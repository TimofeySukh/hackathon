export const OAUTH_RESULT_MESSAGE_TYPE = 'social-datanode.oauth-result.v1'
export const OAUTH_ACK_MESSAGE_TYPE = 'social-datanode.oauth-ack.v1'

const CALLBACK_FLAG = 'v1'
const ACK_TIMEOUT_MS = 15_000

export function parseOAuthCallbackResult(href) {
  const url = new URL(href)
  if (url.searchParams.get('sdn_auth_popup_callback') !== CALLBACK_FLAG) return null

  const nonce = url.searchParams.get('sdn_auth_nonce') || ''
  if (!nonce) return null

  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const error = url.searchParams.get('error_description')
    || url.searchParams.get('error')
    || hash.get('error_description')
    || hash.get('error')

  if (error) {
    return { type: OAUTH_RESULT_MESSAGE_TYPE, nonce, error }
  }

  const accessToken = hash.get('access_token') || ''
  const refreshToken = hash.get('refresh_token') || ''
  if (!accessToken || !refreshToken) return null

  return {
    type: OAUTH_RESULT_MESSAGE_TYPE,
    nonce,
    accessToken,
    refreshToken,
  }
}

export function readTrustedOAuthAcknowledgement(event, {
  expectedOrigin,
  expectedOpener,
  expectedNonce,
}) {
  if (event.origin !== expectedOrigin || event.source !== expectedOpener) return null
  const message = event.data
  if (!message || typeof message !== 'object') return null
  if (message.type !== OAUTH_ACK_MESSAGE_TYPE || message.nonce !== expectedNonce) return null
  if (typeof message.ok !== 'boolean') return null
  return message
}

export function runOAuthPopupCallback(target = window) {
  const status = target.document.getElementById('oauth-status')
  const result = parseOAuthCallbackResult(target.location.href)
  const opener = target.opener

  target.history.replaceState(target.history.state, '', `${target.location.pathname}${target.location.search}`)

  if (!result || !opener) {
    if (status) status.textContent = 'Could not return to the board. Close this window and try again.'
    return
  }

  const timeout = target.setTimeout(() => {
    if (status) status.textContent = 'The board did not confirm sign in. Close this window and try again.'
  }, ACK_TIMEOUT_MS)

  target.addEventListener('message', (event) => {
    const acknowledgement = readTrustedOAuthAcknowledgement(event, {
      expectedOrigin: target.location.origin,
      expectedOpener: opener,
      expectedNonce: result.nonce,
    })
    if (!acknowledgement) return

    target.clearTimeout(timeout)
    if (!acknowledgement.ok) {
      if (status) status.textContent = acknowledgement.error || 'Could not complete sign in.'
      return
    }

    if (status) status.textContent = 'Signed in. Returning to your board…'
    target.close()
  })

  opener.postMessage(result, target.location.origin)
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  runOAuthPopupCallback(window)
}
