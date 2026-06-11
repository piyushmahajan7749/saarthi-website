import { NextResponse } from 'next/server'
import { runAutomations } from '@/lib/automations'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/admin/automations/run — manual trigger from the CRM (auth via
// middleware). Same logic as the cron, for testing/on-demand runs.
export async function POST() {
  try {
    const summary = await runAutomations({ deliver: true })
    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[admin] manual automation run failed:', err)
    return NextResponse.json({ error: 'Automation run failed.' }, { status: 500 })
  }
}
