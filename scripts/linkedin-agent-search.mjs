#!/usr/bin/env node
/**
 * Grep-like local search over LinkedIn compact JSONL exports.
 *
 * This is intentionally separate from the DataNode API, CLI client, and MCP server.
 * It gives agents a small read-only retrieval surface for large LinkedIn exports:
 * search locally, fit results into a token budget, then pass only the matched
 * profiles to an LLM.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DEFAULT_BUDGET_TOKENS = 30000
const DEFAULT_HARD_BUDGET_TOKENS = 50000
const DEFAULT_LIMIT = 250
const TOKEN_CHARS = 3.55

const FIELD_ALIASES = new Map([
  ['company', 'circle'],
  ['group', 'circle'],
  ['position', 'role'],
  ['title', 'role'],
  ['job', 'role'],
  ['url', 'link'],
])

const EXPANSIONS = new Map([
  ['ai', ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'gpt']],
  ['agile', ['agile', 'scrum', 'kanban']],
  ['coach', ['coach', 'coaching']],
  ['consultant', ['consultant', 'consulting', 'advisor', 'adviser']],
  ['cto', ['cto', 'chief technology officer']],
  ['ceo', ['ceo', 'chief executive officer']],
  ['designer', ['designer', 'design']],
  ['developer', ['developer', 'software developer', 'engineer', 'programmer']],
  ['engineer', ['engineer', 'engineering', 'software engineer', 'developer']],
  ['founder', ['founder', 'co-founder', 'cofounder', 'founding']],
  ['founders', ['founder', 'co-founder', 'cofounder', 'founding']],
  ['investor', ['investor', 'vc', 'venture capital', 'angel']],
  ['investors', ['investor', 'vc', 'venture capital', 'angel']],
  ['manager', ['manager', 'management', 'lead', 'head']],
  ['marketing', ['marketing', 'growth', 'brand']],
  ['product', ['product', 'pm', 'product manager']],
  ['recruiter', ['recruiter', 'recruiting', 'talent acquisition']],
  ['sales', ['sales', 'business development', 'bd']],
  ['startup', ['startup', 'start-up', 'scaleup', 'scale-up', 'founder']],
])

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr
  stream.write(`Usage:
  npm run --silent linkedin:agent-search -- stats [--data people-for-llm.jsonl]
  npm run --silent linkedin:agent-search -- search "query terms" [options]

Options:
  --data <path>              JSONL file. Defaults to newest ~/Downloads/linkedin-graph-export-*/people-for-llm.jsonl
  --budget-tokens <n>        Soft output budget. Default ${DEFAULT_BUDGET_TOKENS}; hard max ${DEFAULT_HARD_BUDGET_TOKENS}
  --limit <n>                Max records before budget trimming. Default ${DEFAULT_LIMIT}
  --offset <n>               Page offset after ranking. Default 0
  --mode all|any             all = every query term group must match. Default all
  --format json|jsonl|ids    Output format. Default json
  --no-expand                Disable transparent synonym expansion
  --debug                    Include matched fields/needles for each result

Query syntax:
  Plain words search all fields:       "founder agile"
  Quoted phrases stay together:        "\\"software engineer\\""
  Field filters are grep-like:         "circle:Novo role:coach"
  Supported fields: id, name, circle, role, note, link
`)
  process.exit(exitCode)
}

function parseArgs(argv) {
  const args = {
    command: argv[2] ?? '',
    queryParts: [],
    data: process.env.LINKEDIN_PEOPLE_JSONL || '',
    budgetTokens: DEFAULT_BUDGET_TOKENS,
    limit: DEFAULT_LIMIT,
    offset: 0,
    mode: 'all',
    format: 'json',
    expand: true,
    debug: false,
  }

  for (let i = 3; i < argv.length; i += 1) {
    const token = argv[i]
    const next = argv[i + 1]
    if (token === '--help' || token === '-h') usage(0)
    else if (token === '--data' && next) { args.data = next; i += 1 }
    else if (token === '--budget-tokens' && next) { args.budgetTokens = Number(next); i += 1 }
    else if (token === '--limit' && next) { args.limit = Number(next); i += 1 }
    else if (token === '--offset' && next) { args.offset = Number(next); i += 1 }
    else if (token === '--mode' && next) { args.mode = next; i += 1 }
    else if (token === '--format' && next) { args.format = next; i += 1 }
    else if (token === '--no-expand') args.expand = false
    else if (token === '--debug') args.debug = true
    else if (token.startsWith('--')) throw new Error(`Unknown option: ${token}`)
    else args.queryParts.push(token)
  }
  args.query = args.queryParts.join(' ').trim()
  return args
}

function assertArgs(args) {
  if (!['stats', 'search'].includes(args.command)) usage(1)
  if (args.command === 'search' && !args.query) throw new Error('search requires a query.')
  if (!Number.isFinite(args.budgetTokens) || args.budgetTokens <= 0) throw new Error('--budget-tokens must be positive.')
  if (args.budgetTokens > DEFAULT_HARD_BUDGET_TOKENS) {
    throw new Error(`--budget-tokens is capped at ${DEFAULT_HARD_BUDGET_TOKENS} to avoid oversized LLM context.`)
  }
  if (!Number.isInteger(args.limit) || args.limit <= 0) throw new Error('--limit must be a positive integer.')
  if (!Number.isInteger(args.offset) || args.offset < 0) throw new Error('--offset must be a non-negative integer.')
  if (!['all', 'any'].includes(args.mode)) throw new Error('--mode must be all or any.')
  if (!['json', 'jsonl', 'ids'].includes(args.format)) throw new Error('--format must be json, jsonl, or ids.')
}

function newestDefaultDataPath() {
  const downloads = path.join(os.homedir(), 'Downloads')
  if (!fs.existsSync(downloads)) return ''
  const candidates = []
  for (const name of fs.readdirSync(downloads)) {
    if (!name.startsWith('linkedin-graph-export-')) continue
    const file = path.join(downloads, name, 'people-for-llm.jsonl')
    if (!fs.existsSync(file)) continue
    candidates.push({ file, mtimeMs: fs.statSync(file).mtimeMs })
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return candidates[0]?.file ?? ''
}

function resolveDataPath(input) {
  const resolved = input || newestDefaultDataPath()
  if (!resolved) throw new Error('No JSONL file found. Pass --data /path/to/people-for-llm.jsonl.')
  const absolute = path.resolve(resolved.replace(/^~/, os.homedir()))
  if (!fs.existsSync(absolute)) throw new Error(`JSONL file not found: ${absolute}`)
  return absolute
}

function readPeople(jsonlPath) {
  const text = fs.readFileSync(jsonlPath, 'utf8')
  const people = []
  let lineNumber = 0
  for (const line of text.split(/\r?\n/)) {
    lineNumber += 1
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      people.push(JSON.parse(trimmed))
    } catch (error) {
      throw new Error(`Invalid JSONL at ${jsonlPath}:${lineNumber}: ${error.message}`)
    }
  }
  return people
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@./:+#-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitQuery(raw) {
  const out = []
  const re = /"([^"]+)"|'([^']+)'|(\S+)/g
  let match
  while ((match = re.exec(raw))) out.push(match[1] ?? match[2] ?? match[3])
  return out
}

function parseQuery(raw, expand) {
  const terms = []
  const fieldTerms = []
  for (const part of splitQuery(raw)) {
    const fieldMatch = part.match(/^([a-zA-Z]+):(.+)$/)
    const rawField = fieldMatch?.[1]?.toLowerCase()
    const value = fieldMatch ? fieldMatch[2] : part
    const field = rawField ? (FIELD_ALIASES.get(rawField) ?? rawField) : 'any'
    if (!['any', 'id', 'name', 'circle', 'role', 'note', 'link'].includes(field)) {
      throw new Error(`Unsupported query field: ${rawField}`)
    }
    const normalized = normalize(value)
    if (!normalized) continue
    const alternatives = expand ? (EXPANSIONS.get(normalized) ?? [normalized]) : [normalized]
    const term = {
      field,
      raw: value,
      alternatives: [...new Set(alternatives.map(normalize).filter(Boolean))],
    }
    if (field === 'any') terms.push(term)
    else fieldTerms.push(term)
  }
  return { terms, fieldTerms, allTerms: [...terms, ...fieldTerms] }
}

function personFields(person) {
  const notes = person.notes && typeof person.notes === 'object' ? person.notes : {}
  const links = person.links && typeof person.links === 'object' ? person.links : {}
  const role = notes.Position ?? notes.Role ?? notes.Title ?? notes.Headline ?? ''
  const noteText = Object.entries(notes).map(([key, value]) => `${key} ${value}`).join(' ')
  const linkText = Object.values(links).join(' ')
  const circle = person.circlePathText ?? (Array.isArray(person.circlePath) ? person.circlePath.join(' ') : '')
  return {
    id: normalize(person.id),
    name: normalize(person.name),
    circle: normalize(circle),
    role: normalize(role),
    note: normalize(noteText),
    link: normalize(linkText),
    any: normalize([person.id, person.name, circle, role, noteText, linkText].filter(Boolean).join(' ')),
  }
}

function findTermMatch(fields, term) {
  const fieldNames = term.field === 'any'
    ? ['name', 'role', 'circle', 'note', 'id', 'link']
    : [term.field]
  for (const needle of term.alternatives) {
    for (const field of fieldNames) {
      if (fields[field]?.includes(needle)) return { field, needle }
    }
  }
  return null
}

function fieldWeight(field) {
  if (field === 'id') return 120
  if (field === 'name') return 90
  if (field === 'role') return 55
  if (field === 'circle') return 38
  if (field === 'note') return 28
  if (field === 'link') return 5
  return 10
}

function scorePerson(person, parsedQuery, mode) {
  const fields = personFields(person)
  const matches = []
  let score = 0
  for (const term of parsedQuery.allTerms) {
    const match = findTermMatch(fields, term)
    if (!match) {
      if (mode === 'all') return null
      continue
    }
    matches.push({ raw: term.raw, field: match.field, needle: match.needle })
    score += fieldWeight(match.field)
    if (fields[match.field] === match.needle) score += 40
    else if (fields[match.field].startsWith(match.needle)) score += 20
  }
  if (parsedQuery.allTerms.length > 0 && matches.length === 0) return null
  return { person, score, matches }
}

function comparableDate(person) {
  const value = person.notes?.['Connected On']
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function compactPerson(entry, debug) {
  const person = entry.person
  const record = {
    id: person.id,
    name: person.name,
    circlePathText: person.circlePathText,
    notes: person.notes ?? {},
    links: person.links ?? {},
    score: entry.score,
  }
  if (debug) record.matched = entry.matches
  return record
}

function estimateTokens(text) {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / TOKEN_CHARS)
}

function buildJsonPayload(args, dataPath, people, parsedQuery, ranked) {
  const budgetTokens = Math.min(args.budgetTokens, DEFAULT_HARD_BUDGET_TOKENS)
  const budgetBytes = Math.floor(budgetTokens * TOKEN_CHARS)
  const page = ranked.slice(args.offset, args.offset + args.limit)
  const items = []
  let omittedByBudget = 0

  for (const entry of page) {
    const candidate = compactPerson(entry, args.debug)
    const draft = {
      status: 'ok',
      source: dataPath,
      query: args.query,
      mode: args.mode,
      expandedTerms: parsedQuery.allTerms,
      totalPeople: people.length,
      totalMatches: ranked.length,
      offset: args.offset,
      returned: items.length + 1,
      budgetTokens,
      items: [...items, candidate],
    }
    const bytes = Buffer.byteLength(JSON.stringify(draft), 'utf8')
    if (bytes > budgetBytes && items.length > 0) {
      omittedByBudget = page.length - items.length
      break
    }
    items.push(candidate)
  }

  const payload = {
    status: 'ok',
    source: dataPath,
    query: args.query,
    mode: args.mode,
    expandedTerms: parsedQuery.allTerms,
    totalPeople: people.length,
    totalMatches: ranked.length,
    offset: args.offset,
    returned: items.length,
    omittedByBudget,
    budgetTokens,
    estimatedTokens: 0,
    next: null,
    items,
  }
  while (items.length > 0) {
    const nextOffset = args.offset + items.length
    payload.returned = items.length
    payload.omittedByBudget = omittedByBudget
    payload.next = nextOffset < ranked.length
      ? `npm run --silent linkedin:agent-search -- search ${JSON.stringify(args.query)} --data ${JSON.stringify(dataPath)} --budget-tokens ${budgetTokens} --limit ${args.limit} --offset ${nextOffset} --mode ${args.mode}`
      : null
    payload.estimatedTokens = estimateTokens(JSON.stringify(payload))
    if (payload.estimatedTokens <= budgetTokens) break
    items.pop()
    omittedByBudget += 1
  }
  if (items.length === 0) {
    payload.returned = 0
    payload.omittedByBudget = page.length
    payload.next = args.offset < ranked.length
      ? `npm run --silent linkedin:agent-search -- search ${JSON.stringify(args.query)} --data ${JSON.stringify(dataPath)} --budget-tokens ${budgetTokens} --limit ${args.limit} --offset ${args.offset} --mode ${args.mode}`
      : null
    payload.estimatedTokens = estimateTokens(JSON.stringify(payload))
  }
  return payload
}

function writeResults(args, dataPath, people, parsedQuery, ranked) {
  if (args.format === 'ids') {
    const ids = ranked.slice(args.offset, args.offset + args.limit).map((entry) => entry.person.id)
    process.stdout.write(`${ids.join('\n')}\n`)
    return
  }
  if (args.format === 'jsonl') {
    const payload = buildJsonPayload(args, dataPath, people, parsedQuery, ranked)
    for (const item of payload.items) process.stdout.write(`${JSON.stringify(item)}\n`)
    if (payload.next) {
      process.stderr.write(`More matches: ${payload.next}\n`)
    }
    return
  }
  process.stdout.write(`${JSON.stringify(buildJsonPayload(args, dataPath, people, parsedQuery, ranked), null, 2)}\n`)
}

function stats(dataPath, people) {
  const companies = new Map()
  let withRole = 0
  let withEmail = 0
  let withLinkedIn = 0
  for (const person of people) {
    const circle = person.circlePathText ?? ''
    companies.set(circle, (companies.get(circle) ?? 0) + 1)
    if (person.notes?.Position) withRole += 1
    if (person.notes?.Email) withEmail += 1
    if (person.links?.linkedin) withLinkedIn += 1
  }
  const topCircles = [...companies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([circlePathText, count]) => ({ circlePathText, count }))
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    source: dataPath,
    people: people.length,
    circles: companies.size,
    withRole,
    withEmail,
    withLinkedIn,
    topCircles,
  }, null, 2)}\n`)
}

function main() {
  try {
    const args = parseArgs(process.argv)
    assertArgs(args)
    const dataPath = resolveDataPath(args.data)
    const people = readPeople(dataPath)
    if (args.command === 'stats') {
      stats(dataPath, people)
      return
    }
    const parsedQuery = parseQuery(args.query, args.expand)
    const ranked = people
      .map((person) => scorePerson(person, parsedQuery, args.mode))
      .filter(Boolean)
      .sort((left, right) => right.score - left.score || comparableDate(right.person) - comparableDate(left.person) || left.person.name.localeCompare(right.person.name))
    writeResults(args, dataPath, people, parsedQuery, ranked)
  } catch (error) {
    process.stderr.write(`linkedin-agent-search error: ${error.message}\n`)
    process.exit(1)
  }
}

main()
