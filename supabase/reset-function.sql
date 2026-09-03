-- The Extra Mile — scoreboard reset function.
-- Run this ONCE in the Supabase SQL editor, AFTER replacing the password below.
--
-- Why a function: the public site uses the anon key, which (by design) cannot
-- delete rows. This SECURITY DEFINER function runs with elevated rights but only
-- deletes when the caller passes the correct password. The admin panel sends the
-- password automatically after you log in — you don't type it again.
--
-- SET THE PASSWORD BELOW to the SAME value as your VITE_ADMIN_PASSWORD (your
-- admin login), so a reset works right after you log into /admin. The value
-- lives only here in the database.

create or replace function public.reset_scores(pw text, game text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if pw is distinct from 'SET-THIS-TO-YOUR-ADMIN-PASSWORD' then
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

-- If you ever change your admin password, re-run this snippet with the new value.
