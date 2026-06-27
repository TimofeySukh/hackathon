import type { Session } from '@supabase/supabase-js'

import type { GraphSearchResult } from './search/graphSearch'
import { getSupabaseFunctionUrl } from './supabase'

const GRAPH_API_FUNCTION = 'graph-api'

export type AgentSearchStep = {
  id: string
  label: string
  detail?: string
}

export type SmartSearchResponse = {
  query: string
  mode: 'agent'
  explanation: string
  steps: AgentSearchStep[]
  suggestions: string[]
  results: Array<{
    type: 'person' | 'circle'
    id: string
    name: string
    subtitle?: string
    aiReason?: string
    circleId?: string
    circlePath?: Array<{ id: string; name: string }>
    parentId?: string | null
    path?: Array<{ id: string; name: string }>
    score?: number
  }>
}

export async function smartSearchGraph(session: Session, query: string, limit = 8): Promise<SmartSearchResponse> {
  const functionUrl = getSupabaseFunctionUrl(GRAPH_API_FUNCTION)
  if (!functionUrl) throw new Error('Supabase is not configured.')

  const response = await fetch(`${functionUrl}/v1/search/smart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit }),
  })

  const payload = await response.json().catch(() => ({})) as SmartSearchResponse & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `Smart search returned ${response.status}.`)
  }
  return payload
}

export function mapSmartSearchResults(results: SmartSearchResponse['results']): GraphSearchResult[] {
  return results.map((result) => {
    if (result.type === 'person') {
      return {
        type: 'person',
        id: result.id,
        name: result.name,
        circleId: result.circleId ?? '',
        circlePath: result.circlePath ?? [],
        score: result.score ?? 0,
        subtitle: result.subtitle ?? '',
        aiReason: result.aiReason,
      }
    }
    return {
      type: 'circle',
      id: result.id,
      name: result.name,
      parentId: result.parentId ?? null,
      path: result.path ?? [],
      score: result.score ?? 0,
      subtitle: result.subtitle ?? 'Circle',
      aiReason: result.aiReason,
    }
  })
}

export function shouldUseSmartSearch(query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 3) return false
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  return tokens.length >= 2
}

export function isSimpleNameLookup(query: string) {
  const trimmed = query.trim()
  if (!trimmed) return true
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  return tokens.length === 1 && trimmed.length <= 24
}
