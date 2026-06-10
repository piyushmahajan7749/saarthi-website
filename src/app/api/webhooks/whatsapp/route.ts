// Meta WhatsApp Cloud API webhook — the front door for every lead.
// GET  = verification handshake (Meta calls this once when you wire the webhook).
// POST = inbound messages; each text message runs through the full qualifier
//        pipeline (lead upsert → AI qualify → matches → warm promotion → broker alert).
// Always answers 200 to POSTs — Meta retries aggressively on anything else.
import { handleInboundLeadMessage } from '@/lib/qualifier'
import { sendWhatsAppText } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const mode = sp.get('hub.mode')
  const token = sp.get('hub.verify_token')
  const challenge = sp.get('hub.challenge')

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const entries = Array.isArray(body?.entry) ? body.entry : []

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        const value = change?.value
        if (!value) continue
        const messages = Array.isArray(value.messages) ? value.messages : []
        const profileName: string | null = value.contacts?.[0]?.profile?.name ?? null

        for (const message of messages) {
          try {
            const from = typeof message?.from === 'string' ? message.from : null
            if (!from) continue

            if (message.type === 'text' && typeof message.text?.body === 'string') {
              await handleInboundLeadMessage({
                phone: from,
                text: message.text.body,
                profileName,
                deliver: true,
              })
            } else if (['audio', 'image', 'video', 'document', 'sticker'].includes(message.type)) {
              // Politely decline media — the bot is text-only for now.
              await sendWhatsAppText(
                from,
                'Filhaal main sirf text samajh paata hoon 🙏 Apni requirement likh kar bhejiye — jaise "2 BHK rent pe chahiye Vijay Nagar me".'
              )
            }
            // statuses/reactions/unknown types: ignore silently
          } catch (err) {
            console.error('[webhook:whatsapp] failed to process message', err)
          }
        }
      }
    }
  } catch (err) {
    console.error('[webhook:whatsapp] handler error', err)
  }
  // Always 200 — internal errors are logged, never surfaced to Meta.
  return Response.json({ ok: true })
}
