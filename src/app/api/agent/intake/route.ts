import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'
import { parseListingsFromText } from '@/lib/ai'
import type { ParsedListing } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/agent/intake
// Called by cx-agent when a broker posts a listing in the WhatsApp group.
// Parses text into structured listing fields, creates an ACTIVE Property,
// returns { listingId, title } for the bot to confirm to the broker.
//
// Body: { text: string, senderName?: string, senderPhone?: string, photoUrls?: string[] }

export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: { text?: string; senderName?: string; senderPhone?: string; photoUrls?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const text = (body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'text is required.' }, { status: 400 })

  let listings: ParsedListing[]
  try {
    listings = await parseListingsFromText(text)
  } catch (err) {
    console.error('[agent/intake] parse failed:', err)
    return NextResponse.json({ error: 'Failed to parse listing details.' }, { status: 500 })
  }

  if (!listings || listings.length === 0) {
    return NextResponse.json({ error: 'No listing found in this message.' }, { status: 422 })
  }

  // Take the first parsed listing (broker messages are typically one listing)
  const parsed = listings[0]
  const photoUrls = body.photoUrls ?? []

  // Credit the broker who posted it. Match a registered broker User by phone;
  // otherwise record their name or number so "posted by" is never blank.
  const senderPhone = (body.senderPhone ?? '').replace(/\D/g, '')
  const brokerUser = senderPhone
    ? await db.user.findUnique({ where: { phone: senderPhone } }).catch(() => null)
    : null
  const postedByName =
    brokerUser?.name ?? (body.senderName?.trim() || (senderPhone ? `+${senderPhone}` : null))

  try {
    const property = await db.property.create({
      data: {
        title: (parsed.title || 'Untitled Listing').trim(),
        description: parsed.description ?? '',
        type: parsed.type ?? 'FLAT',
        listingFor: parsed.listingFor ?? 'SALE',
        bhk: parsed.bhk ?? null,
        price: parsed.price ?? null,
        area: parsed.area ?? null,
        areaUnit: parsed.areaUnit ?? 'sqft',
        furnishing: parsed.furnishing ?? null,
        locality: parsed.locality ?? '',
        city: parsed.city ?? 'Indore',
        address: parsed.address ?? '',
        amenities: JSON.stringify(Array.isArray(parsed.amenities) ? parsed.amenities : []),
        images: JSON.stringify(photoUrls),
        videos: JSON.stringify([]),
        ownerName: parsed.ownerName ?? null,
        ownerPhone: parsed.ownerPhone ? String(parsed.ownerPhone).replace(/\D/g, '') || null : null,
        postedById: brokerUser?.id ?? null,
        postedByName,
        rawText: text,
        aiSummary: parsed.aiSummary ?? null,
        aiNotes: parsed.aiNotes ?? null,
        aiConfidence: parsed.aiConfidence ?? null,
        source: 'WHATSAPP',
        status: 'ACTIVE',
      },
    })

    return NextResponse.json({ listingId: property.id, title: property.title })
  } catch (err) {
    console.error('[agent/intake] db.create failed:', err)
    return NextResponse.json({ error: 'Failed to save listing.' }, { status: 500 })
  }
}
