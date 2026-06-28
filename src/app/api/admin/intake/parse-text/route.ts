import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { parseListingsFromText } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // GPT-5.5 multi-agent parsing of long chats can take a while

// POST /api/admin/intake/parse-text { text } -> { batchId, listings: ParsedListing[] }
export async function POST(req: Request) {
  let body: { text?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'Paste some text first — kuch toh bhejo!' }, { status: 400 })
  }
  if (text.length > 100_000) {
    return NextResponse.json({ error: 'Text too long — maximum 100,000 characters per parse.' }, { status: 400 })
  }

  try {
    const session = await getSession()
    const listings = await parseListingsFromText(text)
    const batch = await db.intakeBatch.create({
      data: {
        source: 'WHATSAPP',
        rawContent: text.slice(0, 5000),
        status: 'PARSED',
        itemCount: listings.length,
        createdBy: session?.id ?? null,
      },
    })
    return NextResponse.json({ batchId: batch.id, listings })
  } catch (err) {
    console.error('[intake] parse-text failed:', err)
    return NextResponse.json({ error: 'Parsing failed — please try again.' }, { status: 500 })
  }
}
