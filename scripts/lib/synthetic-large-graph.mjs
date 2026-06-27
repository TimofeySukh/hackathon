/**
 * Large-scale synthetic graph (~3k) with decoys and tagged cohorts for hard evals.
 * Ground truth is in graph.tags; queries need conjunctive guards or multi-group passes.
 */

import {
  ensureSearchSummaries,
  getCirclePath,
  mulberry32,
} from './synthetic-search-graph.mjs'

const FIRST = [
  'Alice', 'Bob', 'Carol', 'David', 'Elena', 'Frank', 'Grace', 'Hugo', 'Iris', 'Jack',
  'Kate', 'Leo', 'Mia', 'Noah', 'Olga', 'Paul', 'Quinn', 'Rita', 'Sam', 'Tina',
]
const LAST = [
  'Chen', 'Smith', 'Lee', 'Park', 'Garcia', 'Kim', 'Novak', 'Brown', 'Singh', 'Wright',
  'Mueller', 'Silva', 'Kowalski', 'Nguyen', 'Petrov', 'Cohen', 'Ali', 'Johansson', 'Rossi', 'Dubois',
]

const ANCHOR_COMPANIES = [
  { id: 'co-acme', name: 'Acme Corp', parentId: 'work-enterprise' },
  { id: 'co-globex', name: 'Globex', parentId: 'work-enterprise' },
  { id: 'co-initech', name: 'Initech', parentId: 'work-enterprise' },
  { id: 'co-umbrella', name: 'Umbrella Labs', parentId: 'work-enterprise' },
  { id: 'co-wayne', name: 'Wayne Enterprises', parentId: 'work-enterprise' },
]

const FILLER_COMPANY_NAMES = [
  'Pied Piper', 'Hooli', 'Massive Dynamic', 'Cyberdyne', 'Soylent', 'Vehement Capital',
  'Stark Industries', 'Oscorp', 'LexCorp', 'Gringotts', 'Monsters Inc', 'Buy n Large',
  'Prestige Worldwide', 'Dunder Mifflin', 'Vandelay Industries', 'Bluth Company',
  'Paper Street', 'Virtucon', 'Nakatomi', 'Spacely Sprockets', 'Cogswell Cogs',
]

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'co'
}

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)]
}

function personPosition(person) {
  for (const note of person.notes ?? []) {
    if (['position', 'headline', 'title', 'role'].includes(note.title.trim().toLowerCase())) {
      return note.body.trim()
    }
  }
  return ''
}

function noteHaystack(person) {
  return (person.notes ?? []).map((n) => `${n.title} ${n.body}`).join(' ').toLowerCase()
}

function circlePathHaystack(graph, person) {
  return getCirclePath(graph.circles, person.circleId).map((c) => c.name).join(' ').toLowerCase()
}

/**
 * @param {number} peopleCount
 * @param {{ seed?: number, companyCount?: number }} [options]
 */
export function buildLargeGraph(peopleCount, options = {}) {
  const seed = options.seed ?? 42
  const companyCount = options.companyCount ?? Math.min(140, Math.max(40, Math.floor(peopleCount / 22)))
  const rand = mulberry32(seed)

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
    { id: 'hackathon', name: 'Hackathon Network', parentId: 'community' },
    { id: 'investors', name: 'Investors', parentId: 'work-startups' },
    { id: 'yc-alumni', name: 'Y Combinator Alumni', parentId: 'work-startups' },
    ...ANCHOR_COMPANIES,
  ]

  for (let i = 0; i < companyCount; i += 1) {
    const base = FILLER_COMPANY_NAMES[i % FILLER_COMPANY_NAMES.length]
    const suffix = i >= FILLER_COMPANY_NAMES.length ? ` ${Math.floor(i / FILLER_COMPANY_NAMES.length) + 1}` : ''
    const name = `${base}${suffix}`
    circles.push({
      id: `co-${slugify(name)}`,
      name,
      parentId: rand() < 0.85 ? 'work-enterprise' : 'work-freelance',
    })
  }

  const fillerCompanyIds = circles
    .filter((c) => c.id.startsWith('co-') && !ANCHOR_COMPANIES.some((a) => a.id === c.id))
    .map((c) => c.id)

  const tags = {
    girlfriend: new Set(['person-special-alice']),
    startupFounders: new Set(),
    startupCircleDecoys: new Set(),
    acmeEngineers: new Set(),
    globexSeniorEng: new Set(),
    ycInvestors: new Set(),
    devconfRust: new Set(),
    enterpriseFounders: new Set(),
    initechPaymentsPm: new Set(),
    aiSpeakers: new Set(),
  }

  const people = [{
    id: 'person-special-alice',
    name: 'Alice Chen',
    circleId: 'personal-family',
    notes: [{ id: 'n-alice', title: 'Private', body: 'i love her' }],
  }]

  const genericRoles = [
    'Account Executive', 'Designer', 'Recruiter', 'Marketing Manager', 'Data Analyst',
    'Support Engineer', 'Lawyer', 'Researcher', 'Teacher', 'Consultant',
  ]

  const targets = {
    startupFounders: Math.max(36, Math.floor(peopleCount * 0.12)),
    startupCircleDecoys: Math.max(24, Math.floor(peopleCount * 0.02)),
    acmeEngineers: Math.max(12, Math.floor(peopleCount * 0.015)),
    globexSeniorEng: Math.max(10, Math.floor(peopleCount * 0.012)),
    ycInvestors: Math.max(8, Math.floor(peopleCount * 0.009)),
    devconfRust: Math.max(8, Math.floor(peopleCount * 0.007)),
    enterpriseFounders: Math.max(10, Math.floor(peopleCount * 0.015)),
    initechPaymentsPm: Math.max(6, Math.floor(peopleCount * 0.006)),
    aiSpeakers: Math.max(10, Math.floor(peopleCount * 0.013)),
  }

  const assignQueue = []
  for (const [kind, count] of Object.entries(targets)) {
    for (let i = 0; i < count; i += 1) assignQueue.push(kind)
  }
  while (assignQueue.length < peopleCount) assignQueue.push('generic')
  for (let i = assignQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [assignQueue[i], assignQueue[j]] = [assignQueue[j], assignQueue[i]]
  }

  for (let i = 0; i < peopleCount; i += 1) {
    const id = `person-${i}`
    const name = `${pick(rand, FIRST)} ${pick(rand, LAST)}`
    const kind = assignQueue[i] ?? 'generic'
    const notes = []
    let circleId = pick(rand, fillerCompanyIds)

    if (kind === 'startupFounders') {
      circleId = rand() < 0.55 ? 'work-startups' : pick(rand, ['yc-alumni', 'investors', 'hackathon'])
      notes.push({
        id: `${id}-pos`,
        title: 'Position',
        body: pick(rand, [
          'startup founder building AI tools',
          'co-founder at early-stage startup',
          'founder & CEO, pre-seed startup',
          'founding engineer at seed startup',
        ]),
      })
      tags.startupFounders.add(id)
    } else if (kind === 'startupCircleDecoys') {
      circleId = 'work-startups'
      notes.push({ id: `${id}-pos`, title: 'Position', body: pick(rand, genericRoles) })
      notes.push({ id: `${id}-n`, title: 'Note', body: 'Works with startups sometimes' })
      tags.startupCircleDecoys.add(id)
    } else if (kind === 'acmeEngineers') {
      circleId = 'co-acme'
      notes.push({
        id: `${id}-pos`,
        title: 'Position',
        body: `${pick(rand, ['Junior', 'Senior', 'Staff'])} Software Engineer`,
      })
      tags.acmeEngineers.add(id)
    } else if (kind === 'globexSeniorEng') {
      circleId = 'co-globex'
      notes.push({ id: `${id}-pos`, title: 'Position', body: 'Senior Software Engineer' })
      tags.globexSeniorEng.add(id)
    } else if (kind === 'ycInvestors') {
      circleId = 'yc-alumni'
      notes.push({
        id: `${id}-pos`,
        title: 'Position',
        body: pick(rand, ['Angel investor', 'VC partner', 'Pre-seed investor']),
      })
      notes.push({ id: `${id}-n`, title: 'Note', body: 'YC W19 batch' })
      tags.ycInvestors.add(id)
    } else if (kind === 'devconfRust') {
      circleId = pick(rand, fillerCompanyIds)
      notes.push({ id: `${id}-pos`, title: 'Position', body: pick(rand, ['Backend Developer', 'Platform Engineer', 'Tech Lead']) })
      notes.push({ id: `${id}-ev`, title: 'Event', body: 'DevConf 2025 — Rust workshop lead' })
      tags.devconfRust.add(id)
    } else if (kind === 'enterpriseFounders') {
      circleId = pick(rand, ['co-wayne', 'co-umbrella', 'co-initech', 'co-globex'])
      notes.push({
        id: `${id}-pos`,
        title: 'Position',
        body: pick(rand, ['Founding CEO', 'Co-founder', 'Founding Director']),
      })
      tags.enterpriseFounders.add(id)
    } else if (kind === 'initechPaymentsPm') {
      circleId = 'co-initech'
      notes.push({ id: `${id}-pos`, title: 'Position', body: 'Product Manager' })
      notes.push({ id: `${id}-n`, title: 'Note', body: 'Owns payments platform roadmap' })
      tags.initechPaymentsPm.add(id)
    } else if (kind === 'aiSpeakers') {
      circleId = pick(rand, fillerCompanyIds)
      notes.push({ id: `${id}-pos`, title: 'Position', body: pick(rand, ['Research Scientist', 'ML Engineer', 'CTO']) })
      notes.push({ id: `${id}-ev`, title: 'Event', body: 'Spoke at AI Summit 2025 about LLM agents' })
      tags.aiSpeakers.add(id)
    } else {
      circleId = pick(rand, [...fillerCompanyIds, 'personal-friends', 'community', 'work-freelance'])
      notes.push({ id: `${id}-pos`, title: 'Position', body: pick(rand, genericRoles) })
      if (rand() < 0.18) {
        notes.push({ id: `${id}-n`, title: 'Note', body: `Met at event ${Math.floor(rand() * 500)}` })
      }
    }

    // Decoys: pollute naive single-pass at scale
    if (kind === 'generic' && rand() < 0.045) {
      notes[0] = { id: `${id}-pos`, title: 'Position', body: `${pick(rand, ['Junior', 'Senior', 'Staff'])} Software Engineer` }
    }
    if (kind === 'generic' && rand() < 0.012) {
      notes.push({ id: `${id}-ev`, title: 'Event', body: 'DevConf 2025 — Kubernetes panel' })
    }
    if (kind === 'generic' && rand() < 0.008) {
      notes[0] = { id: `${id}-pos`, title: 'Position', body: 'Rust Developer' }
    }
    if (kind === 'generic' && rand() < 0.022) {
      circleId = 'co-globex'
      notes[0] = { id: `${id}-pos`, title: 'Position', body: pick(rand, ['Junior Software Engineer', 'Software Engineer', 'Senior Account Executive']) }
    }
    if (kind === 'generic' && rand() < 0.018) {
      circleId = 'co-acme'
      notes[0] = { id: `${id}-pos`, title: 'Position', body: pick(rand, ['Product Manager', 'Designer', 'Recruiter']) }
    }
    if (kind === 'generic' && rand() < 0.012) {
      circleId = 'co-initech'
      notes.push({ id: `${id}-n`, title: 'Note', body: 'payments integration partner' })
    }
    if (kind === 'generic' && rand() < 0.014) {
      notes.push({ id: `${id}-ev`, title: 'Event', body: 'Spoke at AI Summit 2025 about recruiting' })
    }
    if (kind === 'generic' && rand() < 0.01) {
      circleId = 'investors'
      notes.push({ id: `${id}-n`, title: 'Note', body: 'Angel checks' })
    }
    if (kind === 'generic' && rand() < 0.015) {
      notes.push({ id: `${id}-pos2`, title: 'Position', body: 'Senior Consultant' })
    }

    people.push({ id, name, circleId, notes })
  }

  const graph = {
    source: 'synthetic-large',
    seed,
    peopleCount,
    circles,
    people,
    tags,
  }
  ensureSearchSummaries(graph)
  return graph
}

/** Ground-truth predicate for a bench case id (used by harness + single-pass baselines). */
export function personMatchesBenchCase(graph, person, caseId) {
  const pos = personPosition(person).toLowerCase()
  const notes = noteHaystack(person)
  const path = circlePathHaystack(graph, person)

  switch (caseId) {
    case 'girlfriend':
      return /i love her|люблю/.test(notes)
    case 'startup-founders':
      return tagsHas(graph, 'startupFounders', person.id)
    case 'acme-engineers':
      return path.includes('acme') && /software engineer/.test(pos)
    case 'globex-senior-eng':
      return path.includes('globex') && /senior software engineer/.test(pos)
    case 'yc-investors':
      return path.includes('y combinator') && /investor|vc partner|angel/.test(`${pos} ${notes}`)
    case 'devconf-rust':
      return /devconf 2025/.test(notes) && /rust/.test(notes) && !/kubernetes panel/.test(notes)
    case 'enterprise-founders':
      return tagsHas(graph, 'enterpriseFounders', person.id)
        && !path.includes('startups')
    case 'initech-payments-pm':
      return path.includes('initech') && /product manager/.test(pos) && /payments/.test(notes)
    case 'ai-speakers':
      return /spoke at ai summit/.test(notes) && /ai|llm/.test(notes)
    default:
      return false
  }
}

function tagsHas(graph, tag, id) {
  return graph.tags[tag]?.has(id) ?? false
}

export function expectedIdsForCase(graph, caseId) {
  const out = new Set()
  for (const person of graph.people) {
    if (personMatchesBenchCase(graph, person, caseId)) out.add(person.id)
  }
  return out
}

/** Naive one-shot: token OR scoring, production-ish cap, no expandTerms or guards. */
export function naiveSinglePassIds(graph, query, cap = 36) {
  const stop = new Set(['find', 'and', 'the', 'people', 'in', 'at', 'my', 'all', 'who', 'with', 'from', 'not', 'but', 'are', 'who'])
  const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2 && !stop.has(t))
  const scored = []
  for (const person of graph.people) {
    const hay = `${person.searchSummary ?? ''} ${noteHaystack(person)} ${circlePathHaystack(graph, person)}`.toLowerCase()
    let score = 0
    for (const term of terms) if (hay.includes(term)) score += 1
    if (score > 0) scored.push({ id: person.id, score })
  }
  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
  return scored.slice(0, cap).map((e) => e.id)
}

export function largeBenchCases(graph) {
  const co = graph.tags
  return [
    {
      id: 'girlfriend',
      kind: 'relational',
      text: 'find my girlfriend',
      expectedIds: co.girlfriend,
      minRecall: 1,
      singlePassMaxRecall: 0,
      singlePassMustBeWeak: true,
      isRelational: true,
      forceIds: ['person-special-alice'],
      wantMultiple: false,
      whyHard: 'Signal only in Private note, not in role or circle name.',
    },
    {
      id: 'startup-founders',
      kind: 'conjunctive',
      text: 'startup founders and co-founders',
      expectedIds: co.startupFounders,
      minRecall: 0.95,
      singlePassMaxRecall: 0.55,
      singlePassMustBeWeak: true,
      wantMultiple: true,
      auditTo100: true,
      whyHard: 'Startups circle + generic notes pollute a single OR pass on "startup".',
    },
    {
      id: 'acme-engineers',
      kind: 'conjunctive',
      text: 'software engineers at Acme',
      expectedIds: co.acmeEngineers,
      minRecall: 1,
      singlePassMustBeWeak: false,
      wantMultiple: true,
      whyHard: 'Needs company (circle) AND role — bare "engineer" matches hundreds.',
    },
    {
      id: 'globex-senior-eng',
      kind: 'conjunctive',
      text: 'senior software engineers at Globex',
      expectedIds: co.globexSeniorEng,
      minRecall: 1,
      singlePassMustBeWeak: false,
      wantMultiple: true,
      whyHard: 'Globex has junior engineers; "senior" alone is ambiguous.',
    },
    {
      id: 'devconf-rust',
      kind: 'conjunctive',
      text: 'people from DevConf who know Rust',
      expectedIds: co.devconfRust,
      minRecall: 1,
      singlePassMustBeWeak: false,
      wantMultiple: true,
      whyHard: 'Rust signal is in Event note, not Position; DevConf K8s decoys.',
    },
    {
      id: 'enterprise-founders',
      kind: 'conjunctive',
      text: 'founders at Wayne Enterprises, Umbrella Labs, Initech, or Globex',
      expectedIds: co.enterpriseFounders,
      minRecall: 0.95,
      singlePassMustBeWeak: true,
      minGap: 0.12,
      wantMultiple: true,
      auditTo100: true,
      whyHard: 'Must match anchor company circles AND founder role — not the generic Startups bucket.',
    },
    {
      id: 'initech-payments-pm',
      kind: 'conjunctive',
      text: 'Initech product managers working on payments',
      expectedIds: co.initechPaymentsPm,
      minRecall: 1,
      singlePassMustBeWeak: false,
      wantMultiple: true,
      whyHard: 'PM title + payments detail split across Position and Note fields.',
    },
    {
      id: 'yc-investors',
      kind: 'conjunctive',
      text: 'YC alumni who are investors',
      expectedIds: co.ycInvestors,
      minRecall: 1,
      singlePassMaxRecall: 0.45,
      singlePassMustBeWeak: true,
      wantMultiple: true,
      whyHard: 'Investor circle ≠ YC; need Y Combinator Alumni path + investor role.',
    },
    {
      id: 'ai-speakers',
      kind: 'conjunctive',
      text: 'people who spoke about AI at conferences',
      expectedIds: co.aiSpeakers,
      minRecall: 0.95,
      singlePassMaxRecall: 0.92,
      singlePassMustBeWeak: false,
      minGap: 0.03,
      wantMultiple: true,
      auditTo100: true,
      whyHard: 'Speaker signal lives in Event notes with long phrasing.',
    },
    {
      id: 'multi-triple-discovery',
      kind: 'multi-group',
      text: 'YC alumni investors, AI conference speakers, and senior Globex engineers',
      whyHard: 'Three unrelated cohorts — one OR-term pass cross-contaminates groups.',
      singlePassMaxRecall: 0.45,
      minRecall: 0.95,
      groups: [
        {
          id: 'yc-investors',
          text: 'YC alumni investors',
          expectedIds: co.ycInvestors,
          minRecall: 1,
          wantMultiple: true,
        },
        {
          id: 'ai-speakers',
          text: 'people who spoke about AI at conferences',
          expectedIds: co.aiSpeakers,
          minRecall: 0.95,
          wantMultiple: true,
          auditTo100: true,
        },
        {
          id: 'globex-senior-eng',
          text: 'senior software engineers at Globex',
          expectedIds: co.globexSeniorEng,
          minRecall: 1,
          wantMultiple: true,
        },
      ],
    },
  ]
}

export function largeGraphStats(graph) {
  return {
    people: graph.people.length,
    circles: graph.circles.length,
    startupFounders: graph.tags.startupFounders.size,
    startupCircleDecoys: graph.tags.startupCircleDecoys.size,
    acmeEngineers: graph.tags.acmeEngineers.size,
    globexSeniorEng: graph.tags.globexSeniorEng.size,
    ycInvestors: graph.tags.ycInvestors.size,
    devconfRust: graph.tags.devconfRust.size,
    enterpriseFounders: graph.tags.enterpriseFounders.size,
    initechPaymentsPm: graph.tags.initechPaymentsPm.size,
    aiSpeakers: graph.tags.aiSpeakers.size,
  }
}
