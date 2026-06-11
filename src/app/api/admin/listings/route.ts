import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { PROPERTY_TYPES, LISTING_FOR, PROPERTY_STATUSES } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/admin/listings — create a listing. Returns { property }.
export async function POST(req: Request) {
  const session = await getSession()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim()
  const type = String(body.type ?? '')
  const listingFor = String(body.listingFor ?? 'SALE')
  if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!PROPERTY_TYPES.includes(type as never)) return NextResponse.json({ error: 'Invalid property type.' }, { status: 400 })
  if (!LISTING_FOR.includes(listingFor as never)) return NextResponse.json({ error: 'Invalid listing type.' }, { status: 400 })

  const num = (v: unknown): number | null => {
    if (v === '' || v == null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const status = PROPERTY_STATUSES.includes(String(body.status) as never) ? String(body.status) : 'DRAFT'

  try {
    const property = await db.property.create({
      data: {
        title,
        type,
        listingFor,
        description: String(body.description ?? ''),
        bhk: num(body.bhk) == null ? null : Math.round(num(body.bhk)!),
        price: num(body.price),
        area: num(body.area),
        areaUnit: String(body.areaUnit ?? 'sqft'),
        furnishing: body.furnishing ? String(body.furnishing) : null,
        floor: body.floor ? String(body.floor) : null,
        facing: body.facing ? String(body.facing) : null,
        ageYears: num(body.ageYears) == null ? null : Math.round(num(body.ageYears)!),
        locality: String(body.locality ?? ''),
        city: String(body.city ?? 'Indore'),
        address: String(body.address ?? ''),
        amenities: JSON.stringify(Array.isArray(body.amenities) ? body.amenities : []),
        images: JSON.stringify(Array.isArray(body.images) ? body.images : []),
        videos: JSON.stringify(Array.isArray(body.videos) ? body.videos : []),
        status,
        source: 'MANUAL',
        featured: Boolean(body.featured),
        ownerName: body.ownerName ? String(body.ownerName) : null,
        ownerPhone: body.ownerPhone ? String(body.ownerPhone).replace(/\D/g, '') || null : null,
        adminNotes: body.adminNotes ? String(body.adminNotes) : null,
        postedById: body.postedById ? String(body.postedById) : session?.id ?? null,
      },
    })
    await db.activity.create({
      data: {
        type: 'LISTING_CREATED',
        description: `Listing created: ${title}`,
        propertyId: property.id,
        userId: session?.id ?? null,
      },
    })
    return NextResponse.json({ property })
  } catch (err) {
    console.error('[admin/listings] create failed:', err)
    return NextResponse.json({ error: 'Could not create listing — please try again.' }, { status: 500 })
  }
}
