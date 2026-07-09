import type { CircleNode, GraphState, PersonNode } from '../board/types'

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
  aiReason?: string
}

export type GraphSearchCircleResult = {
  type: 'circle'
  id: string
  name: string
  parentId: string | null
  path: CirclePathItem[]
  score: number
  subtitle: string
  aiReason?: string
}

export type GraphSearchResult = GraphSearchPersonResult | GraphSearchCircleResult

type SearchDoc = {
  key: string
  type: 'person' | 'circle'
  name: string
  nameText: string
  nameTokens: string[]
  circleText: string
  roleText: string
  noteText: string
  linkText: string
  allText: string
  result: GraphSearchResult
}

type SearchArm = 'exact' | 'name' | 'role' | 'notes' | 'circle' | 'links' | 'coverage'

const POSITION_NOTE_TITLES = new Set(['position', 'headline', 'title', 'role', 'specialist'])
const RRF_K = 60
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'is',
  'me',
  'of',
  'on',
  'or',
  'the',
  'to',
  'who',
  'with',
  'в',
  'и',
  'из',
  'к',
  'кто',
  'на',
  'от',
  'по',
  'с',
  'у',
])

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

function tokenize(value: string, options: { keepStopWords?: boolean } = {}) {
  const matches = normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? []
  return matches.filter((token) => token.length > 0 && (options.keepStopWords || !STOP_WORDS.has(token)))
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const normalized = normalizeText(value)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }
  return output
}

function queryTokens(intent: SearchIntent) {
  return unique([...(intent.nameTokens ?? []), ...(intent.keywords ?? []), intent.role ?? ''])
}

function queryPhrase(intent: SearchIntent) {
  return queryTokens(intent).join(' ').trim()
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

function circleNameMatches(pathNames: string[], target: string) {
  const needle = normalizeText(target)
  if (!needle) return false
  return pathNames.some((name) => name === needle || name.includes(needle) || needle.includes(name))
}

function matchesCircleFilter(doc: SearchDoc, circleNames: string[] | undefined) {
  if (!circleNames?.length) return true
  const pathNames = doc.circleText.split(' › ').map(normalizeText).filter(Boolean)
  return circleNames.some((circleName) => circleNameMatches(pathNames, circleName))
}

function scoreText(text: string, tokens: string[], phrase: string, weights: { exact: number; phrase: number; token: number; prefix?: number }) {
  if (!text || tokens.length === 0) return 0
  let score = 0
  if (phrase && text === phrase) score += weights.exact
  else if (phrase && text.includes(phrase)) score += weights.phrase

  const textTokens = new Set(tokenize(text, { keepStopWords: true }))
  for (const token of tokens) {
    if (textTokens.has(token)) score += weights.token
    else if (weights.prefix && [...textTokens].some((part) => part.startsWith(token))) score += weights.prefix
    else if (text.includes(token)) score += Math.max(1, Math.round(weights.token * 0.45))
  }
  return score
}

function coverageScore(doc: SearchDoc, tokens: string[]) {
  if (tokens.length === 0) return 0
  const matched = tokens.filter((token) => doc.allText.includes(token)).length
  if (matched === 0) return 0
  const coverage = matched / tokens.length
  return Math.round(coverage * 80) + (matched === tokens.length ? 35 : 0)
}

function buildSearchDocs(graph: GraphState): SearchDoc[] {
  const peopleDocs: SearchDoc[] = graph.people.map((person) => {
    const circlePath = getCirclePath(graph, person.circleId)
    const pathItems = circlePath.map((circle) => ({ id: circle.id, name: circle.name }))
    const circleText = formatCirclePath(pathItems)
    const roleText = normalizeText(getPersonPosition(person) ?? '')
    const noteText = normalizeText((person.notes ?? []).map((note) => `${note.title} ${note.body}`).join(' '))
    const linkText = normalizeText((person.links ?? []).map((link) => `${link.label} ${link.url}`).join(' '))
    const nameText = normalizeText(person.name)
    const allText = [nameText, normalizeText(circleText), roleText, noteText, linkText].filter(Boolean).join(' ')
    return {
      key: `person:${person.id}`,
      type: 'person',
      name: person.name,
      nameText,
      nameTokens: tokenize(person.name, { keepStopWords: true }),
      circleText: normalizeText(circleText),
      roleText,
      noteText,
      linkText,
      allText,
      result: {
        type: 'person',
        id: person.id,
        name: person.name,
        circleId: person.circleId,
        circlePath: pathItems,
        score: 0,
        subtitle: buildPersonSubtitle(person, circlePath),
      },
    }
  })

  const circleDocs: SearchDoc[] = graph.circles.map((circle) => {
    const path = getCirclePath(graph, circle.id)
    const pathItems = path.map((item) => ({ id: item.id, name: item.name }))
    const circleText = normalizeText(formatCirclePath(pathItems))
    const nameText = normalizeText(circle.name)
    return {
      key: `circle:${circle.id}`,
      type: 'circle',
      name: circle.name,
      nameText,
      nameTokens: tokenize(circle.name, { keepStopWords: true }),
      circleText,
      roleText: '',
      noteText: '',
      linkText: '',
      allText: [nameText, circleText].filter(Boolean).join(' '),
      result: {
        type: 'circle',
        id: circle.id,
        name: circle.name,
        parentId: circle.parentId,
        path: pathItems,
        score: 0,
        subtitle: buildCircleSubtitle(path),
      },
    }
  })

  return [...peopleDocs, ...circleDocs]
}

function addArmScores(
  scores: Map<string, { doc: SearchDoc; score: number; hits: SearchArm[] }>,
  docs: SearchDoc[],
  arm: SearchArm,
  weight: number,
  scoreDoc: (doc: SearchDoc) => number,
) {
  const ranked = docs
    .map((doc) => ({ doc, raw: scoreDoc(doc) }))
    .filter((entry) => entry.raw > 0)
    .sort((left, right) => right.raw - left.raw || left.doc.name.localeCompare(right.doc.name))

  ranked.forEach((entry, index) => {
    const existing = scores.get(entry.doc.key) ?? { doc: entry.doc, score: 0, hits: [] }
    const rrf = weight * (1 / (RRF_K + index + 1)) * 1000
    existing.score += rrf + Math.min(entry.raw, weight * 2)
    if (!existing.hits.includes(arm)) existing.hits.push(arm)
    scores.set(entry.doc.key, existing)
  })
}

export function parseSimpleQuery(raw: string): SearchIntent {
  const intent: SearchIntent = {}
  let text = raw.trim()
  if (!text) return intent

  const scopedMatch = text.match(
    /\b(?:at|@|in|from|inside|within|из|в|от)\s+([^,?;]+?)(?=$|\s+(?:who|with|named|called|speaks?|speaker|specialist|expert|person|people)\b)/iu,
  )
  if (scopedMatch) {
    intent.circleNames = [scopedMatch[1].trim()]
    text = `${text.slice(0, scopedMatch.index)} ${text.slice((scopedMatch.index ?? 0) + scopedMatch[0].length)}`.trim()
  }

  const roleMatch = text.match(/\b(?:role|title|specialist|expert|speaker|специалист|эксперт|спикер)\s*:?\s*([^,?;]+)?/iu)
  if (roleMatch?.[1]) {
    intent.role = roleMatch[1].trim()
  }

  const tokens = tokenize(text)
  if (tokens.length > 0) {
    intent.nameTokens = tokens
    intent.keywords = tokens
  }

  if (/\bcircle\b|\bкруг\b|\bzone\b|\btag\b/i.test(raw)) {
    intent.preferCircles = true
  }

  return intent
}

export function mergeSearchIntent(base: SearchIntent, extra: SearchIntent): SearchIntent {
  return {
    nameTokens: unique([...(base.nameTokens ?? []), ...(extra.nameTokens ?? [])]),
    keywords: unique([...(base.keywords ?? []), ...(extra.keywords ?? [])]),
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
    return mergeSearchIntent(parsed, { nameTokens: fallbackTokens, keywords: fallbackTokens })
  }
  return parsed
}

export function rankGraphSearch(graph: GraphState, intent: SearchIntent, limit: number): GraphSearchResult[] {
  const tokens = queryTokens(intent)
  const phrase = queryPhrase(intent)
  if (tokens.length === 0 && !intent.circleNames?.length) return []

  const docs = buildSearchDocs(graph).filter((doc) => matchesCircleFilter(doc, intent.circleNames))
  const scores = new Map<string, { doc: SearchDoc; score: number; hits: SearchArm[] }>()

  addArmScores(scores, docs, 'exact', 220, (doc) => {
    if (phrase && doc.nameText === phrase) return doc.type === 'person' ? 320 : 250
    if (phrase && doc.nameText.startsWith(phrase)) return doc.type === 'person' ? 210 : 190
    return 0
  })
  addArmScores(scores, docs, 'name', 170, (doc) =>
    scoreText(doc.nameText, tokens, phrase, { exact: 260, phrase: 170, token: doc.type === 'person' ? 80 : 70, prefix: 60 }),
  )
  addArmScores(scores, docs.filter((doc) => doc.type === 'person'), 'role', 145, (doc) =>
    scoreText(doc.roleText, tokens, phrase, { exact: 220, phrase: 150, token: 70, prefix: 45 }),
  )
  addArmScores(scores, docs.filter((doc) => doc.type === 'person'), 'notes', 95, (doc) =>
    scoreText(doc.noteText, tokens, phrase, { exact: 140, phrase: 105, token: 38, prefix: 22 }),
  )
  addArmScores(scores, docs, 'circle', intent.circleNames?.length ? 190 : 85, (doc) => {
    const circleFilterScore = (intent.circleNames ?? []).some((circleName) => circleNameMatches(doc.circleText.split(' › '), circleName)) ? 180 : 0
    return circleFilterScore + scoreText(doc.circleText, tokens, phrase, { exact: 160, phrase: 120, token: 45, prefix: 25 })
  })
  addArmScores(scores, docs.filter((doc) => doc.type === 'person'), 'links', 55, (doc) =>
    scoreText(doc.linkText, tokens, phrase, { exact: 90, phrase: 70, token: 25, prefix: 12 }),
  )
  addArmScores(scores, docs, 'coverage', 80, (doc) => coverageScore(doc, tokens))

  const preferCircles = intent.preferCircles === true
  return [...scores.values()]
    .map((entry) => ({
      ...entry.doc.result,
      score: Math.round(entry.score),
    }))
    .sort((left, right) => {
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
    .slice(0, limit)
}

export function searchGraphByQuery(graph: GraphState, query: string, limit: number): GraphSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const intent = buildSearchIntentFromQuery(trimmed)
  return rankGraphSearch(graph, intent, limit)
}

export function parseSearchIntentJson(raw: string): SearchIntent | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const intent: SearchIntent = {}
    if (Array.isArray(parsed.nameTokens)) {
      intent.nameTokens = unique(parsed.nameTokens.filter((value): value is string => typeof value === 'string'))
    }
    if (Array.isArray(parsed.keywords)) {
      intent.keywords = unique(parsed.keywords.filter((value): value is string => typeof value === 'string'))
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
