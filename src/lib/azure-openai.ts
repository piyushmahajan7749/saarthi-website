// Azure OpenAI (GPT-5.5) client — powers the high-accuracy listing parser.
// Talks to the Azure chat-completions REST API directly (no SDK dependency).
// Callers degrade gracefully: if azureEnabled() is false or a call throws,
// they fall back to Claude and then to the heuristic engine.

const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/+$/, '')
const KEY = process.env.AZURE_OPENAI_KEY
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview'

export function azureEnabled(): boolean {
  return Boolean(ENDPOINT && KEY && DEPLOYMENT)
}

interface ChatJSONArgs {
  system: string
  user: string
  /** JSON Schema for the response. Must be strict-mode compatible
   *  (object root, additionalProperties:false, every key in `required`). */
  schema: Record<string, unknown>
  schemaName?: string
  maxTokens?: number
  timeoutMs?: number
}

// One system+user prompt -> JSON object matching `schema`.
// Prefers strict json_schema structured output; transparently falls back to
// json_object mode for deployments/api-versions that lack json_schema support.
export async function azureChatJSON<T>({
  system,
  user,
  schema,
  schemaName = 'result',
  maxTokens = 8000,
  timeoutMs = 90_000,
}: ChatJSONArgs): Promise<T> {
  if (!azureEnabled()) throw new Error('Azure OpenAI not configured')
  const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`

  async function call(system: string, responseFormat: unknown): Promise<string> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': KEY! },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          // GPT-5 class deployments use max_completion_tokens (not max_tokens)
          // and only accept the default temperature, so we omit temperature.
          max_completion_tokens: maxTokens,
          response_format: responseFormat,
        }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Azure OpenAI ${res.status}: ${body.slice(0, 600)}`)
      }
      const json = await res.json()
      const content: unknown = json?.choices?.[0]?.message?.content
      const finish = json?.choices?.[0]?.finish_reason
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error(`Empty content from Azure OpenAI (finish_reason=${finish})`)
      }
      return content
    } finally {
      clearTimeout(timer)
    }
  }

  let content: string
  try {
    content = await call(system, {
      type: 'json_schema',
      json_schema: { name: schemaName, strict: true, schema },
    })
  } catch (err) {
    // json_schema unsupported or rejected — retry in json_object mode with the
    // schema embedded in the prompt so the model still returns the right shape.
    const enriched = `${system}\n\nReturn ONLY a JSON object that conforms to this JSON Schema. No prose, no markdown fences:\n${JSON.stringify(schema)}`
    content = await call(enriched, { type: 'json_object' })
  }

  // Strip accidental markdown fences, then parse.
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(cleaned) as T
}

// Run async `fn` over `items` with bounded concurrency, preserving order.
export async function mapLimit<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>
): Promise<O[]> {
  const out: O[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      out[idx] = await fn(items[idx], idx)
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker)
  await Promise.all(workers)
  return out
}
