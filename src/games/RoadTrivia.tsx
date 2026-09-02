import { useEffect, useMemo, useState } from 'react'
import type { GameProps } from './PlaceholderGame'
import { TRIVIA, type TriviaQuestion } from './data/trivia'

// Road Trivia: 10 random questions. Correct answers score; answering faster
// scores more (a per-question countdown from 100 to 20). Wrong answers score 0
// for that question. Final score is the sum.
const QUESTIONS_PER_ROUND = 10
const MAX_PER_Q = 100
const MIN_PER_Q = 20
const SECONDS_PER_Q = 12

function pickRound(): TriviaQuestion[] {
  return [...TRIVIA].sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_ROUND)
}

export default function RoadTrivia({ onScore }: GameProps) {
  const round = useMemo(pickRound, [])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  // Points available for the current question, ticking down.
  const [available, setAvailable] = useState(MAX_PER_Q)

  // Countdown for the active question — re-armed on each new question.
  useEffect(() => {
    if (done) return
    setAvailable(MAX_PER_Q)
    const step = (MAX_PER_Q - MIN_PER_Q) / (SECONDS_PER_Q * 10)
    const t = setInterval(() => {
      setAvailable((a) => Math.max(MIN_PER_Q, a - step))
    }, 100)
    return () => clearInterval(t)
  }, [idx, done])

  const q = round[idx]

  const choose = (choice: number) => {
    if (picked !== null) return
    setPicked(choice)
    const correct = choice === q.answer
    const gained = correct ? Math.round(available) : 0
    const newScore = score + gained
    setScore(newScore)
    setTimeout(() => {
      if (idx + 1 >= round.length) {
        setDone(true)
        onScore(newScore)
      } else {
        setIdx((i) => i + 1)
        setPicked(null)
      }
    }, 900)
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="font-display text-2xl">Round complete</h3>
        <p className="mt-2 text-seven-dark/70">You scored {score} points. Nicely driven.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-seven-dark/60">
          Question {idx + 1} / {round.length}
        </span>
        <span className="text-seven-green">Score {score}</span>
      </div>

      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-seven-dark/10">
        <div
          className="h-full bg-seven-orange transition-[width] duration-100"
          style={{ width: `${((available - MIN_PER_Q) / (MAX_PER_Q - MIN_PER_Q)) * 100}%` }}
        />
      </div>
      <p className="mb-1 text-xs text-seven-dark/50">Answer fast for more points</p>

      <h3 className="mb-5 font-display text-xl">{q.q}</h3>

      <div className="grid gap-3">
        {q.choices.map((c, i) => {
          const isCorrect = picked !== null && i === q.answer
          const isWrongPick = picked === i && i !== q.answer
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`rounded-xl border-2 px-4 py-3 text-left font-medium transition ${
                isCorrect
                  ? 'border-seven-green bg-seven-green/10'
                  : isWrongPick
                    ? 'border-seven-red bg-seven-red/10'
                    : 'border-seven-dark/10 hover:border-seven-orange'
              }`}
            >
              {c}
            </button>
          )
        })}
      </div>
    </div>
  )
}
