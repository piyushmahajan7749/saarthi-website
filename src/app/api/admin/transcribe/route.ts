import { NextResponse } from 'next/server'
import { transcribeAudio, transcriptionConfigured } from '@/lib/transcription'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// POST /api/admin/transcribe (multipart: audio) -> { text }
export async function POST(req: Request) {
  if (!transcriptionConfigured()) {
    return NextResponse.json({ error: 'Voice transcription is not configured. Set TRANSCRIPTION_API_KEY, or type the lead details instead.' }, { status: 503 })
  }
  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('audio') ?? form.get('file')
    if (f instanceof File) file = f
  } catch {
    return NextResponse.json({ error: 'Could not read the audio.' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'No audio uploaded.' }, { status: 400 })
  if (file.size > 25_000_000) return NextResponse.json({ error: 'Audio too large — max 25 MB.' }, { status: 400 })

  const result = await transcribeAudio(file, file.name || 'note.webm')
  if (!result.ok) return NextResponse.json({ error: result.error || 'Transcription failed.' }, { status: 502 })
  return NextResponse.json({ text: result.text })
}
