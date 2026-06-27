import {
  buildPersonCandidateSummary,
  scorePersonByTerms,
  type GraphState,
  type PersonCandidateSummary,
} from './graphSearch.ts'
import { callHelperLlm, callWorkerLlm, supportsStrictJsonSchema, getWorkerLlmProvider, getHelperLlmProvider } from './llmProvider.ts'

export type ScoredMatch = {
  id: string
  confidence: number
  reason: string
}

export type MatchResultPayload = {
  matches?: Array<{ id?: string; confidence?: number; reason?: string } | string>
  suggestions?: string[]
}

export type VerifyDecision = {
  id: string
  accept: boolean
  reason: string
}

const PLACEHOLDER_IDS = new Set(['person-id', 'person_id', 'candidate-id', 'id'])
const TERM_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'could', 'for', 'from', 'give', 'good', 'have',
  'help', 'i', 'in', 'is', 'me', 'my', 'of', 'on', 'or', 'people', 'person', 'that', 'the',
  'them', 'they', 'to', 'who', 'with', 'would',
  'а', 'в', 'дать', 'для', 'и', 'или', 'как', 'которые', 'кто', 'людей', 'люди', 'мне',
  'могут', 'мой', 'моя', 'мою', 'на', 'найди', 'найти', 'по', 'с', 'так', 'что',
])

const MATCH_GROUP_PROMPT = `You pick ALL people from candidates that fit this group search.
Return ONLY JSON:
{
  "matches": [
    { "id": "<exact id from candidates>", "confidence": 0.0, "reason": "short explanation in user language" }
  ],
  "suggestions": []
}

Rules:
- GROUP search: return every fitting candidate in this batch, not just one
- Only use exact ids from candidates — never placeholders
- confidence 0..1, include matches >= 0.35
- reason must cite summary or circle when possible
- Do not wrap JSON in markdown`

const MATCH_SINGLE_PROMPT = `You pick the best person from candidates for a single-target search.
Return ONLY JSON:
{
  "matches": [{ "id": "<exact id>", "confidence": 0.0, "reason": "..." }],
  "suggestions": []
}
Only exact ids from candidates. confidence >= 0.45. No markdown.`

const VERIFY_PROMPT = `You verify proposed graph-search matches. The model proposed them; your job is to REJECT clear false positives only.
Return ONLY JSON:
{
  "decisions": [
    { "id": "<exact id>", "accept": true, "reason": "short note" }
  ]
}

Rules:
- accept=true when the profile plausibly fits the query/group (benefit of the doubt)
- accept=false ONLY when the profile clearly does NOT fit (wrong company, wrong role, unrelated)
- Use only provided ids
- Do not wrap JSON in markdown`

function normalizeTerm(value: string) {
  return value.toLowerCase().trim()
}

function tokenizeForSearch(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}@._-]+/u)
    .map((token) => token.replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}]+$/gu, '').trim())
    .filter((token) => token.length > 1 && !TERM_STOPWORDS.has(token))
}

function extractQueryTerms(query: string) {
  const tokens = tokenizeForSearch(query)
  const terms = [...tokens]
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      terms.push(tokens.slice(index, index + size).join(' '))
    }
  }
  return terms
}

function isStrongAuditTerm(term: string) {
  const needle = normalizeTerm(term)
  if (!needle || TERM_STOPWORDS.has(needle)) return false
  return needle.includes(' ') || needle.length >= 5 || /[\d@._-]/.test(needle)
}

export function passesQueryStrongTier(
  graph: GraphState,
  person: GraphState['people'][number],
  query: string,
  terms: string[],
) {
  const tierTerms = filterAuditTerms(terms)
  const activeTerms = tierTerms.length > 0 ? tierTerms : terms
  const queryTerms = extractQueryTerms(query)
  return scorePersonByTerms(graph, person, uniqueTerms(activeTerms, queryTerms)) >= 20
}

export function filterAuditTerms(terms: string[]) {
  return terms.filter(isStrongAuditTerm)
}

export function expandSearchTerms(
  terms: string[],
  options: { query: string; isRelational?: boolean; wantMultiple?: boolean },
) {
  return uniqueTerms(terms, extractQueryTerms(options.query))
}

export function uniqueTerms(...groups: Array<string[] | undefined>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    for (const term of group ?? []) {
      const value = term.trim()
      if (!value) continue
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(value)
    }
  }
  return out
}

export function parseJsonObject<T>(raw: string): T | null {
  const trimmed = raw.trim().replace(/<\/?think>/gi, '')
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  try {
    return JSON.parse(jsonText) as T
  } catch {
    return null
  }
}

export function normalizeMatchResults(
  payload: MatchResultPayload | null,
  validIds: Set<string>,
  minConfidence: number,
): ScoredMatch[] {
  const normalized: ScoredMatch[] = []
  const seen = new Set<string>()

  for (const match of payload?.matches ?? []) {
    if (typeof match === 'string') {
      const id = match.trim()
      if (!id || !validIds.has(id) || PLACEHOLDER_IDS.has(id) || seen.has(id)) continue
      seen.add(id)
      normalized.push({ id, confidence: 0.55, reason: 'Matched by AI' })
      continue
    }

    if (!match || typeof match !== 'object') continue
    const id = typeof match.id === 'string' ? match.id.trim() : ''
    if (!id || !validIds.has(id) || PLACEHOLDER_IDS.has(id) || seen.has(id)) continue
    const confidence = typeof match.confidence === 'number' ? match.confidence : 0.5
    if (confidence < minConfidence) continue
    seen.add(id)
    normalized.push({
      id,
      confidence,
      reason: typeof match.reason === 'string' && match.reason.trim() ? match.reason.trim() : 'Matched by AI',
    })
  }

  return normalized
}

/** Tiered prefilter: all strong role/note hits, then weak hits up to cap. */
export function collectGroupCandidates(
  graph: GraphState,
  terms: string[],
  options: { llmCap: number; strongMinScore?: number; weakMinScore?: number },
) {
  const strongMin = options.strongMinScore ?? 20
  const weakMin = options.weakMinScore ?? 4
  const strong: Array<{ person: GraphState['people'][number]; score: number }> = []
  const weak: Array<{ person: GraphState['people'][number]; score: number }> = []

  for (const person of graph.people) {
    const score = scorePersonByTerms(graph, person, terms)
    if (score >= strongMin) strong.push({ person, score })
    else if (score >= weakMin) weak.push({ person, score })
  }

  strong.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
  weak.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))

  const seen = new Set<string>()
  const ordered: GraphState['people'][number][] = []
  for (const entry of strong) {
    if (seen.has(entry.person.id)) continue
    seen.add(entry.person.id)
    ordered.push(entry.person)
  }
  for (const entry of weak) {
    if (seen.has(entry.person.id)) continue
    if (ordered.length >= options.llmCap) break
    seen.add(entry.person.id)
    ordered.push(entry.person)
  }

  return {
    people: ordered,
    strongCount: strong.length,
    weakCount: weak.length,
  }
}

export function localGroupFallback(
  graph: GraphState | null,
  candidates: PersonCandidateSummary[],
  searchTerms: string[],
  limit: number,
  strongCount = 0,
  query = '',
): ScoredMatch[] {
  if (graph && strongCount > 0) {
    const peopleById = new Map(graph.people.map((person) => [person.id, person]))
    const tierTerms = filterAuditTerms(searchTerms)
    const activeTerms = tierTerms.length > 0 ? tierTerms : searchTerms
    const strong = candidates
      .filter((candidate) => {
        const person = peopleById.get(candidate.id)
        if (!person) return false
        if (query.trim()) return passesQueryStrongTier(graph, person, query, searchTerms)
        return scorePersonByTerms(graph, person, activeTerms) >= 20
      })
      .sort((left, right) => {
        const leftScore = scorePersonByTerms(graph, peopleById.get(left.id)!, activeTerms)
        const rightScore = scorePersonByTerms(graph, peopleById.get(right.id)!, activeTerms)
        return rightScore - leftScore || left.name.localeCompare(right.name)
      })

    if (strong.length > 0) {
      return strong.slice(0, limit).map((candidate) => ({
        id: candidate.id,
        confidence: Math.min(0.82, 0.55 + scorePersonByTerms(graph, peopleById.get(candidate.id)!, activeTerms) / 100),
        reason: 'Strong profile match (deterministic tier)',
      }))
    }
  }

  if (graph) {
    const peopleById = new Map(graph.people.map((person) => [person.id, person]))
    const scored = candidates
      .map((candidate) => {
        const person = peopleById.get(candidate.id)
        const score = person ? scorePersonByTerms(graph, person, searchTerms) : 0
        return { candidate, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))

    return scored.slice(0, limit).map((entry) => ({
      id: entry.candidate.id,
      confidence: Math.min(0.78, 0.42 + entry.score / 80),
      reason: `Matched profile signals (${entry.score} score)`,
    }))
  }

  const terms = searchTerms
    .map((term) => term.toLowerCase().trim())
    .filter((term) => term.length > 2 && !TERM_STOPWORDS.has(term))
  const scored = candidates
    .map((candidate) => {
      const haystack = [candidate.name, candidate.circle, candidate.summary].join(' ').toLowerCase()
      let hits = 0
      for (const term of terms) {
        if (haystack.includes(term)) hits += 1
      }
      return { candidate, hits }
    })
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits || left.candidate.name.localeCompare(right.candidate.name))

  return scored.slice(0, limit).map((entry) => ({
    id: entry.candidate.id,
    confidence: Math.min(0.78, 0.42 + entry.hits * 0.08),
    reason: `Matched ${entry.hits} search term${entry.hits === 1 ? '' : 's'} in profile`,
  }))
}

/** Deterministic recall audit: union strong term hits missing from AI output. */
export function auditStrongTermGaps(
  graph: GraphState,
  terms: string[],
  existing: ScoredMatch[],
  options: { strongMinScore?: number; label: string; query?: string },
): ScoredMatch[] {
  const strongMin = options.strongMinScore ?? 20
  const auditTerms = filterAuditTerms(terms)
  const activeTerms = auditTerms.length > 0 ? auditTerms : terms
  const seen = new Set(existing.map((match) => match.id))
  const gaps: ScoredMatch[] = []

  for (const person of graph.people) {
    if (seen.has(person.id)) continue
    if (options.query?.trim()) {
      if (!passesQueryStrongTier(graph, person, options.query, terms)) continue
    } else {
      const score = scorePersonByTerms(graph, person, activeTerms)
      if (score < strongMin) continue
    }
    gaps.push({
      id: person.id,
      confidence: Math.min(0.85, 0.55),
      reason: `Strong ${options.label} signal in role/notes (verified by scan)`,
    })
    seen.add(person.id)
  }

  gaps.sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
  return gaps
}

function buildMatchResponseFormat(candidateIds: string[], maxItems: number) {
  const ids = candidateIds.length > 0 ? candidateIds : ['__none__']
  return {
    type: 'json_schema',
    json_schema: {
      name: 'search_group_matches',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', enum: ids },
                confidence: { type: 'number' },
                reason: { type: 'string' },
              },
              required: ['id', 'confidence', 'reason'],
              additionalProperties: false,
            },
            maxItems,
          },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['matches', 'suggestions'],
        additionalProperties: false,
      },
    },
  }
}

function buildVerifyResponseFormat(ids: string[]) {
  const enumIds = ids.length > 0 ? ids : ['__none__']
  return {
    type: 'json_schema',
    json_schema: {
      name: 'verify_search_matches',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          decisions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', enum: enumIds },
                accept: { type: 'boolean' },
                reason: { type: 'string' },
              },
              required: ['id', 'accept', 'reason'],
              additionalProperties: false,
            },
          },
        },
        required: ['decisions'],
        additionalProperties: false,
      },
    },
  }
}

function llmCapForGraph(peopleCount: number) {
  if (peopleCount >= 2000) return 120
  if (peopleCount >= 800) return 90
  if (peopleCount >= 300) return 70
  return 50
}

export function candidateCapForGraph(peopleCount: number) {
  return llmCapForGraph(peopleCount)
}

/** Agent-chosen cap: every strong-tier match plus recall audit slack. */
export function computeAutoGroupLimit(strongCount: number, peopleInGraph: number): number {
  if (strongCount > 0) return Math.min(peopleInGraph, strongCount + 12)
  return Math.min(48, Math.max(12, Math.ceil(peopleInGraph * 0.02)))
}

async function matchBatch(
  query: string,
  groupLabel: string,
  candidates: PersonCandidateSummary[],
  wantMultiple: boolean,
): Promise<{ payload: MatchResultPayload | null; provider: string | null }> {
  if (candidates.length === 0) return { payload: { matches: [], suggestions: [] }, provider: null }

  const worker = getWorkerLlmProvider()
  const responseFormat = worker && supportsStrictJsonSchema(worker.model)
    ? buildMatchResponseFormat(candidates.map((c) => c.id), wantMultiple ? 20 : 3)
    : null

  const { content, provider } = await callWorkerLlm({
    system: wantMultiple ? MATCH_GROUP_PROMPT : MATCH_SINGLE_PROMPT,
    user: {
      query,
      group: groupLabel,
      candidates,
    },
    maxTokens: wantMultiple ? 1200 : 500,
    responseFormat,
  })

  if (!content) return { payload: null, provider }
  return { payload: parseJsonObject<MatchResultPayload>(content), provider }
}

export async function batchMatchCandidates(
  query: string,
  groupLabel: string,
  candidates: PersonCandidateSummary[],
  wantMultiple: boolean,
  limit: number,
): Promise<{ matches: ScoredMatch[]; llmCalls: number; providers: string[] }> {
  const BATCH = 18
  const validIds = new Set(candidates.map((c) => c.id))
  const merged = new Map<string, ScoredMatch>()
  const minConfidence = wantMultiple ? 0.35 : 0.45
  let llmCalls = 0
  const providers: string[] = []

  for (let offset = 0; offset < candidates.length; offset += BATCH) {
    const batch = candidates.slice(offset, offset + BATCH)
    const { payload, provider } = await matchBatch(query, groupLabel, batch, wantMultiple)
    llmCalls += 1
    if (provider && !providers.includes(provider)) providers.push(provider)
    for (const match of normalizeMatchResults(payload, validIds, minConfidence)) {
      const existing = merged.get(match.id)
      if (!existing || match.confidence > existing.confidence) {
        merged.set(match.id, match)
      }
    }
    if (!wantMultiple && merged.size > 0) break
    if (wantMultiple && merged.size >= limit) break
  }

  const matches = [...merged.values()]
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
    .slice(0, limit)
  return { matches, llmCalls, providers }
}

export async function verifyMatchesWithHelper(
  query: string,
  groupLabel: string,
  matches: ScoredMatch[],
  candidatesById: Map<string, PersonCandidateSummary>,
): Promise<{ accepted: ScoredMatch[]; rejected: number; llmCalls: number; providers: string[] }> {
  if (matches.length === 0) return { accepted: [], rejected: 0, llmCalls: 0, providers: [] }

  const VERIFY_BATCH = 10
  const accepted: ScoredMatch[] = []
  let rejected = 0
  let llmCalls = 0
  const providers: string[] = []

  for (let offset = 0; offset < matches.length; offset += VERIFY_BATCH) {
    const batch = matches.slice(offset, offset + VERIFY_BATCH)
    const helper = getHelperLlmProvider()
    const responseFormat = helper && supportsStrictJsonSchema(helper.model)
      ? buildVerifyResponseFormat(batch.map((m) => m.id))
      : null

    const { content, provider } = await callHelperLlm({
      system: VERIFY_PROMPT,
      user: {
        query,
        group: groupLabel,
        proposed: batch.map((match) => ({
          id: match.id,
          proposedReason: match.reason,
          profile: candidatesById.get(match.id),
        })),
      },
      maxTokens: 400,
      responseFormat,
    })
    llmCalls += 1
    if (provider && !providers.includes(provider)) providers.push(provider)

    const payload = content ? parseJsonObject<{ decisions?: VerifyDecision[] }>(content) : null
    const decisions = new Map<string, VerifyDecision>()
    for (const decision of payload?.decisions ?? []) {
      if (typeof decision.id === 'string') decisions.set(decision.id, decision)
    }

    for (const match of batch) {
      const decision = decisions.get(match.id)
      if (decision && decision.accept === false) {
        rejected += 1
        continue
      }
      accepted.push({
        ...match,
        reason: decision?.reason?.trim() || match.reason,
        confidence: decision?.accept === true ? Math.min(1, match.confidence + 0.05) : match.confidence,
      })
    }
  }

  return { accepted, rejected, llmCalls, providers }
}

export function mergeValidatedMatches(
  primary: ScoredMatch[],
  auditGaps: ScoredMatch[],
  limit: number,
): ScoredMatch[] {
  const merged = new Map<string, ScoredMatch>()
  for (const match of [...primary, ...auditGaps]) {
    const existing = merged.get(match.id)
    if (!existing || match.confidence > existing.confidence) {
      merged.set(match.id, match)
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))
    .slice(0, limit)
}

export async function runGroupMatchPipeline(
  graph: GraphState,
  query: string,
  groupLabel: string,
  searchTerms: string[],
  options: {
    wantMultiple: boolean
    limit?: number
    verify: boolean
  },
): Promise<{
  matches: ScoredMatch[]
  candidates: PersonCandidateSummary[]
  strongCount: number
  auditAdded: number
  verifyRejected: number
  usedLocalFallback: boolean
  limit: number
  llmCalls: number
  providers: string[]
}> {
  const llmCap = candidateCapForGraph(graph.people.length)
  const { people, strongCount } = collectGroupCandidates(graph, searchTerms, { llmCap })
  const limit = options.limit ?? computeAutoGroupLimit(strongCount, graph.people.length)
  const candidates = people.map((person) => buildPersonCandidateSummary(graph, person))
  const candidatesById = new Map(candidates.map((c) => [c.id, c]))

  let llmCalls = 0
  const batchResult = await batchMatchCandidates(query, groupLabel, candidates, options.wantMultiple, limit)
  let matches = batchResult.matches
  llmCalls += batchResult.llmCalls
  const providers = [...batchResult.providers]
  let usedLocalFallback = false

  if (matches.length === 0 && candidates.length > 0) {
    matches = localGroupFallback(graph, candidates, searchTerms, limit, strongCount, query)
    usedLocalFallback = matches.length > 0
    llmCalls = 0
  }

  let verifyRejected = 0
  if (options.verify && matches.length > 0 && !usedLocalFallback) {
    const verified = await verifyMatchesWithHelper(query, groupLabel, matches, candidatesById)
    matches = verified.accepted
    verifyRejected = verified.rejected
    llmCalls += verified.llmCalls
    for (const provider of verified.providers) {
      if (!providers.includes(provider)) providers.push(provider)
    }
  }

  const auditGaps = options.wantMultiple
    ? auditStrongTermGaps(graph, searchTerms, matches, { label: groupLabel, query })
    : []

  const beforeAudit = matches.length
  matches = mergeValidatedMatches(matches, auditGaps, limit)
  const auditAdded = Math.max(0, matches.length - beforeAudit)

  return {
    matches,
    candidates,
    strongCount,
    auditAdded,
    verifyRejected,
    usedLocalFallback,
    limit,
    llmCalls,
    providers,
  }
}

export { MATCH_SINGLE_PROMPT, MATCH_GROUP_PROMPT, VERIFY_PROMPT }
