import { useEffect, useState } from 'react'
import {
  fetchAllScores,
  overallStandings,
  subscribeAllScores,
  displayLabels,
  type OverallEntry,
} from '../lib/scores'
import { supabaseReady } from '../lib/supabase'

// The home-page board: overall event standings (each player's summed best score
// per game), top N, updating live as scores land across any game.
export default function OverallLeaderboard({ limit = 10 }: { limit?: number }) {
  const [rows, setRows] = useState<OverallEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = () => {
      fetchAllScores()
        .then((all) => {
          if (active) {
            setRows(overallStandings(all).slice(0, limit))
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
    const unsub = subscribeAllScores(load)
    return () => {
      active = false
      unsub()
    }
  }, [limit])

  if (!supabaseReady) return null

  const labels = displayLabels(rows)

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow">
      <div className="road-strip h-2" />
      <div className="flex items-center justify-between px-5 py-3">
        <h2 className="font-display text-xl">Overall standings</h2>
        <span className="flex items-center gap-1 text-xs font-bold uppercase text-seven-green">
          <span className="h-2 w-2 animate-pulse rounded-full bg-seven-green" /> Live
        </span>
      </div>
      {loading ? (
        <p className="px-5 pb-5 text-sm text-seven-dark/60">Loading…</p>
      ) : error ? (
        <div className="px-5 pb-5 text-sm">
          <p className="font-bold text-seven-red">Couldn’t load standings.</p>
          <p className="mt-1 text-seven-dark/60">
            The database is reachable from the internet, so this is usually a network or
            browser-extension block on this device. Details: <span className="font-mono">{error}</span>
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-seven-dark/60">
          No scores yet — play today’s games to get on the board.
        </p>
      ) : (
        <ol className="divide-y divide-seven-dark/5">
          {rows.map((e, i) => (
            <li key={`${e.firstName}-${e.lastName}-${e.rank}`} className="flex items-center gap-3 px-5 py-2.5">
              <span className="w-6 text-right font-display text-seven-orange">{e.rank}</span>
              <span className="flex-1 truncate">{labels[i]}</span>
              <span className="text-xs text-seven-dark/45">{e.gamesPlayed} game{e.gamesPlayed === 1 ? '' : 's'}</span>
              <span className="w-20 text-right font-bold tabular-nums">{e.totalBest.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
