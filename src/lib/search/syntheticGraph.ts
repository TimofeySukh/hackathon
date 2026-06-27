/**
 * Synthetic graphs for local Search Lab (browser). Seeded deterministic data.
 */

import type { CircleNode, GraphState, PersonNode } from '../board/types'
import { buildPersonSearchSummary } from './searchSummary'

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, list: T[]) {
  return list[Math.floor(rand() * list.length)]
}

function makeCircle(id: string, name: string, parentId: string | null = null): CircleNode {
  return {
    id,
    name,
    icon: name.slice(0, 2).toUpperCase(),
    x: 0,
    y: 0,
    radius: 72,
    minRadius: 48,
    parentId,
    connectedTo: null,
    tone: 'blue',
    fillMode: 'transparent',
  }
}

function makePerson(id: string, name: string, circleId: string, notes: PersonNode['notes'] = []): PersonNode {
  return {
    id,
    name,
    x: 0,
    y: 0,
    circleId,
    avatar: name.slice(0, 2).toUpperCase(),
    notes,
  }
}

function ensureSummaries(graph: GraphState) {
  for (const person of graph.people) {
    if (!person.searchSummary?.trim()) {
      person.searchSummary = buildPersonSearchSummary(graph, person)
    }
  }
}

export type SyntheticGraphMeta = {
  label: string
  peopleCount: number
  founders: number
  acmeEngineers: number
  startupDecoys: number
}

const FIRST = ['Alice', 'Bob', 'Carol', 'David', 'Elena', 'Frank', 'Grace', 'Hugo', 'Iris', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah']
const LAST = ['Chen', 'Smith', 'Lee', 'Park', 'Garcia', 'Kim', 'Novak', 'Brown', 'Singh', 'Wright', 'Mueller', 'Silva']

const FILLER_COMPANIES = [
  'Pied Piper', 'Hooli', 'Massive Dynamic', 'Cyberdyne', 'Stark Industries', 'Oscorp',
  'LexCorp', 'Dunder Mifflin', 'Virtucon', 'Nakatomi', 'Bluth Company', 'Wayne Enterprises',
  'Umbrella Labs', 'Globex', 'Initech', 'Acme Corp',
]

/** ~300 people — fast default for UI */
export function buildSmallSyntheticGraph(): GraphState & { meta: SyntheticGraphMeta } {
  const rand = mulberry32(42)
  const peopleCount = 300
  const circles: CircleNode[] = [
    makeCircle('you', 'You'),
    makeCircle('personal', 'Personal'),
    makeCircle('work', 'Work'),
    makeCircle('work-startups', 'Startups', 'work'),
    makeCircle('work-enterprise', 'Enterprise', 'work'),
    makeCircle('co-acme', 'Acme Corp', 'work-enterprise'),
    makeCircle('co-globex', 'Globex', 'work-enterprise'),
    makeCircle('yc-alumni', 'Y Combinator Alumni', 'work-startups'),
    makeCircle('investors', 'Investors', 'work-startups'),
    makeCircle('personal-family', 'Family', 'personal'),
  ]

  const people: PersonNode[] = [
    makePerson('person-special-alice', 'Alice Chen', 'personal-family', [
      { id: 'n0', title: 'Private', body: 'i love her' },
    ]),
  ]

  let founders = 0
  let acmeEngineers = 0
  let startupDecoys = 0
  const startupTarget = 36
  const acmeTarget = 9

  for (let i = 0; i < peopleCount; i += 1) {
    const id = `person-${i}`
    const name = `${pick(rand, FIRST)} ${pick(rand, LAST)}`
    let circleId = pick(rand, ['work-startups', 'co-acme', 'co-globex', 'yc-alumni', 'investors'])
    const notes: PersonNode['notes'] = []

    if (founders < startupTarget && rand() < 0.14) {
      circleId = pick(rand, ['work-startups', 'yc-alumni'])
      notes.push({
        id: `${id}-p`,
        title: 'Position',
        body: pick(rand, ['startup founder building AI tools', 'co-founder at early-stage startup', 'founding engineer']),
      })
      founders += 1
    } else if (acmeEngineers < acmeTarget && (circleId === 'co-acme' || rand() < 0.04)) {
      circleId = 'co-acme'
      notes.push({ id: `${id}-p`, title: 'Position', body: `${pick(rand, ['Junior', 'Senior', 'Staff'])} Software Engineer` })
      acmeEngineers += 1
    } else if (circleId === 'work-startups' && rand() < 0.08) {
      notes.push({ id: `${id}-p`, title: 'Position', body: 'Account Executive' })
      notes.push({ id: `${id}-n`, title: 'Note', body: 'Works with startups sometimes' })
      startupDecoys += 1
    } else {
      notes.push({ id: `${id}-p`, title: 'Position', body: pick(rand, ['Designer', 'Recruiter', 'Consultant', 'Software Engineer']) })
    }

    people.push(makePerson(id, name, circleId, notes))
  }

  const graph: GraphState = { circles, people, connections: [] }
  ensureSummaries(graph)
  return {
    ...graph,
    meta: { label: 'Small synthetic (300)', peopleCount: people.length, founders, acmeEngineers, startupDecoys },
  }
}

/** ~3000 people — large bench scale */
export function buildLargeSyntheticGraph(): GraphState & { meta: SyntheticGraphMeta } {
  const rand = mulberry32(42)
  const peopleCount = 3000
  const circles: CircleNode[] = [
    makeCircle('you', 'You'),
    makeCircle('work', 'Work'),
    makeCircle('work-startups', 'Startups', 'work'),
    makeCircle('work-enterprise', 'Enterprise', 'work'),
    makeCircle('co-acme', 'Acme Corp', 'work-enterprise'),
    makeCircle('co-globex', 'Globex', 'work-enterprise'),
    makeCircle('co-initech', 'Initech', 'work-enterprise'),
    makeCircle('co-wayne', 'Wayne Enterprises', 'work-enterprise'),
    makeCircle('yc-alumni', 'Y Combinator Alumni', 'work-startups'),
    makeCircle('personal-family', 'Family', 'personal'),
  ]

  for (let i = 0; i < 80; i += 1) {
    const name = `${FILLER_COMPANIES[i % FILLER_COMPANIES.length]}${i >= FILLER_COMPANIES.length ? ` ${Math.floor(i / FILLER_COMPANIES.length)}` : ''}`
    circles.push(makeCircle(`co-fill-${i}`, name, 'work-enterprise'))
  }

  const fillerIds = circles.filter((c) => c.id.startsWith('co-fill-')).map((c) => c.id)
  const people: PersonNode[] = [
    makePerson('person-special-alice', 'Alice Chen', 'personal-family', [
      { id: 'n0', title: 'Private', body: 'i love her' },
    ]),
  ]

  let founders = 0
  let acmeEngineers = 0
  let startupDecoys = 0
  const targets = { founders: 360, acme: 45, globexSr: 36, ycInv: 26, devconf: 21, entFound: 45, initechPm: 18, aiSpk: 39, decoys: 60 }
  const queue: string[] = []
  Object.entries(targets).forEach(([k, n]) => { for (let i = 0; i < n; i += 1) queue.push(k) })
  while (queue.length < peopleCount) queue.push('generic')
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]]
  }

  for (let i = 0; i < peopleCount; i += 1) {
    const id = `person-${i}`
    const name = `${pick(rand, FIRST)} ${pick(rand, LAST)}`
    const kind = queue[i] ?? 'generic'
    let circleId = pick(rand, fillerIds)
    const notes: PersonNode['notes'] = []

    if (kind === 'founders') {
      circleId = pick(rand, ['work-startups', 'yc-alumni'])
      notes.push({ id: `${id}-p`, title: 'Position', body: pick(rand, ['startup founder building AI tools', 'co-founder at early-stage startup']) })
      founders += 1
    } else if (kind === 'acme') {
      circleId = 'co-acme'
      notes.push({ id: `${id}-p`, title: 'Position', body: `${pick(rand, ['Junior', 'Senior', 'Staff'])} Software Engineer` })
      acmeEngineers += 1
    } else if (kind === 'globexSr') {
      circleId = 'co-globex'
      notes.push({ id: `${id}-p`, title: 'Position', body: 'Senior Software Engineer' })
    } else if (kind === 'ycInv') {
      circleId = 'yc-alumni'
      notes.push({ id: `${id}-p`, title: 'Position', body: pick(rand, ['Angel investor', 'VC partner']) })
      notes.push({ id: `${id}-n`, title: 'Note', body: 'YC W19 batch' })
    } else if (kind === 'devconf') {
      notes.push({ id: `${id}-p`, title: 'Position', body: 'Platform Engineer' })
      notes.push({ id: `${id}-e`, title: 'Event', body: 'DevConf 2025 — Rust workshop lead' })
    } else if (kind === 'entFound') {
      circleId = pick(rand, ['co-wayne', 'co-globex', 'co-initech'])
      notes.push({ id: `${id}-p`, title: 'Position', body: pick(rand, ['Founding CEO', 'Co-founder']) })
    } else if (kind === 'initechPm') {
      circleId = 'co-initech'
      notes.push({ id: `${id}-p`, title: 'Position', body: 'Product Manager' })
      notes.push({ id: `${id}-n`, title: 'Note', body: 'Owns payments platform roadmap' })
    } else if (kind === 'aiSpk') {
      notes.push({ id: `${id}-p`, title: 'Position', body: 'ML Engineer' })
      notes.push({ id: `${id}-e`, title: 'Event', body: 'Spoke at AI Summit 2025 about LLM agents' })
    } else if (kind === 'decoys') {
      circleId = 'work-startups'
      notes.push({ id: `${id}-p`, title: 'Position', body: 'Account Executive' })
      startupDecoys += 1
    } else {
      notes.push({ id: `${id}-p`, title: 'Position', body: pick(rand, ['Designer', 'Software Engineer', 'Consultant']) })
      if (rand() < 0.04) {
        circleId = 'co-globex'
        notes[0] = { id: `${id}-p`, title: 'Position', body: 'Junior Software Engineer' }
      }
    }

    people.push(makePerson(id, name, circleId, notes))
  }

  const graph: GraphState = { circles, people, connections: [] }
  ensureSummaries(graph)
  return {
    ...graph,
    meta: {
      label: 'Large synthetic (3000)',
      peopleCount: people.length,
      founders,
      acmeEngineers,
      startupDecoys,
    },
  }
}

export type SyntheticScale = 'small' | 'large'

export function buildSyntheticGraph(scale: SyntheticScale) {
  return scale === 'large' ? buildLargeSyntheticGraph() : buildSmallSyntheticGraph()
}

export const SEARCH_LAB_PRESETS = [
  { id: 'girlfriend', label: 'Relational', query: 'find my girlfriend' },
  { id: 'startups', label: 'Startup founders', query: 'startup founders and co-founders' },
  { id: 'acme', label: 'Company + role', query: 'software engineers at Acme' },
  { id: 'globex', label: 'Senior + company', query: 'senior software engineers at Globex' },
  { id: 'devconf', label: 'Event + skill', query: 'people from DevConf who know Rust' },
  { id: 'enterprise', label: 'Founders (not Startups circle)', query: 'founders at Wayne Enterprises, Umbrella Labs, Initech, or Globex' },
  { id: 'initech', label: 'Role + note', query: 'Initech product managers working on payments' },
  { id: 'yc', label: 'YC investors', query: 'YC alumni who are investors' },
  { id: 'ai', label: 'AI speakers', query: 'people who spoke about AI at conferences' },
  {
    id: 'multi',
    label: 'Multi-group discovery',
    query: 'YC alumni investors, AI conference speakers, and senior Globex engineers',
  },
] as const
