import { e2eFakeAccessToken, getSupabaseFunctionUrl, getSupabaseRestUrl, isE2EFakeAuth, supabase, supabasePublishableKey } from './supabase'
import type { GraphState } from './board/types'

// The whole canvas graph lives in a single jsonb column keyed by user id.
// Reads and writes are one round-trip each — no per-node N+1, no rate-limiting.

export type LoadedGraphSource = 'saved' | 'empty' | 'error'

export type LoadedGraphRecord = {
  graph: GraphState | null
  revision: number | null
  source: LoadedGraphSource
}

export class GraphRevisionConflictError extends Error {
  constructor() {
    super('Your board changed somewhere else. Reload before saving again.')
    this.name = 'GraphRevisionConflictError'
  }
}

export class GraphPersistenceError extends Error {
  constructor(action: string, cause: unknown) {
    super(`${action}: ${formatPersistenceError(cause)}`)
    this.name = 'GraphPersistenceError'
    this.cause = cause
  }
}

function serializeGraphPayload(payload: Record<string, unknown>) {
  try {
    return JSON.stringify(payload, (_, value) => (typeof value === 'bigint' ? value.toString() : value))
  } catch (error) {
    throw new GraphPersistenceError('Failed to save your board', error)
  }
}

function toPersistableGraph(graph: GraphState): GraphState {
  if (!isGraphState(graph)) {
    throw new GraphPersistenceError('Failed to save your board', 'Graph payload is invalid.')
  }

  const serialized = serializeGraphPayload({ graph })
  if (!serialized) {
    throw new GraphPersistenceError('Failed to save your board', 'Graph payload could not be serialized.')
  }

  try {
    const parsed = JSON.parse(serialized) as { graph?: unknown }
    if (!isGraphState(parsed.graph)) {
      throw new GraphPersistenceError('Failed to save your board', 'Graph payload is invalid after serialization.')
    }
    return parsed.graph
  } catch (error) {
    if (error instanceof GraphPersistenceError) throw error
    throw new GraphPersistenceError('Failed to save your board', error)
  }
}

function formatPersistenceError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return String(error)

  const details = error as Record<string, unknown>
  const parts = [
    typeof details.error === 'string' ? details.error : null,
    typeof details.message === 'string' ? details.message : null,
    typeof details.details === 'string' ? details.details : null,
    typeof details.hint === 'string' ? details.hint : null,
    typeof details.code === 'string' ? `code ${details.code}` : null,
  ].filter(Boolean)

  if (parts.length > 0) return parts.join(' ')

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

async function getAccessToken() {
  if (isE2EFakeAuth) return e2eFakeAccessToken
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new GraphPersistenceError('Failed to read your auth session', error)
  return data.session?.access_token ?? null
}

async function parseJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { message: text, code: String(response.status) }
  }
}

export async function saveGraphThroughApi(
  graphApiBaseUrl: string,
  accessToken: string,
  graph: GraphState,
  expectedRevision: number | null,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(`${graphApiBaseUrl.replace(/\/$/, '')}/v1/graph`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ graph, expectedRevision }),
  })

  const payload = await parseJsonResponse(response)
  if (!response.ok) {
    if (response.status === 409) {
      throw new GraphRevisionConflictError()
    }
    throw new GraphPersistenceError('Failed to save your board', payload ?? { message: response.statusText, code: String(response.status) })
  }

  return payload as { revision?: unknown } | null
}

export async function saveGraphThroughRest(
  restBasePath: string,
  publishableKey: string,
  accessToken: string,
  userId: string,
  graph: GraphState,
  expectedRevision: number | null,
  fetchImpl: typeof fetch = fetch,
) {
  const persistableGraph = toPersistableGraph(graph)
  const encodedUserId = encodeURIComponent(userId)
  const requestBody = expectedRevision === null
    ? serializeGraphPayload({ user_id: userId, graph: persistableGraph })
    : serializeGraphPayload({ graph: persistableGraph })

  if (!requestBody) {
    throw new GraphPersistenceError('Failed to save your board', 'Graph payload could not be serialized.')
  }

  if (expectedRevision === null) {
    const response = await fetchImpl(`${restBasePath.replace(/\/$/, '')}/user_graphs?select=revision`, {
      method: 'POST',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: requestBody,
    })

    const payload = await parseJsonResponse(response)
    if (!response.ok) {
      if (typeof payload === 'object' && payload && 'code' in payload && payload.code === '23505') {
        throw new GraphRevisionConflictError()
      }
      throw new GraphPersistenceError('Failed to save your board', payload ?? { message: response.statusText, code: String(response.status) })
    }

    return Array.isArray(payload) ? payload[0] as { revision?: unknown } | undefined : undefined
  }

  const response = await fetchImpl(
    `${restBasePath.replace(/\/$/, '')}/user_graphs?user_id=eq.${encodedUserId}&revision=eq.${encodeURIComponent(String(expectedRevision))}&select=revision`,
    {
      method: 'PATCH',
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: requestBody,
    },
  )

  const payload = await parseJsonResponse(response)
  if (!response.ok) {
    throw new GraphPersistenceError('Failed to save your board', payload ?? { message: response.statusText, code: String(response.status) })
  }

  const row = Array.isArray(payload) ? payload[0] as { revision?: unknown } | undefined : undefined
  if (!row) throw new GraphRevisionConflictError()
  return row
}

async function writeGraphThroughApi(graph: GraphState, expectedRevision: number | null) {
  const baseUrl = getSupabaseFunctionUrl('graph-api')
  const accessToken = await getAccessToken()
  if (!baseUrl || !accessToken) {
    throw new GraphPersistenceError('Failed to save your board', 'Supabase session is not available.')
  }

  return saveGraphThroughApi(baseUrl, accessToken, graph, expectedRevision)
}

function isGraphState(value: unknown): value is GraphState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.circles) &&
    Array.isArray(candidate.people) &&
    Array.isArray(candidate.connections)
  )
}

/**
 * Returns the user's saved graph, or null when they have no row yet (a fresh
 * account). The caller decides what an empty account should start from.
 */
export async function loadGraph(userId: string): Promise<GraphState | null> {
  const loaded = await loadGraphRecord(userId)
  return loaded.graph
}

export async function loadGraphRecord(userId: string): Promise<LoadedGraphRecord> {
  if (!supabase) return { graph: null, revision: null, source: 'empty' }

  const { data, error } = await supabase
    .from('user_graphs')
    .select('graph, revision')
    .eq('user_id', userId)
    .maybeSingle()

  if (!error && data && isGraphState(data.graph)) {
    return { graph: data.graph, revision: typeof data.revision === 'number' ? data.revision : 1, source: 'saved' }
  }

  if (error) throw error

  return { graph: null, revision: null, source: 'empty' }
}

/**
 * Persists the entire graph with optimistic concurrency. Safe to call after a
 * bulk import of thousands of nodes — it is still a single request. A stale
 * tab gets GraphRevisionConflictError instead of overwriting newer data.
 */
export async function saveGraph(userId: string, graph: GraphState, expectedRevision: number | null): Promise<number | null> {
  if (!supabase) return expectedRevision

  const persistableGraph = toPersistableGraph(graph)

  try {
    return await saveGraphDirectly(userId, persistableGraph, expectedRevision)
  } catch (directError) {
    if (directError instanceof GraphRevisionConflictError) throw directError

    try {
      const data = await writeGraphThroughApi(persistableGraph, expectedRevision)
      return typeof data?.revision === 'number' ? data.revision : expectedRevision === null ? 1 : expectedRevision + 1
    } catch (apiError) {
      if (
        directError instanceof GraphPersistenceError &&
        directError.message.includes('PGRST102') &&
        apiError instanceof GraphPersistenceError
      ) {
        throw apiError
      }
      throw directError
    }
  }
}

function isRevisionConflictError(error: { code?: string | null; message?: string | null }) {
  return error.code === 'P0001' || /revision conflict/i.test(error.message ?? '')
}

function isMissingSaveUserGraphRpc(error: { code?: string | null; message?: string | null }) {
  return error.code === 'PGRST202' || /save_user_graph/i.test(error.message ?? '')
}

async function saveGraphDirectlyViaRpc(graph: GraphState, expectedRevision: number | null): Promise<number | null> {
  if (!supabase) {
    throw new GraphPersistenceError('Failed to save your board', 'Supabase session is not available.')
  }

  const { data, error } = await supabase.rpc('save_user_graph', {
    p_graph: graph,
    p_expected_revision: expectedRevision,
  })

  if (error) {
    if (isRevisionConflictError(error)) throw new GraphRevisionConflictError()
    if (isMissingSaveUserGraphRpc(error)) return null
    throw new GraphPersistenceError('Failed to save your board', error)
  }

  return typeof data === 'number' ? data : expectedRevision === null ? 1 : expectedRevision + 1
}

async function saveGraphDirectlyViaTable(userId: string, graph: GraphState, expectedRevision: number | null): Promise<number | null> {
  if (!supabase) {
    throw new GraphPersistenceError('Failed to save your board', 'Supabase session is not available.')
  }

  const restUrl = getSupabaseRestUrl('')
  const accessToken = await getAccessToken()
  if (restUrl && supabasePublishableKey && accessToken) {
    try {
      const row = await saveGraphThroughRest(restUrl, supabasePublishableKey, accessToken, userId, graph, expectedRevision)
      return typeof row?.revision === 'number' ? row.revision : expectedRevision === null ? 1 : expectedRevision + 1
    } catch (error) {
      if (!(error instanceof GraphPersistenceError) || !String(error.message).includes('PGRST102')) {
        throw error
      }
    }
  }

  if (expectedRevision === null) {
    const { data, error } = await supabase
      .from('user_graphs')
      .insert({ user_id: userId, graph })
      .select('revision')
      .single()

    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: existingError } = await supabase
          .from('user_graphs')
          .select('revision')
          .eq('user_id', userId)
          .maybeSingle()
        if (existingError) throw new GraphPersistenceError('Failed to save your board', existingError)
        if (typeof existing?.revision !== 'number') throw new GraphRevisionConflictError()
        return saveGraphDirectlyViaTable(userId, graph, existing.revision)
      }
      throw new GraphPersistenceError('Failed to save your board', error)
    }

    return typeof data?.revision === 'number' ? data.revision : 1
  }

  const { data, error } = await supabase
    .from('user_graphs')
    .update({ graph })
    .eq('user_id', userId)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle()

  if (error) {
    throw new GraphPersistenceError('Failed to save your board', error)
  }
  if (!data) {
    throw new GraphRevisionConflictError()
  }

  return typeof data.revision === 'number' ? data.revision : expectedRevision + 1
}

async function saveGraphDirectly(userId: string, graph: GraphState, expectedRevision: number | null): Promise<number | null> {
  const rpcRevision = await saveGraphDirectlyViaRpc(graph, expectedRevision)
  if (rpcRevision !== null) return rpcRevision
  return saveGraphDirectlyViaTable(userId, graph, expectedRevision)
}

// ---- Local (signed-out) persistence ----------------------------------------
// Visitors who aren't signed in still get their work saved — just in this
// browser via localStorage instead of Supabase. Signing in switches over to the
// cloud-backed graph above.

const LOCAL_GRAPH_KEY = 'hackathon-board:local-graph'

/** Returns the locally saved graph, or null when nothing is stored yet. */
export function loadLocalGraph(): GraphState | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_GRAPH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isGraphState(parsed)) return null
    return parsed
  } catch (error) {
    console.error('Failed to load local graph', error)
    return null
  }
}

/** Persists the graph to localStorage for signed-out visitors. */
export function saveLocalGraph(graph: GraphState): void {
  try {
    window.localStorage.setItem(LOCAL_GRAPH_KEY, JSON.stringify(graph))
  } catch (error) {
    console.error('Failed to save local graph', error)
  }
}
