// Public "Post Property" intake — creates an IntakeBatch + PENDING_REVIEW
// Property from the website form. AI enrichment is best-effort and never
// blocks the submission.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { aiEnabled, parseListingsFromText } from '@/lib/ai'
import { formatPhone, propertyTypeLabel } from '@/lib/format'
import { PROPERTY_TYPES, LISTING_FOR, FURNISHING } from '@/types'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 20_000 // basic anti-abuse: webform payloads are small
const NO_BHK_TYPES = ['PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP']

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

function str(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  let raw: string
  try {
    raw = await req.text()
  } catch {
    return bad('Could not read request body')
  }
  if (raw.length > MAX_BODY_BYTES) return bad('Request body too large')

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return bad('Invalid JSON body')
  }

  // ---- validate ----
  const ownerName = str(body.ownerName, 80)
  if (!ownerName) return bad('Your name is required')

  let phoneDigits = str(body.ownerPhone, 20).replace(/\D/g, '')
  if (phoneDigits.length === 12 && phoneDigits.startsWith('91')) phoneDigits = phoneDigits.slice(2)
  if (phoneDigits.length !== 10) return bad('A valid 10-digit mobile number is required')
  const ownerPhone = `91${phoneDigits}`

  const listingFor = str(body.listingFor, 10)
  if (!(LISTING_FOR as readonly string[]).includes(listingFor)) return bad('Invalid listing type')

  const type = str(body.type, 20)
  if (!(PROPERTY_TYPES as readonly string[]).includes(type)) return bad('Invalid property type')

  const price = num(body.price)
  if (price == null || price <= 0) return bad('A valid price is required')

  const locality = str(body.locality, 120)
  if (!locality) return bad('Locality is required')

  const bhkRaw = num(body.bhk)
  const bhk = NO_BHK_TYPES.includes(type) || bhkRaw == null ? null : Math.max(1, Math.min(20, Math.round(bhkRaw)))

  const areaRaw = num(body.area)
  const area = areaRaw != null && areaRaw > 0 ? areaRaw : null
  const areaUnit = ['sqft', 'sqyd', 'acre'].includes(str(body.areaUnit, 10)) ? str(body.areaUnit, 10) : 'sqft'

  const furnishingRaw = str(body.furnishing, 20)
  const furnishing = (FURNISHING as readonly string[]).includes(furnishingRaw) ? furnishingRaw : null

  const amenities = Array.isArray(body.amenities)
    ? body.amenities.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).map((a) => a.trim().slice(0, 50)).slice(0, 20)
    : []

  const address = str(body.address, 200)
  let description = str(body.description, 2000)

  // ---- persist ----
  const batch = await db.intakeBatch.create({
    data: {
      source: 'WEBFORM',
      rawContent: JSON.stringify(body),
      status: 'COMMITTED',
      itemCount: 1,
    },
  })

  const title = `${bhk ? `${bhk} BHK ` : ''}${propertyTypeLabel(type)} for ${listingFor === 'RENT' ? 'Rent' : 'Sale'} in ${locality}`

  // AI enrichment — best effort, never blocks the submission.
  let aiSummary: string | null = null
  let aiNotes: string | null = null
  let aiConfidence: number | null = null
  if (aiEnabled()) {
    try {
      const formText = [
        `Property listing submitted via website form:`,
        `Owner: ${ownerName}, phone ${ownerPhone}`,
        `Wants to: ${listingFor === 'RENT' ? 'rent out' : 'sell'}`,
        `Type: ${propertyTypeLabel(type)}${bhk ? `, ${bhk} BHK` : ''}`,
        `${listingFor === 'RENT' ? 'Rent' : 'Price'}: Rs ${price}${listingFor === 'RENT' ? ' per month' : ''}`,
        area ? `Area: ${area} ${areaUnit}` : '',
        `Locality: ${locality}`,
        address ? `Address: ${address}` : '',
        furnishing ? `Furnishing: ${furnishing}` : '',
        amenities.length ? `Amenities: ${amenities.join(', ')}` : '',
        description ? `Owner's description: ${description}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const [parsed] = await parseListingsFromText(formText)
      if (parsed) {
        aiSummary = parsed.aiSummary
        aiNotes = parsed.aiNotes
        aiConfidence = parsed.aiConfidence
        // Prefer the AI-polished description when it actually has substance.
        if (parsed.description && parsed.description.trim().length > description.length) {
          description = parsed.description.trim().slice(0, 2000)
        }
      }
    } catch (err) {
      console.error('[webform] AI enrichment failed (non-fatal):', err)
    }
  }

  const property = await db.property.create({
    data: {
      title,
      description,
      type,
      listingFor,
      bhk,
      price,
      area,
      areaUnit,
      furnishing,
      locality,
      address,
      amenities: JSON.stringify(amenities),
      status: 'PENDING_REVIEW',
      source: 'WEBFORM',
      ownerName,
      ownerPhone,
      rawText: JSON.stringify(body),
      aiSummary,
      aiNotes,
      aiConfidence,
      intakeBatchId: batch.id,
    },
  })

  await db.activity.create({
    data: {
      type: 'LISTING_CREATED',
      description: `Web form submission from ${ownerName} (${formatPhone(ownerPhone)}) — pending review`,
      propertyId: property.id,
    },
  })

  return NextResponse.json({ ok: true, id: property.id })
}
