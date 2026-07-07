import { supabase } from './supabase'

export type LinkedInArchiveConnectionInput = {
  personId: string
  name: string
  profileUrl?: string
  company?: string
  position?: string
  connectedOn?: string
}

export type LinkedInArchiveMessageInput = {
  conversationId?: string
  from?: string
  senderProfileUrl?: string
  to?: string
  recipientProfileUrls?: string
  participants?: string
  date?: string
  content: string
}

export type LinkedInArchiveInvitationInput = {
  from?: string
  to?: string
  sentAt?: string
  message: string
}

export type LinkedInArchivePostInput = {
  date?: string
  description: string
}

export type LinkedInArchiveEnrichmentNote = {
  personId: string
  title: string
  body: string
}

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeNote(value: unknown): LinkedInArchiveEnrichmentNote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const personId = pickString(record.personId)
  const title = pickString(record.title)
  const body = pickString(record.body)
  if (!personId || !title || !body) return null
  return { personId, title, body }
}

function getFriendlyFunctionErrorMessage(message: string) {
  if (/failed to send a request|fetch/i.test(message)) {
    return 'Could not reach the LinkedIn AI context service. Check that the enrich-linkedin-archive Edge Function is deployed.'
  }

  if (/OPENROUTER_API_KEY|openrouter|api key|secret/i.test(message)) {
    return 'LinkedIn AI context is not configured yet. Add the OpenRouter secret for the enrich-linkedin-archive Edge Function.'
  }

  return message
}

async function getFunctionErrorMessage(error: unknown) {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : null

  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as unknown
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const message = pickString((body as Record<string, unknown>).error)
        if (message) return getFriendlyFunctionErrorMessage(message)
      }
    } catch {
      try {
        const text = await context.clone().text()
        if (text.trim()) return getFriendlyFunctionErrorMessage(text.trim())
      } catch {
        // Fall back to the generic Error message below.
      }
    }
  }

  const fallback = error instanceof Error && error.message
    ? error.message
    : 'LinkedIn archive enrichment failed.'

  return getFriendlyFunctionErrorMessage(fallback)
}

function getLocalTestHeaders() {
  const secret = import.meta.env.DEV ? import.meta.env.VITE_LINKEDIN_ENRICHMENT_TEST_SECRET : ''
  return typeof secret === 'string' && secret.trim()
    ? { 'x-linkedin-enrichment-test-secret': secret.trim() }
    : undefined
}

export async function enrichLinkedInArchiveBatch(input: {
  connections: LinkedInArchiveConnectionInput[]
  messages: LinkedInArchiveMessageInput[]
  invitations: LinkedInArchiveInvitationInput[]
  posts: LinkedInArchivePostInput[]
}): Promise<LinkedInArchiveEnrichmentNote[]> {
  if (!supabase) return []
  if (input.connections.length === 0) return []

  const { data, error } = await supabase.functions.invoke('enrich-linkedin-archive', {
    body: input,
    headers: getLocalTestHeaders(),
  })

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  const notes = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>).notes
    : null
  return Array.isArray(notes)
    ? notes.map(normalizeNote).filter((note): note is LinkedInArchiveEnrichmentNote => note !== null)
    : []
}
