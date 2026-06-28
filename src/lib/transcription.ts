// Audio -> text. Prefers Azure OpenAI Whisper when configured, otherwise falls
// back to any OpenAI-compatible /audio/transcriptions endpoint.
//
// Azure Whisper (preferred) — uses the shared Azure OpenAI account:
//   AZURE_WHISPER_DEPLOYMENT    - the Whisper deployment name (enables Azure path)
//   AZURE_OPENAI_KEY            - account key
//   AZURE_OPENAI_ENDPOINT       - https://<resource>.openai.azure.com
//   AZURE_WHISPER_API_VERSION   - optional, defaults to AZURE_OPENAI_API_VERSION
//
// Generic fallback (OpenAI / Groq / self-hosted):
//   TRANSCRIPTION_API_KEY   - required to enable this path
//   TRANSCRIPTION_BASE_URL  - default https://api.openai.com/v1
//   TRANSCRIPTION_MODEL     - default whisper-1

function azureWhisperConfigured(): boolean {
  return Boolean(
    process.env.AZURE_WHISPER_DEPLOYMENT &&
      process.env.AZURE_OPENAI_KEY &&
      process.env.AZURE_OPENAI_ENDPOINT
  )
}

export function transcriptionConfigured(): boolean {
  return azureWhisperConfigured() || Boolean(process.env.TRANSCRIPTION_API_KEY)
}

export interface TranscriptionResult {
  text: string
  ok: boolean
  error?: string
}

// Azure OpenAI Whisper. Endpoint + auth differ from vanilla OpenAI:
//   {endpoint}/openai/deployments/{deployment}/audio/transcriptions?api-version=…
//   header: api-key (not Bearer); deployment in the URL (no "model" field).
async function transcribeViaAzure(file: Blob, filename: string): Promise<TranscriptionResult> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/+$/, '')
  const deployment = process.env.AZURE_WHISPER_DEPLOYMENT!
  const version = process.env.AZURE_WHISPER_API_VERSION || process.env.AZURE_OPENAI_API_VERSION || '2024-06-01'
  const url = `${endpoint}/openai/deployments/${deployment}/audio/transcriptions?api-version=${version}`

  const form = new FormData()
  form.append('file', file, filename)
  form.append('response_format', 'json')
  // Hindi/English mix — leave language unset so Whisper auto-detects Hinglish.

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': process.env.AZURE_OPENAI_KEY! },
      body: form,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[transcription] azure whisper failed:', res.status, detail.slice(0, 300))
      return { text: '', ok: false, error: `Transcription service error (${res.status}).` }
    }
    const data = (await res.json()) as { text?: string }
    return { text: (data.text ?? '').trim(), ok: true }
  } catch (err) {
    console.error('[transcription] azure whisper request error:', err)
    return { text: '', ok: false, error: 'Could not reach the transcription service.' }
  }
}

async function transcribeViaOpenAICompatible(file: Blob, filename: string): Promise<TranscriptionResult> {
  const base = (process.env.TRANSCRIPTION_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.TRANSCRIPTION_MODEL || 'whisper-1'

  const form = new FormData()
  form.append('file', file, filename)
  form.append('model', model)
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

export async function transcribeAudio(file: Blob, filename = 'audio.webm'): Promise<TranscriptionResult> {
  if (azureWhisperConfigured()) return transcribeViaAzure(file, filename)
  if (process.env.TRANSCRIPTION_API_KEY) return transcribeViaOpenAICompatible(file, filename)
  return {
    text: '',
    ok: false,
    error: 'Transcription is not configured. Set AZURE_WHISPER_DEPLOYMENT (or TRANSCRIPTION_API_KEY), or type the lead details instead.',
  }
}
