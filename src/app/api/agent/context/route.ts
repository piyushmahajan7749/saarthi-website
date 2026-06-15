import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'
import { propertyUrl } from '@/lib/whatsapp'
import { todayContextIST } from '@/lib/scheduling'
import { formatPrice, safeJsonParse } from '@/lib/format'
import type { LeadRequirements } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/agent/context { phone, profileName?, inboundText? }
// Called by cx-agent at the start of every WhatsApp turn:
//   - ensures the Lead exists (creates + LEAD_CREATED activity if new)
//   - records the inbound message in the CRM transcript (when inboundText given)
//   - returns everything the brain needs: requirements, status, matches already
//     sent (with website URLs), open visit, and IST date context for the
//     never-same-day scheduling rule.
export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: { phone?: string; profileName?: string; inboundText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  if (!phone || phone.length < 10) return NextResponse.json({ error: 'Valid phone required.' }, { status: 400 })

  let lead = await db.lead.findUnique({ where: { phone } })
  const isNew = !lead
  if (!lead) {
    lead = await db.lead.create({
      data: { phone, name: body.profileName?.trim() || null, source: 'WHATSAPP', status: 'NEW' },
    })
    await db.activity.create({
      data: { type: 'LEAD_CREATED', description: `New WhatsApp lead from +${phone} (via cx-agent)`, leadId: lead.id },
    })
  }

  if (typeof body.inboundText === 'string' && body.inboundText.trim()) {
    await db.message.create({
      data: { leadId: lead.id, direction: 'INBOUND', channel: 'WHATSAPP', content: body.inboundText.trim().slice(0, 4000) },
    })
    if (lead.status === 'NEW') {
      lead = await db.lead.update({ where: { id: lead.id }, data: { status: 'QUALIFYING' } })
    }
  }

  const [matches, openVisit] = await Promise.all([
    db.leadMatch.findMany({ where: { leadId: lead.id }, include: { property: true }, orderBy: { sentAt: 'desc' } }),
    db.visit.findFirst({ where: { leadId: lead.id, status: { in: ['PROPOSED', 'TENTATIVE', 'CONFIRMED'] } }, orderBy: { createdAt: 'desc' } }),
  ])

  const { todayLabel, tomorrowISO } = todayContextIST(new Date())
  const requirements = safeJsonParse<LeadRequirements>(lead.requirements, {})

  return NextResponse.json({
    leadId: lead.id,
    isNew,
    name: lead.name,
    status: lead.status,
    score: lead.score,
    requirements,
    aiSummary: lead.aiSummary,
    brokerNotified: lead.brokerNotified,
    sentMatches: matches.map((m) => ({
      id: m.propertyId,
      title: m.property.title,
      priceLabel: formatPrice(m.property.price, m.property.listingFor),
      locality: m.property.locality,
      url: propertyUrl(m.propertyId),
      sentAt: m.sentAt.toISOString(),
    })),
    openVisit: openVisit
      ? { id: openVisit.id, status: openVisit.status, scheduledFor: openVisit.scheduledFor?.toISOString() ?? null }
      : null,
    todayLabel,
    tomorrowISO,
  })
}
