import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// A single shared client. When env vars are missing (e.g. a fresh checkout
// before Supabase is wired), we expose `null` and the UI degrades to a clear
// "leaderboard not configured yet" state instead of crashing.

// Sanitize the project URL. The dashboard shows several URLs (Project URL, the
// "Data API" URL that ends in /rest/v1, etc.), and it's easy to paste one that
// already carries a path or a trailing slash. supabase-js then appends its own
// /rest/v1, producing a doubled, invalid path (PGRST125 "Invalid path specified
// in request URL") that breaks every read and write. Strip any trailing slash
// and any accidental service-path suffix so only the bare origin reaches the
// client — e.g. "https://abc.supabase.co/rest/v1/" -> "https://abc.supabase.co".
function cleanSupabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined
  let u = raw.trim().replace(/\/+$/, '')
  u = u.replace(/\/(rest|auth|storage|realtime|functions)\/v1$/i, '')
  return u.replace(/\/+$/, '') || undefined
}

const url = cleanSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabaseReady = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = supabaseReady
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
    })
  : null
