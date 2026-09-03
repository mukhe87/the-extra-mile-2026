> 🧭 **SESSION-START PROTOCOL — present this FIRST, every session:** before any work, provide a **full Project List** as a check-off list showing **(a) Active Projects, (b) Tasks per project, (c) Sessions/Tasks/Projects ON-HOLD, and (d) Completed** items, so the user sees the whole board and picks what to work on. Do not start a task before showing this list.

---

# ⚡ RESUME BRIEF — The Extra Mile

_Last updated: 2026-09-03 (Commit Break). Single source of truth for resuming this project. myPKA-level memory also lives in `MEMORY.md` at the myPKA repo root._

## 1. Whole Project Objective
A public web app for **7-Eleven Customer Service Week 2026 — "The Extra Mile."** Employees play **2 browser games per weekday (Mon–Fri)** that **auto-switch by calendar day (Eastern Time)**, competing on a **live leaderboard** (plus one live head-to-head racer). Players enter first + last name only. Organizers export standings to Excel. **Event week: Oct 5–9, 2026. Must be ready by Oct 2, 2026.**

## 2. Current Status
Built, merged, and **deployed live** — now in a **bug-fix round** (paused for a break). Live URL: **https://the-extra-mile-2026.up.railway.app** (Railway, deploy Active). All 5 build phases merged to `main`.
**Key diagnosis this session:** Supabase is confirmed FINE — direct REST against the live project returns 200 on read, 201 on write, CORS correct. The reported failures (no scores on leaderboard, admin export error) are **client-side in the deployed browser bundle**, not a config problem. Root cause not yet isolated.

## 3. Completed Work
- Phases 0–5 built and merged to `main` (PRs #1–#5): foundations, all 11 games (Mon/Tue quiz-style, Wed arcade in Phaser, Thu/Fri racer with solo + head-to-head, Mystery Challenge reaction game), live-leaderboard plumbing, admin xlsx export, deploy hardening.
- Supabase project created; `supabase/schema.sql` run successfully (scores table + RLS + realtime).
- Railway deploy connected to the GitHub repo; env vars set; public domain generated.
- Verified end-to-end from outside: DB read/write/CORS all working.

## 4. Outstanding Tasks (the bug-fix round)
1. **Client-side leaderboard/scoring bug** — plays don't save from the browser and the board shows nothing, though the DB works. ROOT-CAUSE via headless Chromium (capture console/network error in the prod bundle). Prime suspects: a runtime JS error in the built bundle, or supabase-js client init.
2. **Admin `Download .xlsx` error** ("Export failed. Is Supabase configured?") — almost certainly the same root cause; re-verify after #1.
3. **Games/names don't match the correct games** — investigate the registry / day-router mapping (need Corey to specify what he saw, or reproduce).
4. **Add a leaderboard to the main (home) page** — new feature.
5. **Cosmetic polish + add the official logo** — NEEDS Corey to add the real 7-Eleven "Extra Mile" logo PNG to the repo (e.g. `src/assets/`); it was only shared as chat images. Header currently uses a CSS wordmark.
6. **Clean up the stray `Test Diagnostic` row** in the scores table (Larry's diagnostic insert; needs the Supabase SQL editor — no anon delete policy).

## 5. Important Decisions
- Games are **original builds** styled to the theme (no copyrighted Pac-Man/Galaga/etc. or Hot Wheels art) — an IP decision made at spec time.
- Racer scored in **points** (faster = higher) so it fits the single highest-first leaderboard + export.
- Head-to-head uses a **shared room code → seeded identical course**, compared by elapsed time — fair over any latency; networking isolated in React, Phaser scene stays offline-safe.
- Daily switch keyed to **America/New_York** (Enon OH). Single shared admin password gates `/admin`.
- Build/deploy: React + Vite + TS + Tailwind, Phaser 3 (code-split), Supabase (Postgres + Realtime), SheetJS export, Railway host, GitHub SoT.

## 6. Key Files / Resources
- **Repo:** `github.com/mukhe87/the-extra-mile-2026` — branch `main` @ `876b62d` (merge of PR #5). Local clone: `/home/user/the-extra-mile-2026`.
- **Live site:** https://the-extra-mile-2026.up.railway.app  ·  admin at `/admin`.
- **Supabase:** project `puqcugpbwhkdssymqdvu` (URL + anon key are public and baked into the deployed bundle; also set as Railway variables). **Admin password: chosen by Corey, stored only by Corey — not recorded here.**
- **Day router / schedule:** `src/lib/schedule.ts` (EVENT_TZ, per-day game slugs).
- **Game catalog:** `src/games/registry.ts`. Score plumbing: `src/lib/scores.ts`, `src/lib/supabase.ts`. Leaderboard UI: `src/components/Leaderboard.tsx`. Admin/export: `src/pages/Admin.tsx`. Home: `src/pages/Home.tsx`.
- **Trivia content:** `src/games/data/trivia.ts` (draft 25 Q — Corey to review).
- **Deploy docs:** `DEPLOY.md` (repo) + go-live artifact: https://claude.ai/code/artifact/2e7f78f5-c71c-466d-9a58-a598b8508cfb
- **myPKA memory SSOT:** `MEMORY.md` at myPKA repo root; myPKA `/project-startup` skill work is in open PR #5 on branch `claude/project-startup-vm9pqb`.

## 7. Known Issues
- Client-side scoring bug (see Outstanding #1) — **top priority**, blocks the leaderboard and the export.
- One stray `Test Diagnostic` row in the live leaderboard (harmless; clear via SQL editor).
- Logo is a placeholder wordmark until Corey supplies the real asset.
- `VITE_FORCE_DAY` (if ever set in Railway for previewing) **must be removed before the event** so days auto-switch.

## 8. Recommended Next Steps / Actions
1. Start a **new fix branch off `main`** (e.g. `claude/fix-leaderboard-and-polish`).
2. Reproduce the browser bug in headless Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`): load the live site (or `npm run dev` with env), open a game, submit, capture console + network. Fix the root cause; re-verify a real score lands.
3. Ask Corey exactly what "games/names don't match" looked like (which day/tile), or reproduce; fix the mapping.
4. Add the home-page leaderboard.
5. Get the logo PNG from Corey; wire it into the header + cosmetic pass.
6. Validate build, push branch, open a draft PR, and (with Corey's ok) merge and let Railway redeploy. Then delete the diagnostic row.

---

## Save-point history
- **2026-09-03 — Commit Break.** Deployed live; entered bug-fix round; isolated the failure to the client bundle (Supabase itself verified working). Paused at Corey's request. See `SESSION-SAVEPOINT.md` for the snapshot.
