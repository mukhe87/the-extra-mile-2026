import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createProfile,
  signInByLogin,
  redeemResetCode,
  signIn,
  normalizePin,
  normalizeResetCode,
  normalizeUsername,
  isValidPin,
} from '../lib/profile'
import { setAdmin } from '../lib/admin'

// The site's front door. Players sign in with just their 6-digit PIN. Create
// Account and Admin are separate tabs. A player who forgot their PIN gets a
// 4-digit reset code from the admin and redeems it here.
const ADMIN_NAME = 'Corey Hildenbrand'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined

type View = 'signin' | 'create' | 'admin' | 'reset' | 'forgotpin'

export default function LoginPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('signin')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // sign in
  const [signinUser, setSigninUser] = useState('')
  const [pin, setPin] = useState('')
  // create
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [createUser, setCreateUser] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirm, setConfirm] = useState('')
  // reset redeem
  const [code, setCode] = useState('')
  const [resetUser, setResetUser] = useState('')
  const [resetPin, setResetPin] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  // admin
  const [adminPw, setAdminPw] = useState('')

  const go = (v: View) => {
    setView(v)
    setError(null)
  }

  const doSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!signinUser.trim()) return setError('Enter your username.')
    if (!isValidPin(pin)) return setError('Enter your 6-digit PIN.')
    setBusy(true)
    try {
      const p = await signInByLogin(signinUser, pin)
      if (!p) return setError('Username or PIN is incorrect. Check them, or create an account.')
      signIn(p)
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!first.trim() || !last.trim()) return setError('Enter your first and last name.')
    if (newPin !== confirm) return setError('The two PINs don’t match.')
    setBusy(true)
    try {
      signIn(await createProfile(first, last, createUser, newPin))
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not create your account.')
    } finally {
      setBusy(false)
    }
  }

  const doRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (resetPin !== resetConfirm) return setError('The two PINs don’t match.')
    setBusy(true)
    try {
      signIn(await redeemResetCode(code, resetUser, resetPin))
    } catch (err) {
      setError((err as Error)?.message ?? 'Could not reset your PIN.')
    } finally {
      setBusy(false)
    }
  }

  const doAdmin = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!ADMIN_PASSWORD) return setError('Admin isn’t configured.')
    if (adminPw !== ADMIN_PASSWORD) return setError('Incorrect admin password.')
    setAdmin(true)
    navigate('/admin')
  }

  let body: React.ReactNode
  if (view === 'reset') {
    body = (
      <form onSubmit={doRedeem} className="rounded-2xl bg-white p-8 shadow">
        <h2 className="mb-1 font-display text-2xl">Reset your PIN</h2>
        <p className="mb-6 text-sm text-seven-dark/70">
          Enter the <strong>4-digit code</strong> your admin gave you, then set your{' '}
          <strong>username</strong> and a new 6-digit PIN. (Codes expire 24 hours after they’re
          issued.)
        </p>
        <Field label="Reset code (4 digits)">
          <input
            value={code}
            onChange={(e) => setCode(normalizeResetCode(e.target.value))}
            inputMode="numeric"
            autoFocus
            className={inputCls + ' tracking-[0.5em]'}
            placeholder="1234"
          />
        </Field>
        <Field label="Username">
          <input
            value={resetUser}
            onChange={(e) => setResetUser(normalizeUsername(e.target.value))}
            autoCapitalize="none"
            className={inputCls}
            placeholder="yourname"
          />
        </Field>
        <Field label="New 6-digit PIN">
          <input
            value={resetPin}
            onChange={(e) => setResetPin(normalizePin(e.target.value))}
            inputMode="numeric"
            className={inputCls + ' tracking-[0.4em]'}
            placeholder="123456"
          />
        </Field>
        <Field label="Confirm new PIN">
          <input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(normalizePin(e.target.value))}
            inputMode="numeric"
            className={inputCls + ' tracking-[0.4em]'}
            placeholder="123456"
          />
        </Field>
        {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? 'Saving…' : 'Set new PIN & sign in'}
        </button>
        <BackLink onClick={() => go('signin')} />
      </form>
    )
  } else if (view === 'forgotpin') {
    body = (
      <div className="rounded-2xl bg-white p-8 shadow">
        <h2 className="mb-1 font-display text-2xl">Forgot your PIN?</h2>
        <p className="mb-4 text-sm text-seven-dark/70">
          For your security, PINs can’t be looked up. Reach out to the Website Administrator,{' '}
          <strong>{ADMIN_NAME}</strong> — he’ll reset your account and give you a{' '}
          <strong>4-digit code</strong>. Come back, tap <strong>“Have a reset code?”</strong>, and
          use it to set a new PIN. He can also delete your account if you ask.
        </p>
        <button type="button" onClick={() => go('reset')} className={outlineBtn + ' mb-2'}>
          I have a reset code
        </button>
        <BackLink onClick={() => go('signin')} />
      </div>
    )
  } else {
    body = (
      <div className="rounded-2xl bg-white p-8 shadow">
        <div className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-seven-dark/5 p-1">
          <Tab active={view === 'signin'} onClick={() => go('signin')}>
            Sign in
          </Tab>
          <Tab active={view === 'create'} onClick={() => go('create')}>
            Create
          </Tab>
          <Tab active={view === 'admin'} onClick={() => go('admin')}>
            Admin
          </Tab>
        </div>

        {view === 'signin' && (
          <form onSubmit={doSignIn}>
            <Field label="Username">
              <input
                value={signinUser}
                onChange={(e) => setSigninUser(normalizeUsername(e.target.value))}
                autoCapitalize="none"
                autoFocus
                className={inputCls}
                placeholder="yourname"
              />
            </Field>
            <Field label="6-digit PIN">
              <input
                value={pin}
                onChange={(e) => setPin(normalizePin(e.target.value))}
                inputMode="numeric"
                className={inputCls + ' tracking-[0.4em]'}
                placeholder="123456"
              />
            </Field>
            {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="mt-4 flex flex-col gap-1 text-center text-sm text-seven-dark/60">
              <span>
                Forgot your PIN?{' '}
                <button type="button" onClick={() => go('forgotpin')} className="font-bold text-seven-orange">
                  Get help
                </button>
              </span>
              <span>
                Have a reset code?{' '}
                <button type="button" onClick={() => go('reset')} className="font-bold text-seven-orange">
                  Reset your PIN
                </button>
              </span>
            </div>
          </form>
        )}

        {view === 'create' && (
          <form onSubmit={doCreate}>
            <p className="mb-5 text-sm text-seven-dark/70">
              Create your account. Pick a <strong>6-digit PIN you’ll remember</strong> — it’s how
              you sign in. If you forget it, an admin has to reset your account, so keep it safe.
            </p>
            <Field label="First name">
              <input value={first} onChange={(e) => setFirst(e.target.value)} className={inputCls} placeholder="Alex" />
            </Field>
            <Field label="Last name">
              <input value={last} onChange={(e) => setLast(e.target.value)} className={inputCls} placeholder="Rivera" />
            </Field>
            <Field label="Username">
              <input
                value={createUser}
                onChange={(e) => setCreateUser(normalizeUsername(e.target.value))}
                autoCapitalize="none"
                className={inputCls}
                placeholder="yourname (3–20 chars)"
              />
            </Field>
            <Field label="6-digit PIN">
              <input
                value={newPin}
                onChange={(e) => setNewPin(normalizePin(e.target.value))}
                inputMode="numeric"
                className={inputCls + ' tracking-[0.4em]'}
                placeholder="123456"
              />
            </Field>
            <Field label="Confirm PIN">
              <input
                value={confirm}
                onChange={(e) => setConfirm(normalizePin(e.target.value))}
                inputMode="numeric"
                className={inputCls + ' tracking-[0.4em]'}
                placeholder="123456"
              />
            </Field>
            {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtn}>
              {busy ? 'Creating…' : 'Create account & play'}
            </button>
          </form>
        )}

        {view === 'admin' && (
          <form onSubmit={doAdmin}>
            <p className="mb-5 text-sm text-seven-dark/70">Admin sign-in.</p>
            <Field label="Admin password">
              <input
                type="password"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                className={inputCls}
                placeholder="Admin password"
              />
            </Field>
            {error && <p className="mb-4 text-sm text-seven-red">{error}</p>}
            <button type="submit" className={primaryBtn}>
              Unlock admin
            </button>
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
}

const inputCls =
  'w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono focus:border-seven-orange focus:outline-none disabled:opacity-60'
const primaryBtn =
  'w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60'
const outlineBtn =
  'w-full rounded-full border-2 border-seven-orange px-6 py-3 font-bold text-seven-orange'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      {children}
    </label>
  )
}

function Tab({
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
      className={`rounded-full px-3 py-2 text-sm font-bold transition ${
        active ? 'bg-white text-seven-dark shadow' : 'text-seven-dark/60'
      }`}
    >
      {children}
    </button>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <p className="mt-4 text-center text-sm text-seven-dark/60">
      <button type="button" onClick={onClick} className="font-bold text-seven-orange">
        Back to sign in
      </button>
    </p>
  )
}
