import { useEffect, useRef, useState } from 'react'
import type { GameProps } from './PlaceholderGame'

// Roadside Detour: a short 3-step escape-room detour. Your route is blocked;
// solve each puzzle to advance. Score = time remaining when you get back on the
// road (faster = higher), with a penalty per wrong guess. 4-minute cap.
const ROUND_SECONDS = 240
const WRONG_PENALTY = 15

type Step = {
  title: string
  prompt: string
  hint: string
  check: (answer: string) => boolean
}

const STEPS: Step[] = [
  {
    title: 'The Locked Gate',
    prompt:
      'A sign reads: “The code is the number of hours 7-Eleven was originally open each day.” Enter the code.',
    hint: 'Open 7 a.m. to 11 p.m. — how many hours is that?',
    check: (a) => a.trim() === '16',
  },
  {
    title: 'The Fork in the Road',
    prompt:
      'Two roads. One sign: “Take the direction that means the opposite of LEFT, then the opposite of STOP.” Type both words, separated by a space.',
    hint: 'Opposite of left… opposite of stop…',
    check: (a) => a.trim().toLowerCase().replace(/\s+/g, ' ') === 'right go',
  },
  {
    title: 'The Final Mile',
    prompt:
      'Unscramble the detour password: “ARTXE ELIM”. Type it correctly (two words).',
    hint: 'It’s the whole event’s name.',
    check: (a) => a.trim().toLowerCase().replace(/\s+/g, ' ') === 'extra mile',
  },
]

export default function RoadsideDetour({ onScore }: GameProps) {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [answer, setAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [wrong, setWrong] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [error, setError] = useState(false)
  const [done, setDone] = useState(false)
  const endedRef = useRef(false)

  useEffect(() => {
    if (!started || done) return
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
  }, [started, done])

  useEffect(() => {
    if (started && timeLeft === 0 && !endedRef.current) {
      endedRef.current = true
      setDone(true)
      onScore(0) // ran out of time
    }
  }, [started, timeLeft, onScore])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (STEPS[step].check(answer)) {
      setError(false)
      setShowHint(false)
      setAnswer('')
      if (step + 1 >= STEPS.length) {
        endedRef.current = true
        setDone(true)
        const score = Math.max(0, timeLeft * 10 - wrong * WRONG_PENALTY)
        onScore(score)
      } else {
        setStep((s) => s + 1)
      }
    } else {
      setWrong((w) => w + 1)
      setError(true)
    }
  }

  if (!started) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="mb-2 font-display text-2xl">Roadside Detour</h3>
        <p className="mx-auto mb-6 max-w-md text-seven-dark/70">
          Your route is blocked. Solve three quick puzzles to get back on the road.
          The faster you escape, the higher your score.
        </p>
        <button onClick={() => setStarted(true)} className="rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow">
          Start the detour
        </button>
      </div>
    )
  }

  if (done) {
    const escaped = timeLeft > 0
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="font-display text-2xl">{escaped ? 'Back on the road!' : 'Out of time'}</h3>
        <p className="mt-2 text-seven-dark/70">
          {escaped
            ? `You escaped with ${timeLeft}s to spare and ${wrong} wrong turn(s).`
            : 'The detour beat the clock this time.'}
        </p>
      </div>
    )
  }

  const s = STEPS[step]
  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-seven-dark/60">
          Puzzle {step + 1} / {STEPS.length}
        </span>
        <span className="text-seven-dark/60">
          ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </span>
      </div>
      <h3 className="mb-2 font-display text-xl">{s.title}</h3>
      <p className="mb-4 text-seven-dark/80">{s.prompt}</p>
      <form onSubmit={submit}>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className={`mb-3 w-full rounded-lg border-2 px-3 py-2 focus:outline-none ${
            error ? 'border-seven-red' : 'border-seven-dark/15 focus:border-seven-orange'
          }`}
          placeholder="Your answer"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-seven-red">Not quite — try again.</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-full bg-seven-green px-5 py-2.5 font-bold text-white">
            Submit
          </button>
          <button
            type="button"
            onClick={() => setShowHint(true)}
            className="text-sm font-bold text-seven-orange"
          >
            Need a hint?
          </button>
        </div>
      </form>
      {showHint && <p className="mt-3 text-sm italic text-seven-dark/60">Hint: {s.hint}</p>}
    </div>
  )
}
