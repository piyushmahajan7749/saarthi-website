'use client'

// Client islands for the (server-rendered) homepage:
// - ScrollReveal: attaches the IntersectionObserver that powers .reveal animations.
// - HeroSearch: the smart search bar + quick chips under the hero actions.

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function ScrollReveal() {
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    reveals.forEach((r) => obs.observe(r))
    return () => obs.disconnect()
  }, [])
  return null
}

const QUICK_LINKS = [
  { label: '2 BHK under ₹50L', href: '/listings?bhk=2&priceMax=5000000' },
  { label: 'Flats for rent', href: '/listings?type=FLAT&for=RENT' },
  { label: 'Plots in Rau', href: '/listings?type=PLOT&locality=Rau' },
  { label: 'Villas', href: '/listings?type=VILLA' },
]

export function HeroSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    startTransition(() => {
      router.push(t ? `/listings?q=${encodeURIComponent(t)}` : '/listings')
    })
  }

  return (
    <div style={{ width: '100%' }}>
      <form className="search-shell" onSubmit={submit}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try: 3 BHK in Vijay Nagar under 90 lakh…"
          aria-label="Smart property search"
        />
        <button type="submit" className="btn btn-solid" disabled={pending}>
          {pending ? 'Searching…' : 'Search 🔍'}
        </button>
      </form>
      <div className="chips" style={{ justifyContent: 'center', marginTop: '0.9rem' }}>
        {QUICK_LINKS.map((c) => (
          <Link key={c.href} href={c.href} className="chip">
            {c.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
