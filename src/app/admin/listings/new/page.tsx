import Link from 'next/link'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import PropertyForm, { emptyValues, type BrokerOpt } from '@/components/admin/PropertyForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New listing — Saarthi Command Center' }

export default async function NewListingPage() {
  const [users, session] = await Promise.all([
    db.user.findMany({ where: { active: true }, orderBy: [{ role: 'asc' }, { name: 'asc' }] }),
    getSession(),
  ])
  const brokers: BrokerOpt[] = users.map((u) => ({ id: u.id, name: u.name, role: u.role }))

  return (
    <div>
      <Link href="/admin/listings" className="hint" style={{ textDecoration: 'none' }}>← Back to listings</Link>
      <h1 className="admin-title" style={{ marginTop: 8 }}>Add a <em style={{ color: 'var(--o)' }}>listing</em></h1>
      <p className="admin-sub" style={{ marginBottom: '1.6rem' }}>Manually add a property to the inventory.</p>
      <PropertyForm mode="create" brokers={brokers} initial={emptyValues(session?.id)} />
    </div>
  )
}
