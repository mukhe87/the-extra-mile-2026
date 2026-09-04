-- The Extra Mile — Player Profiles ("Player Pass").
-- Run this once in the Supabase SQL editor, after schema.sql.
--
-- Design: a lightweight identity so a player's scores (and, later, the QR hunt
-- collection and escape-room progress) tie to one person across days and
-- devices — with no passwords and no PII beyond the first/last name they
-- already give. Each profile gets a short, friendly "Player Pass" (e.g.
-- EXTRA-4F7Q) they can use to re-attach on another device.
--
-- Security: the profiles table has RLS on and NO anon policies, so the public
-- (anon) key cannot read or list it directly — that prevents anyone from
-- dumping everyone's pass codes. All access goes through the SECURITY DEFINER
-- functions below: create a profile, or look one up *only if you already know
-- its pass code*. Same pattern as reset-function.sql.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  pass_code  text not null unique,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name  text not null check (char_length(last_name)  between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
-- Intentionally no policies: only the SECURITY DEFINER RPCs below touch this table.

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

-- Create a new profile, generating a unique pass code (retries on the rare
-- collision). Returns the full profile row.
create or replace function public.create_profile(p_first text, p_last text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
  attempts int := 0;
begin
  if p_first is null or btrim(p_first) = '' or p_last is null or btrim(p_last) = '' then
    raise exception 'First and last name are required.';
  end if;
  loop
    attempts := attempts + 1;
    begin
      insert into public.profiles (pass_code, first_name, last_name)
      values (gen_pass_code(), left(btrim(p_first), 60), left(btrim(p_last), 60))
      returning * into result;
      return result;
    exception when unique_violation then
      if attempts >= 8 then raise; end if;
      -- loop and try a fresh code
    end;
  end loop;
end; $$;

-- Look up a profile by its pass code (case-insensitive). Returns the row, or
-- nothing if no match. Knowing the code is the "credential" — you can't list
-- codes, only resolve one you already hold.
create or replace function public.get_profile_by_pass(p_pass text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare result public.profiles;
begin
  select * into result
  from public.profiles
  where upper(btrim(pass_code)) = upper(btrim(p_pass));
  return result;
end; $$;

grant execute on function public.create_profile(text, text) to anon;
grant execute on function public.get_profile_by_pass(text) to anon;
