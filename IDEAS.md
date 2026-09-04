# The Extra Mile — Idea Backlog

Captured ideas to look into. **Nothing here is built or committed to yet** — these
are proposals with open questions to resolve before any of them becomes real work.
Status legend: 🧭 to research · 🟡 needs decisions · 🟢 ready to build.

---

## Idea 1 — All-Week QR Code License Plate Hunt 🧭

**Replaces the current License Plate Challenge with a physical, all-week scavenger hunt.**

### The concept (as described)
- Create **150 QR codes**:
  - **50** map to the **50 real U.S. state license plates** (the "keepers").
  - **100** map to **duplicate / fake license plates** (the "losers" — they don't count).
- QR codes are **printed and hidden all over the company campus**. Players hunt for
  them during breaks/lunches **all week**.
- A player **scans a QR code with their phone** and **uploads it in the web app**;
  the app **adds that state to their personal collection** (real plates only).
- Goal: **collect all 50 states — or the closest to 50 — to win a big prize.**
- Duplicate/fake plates score nothing.

### How it could work technically
- Each QR encodes a link into the web app, e.g. `…/hunt?code=<token>`, where
  `<token>` is an opaque unguessable ID (not the state name — so players can't
  forge one).
- A `hunt_codes` table maps `token → { kind: 'state' | 'fake', state?: '<XX>' }`.
  50 tokens are real states, 100 are fakes.
- A `hunt_finds` table records `{ player, token, found_at }` (unique on player+token
  so re-scanning the same code doesn't double-count).
- The player's collection = distinct **real** states across their finds. Leaderboard =
  most states collected (ties broken by who reached the count first).
- "Upload the QR image" vs "scan opens a link": scanning a link is far more reliable
  than image-upload + decode. **Recommend: QR opens the app link directly** (phones
  do this natively from the camera). Keep image-upload as a fallback only if needed.

### Open questions to resolve 🟡
1. **Scan-to-link vs image-upload?** Link is simpler and more reliable; Corey's note
   says "upload the QR image." Confirm which experience we want. (Strong lean: link.)
2. **Anti-cheating.** Should a given physical code be claimable by everyone (shared
   hunt) or first-come-first-served? If someone shares a screenshot of a code, anyone
   could claim that state. Options: allow it (simplest), or one-claim-per-code, or
   require being on campus Wi-Fi / a time window.
3. **Names without accounts.** Today players are First+Last with no login. An all-week
   collection needs to reliably tie finds to a person across days/devices. Need a
   lightweight identity (e.g. a code/QR "player pass" saved to their phone, or a
   simple PIN) so a collection persists. **This is the biggest design question.**
4. **Prize / tie rules.** If nobody hits 50, "closest to 50" — how are ties broken?
5. **Physical production.** Who prints the 150 codes and places them? We generate the
   printable QR sheets (PDF), Corey's team places them.
6. **The 100 fakes** — do they need believable fake plate art, or just a "Nice try —
   not a real state!" screen? Cheaper + funnier to just show a loser screen.

### What we'd deliver
- A QR-generator script → printable sheet (150 codes, labeled on the back only).
- The `hunt` page + `hunt_codes`/`hunt_finds` tables + a per-player collection view
  (a 50-state map/grid that fills in) + a hunt leaderboard.
- Admin: see who has what, export, reset.

---

## Idea 2 — Hot Wheels Monopoly (multiplayer) 🧭

**Monday game, replacing the License Plate Challenge slot.**

- A multiplayer, play-against-others board game themed to Hot Wheels.
- Would be the **second head-to-head/multiplayer game** (the car racer is the other).

### Open questions to resolve 🟡
1. **IP / trademark.** "Monopoly" and "Hot Wheels" are trademarks (Hasbro, Mattel).
   For a **public-internet** site this is a real concern. Options: (a) get permission,
   (b) build an **IP-safe reskin** — same mechanic (buy/own spaces, rent, roll-and-move)
   under an original name/theme (e.g. "Extra Mile Motorway" property game). **Lean: reskin.**
2. **Scope.** A full multiplayer Monopoly is a *large* build (turn logic, trading,
   real-time sync for N players, a full board) — realistically the biggest single
   game on the list. Confirm appetite vs. the Oct 2 deadline, or a simplified version
   (shorter board, no trading, timed rounds).
3. **Async vs live?** All players in one live game (like the racer) or drop-in?

---

## Idea 3 — Hot Wheels / 7-Eleven Uno Card Game 🧭

**Add to Wednesday & Friday.**

- A multiplayer card game in the Uno family, themed to Hot Wheels / 7-Eleven.

### Open questions to resolve 🟡
1. **IP / trademark.** "Uno" is a Mattel trademark. Same call as Monopoly — an
   **IP-safe reskin** of the classic matching/last-card mechanic under an original
   name (e.g. "Pit Stop" / "Last Card") avoids the issue. **Lean: reskin.**
2. **Scope.** Real-time multiplayer card game — moderate-to-large build (deck logic,
   turn order, matching rules, bots to fill empty seats, live sync). Smaller than
   Monopoly, still substantial.
3. **Wed & Fri already share the arcade set + the racer.** Confirm whether Uno is an
   *additional* game those days (3 games) or *replaces* one of the current two.

---

## Cross-cutting things to look into
- **Deadline math.** Ideas 2 and 3 are meaningfully larger than anything built so
  far. Against the Oct 2 ready / Oct 5 event date, we likely can't do all three well.
  Worth ranking them and picking what's realistic.
- **Trademark posture (Monopoly / Uno / Hot Wheels).** Decide once: licensed, or
  original reskins of the mechanics. This affects both new card/board games.
- **Persistent player identity.** The QR hunt (and any multi-session progress) needs
  a reliable way to recognize the same player across days without full accounts.
- **Schedule impact.** If the QR hunt is an all-week meta-game and Monopoly takes
  Monday's slot, restate the weekly lineup so it's unambiguous.
