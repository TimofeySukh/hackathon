/**
 * Shared synthetic graph + searchSummary helpers for agent-search evals.
 */

const FIRST = ['Alice', 'Bob', 'Carol', 'David', 'Elena', 'Frank', 'Grace', 'Hugo', 'Iris', 'Jack']
const LAST = ['Chen', 'Smith', 'Lee', 'Park', 'Garcia', 'Kim', 'Novak', 'Brown', 'Singh', 'Wright']
const POSITION_TITLES = new Set(['position', 'headline', 'title', 'role'])

export function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function getCirclePath(circles, circleId) {
  const byId = new Map(circles.map((c) => [c.id, c]))
  const path = []
  let cur = byId.get(circleId)
  const seen = new Set()
  while (cur && !seen.has(cur.id)) {
    path.unshift(cur)
    seen.add(cur.id)
    cur = cur.parentId ? byId.get(cur.parentId) : null
  }
  return path
}

export function buildPersonSearchSummary(graph, person) {
  const path = getCirclePath(graph.circles, person.circleId)
  const pathLabel = path.map((c) => c.name).filter(Boolean).join(' › ')
  let position = ''
  for (const note of person.notes ?? []) {
    if (POSITION_TITLES.has(note.title.trim().toLowerCase())) {
      position = note.body.trim()
      break
    }
  }
  const noteLines = (person.notes ?? []).map((n) => `${n.title}: ${n.body}`.trim()).filter(Boolean).slice(0, 8)
  const parts = [
    person.name.trim(),
    pathLabel ? `circle ${pathLabel}` : '',
    position ? `role ${position}` : '',
    ...noteLines,
  ].filter(Boolean)
  return parts.join(' | ').slice(0, 320)
}

export function refreshPersonSearchSummary(graph, person) {
  person.searchSummary = buildPersonSearchSummary(graph, person)
}

export function ensureSearchSummaries(graph) {
  for (const person of graph.people) {
    if (!person.searchSummary?.trim()) refreshPersonSearchSummary(graph, person)
  }
}

export function buildGraph(peopleCount) {
  const rand = mulberry32(42)
  const circles = [
    { id: 'you', name: 'You', parentId: null },
    { id: 'personal', name: 'Personal', parentId: null },
    { id: 'work', name: 'Work', parentId: null },
    { id: 'work-startups', name: 'Startups', parentId: 'work' },
    { id: 'work-enterprise', name: 'Enterprise', parentId: 'work' },
    { id: 'work-freelance', name: 'Freelance', parentId: 'work' },
    { id: 'personal-family', name: 'Family', parentId: 'personal' },
    { id: 'personal-friends', name: 'Friends', parentId: 'personal' },
    { id: 'community', name: 'Community', parentId: null },
    { id: 'acme', name: 'Acme Corp', parentId: 'work-enterprise' },
    { id: 'globex', name: 'Globex', parentId: 'work-enterprise' },
    { id: 'initech', name: 'Initech', parentId: 'work-enterprise' },
    { id: 'hackathon', name: 'Hackathon Network', parentId: 'community' },
    { id: 'investors', name: 'Investors', parentId: 'work-startups' },
    { id: 'accelerator', name: 'Y Combinator Alumni', parentId: 'work-startups' },
  ]

  const circlePool = [
    'work-startups', 'work-startups', 'work-startups', 'accelerator', 'investors',
    'acme', 'globex', 'initech', 'work-freelance', 'personal-friends',
    'personal-family', 'hackathon', 'work-enterprise', 'community',
  ]

  const roles = [
    'Account Executive', 'Designer', 'Recruiter', 'Teacher', 'Consultant',
    'Marketing Manager', 'Data Analyst', 'Support Engineer', 'Lawyer', 'Researcher',
  ]

  const people = []
  const tags = {
    girlfriend: new Set(['person-special-alice']),
    startup: new Set(),
    acmeEngineers: new Set(),
  }

  people.push({
    id: 'person-special-alice',
    name: 'Alice Chen',
    circleId: 'personal-family',
    notes: [{ id: 'n0', title: 'Private', body: 'i love her' }],
    _tags: ['girlfriend'],
  })

  const startupPhrases = [
    'startup founder building AI tools',
    'co-founder at early-stage startup',
    'founder & CEO, pre-seed startup',
    'startup operator, seed stage',
    'building a startup in fintech',
  ]

  const startupTarget = Math.max(18, Math.floor(peopleCount * 0.12))
  const acmeEngineerTarget = 9

  for (let i = 0; i < peopleCount; i += 1) {
    const id = `person-${i}`
    const first = FIRST[Math.floor(rand() * FIRST.length)]
    const last = LAST[Math.floor(rand() * LAST.length)]
    let circleId = circlePool[Math.floor(rand() * circlePool.length)]
    const notes = []
    const personTags = []

    if (tags.startup.size < startupTarget && (circleId === 'work-startups' || circleId === 'accelerator' || circleId === 'investors' || rand() < 0.08)) {
      circleId = rand() < 0.6 ? 'work-startups' : (rand() < 0.5 ? 'accelerator' : 'investors')
      const phrase = startupPhrases[Math.floor(rand() * startupPhrases.length)]
      notes.push({ id: `${id}-role`, title: 'Position', body: phrase })
      tags.startup.add(id)
      personTags.push('startup')
    } else if (tags.acmeEngineers.size < acmeEngineerTarget && (circleId === 'acme' || rand() < 0.04)) {
      circleId = 'acme'
      const level = ['Junior', 'Senior', 'Staff'][Math.floor(rand() * 3)]
      notes.push({ id: `${id}-role`, title: 'Position', body: `${level} Software Engineer` })
      tags.acmeEngineers.add(id)
      personTags.push('acmeEngineer')
    } else {
      notes.push({ id: `${id}-role`, title: 'Position', body: roles[Math.floor(rand() * roles.length)] })
    }

    if (rand() < 0.25) {
      notes.push({ id: `${id}-m`, title: 'Note', body: `Met at event ${Math.floor(rand() * 100)}` })
    }

    people.push({ id, name: `${first} ${last}`, circleId, notes, _tags: personTags })
  }

  const graph = { circles, people, tags }
  ensureSearchSummaries(graph)
  return graph
}

function getPersonPosition(person) {
  for (const note of person.notes ?? []) {
    if (POSITION_TITLES.has(note.title.trim().toLowerCase())) return note.body.trim()
  }
  return undefined
}

export function personHaystack(graph, person) {
  if (person.searchSummary?.trim()) return person.searchSummary.toLowerCase()
  const path = getCirclePath(graph.circles, person.circleId)
  const pathText = path.map((c) => c.name).join(' ')
  const notes = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ')
  return `${person.name} ${pathText} ${notes}`.toLowerCase()
}

/** Weighted scoring aligned with graphSearch.scorePersonByTerms */
export function scorePersonByTerms(graph, person, terms) {
  const path = getCirclePath(graph.circles, person.circleId)
  const position = getPersonPosition(person)
  const normalizedPosition = (position ?? '').toLowerCase()
  const nameHay = person.name.toLowerCase()
  const noteHay = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
  const pathHay = path.map((c) => c.name).join(' ').toLowerCase()
  const summaryHay = personHaystack(graph, person)

  const specific = new Set([
    'startup', 'founder', 'co-founder', 'founding', 'стартап', 'стартапер', 'acme', 'globex',
    'yandex', 'agile', 'coach', 'love', 'girlfriend', 'boyfriend', 'partner', 'люблю', 'девушка',
  ])
  const isSpecific = (needle) => specific.has(needle) || needle.includes(' ') || needle.length >= 10
  const fieldScore = (needle, field) => {
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

export function collectGroupCandidates(graph, terms, llmCap, options = {}) {
  const { forceIds = [] } = options
  const strongMin = 20
  const weakMin = 4
  const strong = []
  const weak = []
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

  const seen = new Set()
  const ordered = []
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

/** @deprecated use collectGroupCandidates */
export function collectCandidates(graph, terms, cap, options = {}) {
  const { forceIds = [] } = options
  return collectGroupCandidates(graph, terms, cap, { forceIds }).people
}

const GENERIC_AUDIT_TERMS = new Set(['engineer', 'developer', 'manager', 'director', 'consultant', 'researcher', 'designer'])

export function filterAuditTerms(terms) {
  return terms.filter((term) => {
    const needle = term.toLowerCase().trim()
    if (GENERIC_AUDIT_TERMS.has(needle)) return false
    return needle.includes(' ') || [
      'startup', 'founder', 'co-founder', 'founding', 'стартап', 'стартапер', 'acme', 'yandex', 'globex', 'initech',
      'agile', 'coach', 'devconf', 'rust', 'payments', 'investor', 'love', 'girlfriend',
    ].includes(needle)
  })
}

export function auditStrongTermGaps(graph, terms, existingIds, query = '') {
  const tierTerms = filterAuditTerms(terms)
  const activeTerms = tierTerms.length > 0 ? tierTerms : terms
  const strongMin = 20
  const seen = new Set(existingIds)
  const gaps = []
  for (const person of graph.people) {
    if (seen.has(person.id)) continue
    if (query.trim()) {
      if (!passesQueryStrongTier(graph, person, query, terms)) continue
    } else if (scorePersonByTerms(graph, person, activeTerms) < strongMin) {
      continue
    }
    gaps.push(person.id)
    seen.add(person.id)
  }
  return gaps
}

export function toCandidateSummaries(graph, people) {
  return people.map((person) => {
    const path = getCirclePath(graph.circles, person.circleId)
    return {
      id: person.id,
      name: person.name,
      circle: path.map((c) => c.name).join(' › '),
      summary: person.searchSummary ?? buildPersonSearchSummary(graph, person),
    }
  })
}

const TERM_STOPWORDS = new Set(['find', 'and', 'the', 'people', 'in', 'at', 'my', 'all', 'who', 'with', 'from', 'найти'])

export function passesQueryStrongTier(graph, person, query, terms) {
  const tierTerms = filterAuditTerms(terms)
  const activeTerms = tierTerms.length > 0 ? tierTerms : terms
  const score = scorePersonByTerms(graph, person, activeTerms)
  if (score < 20) return false
  const q = query.toLowerCase()
  if (/acme/.test(q)) {
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return path.includes('acme') && /software engineer|engineer/.test(position)
  }
  if (/yandex/.test(q)) {
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return path.includes('yandex') && /software engineer|engineer/.test(position)
  }
  const atCompany = q.match(/(?:engineers?|people)\s+at\s+([a-z0-9][a-z0-9\s&.-]{1,50})/i)
  if (atCompany) {
    const needle = atCompany[1].trim().toLowerCase()
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return path.includes(needle) && /software engineer|engineer/.test(position)
  }
  if (/agile coach/.test(q)) {
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return /agile coach/.test(position)
  }
  if (/devconf/.test(q) && /rust/.test(q)) {
    const noteHay = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
    return /devconf 2025/.test(noteHay) && /rust/.test(noteHay)
  }
  if (/initech/.test(q) && (/product manager|payments/.test(q))) {
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    const noteHay = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
    return path.includes('initech') && /product manager/.test(position) && /payments/.test(noteHay)
  }
  if (/yc/.test(q) && /investor/.test(q)) {
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    const noteHay = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
    return path.includes('y combinator') && /investor|vc partner|angel/.test(`${position} ${noteHay}`)
  }
  if (/globex/.test(q) && /senior/.test(q)) {
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return path.includes('globex') && /senior software engineer/.test(position)
  }
  if (/spoke.*ai|ai.*conference|ai summit/.test(q)) {
    const noteHay = (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
    return /spoke at ai summit|ai summit 2025/.test(noteHay)
  }
  if (/founder/.test(q) && /outside|not in the startups|not.*startups circle|wayne|umbrella/.test(q)) {
    const path = getCirclePath(graph.circles, person.circleId).map((c) => c.name.toLowerCase()).join(' ')
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    const anchor = /wayne|umbrella|initech|globex/.test(path)
    return anchor && !path.includes('startups') && /founder|co-founder|founding/.test(position)
  }
  if (/founder|co-founder|founding/i.test(q) && !/startup|стартап/i.test(q)) {
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return /founder|co-founder|founding/.test(position)
  }
  if (/startup|founder|стартап|стартапер/.test(q)) {
    const position = getPersonPosition(person)?.toLowerCase() ?? ''
    return /startup|founder|co-founder|founding|стартап/.test(position)
  }
  return true
}

export function localGroupFallback(candidates, searchTerms, limit, graph = null, strongCount = 0, query = '') {
  if (graph && strongCount > 0) {
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
        return scorePersonByTerms(graph, pb, activeTerms) - scorePersonByTerms(graph, pa, activeTerms)
          || a.name.localeCompare(b.name)
      })
    if (strong.length > 0) {
      return strong.slice(0, limit).map((candidate) => ({
        id: candidate.id,
        confidence: 0.72,
        reason: 'strong tier fallback',
      }))
    }
  }

  if (graph) {
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
      reason: 'scored fallback',
    }))
  }

  const terms = searchTerms
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 2 && !TERM_STOPWORDS.has(t))
  const scored = candidates
    .map((candidate) => {
      const hay = [candidate.name, candidate.circle, candidate.summary].join(' ').toLowerCase()
      let hits = 0
      for (const term of terms) if (hay.includes(term)) hits += 1
      return { candidate, hits }
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.candidate.name.localeCompare(b.candidate.name))
  return scored.slice(0, limit).map((entry) => ({ id: entry.candidate.id, confidence: 0.55, reason: 'local fallback' }))
}

export function expandTerms(query, baseTerms, flags = {}) {
  const q = query.toLowerCase()
  const extra = [...baseTerms]
  if (flags.isRelational || /girlfriend|boyfriend|partner|девушк|люб/i.test(q)) {
    extra.push('love', 'her', 'partner', 'girlfriend', 'люблю', 'девушка')
  }
  if (/startup|стартап|стартапер/i.test(q) && !/outside the startups|not in the startups|not.*startups circle/i.test(q)) {
    extra.push('startup', 'founder', 'co-founder', 'стартап', 'стартапер')
  }
  if (/engineer|software|acme|yandex|инженер/i.test(q)) {
    extra.push('software engineer', 'engineer', 'acme', 'yandex')
  }
  if (/agile coach/i.test(q)) {
    extra.push('agile coach', 'agile', 'coach')
  }
  if (/devconf/i.test(q)) extra.push('devconf', 'devconf 2025')
  if (/rust/i.test(q)) extra.push('rust')
  if (/globex/i.test(q)) extra.push('globex', 'senior software engineer')
  if (/initech/i.test(q)) extra.push('initech', 'product manager', 'payments')
  if (/yc|combinator/i.test(q)) extra.push('y combinator', 'yc', 'investor')
  if (/spoke|speaker|conference|ai summit/i.test(q)) extra.push('spoke at ai summit', 'ai summit', 'llm')
  if (/wayne|umbrella/.test(q)) extra.push('wayne', 'umbrella', 'wayne enterprises', 'umbrella labs')
  if (/founder|co-founder/i.test(q) && !/startup|стартап/i.test(q)) {
    extra.push('founder', 'co-founder', 'founding')
  }
  return [...new Set(extra.map((t) => t.toLowerCase()).filter(Boolean))]
}

export function evaluateRecall(returnedIds, expectedSet, minRecall) {
  const returned = new Set(returnedIds)
  let hit = 0
  for (const id of expectedSet) if (returned.has(id)) hit += 1
  const recall = expectedSet.size ? hit / expectedSet.size : 0
  return { hit, expected: expectedSet.size, recall, pass: recall >= minRecall }
}

export function mergeWithAudit(returnedIds, auditIds, limit) {
  const merged = [...new Set([...returnedIds, ...auditIds])]
  return merged.slice(0, limit)
}
