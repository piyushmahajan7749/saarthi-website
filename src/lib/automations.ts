// Scheduled bot automations (step 6): visit reminders, post-visit feedback
// requests, and stalled-lead follow-ups. Driven by the cron endpoint
// /api/cron/automations and the local scheduler. Idempotent within its windows
// via the *SentAt timestamps and last-message age, so re-running is safe.
import { db } from './db'
import { sendWhatsAppText, formatVisitReminder, formatFollowupMessage, formatVisitFeedbackRequest } from './whatsapp'
import { formatSlotIST } from './scheduling'

const HOUR = 60 * 60 * 1000

export interface AutomationSummary {
  remindersSent: number
  feedbackRequests: number
  followups: number
  details: string[]
  ranAt: string
}

async function sendToLead(leadId: string, phone: string, text: string, deliver: boolean) {
  await db.message.create({ data: { leadId, direction: 'OUTBOUND', channel: 'WHATSAPP', content: text } })
  if (deliver && !phone.startsWith('manual:') && !phone.startsWith('web:')) await sendWhatsAppText(phone, text)
}

export async function runAutomations(opts?: { deliver?: boolean; now?: Date }): Promise<AutomationSummary> {
  const deliver = opts?.deliver ?? true
  const now = opts?.now ?? new Date()
  const details: string[] = []
  let remindersSent = 0
  let feedbackRequests = 0
  let followups = 0

  // 1. Visit reminders — upcoming tentative/confirmed visits within 24h, not yet reminded.
  const upcoming = await db.visit.findMany({
    where: {
      status: { in: ['TENTATIVE', 'CONFIRMED'] },
      reminderSentAt: null,
      scheduledFor: { gte: now, lte: new Date(now.getTime() + 24 * HOUR) },
    },
    include: { lead: true },
  })
  for (const v of upcoming) {
    if (!v.scheduledFor) continue
    const msg = formatVisitReminder({ leadName: v.lead.name, slotText: formatSlotIST(v.scheduledFor) })
    await sendToLead(v.leadId, v.lead.phone, msg, deliver)
    await db.visit.update({ where: { id: v.id }, data: { reminderSentAt: now } })
    await db.activity.create({ data: { type: 'REMINDER_SENT', description: `Visit reminder sent (${formatSlotIST(v.scheduledFor)})`, leadId: v.leadId } })
    remindersSent++
    details.push(`Reminder → ${v.lead.name ?? v.lead.phone}`)
  }

  // 2. Post-visit feedback — visits whose slot passed >2h ago, no feedback request yet.
  const past = await db.visit.findMany({
    where: {
      status: { in: ['TENTATIVE', 'CONFIRMED'] },
      followupSentAt: null,
      scheduledFor: { lt: new Date(now.getTime() - 2 * HOUR) },
    },
    include: { lead: true },
  })
  for (const v of past) {
    const msg = formatVisitFeedbackRequest(v.lead.name)
    await sendToLead(v.leadId, v.lead.phone, msg, deliver)
    await db.visit.update({ where: { id: v.id }, data: { followupSentAt: now, status: 'COMPLETED' } })
    await db.activity.create({ data: { type: 'FEEDBACK', description: 'Asked lead for post-visit feedback', leadId: v.leadId } })
    feedbackRequests++
    details.push(`Feedback request → ${v.lead.name ?? v.lead.phone}`)
  }

  // 3. Stalled-lead follow-ups — active leads with no message in 48h–14d.
  const active = await db.lead.findMany({
    where: { status: { in: ['QUALIFYING', 'MATCHED', 'WARM'] } },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  for (const lead of active) {
    if (lead.phone.startsWith('manual:') || lead.phone.startsWith('web:')) continue
    const last = lead.messages[0]
    if (!last) continue
    const age = now.getTime() - new Date(last.createdAt).getTime()
    if (age < 48 * HOUR || age > 14 * 24 * HOUR) continue
    const msg = formatFollowupMessage(lead.name)
    await sendToLead(lead.id, lead.phone, msg, deliver)
    await db.activity.create({ data: { type: 'FOLLOWUP_SENT', description: 'Re-engagement follow-up sent (lead went quiet)', leadId: lead.id } })
    followups++
    details.push(`Follow-up → ${lead.name ?? lead.phone}`)
  }

  return { remindersSent, feedbackRequests, followups, details, ranAt: now.toISOString() }
}
