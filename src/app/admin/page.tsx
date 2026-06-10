import Link from 'next/link'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { formatPrice, formatPhone, statusLabel, timeAgo } from '@/lib/format'

export const dynamic = 'force-dynamic'

const PIPELINE_STAGES: { status: string; color: string }[] = [
  { status: 'NEW', color: '#8A7060' },
  { status: 'QUALIFYING', color: '#7FA8E8' },
  { status: 'WARM', color: 'var(--o)' },
  { status: 'VISIT_SCHEDULED', color: '#D8A93C' },
  { status: 'CLOSED', color: '#4DC8A8' },
]

const ACTIVITY_ICONS: Record<string, string> = {
  LEAD_CREATED: '🟢',
  STATUS_CHANGE: '🔁',
  BROKER_NOTIFIED: '🔥',
  MATCHES_SENT: '✨',
  LISTING_CREATED: '🏠',
  LISTING_PUBLISHED: '🏠',
  INTAKE: '📥',
  NOTE: '📝',
  VISIT_SCHEDULED: '📅',
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 600, color: 'var(--cream)', letterSpacing: '-0.3px' }}>
      {children}
    </h2>
  )
}

export default async function AdminDashboard() {
  const user = await getSession()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [propByStatus, leadByStatus, newLeadsThisWeek, warmLeads, pendingProps, activities, latest] = await Promise.all([
    db.property.groupBy({ by: ['status'], _count: { _all: true } }),
    db.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    db.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    db.lead.findMany({ where: { status: 'WARM' }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    db.property.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { lead: true, property: true } }),
    db.property.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { postedBy: true } }),
  ])

  const propCount = (status: string) => propByStatus.find((r) => r.status === status)?._count._all ?? 0
  const leadCount = (status: string) => leadByStatus.find((r) => r.status === status)?._count._all ?? 0
  const totalLeads = leadByStatus.reduce((sum, r) => sum + r._count._all, 0)
  const warmCount = leadCount('WARM')
  const pipelineMax = Math.max(...PIPELINE_STAGES.map((s) => leadCount(s.status)), 1)

  const firstName = (user?.name ?? 'Saarthi').split(' ')[0]
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const attention: { icon: string; text: string; href: string; key: string }[] = [
    ...warmLeads.map((l) => ({
      icon: '🔥',
      text: `${l.name || formatPhone(l.phone)} — warm, call now`,
      href: `/admin/leads/${l.id}`,
      key: `lead-${l.id}`,
    })),
    ...pendingProps.map((p) => ({
      icon: '📥',
      text: `${p.title} — review intake`,
      href: '/admin/intake',
      key: `prop-${p.id}`,
    })),
  ].slice(0, 5)

  return (
    <div>
      <div className="page-head" style={{ padding: '0 0 1.6rem' }}>
        <h1 className="admin-title">
          Namaste, <em style={{ color: 'var(--o)', fontStyle: 'italic' }}>{firstName}</em>
        </h1>
        <p className="admin-sub">{today} · Aaj ka haal, ek nazar mein.</p>
      </div>

      {/* ---- stats ---- */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{propCount('ACTIVE')}</div>
          <div className="stat-label2">Active listings</div>
          <div className="stat-delta" style={{ color: propCount('PENDING_REVIEW') > 0 ? '#D8A93C' : undefined }}>
            {propCount('PENDING_REVIEW')} pending review
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalLeads}</div>
          <div className="stat-label2">Total leads</div>
          <div className="stat-delta">{newLeadsThisWeek} new this week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value"><em>{warmCount}</em></div>
          <div className="stat-label2">🔥 Warm leads — call now</div>
          <div className="stat-delta" style={{ color: 'var(--o3)' }}>
            {warmCount > 0 ? 'Garam hain, thanda mat hone do' : 'Sab shaant hai'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{leadCount('CLOSED')}</div>
          <div className="stat-label2">Closed deals</div>
          <div className="stat-delta">{propCount('SOLD')} sold · {propCount('RENTED')} rented</div>
        </div>
      </div>

      {/* ---- pipeline + needs attention ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '1rem', alignItems: 'stretch' }}>
        <div className="card">
          <div className="spread" style={{ marginBottom: '1.2rem' }}>
            <SectionTitle>Lead pipeline</SectionTitle>
            <Link href="/admin/leads" className="btn btn-quiet btn-sm">Open CRM →</Link>
          </div>
          {PIPELINE_STAGES.map((stage) => {
            const count = leadCount(stage.status)
            const pct = Math.max((count / pipelineMax) * 100, count > 0 ? 4 : 0)
            return (
              <div key={stage.status} style={{ display: 'grid', gridTemplateColumns: '120px 30px 1fr', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.04em' }}>{statusLabel(stage.status)}</span>
                <span className="mono" style={{ fontSize: 13.5, color: 'var(--cream)', textAlign: 'right' }}>{count}</span>
                <div style={{ height: 8, borderRadius: 4, background: 'rgba(253,248,242,0.05)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: stage.color }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <SectionTitle>Needs attention</SectionTitle>
          {attention.length === 0 ? (
            <div className="empty" style={{ padding: '2.2rem 1rem', marginTop: '1rem' }}>
              <div className="empty-icon">✨</div>
              All clear — koi pending kaam nahi.
            </div>
          ) : (
            <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attention.map((item) => (
                <Link key={item.key} href={item.href} className="lead-card" style={{ marginBottom: 0 }}>
                  <span className="lead-name" style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span>{item.icon}</span>
                    <span style={{ lineHeight: 1.45 }}>{item.text}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- recent activity ---- */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <SectionTitle>Recent activity</SectionTitle>
        {activities.length === 0 ? (
          <div className="empty" style={{ padding: '2.2rem 1rem', marginTop: '1rem' }}>
            <div className="empty-icon">🕰️</div>
            Abhi tak koi activity nahi — jaise hi leads aayengi, yahan dikhengi.
          </div>
        ) : (
          <div style={{ marginTop: '0.6rem' }}>
            {activities.map((a, i) => {
              const entity = a.property
                ? { href: `/admin/listings/${a.property.id}`, label: a.property.title }
                : a.lead
                  ? { href: `/admin/leads/${a.lead.id}`, label: a.lead.name || formatPhone(a.lead.phone) }
                  : null
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '0.75rem 0.2rem',
                    borderBottom: i < activities.length - 1 ? '1px solid rgba(253,248,242,0.05)' : 'none',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ fontSize: 15, lineHeight: '1.4' }}>{ACTIVITY_ICONS[a.type] ?? '•'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--cream)', lineHeight: 1.5 }}>{a.description}</div>
                    <div className="sub" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                      {timeAgo(a.createdAt)}
                      {entity && (
                        <>
                          {' · '}
                          <Link href={entity.href} style={{ color: 'var(--o3)', textDecoration: 'none' }}>
                            {entity.label}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- latest listings ---- */}
      <div style={{ marginTop: '1.6rem' }}>
        <div className="spread" style={{ marginBottom: '0.9rem' }}>
          <SectionTitle>Latest listings</SectionTitle>
          <Link href="/admin/listings" className="btn btn-quiet btn-sm">All listings →</Link>
        </div>
        {latest.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏠</div>
            Koi listing nahi — pehli property jodne ke liye <Link href="/admin/listings/new" style={{ color: 'var(--o3)' }}>Add listing</Link> dabayein.
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Posted by</th>
                  <th>Views</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/listings/${p.id}`} style={{ color: 'var(--cream)', textDecoration: 'none', fontWeight: 500 }}>
                        {p.title}
                      </Link>
                      <div className="sub">{[p.locality, p.city].filter(Boolean).join(', ')}</div>
                    </td>
                    <td style={{ color: 'var(--o3)', fontWeight: 500 }}>{formatPrice(p.price, p.listingFor)}</td>
                    <td><span className={`badge ${statusBadgeClass(p.status)}`}>{statusLabel(p.status)}</span></td>
                    <td><span className="badge badge-gray">{p.source}</span></td>
                    <td>{p.postedBy?.name ?? <span className="sub">—</span>}</td>
                    <td className="mono">{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
