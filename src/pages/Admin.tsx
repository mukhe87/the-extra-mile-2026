import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  fetchAllScores,
  rankBestPerPlayer,
  overallStandings,
  resetScores,
  type ScoreRow,
} from '../lib/scores'
import { GAMES } from '../games/registry'
import { SCHEDULE, DAY_LABEL, type DayKey } from '../lib/schedule'
import { setAdmin } from '../lib/admin'
import GameCard from '../components/GameCard'

// A single shared password gates this page. This is a light gate appropriate to
// an internal event — it hides the panel from casual visitors, not a hardened
// auth boundary. See README "Security notes".
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

const WEEK: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

type Summary = { players: number; plays: number; games: number }

export default function Admin() {
  const [entered, setEntered] = useState('')
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (ADMIN_PASSWORD && entered === ADMIN_PASSWORD) {
      setOk(true)
      setError(null)
      setAdmin(true)
    } else setError('Incorrect password.')
  }

  if (!ADMIN_PASSWORD) {
    return (
      <div className="rounded-2xl bg-white p-8">
        Set <code>VITE_ADMIN_PASSWORD</code> to enable the admin panel.
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
    <div className="grid gap-8">
      <header>
        <h1 className="font-display text-3xl">Admin panel</h1>
        <p className="text-seven-dark/70">
          Play or preview any day’s games, download standings, and reset the scoreboard.
        </p>
      </header>
      <SummaryCard />
      <PlayAnyGame />
      <ExportCard />
      <ResetCard />
    </div>
  )
}

function SummaryCard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchAllScores()
      .then((rows) => {
        if (!active) return
        const players = new Set(rows.map((r) => `${r.first_name} ${r.last_name}`.toLowerCase())).size
        const games = new Set(rows.map((r) => r.game_slug)).size
        setSummary({ players, plays: rows.length, games })
      })
      .catch((e) => active && setError((e as Error)?.message ?? 'Could not load stats.'))
    return () => {
      active = false
    }
  }, [])

  if (error)
    return (
      <p className="rounded-xl bg-seven-red/5 p-3 text-sm text-seven-red">
        Couldn’t load stats: {error}
      </p>
    )
  if (!summary) return null
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Players" value={summary.players} />
      <Stat label="Total plays" value={summary.plays} />
      <Stat label="Games played" value={summary.games} />
    </div>
  )
}

function PlayAnyGame() {
  return (
    <section>
      <h2 className="mb-1 font-display text-2xl">Play any game</h2>
      <p className="mb-4 text-sm text-seven-dark/60">
        Every day’s games, unlocked for review. These open the real game — scores you post
        here count, so use the reset below to clear test scores when you’re done.
      </p>
      <div className="grid gap-6">
        {WEEK.map((d) => (
          <div key={d}>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-seven-dark/60">
              {DAY_LABEL[d]}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {SCHEDULE[d].map((slug) => {
                const game = GAMES[slug]
                return game ? <GameCard key={`${d}-${slug}`} game={game} /> : null
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExportCard() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportXlsx = async () => {
    setBusy(true)
    setError(null)
    try {
      const rows = await fetchAllScores()
      const wb = XLSX.utils.book_new()
      const overall = overallStandings(rows).map((e) => ({
        Rank: e.rank,
        'First Name': e.firstName,
        'Last Name': e.lastName,
        'Total Points': e.totalBest,
        'Games Played': e.gamesPlayed,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overall), 'Overall')
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
      for (const slug of Object.keys(GAMES)) {
        const gameRows = rows.filter((r) => r.game_slug === slug)
        if (gameRows.length === 0) continue
        const ranked = rankBestPerPlayer(gameRows).map((e) => ({
          Rank: e.rank,
          'First Name': e.firstName,
          'Last Name': e.lastName,
          'Best Score': e.score,
        }))
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(ranked),
          (GAMES[slug]?.title ?? slug).slice(0, 31),
        )
      }
      XLSX.writeFile(wb, `extra-mile-leaderboard-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      setError(`Export failed: ${(e as Error)?.message ?? 'unknown error'}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h2 className="mb-1 font-display text-2xl">Download standings</h2>
      <p className="mb-4 text-sm text-seven-dark/70">
        Excel workbook: an Overall standings sheet, an All Scores sheet, and a ranked sheet
        per game.
      </p>
      {error && <p className="mb-3 text-sm text-seven-red">{error}</p>}
      <button
        onClick={exportXlsx}
        disabled={busy}
        className="rounded-full bg-seven-green px-6 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? 'Building workbook…' : 'Download .xlsx'}
      </button>
    </section>
  )
}

function ResetCard() {
  const [scope, setScope] = useState<string>('__all__')
  const [pw, setPw] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const doReset = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const deleted = await resetScores(pw, scope === '__all__' ? undefined : scope)
      const where = scope === '__all__' ? 'all games' : GAMES[scope]?.title ?? scope
      setMsg({ kind: 'ok', text: `Cleared ${deleted} score${deleted === 1 ? '' : 's'} from ${where}.` })
      setConfirming(false)
      setPw('')
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error)?.message ?? 'Reset failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-seven-red/30 bg-seven-red/5 p-6">
      <h2 className="mb-1 font-display text-2xl text-seven-red">Reset the scoreboard</h2>
      <p className="mb-4 text-sm text-seven-dark/70">
        Permanently deletes scores. Requires the separate reset password stored in the
        database (see <code>supabase/reset-function.sql</code>) — not the admin login above.
      </p>

      <div className="grid gap-3 sm:max-w-md">
        <label className="text-sm font-bold">
          What to clear
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-seven-dark/15 bg-white px-3 py-2"
          >
            <option value="__all__">All games (full reset)</option>
            {Object.values(GAMES).map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold">
          Reset password
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Reset password"
            className="mt-1 w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-red focus:outline-none"
          />
        </label>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={!pw}
            className="justify-self-start rounded-full bg-seven-red px-6 py-2.5 font-bold text-white disabled:opacity-50"
          >
            Reset…
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
            <span className="text-sm font-bold">
              Delete{' '}
              {scope === '__all__' ? 'ALL scores' : `all “${GAMES[scope]?.title}” scores`}? This
              can’t be undone.
            </span>
            <button
              onClick={doReset}
              disabled={busy}
              className="rounded-full bg-seven-red px-5 py-2 font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Clearing…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full border-2 border-seven-dark/15 px-5 py-2 font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        {msg && (
          <p className={`text-sm font-bold ${msg.kind === 'ok' ? 'text-seven-green' : 'text-seven-red'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <div className="font-display text-2xl text-seven-orange">{value}</div>
      <div className="text-xs text-seven-dark/60">{label}</div>
    </div>
  )
}
