'use client'

// Saarthi AI concierge — floating chat widget shown on all public pages.
// Talks to POST /api/chat, renders inline property cards, persists the
// conversation in sessionStorage so it survives page navigation.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { mediaGradient, typeIcon } from '@/components/PropertyCard'
import { formatPrice } from '@/lib/format'

type ChatProperty = {
  id: string
  title: string
  price: number | null
  listingFor: string
  locality: string
  bhk: number | null
  type: string
}

type Msg = {
  role: 'user' | 'bot'
  content: string
  properties?: ChatProperty[]
}

const STORAGE_KEY = 'saarthi_chat'

const GREETING: Msg = {
  role: 'bot',
  content:
    "Namaste! 🙏 Main Saarthi hoon — aapka AI property guide. Bataiye, kaisi property dhoondh rahe hain? (e.g. '2 BHK rent Vijay Nagar' )",
}

const NETWORK_ERROR = 'Network hiccup — try again or WhatsApp us: +91 98260 78459'

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6A8.38 8.38 0 0112.5 3h.5a8.48 8.48 0 018 8v.5z"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const loadedRef = useRef(false)
  const msgsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore conversation once on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as Msg[]
        if (Array.isArray(stored) && stored.length > 0) setMessages(stored)
      }
    } catch {
      /* corrupted storage — start fresh */
    }
    loadedRef.current = true
  }, [])

  // Persist conversation after the initial restore.
  useEffect(() => {
    if (!loadedRef.current) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)))
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [messages])

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = msgsRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending, open])

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || pending) return

    const history = messages
      .filter((m) => m.content)
      .slice(-12)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

    setMessages((cur) => [...cur, { role: 'user', content: text }])
    setInput('')
    setPending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { reply?: string; properties?: ChatProperty[] }
      setMessages((cur) => [
        ...cur,
        {
          role: 'bot',
          content: data.reply || NETWORK_ERROR,
          properties: Array.isArray(data.properties) ? data.properties.slice(0, 3) : [],
        },
      ])
    } catch {
      setMessages((cur) => [...cur, { role: 'bot', content: NETWORK_ERROR }])
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {open && (
        <div className="chatw-panel" role="dialog" aria-label="Saarthi AI chat">
          <div className="chatw-head">
            <div className="chatw-avatar">✦</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="chatw-title">Saarthi AI</div>
              <div className="chatw-status">● online · replies instantly</div>
            </div>
            <button
              className="btn btn-quiet btn-sm"
              style={{ padding: '0.25rem 0.7rem', fontSize: 16, lineHeight: 1 }}
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="chatw-msgs" ref={msgsRef}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <div className={`chatw-bubble ${m.role === 'user' ? 'chatw-user' : 'chatw-bot'}`}>{m.content}</div>
                {m.properties?.map((p) => (
                  <Link key={p.id} href={`/listings/${p.id}`} className="chatw-card">
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: mediaGradient(p.id),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      {typeIcon(p.type)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--cream)',
                          lineHeight: 1.35,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {p.title}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--o3)', fontWeight: 600, marginTop: 2 }}>
                        {formatPrice(p.price, p.listingFor)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                        📍 {p.locality}
                        {p.bhk ? ` · ${p.bhk} BHK` : ''}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
            {pending && (
              <div
                className="chatw-typing chatw-bot"
                style={{ alignSelf: 'flex-start', borderRadius: 15, borderBottomLeftRadius: 4 }}
                aria-label="Saarthi is typing"
              >
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form className="chatw-input-row" onSubmit={send}>
            <input
              ref={inputRef}
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              disabled={pending}
              maxLength={1000}
              aria-label="Message"
            />
            <button
              type="submit"
              className="btn btn-solid"
              style={{ padding: '0.65rem 1.05rem', flexShrink: 0 }}
              disabled={pending || !input.trim()}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      <button className="chatw-fab" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close Saarthi AI chat' : 'Open Saarthi AI chat'}>
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  )
}
