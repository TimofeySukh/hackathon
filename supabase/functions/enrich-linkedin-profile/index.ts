import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

const LINKEDIN_PROFILE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-linkedin-enrichment-test-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type EnrichedProfile = {
  url: string
  name?: string
  company?: string
  headline?: string
  description?: string
  avatarUrl?: string
  source: 'provider'
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

function getLinkedInEnrichmentApiKey() {
  return Deno.env.get('LINKEDIN_ENRICHMENT_API_KEY') ?? getRequiredEnv('BRIGHTDATA_API_KEY')
}

function isLocalUrl(value: string | null) {
  if (!value) return false
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  } catch {
    return false
  }
}

function isAuthorizedLocalTestRequest(req: Request) {
  if (Deno.env.get('LINKEDIN_ENRICHMENT_ALLOW_TEST_AUTH') !== 'true') return false
  const expectedSecret = Deno.env.get('LINKEDIN_ENRICHMENT_TEST_SECRET')
  if (!expectedSecret) return false
  const actualSecret = req.headers.get('x-linkedin-enrichment-test-secret')
  if (actualSecret !== expectedSecret) return false
  return isLocalUrl(req.headers.get('Origin')) || isLocalUrl(req.headers.get('Referer'))
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
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    if (Array.isArray(value)) {
      const picked = pickString(...value)
      if (picked) return picked
    }
  }
  return undefined
}

function pickObjectString(value: unknown, keys: string[]) {
  if (typeof value === 'string') return pickString(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = pickObjectString(item, keys)
      if (picked) return picked
    }
  }
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  return pickString(...keys.map((key) => record[key]))
}

function pickUrl(...values: unknown[]) {
  const value = pickString(...values)
  if (!value) return undefined
  return /^(https?:|data:image\/)/i.test(value) ? value : undefined
}

function pickCompanyFromExperience(value: unknown) {
  const records = Array.isArray(value) ? value : value ? [value] : []
  for (const item of records) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const isCurrent = !pickString(record.end_date, record.ends_at, record.date_to, record.duration_to)
    if (!isCurrent) continue
    const company = pickObjectString(record.company, ['name', 'company_name']) ?? pickString(record.company_name, record.organization)
    if (company) return company
  }
  return undefined
}

function pickCompanyName(record: Record<string, unknown>) {
  return pickString(
    pickObjectString(record.current_company, ['name', 'company_name']),
    pickObjectString(record.company, ['name', 'company_name']),
    pickObjectString(record.current_company_info, ['name', 'company_name']),
    pickCompanyFromExperience(record.current_positions),
    pickCompanyFromExperience(record.experience),
    pickCompanyFromExperience(record.experiences),
    record.current_company_name,
    record.company_name,
    record.organization,
    record.company,
  )
}

function pickAvatarUrl(record: Record<string, unknown>) {
  return pickUrl(
    record.avatar,
    record.avatar_url,
    record.image,
    record.image_url,
    record.picture,
    record.picture_url,
    record.profile_image,
    record.profile_image_url,
    record.profile_image_url_https,
    record.profile_picture,
    record.profile_picture_url,
    pickObjectString(record.avatar, ['url', 'src']),
    pickObjectString(record.image, ['url', 'src']),
    pickObjectString(record.picture, ['url', 'src']),
    pickObjectString(record.profile_image, ['url', 'src']),
    pickObjectString(record.profile_picture, ['url', 'src']),
  )
}

function pickDescription(record: Record<string, unknown>) {
  return pickString(
    record.about,
    record.about_section,
    record.about_text,
    record.description,
    record.summary,
    record.profile_summary,
    record.bio,
    pickObjectString(record.about, ['text', 'value', 'description']),
    pickObjectString(record.summary, ['text', 'value', 'description']),
  )
}

function buildProfileDetails(record: Record<string, unknown>, company: string | undefined) {
  const lines = [
    pickString(record.location, record.city),
    company ? `Current company: ${company}` : undefined,
    pickString(record.educations_details) ? `Education: ${pickString(record.educations_details)}` : undefined,
    typeof record.connections === 'number' ? `LinkedIn connections: ${record.connections}` : undefined,
    typeof record.followers === 'number' ? `LinkedIn followers: ${record.followers}` : undefined,
  ].filter((line): line is string => Boolean(line))

  return lines.length ? lines.join('\n') : undefined
}

function normalizeProviderProfile(payload: unknown, url: string): EnrichedProfile | null {
  const record = Array.isArray(payload) ? payload[0] : payload
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const candidate = record as Record<string, unknown>
  const name = pickString(candidate.name, candidate.full_name, candidate.fullName)
  const company = pickCompanyName(candidate)
  const headline = pickString(candidate.position, candidate.headline, candidate.title, candidate.job_title, candidate.current_title)
  const description = pickDescription(candidate) ?? buildProfileDetails(candidate, company)
  const avatarUrl = pickAvatarUrl(candidate)

  if (!name && !company && !headline && !description && !avatarUrl) return null

  return {
    url,
    name,
    company,
    headline,
    description,
    avatarUrl,
    source: 'provider',
  }
}

function pickSnapshotId(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined
  return pickString((payload as Record<string, unknown>).snapshot_id)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadSnapshot(apiKey: string, snapshotId: string) {
  const snapshotUrl = new URL(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`)
  snapshotUrl.searchParams.set('format', 'json')

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(snapshotUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (response.status === 202 || response.status === 409) {
      await delay(3000)
      continue
    }

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `LinkedIn profile snapshot returned ${response.status}.`)
    }

    return await response.json()
  }

  throw new Error('LinkedIn profile import is still running. Try again in a few seconds.')
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
  try {
    if (!isAuthorizedLocalTestRequest(req)) {
      if (!authHeader) {
        return jsonResponse({ error: 'Missing authorization header.' }, 401)
      }
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const isServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`
      if (!isServiceRole) {
        await requireUser(authHeader)
      }
    }

    const body = (await req.json()) as { url?: unknown }
    const url = typeof body.url === 'string' ? normalizeLinkedInProfileUrl(body.url) : null
    if (!url) {
      return jsonResponse({ error: 'A valid LinkedIn profile URL is required.' }, 400)
    }

    const apiKey = getLinkedInEnrichmentApiKey()
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

    if (!response.ok && response.status !== 202) {
      const message = await response.text()
      return jsonResponse({ error: message || `LinkedIn profile provider returned ${response.status}.` }, 502)
    }

    let payload = await response.json()
    const snapshotId = pickSnapshotId(payload)
    if (snapshotId) {
      payload = await downloadSnapshot(apiKey, snapshotId)
    }

    const profile = normalizeProviderProfile(payload, url)
    if (!profile) {
      return jsonResponse({ error: 'LinkedIn profile provider did not return profile data.' }, 502)
    }

    return jsonResponse(profile)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enrich LinkedIn profile.'
    const status = message === 'Invalid user session.' ? 401 : 500
    return jsonResponse({ error: message }, status)
  }
})
