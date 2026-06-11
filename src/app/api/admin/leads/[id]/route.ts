import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { notifyBrokerForLead, initiateLeadConversation } from '@/lib/qualifier'
import { statusLabel } from '@/lib/format'
import { LEAD_STATUSES } from '@/types'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/leads/[id] { status?, assignedToId?, createdById?, note?, action? }
// action: 'initiate' (re)starts the outbound WhatsApp qualification.
// Returns { lead, brokerAlert?, opener? }.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  let body: { status?: string; assignedToId?: string | null; createdById?: string | null; note?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const lead = await db.lead.findUnique({ where: { id: params.id } })
  if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

  const actor = session?.name ?? 'admin'
  let brokerAlert: string | null = null
  let opener: string | null = null

  try {
    // ---- start/restart conversation ----
    if (body.action === 'initiate') {
      opener = await initiateLeadConversation(lead.id, true)
    }

    // ---- coordinator (who added/owns the lead) ----
    if (Object.prototype.hasOwnProperty.call(body, 'createdById')) {
      await db.lead.update({ where: { id: lead.id }, data: { createdById: body.createdById || null } })
    }
    // ---- note ----
    if (typeof body.note === 'string' && body.note.trim()) {
      await db.activity.create({
        data: { type: 'NOTE', description: body.note.trim(), leadId: lead.id, userId: session?.id ?? null },
      })
    }

    // ---- assignment ----
    if (Object.prototype.hasOwnProperty.call(body, 'assignedToId')) {
      const assignedToId = body.assignedToId || null
      await db.lead.update({ where: { id: lead.id }, data: { assignedToId } })
      if (assignedToId !== lead.assignedToId) {
        const broker = assignedToId ? await db.user.findUnique({ where: { id: assignedToId } }) : null
        await db.activity.create({
          data: {
            type: 'NOTE',
            description: broker ? `Assigned to ${broker.name} by ${actor}` : `Unassigned by ${actor}`,
            leadId: lead.id,
            userId: session?.id ?? null,
          },
        })
      }
    }

    // ---- status ----
    if (body.status && LEAD_STATUSES.includes(body.status as never) && body.status !== lead.status) {
      const next = body.status
      await db.lead.update({ where: { id: lead.id }, data: { status: next } })
      await db.activity.create({
        data: {
          type: next === 'VISIT_SCHEDULED' ? 'VISIT_SCHEDULED' : 'STATUS_CHANGE',
          description: `Status: ${statusLabel(lead.status)} → ${statusLabel(next)} (by ${actor})`,
          leadId: lead.id,
          userId: session?.id ?? null,
        },
      })
      if (next === 'WARM' && !lead.brokerNotified) {
        brokerAlert = await notifyBrokerForLead(lead.id, true)
      }
    }

    const updated = await db.lead.findUnique({ where: { id: lead.id } })
    return NextResponse.json({ lead: updated, brokerAlert, opener })
  } catch (err) {
    console.error('[admin/leads] patch failed:', err)
    return NextResponse.json({ error: 'Could not update lead — please try again.' }, { status: 500 })
  }
}
