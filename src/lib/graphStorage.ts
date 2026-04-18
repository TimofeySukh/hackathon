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

type UpsertPersonAiNoteStatusInput = {
  personId: string
  ownerUserId: string
  status: PersonAiNoteStatus
  errorMessage?: string | null
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

export async function loadBoardGraph(user: User): Promise<BoardGraphPayload> {
  const client = requireSupabase()
  const workspace = await ensureUserWorkspace(user)

  const [tagsResult, peopleResult, notesResult, personAiNotesResult, connectionsResult] = await Promise.all([
    client
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true }),
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
    tags: (tagsResult.data ?? []) as Tag[],
    people: (peopleResult.data ?? []) as PersonNode[],
    notes: (notesResult.data ?? []) as PersonNote[],
    personAiNotes: (personAiNotesResult.data ?? []).map((row) => mapPersonAiNote(row as Record<string, unknown>)),
    connections: (connectionsResult.data ?? []) as Connection[],
  }
}

export async function createTag(userId: string, name: string): Promise<Tag> {
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

  return data as Tag
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
