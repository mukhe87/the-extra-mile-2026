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
- The web app has an **Upload / Scan button**. A player **scans or uploads a QR code
  with their phone**; if the code is one of the **50 real states**, it's **saved under
  their profile and added to their collection**. Fake/duplicate codes are **losers**
  and add nothing.
- Goal: **collect all 50 states — or the closest to 50 — to win a big prize.**
- **The Excel export gets a new "Collection" sheet** showing each player and which of
  the 50 states they've collected (and their total).

### How it could work technically
- Each QR encodes a link into the web app, e.g. `…/hunt?code=<token>`, where
  `<token>` is an **opaque, unguessable ID** — never the state name — so players can't
  forge one or guess the other codes.
- A `hunt_codes` table maps `token → { kind: 'state' | 'fake', state?: '<XX>' }`.
  50 tokens are real states, 100 are fakes.
- A `hunt_finds` table records `{ profile_id, token, found_at }`, unique on
  `(profile_id, token)` so re-scanning the same physical code never double-counts.
- A player's collection = the distinct **real** states across their finds. Hunt
  leaderboard = most states collected (ties broken by who reached that count first).
- **Upload button, two modes:**
  1. **Scan (recommended):** the phone camera opens the QR's link straight into the
     app and it records the find. Most reliable — no image decoding needed.
  2. **Upload image (as asked):** a file/camera input where the player submits a photo
     of the QR; the app decodes it in-browser (e.g. a small QR-reader library) and
     records the find. Keep this as the fallback path; decoding photos is less reliable
     than a direct scan (lighting, blur, angle).
- **Fakes** don't need real plate art — a "Nice try — not a real state!" result screen
  is cheaper and funnier. Real states can show the state name + a plate graphic.

### Open questions to resolve 🟡
1. **Anti-cheating / shared codes.** If someone photographs a code and texts it around,
   anyone could claim that state without finding it. Options: (a) allow it (simplest —
   it's a friendly event), (b) first-scan-only per physical code, (c) require campus
   Wi-Fi or a per-code time window. Pick a posture.
2. **Prize / tie rules.** If nobody hits all 50, "closest to 50" — how are ties broken
   (earliest to reach the count? total scans?).
3. **Physical production.** We generate printable QR sheets (a PDF, codes labeled on the
   back only so the state isn't visible); Corey's team prints + places the 150 codes.
4. **State art.** Do we want per-state plate graphics in the collection view, or just
   state names/abbreviations to start? (Art is a nice-to-have, not required to ship.)

### What we'd deliver
- A QR-generator script → printable sheet (150 codes) + a private key list mapping each
  printed code to what it is (for Corey's records).
- The `hunt` page + Upload/Scan button + `hunt_codes` / `hunt_finds` tables.
- A per-player **collection view** — a 50-state grid/map that fills in as you collect.
- Hunt leaderboard + the new **Collection sheet** in the Excel export + admin reset.

---

## Idea 1a — Player Profiles (foundational — the QR hunt needs this) 🟡

Corey's note: *"set up a profile for each player/user … so this new game option can be
saved under each individual's profile and data does not get mixed up. Come up with a
good solution."* Today the site has **no accounts** — players just type First + Last per
play, so there's nothing that reliably ties an all-week collection to one person across
days and devices. Two "John Smith"s would collide. So profiles are a prerequisite for
the QR hunt, and useful for every game.

### Recommended solution — a lightweight "Player Pass" (no passwords, no PII)
1. **First visit:** player enters First + Last (as today). We create a `profiles` row
   and generate a short, friendly **Player Pass code** (e.g. `EXTRA-4F7Q`).
2. **Stays signed in on that device:** the pass is saved in the browser
   (`localStorage`), so on their own phone they're just "them" every time — no
   re-entry.
3. **Use another device / cleared browser:** they enter their Player Pass code (or
   First+Last + pass) to re-attach to the same profile. We can also show the pass as a
   personal QR they can screenshot and scan to log in on any device.
4. **All game data (scores + hunt finds) is keyed to `profile_id`,** not to a raw typed
   name — so nothing gets mixed up even with duplicate names.

**Why this over the alternatives:**
- *Email / employee-ID login* = stronger identity but more friction and it collects PII
  (privacy considerations for employees). Overkill for a one-week internal event.
- *Name-only (today)* = zero friction but can't reliably persist a week-long collection
  or separate duplicate names. Not enough for the hunt.
- The Player Pass is the balance: near-zero friction, works cross-device, no passwords,
  no PII beyond the name they already give.

### Open questions 🟡
- Optional **employee ID** field if Corey wants stronger identity / to match to staff.
- **Migration:** existing scores are keyed to raw names. We'd map them to profiles or
  start profiles fresh (fine, since the DB was reset for the real event).
- **Scope flag:** this is a real change to the current no-account model — it touches
  score submission, the leaderboard, and the export. Meaningful but very doable.

---

## Idea 2 — Hot Wheels Monopoly (multiplayer) 🧭

**Monday game, replacing the License Plate Challenge slot.**

- A multiplayer, play-against-others board game themed to Hot Wheels.
- Would be the **second multiplayer game** (the car racer is the other).

### Open questions to resolve 🟡
1. **IP / trademark.** "Monopoly" and "Hot Wheels" are trademarks (Hasbro, Mattel).
   For a **public-internet** site this is a real concern. Options: (a) get permission,
   (b) build an **IP-safe reskin** — same mechanic (buy/own spaces, rent, roll-and-move)
   under an original name/theme (e.g. "Extra Mile Motorway"). **Lean: reskin.**
2. **Scope.** A full multiplayer Monopoly is the *largest* build on the list (turn
   logic, trading, real-time sync for N players, a full board). Confirm appetite vs. the
   Oct 2 deadline, or agree a simplified version (shorter board, no trading, timed).
3. **Async vs live?** All players in one live game (like the racer) or drop-in?

---

## Idea 3 — Hot Wheels / 7-Eleven Uno Card Game 🧭

**Add to Wednesday & Friday.**

- A multiplayer card game in the Uno family, themed to Hot Wheels / 7-Eleven.

### Open questions to resolve 🟡
1. **IP / trademark.** "Uno" is a Mattel trademark. Same call as Monopoly — an
   **IP-safe reskin** of the classic matching / last-card mechanic under an original
   name (e.g. "Pit Stop" / "Last Card") avoids it. **Lean: reskin.**
2. **Scope.** Real-time multiplayer card game — moderate-to-large build (deck logic,
   turn order, matching rules, bots to fill seats, live sync). Smaller than Monopoly,
   still substantial.
3. **Wed & Fri already run the arcade set + the racer.** Confirm whether Uno is an
   *additional* game those days (3 games) or *replaces* one of the current two.

---

## Idea 4 — Week-long Online Escape Room Challenge 🧭

**A big headline game with a big prize — themed to The Extra Mile / Hot Wheels.**

### The concept (as described)
- A **very hard, very challenging** online escape room, played over the week.
- **One attempt per player per day.** Pressing **Start** begins a **3-hour timer**. If
  they run out of time before finishing, they're **locked out until the next day** and
  can try again then.
- **First person to fully beat it = grand winner** (big prize), then **2nd** and **3rd**.
- A **0%–100% progress ranking board**: shows how close each player is to finishing —
  even players who *didn't* finish still appear, ranked by how far they got. Whoever is
  closest to 100% sits on top. If a new player beats the standing best %, **their name
  moves to the top and the previous leader drops to 2nd, 3rd, etc.**

### The 0–100% progress board is shared with the License Plate hunt
Corey: this same progress ranking board should also drive the **License Plate Challenge
(QR hunt)** — there, progress % = states collected ÷ 50. So build the **progress board
as one reusable component** that both the Escape Room and the hunt feed into (and it can
serve any future "% toward a goal" game). It's distinct from the existing per-game
"high score" leaderboard.

### How it could work technically
- Escape room = a sequence of gated puzzles/rooms; **% = puzzles solved ÷ total**.
- **Attempt control (needs Player Profiles, Idea 1a):** an `escape_attempts` row per
  `(profile_id, ET-day)` with a **server-recorded start timestamp**, so the 3-hour clock
  and the one-try-per-day lock can't be beaten by refreshing or switching devices.
- **Ranking:** highest % first; ties broken by **earliest to reach that %** (so the first
  to finish wins, and the first to reach a given progress outranks a later tie). Store
  best-%-so-far per player and the timestamp they hit it.
- **Live board:** reuse the existing Supabase realtime pattern so standings update as
  people play.

### Open questions to resolve 🟡
1. **Anti-cheat / shared answers (biggest one).** If every player gets the *same* puzzles,
   people who play later in the week can be told the answers. Options: (a) accept it —
   reward finishing fast early; (b) **seed per-player variations** (same puzzle types,
   different specifics) so answers don't transfer; (c) a pool of puzzles drawn randomly.
   (b)/(c) are much more work but protect the "big prize" fairness.
2. **Content design + difficulty.** "Really hard" means real, well-crafted puzzles — this
   is the **largest content build** of all the ideas. Who writes/approves the puzzles?
3. **Resume vs. restart within the day.** If they close the tab mid-attempt, do they
   resume where they were (clock still running) or restart? (Server start-time means the
   clock keeps running regardless — confirm that's intended.)
4. **"Fully beat it" definition** and how the daily 3-hour window interacts with the
   all-week "first to finish wins" (finish time is what ranks the top 3).
5. **Scope vs. deadline.** Big build + big content. Against Oct 2, this competes directly
   with Monopoly/Uno for the remaining time — ranking matters.

### What we'd deliver
- The escape-room game (puzzles + gating + 3-hour timer + daily lock).
- `escape_attempts` (server clock + one-try-per-day) keyed to profiles.
- The **reusable 0–100% progress ranking board** (used here *and* by the QR hunt).
- Admin visibility + export of attempts/progress; grand-winner + 2nd/3rd readout.

---

## Cross-cutting things to look into
- **Player Profiles first.** Ideas 1/1a are the practical starting point — the profile
  system unblocks the QR hunt *and* the escape room (one-try-per-day + the 3-hour clock
  need a reliable per-player identity) and improves every game. Lowest-risk of the new work.
- **Reusable 0–100% progress board.** Build it once (Idea 4) and feed it from both the
  escape room (puzzles solved) and the QR hunt (states ÷ 50). It's a *progress* board,
  separate from the existing high-score leaderboards.
- **Deadline math.** Ideas 2 (Monopoly), 3 (Uno) and 4 (escape room) are each large
  builds — the escape room also carries the heaviest *content* load. Against Oct 2 ready /
  Oct 5 event we almost certainly can't do all of them well — rank and pick. The two
  "big prize" headliners Corey has named are the **QR hunt** and the **escape room**.
- **Trademark posture (Monopoly / Uno / Hot Wheels).** Decide once: licensed, or
  original reskins of the mechanics. Affects both new card/board games.
- **Schedule impact.** If the QR hunt is an all-week meta-game and Monopoly takes
  Monday's slot, restate the weekly lineup so it's unambiguous.
