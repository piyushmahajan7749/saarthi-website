'use client'

// Smart-search bar + filter row for /listings. Pushes URL params; the server
// page does the querying. The free-text bar routes to ?q= (AI-parsed server-side).
import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PROPERTY_TYPES } from '@/types'
import { propertyTypeLabel } from '@/lib/format'

export default function SearchControls() {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const t = q.trim()
    router.push(t ? `/listings?q=${encodeURIComponent(t)}` : '/listings')
  }

  // Changing a filter preserves existing params but drops the free-text q
  // (explicit filters take over from a smart-search interpretation).
  function setParam(key: string, value: string) {
    const params = new URLSearchParams(Array.from(sp.entries()))
    params.delete('q')
    params.delete('page')
    if (value) params.set(key, value)
    else params.delete(key)
    const s = params.toString()
    router.push(`/listings${s ? `?${s}` : ''}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      <form className="search-shell" onSubmit={submitSearch}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: 3 BHK in Vijay Nagar under 90 lakh…"
          aria-label="Smart search"
        />
        <button type="submit" className="btn btn-solid">Search 🔍</button>
      </form>

      <div className="row search-filters" style={{ flexWrap: 'wrap', gap: 10 }}>
        <select className="select" style={{ width: 'auto' }} value={sp.get('for') ?? ''} onChange={(e) => setParam('for', e.target.value)}>
          <option value="">Buy or rent</option>
          <option value="SALE">For sale</option>
          <option value="RENT">For rent</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={sp.get('type') ?? ''} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{propertyTypeLabel(t)}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={sp.get('bhk') ?? ''} onChange={(e) => setParam('bhk', e.target.value)}>
          <option value="">Any BHK</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} BHK</option>)}
        </select>
        <input
          className="input"
          style={{ width: 'auto', minWidth: 150 }}
          defaultValue={sp.get('locality') ?? ''}
          placeholder="Locality"
          onKeyDown={(e) => { if (e.key === 'Enter') setParam('locality', (e.target as HTMLInputElement).value.trim()) }}
          onBlur={(e) => { if (e.target.value.trim() !== (sp.get('locality') ?? '')) setParam('locality', e.target.value.trim()) }}
          aria-label="Locality"
        />
        <select className="select" style={{ width: 'auto', marginLeft: 'auto' }} value={sp.get('sort') ?? 'newest'} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>
    </div>
  )
}
