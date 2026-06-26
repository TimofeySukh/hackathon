import type { Session } from '@supabase/supabase-js'

import { getSupabaseFunctionUrl } from './supabase'

export type AgentScope =
  | 'graph:read'
  | 'search:read'
  | 'people:write'
  | 'notes:write'
  | 'links:write'
  | 'connections:write'
  | 'circles:write'
  | 'graph:replace'

export type AgentTokenRecord = {
  id: string
  name: string
  token_prefix: string
  scopes: AgentScope[]
  expires_at: string | null
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
}

const GRAPH_API_FUNCTION = 'graph-api'

export function getGraphApiBaseUrl() {
  const functionUrl = getSupabaseFunctionUrl(GRAPH_API_FUNCTION)
  return functionUrl ? `${functionUrl}/v1` : null
}

async function graphApiFetch<T>(session: Session, path: string, init: RequestInit = {}): Promise<T> {
  const functionUrl = getSupabaseFunctionUrl(GRAPH_API_FUNCTION)
  if (!functionUrl) throw new Error('Supabase is not configured.')

  const response = await fetch(`${functionUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `Graph API returned ${response.status}.`)
  }
  return payload as T
}

export async function listAgentTokens(session: Session) {
  const payload = await graphApiFetch<{ tokens: AgentTokenRecord[] }>(session, '/v1/agent-tokens')
  return payload.tokens
}

export async function createAgentToken(session: Session, name: string, scopes: AgentScope[]) {
  return await graphApiFetch<{ token: string; record: AgentTokenRecord }>(session, '/v1/agent-tokens', {
    method: 'POST',
    body: JSON.stringify({ name, scopes }),
  })
}

export async function revokeAgentToken(session: Session, tokenId: string) {
  await graphApiFetch<{ ok: true }>(session, `/v1/agent-tokens/${tokenId}/revoke`, { method: 'POST' })
}
