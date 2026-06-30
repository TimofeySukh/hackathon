import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { e2eFakeAccessToken, e2eFakeUserId, isE2EFakeAuth, supabase } from './supabase'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unconfigured'

type AuthState = {
  session: Session | null
  status: AuthStatus
  error: string | null
  isPasswordRecovery: boolean
}

const getStatus = (session: Session | null): AuthStatus => (session ? 'authenticated' : 'anonymous')
const AUTH_RETURN_HASH_KEY = 'sdn.authReturnHash'
const AUTH_RETURN_EXPIRES_KEY = 'sdn.authReturnHashExpiresAt'
const AUTH_RETURN_TTL_MS = 10 * 60 * 1000

function getAuthRedirectUrl() {
  return window.location.origin + window.location.pathname
}

function readAuthReturnHash() {
  const expiresAt = Number(window.sessionStorage.getItem(AUTH_RETURN_EXPIRES_KEY) || 0)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    window.sessionStorage.removeItem(AUTH_RETURN_HASH_KEY)
    window.sessionStorage.removeItem(AUTH_RETURN_EXPIRES_KEY)
    return null
  }

  const hash = window.sessionStorage.getItem(AUTH_RETURN_HASH_KEY)
  return hash?.startsWith('#') ? hash : null
}

export function hasPendingBoardAuthReturn() {
  return readAuthReturnHash() === '#board'
}

function rememberBoardAuthReturn() {
  window.sessionStorage.setItem(AUTH_RETURN_HASH_KEY, '#board')
  window.sessionStorage.setItem(AUTH_RETURN_EXPIRES_KEY, String(Date.now() + AUTH_RETURN_TTL_MS))
}

export function consumeAuthReturnHash() {
  const hash = readAuthReturnHash()
  window.sessionStorage.removeItem(AUTH_RETURN_HASH_KEY)
  window.sessionStorage.removeItem(AUTH_RETURN_EXPIRES_KEY)
  return hash
}

function createE2EFakeSession(): Session {
  const nowIso = new Date().toISOString()
  return {
    access_token: e2eFakeAccessToken,
    refresh_token: 'local-e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: e2eFakeUserId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'local-e2e@example.invalid',
      email_confirmed_at: nowIso,
      phone: '',
      app_metadata: {},
      user_metadata: { full_name: 'Local E2E User' },
      identities: [],
      created_at: nowIso,
      updated_at: nowIso,
    },
  } as Session
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => ({
    session: isE2EFakeAuth ? createE2EFakeSession() : null,
    status: isE2EFakeAuth ? 'authenticated' : supabase ? 'loading' : 'unconfigured',
    error: null,
    isPasswordRecovery: false,
  }))

  useEffect(() => {
    if (isE2EFakeAuth) return undefined
    if (!supabase) return undefined

    let isMounted = true
    let latestAuthenticatedSession: Session | null = null

    const loadWorkspace = async (session: Session | null) => {
      if (session?.user) {
        latestAuthenticatedSession = session
      } else if (latestAuthenticatedSession) {
        return
      }

      if (!session?.user) {
        if (isMounted) {
          setAuthState({
            session: null,
            status: 'anonymous',
            error: null,
            isPasswordRecovery: false,
          })
        }
        return
      }

      if (isMounted) {
        setAuthState((current) => ({
          session,
          status: getStatus(session),
          error: null,
          isPasswordRecovery: current.isPasswordRecovery,
        }))
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        latestAuthenticatedSession = null
        void loadWorkspace(null)
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        setAuthState((current) => ({
          ...current,
          session,
          status: getStatus(session),
          error: null,
          isPasswordRecovery: true,
        }))
        return
      }

      void loadWorkspace(session)
    })

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return

      if (error) {
        setAuthState({
          session: null,
          status: 'anonymous',
          error: error.message,
          isPasswordRecovery: false,
        })
        return
      }

      void loadWorkspace(data.session)
    }).catch((err) => {
      if (!isMounted) return
      console.error('Failed to get session:', err)
      setAuthState({
        session: null,
        status: 'anonymous',
        error: err instanceof Error ? err.message : String(err),
        isPasswordRecovery: false,
      })
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    if (!supabase) return

    rememberBoardAuthReturn()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: 'Auth is not configured.' as string | null }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
      return { error: error.message }
    }

    rememberBoardAuthReturn()
    return { error: null }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) {
      return { error: 'Auth is not configured.' as string | null, needsConfirmation: false, alreadyRegistered: false }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
      return { error: error.message, needsConfirmation: false, alreadyRegistered: false }
    }

    // To prevent email enumeration, Supabase returns a fake user with an empty
    // `identities` array when the address already belongs to a confirmed account.
    // We treat that as "already registered" so we can steer the user to sign in.
    const alreadyRegistered = Boolean(data.user && (data.user.identities?.length ?? 0) === 0)

    // When email confirmation is required, Supabase returns a user but no session.
    const needsConfirmation = Boolean(data.user && !data.session && !alreadyRegistered)

    if (data.session) {
      rememberBoardAuthReturn()
    }

    return { error: null, needsConfirmation, alreadyRegistered }
  }

  const resendConfirmation = async (email: string) => {
    if (!supabase) return { error: 'Auth is not configured.' as string | null }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    })

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  }

  const sendPasswordReset = async (email: string) => {
    if (!supabase) return { error: 'Auth is not configured.' as string | null }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl(),
    })

    if (error) {
      return { error: error.message }
    }

    return { error: null }
  }

  const updatePassword = async (password: string) => {
    if (!supabase) return { error: 'Auth is not configured.' as string | null }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
      return { error: error.message }
    }

    rememberBoardAuthReturn()
    setAuthState((currentState) => ({ ...currentState, error: null, isPasswordRecovery: false }))
    return { error: null }
  }

  const dismissPasswordRecovery = () => {
    setAuthState((currentState) => ({ ...currentState, isPasswordRecovery: false }))
  }

  const clearError = () => {
    setAuthState((currentState) => ({ ...currentState, error: null }))
  }

  const signOut = async () => {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
    } else {
      consumeAuthReturnHash()
    }
  }

  return {
    ...authState,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
    dismissPasswordRecovery,
    clearError,
    signOut,
  }
}
