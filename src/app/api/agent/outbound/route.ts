import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'

export const dynamic = 'force-dynamic'

// POST /api/agent/outbound { phone, text }
// cx-agent records every reply it sends here so the CRM transcript stays
// complete (cx-agent does its own WhatsApp delivery).
export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: { phone?: string; text?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  const text = String(body.text ?? '').trim()
  if (!phone || !text) return NextResponse.json({ error: 'phone and text required.' }, { status: 400 })

  const lead = await db.lead.findUnique({ where: { phone } })
  if (!lead) return NextResponse.json({ error: 'Lead not found — call /api/agent/context first.' }, { status: 404 })

  await db.message.create({
    data: { leadId: lead.id, direction: 'OUTBOUND', channel: 'WHATSAPP', content: text.slice(0, 4000) },
  })
  return NextResponse.json({ ok: true })
}
