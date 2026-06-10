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

  try {
    for (const l of listings) {
      const type = PROPERTY_TYPES.includes(l.type as never) ? l.type : 'FLAT'
      const listingFor = LISTING_FOR.includes(l.listingFor as never) ? l.listingFor : 'SALE'
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
          images: '[]',
          status,
          source,
          ownerName: l.ownerName ?? null,
          ownerPhone: l.ownerPhone ? String(l.ownerPhone).replace(/\D/g, '') || null : null,
          rawText: l.rawText ?? null,
          aiSummary: l.aiSummary ?? null,
          aiNotes: l.aiNotes ?? null,
          aiConfidence: l.aiConfidence ?? null,
          postedById: postedById || session?.id || null,
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
