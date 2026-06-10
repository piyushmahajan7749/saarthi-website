'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPrice, propertyTypeLabel, statusLabel } from '@/lib/format'
import { mediaGradient, typeIcon } from '@/components/PropertyCard'
import { PROPERTY_STATUSES } from '@/types'

export interface ListingRow {
  id: string
  title: string
  locality: string
  city: string
  price: number | null
  type: string
  listingFor: string
  status: string
  source: string
  featured: boolean
  views: number
  postedByName: string | null
  createdAt: string
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'badge-green'
    case 'PENDING_REVIEW': return 'badge-gold'
    case 'DRAFT': return 'badge-gray'
    case 'SOLD':
    case 'RENTED': return 'badge-teal'
    case 'ARCHIVED': return 'badge-red'
    default: return 'badge-gray'
  }
}

export default function ListingsTable({ rows }: { rows: ListingRow[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Update failed')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(null)
    }
  }

  async function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setBusy(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/listings/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="empty">
        <div className="empty-icon">🏘️</div>
        No listings here yet. <Link href="/admin/listings/new" style={{ color: 'var(--o3)' }}>Add one</Link> or import via the{' '}
        <Link href="/admin/intake" style={{ color: 'var(--o3)' }}>Intake parser</Link>.
      </div>
    )
  }

  return (
    <div>
      {error && <p className="error-text" style={{ marginBottom: 10 }}>⚠ {error}</p>}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Property</th>
              <th>Price</th>
              <th>Type</th>
              <th>Status</th>
              <th>Source</th>
              <th>Posted by</th>
              <th>Views</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={r.status === 'PENDING_REVIEW' ? { background: 'rgba(184,134,26,0.06)' } : undefined}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: mediaGradient(r.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {typeIcon(r.type)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/admin/listings/${r.id}`} style={{ color: 'var(--cream)', textDecoration: 'none', fontWeight: 500 }}>
                        {r.featured ? '★ ' : ''}{r.title}
                      </Link>
                      <div className="sub">📍 {[r.locality, r.city].filter(Boolean).join(', ')}</div>
                    </div>
                  </div>
                </td>
                <td className="mono" style={{ whiteSpace: 'nowrap' }}>{formatPrice(r.price, r.listingFor)}</td>
                <td className="sub">{propertyTypeLabel(r.type)}</td>
                <td><span className={`badge ${statusBadgeClass(r.status)}`}>{statusLabel(r.status)}</span></td>
                <td><span className="badge badge-gray">{r.source}</span></td>
                <td className="sub">{r.postedByName ?? '—'}</td>
                <td className="mono">{r.views}</td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {r.status === 'PENDING_REVIEW' && (
                      <button className="btn btn-solid btn-sm" disabled={busy === r.id} onClick={() => patch(r.id, { status: 'ACTIVE' })}>
                        Approve
                      </button>
                    )}
                    <select
                      className="select"
                      style={{ width: 'auto', padding: '0.3rem 1.8rem 0.3rem 0.7rem', fontSize: 12 }}
                      value={r.status}
                      disabled={busy === r.id}
                      onChange={(e) => patch(r.id, { status: e.target.value })}
                    >
                      {PROPERTY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                    <button
                      className="btn btn-quiet btn-sm"
                      title={r.featured ? 'Unfeature' : 'Feature'}
                      disabled={busy === r.id}
                      onClick={() => patch(r.id, { featured: !r.featured })}
                      style={{ color: r.featured ? 'var(--gold)' : undefined }}
                    >
                      ★
                    </button>
                    <Link href={`/admin/listings/${r.id}`} className="btn btn-quiet btn-sm">Edit</Link>
                    <button className="btn btn-danger btn-sm" disabled={busy === r.id} onClick={() => remove(r.id, r.title)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
