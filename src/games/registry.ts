// The catalog of every game in the event. In Phase 0 every game points at the
// shared placeholder harness so the whole site — day router, name gate,
// leaderboard, scoring — runs end to end. Phases 1-4 replace each `load` with
// the real game while leaving this metadata (and the rest of the app) untouched.

import { lazy, type ComponentType } from 'react'
import PlaceholderGame from './PlaceholderGame'
import type { GameProps } from './PlaceholderGame'
import LicensePlate from './LicensePlate'
import RoadTrivia from './RoadTrivia'
import ExtraMileBingo from './ExtraMileBingo'
import RoadsideDetour from './RoadsideDetour'

// The Phaser arcade games are lazy-loaded so Phaser (~1.5 MB) is fetched only
// when someone opens one of those games, keeping the initial page light. They
// share one async chunk. GamePage wraps game rendering in <Suspense>.
const SnackRun = lazy(() => import('./ArcadeGames').then((m) => ({ default: m.SnackRun })))
const FuelLine = lazy(() => import('./ArcadeGames').then((m) => ({ default: m.FuelLine })))
const CrossInterstate = lazy(() =>
  import('./ArcadeGames').then((m) => ({ default: m.CrossInterstate })),
)
const TrafficBuster = lazy(() => import('./ArcadeGames').then((m) => ({ default: m.TrafficBuster })))
const NightShiftDefender = lazy(() =>
  import('./ArcadeGames').then((m) => ({ default: m.NightShiftDefender })),
)

export type GameMode = 'leaderboard' | 'head-to-head'

export type GameMeta = {
  slug: string
  title: string
  blurb: string
  mode: GameMode
  scoreLabel: string // e.g. "points", "seconds", "miles"
  built: boolean // flips true when the real game replaces the placeholder
  load: ComponentType<GameProps>
}

export const GAMES: Record<string, GameMeta> = {
  'license-plate': {
    slug: 'license-plate',
    title: 'License Plate Challenge',
    blurb: 'Spot state plates on the open road before the timer runs out.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: LicensePlate,
  },
  'road-trivia': {
    slug: 'road-trivia',
    title: 'Road Trivia',
    blurb: 'Customer-service and road-trip trivia, faster answers score higher.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: RoadTrivia,
  },
  'extra-mile-bingo': {
    slug: 'extra-mile-bingo',
    title: 'Extra Mile Bingo',
    blurb: 'Road-trip bingo — mark the squares as they roll by for a line.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: ExtraMileBingo,
  },
  'roadside-detour': {
    slug: 'roadside-detour',
    title: 'Roadside Detour',
    blurb: 'A quick escape-room detour — solve the clues to get back on the road.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: RoadsideDetour,
  },
  muncher: {
    slug: 'muncher',
    title: 'Snack Run',
    blurb: 'Clear the aisle maze of Slurpee cups without getting cornered.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: SnackRun,
  },
  'fixed-shooter': {
    slug: 'fixed-shooter',
    title: 'Traffic Buster',
    blurb: 'Hold the lane and clear the incoming wave — classic fixed-shooter.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: TrafficBuster,
  },
  'road-crosser': {
    slug: 'road-crosser',
    title: 'Cross the Interstate',
    blurb: 'Hop the traffic lanes and rivers to reach the store — one wrong step and it is over.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: CrossInterstate,
  },
  snake: {
    slug: 'snake',
    title: 'Fuel Line',
    blurb: 'Grow the fuel line without crossing yourself.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: FuelLine,
  },
  'space-shooter': {
    slug: 'space-shooter',
    title: 'Night Shift Defender',
    blurb: 'Defend the store through waves — descending fixed-shooter.',
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: true,
    load: NightShiftDefender,
  },
  'car-racing': {
    slug: 'car-racing',
    title: 'The Extra Mile Racer',
    blurb: 'Race the strip head-to-head or chase your own best lap.',
    mode: 'head-to-head',
    scoreLabel: 'seconds',
    built: false,
    load: PlaceholderGame,
  },
  'mystery-challenge': {
    slug: 'mystery-challenge',
    title: 'Mystery Challenge',
    blurb: "A surprise Extra Mile challenge revealed on the day.",
    mode: 'leaderboard',
    scoreLabel: 'points',
    built: false,
    load: PlaceholderGame,
  },
}

export function getGame(slug: string): GameMeta | undefined {
  return GAMES[slug]
}
