import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GameProps } from './PlaceholderGame'
import {
  advanceTurn,
  applyPlay,
  bankedForWinner,
  cpuChoose,
  dealHand,
  drawCards,
  hasPlayable,
  isPlayable,
  KIND_LABEL,
  LANES,
  makeRng,
  topCard,
  type Card,
  type GameState,
  type Lane,
  type RNG,
} from './fullThrottle/engine'

// Full Throttle — a car-lane, Crazy-Eights-style card game, SOLO vs CPU. The
// engine (./fullThrottle/engine) holds all the rules; this file owns the table
// UI, the human's turn, and the timed CPU turns.

// --- Tunables -------------------------------------------------------------
const DEFAULT_CPU = 3 // CPU drivers by default → 4 seats
const MIN_CPU = 1
const MAX_CPU = 9 // 10 seats max
const HANDS_PER_SESSION = 3 // banked-points session length
const STARTING_HAND = 7 // cards dealt to each seat
const CPU_TURN_MS = 900 // pause before a CPU acts, so the human can watch

// Lane card-face styling. These are card art (not brand chrome), so four
// distinct, legible lane colors — brand tokens stay on the page furniture.
const LANE_STYLE: Record<Lane, { bg: string; text: string; label: string }> = {
  red: { bg: '#EE1C25', text: '#fff', label: 'Red' },
  blue: { bg: '#1D5FA8', text: '#fff', label: 'Blue' },
  green: { bg: '#008061', text: '#fff', label: 'Green' },
  yellow: { bg: '#F6C700', text: '#101820', label: 'Yellow' },
}

function cardFace(card: Card): string {
  if (card.kind === 'number') return String(card.value)
  return KIND_LABEL[card.kind]
}

// A single rendered card. Wilds (no lane) get a neutral dark face.
function CardView({
  card,
  onClick,
  playable,
  small,
}: {
  card: Card
  onClick?: () => void
  playable?: boolean
  small?: boolean
}) {
  const style = card.color ? LANE_STYLE[card.color] : { bg: '#101820', text: '#fff', label: '' }
  const size = small ? 'h-16 w-11 text-xs' : 'h-24 w-16 text-sm'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${card.color ? LANE_STYLE[card.color].label + ' ' : ''}${cardFace(card)}`}
      style={{ backgroundColor: style.bg, color: style.text }}
      className={`${size} flex shrink-0 items-center justify-center rounded-xl px-1 text-center font-display leading-tight shadow transition ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${playable ? 'ring-4 ring-seven-orange -translate-y-2' : 'ring-1 ring-black/10'}`}
    >
      {cardFace(card)}
    </button>
  )
}

// Facedown card back for opponent hands / the draw pile.
function CardBack({ small }: { small?: boolean }) {
  const size = small ? 'h-16 w-11' : 'h-24 w-16'
  return (
    <div
      aria-hidden
      className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-seven-dark text-seven-line shadow ring-1 ring-black/10`}
    >
      <span className="font-display text-lg">FT</span>
    </div>
  )
}

type Phase = 'setup' | 'playing' | 'handOver' | 'sessionOver'

export default function FullThrottle({ onScore }: GameProps) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [cpuCount, setCpuCount] = useState(DEFAULT_CPU)
  const [state, setState] = useState<GameState | null>(null)
  const [scores, setScores] = useState<number[]>([]) // cumulative, per seat
  const [handIndex, setHandIndex] = useState(0)
  const [pickingWild, setPickingWild] = useState<string | null>(null) // card id awaiting a lane
  const [awaitingPass, setAwaitingPass] = useState(false) // human drew, must play-or-pass
  const [message, setMessage] = useState('')

  // Session-scoped RNG (mutable closure) lives in a ref so it persists across
  // hands and re-renders. Reseeded when a new session begins.
  const rngRef = useRef<RNG>(makeRng(Date.now()))
  const cpuTimer = useRef<number | undefined>(undefined)
  const scoredRef = useRef(false) // guards the single onScore call

  const seatCount = cpuCount + 1

  const clearCpuTimer = () => {
    if (cpuTimer.current !== undefined) {
      clearTimeout(cpuTimer.current)
      cpuTimer.current = undefined
    }
  }
  useEffect(() => () => clearCpuTimer(), [])

  // Begin a hand: deal and reset per-hand UI flags.
  const startHand = useCallback(
    (seats: number) => {
      setState(dealHand(seats, STARTING_HAND, rngRef.current))
      setAwaitingPass(false)
      setPickingWild(null)
      setMessage('')
      setPhase('playing')
    },
    [],
  )

  // Begin a whole session from the seat picker.
  const startSession = () => {
    rngRef.current = makeRng(Date.now())
    scoredRef.current = false
    setScores(new Array(cpuCount + 1).fill(0))
    setHandIndex(0)
    startHand(cpuCount + 1)
  }

  // Resolve a completed hand: bank points to the winner, then either advance to
  // the next hand or end the session.
  const finishHand = useCallback(
    (finished: GameState) => {
      clearCpuTimer()
      const winner = finished.winner as number
      const banked = bankedForWinner(finished, winner)
      setScores((prev) => {
        const next = prev.slice()
        next[winner] += banked
        return next
      })
      setMessage(
        winner === 0
          ? `You went out! You bank ${banked} points.`
          : `Driver ${winner} went out. They bank ${banked} points.`,
      )
      setPhase('handOver')
    },
    [],
  )

  // Apply a play from any seat. The winner-watch effect below routes to
  // hand-end; here we only advance the state.
  const commitPlay = useCallback(
    (from: GameState, seat: number, cardId: string, color: Lane | undefined) => {
      setState(applyPlay(from, seat, cardId, color, rngRef.current))
    },
    [],
  )

  // --- Winner watch: whenever a play empties a hand, resolve the hand once. ---
  useEffect(() => {
    if (phase === 'playing' && state && state.winner !== null) finishHand(state)
  }, [phase, state, finishHand])

  // --- CPU turns: fire on a short timer whenever it's a CPU seat's turn. -----
  useEffect(() => {
    if (phase !== 'playing' || !state || state.winner !== null) return
    if (state.turn === 0) return // human's turn — handled by clicks

    clearCpuTimer()
    cpuTimer.current = window.setTimeout(() => {
      setState((cur) => {
        if (!cur || cur.winner !== null || cur.turn === 0) return cur
        const seat = cur.turn
        const move = cpuChoose(cur.hands[seat], cur.activeColor, topCard(cur))
        if (move) return applyPlay(cur, seat, move.cardId, move.color, rngRef.current)
        // No legal play: draw one, then play it if it's now legal, else pass.
        const drawn = drawCards(cur, seat, 1, rngRef.current)
        const move2 = cpuChoose(drawn.hands[seat], drawn.activeColor, topCard(drawn))
        if (move2) return applyPlay(drawn, seat, move2.cardId, move2.color, rngRef.current)
        return {
          ...drawn,
          turn: advanceTurn(seat, drawn.direction, drawn.hands.length, false),
        }
      })
    }, CPU_TURN_MS)

    return clearCpuTimer
  }, [phase, state])

  // --- Session end: submit the human's banked total exactly once. -----------
  useEffect(() => {
    if (phase === 'handOver' && handIndex + 1 >= HANDS_PER_SESSION) {
      setPhase('sessionOver')
    }
  }, [phase, handIndex])

  useEffect(() => {
    if (phase === 'sessionOver' && !scoredRef.current) {
      scoredRef.current = true
      onScore(scores[0] ?? 0)
    }
  }, [phase, scores, onScore])

  // --- Human actions --------------------------------------------------------
  const human = state?.hands[0] ?? []
  const top = state ? topCard(state) : null
  const humanTurn = phase === 'playing' && state?.turn === 0 && state?.winner === null
  const humanHasPlay = useMemo(
    () => (state && top ? hasPlayable(human, state.activeColor, top) : false),
    [state, human, top],
  )

  const playHumanCard = (card: Card) => {
    if (!state || !humanTurn) return
    if (card.kind === 'wild' || card.kind === 'wild4') {
      setPickingWild(card.id) // need a lane first
      return
    }
    setAwaitingPass(false)
    commitPlay(state, 0, card.id, undefined)
  }

  const chooseWildLane = (lane: Lane) => {
    if (!state || pickingWild === null) return
    const id = pickingWild
    setPickingWild(null)
    setAwaitingPass(false)
    commitPlay(state, 0, id, lane)
  }

  const humanDraw = () => {
    if (!state || !humanTurn) return
    const drawn = drawCards(state, 0, 1, rngRef.current)
    setState(drawn)
    const newest = drawn.hands[0][drawn.hands[0].length - 1]
    if (newest && isPlayable(newest, drawn.activeColor, topCard(drawn))) {
      setAwaitingPass(true)
      setMessage('You drew a playable card — play it or pass.')
    } else {
      setAwaitingPass(true)
      setMessage('No play — pass to continue.')
    }
  }

  const humanPass = () => {
    if (!state || !humanTurn) return
    setAwaitingPass(false)
    setMessage('')
    setState({ ...state, turn: advanceTurn(0, state.direction, state.hands.length, false) })
  }

  const nextHand = () => {
    setHandIndex((i) => i + 1)
    startHand(seatCount)
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  if (phase === 'setup') {
    return (
      <div className="rounded-2xl bg-white p-6 shadow">
        <h3 className="mb-1 font-display text-2xl">Full Throttle</h3>
        <p className="mb-5 text-seven-dark/70">
          Match the top card by lane or number, drop action cards to shake up the
          grid, and be first to empty your hand. Best banked total over{' '}
          {HANDS_PER_SESSION} hands wins.
        </p>
        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-seven-dark/70">
            CPU drivers: {cpuCount} ({seatCount} seats)
          </label>
          <input
            type="range"
            min={MIN_CPU}
            max={MAX_CPU}
            value={cpuCount}
            onChange={(e) => setCpuCount(Number(e.target.value))}
            className="w-full accent-seven-orange"
            aria-label="Number of CPU drivers"
          />
          <div className="mt-1 flex justify-between text-xs text-seven-dark/50">
            <span>{MIN_CPU}</span>
            <span>{MAX_CPU}</span>
          </div>
        </div>
        <button
          onClick={startSession}
          className="rounded-full bg-seven-green px-6 py-3 font-bold text-white shadow"
        >
          Start engines
        </button>
      </div>
    )
  }

  if (!state || !top) return null

  const activeStyle = LANE_STYLE[state.activeColor]

  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      {/* Status bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
        <span className="text-seven-dark/60">
          Hand {handIndex + 1} / {HANDS_PER_SESSION}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-seven-dark/60">Lane</span>
          <span
            className="inline-block h-4 w-4 rounded-full ring-1 ring-black/20"
            style={{ backgroundColor: activeStyle.bg }}
            aria-label={`Active lane ${activeStyle.label}`}
          />
          <span className="text-seven-dark/60">
            {state.direction === 1 ? 'order →' : 'order ←'}
          </span>
        </span>
        <span className="text-seven-green">You: {scores[0] ?? 0} pts</span>
      </div>

      {/* Opponent seats */}
      <div className="mb-5 flex flex-wrap gap-3">
        {state.hands.slice(1).map((hand, i) => {
          const seat = i + 1
          const isTurn = state.turn === seat && state.winner === null
          return (
            <div
              key={seat}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                isTurn ? 'bg-seven-orange/15 ring-2 ring-seven-orange' : 'bg-seven-dark/5'
              }`}
            >
              <CardBack small />
              <div className="text-xs">
                <div className="font-bold">Driver {seat}</div>
                <div className="text-seven-dark/60">{hand.length} cards</div>
                <div className="text-seven-green">{scores[seat] ?? 0} pts</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table centre: draw pile + discard top */}
      <div className="mb-6 flex items-center justify-center gap-8">
        <div className="text-center">
          <button
            type="button"
            onClick={humanDraw}
            disabled={!humanTurn || humanHasPlay || awaitingPass}
            aria-label="Draw a card"
            className="disabled:opacity-50"
          >
            <CardBack />
          </button>
          <div className="mt-1 text-xs text-seven-dark/60">
            Draw ({state.drawPile.length})
          </div>
        </div>
        <div className="text-center">
          <CardView card={top} />
          <div className="mt-1 text-xs text-seven-dark/60">Discard</div>
        </div>
      </div>

      {/* Wild lane picker */}
      {pickingWild !== null && (
        <div className="mb-5 rounded-xl bg-seven-cream p-4 text-center">
          <p className="mb-3 text-sm font-bold">Pick a lane</p>
          <div className="flex justify-center gap-3">
            {LANES.map((lane) => (
              <button
                key={lane}
                onClick={() => chooseWildLane(lane)}
                aria-label={`Choose ${LANE_STYLE[lane].label} lane`}
                style={{ backgroundColor: LANE_STYLE[lane].bg }}
                className="h-10 w-10 rounded-full shadow ring-1 ring-black/20"
              />
            ))}
          </div>
        </div>
      )}

      {/* Turn / message line */}
      <p className="mb-2 min-h-5 text-center text-sm font-bold text-seven-dark/70">
        {message ||
          (humanTurn
            ? humanHasPlay
              ? 'Your turn — play a lit card.'
              : 'Your turn — no play, draw a card.'
            : `Driver ${state.turn} is driving…`)}
      </p>

      {/* Human hand */}
      <div className="flex flex-wrap justify-center gap-2">
        {human.map((card) => {
          const playable = humanTurn && isPlayable(card, state.activeColor, top)
          return (
            <CardView
              key={card.id}
              card={card}
              playable={playable}
              onClick={playable ? () => playHumanCard(card) : undefined}
            />
          )
        })}
      </div>

      {/* Pass control after a forced draw */}
      {humanTurn && awaitingPass && (
        <div className="mt-4 text-center">
          <button
            onClick={humanPass}
            className="rounded-full bg-seven-green px-6 py-3 font-bold text-white shadow"
          >
            Pass
          </button>
        </div>
      )}

      {/* Hand-over panel */}
      {phase === 'handOver' && (
        <div className="mt-6 rounded-2xl bg-seven-cream p-6 text-center">
          <h3 className="font-display text-xl">Hand complete</h3>
          <p className="mt-2 text-seven-dark/70">{message}</p>
          <button
            onClick={nextHand}
            className="mt-4 rounded-full bg-seven-green px-6 py-3 font-bold text-white shadow"
          >
            Next hand
          </button>
        </div>
      )}

      {/* Session-over panel */}
      {phase === 'sessionOver' && (
        <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow">
          <h3 className="font-display text-2xl">Session complete</h3>
          <p className="mt-2 text-seven-dark/70">
            You banked {scores[0] ?? 0} points over {HANDS_PER_SESSION} hands. Nicely
            driven.
          </p>
          <button
            onClick={() => setPhase('setup')}
            className="mt-4 rounded-full bg-seven-green px-6 py-3 font-bold text-white shadow"
          >
            New session
          </button>
        </div>
      )}
    </div>
  )
}
