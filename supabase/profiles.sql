-- The Extra Mile — Player Profiles ("Player Pass" + recovery PIN).
-- Run this once in the Supabase SQL editor, after schema.sql.
-- (If profiles already exist from an earlier version, run
--  supabase/profiles-pin-migration.sql instead — it upgrades in place.)
--
-- Design: a lightweight identity so a player's scores (and, later, the QR hunt
-- collection and escape-room progress) tie to one person across days and
-- devices — with no passwords and no PII beyond the first/last name they give.
-- Each profile has:
--   • a short, friendly "Player Pass" (e.g. EXTRA-4F7Q) for one-tap re-attach;
--   • a self-chosen 4-digit PIN. First + Last + PIN is unique, which does two
--     jobs: it lets a player who LOST their pass reconnect with name + PIN, and
--     it keeps two people who share a name distinct (their data never mixes).
--
-- Security: the profiles table has RLS on and NO anon policies, so the public
-- (anon) key cannot read or list it directly. All access goes through the
-- SECURITY DEFINER functions below, and those NEVER return the PIN. You can
-- create a profile, resolve one by a pass code you already hold, or resolve one
-- by name + PIN — but you cannot dump the table or read anyone's PIN.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  pass_code  text not null unique,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name  text not null check (char_length(last_name)  between 1 and 60),
  pin        text check (pin ~ '^[0-9]{4}$'),
  must_set_pin boolean not null default false, -- set by an admin reset; cleared when the player picks a personal PIN
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- Intentionally no policies: only the SECURITY DEFINER RPCs below touch this table.

-- One person = one (first, last, PIN). Powers both name+PIN recovery and
-- same-name disambiguation.
create unique index if not exists profiles_name_pin_key
  on public.profiles (lower(first_name), lower(last_name), pin);

-- Link scores to a profile (nullable, so older/nameless rows still work). If a
-- profile is ever deleted, its scores keep their names and just lose the link.
alter table public.scores
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create index if not exists scores_profile_id_idx on public.scores (profile_id);

-- A short Player Pass code: EXTRA- + 4 chars from an unambiguous alphabet
-- (no 0/O/1/I/L, so it's easy to read off a screen and type on a phone).
create or replace function public.gen_pass_code()
returns text language plpgsql as $$
declare
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text := 'EXTRA-';
  i int;
begin
  for i in 1..4 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end; $$;

-- Create a profile with a chosen 4-digit PIN. Enforces unique (first,last,PIN);
-- generates a unique pass code (retries on the rare collision). Returns the
-- profile WITHOUT the PIN.
create or replace function public.create_profile(p_first text, p_last text, p_pin text)
returns table (id uuid, pass_code text, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  attempts int := 0;
  f text := left(btrim(p_first), 60);
  l text := left(btrim(p_last), 60);
begin
  if p_first is null or btrim(p_first) = '' or p_last is null or btrim(p_last) = '' then
    raise exception 'First and last name are required.';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be 4 digits.';
  end if;
  if exists (
    select 1 from public.profiles pr
    where lower(pr.first_name) = lower(f) and lower(pr.last_name) = lower(l) and pr.pin = p_pin
  ) then
    raise exception 'name+pin taken';
  end if;
  loop
    attempts := attempts + 1;
    new_code := gen_pass_code();
    begin
      insert into public.profiles (pass_code, first_name, last_name, pin)
      values (new_code, f, l, p_pin);
      return query
        select pr.id, pr.pass_code, pr.first_name, pr.last_name
        from public.profiles pr where pr.pass_code = new_code;
      return;
    exception when unique_violation then
      -- Distinguish a name+PIN race from a pass-code collision.
      if exists (
        select 1 from public.profiles pr
        where lower(pr.first_name) = lower(f) and lower(pr.last_name) = lower(l) and pr.pin = p_pin
      ) then
        raise exception 'name+pin taken';
      end if;
      if attempts >= 8 then raise; end if;
      -- otherwise loop and try a fresh pass code
    end;
  end loop;
end; $$;

-- Resolve a profile by pass code (case-insensitive). Returns 0 rows if no match.
-- Never returns the PIN. must_set_pin tells the app to force a personal PIN
-- after an admin reset.
create or replace function public.get_profile_by_pass(p_pass text)
returns table (id uuid, pass_code text, first_name text, last_name text, must_set_pin boolean)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pr.id, pr.pass_code, pr.first_name, pr.last_name, pr.must_set_pin
    from public.profiles pr
    where upper(btrim(pr.pass_code)) = upper(btrim(p_pass));
end; $$;

-- Resolve a profile by First + Last + PIN — the recovery path when a player has
-- lost their pass. Returns 0 rows if no match. Never returns the PIN.
create or replace function public.get_profile_by_name_pin(p_first text, p_last text, p_pin text)
returns table (id uuid, pass_code text, first_name text, last_name text, must_set_pin boolean)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pr.id, pr.pass_code, pr.first_name, pr.last_name, pr.must_set_pin
    from public.profiles pr
    where lower(pr.first_name) = lower(btrim(p_first))
      and lower(pr.last_name)  = lower(btrim(p_last))
      and pr.pin = p_pin;
end; $$;

-- Player self-service: set a new PIN by presenting the current pass code (which
-- they just logged in with). Clears must_set_pin. Keeps name+PIN uniqueness.
create or replace function public.set_own_pin(p_pass text, p_new_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare pid uuid; f text; l text;
begin
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be 4 digits.'; end if;
  select id, first_name, last_name into pid, f, l
  from public.profiles where upper(btrim(pass_code)) = upper(btrim(p_pass));
  if pid is null then raise exception 'unauthorized'; end if;
  if exists (
    select 1 from public.profiles p2
    where p2.id <> pid and lower(p2.first_name) = lower(f) and lower(p2.last_name) = lower(l) and p2.pin = p_new_pin
  ) then
    raise exception 'name+pin taken';
  end if;
  update public.profiles set pin = p_new_pin, must_set_pin = false where id = pid;
end; $$;

grant execute on function public.create_profile(text, text, text) to anon;
grant execute on function public.get_profile_by_pass(text) to anon;
grant execute on function public.get_profile_by_name_pin(text, text, text) to anon;
grant execute on function public.set_own_pin(text, text) to anon;
