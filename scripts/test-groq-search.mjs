#!/usr/bin/env node
/**
 * Minimal Groq agent-search benchmark (keep requests low for free-tier limits).
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... node scripts/test-groq-search.mjs
 *   GROQ_API_KEY=gsk_... node scripts/test-groq-search.mjs --model openai/gpt-oss-120b
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const DEFAULT_MODELS = ['qwen/qwen3-32b', 'openai/gpt-oss-120b']

const TEST_GRAPH = {
  circles: [
    { id: 'you', name: 'You', parentId: null },
    { id: 'personal', name: 'Personal', parentId: null },
    { id: 'linkedin-company-acme', name: 'Acme Corp', parentId: null },
  ],
  people: [
    {
      id: 'person-alice',
      name: 'Alice Chen',
      circleId: 'personal',
      notes: [{ id: 'n1', title: 'Private', body: 'i love her' }],
    },
    {
      id: 'person-bob',
      name: 'Bob Smith',
      circleId: 'linkedin-company-acme',
      notes: [{ id: 'n2', title: 'Position', body: 'Senior Software Engineer' }],
    },
    {
      id: 'person-carol',
      name: 'Carol Lee',
      circleId: 'linkedin-company-acme',
      notes: [{ id: 'n3', title: 'Position', body: 'Product Manager' }],
    },
  ],
}

const QUERIES = [
  { id: 'girlfriend', text: 'find my girlfriend' },
  { id: 'engineer-acme', text: 'engineer at Acme' },
]

const ANALYZE_PROMPT = `Return ONLY JSON: {"thinking":"...","searchTerms":["..."],"isRelational":true|false}
Expand relationship terms into note-friendly words (girlfriend -> love, her, partner).`

const MATCH_PROMPT = `Return ONLY JSON: {"matches":[{"id":"...","confidence":0.9,"reason":"..."}],"suggestions":[]}
Pick only from candidates. confidence 0..1.`

function parseArgs() {
  const models = []
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === '--model' && process.argv[i + 1]) {
      models.push(process.argv[i + 1])
      i += 1
    }
  }
  return { models: models.length ? models : DEFAULT_MODELS }
}

function buildCandidates(graph) {
  return graph.people.map((person) => {
    const circle = graph.circles.find((c) => c.id === person.circleId)
    return {
      id: person.id,
      name: person.name,
      circle: circle?.name ?? '',
      notes: (person.notes ?? []).map((n) => `${n.title}: ${n.body}`),
    }
  })
}

function parseJson(raw) {
  const text = raw.trim()
  const block = text.match(/\{[\s\S]*\}/)?.[0] ?? text
  return JSON.parse(block)
}

async function groqChat(apiKey, model, system, user, maxTokens = 220) {
  const started = performance.now()
  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({}))
  const ms = Math.round(performance.now() - started)

  if (!response.ok) {
    throw new Error(payload?.error?.message || `HTTP ${response.status}`)
  }

  const content = payload.choices?.[0]?.message?.content ?? ''
  const usage = payload.usage ?? {}
  return { content, ms, usage }
}

function scoreMatch(analyze, match, expectedPersonId) {
  const terms = analyze.searchTerms ?? []
  const hits = (match.matches ?? []).find((m) => m.id === expectedPersonId)
  return {
    expectedPersonId,
    found: Boolean(hits),
    confidence: hits?.confidence ?? null,
    reason: hits?.reason ?? null,
    searchTerms: terms,
  }
}

async function runCase(apiKey, model, queryCase, candidates) {
  const circles = TEST_GRAPH.circles.map((c) => c.name)

  const analyze = await groqChat(apiKey, model, ANALYZE_PROMPT, {
    query: queryCase.text,
    circles,
  })

  let analyzeJson
  try {
    analyzeJson = parseJson(analyze.content)
  } catch {
    analyzeJson = { parseError: true, raw: analyze.content.slice(0, 200) }
  }

  await sleep(1200)

  const match = await groqChat(apiKey, model, MATCH_PROMPT, {
    query: queryCase.text,
    thinking: analyzeJson.thinking,
    searchTerms: analyzeJson.searchTerms,
    candidates,
  }, 280)

  let matchJson
  try {
    matchJson = parseJson(match.content)
  } catch {
    matchJson = { parseError: true, raw: match.content.slice(0, 200) }
  }

  const expected = queryCase.id === 'girlfriend' ? 'person-alice' : 'person-bob'
  const verdict = scoreMatch(analyzeJson, matchJson, expected)

  return {
    query: queryCase.text,
    analyze: { ms: analyze.ms, tokens: analyze.usage, json: analyzeJson },
    match: { ms: match.ms, tokens: match.usage, json: matchJson },
    verdict,
    totalMs: analyze.ms + match.ms,
    totalTokens: (analyze.usage.total_tokens ?? 0) + (match.usage.total_tokens ?? 0),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    console.error('Set GROQ_API_KEY in the environment.')
    process.exit(1)
  }

  const { models } = parseArgs()
  const candidates = buildCandidates(TEST_GRAPH)

  console.log('Groq agent-search mini benchmark')
  console.log(`Models: ${models.join(', ')}`)
  console.log(`Queries: ${QUERIES.map((q) => q.text).join(' | ')}`)
  console.log(`Calls per model: ${QUERIES.length * 2} (analyze + match)\n`)

  const summary = []

  for (const model of models) {
    console.log(`\n=== ${model} ===`)
    for (const queryCase of QUERIES) {
      try {
        const result = await runCase(apiKey, model, queryCase, candidates)
        summary.push({ model, ...result })
        console.log(`\nQuery: "${result.query}"`)
        console.log(`  analyze: ${result.analyze.ms}ms, tokens=${result.analyze.tokens.total_tokens ?? '?'}`)
        console.log(`  thinking: ${result.analyze.json.thinking ?? result.analyze.json.raw ?? '(parse fail)'}`)
        console.log(`  searchTerms: ${JSON.stringify(result.analyze.json.searchTerms ?? [])}`)
        console.log(`  match: ${result.match.ms}ms, tokens=${result.match.tokens.total_tokens ?? '?'}`)
        console.log(`  found expected (${result.verdict.expectedPersonId}): ${result.verdict.found ? 'YES' : 'NO'}`)
        if (result.verdict.reason) console.log(`  reason: ${result.verdict.reason}`)
        console.log(`  total: ${result.totalMs}ms, ~${result.totalTokens} tokens`)
        await sleep(1500)
      } catch (error) {
        console.error(`  ERROR on "${queryCase.text}": ${error.message}`)
        if (String(error.message).includes('rate') || String(error.message).includes('429')) {
          console.error('  Rate limited — stopping early.')
          process.exit(2)
        }
      }
    }
  }

  console.log('\n--- Summary ---')
  for (const row of summary) {
    console.log(
      `${row.model} | "${row.query}" | ${row.totalMs}ms | ${row.totalTokens} tok | correct=${row.verdict.found}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
