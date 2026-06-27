#!/usr/bin/env node
/**
 * Large synthetic search benchmark (~3k by default).
 * Proves harness recall on hard queries AND that naive single-pass baselines fail.
 *
 * Usage:
 *   npm run test:agent-search:bench
 *   node scripts/test-agent-search-bench.mjs --people 3000
 *   node scripts/test-agent-search-bench.mjs --people 500 --quick
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditStrongTermGaps,
  collectGroupCandidates,
  evaluateRecall,
  expandTerms,
  localGroupFallback,
  mergeWithAudit,
  toCandidateSummaries,
} from './lib/synthetic-search-graph.mjs'
import {
  buildLargeGraph,
  largeBenchCases,
  largeGraphStats,
  naiveSinglePassIds,
} from './lib/synthetic-large-graph.mjs'

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SINGLE_PASS_CAP = 36

function parseArgs() {
  const args = { people: 3000, quick: false }
  for (let i = 2; i < process.argv.length; i += 1) {
    const t = process.argv[i]
    const n = process.argv[i + 1]
    if (t === '--people' && n) { args.people = Number(n); i += 1 }
    else if (t === '--quick') { args.quick = true; args.people = 500 }
  }
  return args
}

function runHarnessCase(graph, testCase) {
  const terms = expandTerms(testCase.text, testCase.text.split(/\s+/), testCase)
  const expectedSize = testCase.expectedIds.size
  const resultCap = testCase.fallbackLimit
    ?? Math.max(testCase.llmCap ?? 70, Math.ceil(expectedSize * 1.05) + 8)
  const pool = collectGroupCandidates(graph, terms, testCase.llmCap ?? 70, {
    forceIds: testCase.forceIds ?? [],
  })
  const prefilter = evaluateRecall(pool.people.map((p) => p.id), testCase.expectedIds, testCase.minRecall)

  const candidates = toCandidateSummaries(graph, pool.people)
  const fallback = localGroupFallback(candidates, terms, resultCap, graph, pool.strongCount, testCase.text)
  let returned = fallback.map((m) => m.id)
  if (testCase.wantMultiple && testCase.auditTo100) {
    const audit = auditStrongTermGaps(graph, terms, returned, testCase.text)
    returned = mergeWithAudit(returned, audit, resultCap)
  }
  const harness = evaluateRecall(returned, testCase.expectedIds, testCase.minRecall)
  return { prefilter, harness, strongCount: pool.strongCount, returned: returned.length }
}

function flattenCases(cases) {
  const flat = []
  for (const testCase of cases) {
    if (testCase.kind === 'multi-group') {
      for (const group of testCase.groups) flat.push({ ...group, parentId: testCase.id })
    } else {
      flat.push(testCase)
    }
  }
  return flat
}

function runSinglePassChecks(graph, cases, pass) {
  for (const testCase of cases) {
    if (testCase.kind === 'multi-group') {
      const combinedIds = naiveSinglePassIds(graph, testCase.text, SINGLE_PASS_CAP)
      let weakGroups = 0
      const parts = []
      for (const group of testCase.groups) {
        const ev = evaluateRecall(combinedIds, group.expectedIds, 0)
        parts.push(`${group.id}=${(ev.recall * 100).toFixed(0)}%`)
        if (ev.recall < group.minRecall) weakGroups += 1
      }
      pass(
        `${testCase.id} single-pass misses ≥2/3 groups`,
        weakGroups >= 2,
        `one cap-${SINGLE_PASS_CAP} pass → ${parts.join(' ')}`,
      )
      if (testCase.whyHard) console.log(`         ↳ ${testCase.whyHard}`)
      continue
    }

    const ids = naiveSinglePassIds(graph, testCase.text, SINGLE_PASS_CAP)
    const single = evaluateRecall(ids, testCase.expectedIds, 0)
    const harness = runHarnessCase(graph, testCase)

    const gap = harness.harness.recall - single.recall
    const mustBeWeak = testCase.singlePassMustBeWeak !== false && testCase.kind !== 'multi-group'
    if (mustBeWeak) {
      const beatsSingle = gap >= (testCase.minGap ?? 0.12)
      const underCap = testCase.singlePassMaxRecall == null || single.recall <= testCase.singlePassMaxRecall
      pass(
        `${testCase.id} harness beats single-pass (Δ≥${Math.round((testCase.minGap ?? 0.12) * 100)}%)`,
        beatsSingle,
        `single=${(single.recall * 100).toFixed(0)}% harness=${(harness.harness.recall * 100).toFixed(0)}% Δ=${(gap * 100).toFixed(0)}%`,
      )
      if (testCase.singlePassMaxRecall != null) {
        pass(
          `${testCase.id} single-pass ≤ ${Math.round(testCase.singlePassMaxRecall * 100)}%`,
          underCap,
          `recall=${(single.recall * 100).toFixed(0)}% hit=${single.hit}/${single.expected}`,
        )
      }
    } else {
      console.log(
        `INFO | ${testCase.id} single=${(single.recall * 100).toFixed(0)}% harness=${(harness.harness.recall * 100).toFixed(0)}% (small cohort — gap not gated)`,
      )
    }
    if (testCase.whyHard && (mustBeWeak || testCase.kind === 'multi-group')) {
      console.log(`         ↳ ${testCase.whyHard}`)
    }
  }
}

async function main() {
  const { people, quick } = parseArgs()
  const graph = buildLargeGraph(people)
  const stats = largeGraphStats(graph)
  const cases = largeBenchCases(graph)

  console.log(`Agent search bench (large synthetic) | ${stats.people} people | ${stats.circles} circles`)
  console.log(`  founders=${stats.startupFounders} decoys=${stats.startupCircleDecoys} acme=${stats.acmeEngineers}`)
  console.log(`  globexSr=${stats.globexSeniorEng} ycInv=${stats.ycInvestors} devconfRust=${stats.devconfRust}`)
  console.log(`  entFounders=${stats.enterpriseFounders} initechPm=${stats.initechPaymentsPm} aiSpk=${stats.aiSpeakers}`)
  if (quick) console.log('  (quick mode — smaller graph)\n')
  else console.log(`  single-pass baseline cap=${SINGLE_PASS_CAP} (production per-group limit)\n`)

  const results = []
  const pass = (name, ok, detail) => {
    results.push({ name, ok, detail })
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ` | ${detail}` : ''}`)
  }

  console.log('--- Single-pass vs harness (one OR scan, top-36) ---')
  runSinglePassChecks(graph, cases, pass)

  console.log('\n--- Harness (prefilter + guarded fallback + audit) ---')
  for (const testCase of flattenCases(cases)) {
    const label = testCase.parentId ? `${testCase.parentId}/${testCase.id}` : testCase.id
    const run = runHarnessCase(graph, testCase)
    pass(
      `${label} prefilter ≥ ${Math.round(testCase.minRecall * 100)}%`,
      run.prefilter.pass,
      `${run.prefilter.hit}/${run.prefilter.expected} strong=${run.strongCount}`,
    )
    pass(
      `${label} harness ≥ ${Math.round(testCase.minRecall * 100)}%`,
      run.harness.pass,
      `ret=${run.returned} hit=${run.harness.hit}/${run.harness.expected}`,
    )
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.error(`\n${failed.length} bench check(s) failed`)
    process.exit(1)
  }

  console.log('\nAll bench checks passed.')
  console.log('\nHard query catalog:')
  for (const testCase of cases) {
    console.log(`  • ${testCase.text}`)
    if (testCase.whyHard) console.log(`    ${testCase.whyHard}`)
    if (testCase.kind === 'multi-group') {
      for (const g of testCase.groups) console.log(`    → separate pass: ${g.text}`)
    }
  }

  const outPath = path.join(repoRoot, 'tmp', 'agent-search-bench-last.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({ people, stats, cases: cases.map((c) => ({ id: c.id, text: c.text, kind: c.kind })) }, null, 2))
  console.log(`\nWrote ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
