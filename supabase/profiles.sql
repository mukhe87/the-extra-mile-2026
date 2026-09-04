-- The Extra Mile — Player Profiles (PIN-only sign-in).
-- Run once in the Supabase SQL editor, after schema.sql.
-- (If profiles already exist from an earlier version, run the matching
--  migration instead — e.g. supabase/profiles-v2-migration.sql.)
--
-- Model:
--   • An account is First + Last (for the leaderboard) + a globally-unique
--     6-digit PIN. Players sign in with the PIN alone — no name, no pass.
--   • Forgot the PIN? The admin resets the account, which issues a 4-digit code
--     (valid 24h). The player enters that code + a new 6-digit PIN to get back
--     in. The admin never sees or sets PINs.
--
-- Security: the profiles table has RLS on and NO anon policies, so the anon key
-- can't read/list it. All access goes through the SECURITY DEFINER functions
-- below, which never return the PIN.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name  text not null check (char_length(last_name)  between 1 and 60),
  pin        text not null check (pin ~ '^[0-9]{6}$'),
  reset_code text,
  reset_code_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- Intentionally no policies: only the SECURITY DEFINER RPCs below touch this table.

-- The PIN is the login, so it must be unique across all players.
create unique index if not exists profiles_pin_key on public.profiles (pin);

-- Link scores to a profile (nullable; on delete keep the score, drop the link).
alter table public.scores
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create index if not exists scores_profile_id_idx on public.scores (profile_id);

-- Create an account: First + Last + a unique 6-digit PIN.
create or replace function public.create_profile(p_first text, p_last text, p_pin text)
returns table (id uuid, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
declare f text := left(btrim(p_first), 60); l text := left(btrim(p_last), 60);
begin
  if f = '' or l = '' then raise exception 'First and last name are required.'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be 6 digits.'; end if;
  begin
    insert into public.profiles (first_name, last_name, pin) values (f, l, p_pin);
  exception when unique_violation then
    raise exception 'pin taken';
  end;
  return query select pr.id, pr.first_name, pr.last_name from public.profiles pr where pr.pin = p_pin;
end; $$;

-- Sign in: resolve the account for a 6-digit PIN. 0 rows if no match.
create or replace function public.get_profile_by_pin(p_pin text)
returns table (id uuid, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query select pr.id, pr.first_name, pr.last_name
    from public.profiles pr where pr.pin = btrim(p_pin);
end; $$;

-- Redeem an admin reset code: choose a new unique 6-digit PIN, clear the code.
create or replace function public.redeem_reset_code(p_code text, p_new_pin text)
returns table (id uuid, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if p_new_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be 6 digits.'; end if;
  select pr.id into pid from public.profiles pr
    where pr.reset_code = btrim(p_code) and pr.reset_code_expires_at > now();
  if pid is null then raise exception 'invalid or expired code'; end if;
  if exists (select 1 from public.profiles where pin = p_new_pin and id <> pid) then
    raise exception 'pin taken';
  end if;
  update public.profiles
    set pin = p_new_pin, reset_code = null, reset_code_expires_at = null
    where id = pid;
  return query select pr.id, pr.first_name, pr.last_name from public.profiles pr where pr.id = pid;
end; $$;

grant execute on function public.create_profile(text, text, text) to anon;
grant execute on function public.get_profile_by_pin(text) to anon;
grant execute on function public.redeem_reset_code(text, text) to anon;
