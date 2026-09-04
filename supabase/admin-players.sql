-- The Extra Mile — Admin player management.
-- Run once in the Supabase SQL editor, after profiles.sql and reset-function.sql
-- (which creates app_config). Every function is gated by the admin password in
-- app_config.reset_password and runs SECURITY DEFINER, so the anon key can call
-- them only with the correct password.
--
--   • admin_find_profiles  — search players by name (with score count + any
--                            active reset code)
--   • admin_reset_account  — issue a 4-digit reset code (valid 24h) for a player
--                            who forgot their PIN; keeps ALL their data
--   • admin_delete_profile — delete the account AND all its data
--
-- The admin never sees or sets a player's PIN. A reset only issues a code the
-- player uses to set their own new PIN (redeem_reset_code in profiles.sql).

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

-- Search players by name or username. Shows the username (so the admin can read
-- it back to a player who forgot it), a live score count, and any active reset
-- code + expiry.
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

-- Reset an account: generate a 4-digit code (unique among active codes), valid
-- 24 hours. Does NOT change the PIN or delete any data.
create or replace function public.admin_reset_account(pw text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  perform public.admin_check(pw);
  loop
    code := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.profiles where reset_code = code and reset_code_expires_at > now()
    );
  end loop;
  update public.profiles
    set reset_code = code, reset_code_expires_at = now() + interval '24 hours'
    where id = p_id;
  if not found then raise exception 'Player not found.'; end if;
  return code;
end; $$;

-- Delete a player's account AND all their data. Returns score rows removed.
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
grant execute on function public.admin_reset_account(text, uuid) to anon;
grant execute on function public.admin_delete_profile(text, uuid) to anon;
