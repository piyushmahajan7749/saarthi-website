// Public website chat endpoint — powers the ChatWidget AI concierge.
// Routes every message through the SAME brain as the WhatsApp bot
// (handleInboundLeadMessage): one lead per browser session (phone = "web:<id>"),
// full qualify → match → schedule pipeline, with deliver:false so replies come
// back to the widget instead of going out over WhatsApp.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { handleInboundLeadMessage } from '@/lib/qualifier'

export const dynamic = 'force-dynamic'

const FALLBACK = 'Sorry, thodi technical dikkat aa gayi — please try again, ya WhatsApp par +91 96307 07498 pe message karein. 🙏'

export async function POST(req: Request) {
  let body: { message?: unknown; sessionId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : ''
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  // Stable per-browser session id keys the lead/conversation across messages.
  const raw = typeof body.sessionId === 'string' ? body.sessionId.replace(/[^a-zA-Z0-9_-]/g, '') : ''
  const sessionId = raw.slice(0, 48) || crypto.randomUUID()
  const webPhone = `web:${sessionId}`

  try {
    const turnStart = new Date()
    const result = await handleInboundLeadMessage({
      phone: webPhone,
      text: message,
      deliver: false,
      channel: 'WEBSITE',
    })

    // Property matches the bot sent THIS turn → render as cards (instead of the
    // WhatsApp-formatted text blob, which we drop from the web reply).
    const freshMatches = await db.leadMatch.findMany({
      where: { leadId: result.leadId, sentAt: { gte: turnStart } },
      include: { property: true },
      orderBy: { sentAt: 'desc' },
      take: 3,
    })
    const properties = freshMatches.map((m) => ({
      id: m.property.id,
      title: m.property.title,
      price: m.property.price,
      listingFor: m.property.listingFor,
      locality: m.property.locality,
      bhk: m.property.bhk,
      type: m.property.type,
    }))

    // replies[0] is always the conversational line. If we're showing cards, use
    // just that; otherwise include any extra notes (e.g. "no matches yet").
    const reply = properties.length
      ? result.replies[0] || FALLBACK
      : result.replies.filter(Boolean).join('\n\n') || FALLBACK

    return NextResponse.json({ reply, properties, sessionId })
  } catch (err) {
    console.error('[chat] handleInboundLeadMessage failed:', err)
    return NextResponse.json({ reply: FALLBACK, properties: [], sessionId })
  }
}
