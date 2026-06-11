import { NextResponse } from 'next/server'
import { extractLeadFromText } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/leads/extract { text } -> { extracted: ExtractedLead }
// Used by the "Add lead" screen to preview the AI extraction before committing.
export async function POST(req: Request) {
  let body: { text?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Describe the lead first (type or record a note).' }, { status: 400 })
  if (text.length > 5000) return NextResponse.json({ error: 'Note too long — keep it under 5000 characters.' }, { status: 400 })

  const extracted = await extractLeadFromText(text)
  return NextResponse.json({ extracted })
}
