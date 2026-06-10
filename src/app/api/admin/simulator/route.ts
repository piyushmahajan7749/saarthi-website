import { NextResponse } from 'next/server'
import { handleInboundLeadMessage } from '@/lib/qualifier'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/admin/simulator { phone, text, name? }
// Runs the full inbound pipeline with deliver:false (no real WhatsApp send).
// Returns { leadId, replies, status, brokerAlert }.
export async function POST(req: Request) {
  let body: { phone?: string; text?: string; name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const phone = String(body.phone ?? '').replace(/\D/g, '')
  const text = String(body.text ?? '').trim()
  if (!phone || phone.length < 10) return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Type a message as the buyer.' }, { status: 400 })

  try {
    const result = await handleInboundLeadMessage({
      phone,
      text,
      profileName: body.name?.trim() || null,
      deliver: false,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[simulator] failed:', err)
    return NextResponse.json({ error: 'Simulation failed — please try again.' }, { status: 500 })
  }
}
