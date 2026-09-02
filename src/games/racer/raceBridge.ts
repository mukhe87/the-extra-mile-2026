// The bridge between the React lobby (which owns Supabase Realtime and match
// state) and the Phaser race scene (which owns the actual driving). The scene
// reads this object from the game registry under the key 'raceBridge'. Keeping
// all networking in React and all gameplay in Phaser means the scene never
// touches Supabase and stays testable on its own.
export type RaceMode = 'solo' | 'versus'

export type RaceBridge = {
  seed: number
  mode: RaceMode
  goal: number
  // scene -> react: called as the local car advances (throttled by the scene)
  onProgress: (pct: number) => void
  // scene -> react: called once when the local car crosses the finish line
  onFinish: (elapsedMs: number, points: number) => void
  // react -> scene: latest opponent progress (0..1), or -1 when not applicable
  opponentPct: () => number
  // react -> scene: opponent's finish, or null if not finished
  opponentResult: () => { points: number } | null
}

// Deterministic PRNG so a shared seed yields an identical obstacle course for
// both racers (fair head-to-head regardless of latency).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash a room code to a stable numeric seed. */
export function seedFromCode(code: string): number {
  let h = 2166136261
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Points from finish time — faster is higher, to fit the highest-first leaderboard. */
export function racePoints(elapsedMs: number): number {
  return Math.max(0, Math.round(10000 - elapsedMs / 6))
}

export const RACE_GOAL = 4000
