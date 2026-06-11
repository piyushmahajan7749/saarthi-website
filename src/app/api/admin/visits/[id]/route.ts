import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { VISIT_STATUSES } from '@/types'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/visits/[id] { status?, notes?, feedback?, scheduledFor? }
// The coordinator uses this after talking to the broker — confirm/reschedule/
// cancel a tentative visit, log feedback. Returns { visit }.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  let body: { status?: string; notes?: string; feedback?: string; scheduledFor?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const visit = await db.visit.findUnique({ where: { id: params.id } })
  if (!visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.status && VISIT_STATUSES.includes(body.status as never)) data.status = body.status
  if (typeof body.notes === 'string') data.notes = body.notes
  if (typeof body.feedback === 'string') data.feedback = body.feedback
  if (body.scheduledFor) {
    const d = new Date(body.scheduledFor)
    if (!isNaN(d.getTime())) data.scheduledFor = d
  }

  try {
    const updated = await db.visit.update({ where: { id: visit.id }, data })
    if (data.status && data.status !== visit.status) {
      const type = data.status === 'CONFIRMED' ? 'VISIT_CONFIRMED' : data.status === 'COMPLETED' ? 'FEEDBACK' : 'STATUS_CHANGE'
      await db.activity.create({
        data: { type, description: `Visit ${visit.status} → ${data.status} (by ${session?.name ?? 'admin'})`, leadId: visit.leadId, userId: session?.id ?? null },
      })
      // Confirming the visit promotes the lead; cancelling reopens it.
      if (data.status === 'CONFIRMED') await db.lead.update({ where: { id: visit.leadId }, data: { status: 'VISIT_SCHEDULED' } })
    }
    if (typeof body.feedback === 'string' && body.feedback.trim()) {
      await db.activity.create({ data: { type: 'FEEDBACK', description: `Visit feedback: ${body.feedback.trim()}`, leadId: visit.leadId, userId: session?.id ?? null } })
    }
    return NextResponse.json({ visit: updated })
  } catch (err) {
    console.error('[admin/visits] patch failed:', err)
    return NextResponse.json({ error: 'Could not update visit.' }, { status: 500 })
  }
}
