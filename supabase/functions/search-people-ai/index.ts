import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'
import { searchPeopleWithFallback } from '../_shared/ai.ts'
import { createCorsHeaders } from '../_shared/cors.ts'
const MAX_CANDIDATES = 40
const MAX_NOTES_PER_PERSON = 5
const MAX_NOTE_TEXT_LENGTH = 360

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...createCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  })
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function sanitizeAiText(value: unknown) {
  if (typeof value !== 'string') return ''

  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/\bhttps?:\/\/\S+/gi, '[url removed]')
    .replace(/\blinkedin\.com\/\S+/gi, '[url removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOTE_TEXT_LENGTH)
}

function normalizeCandidateIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_CANDIDATES)
}

function sanitizeNote(note: Record<string, unknown>) {
  return {
    id: note.id,
    title: sanitizeAiText(note.title),
    body: sanitizeAiText(note.body),
    created_at: note.created_at,
    updated_at: note.updated_at,
  }
}

function sanitizeAiNote(note: Record<string, unknown> | null | undefined) {
  if (!note) return null

  const structuredSummary =
    note.structured_summary && typeof note.structured_summary === 'object' && !Array.isArray(note.structured_summary)
      ? note.structured_summary as Record<string, unknown>
      : {}

  return {
    person_id: note.person_id,
    status: note.status,
    summary: sanitizeAiText(note.summary),
    structured_summary: {
      summary: sanitizeAiText(structuredSummary.summary),
      traits: Array.isArray(structuredSummary.traits) ? structuredSummary.traits.map(sanitizeAiText).filter(Boolean) : [],
      interests: Array.isArray(structuredSummary.interests) ? structuredSummary.interests.map(sanitizeAiText).filter(Boolean) : [],
      relationship_context: Array.isArray(structuredSummary.relationship_context)
        ? structuredSummary.relationship_context.map(sanitizeAiText).filter(Boolean)
        : [],
      open_questions: Array.isArray(structuredSummary.open_questions)
        ? structuredSummary.open_questions.map(sanitizeAiText).filter(Boolean)
        : [],
    },
    updated_at: note.updated_at,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: createCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return jsonResponse(req, { error: 'Missing authorization header.' }, 401)
  }

  try {
    const body = (await req.json()) as { query?: unknown; candidate_ids?: unknown }
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const candidateIds = normalizeCandidateIds(body.candidate_ids)

    if (!query || candidateIds.length === 0) {
      return jsonResponse(req, { results: [] })
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY')
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return jsonResponse(req, { error: 'Invalid user session.' }, 401)
    }

    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, tag_id, x, y, is_root, created_at, updated_at')
      .eq('owner_user_id', user.id)
      .in('id', candidateIds)

    if (peopleError) {
      throw peopleError
    }

    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id)

    if (tagsError) {
      throw tagsError
    }

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, person_id, title, body, created_at, updated_at')
      .eq('owner_user_id', user.id)
      .in('person_id', candidateIds)
      .order('updated_at', { ascending: false })

    if (notesError) {
      throw notesError
    }

    const { data: aiNotes, error: aiNotesError } = await supabase
      .from('person_ai_notes')
      .select('person_id, status, summary, structured_summary, updated_at')
      .eq('owner_user_id', user.id)
      .in('person_id', candidateIds)

    if (aiNotesError) {
      throw aiNotesError
    }

    const tagsById = new Map((tags ?? []).map((tag) => [tag.id, tag.name]))
    const notesByPersonId = new Map<string, unknown[]>()
    const aiNotesByPersonId = new Map((aiNotes ?? []).map((note) => [note.person_id, note]))

    for (const note of notes ?? []) {
      const existingNotes = notesByPersonId.get(note.person_id) ?? []
      if (existingNotes.length < MAX_NOTES_PER_PERSON) {
        existingNotes.push(sanitizeNote(note as Record<string, unknown>))
      }
      notesByPersonId.set(note.person_id, existingNotes)
    }

    const peopleById = new Map((people ?? []).map((person) => [person.id, person]))
    const candidates = candidateIds.flatMap((personId) => {
      const person = peopleById.get(personId)
      if (!person) return []

      return [{
      id: person.id,
      name: sanitizeAiText(person.name),
      tag_name: person.tag_id ? sanitizeAiText(tagsById.get(person.tag_id) ?? null) || null : null,
      is_root: person.is_root,
      notes: notesByPersonId.get(person.id) ?? [],
      ai_note: sanitizeAiNote(aiNotesByPersonId.get(person.id) as Record<string, unknown> | null | undefined),
    }]
    })
    const allowedPersonIds = new Set(candidates.map((person) => person.id))

    const results = (await searchPeopleWithFallback({ query, candidates }))
      .filter((entry) => allowedPersonIds.has(entry.person_id))
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)

    return jsonResponse(req, { results })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unable to search people.' }, 500)
  }
})
