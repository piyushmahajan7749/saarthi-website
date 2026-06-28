import { NextResponse } from 'next/server'
import AdmZip from 'adm-zip'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { parseListingsFromText } from '@/lib/ai'
import { uploadToAzure } from '@/lib/azure-storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/admin/intake/parse-wa-zip  (multipart: file = .zip)
// -> { batchId, listings: ParsedListing[], mediaByListing: string[][] }
//
// Accepts the zip file produced by WhatsApp "Export Chat > Attach Media".
// Unzips in memory, finds _chat.txt, parses listings, then for each listing
// extracts the filenames mentioned in its rawText, uploads those files to
// Azure Blob Storage, and returns the URLs pre-matched to the right listing.

const MEDIA_RE = /(\S+\.(jpe?g|png|webp|gif|mp4|mov|webm))\s*(?:\([^)]*\))?/gi
const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
}

function extractFilenames(rawText: string): string[] {
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  MEDIA_RE.lastIndex = 0
  while ((m = MEDIA_RE.exec(rawText)) !== null) seen.add(m[1])
  return Array.from(seen)
}

export async function POST(req: Request) {
  const session = await getSession()

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Could not read upload.' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return NextResponse.json({ error: 'Expected a .zip file from WhatsApp Export Chat.' }, { status: 400 })
  }
  if (file.size > 200_000_000) {
    return NextResponse.json({ error: 'Zip too large (200 MB max).' }, { status: 400 })
  }

  // Unzip in memory
  let zip: AdmZip
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    zip = new AdmZip(buf)
  } catch {
    return NextResponse.json({ error: 'Could not unzip the file. Make sure it\'s a valid WhatsApp export.' }, { status: 422 })
  }

  const entries = zip.getEntries()

  // Find _chat.txt — may be at root or inside a folder
  const chatEntry = entries.find((e) => e.name === '_chat.txt')
  if (!chatEntry) {
    return NextResponse.json({ error: 'No _chat.txt found inside the zip. Export the chat with "Attach Media" on WhatsApp.' }, { status: 422 })
  }
  const chatText = chatEntry.getData().toString('utf8')

  // Build filename → Buffer map for all media files
  const mediaMap = new Map<string, { data: Buffer; ext: string }>()
  for (const entry of entries) {
    const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
    if (MIME[ext]) {
      mediaMap.set(entry.name, { data: entry.getData(), ext })
    }
  }

  // Parse listings from chat text
  let listings: Awaited<ReturnType<typeof parseListingsFromText>>
  try {
    listings = await parseListingsFromText(chatText)
  } catch (err) {
    console.error('[parse-wa-zip] parse failed:', err)
    return NextResponse.json({ error: 'AI parsing failed — try again.' }, { status: 500 })
  }

  // For each listing, find mentioned filenames in its rawText → upload → collect URLs
  const mediaByListing: string[][] = []

  for (const listing of listings) {
    const filenames = extractFilenames(listing.rawText ?? '')
    const urls: string[] = []

    for (const filename of filenames) {
      const entry = mediaMap.get(filename)
      if (!entry) continue
      try {
        const contentType = MIME[entry.ext] ?? 'application/octet-stream'
        const url = await uploadToAzure(entry.data, filename, contentType)
        urls.push(url)
      } catch (err) {
        console.error('[parse-wa-zip] upload failed for', filename, err)
      }
    }

    mediaByListing.push(urls)
  }

  const batch = await db.intakeBatch.create({
    data: {
      source: 'WHATSAPP',
      rawContent: chatText.slice(0, 5000),
      status: 'PARSED',
      itemCount: listings.length,
      createdBy: session?.id ?? null,
    },
  })

  return NextResponse.json({ batchId: batch.id, listings, mediaByListing })
}
