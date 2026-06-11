// Lead detail — full conversation transcript on the left, CRM controls on the right.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { formatPhone, statusLabel, timeAgo, waLink, safeJsonParse } from '@/lib/format'
import type { LeadRequirements } from '@/types'
import LeadDetailClient from './LeadDetailClient'

export const dynamic = 'force-dynamic'

const SOURCE_ICON: Record<string, string> = { WHATSAPP: '📱', WEBSITE: '🌐', MANUAL: '✍️' }

function shortTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      matches: { include: { property: true }, orderBy: { sentAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' } },
      visits: { orderBy: { createdAt: 'desc' } },
      assignedTo: true,
      createdBy: true,
    },
  })
  if (!lead) notFound()

  // Resolve the properties referenced by each visit for display.
  const visitPropIds = Array.from(new Set(lead.visits.flatMap((v) => safeJsonParse<string[]>(v.propertyIds, []))))
  const visitProps = visitPropIds.length
    ? await db.property.findMany({ where: { id: { in: visitPropIds } }, select: { id: true, title: true } })
    : []
  const propTitle = new Map(visitProps.map((p) => [p.id, p.title]))

  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  })

  const requirements = safeJsonParse<LeadRequirements>(lead.requirements, {})

  return (
    <div>
      <style>{`
        .lead-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
        @media (max-width: 1024px) { .lead-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="spread" style={{ marginBottom: '1.6rem' }}>
        <div>
          <Link href="/admin/leads" className="hint" style={{ textDecoration: 'none' }}>
            ← All leads
          </Link>
          <h1 className="admin-title" style={{ marginTop: 4 }}>
            {lead.name || formatPhone(lead.phone)}{' '}
            <em style={{ color: 'var(--o)', fontStyle: 'italic' }}>· {statusLabel(lead.status)}</em>
          </h1>
          <p className="admin-sub">
            {SOURCE_ICON[lead.source] ?? '💬'} {lead.source.toLowerCase()} lead · created {timeAgo(lead.createdAt)} ·{' '}
            {lead.messages.length} messages
          </p>
        </div>
      </div>

      <div className="lead-grid">
        {/* ---------- LEFT: conversation ---------- */}
        <div className="card">
          <div className="spread" style={{ marginBottom: '1rem' }}>
            <div className="row">
              <span className="label">Conversation</span>
              <span className="badge badge-gray">
                {SOURCE_ICON[lead.source] ?? '💬'} {lead.source}
              </span>
            </div>
            <div className="row">
              <span className="hint mono">{formatPhone(lead.phone)}</span>
              <a
                className="btn btn-outline btn-sm"
                href={waLink(lead.phone)}
                target="_blank"
                rel="noreferrer"
              >
                Open in WhatsApp ↗
              </a>
            </div>
          </div>

          {lead.messages.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">💬</div>
              No messages yet
            </div>
          ) : (
            <div className="wa-chat" style={{ maxHeight: 640 }}>
              {lead.messages.map((m) => {
                const cls =
                  m.direction === 'INBOUND' ? 'wa-in' : m.channel === 'SYSTEM' ? 'wa-sys' : 'wa-out'
                return (
                  <div key={m.id} className={`wa-bubble ${cls}`}>
                    {m.content}
                    <span className="wa-time">{shortTime(m.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ---------- RIGHT: CRM controls (client) ---------- */}
        <LeadDetailClient
          lead={{
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            status: lead.status,
            score: lead.score,
            source: lead.source,
            brokerNotified: lead.brokerNotified,
            assignedToId: lead.assignedToId,
            createdByName: lead.createdBy?.name ?? null,
            conversationStarted: lead.conversationStarted,
            aiSummary: lead.aiSummary,
            createdAt: lead.createdAt.toISOString(),
            requirements,
          }}
          users={users}
          visits={lead.visits.map((v) => ({
            id: v.id,
            status: v.status,
            scheduledFor: v.scheduledFor ? v.scheduledFor.toISOString() : null,
            availabilityText: v.availabilityText,
            feedback: v.feedback,
            notes: v.notes,
            coordinatorNotified: v.coordinatorNotified,
            propertyTitles: safeJsonParse<string[]>(v.propertyIds, []).map((id) => propTitle.get(id) ?? 'Property'),
          }))}
          matches={lead.matches.map((m) => ({
            id: m.id,
            propertyId: m.propertyId,
            title: m.property.title,
            price: m.property.price,
            listingFor: m.property.listingFor,
            score: m.score,
            sentAt: m.sentAt.toISOString(),
          }))}
          activities={lead.activities.map((a) => ({
            id: a.id,
            type: a.type,
            description: a.description,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  )
}
