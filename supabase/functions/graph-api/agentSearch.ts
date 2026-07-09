import {
  buildPersonCandidateSummary,
  buildSearchIntentFromQuery,
  collectPersonCandidates,
  getCirclePath,
  rankGraphSearch,
  type GraphState,
  type GraphSearchResult,
  type SearchIntent,
} from './graphSearch.ts'
import { callSearchIntent, getAiSearchConfig } from './interpretSearch.ts'

const ANALYZE_PROMPT = `You help search a personal relationship graph. The user asks in natural language.
Return ONLY JSON:
{
  "thinking": "one short sentence in the user's language explaining what they want",
  "searchTerms": ["expanded literal terms to scan notes/names, include synonyms and translations"],
  "isRelational": boolean,
  "suggestions": ["optional follow-up searches if the query is vague"]
}

Rules:
- Expand relationship words into note-friendly terms (girlfriend -> love, her, partner, relationship, девушка, люблю)
- Include both user language and English variants when useful
- searchTerms are for substring matching, not philosophy
- Do not wrap JSON in markdown`

const MATCH_PROMPT = `You pick people from a candidate list that best match the user's search.
Return ONLY JSON:
{
  "matches": [
    { "id": "person-id", "confidence": 0.0, "reason": "short explanation in user language" }
  ],
  "suggestions": ["what to try next if unsure, max 3"]
}

Rules:
- Only use ids from candidates
- confidence 0..1, include matches >= 0.45
- reason must cite note text or circle when possible
- Empty matches array is valid
- Do not wrap JSON in markdown`

const RETRY_PROMPT = `The first pass found no matches. Read notes carefully for semantic fits (e.g. "i love her" may mean girlfriend).
Return ONLY JSON:
{
  "matches": [{ "id": "person-id", "confidence": 0.0, "reason": "..." }],
  "suggestions": ["..."]
}
Use only provided candidates.`

export type AgentSearchStep = {
  id: string
  label: string
  detail?: string
}

export type AgentSearchResponse = {
  query: string
  mode: 'agent'
  explanation: string
  steps: AgentSearchStep[]
  suggestions: string[]
  results: ReturnType<typeof buildApiResults>
}

type AnalyzeResult = {
  thinking?: string
  searchTerms?: string[]
  isRelational?: boolean
  suggestions?: string[]
}

type MatchResult = {
  matches?: Array<{ id?: string; confidence?: number; reason?: string }>
  suggestions?: string[]
}

function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim()
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  try {
    return JSON.parse(jsonText) as T
  } catch {
    return null
  }
}

async function callAgentLlm(system: string, user: unknown, maxTokens = 400): Promise<string | null> {
  const config = getAiSearchConfig()
  if (!config) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

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
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    })

    if (!response.ok) {
      console.error('Agent search LLM error', response.status, await response.text())
      return null
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    return payload.choices?.[0]?.message?.content ?? null
  } catch (error) {
    console.error('Agent search LLM failed', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function uniqueTerms(...groups: Array<string[] | undefined>) {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const group of groups) {
    for (const term of group ?? []) {
      const value = term.trim()
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      terms.push(value)
    }
  }
  return terms
}

function graphResultsByIds(
  graph: GraphState,
  matches: Array<{ id: string; reason: string; confidence: number }>,
  limit: number,
): { results: GraphSearchResult[]; reasons: Map<string, string> } {
  const reasons = new Map<string, string>()
  const results: GraphSearchResult[] = []

  for (const match of matches) {
    const person = graph.people.find((candidate) => candidate.id === match.id)
    if (!person) continue
    const circlePath = getCirclePath(graph, person.circleId)
    const pathItems = circlePath.map((circle) => ({ id: circle.id, name: circle.name }))
    const position = (person.notes ?? []).find((note) =>
      ['position', 'headline', 'title', 'role'].includes(note.title.trim().toLowerCase())
    )?.body
    const pathLabel = pathItems.map((item) => item.name).filter(Boolean).join(' › ')
    const subtitle = position && pathLabel ? `${pathLabel} · ${position}` : pathLabel || position || ''
    results.push({
      type: 'person',
      id: person.id,
      name: person.name,
      circleId: person.circleId,
      circlePath: pathItems,
      score: Math.round(match.confidence * 100),
      subtitle,
    })
    reasons.set(person.id, match.reason)
    if (results.length >= limit) break
  }

  return { results, reasons }
}

function buildApiResults(
  graph: GraphState,
  results: GraphSearchResult[],
  reasons: Map<string, string>,
  limit: number,
) {
  return results.slice(0, limit).map((result) => {
    const aiReason = reasons.get(result.id)
    if (result.type === 'person') {
      return {
        type: 'person' as const,
        id: result.id,
        name: result.name,
        circleId: result.circleId,
        circlePath: result.circlePath,
        subtitle: result.subtitle,
        score: result.score,
        aiReason,
      }
    }
    return {
      type: 'circle' as const,
      id: result.id,
      name: result.name,
      parentId: result.parentId,
      path: result.path,
      subtitle: result.subtitle,
      score: result.score,
      aiReason,
    }
  })
}

async function matchCandidates(
  query: string,
  candidates: ReturnType<typeof buildPersonCandidateSummary>[],
  systemPrompt: string,
): Promise<MatchResult | null> {
  if (candidates.length === 0) return { matches: [], suggestions: [] }
  const content = await callAgentLlm(systemPrompt, { query, candidates: candidates.slice(0, 50) }, 500)
  if (!content) return null
  return parseJsonObject<MatchResult>(content)
}

export async function runAgentSearch(graph: GraphState, query: string, limit: number): Promise<AgentSearchResponse> {
  const trimmed = query.trim()
  const steps: AgentSearchStep[] = []
  const circleNames = graph.circles.map((circle) => circle.name).filter(Boolean)

  steps.push({ id: 'read', label: 'Reading your question', detail: trimmed })

  let explanation = 'Scanning your graph for matches.'
  let suggestions: string[] = []
  let searchTerms: string[] = []
  let isRelational = false
  let intent: SearchIntent = buildSearchIntentFromQuery(trimmed)

  const analyzeContent = await callAgentLlm(ANALYZE_PROMPT, { query: trimmed, circles: circleNames.slice(0, 200) }, 320)
  const analysis = analyzeContent ? parseJsonObject<AnalyzeResult>(analyzeContent) : null

  if (analysis) {
    explanation = analysis.thinking?.trim() || explanation
    searchTerms = uniqueTerms(analysis.searchTerms, intent.keywords, intent.nameTokens, [trimmed])
    isRelational = analysis.isRelational === true
    suggestions = (analysis.suggestions ?? []).filter((item) => typeof item === 'string').slice(0, 3)
    steps.push({
      id: 'understand',
      label: 'Understanding what you mean',
      detail: explanation,
    })
  } else {
    const aiIntent = await callSearchIntent(trimmed, circleNames)
    if (aiIntent) intent = aiIntent
    searchTerms = uniqueTerms(intent.keywords, intent.nameTokens, [trimmed])
    steps.push({
      id: 'understand',
      label: 'Understanding what you mean',
      detail: 'Expanded your query into search terms.',
    })
  }

  steps.push({ id: 'scan', label: 'Scanning contacts and notes' })

  const strictResults = rankGraphSearch(graph, intent, limit)
  if (strictResults.length > 0) {
    steps.push({
      id: 'keyword',
      label: 'Found keyword matches',
      detail: `${strictResults.length} direct match${strictResults.length === 1 ? '' : 'es'}`,
    })
  }

  const candidates = collectPersonCandidates(graph, searchTerms, {
    max: 60,
    includeAllNoted: isRelational || strictResults.length === 0,
  }).map((person) => buildPersonCandidateSummary(graph, person))

  steps.push({
    id: 'candidates',
    label: 'Reviewing candidates with AI',
    detail: `${candidates.length} profile${candidates.length === 1 ? '' : 's'} with notes or term hits`,
  })

  let matchPayload = await matchCandidates(trimmed, candidates, MATCH_PROMPT)
  let normalizedMatches = (matchPayload?.matches ?? [])
    .filter((match) => typeof match.id === 'string' && match.id.trim())
    .map((match) => ({
      id: match.id!.trim(),
      confidence: typeof match.confidence === 'number' ? match.confidence : 0.5,
      reason: typeof match.reason === 'string' ? match.reason.trim() : 'Matched by AI',
    }))
    .filter((match) => match.confidence >= 0.45)

  if (normalizedMatches.length === 0 && candidates.length > 0) {
    steps.push({ id: 'retry', label: 'Trying a deeper note pass', detail: 'Looking for semantic fits in private notes' })
    matchPayload = await matchCandidates(trimmed, candidates, RETRY_PROMPT)
    normalizedMatches = (matchPayload?.matches ?? [])
      .filter((match) => typeof match.id === 'string' && match.id.trim())
      .map((match) => ({
        id: match.id!.trim(),
        confidence: typeof match.confidence === 'number' ? match.confidence : 0.5,
        reason: typeof match.reason === 'string' ? match.reason.trim() : 'Matched by AI',
      }))
      .filter((match) => match.confidence >= 0.4)
  }

  const aiSuggestions = (matchPayload?.suggestions ?? []).filter((item) => typeof item === 'string').slice(0, 3)
  if (aiSuggestions.length > 0) suggestions = [...new Set([...suggestions, ...aiSuggestions])].slice(0, 4)

  let results: GraphSearchResult[] = []
  let reasons = new Map<string, string>()

  if (normalizedMatches.length > 0) {
    const mapped = graphResultsByIds(graph, normalizedMatches, limit)
    results = mapped.results
    reasons = mapped.reasons
    steps.push({
      id: 'pick',
      label: 'AI picked matches',
      detail: `${results.length} suggestion${results.length === 1 ? '' : 's'}`,
    })
  } else if (strictResults.length > 0) {
    results = strictResults
    steps.push({
      id: 'fallback',
      label: 'Used direct keyword matches',
      detail: 'AI did not find a semantic fit in notes',
    })
  } else {
    steps.push({
      id: 'none',
      label: 'No confident match yet',
      detail: 'Try a follow-up suggestion below',
    })
    if (suggestions.length === 0) {
      suggestions = [
        'Search by her name',
        'Add a note like "my girlfriend" on her profile',
        'Try "person I love" or words from your note',
      ]
    }
  }

  return {
    query: trimmed,
    mode: 'agent',
    explanation,
    steps,
    suggestions,
    results: buildApiResults(graph, results, reasons, limit),
  }
}
