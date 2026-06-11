'use client'

// Add a lead by voice (record -> upload -> transcribe) or text, preview the AI
// extraction, edit, then create. Creating kicks off the outbound WhatsApp.
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice, propertyTypeLabel } from '@/lib/format'
import { PROPERTY_TYPES, type ExtractedLead } from '@/types'

type Phase = 'capture' | 'review' | 'done'

export default function AddLeadClient({ transcriptionEnabled, aiEnabled }: { transcriptionEnabled: boolean; aiEnabled: boolean }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('capture')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedLead | null>(null)
  const [result, setResult] = useState<{ leadId: string; opener: string | null; duplicate: boolean } | null>(null)

  // --- recording ---
  const [recording, setRecording] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop()
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribe(blob)
      }
      recRef.current = rec
      rec.start()
      setRecording(true)
    } catch {
      setError('Could not access the microphone. Check browser permissions, or type the note instead.')
    }
  }

  async function transcribe(blob: Blob) {
    setBusy('transcribe')
    setError(null)
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'note.webm')
      const res = await fetch('/api/admin/transcribe', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Transcription failed')
      setNote((prev) => (prev ? `${prev} ${data.text}` : data.text))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed')
    } finally {
      setBusy(null)
    }
  }

  async function onFile(file: File) {
    await transcribe(file)
  }

  async function extract() {
    if (!note.trim()) return setError('Add a note first (record or type).')
    setBusy('extract')
    setError(null)
    try {
      const res = await fetch('/api/admin/leads/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Extraction failed')
      setExtracted(data.extracted)
      setPhase('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setBusy(null)
    }
  }

  async function create() {
    if (!extracted) return
    setBusy('create')
    setError(null)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ extracted, rawNote: note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not create lead')
      setResult(data)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create lead')
    } finally {
      setBusy(null)
    }
  }

  function upd<K extends keyof ExtractedLead>(k: K, v: ExtractedLead[K]) {
    setExtracted((e) => (e ? { ...e, [k]: v } : e))
  }
  function updReq(patch: Record<string, unknown>) {
    setExtracted((e) => (e ? { ...e, requirements: { ...e.requirements, ...patch } } : e))
  }

  // ---------- DONE ----------
  if (phase === 'done' && result) {
    return (
      <div className="card" style={{ maxWidth: 640, borderColor: 'rgba(40,160,120,0.35)', background: 'rgba(40,160,120,0.05)' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: 'var(--cream)', marginBottom: 6 }}>
          Lead {result.duplicate ? 'updated' : 'created'}!
        </h2>
        <p className="hint" style={{ marginBottom: 14 }}>
          {result.opener
            ? 'Saarthi has started the WhatsApp conversation to gather their requirements.'
            : 'No phone number captured — add one on the lead page to start the WhatsApp conversation.'}
        </p>
        {result.opener && (
          <div className="wa-chat" style={{ marginBottom: 16 }}>
            <div className="wa-bubble wa-out">{result.opener}</div>
          </div>
        )}
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-solid" onClick={() => router.push(`/admin/leads/${result.leadId}`)}>Open lead →</button>
          <button className="btn btn-quiet" onClick={() => { setPhase('capture'); setNote(''); setExtracted(null); setResult(null) }}>Add another</button>
        </div>
      </div>
    )
  }

  // ---------- REVIEW ----------
  if (phase === 'review' && extracted) {
    const r = extracted.requirements
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <span className="label">Review &amp; edit the extracted lead</span>
          <span className="badge badge-gray">AI confidence {Math.round((extracted.confidence ?? 0) * 100)}%</span>
        </div>
        <div className="form-grid">
          <div className="field">
            <span className="label">Name</span>
            <input className="input" value={extracted.name ?? ''} onChange={(e) => upd('name', e.target.value || null)} placeholder="Lead name" />
          </div>
          <div className="field">
            <span className="label">Phone (WhatsApp)</span>
            <input className="input" value={extracted.phone ?? ''} onChange={(e) => upd('phone', e.target.value || null)} placeholder="9826012345" />
            <span className="hint">{extracted.phone ? 'Bot will message this number' : '⚠ No phone — conversation won’t auto-start'}</span>
          </div>
          <div className="field">
            <span className="label">Buy or rent</span>
            <select className="select" value={r.listingFor ?? ''} onChange={(e) => updReq({ listingFor: e.target.value || undefined })}>
              <option value="">—</option><option value="SALE">Buy</option><option value="RENT">Rent</option>
            </select>
          </div>
          <div className="field">
            <span className="label">Type</span>
            <select className="select" value={r.type ?? ''} onChange={(e) => updReq({ type: e.target.value || undefined })}>
              <option value="">—</option>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{propertyTypeLabel(t)}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="label">BHK</span>
            <input type="number" className="input" value={r.bhk ?? ''} onChange={(e) => updReq({ bhk: e.target.value ? Number(e.target.value) : undefined })} />
          </div>
          <div className="field">
            <span className="label">Max budget (₹)</span>
            <input type="number" className="input" value={r.budgetMax ?? ''} onChange={(e) => updReq({ budgetMax: e.target.value ? Number(e.target.value) : undefined })} />
            <span className="hint">{r.budgetMax ? formatPrice(r.budgetMax, r.listingFor) : ' '}</span>
          </div>
          <div className="field">
            <span className="label">Localities (comma-separated)</span>
            <input className="input" value={(r.localities ?? []).join(', ')} onChange={(e) => updReq({ localities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div className="field">
            <span className="label">Timeline</span>
            <input className="input" value={r.timeline ?? ''} onChange={(e) => updReq({ timeline: e.target.value || undefined })} placeholder="e.g. 1-3 months" />
          </div>
          <div className="field full">
            <span className="label">AI summary</span>
            <input className="input" value={extracted.aiSummary} onChange={(e) => upd('aiSummary', e.target.value)} />
          </div>
        </div>
        {error && <p className="error-text" style={{ marginTop: 12 }}>⚠ {error}</p>}
        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-solid btn-lg" disabled={busy !== null} onClick={create}>
            {busy === 'create' ? 'Creating…' : 'Create lead & start WhatsApp →'}
          </button>
          <button className="btn btn-quiet" disabled={busy !== null} onClick={() => setPhase('capture')}>← Back to note</button>
        </div>
      </div>
    )
  }

  // ---------- CAPTURE ----------
  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="field">
        <span className="label">Lead note — voice or text</span>
        <textarea
          className="textarea" style={{ minHeight: 150 }} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Rahul Sharma, 98260 12345 — wants a 3 BHK flat in Vijay Nagar or Scheme 78, budget around 85 lakh, looking to buy in next 2 months. Met him at the Sunday open house."
        />
        <span className="hint">Speak naturally (Hindi/English) — the AI pulls out name, phone, budget, area, timeline.</span>
      </div>

      <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          className={`btn ${recording ? 'btn-danger' : 'btn-outline'}`}
          onClick={toggleRecord}
          disabled={busy === 'transcribe' || !transcriptionEnabled}
          title={transcriptionEnabled ? '' : 'Set TRANSCRIPTION_API_KEY to enable voice'}
        >
          {recording ? '⏹ Stop & transcribe' : '🎙 Record voice note'}
          {recording && <span className="wa-float-dot" style={{ marginLeft: 6 }} />}
        </button>
        <label className="btn btn-quiet" style={{ cursor: transcriptionEnabled ? 'pointer' : 'not-allowed' }}>
          ⬆ Upload audio
          <input type="file" accept="audio/*" hidden disabled={!transcriptionEnabled || busy !== null}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        </label>
        {busy === 'transcribe' && <span className="hint">Transcribing… <span className="skel" style={{ display: 'inline-block', width: 80, height: 8, verticalAlign: 'middle' }} /></span>}
      </div>
      {!transcriptionEnabled && <p className="hint" style={{ marginTop: 8 }}>🔇 Voice is off (no transcription key set) — type the note instead.</p>}
      {!aiEnabled && <p className="hint" style={{ marginTop: 4 }}>ℹ AI key not set — extraction uses basic rules; review carefully.</p>}

      {error && <p className="error-text" style={{ marginTop: 12 }}>⚠ {error}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn btn-solid btn-lg" disabled={busy !== null || !note.trim()} onClick={extract}>
          {busy === 'extract' ? 'Extracting…' : 'Extract with AI ✦'}
        </button>
      </div>
    </div>
  )
}
