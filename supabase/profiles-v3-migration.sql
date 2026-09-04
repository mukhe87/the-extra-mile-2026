-- The Extra Mile — Profiles v3: username + 6-digit PIN sign-in.
-- Run ONCE in the Supabase SQL editor (after profiles-v2-migration.sql).
--
-- Adds a unique USERNAME. Sign in is now Username + 6-digit PIN, so the PIN is a
-- secret rather than the whole login (PINs no longer need to be unique). Forgot
-- the PIN or username? The admin resets the account (4-digit code, 24h); the
-- player redeems it to set their username + a new PIN.
--
-- NOTE: clears existing (pre-event, test) accounts because they have no
-- username. Players re-create accounts.

drop function if exists public.create_profile(text, text, text);
drop function if exists public.get_profile_by_pin(text);
drop function if exists public.redeem_reset_code(text, text);
drop function if exists public.admin_find_profiles(text, text);

delete from public.profiles;

-- The PIN is now a secret, not the identifier — drop its uniqueness.
drop index if exists public.profiles_pin_key;

-- Add the username and make it the unique login handle (case-insensitive).
alter table public.profiles add column if not exists username text;
alter table public.profiles alter column username set not null;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9._-]{3,20}$');
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Create an account: First + Last + unique Username + 6-digit PIN.
create or replace function public.create_profile(p_first text, p_last text, p_username text, p_pin text)
returns table (id uuid, first_name text, last_name text, username text)
language plpgsql security definer set search_path = public as $$
declare f text := left(btrim(p_first), 60); l text := left(btrim(p_last), 60); u text := btrim(p_username);
begin
  if f = '' or l = '' then raise exception 'First and last name are required.'; end if;
  if u !~ '^[A-Za-z0-9._-]{3,20}$' then raise exception 'bad username'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be 6 digits.'; end if;
  begin
    insert into public.profiles (first_name, last_name, username, pin) values (f, l, u, p_pin);
  exception when unique_violation then
    raise exception 'username taken';
  end;
  return query select pr.id, pr.first_name, pr.last_name, pr.username
    from public.profiles pr where lower(pr.username) = lower(u);
end; $$;

-- Sign in: match username (case-insensitive) + PIN.
create or replace function public.get_profile_by_login(p_username text, p_pin text)
returns table (id uuid, first_name text, last_name text, username text)
language plpgsql security definer set search_path = public as $$
begin
  return query select pr.id, pr.first_name, pr.last_name, pr.username
    from public.profiles pr
    where lower(pr.username) = lower(btrim(p_username)) and pr.pin = btrim(p_pin);
end; $$;

-- Redeem an admin reset code: set username (unique) + a new 6-digit PIN.
create or replace function public.redeem_reset_code(p_code text, p_username text, p_new_pin text)
returns table (id uuid, first_name text, last_name text, username text)
language plpgsql security definer set search_path = public as $$
declare pid uuid; u text := btrim(p_username);
begin
  if u !~ '^[A-Za-z0-9._-]{3,20}$' then raise exception 'bad username'; end if;
  if p_new_pin !~ '^[0-9]{6}$' then raise exception 'PIN must be 6 digits.'; end if;
  select pr.id into pid from public.profiles pr
    where pr.reset_code = btrim(p_code) and pr.reset_code_expires_at > now();
  if pid is null then raise exception 'invalid or expired code'; end if;
  if exists (select 1 from public.profiles where lower(username) = lower(u) and id <> pid) then
    raise exception 'username taken';
  end if;
  update public.profiles
    set username = u, pin = p_new_pin, reset_code = null, reset_code_expires_at = null
    where id = pid;
  return query select pr.id, pr.first_name, pr.last_name, pr.username from public.profiles pr where pr.id = pid;
end; $$;

grant execute on function public.create_profile(text, text, text, text) to anon;
grant execute on function public.get_profile_by_login(text, text) to anon;
grant execute on function public.redeem_reset_code(text, text, text) to anon;

-- Admin search now also returns the username (so the admin can read it back to a
-- player who forgot it — no reset needed).
create or replace function public.admin_find_profiles(pw text, q text)
returns table (
  id uuid, first_name text, last_name text, username text, created_at timestamptz,
  score_count bigint, reset_code text, reset_code_expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check(pw);
  return query
    select p.id, p.first_name, p.last_name, p.username, p.created_at,
      (select count(*) from public.scores s where s.profile_id = p.id),
      case when p.reset_code_expires_at > now() then p.reset_code else null end,
      case when p.reset_code_expires_at > now() then p.reset_code_expires_at else null end
    from public.profiles p
    where q is null or btrim(q) = ''
       or (p.first_name || ' ' || p.last_name) ilike '%' || btrim(q) || '%'
       or p.username ilike '%' || btrim(q) || '%'
    order by p.created_at desc
    limit 100;
end; $$;

grant execute on function public.admin_find_profiles(text, text) to anon;
