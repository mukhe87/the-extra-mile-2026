-- The Extra Mile — License Plate Challenge (state-collecting hunt).
-- Run ONCE in the Supabase SQL editor, after schema.sql, profiles.sql and
-- reset-function.sql (which creates app_config). Nothing to edit in here.
--
-- HOW IT WORKS
--   • You hide ~60 distinct printed code tiles around campus. Each tile has a
--     fixed short id like "LP-7K2P" (seeded below; the admin panel prints them).
--   • What a code is "worth" ROTATES on the server every 10 minutes. At any
--     moment a code is either one of the 50 US states, or a "dud" window.
--     Nothing is stored per-window — it's computed from (code + time + a secret
--     salt), so a screenshot of a code goes stale fast and can't be farmed.
--   • A player scans a code (uploads/enters its id):
--       - shows a state they still need  -> collected; that code is now DONE for
--         that player (can't scan it again).
--       - dud, or a state they already have -> "try this one again later"; a
--         short cooldown is placed on that code for that player.
--   • Collect all 50 states. Ranking = most states, earliest to get there.
--
-- SECURITY: every table is RLS-on. Only hunt_collection is publicly readable
-- (so the live board can subscribe); it can only be written by the SECURITY
-- DEFINER functions below. Codes and per-player scan state are never exposed to
-- the anon key. The rotation salt lives inside the function, not in the bundle.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- The fixed set of valid printed codes. Not anon-readable (don't hand out the
-- list); scans are validated inside hunt_scan.
create table if not exists public.hunt_codes (
  code_id    text primary key,
  created_at timestamptz not null default now()
);
alter table public.hunt_codes enable row level security;
-- no policies => anon cannot read/list codes.

-- A player's collected states (one row per state). Publicly readable for the
-- live leaderboard; written only via hunt_scan (SECURITY DEFINER).
create table if not exists public.hunt_collection (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  state_code text not null,
  via_code   text,
  claimed_at timestamptz not null default now(),
  primary key (profile_id, state_code)
);
create index if not exists hunt_collection_profile_idx on public.hunt_collection (profile_id);
alter table public.hunt_collection enable row level security;

drop policy if exists "read hunt collection" on public.hunt_collection;
create policy "read hunt collection" on public.hunt_collection for select using (true);
-- no insert/update/delete policies => anon writes are denied; the RPC bypasses RLS.

alter publication supabase_realtime add table public.hunt_collection;

-- Per-(player, code) scan state: a permanent 'claimed' block after a success, or
-- a 'cooldown' window after a dud. Private — RPC only.
create table if not exists public.hunt_code_state (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  code_id        text not null,
  status         text not null check (status in ('claimed','cooldown')),
  cooldown_until timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (profile_id, code_id)
);
alter table public.hunt_code_state enable row level security;
-- no policies => RPC only.

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed the printed codes (60 distinct tiles). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.hunt_codes (code_id)
select unnest(array[
  'LP-7K2P','LP-9F4Q','LP-3M8R','LP-6B2T','LP-8H5K','LP-2N9W','LP-5J3D','LP-4C7Y',
  'LP-9P2M','LP-3R6F','LP-7T4B','LP-2K8H','LP-6W3N','LP-5D9J','LP-4Y2C','LP-8M7P',
  'LP-3F5R','LP-9B4T','LP-2H6K','LP-7N3W','LP-5R8D','LP-4T2Y','LP-8K6C','LP-3P9M',
  'LP-6F4R','LP-2B7T','LP-9H3K','LP-5W2N','LP-4D8J','LP-7Y5C','LP-3M2P','LP-8R6F',
  'LP-2T9B','LP-6K4H','LP-9N3W','LP-5C7D','LP-4R2Y','LP-8P5K','LP-3B5M','LP-7F4R',
  'LP-2W6T','LP-6H2K','LP-9D3N','LP-5Y9J','LP-4M7C','LP-8T2P','LP-3K6R','LP-7B4F',
  'LP-2P9T','LP-6R3K','LP-9W5N','LP-5F2D','LP-4H8Y','LP-8C6M','LP-3T3R','LP-7K9B',
  'LP-2M4H','LP-6P7W','LP-9R2D','LP-5B8C'
])
on conflict (code_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- The scan: the whole game in one function.
-- Returns jsonb { result, state, name, total } where result is one of
--   collected | already_have | dud | cooldown | blocked | invalid | unknown_player
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.hunt_scan(p_profile_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- Tunables. Change ROTATE / COOLDOWN minutes or dud % here if desired.
  v_rotate_min  int  := 10;      -- a code's value changes every N minutes
  v_cooldown_min int := 10;      -- after a dud, wait N minutes before re-scanning it
  v_dud_pct     int  := 30;      -- % of windows a code is a "dud"
  v_salt        text := 'em2026-license-plate-rotation-v1';
  v_states      text[] := array[
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
    'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
    'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV',
    'WI','WY'];
  v_names       text[] := array[
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
    'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming'];
  v_code   text := upper(btrim(coalesce(p_code, '')));
  v_win    bigint;
  v_h      bigint;
  v_idx    int;
  v_state  text;
  v_name   text;
  v_row    public.hunt_code_state%rowtype;
  v_total  int;
begin
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    return jsonb_build_object('result','unknown_player');
  end if;

  if v_code = '' or not exists (select 1 from public.hunt_codes where code_id = v_code) then
    return jsonb_build_object('result','invalid');
  end if;

  select count(*)::int into v_total from public.hunt_collection where profile_id = p_profile_id;

  -- Already-resolved state for this (player, code)?
  select * into v_row from public.hunt_code_state
    where profile_id = p_profile_id and code_id = v_code;
  if found then
    if v_row.status = 'claimed' then
      return jsonb_build_object('result','blocked','total',v_total);
    elsif v_row.status = 'cooldown' and v_row.cooldown_until > now() then
      return jsonb_build_object('result','cooldown','total',v_total,
        'retry_at', v_row.cooldown_until);
    end if;
  end if;

  -- Rotation: deterministic value of this code in the current time window.
  v_win := floor(extract(epoch from now()) / (v_rotate_min * 60))::bigint;
  v_h := abs(hashtextextended(v_code || '|' || v_win::text || '|' || v_salt, 42));

  if (v_h % 100) < v_dud_pct then
    -- Dud window: cooldown this code for the player, tell them to try later.
    insert into public.hunt_code_state (profile_id, code_id, status, cooldown_until, updated_at)
    values (p_profile_id, v_code, 'cooldown', now() + make_interval(mins => v_cooldown_min), now())
    on conflict (profile_id, code_id) do update
      set status = 'cooldown', cooldown_until = excluded.cooldown_until, updated_at = now();
    return jsonb_build_object('result','dud','total',v_total);
  end if;

  v_idx := ((v_h / 100) % 50)::int;      -- 0..49
  v_state := v_states[v_idx + 1];
  v_name  := v_names[v_idx + 1];

  -- Already have this state? Treat like a dud for this code (try again later).
  if exists (select 1 from public.hunt_collection
             where profile_id = p_profile_id and state_code = v_state) then
    insert into public.hunt_code_state (profile_id, code_id, status, cooldown_until, updated_at)
    values (p_profile_id, v_code, 'cooldown', now() + make_interval(mins => v_cooldown_min), now())
    on conflict (profile_id, code_id) do update
      set status = 'cooldown', cooldown_until = excluded.cooldown_until, updated_at = now();
    return jsonb_build_object('result','already_have','state',v_state,'name',v_name,'total',v_total);
  end if;

  -- New state! Collect it and permanently mark this code done for the player.
  insert into public.hunt_collection (profile_id, state_code, via_code)
  values (p_profile_id, v_state, v_code)
  on conflict (profile_id, state_code) do nothing;

  insert into public.hunt_code_state (profile_id, code_id, status, cooldown_until, updated_at)
  values (p_profile_id, v_code, 'claimed', null, now())
  on conflict (profile_id, code_id) do update
    set status = 'claimed', cooldown_until = null, updated_at = now();

  v_total := v_total + 1;
  return jsonb_build_object('result','collected','state',v_state,'name',v_name,'total',v_total);
end; $$;

-- Ranked standings for the live board and the Excel export. Most states first,
-- then earliest to reach that count (fastest). state_list is for the export.
create or replace function public.get_hunt_standings(p_limit int default 200)
returns table (
  profile_id uuid, first_name text, last_name text, username text,
  states int, last_at timestamptz, state_list text[]
)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.id, p.first_name, p.last_name, p.username,
      count(c.*)::int as states,
      max(c.claimed_at) as last_at,
      array_agg(c.state_code order by c.claimed_at) as state_list
    from public.profiles p
    join public.hunt_collection c on c.profile_id = p.id
    group by p.id, p.first_name, p.last_name, p.username
    order by states desc, last_at asc
    limit greatest(1, coalesce(p_limit, 200));
end; $$;

-- Admin: wipe all hunt progress (gated by the admin password in app_config).
create or replace function public.admin_reset_hunt(pw text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.admin_check(pw);
  delete from public.hunt_code_state where true;
  delete from public.hunt_collection where true;
  get diagnostics n = row_count;
  return n;
end; $$;

grant execute on function public.hunt_scan(uuid, text) to anon;
grant execute on function public.get_hunt_standings(int) to anon;
grant execute on function public.admin_reset_hunt(text) to anon;
