/**
 * Local discovery engine for Search Lab — heuristic plan + deterministic harness (no API).
 */

import type { AgentDiscoveryResponse, AgentDiscoveryStep, DiscoveryGroup, DiscoveryPerson } from '../agentDiscovery'
import type { GraphState } from '../board/types'
import { getCirclePath, getPersonPosition } from './graphSearch'
import {
  expandSearchTerms,
  runLocalGroupPipeline,
  type ScoredMatch,
} from './clientHarness'
const GROUP_TONES: DiscoveryGroup['tone'][] = ['blue', 'green', 'amber', 'violet', 'red']

type PlanGroup = {
  id: string
  label: string
  description: string
  searchTerms: string[]
}

function tokenize(query: string) {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !['find', 'and', 'the', 'who', 'with', 'from'].includes(t))
}

function heuristicDiscoveryPlan(query: string): { thinking: string; groups: PlanGroup[]; suggestions: string[] } {
  const trimmed = query.trim()
  return {
    thinking: 'Single-group scan with expanded terms (local harness — use LLM agent for multi-group planning).',
    groups: [{
      id: 'group-1',
      label: 'Matches',
      description: trimmed,
      searchTerms: expandSearchTerms(trimmed, tokenize(trimmed), { wantMultiple: true }),
    }],
    suggestions: ['Switch to LLM agent to auto-plan discovery groups'],
  }
}

function buildPersonSubtitle(graph: GraphState, personId: string) {
  const person = graph.people.find((p) => p.id === personId)
  if (!person) return ''
  const path = getCirclePath(graph, person.circleId).map((c) => c.name).join(' › ')
  const position = getPersonPosition(person)
  return position && path ? `${path} · ${position}` : path || position || ''
}

function matchesToDiscoveryPeople(graph: GraphState, matches: ScoredMatch[]): DiscoveryPerson[] {
  return matches.map((entry) => ({
    id: entry.id,
    name: graph.people.find((p) => p.id === entry.id)?.name ?? entry.id,
    subtitle: buildPersonSubtitle(graph, entry.id),
    aiReason: entry.reason,
    confidence: entry.confidence,
    x: 0,
    y: 0,
  }))
}

export function runLocalDiscovery(
  graph: GraphState,
  query: string,
): AgentDiscoveryResponse {
  const trimmed = query.trim()
  const steps: AgentDiscoveryStep[] = [{ id: 'read', label: 'Reading your question', detail: trimmed }]

  const plan = heuristicDiscoveryPlan(trimmed)
  steps.push({
    id: 'plan',
    label: 'Planning discovery groups (local)',
    detail: `${plan.groups.length} cluster${plan.groups.length === 1 ? '' : 's'}: ${plan.groups.map((g) => g.label).join(', ')}`,
  })

  steps.push({ id: 'scan', label: 'Scanning all profiles', detail: `${graph.people.length} people in synthetic graph` })

  const layoutGroups: DiscoveryGroup[] = []
  let maxAutoLimit = 0

  for (const group of plan.groups) {
    const terms = expandSearchTerms(group.description, group.searchTerms, { wantMultiple: true })
    const pipeline = runLocalGroupPipeline(graph, trimmed, group.label, terms, {
      wantMultiple: true,
    })

    maxAutoLimit = Math.max(maxAutoLimit, pipeline.limit)

    steps.push({
      id: `prefilter-${group.id}`,
      label: `Prefilter: ${group.label}`,
      detail: `${pipeline.strongCount} strong · ${pipeline.candidates.length} candidates`,
    })
    steps.push({
      id: `match-${group.id}`,
      label: `Local match: ${group.label}`,
      detail: `${pipeline.matches.length} profiles (auto limit ${pipeline.limit})`,
    })
    if (pipeline.auditAdded > 0) {
      steps.push({
        id: `audit-${group.id}`,
        label: `Recall audit: ${group.label}`,
        detail: `Added ${pipeline.auditAdded} missed strong match${pipeline.auditAdded === 1 ? '' : 'es'}`,
      })
    }

    layoutGroups.push({
      id: group.id,
      label: group.label,
      description: group.description,
      tone: GROUP_TONES[layoutGroups.length % GROUP_TONES.length],
      people: matchesToDiscoveryPeople(graph, pipeline.matches),
    })
  }

  const foundCount = layoutGroups.reduce((sum, group) => sum + group.people.length, 0)

  steps.push({
    id: 'layout',
    label: 'Organizing board graph',
    detail: `${foundCount} people across ${layoutGroups.length} discovery circle${layoutGroups.length === 1 ? '' : 's'}`,
  })

  return {
    query: trimmed,
    mode: 'discovery',
    explanation: plan.thinking,
    steps,
    suggestions: plan.suggestions,
    groups: layoutGroups,
    totalScanned: graph.people.length,
    perGroupLimit: maxAutoLimit,
  }
}

export function runLocalFlatSearch(graph: GraphState, query: string) {
  const terms = expandSearchTerms(query, tokenize(query), { wantMultiple: true })
  const pipeline = runLocalGroupPipeline(graph, query, 'Matches', terms, { wantMultiple: true })
  return {
    query,
    explanation: 'Flat ranked list from local harness (prefilter + strong tier + audit).',
    steps: [
      { id: 'scan', label: 'Scanning profiles', detail: `${graph.people.length} people` },
      { id: 'match', label: 'Local match', detail: `${pipeline.matches.length} results (auto limit ${pipeline.limit})` },
    ] as AgentDiscoveryStep[],
    results: pipeline.matches.map((m) => {
      const person = graph.people.find((p) => p.id === m.id)!
      return {
        id: m.id,
        name: person.name,
        subtitle: buildPersonSubtitle(graph, m.id),
        aiReason: m.reason,
        confidence: m.confidence,
      }
    }),
  }
}
