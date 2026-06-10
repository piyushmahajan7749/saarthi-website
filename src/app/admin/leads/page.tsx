// Leads CRM — pipeline board of every buyer the bot is talking to.
import Link from 'next/link'
import { db } from '@/lib/db'
import { formatPhone, formatPrice, safeJsonParse, statusLabel, timeAgo } from '@/lib/format'
import type { LeadRequirements } from '@/types'

export const dynamic = 'force-dynamic'

const PIPE_COLUMNS: { status: string; title: string }[] = [
  { status: 'NEW', title: 'New' },
  { status: 'QUALIFYING', title: 'Qualifying' },
  { status: 'WARM', title: 'Warm 🔥' },
  { status: 'VISIT_SCHEDULED', title: 'Visit scheduled' },
  { status: 'CLOSED', title: 'Closed' },
]

const SOURCE_ICON: Record<string, string> = { WHATSAPP: '📱', WEBSITE: '🌐', MANUAL: '✍️' }

function reqSummary(raw: string): string {
  const req = safeJsonParse<LeadRequirements>(raw, {})
  const bits: string[] = []
  if (req.bhk) bits.push(`${req.bhk} BHK`)
  if (req.type) bits.push(req.type.charAt(0) + req.type.slice(1).toLowerCase())
  if (req.listingFor) bits.push(req.listingFor === 'RENT' ? 'rent' : 'buy')
  if (req.budgetMax) bits.push(`up to ${formatPrice(req.budgetMax, req.listingFor)}`)
  else if (req.budgetMin) bits.push(`from ${formatPrice(req.budgetMin, req.listingFor)}`)
  if (req.localities?.length) bits.push(`📍 ${req.localities.slice(0, 2).join(', ')}`)
  return bits.join(' · ') || 'Requirements abhi capture nahi hue'
}

function scorePillStyle(score: number): React.CSSProperties {
  if (score >= 70)
    return { background: 'rgba(200,96,26,0.18)', color: 'var(--o3)', border: '1px solid rgba(200,96,26,0.4)' }
  if (score >= 40)
    return { background: 'rgba(184,134,26,0.15)', color: '#D8A93C', border: '1px solid rgba(184,134,26,0.32)' }
  return { background: 'rgba(253,248,242,0.06)', color: 'var(--muted)', border: '1px solid rgba(253,248,242,0.12)' }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function LeadsPage() {
  const leads = await db.lead.findMany({
    include: {
      assignedTo: true,
      _count: { select: { messages: true, matches: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const warmCount = leads.filter((l) => l.status === 'WARM').length
  const coldLost = leads.filter((l) => l.status === 'COLD' || l.status === 'LOST')

  return (
    <div>
      <div className="spread" style={{ marginBottom: '1.8rem' }}>
        <div>
          <h1 className="admin-title">
            Leads <em style={{ color: 'var(--o)', fontStyle: 'italic' }}>CRM</em>
          </h1>
          <p className="admin-sub">
            {leads.length} total · {warmCount} warm 🔥 · brokers only get pinged when a lead turns warm
          </p>
        </div>
        <Link href="/admin/simulator" className="btn btn-outline btn-sm">
          🤖 Test the bot →
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💬</div>
          <p style={{ maxWidth: 420, margin: '0 auto', lineHeight: 1.7 }}>
            No leads yet — they&apos;ll appear the moment someone messages your WhatsApp bot.{' '}
            <Link href="/admin/simulator" style={{ color: 'var(--o3)' }}>
              Try the Simulator →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="pipeline">
            {PIPE_COLUMNS.map((col) => {
              const colLeads = leads.filter((l) => l.status === col.status)
              const isWarm = col.status === 'WARM'
              return (
                <div key={col.status} className="pipe-col" style={isWarm ? { borderColor: 'rgba(200,96,26,0.22)' } : undefined}>
                  <div className="pipe-head">
                    <span className="pipe-title">{col.title}</span>
                    <span className="pipe-count">{colLeads.length}</span>
                  </div>
                  {colLeads.length === 0 && (
                    <p className="hint" style={{ textAlign: 'center', padding: '1.2rem 0', opacity: 0.6 }}>
                      —
                    </p>
                  )}
                  {colLeads.map((l) => (
                    <Link
                      key={l.id}
                      href={`/admin/leads/${l.id}`}
                      className="lead-card"
                      style={isWarm ? { borderColor: 'rgba(200,96,26,0.35)' } : undefined}
                    >
                      <div className="spread" style={{ gap: '0.4rem' }}>
                        <span className="lead-name">{l.name || formatPhone(l.phone)}</span>
                        <span className="score-pill" style={scorePillStyle(l.score)}>
                          {l.score >= 70 ? '🔥 ' : ''}
                          {l.score}
                        </span>
                      </div>
                      <div className="lead-meta">{reqSummary(l.requirements)}</div>
                      <div
                        className="lead-meta"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}
                      >
                        <span title={l.source}>{SOURCE_ICON[l.source] ?? '💬'}</span>
                        <span>{timeAgo(l.updatedAt)}</span>
                        <span>💬 {l._count.messages}</span>
                        {l._count.matches > 0 && <span>🏠 {l._count.matches}</span>}
                        {l.assignedTo && (
                          <span
                            title={`Assigned to ${l.assignedTo.name}`}
                            style={{
                              marginLeft: 'auto',
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'rgba(200,96,26,0.16)',
                              border: '1px solid rgba(200,96,26,0.35)',
                              color: 'var(--o3)',
                              fontSize: 9.5,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {initials(l.assignedTo.name)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>

          {coldLost.length > 0 && (
            <details style={{ marginTop: '2rem' }}>
              <summary
                style={{
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '0.4rem 0',
                }}
              >
                Cold / Lost ({coldLost.length})
              </summary>
              <div className="tbl-wrap" style={{ marginTop: '0.9rem' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Phone</th>
                      <th>Requirements</th>
                      <th>Status</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coldLost.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <Link href={`/admin/leads/${l.id}`} style={{ color: 'var(--cream)', textDecoration: 'none' }}>
                            {l.name || formatPhone(l.phone)}
                          </Link>
                        </td>
                        <td className="sub mono">{formatPhone(l.phone)}</td>
                        <td className="sub">{reqSummary(l.requirements)}</td>
                        <td>
                          <span className={`badge ${l.status === 'LOST' ? 'badge-red' : 'badge-gray'}`}>
                            {statusLabel(l.status)}
                          </span>
                        </td>
                        <td className="sub">{timeAgo(l.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
