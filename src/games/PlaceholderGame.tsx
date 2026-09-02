import { useState } from 'react'

// Shared props every game receives. A game plays, then calls onScore(finalScore)
// exactly once when the round ends. Phase 0 uses this stub so the surrounding
// app (name gate, submission, live leaderboard) is fully exercised before any
// real game exists; each real game will honor the same contract.
export type GameProps = {
  slug: string
  title: string
  scoreLabel: string
  onScore: (score: number) => void
}

export default function PlaceholderGame({ title, scoreLabel, onScore }: GameProps) {
  const [submitted, setSubmitted] = useState(false)

  // A stand-in "round": produces a demo score so the pipeline is testable.
  const playDemoRound = () => {
    const score = Math.floor(Math.random() * 900) + 100
    setSubmitted(true)
    onScore(score)
  }

  return (
    <div className="rounded-2xl border-4 border-dashed border-seven-orange bg-white p-8 text-center">
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-seven-red">
        Preview build
      </p>
      <h3 className="mb-3 text-2xl font-display">{title}</h3>
      <p className="mx-auto mb-6 max-w-md text-seven-dark/70">
        This game is on the schedule and its scoring is already wired to the live
        leaderboard. The playable version drops in during the build — this
        placeholder posts a demo {scoreLabel} score so the flow can be tested end
        to end.
      </p>
      <button
        onClick={playDemoRound}
        disabled={submitted}
        className="rounded-full bg-seven-green px-6 py-3 font-bold text-white shadow disabled:opacity-50"
      >
        {submitted ? 'Score submitted ✓' : `Play demo round`}
      </button>
    </div>
  )
}
