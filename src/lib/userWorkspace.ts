import type { User } from '@supabase/supabase-js'

import { supabase } from './supabase'

export type UserBoard = {
  id: string
  user_id: string
  title: string
}

const getDisplayName = (user: User) => {
  const metadata = user.user_metadata
  return (
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    user.email?.split('@')[0] ||
    null
  )
}

export async function ensureUserWorkspace(user: User): Promise<UserBoard | null> {
  if (!supabase) return null

  const metadata = user.user_metadata
  const profileResult = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    display_name: getDisplayName(user),
    avatar_url: metadata.avatar_url || metadata.picture || null,
  })

  if (profileResult.error) {
    throw profileResult.error
  }

  const boardInsertResult = await supabase.from('boards').insert({
    user_id: user.id,
    title: 'Personal board',
  })

  if (boardInsertResult.error && boardInsertResult.error.code !== '23505') {
    throw boardInsertResult.error
  }

  const { data, error } = await supabase
    .from('boards')
    .select('id, user_id, title')
    .eq('user_id', user.id)
    .single()

  if (error) {
    throw error
  }

  return data
}
