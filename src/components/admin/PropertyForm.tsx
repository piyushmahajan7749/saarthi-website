'use client'

// Shared create/edit form for a Property. Used by /admin/listings/new and
// /admin/listings/[id]. POSTs to create, PATCHes to update, then routes to
// the listings table.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice, propertyTypeLabel } from '@/lib/format'
import { PROPERTY_TYPES, PROPERTY_STATUSES, FURNISHING } from '@/types'
import { statusLabel } from '@/lib/format'
import type { BrokerOpt, PropertyFormValues } from './property-form-shared'

// Re-export the shared types so existing `import { type BrokerOpt } from './PropertyForm'`
// sites keep working (type-only — erased at build, safe across the client boundary).
export type { BrokerOpt, PropertyFormValues }

const AMENITY_OPTIONS = ['Lift', 'Covered parking', 'Power backup', '24x7 security', 'Garden', 'Club house', 'Gym', 'Swimming pool', 'Modular kitchen', 'Kids play area', 'Intercom', 'Pet friendly']
const NO_BHK = ['PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP']

export default function PropertyForm({
  initial,
  brokers,
  mode,
  aiContext,
}: {
  initial: PropertyFormValues
  brokers: BrokerOpt[]
  mode: 'create' | 'edit'
  aiContext?: { aiSummary: string | null; aiNotes: string | null; rawText: string | null; source: string }
}) {
  const router = useRouter()
  const [v, setV] = useState<PropertyFormValues>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof PropertyFormValues>(k: K, val: PropertyFormValues[K]) => setV((p) => ({ ...p, [k]: val }))
  const toggleAmenity = (a: string) =>
    setV((p) => ({ ...p, amenities: p.amenities.includes(a) ? p.amenities.filter((x) => x !== a) : [...p.amenities, a] }))

  const showBhk = !NO_BHK.includes(v.type)
  const priceNum = Number(v.price)

  async function submit() {
    setError(null)
    if (!v.title.trim()) return setError('Title is required.')
    setSaving(true)
    const payload = {
      title: v.title,
      type: v.type,
      listingFor: v.listingFor,
      bhk: showBhk ? v.bhk : '',
      price: v.price,
      area: v.area,
      areaUnit: v.areaUnit,
      furnishing: v.furnishing || null,
      floor: v.floor,
      facing: v.facing,
      ageYears: v.ageYears,
      locality: v.locality,
      city: v.city,
      address: v.address,
      amenities: v.amenities,
      images: v.images.split('\n').map((s) => s.trim()).filter(Boolean),
      videos: v.videos.split('\n').map((s) => s.trim()).filter(Boolean),
      description: v.description,
      ownerName: v.ownerName,
      ownerPhone: v.ownerPhone,
      status: v.status,
      featured: v.featured,
      postedById: v.postedById || null,
      adminNotes: v.adminNotes,
    }
    try {
      const res = await fetch(mode === 'create' ? '/api/admin/listings' : `/api/admin/listings/${v.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Save failed')
      router.push('/admin/listings')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 860 }}>
      <div className="form-grid">
        <div className="field full">
          <span className="label">Title *</span>
          <input className="input" value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="3 BHK Flat for Sale in Vijay Nagar" />
        </div>

        <div className="field">
          <span className="label">Property type</span>
          <select className="select" value={v.type} onChange={(e) => set('type', e.target.value)}>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{propertyTypeLabel(t)}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">Listing for</span>
          <div className="tabs" style={{ padding: 3 }}>
            <button type="button" className={`tab ${v.listingFor === 'SALE' ? 'active' : ''}`} style={{ padding: '0.4rem 1.2rem' }} onClick={() => set('listingFor', 'SALE')}>Sell</button>
            <button type="button" className={`tab ${v.listingFor === 'RENT' ? 'active' : ''}`} style={{ padding: '0.4rem 1.2rem' }} onClick={() => set('listingFor', 'RENT')}>Rent out</button>
          </div>
        </div>

        {showBhk && (
          <div className="field">
            <span className="label">BHK</span>
            <select className="select" value={v.bhk} onChange={(e) => set('bhk', e.target.value)}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} BHK</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <span className="label">{v.listingFor === 'RENT' ? 'Monthly rent (₹)' : 'Price (₹)'}</span>
          <input type="number" className="input" value={v.price} onChange={(e) => set('price', e.target.value)} placeholder="7500000" />
          <span className="hint">{v.price && Number.isFinite(priceNum) ? `Shows as ${formatPrice(priceNum, v.listingFor)}` : 'Leave empty for "Price on request"'}</span>
        </div>
        <div className="field">
          <span className="label">Area</span>
          <div className="row" style={{ gap: 8 }}>
            <input type="number" className="input" value={v.area} onChange={(e) => set('area', e.target.value)} placeholder="1650" />
            <select className="select" style={{ width: 110 }} value={v.areaUnit} onChange={(e) => set('areaUnit', e.target.value)}>
              <option value="sqft">sqft</option>
              <option value="sqyd">sqyd</option>
              <option value="acre">acre</option>
            </select>
          </div>
        </div>

        <div className="field">
          <span className="label">Furnishing</span>
          <select className="select" value={v.furnishing} onChange={(e) => set('furnishing', e.target.value)}>
            <option value="">—</option>
            {FURNISHING.map((f) => <option key={f} value={f}>{f.replace('_', '-').toLowerCase()}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">Floor</span>
          <input className="input" value={v.floor} onChange={(e) => set('floor', e.target.value)} placeholder="3rd of 8" />
        </div>
        <div className="field">
          <span className="label">Facing</span>
          <input className="input" value={v.facing} onChange={(e) => set('facing', e.target.value)} placeholder="East" />
        </div>
        <div className="field">
          <span className="label">Age (years)</span>
          <input type="number" className="input" value={v.ageYears} onChange={(e) => set('ageYears', e.target.value)} placeholder="3" />
        </div>

        <div className="field">
          <span className="label">Locality</span>
          <input className="input" value={v.locality} onChange={(e) => set('locality', e.target.value)} placeholder="Vijay Nagar" />
        </div>
        <div className="field">
          <span className="label">City</span>
          <input className="input" value={v.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="field full">
          <span className="label">Address</span>
          <input className="input" value={v.address} onChange={(e) => set('address', e.target.value)} placeholder="Scheme 54 PU4, near C21 Mall" />
        </div>

        <div className="field full">
          <span className="label">Amenities</span>
          <div className="chips">
            {AMENITY_OPTIONS.map((a) => (
              <span key={a} className={`chip ${v.amenities.includes(a) ? 'on' : ''}`} onClick={() => toggleAmenity(a)}>
                {a}
              </span>
            ))}
          </div>
        </div>

        <div className="field full">
          <span className="label">Description</span>
          <textarea className="textarea" value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="What makes this property special…" />
        </div>

        <div className="field full">
          <span className="label">Image URLs (one per line)</span>
          <textarea className="textarea" style={{ minHeight: 70 }} value={v.images} onChange={(e) => set('images', e.target.value)} placeholder="https://…/photo1.jpg" />
          <span className="hint">Optional — listings without photos show a styled placeholder.</span>
        </div>
        <div className="field full">
          <span className="label">Video URLs (one per line)</span>
          <textarea className="textarea" style={{ minHeight: 60 }} value={v.videos} onChange={(e) => set('videos', e.target.value)} placeholder="https://…/walkthrough.mp4" />
        </div>

        <div className="field">
          <span className="label">Owner name</span>
          <input className="input" value={v.ownerName} onChange={(e) => set('ownerName', e.target.value)} />
        </div>
        <div className="field">
          <span className="label">Owner phone</span>
          <input className="input" value={v.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="98260…" />
        </div>

        <div className="field">
          <span className="label">Status</span>
          <select className="select" value={v.status} onChange={(e) => set('status', e.target.value)}>
            {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
        <div className="field">
          <span className="label">Posted by</span>
          <select className="select" value={v.postedById} onChange={(e) => set('postedById', e.target.value)}>
            <option value="">—</option>
            {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}{b.role === 'ADMIN' ? ' · Admin' : ''}</option>)}
          </select>
        </div>

        <label className="field full row" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={v.featured} onChange={(e) => set('featured', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--o)' }} />
          <span style={{ fontSize: 14, color: 'var(--cream)' }}>★ Feature this listing on the homepage</span>
        </label>

        <div className="field full">
          <span className="label">Admin notes (internal)</span>
          <textarea className="textarea" style={{ minHeight: 70 }} value={v.adminNotes} onChange={(e) => set('adminNotes', e.target.value)} />
        </div>
      </div>

      {aiContext && (aiContext.aiSummary || aiContext.aiNotes || aiContext.rawText) && (
        <details style={{ marginTop: '1.2rem' }}>
          <summary className="label" style={{ cursor: 'pointer', color: 'var(--o3)' }}>✦ AI intake context ({aiContext.source})</summary>
          <div className="card" style={{ marginTop: 10, background: 'rgba(200,96,26,0.05)' }}>
            {aiContext.aiSummary && <p style={{ fontSize: 13.5, color: 'var(--cream)', fontStyle: 'italic', marginBottom: 8 }}>{aiContext.aiSummary}</p>}
            {aiContext.aiNotes && <p className="hint" style={{ color: 'var(--o3)' }}>✦ {aiContext.aiNotes}</p>}
            {aiContext.rawText && <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, color: 'var(--muted)', marginTop: 8, fontFamily: 'inherit' }}>{aiContext.rawText}</pre>}
          </div>
        </details>
      )}

      {error && <p className="error-text" style={{ marginTop: 14 }}>⚠ {error}</p>}
      <div className="row" style={{ marginTop: '1.4rem', gap: 10 }}>
        <button className="btn btn-solid btn-lg" disabled={saving} onClick={submit}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create listing →' : 'Save changes'}
        </button>
        <button className="btn btn-quiet" disabled={saving} onClick={() => router.push('/admin/listings')}>Cancel</button>
      </div>
    </div>
  )
}
