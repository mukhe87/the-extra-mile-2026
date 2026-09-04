import { useState } from 'react'
import {
  createProfile,
  loginByPass,
  loginByNamePin,
  setOwnPin,
  signIn,
  normalizePin,
  isValidPin,
  type Profile,
} from '../lib/profile'

// The site's front door. Players must sign in here before reaching the home or
// game pages. Sign In is the default so returning players never accidentally
// create a duplicate; Create Account is a deliberate, separate choice.
//
// Contact for PIN resets / account deletion (shown on the Forgot-PIN screen).
const ADMIN_NAME = 'Corey Hildenbrand'

type Tab = 'signin' | 'create' | 'forgotpin'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Profile | null>(null)
  const [forcePinFor, setForcePinFor] = useState<Profile | null>(null)

  const go = (t: Tab) => {
    setTab(t)
    setError(null)
  }

  // Sign in either establishes the session, or (after an admin reset) routes to
  // the forced PIN screen first.
  const complete = (res: { profile: Profile; mustSetPin: boolean }) => {
    if (res.mustSetPin) setForcePinFor(res.profile)
    else signIn(res.profile)
  }

  const doPass = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!pass.trim()) return setError('Enter your Player Pass.')
    setBusy('pass')
    try {
      const res = await loginByPass(pass)
      if (!res) return setError('That Player Pass didn’t match. Check it, or use your name + PIN.')
      complete(res)
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not sign you in.')
    } finally {
      setBusy(null)
    }
  }

  const doNamePin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!first.trim() || !last.trim()) return setError('Enter your first and last name.')
    if (!isValidPin(pin)) return setError('Enter your 4-digit PIN.')
    setBusy('namepin')
    try {
      const res = await loginByNamePin(first, last, pin)
      if (!res)
        return setError('No account matches that name and PIN. Check them, or create an account.')
      complete(res)
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not sign you in.')
    } finally {
      setBusy(null)
    }
  }

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!first.trim() || !last.trim()) return setError('Enter your first and last name.')
    if (!isValidPin(pin)) return setError('Pick a 4-digit PIN (numbers only).')
    if (pin !== confirm) return setError('The two PINs don’t match.')
    setBusy('create')
    try {
      setCreated(await createProfile(first, last, pin))
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not create your account.')
    } finally {
      setBusy(null)
    }
  }

  let body: React.ReactNode
  if (forcePinFor) {
    body = <ForcePinReset profile={forcePinFor} />
  } else if (created) {
    body = <PassReveal profile={created} />
  } else if (tab === 'forgotpin') {
    body = <ForgotPin onBack={() => go('signin')} />
  } else {
    body = (
      <div className="rounded-2xl bg-white p-8 shadow">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-seven-dark/5 p-1">
          <TabButton active={tab === 'signin'} onClick={() => go('signin')}>
            Sign in
          </TabButton>
          <TabButton active={tab === 'create'} onClick={() => go('create')}>
            Create account
          </TabButton>
        </div>

        {tab === 'signin' ? (
          <div>
            <form onSubmit={doPass}>
              <label className="mb-2 block">
                <span className="mb-1 block text-sm font-bold">Player Pass</span>
                <input
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  disabled={busy !== null}
                  autoCapitalize="characters"
                  className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono uppercase tracking-wider focus:border-seven-orange focus:outline-none disabled:opacity-60"
                  placeholder="EXTRA-4F7Q"
                />
              </label>
              <button
                type="submit"
                disabled={busy !== null}
                className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
              >
                {busy === 'pass' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-seven-dark/40">
              <span className="h-px flex-1 bg-seven-dark/10" /> or use your name + PIN
              <span className="h-px flex-1 bg-seven-dark/10" />
            </div>

            <form onSubmit={doNamePin}>
              <NameFields {...{ first, last, setFirst, setLast, busy: busy !== null }} />
              <PinField
                pin={pin}
                setPin={setPin}
                busy={busy !== null}
                hint="The 4-digit PIN you chose when you signed up."
              />
              <button
                type="submit"
                disabled={busy !== null}
                className="w-full rounded-full border-2 border-seven-orange px-6 py-3 font-bold text-seven-orange disabled:opacity-60"
              >
                {busy === 'namepin' ? 'Signing in…' : 'Sign in with name + PIN'}
              </button>
            </form>

            {error && <p className="mt-4 text-sm text-seven-red">{error}</p>}

            <p className="mt-4 text-center text-sm text-seven-dark/60">
              Forgot your PIN?{' '}
              <button type="button" onClick={() => go('forgotpin')} className="font-bold text-seven-orange">
                Get help
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={doCreate}>
            <p className="mb-5 text-sm text-seven-dark/70">
              New here? Create your account. Pick a 4-digit PIN you’ll remember — it keeps your
              scores separate from anyone with your name, and lets you get back in if you lose your
              Player Pass.
            </p>
            <NameFields {...{ first, last, setFirst, setLast, busy: busy !== null }} />
            <PinField
              pin={pin}
              setPin={setPin}
              busy={busy !== null}
              hint="Choose a 4-digit PIN."
            />
            <label className="mb-6 block">
              <span className="mb-1 block text-sm font-bold">Confirm PIN</span>
              <input
                value={confirm}
                onChange={(e) => setConfirm(normalizePin(e.target.value))}
                disabled={busy !== null}
                inputMode="numeric"
                autoComplete="off"
                className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono tracking-[0.5em] focus:border-seven-orange focus:outline-none disabled:opacity-60"
                placeholder="1234"
              />
            </label>

            {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}

            <button
              type="submit"
              disabled={busy !== null}
              className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
            >
              {busy === 'create' ? 'Creating…' : 'Create account'}
            </button>
            <p className="mt-4 text-center text-sm text-seven-dark/60">
              Already have an account?{' '}
              <button type="button" onClick={() => go('signin')} className="font-bold text-seven-orange">
                Sign in
              </button>
            </p>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="road-strip h-2" />
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/extra-mile-logo.png"
            alt="The Extra Mile — 7-Eleven Customer Service Week 2026"
            className="w-full max-w-[220px]"
            width={623}
            height={640}
          />
          <p className="mt-3 text-sm font-bold uppercase tracking-widest text-seven-green">
            Customer Service Week 2026
          </p>
        </div>
        {body}
      </div>
    </div>
  )

  // --- forced PIN reset (after an admin reset) ---
  function ForcePinReset({ profile }: { profile: Profile }) {
    const [p1, setP1] = useState('')
    const [p2, setP2] = useState('')
    const [b, setB] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const submit = async (e: React.FormEvent) => {
      e.preventDefault()
      setErr(null)
      if (!isValidPin(p1)) return setErr('Pick a 4-digit PIN (numbers only).')
      if (p1 !== p2) return setErr('The two PINs don’t match.')
      setB(true)
      try {
        await setOwnPin(profile.passCode, p1)
        signIn(profile)
      } catch (e2) {
        setErr((e2 as Error)?.message ?? 'Could not set your PIN.')
      } finally {
        setB(false)
      }
    }
    return (
      <form onSubmit={submit} className="rounded-2xl bg-white p-8 shadow">
        <h2 className="mb-1 font-display text-2xl">Set a new PIN, {profile.firstName}</h2>
        <p className="mb-6 text-sm text-seven-dark/70">
          Your account was reset. For your security, please choose a new{' '}
          <strong>4-digit PIN</strong> that’s personal to you.
        </p>
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold">New PIN</span>
          <input
            value={p1}
            onChange={(e) => setP1(normalizePin(e.target.value))}
            disabled={b}
            inputMode="numeric"
            autoFocus
            className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono tracking-[0.5em] focus:border-seven-orange focus:outline-none disabled:opacity-60"
            placeholder="1234"
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-bold">Confirm PIN</span>
          <input
            value={p2}
            onChange={(e) => setP2(normalizePin(e.target.value))}
            disabled={b}
            inputMode="numeric"
            className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono tracking-[0.5em] focus:border-seven-orange focus:outline-none disabled:opacity-60"
            placeholder="1234"
          />
        </label>
        {err && <p className="mb-4 text-sm text-seven-red">{err}</p>}
        <button
          type="submit"
          disabled={b}
          className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
        >
          {b ? 'Saving…' : 'Save my PIN & play'}
        </button>
      </form>
    )
  }

  // --- pass reveal after account creation ---
  function PassReveal({ profile }: { profile: Profile }) {
    const [copied, setCopied] = useState(false)
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(profile.passCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        /* clipboard blocked */
      }
    }
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h2 className="mb-1 font-display text-2xl">You’re all set, {profile.firstName}!</h2>
        <p className="mb-5 text-sm text-seven-dark/70">
          This is your <strong>Player Pass</strong>. Save it to sign in fast — and if you lose it,
          you can sign in with your name and PIN.
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
        <p className="mb-5 text-xs text-seven-dark/50">Tip: screenshot this so you always have it.</p>
        <button
          onClick={() => signIn(profile)}
          className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow"
        >
          Start playing
        </button>
      </div>
    )
  }
}

function ForgotPin({ onBack }: { onBack: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow">
      <h2 className="mb-1 font-display text-2xl">Forgot your PIN?</h2>
      <p className="mb-4 text-sm text-seven-dark/70">
        For your security, PINs can’t be reset here. If you’ve forgotten your PIN — or you’d like
        your account deleted — please reach out to the Website Administrator,{' '}
        <strong>{ADMIN_NAME}</strong>, and he’ll take care of it for you.
      </p>
      <div className="mb-6 rounded-xl border-2 border-seven-orange/40 bg-seven-orange/5 p-4 text-sm text-seven-dark/80">
        Ask {ADMIN_NAME} to <strong>reset your PIN</strong> or <strong>delete your account</strong>.
        After a reset, the next time you sign in you’ll be asked to choose a new personal PIN.
      </div>
      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow"
      >
        Back to sign in
      </button>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        active ? 'bg-white text-seven-dark shadow' : 'text-seven-dark/60'
      }`}
    >
      {children}
    </button>
  )
}

function NameFields({
  first,
  last,
  setFirst,
  setLast,
  busy,
}: {
  first: string
  last: string
  setFirst: (v: string) => void
  setLast: (v: string) => void
  busy: boolean
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
      </label>
    </>
  )
}

function PinField({
  pin,
  setPin,
  busy,
  hint,
}: {
  pin: string
  setPin: (v: string) => void
  busy: boolean
  hint: string
}) {
  return (
    <label className="mb-4 block">
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
      <span className="mt-1 block text-xs text-seven-dark/50">{hint}</span>
    </label>
  )
}
