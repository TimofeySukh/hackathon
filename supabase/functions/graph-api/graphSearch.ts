// Keep in sync with src/lib/search/graphSearch.ts

import { buildPersonSearchSummary, personSearchHaystack, refreshPersonSearchSummary } from './searchSummary.ts'

type CircleNode = { id: string; name: string; parentId: string | null }
type PersonNote = { id: string; title: string; body: string }
type PersonLink = { id: string; label: string; url: string }
export type PersonNode = {
  id: string
  name: string
  circleId: string
  notes?: PersonNote[]
  links?: PersonLink[]
  searchSummary?: string
}
export type GraphState = { circles: CircleNode[]; people: PersonNode[]; connections: unknown[] }

export type CirclePathItem = { id: string; name: string }

export type SearchIntent = {
  nameTokens?: string[]
  keywords?: string[]
  circleNames?: string[]
  role?: string
  preferCircles?: boolean
}

export type GraphSearchPersonResult = {
  type: 'person'
  id: string
  name: string
  circleId: string
  circlePath: CirclePathItem[]
  score: number
  subtitle: string
}

export type GraphSearchCircleResult = {
  type: 'circle'
  id: string
  name: string
  parentId: string | null
  path: CirclePathItem[]
  score: number
  subtitle: string
}

export type GraphSearchResult = GraphSearchPersonResult | GraphSearchCircleResult

const POSITION_NOTE_TITLES = new Set(['position', 'headline', 'title', 'role'])

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[\s,;]+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0)
}

export function getCirclePath(graph: GraphState, circleId: string | null): CircleNode[] {
  const circlesById = new Map(graph.circles.map((circle) => [circle.id, circle]))
  const path: CircleNode[] = []
  let current = circleId ? circlesById.get(circleId) : undefined
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId ? circlesById.get(current.parentId) : undefined
  }
  return path
}

export function formatCirclePath(path: CirclePathItem[]) {
  return path.map((item) => item.name).filter(Boolean).join(' › ')
}

export function getPersonPosition(person: PersonNode) {
  for (const note of person.notes ?? []) {
    if (POSITION_NOTE_TITLES.has(note.title.trim().toLowerCase())) {
      return note.body.trim()
    }
  }
  return undefined
}

function buildPersonHaystack(person: PersonNode, circlePath: CircleNode[], graph?: GraphState) {
  if (graph && person.searchSummary?.trim()) {
    return normalizeText(personSearchHaystack(graph, person))
  }
  const noteText = (person.notes ?? []).map((note) => `${note.title} ${note.body}`).join(' ')
  const linkText = (person.links ?? []).map((link) => `${link.label} ${link.url}`).join(' ')
  const pathText = circlePath.map((circle) => circle.name).join(' ')
  return normalizeText([person.name, pathText, noteText, linkText].filter(Boolean).join(' '))
}

function circleNameMatches(pathNames: string[], target: string) {
  const needle = normalizeText(target)
  if (!needle) return false
  return pathNames.some((name) => name.includes(needle) || needle.includes(name))
}

function scoreNameTokens(name: string, tokens: string[]) {
  let score = 0
  const normalizedName = normalizeText(name)
  const parts = normalizedName.split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (!token) continue
    if (normalizedName === token) score += 120
    else if (normalizedName.includes(token)) score += 100
    else if (parts.some((part) => part.startsWith(token))) score += 80
  }
  return score
}

function scoreKeywords(haystack: string, position: string | undefined, keywords: string[]) {
  let score = 0
  const normalizedPosition = position ? normalizeText(position) : ''
  for (const keyword of keywords) {
    if (!keyword) continue
    if (normalizedPosition.includes(keyword)) score += 40
    else if (haystack.includes(keyword)) score += 20
  }
  return score
}

function scoreCircleFilters(pathNames: string[], circleNames: string[] | undefined) {
  if (!circleNames?.length) return { score: 0, matches: true }
  const matches = circleNames.some((circleName) => circleNameMatches(pathNames, circleName))
  return { score: matches ? 50 : 0, matches }
}

export function parseSimpleQuery(raw: string): SearchIntent {
  const intent: SearchIntent = {}
  let text = raw.trim()
  if (!text) return intent

  const scopedMatch = text.match(
    /\b(?:at|@|in|from|inside|within|из|в|от)\s+([^,?;]+?)(?=$|\s+(?:who|with|named|called|named|named|named)\b)/iu,
  )
  if (scopedMatch) {
    intent.circleNames = [scopedMatch[1].trim()]
    text = `${text.slice(0, scopedMatch.index)} ${text.slice((scopedMatch.index ?? 0) + scopedMatch[0].length)}`.trim()
  }

  const tokens = tokenize(text)
  if (tokens.length === 1) {
    intent.nameTokens = tokens
  } else if (tokens.length > 1) {
    intent.keywords = tokens
  }

  if (/\bcircle\b|\bкруг\b|\bzone\b|\btag\b/i.test(raw)) {
    intent.preferCircles = true
  }

  return intent
}

export function mergeSearchIntent(base: SearchIntent, extra: SearchIntent): SearchIntent {
  return {
    nameTokens: [...(base.nameTokens ?? []), ...(extra.nameTokens ?? [])],
    keywords: [...(base.keywords ?? []), ...(extra.keywords ?? [])],
    circleNames: [...(base.circleNames ?? []), ...(extra.circleNames ?? [])],
    role: extra.role ?? base.role,
    preferCircles: extra.preferCircles ?? base.preferCircles,
  }
}

export function buildSearchIntentFromQuery(raw: string): SearchIntent {
  const trimmed = raw.trim()
  if (!trimmed) return {}
  const parsed = parseSimpleQuery(trimmed)
  const fallbackTokens = tokenize(trimmed)
  if (!parsed.nameTokens?.length && !parsed.keywords?.length && fallbackTokens.length) {
    return mergeSearchIntent(parsed, { keywords: fallbackTokens })
  }
  return parsed
}

function buildPersonSubtitle(person: PersonNode, circlePath: CircleNode[]) {
  const position = getPersonPosition(person)
  const pathLabel = formatCirclePath(circlePath.map((circle) => ({ id: circle.id, name: circle.name })))
  if (position && pathLabel) return `${pathLabel} · ${position}`
  return pathLabel || position || ''
}

function buildCircleSubtitle(path: CircleNode[]) {
  const pathLabel = formatCirclePath(path.map((circle) => ({ id: circle.id, name: circle.name })))
  return pathLabel || 'Circle'
}

function scorePerson(person: PersonNode, intent: SearchIntent, circlePath: CircleNode[], graph: GraphState): number {
  const pathNames = circlePath.map((circle) => normalizeText(circle.name))
  const { score: circleScore, matches } = scoreCircleFilters(pathNames, intent.circleNames)
  if (intent.circleNames?.length && !matches) return 0

  const haystack = buildPersonHaystack(person, circlePath, graph)
  const position = getPersonPosition(person)
  let score = circleScore
  score += scoreNameTokens(person.name, intent.nameTokens ?? [])
  score += scoreKeywords(haystack, position, intent.keywords ?? [])
  if (intent.role) {
    const role = normalizeText(intent.role)
    if (position && normalizeText(position).includes(role)) score += 45
    else if (haystack.includes(role)) score += 15
  }

  if (score === 0 && intent.circleNames?.length) return 0
  return score
}

function scoreCircle(circle: CircleNode, intent: SearchIntent, path: CircleNode[]): number {
  const pathNames = path.map((item) => normalizeText(item.name))
  const name = normalizeText(circle.name)
  let score = 0

  for (const token of intent.nameTokens ?? []) {
    if (name.includes(token)) score += 90
  }
  for (const keyword of intent.keywords ?? []) {
    if (name.includes(keyword)) score += 35
    else if (pathNames.some((part) => part.includes(keyword))) score += 20
  }
  for (const circleName of intent.circleNames ?? []) {
    if (circleNameMatches(pathNames, circleName) || name.includes(normalizeText(circleName))) score += 60
  }
  if (intent.preferCircles) score += 10
  return score
}

export function rankGraphSearch(graph: GraphState, intent: SearchIntent, limit: number): GraphSearchResult[] {
  const peopleResults: GraphSearchPersonResult[] = graph.people
    .map((person) => {
      const circlePath = getCirclePath(graph, person.circleId)
      const score = scorePerson(person, intent, circlePath, graph)
      if (score <= 0) return null
      return {
        type: 'person' as const,
        id: person.id,
        name: person.name,
        circleId: person.circleId,
        circlePath: circlePath.map((circle) => ({ id: circle.id, name: circle.name })),
        score,
        subtitle: buildPersonSubtitle(person, circlePath),
      }
    })
    .filter((result): result is GraphSearchPersonResult => result !== null)

  const circleResults: GraphSearchCircleResult[] = graph.circles
    .map((circle) => {
      const path = getCirclePath(graph, circle.id)
      const score = scoreCircle(circle, intent, path)
      if (score <= 0) return null
      return {
        type: 'circle' as const,
        id: circle.id,
        name: circle.name,
        parentId: circle.parentId,
        path: path.map((item) => ({ id: item.id, name: item.name })),
        score,
        subtitle: buildCircleSubtitle(path),
      }
    })
    .filter((result): result is GraphSearchCircleResult => result !== null)

  const preferCircles = intent.preferCircles === true
  const sorted = [...peopleResults, ...circleResults].sort((left, right) => {
    if (preferCircles) {
      if (left.type !== right.type) {
        if (left.type === 'circle') return -1
        if (right.type === 'circle') return 1
      }
    } else if (left.type !== right.type) {
      if (left.type === 'person') return -1
      if (right.type === 'person') return 1
    }
    return right.score - left.score || left.name.localeCompare(right.name)
  })

  return sorted.slice(0, limit)
}

export function searchGraphByQuery(graph: GraphState, query: string, limit: number): GraphSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const intent = buildSearchIntentFromQuery(trimmed)
  const ranked = rankGraphSearch(graph, intent, limit)
  if (ranked.length > 0) return ranked

  const legacyNeedle = normalizeText(trimmed)
  const circlesById = new Map(graph.circles.map((circle) => [circle.id, circle]))
  const legacyPeople = graph.people
    .filter((person) => {
      const circle = circlesById.get(person.circleId)
      const noteText = (person.notes ?? []).map((note) => `${note.title} ${note.body}`).join(' ')
      const linkText = (person.links ?? []).map((link) => `${link.label} ${link.url}`).join(' ')
      return [person.name, circle?.name, noteText, linkText].filter(Boolean).join(' ').toLowerCase().includes(legacyNeedle)
    })
    .map((person) => {
      const circlePath = getCirclePath(graph, person.circleId)
      return {
        type: 'person' as const,
        id: person.id,
        name: person.name,
        circleId: person.circleId,
        circlePath: circlePath.map((circle) => ({ id: circle.id, name: circle.name })),
        score: 1,
        subtitle: buildPersonSubtitle(person, circlePath),
      }
    })

  const legacyCircles = graph.circles
    .filter((circle) => circle.name.toLowerCase().includes(legacyNeedle))
    .map((circle) => {
      const path = getCirclePath(graph, circle.id)
      return {
        type: 'circle' as const,
        id: circle.id,
        name: circle.name,
        parentId: circle.parentId,
        path: path.map((item) => ({ id: item.id, name: item.name })),
        score: 1,
        subtitle: buildCircleSubtitle(path),
      }
    })

  return [...legacyPeople, ...legacyCircles].slice(0, limit)
}

export function parseSearchIntentJson(raw: string): SearchIntent | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const intent: SearchIntent = {}
    if (Array.isArray(parsed.nameTokens)) {
      intent.nameTokens = parsed.nameTokens.filter((value): value is string => typeof value === 'string').map(normalizeText)
    }
    if (Array.isArray(parsed.keywords)) {
      intent.keywords = parsed.keywords.filter((value): value is string => typeof value === 'string').map(normalizeText)
    }
    if (Array.isArray(parsed.circleNames)) {
      intent.circleNames = parsed.circleNames.filter((value): value is string => typeof value === 'string').map((value) => value.trim())
    }
    if (typeof parsed.role === 'string' && parsed.role.trim()) intent.role = parsed.role.trim()
    if (typeof parsed.preferCircles === 'boolean') intent.preferCircles = parsed.preferCircles
    return intent
  } catch {
    return null
  }
}

export type PersonCandidateSummary = {
  id: string
  name: string
  circle: string
  summary: string
}

function isSpecificTerm(needle: string) {
  return needle.includes(' ') || needle.length >= 8 || /[\d@._-]/.test(needle)
}

function termFieldScore(needle: string, field: 'position' | 'note' | 'name' | 'path' | 'summary') {
  const specific = isSpecificTerm(needle)
  switch (field) {
    case 'position': return specific ? 35 : 12
    case 'note': return specific ? 22 : 10
    case 'name': return 18
    case 'path': return 4
    case 'summary': return 8
  }
}

/** Weighted term score: role/notes >> name >> circle path. Generic single tokens score lower. */
export function scorePersonByTerms(graph: GraphState, person: PersonNode, terms: string[]): number {
  const circlePath = getCirclePath(graph, person.circleId)
  const position = getPersonPosition(person)
  const normalizedPosition = position ? normalizeText(position) : ''
  const nameHay = normalizeText(person.name)
  const noteHay = normalizeText((person.notes ?? []).map((note) => `${note.title} ${note.body}`).join(' '))
  const pathHay = normalizeText(circlePath.map((circle) => circle.name).join(' '))
  const summaryHay = normalizeText(personSearchHaystack(graph, person))

  let score = 0
  for (const term of terms) {
    const needle = normalizeText(term)
    if (!needle || needle.length < 2) continue
    if (normalizedPosition.includes(needle)) score += termFieldScore(needle, 'position')
    else if (noteHay.includes(needle)) score += termFieldScore(needle, 'note')
    else if (nameHay.includes(needle)) score += termFieldScore(needle, 'name')
    else if (summaryHay.includes(needle) && !pathHay.includes(needle)) score += termFieldScore(needle, 'summary')
    else if (pathHay.includes(needle)) score += termFieldScore(needle, 'path')
    else if (summaryHay.includes(needle)) score += termFieldScore(needle, 'summary')
  }
  return score
}

function scorePersonLoose(person: PersonNode, terms: string[], _circlePath: CircleNode[], graph: GraphState) {
  return scorePersonByTerms(graph, person, terms)
}

export function buildPersonCandidateSummary(graph: GraphState, person: PersonNode): PersonCandidateSummary {
  if (!person.searchSummary?.trim()) {
    refreshPersonSearchSummary(graph, person)
  }
  const circlePath = getCirclePath(graph, person.circleId)
  return {
    id: person.id,
    name: person.name,
    circle: formatCirclePath(circlePath.map((circle) => ({ id: circle.id, name: circle.name }))),
    summary: person.searchSummary ?? buildPersonSearchSummary(graph, person),
  }
}

export function rankPeopleByTerms(
  graph: GraphState,
  terms: string[],
  options: { max: number; includeAllNoted?: boolean; minScore?: number },
) {
  const ranked: Array<{ person: PersonNode; score: number }> = []
  const seen = new Set<string>()
  const minScore = options.minScore ?? 1

  for (const person of graph.people) {
    const circlePath = getCirclePath(graph, person.circleId)
    const score = scorePersonLoose(person, terms, circlePath, graph)
    if (score < minScore) continue
    ranked.push({ person, score })
    seen.add(person.id)
  }

  if (options.includeAllNoted) {
    for (const person of graph.people) {
      if (seen.has(person.id)) continue
      if ((person.notes?.length ?? 0) === 0) continue
      ranked.push({ person, score: 1 })
      seen.add(person.id)
    }
  }

  ranked.sort((left, right) => right.score - left.score || left.person.name.localeCompare(right.person.name))
  return ranked.slice(0, options.max).map((entry) => entry.person)
}

export function collectPersonCandidates(
  graph: GraphState,
  terms: string[],
  options: { max: number; includeAllNoted: boolean },
) {
  return rankPeopleByTerms(graph, terms, {
    max: options.max,
    includeAllNoted: options.includeAllNoted,
    minScore: 1,
  })
}

export function toApiSearchResults(
  results: GraphSearchResult[],
  reasons?: Map<string, string>,
) {
  return results.map((result) => {
    const aiReason = reasons?.get(result.id)
    if (result.type === 'person') {
      return {
        type: 'person',
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
      type: 'circle',
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
