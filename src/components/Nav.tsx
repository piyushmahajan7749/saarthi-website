'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919630707498'

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleScroll = () => {
      const nav = document.querySelector('nav')
      if (nav) nav.style.background = window.scrollY > 80 ? 'rgba(14,10,6,0.94)' : 'rgba(14,10,6,0.72)'
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const links = [
    { href: '/', label: 'Home' },
    { href: '/listings', label: 'Listings' },
    { href: '/post-property', label: 'Post Property' },
    { href: '/#how', label: 'How it works' },
    { href: '/#brokers', label: 'For brokers' },
  ]

  return (
    <nav>
      <Link href="/" className="nav-logo" style={{ textDecoration: 'none' }}>
        <Image src="/logo-transparent.png" alt="Saarthi" width={56} height={56} style={{ objectFit: 'contain' }} />
        <div>
          <div className="nav-logo-text">Saar<span>thi</span></div>
          <div className="nav-logo-hi">सारथी</div>
        </div>
      </Link>

      <div className="nav-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href} style={pathname === l.href ? { color: 'var(--o3)' } : undefined}>
            {l.label}
          </Link>
        ))}
      </div>

      <a href={`https://wa.me/${WA}`} className="nav-cta nav-cta-desktop" target="_blank" rel="noopener noreferrer">
        WhatsApp us →
      </a>

      <button
        className="nav-burger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
        </svg>
      </button>

      {open && (
        <div className="nav-mobile" onClick={() => setOpen(false)}>
          <div className="nav-mobile-panel" onClick={(e) => e.stopPropagation()}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={pathname === l.href ? 'active' : ''}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <a href={`https://wa.me/${WA}`} className="nav-cta" target="_blank" rel="noopener noreferrer" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
              WhatsApp us →
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
