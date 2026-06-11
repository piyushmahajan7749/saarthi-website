import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { PROPERTY_TYPES, LISTING_FOR, PROPERTY_STATUSES } from '@/types'

export const dynamic = 'force-dynamic'

// PATCH /api/admin/listings/[id] — partial update of whitelisted fields.
// Used by the listings table (status/featured), the editor, and intake
// web-submission approval. Returns { property }.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const existing = await db.property.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 })

  const num = (v: unknown): number | null => {
    if (v === '' || v == null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const data: Prisma.PropertyUpdateInput = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  if (has('title') && String(body.title).trim()) data.title = String(body.title).trim()
  if (has('description')) data.description = String(body.description ?? '')
  if (has('type') && PROPERTY_TYPES.includes(String(body.type) as never)) data.type = String(body.type)
  if (has('listingFor') && LISTING_FOR.includes(String(body.listingFor) as never)) data.listingFor = String(body.listingFor)
  if (has('bhk')) data.bhk = num(body.bhk) == null ? null : Math.round(num(body.bhk)!)
  if (has('price')) data.price = num(body.price)
  if (has('area')) data.area = num(body.area)
  if (has('areaUnit')) data.areaUnit = String(body.areaUnit ?? 'sqft')
  if (has('furnishing')) data.furnishing = body.furnishing ? String(body.furnishing) : null
  if (has('floor')) data.floor = body.floor ? String(body.floor) : null
  if (has('facing')) data.facing = body.facing ? String(body.facing) : null
  if (has('ageYears')) data.ageYears = num(body.ageYears) == null ? null : Math.round(num(body.ageYears)!)
  if (has('locality')) data.locality = String(body.locality ?? '')
  if (has('city')) data.city = String(body.city ?? 'Indore')
  if (has('address')) data.address = String(body.address ?? '')
  if (has('amenities') && Array.isArray(body.amenities)) data.amenities = JSON.stringify(body.amenities)
  if (has('images') && Array.isArray(body.images)) data.images = JSON.stringify(body.images)
  if (has('videos') && Array.isArray(body.videos)) data.videos = JSON.stringify(body.videos)
  if (has('featured')) data.featured = Boolean(body.featured)
  if (has('ownerName')) data.ownerName = body.ownerName ? String(body.ownerName) : null
  if (has('ownerPhone')) data.ownerPhone = body.ownerPhone ? String(body.ownerPhone).replace(/\D/g, '') || null : null
  if (has('adminNotes')) data.adminNotes = body.adminNotes ? String(body.adminNotes) : null
  if (has('postedById')) data.postedBy = body.postedById ? { connect: { id: String(body.postedById) } } : { disconnect: true }

  let statusChanged = false
  if (has('status') && PROPERTY_STATUSES.includes(String(body.status) as never)) {
    data.status = String(body.status)
    statusChanged = String(body.status) !== existing.status
  }

  try {
    const property = await db.property.update({ where: { id: params.id }, data })
    if (statusChanged) {
      const becamePublished = property.status === 'ACTIVE' && ['DRAFT', 'PENDING_REVIEW'].includes(existing.status)
      await db.activity.create({
        data: {
          type: becamePublished ? 'LISTING_PUBLISHED' : 'STATUS_CHANGE',
          description: becamePublished
            ? `Published live: ${property.title}`
            : `Listing status: ${existing.status} → ${property.status}`,
          propertyId: property.id,
          userId: session?.id ?? null,
        },
      })
    }
    return NextResponse.json({ property })
  } catch (err) {
    console.error('[admin/listings] update failed:', err)
    return NextResponse.json({ error: 'Could not update listing — please try again.' }, { status: 500 })
  }
}

// DELETE /api/admin/listings/[id] — hard delete (cascades matches & activity).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await db.property.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/listings] delete failed:', err)
    return NextResponse.json({ error: 'Could not delete listing.' }, { status: 500 })
  }
}
