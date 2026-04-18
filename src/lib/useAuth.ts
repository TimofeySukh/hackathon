import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './supabase'
import { ensureUserWorkspace, type UserBoard } from './userWorkspace'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unconfigured'

type AuthState = {
  session: Session | null
  board: UserBoard | null
  status: AuthStatus
  error: string | null
}

const getStatus = (session: Session | null): AuthStatus => (session ? 'authenticated' : 'anonymous')

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => ({
    session: null,
    board: null,
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
            board: null,
            status: 'anonymous',
            error: null,
          })
        }
        return
      }

      try {
        const board = await ensureUserWorkspace(session.user)

        if (isMounted) {
          setAuthState({
            session,
            board,
            status: getStatus(session),
            error: null,
          })
        }
      } catch (error) {
        if (isMounted) {
          setAuthState({
            session,
            board: null,
            status: getStatus(session),
            error: error instanceof Error ? error.message : 'Unable to load account workspace.',
          })
        }
      }
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return

      if (error) {
        setAuthState({
          session: null,
          board: null,
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
