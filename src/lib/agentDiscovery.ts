import type { Session } from '@supabase/supabase-js'

import type { GraphState, PersonLink, PersonNote } from './board/types'
import { getSupabaseFunctionUrl } from './supabase'

const GRAPH_API_FUNCTION = 'graph-api'

export type AgentDiscoveryStep = {
  id: string
  label: string
  detail?: string
}

export type DiscoveryPerson = {
  id: string
  name: string
  subtitle: string
  aiReason: string
  confidence: number
  x: number
  y: number
  notes?: PersonNote[]
  links?: PersonLink[]
  searchSummary?: string
}

export type DiscoveryGroup = {
  id: string
  label: string
  description: string
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'red'
  people: DiscoveryPerson[]
}

export type AgentDiscoveryResponse = {
  query: string
  mode: 'discovery'
  explanation: string
  steps: AgentDiscoveryStep[]
  suggestions: string[]
  groups: DiscoveryGroup[]
  totalScanned: number
  perGroupLimit: number
  llmCalls?: number
  llmProviders?: string[]
}

export async function discoverPeopleGraph(
  session: Session,
  query: string,
  perGroupLimit?: number,
): Promise<AgentDiscoveryResponse> {
  const functionUrl = getSupabaseFunctionUrl(GRAPH_API_FUNCTION)
  if (!functionUrl) throw new Error('Supabase is not configured.')

  const body: Record<string, unknown> = { query }
  if (perGroupLimit != null) body.perGroupLimit = perGroupLimit

  const response = await fetch(`${functionUrl}/v1/search/discover`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({})) as AgentDiscoveryResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `Discovery search returned ${response.status}.`)
  }
  return payload
}

/** LLM discovery on a client-provided graph (Search Lab synthetic data). */
export async function discoverSyntheticGraph(
  session: Session,
  graph: GraphState,
  query: string,
  perGroupLimit?: number,
): Promise<AgentDiscoveryResponse> {
  const functionUrl = getSupabaseFunctionUrl(GRAPH_API_FUNCTION)
  if (!functionUrl) throw new Error('Supabase is not configured.')

  const body: Record<string, unknown> = { query, graph }
  if (perGroupLimit != null) body.perGroupLimit = perGroupLimit

  const response = await fetch(`${functionUrl}/v1/search/discover-lab`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({})) as AgentDiscoveryResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `Lab discovery returned ${response.status}.`)
  }
  return payload
}

export function shouldOfferDiscovery(query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 4) return false
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  return tokens.length >= 2
}

export function totalDiscoveryPeople(groups: DiscoveryGroup[]) {
  return groups.reduce((sum, group) => sum + group.people.length, 0)
}
