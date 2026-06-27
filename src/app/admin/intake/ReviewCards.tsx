'use client'

// Shared review/edit/commit flow for parsed listings — used by both the
// WhatsApp-paste tab and the Excel-upload tab on /admin/intake.

import { useState } from 'react'
import type { ParsedListing } from '@/types'
import { PROPERTY_TYPES } from '@/types'
import { formatPrice, propertyTypeLabel } from '@/lib/format'

export interface BrokerOption {
  id: string
  name: string
  role: string
}

interface CardItem {
  include: boolean
  data: ParsedListing
  images: string[]
  videos: string[]
}

function confidenceColor(c: number): string {
  if (c < 0.5) return '#E5735F'
  if (c < 0.75) return '#D8A93C'
  return '#4DC8A8'
}

export default function ReviewCards({
  batchId,
  listings,
  brokers,
  preloadedMedia = [],
  onCommitted,
}: {
  batchId: string
  listings: ParsedListing[]
  brokers: BrokerOption[]
  /** Per-listing arrays of already-uploaded Azure URLs. Index matches listings[i]. */
  preloadedMedia?: string[][]
  onCommitted: (result: { count: number; published: boolean }) => void
}) {
  const [items, setItems] = useState<CardItem[]>(() =>
    listings.map((l, idx) => {
      const urls = preloadedMedia[idx] ?? []
      const images = urls.filter((u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u))
      const videos = urls.filter((u) => /\.(mp4|mov|webm)(\?|$)/i.test(u))
      return { include: (l.aiConfidence ?? 0) >= 0.5, data: l, images, videos }
    })
  )
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const defaultBroker = brokers.find((b) => b.role === 'ADMIN') ?? brokers[0]
  const [postedById, setPostedById] = useState(defaultBroker?.id ?? '')
  const [committing, setCommitting] = useState<'publish' | 'draft' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = items.filter((i) => i.include)

  function update(idx: number, patch: Partial<ParsedListing>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, data: { ...it.data, ...patch } } : it)))
  }

  function toggle(idx: number) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, include: !it.include } : it)))
  }

  async function uploadMedia(idx: number, files: FileList) {
    if (!files.length) return
    setUploadingIdx(idx)
    try {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      const urls: string[] = json.urls ?? []
      const imgs = urls.filter((u) => /\.(jpe?g|png|webp|gif)$/i.test(u))
      const vids = urls.filter((u) => /\.(mp4|mov|webm)$/i.test(u))
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, images: [...it.images, ...imgs], videos: [...it.videos, ...vids] } : it)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingIdx(null)
    }
  }

  function removeMedia(idx: number, url: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, images: it.images.filter((u) => u !== url), videos: it.videos.filter((u) => u !== url) } : it)))
  }

  function numOrNull(v: string): number | null {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  async function commit(publish: boolean) {
    if (selected.length === 0 || committing) return
    setCommitting(publish ? 'publish' : 'draft')
    setError(null)
    try {
      const res = await fetch('/api/admin/intake/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, postedById, publish, listings: selected.map((s) => ({ ...s.data, images: s.images, videos: s.videos })) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Commit failed — please try again.')
      onCommitted({ count: json.count ?? selected.length, published: publish })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    } finally {
      setCommitting(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* toolbar */}
      <div className="card spread" style={{ padding: '1rem 1.4rem' }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cream)' }}>
          {items.length} listing{items.length === 1 ? '' : 's'} parsed ·{' '}
          <span style={{ color: 'var(--o3)' }}>{selected.length} selected</span>
        </span>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <span className="label">Post as</span>
          <select
            className="select"
            style={{ width: 'auto', minWidth: 160 }}
            value={postedById}
            onChange={(e) => setPostedById(e.target.value)}
          >
            {brokers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.role === 'ADMIN' ? '· Admin' : ''}
              </option>
            ))}
          </select>
          <button
            className="btn btn-solid"
            disabled={selected.length === 0 || committing !== null}
            onClick={() => commit(true)}
          >
            {committing === 'publish' ? 'Publishing…' : 'Publish selected live'}
          </button>
          <button
            className="btn btn-quiet"
            disabled={selected.length === 0 || committing !== null}
            onClick={() => commit(false)}
          >
            {committing === 'draft' ? 'Saving…' : 'Save as drafts'}
          </button>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}

      {items.map((item, idx) => {
        const d = item.data
        const pct = Math.round(Math.max(0, Math.min(1, d.aiConfidence ?? 0)) * 100)
        return (
          <div key={idx} className="card" style={{ opacity: item.include ? 1 : 0.55, transition: 'opacity 0.2s' }}>
            <div className="spread" style={{ marginBottom: '1.1rem' }}>
              <label className="row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={item.include}
                  onChange={() => toggle(idx)}
                  style={{ width: 16, height: 16, accentColor: 'var(--o)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--cream)' }}>Include this listing</span>
              </label>
              <div className="row" style={{ minWidth: 220 }}>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    minWidth: 110,
                    borderRadius: 4,
                    background: 'rgba(253, 248, 242, 0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: confidenceColor(d.aiConfidence ?? 0),
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <span className="hint" style={{ whiteSpace: 'nowrap' }}>
                  AI confidence · {pct}%
                </span>
              </div>
            </div>

            <div className="form-grid">
              <div className="field full">
                <span className="label">Title</span>
                <input className="input" value={d.title} onChange={(e) => update(idx, { title: e.target.value })} />
              </div>
              <div className="field">
                <span className="label">Property type</span>
                <select
                  className="select"
                  value={d.type}
                  onChange={(e) => update(idx, { type: e.target.value as ParsedListing['type'] })}
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {propertyTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="label">Listing for</span>
                <div className="tabs" style={{ padding: 3 }}>
                  <button
                    type="button"
                    className={`tab ${d.listingFor === 'SALE' ? 'active' : ''}`}
                    style={{ padding: '0.4rem 1.1rem' }}
                    onClick={() => update(idx, { listingFor: 'SALE' })}
                  >
                    Sale
                  </button>
                  <button
                    type="button"
                    className={`tab ${d.listingFor === 'RENT' ? 'active' : ''}`}
                    style={{ padding: '0.4rem 1.1rem' }}
                    onClick={() => update(idx, { listingFor: 'RENT' })}
                  >
                    Rent
                  </button>
                </div>
              </div>
              <div className="field">
                <span className="label">BHK</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={d.bhk ?? ''}
                  onChange={(e) => {
                    const n = numOrNull(e.target.value)
                    update(idx, { bhk: n == null ? null : Math.round(n) })
                  }}
                />
              </div>
              <div className="field">
                <span className="label">Price (₹)</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={d.price ?? ''}
                  onChange={(e) => update(idx, { price: numOrNull(e.target.value) })}
                />
                <span className="hint">
                  {d.price != null ? `Shows as ${formatPrice(d.price, d.listingFor)}` : 'Empty = "Price on request"'}
                </span>
              </div>
              <div className="field">
                <span className="label">Area ({d.areaUnit || 'sqft'})</span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  value={d.area ?? ''}
                  onChange={(e) => update(idx, { area: numOrNull(e.target.value) })}
                />
              </div>
              <div className="field">
                <span className="label">Locality</span>
                <input
                  className="input"
                  value={d.locality}
                  onChange={(e) => update(idx, { locality: e.target.value })}
                />
              </div>
              <div className="field">
                <span className="label">Owner name</span>
                <input
                  className="input"
                  value={d.ownerName ?? ''}
                  onChange={(e) => update(idx, { ownerName: e.target.value || null })}
                />
              </div>
              <div className="field">
                <span className="label">Owner phone</span>
                <input
                  className="input"
                  value={d.ownerPhone ?? ''}
                  onChange={(e) => update(idx, { ownerPhone: e.target.value || null })}
                />
              </div>
              <div className="field">
                <span className="label">Posted by (broker)</span>
                <input
                  className="input"
                  value={d.postedByName ?? ''}
                  onChange={(e) => update(idx, { postedByName: e.target.value || null })}
                  placeholder="WhatsApp group sender"
                />
                <span className="hint">Auto-credited to this broker if their name is registered.</span>
              </div>
              <div className="field full">
                <span className="label">Description</span>
                <textarea
                  className="textarea"
                  rows={3}
                  style={{ minHeight: 80 }}
                  value={d.description}
                  onChange={(e) => update(idx, { description: e.target.value })}
                />
              </div>
            </div>

            {/* media */}
            <div style={{ marginTop: '0.9rem' }}>
              <div className="spread" style={{ marginBottom: 8 }}>
                <span className="label">
                  Photos &amp; videos{d.mediaCount > 0 ? ` · ${d.mediaCount} in chat` : ''}
                </span>
                <label className="btn btn-quiet btn-sm" style={{ cursor: 'pointer' }}>
                  {uploadingIdx === idx ? 'Uploading…' : '⬆ Attach media'}
                  <input
                    type="file" accept="image/*,video/*" multiple hidden
                    disabled={uploadingIdx !== null}
                    onChange={(e) => { if (e.target.files) uploadMedia(idx, e.target.files); e.target.value = '' }}
                  />
                </label>
              </div>
              {d.mediaCount > 0 && item.images.length === 0 && item.videos.length === 0 && (
                <p className="hint" style={{ marginBottom: 8 }}>
                  📎 This message had {d.mediaCount} attachment{d.mediaCount === 1 ? '' : 's'} in WhatsApp — re-attach them here so they show on the listing.
                </p>
              )}
              {(item.images.length > 0 || item.videos.length > 0) && (
                <div className="chips">
                  {item.images.map((u) => (
                    <span key={u} className="chip on">🖼 {u.split('/').pop()} <button onClick={() => removeMedia(idx, u)}>✕</button></span>
                  ))}
                  {item.videos.map((u) => (
                    <span key={u} className="chip on">▶ {u.split('/').pop()} <button onClick={() => removeMedia(idx, u)}>✕</button></span>
                  ))}
                </div>
              )}
            </div>

            {d.aiNotes && (
              <div
                style={{
                  marginTop: '1rem',
                  background: 'rgba(200, 96, 26, 0.07)',
                  border: '1px solid rgba(200, 96, 26, 0.25)',
                  borderRadius: 12,
                  padding: '0.7rem 1rem',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: 'var(--o3)',
                }}
              >
                ✦ AI notes: {d.aiNotes}
              </div>
            )}

            {d.rawText && (
              <details style={{ marginTop: '0.8rem' }}>
                <summary className="hint" style={{ cursor: 'pointer' }}>
                  Source message
                </summary>
                <pre
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    color: 'var(--muted)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: 10,
                    padding: '0.8rem 1rem',
                    marginTop: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  {d.rawText}
                </pre>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
