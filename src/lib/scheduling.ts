// Visit-slot helpers. Core rule (step 5): a visit is NEVER proposed for the
// same day the lead asks — the listing broker's availability may not allow it.
// The earliest tentative slot is tomorrow.

const DAY_MS = 24 * 60 * 60 * 1000
const IST_OFFSET_MIN = 330 // Asia/Kolkata, UTC+5:30 — used to reason about "day" in local terms

// Start-of-day (local IST) for a given instant, returned as a UTC Date.
function istStartOfDay(d: Date): Date {
  const local = new Date(d.getTime() + IST_OFFSET_MIN * 60_000)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - IST_OFFSET_MIN * 60_000)
}

// A slot at a given IST hour, N days from `from`.
function istSlot(from: Date, daysAhead: number, hourIST: number): Date {
  const base = istStartOfDay(from)
  return new Date(base.getTime() + daysAhead * DAY_MS + (hourIST * 60 - IST_OFFSET_MIN) * 60_000)
}

export function isSameISTDay(a: Date, b: Date): boolean {
  return istStartOfDay(a).getTime() === istStartOfDay(b).getTime()
}

// Clamp any candidate slot so it is at least tomorrow (IST). If the candidate
// is today/past, push it to tomorrow keeping the time-of-day.
export function clampToTomorrowOrLater(candidate: Date, now: Date): Date {
  if (istStartOfDay(candidate).getTime() <= istStartOfDay(now).getTime()) {
    const tomorrowStart = new Date(istStartOfDay(now).getTime() + DAY_MS)
    const candLocal = new Date(candidate.getTime() + IST_OFFSET_MIN * 60_000)
    const hour = candLocal.getUTCHours()
    const min = candLocal.getUTCMinutes()
    return new Date(tomorrowStart.getTime() + (hour * 60 + min - IST_OFFSET_MIN) * 60_000)
  }
  return candidate
}

// Default proposal when we have no parsed availability: tomorrow & day-after,
// late afternoon (good for site visits).
export function defaultProposedSlots(now: Date): Date[] {
  return [istSlot(now, 1, 17), istSlot(now, 2, 11)]
}

export function formatSlotIST(d: Date): string {
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Kolkata',
  })
}

// Validate/clean an AI-proposed ISO slot: must parse and must be >= tomorrow.
// Returns a safe Date or null (caller then asks for availability instead).
export function sanitizeProposedSlot(iso: string | null | undefined, now: Date): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  if (istStartOfDay(d).getTime() <= istStartOfDay(now).getTime()) return null
  // don't allow absurdly far slots (> 30 days) — likely a hallucinated year
  if (d.getTime() - now.getTime() > 30 * DAY_MS) return null
  return d
}

export function todayContextIST(now: Date): { todayISO: string; tomorrowISO: string; todayLabel: string } {
  const tomorrow = new Date(istStartOfDay(now).getTime() + DAY_MS + 11 * 60 * 60_000)
  return {
    todayISO: now.toISOString(),
    tomorrowISO: tomorrow.toISOString(),
    todayLabel: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }),
  }
}
