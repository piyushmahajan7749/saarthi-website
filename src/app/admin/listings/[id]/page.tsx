import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { safeJsonParse } from '@/lib/format'
import PropertyForm, { type BrokerOpt, type PropertyFormValues } from '@/components/admin/PropertyForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit listing — Saarthi Command Center' }

export default async function EditListingPage({ params }: { params: { id: string } }) {
  const [property, users] = await Promise.all([
    db.property.findUnique({ where: { id: params.id } }),
    db.user.findMany({ where: { active: true }, orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
  ])
  if (!property) notFound()

  const brokers: BrokerOpt[] = users.map((u) => ({ id: u.id, name: u.name, role: u.role }))
  const images = safeJsonParse<string[]>(property.images, [])
  const videos = safeJsonParse<string[]>(property.videos, [])
  const amenities = safeJsonParse<string[]>(property.amenities, [])

  const initial: PropertyFormValues = {
    id: property.id,
    title: property.title,
    type: property.type,
    listingFor: property.listingFor,
    bhk: property.bhk?.toString() ?? '',
    price: property.price?.toString() ?? '',
    area: property.area?.toString() ?? '',
    areaUnit: property.areaUnit,
    furnishing: property.furnishing ?? '',
    floor: property.floor ?? '',
    facing: property.facing ?? '',
    ageYears: property.ageYears?.toString() ?? '',
    locality: property.locality,
    city: property.city,
    address: property.address,
    amenities,
    images: images.join('\n'),
    videos: videos.join('\n'),
    description: property.description,
    ownerName: property.ownerName ?? '',
    ownerPhone: property.ownerPhone ?? '',
    status: property.status,
    featured: property.featured,
    postedById: property.postedById ?? '',
    adminNotes: property.adminNotes ?? '',
  }

  return (
    <div>
      <Link href="/admin/listings" className="hint" style={{ textDecoration: 'none' }}>← Back to listings</Link>
      <div className="spread" style={{ marginTop: 8, marginBottom: '1.6rem' }}>
        <div>
          <h1 className="admin-title">Edit <em style={{ color: 'var(--o)' }}>listing</em></h1>
          <p className="admin-sub">{property.title}</p>
        </div>
        <Link href={`/listings/${property.id}`} target="_blank" className="btn btn-quiet btn-sm">View public page ↗</Link>
      </div>
      <PropertyForm
        mode="edit"
        brokers={brokers}
        initial={initial}
        aiContext={{ aiSummary: property.aiSummary, aiNotes: property.aiNotes, rawText: property.rawText, source: property.source }}
      />
    </div>
  )
}
