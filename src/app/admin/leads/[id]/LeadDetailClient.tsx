'use client'

// Right-hand CRM panel for a lead: status, assignment, AI requirements,
// matched properties, activity trail and notes. All mutations PATCH
// /api/admin/leads/[id] and refresh the server-rendered transcript.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice, propertyTypeLabel, statusLabel, timeAgo } from '@/lib/format'
import { LEAD_STATUSES, type LeadRequirements } from '@/types'

interface LeadData {
  id: string
  name: string | null
  phone: string
  status: string
  score: number
  source: string
  brokerNotified: boolean
  assignedToId: string | null
  aiSummary: string | null
  createdAt: string
  requirements: LeadRequirements
}
interface UserRow {
  id: string
  name: string
  role: string
}
interface MatchRow {
  id: string
  propertyId: string
  title: string
  price: number | null
  listingFor: string
  score: number
  sentAt: string
}
interface ActivityRow {
  id: string
  type: string
  description: string
  createdAt: string
}

const ACTIVITY_ICON: Record<string, string> = {
  LEAD_CREATED: '✨',
  STATUS_CHANGE: '🔄',
  BROKER_NOTIFIED: '🔔',
  MATCHES_SENT: '🏠',
  NOTE: '📝',
  VISIT_SCHEDULED: '📅',
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--o)'
  if (score >= 40) return '#D8A93C'
  return 'rgba(253,248,242,0.35)'
}

function budgetText(req: LeadRequirements): string | null {
  if (req.budgetMin && req.budgetMax)
    return `${formatPrice(req.budgetMin)} – ${formatPrice(req.budgetMax, req.listingFor)}`
  if (req.budgetMax) return `up to ${formatPrice(req.budgetMax, req.listingFor)}`
  if (req.budgetMin) return `from ${formatPrice(req.budgetMin, req.listingFor)}`
  return null
}

export default function LeadDetailClient({
  lead,
  users,
  matches,
  activities,
}: {
  lead: LeadData
  users: UserRow[]
  matches: MatchRow[]
  activities: ActivityRow[]
}) {
  const router = useRouter()
  const [status, setStatus] = useState(lead.status)
  const [assignedToId, setAssignedToId] = useState(lead.assignedToId ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [brokerAlert, setBrokerAlert] = useState<string | null>(null)
  const [notified, setNotified] = useState(lead.brokerNotified)

  async function patch(payload: Record<string, unknown>, kind: string): Promise<boolean> {
    setSaving(kind)
    setError(null)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Update failed — try again')
      if (data?.brokerAlert) {
        setBrokerAlert(data.brokerAlert)
        setNotified(true)
      }
      router.refresh()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed — try again')
      return false
    } finally {
      setSaving(null)
    }
  }

  async function changeStatus(next: string) {
    const prev = status
    setStatus(next)
    const ok = await patch({ status: next }, 'status')
    if (!ok) setStatus(prev)
  }

  async function changeAssignee(next: string) {
    const prev = assignedToId
    setAssignedToId(next)
    const ok = await patch({ assignedToId: next || null }, 'assign')
    if (!ok) setAssignedToId(prev)
  }

  async function saveNote() {
    if (!note.trim()) return
    const ok = await patch({ note: note.trim() }, 'note')
    if (ok) setNote('')
  }

  const req = lead.requirements
  const chips: string[] = []
  if (req.listingFor) chips.push(req.listingFor === 'RENT' ? '🔑 Rent' : '🏷️ Buy')
  if (req.type) chips.push(propertyTypeLabel(req.type))
  if (req.bhk) chips.push(`${req.bhk} BHK`)
  const budget = budgetText(req)
  if (budget) chips.push(`💰 ${budget}`)
  for (const loc of req.localities ?? []) chips.push(`📍 ${loc}`)
  if (req.timeline) chips.push(`⏱ ${req.timeline}`)
  if (req.purpose) chips.push(`🎯 ${req.purpose}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {brokerAlert && (
        <div
          className="card"
          style={{ borderColor: 'rgba(200,96,26,0.45)', background: 'rgba(200,96,26,0.06)' }}
        >
          <div className="spread" style={{ marginBottom: 8 }}>
            <span className="label" style={{ color: 'var(--o3)' }}>
              📤 Sent to broker
            </span>
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => setBrokerAlert(null)}
              aria-label="Dismiss broker alert"
            >
              ✕
            </button>
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: "'Outfit', sans-serif",
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'var(--cream)',
              margin: 0,
            }}
          >
            {brokerAlert}
          </pre>
        </div>
      )}

      {error && <p className="error-text">⚠ {error}</p>}

      {/* ---------- status / score / assignment ---------- */}
      <div className="card">
        <div className="spread" style={{ marginBottom: '1rem' }}>
          <span className="label">Status</span>
          {notified ? (
            <span className="badge badge-green">🔔 Broker alerted</span>
          ) : (
            <span className="badge badge-gray">Broker not yet alerted</span>
          )}
        </div>

        <div className="field" style={{ marginBottom: '1rem' }}>
          <select
            className="select"
            value={status}
            disabled={saving === 'status'}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          {status === 'WARM' && !notified && (
            <span className="hint" style={{ color: 'var(--o3)' }}>
              🔥 Broker will be alerted on WhatsApp
            </span>
          )}
        </div>

        <div style={{ marginBottom: '1.1rem' }}>
          <div className="spread" style={{ marginBottom: 6 }}>
            <span className="hint">Qualification score</span>
            <span className="hint mono" style={{ color: scoreColor(lead.score) }}>
              {lead.score}/100
            </span>
          </div>
          <div
            style={{
              height: 7,
              borderRadius: 50,
              background: 'rgba(253,248,242,0.07)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, lead.score))}%`,
                height: '100%',
                borderRadius: 50,
                background: scoreColor(lead.score),
                transition: 'width 0.4s',
              }}
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: '0.9rem' }}>
          <span className="label">Assigned broker</span>
          <select
            className="select"
            value={assignedToId}
            disabled={saving === 'assign'}
            onChange={(e) => changeAssignee(e.target.value)}
          >
            <option value="">— Unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role.toLowerCase()})
              </option>
            ))}
          </select>
        </div>

        <p className="hint">
          Source: {lead.source.toLowerCase()} · created {timeAgo(lead.createdAt)}
        </p>
      </div>

      {/* ---------- requirements ---------- */}
      <div className="card">
        <span className="label" style={{ display: 'block', marginBottom: '0.9rem' }}>
          Requirements (AI-extracted)
        </span>
        {chips.length === 0 ? (
          <p className="hint">
            Bot hasn&apos;t captured requirements yet — conversation abhi chal rahi hai.
          </p>
        ) : (
          <div className="chips">
            {chips.map((c, i) => (
              <span key={i} className="chip" style={{ cursor: 'default' }}>
                {c}
              </span>
            ))}
          </div>
        )}
        {req.notes && (
          <p className="hint" style={{ marginTop: '0.8rem' }}>
            📝 {req.notes}
          </p>
        )}
        {lead.aiSummary && (
          <p
            style={{
              marginTop: '0.9rem',
              fontStyle: 'italic',
              fontSize: 13.5,
              lineHeight: 1.65,
              color: 'var(--faint)',
            }}
          >
            ✦ {lead.aiSummary}
          </p>
        )}
      </div>

      {/* ---------- matched properties ---------- */}
      <div className="card">
        <span className="label" style={{ display: 'block', marginBottom: '0.9rem' }}>
          Matched properties
        </span>
        {matches.length === 0 ? (
          <p className="hint">No matches sent yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {matches.map((m, i) => (
              <div
                key={m.id}
                className="spread"
                style={{
                  padding: '0.6rem 0',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(253,248,242,0.06)',
                  gap: '0.6rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <a
                    href={`/listings/${m.propertyId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--cream)', fontSize: 13.5, fontWeight: 500, textDecoration: 'none' }}
                  >
                    {m.title} ↗
                  </a>
                  <div className="hint" style={{ marginTop: 2 }}>
                    {formatPrice(m.price, m.listingFor)} · sent {timeAgo(m.sentAt)}
                  </div>
                </div>
                <span className="badge badge-orange">{Math.round(m.score)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- activity ---------- */}
      <div className="card">
        <span className="label" style={{ display: 'block', marginBottom: '0.9rem' }}>
          Activity
        </span>
        {activities.length === 0 ? (
          <p className="hint">Nothing logged yet</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activities.map((a) => (
              <li key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>
                  {ACTIVITY_ICON[a.type] ?? '•'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--cream)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {a.description}
                  </div>
                  <div className="hint" style={{ marginTop: 1 }}>
                    {timeAgo(a.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- add note ---------- */}
      <div className="card">
        <div className="field">
          <span className="label">Add note</span>
          <textarea
            className="textarea"
            style={{ minHeight: 80 }}
            placeholder="e.g. Called at 6pm — visit fixed for Sunday morning"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving === 'note'}
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn btn-quiet btn-sm"
              onClick={saveNote}
              disabled={saving === 'note' || !note.trim()}
            >
              {saving === 'note' ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
