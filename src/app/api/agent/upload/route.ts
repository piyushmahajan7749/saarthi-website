import { NextResponse } from 'next/server'
import path from 'path'
import { requireAgentKey } from '@/lib/agent-auth'
import { uploadToAzure } from '@/lib/azure-storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/agent/upload (multipart: file, Authorization: Bearer)
// Called by cx-agent to upload a WhatsApp media file (already downloaded from Meta)
// to Azure Blob Storage. Returns { url } for the public Azure URL.
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
}

export async function POST(req: Request) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Could not parse multipart body.' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No file in request.' }, { status: 400 })
  if (file.size > 60_000_000) return NextResponse.json({ error: 'File too large (60MB max).' }, { status: 400 })

  const contentType = file.type || 'image/jpeg'
  const ext = MIME_TO_EXT[contentType] ?? path.extname(file.name).replace('.', '') ?? 'jpg'
  const buf = Buffer.from(await file.arrayBuffer())
  const url = await uploadToAzure(buf, `media.${ext}`, contentType)
  return NextResponse.json({ url })
}
