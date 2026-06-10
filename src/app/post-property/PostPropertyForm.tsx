'use client'

// Public "Post Property" form — submits to /api/intake/webform where the
// listing lands as PENDING_REVIEW for the admin team.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { PROPERTY_TYPES, FURNISHING } from '@/types'
import { formatPrice, propertyTypeLabel } from '@/lib/format'

const AMENITIES = ['Lift', 'Parking', 'Power backup', 'Security', 'Garden', 'Club house', 'Gym', 'Modular kitchen']
const NO_BHK_TYPES = ['PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP']
const AREA_UNITS = ['sqft', 'sqyd', 'acre']
const FURNISHING_LABELS: Record<string, string> = {
  UNFURNISHED: 'Unfurnished',
  SEMI_FURNISHED: 'Semi-furnished',
  FURNISHED: 'Fully furnished',
}

type FormState = {
  ownerName: string
  ownerPhone: string
  listingFor: 'SALE' | 'RENT'
  type: string
  bhk: string
  price: string
  area: string
  areaUnit: string
  locality: string
  address: string
  furnishing: string
  amenities: string[]
  description: string
}

const INITIAL: FormState = {
  ownerName: '',
  ownerPhone: '',
  listingFor: 'SALE',
  type: 'FLAT',
  bhk: '2',
  price: '',
  area: '',
  areaUnit: 'sqft',
  locality: '',
  address: '',
  furnishing: '',
  amenities: [],
  description: '',
}

function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="full" style={{ marginTop: '0.4rem' }}>
      <div className="label" style={{ color: 'var(--o3)' }}>{children}</div>
      <hr className="divider" style={{ margin: '0.6rem 0 0' }} />
    </div>
  )
}

export default function PostPropertyForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState('')

  const isRent = form.listingFor === 'RENT'
  const showBhk = !NO_BHK_TYPES.includes(form.type)
  const priceNum = Number(form.price)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  function toggleAmenity(a: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a],
    }))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.ownerName.trim()) e.ownerName = 'Please tell us your name.'
    if (cleanPhone(form.ownerPhone).length !== 10) e.ownerPhone = 'Enter a valid 10-digit mobile number.'
    if (!form.price.trim() || isNaN(priceNum) || priceNum <= 0) {
      e.price = isRent ? 'Enter the expected monthly rent.' : 'Enter the expected price.'
    }
    if (!form.locality.trim()) e.locality = 'Locality is required — buyers search by area.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setServerError('')
    if (!validate() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/intake/webform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          ownerPhone: cleanPhone(form.ownerPhone),
          listingFor: form.listingFor,
          type: form.type,
          bhk: showBhk && form.bhk ? Number(form.bhk) : null,
          price: priceNum,
          area: form.area.trim() ? Number(form.area) : null,
          areaUnit: form.areaUnit,
          locality: form.locality.trim(),
          address: form.address.trim(),
          furnishing: form.furnishing || null,
          amenities: form.amenities,
          description: form.description.trim(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setServerError(data.error || 'Something went wrong — please try again.')
        return
      }
      setDone(true)
    } catch {
      setServerError('Network hiccup — check your connection and try again, or WhatsApp us: +91 98260 78459.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', padding: '3.5rem 2rem' }}>
        <div style={{ fontSize: 48, marginBottom: '0.8rem' }}>🎉</div>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 34,
            fontWeight: 600,
            color: 'var(--cream)',
            letterSpacing: '-0.5px',
          }}
        >
          Listing <em style={{ color: 'var(--o)', fontStyle: 'italic' }}>received!</em>
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: '0.8rem auto 1.8rem' }}>
          Our team reviews every property — it goes live within a few hours. Track anything on WhatsApp: +91 98260 78459.
        </p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/listings" className="btn btn-solid">
            Browse listings
          </Link>
          <button
            className="btn btn-quiet"
            onClick={() => {
              setForm(INITIAL)
              setErrors({})
              setServerError('')
              setDone(false)
            }}
          >
            Submit another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="card" style={{ maxWidth: 760, margin: '0 auto', padding: '2rem' }} onSubmit={submit} noValidate>
      <div className="form-grid">
        <SectionLabel>Your details</SectionLabel>

        <div className="field">
          <label className="label" htmlFor="pp-name">Your name *</label>
          <input
            id="pp-name"
            className="input"
            value={form.ownerName}
            onChange={(e) => set('ownerName', e.target.value)}
            placeholder="e.g. Rajesh Sharma"
            maxLength={80}
          />
          {errors.ownerName && <span className="error-text">{errors.ownerName}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="pp-phone">Mobile number *</label>
          <input
            id="pp-phone"
            className="input"
            type="tel"
            inputMode="numeric"
            value={form.ownerPhone}
            onChange={(e) => set('ownerPhone', e.target.value)}
            placeholder="98260 78459"
            maxLength={15}
          />
          {errors.ownerPhone ? (
            <span className="error-text">{errors.ownerPhone}</span>
          ) : (
            <span className="hint">10-digit mobile — we&apos;ll coordinate on WhatsApp.</span>
          )}
        </div>

        <SectionLabel>Property details</SectionLabel>

        <div className="field full">
          <span className="label">I want to</span>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${form.listingFor === 'SALE' ? 'active' : ''}`}
              onClick={() => set('listingFor', 'SALE')}
            >
              Sell
            </button>
            <button
              type="button"
              className={`tab ${form.listingFor === 'RENT' ? 'active' : ''}`}
              onClick={() => set('listingFor', 'RENT')}
            >
              Rent out
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="pp-type">Property type</label>
          <select id="pp-type" className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {propertyTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        {showBhk && (
          <div className="field">
            <label className="label" htmlFor="pp-bhk">BHK</label>
            <select id="pp-bhk" className="select" value={form.bhk} onChange={(e) => set('bhk', e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} BHK
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="pp-price">{isRent ? 'Monthly rent (₹) *' : 'Expected price (₹) *'}</label>
          <input
            id="pp-price"
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder={isRent ? 'e.g. 18000' : 'e.g. 7500000'}
          />
          {errors.price ? (
            <span className="error-text">{errors.price}</span>
          ) : priceNum > 0 ? (
            <span className="hint">≈ {formatPrice(priceNum, form.listingFor)}</span>
          ) : (
            <span className="hint">{isRent ? 'Rent per month, in rupees.' : 'Full amount in rupees — 75 lakh = 7500000.'}</span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="pp-area">Area</label>
          <div className="row" style={{ gap: '0.5rem' }}>
            <input
              id="pp-area"
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.area}
              onChange={(e) => set('area', e.target.value)}
              placeholder="e.g. 1250"
            />
            <select
              className="select"
              style={{ width: 110, flexShrink: 0 }}
              value={form.areaUnit}
              onChange={(e) => set('areaUnit', e.target.value)}
              aria-label="Area unit"
            >
              {AREA_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="pp-locality">Locality *</label>
          <input
            id="pp-locality"
            className="input"
            value={form.locality}
            onChange={(e) => set('locality', e.target.value)}
            placeholder="e.g. Vijay Nagar, Indore"
            maxLength={120}
          />
          {errors.locality && <span className="error-text">{errors.locality}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="pp-furnishing">Furnishing</label>
          <select
            id="pp-furnishing"
            className="select"
            value={form.furnishing}
            onChange={(e) => set('furnishing', e.target.value)}
          >
            <option value="">Select (optional)</option>
            {FURNISHING.map((f) => (
              <option key={f} value={f}>
                {FURNISHING_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className="field full">
          <label className="label" htmlFor="pp-address">Address</label>
          <input
            id="pp-address"
            className="input"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Building / street — exact address stays private until you share it"
            maxLength={200}
          />
        </div>

        <div className="field full">
          <span className="label">Amenities</span>
          <div className="chips">
            {AMENITIES.map((a) => (
              <button
                type="button"
                key={a}
                className={`chip ${form.amenities.includes(a) ? 'on' : ''}`}
                style={{ fontFamily: "'Outfit', sans-serif" }}
                onClick={() => toggleAmenity(a)}
                aria-pressed={form.amenities.includes(a)}
              >
                {form.amenities.includes(a) ? '✓ ' : ''}
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="field full">
          <label className="label" htmlFor="pp-desc">Description</label>
          <textarea
            id="pp-desc"
            className="textarea"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Tell buyers what makes it special — Saarthi AI will polish it"
            maxLength={2000}
          />
        </div>

        {serverError && (
          <div className="full">
            <span className="error-text">{serverError}</span>
          </div>
        )}

        <div className="full spread" style={{ marginTop: '0.4rem' }}>
          <span className="hint">Free listing · reviewed by our team before going live.</span>
          <button type="submit" className="btn btn-solid btn-lg" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit listing →'}
          </button>
        </div>
      </div>
    </form>
  )
}
