import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// Player identity — PIN-only sign-in. An account is a first + last name (for the
// leaderboard) plus a globally-unique 6-digit PIN that IS the login. No pass, no
// password. Forgot the PIN? An admin resets the account, issuing a 4-digit code
// (valid 24h) the player redeems to set a new PIN.

export type Profile = {
  id: string
  firstName: string
  lastName: string
}

// The signed-in session lives ONLY in memory — never persisted — so a refresh or
// a closed tab drops it and returns the player to the login page. An idle timer
// also ends the session after INACTIVITY_MS of no activity.
const INACTIVITY_MS = 15 * 60 * 1000

let current: Profile | null = null
let idleTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function armIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => signOut(), INACTIVITY_MS)
}

export function getProfile(): Profile | null {
  return current
}

/** Begin a session for this profile (called only after successful auth). */
export function signIn(p: Profile): void {
  current = p
  armIdleTimer()
  emit()
}

/** End the session (sign out, idle timeout, or lock). */
export function signOut(): void {
  current = null
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = undefined
  emit()
}

// Kept name for callers that "sign out" (e.g. the header button).
export const clearProfile = signOut

/** Reset the inactivity timer on user activity (no-op when signed out). */
export function touchSession(): void {
  if (current) armIdleTimer()
}

/** React hook: the current session profile, re-rendering on sign-in / sign-out. */
export function useProfile(): Profile | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getProfile,
    getProfile,
  )
}

export function fullName(p: Profile): string {
  return `${p.firstName} ${p.lastName}`.trim()
}

// A 6-digit login PIN.
export function normalizePin(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6)
}
export function isValidPin(input: string): boolean {
  return /^[0-9]{6}$/.test(input)
}
// A 4-digit admin-issued reset code.
export function normalizeResetCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 4)
}
export function isValidResetCode(input: string): boolean {
  return /^[0-9]{4}$/.test(input)
}

type ProfileRow = { id: string; first_name: string; last_name: string }
const fromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
})
const firstRow = (data: unknown): ProfileRow | null => {
  const row = (Array.isArray(data) ? data[0] : data) as ProfileRow | null
  return row && row.id ? row : null
}

/** Create an account (First + Last + unique 6-digit PIN). Returns the profile. */
export async function createProfile(first: string, last: string, pin: string): Promise<Profile> {
  const firstName = first.trim()
  const lastName = last.trim()
  if (!firstName || !lastName) throw new Error('First and last name are required.')
  if (!isValidPin(pin)) throw new Error('Pick a 6-digit PIN (numbers only).')

  if (!supabase) {
    // No backend (local dev): make a self-contained local profile.
    return { id: crypto.randomUUID(), firstName, lastName }
  }
  const { data, error } = await supabase.rpc('create_profile', {
    p_first: firstName,
    p_last: lastName,
    p_pin: pin,
  })
  if (error) throw new Error(friendlyRpcError(error))
  const row = firstRow(data)
  if (!row) throw new Error('Could not create your account — please try again.')
  return fromRow(row)
}

/** Sign in with a 6-digit PIN. Returns the profile, or null if none matches. */
export async function signInByPin(pin: string): Promise<Profile | null> {
  if (!isValidPin(pin)) throw new Error('Enter your 6-digit PIN.')
  if (!supabase) throw new Error('Signing in needs the live site.')
  const { data, error } = await supabase.rpc('get_profile_by_pin', { p_pin: pin })
  if (error) throw new Error(friendlyRpcError(error))
  const row = firstRow(data)
  return row ? fromRow(row) : null
}

/** Redeem an admin reset code and set a new 6-digit PIN. Returns the profile. */
export async function redeemResetCode(code: string, newPin: string): Promise<Profile> {
  if (!isValidResetCode(code)) throw new Error('Enter the 4-digit reset code from your admin.')
  if (!isValidPin(newPin)) throw new Error('Pick a new 6-digit PIN (numbers only).')
  if (!supabase) throw new Error('This needs the live site.')
  const { data, error } = await supabase.rpc('redeem_reset_code', { p_code: code, p_new_pin: newPin })
  if (error) throw new Error(friendlyRpcError(error))
  const row = firstRow(data)
  if (!row) throw new Error('That reset code is wrong or has expired. Ask your admin for a new one.')
  return fromRow(row)
}

// Friendlier messages for the common known states.
function friendlyRpcError(error: { code?: string; message: string }): string {
  const code = error.code
  if (/pin taken/i.test(error.message)) {
    return 'That PIN is already taken. Please choose a different 6-digit PIN.'
  }
  if (/invalid or expired code/i.test(error.message)) {
    return 'That reset code is wrong or has expired. Ask your admin for a new one.'
  }
  if (/unauthorized/i.test(error.message)) {
    return 'Admin password didn’t match the one in Supabase → app_config.'
  }
  if (/admin password not set/i.test(error.message)) {
    return 'Admin password isn’t set — add it in Supabase → Table Editor → app_config (reset_password).'
  }
  if (
    code === 'PGRST202' ||
    code === '42P01' ||
    /could not find|schema cache|function|relation .* does not exist/i.test(error.message)
  ) {
    return 'Profiles aren’t set up yet — run the profiles SQL once in Supabase, then try again.'
  }
  return error.message
}

// ---------------------------------------------------------------------------
// Admin player management (gated by the admin password server-side).
// ---------------------------------------------------------------------------

export type AdminProfile = {
  id: string
  firstName: string
  lastName: string
  createdAt: string
  scoreCount: number
  resetCode: string | null // active reset code, if a reset is pending
  resetExpiresAt: string | null
}

/** Search players by name (admin). Returns [] if not configured. */
export async function adminFindProfiles(pw: string, query: string): Promise<AdminProfile[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_find_profiles', { pw, q: query })
  if (error) throw new Error(friendlyRpcError(error))
  return ((data ?? []) as Array<{
    id: string
    first_name: string
    last_name: string
    created_at: string
    score_count: number
    reset_code: string | null
    reset_code_expires_at: string | null
  }>).map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    createdAt: r.created_at,
    scoreCount: Number(r.score_count),
    resetCode: r.reset_code,
    resetExpiresAt: r.reset_code_expires_at,
  }))
}

/**
 * Reset a player's account: issue a 4-digit code (valid 24h) to hand them.
 * Keeps all their data; the admin never sees or sets the PIN. Returns the code.
 */
export async function adminResetAccount(pw: string, profileId: string): Promise<string> {
  if (!supabase) throw new Error('This needs the live site.')
  const { data, error } = await supabase.rpc('admin_reset_account', { pw, p_id: profileId })
  if (error) throw new Error(friendlyRpcError(error))
  return String(data)
}

/** Delete a player's account AND all their data. Returns scores removed. */
export async function adminDeleteProfile(pw: string, profileId: string): Promise<number> {
  if (!supabase) throw new Error('This needs the live site.')
  const { data, error } = await supabase.rpc('admin_delete_profile', { pw, p_id: profileId })
  if (error) throw new Error(friendlyRpcError(error))
  return (data as number) ?? 0
}
