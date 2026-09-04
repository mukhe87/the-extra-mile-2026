import { useState } from 'react'
import {
  createProfile,
  loginByPass,
  loginByNamePin,
  setOwnPin,
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
type Mode = 'new' | 'pass' | 'recover' | 'forgotpin'

// Who to contact for a PIN reset or account deletion (shown on the "Forgot PIN"
// screen). Update the name/contact here if the administrator changes.
const ADMIN_NAME = 'Corey Hildenbrand'

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
  // Set after an admin reset: the player must choose a personal PIN before playing.
  const [forcePinFor, setForcePinFor] = useState<Profile | null>(null)

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
      const res = await loginByPass(pass)
      if (!res) return setError('That Player Pass didn’t match. Check it, or use “Lost your pass?”.')
      if (res.mustSetPin) setForcePinFor(res.profile)
      else onDone()
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
      const res = await loginByNamePin(first, last, pin)
      if (!res)
        return setError('No match for that name and PIN. Double-check them, or start as a new player.')
      if (res.mustSetPin) setForcePinFor(res.profile)
      else onDone()
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not reconnect you.')
    } finally {
      setBusy(false)
    }
  }

  if (forcePinFor) return <ForcePinReset profile={forcePinFor} onDone={onDone} />
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
            <span>
              Forgot your PIN?{' '}
              <button type="button" onClick={() => go('forgotpin')} className="font-bold text-seven-orange">
                Get help
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

          <div className="mt-4 flex flex-col gap-1 text-center text-sm text-seven-dark/60">
            <span>
              Forgot your PIN?{' '}
              <button type="button" onClick={() => go('forgotpin')} className="font-bold text-seven-orange">
                Get help
              </button>
            </span>
            <span>
              Have your pass, or new here?{' '}
              <button type="button" onClick={() => go('pass')} className="font-bold text-seven-orange">
                Back
              </button>
            </span>
          </div>
        </form>
      )}

      {mode === 'forgotpin' && (
        <div>
          <h2 className="mb-1 font-display text-2xl">Forgot your PIN?</h2>
          <p className="mb-4 text-sm text-seven-dark/70">
            For your security, PINs can’t be reset here. If you’ve forgotten your PIN — or you’d
            like your account deleted — please reach out to the Website Administrator,{' '}
            <strong>{ADMIN_NAME}</strong>, and he’ll take care of it for you.
          </p>
          <div className="mb-6 rounded-xl border-2 border-seven-orange/40 bg-seven-orange/5 p-4 text-sm text-seven-dark/80">
            Ask {ADMIN_NAME} to <strong>reset your PIN</strong> or <strong>delete your account</strong>.
            After a reset, the next time you sign in you’ll be asked to choose a new personal PIN.
          </div>
          <button
            type="button"
            onClick={() => go('pass')}
            className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow"
          >
            Back to sign in
          </button>
        </div>
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

// Shown right after a player logs in following an admin reset: they must choose
// a new personal PIN before continuing. Uses their current pass to authorize.
function ForcePinReset({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isValidPin(pin)) return setError('Pick a 4-digit PIN (numbers only).')
    if (pin !== confirm) return setError('The two PINs don’t match.')
    setBusy(true)
    try {
      await setOwnPin(profile.passCode, pin)
      onDone()
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not set your PIN.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
      <h2 className="mb-1 font-display text-2xl">Set a new PIN, {profile.firstName}</h2>
      <p className="mb-6 text-sm text-seven-dark/70">
        Your account was reset. For your security, please choose a new{' '}
        <strong>4-digit PIN</strong> that’s personal to you — you’ll use it to get back in if you
        ever lose your Player Pass.
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">New PIN</span>
        <input
          value={pin}
          onChange={(e) => setPin(normalizePin(e.target.value))}
          disabled={busy}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono tracking-[0.5em] focus:border-seven-orange focus:outline-none disabled:opacity-60"
          placeholder="1234"
        />
      </label>

      <label className="mb-6 block">
        <span className="mb-1 block text-sm font-bold">Confirm PIN</span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(normalizePin(e.target.value))}
          disabled={busy}
          inputMode="numeric"
          autoComplete="off"
          className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono tracking-[0.5em] focus:border-seven-orange focus:outline-none disabled:opacity-60"
          placeholder="1234"
        />
      </label>

      {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save my PIN & play'}
      </button>
    </form>
  )
}
