import { useEffect, useRef, useState } from 'react'

type GoogleCredentialResponse = {
  credential?: string
  select_by?: string
}

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
    },
  ) => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId
      }
    }
  }
}

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

type GoogleIdentityButtonProps = {
  clientId: string | undefined
  onCredential: (credential: string) => void
  onFallbackClick: () => void
}

export function GoogleIdentityButton({ clientId, onCredential, onFallbackClick }: GoogleIdentityButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scriptFailed, setScriptFailed] = useState(false)

  useEffect(() => {
    if (!clientId) return undefined

    let cancelled = false

    const renderButton = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return

      containerRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            onCredential(response.credential)
          }
        },
        ux_mode: 'popup',
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 256,
      })
    }

    const existingScript = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null

    if (window.google?.accounts?.id) {
      renderButton()
      return () => {
        cancelled = true
      }
    }

    const script = existingScript ?? document.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = renderButton
    script.onerror = () => {
      if (!cancelled) setScriptFailed(true)
    }

    if (!existingScript) {
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
    }
  }, [clientId, onCredential])

  if (!clientId || scriptFailed) {
    return (
      <button type="button" className="m3-primary-button" onClick={onFallbackClick}>
        Continue with Google
      </button>
    )
  }

  return <div ref={containerRef} className="google-identity-button" />
}
