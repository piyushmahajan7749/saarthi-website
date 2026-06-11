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
  createdByName: string | null
  conversationStarted: boolean
  aiSummary: string | null
  createdAt: string
  requirements: LeadRequirements
}
interface UserRow {
  id: string
  name: string
  role: string
}
interface VisitRow {
  id: string
  status: string
  scheduledFor: string | null
  availabilityText: string | null
  feedback: string | null
  notes: string | null
  coordinatorNotified: boolean
  propertyTitles: string[]
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

const VISIT_BADGE: Record<string, string> = {
  PROPOSED: 'badge-gold', TENTATIVE: 'badge-gold', CONFIRMED: 'badge-green',
  COMPLETED: 'badge-teal', CANCELLED: 'badge-red', NO_SHOW: 'badge-red',
}

export default function LeadDetailClient({
  lead,
  users,
  visits,
  matches,
  activities,
}: {
  lead: LeadData
  users: UserRow[]
  visits: VisitRow[]
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
  const [convoStarted, setConvoStarted] = useState(lead.conversationStarted)

  const hasPhone = !lead.phone.startsWith('manual:') && !lead.phone.startsWith('web:')

  async function patchVisit(visitId: string, body: Record<string, unknown>, kind: string) {
    setSaving(kind)
    setError(null)
    try {
      const res = await fetch(`/api/admin/visits/${visitId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || 'Update failed') }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(null)
    }
  }

  async function startConversation() {
    setSaving('initiate')
    setError(null)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'initiate' }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Could not start conversation')
      setConvoStarted(true)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start conversation')
    } finally {
      setSaving(null)
    }
  }

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

        {lead.createdByName && (
          <p className="hint" style={{ marginBottom: 4 }}>👤 Added by {lead.createdByName} (coordinates the visit)</p>
        )}
        <p className="hint">
          Source: {lead.source.toLowerCase()} · created {timeAgo(lead.createdAt)}
        </p>

        {/* Outbound conversation control */}
        <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid rgba(253,248,242,0.07)' }}>
          {!hasPhone ? (
            <p className="hint">📵 No phone captured — add one to start the WhatsApp conversation.</p>
          ) : convoStarted ? (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="badge badge-green">✅ Conversation started</span>
              <button className="btn btn-quiet btn-sm" disabled={saving === 'initiate'} onClick={startConversation}>
                {saving === 'initiate' ? 'Sending…' : 'Re-send opener'}
              </button>
            </div>
          ) : (
            <button className="btn btn-solid btn-block" disabled={saving === 'initiate'} onClick={startConversation}>
              {saving === 'initiate' ? 'Starting…' : '💬 Start WhatsApp conversation'}
            </button>
          )}
        </div>
      </div>

      {/* ---------- visits / scheduling ---------- */}
      <div className="card">
        <span className="label" style={{ display: 'block', marginBottom: '0.9rem' }}>Visits</span>
        {visits.length === 0 ? (
          <p className="hint">No visit scheduled yet. When the lead likes a property and shares availability, Saarthi proposes a tentative slot (never same-day) and pings the coordinator.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visits.map((v) => (
              <div key={v.id} style={{ border: '1px solid rgba(253,248,242,0.08)', borderRadius: 12, padding: '0.9rem' }}>
                <div className="spread" style={{ marginBottom: 8 }}>
                  <span className={`badge ${VISIT_BADGE[v.status] ?? 'badge-gray'}`}>{statusLabel(v.status) || v.status}</span>
                  {v.coordinatorNotified && <span className="badge badge-green">📤 Coordinator alerted</span>}
                </div>
                {v.scheduledFor && (
                  <div style={{ fontSize: 14, color: 'var(--cream)', marginBottom: 4 }}>
                    🗓 {new Date(v.scheduledFor).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}
                    <span className="hint"> (tentative)</span>
                  </div>
                )}
                {v.propertyTitles.length > 0 && (
                  <div className="hint" style={{ marginBottom: 6 }}>🏠 {v.propertyTitles.join(' · ')}</div>
                )}
                {v.availabilityText && <div className="hint" style={{ marginBottom: 6 }}>🕒 Lead said: “{v.availabilityText}”</div>}
                {v.feedback && <div className="ok-text" style={{ marginBottom: 6 }}>💬 {v.feedback}</div>}
                {['PROPOSED', 'TENTATIVE'].includes(v.status) && (
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    <button className="btn btn-solid btn-sm" disabled={saving === `v-${v.id}`} onClick={() => patchVisit(v.id, { status: 'CONFIRMED' }, `v-${v.id}`)}>Confirm</button>
                    <button className="btn btn-danger btn-sm" disabled={saving === `v-${v.id}`} onClick={() => patchVisit(v.id, { status: 'CANCELLED' }, `v-${v.id}`)}>Cancel</button>
                  </div>
                )}
                {v.status === 'CONFIRMED' && (
                  <button className="btn btn-quiet btn-sm" style={{ marginTop: 8 }} disabled={saving === `v-${v.id}`} onClick={() => patchVisit(v.id, { status: 'COMPLETED' }, `v-${v.id}`)}>Mark completed</button>
                )}
              </div>
            ))}
          </div>
        )}
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
