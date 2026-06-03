import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'
import { generatePersonSummaryWithFallback, type PersonAiStructuredSummary } from '../_shared/ai.ts'
import { createCorsHeaders } from '../_shared/cors.ts'

const MAX_NOTE_TEXT_LENGTH = 1200

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...createCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  })
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

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

async function writePersonAiNoteState(
  client: ReturnType<typeof createClient>,
  input: {
    personId: string
    ownerUserId: string
    status: 'pending' | 'created' | 'error'
    summary?: string | null
    structuredSummary?: PersonAiStructuredSummary
    errorMessage?: string | null
  },
) {
  const payload: Record<string, unknown> = {
    person_id: input.personId,
    owner_user_id: input.ownerUserId,
    status: input.status,
    error_message: input.errorMessage ?? null,
  }

  if (input.summary !== undefined) {
    payload.summary = input.summary
  }

  if (input.structuredSummary !== undefined) {
    payload.structured_summary = input.structuredSummary
  }

  const { error } = await client.from('person_ai_notes').upsert(
    payload,
    {
      onConflict: 'person_id',
    },
  )

  if (error) {
    throw error
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

  let personId = ''
  let ownerUserId = ''

  try {
    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return jsonResponse(req, { error: 'Invalid user session.' }, 401)
    }

    ownerUserId = user.id

    const body = (await req.json()) as { person_id?: unknown }

    if (typeof body.person_id !== 'string' || !body.person_id.trim()) {
      return jsonResponse(req, { error: 'person_id is required.' }, 400)
    }

    personId = body.person_id

    const { data: person, error: personError } = await supabase
      .from('people')
      .select('id, name, tag_id, owner_user_id')
      .eq('id', personId)
      .maybeSingle()

    if (personError) {
      throw personError
    }

    if (!person || person.owner_user_id !== user.id) {
      return jsonResponse(req, { error: 'Person not found.' }, 404)
    }

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, title, body, created_at, updated_at')
      .eq('person_id', personId)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true })

    if (notesError) {
      throw notesError
    }

    let tagName: string | null = null

    if (person.tag_id) {
      const { data: tag, error: tagError } = await supabase
        .from('tags')
        .select('name')
        .eq('id', person.tag_id)
        .maybeSingle()

      if (tagError) {
        throw tagError
      }

      tagName = tag?.name ?? null
    }

    const structuredSummary = await generatePersonSummaryWithFallback({
      person: {
        id: person.id,
        name: sanitizeAiText(person.name),
        tag_id: person.tag_id,
        tag_name: tagName ? sanitizeAiText(tagName) : null,
      },
      notes: (notes ?? []).map((note) => ({
        ...note,
        title: sanitizeAiText(note.title),
        body: sanitizeAiText(note.body),
      })),
    })

    await writePersonAiNoteState(supabase, {
      personId,
      ownerUserId: ownerUserId,
      status: 'created',
      summary: structuredSummary.summary,
      structuredSummary,
      errorMessage: null,
    })

    return jsonResponse(req, { ok: true })
  } catch (error) {
    if (personId && ownerUserId) {
      try {
        await writePersonAiNoteState(supabase, {
          personId,
          ownerUserId,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unable to sync AI note.',
        })
      } catch {
        return jsonResponse(
          req,
          { error: error instanceof Error ? error.message : 'Unable to sync AI note.' },
          500,
        )
      }
    }

    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unable to sync AI note.' }, 500)
  }
})
