import { useState } from 'react'
import { createProfile, loginByPass, type Profile } from '../lib/profile'

// The identity gate. New players enter First + Last and get a "Player Pass"
// (shown once so they can save it for another device). Returning players can
// re-attach by entering their pass. Blocks scoring until a profile exists.
type Mode = 'new' | 'returning'

export default function NameGate({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('new')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [pass, setPass] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // After creating a profile we show the pass once, then continue.
  const [created, setCreated] = useState<Profile | null>(null)

  const firstOk = first.trim().length > 0
  const lastOk = last.trim().length > 0

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!firstOk || !lastOk) return
    setBusy(true)
    try {
      const profile = await createProfile(first, last)
      setCreated(profile)
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not create your profile.')
    } finally {
      setBusy(false)
    }
  }

  const submitReturning = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!pass.trim()) {
      setError('Enter your Player Pass.')
      return
    }
    setBusy(true)
    try {
      const profile = await loginByPass(pass)
      if (!profile) {
        setError('That Player Pass didn’t match. Check it and try again.')
        return
      }
      onDone()
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  // Step 2 for new players: show the pass once, prominently, then continue.
  if (created) {
    return <PassReveal profile={created} onContinue={onDone} />
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
      {mode === 'new' ? (
        <form onSubmit={submitNew}>
          <h2 className="mb-1 font-display text-2xl">Before you play</h2>
          <p className="mb-6 text-sm text-seven-dark/70">
            Enter your name so your scores land on the leaderboard. We’ll give you a
            personal <strong>Player Pass</strong> so you can pick up where you left off on
            any device.
          </p>

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-bold">First name</span>
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-orange focus:outline-none disabled:opacity-60"
              placeholder="Alex"
            />
            {touched && !firstOk && (
              <span className="mt-1 block text-xs text-seven-red">First name is required.</span>
            )}
          </label>

          <label className="mb-6 block">
            <span className="mb-1 block text-sm font-bold">Last name</span>
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 focus:border-seven-orange focus:outline-none disabled:opacity-60"
              placeholder="Rivera"
            />
            {touched && !lastOk && (
              <span className="mt-1 block text-xs text-seven-red">Last name is required.</span>
            )}
          </label>

          {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
          >
            {busy ? 'Setting up…' : 'Let’s go'}
          </button>

          <p className="mt-4 text-center text-sm text-seven-dark/60">
            Already have a Player Pass?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('returning')
                setError(null)
              }}
              className="font-bold text-seven-orange"
            >
              Enter it here
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={submitReturning}>
          <h2 className="mb-1 font-display text-2xl">Welcome back</h2>
          <p className="mb-6 text-sm text-seven-dark/70">
            Enter your <strong>Player Pass</strong> to pick up your scores on this device.
          </p>

          <label className="mb-6 block">
            <span className="mb-1 block text-sm font-bold">Player Pass</span>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={busy}
              autoCapitalize="characters"
              className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono uppercase tracking-wider focus:border-seven-orange focus:outline-none disabled:opacity-60"
              placeholder="EXTRA-4F7Q"
            />
          </label>

          {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-sm text-seven-dark/60">
            New player?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('new')
                setError(null)
              }}
              className="font-bold text-seven-orange"
            >
              Start here
            </button>
          </p>
        </form>
      )}
    </div>
  )
}

function PassReveal({ profile, onContinue }: { profile: Profile; onContinue: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.passCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — the code is on screen to copy by hand */
    }
  }
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow">
      <h2 className="mb-1 font-display text-2xl">You’re all set, {profile.firstName}!</h2>
      <p className="mb-5 text-sm text-seven-dark/70">
        This is your <strong>Player Pass</strong>. Save it — you’ll use it to pick up your
        scores on another phone or computer.
      </p>
      <div className="mb-3 rounded-xl border-2 border-dashed border-seven-orange/50 bg-seven-orange/5 p-5">
        <div className="font-display text-3xl tracking-wider text-seven-dark">{profile.passCode}</div>
      </div>
      <button
        onClick={copy}
        className="mb-5 rounded-full border-2 border-seven-dark/15 px-4 py-2 text-sm font-bold hover:border-seven-orange"
      >
        {copied ? 'Copied ✓' : 'Copy my pass'}
      </button>
      <p className="mb-5 text-xs text-seven-dark/50">
        Tip: screenshot this screen so you always have your pass handy.
      </p>
      <button
        onClick={onContinue}
        className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow"
      >
        Start playing
      </button>
    </div>
  )
}
