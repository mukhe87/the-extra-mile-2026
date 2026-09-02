import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameProps } from './PlaceholderGame'

// Extra Mile Bingo: a 5x5 road-trip card (center is FREE). Squares are "called"
// on a timer; tap a called square to mark it before the next call. Completed
// lines (row/column/diagonal) score; a blackout is the jackpot. ~90s or until
// blackout. Score rewards lines + speed (time left).
const SQUARES = [
  'Red light', 'Mile marker', 'Rest stop', 'Semi truck', 'Blue sky',
  'Gas station', 'Road sign', 'Overpass', 'Roadwork', 'Toll booth',
  'Billboard', 'Exit ramp', 'Motorcycle', 'RV', 'Bridge',
  'Detour', 'Speed limit', 'Rest area', 'Tunnel', 'Rail crossing',
  'Scenic view', 'Weigh station', 'Merge', 'School bus',
]
const SIZE = 5
const CENTER = 12 // free space
const CALL_INTERVAL_MS = 2600
const ROUND_MS = 90_000

type Cell = { label: string; called: boolean; marked: boolean; free?: boolean }

function buildCard(): Cell[] {
  const picks = [...SQUARES].sort(() => Math.random() - 0.5).slice(0, 24)
  const cells: Cell[] = []
  let p = 0
  for (let i = 0; i < 25; i++) {
    if (i === CENTER) cells.push({ label: 'FREE', called: true, marked: true, free: true })
    else cells.push({ label: picks[p++], called: false, marked: false })
  }
  return cells
}

const LINES: number[][] = (() => {
  const lines: number[][] = []
  for (let r = 0; r < SIZE; r++) lines.push([...Array(SIZE)].map((_, c) => r * SIZE + c))
  for (let c = 0; c < SIZE; c++) lines.push([...Array(SIZE)].map((_, r) => r * SIZE + c))
  lines.push([...Array(SIZE)].map((_, i) => i * SIZE + i))
  lines.push([...Array(SIZE)].map((_, i) => i * SIZE + (SIZE - 1 - i)))
  return lines
})()

export default function ExtraMileBingo({ onScore }: GameProps) {
  const [cells, setCells] = useState<Cell[]>(useMemo(buildCard, []))
  const [started, setStarted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(ROUND_MS)
  const [linesDone, setLinesDone] = useState(0)
  const endedRef = useRef(false)

  const finish = (marked: number, lines: number, msLeft: number) => {
    if (endedRef.current) return
    endedRef.current = true
    const blackout = marked >= 25
    const score = lines * 200 + (blackout ? 1000 : 0) + Math.round(msLeft / 100)
    onScore(score)
  }

  // Caller: reveals a random uncalled square on an interval.
  useEffect(() => {
    if (!started) return
    const t = setInterval(() => {
      setCells((cs) => {
        const uncalled = cs.map((c, i) => (!c.called ? i : -1)).filter((i) => i >= 0)
        if (uncalled.length === 0) return cs
        const pick = uncalled[Math.floor(Math.random() * uncalled.length)]
        return cs.map((c, i) => (i === pick ? { ...c, called: true } : c))
      })
    }, CALL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [started])

  // Round timer.
  useEffect(() => {
    if (!started) return
    const t = setInterval(() => {
      setTimeLeft((ms) => {
        if (ms <= 100) {
          clearInterval(t)
          return 0
        }
        return ms - 100
      })
    }, 100)
    return () => clearInterval(t)
  }, [started])

  useEffect(() => {
    if (started && timeLeft === 0) {
      const marked = cells.filter((c) => c.marked).length
      finish(marked, linesDone, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, started])

  const mark = (i: number) => {
    setCells((cs) => {
      if (!cs[i].called || cs[i].marked) return cs
      const next = cs.map((c, j) => (j === i ? { ...c, marked: true } : c))
      const completed = LINES.filter((ln) => ln.every((k) => next[k].marked)).length
      setLinesDone(completed)
      const markedCount = next.filter((c) => c.marked).length
      if (markedCount >= 25) finish(markedCount, completed, timeLeft)
      return next
    })
  }

  if (!started) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow">
        <h3 className="mb-2 font-display text-2xl">Extra Mile Bingo</h3>
        <p className="mx-auto mb-6 max-w-md text-seven-dark/70">
          We call road-trip sights one at a time. Tap a square once it’s called to
          mark it. Complete lines to score — mark the whole card for the jackpot.
        </p>
        <button onClick={() => setStarted(true)} className="rounded-full bg-seven-orange px-6 py-3 font-bold text-white shadow">
          Start the trip
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <div className="mb-4 flex items-center justify-between text-sm font-bold">
        <span className="text-seven-green">Lines {linesDone}</span>
        <span className="text-seven-dark/60">⏱ {Math.ceil(timeLeft / 1000)}s</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {cells.map((c, i) => (
          <button
            key={i}
            onClick={() => mark(i)}
            disabled={!c.called || c.marked}
            className={`aspect-square rounded-md p-1 text-[10px] font-bold leading-tight sm:text-xs ${
              c.marked
                ? 'bg-seven-green text-white'
                : c.called
                  ? 'bg-seven-orange/20 text-seven-dark ring-2 ring-seven-orange'
                  : 'bg-seven-dark/5 text-seven-dark/40'
            }`}
          >
            {c.free ? '★ FREE' : c.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-seven-dark/50">
        Highlighted squares have been called — tap to mark.
      </p>
    </div>
  )
}
