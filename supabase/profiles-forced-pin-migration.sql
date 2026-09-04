-- The Extra Mile — force a personal PIN after an admin reset.
-- Run this ONCE in the Supabase SQL editor (after profiles.sql and
-- admin-players.sql). When an admin issues a new pass or resets a PIN, the
-- player is flagged so that the next time they log in they must choose a new,
-- personal PIN before playing — then the flag clears.

-- 1) The flag.
alter table public.profiles add column if not exists must_set_pin boolean not null default false;

-- 2) Login RPCs also report the flag. Return-type change → drop + recreate.
drop function if exists public.get_profile_by_pass(text);
drop function if exists public.get_profile_by_name_pin(text, text, text);

create or replace function public.get_profile_by_pass(p_pass text)
returns table (id uuid, pass_code text, first_name text, last_name text, must_set_pin boolean)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select pr.id, pr.pass_code, pr.first_name, pr.last_name, pr.must_set_pin
    from public.profiles pr
    where upper(btrim(pr.pass_code)) = upper(btrim(p_pass));
end; $$;

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

-- 3) Admin resets flag the player to set a personal PIN next login.
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

create or replace function public.admin_set_pin(pw text, p_id uuid, new_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare f text; l text;
begin
  perform public.admin_check(pw);
  if new_pin is null or new_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be 4 digits.'; end if;
  select first_name, last_name into f, l from public.profiles where id = p_id;
  if f is null then raise exception 'Player not found.'; end if;
  if exists (
    select 1 from public.profiles p2
    where p2.id <> p_id and lower(p2.first_name) = lower(f) and lower(p2.last_name) = lower(l) and p2.pin = new_pin
  ) then
    raise exception 'name+pin taken';
  end if;
  update public.profiles set pin = new_pin, must_set_pin = true where id = p_id;
end; $$;

-- 4) Player self-service: set a new PIN by presenting the current pass code
-- (which they just used to log in). Clears the must_set_pin flag.
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

grant execute on function public.get_profile_by_pass(text) to anon;
grant execute on function public.get_profile_by_name_pin(text, text, text) to anon;
grant execute on function public.set_own_pin(text, text) to anon;
