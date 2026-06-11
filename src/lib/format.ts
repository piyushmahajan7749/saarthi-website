// Indian real-estate formatting helpers, safe in both server and client code.

// 7500000 -> "₹75 L", 12500000 -> "₹1.25 Cr", 18000 -> "₹18,000"
export function formatPrice(price: number | null | undefined, listingFor?: string): string {
  if (price == null || isNaN(price)) return 'Price on request'
  let label: string
  if (price >= 1_00_00_000) {
    const cr = price / 1_00_00_000
    label = `₹${trimZeros(cr.toFixed(2))} Cr`
  } else if (price >= 1_00_000) {
    const l = price / 1_00_000
    label = `₹${trimZeros(l.toFixed(1))} L`
  } else {
    label = `₹${price.toLocaleString('en-IN')}`
  }
  return listingFor === 'RENT' ? `${label}/mo` : label
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, '')
}

export function formatArea(area: number | null | undefined, unit = 'sqft'): string {
  if (area == null || isNaN(area)) return ''
  return `${area.toLocaleString('en-IN')} ${unit}`
}

export function propertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    FLAT: 'Flat / Apartment', HOUSE: 'Independent House', VILLA: 'Villa', PLOT: 'Plot / Land',
    COMMERCIAL: 'Commercial', OFFICE: 'Office Space', SHOP: 'Shop / Showroom', PG: 'PG / Co-living',
  }
  return map[type] ?? type
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft', PENDING_REVIEW: 'Pending review', ACTIVE: 'Live', SOLD: 'Sold', RENTED: 'Rented', ARCHIVED: 'Archived',
    NEW: 'New', QUALIFYING: 'Qualifying', WARM: 'Warm', COLD: 'Cold', VISIT_SCHEDULED: 'Visit scheduled', CLOSED: 'Closed', LOST: 'Lost',
  }
  return map[status] ?? status
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

// "919826078459" -> "+91 98260 78459"
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  // Placeholder phones used before a real number is captured.
  if (phone.startsWith('manual:') || phone.startsWith('web:')) return 'No phone yet'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
  return phone
}

export function waLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '')
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${q}`
}
