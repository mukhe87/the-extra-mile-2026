-- The Extra Mile — upgrade existing Player Profiles to add the recovery PIN.
-- Run this ONCE in the Supabase SQL editor IF you already ran the first
-- profiles.sql (i.e. the profiles table already exists). It adds the 4-digit
-- PIN, the name+PIN uniqueness, and name+PIN recovery — and stops the RPCs from
-- ever returning the PIN. Safe to run on an empty or populated profiles table;
-- existing rows (if any) get a null PIN until those players set one.

-- 1) Add the PIN column + format check (null allowed for pre-existing rows).
alter table public.profiles add column if not exists pin text;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pin_format'
  ) then
    alter table public.profiles
      add constraint profiles_pin_format check (pin is null or pin ~ '^[0-9]{4}$');
  end if;
end $$;

-- 2) First + Last + PIN is unique (powers recovery + same-name disambiguation).
create unique index if not exists profiles_name_pin_key
  on public.profiles (lower(first_name), lower(last_name), pin);

-- 3) Replace the functions. A return-type change requires DROP first.
drop function if exists public.create_profile(text, text);
drop function if exists public.get_profile_by_pass(text);

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
      if exists (
        select 1 from public.profiles pr
        where lower(pr.first_name) = lower(f) and lower(pr.last_name) = lower(l) and pr.pin = p_pin
      ) then
        raise exception 'name+pin taken';
      end if;
      if attempts >= 8 then raise; end if;
    end;
  end loop;
end; $$;

create or replace function public.get_profile_by_pass(p_pass text)
returns table (id uuid, pass_code text, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pr.id, pr.pass_code, pr.first_name, pr.last_name
    from public.profiles pr
    where upper(btrim(pr.pass_code)) = upper(btrim(p_pass));
end; $$;

create or replace function public.get_profile_by_name_pin(p_first text, p_last text, p_pin text)
returns table (id uuid, pass_code text, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pr.id, pr.pass_code, pr.first_name, pr.last_name
    from public.profiles pr
    where lower(pr.first_name) = lower(btrim(p_first))
      and lower(pr.last_name)  = lower(btrim(p_last))
      and pr.pin = p_pin;
end; $$;

grant execute on function public.create_profile(text, text, text) to anon;
grant execute on function public.get_profile_by_pass(text) to anon;
grant execute on function public.get_profile_by_name_pin(text, text, text) to anon;
