// Local / self-host scheduler. Pings the automations cron endpoint on an
// interval so reminders, follow-ups and feedback requests fire without Vercel
// Cron. Run alongside the app:  npm run scheduler
//
// On Vercel this is unnecessary — vercel.json drives the same endpoint.
const BASE = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SECRET = process.env.CRON_SECRET || ''
const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS || 15 * 60 * 1000) // default every 15 min

async function tick() {
  const url = `${BASE}/api/cron/automations${SECRET ? `?key=${encodeURIComponent(SECRET)}` : ''}`
  try {
    const res = await fetch(url, { method: 'POST', headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {} })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`[scheduler] ${new Date().toISOString()} — HTTP ${res.status}`, data)
      return
    }
    const total = (data.remindersSent ?? 0) + (data.feedbackRequests ?? 0) + (data.followups ?? 0)
    console.log(`[scheduler] ${new Date().toISOString()} — ${total} actions`, data.details ?? [])
  } catch (err) {
    console.error('[scheduler] tick failed:', err)
  }
}

console.log(`[scheduler] starting — pinging ${BASE}/api/cron/automations every ${INTERVAL_MS / 60000} min`)
tick()
setInterval(tick, INTERVAL_MS)
