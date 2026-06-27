import {
  buildSearchIntentFromQuery,
  parseSearchIntentJson,
  type GraphState,
  type SearchIntent,
} from './graphSearch.ts'

import { callHelperLlm, getPrimaryLlmProvider, isAiSearchConfigured as isLlmConfigured } from './llmProvider.ts'

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
  const primary = getPrimaryLlmProvider()
  if (!primary) return null
  return {
    apiKey: primary.apiKey,
    baseUrl: primary.baseUrl,
    model: primary.model,
  }
}

export function isAiSearchConfigured() {
  return isLlmConfigured()
}

export async function callNeuralDeepIntent(query: string, circleNames: string[]): Promise<SearchIntent | null> {
  const config = getAiSearchConfig()
  if (!config) return null

  const cacheKey = normalizeCacheKey(query)
  const cached = intentCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.intent

  try {
    const { content } = await callHelperLlm({
      system: SYSTEM_PROMPT,
      user: { query, circles: circleNames.slice(0, 250) },
      maxTokens: 220,
      temperature: 0,
      timeoutMs: 8000,
    })
    if (!content) return null

    const intent = parseSearchIntentJson(content)
    if (!intent) return null

    intentCache.set(cacheKey, { intent, expiresAt: Date.now() + INTENT_CACHE_TTL_MS })
    return intent
  } catch (error) {
    console.error('AI search interpret failed', error)
    return null
  }
}

export async function interpretSearchQuery(graph: GraphState, query: string): Promise<{
  intent: SearchIntent
  source: 'ai' | 'local'
}> {
  const trimmed = query.trim()
  const localIntent = buildSearchIntentFromQuery(trimmed)
  const circleNames = graph.circles.map((circle) => circle.name).filter(Boolean)
  const aiIntent = await callNeuralDeepIntent(trimmed, circleNames)
  if (aiIntent) {
    return { intent: aiIntent, source: 'ai' }
  }
  return { intent: localIntent, source: 'local' }
}
