import assert from 'node:assert/strict'

import { beginGoogleOAuth, isEmbeddedContext } from '../src/lib/embeddedAuth.ts'

const sharedWindow = {}
assert.equal(isEmbeddedContext({ self: sharedWindow, top: sharedWindow }), false)
assert.equal(isEmbeddedContext({ self: {}, top: {} }), true)

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
