-- The Extra Mile — scoreboard reset function.
-- Run this ONCE in the Supabase SQL editor, AFTER replacing the password below.
--
-- Why a function: the public site uses the anon key, which (by design) cannot
-- delete rows. This SECURITY DEFINER function runs with elevated rights but only
-- deletes when the caller passes the correct reset password — which lives here in
-- the database, never in the website code. The admin types it in the panel.
--
-- 1) Replace 'CHANGE-ME-RESET-PASSWORD' with a strong password of your choice.
-- 2) Keep it separate from your VITE_ADMIN_PASSWORD (that one is public in the app).

create or replace function public.reset_scores(pw text, game text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if pw is distinct from 'CHANGE-ME-RESET-PASSWORD' then
    raise exception 'unauthorized';
  end if;

  if game is null or game = '' then
    delete from public.scores;
  else
    delete from public.scores where game_slug = game;
  end if;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Allow the site (anon) to call it; the password check inside is the real gate.
grant execute on function public.reset_scores(text, text) to anon;

-- To change the reset password later, just re-run this whole snippet with a new value.
