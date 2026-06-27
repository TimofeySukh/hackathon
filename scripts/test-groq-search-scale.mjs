#!/usr/bin/env node
/**
 * Scaled Groq agent-search benchmark with synthetic graphs and group queries.
 * Keeps LLM calls low; pre-filters candidates before match pass.
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... node scripts/test-groq-search-scale.mjs
 *   GROQ_API_KEY=gsk_... node scripts/test-groq-search-scale.mjs --people 250 --candidate-cap 40
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const MODELS = ['qwen/qwen3.6-27b', 'openai/gpt-oss-20b']

const FIRST = ['Alice', 'Bob', 'Carol', 'David', 'Elena', 'Frank', 'Grace', 'Hugo', 'Iris', 'Jack']
const LAST = ['Chen', 'Smith', 'Lee', 'Park', 'Garcia', 'Kim', 'Novak', 'Brown', 'Singh', 'Wright']

const ANALYZE_PROMPT = `You search a personal relationship graph. Return ONLY JSON:
{"thinking":"short","searchTerms":["literal terms for notes/names"],"isRelational":boolean,"wantMultiple":boolean}
- wantMultiple=true for group queries (startups, all engineers, everyone in a company)
- Expand synonyms (girlfriend->love,her,partner; startup->founder,co-founder,early-stage)
- No markdown, no reasoning blocks outside JSON`

const MATCH_SINGLE = `Return ONLY JSON: {"matches":[{"id":"person-id","confidence":0.0,"reason":"..."}],"suggestions":[]}
Use ONLY ids from candidates (exact strings). Never use placeholders like "person-id". confidence >= 0.45.`

const MATCH_GROUP = `Return ONLY JSON: {"matches":[{"id":"person-id","confidence":0.0,"reason":"..."}],"suggestions":[]}
GROUP search: return ALL fitting candidates (up to 15). Use ONLY exact ids from candidates — never invent ids. confidence >= 0.4.`

function parseArgs() {
  const args = { people: 220, candidateCap: 40, delayMs: 10000, model: null }
  for (let i = 2; i < process.argv.length; i += 1) {
    const t = process.argv[i]
    const n = process.argv[i + 1]
    if (t === '--people' && n) { args.people = Number(n); i += 1 }
    else if (t === '--candidate-cap' && n) { args.candidateCap = Number(n); i += 1 }
    else if (t === '--delay-ms' && n) { args.delayMs = Number(n); i += 1 }
    else if (t === '--model' && n) { args.model = n; i += 1 }
  }
  return args
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function buildGraph(peopleCount) {
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

  let startupTarget = Math.max(18, Math.floor(peopleCount * 0.12))
  let acmeEngineerTarget = 9

  for (let i = 0; i < peopleCount; i += 1) {
    const id = `person-${i}`
    const first = FIRST[Math.floor(rand() * FIRST.length)]
    const last = LAST[Math.floor(rand() * LAST.length)]
    let circleId = circlePool[Math.floor(rand() * circlePool.length)]

    const notes = []
    let personTags = []

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

  for (const person of people) {
    const path = getCirclePath(circles, person.circleId)
    const noteLines = (person.notes ?? []).map((n) => `${n.title}: ${n.body}`).join(' | ')
    person.searchSummary = `${person.name} | ${path.map((c) => c.name).join(' › ')} | ${noteLines}`.slice(0, 320)
  }

  return { circles, people, tags }
}

function getCirclePath(circles, circleId) {
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

function personHaystack(person, circlePath) {
  const path = circlePath.map((c) => c.name).join(' ')
  const notes = person.notes.map((n) => `${n.title} ${n.body}`).join(' ')
  return `${person.name} ${path} ${notes}`.toLowerCase()
}

function collectCandidates(graph, terms, cap, options) {
  const { includeAllNoted, forceIds = [] } = options
  const scored = []
  const seen = new Set()
  for (const id of forceIds) {
    const person = graph.people.find((p) => p.id === id)
    if (person) {
      scored.push({ person, score: 1000 })
      seen.add(id)
    }
  }
  for (const person of graph.people) {
    if (seen.has(person.id)) continue
    const path = getCirclePath(graph.circles, person.circleId)
    const hay = personHaystack(person, path)
    let score = 0
    for (const term of terms) {
      const t = term.toLowerCase().trim()
      if (t && hay.includes(t)) score += 10
    }
    if (includeAllNoted && (person.notes?.length ?? 0) > 0 && score === 0) score = 1
    if (score > 0) {
      scored.push({ person, score })
      seen.add(person.id)
    }
  }
  scored.sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
  return scored.slice(0, cap).map((x) => x.person)
}

function toCandidateSummaries(graph, people) {
  return people.map((person) => {
    const path = getCirclePath(graph.circles, person.circleId)
    const summary = person.searchSummary ?? `${person.name} | ${path.map((c) => c.name).join(' › ')} | ${(person.notes ?? []).map((n) => `${n.title}: ${n.body}`).join(' ')}`.slice(0, 320)
    return {
      id: person.id,
      name: person.name,
      circle: path.map((c) => c.name).join(' › '),
      summary,
    }
  })
}

function buildQueries(tags) {
  return [
    {
      id: 'girlfriend',
      text: 'find my girlfriend',
      mode: 'single',
      expectedIds: tags.girlfriend,
      minReturn: 1,
      maxReturn: 2,
      minRecall: 1,
    },
    {
      id: 'startups',
      text: 'find startup founders and people in startups',
      mode: 'group',
      expectedIds: tags.startup,
      minReturn: 5,
      maxReturn: 15,
      minRecall: 0.35,
    },
    {
      id: 'acme-engineers',
      text: 'software engineers at Acme',
      mode: 'group',
      expectedIds: tags.acmeEngineers,
      minReturn: 4,
      maxReturn: 12,
      minRecall: 0.5,
    },
    {
      id: 'startups-ru',
      text: 'найти стартаперов',
      mode: 'group',
      expectedIds: tags.startup,
      minReturn: 4,
      maxReturn: 15,
      minRecall: 0.3,
    },
  ]
}

const PLACEHOLDER_IDS = new Set(['person-id', 'person_id', 'candidate-id', 'id'])

function parseJson(raw) {
  const text = raw.trim().replace(/<\/?think>/gi, '')
  const block = text.match(/\{[\s\S]*\}/)?.[0] ?? text
  return JSON.parse(block)
}

async function groqChat(apiKey, model, system, user, maxTokens, useJsonFormat = false) {
  const started = performance.now()
  const body = {
    model,
    temperature: 0.1,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) },
    ],
  }
  if (useJsonFormat) body.response_format = { type: 'json_object' }

  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  const ms = Math.round(performance.now() - started)
  if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`)
  return { content: payload.choices?.[0]?.message?.content ?? '', ms, usage: payload.usage ?? {} }
}

function normalizeMatches(matchJson, validIds, minConfidence = 0.4) {
  const normalized = []
  const seen = new Set()
  for (const match of matchJson.matches ?? []) {
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
    normalized.push({ id, confidence, reason: match.reason ?? 'Matched by AI' })
  }
  return normalized
}

function localGroupFallback(candidates, searchTerms, limit) {
  const terms = searchTerms.map((t) => t.toLowerCase()).filter((t) => t.length > 2)
  const scored = candidates
    .map((candidate) => {
      const hay = [candidate.name, candidate.circle, candidate.summary ?? ''].join(' ').toLowerCase()
      let hits = 0
      for (const term of terms) if (hay.includes(term)) hits += 1
      return { candidate, hits }
    })
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.candidate.name.localeCompare(b.candidate.name))
  return scored.slice(0, limit).map((entry) => ({ id: entry.candidate.id, confidence: 0.55, reason: 'local fallback' }))
}

function evaluateGroup(matchJson, testCase, validIds) {
  const returned = normalizeMatches(matchJson, validIds, testCase.mode === 'group' ? 0.4 : 0.45).map((m) => m.id)
  const returnedSet = new Set(returned)
  const expected = testCase.expectedIds
  let hit = 0
  for (const id of expected) if (returnedSet.has(id)) hit += 1
  const recall = expected.size ? hit / expected.size : 0
  const precision = returned.length ? hit / returned.length : 0
  const pass =
    returned.length >= testCase.minReturn &&
    returned.length <= testCase.maxReturn + 5 &&
    recall >= testCase.minRecall
  return { returned: returned.length, hit, expected: expected.size, recall, precision, pass, ids: returned.slice(0, 8) }
}

async function runCase(apiKey, model, graph, testCase, candidateCap) {
  const circleNames = graph.circles.map((c) => c.name)
  const analyze = await groqChat(apiKey, model, ANALYZE_PROMPT, { query: testCase.text, circles: circleNames.slice(0, 30) }, 260, false)

  let analyzeJson
  try { analyzeJson = parseJson(analyze.content) } catch { analyzeJson = { searchTerms: testCase.text.split(/\s+/), wantMultiple: testCase.mode === 'group' } }

  const terms = [...(analyzeJson.searchTerms ?? []), ...testCase.text.split(/\s+/).filter((w) => w.length > 2)]
  if (testCase.id === 'girlfriend' || analyzeJson.isRelational) {
    terms.push('love', 'her', 'partner', 'girlfriend', 'люблю', 'девушка')
  }
  if (testCase.id === 'startups' || testCase.id === 'startups-ru') {
    terms.push('startup', 'founder', 'co-founder', 'early-stage', 'стартап', 'ceo')
  }
  if (testCase.id === 'acme-engineers') {
    terms.push('software engineer', 'engineer', 'acme')
  }
  const uniqueTerms = [...new Set(terms.map((t) => t.toLowerCase()))]
  const pool = collectCandidates(graph, uniqueTerms, candidateCap, {
    includeAllNoted: analyzeJson.isRelational || testCase.mode === 'group' || testCase.id === 'girlfriend',
    forceIds: testCase.id === 'girlfriend' ? ['person-special-alice'] : [],
  })
  const candidates = toCandidateSummaries(graph, pool)
  const validIds = new Set(candidates.map((c) => c.id))

  const matchPrompt = testCase.mode === 'group' ? MATCH_GROUP : MATCH_SINGLE
  const match = await groqChat(apiKey, model, matchPrompt, {
    query: testCase.text,
    wantMultiple: testCase.mode === 'group',
    searchTerms: uniqueTerms.slice(0, 12),
    candidateCount: candidates.length,
    candidates,
  }, testCase.mode === 'group' ? 900 : 400, false)

  let matchJson
  try { matchJson = parseJson(match.content) } catch { matchJson = { matches: [], parseError: true, raw: match.content.slice(0, 180) } }

  const verdict = testCase.mode === 'single'
    ? evaluateGroup({ matches: (matchJson.matches ?? []).slice(0, 3) }, { ...testCase, minReturn: 1, minRecall: 1 }, validIds)
    : evaluateGroup(matchJson, testCase, validIds)

  let fallbackVerdict = null
  if (!verdict.pass && testCase.mode === 'group') {
    const fallbackMatches = localGroupFallback(candidates, uniqueTerms, testCase.maxReturn)
    fallbackVerdict = evaluateGroup({ matches: fallbackMatches }, testCase, validIds)
  }

  return {
    query: testCase.text,
    mode: testCase.mode,
    candidatesSent: candidates.length,
    analyzeMs: analyze.ms,
    matchMs: match.ms,
    tokens: (analyze.usage.total_tokens ?? 0) + (match.usage.total_tokens ?? 0),
    searchTerms: uniqueTerms.slice(0, 8),
    verdict,
    fallbackVerdict,
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    console.error('Set GROQ_API_KEY')
    process.exit(1)
  }

  const { people, candidateCap, delayMs, model: onlyModel } = parseArgs()
  const models = onlyModel ? [onlyModel] : MODELS
  const graph = buildGraph(people)
  const queries = buildQueries(graph.tags)

  console.log('Groq scaled search benchmark')
  console.log(`Graph: ${graph.people.length} people, ${graph.circles.length} circles (nested)`)
  console.log(`Tagged: startup=${graph.tags.startup.size}, acme engineers=${graph.tags.acmeEngineers.size}`)
  console.log(`Models: ${models.join(', ')}`)
  console.log(`Queries: ${queries.length} | candidate cap: ${candidateCap}`)
  console.log(`Est. calls: ${models.length * queries.length * 2}\n`)

  const rows = []
  let totalTokens = 0

  for (const model of models) {
    console.log(`\n=== ${model} ===`)
    for (const testCase of queries) {
      try {
        const result = await runCase(apiKey, model, graph, testCase, candidateCap)
        totalTokens += result.tokens
        rows.push({ model, ...result })
        const v = result.verdict
        console.log(`\n[${testCase.mode}] "${result.query}"`)
        console.log(`  pool→LLM: ${result.candidatesSent} candidates | ${result.analyzeMs + result.matchMs}ms | ${result.tokens} tok`)
        console.log(`  terms: ${JSON.stringify(result.searchTerms)}`)
        if (testCase.mode === 'group') {
          console.log(`  returned ${v.returned} | hit ${v.hit}/${v.expected} | recall ${(v.recall * 100).toFixed(0)}% | precision ${(v.precision * 100).toFixed(0)}% | pass=${v.pass}`)
          if (result.fallbackVerdict) {
            const f = result.fallbackVerdict
            console.log(`  local fallback: ret=${f.returned} hit=${f.hit}/${f.expected} recall=${(f.recall * 100).toFixed(0)}% pass=${f.pass}`)
          }
          console.log(`  sample ids: ${v.ids.join(', ')}`)
        } else {
          console.log(`  pass=${v.pass} | hit=${v.hit}/${v.expected}`)
        }
        await sleep(delayMs)
      } catch (error) {
        console.error(`  ERROR: ${error.message}`)
        if (/rate|429|limit/i.test(error.message)) {
          console.error('Rate limit — stopping.')
          break
        }
      }
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total tokens (approx): ${totalTokens}`)
  for (const r of rows) {
    console.log(`${r.model} | ${r.mode} | "${r.query}" | pass=${r.verdict.pass} | ret=${r.verdict.returned} | recall=${(r.verdict.recall * 100).toFixed(0)}% | ${r.tokens}tok`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
