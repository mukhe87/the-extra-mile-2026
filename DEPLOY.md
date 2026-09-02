# Go-Live Checklist — The Extra Mile

Everything to take the site from code to a live URL for the event. ~20 minutes.

## 1. Supabase (leaderboards + head-to-head) — ~5 min
1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open **SQL Editor** → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates the `scores` table, its indexes, Row Level Security (public read + insert only), and enables Realtime.
3. Open **Project Settings → API** and copy:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon public** key → this is `VITE_SUPABASE_ANON_KEY`
   (The anon key is a public client key — safe to put in the front end. Never use the *service_role* key here.)

## 2. Railway (hosting) — ~10 min
1. In Railway, **New Project → Deploy from GitHub repo** → pick `the-extra-mile-2026`.
2. Railway reads [`railway.json`](railway.json): build `npm run build`, start `npm run start` (serves the built site on `$PORT`).
3. Add **Variables** (Railway → your service → Variables):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
   - `VITE_ADMIN_PASSWORD` = a password of your choice (gates `/admin`)
   > These are build-time vars (Vite inlines `VITE_*` at build). After changing any of them, **redeploy** so the new build picks them up.
4. Deploy. Railway gives you a `*.up.railway.app` URL — that's your live site. (A custom domain can be added later under Settings → Networking.)

## 3. Smoke test — ~5 min
- Open the URL. You should see today's two games (based on **Eastern Time**).
- Play a game, enter a name, and confirm your score appears on the **live leaderboard**.
- Preview any day without waiting: add `VITE_FORCE_DAY=wed` (or mon/tue/thu/fri) as a Railway variable and redeploy — the site then shows that day. **Remove it before the event** so the auto-switch takes over.
- **Head-to-head:** open the racer on two devices/browsers, one **Host head-to-head** (share the 4-char code), the other **Join** with that code; both tap Start and confirm you see each other's progress bar and a win/lose result.
- Visit `/admin`, enter the password, and **Download .xlsx** — confirm the Overall, All Scores, and per-game sheets.

## Day-to-day during the event
- Nothing to do — games switch automatically at **midnight Eastern**.
- Grab standings any time from `/admin` → **Download .xlsx** (the **Overall** sheet is the event-winner view).

## Notes
- **Timezone:** the daily switch uses `America/New_York` (Eastern). Change it in `src/lib/schedule.ts` (`EVENT_TZ`) if needed.
- **Branding:** the header uses a CSS wordmark. To drop in the official Extra Mile / 7-Eleven logo, add the file under `src/assets/` and point the header (`src/components/Layout.tsx`) at it.
- **Admin security:** the admin password is checked in the browser — a light gate for an internal event, not a hardened boundary. See the README "Security notes" for the stronger option if ever needed.
- **Content:** Road Trivia questions live in `src/games/data/trivia.ts` — edit freely before go-live.
