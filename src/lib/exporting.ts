import * as XLSX from 'xlsx'
import { GAMES } from '../games/registry'
import { rankBestPerPlayer, overallStandings, type ScoreRow } from './scores'
import { TOTAL_STATES, stateName, type HuntStanding } from './hunt'
import type { DayKey } from './schedule'

// Reports are split by the day a score was actually played (Eastern Time), not
// by the game's scheduled day — so games that appear on two days (e.g. the
// arcade set on Wed and Fri) never get mixed between those days' reports.
const ET = 'America/New_York'
const SHORT_TO_KEY: Record<string, DayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'weekend',
  Sun: 'weekend',
}

export function etWeekday(iso: string): DayKey {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: ET, weekday: 'short' }).format(new Date(iso))
  return SHORT_TO_KEY[s] ?? 'weekend'
}

function etDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

function gameTitle(slug: string): string {
  return GAMES[slug]?.title ?? slug
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10)
}

// A flat sheet of plays, each row carrying the Game name next to the score.
function scoresSheet(rows: ScoreRow[]) {
  const sorted = [...rows].sort(
    (a, b) => gameTitle(a.game_slug).localeCompare(gameTitle(b.game_slug)) || b.score - a.score,
  )
  return XLSX.utils.json_to_sheet(
    sorted.map((r) => ({
      Game: gameTitle(r.game_slug),
      'First Name': r.first_name,
      'Last Name': r.last_name,
      Score: r.score,
      'Submitted (ET)': etDateTime(r.created_at),
    })),
  )
}

// One ranked sheet per game that has data in these rows (best score per player).
function appendPerGameSheets(wb: XLSX.WorkBook, rows: ScoreRow[]) {
  for (const slug of Object.keys(GAMES)) {
    const gameRows = rows.filter((r) => r.game_slug === slug)
    if (gameRows.length === 0) continue
    const ranked = rankBestPerPlayer(gameRows).map((e) => ({
      Rank: e.rank,
      'First Name': e.firstName,
      'Last Name': e.lastName,
      'Best Score': e.score,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ranked), gameTitle(slug).slice(0, 31))
  }
}

/** Download a report for a single weekday (only scores played that day, ET). */
export function downloadDayReport(rows: ScoreRow[], day: DayKey, dayLabel: string): number {
  const dayRows = rows.filter((r) => etWeekday(r.created_at) === day)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, scoresSheet(dayRows), 'Scores')
  appendPerGameSheets(wb, dayRows)
  XLSX.writeFile(wb, `extra-mile-${dayLabel.toLowerCase()}-${stamp()}.xlsx`)
  return dayRows.length
}

/** Download the full-week workbook: Overall standings, All Scores, per-game. */
export function downloadFullReport(rows: ScoreRow[]): void {
  const wb = XLSX.utils.book_new()
  const overall = overallStandings(rows).map((e) => ({
    Rank: e.rank,
    'First Name': e.firstName,
    'Last Name': e.lastName,
    'Total Points': e.totalBest,
    'Games Played': e.gamesPlayed,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overall), 'Overall')
  XLSX.utils.book_append_sheet(wb, scoresSheet(rows), 'All Scores')
  appendPerGameSheets(wb, rows)
  XLSX.writeFile(wb, `extra-mile-full-week-${stamp()}.xlsx`)
}

/**
 * Download the License Plate Challenge standings: a ranked summary plus each
 * player's collected states. `states` is out of TOTAL_STATES (50).
 */
export function downloadHuntReport(standings: HuntStanding[]): void {
  const wb = XLSX.utils.book_new()
  const summary = standings.map((s, i) => ({
    Rank: i + 1,
    'First Name': s.firstName,
    'Last Name': s.lastName,
    Username: s.username,
    States: s.states,
    'Out Of': TOTAL_STATES,
    Complete: s.states >= TOTAL_STATES ? 'Yes' : 'No',
    'Last Collected (ET)': s.lastAt ? etDateTime(s.lastAt) : '',
    'States Collected': s.stateList.map((c) => `${c} (${stateName(c)})`).join(', '),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'License Plate')
  XLSX.writeFile(wb, `extra-mile-license-plate-${stamp()}.xlsx`)
}

/**
 * Download a backup of exactly what a reset is about to delete: all rows, or a
 * single game's rows. Used by the "Save to Excel, then delete" option.
 */
export function downloadBackup(rows: ScoreRow[], scope: string): void {
  const subset = scope === '__all__' ? rows : rows.filter((r) => r.game_slug === scope)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, scoresSheet(subset), 'Scores')
  appendPerGameSheets(wb, subset)
  const tag = scope === '__all__' ? 'all' : scope
  XLSX.writeFile(wb, `extra-mile-backup-${tag}-${stamp()}.xlsx`)
}
