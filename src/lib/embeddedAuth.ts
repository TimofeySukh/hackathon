type WindowRelationship = {
  self: unknown
  top: unknown
}

type OAuthPopup = {
  close: () => void
  location: {
    href: string
  }
}

type OAuthResult = {
  data: {
    url: string | null
  }
  error: {
    message: string
  } | null
}

type BeginGoogleOAuthOptions = {
  embedded: boolean
  redirectTo: string
  openPopup: () => OAuthPopup | null
  signIn: (options: { redirectTo: string; skipBrowserRedirect: boolean }) => Promise<OAuthResult>
}

type CloseGoogleOAuthPopupOptions = {
  authenticated: boolean
  embedded?: boolean
  url?: string
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  now?: number
  close?: () => void
}

const AUTH_POPUP_SEARCH_PARAM = 'sdn_auth_popup'
const GOOGLE_AUTH_POPUP_VALUE = 'google'
const GOOGLE_AUTH_POPUP_STORAGE_KEY = 'sdn.googleOAuthPopupExpiresAt'
const GOOGLE_AUTH_POPUP_TTL_MS = 10 * 60 * 1000

export function isEmbeddedContext(target: WindowRelationship = window) {
  return target.self !== target.top
}

export function addGoogleOAuthPopupMarker(redirectTo: string, embedded: boolean) {
  if (!embedded) return redirectTo

  const url = new URL(redirectTo)
  url.searchParams.set(AUTH_POPUP_SEARCH_PARAM, GOOGLE_AUTH_POPUP_VALUE)
  return url.toString()
}

export function rememberGoogleOAuthPopup(
  storage: Pick<Storage, 'setItem'> = window.sessionStorage,
  now = Date.now(),
) {
  try {
    storage.setItem(GOOGLE_AUTH_POPUP_STORAGE_KEY, String(now + GOOGLE_AUTH_POPUP_TTL_MS))
  } catch {
    // The URL marker remains available when sessionStorage is blocked.
  }
}

export function clearGoogleOAuthPopupMarker(
  storage: Pick<Storage, 'removeItem'> = window.sessionStorage,
) {
  try {
    storage.removeItem(GOOGLE_AUTH_POPUP_STORAGE_KEY)
  } catch {
    // Ignore storage access errors.
  }
}

function hasStoredGoogleOAuthPopupMarker(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  now: number,
) {
  try {
    const expiresAt = Number(storage.getItem(GOOGLE_AUTH_POPUP_STORAGE_KEY) || 0)
    if (Number.isFinite(expiresAt) && expiresAt > now) return true
    storage.removeItem(GOOGLE_AUTH_POPUP_STORAGE_KEY)
  } catch {
    // The URL marker remains available when sessionStorage is blocked.
  }
  return false
}

export function closeGoogleOAuthPopupAfterSignIn({
  authenticated,
  embedded = isEmbeddedContext(),
  url = window.location.href,
  storage = window.sessionStorage,
  now = Date.now(),
  close = () => window.close(),
}: CloseGoogleOAuthPopupOptions) {
  if (!authenticated || embedded) return false

  const callbackUrl = new URL(url)
  const hasUrlMarker = callbackUrl.searchParams.get(AUTH_POPUP_SEARCH_PARAM) === GOOGLE_AUTH_POPUP_VALUE
  const hasStorageMarker = hasStoredGoogleOAuthPopupMarker(storage, now)
  if (!hasUrlMarker && !hasStorageMarker) {
    return false
  }

  clearGoogleOAuthPopupMarker(storage)
  close()
  return true
}

export async function beginGoogleOAuth({
  embedded,
  redirectTo,
  openPopup,
  signIn,
}: BeginGoogleOAuthOptions): Promise<{ error: string | null }> {
  const popup = embedded ? openPopup() : null
  if (embedded && !popup) return { error: 'Allow popups to continue with Google.' }

  try {
    const { data, error } = await signIn({
      redirectTo,
      skipBrowserRedirect: embedded,
    })

    if (error) {
      popup?.close()
      return { error: error.message }
    }

    if (embedded && popup) {
      if (!data.url) {
        popup.close()
        return { error: 'Google sign-in did not provide a redirect URL.' }
      }
      popup.location.href = data.url
    }

    return { error: null }
  } catch (error) {
    popup?.close()
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
