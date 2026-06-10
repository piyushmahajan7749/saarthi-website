import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { parseListingsFromRows } from '@/lib/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/admin/intake/parse-excel (multipart: file) -> { batchId, listings }
export async function POST(req: Request) {
  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Could not read the uploaded file.' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
  if (file.size > 5_000_000) return NextResponse.json({ error: 'File too large — max 5 MB.' }, { status: 400 })

  let rows: Record<string, unknown>[]
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return NextResponse.json({ error: 'The file has no sheets.' }, { status: 400 })
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  } catch (err) {
    console.error('[intake] excel read failed:', err)
    return NextResponse.json({ error: 'Could not read that spreadsheet — is it a valid .xlsx/.csv?' }, { status: 400 })
  }

  if (rows.length === 0) return NextResponse.json({ error: 'No data rows found in the sheet.' }, { status: 400 })
  if (rows.length > 200) rows = rows.slice(0, 200)

  try {
    const session = await getSession()
    const listings = await parseListingsFromRows(rows)
    const batch = await db.intakeBatch.create({
      data: {
        source: 'EXCEL',
        rawContent: `${file.name} · ${rows.length} rows`,
        status: 'PARSED',
        itemCount: listings.length,
        createdBy: session?.id ?? null,
      },
    })
    return NextResponse.json({ batchId: batch.id, listings })
  } catch (err) {
    console.error('[intake] parse-excel failed:', err)
    return NextResponse.json({ error: 'Parsing failed — please try again.' }, { status: 500 })
  }
}
