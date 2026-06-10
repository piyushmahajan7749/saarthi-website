// All Claude API usage lives here. Every function degrades gracefully to the
// heuristic engine in src/lib/heuristics.ts when ANTHROPIC_API_KEY is unset or
// a call fails — the platform must keep working without AI.
import Anthropic from '@anthropic-ai/sdk'
import type { ParsedListing, PropertyFilters, LeadRequirements, QualifierResult } from '@/types'
import {
  heuristicParseListing,
  heuristicParseSearch,
  heuristicQualifierTurn,
  splitWhatsAppChat,
} from './heuristics'

const MODEL = process.env.AI_MODEL || 'claude-opus-4-8'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Structured-output helper: one user prompt -> JSON matching `schema`.
async function structured<T>(system: string, prompt: string, schema: Record<string, unknown>, maxTokens = 16000): Promise<T> {
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
    'city', 'address', 'amenities', 'ownerName', 'ownerPhone', 'description', 'aiSummary',
    'aiNotes', 'aiConfidence', 'rawText',
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
    ownerName: { type: ['string', 'null'] },
    ownerPhone: { type: ['string', 'null'], description: 'Digits only with country code, e.g. 919826078459' },
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
Extract EVERY distinct property listing from the input into structured JSON.
Rules:
- Convert Indian price formats: "75L"/"75 lakh" = 7500000, "1.2cr" = 12000000. Rent amounts are per month.
- Hinglish is common ("makaan", "bechna hai", "kiraya") — interpret it.
- Skip chatter that is not a property listing (greetings, questions, requirement posts like "chahiye"/"required"/"looking for").
- If a message is a REQUIREMENT (someone looking to buy/rent) and not an inventory listing, skip it.
- aiNotes must flag: missing price/locality/contact, suspicious pricing for the locality, anything an admin should verify.
- Never invent data. Use null for unknown fields. Keep rawText verbatim per listing.`

export async function parseListingsFromText(raw: string): Promise<ParsedListing[]> {
  if (!aiEnabled()) {
    return splitWhatsAppChat(raw).map(heuristicParseListing)
  }
  try {
    const { listings } = await structured<{ listings: ParsedListing[] }>(
      PARSER_SYSTEM,
      `Extract all property listings from this WhatsApp chat / text:\n\n<input>\n${raw.slice(0, 60000)}\n</input>`,
      LISTINGS_SCHEMA
    )
    return listings
  } catch (err) {
    console.error('[ai] parseListingsFromText failed, falling back to heuristics:', err)
    return splitWhatsAppChat(raw).map(heuristicParseListing)
  }
}

export async function parseListingsFromRows(rows: Record<string, unknown>[]): Promise<ParsedListing[]> {
  const rowsText = rows.map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`).join('\n')
  if (!aiEnabled()) {
    return rows.map((r) => heuristicParseListing(Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')))
  }
  try {
    const { listings } = await structured<{ listings: ParsedListing[] }>(
      PARSER_SYSTEM,
      `Each row below is one property from an Excel sheet (column names vary by broker — map them sensibly). Extract one listing per row:\n\n${rowsText.slice(0, 60000)}`,
      LISTINGS_SCHEMA
    )
    return listings
  } catch (err) {
    console.error('[ai] parseListingsFromRows failed, falling back to heuristics:', err)
    return rows.map((r) => heuristicParseListing(Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')))
  }
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
// 3. Lead qualifier bot (WhatsApp + website chat)
// ---------------------------------------------------------------------------

const QUALIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'requirements', 'aiSummary', 'score', 'readyForMatches', 'suggestWarm', 'leadName'],
  properties: {
    reply: { type: 'string', description: 'Next WhatsApp message to the lead. Warm, concise (under 60 words), Hinglish ok, max ONE question.' },
    requirements: {
      type: 'object',
      additionalProperties: false,
      required: ['listingFor', 'type', 'bhk', 'budgetMin', 'budgetMax', 'localities', 'city', 'timeline', 'purpose', 'notes'],
      properties: {
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
      },
    },
    aiSummary: { type: 'string', description: 'Running 1-2 sentence summary of who this lead is and what they want' },
    score: { type: 'integer', description: '0-100 qualification score. 70+ = clearly serious: budget+area known, near-term timeline' },
    readyForMatches: { type: 'boolean', description: 'true when listingFor + budget + (bhk or type) + locality are known' },
    suggestWarm: { type: 'boolean', description: 'true when lead is engaged AND qualified (score>=70): asked for visits, responded to specific properties, near-term timeline' },
    leadName: { type: ['string', 'null'], description: 'Lead\'s name if they mentioned it, else null' },
  },
}

const QUALIFIER_SYSTEM = `You are Saarthi (सारथी), an AI real-estate assistant chatting with property seekers on WhatsApp for a brokerage in Indore, India.

Your job — qualify the lead WITHOUT being pushy:
1. Understand: buy or rent → property type/BHK → budget → preferred localities → timeline.
2. Ask exactly ONE question per message. Keep messages under 60 words, friendly, professional. Mirror the lead's language (Hindi/Hinglish/English).
3. Once you know listingFor + budget + (bhk or type) + at least one locality, set readyForMatches=true — the system will then send matching property links automatically. Don't invent properties yourself.
4. After matches were sent (visible in history as [MATCHES SENT...]), help with follow-ups: more options, visit requests, specific questions. If they want a visit or are clearly serious, set suggestWarm=true — a human broker will then call them.
5. Never discuss commission/legal advice; say the broker will help with that.
6. Always merge new info into the FULL requirements object (carry over previous values unless corrected).`

export async function qualifierTurn(args: {
  history: { direction: string; content: string }[]
  incoming: string
  requirements: LeadRequirements
  leadName?: string | null
  matchesSentCount: number
}): Promise<QualifierResult> {
  const { history, incoming, requirements, leadName, matchesSentCount } = args

  if (!aiEnabled()) {
    const h = heuristicQualifierTurn(history, incoming, requirements)
    const filled = [h.requirements.listingFor, h.requirements.budgetMax, h.requirements.bhk ?? h.requirements.type, h.requirements.localities?.length].filter(Boolean).length
    const wantsVisit = /visit|dekhna|dikha|interested|pasand|call me|schedule/i.test(incoming)
    return {
      reply: h.reply,
      requirements: h.requirements,
      aiSummary: `Heuristic mode. Requirements so far: ${JSON.stringify(h.requirements)}`,
      score: Math.min(95, filled * 20 + (wantsVisit ? 20 : 0)),
      readyForMatches: h.readyForMatches,
      suggestWarm: matchesSentCount > 0 && wantsVisit,
      leadName: leadName ?? null,
    }
  }

  const transcript = history
    .slice(-30)
    .map((m) => `${m.direction === 'INBOUND' ? 'Lead' : 'Saarthi'}: ${m.content}`)
    .join('\n')

  try {
    return await structured<QualifierResult>(
      QUALIFIER_SYSTEM,
      [
        leadName ? `Lead name: ${leadName}` : 'Lead name unknown.',
        `Known requirements: ${JSON.stringify(requirements)}`,
        `Property links already sent to this lead: ${matchesSentCount}`,
        `Conversation so far:\n${transcript || '(none — this is the first message)'}`,
        `New message from lead: "${incoming}"`,
        'Respond with the structured result.',
      ].join('\n\n'),
      QUALIFIER_SCHEMA,
      2000
    )
  } catch (err) {
    console.error('[ai] qualifierTurn failed, falling back to heuristics:', err)
    const h = heuristicQualifierTurn(history, incoming, requirements)
    return {
      reply: h.reply,
      requirements: h.requirements,
      aiSummary: 'AI unavailable — heuristic qualification.',
      score: 40,
      readyForMatches: h.readyForMatches,
      suggestWarm: false,
      leadName: leadName ?? null,
    }
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
