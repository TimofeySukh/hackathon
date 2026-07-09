import {
  buildSearchIntentFromQuery,
  parseSearchIntentJson,
  type GraphState,
  type SearchIntent,
} from './graphSearch.ts'

const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const INTENT_CACHE_TTL_MS = 5 * 60 * 1000

const intentCache = new Map<string, { intent: SearchIntent; expiresAt: number }>()

const SYSTEM_PROMPT = `You convert natural-language graph search queries into JSON filters.
Return ONLY valid JSON with this shape:
{
  "nameTokens": string[],
  "keywords": string[],
  "circleNames": string[],
  "role": string,
  "preferCircles": boolean
}

Rules:
- nameTokens: person name fragments ("Alice", "Иван")
- keywords: topic words from notes or general terms not covered elsewhere
- circleNames: company, circle, or group names ("Google", "Work", "Meta"). Match user wording to provided circle list when possible.
- role: job title or role phrase ("product manager", "engineer")
- preferCircles: true when user asks for a circle/zone/tag itself
- Use lowercase ASCII where possible for tokens; keep circleNames in the user's language
- Empty arrays and empty strings are fine when unknown
- Do not wrap JSON in markdown`

function normalizeCacheKey(query: string) {
  return query.trim().toLowerCase()
}

export function getAiSearchConfig() {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY')
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: (Deno.env.get('OPENROUTER_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    model: Deno.env.get('OPENROUTER_SEARCH_MODEL') ?? DEFAULT_MODEL,
  }
}

export function isAiSearchConfigured() {
  return Boolean(getAiSearchConfig())
}

export async function callSearchIntent(query: string, circleNames: string[]): Promise<SearchIntent | null> {
  const config = getAiSearchConfig()
  if (!config) return null

  const cacheKey = normalizeCacheKey(query)
  const cached = intentCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.intent

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 220,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              query,
              circles: circleNames.slice(0, 250),
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('AI search provider error', response.status, await response.text())
      return null
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return null

    const intent = parseSearchIntentJson(content)
    if (!intent) return null

    intentCache.set(cacheKey, { intent, expiresAt: Date.now() + INTENT_CACHE_TTL_MS })
    return intent
  } catch (error) {
    console.error('AI search interpret failed', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function interpretSearchQuery(graph: GraphState, query: string): Promise<{
  intent: SearchIntent
  source: 'ai' | 'local'
}> {
  const trimmed = query.trim()
  const localIntent = buildSearchIntentFromQuery(trimmed)
  const circleNames = graph.circles.map((circle) => circle.name).filter(Boolean)
  const aiIntent = await callSearchIntent(trimmed, circleNames)
  if (aiIntent) {
    return { intent: aiIntent, source: 'ai' }
  }
  return { intent: localIntent, source: 'local' }
}
