import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

type SearchResponse = {
  results?: unknown
}

type SearchResult = {
  person_id: string
  score: number
  reason: string
  matched_signals: string[]
}

const DEFAULT_N8N_PEOPLE_SEARCH_WEBHOOK_URL = 'https://velizard.app.n8n.cloud/webhook/person-search'
const MAX_CANDIDATES = 40

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

function getN8nPeopleSearchWebhookUrl() {
  return Deno.env.get('N8N_PEOPLE_SEARCH_WEBHOOK_URL') || DEFAULT_N8N_PEOPLE_SEARCH_WEBHOOK_URL
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeSearchResults(payload: SearchResponse, allowedPersonIds: Set<string>): SearchResult[] {
  if (!Array.isArray(payload.results)) return []

  return payload.results
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      person_id: typeof entry.person_id === 'string' ? entry.person_id : '',
      score: typeof entry.score === 'number' ? Math.max(0, Math.min(1, entry.score)) : 0,
      reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
      matched_signals: normalizeStringArray(entry.matched_signals).slice(0, 5),
    }))
    .filter((entry) => allowedPersonIds.has(entry.person_id))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401)
  }

  try {
    const body = (await req.json()) as { query?: unknown }
    const query = typeof body.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return jsonResponse({ results: [] })
    }

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY')
    const n8nWebhookUrl = getN8nPeopleSearchWebhookUrl()
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
      return jsonResponse({ error: 'Invalid user session.' }, 401)
    }

    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, tag_id, x, y, is_root, created_at, updated_at')
      .eq('owner_user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(MAX_CANDIDATES)

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
      .order('updated_at', { ascending: false })

    if (notesError) {
      throw notesError
    }

    const { data: aiNotes, error: aiNotesError } = await supabase
      .from('person_ai_notes')
      .select('person_id, status, summary, structured_summary, updated_at')
      .eq('owner_user_id', user.id)

    if (aiNotesError) {
      throw aiNotesError
    }

    const tagsById = new Map((tags ?? []).map((tag) => [tag.id, tag.name]))
    const notesByPersonId = new Map<string, unknown[]>()
    const aiNotesByPersonId = new Map((aiNotes ?? []).map((note) => [note.person_id, note]))

    for (const note of notes ?? []) {
      const existingNotes = notesByPersonId.get(note.person_id) ?? []
      if (existingNotes.length < 5) {
        existingNotes.push(note)
      }
      notesByPersonId.set(note.person_id, existingNotes)
    }

    const candidates = (people ?? []).map((person) => ({
      id: person.id,
      name: person.name,
      tag_name: person.tag_id ? tagsById.get(person.tag_id) ?? null : null,
      is_root: person.is_root,
      notes: notesByPersonId.get(person.id) ?? [],
      ai_note: aiNotesByPersonId.get(person.id) ?? null,
    }))
    const allowedPersonIds = new Set(candidates.map((person) => person.id))

    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        candidates,
      }),
    })

    if (!webhookResponse.ok) {
      const message = await webhookResponse.text()
      throw new Error(message || `n8n people search webhook failed with status ${webhookResponse.status}.`)
    }

    const payload = (await webhookResponse.json()) as SearchResponse
    const results = normalizeSearchResults(payload, allowedPersonIds)

    return jsonResponse({ results })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to search people.' }, 500)
  }
})
