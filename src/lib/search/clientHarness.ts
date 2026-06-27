/**
 * Browser-side search harness (deterministic, no LLM). Mirrors scripts/lib/synthetic-search-graph.mjs.
 */

import type { GraphState, PersonNode } from '../board/types'
import { getCirclePath, getPersonPosition } from './graphSearch'
import { computeAutoGroupLimit } from './groupResultLimit'
import { personSearchHaystack } from './searchSummary'

export type ScoredMatch = { id: string; confidence: number; reason: string }

export type PersonCandidateSummary = {
  id: string
  name: string
  circle: string
  summary: string
}

const TERM_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'could', 'for', 'from', 'give', 'good', 'have',
  'help', 'i', 'in', 'is', 'me', 'my', 'of', 'on', 'or', 'people', 'person', 'that', 'the',
  'them', 'they', 'to', 'who', 'with', 'would',
  'а', 'в', 'дать', 'для', 'и', 'или', 'как', 'которые', 'кто', 'людей', 'люди', 'мне',
  'могут', 'мой', 'моя', 'мою', 'на', 'найди', 'найти', 'по', 'с', 'так', 'что',
])

function getPersonPositionLocal(person: PersonNode) {
  return getPersonPosition(person)
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

function uniqueTerms(...groups: string[][]) {
  return [...new Set(groups.flat().map((term) => term.toLowerCase().trim()).filter(Boolean))]
}

export function expandSearchTerms(
  query: string,
  baseTerms: string[],
  _flags: { isRelational?: boolean; wantMultiple?: boolean } = {},
) {
  void _flags
  return uniqueTerms(baseTerms, extractQueryTerms(query))
}

export function scorePersonByTerms(graph: GraphState, person: PersonNode, terms: string[]) {
  const path = getCirclePath(graph, person.circleId)
  const position = getPersonPositionLocal(person)
  const normalizedPosition = (position ?? '').toLowerCase()
  const nameHay = person.name.toLowerCase()
  const noteHay = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
  const pathHay = path.map((c) => c.name).join(' ').toLowerCase()
  const summaryHay = personSearchHaystack(graph, person)

  const isSpecific = (needle: string) => needle.includes(' ') || needle.length >= 8 || /[\d@._-]/.test(needle)
  const fieldScore = (needle: string, field: string) => {
    const s = isSpecific(needle)
    if (field === 'position') return s ? 35 : 12
    if (field === 'note') return s ? 22 : 10
    if (field === 'name') return 18
    if (field === 'path') return 4
    return 8
  }

  let score = 0
  for (const term of terms) {
    const needle = term.toLowerCase().trim()
    if (!needle || needle.length < 2) continue
    if (normalizedPosition.includes(needle)) score += fieldScore(needle, 'position')
    else if (noteHay.includes(needle)) score += fieldScore(needle, 'note')
    else if (nameHay.includes(needle)) score += fieldScore(needle, 'name')
    else if (summaryHay.includes(needle) && !pathHay.includes(needle)) score += fieldScore(needle, 'summary')
    else if (pathHay.includes(needle)) score += fieldScore(needle, 'path')
    else if (summaryHay.includes(needle)) score += fieldScore(needle, 'summary')
  }
  return score
}

export function filterAuditTerms(terms: string[]) {
  return terms.filter((term) => {
    const needle = term.toLowerCase().trim()
    if (!needle || TERM_STOPWORDS.has(needle)) return false
    return needle.includes(' ') || needle.length >= 5 || /[\d@._-]/.test(needle)
  })
}

export function passesQueryStrongTier(graph: GraphState, person: PersonNode, query: string, terms: string[]) {
  const tierTerms = filterAuditTerms(terms)
  const activeTerms = tierTerms.length > 0 ? tierTerms : terms
  return scorePersonByTerms(graph, person, uniqueTerms(activeTerms, extractQueryTerms(query))) >= 20
}

export function collectGroupCandidates(
  graph: GraphState,
  terms: string[],
  llmCap: number,
  forceIds: string[] = [],
) {
  const strongMin = 20
  const weakMin = 4
  const strong: Array<{ person: PersonNode; score: number }> = []
  const weak: Array<{ person: PersonNode; score: number }> = []
  const forced = new Set(forceIds)

  for (const id of forceIds) {
    const person = graph.people.find((p) => p.id === id)
    if (person) strong.push({ person, score: 1000 })
  }

  for (const person of graph.people) {
    if (forced.has(person.id)) continue
    const score = scorePersonByTerms(graph, person, terms)
    if (score >= strongMin) strong.push({ person, score })
    else if (score >= weakMin) weak.push({ person, score })
  }

  strong.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
  weak.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))

  const seen = new Set<string>()
  const ordered: PersonNode[] = []
  for (const entry of strong) {
    if (seen.has(entry.person.id)) continue
    seen.add(entry.person.id)
    ordered.push(entry.person)
  }
  for (const entry of weak) {
    if (seen.has(entry.person.id)) continue
    if (ordered.length >= llmCap) break
    seen.add(entry.person.id)
    ordered.push(entry.person)
  }

  return { people: ordered, strongCount: strong.length }
}

export function toCandidateSummaries(graph: GraphState, people: PersonNode[]): PersonCandidateSummary[] {
  return people.map((person) => {
    const path = getCirclePath(graph, person.circleId)
    return {
      id: person.id,
      name: person.name,
      circle: path.map((c) => c.name).join(' › '),
      summary: person.searchSummary ?? personSearchHaystack(graph, person),
    }
  })
}

export function auditStrongTermGaps(graph: GraphState, terms: string[], existingIds: string[], query = '') {
  const tierTerms = filterAuditTerms(terms)
  const activeTerms = tierTerms.length > 0 ? tierTerms : terms
  const seen = new Set(existingIds)
  const gaps: string[] = []
  for (const person of graph.people) {
    if (seen.has(person.id)) continue
    if (query.trim()) {
      if (!passesQueryStrongTier(graph, person, query, terms)) continue
    } else if (scorePersonByTerms(graph, person, activeTerms) < 20) {
      continue
    }
    gaps.push(person.id)
    seen.add(person.id)
  }
  return gaps
}

export function localGroupFallback(
  graph: GraphState,
  candidates: PersonCandidateSummary[],
  searchTerms: string[],
  limit: number,
  strongCount: number,
  query = '',
): ScoredMatch[] {
  if (strongCount > 0) {
    const tierTerms = filterAuditTerms(searchTerms)
    const activeTerms = tierTerms.length > 0 ? tierTerms : searchTerms
    const strong = candidates
      .filter((candidate) => {
        const person = graph.people.find((p) => p.id === candidate.id)
        if (!person) return false
        if (query.trim()) return passesQueryStrongTier(graph, person, query, searchTerms)
        return scorePersonByTerms(graph, person, activeTerms) >= 20
      })
      .sort((a, b) => {
        const pa = graph.people.find((p) => p.id === a.id)
        const pb = graph.people.find((p) => p.id === b.id)
        return scorePersonByTerms(graph, pb!, activeTerms) - scorePersonByTerms(graph, pa!, activeTerms)
          || a.name.localeCompare(b.name)
      })
    if (strong.length > 0) {
      return strong.slice(0, limit).map((c) => ({
        id: c.id,
        confidence: 0.72,
        reason: 'Strong tier match (local harness)',
      }))
    }
  }

  const scored = candidates
    .map((candidate) => {
      const person = graph.people.find((p) => p.id === candidate.id)
      const score = person ? scorePersonByTerms(graph, person, searchTerms) : 0
      return { candidate, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))

  return scored.slice(0, limit).map((entry) => ({
    id: entry.candidate.id,
    confidence: Math.min(0.78, 0.42 + entry.score / 80),
    reason: 'Scored fallback (local harness)',
  }))
}

export function runLocalGroupPipeline(
  graph: GraphState,
  query: string,
  groupLabel: string,
  searchTerms: string[],
  options: { wantMultiple: boolean; limit?: number },
) {
  const llmCap = Math.min(100, Math.max(45, Math.ceil(graph.people.length * 0.03)))
  const { people, strongCount } = collectGroupCandidates(graph, searchTerms, llmCap)
  const limit = options.limit ?? computeAutoGroupLimit(strongCount, graph.people.length)
  const candidates = toCandidateSummaries(graph, people)
  let matches = localGroupFallback(graph, candidates, searchTerms, limit, strongCount, query)
  const usedLocalFallback = matches.length > 0

  const auditGaps = options.wantMultiple
    ? auditStrongTermGaps(graph, searchTerms, matches.map((m) => m.id), query)
    : []
  const before = matches.length
  const merged = [...new Set([...matches.map((m) => m.id), ...auditGaps])].slice(0, limit)
  matches = merged.map((id) => {
    const existing = matches.find((m) => m.id === id)
    return existing ?? { id, confidence: 0.68, reason: 'Recall audit (local harness)' }
  })

  return {
    matches,
    candidates,
    strongCount,
    limit,
    auditAdded: Math.max(0, matches.length - before),
    verifyRejected: 0,
    usedLocalFallback,
    groupLabel,
  }
}
