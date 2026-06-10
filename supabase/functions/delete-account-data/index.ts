import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'
import { createCorsHeaders } from '../_shared/cors.ts'

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

    const userId = user.id
    const [legacyConnectionsResult, nodeGroupsResult, notesResult, personAiNotesResult] = await Promise.all([
      supabase.from('connections').delete().eq('owner_user_id', userId),
      supabase.from('node_groups').delete().eq('owner_user_id', userId),
      supabase.from('notes').delete().eq('owner_user_id', userId),
      supabase.from('person_ai_notes').delete().eq('owner_user_id', userId),
    ])

    if (legacyConnectionsResult.error) throw legacyConnectionsResult.error
    if (nodeGroupsResult.error) throw nodeGroupsResult.error
    if (notesResult.error) throw notesResult.error
    if (personAiNotesResult.error) throw personAiNotesResult.error

    const peopleResult = await supabase
      .from('people')
      .delete()
      .eq('owner_user_id', userId)
      .eq('is_root', false)

    if (peopleResult.error) throw peopleResult.error

    const tagsResult = await supabase.from('tags').delete().eq('user_id', userId)

    if (tagsResult.error) throw tagsResult.error

    const profileResult = await supabase
      .from('profiles')
      .update({
        email: null,
        display_name: null,
        avatar_url: null,
      })
      .eq('id', userId)

    if (profileResult.error) throw profileResult.error

    const rootResult = await supabase
      .from('people')
      .update({
        name: 'You',
        tag_id: null,
      })
      .eq('owner_user_id', userId)
      .eq('is_root', true)

    if (rootResult.error) throw rootResult.error

    return jsonResponse(req, { ok: true })
  } catch (error) {
    return jsonResponse(req, { error: error instanceof Error ? error.message : 'Unable to delete account data.' }, 500)
  }
})
