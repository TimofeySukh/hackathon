import { FunctionsHttpError } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

import { supabase } from './supabase'
import type {
  BoardGraphPayload,
  Circle,
  Connection,
  PersonAiNote,
  PersonAiNoteStatus,
  PersonAiStructuredSummary,
  PersonNode,
  PersonNote,
  Tag,
} from './graphTypes'
import { DEFAULT_TAG_COLOR, DEFAULT_TAGS, getDefaultTagColor, normalizeTagColor } from './tagPalette'
import { ensureUserWorkspace } from './userWorkspace'

type CreatePersonInput = {
  boardId: string
  ownerUserId: string
  name: string
  tagId?: string | null
  x: number
  y: number
  circleId: string | null
  role: string
  avatar: string
  shapeType: string
  sides: number
  amplitude: number
  imageUrl?: string | null
}

type UpdatePersonInput = {
  id: string
  name?: string
  tag_id?: string | null
  circle_id?: string | null
  role?: string
  avatar?: string
  shape_type?: string
  sides?: number
  amplitude?: number
  image_url?: string | null
}

type CreateCircleInput = {
  boardId: string
  ownerUserId: string
  name: string
  icon: string
  x: number
  y: number
  radius: number
  minRadius: number
  parentId?: string | null
  connectedTo?: string | null
  tone: string
  shapeType: string
  sides: number
  amplitude: number
  imageUrl?: string | null
}

type UpdateCircleInput = {
  id: string
  name?: string
  icon?: string
  x?: number
  y?: number
  radius?: number
  min_radius?: number
  parent_id?: string | null
  connected_to?: string | null
  tone?: string
  shape_type?: string
  sides?: number
  amplitude?: number
  image_url?: string | null
}

type CreateConnectionInput = {
  boardId: string
  ownerUserId: string
  firstPersonId: string
  secondPersonId: string
}

type CreateNoteInput = {
  personId: string
  ownerUserId: string
  title: string
  body: string
}

type UpdateNoteInput = {
  id: string
  title?: string
  body?: string
}

type UpdateTagInput = {
  id: string
  name?: string
  color?: string
}

type UpsertPersonAiNoteStatusInput = {
  personId: string
  ownerUserId: string
  status: PersonAiNoteStatus
  errorMessage?: string | null
}

export type AiPeopleSearchResult = {
  person_id: string
  score: number
  reason: string
  matched_signals: string[]
}

const EMPTY_PERSON_AI_STRUCTURED_SUMMARY: PersonAiStructuredSummary = {
  summary: '',
  traits: [],
  interests: [],
  relationship_context: [],
  open_questions: [],
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

async function readFunctionError(error: unknown) {
  if (!(error instanceof FunctionsHttpError)) {
    return error instanceof Error ? error.message : 'Edge Function call failed.'
  }

  const response = error.context as Response | undefined
  if (!response) {
    return error.message
  }

  try {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { error?: unknown; message?: unknown }
      if (typeof payload.error === 'string') return payload.error
      if (payload.error && typeof payload.error === 'object' && 'message' in payload.error) {
        const message = (payload.error as { message?: unknown }).message
        if (typeof message === 'string') return message
      }
      if (typeof payload.message === 'string') return payload.message
      return JSON.stringify(payload)
    }

    const text = await response.text()
    return text || error.message
  } catch {
    return error.message
  }
}

function canonicalizeConnection(firstPersonId: string, secondPersonId: string) {
  return firstPersonId < secondPersonId
    ? { personAId: firstPersonId, personBId: secondPersonId }
    : { personAId: secondPersonId, personBId: firstPersonId }
}

export function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizePersonAiStructuredSummary(value: unknown): PersonAiStructuredSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_PERSON_AI_STRUCTURED_SUMMARY
  }

  const candidate = value as Record<string, unknown>

  return {
    summary: typeof candidate.summary === 'string' ? candidate.summary : '',
    traits: normalizeStringArray(candidate.traits),
    interests: normalizeStringArray(candidate.interests),
    relationship_context: normalizeStringArray(candidate.relationship_context),
    open_questions: normalizeStringArray(candidate.open_questions),
  }
}

function mapPersonAiNote(row: Record<string, unknown>): PersonAiNote {
  return {
    id: String(row.id),
    person_id: String(row.person_id),
    owner_user_id: String(row.owner_user_id),
    status: row.status as PersonAiNoteStatus,
    summary: typeof row.summary === 'string' ? row.summary : null,
    structured_summary: normalizePersonAiStructuredSummary(row.structured_summary),
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

async function ensureDefaultTags(userId: string) {
  const client = requireSupabase()
  const existingTags = await client
    .from('tags')
    .select('normalized_name')
    .eq('user_id', userId)

  if (existingTags.error) throw existingTags.error

  const existingNames = new Set((existingTags.data ?? []).map((tag) => tag.normalized_name))
  const missingTags = DEFAULT_TAGS.filter(
    (tag) => !existingNames.has(normalizeTagName(tag.name).toLowerCase()),
  )

  if (missingTags.length === 0) return

  const insertedTags = await client.from('tags').insert(
    missingTags.map((tag) => ({
      user_id: userId,
      name: tag.name,
      color: tag.color,
    })),
  )

  if (insertedTags.error) throw insertedTags.error
}

function hydrateTagColor(tag: Tag): Tag {
  return {
    ...tag,
    color: normalizeTagColor(tag.color ?? getDefaultTagColor(tag.name)),
  }
}

function isMissingColorColumnError(error: { message?: string; code?: string } | null) {
  return (
    error?.code === 'PGRST204' ||
    error?.message?.toLowerCase().includes("'color' column") ||
    error?.message?.toLowerCase().includes('column "color"')
  )
}

export async function loadBoardGraph(user: User): Promise<BoardGraphPayload> {
  const client = requireSupabase()
  const workspace = await ensureUserWorkspace(user)
  if (workspace.isNewRootPerson) {
    await ensureDefaultTags(user.id)
  }

  const [tagsResult, circlesResult, peopleResult, notesResult, personAiNotesResult, connectionsResult] = await Promise.all([
    client
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    client
      .from('circles')
      .select('*')
      .eq('board_id', workspace.board.id)
      .order('is_root', { ascending: false })
      .order('created_at', { ascending: true }),
    client
      .from('people')
      .select('*')
      .eq('board_id', workspace.board.id)
      .order('is_root', { ascending: false })
      .order('created_at', { ascending: true }),
    client
      .from('notes')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true }),
    client
      .from('person_ai_notes')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true }),
    client
      .from('connections')
      .select('*')
      .eq('board_id', workspace.board.id)
      .order('created_at', { ascending: true }),
  ])

  if (tagsResult.error) throw tagsResult.error
  if (circlesResult.error) throw circlesResult.error
  if (peopleResult.error) throw peopleResult.error
  if (notesResult.error) throw notesResult.error
  if (personAiNotesResult.error) throw personAiNotesResult.error
  if (connectionsResult.error) throw connectionsResult.error

  const circles = (circlesResult.data ?? []) as Circle[]
  let people = (peopleResult.data ?? []) as PersonNode[]

  // Reconcile/bootstrap root circle and map loose people to it
  let rootCircle = circles.find(c => c.is_root)
  if (!rootCircle) {
    const { data: newRootCircle, error: rootCircleError } = await client
      .from('circles')
      .insert({
        board_id: workspace.board.id,
        owner_user_id: user.id,
        name: 'You',
        icon: 'YOU',
        x: 0,
        y: 0,
        radius: 126,
        min_radius: 126,
        tone: 'blue',
        shape_type: 'wavy',
        sides: 12,
        amplitude: 7,
        is_root: true,
      })
      .select('*')
      .single()

    if (rootCircleError) {
      if (rootCircleError.code === '23505') {
        const { data: existingRootCircle, error: fetchError } = await client
          .from('circles')
          .select('*')
          .eq('board_id', workspace.board.id)
          .eq('is_root', true)
          .single()

        if (fetchError) throw fetchError
        rootCircle = existingRootCircle as Circle
        circles.push(rootCircle)
      } else {
        throw rootCircleError
      }
    } else {
      rootCircle = newRootCircle as Circle
      circles.push(rootCircle)
    }

    // Re-parent the root person if not already set
    const rootPerson = people.find(p => p.is_root)
    if (rootPerson && !rootPerson.circle_id) {
      const { data: updatedRootPerson, error: rootPersonError } = await client
        .from('people')
        .update({ circle_id: rootCircle.id })
        .eq('id', rootPerson.id)
        .select('*')
        .single()

      if (rootPersonError) throw rootPersonError
      people = people.map(p => p.id === rootPerson.id ? (updatedRootPerson as PersonNode) : p)
    }
  }

  // Map any loose legacy people to the root circle
  const legacyPeopleToUpdate = people.filter(p => !p.circle_id)
  if (legacyPeopleToUpdate.length > 0 && rootCircle) {
    const { error: updateError } = await client
      .from('people')
      .update({ circle_id: rootCircle.id })
      .in('id', legacyPeopleToUpdate.map(p => p.id))

    if (updateError) throw updateError
    people = people.map(p => p.circle_id ? p : { ...p, circle_id: rootCircle!.id })
  }

  return {
    board: workspace.board,
    tags: ((tagsResult.data ?? []) as Tag[]).map(hydrateTagColor),
    circles,
    people,
    notes: (notesResult.data ?? []) as PersonNote[],
    personAiNotes: (personAiNotesResult.data ?? []).map((row) => mapPersonAiNote(row as Record<string, unknown>)),
    connections: (connectionsResult.data ?? []) as Connection[],
  }
}

export async function createTag(userId: string, name: string, color = DEFAULT_TAG_COLOR): Promise<Tag> {
  const client = requireSupabase()
  const normalizedName = normalizeTagName(name)

  const { data, error } = await client
    .from('tags')
    .insert({
      user_id: userId,
      name: normalizedName,
      color: normalizeTagColor(color),
    })
    .select('*')
    .single()

  if (error) throw error

  return hydrateTagColor({
    ...(data as Tag),
    color: normalizeTagColor(color),
  })
}

export async function updateTag(input: UpdateTagInput): Promise<Tag> {
  const client = requireSupabase()
  const updates: Record<string, string> = {}

  if (input.name !== undefined) updates.name = normalizeTagName(input.name)
  if (input.color !== undefined) updates.color = normalizeTagColor(input.color)

  const { data, error } = await client
    .from('tags')
    .update(updates)
    .eq('id', input.id)
    .select('*')
    .single()

  if (isMissingColorColumnError(error)) {
    const fallback = await client.from('tags').select('*').eq('id', input.id).single()

    if (fallback.error) throw fallback.error

    return hydrateTagColor({
      ...(fallback.data as Tag),
      color: normalizeTagColor(input.color ?? DEFAULT_TAG_COLOR),
    })
  }

  if (error) throw error

  return hydrateTagColor(data as Tag)
}

export async function deleteTag(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('tags').delete().eq('id', id)

  if (error) throw error
}

export async function createPerson(input: CreatePersonInput): Promise<PersonNode> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('people')
    .insert({
      board_id: input.boardId,
      owner_user_id: input.ownerUserId,
      name: input.name,
      tag_id: input.tagId ?? null,
      x: input.x,
      y: input.y,
      circle_id: input.circleId,
      role: input.role,
      avatar: input.avatar,
      shape_type: input.shapeType,
      sides: input.sides,
      amplitude: input.amplitude,
      image_url: input.imageUrl ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNode
}

export async function updatePerson(input: UpdatePersonInput): Promise<PersonNode> {
  const client = requireSupabase()
  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) updates.name = input.name
  if (input.tag_id !== undefined) updates.tag_id = input.tag_id
  if (input.circle_id !== undefined) updates.circle_id = input.circle_id
  if (input.role !== undefined) updates.role = input.role
  if (input.avatar !== undefined) updates.avatar = input.avatar
  if (input.shape_type !== undefined) updates.shape_type = input.shape_type
  if (input.sides !== undefined) updates.sides = input.sides
  if (input.amplitude !== undefined) updates.amplitude = input.amplitude
  if (input.image_url !== undefined) updates.image_url = input.image_url

  const { data, error } = await client
    .from('people')
    .update(updates)
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNode
}

export async function createCircle(input: CreateCircleInput): Promise<Circle> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('circles')
    .insert({
      board_id: input.boardId,
      owner_user_id: input.ownerUserId,
      name: input.name,
      icon: input.icon,
      x: input.x,
      y: input.y,
      radius: input.radius,
      min_radius: input.minRadius,
      parent_id: input.parentId ?? null,
      connected_to: input.connectedTo ?? null,
      tone: input.tone,
      shape_type: input.shapeType,
      sides: input.sides,
      amplitude: input.amplitude,
      image_url: input.imageUrl ?? null,
    })
    .select('*')
    .single()

  if (error) throw error

  return data as Circle
}

export async function updateCircle(input: UpdateCircleInput): Promise<Circle> {
  const client = requireSupabase()
  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) updates.name = input.name
  if (input.icon !== undefined) updates.icon = input.icon
  if (input.x !== undefined) updates.x = input.x
  if (input.y !== undefined) updates.y = input.y
  if (input.radius !== undefined) updates.radius = input.radius
  if (input.min_radius !== undefined) updates.min_radius = input.min_radius
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id
  if (input.connected_to !== undefined) updates.connected_to = input.connected_to
  if (input.tone !== undefined) updates.tone = input.tone
  if (input.shape_type !== undefined) updates.shape_type = input.shape_type
  if (input.sides !== undefined) updates.sides = input.sides
  if (input.amplitude !== undefined) updates.amplitude = input.amplitude
  if (input.image_url !== undefined) updates.image_url = input.image_url

  const { data, error } = await client
    .from('circles')
    .update(updates)
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw error

  return data as Circle
}

export async function moveCircle(id: string, x: number, y: number): Promise<Circle> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('circles')
    .update({ x, y })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return data as Circle
}

export async function deleteCircle(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('circles').delete().eq('id', id)

  if (error) throw error
}

export async function movePerson(id: string, x: number, y: number): Promise<PersonNode> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('people')
    .update({ x, y })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNode
}

export async function deletePerson(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('people').delete().eq('id', id)

  if (error) throw error
}

export async function createConnection(input: CreateConnectionInput): Promise<Connection> {
  const client = requireSupabase()
  const { personAId, personBId } = canonicalizeConnection(input.firstPersonId, input.secondPersonId)

  const { data, error } = await client
    .from('connections')
    .insert({
      board_id: input.boardId,
      owner_user_id: input.ownerUserId,
      person_a_id: personAId,
      person_b_id: personBId,
    })
    .select('*')
    .single()

  if (error?.code === '23505') {
    const existing = await client
      .from('connections')
      .select('*')
      .eq('board_id', input.boardId)
      .eq('person_a_id', personAId)
      .eq('person_b_id', personBId)
      .single()

    if (existing.error) throw existing.error

    return existing.data as Connection
  }

  if (error) throw error

  return data as Connection
}

export async function deleteConnection(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('connections').delete().eq('id', id)

  if (error) throw error
}

export async function createNote(input: CreateNoteInput): Promise<PersonNote> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('notes')
    .insert({
      person_id: input.personId,
      owner_user_id: input.ownerUserId,
      title: input.title,
      body: input.body,
    })
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNote
}

export async function updateNote(input: UpdateNoteInput): Promise<PersonNote> {
  const client = requireSupabase()
  const updates: Record<string, string> = {}

  if (input.title !== undefined) updates.title = input.title
  if (input.body !== undefined) updates.body = input.body

  const { data, error } = await client
    .from('notes')
    .update(updates)
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNote
}

export async function deleteNote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('notes').delete().eq('id', id)

  if (error) throw error
}

export async function getPersonAiNote(personId: string) {
  const client = requireSupabase()
  const { data, error } = await client.from('person_ai_notes').select('*').eq('person_id', personId).maybeSingle()

  if (error) throw error
  if (!data) return null

  return mapPersonAiNote(data as Record<string, unknown>)
}

export async function upsertPersonAiNoteStatus(input: UpsertPersonAiNoteStatusInput) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('person_ai_notes')
    .upsert(
      {
        person_id: input.personId,
        owner_user_id: input.ownerUserId,
        status: input.status,
        error_message: input.errorMessage ?? null,
      },
      {
        onConflict: 'person_id',
      },
    )
    .select('*')
    .single()

  if (error) throw error

  return mapPersonAiNote(data as Record<string, unknown>)
}

export async function invokePersonAiNoteSync(personId: string) {
  const client = requireSupabase()
  const { error } = await client.functions.invoke('sync-person-ai-note', {
    body: {
      person_id: personId,
    },
  })

  if (error) {
    throw new Error(await readFunctionError(error))
  }
}

export async function searchPeopleWithAi(query: string): Promise<AiPeopleSearchResult[]> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('search-people-ai', {
    body: {
      query,
    },
  })

  if (error) {
    throw new Error(await readFunctionError(error))
  }

  const results = data && typeof data === 'object' && 'results' in data ? (data as { results?: unknown }).results : []
  if (!Array.isArray(results)) return []

  return results
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      person_id: typeof entry.person_id === 'string' ? entry.person_id : '',
      score: typeof entry.score === 'number' ? entry.score : 0,
      reason: typeof entry.reason === 'string' ? entry.reason : '',
      matched_signals: normalizeStringArray(entry.matched_signals),
    }))
    .filter((entry) => entry.person_id)
}
