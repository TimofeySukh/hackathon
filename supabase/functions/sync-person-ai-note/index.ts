import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

type PersonAiStructuredSummary = {
  summary: string
  traits: string[]
  interests: string[]
  relationship_context: string[]
  open_questions: string[]
}

type N8nResponse = {
  summary?: unknown
  structured_summary?: unknown
}

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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeStructuredSummary(payload: N8nResponse): PersonAiStructuredSummary {
  const candidate =
    payload.structured_summary && typeof payload.structured_summary === 'object' && !Array.isArray(payload.structured_summary)
      ? (payload.structured_summary as Record<string, unknown>)
      : {}

  const summaryFromPayload = typeof payload.summary === 'string' ? payload.summary.trim() : ''
  const summaryFromObject = typeof candidate.summary === 'string' ? candidate.summary.trim() : ''
  const summary = summaryFromPayload || summaryFromObject

  return {
    summary,
    traits: normalizeStringArray(candidate.traits),
    interests: normalizeStringArray(candidate.interests),
    relationship_context: normalizeStringArray(candidate.relationship_context),
    open_questions: normalizeStringArray(candidate.open_questions),
  }
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
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header.' }, 401)
  }

  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY')
  const n8nWebhookUrl = getRequiredEnv('N8N_PERSON_AI_WEBHOOK_URL')

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
      return jsonResponse({ error: 'Invalid user session.' }, 401)
    }

    ownerUserId = user.id

    const body = (await req.json()) as { person_id?: unknown }

    if (typeof body.person_id !== 'string' || !body.person_id.trim()) {
      return jsonResponse({ error: 'person_id is required.' }, 400)
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
      return jsonResponse({ error: 'Person not found.' }, 404)
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

    const webhookResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        person: {
          id: person.id,
          name: person.name,
          tag_id: person.tag_id,
          tag_name: tagName,
        },
        notes: notes ?? [],
      }),
    })

    if (!webhookResponse.ok) {
      const message = await webhookResponse.text()
      throw new Error(message || `n8n webhook failed with status ${webhookResponse.status}.`)
    }

    const payload = (await webhookResponse.json()) as N8nResponse
    const structuredSummary = normalizeStructuredSummary(payload)

    await writePersonAiNoteState(supabase, {
      personId,
      ownerUserId: ownerUserId,
      status: 'created',
      summary: structuredSummary.summary,
      structuredSummary,
      errorMessage: null,
    })

    return jsonResponse({ ok: true })
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
          { error: error instanceof Error ? error.message : 'Unable to sync AI note.' },
          500,
        )
      }
    }

    return jsonResponse({ error: error instanceof Error ? error.message : 'Unable to sync AI note.' }, 500)
  }
})
