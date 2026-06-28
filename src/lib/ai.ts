// All Claude API usage lives here. Every function degrades gracefully to the
// heuristic engine in src/lib/heuristics.ts when ANTHROPIC_API_KEY is unset or
// a call fails — the platform must keep working without AI.
import Anthropic from '@anthropic-ai/sdk'
import type { ParsedListing, PropertyFilters, LeadRequirements, QualifierResult, ExtractedLead } from '@/types'
import {
  heuristicParseListing,
  heuristicParseSearch,
  heuristicQualifierTurn,
  splitWhatsAppChatBlocks,
  parsePriceToken,
} from './heuristics'
import { azureEnabled, azureChatJSON, mapLimit } from './azure-openai'

const MODEL = process.env.AI_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// The conversational AI layer runs on Azure OpenAI (GPT-5.5) when configured,
// otherwise Anthropic Claude, otherwise the heuristic engine.
export function aiEnabled(): boolean {
  return azureEnabled() || Boolean(process.env.ANTHROPIC_API_KEY)
}

// Structured-output helper: one user prompt -> JSON matching `schema`.
// Prefers Azure (reasoning models need headroom, so we floor the token budget),
// falls back to Anthropic structured outputs.
async function structured<T>(system: string, prompt: string, schema: Record<string, unknown>, maxTokens = 16000): Promise<T> {
  if (azureEnabled()) {
    return azureChatJSON<T>({ system, user: prompt, schema, maxTokens: Math.max(maxTokens, 6000) })
  }
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { format: { type: 'json_schema', schema } },
  } as Parameters<Anthropic['messages']['create']>[0])
  const block = (response as Anthropic.Message).content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('No text block in structured response')
  return JSON.parse(block.text) as T
}

// ---------------------------------------------------------------------------
// 1. Listing parser — WhatsApp text / Excel rows / web form -> ParsedListing[]
// ---------------------------------------------------------------------------

const LISTING_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title', 'type', 'listingFor', 'bhk', 'price', 'area', 'areaUnit', 'furnishing', 'locality',
    'city', 'address', 'amenities', 'ownerName', 'ownerPhone', 'postedByName', 'mediaCount',
    'description', 'aiSummary', 'aiNotes', 'aiConfidence', 'rawText',
  ],
  properties: {
    title: { type: 'string', description: 'Short marketable title, e.g. "3 BHK Flat for Sale in Vijay Nagar"' },
    type: { type: 'string', enum: ['FLAT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP', 'PG'] },
    listingFor: { type: 'string', enum: ['SALE', 'RENT'] },
    bhk: { type: ['integer', 'null'] },
    price: { type: ['number', 'null'], description: 'Absolute rupees. 75 lakh = 7500000. Rent is per month.' },
    area: { type: ['number', 'null'] },
    areaUnit: { type: 'string', enum: ['sqft', 'sqyd', 'acre'] },
    furnishing: { type: ['string', 'null'], enum: ['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED', null] },
    locality: { type: 'string' },
    city: { type: 'string' },
    address: { type: 'string' },
    amenities: { type: 'array', items: { type: 'string' } },
    ownerName: { type: ['string', 'null'], description: 'Property owner/seller name if mentioned in the message body' },
    ownerPhone: { type: ['string', 'null'], description: 'Digits only with country code, e.g. 919826078459' },
    postedByName: { type: ['string', 'null'], description: 'The WhatsApp group member who POSTED this listing (the chat sender), e.g. "Rajan Verma". Distinct from the property owner.' },
    mediaCount: { type: 'integer', description: 'How many photos/videos were attached to this message (count "<Media omitted>", "file attached", IMG-/VID- references). 0 if none.' },
    description: { type: 'string', description: 'Clean 2-4 sentence description rewritten from the raw text' },
    aiSummary: { type: ['string', 'null'], description: 'One-line sales pitch' },
    aiNotes: { type: ['string', 'null'], description: 'Comments for the admin: missing fields, red flags, whether price looks high/low for the locality' },
    aiConfidence: { type: 'number', description: '0 to 1 — how confident the extraction is' },
    rawText: { type: 'string', description: 'The exact source text this listing came from' },
  },
} as const

const LISTINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['listings'],
  properties: { listings: { type: 'array', items: LISTING_ITEM_SCHEMA } },
}

const PARSER_SYSTEM = `You are Saarthi's listing parser for Indian real estate (primary market: Indore, MP).
The input is usually an exported BROKER WhatsApp GROUP chat where brokers post inventory. Lines look like "12/05/25, 10:31 - Rajan Verma: 3 BHK flat...". Extract EVERY distinct property listing into structured JSON.
Rules:
- postedByName = the chat sender who posted the listing (e.g. "Rajan Verma"). This is who to credit/contact, distinct from the property owner.
- mediaCount = number of photos/videos attached to that message ("<Media omitted>", "file attached", IMG-/VID- references).
- Convert Indian price formats: "75L"/"75 lakh" = 7500000, "1.2cr" = 12000000. Rent amounts are per month.
- Rent price sanity: residential rent in Indore ranges ₹4,000–₹1,50,000/month. If the extracted rent price exceeds ₹3,00,000 it is almost certainly a SALE price — either reclassify as SALE or set price=null and flag in aiNotes.
- Hinglish is common ("makaan", "bechna hai", "kiraya", "rent pe") — interpret it.
- Skip chatter that is not a property listing (greetings, questions, requirement posts like "chahiye"/"required"/"looking for").
- If a message is a REQUIREMENT (someone looking to buy/rent) and not an inventory listing, skip it.
- aiNotes must flag: missing price/locality/contact, suspicious pricing for the locality, price that looks like a sale amount on a RENT listing, and note if photos/videos are attached (admin should download & attach them).
- Never invent data. Use null for unknown fields. Keep rawText verbatim per listing.`

// ---- Multi-agent listing pipeline (Azure OpenAI / GPT-5.5) -----------------
// Three specialised passes for accuracy:
//   1. Segmenter — split the raw chat into distinct listing "posts"
//   2. Extractor — turn each post into a structured ParsedListing
//   3. Auditor   — cross-check & correct every listing (price scale, SALE/RENT…)
// Each pass degrades to the previous best engine if Azure is unavailable.

const SEGMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['posts'],
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rawText', 'postedByName', 'mediaCount'],
        properties: {
          rawText: { type: 'string', description: 'VERBATIM text of this one listing, including any media filename / "<Media omitted>" / "(file attached)" lines exactly as written.' },
          postedByName: { type: ['string', 'null'], description: 'WhatsApp sender who posted it, e.g. "Rajan Verma". Null if unknown.' },
          mediaCount: { type: 'integer', description: 'Count of photos/videos attached to this listing ("<Media omitted>", "file attached", IMG-/VID- references).' },
        },
      },
    },
  },
} as const

interface SegmentedPost { rawText: string; postedByName: string | null; mediaCount: number }

const SEGMENTER_SYSTEM = `You segment an exported BROKER WhatsApp group chat (Indore, India real estate) into individual PROPERTY LISTINGS.
A single chat message may contain several listings; one listing may span several consecutive messages from the same sender. Your job is to output exactly one entry per distinct property on offer.
Rules:
- INCLUDE only inventory being offered (for sale or rent). EXCLUDE greetings, thanks, questions, requirement/wanted posts ("chahiye", "required", "looking for", "need"), price negotiations and general chatter.
- Keep rawText VERBATIM — do not paraphrase, translate, or drop media reference lines (e.g. "IMG-20240608-WA0001.jpg (file attached)", "<Media omitted>"). The downstream system matches photos to listings using those exact filenames.
- postedByName = the chat sender (left of the colon on the "DD/MM/YY, HH:MM - Name:" line), not the property owner.
- mediaCount = number of media attachments that belong to that listing.
- If the same property is reposted, output it once (the most complete version).`

const EXTRACTOR_SYSTEM = `You are Saarthi's expert listing extractor for Indian real estate (primary market: Indore, MP). You receive an ARRAY of pre-segmented listing posts and must output one structured listing per input post, IN THE SAME ORDER (same array length).
Extraction rules:
- title: short, marketable, e.g. "3 BHK Flat for Sale in Vijay Nagar".
- type: FLAT/HOUSE/VILLA/PLOT/COMMERCIAL/OFFICE/SHOP/PG. "makaan"/"bungalow"/"kothi"/"independent house" => HOUSE. "plot"/"land"/"farm"/"jameen" => PLOT.
- listingFor: SALE or RENT. Cues for RENT: "rent", "kiraya", "lease", "per month", "/month", "pm", "rent pe". Cues for SALE: "sale", "sell", "bechna", "for sale".
- price: ABSOLUTE rupees. Conversions: "75L"/"75 lac"/"75 lakh" => 7500000; "1.2cr"/"1.2 crore" => 12000000; "18k"/"18 hazaar" => 18000; "₹45,00,000" => 4500000. Rent is the MONTHLY figure.
- PRICE SANITY (critical): residential RENT in Indore is ₹3,000–₹2,00,000/month. If a RENT listing's price would exceed ₹3,00,000/month it is almost certainly a SALE price stated in the message — if the post is genuinely a rental, set price=null and explain in aiNotes; if it is actually a sale, set listingFor=SALE. Never put a sale-scale number (e.g. 1,00,00,000) on a RENT listing.
- area + areaUnit: number with unit sqft/sqyd/acre (default sqft).
- bhk: integer (null for plots/commercial).
- ownerName/ownerPhone: the PROPERTY owner/seller if named in the body. ownerPhone = digits with country code (prefix 91 for bare 10-digit Indian numbers). postedByName is given to you — keep it; it is the broker who posted, distinct from the owner.
- mediaCount: keep the value provided for the post.
- description: clean, factual 2–4 sentences rewritten from rawText (no invented amenities).
- amenities: only those explicitly mentioned.
- aiSummary: one-line sales pitch. aiNotes: missing fields, red flags, pricing that looks off for the locality, and a note if media is attached.
- aiConfidence: 0..1 honest confidence.
- rawText: copy the post's rawText VERBATIM (unchanged).
- NEVER invent data. Use null for unknown fields.`

const AUDITOR_SYSTEM = `You are a strict QA auditor for extracted Indian real-estate listings (Indore). You receive listings with their original rawText and must return the SAME listings array (same order, same length) with errors corrected.
Check and FIX each listing against its rawText:
- Price scale: lakh/crore/k conversions correct? "75 lakh"=7500000, "1.2cr"=12000000, "18k"=18000.
- SALE vs RENT: does listingFor match the text? A RENT price above ₹3,00,000/month is wrong — either it is really a SALE (set listingFor=SALE) or the rent is unknown (set price=null). Never leave a sale-scale price on a RENT listing.
- type, bhk, area/areaUnit, locality, city sane and supported by rawText?
- owner vs poster not swapped; phone digits valid (country code, 10-digit Indian => prefix 91).
- No hallucinated amenities/fields — strip anything not in rawText.
Update aiNotes to describe any correction you made or any remaining gap, and set aiConfidence accordingly. Do NOT alter rawText, mediaCount, or postedByName unless they are clearly wrong. Return the corrected listings array.`

const EXTRACT_CHUNK = 6 // posts per extractor call
const AUDIT_CHUNK = 10 // listings per auditor call
const PARSE_CONCURRENCY = 4

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function azureSegment(raw: string): Promise<SegmentedPost[]> {
  const { posts } = await azureChatJSON<{ posts: SegmentedPost[] }>({
    system: SEGMENTER_SYSTEM,
    user: `Segment this broker WhatsApp group export into individual property listings:\n\n<chat>\n${raw.slice(0, 100_000)}\n</chat>`,
    schema: SEGMENT_SCHEMA,
    schemaName: 'segments',
    maxTokens: 16_000,
    timeoutMs: 100_000,
  })
  return Array.isArray(posts) ? posts : []
}

async function azureExtract(posts: SegmentedPost[]): Promise<ParsedListing[]> {
  const chunks = chunk(posts, EXTRACT_CHUNK)
  const results = await mapLimit(chunks, PARSE_CONCURRENCY, async (group) => {
    const { listings } = await azureChatJSON<{ listings: ParsedListing[] }>({
      system: EXTRACTOR_SYSTEM,
      user: `Extract one structured listing per post (preserve order):\n\n${JSON.stringify(group, null, 1)}`,
      schema: LISTINGS_SCHEMA,
      schemaName: 'listings',
      maxTokens: 12_000,
    })
    return Array.isArray(listings) ? listings : []
  })
  return results.flat()
}

async function azureAudit(listings: ParsedListing[]): Promise<ParsedListing[]> {
  const chunks = chunk(listings, AUDIT_CHUNK)
  const results = await mapLimit(chunks, PARSE_CONCURRENCY, async (group) => {
    try {
      const { listings: fixed } = await azureChatJSON<{ listings: ParsedListing[] }>({
        system: AUDITOR_SYSTEM,
        user: `Audit and correct these listings:\n\n${JSON.stringify(group, null, 1)}`,
        schema: LISTINGS_SCHEMA,
        schemaName: 'listings',
        maxTokens: 12_000,
      })
      // Only accept a clean 1:1 correction; otherwise keep the originals.
      return Array.isArray(fixed) && fixed.length === group.length ? fixed : group
    } catch (err) {
      console.error('[ai] audit chunk failed, keeping unaudited listings:', err)
      return group
    }
  })
  return results.flat()
}

// Legacy single-shot Claude parse — middle fallback when Azure is unavailable.
async function claudeParse(prompt: string): Promise<ParsedListing[]> {
  const { listings } = await structured<{ listings: ParsedListing[] }>(PARSER_SYSTEM, prompt, LISTINGS_SCHEMA)
  return listings
}

export async function parseListingsFromText(raw: string): Promise<ParsedListing[]> {
  const heuristic = () =>
    splitWhatsAppChatBlocks(raw).map((b) => heuristicParseListing(b.text, { postedByName: b.sender, mediaCount: b.mediaCount }))

  if (azureEnabled()) {
    try {
      const posts = await azureSegment(raw)
      if (posts.length === 0) return []
      const extracted = await azureExtract(posts)
      return await azureAudit(extracted)
    } catch (err) {
      console.error('[ai] Azure listing pipeline failed, trying Claude:', err)
    }
  }
  if (aiEnabled()) {
    try {
      return await claudeParse(`Extract all property listings from this broker WhatsApp group export:\n\n<input>\n${raw.slice(0, 60000)}\n</input>`)
    } catch (err) {
      console.error('[ai] Claude listing parse failed, falling back to heuristics:', err)
    }
  }
  return heuristic()
}

export async function parseListingsFromRows(rows: Record<string, unknown>[]): Promise<ParsedListing[]> {
  const rowsHeuristic = () =>
    rows.map((r) => heuristicParseListing(Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')))

  // Each row is already one property — no segmentation needed.
  const posts: SegmentedPost[] = rows.map((r) => ({ rawText: Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', '), postedByName: null, mediaCount: 0 }))

  if (azureEnabled()) {
    try {
      const extracted = await azureExtract(posts)
      return await azureAudit(extracted)
    } catch (err) {
      console.error('[ai] Azure row pipeline failed, trying Claude:', err)
    }
  }
  if (aiEnabled()) {
    try {
      const rowsText = rows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n')
      return await claudeParse(`Each row below is one property from an Excel sheet (column names vary by broker — map them sensibly). Extract one listing per row:\n\n${rowsText.slice(0, 60000)}`)
    } catch (err) {
      console.error('[ai] Claude row parse failed, falling back to heuristics:', err)
    }
  }
  return rowsHeuristic()
}

// ---------------------------------------------------------------------------
// 2. Smart search — natural language -> PropertyFilters
// ---------------------------------------------------------------------------

const FILTERS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'listingFor', 'bhk', 'priceMin', 'priceMax', 'locality', 'q'],
  properties: {
    type: { type: ['string', 'null'], enum: ['FLAT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP', 'PG', null] },
    listingFor: { type: ['string', 'null'], enum: ['SALE', 'RENT', null] },
    bhk: { type: ['integer', 'null'] },
    priceMin: { type: ['number', 'null'], description: 'Rupees' },
    priceMax: { type: ['number', 'null'], description: 'Rupees' },
    locality: { type: ['string', 'null'] },
    q: { type: ['string', 'null'], description: 'Leftover free-text terms worth keyword-matching' },
  },
}

export async function parseSearchQuery(query: string): Promise<PropertyFilters> {
  if (!query.trim()) return {}
  if (!aiEnabled()) return heuristicParseSearch(query)
  try {
    const out = await structured<Record<string, unknown>>(
      'Convert an Indian real-estate search query (possibly Hinglish) into structured filters. "under 80 lakh" => priceMax 8000000. Null for anything not specified.',
      `Query: "${query}"`,
      FILTERS_SCHEMA,
      1000
    )
    const filters: PropertyFilters = {}
    if (out.type) filters.type = out.type as PropertyFilters['type']
    if (out.listingFor) filters.listingFor = out.listingFor as PropertyFilters['listingFor']
    if (out.bhk) filters.bhk = out.bhk as number
    if (out.priceMin) filters.priceMin = out.priceMin as number
    if (out.priceMax) filters.priceMax = out.priceMax as number
    if (out.locality) filters.locality = out.locality as string
    if (out.q) filters.q = out.q as string
    return filters
  } catch (err) {
    console.error('[ai] parseSearchQuery failed, falling back to heuristics:', err)
    return heuristicParseSearch(query)
  }
}

// ---------------------------------------------------------------------------
// 3a. Lead extraction — admin's voice/text note -> structured lead
// ---------------------------------------------------------------------------

const REQUIREMENTS_SCHEMA_PROPS = {
  listingFor: { type: ['string', 'null'], enum: ['SALE', 'RENT', null] },
  type: { type: ['string', 'null'], enum: ['FLAT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP', 'PG', null] },
  bhk: { type: ['integer', 'null'] },
  budgetMin: { type: ['number', 'null'], description: 'Rupees' },
  budgetMax: { type: ['number', 'null'], description: 'Rupees' },
  localities: { type: 'array', items: { type: 'string' } },
  city: { type: ['string', 'null'] },
  timeline: { type: ['string', 'null'] },
  purpose: { type: ['string', 'null'] },
  notes: { type: ['string', 'null'] },
}
const REQUIREMENTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['listingFor', 'type', 'bhk', 'budgetMin', 'budgetMax', 'localities', 'city', 'timeline', 'purpose', 'notes'],
  properties: REQUIREMENTS_SCHEMA_PROPS,
}

const EXTRACT_LEAD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'phone', 'requirements', 'aiSummary', 'notes', 'confidence'],
  properties: {
    name: { type: ['string', 'null'], description: 'Lead\'s name if stated' },
    phone: { type: ['string', 'null'], description: 'Digits only, with country code (prefix 91 for a bare 10-digit Indian number)' },
    requirements: REQUIREMENTS_SCHEMA,
    aiSummary: { type: 'string', description: 'One-sentence summary of who this lead is and what they want' },
    notes: { type: ['string', 'null'], description: 'Anything else the staff member said worth keeping (how they met, urgency, etc.)' },
    confidence: { type: 'number', description: '0..1 how confident the extraction is' },
  },
}

// Used by the admin "Add lead" feature (text typed, or a transcribed voice note).
export async function extractLeadFromText(text: string): Promise<ExtractedLead> {
  const fallback = (): ExtractedLead => {
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/)
    const bhk = text.match(/(\d+)\s*bhk/i)
    const price = parsePriceToken(text)
    const nameMatch = text.match(/\b(?:name is|naam|mr\.?|ms\.?|client)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/)
    return {
      name: nameMatch ? nameMatch[1] : null,
      phone: phoneMatch ? `91${phoneMatch[1]}` : null,
      requirements: {
        listingFor: /\brent|kiraya|lease\b/i.test(text) ? 'RENT' : /\bbuy|sale|purchase|lena\b/i.test(text) ? 'SALE' : undefined,
        bhk: bhk ? parseInt(bhk[1], 10) : undefined,
        budgetMax: price ?? undefined,
        notes: text.trim().slice(0, 500),
      },
      aiSummary: `Lead captured (heuristic): ${text.trim().slice(0, 120)}`,
      notes: null,
      confidence: 0.4,
    }
  }
  if (!aiEnabled()) return fallback()
  try {
    return await structured<ExtractedLead>(
      'You convert a real-estate agent\'s quick note (typed or transcribed from voice, often Hinglish) about a prospective buyer/renter into a structured lead. Extract name, phone, and requirements. "75 lakh" => 7500000. Prefix bare 10-digit Indian numbers with 91. Never invent a phone number.',
      `Agent's note about a new lead:\n"""${text.slice(0, 4000)}"""`,
      EXTRACT_LEAD_SCHEMA,
      1500
    )
  } catch (err) {
    console.error('[ai] extractLeadFromText failed, falling back:', err)
    return fallback()
  }
}

// ---------------------------------------------------------------------------
// 3b. Lead qualifier bot (WhatsApp + website chat)
// ---------------------------------------------------------------------------

const QUALIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'reply', 'requirements', 'aiSummary', 'score', 'readyForMatches', 'suggestWarm', 'leadName',
    'interestedPropertyIds', 'readyToSchedule', 'availabilityText', 'proposedSlotISO', 'proposedSlotText',
  ],
  properties: {
    reply: { type: 'string', description: 'Next WhatsApp message to the lead. Warm, concise (under 60 words), Hinglish ok, max ONE question.' },
    requirements: REQUIREMENTS_SCHEMA,
    aiSummary: { type: 'string', description: 'Running 1-2 sentence summary of who this lead is and what they want' },
    score: { type: 'integer', description: '0-100 qualification score. 70+ = clearly serious: budget+area known, near-term timeline' },
    readyForMatches: { type: 'boolean', description: 'true when listingFor + budget + (bhk or type) + locality are known AND no matches sent yet this round' },
    suggestWarm: { type: 'boolean', description: 'true when lead is engaged AND qualified (score>=70)' },
    leadName: { type: ['string', 'null'], description: 'Lead\'s name if they mentioned it, else null' },
    interestedPropertyIds: { type: 'array', items: { type: 'string' }, description: 'From the SENT MATCHES list, the property ids the lead expressed interest in. Empty if none yet.' },
    readyToSchedule: { type: 'boolean', description: 'true ONLY when the lead likes one or more sent properties AND wants to visit/see them' },
    availabilityText: { type: ['string', 'null'], description: 'The lead\'s stated availability (e.g. "Saturday evening", "kal ke baad anytime"), else null' },
    proposedSlotISO: { type: ['string', 'null'], description: 'A concrete tentative visit datetime in ISO-8601 you propose. MUST be tomorrow or later (never today). Null until you have their availability.' },
    proposedSlotText: { type: ['string', 'null'], description: 'Human-friendly version of the proposed slot, e.g. "kal (Sat) shaam 5 baje".' },
  },
}

const QUALIFIER_SYSTEM = `You are Saarthi (सारथी), an AI real-estate assistant chatting with property seekers on WhatsApp for a brokerage in Indore, India.

Stages — move through them naturally, ONE question per message, under 60 words, mirror the lead's language (Hindi/Hinglish/English):
1. QUALIFY: buy or rent → type/BHK → budget → localities → timeline. When listingFor + budget + (bhk or type) + a locality are known, set readyForMatches=true (the system sends matching property links — never invent properties).
2. REACT: after matches are sent (history shows [MATCHES SENT...]), ask which they like / offer more. Put the ids they like into interestedPropertyIds (use the SENT MATCHES id list given to you).
3. SCHEDULE: when they like a property and want to visit, set readyToSchedule=true.
   - First get their availability → availabilityText.
   - Then propose ONE concrete tentative slot: proposedSlotISO + proposedSlotText. CRITICAL: the slot must be TOMORROW OR LATER — never today (the broker may not be free same-day). Use the TODAY date given to you to compute this. Frame it as tentative: "main aapke liye <slot> tentatively rakh raha hoon, broker confirm karke final karega."
   - Tell them our team will confirm the final time with the property owner/broker.
4. Never discuss commission/legal/price negotiation — say the broker will help.
Always merge new info into the FULL requirements object (carry previous values unless corrected). Only set proposedSlotISO once you actually have their availability.

TONE & FORMATTING: Write like a warm, real human texting on WhatsApp. Plain sentences only. NEVER use markdown, asterisks (*), underscores, bold, italics, bullet characters, numbered headings, or emoji-spam. At most one friendly emoji per message. Keep it short, natural and easy to read.`

export async function qualifierTurn(args: {
  history: { direction: string; content: string }[]
  incoming: string
  requirements: LeadRequirements
  leadName?: string | null
  matchesSentCount: number
  sentMatches?: { id: string; title: string }[]
  todayLabel?: string
  tomorrowISO?: string
}): Promise<QualifierResult> {
  const { history, incoming, requirements, leadName, matchesSentCount, sentMatches = [], todayLabel, tomorrowISO } = args

  if (!aiEnabled()) {
    const h = heuristicQualifierTurn(history, incoming, requirements)
    const filled = [h.requirements.listingFor, h.requirements.budgetMax, h.requirements.bhk ?? h.requirements.type, h.requirements.localities?.length].filter(Boolean).length
    const wantsVisit = /visit|dekhna|dikhao|dekh|interested|pasand|achhi|like|schedule|book/i.test(incoming)
    const gaveAvailability = /\b(today|kal|tomorrow|saturday|sunday|sat|sun|monday|tuesday|wednesday|thursday|friday|evening|morning|shaam|subah|\d\s*(am|pm)|baje|weekend|anytime|free)\b/i.test(incoming)
    // Did the bot just ask for availability? Then this turn's reply is the answer,
    // even without a fresh "visit" keyword.
    const lastBot = [...history].reverse().find((m) => m.direction === 'OUTBOUND')?.content ?? ''
    const askedAvailability = /kab visit|kab free|availability|aaj nahi/i.test(lastBot)
    const schedulingMode = matchesSentCount > 0 && (wantsVisit || askedAvailability)

    let proposedSlotISO: string | null = null
    let proposedSlotText: string | null = null
    let reply = h.reply
    if (schedulingMode && !gaveAvailability) {
      reply = 'Badhiya! 🙌 Aap kab visit kar sakte hain? (kal ya uske baad koi bhi din/time — aaj nahi, kyunki broker ki availability confirm karni hoti hai)'
    } else if (schedulingMode && gaveAvailability && tomorrowISO) {
      proposedSlotISO = tomorrowISO
      proposedSlotText = 'kal (tentative)'
      reply = `Perfect! Main *${proposedSlotText}* tentatively rakh raha hoon. Humari team property owner/broker se confirm karke aapko final time bata degi. 🏡`
    }
    return {
      reply,
      requirements: h.requirements,
      aiSummary: `Heuristic mode. Requirements: ${JSON.stringify(h.requirements)}`,
      score: Math.min(95, filled * 20 + (schedulingMode ? 25 : 0)),
      readyForMatches: h.readyForMatches && matchesSentCount === 0,
      suggestWarm: schedulingMode,
      leadName: leadName ?? null,
      interestedPropertyIds: schedulingMode && sentMatches[0] ? [sentMatches[0].id] : [],
      readyToSchedule: Boolean(proposedSlotISO),
      availabilityText: gaveAvailability ? incoming.slice(0, 200) : null,
      proposedSlotISO,
      proposedSlotText,
    }
  }

  const transcript = history
    .slice(-30)
    .map((m) => `${m.direction === 'INBOUND' ? 'Lead' : 'Saarthi'}: ${m.content}`)
    .join('\n')

  const fallbackResult = (): QualifierResult => {
    const h = heuristicQualifierTurn(history, incoming, requirements)
    return {
      reply: h.reply, requirements: h.requirements, aiSummary: 'AI unavailable — heuristic qualification.',
      score: 40, readyForMatches: h.readyForMatches && matchesSentCount === 0, suggestWarm: false, leadName: leadName ?? null,
      interestedPropertyIds: [], readyToSchedule: false, availabilityText: null, proposedSlotISO: null, proposedSlotText: null,
    }
  }

  try {
    return await structured<QualifierResult>(
      QUALIFIER_SYSTEM,
      [
        `TODAY is ${todayLabel ?? 'unknown'}. The earliest allowed visit slot is TOMORROW (${tomorrowISO ?? 'next day'}) — never propose today.`,
        leadName ? `Lead name: ${leadName}` : 'Lead name unknown.',
        `Known requirements: ${JSON.stringify(requirements)}`,
        `Property links already sent: ${matchesSentCount}`,
        sentMatches.length ? `SENT MATCHES (id — title):\n${sentMatches.map((m) => `${m.id} — ${m.title}`).join('\n')}` : 'No specific matches sent yet.',
        `Conversation so far:\n${transcript || '(none — this is the first message)'}`,
        `New message from lead: "${incoming}"`,
        'Respond with the structured result.',
      ].join('\n\n'),
      QUALIFIER_SCHEMA,
      2000
    )
  } catch (err) {
    console.error('[ai] qualifierTurn failed, falling back to heuristics:', err)
    return fallbackResult()
  }
}

// ---------------------------------------------------------------------------
// 4. Website chat — same brain, web persona; can reference live inventory.
// ---------------------------------------------------------------------------

const WEBCHAT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'propertyIds', 'capturedName', 'capturedPhone'],
  properties: {
    reply: { type: 'string', description: 'Chat reply. Concise, helpful, markdown-free. Under 90 words.' },
    propertyIds: { type: 'array', items: { type: 'string' }, description: 'IDs of provided properties worth showing as cards (max 3), else empty' },
    capturedName: { type: ['string', 'null'] },
    capturedPhone: { type: ['string', 'null'], description: 'Digits only with country code if the visitor shared a phone number' },
  },
}

export async function webChatTurn(args: {
  history: { role: 'user' | 'assistant'; content: string }[]
  incoming: string
  inventoryContext: string // compact JSON list of candidate properties
}): Promise<{ reply: string; propertyIds: string[]; capturedName: string | null; capturedPhone: string | null }> {
  const { history, incoming, inventoryContext } = args
  const fallback = {
    reply:
      'Main aapki property search mein madad kar sakta hoon! Browse our listings page, or WhatsApp us at +91 98260 78459 and our AI assistant will find matches for you.',
    propertyIds: [] as string[],
    capturedName: null,
    capturedPhone: null,
  }
  if (!aiEnabled()) return fallback
  try {
    const transcript = history.slice(-16).map((m) => `${m.role === 'user' ? 'Visitor' : 'Saarthi'}: ${m.content}`).join('\n')
    return await structured(
      `You are Saarthi's website assistant for an Indore real-estate platform. Help visitors find properties from the LIVE INVENTORY provided, answer questions about the platform (free for buyers, brokers pay on success, WhatsApp-first: +91 98260 78459), and gently collect name + phone so a human can follow up. Never invent properties — only reference inventory by id. If nothing matches, say so honestly and offer to take their requirements.`,
      `LIVE INVENTORY (JSON):\n${inventoryContext}\n\nConversation:\n${transcript}\n\nVisitor: "${incoming}"`,
      WEBCHAT_SCHEMA,
      1500
    )
  } catch (err) {
    console.error('[ai] webChatTurn failed:', err)
    return fallback
  }
}
