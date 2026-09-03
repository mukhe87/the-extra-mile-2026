import { useEffect, useState } from 'react'
import { fetchLeaderboard, subscribeLeaderboard, type LeaderboardEntry } from '../lib/scores'
import { supabaseReady } from '../lib/supabase'

// Live leaderboard for one game. Re-fetches whenever a new score for this game
// is inserted (Supabase Realtime).
export default function Leaderboard({
  gameSlug,
  scoreLabel,
  highlight,
}: {
  gameSlug: string
  scoreLabel: string
  highlight?: { firstName: string; lastName: string }
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = () => {
      fetchLeaderboard(gameSlug)
        .then((rows) => {
          if (active) {
            setEntries(rows)
            setError(null)
          }
        })
        .catch((e) => {
          if (active) setError(e?.message ? String(e.message) : 'Could not reach the leaderboard.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    load()
    const unsub = subscribeLeaderboard(gameSlug, load)
    return () => {
      active = false
      unsub()
    }
  }, [gameSlug])

  if (!supabaseReady) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-seven-dark/60">
        Leaderboard connects once Supabase is configured (see README).
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow">
      <div className="road-strip h-2" />
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className="font-display text-lg">Leaderboard</h3>
        <span className="flex items-center gap-1 text-xs font-bold uppercase text-seven-green">
          <span className="h-2 w-2 animate-pulse rounded-full bg-seven-green" /> Live
        </span>
      </div>
      {loading ? (
        <p className="px-5 pb-5 text-sm text-seven-dark/60">Loading…</p>
      ) : error ? (
        <div className="px-5 pb-5 text-sm">
          <p className="font-bold text-seven-red">Couldn’t load the leaderboard.</p>
          <p className="mt-1 text-seven-dark/60">
            The database is reachable from the internet, so this is usually a network or
            browser-extension block on this device. Details: <span className="font-mono">{error}</span>
          </p>
        </div>
      ) : entries.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-seven-dark/60">
          No scores yet — be the first to go the Extra Mile.
        </p>
      ) : (
        <ol className="divide-y divide-seven-dark/5">
          {entries.map((e) => {
            const isMe =
              highlight &&
              e.firstName.toLowerCase() === highlight.firstName.toLowerCase() &&
              e.lastName.toLowerCase() === highlight.lastName.toLowerCase()
            return (
              <li
                key={`${e.firstName}-${e.lastName}-${e.rank}`}
                className={`flex items-center gap-3 px-5 py-2.5 ${
                  isMe ? 'bg-seven-orange/10' : ''
                }`}
              >
                <span className="w-6 text-right font-display text-seven-orange">{e.rank}</span>
                <span className="flex-1 truncate">
                  {e.firstName} {e.lastName}
                </span>
                <span className="font-bold">
                  {e.score.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-seven-dark/50">{scoreLabel}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
