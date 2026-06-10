import { db } from '@/lib/db'
import IntakeClient, { type BrokerOption, type WebSubmission, type BatchRow } from './IntakeClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Saarthi — Intake parser' }

export default async function IntakePage() {
  const [users, webSubmissions, batches] = await Promise.all([
    db.user.findMany({
      where: { active: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }], // ADMIN sorts before BROKER
    }),
    db.property.findMany({
      where: { status: 'PENDING_REVIEW', source: 'WEBFORM' },
      orderBy: { createdAt: 'desc' },
    }),
    db.intakeBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { _count: { select: { properties: true } } },
    }),
  ])

  const brokers: BrokerOption[] = users.map((u) => ({ id: u.id, name: u.name, role: u.role }))

  const subs: WebSubmission[] = webSubmissions.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
    listingFor: p.listingFor,
    bhk: p.bhk,
    price: p.price,
    area: p.area,
    areaUnit: p.areaUnit,
    locality: p.locality,
    city: p.city,
    ownerName: p.ownerName,
    ownerPhone: p.ownerPhone,
    description: p.description,
    aiNotes: p.aiNotes,
    createdAt: p.createdAt.toISOString(),
  }))

  const history: BatchRow[] = batches.map((b) => ({
    id: b.id,
    source: b.source,
    status: b.status,
    itemCount: b.itemCount,
    committedCount: b._count.properties,
    preview: b.rawContent.slice(0, 80),
    createdAt: b.createdAt.toISOString(),
  }))

  return (
    <>
      <header style={{ marginBottom: '1.8rem' }}>
        <h1 className="admin-title">
          Intake <em style={{ color: 'var(--o)' }}>parser</em>
        </h1>
        <p className="admin-sub">
          Turn WhatsApp messages, Excel sheets and web submissions into live listings — automatically.
        </p>
      </header>
      <IntakeClient brokers={brokers} webSubmissions={subs} batches={history} />
    </>
  )
}
