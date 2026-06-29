import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'
import { findMatches } from '@/lib/matching'
import { propertyUrl } from '@/lib/whatsapp'
import { formatPrice, formatArea, safeJsonParse } from '@/lib/format'
import type { LeadRequirements } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/agent/search { phone, requirements?, limit?, record? }
// Tool backend for cx-agent's search_properties:
//   - merges + persists any newly-learned requirements onto the lead
//   - finds top ACTIVE matches (excluding ones already sent)
//   - when record!=false: writes LeadMatch rows + transcript marker + activity,
//     and bumps QUALIFYING → MATCHED — identical bookkeeping to the built-in bot.
// Returns structured matches with website URLs for the bot to message.
export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: { phone?: string; requirements?: LeadRequirements; limit?: number; record?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  if (!phone) return NextResponse.json({ error: 'Valid phone required.' }, { status: 400 })

  const lead = await db.lead.findUnique({ where: { phone } })
  if (!lead) return NextResponse.json({ error: 'Lead not found — call /api/agent/context first.' }, { status: 404 })

  // Merge newly-learned requirements into the lead before searching.
  const existing = safeJsonParse<LeadRequirements>(lead.requirements, {})
  const merged: LeadRequirements = { ...existing, ...(body.requirements ?? {}) }
  if (body.requirements) {
    await db.lead.update({ where: { id: lead.id }, data: { requirements: JSON.stringify(merged) } })
  }

  const already = await db.leadMatch.findMany({ where: { leadId: lead.id }, select: { propertyId: true } })
  const matches = await findMatches(merged, {
    excludePropertyIds: already.map((m) => m.propertyId),
    limit: Math.min(Math.max(body.limit ?? 3, 1), 5),
  })

  const record = body.record !== false
  if (record && matches.length) {
    for (const m of matches) {
      await db.leadMatch.create({ data: { leadId: lead.id, propertyId: m.property.id, score: m.score } })
    }
    await db.message.create({
      data: {
        leadId: lead.id,
        direction: 'OUTBOUND',
        channel: 'SYSTEM',
        content: `[MATCHES SENT: ${matches.map((m) => m.property.title).join(' | ')}]`,
      },
    })
    await db.activity.create({
      data: { type: 'MATCHES_SENT', description: `Sent ${matches.length} matching properties (via cx-agent)`, leadId: lead.id },
    })
    if (['NEW', 'QUALIFYING'].includes(lead.status)) {
      await db.lead.update({ where: { id: lead.id }, data: { status: 'MATCHED' } })
    }
  }

  return NextResponse.json({
    count: matches.length,
    matches: matches.map((m) => ({
      id: m.property.id,
      title: m.property.title,
      priceLabel: formatPrice(m.property.price, m.property.listingFor),
      bhk: m.property.bhk,
      area: m.property.area != null ? formatArea(m.property.area, m.property.areaUnit) : null,
      locality: m.property.locality,
      type: m.property.type,
      listingFor: m.property.listingFor,
      url: propertyUrl(m.property.id),
      imageUrls: safeJsonParse<string[]>(m.property.images, []).slice(0, 5),
      videoUrl: safeJsonParse<string[]>(m.property.videos, [])[0] ?? null,
      reasons: m.reasons,
      score: m.score,
    })),
  })
}
