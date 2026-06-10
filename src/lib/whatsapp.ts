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
  const lines: string[] = [`${hello}yeh rahi aapke liye ${matches.length} best matching properties: ✨`]
  matches.forEach((m, i) => {
    const p = m.property
    const specs = [p.bhk ? `${p.bhk} BHK` : null, formatArea(p.area, p.areaUnit) || null, p.locality || p.city].filter(Boolean).join(' · ')
    lines.push('')
    lines.push(`*${i + 1}. ${p.title}*`)
    lines.push(`   ${formatPrice(p.price, p.listingFor)} · ${specs}`)
    if (m.reasons.length) lines.push(`   ✓ ${m.reasons.slice(0, 2).join(' · ')}`)
    lines.push(`   ${propertyUrl(p.id)}`)
  })
  lines.push('')
  lines.push('Pura detail website par hai. Koi pasand aaye toh bataiye — main visit schedule karwa dunga! 🏡')
  return lines.join('\n')
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
    '🔥 *Warm lead — call them now!*',
    '',
    `*Who:* ${leadName || 'Name not shared yet'} (+${leadPhone.replace(/\D/g, '')})`,
    `*Summary:* ${summary}`,
    `*Looking for:* ${requirements}`,
    topProperty ? `*Most interested in:* ${topProperty.title}\n${propertyUrl(topProperty.id)}` : null,
    '',
    `Full history: ${siteUrl()}/admin/leads`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}
