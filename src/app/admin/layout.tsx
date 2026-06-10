import { getSession } from '@/lib/auth'
import AdminShell from '@/components/admin/AdminShell'

export const metadata = { title: 'Saarthi — Command Center' }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession()
  // No session => this is the /admin/login page (middleware guards the rest).
  if (!user) return <>{children}</>
  return <AdminShell user={user}>{children}</AdminShell>
}
