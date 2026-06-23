import { supabase } from './supabase'
import type { CircleTone, GraphState, PersonNote } from './board/types'
import { ensureContainment, makeCircle, packedCircleRadius, personPackOffset } from './board/layout'

// The whole canvas graph lives in a single jsonb column keyed by user id.
// Reads and writes are one round-trip each — no per-node N+1, no rate-limiting.

export type LoadedGraphSource = 'saved' | 'legacy' | 'empty'

export type LoadedGraphRecord = {
  graph: GraphState | null
  source: LoadedGraphSource
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
  if (!supabase) return { graph: null, source: 'empty' }

  const { data, error } = await supabase
    .from('user_graphs')
    .select('graph')
    .eq('user_id', userId)
    .maybeSingle()

  if (!error && data && isGraphState(data.graph)) {
    return { graph: data.graph, source: 'saved' }
  }

  if (error && !isMissingTableError(error)) throw error

  const legacyGraph = await loadLegacyGraph(userId)
  if (legacyGraph) return { graph: legacyGraph, source: 'legacy' }

  return { graph: null, source: 'empty' }
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

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('could not find the table') && message.includes('schema cache'))
  )
}

function isOptionalLegacyTableError(error: { code?: string; message?: string } | null) {
  return Boolean(error && isMissingTableError(error))
}

function toneForIndex(index: number): CircleTone {
  const tones: CircleTone[] = ['blue', 'green', 'amber', 'violet', 'red']
  return tones[index % tones.length]
}

function makeGroupCircle(index: number, group: { id: string; color?: string | null; member_ids?: string[] | null }) {
  const angle = (index / 10) * Math.PI * 2
  const distance = 520 + Math.floor(index / 10) * 360
  const memberCount = Array.isArray(group.member_ids) ? group.member_ids.length : 0
  return {
    ...makeCircle(
      group.id,
      `Group ${index + 1}`,
      `G${index + 1}`,
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
      packedCircleRadius(memberCount),
      null,
      null,
      toneForIndex(index),
    ),
    customColor: group.color ?? undefined,
  }
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
}

async function loadLegacyGraph(userId: string): Promise<GraphState | null> {
  if (!supabase) return null

  const boardResult = await supabase
    .from('boards')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (isOptionalLegacyTableError(boardResult.error)) return null
  if (boardResult.error) throw boardResult.error
  if (!boardResult.data?.id) return null

  const boardId = String(boardResult.data.id)

  const [peopleResult, notesResult, connectionsResult, groupsResult] = await Promise.all([
    supabase
      .from('people')
      .select('*')
      .eq('board_id', boardId)
      .order('is_root', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('notes')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('connections')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true }),
    supabase
      .from('node_groups')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true }),
  ])

  if (isOptionalLegacyTableError(peopleResult.error)) return null
  if (peopleResult.error) throw peopleResult.error
  if (notesResult.error && !isOptionalLegacyTableError(notesResult.error)) throw notesResult.error
  if (connectionsResult.error && !isOptionalLegacyTableError(connectionsResult.error)) throw connectionsResult.error
  if (groupsResult.error && !isOptionalLegacyTableError(groupsResult.error)) throw groupsResult.error

  const legacyPeople = (peopleResult.data ?? []) as Array<Record<string, unknown>>
  if (legacyPeople.length === 0) return null

  const groups = (groupsResult.data ?? []) as Array<{ id: string; color?: string | null; member_ids?: string[] | null }>
  const groupCircles = groups.map((group, index) => makeGroupCircle(index, group))
  const circles = [
    makeCircle('you', 'You', 'YOU', 0, 0, 104, null, null, 'blue'),
    ...groupCircles,
  ]
  const groupByMemberId = new Map<string, string>()
  for (const group of groups) {
    for (const memberId of group.member_ids ?? []) {
      groupByMemberId.set(memberId, group.id)
    }
  }

  const notesByPersonId = new Map<string, PersonNote[]>()
  for (const note of (notesResult.data ?? []) as Array<Record<string, unknown>>) {
    const personId = String(note.person_id)
    const existing = notesByPersonId.get(personId) ?? []
    existing.push({
      id: String(note.id),
      title: typeof note.title === 'string' && note.title.trim() ? note.title : 'Note',
      body: typeof note.body === 'string' ? note.body : '',
    })
    notesByPersonId.set(personId, existing)
  }

  let fallbackIndex = 0
  const people = legacyPeople
    .filter((person) => person.is_root !== true)
    .map((person) => {
      const id = String(person.id)
      const circleId = groupByMemberId.get(id) ?? 'you'
      const circle = circles.find((entry) => entry.id === circleId)
      const fallbackOffset = personPackOffset(fallbackIndex++)
      const x = typeof person.x === 'number' ? person.x : (circle?.x ?? 0) + fallbackOffset.x
      const y = typeof person.y === 'number' ? person.y : (circle?.y ?? 0) + fallbackOffset.y
      const name = typeof person.name === 'string' && person.name.trim() ? person.name : 'Unnamed'
      const notes = notesByPersonId.get(id)

      return {
        id,
        name,
        role: '',
        x,
        y,
        circleId,
        avatar: initialsFor(name),
        ...(notes?.length ? { notes } : {}),
      }
    })

  const personIds = new Set(people.map((person) => person.id))
  const connections = ((connectionsResult.data ?? []) as Array<Record<string, unknown>>)
    .filter((connection) => personIds.has(String(connection.person_a_id)) && personIds.has(String(connection.person_b_id)))
    .map((connection) => ({
      id: String(connection.id),
      fromId: String(connection.person_a_id),
      toId: String(connection.person_b_id),
    }))

  return ensureContainment({ circles, people, connections })
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
