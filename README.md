# Saarthi — AI Real Estate Platform

> Har saude mein saath. · India's AI property guide (Indore first).

A full-stack real-estate platform: public listings site with AI smart search and an AI chat concierge, an automated listing parser (WhatsApp chats / Excel sheets / web form → structured listings), a WhatsApp lead-qualifier bot, and a broker CRM — brokers are only pinged once a lead turns **warm**.

## Quick start

```bash
npm install
npm run db:push      # create SQLite db from prisma/schema.prisma
npm run db:seed      # admin user + brokers + 14 Indore listings + sample leads
npm run dev          # http://localhost:3000
```

**Admin login** → `http://localhost:3000/admin/login`
- Phone: `919826078459` · Password: `saarthi123` (change via `SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD` in `.env` before seeding)

## Configuration (.env / .env.local)

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables Claude-powered parsing, smart search, chat & qualifier bot. **Empty = heuristic fallback mode — everything still works**, just rule-based. |
| `AI_MODEL` | Default `claude-opus-4-8`. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Cloud API creds for real outbound messages. Empty = messages logged to console; use the admin **Bot Simulator** instead. |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token (set the same value in the Meta app dashboard). |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Public CTA number (currently `919826078459`). |
| `NEXT_PUBLIC_SITE_URL` | Used for property links the bot sends on WhatsApp. |
| `SESSION_SECRET` | JWT signing secret for admin sessions. |

Put real secrets in `.env.local` (gitignored); `.env` holds safe defaults.

## The funnel

1. **Inventory in** — three intake channels, all landing as structured `Property` rows with full tracking (`source`, `postedBy`, `status`, `rawText`, `aiNotes`, `aiConfidence`):
   - *WhatsApp paste* — Admin → Intake: paste a chat export, Claude splits & structures every listing.
   - *Excel upload* — any column layout; AI maps columns per row.
   - *Web form* — public `/post-property` page → `PENDING_REVIEW` for one-click approval.
2. **Leads in** — buyers message the WhatsApp number (webhook: `/api/webhooks/whatsapp`) or the website chat widget. The AI qualifier asks one question at a time (budget → BHK → locality → timeline), then sends links to matching listings on this site.
3. **Warm ≠ noise** — leads sit in `NEW → QUALIFYING` until the AI (or an admin) marks them `WARM`. Only then does the bot WhatsApp the broker who posted the matched listing: *"🔥 Warm lead — call them now"* with the lead's summary, requirements and number.
4. **Close** — broker calls, schedules the visit (`VISIT_SCHEDULED`), closes (`CLOSED`). Every step is on the lead's activity timeline in the CRM.

## Map

| Where | What |
| --- | --- |
| `/` | Marketing homepage + featured listings + smart search + AI chat widget |
| `/listings`, `/listings/[id]` | Browse with NL smart search ("3bhk under 80L vijay nagar"), detail pages the bot links to |
| `/post-property` | Public owner/broker submission form |
| `/admin` | Dashboard: stats, pipeline, needs-attention, activity feed |
| `/admin/listings` | Listing management (status, feature, edit, create) |
| `/admin/intake` | The parser: WhatsApp paste / Excel upload / web-submission review |
| `/admin/leads`, `/admin/leads/[id]` | CRM: pipeline board, full WhatsApp transcript, matches, activity, warm/cold controls |
| `/admin/simulator` | Chat as a fake buyer end-to-end — no WhatsApp setup needed |
| `src/lib/ai.ts` | All Claude calls (structured outputs) with heuristic fallbacks |
| `src/lib/qualifier.ts` | The inbound-message pipeline (qualify → match → warm → notify broker) |
| `src/lib/matching.ts` | Deterministic lead↔property scoring (so brokers trust why a match was sent) |

## Going to production

- Swap `datasource db` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL` — the schema is Postgres-ready (string enums, no SQLite-isms).
- Point the Meta webhook at `https://<domain>/api/webhooks/whatsapp` with your `WHATSAPP_VERIFY_TOKEN`.
- Set a strong `SESSION_SECRET`, real `ANTHROPIC_API_KEY`, and `NEXT_PUBLIC_SITE_URL`.
