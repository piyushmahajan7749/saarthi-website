import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAgentKey } from '@/lib/agent-auth'
import { describeRequirements, initiateLeadConversation } from '@/lib/qualifier'
import { formatReferredLeadOpener } from '@/lib/whatsapp'
import { safeJsonParse } from '@/lib/format'
import type { LeadRequirements } from '@/types'

export const dynamic = 'force-dynamic'

// POST /api/agent/lead-intake
// Called by cx-agent when a broker sends a lead referral (audio/text).
// Creates or updates the lead, logs a referral activity, returns { leadId, phone, isNew }.
//
// Body: {
//   phone: string,          // lead's phone (digits with country code)
//   name?: string,
//   referredBy?: string,    // broker's phone
//   referredByName?: string,
//   requirements?: {
//     listingFor?: string, bhk?: number, type?: string,
//     budgetMin?: number, budgetMax?: number,
//     localities?: string[], timeline?: string, notes?: string,
//   },
//   rawText?: string,       // original broker voice note / text
// }

export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let body: {
    phone?: string
    name?: string
    referredBy?: string
    referredByName?: string
    requirements?: Record<string, unknown>
    rawText?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const phone = (body.phone ?? '').trim()
  if (!phone) return NextResponse.json({ error: 'phone is required.' }, { status: 400 })

  const existing = await db.lead.findUnique({
    where: { phone },
    select: { id: true, requirements: true, name: true, conversationStarted: true },
  })

  const isNew = !existing

  // Only update requirements if the lead exists but has none set yet
  let reqUpdate: string | undefined
  if (!isNew && body.requirements) {
    let current: Record<string, unknown> = {}
    try { current = JSON.parse(existing!.requirements) } catch { /* */ }
    if (Object.keys(current).length === 0) {
      reqUpdate = JSON.stringify(body.requirements)
    }
  }

  const lead = await db.lead.upsert({
    where: { phone },
    create: {
      phone,
      name: body.name ?? null,
      source: 'WHATSAPP',
      status: 'NEW',
      requirements: body.requirements ? JSON.stringify(body.requirements) : '{}',
    },
    update: {
      // Only set name if we have one and they don't yet
      ...(body.name && !existing?.name ? { name: body.name } : {}),
      // Only update requirements if lead exists but has none
      ...(reqUpdate ? { requirements: reqUpdate } : {}),
    },
  })

  const brokerLabel = body.referredByName || body.referredBy || 'broker'
  const noteSnippet = body.rawText ? ` — "${body.rawText.slice(0, 150)}"` : ''

  await db.activity.create({
    data: {
      type: 'NOTE',
      description: `Lead referred by ${brokerLabel}${noteSnippet}`,
      leadId: lead.id,
    },
  })

  // Kick off the bot follow-up the first time we hear about this lead, using the
  // requirement the broker shared so the lead doesn't have to repeat themselves.
  // `opener` is returned so the caller (cx-agent) delivers it over WhatsApp.
  let opener: string | null = null
  if (isNew || !existing?.conversationStarted) {
    const req = safeJsonParse<LeadRequirements>(lead.requirements, {})
    const requirementText = Object.keys(req).length ? describeRequirements(req) : null
    const contextualOpener = formatReferredLeadOpener({
      leadName: lead.name,
      requirementText,
      brokerName: body.referredByName ?? null,
    })
    opener = await initiateLeadConversation(lead.id, false, contextualOpener)
  }

  return NextResponse.json({ leadId: lead.id, phone: lead.phone, isNew, opener })
}
