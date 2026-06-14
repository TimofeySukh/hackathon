import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './supabase'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unconfigured'

type AuthState = {
  session: Session | null
  status: AuthStatus
  error: string | null
}

const getStatus = (session: Session | null): AuthStatus => (session ? 'authenticated' : 'anonymous')

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => ({
    session: null,
    status: supabase ? 'loading' : 'unconfigured',
    error: null,
  }))

  useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true

    const loadWorkspace = async (session: Session | null) => {
      if (!session?.user) {
        if (isMounted) {
          setAuthState({
            session: null,
            status: 'anonymous',
            error: null,
          })
        }
        return
      }

      if (isMounted) {
        setAuthState({
          session,
          status: getStatus(session),
          error: null,
        })
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return

      if (error) {
        setAuthState({
          session: null,
          status: 'anonymous',
          error: error.message,
        })
        return
      }

      void loadWorkspace(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadWorkspace(session)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    if (!supabase) return

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
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
        emailRedirectTo: window.location.origin,
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

    return { error: null, needsConfirmation, alreadyRegistered }
  }

  const resendConfirmation = async (email: string) => {
    if (!supabase) return { error: 'Auth is not configured.' as string | null }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
      return { error: error.message }
    }

    return { error: null }
  }

  const signOut = async () => {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      setAuthState((currentState) => ({ ...currentState, error: error.message }))
    }
  }

  return {
    ...authState,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    signOut,
  }
}
