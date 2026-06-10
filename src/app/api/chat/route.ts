// Public website chat endpoint — powers the ChatWidget AI concierge.
// Loads live inventory, runs a webChatTurn (AI or graceful fallback) and
// silently captures leads when the visitor shares a phone number.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { webChatTurn } from '@/lib/ai'

export const dynamic = 'force-dynamic'

type HistoryItem = { role: 'user' | 'assistant'; content: string }

function sanitizeHistory(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is { role: string; content: string } => {
      if (!m || typeof m !== 'object') return false
      const item = m as Record<string, unknown>
      return (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
    })
    .slice(-20)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, 1000) }))
}

export async function POST(req: Request) {
  let body: { message?: unknown; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : ''
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }
  const history = sanitizeHistory(body.history)

  // Live inventory context for the AI — compact to keep the prompt small.
  const inventory = await db.property.findMany({
    where: { status: 'ACTIVE' },
    orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    take: 60,
  })
  const compact = inventory.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    listingFor: p.listingFor,
    bhk: p.bhk,
    price: p.price,
    area: p.area,
    locality: p.locality,
  }))

  const result = await webChatTurn({
    history,
    incoming: message,
    inventoryContext: JSON.stringify(compact),
  })

  // Lead capture — best effort, must never break the chat itself.
  if (result.capturedPhone) {
    try {
      let digits = result.capturedPhone.replace(/\D/g, '')
      if (digits.length === 10) digits = `91${digits}`
      if (digits.length >= 11 && digits.length <= 15) {
        const existing = await db.lead.findUnique({ where: { phone: digits } })
        let leadId: string
        if (existing) {
          const updated = await db.lead.update({
            where: { phone: digits },
            data: { name: result.capturedName ?? existing.name },
          })
          leadId = updated.id
        } else {
          const created = await db.lead.create({
            data: {
              phone: digits,
              name: result.capturedName ?? null,
              source: 'WEBSITE',
              status: 'NEW',
            },
          })
          leadId = created.id
          await db.activity.create({
            data: { type: 'LEAD_CREATED', description: 'Website chat lead', leadId },
          })
        }
        await db.message.create({
          data: { leadId, direction: 'INBOUND', channel: 'WEBCHAT', content: message },
        })
        await db.message.create({
          data: { leadId, direction: 'OUTBOUND', channel: 'WEBCHAT', content: result.reply },
        })
      }
    } catch (err) {
      console.error('[chat] lead capture failed (non-fatal):', err)
    }
  }

  // Resolve AI-suggested property ids against the inventory we actually loaded.
  const byId = new Map(inventory.map((p) => [p.id, p]))
  const properties = (result.propertyIds || [])
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      listingFor: p.listingFor,
      locality: p.locality,
      bhk: p.bhk,
      type: p.type,
    }))

  return NextResponse.json({ reply: result.reply, properties })
}
