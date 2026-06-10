import { Suspense } from 'react'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { parseSearchQuery } from '@/lib/ai'
import { formatPrice, propertyTypeLabel } from '@/lib/format'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import PropertyCard from '@/components/PropertyCard'
import ChatWidget from '@/components/ChatWidget'
import WhatsAppFloat from '@/components/WhatsAppFloat'
import SearchControls from './SearchControls'
import type { PropertyFilters, PropertyType, ListingFor } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Browse properties in Indore — Saarthi' }

const PAGE_SIZE = 12
const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919826078459'

type SP = {
  q?: string; for?: string; type?: string; bhk?: string
  priceMin?: string; priceMax?: string; locality?: string; sort?: string; page?: string
}

// Translate the merged filter set back into URL params (for chip-removal links).
function buildHref(base: Record<string, string | undefined>, drop?: string): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) {
    if (v && k !== drop) p.set(k, v)
  }
  const s = p.toString()
  return `/listings${s ? `?${s}` : ''}`
}

export default async function ListingsPage({ searchParams }: { searchParams: SP }) {
  // Start from explicit params; if a free-text q is present, fold in AI-derived
  // filters but let explicit params win.
  const explicit: PropertyFilters = {
    listingFor: (searchParams.for as ListingFor) || undefined,
    type: (searchParams.type as PropertyType) || undefined,
    bhk: searchParams.bhk ? Number(searchParams.bhk) : undefined,
    priceMin: searchParams.priceMin ? Number(searchParams.priceMin) : undefined,
    priceMax: searchParams.priceMax ? Number(searchParams.priceMax) : undefined,
    locality: searchParams.locality || undefined,
  }

  let smart: PropertyFilters = {}
  if (searchParams.q?.trim()) {
    smart = await parseSearchQuery(searchParams.q.trim())
  }
  const f: PropertyFilters = {
    listingFor: explicit.listingFor ?? smart.listingFor,
    type: explicit.type ?? smart.type,
    bhk: explicit.bhk ?? smart.bhk,
    priceMin: explicit.priceMin ?? smart.priceMin,
    priceMax: explicit.priceMax ?? smart.priceMax,
    locality: explicit.locality ?? smart.locality,
  }

  // Once interpreted, represent everything as explicit params so chips & paging work.
  const effectiveParams: Record<string, string | undefined> = {
    for: f.listingFor,
    type: f.type,
    bhk: f.bhk?.toString(),
    priceMin: f.priceMin?.toString(),
    priceMax: f.priceMax?.toString(),
    locality: f.locality,
    sort: searchParams.sort,
  }

  const where: Prisma.PropertyWhereInput = { status: 'ACTIVE' }
  if (f.listingFor) where.listingFor = f.listingFor
  if (f.type) where.type = f.type
  if (f.bhk) where.bhk = f.bhk
  if (f.locality) where.locality = { contains: f.locality }
  if (f.priceMin != null || f.priceMax != null) {
    where.price = {}
    if (f.priceMin != null) where.price.gte = f.priceMin
    if (f.priceMax != null) where.price.lte = f.priceMax
  }

  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    searchParams.sort === 'price_asc' ? { price: 'asc' }
    : searchParams.sort === 'price_desc' ? { price: 'desc' }
    : { createdAt: 'desc' }

  const page = Math.max(1, Number(searchParams.page) || 1)
  const [total, properties] = await Promise.all([
    db.property.count({ where }),
    db.property.findMany({ where, orderBy: [{ featured: 'desc' }, orderBy], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Interpreted-filter chips
  const chips: { label: string; href: string }[] = []
  if (f.listingFor) chips.push({ label: f.listingFor === 'RENT' ? 'For rent' : 'For sale', href: buildHref(effectiveParams, 'for') })
  if (f.type) chips.push({ label: propertyTypeLabel(f.type), href: buildHref(effectiveParams, 'type') })
  if (f.bhk) chips.push({ label: `${f.bhk} BHK`, href: buildHref(effectiveParams, 'bhk') })
  if (f.priceMin != null) chips.push({ label: `≥ ${formatPrice(f.priceMin)}`, href: buildHref(effectiveParams, 'priceMin') })
  if (f.priceMax != null) chips.push({ label: `≤ ${formatPrice(f.priceMax)}`, href: buildHref(effectiveParams, 'priceMax') })
  if (f.locality) chips.push({ label: `📍 ${f.locality}`, href: buildHref(effectiveParams, 'locality') })

  function pageHref(p: number) {
    return buildHref({ ...effectiveParams, page: p.toString() })
  }

  return (
    <>
      <Nav />
      <div className="page">
        <div className="wrap">
          <div className="page-head">
            <h1 className="page-title">Browse <em>Indore</em> properties</h1>
            <p className="page-sub">{total} {total === 1 ? 'property' : 'properties'} live{f.locality ? ` in ${f.locality}` : ''} · updated continuously by Saarthi AI</p>
          </div>

          <Suspense fallback={<div className="skel" style={{ height: 120 }} />}>
            <SearchControls />
          </Suspense>

          {searchParams.q?.trim() && chips.length > 0 && (
            <div style={{ marginBottom: '1.2rem' }}>
              <span className="hint" style={{ marginRight: 10 }}>✦ Smart search understood:</span>
              <span className="chips" style={{ display: 'inline-flex' }}>
                {chips.map((c, i) => (
                  <Link key={i} href={c.href} className="chip on" style={{ textDecoration: 'none' }}>
                    {c.label} <span aria-hidden>✕</span>
                  </Link>
                ))}
              </span>
            </div>
          )}

          {properties.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🏘️</div>
              <p style={{ marginBottom: 6, color: 'var(--cream)' }}>No matches — try widening your search.</p>
              <p style={{ marginBottom: 18 }}>Or tell Saarthi exactly what you need and we&apos;ll hunt it down for you.</p>
              <div className="row" style={{ justifyContent: 'center', gap: 10 }}>
                <Link href="/listings" className="btn btn-quiet">Clear filters</Link>
                <a href={`https://wa.me/${WA}?text=${encodeURIComponent('Hi Saarthi! Mujhe ye chahiye: ')}`} className="btn btn-solid" target="_blank" rel="noreferrer">
                  Tell Saarthi on WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="listings-grid">
                {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
              </div>

              {totalPages > 1 && (
                <div className="spread" style={{ marginTop: '2.5rem', justifyContent: 'center', gap: 16 }}>
                  {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn-quiet">← Prev</Link> : <span className="btn btn-quiet" style={{ opacity: 0.4 }}>← Prev</span>}
                  <span className="hint">Page {page} of {totalPages}</span>
                  {page < totalPages ? <Link href={pageHref(page + 1)} className="btn btn-quiet">Next →</Link> : <span className="btn btn-quiet" style={{ opacity: 0.4 }}>Next →</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
      <WhatsAppFloat />
      <ChatWidget />
    </>
  )
}
