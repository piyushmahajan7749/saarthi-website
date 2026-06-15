import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'
import { scheduleTentativeVisit } from '@/lib/qualifier'
import { sanitizeProposedSlot, defaultProposedSlots, formatSlotIST } from '@/lib/scheduling'

export const dynamic = 'force-dynamic'

// POST /api/agent/visit { phone, propertyIds?, slotISO?, availabilityText? }
// Tool backend for cx-agent's schedule_visit. The NEVER-SAME-DAY rule is
// enforced HERE (server-side): an invalid/same-day/absent slotISO falls back
// to the default tomorrow-or-later slot, so the LLM can't book today even if
// it hallucinates a date. Creates/refreshes the tentative Visit, alerts the
// coordinator, and moves the lead to VISIT_SCHEDULED.
export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: { phone?: string; propertyIds?: string[]; slotISO?: string; availabilityText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  if (!phone) return NextResponse.json({ error: 'Valid phone required.' }, { status: 400 })

  const theLead = await db.lead.findUnique({ where: { phone } })
  if (!theLead) return NextResponse.json({ error: 'Lead not found — call /api/agent/context first.' }, { status: 404 })

  // Validate picked properties against what was actually sent to this lead.
  const sent = await db.leadMatch.findMany({ where: { leadId: theLead.id }, select: { propertyId: true }, orderBy: { score: 'desc' } })
  const sentIds = new Set(sent.map((s) => s.propertyId))
  let pickedIds = (body.propertyIds ?? []).filter((id) => sentIds.has(id))
  if (pickedIds.length === 0 && sent.length > 0) pickedIds = [sent[0].propertyId]
  if (pickedIds.length === 0) {
    return NextResponse.json({ error: 'No matched properties to visit — send matches first via /api/agent/search.' }, { status: 409 })
  }

  // Never-same-day, enforced server-side.
  const now = new Date()
  const slot = sanitizeProposedSlot(body.slotISO, now) ?? defaultProposedSlots(now)[0]

  const { visit, alert } = await scheduleTentativeVisit({
    leadId: theLead.id,
    propertyIds: pickedIds,
    slot,
    availabilityText: body.availabilityText?.trim() || null,
    summary: theLead.aiSummary ?? 'Qualified via WhatsApp agent',
    leadName: theLead.name,
    leadPhone: phone,
    deliver: true,
  })
  if (!visit) return NextResponse.json({ error: 'Could not schedule the visit.' }, { status: 500 })

  if (theLead.status !== 'VISIT_SCHEDULED') {
    await db.lead.update({ where: { id: theLead.id }, data: { status: 'VISIT_SCHEDULED' } })
    await db.activity.create({
      data: { type: 'STATUS_CHANGE', description: `Status: ${theLead.status} → VISIT_SCHEDULED (AI agent)`, leadId: theLead.id },
    })
  }

  const titles = await db.property.findMany({ where: { id: { in: pickedIds } }, select: { title: true } })

  return NextResponse.json({
    ok: true,
    visitId: visit.id,
    slotText: formatSlotIST(slot),
    scheduledForISO: slot.toISOString(),
    propertyTitles: titles.map((t) => t.title),
    coordinatorAlerted: Boolean(alert),
  })
}
