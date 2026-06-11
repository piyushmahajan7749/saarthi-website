// Audio -> text via any OpenAI-compatible /audio/transcriptions endpoint
// (OpenAI Whisper, Groq, Deepgram-compatible gateways, self-hosted, etc.).
// Configured entirely by env so the vendor is swappable:
//   TRANSCRIPTION_API_KEY   - required to enable transcription
//   TRANSCRIPTION_BASE_URL  - default https://api.openai.com/v1
//   TRANSCRIPTION_MODEL     - default whisper-1

export function transcriptionConfigured(): boolean {
  return Boolean(process.env.TRANSCRIPTION_API_KEY)
}

export interface TranscriptionResult {
  text: string
  ok: boolean
  error?: string
}

export async function transcribeAudio(file: Blob, filename = 'audio.webm'): Promise<TranscriptionResult> {
  if (!transcriptionConfigured()) {
    return { text: '', ok: false, error: 'Transcription is not configured. Set TRANSCRIPTION_API_KEY, or type the lead details instead.' }
  }
  const base = (process.env.TRANSCRIPTION_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.TRANSCRIPTION_MODEL || 'whisper-1'

  const form = new FormData()
  form.append('file', file, filename)
  form.append('model', model)
  // Hint the languages we expect (Hindi/English mix). Whisper auto-detects, so
  // we leave language unset to allow Hinglish, but ask for plain text output.
  form.append('response_format', 'json')

  try {
    const res = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.TRANSCRIPTION_API_KEY}` },
      body: form,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[transcription] failed:', res.status, detail.slice(0, 300))
      return { text: '', ok: false, error: `Transcription service error (${res.status}).` }
    }
    const data = (await res.json()) as { text?: string }
    return { text: (data.text ?? '').trim(), ok: true }
  } catch (err) {
    console.error('[transcription] request error:', err)
    return { text: '', ok: false, error: 'Could not reach the transcription service.' }
  }
}
