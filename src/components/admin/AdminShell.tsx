'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import type { SessionUser } from '@/types'

function Icon({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  listings: 'M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5M9 21v-6h6v6',
  intake: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  leads: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  simulator: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  site: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
}

export default function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const links = [
    { href: '/admin', label: 'Dashboard', icon: ICONS.dashboard, exact: true },
    { href: '/admin/listings', label: 'Listings', icon: ICONS.listings },
    { href: '/admin/intake', label: 'Intake / Parser', icon: ICONS.intake },
    { href: '/admin/leads', label: 'Leads CRM', icon: ICONS.leads },
    { href: '/admin/simulator', label: 'Bot Simulator', icon: ICONS.simulator },
  ]

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="admin-wrap">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-logo" style={{ textDecoration: 'none' }}>
          <Image src="/logo-transparent.png" alt="Saarthi" width={38} height={38} style={{ objectFit: 'contain' }} />
          <div>
            <div className="admin-logo-text">Saar<span>thi</span></div>
            <div className="admin-logo-sub">Command Center</div>
          </div>
        </Link>
        <nav className="admin-nav">
          {links.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href)
            return (
              <Link key={l.href} href={l.href} className={active ? 'active' : ''}>
                <Icon d={l.icon} />
                <span className="txt">{l.label}</span>
              </Link>
            )
          })}
          <div className="nav-section">Site</div>
          <Link href="/" target="_blank">
            <Icon d={ICONS.site} />
            <span className="txt">View website ↗</span>
          </Link>
        </nav>
        <div className="admin-user">
          <div>
            <div className="admin-user-name">{user.name}</div>
            <div className="admin-user-role">{user.role.toLowerCase()}</div>
          </div>
          <button className="btn btn-quiet btn-sm" onClick={logout} title="Log out">⎋</button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}
