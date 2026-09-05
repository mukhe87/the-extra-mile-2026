import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import jsQR from 'jsqr'
import { useProfile } from '../lib/profile'
import {
  STATES,
  TOTAL_STATES,
  scanCode,
  fetchMyCollection,
  fetchStandings,
  subscribeHunt,
  type ScanResult,
  type HuntStanding,
} from '../lib/hunt'

// License Plate Challenge — the all-week state-collecting hunt. Players find
// code tiles hidden around campus, upload/scan each, and try to collect all 50
// states. What a code is worth rotates on the server (anti-cheat); this page is
// just the scan + collection + standings UI.

type Feedback = { tone: 'good' | 'warn' | 'bad'; title: string; detail: string } | null

function feedbackFor(r: ScanResult): Feedback {
  switch (r.result) {
    case 'collected':
      return { tone: 'good', title: `${r.name} collected! 🎉`, detail: `That’s ${r.total} of ${TOTAL_STATES} states.` }
    case 'already_have':
      return { tone: 'warn', title: `You already have ${r.name}.`, detail: 'This code’s showing a plate you’ve got — try it again a bit later.' }
    case 'dud':
      return { tone: 'warn', title: 'Dud — no plate right now.', detail: 'This one isn’t showing a state at the moment. Try it again later, or find another code.' }
    case 'cooldown':
      return { tone: 'warn', title: 'Not yet — try this one later.', detail: 'You scanned this code recently. Give it a few minutes and come back to it.' }
    case 'blocked':
      return { tone: 'warn', title: 'You’ve already used this code.', detail: 'You collected a plate from this one already. Go find a different code!' }
    case 'invalid':
      return { tone: 'bad', title: 'That’s not a valid code.', detail: 'Make sure you’re scanning an official License Plate Challenge tile, or type the LP- code under it.' }
    case 'unknown_player':
      return { tone: 'bad', title: 'Please sign in again.', detail: 'We couldn’t find your account for this scan.' }
    default:
      return null
  }
}

export default function LicensePlateChallenge() {
  const player = useProfile() // guaranteed by the app-level login gate
  const [params, setParams] = useSearchParams()
  const [collected, setCollected] = useState<Set<string>>(new Set())
  const [standings, setStandings] = useState<HuntStanding[]>([])
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    if (!player) return
    try {
      const [mine, board] = await Promise.all([fetchMyCollection(player.id), fetchStandings(200)])
      setCollected(new Set(mine))
      setStandings(board)
    } catch {
      /* transient; the realtime subscription will retry the refresh */
    }
  }, [player])

  useEffect(() => {
    refresh()
    const unsub = subscribeHunt(() => refresh())
    return unsub
  }, [refresh])

  const doScan = useCallback(
    async (code: string) => {
      if (!player || !code.trim()) return
      setBusy(true)
      setFeedback(null)
      try {
        const res = await scanCode(player.id, code)
        setFeedback(feedbackFor(res))
        if (res.result === 'collected') await refresh()
      } catch (err) {
        setFeedback({ tone: 'bad', title: 'Scan failed.', detail: (err as Error)?.message ?? 'Please try again.' })
      } finally {
        setBusy(false)
      }
    },
    [player, refresh],
  )

  // Deep-link support: a code tile QR opens /license-plate?c=LP-XXXX. Auto-scan
  // once, then strip the param so a refresh doesn't re-fire it.
  useEffect(() => {
    const c = params.get('c')
    if (c && player) {
      doScan(c)
      params.delete('c')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) fileRef.current && (fileRef.current.value = '') // allow re-selecting the same file
    if (!file) return
    setBusy(true)
    setFeedback(null)
    try {
      const code = await decodeQrFromFile(file)
      if (!code) {
        setFeedback({ tone: 'bad', title: 'Couldn’t read that photo.', detail: 'Get the whole code square in frame and in focus, or type the LP- code under it.' })
        return
      }
      await doScan(code)
    } catch {
      setFeedback({ tone: 'bad', title: 'Couldn’t read that photo.', detail: 'Try again, or type the LP- code under it.' })
    } finally {
      setBusy(false)
    }
  }

  const count = collected.size
  const pct = Math.round((count / TOTAL_STATES) * 100)

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm font-bold text-seven-orange">
        ← Home
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-3xl">License Plate Challenge</h1>
        <p className="text-seven-dark/70">
          Hunt the code tiles hidden around campus all week. Scan each one to collect state license
          plates — bag all {TOTAL_STATES} states to win. Codes shuffle what they’re worth, so keep
          coming back to the ones that come up empty.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {/* Scan panel */}
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-1 font-display text-xl">Scan a code</h2>
            <p className="mb-4 text-sm text-seven-dark/60">
              Snap a photo of a code tile, or type the <strong>LP-</strong> code printed under it.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="hidden"
              id="lp-photo"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow disabled:opacity-60"
            >
              {busy ? 'Checking…' : '📷 Scan / upload a code photo'}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-widest text-seven-dark/40">
              <span className="h-px flex-1 bg-seven-dark/10" /> or <span className="h-px flex-1 bg-seven-dark/10" />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                doScan(manual)
                setManual('')
              }}
              className="flex gap-2"
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value.toUpperCase())}
                placeholder="LP-7K2P"
                className="w-full rounded-lg border-2 border-seven-dark/15 px-3 py-2 font-mono uppercase tracking-widest focus:border-seven-orange focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !manual.trim()}
                className="rounded-lg bg-seven-dark px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Go
              </button>
            </form>

            {feedback && (
              <div
                className={`mt-4 rounded-xl border-2 p-4 ${
                  feedback.tone === 'good'
                    ? 'border-seven-green/40 bg-seven-green/5'
                    : feedback.tone === 'warn'
                      ? 'border-seven-orange/40 bg-seven-orange/5'
                      : 'border-seven-red/40 bg-seven-red/5'
                }`}
              >
                <p className="font-bold">{feedback.title}</p>
                <p className="text-sm text-seven-dark/70">{feedback.detail}</p>
              </div>
            )}
          </section>

          {/* Collection grid */}
          <section className="mt-6 rounded-2xl bg-white p-6 shadow">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-xl">My collection</h2>
              <span className="font-display text-2xl">
                {count}
                <span className="text-base font-normal text-seven-dark/50"> / {TOTAL_STATES}</span>
              </span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-seven-dark/10">
              <div className="h-full rounded-full bg-seven-green transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
              {STATES.map((s) => {
                const have = collected.has(s.code)
                return (
                  <div
                    key={s.code}
                    title={s.name}
                    className={`flex aspect-[4/3] items-center justify-center rounded-lg border-2 text-sm font-bold ${
                      have
                        ? 'border-seven-green bg-seven-green/10 text-seven-dark'
                        : 'border-dashed border-seven-dark/15 bg-seven-dark/5 text-seven-dark/30'
                    }`}
                  >
                    {s.code}
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Standings */}
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-1 font-display text-xl">Standings</h2>
          <p className="mb-4 text-sm text-seven-dark/60">Most states wins — ties go to whoever got there first.</p>
          {standings.length === 0 ? (
            <p className="text-sm text-seven-dark/50">No plates collected yet. Be the first!</p>
          ) : (
            <ol className="space-y-2">
              {standings.slice(0, 25).map((s, i) => {
                const me = player?.id === s.profileId
                return (
                  <li
                    key={s.profileId}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      me ? 'bg-seven-orange/10 ring-1 ring-seven-orange/40' : 'bg-seven-dark/5'
                    }`}
                  >
                    <span className="w-6 text-center font-display text-lg text-seven-dark/60">{i + 1}</span>
                    <span className="flex-1 truncate text-sm font-bold">
                      {s.firstName} {s.lastName}
                      {me && <span className="ml-1 text-xs font-normal text-seven-orange">(you)</span>}
                    </span>
                    <span className="font-display text-lg">
                      {s.states}
                      <span className="text-xs font-normal text-seven-dark/50">/{TOTAL_STATES}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

/** Decode a QR code from an uploaded image file. Returns the raw payload or ''. */
async function decodeQrFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // Cap the working canvas so huge phone photos stay fast.
    const max = 1000
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h)
    const result = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' })
    return result?.data ?? ''
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
