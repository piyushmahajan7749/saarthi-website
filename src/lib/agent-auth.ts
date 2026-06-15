// Bearer-token auth for the Agent API (/api/agent/*) — used by the external
// WhatsApp brain (cx-agent on Azure) to read/write the CRM. Not session-based:
// the caller is a service, not a browser.
import { NextResponse } from 'next/server'

// Returns null when authorized; otherwise the error Response to return as-is.
export function requireAgentKey(req: Request): NextResponse | null {
  const key = process.env.AGENT_API_KEY
  if (!key) {
    // Fail closed: without a configured key the Agent API is disabled.
    return NextResponse.json({ error: 'Agent API not configured (AGENT_API_KEY unset).' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${key}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
