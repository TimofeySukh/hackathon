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
import { ensurePersonSearchSummaries } from './searchSummary.ts'
import { callNeuralDeepIntent } from './interpretSearch.ts'
import { callHelperLlm } from './llmProvider.ts'
import {
  expandSearchTerms,
  parseJsonObject,
  runGroupMatchPipeline,
  uniqueTerms,
} from './searchHarness.ts'

const ANALYZE_PROMPT = `You help search a personal relationship graph. The user asks in natural language.
Return ONLY JSON:
{
  "thinking": "one short sentence in the user's language explaining what they want",
  "searchTerms": ["expanded literal terms to scan notes/names, include synonyms and translations"],
  "isRelational": boolean,
  "wantMultiple": boolean,
  "suggestions": ["optional follow-up searches if the query is vague"]
}

Rules:
- YOU decide whether the user wants one best person/circle or a set of people
- Split meaning into literal note/name/circle terms and short phrases that can be used for deterministic prefiltering
- Include useful synonyms and translations when they are needed to find notes written in another language
- searchTerms are for substring matching, not philosophy
- Do not wrap JSON in markdown`

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
  wantMultiple?: boolean
  suggestions?: string[]
}

async function callAgentLlm(system: string, user: unknown, maxTokens = 400): Promise<string | null> {
  const { content } = await callHelperLlm({
    system,
    user,
    maxTokens,
    temperature: 0.2,
    timeoutMs: 12000,
  })
  return content
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

export async function runAgentSearch(graph: GraphState, query: string, limit: number): Promise<AgentSearchResponse> {
  const trimmed = query.trim()
  const steps: AgentSearchStep[] = []
  const circleNames = graph.circles.map((circle) => circle.name).filter(Boolean)

  steps.push({ id: 'read', label: 'Reading your question', detail: trimmed })

  let explanation = 'Scanning your graph for matches.'
  let suggestions: string[] = []
  let searchTerms: string[] = []
  let isRelational = false
  let wantMultiple = false
  let intent: SearchIntent = buildSearchIntentFromQuery(trimmed)

  const analyzeContent = await callAgentLlm(ANALYZE_PROMPT, { query: trimmed, circles: circleNames.slice(0, 200) }, 320)
  const analysis = analyzeContent ? parseJsonObject<AnalyzeResult>(analyzeContent) : null

  if (analysis) {
    explanation = analysis.thinking?.trim() || explanation
    isRelational = analysis.isRelational === true
    wantMultiple = analysis.wantMultiple === true || wantMultiple
    searchTerms = expandSearchTerms(
      uniqueTerms(analysis.searchTerms, intent.keywords, intent.nameTokens, [trimmed]),
      { query: trimmed, isRelational, wantMultiple },
    )
    suggestions = (analysis.suggestions ?? []).filter((item) => typeof item === 'string').slice(0, 3)
    steps.push({
      id: 'understand',
      label: 'Understanding what you mean',
      detail: wantMultiple ? `${explanation} (group search)` : explanation,
    })
  } else {
    const aiIntent = await callNeuralDeepIntent(trimmed, circleNames)
    if (!aiIntent) {
      throw new Response('AI search could not interpret the query. Check graph-api LLM provider configuration and Edge Function logs.', { status: 502 })
    }
    intent = aiIntent
    searchTerms = expandSearchTerms(uniqueTerms(intent.keywords, intent.nameTokens, [trimmed]), {
      query: trimmed,
      isRelational,
      wantMultiple,
    })
    steps.push({
      id: 'understand',
      label: 'Understanding what you mean',
      detail: wantMultiple ? 'Expanded your query into group search terms.' : 'Expanded your query into search terms.',
    })
  }

  const resultLimit = wantMultiple ? Math.max(limit, 20) : limit

  ensurePersonSearchSummaries(graph)

  steps.push({ id: 'scan', label: 'Scanning contacts and notes' })

  const strictResults = rankGraphSearch(graph, intent, resultLimit)
  if (strictResults.length > 0) {
    steps.push({
      id: 'keyword',
      label: 'Found keyword matches',
      detail: `${strictResults.length} direct match${strictResults.length === 1 ? '' : 'es'}`,
    })
  }

  const candidates = collectPersonCandidates(graph, searchTerms, {
    max: wantMultiple ? 60 : 45,
    includeAllNoted: isRelational || wantMultiple || strictResults.length === 0,
  }).map((person) => buildPersonCandidateSummary(graph, person))

  steps.push({
    id: 'candidates',
    label: 'Reviewing candidates with AI',
    detail: `${candidates.length} profile${candidates.length === 1 ? '' : 's'} with notes or term hits`,
  })

  const pipeline = await runGroupMatchPipeline(graph, trimmed, trimmed, searchTerms, {
    wantMultiple,
    limit: resultLimit,
    verify: true,
  })

  let normalizedMatches = pipeline.matches

  if (pipeline.usedLocalFallback && normalizedMatches.length > 0) {
    steps.push({
      id: 'local-group',
      label: 'Used local term matches',
      detail: `${normalizedMatches.length} profile${normalizedMatches.length === 1 ? '' : 's'} matched search terms`,
    })
  } else if (normalizedMatches.length === 0 && candidates.length > 0) {
    steps.push({ id: 'retry', label: 'Trying a deeper note pass', detail: 'Looking for semantic fits in private notes' })
    const retryPipeline = await runGroupMatchPipeline(graph, trimmed, `${trimmed} (semantic retry)`, searchTerms, {
      wantMultiple,
      limit: resultLimit,
      verify: false,
    })
    normalizedMatches = retryPipeline.matches
  }

  if (pipeline.verifyRejected > 0) {
    steps.push({
      id: 'verify',
      label: 'Verified matches (helper)',
      detail: `Rejected ${pipeline.verifyRejected} false positive${pipeline.verifyRejected === 1 ? '' : 's'}`,
    })
  }

  if (pipeline.auditAdded > 0) {
    steps.push({
      id: 'audit',
      label: 'Recall audit (code)',
      detail: `Added ${pipeline.auditAdded} strong match${pipeline.auditAdded === 1 ? '' : 'es'} missed by AI`,
    })
  }

  const aiSuggestions: string[] = []
  if (aiSuggestions.length > 0) suggestions = [...new Set([...suggestions, ...aiSuggestions])].slice(0, 4)

  let results: GraphSearchResult[] = []
  let reasons = new Map<string, string>()

  if (normalizedMatches.length > 0) {
    const mapped = graphResultsByIds(graph, normalizedMatches, resultLimit)
    results = mapped.results
    reasons = mapped.reasons
    steps.push({
      id: 'pick',
      label: wantMultiple ? 'AI picked a group (worker)' : 'AI picked matches (worker)',
      detail: `${results.length} suggestion${results.length === 1 ? '' : 's'}`,
    })
  } else if (wantMultiple && strictResults.length > 0) {
    results = strictResults.filter((result) => result.type === 'person').slice(0, resultLimit)
    steps.push({
      id: 'fallback-group',
      label: 'Used keyword matches for group',
      detail: `${results.length} direct match${results.length === 1 ? '' : 'es'}`,
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
        'Try a more specific role, company, event, or relationship phrase',
        'Add notes with the exact context you want the agent to find',
        'Split a broad request into two discovery groups',
      ]
    }
  }

  return {
    query: trimmed,
    mode: 'agent',
    explanation,
    steps,
    suggestions,
    results: buildApiResults(graph, results, reasons, resultLimit),
  }
}
