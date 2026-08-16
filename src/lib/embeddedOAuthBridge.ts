export const OAUTH_RESULT_MESSAGE_TYPE = 'social-datanode.oauth-result.v1'
export const OAUTH_ACK_MESSAGE_TYPE = 'social-datanode.oauth-ack.v1'

const EMBED_AUTH_SEARCH_PARAM = 'embed_auth'
const EMBED_AUTH_VALUE = 'popup-v1'
const OAUTH_CALLBACK_SEARCH_PARAM = 'sdn_auth_popup_callback'
const OAUTH_CALLBACK_VALUE = 'v1'
const OAUTH_NONCE_SEARCH_PARAM = 'sdn_auth_nonce'

export type OAuthResultMessage = {
  type: typeof OAUTH_RESULT_MESSAGE_TYPE
  nonce: string
  accessToken?: string
  refreshToken?: string
  error?: string
}

export type OAuthAcknowledgement = {
  type: typeof OAUTH_ACK_MESSAGE_TYPE
  nonce: string
  ok: boolean
  error?: string
}

type MessageEventLike = {
  origin: string
  source: unknown
  data: unknown
}

type TrustedOAuthResultOptions = {
  expectedOrigin: string
  expectedPopup: unknown
  expectedNonce: string
}

type OAuthSessionSetter = (tokens: {
  access_token: string
  refresh_token: string
}) => Promise<{
  data: { session: unknown | null }
  error: { message: string } | null
}>

export function isEmbeddedPopupAuthEnabled(href = window.location.href) {
  const url = new URL(href)
  return url.searchParams.get(EMBED_AUTH_SEARCH_PARAM) === EMBED_AUTH_VALUE
}

export function createOAuthNonce(
  randomValues?: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>,
) {
  const bytes = new Uint8Array(new ArrayBuffer(16))
  const randomBytes = randomValues ? randomValues(bytes) : crypto.getRandomValues(bytes)
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildEmbeddedOAuthCallbackUrl(origin: string, nonce: string) {
  const url = new URL('/embed', origin)
  url.searchParams.set('sdn_auth_return', 'board')
  url.searchParams.set(OAUTH_CALLBACK_SEARCH_PARAM, OAUTH_CALLBACK_VALUE)
  url.searchParams.set(OAUTH_NONCE_SEARCH_PARAM, nonce)
  return url.toString()
}

function isOAuthResultMessage(value: unknown): value is OAuthResultMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<OAuthResultMessage>
  if (message.type !== OAUTH_RESULT_MESSAGE_TYPE || typeof message.nonce !== 'string') return false
  if (typeof message.error === 'string' && message.error) return true
  return typeof message.accessToken === 'string' && message.accessToken.length > 0
    && typeof message.refreshToken === 'string' && message.refreshToken.length > 0
}

export function readTrustedOAuthResult(
  event: MessageEventLike,
  { expectedOrigin, expectedPopup, expectedNonce }: TrustedOAuthResultOptions,
) {
  if (event.origin !== expectedOrigin || event.source !== expectedPopup) return null
  if (!isOAuthResultMessage(event.data) || event.data.nonce !== expectedNonce) return null
  return event.data
}

export function createOAuthAcknowledgement(
  nonce: string,
  ok: boolean,
  error?: string,
): OAuthAcknowledgement {
  return {
    type: OAUTH_ACK_MESSAGE_TYPE,
    nonce,
    ok,
    ...(error ? { error } : {}),
  }
}

export async function completeOAuthResult(
  result: OAuthResultMessage,
  setSession: OAuthSessionSetter,
) {
  if (result.error) {
    return createOAuthAcknowledgement(result.nonce, false, result.error)
  }

  try {
    const { data, error } = await setSession({
      access_token: result.accessToken ?? '',
      refresh_token: result.refreshToken ?? '',
    })
    const sessionError = error?.message || (!data.session ? 'Google sign-in did not create a session.' : null)
    return createOAuthAcknowledgement(result.nonce, !sessionError, sessionError ?? undefined)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return createOAuthAcknowledgement(result.nonce, false, message)
  }
}
