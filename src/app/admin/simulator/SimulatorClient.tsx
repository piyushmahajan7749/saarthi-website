'use client'

// Pose as a buyer and drive the full inbound pipeline (deliver:false). Shows
// what the AI did: lead status, matches, and any broker alert that fired.
import { useState, useRef, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { statusLabel } from '@/lib/format'

interface Turn {
  from: 'lead' | 'bot' | 'system'
  text: string
}

interface ApiResult {
  leadId: string
  replies: string[]
  status: string
  brokerAlert: string | null
}

function statusBadgeClass(status: string): string {
  if (['WARM', 'VISIT_SCHEDULED'].includes(status)) return 'badge-orange'
  if (['CLOSED'].includes(status)) return 'badge-green'
  if (['COLD', 'LOST'].includes(status)) return 'badge-gray'
  return 'badge-blue'
}

// Turn bare URLs in bot replies into links.
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: 'var(--o3)', wordBreak: 'break-all' }}>{p}</a>
    ) : (
      <span key={i}>{p}</span>
    )
  )
}

export default function SimulatorClient() {
  const [phone, setPhone] = useState('917999000001')
  const [name, setName] = useState('')
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<ApiResult | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, pending])

  function reset() {
    setTurns([])
    setLast(null)
    setError(null)
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || pending) return
    setTurns((t) => [...t, { from: 'lead', text }])
    setInput('')
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, text, name: name || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Simulation failed')
      const result = data as ApiResult
      setLast(result)
      const newTurns: Turn[] = result.replies.map((r) => ({
        from: r.includes('http') && /\d\.\s/.test(r) ? 'system' : 'bot',
        text: r,
      }))
      setTurns((t) => [...t, ...newTurns])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '1.4rem', alignItems: 'start' }}>
      {/* ---- left: conversation ---- */}
      <div className="card">
        <div className="spread" style={{ marginBottom: '1rem', gap: 8 }}>
          <span className="label">📱 Test conversation</span>
          <button className="btn btn-quiet btn-sm" onClick={reset}>Reset chat</button>
        </div>
        <div className="row" style={{ gap: 8, marginBottom: '0.9rem' }}>
          <input className="input" style={{ flex: 1 }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Buyer phone" />
          <input className="input" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Buyer name (optional)" />
        </div>

        <div className="wa-chat" ref={chatRef} style={{ height: 460, maxHeight: 460 }}>
          {turns.length === 0 && (
            <div className="wa-sys">Type as the buyer to start — e.g. &ldquo;3 bhk chahiye Vijay Nagar me 90 lakh tak&rdquo;</div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={`wa-bubble ${t.from === 'lead' ? 'wa-in' : t.from === 'system' ? 'wa-sys' : 'wa-out'}`}>
              {t.from === 'bot' || t.from === 'system' ? linkify(t.text) : t.text}
            </div>
          ))}
          {pending && (
            <div className="wa-bubble wa-out chatw-typing" style={{ alignSelf: 'flex-end' }}>
              <span /><span /><span />
            </div>
          )}
        </div>

        <form className="row" style={{ gap: 8, marginTop: '0.9rem' }} onSubmit={send}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type as the buyer…"
            disabled={pending}
          />
          <button className="btn btn-solid" type="submit" disabled={pending || !input.trim()}>Send</button>
        </form>
        {error && <p className="error-text" style={{ marginTop: 8 }}>⚠ {error}</p>}
      </div>

      {/* ---- right: what Saarthi did ---- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        <div className="card">
          <span className="label" style={{ display: 'block', marginBottom: 12 }}>🧠 What Saarthi did</span>
          {last ? (
            <>
              <div className="spread" style={{ marginBottom: 12 }}>
                <span className="hint">Lead status</span>
                <span className={`badge ${statusBadgeClass(last.status)}`}>{statusLabel(last.status)}</span>
              </div>
              <Link href={`/admin/leads/${last.leadId}`} className="btn btn-outline btn-sm" target="_blank">
                Open lead in CRM →
              </Link>
            </>
          ) : (
            <p className="hint">Send a message to see the qualifier in action.</p>
          )}
        </div>

        {last?.brokerAlert && (
          <div className="card" style={{ borderColor: 'rgba(200,96,26,0.45)', background: 'rgba(200,96,26,0.06)' }}>
            <span className="label" style={{ color: 'var(--o3)', display: 'block', marginBottom: 8 }}>🔥 Broker alert sent</span>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: "'Outfit', sans-serif", fontSize: 12.5, lineHeight: 1.6, color: 'var(--cream)', margin: 0 }}>
              {last.brokerAlert}
            </pre>
          </div>
        )}

        <div className="card">
          <span className="label" style={{ display: 'block', marginBottom: 10 }}>How the funnel works</span>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            <li>The bot <strong style={{ color: 'var(--cream)' }}>qualifies</strong> the buyer — budget, BHK, locality, timeline.</li>
            <li>Once it knows enough, it <strong style={{ color: 'var(--cream)' }}>sends matching property links</strong> to this website.</li>
            <li>When the buyer turns <strong style={{ color: 'var(--o3)' }}>warm</strong>, the broker who posted the match gets a WhatsApp alert.</li>
            <li>Cold leads <strong style={{ color: 'var(--cream)' }}>never bother</strong> the brokers — the bot keeps nurturing them.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
