// End-to-end lead handling. The WhatsApp webhook and the admin Simulator both
// call handleInboundLeadMessage. Admin "Add lead" calls createLeadFromExtraction
// -> initiateLeadConversation. Responsible for: lead upsert, transcript, AI
// qualification, sending matches, tentative visit scheduling, and notifying the
// staff coordinator to take the visit forward with the listing brokers.
import { db } from './db'
import { qualifierTurn } from './ai'
import { findMatches } from './matching'
import {
  formatMatchesMessage,
  formatWarmLeadAlert,
  formatLeadOpener,
  formatVisitCoordinationAlert,
  sendWhatsAppText,
} from './whatsapp'
import { sanitizeProposedSlot, formatSlotIST, todayContextIST } from './scheduling'
import { formatPrice, safeJsonParse } from './format'
import type { LeadRequirements, ExtractedLead } from '@/types'

export interface InboundResult {
  leadId: string
  replies: string[]
  status: string
  brokerAlert: string | null // coordinator/broker alert text, if one fired this turn
  visitScheduled?: { slotText: string; propertyTitles: string[] } | null
}

export function describeRequirements(req: LeadRequirements): string {
  const bits: string[] = []
  if (req.bhk) bits.push(`${req.bhk} BHK`)
  if (req.type && req.type !== 'FLAT') bits.push(req.type.toLowerCase())
  if (req.listingFor) bits.push(req.listingFor === 'RENT' ? 'on rent' : 'to buy')
  if (req.budgetMax) bits.push(`budget ${formatPrice(req.budgetMax, req.listingFor)}`)
  if (req.localities?.length) bits.push(`in ${req.localities.join('/')}`)
  if (req.timeline) bits.push(`timeline: ${req.timeline}`)
  return bits.join(', ') || 'requirements not captured yet'
}

// --- Admin "Add lead" (voice/text) -------------------------------------------

export async function createLeadFromExtraction(args: {
  extracted: ExtractedLead
  createdById?: string | null
  rawNote?: string
  deliver?: boolean
}): Promise<{ leadId: string; opener: string | null; duplicate: boolean }> {
  const { extracted, createdById, rawNote } = args
  const deliver = args.deliver ?? true
  const phone = (extracted.phone || '').replace(/\D/g, '')

  // Upsert by phone when we have one; otherwise always create.
  let lead = phone ? await db.lead.findUnique({ where: { phone } }) : null
  const duplicate = Boolean(lead)
  if (!lead) {
    lead = await db.lead.create({
      data: {
        // Placeholder phone keeps the unique constraint happy when none captured.
        phone: phone || `manual:${Date.now()}`,
        name: extracted.name ?? null,
        source: 'MANUAL',
        status: 'NEW',
        requirements: JSON.stringify(extracted.requirements ?? {}),
        aiSummary: extracted.aiSummary ?? null,
        createdById: createdById ?? null,
      },
    })
  } else {
    lead = await db.lead.update({
      where: { id: lead.id },
      data: {
        name: lead.name ?? extracted.name ?? null,
        requirements: JSON.stringify({ ...safeJsonParse<LeadRequirements>(lead.requirements, {}), ...extracted.requirements }),
        aiSummary: extracted.aiSummary ?? lead.aiSummary,
        createdById: lead.createdById ?? createdById ?? null,
      },
    })
  }

  await db.activity.create({
    data: {
      type: 'LEAD_CREATED',
      description: `Lead added by staff${extracted.notes ? ` — ${extracted.notes}` : ''}${rawNote ? `\nNote: "${rawNote.slice(0, 300)}"` : ''}`,
      leadId: lead.id,
      userId: createdById ?? null,
    },
  })

  // Kick off the WhatsApp qualification if we have a real number.
  let opener: string | null = null
  if (phone && !phone.startsWith('manual:')) {
    opener = await initiateLeadConversation(lead.id, deliver)
  }
  return { leadId: lead.id, opener, duplicate }
}

// Outbound: bot introduces itself and starts gathering requirements.
export async function initiateLeadConversation(leadId: string, deliver = true): Promise<string | null> {
  const lead = await db.lead.findUnique({ where: { id: leadId } })
  if (!lead) return null
  if (lead.phone.startsWith('manual:') || lead.phone.startsWith('web:')) return null

  const opener = formatLeadOpener(lead.name)
  await db.message.create({ data: { leadId: lead.id, direction: 'OUTBOUND', channel: 'WHATSAPP', content: opener } })
  await db.lead.update({
    where: { id: lead.id },
    data: { conversationStarted: true, status: lead.status === 'NEW' ? 'QUALIFYING' : lead.status },
  })
  await db.activity.create({
    data: { type: 'LEAD_INITIATED', description: 'Bot started the WhatsApp qualification conversation', leadId: lead.id },
  })
  if (deliver) await sendWhatsAppText(lead.phone, opener)
  return opener
}

// --- Inbound message pipeline ------------------------------------------------

export async function handleInboundLeadMessage(args: {
  phone: string
  text: string
  profileName?: string | null
  deliver?: boolean
  channel?: 'WHATSAPP' | 'WEBSITE'
}): Promise<InboundResult> {
  const { phone, text, profileName } = args
  const deliver = args.deliver ?? true
  const channel = args.channel ?? 'WHATSAPP'
  const isWeb = channel === 'WEBSITE'
  const msgChannel = isWeb ? 'WEBCHAT' : 'WHATSAPP'
  // Web chat sessions key the lead by an opaque session id (e.g. "web:uuid");
  // WhatsApp keys by the sender's digits.
  const cleanPhone = isWeb ? phone : phone.replace(/\D/g, '')
  const now = new Date()
  const { todayLabel, tomorrowISO } = todayContextIST(now)

  // 1. Upsert lead + store inbound message
  let lead = await db.lead.findUnique({ where: { phone: cleanPhone } })
  const isNew = !lead
  if (!lead) {
    lead = await db.lead.create({ data: { phone: cleanPhone, name: profileName ?? null, source: isWeb ? 'WEBSITE' : 'WHATSAPP', status: 'NEW' } })
    await db.activity.create({ data: { type: 'LEAD_CREATED', description: isWeb ? 'New website chat lead' : `New WhatsApp lead from +${cleanPhone}`, leadId: lead.id } })
  }
  await db.message.create({ data: { leadId: lead.id, direction: 'INBOUND', channel: msgChannel, content: text } })

  if (['CLOSED', 'LOST'].includes(lead.status)) {
    return { leadId: lead.id, replies: [], status: lead.status, brokerAlert: null }
  }

  // 2. Context for the qualifier
  const history = await db.message.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: 'asc' }, take: 40 })
  const requirements = safeJsonParse<LeadRequirements>(lead.requirements, {})
  const priorMatches = await db.leadMatch.findMany({ where: { leadId: lead.id }, include: { property: true } })
  const sentMatches = priorMatches.map((m) => ({ id: m.propertyId, title: m.property.title }))

  const result = await qualifierTurn({
    history: history.slice(0, -1).map((m) => ({ direction: m.direction, content: m.content })),
    incoming: text,
    requirements,
    leadName: lead.name ?? profileName ?? null,
    matchesSentCount: priorMatches.length,
    sentMatches,
    todayLabel,
    tomorrowISO,
  })

  const replies: string[] = [result.reply]

  // 3. Send matches when ready
  if (result.readyForMatches) {
    const matches = await findMatches(result.requirements, {
      excludePropertyIds: priorMatches.map((m) => m.propertyId),
      limit: 3,
    })
    if (matches.length) {
      replies.push(formatMatchesMessage(matches.map((m) => ({ property: m.property, reasons: m.reasons })), result.leadName ?? lead.name))
      for (const m of matches) {
        await db.leadMatch.create({ data: { leadId: lead.id, propertyId: m.property.id, score: m.score } })
        sentMatches.push({ id: m.property.id, title: m.property.title })
      }
      await db.message.create({ data: { leadId: lead.id, direction: 'OUTBOUND', channel: 'SYSTEM', content: `[MATCHES SENT: ${matches.map((m) => m.property.title).join(' | ')}]` } })
      await db.activity.create({ data: { type: 'MATCHES_SENT', description: `Sent ${matches.length} matching properties`, leadId: lead.id } })
    } else if (priorMatches.length === 0) {
      replies.push('Filhaal aapke exact requirements ki properties available nahi hain, lekin maine requirement save kar li hai — jaise hi kuch aata hai turant bhejunga! 🙏')
    }
  }

  // 4. Visit scheduling (step 5): lead likes a property & wants to visit.
  let brokerAlert: string | null = null
  let visitScheduled: InboundResult['visitScheduled'] = null
  let newStatus = lead.status
  if (isNew || lead.status === 'NEW') newStatus = 'QUALIFYING'
  if (sentMatches.length && newStatus === 'QUALIFYING') newStatus = 'MATCHED'

  const slot = result.readyToSchedule ? sanitizeProposedSlot(result.proposedSlotISO, now) : null
  if (slot) {
    // Which properties? validated against what we actually sent.
    const sentIds = new Set(sentMatches.map((m) => m.id))
    let pickedIds = result.interestedPropertyIds.filter((id) => sentIds.has(id))
    if (pickedIds.length === 0 && sentMatches.length) pickedIds = [sentMatches[0].id]

    const { visit, alert } = await scheduleTentativeVisit({
      leadId: lead.id,
      propertyIds: pickedIds,
      slot,
      availabilityText: result.availabilityText,
      summary: result.aiSummary,
      leadName: result.leadName ?? lead.name,
      leadPhone: cleanPhone,
      deliver,
    })
    if (visit) {
      newStatus = 'VISIT_SCHEDULED'
      brokerAlert = alert
      const titles = await db.property.findMany({ where: { id: { in: pickedIds } }, select: { title: true } })
      visitScheduled = { slotText: formatSlotIST(slot), propertyTitles: titles.map((t) => t.title) }
    }
  } else if (result.suggestWarm && !['WARM', 'VISIT_SCHEDULED'].includes(newStatus)) {
    newStatus = 'WARM'
  }

  // 5. Persist lead
  await db.lead.update({
    where: { id: lead.id },
    data: {
      name: lead.name ?? result.leadName ?? profileName ?? null,
      requirements: JSON.stringify(result.requirements),
      aiSummary: result.aiSummary,
      score: result.score,
      status: newStatus,
    },
  })
  if (newStatus !== lead.status) {
    await db.activity.create({
      data: { type: 'STATUS_CHANGE', description: `Status: ${lead.status} → ${newStatus} (AI qualifier)`, leadId: lead.id },
    })
  }
  // Warm (non-visit) path still pings the broker, as before.
  if (newStatus === 'WARM' && lead.status !== 'WARM' && !lead.brokerNotified) {
    brokerAlert = await notifyBroker(lead.id, result.leadName ?? lead.name, cleanPhone, result.aiSummary, describeRequirements(result.requirements), deliver)
  }

  // 6. Store + deliver replies
  for (const r of replies) {
    if (!r.startsWith('[MATCHES SENT')) {
      await db.message.create({ data: { leadId: lead.id, direction: 'OUTBOUND', channel: msgChannel, content: r } })
    }
    if (deliver) await sendWhatsAppText(cleanPhone, r)
  }

  return { leadId: lead.id, replies, status: newStatus, brokerAlert, visitScheduled }
}

// Create/refresh a tentative Visit and alert the coordinator (the staff member
// who added the lead). They take it forward with the listing brokers.
// Exported: the Agent API (/api/agent/visit) reuses this so the external
// WhatsApp brain (cx-agent) gets identical rules — incl. never-same-day.
export async function scheduleTentativeVisit(args: {
  leadId: string
  propertyIds: string[]
  slot: Date
  availabilityText: string | null
  summary: string
  leadName: string | null
  leadPhone: string
  deliver: boolean
}): Promise<{ visit: { id: string } | null; alert: string | null }> {
  const { leadId, propertyIds, slot, availabilityText, summary, leadName, leadPhone, deliver } = args
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { assignedTo: true, createdBy: true } })
  if (!lead) return { visit: null, alert: null }

  // Coordinator = whoever added the lead; fall back to assigned broker, then the
  // broker who posted the top picked property, then any admin.
  const props = await db.property.findMany({ where: { id: { in: propertyIds } }, include: { postedBy: true } })
  const poster = props.find((p) => p.postedBy)?.postedBy ?? null
  let coordinator = lead.createdBy ?? lead.assignedTo ?? poster ?? null
  if (!coordinator && lead.createdById) coordinator = await db.user.findUnique({ where: { id: lead.createdById } })
  if (!coordinator) coordinator = await db.user.findFirst({ where: { role: 'ADMIN', active: true } })

  // Reuse an open visit if one exists.
  const open = await db.visit.findFirst({ where: { leadId, status: { in: ['PROPOSED', 'TENTATIVE'] } } })
  const visit = open
    ? await db.visit.update({
        where: { id: open.id },
        data: { propertyIds: JSON.stringify(propertyIds), scheduledFor: slot, availabilityText, status: 'TENTATIVE', coordinatorId: coordinator?.id ?? null },
      })
    : await db.visit.create({
        data: {
          leadId, status: 'TENTATIVE', propertyIds: JSON.stringify(propertyIds), scheduledFor: slot,
          availabilityText, coordinatorId: coordinator?.id ?? null,
        },
      })

  await db.activity.create({
    data: { type: 'VISIT_PROPOSED', description: `Tentative visit ${formatSlotIST(slot)} for ${propertyIds.length} propert${propertyIds.length === 1 ? 'y' : 'ies'}`, leadId },
  })

  // Alert the coordinator.
  let alert: string | null = null
  if (coordinator && !visit.coordinatorNotified) {
    alert = formatVisitCoordinationAlert({
      leadName,
      leadPhone,
      slotText: formatSlotIST(slot),
      summary,
      properties: props.map((p) => ({ title: p.title, id: p.id, postedBy: p.postedBy?.name ?? p.postedByName ?? null })),
    })
    if (deliver) await sendWhatsAppText(coordinator.phone, alert)
    await db.visit.update({ where: { id: visit.id }, data: { coordinatorNotified: true } })
    await db.lead.update({ where: { id: leadId }, data: { assignedToId: lead.assignedToId ?? coordinator.id } })
    await db.activity.create({
      data: { type: 'BROKER_NOTIFIED', description: `Visit coordination sent to ${coordinator.name} (+${coordinator.phone})`, leadId, userId: coordinator.id },
    })
  }
  return { visit, alert }
}

// --- Manual warm-marking from the CRM ---------------------------------------

export async function notifyBrokerForLead(leadId: string, deliver = true): Promise<string | null> {
  const lead = await db.lead.findUnique({ where: { id: leadId } })
  if (!lead || lead.brokerNotified) return null
  const req = safeJsonParse<LeadRequirements>(lead.requirements, {})
  return notifyBroker(lead.id, lead.name, lead.phone, lead.aiSummary ?? 'Marked warm by admin', describeRequirements(req), deliver)
}

async function notifyBroker(
  leadId: string,
  leadName: string | null,
  leadPhone: string,
  summary: string,
  requirementsText: string,
  deliver: boolean
): Promise<string | null> {
  const topMatch = await db.leadMatch.findFirst({ where: { leadId }, orderBy: { score: 'desc' }, include: { property: { include: { postedBy: true } } } })
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { assignedTo: true, createdBy: true } })
  let broker = lead?.createdBy ?? topMatch?.property.postedBy ?? lead?.assignedTo ?? null
  if (!broker) broker = await db.user.findFirst({ where: { role: 'ADMIN', active: true } })
  if (!broker) return null

  const alert = formatWarmLeadAlert({
    leadName, leadPhone, summary, requirements: requirementsText,
    topProperty: topMatch ? { title: topMatch.property.title, id: topMatch.property.id } : null,
  })
  if (deliver) await sendWhatsAppText(broker.phone, alert)
  await db.lead.update({ where: { id: leadId }, data: { brokerNotified: true, assignedToId: lead?.assignedToId ?? broker.id } })
  await db.activity.create({
    data: { type: 'BROKER_NOTIFIED', description: `Warm-lead alert sent to ${broker.name} (+${broker.phone})`, leadId, userId: broker.id },
  })
  return alert
}
