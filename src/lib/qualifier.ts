// End-to-end handling of one inbound lead message (WhatsApp webhook and the
// admin Simulator both call this). Responsible for: lead upsert, transcript,
// AI qualification, sending matches, warm-lead promotion + broker alert.
import { db } from './db'
import { qualifierTurn } from './ai'
import { findMatches } from './matching'
import { formatMatchesMessage, formatWarmLeadAlert, sendWhatsAppText } from './whatsapp'
import { formatPrice, safeJsonParse } from './format'
import type { LeadRequirements } from '@/types'

export interface InboundResult {
  leadId: string
  replies: string[] // messages sent back to the lead (in order)
  status: string
  brokerAlert: string | null // alert text sent to broker (if warm transition happened)
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

// channel: WHATSAPP (real + simulator). `deliver`=false suppresses real sends (simulator).
export async function handleInboundLeadMessage(args: {
  phone: string
  text: string
  profileName?: string | null
  deliver?: boolean
}): Promise<InboundResult> {
  const { phone, text, profileName } = args
  const deliver = args.deliver ?? true
  const cleanPhone = phone.replace(/\D/g, '')

  // 1. Upsert lead + store inbound message
  let lead = await db.lead.findUnique({ where: { phone: cleanPhone } })
  const isNew = !lead
  if (!lead) {
    lead = await db.lead.create({
      data: { phone: cleanPhone, name: profileName ?? null, source: 'WHATSAPP', status: 'NEW' },
    })
    await db.activity.create({
      data: { type: 'LEAD_CREATED', description: `New WhatsApp lead from +${cleanPhone}`, leadId: lead.id },
    })
  }
  await db.message.create({
    data: { leadId: lead.id, direction: 'INBOUND', channel: 'WHATSAPP', content: text },
  })

  // Closed/lost leads: humans own the conversation, the bot stays quiet.
  if (['CLOSED', 'LOST'].includes(lead.status)) {
    return { leadId: lead.id, replies: [], status: lead.status, brokerAlert: null }
  }

  // 2. Run the qualifier
  const history = await db.message.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'asc' },
    take: 40,
  })
  const requirements = safeJsonParse<LeadRequirements>(lead.requirements, {})
  const matchesSentCount = await db.leadMatch.count({ where: { leadId: lead.id } })

  const result = await qualifierTurn({
    history: history.slice(0, -1).map((m) => ({ direction: m.direction, content: m.content })),
    incoming: text,
    requirements,
    leadName: lead.name ?? profileName ?? null,
    matchesSentCount,
  })

  const replies: string[] = [result.reply]

  // 3. Send matches when ready
  let matchesSentNow = 0
  if (result.readyForMatches) {
    const already = await db.leadMatch.findMany({ where: { leadId: lead.id }, select: { propertyId: true } })
    const matches = await findMatches(result.requirements, {
      excludePropertyIds: already.map((m) => m.propertyId),
      limit: 3,
    })
    if (matches.length) {
      const msg = formatMatchesMessage(
        matches.map((m) => ({ property: m.property, reasons: m.reasons })),
        result.leadName ?? lead.name
      )
      replies.push(msg)
      matchesSentNow = matches.length
      for (const m of matches) {
        await db.leadMatch.create({ data: { leadId: lead.id, propertyId: m.property.id, score: m.score } })
      }
      await db.message.create({
        data: { leadId: lead.id, direction: 'OUTBOUND', channel: 'SYSTEM', content: `[MATCHES SENT: ${matches.map((m) => m.property.title).join(' | ')}]` },
      })
      await db.activity.create({
        data: { type: 'MATCHES_SENT', description: `Sent ${matches.length} matching properties`, leadId: lead.id },
      })
    } else if (matchesSentCount === 0) {
      replies.push(
        'Filhaal aapke exact requirements ki properties available nahi hain, lekin maine aapki requirement save kar li hai — jaise hi kuch aata hai main turant bhejunga! 🙏'
      )
    }
  }

  // 4. Status progression
  let newStatus = lead.status
  if (isNew || lead.status === 'NEW') newStatus = 'QUALIFYING'
  let brokerAlert: string | null = null

  if (result.suggestWarm && !['WARM', 'VISIT_SCHEDULED'].includes(lead.status)) {
    newStatus = 'WARM'
  }

  // 5. Persist lead updates
  const updated = await db.lead.update({
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
      data: { type: 'STATUS_CHANGE', description: `Status: ${lead.status} → ${newStatus}${newStatus === 'WARM' ? ' (auto, by AI qualifier)' : ''}`, leadId: lead.id },
    })
  }

  // 6. Warm transition → notify broker (the one who posted their top match, else any admin)
  if (newStatus === 'WARM' && lead.status !== 'WARM' && !lead.brokerNotified) {
    brokerAlert = await notifyBroker(lead.id, updated.name, cleanPhone, result.aiSummary, describeRequirements(result.requirements), deliver)
  }

  // 7. Store + deliver outbound replies
  for (const r of replies) {
    if (!r.startsWith('[MATCHES SENT')) {
      await db.message.create({ data: { leadId: lead.id, direction: 'OUTBOUND', channel: 'WHATSAPP', content: r } })
    }
    if (deliver) await sendWhatsAppText(cleanPhone, r)
  }

  return { leadId: lead.id, replies, status: newStatus, brokerAlert }
}

// Manual warm-marking from the CRM also alerts the broker. Returns alert text or null.
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
  // Prefer the broker who posted the lead's best match; fall back to assigned broker, then any admin.
  const topMatch = await db.leadMatch.findFirst({
    where: { leadId },
    orderBy: { score: 'desc' },
    include: { property: { include: { postedBy: true } } },
  })
  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { assignedTo: true } })
  let broker = topMatch?.property.postedBy ?? lead?.assignedTo ?? null
  if (!broker) broker = await db.user.findFirst({ where: { role: 'ADMIN', active: true } })
  if (!broker) return null

  const alert = formatWarmLeadAlert({
    leadName,
    leadPhone,
    summary,
    requirements: requirementsText,
    topProperty: topMatch ? { title: topMatch.property.title, id: topMatch.property.id } : null,
  })

  if (deliver) await sendWhatsAppText(broker.phone, alert)
  await db.lead.update({ where: { id: leadId }, data: { brokerNotified: true, assignedToId: broker.id } })
  await db.activity.create({
    data: {
      type: 'BROKER_NOTIFIED',
      description: `Warm-lead alert sent to ${broker.name} (+${broker.phone})`,
      leadId,
      userId: broker.id,
    },
  })
  return alert
}
