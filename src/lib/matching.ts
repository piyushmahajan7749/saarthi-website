// Lead-requirements -> property matching. Deterministic scoring so brokers can
// trust why a property was sent.
import type { Property } from '@prisma/client'
import type { LeadRequirements } from '@/types'
import { db } from './db'

export interface ScoredProperty {
  property: Property
  score: number // 0..100
  reasons: string[]
}

export function scoreProperty(req: LeadRequirements, p: Property): ScoredProperty {
  let score = 0
  const reasons: string[] = []

  // Hard-ish requirements
  if (req.listingFor && p.listingFor === req.listingFor) {
    score += 25
    reasons.push(req.listingFor === 'RENT' ? 'Available for rent' : 'Available for sale')
  } else if (req.listingFor && p.listingFor !== req.listingFor) {
    return { property: p, score: 0, reasons: ['Sale/rent mismatch'] }
  }

  if (req.type) {
    if (p.type === req.type) {
      score += 15
      reasons.push('Property type matches')
    } else if ((req.type === 'FLAT' && p.type === 'PG') || (req.type === 'HOUSE' && p.type === 'VILLA')) {
      score += 7
    }
  } else {
    score += 8
  }

  if (req.bhk != null && p.bhk != null) {
    if (p.bhk === req.bhk) {
      score += 20
      reasons.push(`${p.bhk} BHK as requested`)
    } else if (Math.abs(p.bhk - req.bhk) === 1) {
      score += 8
      reasons.push(`${p.bhk} BHK (close to ${req.bhk})`)
    }
  } else if (req.bhk == null) {
    score += 10
  }

  if (req.budgetMax != null && p.price != null) {
    if (p.price <= req.budgetMax && (req.budgetMin == null || p.price >= req.budgetMin)) {
      score += 25
      reasons.push('Within budget')
    } else if (p.price <= req.budgetMax * 1.15) {
      score += 12
      reasons.push('Slightly above budget (~15%)')
    } else if (p.price < (req.budgetMin ?? 0) * 0.8) {
      score += 5
    }
  } else {
    score += 10
  }

  if (req.localities?.length) {
    const hit = req.localities.find(
      (l) => p.locality.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(p.locality.toLowerCase())
    )
    if (hit && p.locality) {
      score += 15
      reasons.push(`In preferred area (${p.locality})`)
    }
  } else {
    score += 7
  }

  return { property: p, score: Math.min(100, score), reasons }
}

// Top matches among ACTIVE properties, excluding ones already sent to the lead.
export async function findMatches(req: LeadRequirements, opts?: { excludePropertyIds?: string[]; limit?: number }): Promise<ScoredProperty[]> {
  const limit = opts?.limit ?? 3
  const exclude = new Set(opts?.excludePropertyIds ?? [])
  const candidates = await db.property.findMany({
    where: {
      status: 'ACTIVE',
      ...(req.listingFor ? { listingFor: req.listingFor } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return candidates
    .filter((p) => !exclude.has(p.id))
    .map((p) => scoreProperty(req, p))
    .filter((s) => s.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
