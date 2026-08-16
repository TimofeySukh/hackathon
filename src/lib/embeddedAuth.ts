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

export function isEmbeddedContext(target: WindowRelationship = window) {
  return target.self !== target.top
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
