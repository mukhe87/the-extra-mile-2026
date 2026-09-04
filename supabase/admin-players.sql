-- The Extra Mile — Admin player management.
-- Run this once in the Supabase SQL editor, after profiles.sql (and the
-- reset-function.sql that creates app_config).
--
-- Lets the admin panel help players who are locked out and remove accounts.
-- Every function is gated by the admin password stored in app_config
-- (reset_password) — the same gate as reset_scores — and runs SECURITY DEFINER
-- so the public (anon) key can call them ONLY with the correct password.
--
--   • admin_find_profiles  — search players by name or pass (to find the person)
--   • admin_reset_pass     — issue a NEW Player Pass (keeps all their data)
--   • admin_set_pin        — set a NEW 4-digit PIN (keeps all their data)
--   • admin_delete_profile — delete the account AND all its data
--
-- "Reset" only changes credentials; the profile id never changes, so scores
-- (and future QR-hunt photos/finds keyed to profile_id) stay intact. Only
-- admin_delete_profile removes data.

-- Password gate shared by the admin functions below.
create or replace function public.admin_check(pw text)
returns void language plpgsql security definer set search_path = public as $$
declare expected text;
begin
  select reset_password into expected from public.app_config where id = true;
  if expected is null or expected = '' then
    raise exception 'Admin password not set. In Supabase, open Table Editor > app_config and set the reset_password cell.';
  end if;
  if pw is distinct from expected then
    raise exception 'unauthorized';
  end if;
end; $$;

-- Search players (name or pass code, case-insensitive). Returns each player's
-- pass code and a live score count so the admin can identify the right person
-- (handy when two people share a name). Never returns the PIN.
create or replace function public.admin_find_profiles(pw text, q text)
returns table (
  id uuid, first_name text, last_name text, pass_code text,
  created_at timestamptz, score_count bigint
)
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_check(pw);
  return query
    select p.id, p.first_name, p.last_name, p.pass_code, p.created_at,
           (select count(*) from public.scores s where s.profile_id = p.id)
    from public.profiles p
    where q is null or btrim(q) = ''
       or (p.first_name || ' ' || p.last_name) ilike '%' || btrim(q) || '%'
       or p.pass_code ilike '%' || btrim(q) || '%'
    order by p.created_at desc
    limit 100;
end; $$;

-- Issue a new Player Pass for a player who lost theirs. Data untouched.
create or replace function public.admin_reset_pass(pw text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare new_code text; attempts int := 0;
begin
  perform public.admin_check(pw);
  loop
    attempts := attempts + 1;
    new_code := public.gen_pass_code();
    begin
      update public.profiles set pass_code = new_code, must_set_pin = true where id = p_id;
      if not found then raise exception 'Player not found.'; end if;
      return new_code;
    exception when unique_violation then
      if attempts >= 8 then raise; end if;
    end;
  end loop;
end; $$;

-- Set a new PIN for a player who forgot theirs. Data untouched. Keeps the
-- name+PIN uniqueness (won't collide with a same-named player).
create or replace function public.admin_set_pin(pw text, p_id uuid, new_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare f text; l text;
begin
  perform public.admin_check(pw);
  if new_pin is null or new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be 4 digits.';
  end if;
  select first_name, last_name into f, l from public.profiles where id = p_id;
  if f is null then raise exception 'Player not found.'; end if;
  if exists (
    select 1 from public.profiles p2
    where p2.id <> p_id
      and lower(p2.first_name) = lower(f)
      and lower(p2.last_name)  = lower(l)
      and p2.pin = new_pin
  ) then
    raise exception 'name+pin taken';
  end if;
  update public.profiles set pin = new_pin, must_set_pin = true where id = p_id;
end; $$;

-- Delete a player's account AND all their data. Returns the number of score
-- rows removed. (When the QR hunt lands, add its per-profile deletes here.)
create or replace function public.admin_delete_profile(pw text, p_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.admin_check(pw);
  delete from public.scores where profile_id = p_id;
  get diagnostics n = row_count;
  delete from public.profiles where id = p_id;
  return n;
end; $$;

grant execute on function public.admin_find_profiles(text, text) to anon;
grant execute on function public.admin_reset_pass(text, uuid) to anon;
grant execute on function public.admin_set_pin(text, uuid, text) to anon;
grant execute on function public.admin_delete_profile(text, uuid) to anon;
