// Tracks whether the current tab has unlocked the admin panel, so game pages can
// tell (e.g. to reword the "not on today's schedule" note into an admin preview).
// Session-scoped: clears when the tab closes.
const KEY = 'extra-mile-admin'

export function setAdmin(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    /* private mode — the panel still works for this session */
  }
}

export function isAdmin(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
