import { NextResponse } from 'next/server'
import { runAutomations } from '@/lib/automations'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Reminders / feedback / follow-ups. Public route (not under /api/admin so the
// scheduler can call it without a session) — protected by CRON_SECRET instead.
// Accepts the secret via `Authorization: Bearer <CRON_SECRET>`, `?key=`, or
// Vercel's `x-vercel-cron` header. If no CRON_SECRET is set, allows local use.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // unset => local/dev convenience
  if (req.headers.get('x-vercel-cron')) return true
  const auth = req.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  const url = new URL(req.url)
  return url.searchParams.get('key') === secret
}

async function run(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const summary = await runAutomations({ deliver: true })
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[cron] automations failed:', err)
    return NextResponse.json({ error: 'Automation run failed.' }, { status: 500 })
  }
}

export const GET = run // Vercel Cron issues GET
export const POST = run // scheduler / manual trigger
