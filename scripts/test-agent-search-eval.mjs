#!/usr/bin/env node
/**
 * Deterministic agent-search eval suite (no API key required).
 * Optional Groq pass when GROQ_API_KEY is set.
 *
 * Usage:
 *   node scripts/test-agent-search-eval.mjs
 *   node scripts/test-agent-search-eval.mjs --groq
 *   node scripts/test-agent-search-eval.mjs --linkedin /path/to/Basic_LinkedInDataExport.zip
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditStrongTermGaps,
  buildGraph,
  collectGroupCandidates,
  evaluateRecall,
  expandTerms,
  localGroupFallback,
  mergeWithAudit,
  toCandidateSummaries,
} from './lib/synthetic-search-graph.mjs'
import { buildGraphFromLinkedInZip, linkedInEvalCases } from './lib/linkedin-export-graph.mjs'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envLocal = path.join(repoRoot, '.env.local')
if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const GROQ_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']
const GPT_OSS_STRICT = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b'])

function parseArgs() {
  const args = { people: 300, groq: false, delayMs: 15000, models: GROQ_MODELS, linkedin: null }
  for (let i = 2; i < process.argv.length; i += 1) {
    const t = process.argv[i]
    const n = process.argv[i + 1]
    if (t === '--people' && n) { args.people = Number(n); i += 1 }
    else if (t === '--groq') args.groq = true
    else if (t === '--delay-ms' && n) { args.delayMs = Number(n); i += 1 }
    else if (t === '--model' && n) { args.models = [n]; i += 1 }
    else if (t === '--linkedin') {
      args.linkedin = n && !n.startsWith('--') ? n : (process.env.LINKEDIN_EXPORT_ZIP?.trim() || null)
      if (n && !n.startsWith('--')) i += 1
    }
  }
  return args
}

function runCaseEvals(graph, cases, pass) {
  for (const testCase of cases) {
    const terms = expandTerms(testCase.text, testCase.text.split(/\s+/), testCase)
    const expectedSize = testCase.expectedIds.size
    const resultCap = testCase.fallbackLimit
      ?? Math.max(testCase.llmCap ?? 70, Math.ceil(expectedSize * 1.05) + 8)
    const pool = collectGroupCandidates(graph, terms, testCase.llmCap ?? 70, {
      forceIds: testCase.forceIds ?? [],
    })
    const prefilter = evaluateRecall(pool.people.map((p) => p.id), testCase.expectedIds, testCase.minRecall)
    pass(`${testCase.id} prefilter recall >= ${Math.round(testCase.minRecall * 100)}%`, prefilter.pass,
      `${prefilter.hit}/${prefilter.expected} strong=${pool.strongCount} (${(prefilter.recall * 100).toFixed(0)}%)`)

    if (testCase.skipFallback) continue

    const candidates = toCandidateSummaries(graph, pool.people)
    const fallback = localGroupFallback(
      candidates,
      terms,
      resultCap,
      graph,
      pool.strongCount,
      testCase.text,
    )
    const fallbackEval = evaluateRecall(fallback.map((m) => m.id), testCase.expectedIds, testCase.minRecall)
    pass(`${testCase.id} local fallback recall >= ${Math.round(testCase.minRecall * 100)}%`, fallbackEval.pass,
      `ret=${fallback.length} hit=${fallbackEval.hit}/${fallbackEval.expected}`)

    if (testCase.wantMultiple && testCase.auditTo100) {
      const audit = auditStrongTermGaps(graph, terms, fallback.map((m) => m.id), testCase.text)
      const withAudit = evaluateRecall(
        mergeWithAudit(fallback.map((m) => m.id), audit, resultCap),
        testCase.expectedIds,
        1,
      )
      pass(`${testCase.id} audit closes recall to 100%`, withAudit.pass,
        `audit+${audit.length} hit=${withAudit.hit}/${withAudit.expected}`)
    }
  }
}

function runLocalEvals(graph) {
  const results = []
  const pass = (name, ok, detail) => {
    results.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` | ${detail}` : ''}`)
  }

  if (graph.source === 'linkedin') {
    const sample = graph.people.find((p) => graph.tags.founders.has(p.id))
    pass('founder summary mentions founder', sample && /founder|founding/i.test(sample.searchSummary), sample?.searchSummary?.slice(0, 90))
    pass('no private love notes in graph', !graph.people.some((p) => /i love her|girlfriend/i.test(p.searchSummary ?? '')))

    runCaseEvals(graph, linkedInEvalCases(graph).map((c) => ({ ...c, auditTo100: c.minRecall < 1 })), pass)

    const avgSummaryLen = Math.round(graph.people.reduce((sum, p) => sum + (p.searchSummary?.length ?? 0), 0) / graph.people.length)
    pass('avg searchSummary length <= 280', avgSummaryLen <= 280, `${avgSummaryLen} chars`)
  } else {
    const alice = graph.people.find((p) => p.id === 'person-special-alice')
    pass('searchSummary includes love note', alice.searchSummary.includes('i love her'), alice.searchSummary.slice(0, 80))

    const startupSample = graph.people.find((p) => graph.tags.startup.has(p.id))
    pass('startup summary mentions startup', /startup|founder/i.test(startupSample.searchSummary), startupSample.searchSummary.slice(0, 80))

    runCaseEvals(graph, [
      {
        id: 'girlfriend',
        text: 'find my girlfriend',
        isRelational: true,
        forceIds: ['person-special-alice'],
        expectedIds: graph.tags.girlfriend,
        minRecall: 1,
        wantMultiple: false,
        llmCap: 40,
        skipFallback: false,
        fallbackLimit: 3,
      },
      {
        id: 'startup',
        text: 'find startup founders',
        wantMultiple: true,
        expectedIds: graph.tags.startup,
        minRecall: 0.95,
        auditTo100: true,
      },
      {
        id: 'acme',
        text: 'software engineers at Acme',
        wantMultiple: true,
        expectedIds: graph.tags.acmeEngineers,
        minRecall: 1,
      },
    ], pass)

    const avgSummaryLen = Math.round(graph.people.reduce((sum, p) => sum + (p.searchSummary?.length ?? 0), 0) / graph.people.length)
    pass('avg searchSummary length <= 220', avgSummaryLen <= 220, `${avgSummaryLen} chars`)
  }

  const failed = results.filter((r) => !r.ok)
  return { results, failed }
}

async function groqChat(apiKey, model, system, user, maxTokens, responseFormat = null) {
  const body = {
    model,
    temperature: 0.1,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) },
    ],
  }
  if (responseFormat) body.response_format = responseFormat

  const response = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`)
  return payload.choices?.[0]?.message?.content ?? ''
}

function supportsStrictStructuredOutput(model) {
  return GPT_OSS_STRICT.has(model)
}

function buildMatchResponseFormat(candidateIds, wantMultiple) {
  const ids = candidateIds.length > 0 ? candidateIds : ['__none__']
  const matchItem = {
    type: 'object',
    properties: {
      id: { type: 'string', enum: ids },
      confidence: { type: 'number' },
      reason: { type: 'string' },
    },
    required: ['id', 'confidence', 'reason'],
    additionalProperties: false,
  }

  const matchesSchema = wantMultiple
    ? { type: 'array', items: matchItem, maxItems: 20 }
    : { type: 'array', items: matchItem, maxItems: 3 }

  return {
    type: 'json_schema',
    json_schema: {
      name: wantMultiple ? 'search_group_matches' : 'search_single_match',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          matches: matchesSchema,
          suggestions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['matches', 'suggestions'],
        additionalProperties: false,
      },
    },
  }
}

function parseJson(raw) {
  const text = raw.trim().replace(/<\/?think>/gi, '')
  const block = text.match(/\{[\s\S]*\}/)?.[0] ?? text
  return JSON.parse(block)
}

const PLACEHOLDER_IDS = new Set(['person-id', 'person_id', 'candidate-id', 'id'])

function normalizeMatches(matchJson, validIds) {
  const out = []
  const seen = new Set()
  for (const match of matchJson.matches ?? []) {
    const id = typeof match === 'string' ? match.trim() : (typeof match?.id === 'string' ? match.id.trim() : '')
    if (!id || !validIds.has(id) || PLACEHOLDER_IDS.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

async function runGroqCase(apiKey, model, graph, testCase) {
  const MATCH_GROUP = `Pick ALL people from candidates that fit this group search. confidence 0.4-1.0. Empty matches if none fit.`
  const MATCH_SINGLE = `Pick the best matching person from candidates. confidence 0.45-1.0. Empty matches if none fit.`

  const terms = expandTerms(testCase.text, testCase.text.split(/\s+/), testCase)
  const pool = collectGroupCandidates(graph, terms, 70, {
    forceIds: testCase.forceIds ?? [],
  })
  const candidates = toCandidateSummaries(graph, pool.people)
  const validIds = new Set(candidates.map((c) => c.id))
  if (candidates.length === 0) {
    return { returned: 0, hit: 0, expected: testCase.expectedIds.size, recall: 0, pass: false }
  }

  const prompt = testCase.wantMultiple ? MATCH_GROUP : MATCH_SINGLE
  const responseFormat = supportsStrictStructuredOutput(model)
    ? buildMatchResponseFormat(candidates.map((c) => c.id), testCase.wantMultiple)
    : null
  const content = await groqChat(
    apiKey,
    model,
    prompt,
    { query: testCase.text, candidates },
    testCase.wantMultiple ? 2000 : 600,
    responseFormat,
  )
  const matchJson = parseJson(content)
  const returned = normalizeMatches(matchJson, validIds)
  const audited = mergeWithAudit(
    returned,
    testCase.wantMultiple ? auditStrongTermGaps(graph, terms, returned, testCase.text) : [],
    testCase.wantMultiple ? 36 : 3,
  )
  const evalResult = evaluateRecall(audited, testCase.expectedIds, testCase.minRecall)
  return { returned: audited.length, llmReturned: returned.length, ...evalResult, structured: Boolean(responseFormat) }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { people, groq, delayMs, models, linkedin } = parseArgs()
  if (linkedin === null && process.argv.includes('--linkedin')) {
    console.error('Pass --linkedin /path/to/export.zip or set LINKEDIN_EXPORT_ZIP in .env.local')
    process.exit(1)
  }

  const graph = linkedin
    ? buildGraphFromLinkedInZip(linkedin)
    : buildGraph(people)

  if (graph.source === 'linkedin') {
    console.log(`Agent search eval (LinkedIn) | ${graph.people.length} people | circles=${graph.circles.length}`)
    console.log(`  founders=${graph.tags.founders.size} | agile=${graph.tags.agileCoaches.size} | ${graph.meta.engineerCompany} engineers=${graph.tags.companyEngineers.size}\n`)
  } else {
    console.log(`Agent search eval | ${graph.people.length} people | startups=${graph.tags.startup.size} | acme=${graph.tags.acmeEngineers.size}\n`)
  }
  console.log('--- Local evals (deterministic) ---')
  const { failed } = runLocalEvals(graph)
  if (failed.length > 0) {
    console.error(`\n${failed.length} local eval(s) failed`)
    process.exit(1)
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!groq || !apiKey) {
    console.log('\nLocal evals passed. Set --groq and GROQ_API_KEY for LLM benchmark.')
    return
  }

  console.log('\n--- Groq LLM evals (GPT-OSS uses json_schema strict) ---')
  const cases = graph.source === 'linkedin'
    ? linkedInEvalCases(graph)
    : [
      { id: 'girlfriend', text: 'find my girlfriend', wantMultiple: false, isRelational: true, forceIds: ['person-special-alice'], expectedIds: graph.tags.girlfriend, minRecall: 1 },
      { id: 'startups', text: 'find startup founders and people in startups', wantMultiple: true, expectedIds: graph.tags.startup, minRecall: 0.95 },
      { id: 'acme', text: 'software engineers at Acme', wantMultiple: true, expectedIds: graph.tags.acmeEngineers, minRecall: 1 },
      { id: 'startups-ru', text: 'найти стартаперов', wantMultiple: true, expectedIds: graph.tags.startup, minRecall: 0.95 },
    ]

  let groqFailed = 0
  for (const model of models) {
    console.log(`\n=== ${model} ===`)
    for (const testCase of cases) {
      let attempts = 0
      while (attempts < 2) {
        attempts += 1
        try {
          const result = await runGroqCase(apiKey, model, graph, testCase)
          const ok = result.pass && (testCase.wantMultiple ? result.returned >= 3 : result.returned >= 1)
          console.log(`${ok ? 'PASS' : 'FAIL'} | ${testCase.id} | ret=${result.returned} hit=${result.hit}/${result.expected} recall=${(result.recall * 100).toFixed(0)}% | strict=${result.structured ? 'yes' : 'no'}`)
          if (!ok) groqFailed += 1
          break
        } catch (error) {
          const msg = error.message || String(error)
          if (attempts < 2 && /rate|429|limit|validate JSON/i.test(msg)) {
            console.error(`RETRY | ${testCase.id} | ${msg}`)
            await sleep(15000)
            continue
          }
          console.error(`ERROR | ${testCase.id} | ${msg}`)
          groqFailed += 1
          if (/rate|429|limit/i.test(msg)) break
          break
        }
      }
      await sleep(delayMs)
    }
  }

  if (groqFailed > 0) {
    console.error(`\n${groqFailed} Groq eval(s) failed or errored`)
    process.exit(2)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
