'use client'

// Manually fire the scheduled automations (reminders / follow-ups / feedback).
// The same logic runs on the cron schedule; this is for on-demand testing.
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AutomationsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/automations/run', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error || 'Run failed')
      const total = (d.remindersSent ?? 0) + (d.feedbackRequests ?? 0) + (d.followups ?? 0)
      setMsg(total === 0 ? 'Nothing due right now.' : `Sent ${d.remindersSent} reminders, ${d.feedbackRequests} feedback, ${d.followups} follow-ups.`)
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      {msg && <span className="hint">{msg}</span>}
      <button className="btn btn-quiet btn-sm" onClick={run} disabled={busy} title="Reminders, follow-ups & feedback also run automatically on a schedule">
        {busy ? 'Running…' : '⚙ Run automations'}
      </button>
    </div>
  )
}
