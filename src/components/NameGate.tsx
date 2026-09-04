import { useState } from 'react'
import {
  createProfile,
  loginByPass,
  loginByNamePin,
  normalizePin,
  isValidPin,
  type Profile,
} from '../lib/profile'

// The identity gate.
//  • new     — First + Last + a chosen 4-digit PIN → creates a profile and
//              reveals the Player Pass once.
//  • pass    — returning player enters their Player Pass.
//  • recover — lost the pass? reconnect with First + Last + PIN.
// Blocks scoring until a profile exists.
type Mode = 'new' | 'pass' | 'recover'

export default function NameGate({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('new')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [pin, setPin] = useState('')
  const [pass, setPass] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Profile | null>(null)

  const firstOk = first.trim().length > 0
  const lastOk = last.trim().length > 0
  const pinOk = isValidPin(pin)

  const go = (m: Mode) => {
    setMode(m)
    setError(null)
    setTouched(false)
  }

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!firstOk || !lastOk || !pinOk) return
    setBusy(true)
    try {
      setCreated(await createProfile(first, last, pin))
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not create your profile.')
    } finally {
      setBusy(false)
    }
  }

  const submitPass = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!pass.trim()) return setError('Enter your Player Pass.')
    setBusy(true)
    try {
      const p = await loginByPass(pass)
      if (!p) return setError('That Player Pass didn’t match. Check it, or use “Lost your pass?”.')
      onDone()
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  const submitRecover = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!firstOk || !lastOk || !pinOk) return
    setBusy(true)
    try {
      const p = await loginByNamePin(first, last, pin)
      if (!p)
        return setError('No match for that name and PIN. Double-check them, or start as a new player.')
      onDone()
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not reconnect you.')
    } finally {
      setBusy(false)
    }
  }

  if (created) return <PassReveal profile={created} onContinue={onDone} />

  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
      {mode === 'new' && (
        <form onSubmit={submitNew}>
          <h2 className="mb-1 font-display text-2xl">Before you play</h2>
          <p className="mb-6 text-sm text-seven-dark/70">
            Enter your name and pick a 4-digit PIN. We’ll give you a personal{' '}
            <strong>Player Pass</strong> to jump back in on any device — and your PIN lets you
            recover it if you lose it.
          </p>

          <NameFields
            first={first}
            last={last}
            setFirst={setFirst}
            setLast={setLast}
            busy={busy}
            touched={touched}
            firstOk={firstOk}
            lastOk={lastOk}
          />
          <PinField
            pin={pin}
            setPin={setPin}
            busy={busy}
            touched={touched}
            pinOk={pinOk}
            hint="Pick a 4-digit PIN you’ll remember — it recovers your pass and keeps your scores separate from anyone with your name."
          />

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
            <button type="button" onClick={() => go('pass')} className="font-bold text-seven-orange">
              Enter it here
            </button>
          </p>
        </form>
      )}

      {mode === 'pass' && (
        <form onSubmit={submitPass}>
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

          <div className="mt-4 flex flex-col gap-1 text-center text-sm text-seven-dark/60">
            <span>
              Lost your pass?{' '}
              <button type="button" onClick={() => go('recover')} className="font-bold text-seven-orange">
                Reconnect with name + PIN
              </button>
            </span>
            <span>
              New player?{' '}
              <button type="button" onClick={() => go('new')} className="font-bold text-seven-orange">
                Start here
              </button>
            </span>
          </div>
        </form>
      )}

      {mode === 'recover' && (
        <form onSubmit={submitRecover}>
          <h2 className="mb-1 font-display text-2xl">Reconnect your profile</h2>
          <p className="mb-6 text-sm text-seven-dark/70">
            Lost your Player Pass? Enter the <strong>name and 4-digit PIN</strong> you set up with,
            and we’ll get you back to your scores.
          </p>

          <NameFields
            first={first}
            last={last}
            setFirst={setFirst}
            setLast={setLast}
            busy={busy}
            touched={touched}
            firstOk={firstOk}
            lastOk={lastOk}
          />
          <PinField
            pin={pin}
            setPin={setPin}
            busy={busy}
            touched={touched}
            pinOk={pinOk}
            hint="The 4-digit PIN you chose when you first signed up."
          />

          {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
          >
            {busy ? 'Reconnecting…' : 'Reconnect'}
          </button>

          <p className="mt-4 text-center text-sm text-seven-dark/60">
            Have your pass, or new here?{' '}
            <button type="button" onClick={() => go('pass')} className="font-bold text-seven-orange">
              Back
            </button>
          </p>
        </form>
      )}
    </div>
  )
}

function NameFields({
  first,
  last,
  setFirst,
  setLast,
  busy,
  touched,
  firstOk,
  lastOk,
}: {
  first: string
  last: string
  setFirst: (v: string) => void
  setLast: (v: string) => void
  busy: boolean
  touched: boolean
  firstOk: boolean
  lastOk: boolean
}) {
  return (
    <>
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

      <label className="mb-3 block">
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
    </>
  )
}

function PinField({
  pin,
  setPin,
  busy,
  touched,
  pinOk,
  hint,
}: {
  pin: string
  setPin: (v: string) => void
  busy: boolean
  touched: boolean
  pinOk: boolean
  hint: string
}) {
  return (
    <label className="mb-6 block">
      <span className="mb-1 block text-sm font-bold">4-digit PIN</span>
      <input
        value={pin}
        onChange={(e) => setPin(normalizePin(e.target.value))}
        disabled={busy}
        inputMode="numeric"
        autoComplete="off"
        className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono tracking-[0.5em] focus:border-seven-orange focus:outline-none disabled:opacity-60"
        placeholder="1234"
      />
      {touched && !pinOk ? (
        <span className="mt-1 block text-xs text-seven-red">Enter exactly 4 digits.</span>
      ) : (
        <span className="mt-1 block text-xs text-seven-dark/50">{hint}</span>
      )}
    </label>
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
        This is your <strong>Player Pass</strong>. Save it to jump back in on another device —
        and if you ever lose it, reconnect with your name and PIN.
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
