import assert from 'node:assert/strict'

import { beginGoogleOAuth, isEmbeddedContext } from '../src/lib/embeddedAuth.ts'
import {
  OAUTH_ACK_MESSAGE_TYPE,
  OAUTH_RESULT_MESSAGE_TYPE,
  buildEmbeddedOAuthCallbackUrl,
  completeOAuthResult,
  createOAuthAcknowledgement,
  createOAuthNonce,
  isEmbeddedPopupAuthEnabled,
  readTrustedOAuthResult,
} from '../src/lib/embeddedOAuthBridge.ts'
import {
  parseOAuthCallbackResult,
  readTrustedOAuthAcknowledgement,
  runOAuthPopupCallback,
} from '../public/auth/popup-callback.js'

const sharedWindow = {}
assert.equal(isEmbeddedContext({ self: sharedWindow, top: sharedWindow }), false)
assert.equal(isEmbeddedContext({ self: {}, top: {} }), true)

assert.equal(
  isEmbeddedPopupAuthEnabled('https://social.datanode.live/embed?embed_auth=popup-v1#board'),
  true,
)
assert.equal(isEmbeddedPopupAuthEnabled('https://social.datanode.live/embed#board'), false)

const nonce = createOAuthNonce((bytes) => {
  bytes.fill(0xab)
  return bytes
})
assert.equal(nonce, 'abababababababababababababababab')
assert.equal(
  buildEmbeddedOAuthCallbackUrl('https://social.datanode.live', nonce),
  'https://social.datanode.live/embed?sdn_auth_return=board&sdn_auth_popup_callback=v1&sdn_auth_nonce=abababababababababababababababab',
)

const expectedPopup = {}
const trustedResult = readTrustedOAuthResult({
  origin: 'https://social.datanode.live',
  source: expectedPopup,
  data: {
    type: OAUTH_RESULT_MESSAGE_TYPE,
    nonce,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  },
}, {
  expectedOrigin: 'https://social.datanode.live',
  expectedPopup,
  expectedNonce: nonce,
})
assert.deepEqual(trustedResult, {
  type: OAUTH_RESULT_MESSAGE_TYPE,
  nonce,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
})
assert.equal(readTrustedOAuthResult({
  origin: 'https://evil.example',
  source: expectedPopup,
  data: trustedResult,
}, {
  expectedOrigin: 'https://social.datanode.live',
  expectedPopup,
  expectedNonce: nonce,
}), null)
assert.equal(readTrustedOAuthResult({
  origin: 'https://social.datanode.live',
  source: expectedPopup,
  data: trustedResult,
}, {
  expectedOrigin: 'https://social.datanode.live',
  expectedPopup,
  expectedNonce: 'different-nonce',
}), null)
assert.equal(readTrustedOAuthResult({
  origin: 'https://social.datanode.live',
  source: {},
  data: trustedResult,
}, {
  expectedOrigin: 'https://social.datanode.live',
  expectedPopup,
  expectedNonce: nonce,
}), null)

const completedTokens = []
assert.deepEqual(await completeOAuthResult(trustedResult, async (tokens) => {
  completedTokens.push(tokens)
  return { data: { session: { user: { id: 'user-1' } } }, error: null }
}), {
  type: OAUTH_ACK_MESSAGE_TYPE,
  nonce,
  ok: true,
})
assert.deepEqual(completedTokens, [{ access_token: 'access-token', refresh_token: 'refresh-token' }])

assert.deepEqual(await completeOAuthResult({
  type: OAUTH_RESULT_MESSAGE_TYPE,
  nonce,
  error: 'Google denied access.',
}, async () => assert.fail('An OAuth error must not attempt to create a session.')), {
  type: OAUTH_ACK_MESSAGE_TYPE,
  nonce,
  ok: false,
  error: 'Google denied access.',
})

assert.deepEqual(await completeOAuthResult(trustedResult, async () => {
  throw new Error('Session request failed.')
}), {
  type: OAUTH_ACK_MESSAGE_TYPE,
  nonce,
  ok: false,
  error: 'Session request failed.',
})

const acknowledgement = createOAuthAcknowledgement(nonce, true)
assert.deepEqual(acknowledgement, { type: OAUTH_ACK_MESSAGE_TYPE, nonce, ok: true })
assert.deepEqual(parseOAuthCallbackResult(
  `https://social.datanode.live/embed?sdn_auth_popup_callback=v1&sdn_auth_nonce=${nonce}#access_token=access-token&refresh_token=refresh-token`,
), {
  type: OAUTH_RESULT_MESSAGE_TYPE,
  nonce,
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
})
assert.deepEqual(readTrustedOAuthAcknowledgement({
  origin: 'https://social.datanode.live',
  source: expectedPopup,
  data: acknowledgement,
}, {
  expectedOrigin: 'https://social.datanode.live',
  expectedOpener: expectedPopup,
  expectedNonce: nonce,
}), acknowledgement)

const callbackStatus = { textContent: '' }
const callbackListeners = new Map()
const callbackMessages = []
let callbackClosed = false
let clearedCallbackUrl = null
const callbackOpener = {
  postMessage(message, targetOrigin) {
    callbackMessages.push({ message, targetOrigin })
  },
}
const callbackTarget = {
  location: {
    href: `https://social.datanode.live/embed?sdn_auth_popup_callback=v1&sdn_auth_nonce=${nonce}#access_token=access-token&refresh_token=refresh-token`,
    origin: 'https://social.datanode.live',
    pathname: '/embed',
    search: `?sdn_auth_popup_callback=v1&sdn_auth_nonce=${nonce}`,
  },
  opener: callbackOpener,
  document: { getElementById: () => callbackStatus },
  history: {
    state: null,
    replaceState(_state, _unused, url) { clearedCallbackUrl = url },
  },
  setTimeout: () => 1,
  clearTimeout: () => {},
  addEventListener(type, listener) { callbackListeners.set(type, listener) },
  close() { callbackClosed = true },
}
runOAuthPopupCallback(callbackTarget)
assert.equal(clearedCallbackUrl, `/embed?sdn_auth_popup_callback=v1&sdn_auth_nonce=${nonce}`)
assert.deepEqual(callbackMessages, [{
  message: trustedResult,
  targetOrigin: 'https://social.datanode.live',
}])
assert.equal(callbackClosed, false)
callbackListeners.get('message')({
  origin: 'https://social.datanode.live',
  source: callbackOpener,
  data: acknowledgement,
})
assert.equal(callbackClosed, true)

const standaloneCalls = []
const standaloneResult = await beginGoogleOAuth({
  embedded: false,
  redirectTo: 'https://social.datanode.live/?sdn_auth_return=board',
  openPopup: () => assert.fail('Standalone OAuth must not open a popup.'),
  signIn: async (options) => {
    standaloneCalls.push(options)
    return { data: { url: null }, error: null }
  },
})
assert.deepEqual(standaloneCalls, [{
  redirectTo: 'https://social.datanode.live/?sdn_auth_return=board',
  skipBrowserRedirect: false,
}])
assert.deepEqual(standaloneResult, { error: null })

const popup = {
  closed: false,
  close() { this.closed = true },
  location: { href: 'about:blank' },
}
const embeddedCalls = []
const embeddedResult = await beginGoogleOAuth({
  embedded: true,
  redirectTo: 'https://social.datanode.live/embed?sdn_auth_return=board',
  openPopup: () => popup,
  signIn: async (options) => {
    embeddedCalls.push(options)
    return { data: { url: 'https://accounts.google.com/example' }, error: null }
  },
})
assert.deepEqual(embeddedCalls, [{
  redirectTo: 'https://social.datanode.live/embed?sdn_auth_return=board',
  skipBrowserRedirect: true,
}])
assert.equal(popup.location.href, 'https://accounts.google.com/example')
assert.deepEqual(embeddedResult, { error: null })

let blockedSignInCalled = false
assert.deepEqual(await beginGoogleOAuth({
  embedded: true,
  redirectTo: 'https://social.datanode.live/embed?sdn_auth_return=board',
  openPopup: () => null,
  signIn: async () => {
    blockedSignInCalled = true
    return { data: { url: null }, error: null }
  },
}), { error: 'Allow popups to continue with Google.' })
assert.equal(blockedSignInCalled, false)

const failedPopup = {
  closed: false,
  close() { this.closed = true },
  location: { href: 'about:blank' },
}
assert.deepEqual(await beginGoogleOAuth({
  embedded: true,
  redirectTo: 'https://social.datanode.live/embed?sdn_auth_return=board',
  openPopup: () => failedPopup,
  signIn: async () => ({ data: { url: null }, error: { message: 'OAuth unavailable.' } }),
}), { error: 'OAuth unavailable.' })
assert.equal(failedPopup.closed, true)

console.log('Embedded Google OAuth preserves standalone redirects and uses a guarded popup.')
