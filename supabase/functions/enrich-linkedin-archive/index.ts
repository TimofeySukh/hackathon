import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-chat-v3-0324'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_CONNECTIONS_PER_REQUEST = 12
const MAX_TEXT_CHARS = 24000

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
  personIds?: string[]
  conversationId?: string
  from?: string
  senderProfileUrl?: string
  to?: string
  recipientProfileUrls?: string
  participants?: string
  date?: string
  content: string
}

type InvitationInput = {
  personIds?: string[]
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
    ? value.trim().replaceAll('\u0000', '').replace(/\s+/g, ' ')
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
    personIds: Array.isArray(record.personIds)
      ? record.personIds.map(pickString).filter((item): item is string => Boolean(item))
      : undefined,
    conversationId: pickString(record.conversationId),
    from: pickString(record.from),
    senderProfileUrl: pickString(record.senderProfileUrl),
    to: pickString(record.to),
    recipientProfileUrls: pickString(record.recipientProfileUrls),
    participants: pickString(record.participants),
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
    personIds: Array.isArray(record.personIds)
      ? record.personIds.map(pickString).filter((item): item is string => Boolean(item))
      : undefined,
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
      ? record.messages.map(normalizeMessage).filter((item): item is MessageInput => item !== null).slice(0, 160)
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
  if (!apiKey) throw new Error('Missing required environment variable: OPENROUTER_API_KEY')
  return {
    apiKey,
    model: Deno.env.get('OPENROUTER_MODEL') ?? DEFAULT_OPENROUTER_MODEL,
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

const OUTPUT_CONTRACT = `Return ONLY valid JSON:
{
  "notes": [
    { "personId": "string", "title": "string", "body": "string" }
  ]
}

Global rules:
- Only produce notes for personId values provided in the request.
- Persist only derived context. Never quote long raw messages, invitation text, or post text.
- Do not invent facts. If evidence is weak, write "Likely" and keep it specific.
- If the evidence is empty, generic, spammy, or not clearly tied to a person, return {"notes":[]}.
- Each note body must be under 120 words.
- Prefer one high-signal note over several weak notes.`

async function callOpenRouterJson(input: {
  system: string
  user: unknown
  maxTokens?: number
}): Promise<unknown | null> {
  const config = getOpenRouterConfig()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)

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
        model: config.model,
        temperature: 0.1,
        max_tokens: input.maxTokens ?? 1400,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: clampText(JSON.stringify(input.user), MAX_TEXT_CHARS) },
        ],
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `OpenRouter returned ${response.status}.`)
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return null

    try {
      return JSON.parse(extractJsonObject(content)) as unknown
    } catch (err) {
      console.warn('Failed to parse JSON from OpenRouter response:', err)
      console.warn('Raw content was:', content)
      return null
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function callTaskForNotes(input: {
  system: string
  user: unknown
  allowedPersonIds: Set<string>
  maxTokens?: number
}): Promise<OutputNote[]> {
  const parsed = await callOpenRouterJson(input)
  return normalizeOutputNotes(parsed, input.allowedPersonIds)
}

function compactConnections(connections: ConnectionInput[]) {
  return connections.map((connection) => ({
    personId: connection.personId,
    name: connection.name,
    profileUrl: connection.profileUrl,
    company: connection.company,
    position: connection.position,
    connectedOn: connection.connectedOn,
  }))
}

async function runInvitationParser(input: ReturnType<typeof normalizeBody>, allowedPersonIds: Set<string>) {
  if (input.invitations.length === 0) return []

  return callTaskForNotes({
    allowedPersonIds,
    system: `Task B: Invitation Note Parser for Social Datanode.

${OUTPUT_CONTRACT}

Specific rules:
- Invitations may include personIds. Treat those as the authoritative mapping from invitation to connection.
- Infer origin context only from short invitation notes and sender/recipient names.
- Ignore greetings, signatures, generic networking text, sales spam, and empty courtesy phrases.
- Extract concrete origins only: event name, company/team, shared project, referral, role relation, hiring/recruiting context, speaker/audience context.
- Output title "Origin Context".
- Body format: "Origin: <specific context>\\nRole at first contact: <Recruiter | Candidate | Speaker | Peer | Attendee | Cold | Unknown>\\nEvidence: <short paraphrase, no raw quote>".
- If the note is generic ("let's connect", "grow network"), return no note for that person.`,
    user: {
      connections: compactConnections(input.connections),
      invitations: input.invitations,
    },
    maxTokens: 1200,
  })
}

async function runChatTranscriptSummarizer(input: ReturnType<typeof normalizeBody>, allowedPersonIds: Set<string>) {
  if (input.messages.length === 0) return []

  return callTaskForNotes({
    allowedPersonIds,
    system: `Task A: Chat Transcript Summarizer for Social Datanode.

${OUTPUT_CONTRACT}

Specific rules:
- Each message may include personIds. Treat those as the authoritative mapping from message to connection.
- Summarize only relationship context that helps the user remember who the person is and why they matter.
- Ignore boilerplate, scheduling noise, auto-replies, greetings, signatures, repeated "thanks", and unrelated platform noise.
- Do not quote raw messages. Paraphrase the durable context.
- Extract: relationship_summary, domain_tags, action_items, relationship_warmth.
- relationship_warmth must be one of: Cold, Warm, Hot.
- Output at most two notes per person:
  1. title "AI Relationship Summary" with body:
     "Summary: ...\\nTags: tag1, tag2\\nWarmth: Cold|Warm|Hot"
  2. title "Action Items" only when a real user action exists, with body as short bullet-like lines.
- Skip people when messages do not clearly identify a meaningful relationship.`,
    user: {
      connections: compactConnections(input.connections),
      messages: input.messages,
    },
    maxTokens: 2600,
  })
}

async function runEventPostAnalyzer(input: ReturnType<typeof normalizeBody>, allowedPersonIds: Set<string>) {
  if (input.posts.length === 0) return []

  return callTaskForNotes({
    allowedPersonIds,
    system: `Task D: Event & Post Content Analyzer for Social Datanode.

${OUTPUT_CONTRACT}

Specific rules:
- First decide whether each post describes a professional event: hackathon, conference, meetup, workshop, office visit, panel, demo day, hiring fair, community event.
- Ignore personal life posts, generic marketing posts, reposts without event context, image descriptions with no event, and posts unrelated to networking.
- Resolve relative dates only when the post date is provided; otherwise say "date unknown".
- Distinguish the Archive Owner from the connections:
  1. All posts are written in the first person ("I", "my", "we") by the Archive Owner.
  2. Never attribute the Archive Owner's personal goals, feelings, first-time experiences, or specific personal actions (e.g., "my first hackathon", "aimed for UI/UX", "bought water guns") to the connection.
  3. The Highlights for a connection should summarize the event itself (e.g., "Royalhacks hackathon focused on social network visualization") or collective/explicit achievements, never the Archive Owner's personal first-person actions.
- Correlate events to people only when:
  1. the event/post date is on, up to two days before, or up to four days after their Connected On date, OR
  2. the post explicitly mentions their name.
- Output title "AI Event Context".
- Body format: "Event: <clean event name>\\nDate: <YYYY-MM-DD or unknown>\\nContext: <why this person is linked>\\nHighlights: <1-2 durable highlights>".
- If correlation is only date-spike based, start Context with "Likely".
- Never correlate a person to an event that happened after their Connected On date (though the post recap itself may be published up to four days after their Connected On date) unless the post explicitly mentions that person.
- Do not attach an event to every connection unless the evidence supports the batch date correlation.`,
    user: {
      connections: compactConnections(input.connections),
      posts: input.posts,
    },
    maxTokens: 1800,
  })
}

async function runArchiveEnrichmentTasks(input: ReturnType<typeof normalizeBody>): Promise<OutputNote[]> {
  const allowedPersonIds = new Set(input.connections.map((connection) => connection.personId))
  const taskResults = await Promise.all([
    runInvitationParser(input, allowedPersonIds),
    runChatTranscriptSummarizer(input, allowedPersonIds),
    runEventPostAnalyzer(input, allowedPersonIds),
  ])

  const seen = new Set<string>()
  const notes: OutputNote[] = []
  for (const note of taskResults.flat()) {
    const key = `${note.personId}\n${note.title}\n${note.body}`
    if (seen.has(key)) continue
    seen.add(key)
    notes.push(note)
  }
  return notes
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
    const notes = await runArchiveEnrichmentTasks(input)
    return jsonResponse({ notes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to enrich LinkedIn archive.'
    const status = message === 'Invalid user session.' ? 401 : message.includes('required') ? 400 : 500
    return jsonResponse({ error: message }, status)
  }
})
