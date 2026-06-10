'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      if (res.ok) {
        router.push(next)
        router.refresh()
        return
      }
      if (res.status === 401) {
        setError('Invalid phone or password')
      } else {
        const data = await res.json().catch(() => null)
        setError((data && data.error) || 'Something went wrong — try again')
      }
      setBusy(false)
    } catch {
      setError('Network error — check your connection and try again')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: '2rem 1.25rem',
        overflow: 'hidden',
      }}
    >
      {/* Subtle brand glow, same family as .hero-bg */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(200,96,26,0.14) 0%, transparent 65%), radial-gradient(ellipse 40% 40% at 15% 85%, rgba(200,96,26,0.07) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 430,
          padding: '2.75rem 2.5rem 2.25rem',
          background: 'rgba(22,16,9,0.82)',
          borderColor: 'rgba(200,96,26,0.25)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.55)',
          textAlign: 'center',
        }}
      >
        <Image
          src="/logo-transparent.png"
          alt="Saarthi"
          width={72}
          height={72}
          style={{ objectFit: 'contain', margin: '0 auto' }}
        />
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 32,
            fontWeight: 700,
            color: 'var(--cream)',
            letterSpacing: '-0.5px',
            marginTop: '0.9rem',
            lineHeight: 1.1,
          }}
        >
          Saar<span style={{ color: 'var(--o)' }}>thi</span> Command Center
        </h1>
        <p className="hint" style={{ marginTop: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11 }}>
          Broker &amp; admin access
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.8rem', textAlign: 'left' }}>
          <div className="field">
            <label className="label" htmlFor="login-phone">Phone</label>
            <input
              id="login-phone"
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98260 78459"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error-text" role="alert">{error}</div>}
          <button className="btn btn-solid btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <div className="divider" style={{ margin: '1.6rem 0 1.1rem' }} />
        <p className="hint" style={{ fontSize: 12 }}>
          Saarthi staff only · Buyers chat with us on WhatsApp —{' '}
          <Link href="/" style={{ color: 'var(--o3)', textDecoration: 'none' }}>
            visit the website
          </Link>
        </p>
      </div>
    </div>
  )
}
