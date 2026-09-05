// The daily game schedule and the Eastern-Time day router.
//
// The event runs Customer Service Week 2026 (Mon Oct 5 - Fri Oct 9). Each
// weekday exposes a fixed set of games; the site picks the set from the
// current day in Eastern Time (the event's timezone, Enon OH), so it switches
// on its own at midnight ET with no one flipping a switch.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'weekend'

export const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  weekend: 'Weekend',
}

// Ordered game slugs per day. Slugs map to entries in games/registry.ts.
export const SCHEDULE: Record<DayKey, string[]> = {
  // Monday's second game slot is pending a new game (the old License Plate
  // Challenge became the all-week hunt at /license-plate). Road Trivia holds
  // Monday for now.
  mon: ['road-trivia'],
  tue: ['extra-mile-bingo', 'roadside-detour'],
  wed: ['muncher', 'fixed-shooter', 'road-crosser', 'snake', 'space-shooter'],
  thu: ['car-racing', 'mystery-challenge'],
  fri: ['car-racing', 'muncher', 'fixed-shooter', 'road-crosser', 'snake', 'space-shooter'],
  weekend: [],
}

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'weekend',
  Sun: 'weekend',
}

const EVENT_TZ = 'America/New_York'

/** The current event day, resolved in Eastern Time. */
export function currentDayKey(now: Date = new Date()): DayKey {
  const forced = import.meta.env.VITE_FORCE_DAY as string | undefined
  if (forced && forced in DAY_LABEL) return forced as DayKey

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TZ,
    weekday: 'short',
  }).format(now)
  return WEEKDAY_TO_KEY[weekday] ?? 'weekend'
}

/** Game slugs available right now. */
export function todaysGameSlugs(now: Date = new Date()): string[] {
  return SCHEDULE[currentDayKey(now)]
}

/** True when a slug is playable on the current day (used to gate game pages). */
export function isSlugAvailableToday(slug: string, now: Date = new Date()): boolean {
  return todaysGameSlugs(now).includes(slug)
}
