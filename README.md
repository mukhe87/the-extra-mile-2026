# The Extra Mile — Customer Service Week 2026

A public web app for 7-Eleven's Customer Service Week 2026 ("The Extra Mile").
Each weekday (Mon–Fri) it shows **2 games** that **switch automatically by the
calendar day (Eastern Time)**. Players enter their **first + last name**, play,
and post scores to a **live leaderboard**. One game (the racer, Thu & Fri)
supports **live head-to-head**. An admin page exports all leaderboard data to
**Excel**.

Event week: **Oct 5–9, 2026.** Build ready by **Oct 2, 2026.**

## Stack
- React + Vite + TypeScript + Tailwind CSS
- Phaser 3 for the action games
- Supabase (Postgres + Realtime) for scores, live leaderboard, and head-to-head sync
- SheetJS (`xlsx`) for the admin Excel export
- Deploy on Railway; GitHub is the source of truth

## Local setup
```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key + admin password
npm run dev            # http://localhost:5173
```

To preview a specific event day locally, set `VITE_FORCE_DAY=wed` in `.env`.
Leave it unset in production so the site auto-switches by Eastern Time.

## Supabase
1. Create a project at supabase.com.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Settings → API: copy the **Project URL** and **anon public** key into `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

The site runs without Supabase (games are playable), but leaderboards stay in a
"not configured yet" state until the keys are set.

## Deploy (Railway)
1. Push this repo to GitHub and connect it in Railway.
2. Build command `npm run build`, start command `npm run start` (serves the
   built site on `$PORT`).
3. Add the same `VITE_*` env vars in Railway's variables.

## Admin / Excel export
Visit `/admin`, enter `VITE_ADMIN_PASSWORD`, and download the workbook: an
"All Scores" sheet plus a ranked sheet per game.

### Security notes
- No player accounts; identity is a self-entered name, by design.
- The admin password is checked in the browser — a light gate suitable for an
  internal event, not a hardened boundary. If stronger protection is needed,
  move the export behind a Supabase Edge Function that checks a server-side
  secret (a documented follow-up, out of scope for the event build).
- Row Level Security allows public read + insert of scores only; no update or
  delete. See `supabase/schema.sql`.

## Project status
Phase 0 (foundations) complete: branded shell, Eastern-Time day router, name
gate, live leaderboard, scoring pipeline, admin export — all running against a
shared placeholder game harness. Real games land in Phases 1–4; see
[`GAMES.md`](GAMES.md) for the designs awaiting approval.
