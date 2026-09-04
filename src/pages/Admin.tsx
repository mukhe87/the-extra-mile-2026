import { useEffect, useState } from 'react'
import { fetchAllScores, resetScores } from '../lib/scores'
import {
  adminFindProfiles,
  adminResetAccount,
  adminDeleteProfile,
  type AdminProfile,
} from '../lib/profile'
import { downloadDayReport, downloadFullReport, downloadBackup } from '../lib/exporting'
import { GAMES } from '../games/registry'
import { SCHEDULE, DAY_LABEL, type DayKey } from '../lib/schedule'
import { setAdmin, isAdmin } from '../lib/admin'
import GameCard from '../components/GameCard'

// A single shared password gates this page. This is a light gate appropriate to
// an internal event — it hides the panel from casual visitors, not a hardened
// auth boundary. See README "Security notes".
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

const WEEK: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

type Summary = { players: number; plays: number; games: number }

export default function Admin() {
  const [entered, setEntered] = useState('')
  const [ok, setOk] = useState(isAdmin()) // already unlocked via the login page?
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

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
          Play or preview any day’s games, download reports by day, and reset the scoreboard.
        </p>
      </header>
      <SummaryCard reloadKey={reloadKey} />
      <PlayAnyGame />
      <DownloadCard />
      <ManagePlayers onChange={() => setReloadKey((k) => k + 1)} />
      <ResetCard onDone={() => setReloadKey((k) => k + 1)} />
    </div>
  )
}

function SummaryCard({ reloadKey }: { reloadKey: number }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchAllScores()
      .then((rows) => {
        if (!active) return
        const players = new Set(
          rows.map((r) => r.profile_id ?? `name:${r.first_name} ${r.last_name}`.toLowerCase()),
        ).size
        const games = new Set(rows.map((r) => r.game_slug)).size
        setSummary({ players, plays: rows.length, games })
      })
      .catch((e) => active && setError((e as Error)?.message ?? 'Could not load stats.'))
    return () => {
      active = false
    }
  }, [reloadKey])

  if (error)
    return <p className="rounded-xl bg-seven-red/5 p-3 text-sm text-seven-red">Couldn’t load stats: {error}</p>
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

function DownloadCard() {
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (label: string, fn: (rows: Awaited<ReturnType<typeof fetchAllScores>>) => number | void) => {
    setBusy(label)
    setError(null)
    setNote(null)
    try {
      const rows = await fetchAllScores()
      const count = fn(rows)
      if (typeof count === 'number')
        setNote(count === 0 ? `No scores for ${label} yet — downloaded an empty sheet.` : `Downloaded ${label} (${count} plays).`)
    } catch (e) {
      setError(`Download failed: ${(e as Error)?.message ?? 'unknown error'}.`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h2 className="mb-1 font-display text-2xl">Download reports</h2>
      <p className="mb-4 text-sm text-seven-dark/70">
        A separate Excel report per weekday (only scores played that day), so days don’t mix.
        Each sheet lists the game name next to every player’s score. “Full week” includes overall
        standings.
      </p>
      <div className="flex flex-wrap gap-2">
        {WEEK.map((d) => (
          <button
            key={d}
            disabled={busy !== null}
            onClick={() => run(DAY_LABEL[d], (rows) => downloadDayReport(rows, d, DAY_LABEL[d]))}
            className="rounded-full bg-seven-green px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {busy === DAY_LABEL[d] ? '…' : DAY_LABEL[d]}
          </button>
        ))}
        <button
          disabled={busy !== null}
          onClick={() => run('Full week', (rows) => downloadFullReport(rows))}
          className="rounded-full bg-seven-dark px-5 py-2.5 font-bold text-white disabled:opacity-50"
        >
          {busy === 'Full week' ? '…' : 'Full week'}
        </button>
      </div>
      {note && <p className="mt-3 text-sm text-seven-green">{note}</p>}
      {error && <p className="mt-3 text-sm text-seven-red">{error}</p>}
    </section>
  )
}

function ResetCard({ onDone }: { onDone: () => void }) {
  const [scope, setScope] = useState<string>('__all__')
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const scopeLabel = scope === '__all__' ? 'all games' : GAMES[scope]?.title ?? scope

  const doDelete = async (saveFirst: boolean) => {
    setBusy(true)
    setMsg(null)
    try {
      if (saveFirst) {
        const rows = await fetchAllScores()
        downloadBackup(rows, scope)
      }
      const deleted = await resetScores(ADMIN_PASSWORD ?? '', scope === '__all__' ? undefined : scope)
      setMsg({
        kind: 'ok',
        text: `${saveFirst ? 'Saved a backup, then cleared' : 'Cleared'} ${deleted} score${
          deleted === 1 ? '' : 's'
        } from ${scopeLabel}.`,
      })
      setShowConfirm(false)
      onDone()
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error)?.message ?? 'Reset failed.' })
      setShowConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-seven-red/30 bg-seven-red/5 p-6">
      <h2 className="mb-1 font-display text-2xl text-seven-red">Reset the scoreboard</h2>
      <p className="mb-4 text-sm text-seven-dark/70">
        Permanently deletes scores. Choose what to clear, then confirm.
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

        <button
          onClick={() => {
            setMsg(null)
            setShowConfirm(true)
          }}
          className="justify-self-start rounded-full bg-seven-red px-6 py-2.5 font-bold text-white"
        >
          Reset
        </button>

        {msg && (
          <p className={`text-sm font-bold ${msg.kind === 'ok' ? 'text-seven-green' : 'text-seven-red'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {showConfirm && (
        <ConfirmResetModal
          scopeLabel={scopeLabel}
          busy={busy}
          onSaveThenDelete={() => doDelete(true)}
          onDelete={() => doDelete(false)}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </section>
  )
}

function ConfirmResetModal({
  scopeLabel,
  busy,
  onSaveThenDelete,
  onDelete,
  onCancel,
}: {
  scopeLabel: string
  busy: boolean
  onSaveThenDelete: () => void
  onDelete: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm reset"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 font-display text-xl text-seven-red">Reset the scoreboard?</h3>
        <p className="mb-5 text-sm text-seven-dark/80">
          You’re about to reset the scoreboard for <strong>{scopeLabel}</strong>. This permanently
          deletes all of that data and can’t be undone. Would you like to save this data to an Excel
          spreadsheet first?
        </p>
        <div className="grid gap-2">
          <button
            onClick={onSaveThenDelete}
            disabled={busy}
            className="rounded-full bg-seven-green px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Save data to Excel, then delete'}
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-full bg-seven-red px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Yes, delete data'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border-2 border-seven-dark/15 px-5 py-2.5 font-bold disabled:opacity-50"
          >
            No, don’t delete data
          </button>
        </div>
      </div>
    </div>
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

// Look up players to help anyone locked out (issue a new pass / reset their
// PIN — their scores and data stay), or delete an account and all its data.
function ManagePlayers({ onChange }: { onChange: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminProfile[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<AdminProfile | null>(null)

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      setResults(await adminFindProfiles(ADMIN_PASSWORD ?? '', query))
    } catch (err) {
      setError((err as Error)?.message ?? 'Search failed.')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  const afterDelete = (id: string) => {
    setResults((rows) => (rows ? rows.filter((r) => r.id !== id) : rows))
    setToDelete(null)
    onChange()
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h2 className="mb-1 font-display text-2xl">Manage players</h2>
      <p className="mb-4 text-sm text-seven-dark/70">
        Look up a player who forgot their PIN and <strong>Reset account</strong> — that issues a
        4-digit code (valid 24 hours) to give them; they use it on the sign-in page to set a new
        PIN. A reset keeps <strong>all their data</strong> (scores and, later, their License Plate
        photos) — you never see or set their PIN. <strong>Delete account</strong> removes it and all
        its data.
      </p>

      <form onSubmit={search} className="mb-4 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or pass (blank = everyone)"
          className="min-w-[16rem] flex-1 rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-orange focus:outline-none"
        />
        <button
          disabled={busy}
          className="rounded-full bg-seven-dark px-5 py-2.5 font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-seven-red">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-sm text-seven-dark/60">No players match that search.</p>
      )}

      {results && results.length > 0 && (
        <ul className="grid gap-3">
          {results.map((p) => (
            <PlayerRow key={p.id} player={p} onDelete={() => setToDelete(p)} />
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmDeletePlayerModal
          player={toDelete}
          onCancel={() => setToDelete(null)}
          onDeleted={() => afterDelete(toDelete.id)}
        />
      )}
    </section>
  )
}

function PlayerRow({ player, onDelete }: { player: AdminProfile; onDelete: () => void }) {
  const [code, setCode] = useState<string | null>(player.resetCode)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const resetAccount = async () => {
    setBusy(true)
    setErr(null)
    try {
      setCode(await adminResetAccount(ADMIN_PASSWORD ?? '', player.id))
    } catch (e) {
      setErr((e as Error)?.message ?? 'Could not reset the account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border-2 border-seven-dark/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">
            {player.firstName} {player.lastName}
          </p>
          <p className="text-xs text-seven-dark/55">
            {player.scoreCount} score{player.scoreCount === 1 ? '' : 's'} · joined{' '}
            {new Date(player.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetAccount}
            disabled={busy}
            className="rounded-full bg-seven-green px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? '…' : 'Reset account'}
          </button>
          <button
            onClick={onDelete}
            className="rounded-full border-2 border-seven-red/40 px-3 py-1.5 text-sm font-bold text-seven-red hover:bg-seven-red/5"
          >
            Delete account
          </button>
        </div>
      </div>

      {code && (
        <div className="mt-3 rounded-lg border-2 border-dashed border-seven-orange/50 bg-seven-orange/5 p-3 text-sm">
          Give {player.firstName} this reset code — it expires in 24 hours. They enter it on the
          sign-in page under “Have a reset code?” to set a new PIN.
          <div className="mt-1 font-display text-2xl tracking-widest text-seven-dark">{code}</div>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-seven-red">{err}</p>}
    </li>
  )
}

function ConfirmDeletePlayerModal({
  player,
  onCancel,
  onDeleted,
}: {
  player: AdminProfile
  onCancel: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  const del = async () => {
    setBusy(true)
    setErr(null)
    try {
      await adminDeleteProfile(ADMIN_PASSWORD ?? '', player.id)
      onDeleted()
    } catch (e) {
      setErr((e as Error)?.message ?? 'Delete failed.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete player"
      onClick={() => !busy && onCancel()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 font-display text-xl text-seven-red">Delete this account?</h3>
        <p className="mb-5 text-sm text-seven-dark/80">
          You’re about to permanently delete{' '}
          <strong>
            {player.firstName} {player.lastName}
          </strong>
          ’s account and <strong>all of their data</strong> — their {player.scoreCount} score
          {player.scoreCount === 1 ? '' : 's'} and any saved items (License Plate photos, etc.).
          This <strong>cannot be undone</strong>.
        </p>
        {err && <p className="mb-3 text-sm text-seven-red">{err}</p>}
        <div className="grid gap-2">
          <button
            onClick={del}
            disabled={busy}
            className="rounded-full bg-seven-red px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Deleting…' : 'Yes, delete this account and all data'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border-2 border-seven-dark/15 px-5 py-2.5 font-bold disabled:opacity-50"
          >
            No, keep this account
          </button>
        </div>
      </div>
    </div>
  )
}
