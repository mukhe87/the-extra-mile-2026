import { supabase } from './supabase'

// License Plate Challenge — collect all 50 states by scanning codes hidden
// around campus. What each code is "worth" rotates on the server (see
// supabase/license-plate-hunt.sql); this module is the thin client over it.

export type StateInfo = { code: string; name: string }

// The 50 states, in the SAME order the SQL function uses. This drives the
// collection grid; the server returns the actual state_code on a scan.
export const STATES: StateInfo[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

export const TOTAL_STATES = STATES.length // 50
export const stateName = (code: string): string =>
  STATES.find((s) => s.code === code)?.name ?? code

export type ScanResult =
  | { result: 'collected'; state: string; name: string; total: number }
  | { result: 'already_have'; state: string; name: string; total: number }
  | { result: 'dud'; total: number }
  | { result: 'cooldown'; total: number; retry_at?: string }
  | { result: 'blocked'; total: number }
  | { result: 'invalid' }
  | { result: 'unknown_player' }

/**
 * Pull a code id out of whatever the scanner/upload produced. A QR may encode a
 * bare code ("LP-7K2P"), or a URL that contains it. Returns '' if none found.
 */
export function normalizeCode(input: string): string {
  const raw = (input || '').toUpperCase()
  const m = raw.match(/LP[-\s]?([A-Z0-9]{4})/)
  if (m) return `LP-${m[1]}`
  // Bare 4-char code typed without the prefix.
  const bare = raw.replace(/[^A-Z0-9]/g, '')
  if (/^[A-Z0-9]{4}$/.test(bare)) return `LP-${bare}`
  return ''
}

/** Scan/redeem a code for a player. Throws only on a transport/RPC error. */
export async function scanCode(profileId: string, code: string): Promise<ScanResult> {
  const normalized = normalizeCode(code)
  if (!normalized) return { result: 'invalid' }
  if (!supabase) throw new Error('Scanning needs the live site.')
  const { data, error } = await supabase.rpc('hunt_scan', {
    p_profile_id: profileId,
    p_code: normalized,
  })
  if (error) {
    const c = (error as { code?: string }).code
    if (
      c === 'PGRST202' ||
      /could not find|schema cache|function .* does not exist/i.test(error.message)
    )
      throw new Error(
        'The License Plate Challenge isn’t set up yet — run supabase/license-plate-hunt.sql once.',
      )
    throw error
  }
  return data as ScanResult
}

/** The set of state codes a player has collected (for the grid). */
export async function fetchMyCollection(profileId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('hunt_collection')
    .select('state_code')
    .eq('profile_id', profileId)
  if (error) throw error
  return (data ?? []).map((r) => (r as { state_code: string }).state_code)
}

export type HuntStanding = {
  profileId: string
  firstName: string
  lastName: string
  username: string
  states: number
  lastAt: string
  stateList: string[]
}

/** Ranked standings (most states, earliest to get there). */
export async function fetchStandings(limit = 200): Promise<HuntStanding[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('get_hunt_standings', { p_limit: limit })
  if (error) throw error
  return ((data ?? []) as Array<{
    profile_id: string
    first_name: string
    last_name: string
    username: string
    states: number
    last_at: string
    state_list: string[]
  }>).map((r) => ({
    profileId: r.profile_id,
    firstName: r.first_name,
    lastName: r.last_name,
    username: r.username,
    states: Number(r.states),
    lastAt: r.last_at,
    stateList: r.state_list ?? [],
  }))
}

/** Live updates: fires whenever any collection row changes (new claim / reset). */
export function subscribeHunt(onChange: () => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client
    .channel('hunt:collection')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hunt_collection' }, () =>
      onChange(),
    )
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}

/** Admin: the list of all printed code ids (for the printable tiles). */
export async function adminListCodes(password: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_codes', { pw: password })
  if (error) {
    if (/unauthorized/i.test(error.message))
      throw new Error('Wrong admin password (check Supabase → app_config → reset_password).')
    throw error
  }
  return (data ?? []) as string[]
}

/** Admin: wipe all hunt progress. Gated by the admin password server-side. */
export async function adminResetHunt(password: string): Promise<number> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_reset_hunt', { pw: password })
  if (error) {
    if (/unauthorized/i.test(error.message))
      throw new Error('Wrong admin password (check Supabase → app_config → reset_password).')
    throw error
  }
  return (data as number) ?? 0
}
