import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createLeadFromExtraction } from '@/lib/qualifier'
import type { ExtractedLead } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/leads { extracted: ExtractedLead, rawNote?: string }
// Creates the lead (assigned to the staff member who added it) and, if a phone
// is present, kicks off the outbound WhatsApp qualification.
// Returns { leadId, opener, duplicate }.
export async function POST(req: Request) {
  const session = await getSession()
  let body: { extracted?: ExtractedLead; rawNote?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const extracted = body.extracted
  if (!extracted || typeof extracted !== 'object') {
    return NextResponse.json({ error: 'Missing lead details.' }, { status: 400 })
  }
  if (!extracted.name && !extracted.phone && !extracted.requirements) {
    return NextResponse.json({ error: 'Lead needs at least a name, phone, or requirement.' }, { status: 400 })
  }

  try {
    const result = await createLeadFromExtraction({
      extracted,
      createdById: session?.id ?? null,
      rawNote: body.rawNote,
      deliver: true,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/leads] create failed:', err)
    return NextResponse.json({ error: 'Could not create the lead — please try again.' }, { status: 500 })
  }
}
