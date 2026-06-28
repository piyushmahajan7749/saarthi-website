// WhatsApp Business Cloud API (Meta) outbound messaging.
// Without WHATSAPP_TOKEN configured, messages are logged instead of sent —
// the admin Simulator and dev environment work fully offline.
import type { Property } from '@prisma/client'
import { formatPrice, formatArea } from './format'

const GRAPH_URL = 'https://graph.facebook.com/v21.0'

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

// Returns true if actually delivered to the WhatsApp API (false in dev/log mode).
export async function sendWhatsAppText(toPhone: string, text: string): Promise<boolean> {
  const to = toPhone.replace(/\D/g, '')
  if (!whatsappConfigured()) {
    console.log(`[whatsapp:dev] -> ${to}: ${text}`)
    return false
  }
  const res = await fetch(`${GRAPH_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: true },
    }),
  })
  if (!res.ok) {
    console.error('[whatsapp] send failed:', res.status, await res.text())
    return false
  }
  return true
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function propertyUrl(propertyId: string): string {
  return `${siteUrl()}/listings/${propertyId}`
}

// WhatsApp-formatted matches message with links to the website detail pages.
export function formatMatchesMessage(matches: { property: Property; reasons: string[] }[], leadName?: string | null): string {
  const hello = leadName ? `${leadName}, ` : ''
  const lines: string[] = [`${hello}yeh rahi aapke liye ${matches.length} achhi properties 👇`]
  matches.forEach((m, i) => {
    const p = m.property
    const specs = [p.bhk ? `${p.bhk} BHK` : null, formatArea(p.area, p.areaUnit) || null, p.locality || p.city].filter(Boolean).join(' · ')
    lines.push('')
    lines.push(`${i + 1}. ${p.title}`)
    lines.push(`${formatPrice(p.price, p.listingFor)} · ${specs}`)
    if (m.reasons.length) lines.push(`✓ ${m.reasons.slice(0, 2).join(' · ')}`)
    lines.push(propertyUrl(p.id))
  })
  lines.push('')
  lines.push('Koi pasand aaye toh bataiye — main visit set karwa dunga 🏡')
  return lines.join('\n')
}

// Resolve and download an inbound WhatsApp media object (image/video/audio).
// Returns the bytes + mime, or null in dev / on failure. Two-step per Cloud API:
// GET /{media-id} -> { url }, then GET that url with the bearer token.
export async function fetchWhatsAppMedia(mediaId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!whatsappConfigured()) {
    console.log(`[whatsapp:dev] would download media ${mediaId}`)
    return null
  }
  try {
    const metaRes = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    })
    if (!metaRes.ok) return null
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string }
    if (!meta.url) return null
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } })
    if (!binRes.ok) return null
    const bytes = Buffer.from(await binRes.arrayBuffer())
    return { bytes, mime: meta.mime_type || 'application/octet-stream' }
  } catch (err) {
    console.error('[whatsapp] media download failed:', err)
    return null
  }
}

// Tentative-visit proposal sent to the lead.
export function formatVisitProposal(args: {
  leadName: string | null
  slotText: string
  properties: { title: string }[]
}): string {
  const { leadName, slotText, properties } = args
  const hello = leadName ? `${leadName}, ` : ''
  const list = properties.map((p, i) => `${i + 1}. ${p.title}`).join('\n')
  return [
    `${hello}maine aapke liye visit tentatively rakh diya hai 📅`,
    '',
    `🕒 ${slotText}`,
    properties.length ? `\nProperties:\n${list}` : '',
    '',
    'Humari team broker se final time confirm karke aapko bata degi. Koi aur time chahiye toh bata dijiye 🙏',
  ].filter((l) => l !== '').join('\n')
}

// Coordination alert to the staff member who added the lead (the coordinator) —
// they take it forward with the listing brokers directly.
export function formatVisitCoordinationAlert(args: {
  leadName: string | null
  leadPhone: string
  slotText: string
  summary: string
  properties: { title: string; id: string; postedBy: string | null }[]
}): string {
  const { leadName, leadPhone, slotText, summary, properties } = args
  const list = properties
    .map((p, i) => `${i + 1}. ${p.title}${p.postedBy ? ` — broker: ${p.postedBy}` : ''}\n   ${propertyUrl(p.id)}`)
    .join('\n')
  return [
    '📅 Visit to coordinate — your lead is ready',
    '',
    `Lead: ${leadName || 'Name not shared'} (+${leadPhone.replace(/\D/g, '')})`,
    `Summary: ${summary}`,
    `Tentative slot: ${slotText}`,
    '',
    'Selected properties:',
    list,
    '',
    'Please confirm the final time with the listing broker(s) and the lead.',
    `Manage: ${siteUrl()}/admin/leads`,
  ].join('\n')
}

// Outbound opener when staff add a lead — bot starts qualification.
export function formatLeadOpener(leadName: string | null): string {
  const hello = leadName ? `Namaste ${leadName}! 🙏` : 'Namaste! 🙏'
  return `${hello} Main Saarthi hoon, ${process.env.NEXT_PUBLIC_SITE_NAME || 'aapki property search'} ka AI assistant. Aapke liye ghar dhoondhne mein madad karunga. Aap khareedna chahte hain ya rent par dhoondh rahe hain? 🏡`
}

// Opener when a BROKER refers a lead — the bot reaches out and confirms the
// requirement the broker shared, so the lead doesn't have to repeat themselves.
export function formatReferredLeadOpener(args: {
  leadName: string | null
  requirementText: string | null
  brokerName: string | null
}): string {
  const { leadName, requirementText, brokerName } = args
  const hello = leadName ? `Namaste ${leadName}! 🙏` : 'Namaste! 🙏'
  const via = brokerName ? `${brokerName} ne aapko humse connect kiya hai.` : 'Aapko humse connect kiya gaya hai.'
  const known =
    requirementText && requirementText !== 'requirements not captured yet'
      ? ` Maine suna aap ${requirementText} dhoondh rahe hain — sahi hai na?`
      : ' Bataiye, aap kaisi property dhoondh rahe hain?'
  return `${hello} Main Saarthi hoon, ${process.env.NEXT_PUBLIC_SITE_NAME || 'aapki property search'} ka AI assistant. ${via}${known} Main aapke liye sahi options nikaal deta hoon 🏡`
}

export function formatVisitReminder(args: { leadName: string | null; slotText: string }): string {
  const hello = args.leadName ? `${args.leadName}, ` : ''
  return `${hello}reminder 🔔 — aapki property visit ${args.slotText} ke liye tentatively scheduled hai. Humari team confirm karke final details bhejegi. Visit ke liye ready hain? 😊`
}

export function formatFollowupMessage(leadName: string | null): string {
  const hello = leadName ? `${leadName}, ` : ''
  return `${hello}namaste! 🙏 Kya aap abhi bhi property dhoondh rahe hain? Maine kuch nayi listings dekhi hain jo aapke liye perfect ho sakti hain. Bataiye toh main bhej doon? 🏡`
}

export function formatVisitFeedbackRequest(leadName: string | null): string {
  const hello = leadName ? `${leadName}, ` : ''
  return `${hello}visit kaisi rahi? 😊 Property pasand aayi ya kuch aur dekhna chahenge? Aapka feedback bataiye — main aur behtar options dhoondh sakta hoon.`
}

// Alert sent to the broker who owns the listing / is assigned, when a lead turns warm.
export function formatWarmLeadAlert(args: {
  leadName: string | null
  leadPhone: string
  summary: string
  requirements: string
  topProperty?: { title: string; id: string } | null
}): string {
  const { leadName, leadPhone, summary, requirements, topProperty } = args
  return [
    '🔥 Warm lead — call them now',
    '',
    `Who: ${leadName || 'Name not shared yet'} (+${leadPhone.replace(/\D/g, '')})`,
    `Summary: ${summary}`,
    `Looking for: ${requirements}`,
    topProperty ? `Most interested in: ${topProperty.title}\n${propertyUrl(topProperty.id)}` : null,
    '',
    `Full history: ${siteUrl()}/admin/leads`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}
