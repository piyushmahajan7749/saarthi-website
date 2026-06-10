import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { formatPrice, formatArea, propertyTypeLabel, statusLabel, timeAgo, safeJsonParse, waLink } from '@/lib/format'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PropertyCard, { mediaGradient, typeIcon } from '@/components/PropertyCard'
import ChatWidget from '@/components/ChatWidget'
import WhatsAppFloat from '@/components/WhatsAppFloat'

export const dynamic = 'force-dynamic'
const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919826078459'
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')

export async function generateMetadata({ params }: { params: { id: string } }) {
  const p = await db.property.findUnique({ where: { id: params.id } })
  return { title: p ? `${p.title} — Saarthi` : 'Listing — Saarthi' }
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <span style={{ fontSize: 15, color: 'var(--cream)' }}>{value}</span>
    </div>
  )
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const property = await db.property.findUnique({ where: { id: params.id } })
  if (!property) notFound()

  // Fire-and-forget view increment (don't block render).
  db.property.update({ where: { id: property.id }, data: { views: { increment: 1 } } }).catch(() => {})

  const images = safeJsonParse<string[]>(property.images, [])
  const amenities = safeJsonParse<string[]>(property.amenities, [])
  const isLive = property.status === 'ACTIVE'

  const similarWhere: Prisma.PropertyWhereInput = {
    status: 'ACTIVE',
    id: { not: property.id },
    listingFor: property.listingFor,
    OR: [{ type: property.type }, { locality: property.locality || undefined }],
  }
  const similar = await db.property.findMany({ where: similarWhere, take: 3, orderBy: { featured: 'desc' } })

  const tiles = [0, 1, 2]
  const waText = `Hi Saarthi! I'm interested in: ${property.title} (${SITE}/listings/${property.id})`

  return (
    <>
      <Nav />
      <div className="page">
        <div className="wrap">
          <Link href="/listings" className="hint" style={{ textDecoration: 'none', display: 'inline-block', margin: '0.5rem 0 1.2rem' }}>← All listings</Link>

          {!isLive && (
            <div className="card" style={{ borderColor: 'rgba(190,60,50,0.35)', background: 'rgba(190,60,50,0.06)', marginBottom: '1.2rem', padding: '0.8rem 1.2rem' }}>
              <span className="badge badge-red" style={{ marginRight: 10 }}>{statusLabel(property.status)}</span>
              <span className="hint">This listing is no longer live — shown for reference.</span>
            </div>
          )}

          {/* gallery */}
          <div className="gallery">
            <div className="gallery-main" style={{ position: 'relative' }}>
              {images[0]
                ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={images[0]} alt={property.title} />
                : <div className="ph" style={{ background: mediaGradient(property.id) }}><span style={{ fontSize: 64 }}>{typeIcon(property.type)}</span></div>}
              <div className="prop-badges">
                <span className={`badge ${property.listingFor === 'RENT' ? 'badge-teal' : 'badge-orange'}`}>For {property.listingFor === 'RENT' ? 'Rent' : 'Sale'}</span>
                {property.featured && <span className="badge badge-gold">★ Featured</span>}
              </div>
            </div>
            <div className="gallery-side">
              {tiles.slice(1).map((i) => (
                <div key={i} className="ph" style={images[i] ? undefined : { background: mediaGradient(property.id + i) }}>
                  {images[i]
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={images[i]} alt={`${property.title} ${i}`} />
                    : <span style={{ fontSize: 34, opacity: 0.7 }}>{typeIcon(property.type)}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* header + 2-col body */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', marginTop: '1.8rem', alignItems: 'start' }} className="detail-grid">
            <div style={{ minWidth: 0 }}>
              <div className="prop-price" style={{ fontSize: 38 }}>{formatPrice(property.price, property.listingFor)}</div>
              <h1 className="page-title" style={{ fontSize: 'clamp(26px,3.5vw,40px)', margin: '0.3rem 0' }}>{property.title}</h1>
              <p className="page-sub" style={{ marginTop: 0 }}>
                📍 {[property.locality, property.address, property.city].filter(Boolean).join(', ')}
              </p>
              <p className="hint" style={{ marginTop: 6 }}>
                Listed {timeAgo(property.createdAt)} · {property.views} views · <span className="badge badge-gray">{property.source}</span>
              </p>

              <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="form-grid">
                  {property.bhk != null && <Spec label="Configuration" value={`${property.bhk} BHK`} />}
                  {property.area != null && <Spec label="Area" value={formatArea(property.area, property.areaUnit)} />}
                  <Spec label="Type" value={propertyTypeLabel(property.type)} />
                  <Spec label="Listed for" value={property.listingFor === 'RENT' ? 'Rent' : 'Sale'} />
                  {property.furnishing && <Spec label="Furnishing" value={property.furnishing.replace('_', '-').toLowerCase()} />}
                  {property.floor && <Spec label="Floor" value={property.floor} />}
                  {property.facing && <Spec label="Facing" value={property.facing} />}
                  {property.ageYears != null && <Spec label="Age" value={`${property.ageYears} years`} />}
                </div>
              </div>

              {property.description && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h2 className="section-eyebrow" style={{ color: 'var(--o)' }}>About this property</h2>
                  <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.8, marginTop: 8 }}>{property.description}</p>
                </div>
              )}

              {amenities.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h2 className="section-eyebrow" style={{ color: 'var(--o)' }}>Amenities</h2>
                  <div className="chips" style={{ marginTop: 10 }}>
                    {amenities.map((a) => <span key={a} className="chip" style={{ cursor: 'default' }}>{a}</span>)}
                  </div>
                </div>
              )}

              {(property.aiSummary || property.aiNotes) && (
                <div className="card" style={{ marginTop: '1.5rem', borderColor: 'rgba(200,96,26,0.3)', background: 'rgba(200,96,26,0.05)' }}>
                  <div className="label" style={{ color: 'var(--o3)', marginBottom: 8 }}>✦ Saarthi&apos;s take</div>
                  {property.aiSummary && <p style={{ fontSize: 14.5, color: 'var(--cream)', lineHeight: 1.7 }}>{property.aiSummary}</p>}
                  {property.aiNotes && <p className="hint" style={{ marginTop: 8 }}>{property.aiNotes}</p>}
                </div>
              )}
            </div>

            {/* CTA card */}
            <div className="card" style={{ position: 'sticky', top: 100 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, color: 'var(--cream)', marginBottom: 4 }}>
                Interested in this property?
              </div>
              <p className="hint" style={{ marginBottom: 16 }}>Saarthi AI replies in minutes — free for buyers, no brokerage charges.</p>
              <a href={waLink(WA, waText)} className="btn btn-solid btn-lg btn-block" target="_blank" rel="noreferrer" style={{ marginBottom: 10 }}>
                💬 Enquire on WhatsApp
              </a>
              <Link href="/listings" className="btn btn-quiet btn-block">Browse similar →</Link>
              <hr className="divider" />
              <p className="hint" style={{ textAlign: 'center' }}>Free for buyers · No brokerage · Indore</p>
            </div>
          </div>

          {/* similar */}
          {similar.length > 0 && (
            <div style={{ marginTop: '3.5rem' }}>
              <h2 className="section-title" style={{ fontSize: 'clamp(26px,3vw,38px)', marginBottom: '1.5rem' }}>Similar <em>properties</em></h2>
              <div className="listings-grid">
                {similar.map((p) => <PropertyCard key={p.id} property={p} />)}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
      <WhatsAppFloat text={waText} />
      <ChatWidget />
    </>
  )
}
