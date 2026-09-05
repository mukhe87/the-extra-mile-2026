// Full Throttle — pure game engine. No React here: every function is a pure
// transform over explicit state so the rules stay correct, deterministic, and
// unit-testable. The UI layer (../FullThrottle.tsx) owns timers and rendering.
//
// The game is a car-lane take on the public-domain Crazy Eights family: match
// the top of the discard by lane (color) or by value/symbol; action cards bend
// the turn order. Themed names — Skip = Pit Stop, Reverse = U-Turn, Draw2 = +2,
// plus Wild and Wild +4.

// The four lanes (colors). Kept car-flavored but legible.
export const LANES = ['red', 'blue', 'green', 'yellow'] as const
export type Lane = (typeof LANES)[number]

// Card kinds. Numbers carry a value 0-9; everything else has value null.
export type CardKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

export type Card = {
  id: string
  color: Lane | null // null only for wilds until a lane is chosen at play time
  kind: CardKind
  value: number | null // 0-9 for numbers, null otherwise
}

// Human-facing label for a card's action (UI convenience).
export const KIND_LABEL: Record<Exclude<CardKind, 'number'>, string> = {
  skip: 'Pit Stop',
  reverse: 'U-Turn',
  draw2: '+2',
  wild: 'Wild',
  wild4: 'Wild +4',
}

export type Direction = 1 | -1
export type RNG = () => number // returns a float in [0, 1)

// The whole game as one explicit, serializable value. Seat 0 is always the
// human; seats 1..N are CPU drivers. `discard` is top-of-pile-last.
export type GameState = {
  hands: Card[][]
  drawPile: Card[]
  discard: Card[]
  activeColor: Lane // the lane in force (a wild's chosen lane lives here)
  turn: number // seat index whose turn it is
  direction: Direction
  winner: number | null // seat index once a hand is won, else null
}

// A CPU's decision for its turn: which card to play and, for wilds, the lane.
export type CpuMove = { cardId: string; color: Lane } | null

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) so a seed reproduces a whole game in tests.
// ---------------------------------------------------------------------------
export function makeRng(seed: number): RNG {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fisher-Yates using the supplied RNG. Returns a new array; input untouched.
export function shuffle<T>(items: T[], rng: RNG): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------------------------------------------------------------------------
// Deck: exactly 108 cards.
//   Per lane (×4): one 0, two each of 1-9, two Skip, two Reverse, two +2  = 25
//   Wilds: 4 Wild + 4 Wild +4                                             = 8
//   Total: 25×4 + 8 = 108
// ---------------------------------------------------------------------------
export function buildDeck(): Card[] {
  const deck: Card[] = []
  let n = 0
  const push = (color: Lane | null, kind: CardKind, value: number | null) =>
    deck.push({ id: `c${n++}`, color, kind, value })

  for (const lane of LANES) {
    push(lane, 'number', 0) // a single 0
    for (let v = 1; v <= 9; v++) {
      push(lane, 'number', v)
      push(lane, 'number', v) // two of each 1-9
    }
    for (const kind of ['skip', 'reverse', 'draw2'] as const) {
      push(lane, kind, null)
      push(lane, kind, null) // two of each action
    }
  }
  for (let i = 0; i < 4; i++) push(null, 'wild', null)
  for (let i = 0; i < 4; i++) push(null, 'wild4', null)

  return deck
}

// ---------------------------------------------------------------------------
// Playability: a card matches the active lane, or the top card's value/symbol;
// wilds are always playable.
// ---------------------------------------------------------------------------
export function isPlayable(card: Card, activeColor: Lane, top: Card): boolean {
  if (card.kind === 'wild' || card.kind === 'wild4') return true
  if (card.color === activeColor) return true
  if (card.kind === 'number' && top.kind === 'number') return card.value === top.value
  // Non-number, non-wild actions match their own kind (Pit Stop on Pit Stop…).
  if (card.kind !== 'number' && card.kind === top.kind) return true
  return false
}

// Convenience: the current top-of-discard.
export function topCard(state: GameState): Card {
  return state.discard[state.discard.length - 1]
}

// Does a seat hold any legal play against the current top?
export function hasPlayable(hand: Card[], activeColor: Lane, top: Card): boolean {
  return hand.some((c) => isPlayable(c, activeColor, top))
}

// ---------------------------------------------------------------------------
// Turn advancement: step one (or two, on a skip) seats in the current
// direction, wrapping safely for any seat count.
// ---------------------------------------------------------------------------
export function advanceTurn(
  current: number,
  direction: Direction,
  count: number,
  skipOne: boolean,
): number {
  const steps = skipOne ? 2 : 1
  return (((current + direction * steps) % count) + count) % count
}

// ---------------------------------------------------------------------------
// Drawing: move `n` cards from the draw pile into a seat's hand. When the draw
// pile empties, reshuffle the discard (all but the current top) back into it.
// Pure: returns a fresh state.
// ---------------------------------------------------------------------------
export function drawCards(state: GameState, seat: number, n: number, rng: RNG): GameState {
  let drawPile = state.drawPile.slice()
  let discard = state.discard.slice()
  const hand = state.hands[seat].slice()

  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discard.length <= 1) break // nothing left to recycle; stop drawing
      const keptTop = discard[discard.length - 1]
      drawPile = shuffle(discard.slice(0, -1), rng)
      discard = [keptTop]
    }
    const card = drawPile.pop()
    if (!card) break
    hand.push(card)
  }

  const hands = state.hands.slice()
  hands[seat] = hand
  return { ...state, hands, drawPile, discard }
}

// ---------------------------------------------------------------------------
// applyPlay: seat plays `cardId` (with `chosenColor` for wilds). Resolves the
// card's placement, lane change, direction flip, any forced draw + skip, and
// advances the turn. Returns the fully-advanced state so the UI just re-renders.
//
// House rules kept deliberately simple: effects resolve immediately (no +2/+4
// stacking), and in a 2-seat game U-Turn behaves like a Pit Stop (standard).
// ---------------------------------------------------------------------------
export function applyPlay(
  state: GameState,
  seat: number,
  cardId: string,
  chosenColor: Lane | undefined,
  rng: RNG,
): GameState {
  const hand = state.hands[seat].slice()
  const idx = hand.findIndex((c) => c.id === cardId)
  if (idx === -1) return state // not holding it — no-op guard
  const [card] = hand.splice(idx, 1)

  const hands = state.hands.slice()
  hands[seat] = hand

  // Wilds adopt their chosen lane on the pile so future matches read cleanly.
  const isWild = card.kind === 'wild' || card.kind === 'wild4'
  const laneChoice: Lane = isWild ? (chosenColor ?? state.activeColor) : (card.color as Lane)
  const placed: Card = isWild ? { ...card, color: laneChoice } : card

  const discard = state.discard.concat(placed)
  const seatCount = state.hands.length

  // Direction: U-Turn flips it. In a 2-seat game a flip just returns the turn
  // to the player, so it plays as a skip instead.
  let direction = state.direction
  const twoSeat = seatCount === 2
  if (card.kind === 'reverse' && !twoSeat) direction = (direction * -1) as Direction

  let next: GameState = { ...state, hands, discard, activeColor: laneChoice, direction }

  // Winner check: emptying your hand ends the play immediately.
  if (hand.length === 0) {
    return { ...next, winner: seat }
  }

  // The immediate next seat in the (possibly flipped) direction.
  const nextSeat = advanceTurn(seat, direction, seatCount, false)

  // Forced-draw cards make the next seat draw, then lose their turn.
  const drawN = card.kind === 'draw2' ? 2 : card.kind === 'wild4' ? 4 : 0
  if (drawN > 0) {
    next = drawCards(next, nextSeat, drawN, rng)
    next = { ...next, turn: advanceTurn(seat, direction, seatCount, true) }
    return next
  }

  // Pit Stop (or U-Turn in a 2-seat game) skips the next seat.
  const skips = card.kind === 'skip' || (card.kind === 'reverse' && twoSeat)
  next = { ...next, turn: advanceTurn(seat, direction, seatCount, skips) }
  return next
}

// ---------------------------------------------------------------------------
// CPU heuristic (deterministic given the hand + top): play a matching non-wild
// when possible — preferring an action card, then the highest number — and hold
// wilds until nothing else is legal. When forced to pick a wild's lane, choose
// the lane the CPU holds most of.
// ---------------------------------------------------------------------------
function bestLane(hand: Card[]): Lane {
  const counts = new Map<Lane, number>()
  for (const lane of LANES) counts.set(lane, 0)
  for (const c of hand) if (c.color) counts.set(c.color, (counts.get(c.color) ?? 0) + 1)
  // LANES order is the deterministic tie-break.
  let pick: Lane = LANES[0]
  let max = -1
  for (const lane of LANES) {
    const v = counts.get(lane) ?? 0
    if (v > max) {
      max = v
      pick = lane
    }
  }
  return pick
}

export function cpuChoose(hand: Card[], activeColor: Lane, top: Card): CpuMove {
  const playable = hand.filter((c) => isPlayable(c, activeColor, top))
  if (playable.length === 0) return null

  const nonWild = playable.filter((c) => c.kind !== 'wild' && c.kind !== 'wild4')
  if (nonWild.length > 0) {
    // Actions first (they disrupt opponents), then highest number.
    const ranked = nonWild.slice().sort((a, b) => {
      const aAction = a.kind !== 'number'
      const bAction = b.kind !== 'number'
      if (aAction !== bAction) return aAction ? -1 : 1
      return (b.value ?? 0) - (a.value ?? 0)
    })
    const pick = ranked[0]
    return { cardId: pick.id, color: pick.color as Lane }
  }

  // Only wilds are legal: play one and steer toward our strongest lane.
  const wild = playable[0]
  return { cardId: wild.id, color: bestLane(hand) }
}

// ---------------------------------------------------------------------------
// Scoring: a hand's card value. Numbers = face value; Pit Stop / U-Turn / +2 =
// 20 each; Wild / Wild +4 = 50 each. The hand winner banks the sum of every
// opponent's remaining cards.
// ---------------------------------------------------------------------------
export function cardValue(card: Card): number {
  if (card.kind === 'number') return card.value ?? 0
  if (card.kind === 'wild' || card.kind === 'wild4') return 50
  return 20 // skip / reverse / draw2
}

export function handValue(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardValue(c), 0)
}

// Points the winner banks: the sum across every other seat's hand.
export function bankedForWinner(state: GameState, winnerSeat: number): number {
  return state.hands.reduce(
    (sum, hand, seat) => (seat === winnerSeat ? sum : sum + handValue(hand)),
    0,
  )
}

// ---------------------------------------------------------------------------
// Dealing a fresh hand. Builds + shuffles the deck, deals `handSize` to each of
// `seatCount` seats, and turns up the first non-wild card as the opening
// discard (any opening action is ignored — a common, tidy house rule). Seat 0
// (human) leads.
// ---------------------------------------------------------------------------
export function dealHand(seatCount: number, handSize: number, rng: RNG): GameState {
  const deck = shuffle(buildDeck(), rng)
  const hands: Card[][] = []
  let cursor = 0
  for (let s = 0; s < seatCount; s++) {
    hands.push(deck.slice(cursor, cursor + handSize))
    cursor += handSize
  }

  // Find the first colored card from here on for the opening discard.
  let startIdx = cursor
  while (startIdx < deck.length && deck[startIdx].color === null) startIdx++
  const opener = deck[startIdx]
  // Remaining cards (minus the opener) form the draw pile.
  const rest = deck.slice(cursor).filter((c) => c.id !== opener.id)

  return {
    hands,
    drawPile: rest,
    discard: [opener],
    activeColor: opener.color as Lane,
    turn: 0,
    direction: 1,
    winner: null,
  }
}
