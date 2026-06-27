'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ParsedListing } from '@/types'
import { formatPrice, formatPhone, timeAgo } from '@/lib/format'
import ReviewCards, { type BrokerOption } from './ReviewCards'

export type { BrokerOption }

export interface WebSubmission {
  id: string
  title: string
  type: string
  listingFor: string
  bhk: number | null
  price: number | null
  area: number | null
  areaUnit: string
  locality: string
  city: string
  ownerName: string | null
  ownerPhone: string | null
  description: string
  aiNotes: string | null
  createdAt: string
}

export interface BatchRow {
  id: string
  source: string
  status: string
  itemCount: number
  committedCount: number
  preview: string
  createdAt: string
}

type TabKey = 'whatsapp' | 'excel' | 'web' | 'history'

interface ParseResult {
  batchId: string
  listings: ParsedListing[]
}

interface CommitSummary {
  count: number
  published: boolean
}

const WA_PLACEHOLDER = `3bhk flat vijay nagar 85 lakh semi furnished 7th floor call 9826012345

2 BHK rent mein hai Palasia, 18k per month, fully furnished, family preferred — Sharma ji 9893011223

Plot 1200 sqft Super Corridor 32 lac clear title, contact Verma 9907654321`

function sourceBadge(source: string): { cls: string; label: string } {
  switch (source) {
    case 'WHATSAPP':
      return { cls: 'badge-green', label: '📱 WhatsApp' }
    case 'EXCEL':
      return { cls: 'badge-blue', label: '📊 Excel' }
    case 'WEBFORM':
      return { cls: 'badge-teal', label: '🌐 Webform' }
    default:
      return { cls: 'badge-gray', label: source }
  }
}

function batchStatusBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case 'COMMITTED':
      return { cls: 'badge-green', label: 'Committed' }
    case 'PARSED':
      return { cls: 'badge-gold', label: 'Parsed' }
    case 'DISCARDED':
      return { cls: 'badge-gray', label: 'Discarded' }
    default:
      return { cls: 'badge-gray', label: status }
  }
}

function SuccessNote({ summary, onDismiss }: { summary: CommitSummary; onDismiss: () => void }) {
  return (
    <div
      className="card spread"
      style={{ borderColor: 'rgba(40, 160, 120, 0.35)', background: 'rgba(40, 160, 120, 0.05)', padding: '1rem 1.4rem' }}
    >
      <p className="ok-text" style={{ fontSize: 14 }}>
        ✅ {summary.count} listing{summary.count === 1 ? '' : 's'} {summary.published ? 'published' : 'saved as drafts'} ·{' '}
        <Link href="/admin/listings" style={{ color: '#4DC8A8', textDecoration: 'underline' }}>
          view in Listings
        </Link>
      </p>
      <button className="btn btn-quiet btn-sm" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

export default function IntakeClient({
  brokers,
  webSubmissions,
  batches,
}: {
  brokers: BrokerOption[]
  webSubmissions: WebSubmission[]
  batches: BatchRow[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('whatsapp')

  // ---- Tab 1: WhatsApp ----
  type WaMode = 'zip' | 'paste'
  const [waMode, setWaMode] = useState<WaMode>('zip')
  const [waError, setWaError] = useState<string | null>(null)
  const [waResult, setWaResult] = useState<ParseResult | null>(null)
  const [waSuccess, setWaSuccess] = useState<CommitSummary | null>(null)
  // Per-listing media arrays (exact match from zip, or order-based from paste+pool)
  const [preloadedMedia, setPreloadedMedia] = useState<string[][]>([])

  function resetWa() {
    setWaResult(null)
    setWaError(null)
    setPreloadedMedia([])
  }

  // ---- Sub-mode A: ZIP upload ----
  const [zipDragOver, setZipDragOver] = useState(false)
  const [zipParsing, setZipParsing] = useState(false)

  async function handleZip(file: File) {
    if (zipParsing) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setWaError('Please upload a .zip file from WhatsApp "Export Chat > Attach Media".')
      return
    }
    setZipParsing(true)
    setWaError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/intake/parse-wa-zip', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to process zip.')
      if (!Array.isArray(json.listings) || json.listings.length === 0) {
        setWaError('No listings found in the chat. Check the export has actual listing messages.')
        return
      }
      setPreloadedMedia(json.mediaByListing ?? [])
      setWaResult({ batchId: json.batchId, listings: json.listings })
    } catch (e) {
      setWaError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    } finally {
      setZipParsing(false)
    }
  }

  // ---- Sub-mode B: Paste text + optional media pool ----
  const [text, setText] = useState('')
  const [textParsing, setTextParsing] = useState(false)
  const [mediaPool, setMediaPool] = useState<string[]>([])
  const [mediaUploading, setMediaUploading] = useState(false)
  const [mediaDragOver, setMediaDragOver] = useState(false)

  async function uploadMediaPool(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => /\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i.test(f.name))
    if (!arr.length) return
    setMediaUploading(true)
    try {
      const fd = new FormData()
      arr.forEach((f) => fd.append('files', f))
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      setMediaPool((prev) => [...prev, ...(json.urls ?? [])])
    } catch {
      // non-fatal — user can still attach per card
    } finally {
      setMediaUploading(false)
    }
  }

  async function parseText() {
    if (!text.trim() || textParsing) return
    setTextParsing(true)
    setWaError(null)
    try {
      const res = await fetch('/api/admin/intake/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Parsing failed — please try again.')
      if (!Array.isArray(json.listings) || json.listings.length === 0) {
        setWaError('No listings found — try pasting actual listing messages.')
        return
      }
      // Distribute pool by mediaCount order (best-effort; user can reassign per card)
      let poolIdx = 0
      const distributed: string[][] = json.listings.map((l: { mediaCount?: number }) => {
        const count = l.mediaCount ?? 0
        const slice = mediaPool.slice(poolIdx, poolIdx + count)
        poolIdx += count
        return slice
      })
      setPreloadedMedia(distributed)
      setWaResult({ batchId: json.batchId, listings: json.listings })
    } catch (e) {
      setWaError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    } finally {
      setTextParsing(false)
    }
  }

  // ---- Tab 2: Excel upload ----
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [excelParsingName, setExcelParsingName] = useState<string | null>(null)
  const [excelError, setExcelError] = useState<string | null>(null)
  const [excelResult, setExcelResult] = useState<ParseResult | null>(null)
  const [excelSuccess, setExcelSuccess] = useState<CommitSummary | null>(null)

  async function handleFile(file: File) {
    if (excelParsingName) return
    setExcelParsingName(file.name)
    setExcelError(null)
    setExcelSuccess(null)
    setExcelResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/intake/parse-excel', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Parsing failed — please try again.')
      if (!Array.isArray(json.listings) || json.listings.length === 0) {
        setExcelError('No listings could be extracted from that file. Check the sheet has one property per row.')
        return
      }
      setExcelResult({ batchId: json.batchId, listings: json.listings })
    } catch (e) {
      setExcelError(e instanceof Error ? e.message : 'Something went wrong — please try again.')
    } finally {
      setExcelParsingName(null)
    }
  }

  // ---- Tab 3: Web submissions ----
  const [webs, setWebs] = useState<WebSubmission[]>(webSubmissions)
  const [webError, setWebError] = useState<string | null>(null)

  async function moderate(id: string, status: 'ACTIVE' | 'ARCHIVED') {
    const prev = webs
    setWebError(null)
    setWebs((w) => w.filter((x) => x.id !== id)) // optimistic
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Update failed — please try again.')
      }
      router.refresh()
    } catch (e) {
      setWebs(prev)
      setWebError(e instanceof Error ? e.message : 'Update failed — please try again.')
    }
  }

  return (
    <div>
      <div className="tabs" style={{ marginBottom: '1.6rem', flexWrap: 'wrap' }}>
        <button className={`tab ${tab === 'whatsapp' ? 'active' : ''}`} onClick={() => setTab('whatsapp')}>
          📱 WhatsApp import
        </button>
        <button className={`tab ${tab === 'excel' ? 'active' : ''}`} onClick={() => setTab('excel')}>
          📊 Excel upload
        </button>
        <button className={`tab ${tab === 'web' ? 'active' : ''}`} onClick={() => setTab('web')}>
          🌐 Web submissions ({webs.length})
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          🕘 History
        </button>
      </div>

      {/* ============ Tab 1: WhatsApp ============ */}
      {tab === 'whatsapp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {waSuccess && <SuccessNote summary={waSuccess} onDismiss={() => setWaSuccess(null)} />}

          {!waResult && (
            <>
              {/* Mode switcher */}
              <div className="tabs" style={{ padding: 3 }}>
                <button
                  className={`tab ${waMode === 'zip' ? 'active' : ''}`}
                  style={{ padding: '0.45rem 1.2rem' }}
                  onClick={() => { setWaMode('zip'); setWaError(null) }}
                >
                  📦 Upload ZIP export
                </button>
                <button
                  className={`tab ${waMode === 'paste' ? 'active' : ''}`}
                  style={{ padding: '0.45rem 1.2rem' }}
                  onClick={() => { setWaMode('paste'); setWaError(null) }}
                >
                  ✍️ Paste text
                </button>
              </div>

              {/* ---- Mode A: ZIP ---- */}
              {waMode === 'zip' && (
                <div className="card">
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      padding: '3rem 2rem',
                      border: `1.5px dashed ${zipDragOver ? 'var(--o)' : 'rgba(200,96,26,0.35)'}`,
                      borderRadius: 14,
                      background: zipDragOver ? 'rgba(200,96,26,0.06)' : 'rgba(0,0,0,0.12)',
                      cursor: zipParsing ? 'default' : 'pointer',
                      transition: 'all 0.18s',
                      textAlign: 'center',
                    }}
                    onDragOver={(e) => { e.preventDefault(); setZipDragOver(true) }}
                    onDragLeave={() => setZipDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setZipDragOver(false)
                      const f = e.dataTransfer.files?.[0]
                      if (f) handleZip(f)
                    }}
                  >
                    <span style={{ fontSize: 40 }}>{zipParsing ? '⏳' : '📦'}</span>
                    <span style={{ fontWeight: 500, color: 'var(--cream)', fontSize: 15 }}>
                      {zipParsing ? 'Uploading & parsing…' : 'Drop your WhatsApp export .zip here'}
                    </span>
                    <span className="hint" style={{ maxWidth: 380 }}>
                      Photos &amp; videos are matched to the right listing by filename — no guessing.
                      <br />
                      On WhatsApp: <strong>group → ⋮ → Export Chat → Attach Media</strong>
                    </span>
                    <input
                      type="file" accept=".zip" hidden
                      disabled={zipParsing}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleZip(f)
                        e.currentTarget.value = ''
                      }}
                    />
                  </label>
                  {waError && <p className="error-text" style={{ marginTop: 10 }}>{waError}</p>}
                </div>
              )}

              {/* ---- Mode B: Paste text ---- */}
              {waMode === 'paste' && (
                <div className="card">
                  <div className="field">
                    <span className="label">Raw WhatsApp text</span>
                    <textarea
                      className="textarea"
                      rows={12}
                      placeholder={WA_PLACEHOLDER}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <span className="hint">
                      Paste the <code>_chat.txt</code> or any broker messages — AI splits and structures them.
                    </span>
                  </div>

                  <div className="field" style={{ marginTop: '0.8rem' }}>
                    <span className="label">
                      Photos &amp; videos{' '}
                      <span className="hint" style={{ fontWeight: 400 }}>— optional, distributed in order</span>
                    </span>
                    <label
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        padding: '1.1rem 1.4rem',
                        border: `1.5px dashed ${mediaDragOver ? 'var(--o)' : 'rgba(200,96,26,0.28)'}`,
                        borderRadius: 12,
                        background: mediaDragOver ? 'rgba(200,96,26,0.06)' : 'rgba(0,0,0,0.15)',
                        cursor: mediaUploading ? 'default' : 'pointer',
                        transition: 'all 0.18s', textAlign: 'center',
                      }}
                      onDragOver={(e) => { e.preventDefault(); setMediaDragOver(true) }}
                      onDragLeave={() => setMediaDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault(); setMediaDragOver(false)
                        if (!mediaUploading && e.dataTransfer.files.length) uploadMediaPool(e.dataTransfer.files)
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{mediaUploading ? '⏳' : '📸'}</span>
                      <span className="hint">
                        {mediaUploading
                          ? `Uploading… (${mediaPool.length} done)`
                          : mediaPool.length > 0
                          ? `${mediaPool.length} file${mediaPool.length === 1 ? '' : 's'} ready`
                          : 'Drop images/videos here'}
                      </span>
                      <input
                        type="file" accept="image/*,video/*" multiple hidden
                        disabled={mediaUploading}
                        onChange={(e) => { if (e.target.files?.length) uploadMediaPool(e.target.files); e.currentTarget.value = '' }}
                      />
                    </label>
                    {mediaPool.length > 0 && (
                      <div className="chips" style={{ marginTop: 8 }}>
                        {mediaPool.map((u) => (
                          <span key={u} className="chip on" style={{ fontSize: 12 }}>
                            🖼 {u.split('/').pop()?.split('-').slice(1).join('-') || u.split('/').pop()}
                            <button onClick={() => setMediaPool((p) => p.filter((x) => x !== u))}>✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="row" style={{ marginTop: '1rem' }}>
                    <button className="btn btn-solid" disabled={!text.trim() || textParsing || mediaUploading} onClick={parseText}>
                      {textParsing ? 'Parsing…' : 'Parse with AI ✦'}
                    </button>
                    {waError && <span className="error-text">{waError}</span>}
                  </div>
                </div>
              )}
            </>
          )}

          {waResult && (
            <>
              <div className="row">
                <button className="btn btn-quiet btn-sm" onClick={resetWa}>← Start over</button>
              </div>
              <ReviewCards
                key={waResult.batchId}
                batchId={waResult.batchId}
                listings={waResult.listings}
                brokers={brokers}
                preloadedMedia={preloadedMedia}
                onCommitted={(summary) => {
                  resetWa()
                  setText('')
                  setMediaPool([])
                  setWaSuccess(summary)
                  router.refresh()
                }}
              />
            </>
          )}
        </div>
      )}

      {/* ============ Tab 2: Excel upload ============ */}
      {tab === 'excel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {excelSuccess && <SuccessNote summary={excelSuccess} onDismiss={() => setExcelSuccess(null)} />}
          {!excelResult && !excelParsingName && (
            <>
              <label
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  border: `1.5px dashed ${dragOver ? 'var(--o)' : 'rgba(200, 96, 26, 0.35)'}`,
                  background: dragOver ? 'rgba(200, 96, 26, 0.06)' : undefined,
                  padding: '3.5rem 2rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files?.[0]
                  if (f) handleFile(f)
                }}
              >
                <span style={{ fontSize: 38 }}>📊</span>
                <span style={{ color: 'var(--cream)', fontWeight: 500, fontSize: 15 }}>
                  Drop .xlsx / .csv here or click to browse
                </span>
                <span className="hint">Any column layout works — AI maps it to Saarthi fields.</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
              {excelError && <p className="error-text">{excelError}</p>}
            </>
          )}
          {excelParsingName && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ color: 'var(--cream)', fontSize: 14 }}>
                Parsing <strong>{excelParsingName}</strong> — AI is mapping the columns…
              </span>
              <div className="skel" style={{ height: 10, width: '70%' }} />
              <div className="skel" style={{ height: 10, width: '45%' }} />
            </div>
          )}
          {excelResult && (
            <>
              <div className="row">
                <button
                  className="btn btn-quiet btn-sm"
                  onClick={() => {
                    setExcelResult(null)
                    setExcelError(null)
                  }}
                >
                  ← Upload another file
                </button>
              </div>
              <ReviewCards
                key={excelResult.batchId}
                batchId={excelResult.batchId}
                listings={excelResult.listings}
                brokers={brokers}
                onCommitted={(summary) => {
                  setExcelResult(null)
                  setExcelSuccess(summary)
                  router.refresh()
                }}
              />
            </>
          )}
        </div>
      )}

      {/* ============ Tab 3: Web submissions ============ */}
      {tab === 'web' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {webError && <p className="error-text">{webError}</p>}
          {webs.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🎉</div>
              No pending web submissions
            </div>
          ) : (
            webs.map((p) => (
              <div key={p.id} className="card">
                <div className="spread">
                  <div>
                    <div
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 24,
                        fontWeight: 700,
                        color: 'var(--o3)',
                        lineHeight: 1.1,
                      }}
                    >
                      {formatPrice(p.price, p.listingFor)}
                    </div>
                    <div style={{ color: 'var(--cream)', fontWeight: 500, marginTop: 4 }}>{p.title}</div>
                    <div className="hint" style={{ marginTop: 4 }}>
                      📍 {[p.locality, p.city].filter(Boolean).join(', ')} · {timeAgo(p.createdAt)}
                    </div>
                  </div>
                  <span className="badge badge-blue">🌐 Webform</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--cream)', marginTop: 12 }}>
                  👤 {p.ownerName || 'Owner'} {p.ownerPhone ? `· ${formatPhone(p.ownerPhone)}` : ''}
                </div>
                {p.description && (
                  <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginTop: 8 }}>{p.description}</p>
                )}
                {p.aiNotes && (
                  <div
                    style={{
                      marginTop: 10,
                      background: 'rgba(200, 96, 26, 0.07)',
                      border: '1px solid rgba(200, 96, 26, 0.25)',
                      borderRadius: 12,
                      padding: '0.7rem 1rem',
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: 'var(--o3)',
                    }}
                  >
                    ✦ AI notes: {p.aiNotes}
                  </div>
                )}
                <div className="row" style={{ marginTop: 14 }}>
                  <button className="btn btn-solid btn-sm" onClick={() => moderate(p.id, 'ACTIVE')}>
                    Approve &amp; publish
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => moderate(p.id, 'ARCHIVED')}>
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============ Tab 4: History ============ */}
      {tab === 'history' &&
        (batches.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🕘</div>
            No intake runs yet — paste a WhatsApp chat or upload an Excel to get started.
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Source</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th>Content</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const src = sourceBadge(b.source)
                  const st = batchStatusBadge(b.status)
                  return (
                    <tr key={b.id}>
                      <td className="sub" style={{ whiteSpace: 'nowrap' }}>
                        {timeAgo(b.createdAt)}
                      </td>
                      <td>
                        <span className={`badge ${src.cls}`}>{src.label}</span>
                      </td>
                      <td className="mono">
                        {b.itemCount} parsed
                        {b.committedCount > 0 ? ` · ${b.committedCount} committed` : ''}
                      </td>
                      <td>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </td>
                      <td
                        className="sub"
                        style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {b.preview || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  )
}
