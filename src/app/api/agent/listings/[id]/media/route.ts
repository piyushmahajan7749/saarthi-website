import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'

export const dynamic = 'force-dynamic'

// PATCH /api/agent/listings/:id/media
// Appends photo URLs to an existing listing's images array.
// Called by cx-agent after uploading WhatsApp group photos to Azure.
// Body: { photoUrls: string[] }

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: { photoUrls?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const newUrls = (body.photoUrls ?? []).filter(Boolean)
  if (newUrls.length === 0) return NextResponse.json({ error: 'photoUrls required.' }, { status: 400 })

  const listing = await db.property.findUnique({ where: { id: params.id }, select: { images: true } })
  if (!listing) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 })

  let current: string[] = []
  try { current = JSON.parse(listing.images) } catch { current = [] }

  const merged = [...current, ...newUrls]
  await db.property.update({ where: { id: params.id }, data: { images: JSON.stringify(merged) } })
  return NextResponse.json({ ok: true, imageCount: merged.length })
}
