import { supabase } from './supabase'
import type { Profile } from './profile'

// One row per score submission. The leaderboard is derived by ranking these.
// profile_id ties the row to a Player Pass so two same-named players never
// collide; first/last name are kept for display and legacy rows.
export type ScoreRow = {
  id: string
  game_slug: string
  first_name: string
  last_name: string
  score: number
  created_at: string
  profile_id?: string | null
}

export type LeaderboardEntry = {
  rank: number
  profileId?: string | null
  firstName: string
  lastName: string
  score: number
  createdAt: string
}

/**
 * Display labels that keep same-named players apart. When two distinct players
 * share a name, the 2nd, 3rd, … get a "(2)", "(3)" suffix so viewers can tell
 * them apart on the board (their scores are already separate via profile_id).
 */
export function displayLabels(
  rows: Array<{ firstName: string; lastName: string }>,
): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = `${r.firstName} ${r.lastName}`.trim()
    const key = base.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

/** Submit a score. Returns the inserted row, or null if Supabase isn't wired. */
export async function submitScore(
  gameSlug: string,
  player: Profile,
  score: number,
): Promise<ScoreRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('scores')
    .insert({
      game_slug: gameSlug,
      first_name: player.firstName,
      last_name: player.lastName,
      score: Math.round(score),
      profile_id: player.id,
    })
    .select()
    .single()
  if (error) throw error
  return data as ScoreRow
}

/**
 * Fetch the ranked leaderboard for a game: each player's best score, highest
 * first. Ranking is done client-side over the top rows so the same logic works
 * whether or not a DB view exists yet.
 */
export async function fetchLeaderboard(
  gameSlug: string,
  limit = 25,
): Promise<LeaderboardEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('scores')
    .select('first_name,last_name,score,created_at,profile_id')
    .eq('game_slug', gameSlug)
    .order('score', { ascending: false })
    .limit(500)
  if (error) throw error
  return rankBestPerPlayer((data ?? []) as ScoreRow[]).slice(0, limit)
}

/** Collapse to each player's best score, then rank. */
export function rankBestPerPlayer(rows: ScoreRow[]): LeaderboardEntry[] {
  const best = new Map<string, ScoreRow>()
  for (const r of rows) {
    // Identify by profile (Player Pass) when present so two same-named people
    // stay separate; rows without a profile fall back to name.
    const key = r.profile_id ?? `name:${r.first_name} ${r.last_name}`.toLowerCase()
    const cur = best.get(key)
    if (!cur || r.score > cur.score) best.set(key, r)
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at))
    .map((r, i) => ({
      rank: i + 1,
      profileId: r.profile_id ?? null,
      firstName: r.first_name,
      lastName: r.last_name,
      score: r.score,
      createdAt: r.created_at,
    }))
}

/**
 * Subscribe to live leaderboard changes for a game. Calls `onChange` whenever a
 * new score for this game lands. Returns an unsubscribe function.
 */
export function subscribeLeaderboard(gameSlug: string, onChange: () => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  // Listen to ALL changes on the table (no column filter): a filtered DELETE
  // often omits non-key columns, so a scoreboard reset wouldn't reach a
  // game-filtered subscription. The component re-fetches on any change, so a
  // reset clears open boards live too.
  const channel = client
    .channel(`scores:${gameSlug}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => onChange())
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}

/**
 * Subscribe to ANY new score across all games (used by the home-page overall
 * board). Returns an unsubscribe function.
 */
export function subscribeAllScores(onChange: () => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client
    .channel('scores:all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => onChange())
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}

/** Fetch every score row (admin export). */
export async function fetchAllScores(): Promise<ScoreRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ScoreRow[]
}

/**
 * Reset the scoreboard by calling the server-side reset_scores function (see
 * supabase/reset-function.sql). Deletes all scores, or just one game's, and only
 * succeeds when the reset password matches the one stored in the DB function.
 * Returns the number of rows deleted.
 */
export async function resetScores(password: string, gameSlug?: string): Promise<number> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('reset_scores', {
    pw: password,
    game: gameSlug ?? null,
  })
  if (error) {
    // Friendlier messages for the common setup states.
    const code = (error as { code?: string }).code
    if (/reset password not set/i.test(error.message))
      throw new Error(
        'Reset password not set yet. In Supabase → Table Editor → app_config, type your admin password into the reset_password cell and Save, then try again.',
      )
    if (/unauthorized/i.test(error.message))
      throw new Error(
        'Wrong reset password — it must match the value in Supabase → Table Editor → app_config (reset_password).',
      )
    if (
      code === 'PGRST202' ||
      code === '42P01' ||
      /could not find|schema cache|function|relation .* does not exist/i.test(error.message)
    )
      throw new Error('Reset isn’t set up yet — run supabase/reset-function.sql once, then set the password in app_config.')
    throw error
  }
  return (data as number) ?? 0
}

export type OverallEntry = {
  rank: number
  firstName: string
  lastName: string
  totalBest: number // sum of each game's best score for this player
  gamesPlayed: number
}

/**
 * Overall standings across every game: for each player, sum their best score in
 * each game they played, then rank. This is how an "overall event winner" is
 * picked from the per-game leaderboards.
 */
export function overallStandings(rows: ScoreRow[]): OverallEntry[] {
  // player -> game -> best
  const byPlayer = new Map<string, { first: string; last: string; games: Map<string, number> }>()
  for (const r of rows) {
    // Same identity rule as the per-game board: profile first, name fallback.
    const key = r.profile_id ?? `name:${r.first_name} ${r.last_name}`.toLowerCase()
    let p = byPlayer.get(key)
    if (!p) {
      p = { first: r.first_name, last: r.last_name, games: new Map() }
      byPlayer.set(key, p)
    }
    const cur = p.games.get(r.game_slug) ?? 0
    if (r.score > cur) p.games.set(r.game_slug, r.score)
  }
  return [...byPlayer.values()]
    .map((p) => ({
      firstName: p.first,
      lastName: p.last,
      totalBest: [...p.games.values()].reduce((a, b) => a + b, 0),
      gamesPlayed: p.games.size,
    }))
    .sort((a, b) => b.totalBest - a.totalBest || b.gamesPlayed - a.gamesPlayed)
    .map((e, i) => ({ rank: i + 1, ...e }))
}
