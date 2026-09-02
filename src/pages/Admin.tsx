import { useState } from 'react'
import * as XLSX from 'xlsx'
import { fetchAllScores } from '../lib/scores'
import { rankBestPerPlayer, type ScoreRow } from '../lib/scores'
import { GAMES } from '../games/registry'

// A single shared password gates this page. This is a light gate appropriate to
// an internal event — it hides the export from casual visitors, not a hardened
// auth boundary. See README "Security notes".
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

export default function Admin() {
  const [entered, setEntered] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (ADMIN_PASSWORD && entered === ADMIN_PASSWORD) setOk(true)
    else setError('Incorrect password.')
  }

  const exportXlsx = async () => {
    setBusy(true)
    setError(null)
    try {
      const rows = await fetchAllScores()
      const wb = XLSX.utils.book_new()

      // Sheet 1: every submission, raw.
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
        const sheet = XLSX.utils.json_to_sheet(ranked)
        const name = (GAMES[slug]?.title ?? slug).slice(0, 31)
        XLSX.utils.book_append_sheet(wb, sheet, name)
      }

      const stamp = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `extra-mile-leaderboard-${stamp}.xlsx`)
    } catch (err) {
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
        Download every score as an Excel workbook — one “All Scores” sheet plus a
        ranked sheet per game.
      </p>
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
