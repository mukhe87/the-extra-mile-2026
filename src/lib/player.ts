// Player identity is just a first + last name, remembered in the browser so a
// player isn't re-prompted every game during the event. No accounts, no auth.

export type Player = { firstName: string; lastName: string }

const KEY = 'extra-mile-player'

export function getPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Player
    if (p && p.firstName && p.lastName) return p
    return null
  } catch {
    return null
  }
}

export function setPlayer(p: Player): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* private mode / storage disabled — the app still works for this session */
  }
}

export function clearPlayer(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function fullName(p: Player): string {
  return `${p.firstName} ${p.lastName}`.trim()
}
