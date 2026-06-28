'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919630707498'

export default function Nav() {
  const pathname = usePathname()

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
      <a href={`https://wa.me/${WA}`} className="nav-cta" target="_blank" rel="noopener noreferrer">
        WhatsApp us →
      </a>
    </nav>
  )
}
