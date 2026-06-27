export type LlmProvider = {
  label: string
  role: 'helper' | 'worker'
  apiKey: string
  baseUrl: string
  model: string
}

const DEFAULT_NEURALDEEP_BASE = 'https://api.neuraldeep.ru/v1'
const DEFAULT_GROQ_BASE = 'https://api.groq.com/openai/v1'
const DEFAULT_OPENAI_BASE = 'https://api.openai.com/v1'

const GPT_OSS_STRICT = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b'])

export function supportsStrictJsonSchema(model: string) {
  return GPT_OSS_STRICT.has(model) || model.includes('gpt-4o-mini') || model.includes('gpt-5')
}

function envTrim(key: string) {
  return Deno.env.get(key)?.trim() || ''
}

function buildProvider(
  label: string,
  role: 'helper' | 'worker',
  apiKey: string,
  baseUrl: string,
  model: string,
): LlmProvider | null {
  if (!apiKey || !model) return null
  return { label, role, apiKey, baseUrl: baseUrl.replace(/\/$/, ''), model }
}

/** Helper (nano): plan, classify, verify — fast/cheap. */
export function getHelperLlmProvider(): LlmProvider | null {
  const explicit = envTrim('SEARCH_HELPER_MODEL')
  const openaiKey = envTrim('OPENAI_API_KEY')
  const groqKey = envTrim('GROQ_API_KEY')

  if (openaiKey) {
    return buildProvider(
      'openai-helper',
      'helper',
      openaiKey,
      envTrim('OPENAI_API_BASE_URL') || DEFAULT_OPENAI_BASE,
      explicit || envTrim('OPENAI_HELPER_MODEL') || 'gpt-5.4-nano',
    )
  }

  if (groqKey) {
    return buildProvider(
      'groq-helper',
      'helper',
      groqKey,
      DEFAULT_GROQ_BASE,
      explicit || 'openai/gpt-oss-20b',
    )
  }

  const aiKey = envTrim('AI_SEARCH_API_KEY')
  if (aiKey) {
    return buildProvider(
      'ai-search-helper',
      'helper',
      aiKey,
      envTrim('AI_SEARCH_API_BASE_URL') || DEFAULT_NEURALDEEP_BASE,
      explicit || envTrim('AI_SEARCH_MODEL') || 'openai/gpt-oss-120b',
    )
  }

  return null
}

/** Worker (mini): batch matching — stronger model. */
export function getWorkerLlmProvider(): LlmProvider | null {
  const explicit = envTrim('SEARCH_WORKER_MODEL')
  const groqKey = envTrim('GROQ_API_KEY')
  const openaiKey = envTrim('OPENAI_API_KEY')
  const aiKey = envTrim('AI_SEARCH_API_KEY')

  if (openaiKey) {
    return buildProvider(
      'openai-worker',
      'worker',
      openaiKey,
      envTrim('OPENAI_API_BASE_URL') || DEFAULT_OPENAI_BASE,
      explicit || envTrim('OPENAI_WORKER_MODEL') || envTrim('OPENAI_MODEL') || 'gpt-5.4-mini',
    )
  }

  if (groqKey) {
    return buildProvider(
      'groq-worker',
      'worker',
      groqKey,
      DEFAULT_GROQ_BASE,
      explicit || envTrim('GROQ_MODEL') || 'openai/gpt-oss-120b',
    )
  }

  if (aiKey) {
    return buildProvider(
      'ai-search-worker',
      'worker',
      aiKey,
      envTrim('AI_SEARCH_API_BASE_URL') || DEFAULT_NEURALDEEP_BASE,
      explicit || envTrim('AI_SEARCH_MODEL') || 'openai/gpt-oss-120b',
    )
  }

  return null
}

export function getLlmProviderChain(): LlmProvider[] {
  const chain: LlmProvider[] = []
  const seen = new Set<string>()
  for (const provider of [getHelperLlmProvider(), getWorkerLlmProvider()]) {
    if (!provider) continue
    const key = `${provider.baseUrl}|${provider.model}|${provider.role}`
    if (seen.has(key)) continue
    seen.add(key)
    chain.push(provider)
  }
  return chain
}

export function getPrimaryLlmProvider(): LlmProvider | null {
  return getWorkerLlmProvider() ?? getHelperLlmProvider()
}

export function isAiSearchConfigured() {
  return Boolean(getHelperLlmProvider() || getWorkerLlmProvider())
}

export type LlmChatOptions = {
  system: string
  user: unknown
  maxTokens?: number
  temperature?: number
  responseFormat?: Record<string, unknown> | null
  timeoutMs?: number
}

async function callLlmOnProvider(
  provider: LlmProvider,
  options: LlmChatOptions,
): Promise<string | null> {
  const {
    system,
    user,
    maxTokens = 400,
    temperature = 0.2,
    responseFormat = null,
    timeoutMs = 14000,
  } = options

  const buildBody = (format: Record<string, unknown> | null) => ({
    model: provider.model,
    temperature,
    max_tokens: maxTokens,
    ...(format ? { response_format: format } : {}),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: typeof user === 'string' ? user : JSON.stringify(user) },
    ],
  })

  const formatAttempts: Array<Record<string, unknown> | null> = responseFormat
    ? [responseFormat, null]
    : supportsStrictJsonSchema(provider.model)
      ? [{ type: 'json_object' }, null]
      : [null]

  for (const format of formatAttempts) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildBody(format)),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`LLM error (${provider.label})`, response.status, errorText.slice(0, 200))
        if (format && formatAttempts.length > 1) continue
        return null
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>
      }
      return payload.choices?.[0]?.message?.content ?? null
    } catch (error) {
      console.error(`LLM failed (${provider.label})`, error)
      if (format && formatAttempts.length > 1) continue
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  return null
}

async function callRoleLlm(
  role: 'helper' | 'worker',
  options: LlmChatOptions,
): Promise<{ content: string | null; provider: string | null }> {
  const primary = role === 'helper' ? getHelperLlmProvider() : getWorkerLlmProvider()
  const fallback = role === 'helper' ? getWorkerLlmProvider() : getHelperLlmProvider()

  for (const provider of [primary, fallback]) {
    if (!provider) continue
    const content = await callLlmOnProvider(provider, options)
    if (content) return { content, provider: provider.label }
  }

  return { content: null, provider: null }
}

export function callHelperLlm(options: LlmChatOptions) {
  return callRoleLlm('helper', options)
}

export function callWorkerLlm(options: LlmChatOptions) {
  return callRoleLlm('worker', options)
}

/** Legacy: tries worker then helper. */
export async function callLlmChat(options: LlmChatOptions): Promise<{ content: string | null; provider: string | null }> {
  const worker = await callWorkerLlm(options)
  if (worker.content) return worker
  return await callHelperLlm(options)
}
