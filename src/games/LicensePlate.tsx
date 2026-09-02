import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameProps } from './PlaceholderGame'

// License Plate Challenge: plates from several states sit on the highway. The
// prompt names a state; tap the matching plate before the 60s round ends. A
// correct tap scores (with a streak bonus) and reshuffles; a wrong tap breaks
// the streak. More plates on screen as you go.
const STATES = [
  'TEXAS', 'OHIO', 'FLORIDA', 'NEVADA', 'ARIZONA', 'GEORGIA',
  'VIRGINIA', 'MAINE', 'OREGON', 'UTAH', 'IDAHO', 'KANSAS',
]
const ROUND_SECONDS = 60

function sample<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

export default function LicensePlate({ onScore }: GameProps) {
  const [started, setStarted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [target, setTarget] = useState('')
  const [plates, setPlates] = useState<string[]>([])
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const endedRef = useRef(false)

  const platesOnBoard = Math.min(4 + Math.floor((ROUND_SECONDS - timeLeft) / 15), 8)

  const deal = useCallback(() => {
    const board = sample(STATES, platesOnBoard)
    const t = board[Math.floor(Math.random() * board.length)]
    setPlates(board)
    setTarget(t)
  }, [platesOnBoard])

  const start = () => {
    setStarted(true)
    setTimeLeft(ROUND_SECONDS)
    setScore(0)
    setStreak(0)
    endedRef.current = false
    deal()
  }

  useEffect(() => {
    if (!started) return
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [started])

  useEffect(() => {
    if (started && timeLeft === 0 && !endedRef.current) {
      endedRef.current = true
      onScore(score)
    }
  }, [started, timeLeft, score, onScore])

  const tap = (plate: string) => {
    if (timeLeft === 0) return
    if (plate === target) {
      const bonus = Math.min(streak, 5) * 10
      setScore((s) => s + 50 + bonus)
      setStreak((k) => k + 1)
      setFlash('hit')
      deal()
    } else {
      setStreak(0)
      setFlash('miss')
    }
    setTimeout(() => setFlash(null), 200)
  }

  if (!started) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="mb-2 font-display text-2xl">License Plate Challenge</h3>
        <p className="mx-auto mb-6 max-w-md text-seven-dark/70">
          Tap the plate that matches the state we call. Keep a streak going for
          bonus points. You’ve got 60 seconds.
        </p>
        <button onClick={start} className="rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow">
          Start driving
        </button>
      </div>
    )
  }

  const ended = timeLeft === 0

  return (
    <div className={`rounded-2xl bg-white p-6 shadow ${flash === 'miss' ? 'ring-4 ring-seven-red/40' : ''}`}>
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-seven-green">Score {score}</span>
        <span className={streak > 1 ? 'text-seven-orange' : 'text-seven-dark/50'}>
          Streak {streak}
        </span>
        <span className="text-seven-dark/60">⏱ {timeLeft}s</span>
      </div>

      {ended ? (
        <div className="py-6 text-center">
          <h3 className="font-display text-2xl">Time!</h3>
          <p className="mt-2 text-seven-dark/70">You scored {score} points.</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-center">
            Find <span className="font-display text-2xl text-seven-red">{target}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {plates.map((p, i) => (
              <button
                key={`${p}-${i}`}
                onClick={() => tap(p)}
                className="rounded-lg border-4 border-seven-dark/70 bg-seven-cream px-2 py-4 font-display text-seven-dark shadow-sm transition hover:-translate-y-0.5"
              >
                <span className="block text-[10px] font-normal tracking-widest text-seven-dark/50">
                  ★ USA ★
                </span>
                {p}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
