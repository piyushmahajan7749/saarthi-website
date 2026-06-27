import { NextResponse } from 'next/server'
import path from 'path'
import { uploadToAzure } from '@/lib/azure-storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/admin/upload (multipart: files[] or file) -> { urls: string[] }
// Uploads listing photos/videos to Azure Blob Storage and returns public URLs.
const ALLOWED = /\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
}

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

  const urls: string[] = []
  for (const file of files) {
    if (!ALLOWED.test(file.name)) continue
    if (file.size > 60_000_000) continue
    const ext = path.extname(file.name).toLowerCase()
    const contentType = MIME[ext] ?? 'application/octet-stream'
    const buf = Buffer.from(await file.arrayBuffer())
    const url = await uploadToAzure(buf, file.name, contentType)
    urls.push(url)
  }
  if (urls.length === 0) return NextResponse.json({ error: 'No supported files (use jpg/png/webp/mp4/mov).' }, { status: 400 })
  return NextResponse.json({ urls })
}
