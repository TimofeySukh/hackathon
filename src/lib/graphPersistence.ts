import { e2eFakeAccessToken, getSupabaseFunctionUrl, isE2EFakeAuth, supabase } from './supabase'
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
  revision: number | null

  constructor(revision: number | null = null) {
    super('Your board changed somewhere else. Reload before saving again.')
    this.name = 'GraphRevisionConflictError'
    this.revision = revision
  }
}

export class GraphPersistenceError extends Error {
  constructor(action: string, cause: unknown) {
    super(`${action}: ${formatPersistenceError(cause)}`)
    this.name = 'GraphPersistenceError'
    this.cause = cause
  }
}

function formatPersistenceError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return String(error)

  const details = error as Record<string, unknown>
  const parts = [
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

async function writeGraphThroughApi(graph: GraphState, expectedRevision: number | null) {
  const baseUrl = getSupabaseFunctionUrl('graph-api')
  const accessToken = await getAccessToken()
  if (!baseUrl || !accessToken) {
    throw new GraphPersistenceError('Failed to save your board', 'Supabase session is not available.')
  }

  const response = await fetch(`${baseUrl}/v1/graph`, {
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
      const revision = typeof (payload as { revision?: unknown } | null)?.revision === 'number'
        ? (payload as { revision: number }).revision
        : null
      throw new GraphRevisionConflictError(revision)
    }
    throw new GraphPersistenceError('Failed to save your board', payload ?? { message: response.statusText, code: String(response.status) })
  }

  return payload as { revision?: unknown } | null
}

function readRevisionFromRows(rows: unknown): number | null {
  if (!Array.isArray(rows)) return null
  const revision = (rows[0] as { revision?: unknown } | undefined)?.revision
  return typeof revision === 'number' ? revision : null
}

async function readGraphRevisionDirect(userId: string): Promise<number | null> {
  if (!supabase) {
    throw new GraphPersistenceError('Failed to load your board revision', 'Supabase session is not available.')
  }

  const { data, error } = await supabase
    .from('user_graphs')
    .select('revision')
    .eq('user_id', userId)
    .limit(1)

  if (error) {
    throw new GraphPersistenceError('Failed to load your board revision', error)
  }

  return readRevisionFromRows(data)
}

async function writeGraphDirect(userId: string, graph: GraphState, expectedRevision: number | null) {
  if (!supabase) {
    throw new GraphPersistenceError('Failed to save your board', 'Supabase session is not available.')
  }

  if (expectedRevision === null) {
    const { data, error } = await supabase
      .from('user_graphs')
      .insert({ user_id: userId, graph })
      .select('revision')

    if (error) {
      if (error.code === '23505') {
        throw new GraphRevisionConflictError(await readGraphRevisionDirect(userId))
      }
      throw new GraphPersistenceError('Failed to save your board', error)
    }

    return { revision: readRevisionFromRows(data) ?? 1 }
  }

  const { data, error } = await supabase
    .from('user_graphs')
    .update({ graph })
    .eq('user_id', userId)
    .eq('revision', expectedRevision)
    .select('revision')

  if (error) {
    throw new GraphPersistenceError('Failed to save your board', error)
  }

  const revision = readRevisionFromRows(data)
  if (revision === null) {
    throw new GraphRevisionConflictError(await readGraphRevisionDirect(userId))
  }

  return { revision }
}

async function writeGraphWithFallback(userId: string, graph: GraphState, expectedRevision: number | null) {
  try {
    return await writeGraphThroughApi(graph, expectedRevision)
  } catch (apiError) {
    if (apiError instanceof GraphRevisionConflictError) throw apiError
    if (!supabase) throw apiError

    console.warn('Failed to save graph through graph API, falling back to direct Supabase write.', apiError)
    try {
      return await writeGraphDirect(userId, graph, expectedRevision)
    } catch (directError) {
      if (directError instanceof GraphRevisionConflictError) throw directError
      throw new GraphPersistenceError('Failed to save your board', {
        graphApi: formatPersistenceError(apiError),
        directSupabase: formatPersistenceError(directError),
      })
    }
  }
}

async function readGraphMetaThroughApi() {
  const baseUrl = getSupabaseFunctionUrl('graph-api')
  const accessToken = await getAccessToken()
  if (!baseUrl || !accessToken) {
    throw new GraphPersistenceError('Failed to load your board revision', 'Supabase session is not available.')
  }

  const response = await fetch(`${baseUrl}/v1/graph/meta`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw new GraphPersistenceError('Failed to load your board revision', payload ?? { message: response.statusText, code: String(response.status) })
  }

  return payload as { revision?: unknown } | null
}

async function readLatestGraphRevision(userId: string, knownRevision: number | null): Promise<number | null> {
  if (knownRevision !== null) return knownRevision

  try {
    const meta = await readGraphMetaThroughApi()
    const revision = typeof meta?.revision === 'number' ? meta.revision : null
    if (revision !== null) return revision
  } catch (apiError) {
    if (!supabase) throw apiError
    console.warn('Failed to load graph revision through graph API, falling back to direct Supabase read.', apiError)
  }

  return await readGraphRevisionDirect(userId)
}

async function readGraphThroughApi(): Promise<LoadedGraphRecord> {
  const baseUrl = getSupabaseFunctionUrl('graph-api')
  const accessToken = await getAccessToken()
  if (!baseUrl || !accessToken) {
    throw new GraphPersistenceError('Failed to load your board', 'Supabase session is not available.')
  }

  const response = await fetch(`${baseUrl}/v1/graph`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  const payload = await parseJsonResponse(response)

  if (!response.ok) {
    throw new GraphPersistenceError('Failed to load your board', payload ?? { message: response.statusText, code: String(response.status) })
  }

  const data = payload as { graph?: unknown; revision?: unknown } | null
  const graph = isGraphState(data?.graph) ? data.graph : null
  return {
    graph,
    revision: typeof data?.revision === 'number' ? data.revision : null,
    source: graph ? 'saved' : 'empty',
  }
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

  try {
    return await readGraphThroughApi()
  } catch (apiError) {
    if (isE2EFakeAuth) throw apiError
    console.warn('Failed to load graph through graph API, falling back to direct Supabase read.', apiError)
  }

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
  let data: { revision?: unknown } | null
  let savedFromRevision = expectedRevision
  try {
    data = await writeGraphWithFallback(userId, graph, expectedRevision)
  } catch (error) {
    if (!(error instanceof GraphRevisionConflictError) || expectedRevision !== null) throw error
    const latestRevision = await readLatestGraphRevision(userId, error.revision)
    if (latestRevision === null) throw error
    savedFromRevision = latestRevision
    data = await writeGraphWithFallback(userId, graph, latestRevision)
  }
  return typeof data?.revision === 'number' ? data.revision : savedFromRevision === null ? 1 : savedFromRevision + 1
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
