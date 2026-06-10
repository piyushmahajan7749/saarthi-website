import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import ListingsTable, { type ListingRow } from './ListingsTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Listings — Saarthi Command Center' }

const TABS: { key: string; label: string; statuses: string[] | null }[] = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'live', label: 'Live', statuses: ['ACTIVE'] },
  { key: 'pending', label: 'Pending review', statuses: ['PENDING_REVIEW'] },
  { key: 'draft', label: 'Drafts', statuses: ['DRAFT'] },
  { key: 'closed', label: 'Sold / Rented', statuses: ['SOLD', 'RENTED'] },
  { key: 'archived', label: 'Archived', statuses: ['ARCHIVED'] },
]

function tabHref(key: string, sp: { search?: string; source?: string }): string {
  const q = new URLSearchParams()
  if (key !== 'all') q.set('status', key)
  if (sp.search) q.set('search', sp.search)
  if (sp.source) q.set('source', sp.source)
  const s = q.toString()
  return `/admin/listings${s ? `?${s}` : ''}`
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: { status?: string; search?: string; source?: string }
}) {
  const activeTab = TABS.find((t) => t.key === (searchParams.status ?? 'all')) ?? TABS[0]
  const search = (searchParams.search ?? '').trim()
  const source = (searchParams.source ?? '').trim()

  const where: Prisma.PropertyWhereInput = {}
  if (activeTab.statuses) where.status = { in: activeTab.statuses }
  if (search) where.OR = [{ title: { contains: search } }, { locality: { contains: search } }]
  if (source) where.source = source

  const [properties, byStatus] = await Promise.all([
    db.property.findMany({ where, orderBy: { createdAt: 'desc' }, include: { postedBy: true } }),
    db.property.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const count = (status: string) => byStatus.find((r) => r.status === status)?._count._all ?? 0

  const rows: ListingRow[] = properties.map((p) => ({
    id: p.id,
    title: p.title,
    locality: p.locality,
    city: p.city,
    price: p.price,
    type: p.type,
    listingFor: p.listingFor,
    status: p.status,
    source: p.source,
    featured: p.featured,
    views: p.views,
    postedByName: p.postedBy?.name ?? null,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
    <div>
      <div className="spread" style={{ marginBottom: '1.4rem' }}>
        <div>
          <h1 className="admin-title">Listings</h1>
          <p className="admin-sub">
            {count('ACTIVE')} live · {count('PENDING_REVIEW')} pending · {count('DRAFT')} draft
          </p>
        </div>
        <Link href="/admin/listings/new" className="btn btn-solid">+ Add listing</Link>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem', maxWidth: '100%', overflowX: 'auto' }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key, { search, source })}
            className={`tab${t.key === activeTab.key ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <ListingsTable rows={rows} />
    </div>
  )
}
