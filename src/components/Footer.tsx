import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/logo-transparent.png" alt="Saarthi" width={56} height={56} style={{ objectFit: 'contain' }} />
          <div>
            <div className="footer-logo">Saar<span>thi</span> · सारथी</div>
            <div className="footer-tagline" style={{ marginTop: '6px' }}>Har saude mein saath.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' as const }}>
          <Link href="/listings" style={linkStyle}>Listings</Link>
          <Link href="/post-property" style={linkStyle}>Post Property</Link>
          <Link href="/#how" style={linkStyle}>How it works</Link>
          <Link href="/#brokers" style={linkStyle}>For brokers</Link>
          <Link href="/privacy-policy" style={linkStyle}>Privacy</Link>
          <Link href="/terms" style={linkStyle}>Terms</Link>
          <Link href="/data-deletion" style={linkStyle}>Data Deletion</Link>
          <Link href="/admin" style={linkStyle}>Broker Login</Link>
        </div>
        <div className="footer-meta">© {new Date().getFullYear()} Saarthi AI · Indore, India</div>
      </div>
    </footer>
  )
}

const linkStyle = { fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }
