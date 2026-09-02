import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  fetchAllScores,
  rankBestPerPlayer,
  overallStandings,
  type ScoreRow,
} from '../lib/scores'
import { GAMES } from '../games/registry'

// A single shared password gates this page. This is a light gate appropriate to
// an internal event — it hides the export from casual visitors, not a hardened
// auth boundary. See README "Security notes".
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

type Summary = { players: number; plays: number; games: number }

export default function Admin() {
  const [entered, setEntered] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)

  const unlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (ADMIN_PASSWORD && entered === ADMIN_PASSWORD) {
      setOk(true)
      loadSummary()
    } else setError('Incorrect password.')
  }

  const loadSummary = async () => {
    try {
      const rows = await fetchAllScores()
      const players = new Set(rows.map((r) => `${r.first_name} ${r.last_name}`.toLowerCase())).size
      const games = new Set(rows.map((r) => r.game_slug)).size
      setSummary({ players, plays: rows.length, games })
    } catch {
      /* leave summary null; export still works or reports its own error */
    }
  }

  const exportXlsx = async () => {
    setBusy(true)
    setError(null)
    try {
      const rows = await fetchAllScores()
      const wb = XLSX.utils.book_new()

      // Sheet 1: overall standings (sum of best-per-game), the event winner view.
      const overall = overallStandings(rows).map((e) => ({
        Rank: e.rank,
        'First Name': e.firstName,
        'Last Name': e.lastName,
        'Total Points': e.totalBest,
        'Games Played': e.gamesPlayed,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overall), 'Overall')

      // Sheet 2: every submission, raw.
      const allSheet = XLSX.utils.json_to_sheet(
        rows.map((r: ScoreRow) => ({
          Game: GAMES[r.game_slug]?.title ?? r.game_slug,
          'First Name': r.first_name,
          'Last Name': r.last_name,
          Score: r.score,
          'Submitted (UTC)': r.created_at,
        })),
      )
      XLSX.utils.book_append_sheet(wb, allSheet, 'All Scores')

      // One ranked sheet per game (best score per player).
      for (const slug of Object.keys(GAMES)) {
        const gameRows = rows.filter((r) => r.game_slug === slug)
        if (gameRows.length === 0) continue
        const ranked = rankBestPerPlayer(gameRows).map((e) => ({
          Rank: e.rank,
          'First Name': e.firstName,
          'Last Name': e.lastName,
          'Best Score': e.score,
        }))
        const name = (GAMES[slug]?.title ?? slug).slice(0, 31)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ranked), name)
      }

      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `extra-mile-leaderboard-${stamp}.xlsx`)
    } catch {
      setError('Export failed. Is Supabase configured?')
    } finally {
      setBusy(false)
    }
  }

  if (!ADMIN_PASSWORD) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Set <code>VITE_ADMIN_PASSWORD</code> to enable the admin export.
      </div>
    )
  }

  if (!ok) {
    return (
      <form onSubmit={unlock} className="mx-auto max-w-sm rounded-2xl bg-white p-8 shadow">
        <h1 className="mb-4 font-display text-2xl">Admin</h1>
        <input
          type="password"
          value={entered}
          onChange={(e) => setEntered(e.target.value)}
          placeholder="Admin password"
          className="mb-3 w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-orange focus:outline-none"
        />
        {error && <p className="mb-3 text-sm text-seven-red">{error}</p>}
        <button className="w-full rounded-full bg-seven-dark px-6 py-3 font-bold text-white">
          Unlock
        </button>
      </form>
    )
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow">
      <h1 className="mb-2 font-display text-2xl">Leaderboard export</h1>
      <p className="mb-6 text-sm text-seven-dark/70">
        Download an Excel workbook: an <strong>Overall</strong> standings sheet (the event
        winner view), an <strong>All Scores</strong> sheet, and a ranked sheet per game.
      </p>

      {summary && (
        <div className="mb-6 grid grid-cols-3 gap-3 text-center">
          <Stat label="Players" value={summary.players} />
          <Stat label="Total plays" value={summary.plays} />
          <Stat label="Games played" value={summary.games} />
        </div>
      )}

      {error && <p className="mb-3 text-sm text-seven-red">{error}</p>}
      <button
        onClick={exportXlsx}
        disabled={busy}
        className="rounded-full bg-seven-green px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? 'Building workbook…' : 'Download .xlsx'}
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-seven-cream p-3">
      <div className="font-display text-2xl text-seven-orange">{value}</div>
      <div className="text-xs text-seven-dark/60">{label}</div>
    </div>
  )
}
