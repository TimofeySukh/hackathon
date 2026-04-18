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
    signOut,
  }
}
