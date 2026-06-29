import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabasePublishableKey = supabaseKey
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const isE2EFakeAuth =
  import.meta.env.DEV && import.meta.env.VITE_E2E_FAKE_AUTH === 'true'
export const e2eFakeUserId = import.meta.env.VITE_E2E_FAKE_USER_ID || 'local-e2e-user'
export const e2eFakeAccessToken = import.meta.env.VITE_E2E_FAKE_ACCESS_TOKEN || 'local-e2e-token'

export function getSupabaseFunctionUrl(functionName: string) {
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`
}

export function getSupabaseRestUrl(path: string) {
  if (!supabaseUrl) return null
  const normalizedPath = path.replace(/^\/+/, '')
  return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${normalizedPath}`
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
