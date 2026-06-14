import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

const LINKEDIN_PROFILE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type EnrichedProfile = {
  url: string
  name?: string
  company?: string
  headline?: string
  description?: string
  avatarUrl?: string
  source: 'brightdata'
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

function normalizeLinkedInProfileUrl(rawValue: string): string | null {
  const value = rawValue.trim()
  if (!value) return null
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withProtocol)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'linkedin.com') return null
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (!['in', 'pub'].includes(pathParts[0] ?? '') || !pathParts[1]) return null
    return `https://www.linkedin.com/${pathParts[0]}/${pathParts[1]}/`
  } catch {
    return null
  }
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function pickNestedString(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return pickString((value as Record<string, unknown>)[key])
}

function pickCompanyName(record: Record<string, unknown>) {
  return pickString(
    pickNestedString(record.current_company, 'name'),
    pickNestedString(record.company, 'name'),
    record.current_company_name,
    record.company_name,
    record.organization,
  )
}

function pickAvatarUrl(record: Record<string, unknown>) {
  return pickString(
    record.avatar,
    record.avatar_url,
    record.image,
    record.image_url,
    record.picture,
    record.picture_url,
    record.profile_image,
    record.profile_image_url,
    record.profile_picture,
    record.profile_picture_url,
  )
}

function pickDescription(record: Record<string, unknown>) {
  return pickString(
    record.about,
    record.description,
    record.summary,
    record.bio,
  )
}

function normalizeBrightDataProfile(payload: unknown, url: string): EnrichedProfile | null {
  const record = Array.isArray(payload) ? payload[0] : payload
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const candidate = record as Record<string, unknown>

  return {
    url,
    name: pickString(candidate.name, candidate.full_name),
    company: pickCompanyName(candidate),
    headline: pickString(candidate.position, candidate.headline, candidate.title),
    description: pickDescription(candidate),
    avatarUrl: pickAvatarUrl(candidate),
    source: 'brightdata',
  }
}

async function requireUser(authHeader: string) {
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
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid user session.')
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

  try {
    await requireUser(authHeader)

    const body = (await req.json()) as { url?: unknown }
    const url = typeof body.url === 'string' ? normalizeLinkedInProfileUrl(body.url) : null
    if (!url) {
      return jsonResponse({ error: 'A valid LinkedIn profile URL is required.' }, 400)
    }

    const apiKey = getRequiredEnv('BRIGHTDATA_API_KEY')
    const endpoint = new URL('https://api.brightdata.com/datasets/v3/scrape')
    endpoint.searchParams.set('dataset_id', LINKEDIN_PROFILE_DATASET_ID)
    endpoint.searchParams.set('format', 'json')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ url }]),
    })

    if (!response.ok) {
      const message = await response.text()
      return jsonResponse({ error: message || `Bright Data returned ${response.status}.` }, 502)
    }

    const payload = await response.json()
    const profile = normalizeBrightDataProfile(payload, url)
    if (!profile) {
      return jsonResponse({ error: 'Bright Data did not return profile data.' }, 502)
    }

    return jsonResponse(profile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enrich LinkedIn profile.'
    const status = message === 'Invalid user session.' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
