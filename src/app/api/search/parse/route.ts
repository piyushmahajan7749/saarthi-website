import { NextResponse } from 'next/server'
import { parseSearchQuery } from '@/lib/ai'

export const dynamic = 'force-dynamic'

// POST /api/search/parse { q } -> { filters: PropertyFilters }
export async function POST(req: Request) {
  let body: { q?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ filters: {} })
  }
  const q = String(body.q ?? '').slice(0, 300)
  if (!q.trim()) return NextResponse.json({ filters: {} })
  const filters = await parseSearchQuery(q)
  return NextResponse.json({ filters })
}
