import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_SMART_MODEL = 'openai/gpt-4o-mini'
const DEFAULT_FAST_MODEL = 'deepseek/deepseek-chat-v3-0324'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_CONNECTIONS_PER_REQUEST = 12
const MAX_TEXT_CHARS = 12000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-linkedin-enrichment-test-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ConnectionInput = {
  personId: string
  name: string
  profileUrl?: string
  company?: string
  position?: string
  connectedOn?: string
}

type MessageInput = {
  conversationId?: string
  from?: string
  senderProfileUrl?: string
  to?: string
  recipientProfileUrls?: string
  date?: string
  content: string
}

type InvitationInput = {
  from?: string
  to?: string
  sentAt?: string
  message: string
}

type PostInput = {
  date?: string
  description: string
}

type OutputNote = {
  personId: string
  title: string
  body: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
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

async function requireUser(authHeader: string) {
  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
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

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().replace(/\u0000/g, '').replace(/\s+/g, ' ')
    : undefined
}

function clampText(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}...` : value
}

function normalizeConnection(value: unknown): ConnectionInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const personId = pickString(record.personId)
  const name = pickString(record.name)
  if (!personId || !name) return null
  return {
    personId,
    name,
    profileUrl: pickString(record.profileUrl),
    company: pickString(record.company),
    position: pickString(record.position),
    connectedOn: pickString(record.connectedOn),
  }
}

function normalizeMessage(value: unknown): MessageInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const content = pickString(record.content)
  if (!content) return null
  return {
    conversationId: pickString(record.conversationId),
    from: pickString(record.from),
    senderProfileUrl: pickString(record.senderProfileUrl),
    to: pickString(record.to),
    recipientProfileUrls: pickString(record.recipientProfileUrls),
    date: pickString(record.date),
    content: clampText(content, 1500),
  }
}

function normalizeInvitation(value: unknown): InvitationInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const message = pickString(record.message)
  if (!message) return null
  return {
    from: pickString(record.from),
    to: pickString(record.to),
    sentAt: pickString(record.sentAt),
    message: clampText(message, 1000),
  }
}

function normalizePost(value: unknown): PostInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const description = pickString(record.description)
  if (!description) return null
  return {
    date: pickString(record.date),
    description: clampText(description, 1500),
  }
}

function normalizeBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Request body must be an object.')
  }
  const record = value as Record<string, unknown>
  const connections = Array.isArray(record.connections)
    ? record.connections.map(normalizeConnection).filter((item): item is ConnectionInput => item !== null).slice(0, MAX_CONNECTIONS_PER_REQUEST)
    : []
  if (connections.length === 0) throw new Error('At least one connection is required.')

  return {
    connections,
    messages: Array.isArray(record.messages)
      ? record.messages.map(normalizeMessage).filter((item): item is MessageInput => item !== null).slice(0, 80)
      : [],
    invitations: Array.isArray(record.invitations)
      ? record.invitations.map(normalizeInvitation).filter((item): item is InvitationInput => item !== null).slice(0, 40)
      : [],
    posts: Array.isArray(record.posts)
      ? record.posts.map(normalizePost).filter((item): item is PostInput => item !== null).slice(0, 40)
      : [],
  }
}

function getOpenRouterConfig() {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY') ?? Deno.env.get('LINKEDIN_ARCHIVE_OPENROUTER_API_KEY')
  if (!apiKey) return null
  return {
    apiKey,
    smartModel: Deno.env.get('OPENROUTER_SMART_MODEL') ?? DEFAULT_SMART_MODEL,
    fastModel: Deno.env.get('OPENROUTER_FAST_MODEL') ?? DEFAULT_FAST_MODEL,
  }
}

function extractJsonObject(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match?.[0] ?? trimmed
}

function normalizeOutputNotes(value: unknown, allowedPersonIds: Set<string>): OutputNote[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const notes = (value as Record<string, unknown>).notes
  if (!Array.isArray(notes)) return []

  const output: OutputNote[] = []
  for (const item of notes) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const record = item as Record<string, unknown>
    const personId = pickString(record.personId)
    const title = pickString(record.title)
    const body = pickString(record.body)
    if (!personId || !allowedPersonIds.has(personId) || !title || !body) continue
    output.push({
      personId,
      title: title.slice(0, 80),
      body: clampText(body, 1600),
    })
  }
  return output
}

function buildPrompt(input: ReturnType<typeof normalizeBody>) {
  const payload = JSON.stringify(input)
  return {
    system: `You enrich a private Social Datanode graph from a LinkedIn Part 1 export.
Return ONLY valid JSON:
{
  "notes": [
    { "personId": "string", "title": "string", "body": "string" }
  ]
}

Rules:
- Store only derived relationship context. Never quote long raw messages.
- Do not invent facts. Use "Likely" when context is inferred from weak evidence.
- Produce notes only for provided personId values.
- Prefer these note titles: AI Relationship Summary, Origin Context, AI Event Context, AI Professional Context, Action Items.
- Keep each note under 120 words.
- Skip empty or low-confidence notes.`,
    user: clampText(payload, MAX_TEXT_CHARS),
  }
}

async function callOpenRouter(input: ReturnType<typeof normalizeBody>): Promise<OutputNote[]> {
  const config = getOpenRouterConfig()
  if (!config) return []

  const prompt = buildPrompt(input)
  const hasNarrativeContext = input.messages.length > 0 || input.posts.length > 0
  const model = hasNarrativeContext ? config.smartModel : config.fastModel
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://datanode.live',
        'X-OpenRouter-Title': 'Social Datanode',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1600,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `OpenRouter returned ${response.status}.`)
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return []

    const parsed = JSON.parse(extractJsonObject(content)) as unknown
    return normalizeOutputNotes(parsed, new Set(input.connections.map((connection) => connection.personId)))
  } finally {
    clearTimeout(timeout)
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

    const input = normalizeBody(await req.json())
    const notes = await callOpenRouter(input)
    return jsonResponse({ notes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enrich LinkedIn archive.'
    const status = message === 'Invalid user session.' ? 401 : message.includes('required') ? 400 : 500
    return jsonResponse({ error: message }, status)
  }
})
