import { buildSearchIntentFromQuery, getCirclePath, type GraphState } from './graphSearch.ts'
import { ensurePersonSearchSummaries } from './searchSummary.ts'
import { callHelperLlm } from './llmProvider.ts'
import {
  expandSearchTerms,
  parseJsonObject,
  runGroupMatchPipeline,
  uniqueTerms,
} from './searchHarness.ts'
import type { AgentSearchStep } from './agentSearch.ts'

const DISCOVERY_PLAN_PROMPT = `You plan people discovery on a personal relationship graph (thousands of contacts with notes).
Return ONLY JSON:
{
  "thinking": "one short sentence in the user's language",
  "groups": [
    {
      "id": "group-1",
      "label": "Short UI label (2-4 words)",
      "description": "Who belongs in this cluster",
      "searchTerms": ["literal terms for name/note/circle substring match, include synonyms and translations"]
    }
  ],
  "suggestions": ["optional follow-up searches, max 3"]
}

Rules:
- YOU decide group count (1–4) and labels from user intent — never assume a fixed split pattern
- Separate unrelated asks into distinct groups (e.g. "investors for my startup" vs "first beta testers" -> 2 groups)
- Single-target or vague query -> exactly 1 group with expanded searchTerms
- searchTerms are for deterministic prefilter — include role words, company names, note phrases, translations
- Max 4 groups, min 1 group
- Do not wrap JSON in markdown`

const GROUP_TONES = ['blue', 'green', 'amber', 'violet', 'red'] as const

export type DiscoveryPerson = {
  id: string
  name: string
  subtitle: string
  aiReason: string
  confidence: number
  x: number
  y: number
  notes?: GraphState['people'][number]['notes']
  links?: GraphState['people'][number]['links']
  searchSummary?: string
}

export type DiscoveryGroup = {
  id: string
  label: string
  description: string
  tone: typeof GROUP_TONES[number]
  people: DiscoveryPerson[]
}

export type AgentDiscoveryResponse = {
  query: string
  mode: 'discovery'
  explanation: string
  steps: AgentSearchStep[]
  suggestions: string[]
  groups: DiscoveryGroup[]
  totalScanned: number
  perGroupLimit: number
  llmCalls: number
  llmProviders: string[]
}

type PlanGroup = {
  id?: string
  label?: string
  description?: string
  searchTerms?: string[]
}

type PlanResult = {
  thinking?: string
  groups?: PlanGroup[]
  suggestions?: string[]
}

function buildPersonSubtitle(graph: GraphState, personId: string) {
  const person = graph.people.find((candidate) => candidate.id === personId)
  if (!person) return ''
  const circlePath = getCirclePath(graph, person.circleId)
  const pathLabel = circlePath.map((circle) => circle.name).filter(Boolean).join(' › ')
  const position = (person.notes ?? []).find((note) =>
    ['position', 'headline', 'title', 'role'].includes(note.title.trim().toLowerCase())
  )?.body
  return position && pathLabel ? `${pathLabel} · ${position}` : pathLabel || position || ''
}

function sortForProximity(
  people: Array<{ id: string; confidence: number; reason: string }>,
  graph: GraphState,
) {
  return [...people].sort((left, right) => {
    const leftPerson = graph.people.find((p) => p.id === left.id)
    const rightPerson = graph.people.find((p) => p.id === right.id)
    const leftCircle = leftPerson ? getCirclePath(graph, leftPerson.circleId).map((c) => c.name).join(' › ') : ''
    const rightCircle = rightPerson ? getCirclePath(graph, rightPerson.circleId).map((c) => c.name).join(' › ') : ''
    const circleCmp = leftCircle.localeCompare(rightCircle)
    if (circleCmp !== 0) return circleCmp
    return (leftPerson?.name ?? left.id).localeCompare(rightPerson?.name ?? right.id)
  })
}

function arrangePeopleInRing(
  people: Array<{ id: string; confidence: number; reason: string }>,
  graph: GraphState,
  cx: number,
  cy: number,
  radius: number,
  perGroupLimit: number,
): DiscoveryPerson[] {
  const sorted = sortForProximity(people, graph).slice(0, perGroupLimit)
  const count = sorted.length
  if (count === 0) return []

  const ringRadius = Math.min(radius, 0.08 + count * 0.012)

  return sorted.map((entry, index) => {
    const angle = count === 1 ? 0 : (2 * Math.PI * index) / count - Math.PI / 2
    const person = graph.people.find((p) => p.id === entry.id)
    return {
      id: entry.id,
      name: person?.name ?? entry.id,
      subtitle: buildPersonSubtitle(graph, entry.id),
      aiReason: entry.reason,
      confidence: entry.confidence,
      x: cx + ringRadius * Math.cos(angle),
      y: cy + ringRadius * Math.sin(angle),
      notes: person?.notes ?? [],
      links: person?.links ?? [],
      searchSummary: person?.searchSummary,
    }
  })
}

function computeDiscoveryLayout(
  graph: GraphState,
  groups: Array<{
    id: string
    label: string
    description: string
    matches: Array<{ id: string; confidence: number; reason: string }>
  }>,
  perGroupLimit: number,
): DiscoveryGroup[] {
  const cx = 0.5
  const cy = 0.5

  if (groups.length === 1) {
    const group = groups[0]
    return [{
      id: group.id,
      label: group.label,
      description: group.description,
      tone: GROUP_TONES[0],
      people: arrangePeopleInRing(group.matches, graph, cx, cy, 0.34, perGroupLimit),
    }]
  }

  const groupRingRadius = 0.28
  return groups.map((group, index) => {
    const angle = (2 * Math.PI * index) / groups.length - Math.PI / 2
    const gx = cx + groupRingRadius * Math.cos(angle)
    const gy = cy + groupRingRadius * Math.sin(angle)
    return {
      id: group.id,
      label: group.label,
      description: group.description,
      tone: GROUP_TONES[index % GROUP_TONES.length],
      people: arrangePeopleInRing(group.matches, graph, gx, gy, 0.14, perGroupLimit),
    }
  })
}

function normalizePlanGroups(plan: PlanResult, query: string) {
  const rawGroups = (plan.groups ?? []).filter((group) => group && typeof group === 'object')

  return rawGroups.slice(0, 4).map((group, index) => ({
    id: typeof group.id === 'string' && group.id.trim() ? group.id.trim() : `group-${index + 1}`,
    label: typeof group.label === 'string' && group.label.trim() ? group.label.trim() : `Group ${index + 1}`,
    description: typeof group.description === 'string' && group.description.trim() ? group.description.trim() : query,
    searchTerms: uniqueTerms(group.searchTerms, buildSearchIntentFromQuery(query).keywords, [query]),
  }))
}

export async function runAgentDiscovery(
  graph: GraphState,
  query: string,
  perGroupLimit?: number,
): Promise<AgentDiscoveryResponse> {
  const trimmed = query.trim()
  const steps: AgentSearchStep[] = []
  const circleNames = graph.circles.map((circle) => circle.name).filter(Boolean)
  const totalScanned = graph.people.length
  let llmCalls = 0
  const llmProviders: string[] = []
  let maxAutoLimit = 0

  steps.push({ id: 'read', label: 'Reading your question', detail: trimmed })

  let explanation = 'Planning how to cluster people from your graph.'
  let suggestions: string[] = []

  const { content: planContent, provider: planProvider } = await callHelperLlm({
    system: DISCOVERY_PLAN_PROMPT,
    user: { query: trimmed, circles: circleNames.slice(0, 200), peopleCount: totalScanned },
    maxTokens: 480,
  })
  if (planProvider) llmProviders.push(planProvider)
  if (planContent) llmCalls += 1
  if (!planContent) {
    throw new Response('LLM discovery planner returned no response. Check graph-api provider secrets and Edge Function logs.', { status: 502 })
  }

  const plan = planContent ? parseJsonObject<PlanResult>(planContent) : null
  if (!plan) {
    throw new Response('LLM discovery planner returned invalid JSON. Check provider compatibility with JSON responses.', { status: 502 })
  }
  if (plan?.thinking?.trim()) explanation = plan.thinking.trim()
  const planGroups = normalizePlanGroups(plan, trimmed)
  if (planGroups.length === 0) {
    throw new Response('LLM discovery planner returned no groups for this query.', { status: 502 })
  }
  suggestions = (plan?.suggestions ?? []).filter((item) => typeof item === 'string').slice(0, 3)

  steps.push({
    id: 'plan',
    label: 'Planning discovery groups (helper)',
    detail: `${planGroups.length} cluster${planGroups.length === 1 ? '' : 's'}: ${planGroups.map((g) => g.label).join(', ')}`,
  })

  ensurePersonSearchSummaries(graph)
  steps.push({ id: 'scan', label: 'Scanning all profiles', detail: `${totalScanned} people in graph` })

  const matchedGroups: Array<{
    id: string
    label: string
    description: string
    matches: Array<{ id: string; confidence: number; reason: string }>
  }> = []

  for (const group of planGroups) {
    const terms = expandSearchTerms(group.searchTerms, { query: trimmed, wantMultiple: true })

    const pipeline = await runGroupMatchPipeline(graph, trimmed, group.label, terms, {
      wantMultiple: true,
      limit: perGroupLimit,
      verify: true,
    })
    llmCalls += pipeline.llmCalls
    for (const provider of pipeline.providers) {
      if (!llmProviders.includes(provider)) llmProviders.push(provider)
    }
    maxAutoLimit = Math.max(maxAutoLimit, pipeline.limit)

    steps.push({
      id: `prefilter-${group.id}`,
      label: `Prefilter: ${group.label}`,
      detail: `${pipeline.strongCount} strong + ${pipeline.candidates.length} total candidates`,
    })

    if (pipeline.usedLocalFallback) {
      steps.push({
        id: `local-${group.id}`,
        label: `Local matches: ${group.label}`,
        detail: `${pipeline.matches.length} profiles`,
      })
    } else if (pipeline.matches.length > 0) {
      steps.push({
        id: `match-${group.id}`,
        label: `AI matched: ${group.label}`,
        detail: `${pipeline.matches.length} profiles (worker)`,
      })
    }

    if (pipeline.verifyRejected > 0) {
      steps.push({
        id: `verify-${group.id}`,
        label: `Verified: ${group.label}`,
        detail: `Rejected ${pipeline.verifyRejected} false positive${pipeline.verifyRejected === 1 ? '' : 's'} (helper)`,
      })
    }

    if (pipeline.auditAdded > 0) {
      steps.push({
        id: `audit-${group.id}`,
        label: `Recall audit: ${group.label}`,
        detail: `Added ${pipeline.auditAdded} missed strong match${pipeline.auditAdded === 1 ? '' : 'es'}`,
      })
    }

    matchedGroups.push({
      id: group.id,
      label: group.label,
      description: group.description,
      matches: pipeline.matches,
    })
  }

  const layoutLimit = perGroupLimit ?? maxAutoLimit
  const layoutGroups = computeDiscoveryLayout(graph, matchedGroups, layoutLimit)
  const foundCount = layoutGroups.reduce((sum, group) => sum + group.people.length, 0)

  steps.push({
    id: 'layout',
    label: 'Arranging clusters on map',
    detail: `${foundCount} people across ${layoutGroups.length} group${layoutGroups.length === 1 ? '' : 's'}`,
  })

  if (foundCount === 0 && suggestions.length === 0) {
    suggestions = [
      'Try naming the exact role, company, event, or relationship context',
      'Add profile notes with the context you want discovery to use',
      'Split the request into clearer groups',
    ]
  }

  return {
    query: trimmed,
    mode: 'discovery',
    explanation,
    steps,
    suggestions,
    groups: layoutGroups,
    totalScanned,
    perGroupLimit: layoutLimit,
    llmCalls,
    llmProviders,
  }
}
