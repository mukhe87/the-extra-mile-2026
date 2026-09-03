-- The Extra Mile — scoreboard reset setup.
--
-- Run this WHOLE block ONCE in the Supabase SQL editor. You do NOT edit any
-- password into this SQL — there is nothing to get wrong here. After running it,
-- you set the password in a table cell (see the steps at the bottom).
--
-- Why it works this way: the public site uses the anon key, which (by design)
-- cannot delete rows. The reset_scores function below runs with elevated rights
-- but only deletes when the caller's password matches the one you store in the
-- app_config table. The admin panel sends that password automatically after you
-- log in — you never type it again on the site.

-- 1) A tiny one-row settings table that holds the reset password.
--    RLS is on with no policies, so the public (anon) key can NOT read it.
--    Only this SECURITY DEFINER function and the Supabase dashboard can.
create table if not exists public.app_config (
  id boolean primary key default true,
  reset_password text not null default '',
  constraint app_config_singleton check (id)
);

insert into public.app_config (id, reset_password)
values (true, '')
on conflict (id) do nothing;

alter table public.app_config enable row level security;

-- 2) The reset function: compares the caller's password to the stored one.
--    Both are plain text variables, so there are no quotes for you to fix and
--    the password is never echoed back in an error.
create or replace function public.reset_scores(pw text, game text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  expected text;
begin
  select reset_password into expected from public.app_config where id = true;

  if expected is null or expected = '' then
    raise exception 'Reset password not set. In Supabase, open Table Editor > app_config and type your admin password into the reset_password cell, then Save.';
  end if;

  if pw is distinct from expected then
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) SET YOUR PASSWORD (no SQL, no quotes):
--    a. In the Supabase left sidebar, click "Table Editor".
--    b. Open the "app_config" table. It has one row.
--    c. Click the "reset_password" cell, type your admin password
--       (the SAME value as VITE_ADMIN_PASSWORD / your /admin login), press Save.
--    That's it. Now /admin > Reset works. If you ever change your admin
--    password, just edit that cell again — you never touch this SQL again.
-- ─────────────────────────────────────────────────────────────────────────────
