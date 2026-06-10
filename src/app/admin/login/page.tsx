import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from './LoginForm'

export const metadata = { title: 'Sign in — Saarthi Command Center' }
export const dynamic = 'force-dynamic'

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next === '/admin/login') return '/admin'
  return next
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const user = await getSession()
  const next = safeNext(searchParams.next)
  if (user) redirect(next)
  return <LoginForm next={next} />
}
