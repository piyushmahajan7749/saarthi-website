// Regex/rule-based fallbacks used when ANTHROPIC_API_KEY is not configured,
// and as a safety net when AI calls fail. Tuned for Indian real-estate
// WhatsApp-speak: "2bhk", "75 lakh", "1.2cr", "Vijay Nagar", etc.

import type { ParsedListing, PropertyFilters, PropertyType, LeadRequirements } from '@/types'

const KNOWN_LOCALITIES = [
  'Vijay Nagar', 'Scheme 54', 'Scheme 78', 'Scheme 140', 'Bhawarkua', 'Palasia', 'New Palasia',
  'Rau', 'Mhow', 'Khandwa Road', 'AB Road', 'Bypass', 'Nipania', 'Bicholi Mardana', 'Kanadia Road',
  'Mahalakshmi Nagar', 'Sukhliya', 'Banganga', 'Rajendra Nagar', 'Annapurna', 'Sudama Nagar',
  'Silicon City', 'Pipliyahana', 'Bengali Square', 'Tilak Nagar', 'Geeta Bhawan', 'LIG', 'MIG',
  'Saket', 'Old Palasia', 'Race Course Road', 'South Tukoganj', 'Manorama Ganj',
]

// ---------- price ----------

// "75 lakh"/"75L"/"₹75,00,000"/"1.2 cr" -> rupees
export function parsePriceToken(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, '')
  let m = t.match(/(\d+(?:\.\d+)?)\s*(cr|crore|crores)/)
  if (m) return Math.round(parseFloat(m[1]) * 1_00_00_000)
  m = t.match(/(\d+(?:\.\d+)?)\s*(l|lac|lacs|lakh|lakhs)\b/)
  if (m) return Math.round(parseFloat(m[1]) * 1_00_000)
  m = t.match(/(?:₹|rs\.?|inr)\s*(\d{4,})/)
  if (m) return parseInt(m[1], 10)
  m = t.match(/(\d+(?:\.\d+)?)\s*k\b/)
  if (m) return Math.round(parseFloat(m[1]) * 1000)
  return null
}

function detectType(t: string): PropertyType {
  if (/\bplot|land|farm\b/.test(t)) return 'PLOT'
  if (/\bvilla\b/.test(t)) return 'VILLA'
  if (/\bbungalow|kothi|independent house|row house|house\b/.test(t)) return 'HOUSE'
  if (/\boffice\b/.test(t)) return 'OFFICE'
  if (/\bshop|showroom\b/.test(t)) return 'SHOP'
  if (/\bcommercial|warehouse|godown\b/.test(t)) return 'COMMERCIAL'
  if (/\bpg\b|paying guest|co-?living/.test(t)) return 'PG'
  return 'FLAT'
}

function detectLocality(text: string): string {
  for (const loc of KNOWN_LOCALITIES) {
    if (text.toLowerCase().includes(loc.toLowerCase())) return loc
  }
  const m = text.match(/(?:in|at|near)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})/)
  return m ? m[1] : ''
}

// Parse a single free-text listing blob (one WhatsApp message / form blob).
export function heuristicParseListing(
  raw: string,
  meta?: { postedByName?: string | null; mediaCount?: number }
): ParsedListing {
  const t = raw.toLowerCase()
  const bhkMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:bhk|bed|bedroom)/)
  const bhk = bhkMatch ? Math.round(parseFloat(bhkMatch[1])) : null
  const type = detectType(t)
  const listingFor = /\brent|lease|rental|per month|\/month|\bpm\b/.test(t) ? 'RENT' : 'SALE'
  const price = parsePriceToken(raw)
  const areaMatch = t.match(/(\d{3,5})\s*(?:sq\.?\s*ft|sqft|square feet)/)
  const area = areaMatch ? parseInt(areaMatch[1], 10) : null
  const locality = detectLocality(raw)
  const phoneMatch = raw.match(/(?:\+?91[\s-]?)?([6-9]\d{9})\b/)
  const furnished = /semi[- ]?furnished/.test(t) ? 'SEMI_FURNISHED' : /furnished/.test(t) ? 'FURNISHED' : null

  const missing: string[] = []
  if (!price) missing.push('price')
  if (!locality) missing.push('locality')
  if (!bhk && type === 'FLAT') missing.push('BHK')

  const titleBits = [bhk ? `${bhk} BHK` : null, typeTitle(type), listingFor === 'RENT' ? 'for Rent' : 'for Sale', locality ? `in ${locality}` : null]
  return {
    title: titleBits.filter(Boolean).join(' '),
    type,
    listingFor,
    bhk,
    price,
    area,
    areaUnit: 'sqft',
    furnishing: furnished,
    locality,
    city: 'Indore',
    address: '',
    amenities: [],
    ownerName: null,
    ownerPhone: phoneMatch ? `91${phoneMatch[1]}` : null,
    postedByName: meta?.postedByName ?? null,
    mediaCount: meta?.mediaCount ?? 0,
    description: raw.trim(),
    aiSummary: null,
    aiNotes: missing.length ? `Parsed without AI (heuristic mode). Missing: ${missing.join(', ')}.` : 'Parsed without AI (heuristic mode).',
    aiConfidence: missing.length ? 0.4 : 0.6,
    rawText: raw.trim(),
  }
}

// Split a WhatsApp group export into listing blocks WITH sender attribution and
// media counts. Recognises "12/05/25, 10:31 - Rajan Verma: <msg>" export lines
// and "<Media omitted>" / "IMG-x.jpg (file attached)" placeholders.
export interface ChatBlock {
  text: string
  sender: string | null
  mediaCount: number
}

const MEDIA_RE = /<\s*media omitted\s*>|\(file attached\)|IMG-\d|VID-\d|\.(jpg|jpeg|png|mp4|webp)\b/gi

export function splitWhatsAppChatBlocks(raw: string): ChatBlock[] {
  const exportLine = /^\[?(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\]?\s*[-–]\s*([^:]{1,40}):\s*(.*)$/i
  const lines = raw.split('\n')
  const looksLikeExport = lines.some((l) => exportLine.test(l))

  type Acc = { sender: string | null; parts: string[] }
  const blocks: Acc[] = []
  let cur: Acc | null = null

  if (looksLikeExport) {
    for (const line of lines) {
      const m = line.match(exportLine)
      if (m) {
        if (cur) blocks.push(cur)
        cur = { sender: m[2].trim(), parts: [m[3] ?? ''] }
      } else if (cur) {
        cur.parts.push(line)
      }
    }
    if (cur) blocks.push(cur)
  } else {
    for (const b of raw.split(/\n\s*\n/)) blocks.push({ sender: null, parts: [b] })
  }

  return blocks
    .map((b) => {
      const text = b.parts.join('\n').trim()
      const mediaCount = (text.match(MEDIA_RE) || []).length
      return { text, sender: b.sender, mediaCount }
    })
    .filter((b) => b.text.length > 20)
    .filter((b) => /\d/.test(b.text) || b.mediaCount > 0)
    .filter((b) => !/^(ok|okay|thanks|thank you|good morning|gm|👍|🙏|haan|nahi|yes|no)\b/i.test(b.text))
}

function typeTitle(type: PropertyType): string {
  const map: Record<PropertyType, string> = {
    FLAT: 'Flat', HOUSE: 'House', VILLA: 'Villa', PLOT: 'Plot', COMMERCIAL: 'Commercial Space',
    OFFICE: 'Office', SHOP: 'Shop', PG: 'PG',
  }
  return map[type]
}

// Split a pasted WhatsApp chat export into candidate listing messages.
// Handles "12/05/2025, 10:31 - Name: message" export format and blank-line
// separated blobs.
export function splitWhatsAppChat(raw: string): string[] {
  const exportLine = /^\[?\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4},?\s+\d{1,2}:\d{2}/
  const lines = raw.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  const looksLikeExport = lines.some((l) => exportLine.test(l))

  if (looksLikeExport) {
    for (const line of lines) {
      if (exportLine.test(line)) {
        if (current.length) blocks.push(current.join('\n'))
        // strip "date, time - Sender: " prefix
        current = [line.replace(/^\[?[^-\]]+[-\]]\s*(?:[^:]{1,40}:\s*)?/, '')]
      } else {
        current.push(line)
      }
    }
    if (current.length) blocks.push(current.join('\n'))
  } else {
    for (const block of raw.split(/\n\s*\n/)) blocks.push(block)
  }

  return blocks
    .map((b) => b.trim())
    .filter((b) => b.length > 25)
    .filter((b) => /\d/.test(b)) // a listing has at least one number
    .filter((b) => !/^(ok|okay|thanks|thank you|good morning|gm|👍|🙏)/i.test(b))
}

// NL search query -> structured filters ("3bhk under 80 lakh in vijay nagar for rent")
export function heuristicParseSearch(q: string): PropertyFilters {
  const t = q.toLowerCase()
  const filters: PropertyFilters = {}
  const bhkM = t.match(/(\d+)\s*bhk/)
  if (bhkM) filters.bhk = parseInt(bhkM[1], 10)
  if (/\brent|rental|lease\b/.test(t)) filters.listingFor = 'RENT'
  if (/\bbuy|sale|purchase\b/.test(t)) filters.listingFor = 'SALE'
  const type = detectType(t)
  if (type !== 'FLAT' || /\bflat|apartment\b/.test(t)) filters.type = type

  const underM = t.match(/(?:under|below|upto|up to|max|within|<)\s*₹?\s*([\d.]+\s*(?:cr|crore|l|lac|lakh|lakhs|k)?)/)
  if (underM) {
    const p = parsePriceToken(underM[1])
    if (p) filters.priceMax = p
  }
  const overM = t.match(/(?:above|over|min|>)\s*₹?\s*([\d.]+\s*(?:cr|crore|l|lac|lakh|lakhs|k)?)/)
  if (overM) {
    const p = parsePriceToken(overM[1])
    if (p) filters.priceMin = p
  }
  const locality = detectLocality(q)
  if (locality) filters.locality = locality

  // remainder as free text if nothing structured matched
  if (!bhkM && !filters.listingFor && !locality && !underM && !overM) filters.q = q
  return filters
}

// Rule-based qualifier fallback: asks for missing requirement fields in order.
export function heuristicQualifierTurn(
  history: { direction: string; content: string }[],
  incoming: string,
  existing: LeadRequirements
): { reply: string; requirements: LeadRequirements; readyForMatches: boolean } {
  const req: LeadRequirements = { ...existing }
  const t = incoming.toLowerCase()

  if (/\brent\b/.test(t)) req.listingFor = 'RENT'
  if (/\bbuy|purchase|sale\b/.test(t)) req.listingFor = 'SALE'
  const bhkM = t.match(/(\d+)\s*bhk/)
  if (bhkM) req.bhk = parseInt(bhkM[1], 10)
  const price = parsePriceToken(incoming)
  if (price) req.budgetMax = price
  const loc = detectLocality(incoming)
  if (loc) req.localities = Array.from(new Set([...(req.localities ?? []), loc]))
  const typeGuess = detectType(t)
  if (typeGuess !== 'FLAT' || /\bflat|apartment\b/.test(t)) req.type = typeGuess

  let reply: string
  let ready = false
  if (!req.listingFor) {
    reply = 'Namaste! Main Saarthi hoon 🙏 Aap property *buy* karna chahte hain ya *rent* par dhoondh rahe hain?'
  } else if (!req.bhk && (req.type === 'FLAT' || !req.type)) {
    reply = 'Great! Kitne BHK chahiye? (e.g. 2 BHK / 3 BHK)'
  } else if (!req.budgetMax) {
    reply = `Perfect. Aapka budget kya hai? (e.g. ${req.listingFor === 'RENT' ? '₹15,000/month' : '₹60 lakh'})`
  } else if (!req.localities?.length) {
    reply = 'Kaunsa area prefer karenge? (e.g. Vijay Nagar, Nipania, Mahalakshmi Nagar)'
  } else {
    reply = 'Shukriya! Main aapke liye best matching properties dhoondh raha hoon... 🔍'
    ready = true
  }
  return { reply, requirements: req, readyForMatches: ready }
}
