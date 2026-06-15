import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'
import { notifyBrokerForLead } from '@/lib/qualifier'
import { safeJsonParse } from '@/lib/format'
import type { LeadRequirements } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/agent/update-lead { phone, requirements?, aiSummary?, score?, leadName?, markWarm?, markCold? }
// Tool backend for cx-agent's update_lead_requirements / mark_lead_warm.
// Persists what the brain learned; a WARM transition fires the broker alert
// through the same path the built-in qualifier uses.
export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: {
    phone?: string
    requirements?: LeadRequirements
    aiSummary?: string
    score?: number
    leadName?: string
    markWarm?: boolean
    markCold?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  if (!phone) return NextResponse.json({ error: 'Valid phone required.' }, { status: 400 })

  const lead = await db.lead.findUnique({ where: { phone } })
  if (!lead) return NextResponse.json({ error: 'Lead not found — call /api/agent/context first.' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.requirements) {
    const merged = { ...safeJsonParse<LeadRequirements>(lead.requirements, {}), ...body.requirements }
    data.requirements = JSON.stringify(merged)
  }
  if (typeof body.aiSummary === 'string' && body.aiSummary.trim()) data.aiSummary = body.aiSummary.trim().slice(0, 1000)
  if (typeof body.score === 'number' && Number.isFinite(body.score)) data.score = Math.max(0, Math.min(100, Math.round(body.score)))
  if (typeof body.leadName === 'string' && body.leadName.trim() && !lead.name) data.name = body.leadName.trim()

  let newStatus = lead.status
  if (body.markWarm && !['WARM', 'VISIT_SCHEDULED', 'CLOSED'].includes(lead.status)) newStatus = 'WARM'
  if (body.markCold && !['CLOSED', 'LOST', 'VISIT_SCHEDULED'].includes(lead.status)) newStatus = 'COLD'
  if (newStatus !== lead.status) data.status = newStatus

  await db.lead.update({ where: { id: lead.id }, data })

  let brokerAlert: string | null = null
  if (newStatus !== lead.status) {
    await db.activity.create({
      data: { type: 'STATUS_CHANGE', description: `Status: ${lead.status} → ${newStatus} (AI agent)`, leadId: lead.id },
    })
    if (newStatus === 'WARM' && !lead.brokerNotified) {
      brokerAlert = await notifyBrokerForLead(lead.id, true)
    }
  }

  return NextResponse.json({ ok: true, status: newStatus, brokerAlerted: Boolean(brokerAlert) })
}
