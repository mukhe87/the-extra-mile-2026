-- The Extra Mile — Profiles v2: PIN-only sign-in.
-- Run this ONCE in the Supabase SQL editor. It reshapes the existing profiles
-- table and functions to the new model:
--   • Sign in with a single, globally-unique 6-digit PIN (no name, no pass).
--   • No more Player Pass.
--   • Forgot PIN -> the admin RESETS the account, which generates a 4-digit code
--     (valid 24h). The player enters that code + a new 6-digit PIN to get back
--     in. The admin never sees or sets PINs.
--
-- NOTE: this clears existing (pre-event, test) profiles because their old
-- 4-digit / non-unique PINs and pass codes are incompatible with the new rules.
-- Players re-create accounts. Old test scores (if any) can be cleared from the
-- admin Reset Scoreboard panel.

-- Remove functions whose signature/return changes or that no longer apply.
drop function if exists public.create_profile(text, text, text);
drop function if exists public.get_profile_by_pass(text);
drop function if exists public.get_profile_by_name_pin(text, text, text);
drop function if exists public.set_own_pin(text, text);
drop function if exists public.admin_reset_pass(text, uuid);
drop function if exists public.admin_set_pin(text, uuid, text);
drop function if exists public.admin_find_profiles(text, text);
drop function if exists public.gen_pass_code();

-- Clear old test accounts so the new constraints apply cleanly.
delete from public.profiles;

-- Reshape the table.
drop index if exists public.profiles_name_pin_key;
alter table public.profiles drop column if exists pass_code;
alter table public.profiles drop column if exists must_set_pin;
alter table public.profiles drop constraint if exists profiles_pin_format;

alter table public.profiles alter column pin set not null;
alter table public.profiles add constraint profiles_pin_format check (pin ~ '^[0-9]{6}$');
create unique index if not exists profiles_pin_key on public.profiles (pin);

alter table public.profiles add column if not exists reset_code text;
alter table public.profiles add column if not exists reset_code_expires_at timestamptz;

-- Create an account: First + Last + a unique 6-digit PIN. Returns the profile
-- (no PIN echoed).
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

-- Sign in: resolve the account for a 6-digit PIN. Returns 0 rows if no match.
create or replace function public.get_profile_by_pin(p_pin text)
returns table (id uuid, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query select pr.id, pr.first_name, pr.last_name
    from public.profiles pr where pr.pin = btrim(p_pin);
end; $$;

-- Player self-service after an admin reset: present the 4-digit code and choose
-- a new unique 6-digit PIN. Clears the code. Returns the profile (signs in).
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

-- ---- Admin functions (gated by app_config.reset_password) --------------------

-- Search players by name; shows score count + any active reset code.
create or replace function public.admin_find_profiles(pw text, q text)
returns table (
  id uuid, first_name text, last_name text, created_at timestamptz,
  score_count bigint, reset_code text, reset_code_expires_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check(pw);
  return query
    select p.id, p.first_name, p.last_name, p.created_at,
      (select count(*) from public.scores s where s.profile_id = p.id),
      case when p.reset_code_expires_at > now() then p.reset_code else null end,
      case when p.reset_code_expires_at > now() then p.reset_code_expires_at else null end
    from public.profiles p
    where q is null or btrim(q) = ''
       or (p.first_name || ' ' || p.last_name) ilike '%' || btrim(q) || '%'
    order by p.created_at desc
    limit 100;
end; $$;

-- Reset an account: generate a 4-digit code (unique among active codes), valid
-- 24 hours, for the admin to hand to the player. Does NOT change the PIN or
-- delete any data.
create or replace function public.admin_reset_account(pw text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  perform public.admin_check(pw);
  loop
    code := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles
      where reset_code = code and reset_code_expires_at > now()
    );
  end loop;
  update public.profiles
    set reset_code = code, reset_code_expires_at = now() + interval '24 hours'
    where id = p_id;
  if not found then raise exception 'Player not found.'; end if;
  return code;
end; $$;

-- admin_delete_profile is unchanged from admin-players.sql (deletes the profile
-- and all its scores); it does not need recreating here.

grant execute on function public.admin_find_profiles(text, text) to anon;
grant execute on function public.admin_reset_account(text, uuid) to anon;
