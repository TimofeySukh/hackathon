export type OpenRouterChatRole = 'user' | 'assistant'

export type OpenRouterChatMessage = {
  role: OpenRouterChatRole
  content: string
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_MODEL = 'openrouter/free'

const SYSTEM_PROMPT = `You are DataNode Agent, a helpful assistant inside a social relationship board product.
Answer clearly and concisely in the user's language.
The board integration is not connected yet, so do not claim you can read the user's graph unless they paste details.
When asked about network or contacts, explain what you could do once board context is wired in.`

type OpenRouterChoice = {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>
  }
}

type OpenRouterCompletionResponse = {
  choices?: OpenRouterChoice[]
  error?: {
    message?: string
    code?: number | string
  }
}

function getOpenRouterApiKey(): string | null {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY?.trim()
  return key ? key : null
}

function getOpenRouterModel(): string {
  const model = import.meta.env.VITE_OPENROUTER_MODEL?.trim()
  return model || DEFAULT_MODEL
}

function buildCompletionPayload(messages: OpenRouterChatMessage[]) {
  return {
    model: getOpenRouterModel(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
  }
}

function normalizeAssistantContent(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => (part?.type === 'text' ? part.text ?? '' : ''))
    .join('')
    .trim()
}

function formatOpenRouterError(status: number, rawBody: string): string {
  let message = rawBody
  try {
    const parsed = JSON.parse(rawBody) as OpenRouterCompletionResponse
    message = parsed.error?.message ?? rawBody
  } catch {
    // keep raw text
  }

  if (status === 401 || status === 403) {
    return 'OpenRouter rejected the API key. Check VITE_OPENROUTER_API_KEY in .env.local.'
  }
  if (status === 429) {
    return 'OpenRouter free tier rate limit hit. Wait a moment and try again.'
  }

  return message || `OpenRouter request failed (${status}).`
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(getOpenRouterApiKey())
}

export async function completeOpenRouterChat(
  messages: OpenRouterChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error('Missing VITE_OPENROUTER_API_KEY. Add it to .env.local to enable agent chat.')
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://social.datanode.live',
      'X-Title': 'DataNode Agent',
    },
    body: JSON.stringify(buildCompletionPayload(messages)),
  })

  const rawBody = await response.text()
  if (!response.ok) {
    throw new Error(formatOpenRouterError(response.status, rawBody))
  }

  let parsed: OpenRouterCompletionResponse
  try {
    parsed = JSON.parse(rawBody) as OpenRouterCompletionResponse
  } catch {
    throw new Error('OpenRouter returned a non-JSON response.')
  }

  const content = normalizeAssistantContent(parsed.choices?.[0]?.message?.content)
  if (!content) {
    throw new Error('OpenRouter returned an empty assistant message.')
  }

  return content
}

export function getOpenRouterModelLabel(): string {
  return getOpenRouterModel() === DEFAULT_MODEL ? 'OpenRouter Free' : getOpenRouterModel()
}
