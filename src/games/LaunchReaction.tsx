import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameProps } from './PlaceholderGame'

// Mystery Challenge — "Launch Reaction". A drag-race staging tree: three amber
// lights stage, then GREEN. Launch (tap / Space) the instant it turns green.
// Five rounds; a faster reaction scores more. Jumping the start (before green)
// fouls that round for 0. Score = sum of round points, so faster = higher.
const ROUNDS = 5
const MAX_ROUND = 600 // points cap per round

type Light = 'idle' | 'staging' | 'green' | 'result'

export default function LaunchReaction({ onScore }: GameProps) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro')
  const [light, setLight] = useState<Light>('idle')
  const [round, setRound] = useState(0)
  const [scores, setScores] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [amber, setAmber] = useState(0) // how many amber lights lit (0..3)
  const greenAtRef = useRef(0)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  useEffect(() => () => clearTimers(), [])

  const finishGame = useCallback(
    (all: number[]) => {
      clearTimers()
      setPhase('done')
      onScore(all.reduce((a, b) => a + b, 0))
    },
    [onScore],
  )

  const nextRound = useCallback(
    (soFar: number[]) => {
      if (soFar.length >= ROUNDS) {
        finishGame(soFar)
        return
      }
      setScores(soFar)
      setRound(soFar.length + 1)
      setMessage('')
      setAmber(0)
      setLight('staging')

      // Stage three ambers ~500ms apart, then green after a random hold.
      timers.current.push(window.setTimeout(() => setAmber(1), 500))
      timers.current.push(window.setTimeout(() => setAmber(2), 1000))
      timers.current.push(window.setTimeout(() => setAmber(3), 1500))
      const hold = 1800 + Math.random() * 1800
      timers.current.push(
        window.setTimeout(() => {
          setLight('green')
          greenAtRef.current = performance.now()
        }, 1500 + hold),
      )
    },
    [finishGame],
  )

  const launch = useCallback(() => {
    if (phase !== 'playing') return
    if (light === 'staging') {
      // Jumped the start.
      clearTimers()
      setLight('result')
      setMessage('Jumped the start! 0 for this round.')
      const updated = [...scores, 0]
      timers.current.push(window.setTimeout(() => nextRound(updated), 1400))
      return
    }
    if (light === 'green') {
      const reaction = Math.round(performance.now() - greenAtRef.current)
      const pts = Math.max(0, MAX_ROUND - reaction)
      setLight('result')
      setMessage(`${reaction} ms · +${pts}`)
      const updated = [...scores, pts]
      timers.current.push(window.setTimeout(() => nextRound(updated), 1400))
    }
  }, [phase, light, scores, nextRound])

  // Space / tap to launch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        launch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launch])

  const start = () => {
    setPhase('playing')
    setScores([])
    nextRound([])
  }

  if (phase === 'intro') {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="mb-2 font-display text-2xl">Mystery Challenge: Launch Reaction</h3>
        <p className="mx-auto mb-6 max-w-md text-seven-dark/70">
          It’s a drag-race start. Watch the tree — the moment it turns{' '}
          <span className="font-bold text-seven-green">GREEN</span>, launch (tap or press
          Space). Jump early and you foul the round. Five rounds; fastest reactions win.
        </p>
        <button onClick={start} className="rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow">
          Stage the car
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    const total = scores.reduce((a, b) => a + b, 0)
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="font-display text-2xl">Race done</h3>
        <p className="mt-2 text-seven-dark/70">You scored {total} points across {ROUNDS} launches.</p>
      </div>
    )
  }

  const treeColor = (idx: number) =>
    light === 'green' ? 'bg-seven-green' : amber > idx ? 'bg-amber-400' : 'bg-seven-dark/20'

  return (
    <div
      className="cursor-pointer select-none rounded-2xl bg-white p-6 text-center shadow"
      onPointerDown={launch}
    >
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-seven-dark/60">Round {round} / {ROUNDS}</span>
        <span className="text-seven-green">Total {scores.reduce((a, b) => a + b, 0)}</span>
      </div>

      {/* Staging tree */}
      <div className="mx-auto mb-4 flex w-24 flex-col items-center gap-2 rounded-xl bg-seven-dark p-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-8 w-8 rounded-full ${treeColor(i)}`} />
        ))}
        <span
          className={`h-8 w-8 rounded-full ${light === 'green' ? 'bg-seven-green ring-4 ring-seven-green/40' : 'bg-seven-dark/40'}`}
        />
      </div>

      <p className="min-h-[1.5rem] font-display text-lg">
        {light === 'green' && !message ? 'GO!' : message || 'Wait for green…'}
      </p>
      <p className="mt-2 text-xs text-seven-dark/50">Tap anywhere or press Space to launch</p>
    </div>
  )
}
