// Shared domain types + constants. Prisma stores enums as strings (SQLite);
// these are the canonical values used across UI, API and AI layers.

export const PROPERTY_TYPES = ['FLAT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL', 'OFFICE', 'SHOP', 'PG'] as const
export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const LISTING_FOR = ['SALE', 'RENT'] as const
export type ListingFor = (typeof LISTING_FOR)[number]

export const PROPERTY_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SOLD', 'RENTED', 'ARCHIVED'] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

export const PROPERTY_SOURCES = ['WHATSAPP', 'EXCEL', 'WEBFORM', 'MANUAL'] as const
export type PropertySource = (typeof PROPERTY_SOURCES)[number]

export const LEAD_STATUSES = ['NEW', 'QUALIFYING', 'WARM', 'COLD', 'VISIT_SCHEDULED', 'CLOSED', 'LOST'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const FURNISHING = ['UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED'] as const

// What the AI parser extracts from a WhatsApp message / Excel row / web form.
export interface ParsedListing {
  title: string
  type: PropertyType
  listingFor: ListingFor
  bhk: number | null
  price: number | null // absolute rupees
  area: number | null
  areaUnit: string
  furnishing: string | null
  locality: string
  city: string
  address: string
  amenities: string[]
  ownerName: string | null
  ownerPhone: string | null
  description: string
  aiSummary: string | null
  aiNotes: string | null // missing fields, red flags, price opinion
  aiConfidence: number // 0..1
  rawText: string
}

// What the qualifier bot extracts from a lead conversation.
export interface LeadRequirements {
  listingFor?: ListingFor
  type?: PropertyType
  bhk?: number
  budgetMin?: number // rupees
  budgetMax?: number
  localities?: string[]
  city?: string
  timeline?: string // "asap" | "1-3 months" | "exploring"
  purpose?: string // self-use | investment
  notes?: string
}

// Structured filters for /listings search (NL query → this).
export interface PropertyFilters {
  q?: string // free-text remainder
  type?: PropertyType
  listingFor?: ListingFor
  bhk?: number
  bhkMin?: number
  priceMin?: number
  priceMax?: number
  locality?: string
  city?: string
  status?: PropertyStatus
  featured?: boolean
  sort?: 'newest' | 'price_asc' | 'price_desc'
  page?: number
  pageSize?: number
}

// Qualifier bot turn result (AI or rule-based).
export interface QualifierResult {
  reply: string // message to send back to the lead
  requirements: LeadRequirements // merged/updated requirements
  aiSummary: string // one-paragraph summary of the lead so far
  score: number // 0..100 — how qualified
  readyForMatches: boolean // bot has enough info to send property links
  suggestWarm: boolean // bot believes lead is warm (auto-promote)
  leadName?: string | null // name if the lead mentioned it
}

export interface SessionUser {
  id: string
  name: string
  phone: string
  role: 'ADMIN' | 'BROKER'
}
