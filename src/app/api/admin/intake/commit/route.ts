import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { PROPERTY_TYPES, LISTING_FOR, type ParsedListing } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/admin/intake/commit { batchId, postedById, publish, listings: ParsedListing[] }
// Creates one Property per listing (status ACTIVE if publish else DRAFT), tied
// to the batch. Returns { ok, count, ids }.
export async function POST(req: Request) {
  const session = await getSession()
  let body: { batchId?: string; postedById?: string; publish?: boolean; listings?: ParsedListing[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { batchId, postedById, publish } = body
  const listings = Array.isArray(body.listings) ? body.listings : []
  if (!batchId) return NextResponse.json({ error: 'Missing batch id.' }, { status: 400 })
  if (listings.length === 0) return NextResponse.json({ error: 'No listings selected to commit.' }, { status: 400 })

  const batch = await db.intakeBatch.findUnique({ where: { id: batchId } })
  if (!batch) return NextResponse.json({ error: 'Intake batch not found.' }, { status: 404 })

  const status = publish ? 'ACTIVE' : 'DRAFT'
  const source = batch.source === 'EXCEL' ? 'EXCEL' : 'WHATSAPP'
  const ids: string[] = []

  // Map WhatsApp group sender names -> existing broker Users (case-insensitive),
  // so a listing posted by "Rajan Verma" is credited to that broker if registered.
  const senderNames = Array.from(new Set(listings.map((l) => l.postedByName?.trim()).filter(Boolean) as string[]))
  const allUsers = senderNames.length ? await db.user.findMany({ where: { active: true } }) : []
  const byName = new Map(allUsers.map((u) => [u.name.toLowerCase(), u.id]))

  try {
    for (const l of listings) {
      const type = PROPERTY_TYPES.includes(l.type as never) ? l.type : 'FLAT'
      const listingFor = LISTING_FOR.includes(l.listingFor as never) ? l.listingFor : 'SALE'
      const senderName = l.postedByName?.trim() || null
      const matchedUserId = senderName ? byName.get(senderName.toLowerCase()) ?? null : null
      // Media URLs the admin attached in the review step (optional).
      const lx = l as typeof l & { images?: unknown; videos?: unknown }
      const images = Array.isArray(lx.images) ? lx.images.filter((u) => typeof u === 'string') : []
      const videos = Array.isArray(lx.videos) ? lx.videos.filter((u) => typeof u === 'string') : []
      const created = await db.property.create({
        data: {
          title: (l.title || 'Untitled listing').trim(),
          type,
          listingFor,
          description: l.description ?? '',
          bhk: l.bhk ?? null,
          price: l.price ?? null,
          area: l.area ?? null,
          areaUnit: l.areaUnit || 'sqft',
          furnishing: l.furnishing ?? null,
          locality: l.locality ?? '',
          city: l.city || 'Indore',
          address: l.address ?? '',
          amenities: JSON.stringify(Array.isArray(l.amenities) ? l.amenities : []),
          images: JSON.stringify(images),
          videos: JSON.stringify(videos),
          status,
          source,
          ownerName: l.ownerName ?? null,
          ownerPhone: l.ownerPhone ? String(l.ownerPhone).replace(/\D/g, '') || null : null,
          postedByName: senderName,
          rawText: l.rawText ?? null,
          aiSummary: l.aiSummary ?? null,
          aiNotes: l.aiNotes ?? null,
          aiConfidence: l.aiConfidence ?? null,
          // Credit the matched broker; else the "Post as" selection / current user.
          postedById: matchedUserId || postedById || session?.id || null,
          intakeBatchId: batch.id,
        },
      })
      ids.push(created.id)
      if (publish) {
        await db.activity.create({
          data: { type: 'LISTING_PUBLISHED', description: `Published from intake: ${created.title}`, propertyId: created.id, userId: session?.id ?? null },
        })
      }
    }

    await db.intakeBatch.update({ where: { id: batch.id }, data: { status: 'COMMITTED' } })
    const srcLabel = source === 'EXCEL' ? 'Excel upload' : 'WhatsApp paste'
    await db.activity.create({
      data: {
        type: 'INTAKE',
        description: `Committed ${ids.length} listing${ids.length === 1 ? '' : 's'} from ${srcLabel} (${publish ? 'published' : 'drafts'})`,
        userId: session?.id ?? null,
      },
    })

    return NextResponse.json({ ok: true, count: ids.length, ids })
  } catch (err) {
    console.error('[intake] commit failed:', err)
    return NextResponse.json({ error: 'Could not save listings — please try again.' }, { status: 500 })
  }
}
