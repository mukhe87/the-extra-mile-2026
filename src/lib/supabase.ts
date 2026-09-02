import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// A single shared client. When env vars are missing (e.g. a fresh checkout
// before Supabase is wired), we expose `null` and the UI degrades to a clear
// "leaderboard not configured yet" state instead of crashing.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseReady = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseReady
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
    })
  : null
