import type { User } from '@supabase/supabase-js'

import { supabase } from './supabase'
import type { Board, PersonNode } from './graphTypes'

export type UserWorkspace = {
  board: Board
  rootPerson: PersonNode
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

export async function ensureUserWorkspace(user: User): Promise<UserWorkspace> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

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
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    throw error
  }

  const board = data as Board
  const rootPersonResult = await supabase
    .from('people')
    .select('*')
    .eq('board_id', board.id)
    .eq('is_root', true)
    .maybeSingle()

  if (rootPersonResult.error) {
    throw rootPersonResult.error
  }

  if (rootPersonResult.data) {
    return {
      board,
      rootPerson: rootPersonResult.data as PersonNode,
    }
  }

  const rootInsertResult = await supabase
    .from('people')
    .insert({
      board_id: board.id,
      owner_user_id: user.id,
      name: getDisplayName(user) ?? 'You',
      x: 0,
      y: 0,
      is_root: true,
    })
    .select('*')
    .single()

  if (rootInsertResult.error) {
    throw rootInsertResult.error
  }

  return {
    board,
    rootPerson: rootInsertResult.data as PersonNode,
  }
}
