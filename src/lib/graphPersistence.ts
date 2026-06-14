import { supabase } from './supabase'
import type { GraphState } from '../App'

// The whole canvas graph lives in a single jsonb column keyed by user id.
// Reads and writes are one round-trip each — no per-node N+1, no rate-limiting.

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
  if (!supabase) return null

  const { data, error } = await supabase
    .from('user_graphs')
    .select('graph')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data || !isGraphState(data.graph)) return null

  return data.graph
}

/**
 * Persists the entire graph in one upsert. Safe to call after a bulk import of
 * thousands of nodes — it is still a single request.
 */
export async function saveGraph(userId: string, graph: GraphState): Promise<void> {
  if (!supabase) return

  const { error } = await supabase
    .from('user_graphs')
    .upsert({ user_id: userId, graph }, { onConflict: 'user_id' })

  if (error) throw error
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
