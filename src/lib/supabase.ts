import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
export const supabasePublishableKey = supabaseKey

export function getSupabaseFunctionUrl(functionName: string) {
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`
}

export function getSupabaseRestUrl(path: string) {
  if (!supabaseUrl) return null
  return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path.replace(/^\//, '')}`
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
