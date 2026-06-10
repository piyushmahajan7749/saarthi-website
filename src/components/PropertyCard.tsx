import Link from 'next/link'
import type { Property } from '@prisma/client'
import { formatPrice, formatArea, propertyTypeLabel, safeJsonParse } from '@/lib/format'

// Deterministic warm gradient per property — listings without photos still look intentional.
export function mediaGradient(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const hues = [[22, 38], [28, 14], [16, 30], [34, 20], [12, 26]]
  const [h1, h2] = hues[h % hues.length]
  return `linear-gradient(135deg, hsl(${h1}, 45%, 16%), hsl(${h2}, 65%, 26%) 55%, hsl(${(h1 + h2) / 2}, 55%, 20%))`
}

export function typeIcon(type: string): string {
  const map: Record<string, string> = {
    FLAT: '🏢', HOUSE: '🏠', VILLA: '🏡', PLOT: '🗺️', COMMERCIAL: '🏬', OFFICE: '🏛️', SHOP: '🏪', PG: '🛏️',
  }
  return map[type] ?? '🏠'
}

export default function PropertyCard({ property, badge }: { property: Property; badge?: string }) {
  const images = safeJsonParse<string[]>(property.images, [])
  return (
    <Link href={`/listings/${property.id}`} className="prop-card">
      <div className="prop-media" style={images[0] ? undefined : { background: mediaGradient(property.id) }}>
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0]} alt={property.title} loading="lazy" />
        ) : (
          <span className="prop-media-icon">{typeIcon(property.type)}</span>
        )}
        <div className="prop-badges">
          <span className={`badge ${property.listingFor === 'RENT' ? 'badge-teal' : 'badge-orange'}`}>
            For {property.listingFor === 'RENT' ? 'Rent' : 'Sale'}
          </span>
          {property.featured && <span className="badge badge-gold">★ Featured</span>}
          {badge && <span className="badge badge-gray">{badge}</span>}
        </div>
      </div>
      <div className="prop-body">
        <div className="prop-price">{formatPrice(property.price, property.listingFor)}</div>
        <div className="prop-title">{property.title}</div>
        <div className="prop-specs">
          {property.bhk != null && <span>🛏 {property.bhk} BHK</span>}
          {property.area != null && <span>📐 {formatArea(property.area, property.areaUnit)}</span>}
          <span>{typeIcon(property.type)} {propertyTypeLabel(property.type)}</span>
        </div>
        <div className="prop-loc">📍 {[property.locality, property.city].filter(Boolean).join(', ')}</div>
      </div>
    </Link>
  )
}
