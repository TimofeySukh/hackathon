import type { User } from '@supabase/supabase-js'

import { supabase } from './supabase'
import type {
  BoardGraphPayload,
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
}

type UpdatePersonInput = {
  id: string
  name?: string
  tag_id?: string | null
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
  await ensureDefaultTags(user.id)

  const [tagsResult, peopleResult, notesResult, personAiNotesResult, connectionsResult] = await Promise.all([
    client
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
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
  if (peopleResult.error) throw peopleResult.error
  if (notesResult.error) throw notesResult.error
  if (personAiNotesResult.error) throw personAiNotesResult.error
  if (connectionsResult.error) throw connectionsResult.error

  return {
    board: workspace.board,
    tags: ((tagsResult.data ?? []) as Tag[]).map(hydrateTagColor),
    people: (peopleResult.data ?? []) as PersonNode[],
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
    })
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNode
}

export async function updatePerson(input: UpdatePersonInput): Promise<PersonNode> {
  const client = requireSupabase()
  const updates: Record<string, string | null> = {}

  if (input.name !== undefined) updates.name = input.name
  if (input.tag_id !== undefined) updates.tag_id = input.tag_id

  const { data, error } = await client
    .from('people')
    .update(updates)
    .eq('id', input.id)
    .select('*')
    .single()

  if (error) throw error

  return data as PersonNode
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

  if (error) throw error
}

export async function searchPeopleWithAi(query: string): Promise<AiPeopleSearchResult[]> {
  const client = requireSupabase()
  const { data, error } = await client.functions.invoke('search-people-ai', {
    body: {
      query,
    },
  })

  if (error) throw error

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
