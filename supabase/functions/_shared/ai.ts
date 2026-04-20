type JsonSchema = Record<string, unknown>

export type PersonAiStructuredSummary = {
  summary: string
  traits: string[]
  interests: string[]
  relationship_context: string[]
  open_questions: string[]
}

export type SearchResult = {
  person_id: string
  score: number
  reason: string
  matched_signals: string[]
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
}

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') || 'openrouter/free'

const personSummarySchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'traits', 'interests', 'relationship_context', 'open_questions'],
  properties: {
    summary: { type: 'string' },
    traits: { type: 'array', items: { type: 'string' } },
    interests: { type: 'array', items: { type: 'string' } },
    relationship_context: { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
}

const peopleSearchSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['person_id', 'score', 'reason', 'matched_signals'],
        properties: {
          person_id: { type: 'string' },
          score: { type: 'number' },
          reason: { type: 'string' },
          matched_signals: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => toGeminiSchema(entry))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(record)) {
    if (key === 'additionalProperties') continue
    result[key] = toGeminiSchema(entry)
  }

  return result
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizePersonSummary(value: unknown): PersonAiStructuredSummary {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

  return {
    summary: typeof candidate.summary === 'string' ? candidate.summary.trim() : '',
    traits: normalizeStringArray(candidate.traits),
    interests: normalizeStringArray(candidate.interests),
    relationship_context: normalizeStringArray(candidate.relationship_context),
    open_questions: normalizeStringArray(candidate.open_questions),
  }
}

function normalizeSearchResults(value: unknown): SearchResult[] {
  const results =
    value && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as Record<string, unknown>).results)
      ? ((value as Record<string, unknown>).results as unknown[])
      : []

  return results
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      person_id: typeof entry.person_id === 'string' ? entry.person_id : '',
      score: typeof entry.score === 'number' ? Math.max(0, Math.min(1, entry.score)) : 0,
      reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
      matched_signals: normalizeStringArray(entry.matched_signals).slice(0, 5),
    }))
    .filter((entry) => entry.person_id)
}

function parseJsonObject(text: string) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('AI provider returned an empty response.')
  }

  return JSON.parse(trimmed) as unknown
}

async function readErrorMessage(response: Response) {
  const text = await response.text()
  if (!text) return `${response.status} ${response.statusText}`.trim()

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; status?: string } | string }
    if (typeof parsed.error === 'string') return parsed.error
    if (parsed.error?.message) return parsed.error.message
  } catch {
    return text
  }

  return text
}

function isGeminiQuotaError(status: number, message: string) {
  const normalized = message.toLowerCase()
  return (
    status === 429 ||
    status === 503 ||
    normalized.includes('resource exhausted') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('high demand') ||
    normalized.includes('unavailable')
  )
}

async function callGeminiJson<T>(input: {
  systemInstruction: string
  userPrompt: string
  schema: JsonSchema
  temperature?: number
}): Promise<T> {
  const apiKey = getRequiredEnv('GEMINI_API_KEY')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: input.systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: input.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(input.schema),
      },
    }),
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    const error = new Error(`Gemini request failed: ${message}`)
    ;(error as Error & { status?: number; shouldFallback?: boolean }).status = response.status
    ;(error as Error & { status?: number; shouldFallback?: boolean }).shouldFallback = isGeminiQuotaError(
      response.status,
      message,
    )
    throw error
  }

  const payload = (await response.json()) as GeminiGenerateContentResponse
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? ''
  return parseJsonObject(text) as T
}

function readOpenRouterMessageContent(content: string | Array<{ type?: string; text?: string }> | undefined) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((entry) => (entry.type === 'text' || entry.type === undefined ? entry.text ?? '' : ''))
    .join('')
}

async function callOpenRouterJson<T>(input: {
  systemInstruction: string
  userPrompt: string
  schema: JsonSchema
  temperature?: number
}): Promise<T> {
  const apiKey = getRequiredEnv('OPENROUTER_API_KEY')
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://lxnrpdeahoglgiocowsh.supabase.co',
      'X-Title': 'Hackathon Board',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: input.temperature ?? 0.2,
      messages: [
        { role: 'system', content: input.systemInstruction },
        { role: 'user', content: input.userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          strict: true,
          schema: input.schema,
        },
      },
      plugins: [{ id: 'response-healing' }],
    }),
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(`OpenRouter request failed: ${message}`)
  }

  const payload = (await response.json()) as OpenRouterChatResponse
  const text = readOpenRouterMessageContent(payload.choices?.[0]?.message?.content).trim()
  return parseJsonObject(text) as T
}

export async function generatePersonSummaryWithFallback(input: {
  person: {
    id: string
    name: string
    tag_id: string | null
    tag_name: string | null
  }
  notes: unknown[]
}): Promise<PersonAiStructuredSummary> {
  const systemInstruction =
    'You summarize a single contact from a private relationship graph. Return only JSON. Use only the supplied notes and person metadata. Do not invent facts. Keep arrays concise and useful.'
  const userPrompt = JSON.stringify(
    {
      task: 'Summarize this person into structured relationship notes.',
      person: input.person,
      notes: input.notes,
    },
    null,
    2,
  )

  try {
    return normalizePersonSummary(
      await callGeminiJson<unknown>({
        systemInstruction,
        userPrompt,
        schema: personSummarySchema,
      }),
    )
  } catch (error) {
    if (!(error instanceof Error) || !(error as Error & { shouldFallback?: boolean }).shouldFallback) {
      throw error
    }
  }

  return normalizePersonSummary(
    await callOpenRouterJson<unknown>({
      systemInstruction,
      userPrompt,
      schema: personSummarySchema,
    }),
  )
}

export async function searchPeopleWithFallback(input: {
  query: string
  candidates: unknown[]
}): Promise<SearchResult[]> {
  const systemInstruction =
    'You rank people from a private relationship graph against a natural-language search query. Return only JSON. Prefer strong direct matches from names, tags, notes, and AI summaries. Scores must be between 0 and 1.'
  const userPrompt = JSON.stringify(
    {
      task: 'Return the best matching people for this query.',
      query: input.query,
      candidates: input.candidates,
      constraints: {
        max_results: 8,
        min_reason_length: 1,
        max_matched_signals: 5,
      },
    },
    null,
    2,
  )

  try {
    return normalizeSearchResults(
      await callGeminiJson<unknown>({
        systemInstruction,
        userPrompt,
        schema: peopleSearchSchema,
      }),
    )
  } catch (error) {
    if (!(error instanceof Error) || !(error as Error & { shouldFallback?: boolean }).shouldFallback) {
      throw error
    }
  }

  return normalizeSearchResults(
    await callOpenRouterJson<unknown>({
      systemInstruction,
      userPrompt,
      schema: peopleSearchSchema,
    }),
  )
}
