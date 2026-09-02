-- The Extra Mile — Supabase schema.
-- Run this once in the Supabase SQL editor for your project.

-- One row per score submission. The leaderboard is derived by ranking these.
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name  text not null check (char_length(last_name)  between 1 and 60),
  score integer not null check (score >= 0 and score <= 100000000),
  created_at timestamptz not null default now()
);

create index if not exists scores_game_slug_score_idx
  on public.scores (game_slug, score desc);

-- Realtime: broadcast INSERTs so leaderboards update live.
alter publication supabase_realtime add table public.scores;

-- Row Level Security: the public site uses the anon key. We allow anyone to
-- read the leaderboard and to insert their own score, but never to update or
-- delete. Exports run through the same read policy from the admin page.
alter table public.scores enable row level security;

drop policy if exists "read scores" on public.scores;
create policy "read scores"
  on public.scores for select
  using (true);

drop policy if exists "insert own score" on public.scores;
create policy "insert own score"
  on public.scores for insert
  with check (
    char_length(first_name) between 1 and 60
    and char_length(last_name) between 1 and 60
    and score >= 0 and score <= 100000000
  );

-- No update/delete policies => those are denied for anon by default.
