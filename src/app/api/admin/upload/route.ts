import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/admin/upload (multipart: files[]) -> { urls: string[] }
// Saves listing photos/videos under /public/uploads and returns public URLs.
// NOTE: local/self-host filesystem persistence. On serverless (Vercel) swap for
// blob storage (S3/Vercel Blob) — the rest of the app only stores the URL.
const ALLOWED = /\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i

export async function POST(req: Request) {
  let files: File[] = []
  try {
    const form = await req.formData()
    files = form.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      const single = form.get('file')
      if (single instanceof File) files = [single]
    }
  } catch {
    return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 })
  }
  if (files.length === 0) return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 })

  const dir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(dir, { recursive: true })

  const urls: string[] = []
  let seq = 0
  for (const file of files) {
    if (!ALLOWED.test(file.name)) continue
    if (file.size > 60_000_000) continue // 60MB cap (videos)
    const ext = path.extname(file.name).toLowerCase()
    const safe = `${Date.now().toString(36)}-${(seq++).toString(36)}${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(dir, safe), buf)
    urls.push(`/uploads/${safe}`)
  }
  if (urls.length === 0) return NextResponse.json({ error: 'No supported files (use jpg/png/webp/mp4/mov).' }, { status: 400 })
  return NextResponse.json({ urls })
}
