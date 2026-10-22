-- Golf Live Board — database schema (ARCHITECTURE.md section 5)
--
-- Tables, row-level security, the write functions (the only way a browser can
-- write), the audit log, and the realtime publication.
--
-- Applied through the Supabase connector (apply_migration). Keep this file in
-- sync with whatever is applied to project yxreupqzwgjzhfosnjbj.
--
-- Every write function returns jsonb: { "ok": true, ... } or
-- { "ok": false, "error": "<code>" }. Rejections are answers, not exceptions,
-- so the app can tell "the server said no" apart from "no signal".

-- ─────────────────────────────────────────────────────────────── tables

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- short join code, e.g. "TC7K2"
  name        text not null,
  played_on   date,
  crew_id     uuid,                          -- groups rounds into a season; "Run it back" keeps it
  course      jsonb not null,                -- copy of the course at creation
  roster      jsonb not null,
  settings    jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  finalized_at timestamptz                   -- organizer finalized: scores locked (organizer PIN to edit)
);
create index if not exists events_crew_idx on public.events (crew_id);
alter table public.events add column if not exists finalized_at timestamptz;  -- added Oct 16, 2026

create table if not exists public.event_secrets (   -- never readable from the browser
  event_id    uuid primary key references public.events(id) on delete cascade,
  admin_pin   text not null
);

create table if not exists public.claims (          -- which phone is which player; never readable
  event_id    uuid references public.events(id) on delete cascade,
  player_id   text not null,
  device_id   uuid not null,
  claimed_at  timestamptz default now(),
  primary key (event_id, player_id),
  unique (event_id, device_id)
);

create table if not exists public.join_requests (   -- "let them in" asks; readable
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.events(id) on delete cascade,
  player_id   text not null,
  status      text not null default 'pending',     -- pending | approved | denied | expired
  approved_by text,
  created_at  timestamptz default now()
);
create index if not exists join_requests_event_idx on public.join_requests (event_id);

create table if not exists public.join_request_devices (   -- requester's device, private
  request_id  uuid primary key references public.join_requests(id) on delete cascade,
  device_id   uuid not null
);

create table if not exists public.audit_log (       -- organizer-only; never readable from the browser
  id          bigint generated always as identity primary key,
  event_id    uuid references public.events(id) on delete cascade,
  at          timestamptz default now(),
  actor       text not null,
  action      text not null
);
create index if not exists audit_log_event_idx on public.audit_log (event_id, id desc);

create table if not exists public.scores (
  event_id    uuid references public.events(id) on delete cascade,
  player_id   text not null,
  hole        smallint not null check (hole between 1 and 18),
  strokes     smallint check (strokes between 1 and 15),   -- null = cleared
  updated_by  text,
  updated_at  timestamptz default now(),
  primary key (event_id, player_id, hole)
);

-- ─────────────────────────────────────────────────────────────── permissions

alter table public.events               enable row level security;
alter table public.event_secrets        enable row level security;  -- no policies at all
alter table public.claims               enable row level security;  -- no policies at all
alter table public.join_request_devices enable row level security;  -- no policies at all
alter table public.audit_log            enable row level security;  -- no policies at all
alter table public.join_requests        enable row level security;
alter table public.scores               enable row level security;

drop policy if exists "anyone can read events"        on public.events;
drop policy if exists "anyone can read scores"        on public.scores;
drop policy if exists "anyone can read join requests" on public.join_requests;
create policy "anyone can read events"        on public.events        for select using (true);
create policy "anyone can read scores"        on public.scores        for select using (true);
create policy "anyone can read join requests" on public.join_requests for select using (true);
-- No insert/update/delete policies: the browser cannot write tables directly.

revoke all on public.events, public.scores, public.join_requests,
              public.event_secrets, public.claims, public.join_request_devices, public.audit_log
  from anon, authenticated;
grant select on public.events, public.scores, public.join_requests to anon, authenticated;

-- ─────────────────────────────────────────────────────────────── helpers (not callable from the browser)

create or replace function public._player(p_roster jsonb, p_pid text)
returns jsonb language sql immutable set search_path = public as $$
  select p from jsonb_array_elements(coalesce(p_roster->'players', '[]'::jsonb)) p
  where p->>'id' = p_pid limit 1
$$;

create or replace function public._player_name(p_roster jsonb, p_pid text)
returns text language sql immutable set search_path = public as $$
  select coalesce(public._player(p_roster, p_pid)->>'name', p_pid)
$$;

create or replace function public._team_name(p_roster jsonb, p_team text)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    (select t->>'name' from jsonb_array_elements(coalesce(p_roster->'teams', '[]'::jsonb)) t
      where t->>'id' = p_team limit 1),
    p_team)
$$;

-- Play order: rotations are written as positions (1–6 = first six holes played).
-- settings.startHole = 10 means holes 10–18 are positions 1–9, holes 1–9 are 10–18.
create or replace function public._play_pos(p_settings jsonb, p_hole int)
returns int language sql immutable set search_path = public as $$
  select ((p_hole - case when coalesce(p_settings->>'startHole', '1') = '10' then 10 else 1 end + 18) % 18) + 1
$$;

create or replace function public._hole_at(p_settings jsonb, p_pos int)
returns int language sql immutable set search_path = public as $$
  select ((case when coalesce(p_settings->>'startHole', '1') = '10' then 10 else 1 end - 1 + p_pos - 1) % 18) + 1
$$;

-- Is player B in player A's foursome on this hole? (section 7.1)
-- Swap mode: your cart + the cart you're playing on that hole's rotation.
-- Fixed mode (or no teams): same group all day.
create or replace function public._same_foursome(p_roster jsonb, p_settings jsonb, p_a text, p_b text, p_hole int)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  a jsonb; b jsonb; rot jsonb; m jsonb; v_pos int := public._play_pos(p_settings, p_hole);
begin
  if p_a = p_b then return true; end if;
  a := public._player(p_roster, p_a);
  b := public._player(p_roster, p_b);
  if a is null or b is null then return false; end if;
  if coalesce(p_settings->>'rotationMode', 'swap') = 'swap'
     and a->>'teamId' is not null and b->>'teamId' is not null
     and jsonb_typeof(p_settings->'rotation') = 'array' then
    if a->>'teamId' = b->>'teamId' then return true; end if;
    for rot in select * from jsonb_array_elements(p_settings->'rotation') loop
      if v_pos between (rot->'holes'->>0)::int and (rot->'holes'->>1)::int then
        for m in select * from jsonb_array_elements(rot->'matches') loop
          if m ? (a->>'teamId') and m ? (b->>'teamId') then return true; end if;
        end loop;
        return false;
      end if;
    end loop;
    return false;
  end if;
  return a->>'groupId' is not null and a->>'groupId' = b->>'groupId';
end $$;

create or replace function public._event(p_code text)
returns public.events language sql stable security definer set search_path = public as $$
  select * from public.events where code = upper(trim(p_code)) limit 1
$$;

create or replace function public._admin_ok(p_event uuid, p_pin text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_pin is not null and exists (
    select 1 from public.event_secrets where event_id = p_event and admin_pin = trim(p_pin))
$$;

create or replace function public._log(p_event uuid, p_actor text, p_action text)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (event_id, actor, action) values (p_event, p_actor, p_action)
$$;

create or replace function public._fmt(p_v text)
returns text language sql immutable set search_path = public as $$
  select case p_v
    when 'rotationMatch'     then 'Match Play'
    when 'rotationPlusMinus' then 'Plus/Minus'
    when 'none'              then 'none'
    when 'bestBall'          then 'Best ball'
    when 'aggregate'         then 'Aggregate'
    when 'bestBallAggregate' then 'Low Ball + Low Total'
    when 'doublePar'         then 'Double par'
    when 'netDoubleBogey'    then 'Net double bogey'
    when 'swap'              then 'carts swap'
    when 'fixed'             then 'fixed foursomes'
    when 'full'              then 'strokes as entered'
    when 'offLow'            then 'off the low man'
    when 'true'              then 'on'
    when 'false'             then 'off'
    when 'null'              then 'none'
    else p_v end
$$;

create or replace function public._setting_label(p_key text)
returns text language sql immutable set search_path = public as $$
  select case p_key
    when 'handicapMode'     then 'Handicaps'
    when 'allowancePct'     then 'Allowance %'
    when 'game'             then 'Game'
    when 'teamScore'        then 'Team score'
    when 'halvedHolePoints' then 'Halved points'
    when 'plusMinusCap'     then 'Plus/Minus cap'
    when 'maxHoleScore'     then 'Max hole score'
    when 'par3NoMax'        then 'No max on par 3s'
    when 'rotationMode'     then 'Foursomes'
    when 'matchBonus'       then 'Matchup win bonus'
    when 'startHole'        then 'First tee'
    when 'teeTimes'         then 'Tee times'
    when 'gps'              then 'GPS yardages'
    else p_key end
$$;

-- Which hole is this player on? (last posted hole, and the one after it)
create or replace function public._last_hole(p_event uuid, p_pid text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(hole), 0)::int from public.scores
  where event_id = p_event and player_id = p_pid and strokes is not null
$$;

-- ─────────────────────────────────────────────────────────────── write functions

create or replace function public.create_event(
  p_name text, p_course jsonb, p_roster jsonb, p_settings jsonb,
  p_played_on date default null, p_crew_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_code text; v_pin text; v_id uuid;
  v_crew uuid := coalesce(p_crew_id, gen_random_uuid());
begin
  if coalesce(trim(p_name), '') = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if p_course is null or p_roster is null or p_settings is null then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if octet_length(p_course::text) + octet_length(p_roster::text) + octet_length(p_settings::text) > 60000 then
    return jsonb_build_object('ok', false, 'error', 'too_large');
  end if;
  loop
    select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
      into v_code from generate_series(1, 5);
    exit when not exists (select 1 from public.events where code = v_code);
  end loop;
  v_pin := lpad(floor(random() * 10000)::int::text, 4, '0');
  insert into public.events (code, name, played_on, crew_id, course, roster, settings)
  values (v_code, left(trim(p_name), 60), coalesce(p_played_on, current_date), v_crew, p_course, p_roster, p_settings)
  returning id into v_id;
  insert into public.event_secrets (event_id, admin_pin) values (v_id, v_pin);
  perform public._log(v_id, 'System', 'Round created at ' || coalesce(p_course->>'name', 'a course'));
  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code, 'admin_pin', v_pin, 'crew_id', v_crew);
end $$;

create or replace function public.verify_admin(p_code text, p_admin_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.claimed_players(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'players',
    coalesce((select jsonb_agg(player_id order by player_id) from public.claims where event_id = e.id), '[]'::jsonb));
end $$;

-- Which player (if any) does this phone hold? Lets a phone confirm its name after a
-- "let them in" or an organizer release while it was asleep.
create or replace function public.whoami(p_code text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select player_id into v_pid from public.claims where event_id = e.id and device_id = p_device_id;
  return jsonb_build_object('ok', true, 'player_id', v_pid);
end $$;

create or replace function public.claim_player(p_code text, p_player_id text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_mine text; p jsonb;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  p := public._player(e.roster, p_player_id);
  if p is null then return jsonb_build_object('ok', false, 'error', 'unknown_player'); end if;
  select player_id into v_mine from public.claims where event_id = e.id and device_id = p_device_id;
  if v_mine = p_player_id then return jsonb_build_object('ok', true, 'player_id', p_player_id); end if;
  if v_mine is not null then return jsonb_build_object('ok', false, 'error', 'already_playing', 'player_id', v_mine); end if;
  if exists (select 1 from public.claims where event_id = e.id and player_id = p_player_id) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  begin
    insert into public.claims (event_id, player_id, device_id) values (e.id, p_player_id, p_device_id);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  perform public._log(e.id, p->>'name', 'Joined as ' || (p->>'name') || ' (' ||
    case when p->>'teamId' is not null then public._team_name(e.roster, p->>'teamId')
         else coalesce((select g->>'name' from jsonb_array_elements(coalesce(e.roster->'groups', '[]'::jsonb)) g
                         where g->>'id' = p->>'groupId' limit 1), 'no group') end || ')');
  return jsonb_build_object('ok', true, 'player_id', p_player_id);
end $$;

create or replace function public.leave_round(p_code text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  delete from public.claims where event_id = e.id and device_id = p_device_id returning player_id into v_pid;
  if v_pid is null then return jsonb_build_object('ok', true, 'player_id', null); end if;
  perform public._log(e.id, public._player_name(e.roster, v_pid), public._player_name(e.roster, v_pid) || '''s phone left the round');
  return jsonb_build_object('ok', true, 'player_id', v_pid);
end $$;

create or replace function public.request_join(p_code text, p_player_id text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_mine text; v_req uuid; v_name text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if public._player(e.roster, p_player_id) is null then return jsonb_build_object('ok', false, 'error', 'unknown_player'); end if;
  v_name := public._player_name(e.roster, p_player_id);
  select player_id into v_mine from public.claims where event_id = e.id and device_id = p_device_id;
  if v_mine = p_player_id then return jsonb_build_object('ok', true, 'claimed', true, 'player_id', p_player_id); end if;
  if v_mine is not null then return jsonb_build_object('ok', false, 'error', 'already_playing', 'player_id', v_mine); end if;
  -- Name freed up in the meantime: just take it.
  if not exists (select 1 from public.claims where event_id = e.id and player_id = p_player_id) then
    return public.claim_player(p_code, p_player_id, p_device_id) || jsonb_build_object('claimed', true);
  end if;
  -- Tidy: stale requests for this name, and this phone's earlier asks.
  update public.join_requests set status = 'expired'
   where event_id = e.id and status = 'pending'
     and (created_at < now() - interval '5 minutes'
          or id in (select request_id from public.join_request_devices where device_id = p_device_id));
  insert into public.join_requests (event_id, player_id) values (e.id, p_player_id) returning id into v_req;
  insert into public.join_request_devices (request_id, device_id) values (v_req, p_device_id);
  perform public._log(e.id, 'System', 'A new phone asked to join as ' || v_name);
  return jsonb_build_object('ok', true, 'request_id', v_req);
end $$;

-- Shared check for approve/deny: organizer PIN, or a phone in that player's current foursome.
-- "Current" = the first hole (play order) they haven't posted — what Enter shows them — or the
-- hole before it (so both foursomes can answer while carts swap). The organizer is the backup.
create or replace function public._join_approver(e public.events, p_player_id text, p_device_id uuid, p_admin_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare v_pid text; v_gap int;
begin
  if p_admin_pin is not null and public._admin_ok(e.id, p_admin_pin) then return 'Organizer'; end if;
  select player_id into v_pid from public.claims where event_id = e.id and device_id = p_device_id;
  if v_pid is null then return null; end if;
  select coalesce(min(pos), 18) into v_gap from generate_series(1, 18) pos
   where not exists (select 1 from public.scores s
                      where s.event_id = e.id and s.player_id = p_player_id
                        and s.hole = public._hole_at(e.settings, pos) and s.strokes is not null);
  if public._same_foursome(e.roster, e.settings, v_pid, p_player_id, public._hole_at(e.settings, v_gap))
     or public._same_foursome(e.roster, e.settings, v_pid, p_player_id, public._hole_at(e.settings, greatest(v_gap - 1, 1))) then
    return public._player_name(e.roster, v_pid);
  end if;
  return null;
end $$;

create or replace function public.approve_join(p_code text, p_approver_device_id uuid, p_request_id uuid, p_admin_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; r public.join_requests; v_dev uuid; v_actor text; v_has text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into r from public.join_requests where id = p_request_id and event_id = e.id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no_request'); end if;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'already_' || r.status); end if;
  if r.created_at < now() - interval '5 minutes' then
    update public.join_requests set status = 'expired' where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  v_actor := public._join_approver(e, r.player_id, p_approver_device_id, p_admin_pin);
  if v_actor is null then return jsonb_build_object('ok', false, 'error', 'not_your_foursome'); end if;
  select device_id into v_dev from public.join_request_devices where request_id = r.id;
  select player_id into v_has from public.claims where event_id = e.id and device_id = v_dev;
  if v_has is not null and v_has <> r.player_id then
    update public.join_requests set status = 'expired' where id = r.id;
    return jsonb_build_object('ok', false, 'error', 'requester_already_playing');
  end if;
  delete from public.claims where event_id = e.id and (player_id = r.player_id or device_id = v_dev);
  insert into public.claims (event_id, player_id, device_id) values (e.id, r.player_id, v_dev);
  update public.join_requests set status = 'approved', approved_by = v_actor where id = r.id;
  perform public._log(e.id, v_actor, 'Let in ' || public._player_name(e.roster, r.player_id) || '''s new phone');
  return jsonb_build_object('ok', true, 'player_id', r.player_id);
end $$;

create or replace function public.deny_join(p_code text, p_approver_device_id uuid, p_request_id uuid, p_admin_pin text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; r public.join_requests; v_actor text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into r from public.join_requests where id = p_request_id and event_id = e.id for update;
  if r.id is null then return jsonb_build_object('ok', false, 'error', 'no_request'); end if;
  if r.status <> 'pending' then return jsonb_build_object('ok', false, 'error', 'already_' || r.status); end if;
  v_actor := public._join_approver(e, r.player_id, p_approver_device_id, p_admin_pin);
  if v_actor is null then return jsonb_build_object('ok', false, 'error', 'not_your_foursome'); end if;
  update public.join_requests set status = 'denied', approved_by = v_actor where id = r.id;
  perform public._log(e.id, v_actor, 'Turned away a phone asking to be ' || public._player_name(e.roster, r.player_id));
  return jsonb_build_object('ok', true);
end $$;

-- Shared upsert + audit line for both score functions.
create or replace function public._write_score(e public.events, p_player_id text, p_hole int, p_strokes int, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old smallint; v_found boolean; v_at timestamptz; v_name text;
begin
  if p_hole is null or p_hole < 1 or p_hole > 18 then return jsonb_build_object('ok', false, 'error', 'bad_hole'); end if;
  if p_strokes is not null and (p_strokes < 1 or p_strokes > 15) then return jsonb_build_object('ok', false, 'error', 'bad_strokes'); end if;
  if public._player(e.roster, p_player_id) is null then return jsonb_build_object('ok', false, 'error', 'unknown_player'); end if;
  select strokes, true into v_old, v_found from public.scores
   where event_id = e.id and player_id = p_player_id and hole = p_hole for update;
  if coalesce(v_found, false) and v_old is not distinct from p_strokes::smallint then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  if not coalesce(v_found, false) and p_strokes is null then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  insert into public.scores (event_id, player_id, hole, strokes, updated_by, updated_at)
  values (e.id, p_player_id, p_hole, p_strokes, p_by, now())
  on conflict (event_id, player_id, hole)
  do update set strokes = excluded.strokes, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning updated_at into v_at;
  v_name := public._player_name(e.roster, p_player_id);
  perform public._log(e.id, p_by, 'Hole ' || p_hole || ' · ' || v_name || ' ' ||
    case when p_strokes is null then 'cleared (was ' || v_old || ')'
         when v_old is null then p_strokes::text
         else v_old || ' → ' || p_strokes end);
  return jsonb_build_object('ok', true, 'updated_at', v_at, 'updated_by', p_by);
end $$;

create or replace function public.upsert_score(p_code text, p_device_id uuid, p_player_id text, p_hole int, p_strokes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_actor text; v_old smallint; v_by text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select player_id into v_actor from public.claims where event_id = e.id and device_id = p_device_id;
  if v_actor is null then return jsonb_build_object('ok', false, 'error', 'not_claimed'); end if;
  if not public._same_foursome(e.roster, e.settings, v_actor, p_player_id, p_hole) then
    return jsonb_build_object('ok', false, 'error', 'not_your_foursome');
  end if;
  if e.finalized_at is not null then return jsonb_build_object('ok', false, 'error', 'finalized'); end if;
  -- A player's own entry wins (Oct 21): nobody else can change or clear a score the player entered
  -- on their own phone. They can always change it themselves; the organizer (admin_upsert_score) can too.
  if v_actor <> p_player_id then
    select strokes, updated_by into v_old, v_by from public.scores
     where event_id = e.id and player_id = p_player_id and hole = p_hole;
    if v_old is not null and v_by = public._player_name(e.roster, p_player_id)
       and v_old is distinct from p_strokes::smallint then
      return jsonb_build_object('ok', false, 'error', 'own_entry', 'strokes', v_old, 'updated_by', v_by);
    end if;
  end if;
  return public._write_score(e, p_player_id, p_hole, p_strokes, public._player_name(e.roster, v_actor));
end $$;

create or replace function public.admin_upsert_score(p_code text, p_admin_pin text, p_player_id text, p_hole int, p_strokes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  return public._write_score(e, p_player_id, p_hole, p_strokes, 'Organizer');
end $$;

create or replace function public.update_event(
  p_code text, p_admin_pin text, p_course jsonb, p_roster jsonb, p_settings jsonb, p_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.events; k text; np jsonb; op jsonb; nt jsonb; ot jsonb; i int;
  v_old text; v_new text; v_lines int := 0; v_name text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  if p_course is null or p_roster is null or p_settings is null then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  if octet_length(p_course::text) + octet_length(p_roster::text) + octet_length(p_settings::text) > 60000 then
    return jsonb_build_object('ok', false, 'error', 'too_large');
  end if;
  v_name := coalesce(nullif(left(trim(p_name), 60), ''), e.name);

  -- Plain-English audit lines for what changed.
  if v_name <> e.name then
    perform public._log(e.id, 'Organizer', 'Round name · ' || e.name || ' → ' || v_name); v_lines := v_lines + 1;
  end if;
  for k in select key from (select jsonb_object_keys(e.settings) as key
                            union select jsonb_object_keys(p_settings)) s order by key loop
    if (e.settings->k) is distinct from (p_settings->k) then
      if k = 'rotation' then
        perform public._log(e.id, 'Organizer', 'Rules · matchups reshuffled');
      else
        perform public._log(e.id, 'Organizer', 'Rules · ' || public._setting_label(k) || ' ' ||
          public._fmt(coalesce(e.settings->>k, 'null')) || ' → ' || public._fmt(coalesce(p_settings->>k, 'null')));
      end if;
      v_lines := v_lines + 1;
    end if;
  end loop;
  for nt in select * from jsonb_array_elements(coalesce(p_roster->'teams', '[]'::jsonb)) loop
    v_old := public._team_name(e.roster, nt->>'id');
    if v_old is distinct from nt->>'name' then
      perform public._log(e.id, 'Organizer', 'Team name · ' || v_old || ' → ' || (nt->>'name')); v_lines := v_lines + 1;
    end if;
  end loop;
  for np in select * from jsonb_array_elements(coalesce(p_roster->'players', '[]'::jsonb)) loop
    op := public._player(e.roster, np->>'id');
    if op is null then
      perform public._log(e.id, 'Organizer', 'Players · added ' || (np->>'name')); v_lines := v_lines + 1;
      continue;
    end if;
    if op->>'name' is distinct from np->>'name' then
      perform public._log(e.id, 'Organizer', 'Players · ' || (op->>'name') || ' → ' || (np->>'name')); v_lines := v_lines + 1;
    end if;
    if coalesce(nullif(op->>'strokes', '')::numeric, 0) <> coalesce(nullif(np->>'strokes', '')::numeric, 0) then
      perform public._log(e.id, 'Organizer', 'Strokes · ' || (np->>'name') || ' ' ||
        coalesce(nullif(op->>'strokes', ''), '0') || ' → ' || coalesce(nullif(np->>'strokes', ''), '0'));
      v_lines := v_lines + 1;
    end if;
    if op->>'teamId' is distinct from np->>'teamId' then
      perform public._log(e.id, 'Organizer', 'Players · ' || (np->>'name') || ' moved to ' ||
        coalesce(public._team_name(p_roster, np->>'teamId'), 'no team')); v_lines := v_lines + 1;
    end if;
  end loop;
  for op in select * from jsonb_array_elements(coalesce(e.roster->'players', '[]'::jsonb)) loop
    if public._player(p_roster, op->>'id') is null then
      perform public._log(e.id, 'Organizer', 'Players · removed ' || (op->>'name')); v_lines := v_lines + 1;
    end if;
  end loop;
  for i in 0..17 loop
    if (e.course->'par'->>i) is distinct from (p_course->'par'->>i) then
      perform public._log(e.id, 'Organizer', 'Hole ' || (i + 1) || ' · par ' ||
        coalesce(e.course->'par'->>i, '?') || ' → ' || coalesce(p_course->'par'->>i, '?')); v_lines := v_lines + 1;
    end if;
    if (e.course->'strokeIndex'->>i) is distinct from (p_course->'strokeIndex'->>i) then
      perform public._log(e.id, 'Organizer', 'Hole ' || (i + 1) || ' · hcp ' ||
        coalesce(e.course->'strokeIndex'->>i, '?') || ' → ' || coalesce(p_course->'strokeIndex'->>i, '?')); v_lines := v_lines + 1;
    end if;
  end loop;
  if (e.course->'tee'->>'name') is distinct from (p_course->'tee'->>'name') then
    perform public._log(e.id, 'Organizer', 'Course · tees ' || coalesce(e.course->'tee'->>'name', 'none') ||
      ' → ' || coalesce(p_course->'tee'->>'name', 'none')); v_lines := v_lines + 1;
  end if;

  update public.events
     set name = v_name, course = p_course, roster = p_roster, settings = p_settings, updated_at = now()
   where id = e.id;
  return jsonb_build_object('ok', true, 'changes', v_lines);
end $$;

create or replace function public.release_player(p_code text, p_admin_pin text, p_player_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_dev uuid;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  delete from public.claims where event_id = e.id and player_id = p_player_id returning device_id into v_dev;
  if v_dev is null then return jsonb_build_object('ok', true, 'released', false); end if;
  perform public._log(e.id, 'Organizer', 'Freed up ' || public._player_name(e.roster, p_player_id) || '''s spot');
  return jsonb_build_object('ok', true, 'released', true);
end $$;

create or replace function public.get_audit_log(p_code text, p_admin_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('at', at, 'actor', actor, 'action', action) order by id desc)
      from (select * from public.audit_log where event_id = e.id order by id desc limit 500) a), '[]'::jsonb));
end $$;

-- Organizer: wipe every score but keep the round (players, carts, settings, joined phones).
-- Scores are cleared to null (not deleted) so every phone hears it over Realtime.
create or replace function public.reset_round(p_code text, p_admin_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; n int;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  update public.scores set strokes = null, updated_by = 'Organizer', updated_at = now()
   where event_id = e.id and strokes is not null;
  get diagnostics n = row_count;
  update public.join_requests set status = 'expired' where event_id = e.id and status = 'pending';
  update public.events set updated_at = now(), finalized_at = null where id = e.id;  -- a reset round is open again
  perform public._log(e.id, 'Organizer', 'Reset the round · cleared ' || n || ' score' || case when n = 1 then '' else 's' end);
  return jsonb_build_object('ok', true, 'cleared', n);
end $$;

-- Organizer: finalize the round (locks every score; players can't change them) or reopen it.
-- While finalized, upsert_score / fill_score / pick_team_name refuse with 'finalized';
-- admin_upsert_score (organizer PIN) still works, so the organizer can fix a score.
create or replace function public.finalize_round(p_code text, p_admin_pin text, p_final boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_at timestamptz;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  if coalesce(p_final, true) = (e.finalized_at is not null) then
    return jsonb_build_object('ok', true, 'unchanged', true, 'finalized_at', e.finalized_at);
  end if;
  update public.events set finalized_at = case when coalesce(p_final, true) then now() end, updated_at = now()
   where id = e.id returning finalized_at into v_at;
  perform public._log(e.id, 'Organizer', case when v_at is null then 'Reopened the round · scores unlocked' else 'Finalized the round · scores locked' end);
  return jsonb_build_object('ok', true, 'finalized_at', v_at);
end $$;

-- Organizer: delete the round and everything in it (scores, joined phones, PIN, activity log).
create or replace function public.delete_round(p_code text, p_admin_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if not public._admin_ok(e.id, p_admin_pin) then return jsonb_build_object('ok', false, 'error', 'bad_pin'); end if;
  delete from public.events where id = e.id;  -- cascades to every table that references it
  return jsonb_build_object('ok', true);
end $$;

-- A joined phone names its own cart (either partner). First come, first served:
-- a name another cart already has is refused. Locks the round row so two carts
-- tapping the same name at once can't both get it.
create or replace function public.pick_team_name(p_code text, p_device_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text; v_team text; v_name text := left(trim(coalesce(p_name, '')), 20); v_old text; v_by text;
begin
  select * into e from public.events where code = upper(trim(p_code)) for update;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if e.finalized_at is not null then return jsonb_build_object('ok', false, 'error', 'finalized'); end if;
  select player_id into v_pid from public.claims where event_id = e.id and device_id = p_device_id;
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'not_claimed'); end if;
  v_team := public._player(e.roster, v_pid)->>'teamId';
  if v_team is null then return jsonb_build_object('ok', false, 'error', 'no_team'); end if;
  select t->>'id' into v_by from jsonb_array_elements(coalesce(e.roster->'teams', '[]'::jsonb)) t
   where t->>'id' <> v_team and lower(trim(t->>'name')) = lower(v_name) limit 1;
  if v_by is not null then return jsonb_build_object('ok', false, 'error', 'taken', 'team', v_by); end if;
  v_old := public._team_name(e.roster, v_team);
  if v_old = v_name then return jsonb_build_object('ok', true, 'team', v_team, 'name', v_name, 'unchanged', true); end if;
  update public.events
     set roster = jsonb_set(roster, '{teams}', (
           select jsonb_agg(case when t->>'id' = v_team then jsonb_set(t, '{name}', to_jsonb(v_name)) else t end order by ord)
             from jsonb_array_elements(roster->'teams') with ordinality as x(t, ord))),
         updated_at = now()
   where id = e.id;
  perform public._log(e.id, public._player_name(e.roster, v_pid), 'Named the cart ' || v_name || ' (was ' || v_old || ')');
  return jsonb_build_object('ok', true, 'team', v_team, 'name', v_name);
end $$;

-- Legacy (the app stopped calling it Oct 16, 2026; kept for phones with old queued fills):
-- Next hole with a tile left blank = par. Only fills a cell that is still empty
-- (one atomic insert-or-update-if-null), so it never overwrites a score another
-- phone entered a moment earlier; returns what the cell holds either way.
create or replace function public.fill_score(p_code text, p_device_id uuid, p_player_id text, p_hole int, p_strokes int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_actor text; v_by text; v_at timestamptz; v_cur smallint;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select player_id into v_actor from public.claims where event_id = e.id and device_id = p_device_id;
  if v_actor is null then return jsonb_build_object('ok', false, 'error', 'not_claimed'); end if;
  if not public._same_foursome(e.roster, e.settings, v_actor, p_player_id, p_hole) then
    return jsonb_build_object('ok', false, 'error', 'not_your_foursome');
  end if;
  if p_hole is null or p_hole < 1 or p_hole > 18 then return jsonb_build_object('ok', false, 'error', 'bad_hole'); end if;
  if p_strokes is null or p_strokes < 1 or p_strokes > 15 then return jsonb_build_object('ok', false, 'error', 'bad_strokes'); end if;
  if public._player(e.roster, p_player_id) is null then return jsonb_build_object('ok', false, 'error', 'unknown_player'); end if;
  if e.finalized_at is not null then return jsonb_build_object('ok', false, 'error', 'finalized'); end if;
  v_by := public._player_name(e.roster, v_actor);
  insert into public.scores (event_id, player_id, hole, strokes, updated_by, updated_at)
  values (e.id, p_player_id, p_hole, p_strokes, v_by, now())
  on conflict (event_id, player_id, hole)
  do update set strokes = excluded.strokes, updated_by = excluded.updated_by, updated_at = excluded.updated_at
     where public.scores.strokes is null
  returning updated_at into v_at;
  if v_at is null then
    select strokes into v_cur from public.scores where event_id = e.id and player_id = p_player_id and hole = p_hole;
    return jsonb_build_object('ok', true, 'filled', false, 'strokes', v_cur);
  end if;
  perform public._log(e.id, v_by, 'Hole ' || p_hole || ' · ' || public._player_name(e.roster, p_player_id) || ' ' || p_strokes || ' (left at par)');
  return jsonb_build_object('ok', true, 'filled', true, 'strokes', p_strokes, 'updated_at', v_at, 'updated_by', v_by);
end $$;

-- ─────────────────────────────────────────────────────────────── function permissions

revoke execute on function
  public._player(jsonb, text), public._player_name(jsonb, text), public._team_name(jsonb, text),
  public._play_pos(jsonb, int), public._hole_at(jsonb, int),
  public._same_foursome(jsonb, jsonb, text, text, int), public._event(text), public._admin_ok(uuid, text),
  public._log(uuid, text, text), public._fmt(text), public._setting_label(text), public._last_hole(uuid, text),
  public._join_approver(public.events, text, uuid, text),
  public._write_score(public.events, text, int, int, text)
  from public, anon, authenticated;

grant execute on function
  public.create_event(text, jsonb, jsonb, jsonb, date, uuid),
  public.verify_admin(text, text),
  public.claimed_players(text),
  public.whoami(text, uuid),
  public.claim_player(text, text, uuid),
  public.leave_round(text, uuid),
  public.request_join(text, text, uuid),
  public.approve_join(text, uuid, uuid, text),
  public.deny_join(text, uuid, uuid, text),
  public.upsert_score(text, uuid, text, int, int),
  public.admin_upsert_score(text, text, text, int, int),
  public.fill_score(text, uuid, text, int, int),
  public.update_event(text, text, jsonb, jsonb, jsonb, text),
  public.release_player(text, text, text),
  public.get_audit_log(text, text),
  public.reset_round(text, text),
  public.finalize_round(text, text, boolean),
  public.delete_round(text, text),
  public.pick_team_name(text, uuid, text)
  to anon, authenticated;

-- ─────────────────────────────────────────────────────────────── crews + people (Oct 21, 2026)
-- A crew = a friend group (events.crew_id); a person = one human across rounds (roster
-- personId). No sign-ups: first + last name, plus a nickname when that full name is taken.
-- Kept in sync with every roster by the events_sync_crew trigger. Migration with the backfill:
-- supabase/migrations/2026-10-21-crews-people.sql.

create table if not exists public.crews (
  id         uuid primary key,
  name       text,                                   -- set later (crew naming / invites)
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id         uuid primary key,                       -- = roster player personId
  first_name text not null,
  last_name  text,                                   -- null for people from before last names
  nickname   text,                                   -- only needed when first + last is taken
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One "Andrew Duong" in the whole app (add a nickname to be a second one).
create unique index if not exists people_full_name_uq
  on public.people (lower(first_name), lower(last_name), lower(coalesce(nickname, '')))
  where last_name is not null;

create table if not exists public.crew_members (
  crew_id     uuid not null references public.crews (id) on delete cascade,
  person_id   uuid not null references public.people (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  last_played date,
  rounds      int not null default 0,
  primary key (crew_id, person_id)
);
create index if not exists crew_members_person_idx on public.crew_members (person_id);

-- Reads go through the RPCs below only (full names aren't publicly listable).
alter table public.crews        enable row level security;  -- no policies at all
alter table public.people       enable row level security;  -- no policies at all
alter table public.crew_members enable row level security;  -- no policies at all

-- Keeps people / crews / crew_members in step with a round's roster. Never blocks the round:
-- a name clash (someone else already has that full name) just leaves that person's name as it was.
create or replace function public._sync_crew()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p jsonb; v_pid uuid; v_first text; v_last text; v_nick text; v_new boolean;
begin
  if new.crew_id is null or coalesce(new.settings->>'practice', 'false') = 'true' then return new; end if;
  insert into public.crews (id) values (new.crew_id) on conflict (id) do nothing;
  for p in select * from jsonb_array_elements(coalesce(new.roster->'players', '[]'::jsonb)) loop
    if coalesce(p->>'personId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then continue; end if;
    v_pid   := (p->>'personId')::uuid;
    v_first := left(nullif(trim(coalesce(p->>'firstName', split_part(trim(coalesce(p->>'name', '')), ' ', 1))), ''), 24);
    v_last  := left(nullif(trim(coalesce(p->>'lastName', '')), ''), 30);
    v_nick  := left(nullif(trim(coalesce(p->>'nickname', '')), ''), 24);
    if v_first is null then continue; end if;
    begin
      insert into public.people (id, first_name, last_name, nickname) values (v_pid, v_first, v_last, v_nick)
      on conflict (id) do update
        set first_name = excluded.first_name, last_name = excluded.last_name, nickname = excluded.nickname, updated_at = now()
        where p ? 'firstName'                       -- only rosters that carry the full name update it
          and (people.first_name, people.last_name, people.nickname)
              is distinct from (excluded.first_name, excluded.last_name, excluded.nickname);
    exception when unique_violation then
      -- full name taken by someone else: keep (or create) the person without the clashing last name
      insert into public.people (id, first_name) values (v_pid, v_first) on conflict (id) do nothing;
    end;
    v_new := tg_op = 'INSERT' or not exists (
      select 1 from jsonb_array_elements(coalesce(old.roster->'players', '[]'::jsonb)) o where o->>'personId' = p->>'personId');
    insert into public.crew_members (crew_id, person_id, last_played, rounds)
    values (new.crew_id, v_pid, new.played_on, 1)
    on conflict (crew_id, person_id) do update
      set last_played = greatest(crew_members.last_played, excluded.last_played),
          rounds = crew_members.rounds + case when v_new then 1 else 0 end;
  end loop;
  return new;
end $$;

create or replace trigger events_sync_crew after insert or update of roster, crew_id on public.events
  for each row execute function public._sync_crew();

-- Everyone in a crew (for Setup's players list), most recent first.
create or replace function public.crew_people(p_crew_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'people', coalesce(jsonb_agg(jsonb_build_object(
           'id', pe.id, 'firstName', pe.first_name, 'lastName', pe.last_name, 'nickname', pe.nickname,
           'lastPlayed', m.last_played, 'rounds', m.rounds)
         order by m.last_played desc nulls last, m.rounds desc, pe.first_name), '[]'::jsonb))
    from public.crew_members m join public.people pe on pe.id = m.person_id
   where m.crew_id = p_crew_id
$$;

-- Is this full name free? If it belongs to someone in your crew, that's probably them: says who.
-- Only says yes/no about people outside your crew.
create or replace function public.person_name_check(
  p_first text, p_last text, p_nickname text default null, p_crew_id uuid default null, p_person_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_id uuid; v_mate boolean;
begin
  if coalesce(trim(p_first), '') = '' or coalesce(trim(p_last), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;
  select id into v_id from public.people
   where lower(first_name) = lower(trim(p_first)) and lower(last_name) = lower(trim(p_last))
     and lower(coalesce(nickname, '')) = lower(coalesce(trim(p_nickname), ''))
     and (p_person_id is null or id <> p_person_id)
   limit 1;
  if v_id is null then return jsonb_build_object('ok', true, 'taken', false); end if;
  v_mate := p_crew_id is not null and exists (select 1 from public.crew_members where crew_id = p_crew_id and person_id = v_id);
  return jsonb_build_object('ok', true, 'taken', true, 'crewMate', v_mate) || case when v_mate then jsonb_build_object('id', v_id) else '{}'::jsonb end;
end $$;

grant execute on function public.crew_people(uuid) to anon, authenticated;
grant execute on function public.person_name_check(text, text, text, uuid, uuid) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────── realtime

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores') then
    alter publication supabase_realtime add table public.scores;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'join_requests') then
    alter publication supabase_realtime add table public.join_requests;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────── crews, step 2+ (Oct 22: features 006–009)
-- A crew gets a name, a short invite code (reset kills old links) and an owner: the phone that started it
-- (or, for crews from before this, the first phone to rename it / reset its link / start a season).
-- Phones join by knowing the crew id (from the invite); crew_claims says which person each phone is.
alter table public.crews add column if not exists invite_code  text unique;
alter table public.crews add column if not exists owner_device uuid;
alter table public.crews add column if not exists owner_person uuid;
alter table public.crew_members add column if not exists removed boolean not null default false;

create table if not exists public.crew_claims (
  crew_id    uuid not null references public.crews (id) on delete cascade,
  person_id  uuid not null references public.people (id) on delete cascade,
  device_id  uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (crew_id, person_id)
);
create unique index if not exists crew_claims_device_idx on public.crew_claims (crew_id, device_id);

-- Seasons: a row starts a season (starts_on null = starts with the crew's next round). The crew's first
-- season is implicit (from its first round) until someone starts a second one.
create table if not exists public.seasons (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews (id) on delete cascade,
  name       text not null,
  starts_on  date,
  created_at timestamptz not null default now()
);
create index if not exists seasons_crew_idx on public.seasons (crew_id, created_at);

alter table public.crew_claims enable row level security;
alter table public.seasons enable row level security;

create or replace function public._invite_code()
returns text language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.crews where invite_code = c);
  end loop;
  return c;
end $$;

-- Owner-only actions: the owner phone, or anyone while a crew has no owner yet (who then becomes it).
create or replace function public._crew_owner_ok(p_crew uuid, p_device uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_device into v_owner from public.crews where id = p_crew;
  if not found then return false; end if;
  if v_owner is null then
    update public.crews set owner_device = p_device,
      owner_person = (select person_id from public.crew_claims where crew_id = p_crew and device_id = p_device)
     where id = p_crew;
    return true;
  end if;
  return v_owner = p_device;
end $$;

create or replace function public._crew_card(p_crew uuid, p_device uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'code', c.invite_code,
    'isOwner', c.owner_device is null or c.owner_device = p_device, 'hasOwner', c.owner_device is not null,
    'owner', (select pe.first_name from public.people pe where pe.id = c.owner_person),
    'players', (select count(*) from public.crew_members m where m.crew_id = c.id and not m.removed),
    'rounds', (select count(*) from public.events e where e.crew_id = c.id and coalesce(e.settings->>'practice', 'false') <> 'true'),
    'since', (select min(e.played_on) from public.events e where e.crew_id = c.id and coalesce(e.settings->>'practice', 'false') <> 'true'),
    'me', (select person_id from public.crew_claims where crew_id = c.id and device_id = p_device),
    'claimed', coalesce((select jsonb_agg(person_id) from public.crew_claims where crew_id = c.id and device_id <> p_device), '[]'::jsonb),
    'seasons', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'startsOn', s.starts_on, 'createdAt', s.created_at) order by s.created_at)
                 from public.seasons s where s.crew_id = c.id), '[]'::jsonb))
  from public.crews c where c.id = p_crew
$$;

-- Crew card / settings / seasons for this phone. Makes sure the crew has an invite code.
create or replace function public.crew_info(p_crew_id uuid, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.crews where id = p_crew_id) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  update public.crews set invite_code = public._invite_code() where id = p_crew_id and invite_code is null;
  return jsonb_build_object('ok', true, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- Join screen: what a friend sees for an invite code (a reset or unknown code → not_found).
create or replace function public.crew_by_invite(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('ok', true, 'crew', jsonb_build_object(
      'id', c.id, 'name', c.name,
      'owner', (select pe.first_name from public.people pe where pe.id = c.owner_person),
      'players', (select count(*) from public.crew_members m where m.crew_id = c.id and not m.removed),
      'since', (select min(e.played_on) from public.events e where e.crew_id = c.id and coalesce(e.settings->>'practice', 'false') <> 'true'),
      'people', coalesce((select jsonb_agg(jsonb_build_object('first', pe.first_name, 'last', pe.last_name) order by m.last_played desc nulls last)
                  from public.crew_members m join public.people pe on pe.id = m.person_id where m.crew_id = c.id and not m.removed), '[]'::jsonb),
      'recent', coalesce((select jsonb_agg(x) from (
                  select jsonb_build_object('name', e.name, 'playedOn', e.played_on, 'course', e.course->>'shortName') x
                    from public.events e where e.crew_id = c.id and coalesce(e.settings->>'practice', 'false') <> 'true'
                   order by e.played_on desc nulls last, e.created_at desc limit 3) r), '[]'::jsonb)))
      from public.crews c where c.invite_code = upper(trim(p_code))),
    jsonb_build_object('ok', false, 'error', 'not_found'))
$$;

create or replace function public.create_crew(p_device_id uuid, p_name text, p_person_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_name text := left(nullif(trim(p_name), ''), 24);
begin
  if v_name is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  insert into public.crews (id, name, invite_code, owner_device, owner_person)
  values (v_id, v_name, public._invite_code(), p_device_id,
          case when exists (select 1 from public.people where id = p_person_id) then p_person_id end);
  if exists (select 1 from public.people where id = p_person_id) then
    insert into public.crew_members (crew_id, person_id) values (v_id, p_person_id) on conflict do nothing;
    insert into public.crew_claims (crew_id, person_id, device_id) values (v_id, p_person_id, p_device_id) on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'crew', public._crew_card(v_id, p_device_id));
end $$;

create or replace function public.rename_crew(p_crew_id uuid, p_device_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := left(nullif(trim(p_name), ''), 24);
begin
  if v_name is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if not public._crew_owner_ok(p_crew_id, p_device_id) then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  update public.crews set name = v_name where id = p_crew_id;
  return jsonb_build_object('ok', true, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

create or replace function public.reset_invite(p_crew_id uuid, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._crew_owner_ok(p_crew_id, p_device_id) then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  update public.crews set invite_code = public._invite_code() where id = p_crew_id;
  return jsonb_build_object('ok', true, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- "Which one are you?": this phone is that person in the crew (one phone per person, one person per phone).
create or replace function public.claim_crew_person(p_crew_id uuid, p_device_id uuid, p_person_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.crew_members where crew_id = p_crew_id and person_id = p_person_id and not removed) then
    return jsonb_build_object('ok', false, 'error', 'not_in_crew');
  end if;
  if exists (select 1 from public.crew_claims where crew_id = p_crew_id and person_id = p_person_id and device_id <> p_device_id) then
    return jsonb_build_object('ok', false, 'error', 'claimed');
  end if;
  insert into public.crew_claims (crew_id, person_id, device_id) values (p_crew_id, p_person_id, p_device_id)
  on conflict (crew_id, device_id) do update set person_id = excluded.person_id, claimed_at = now();
  return jsonb_build_object('ok', true, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- "I'm new": a new person in the crew, claimed by this phone. The full name must be free (nickname if not).
create or replace function public.crew_new_person(p_crew_id uuid, p_device_id uuid, p_first text, p_last text, p_nickname text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_first text := left(nullif(trim(p_first), ''), 24);
        v_last text := left(nullif(trim(p_last), ''), 30); v_nick text := left(nullif(trim(p_nickname), ''), 24);
begin
  if v_first is null or v_last is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if not exists (select 1 from public.crews where id = p_crew_id) then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  begin
    insert into public.people (id, first_name, last_name, nickname) values (v_id, v_first, v_last, v_nick);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'name_taken');
  end;
  insert into public.crew_members (crew_id, person_id) values (p_crew_id, v_id);
  insert into public.crew_claims (crew_id, person_id, device_id) values (p_crew_id, v_id, p_device_id)
  on conflict (crew_id, device_id) do update set person_id = excluded.person_id, claimed_at = now();
  return jsonb_build_object('ok', true, 'personId', v_id, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- Owner: take someone off the crew list (their rounds stay). Sticky: playing again doesn't re-add them.
create or replace function public.remove_crew_person(p_crew_id uuid, p_device_id uuid, p_person_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._crew_owner_ok(p_crew_id, p_device_id) then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  update public.crew_members set removed = true where crew_id = p_crew_id and person_id = p_person_id;
  return jsonb_build_object('ok', true, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- Owner: end the current season and start a new one (p_starts_on null = with the crew's next round).
create or replace function public.start_season(p_crew_id uuid, p_device_id uuid, p_name text, p_starts_on date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := left(nullif(trim(p_name), ''), 24);
begin
  if v_name is null then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if not public._crew_owner_ok(p_crew_id, p_device_id) then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  insert into public.seasons (crew_id, name, starts_on) values (p_crew_id, v_name, p_starts_on);
  return jsonb_build_object('ok', true, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- crew_people: everyone still on the list (removed people stay out).
create or replace function public.crew_people(p_crew_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'people', coalesce(jsonb_agg(jsonb_build_object(
           'id', pe.id, 'firstName', pe.first_name, 'lastName', pe.last_name, 'nickname', pe.nickname,
           'lastPlayed', m.last_played, 'rounds', m.rounds)
         order by m.last_played desc nulls last, m.rounds desc, pe.first_name), '[]'::jsonb))
    from public.crew_members m join public.people pe on pe.id = m.person_id
   where m.crew_id = p_crew_id and not m.removed
$$;

revoke all on function public._invite_code() from public, anon, authenticated;
revoke all on function public._crew_owner_ok(uuid, uuid) from public, anon, authenticated;
revoke all on function public._crew_card(uuid, uuid) from public, anon, authenticated;
grant execute on function public.crew_info(uuid, uuid) to anon, authenticated;
grant execute on function public.crew_by_invite(text) to anon, authenticated;
grant execute on function public.create_crew(uuid, text, uuid) to anon, authenticated;
grant execute on function public.rename_crew(uuid, uuid, text) to anon, authenticated;
grant execute on function public.reset_invite(uuid, uuid) to anon, authenticated;
grant execute on function public.claim_crew_person(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.crew_new_person(uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.remove_crew_person(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.start_season(uuid, uuid, text, date) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────── course geo (Oct 22, 2026)
-- GPS yardages stage 3 (docs/design/yardages/NOTES.md §7): one row of green outlines per course, built
-- once by the course-geo Edge Function (OpenStreetMap first, Mapbox satellite + Claude tracing for the
-- holes OSM lacks; service role) and read by every phone with the round (cached as glb.geo.<course_key>).
-- Twin Creeks also ships built in (js/geodata.js). Migration: supabase/migrations/2026-10-22-course-geo.sql.
create table if not exists public.course_geo (
  course_key  text primary key,          -- 'twin-creeks-allen-tx' | 'oga:<id>' | 'oga:<id>#N' (the key Setup saves as course.id)
  name        text not null,
  lat         double precision,          -- course point (OpenGolfAPI / built-in)
  lng         double precision,
  holes       jsonb not null default '[]',  -- [{ hole, par, tee:[lat,lng], green:[[lat,lng],…], source:'osm'|'ai'|'fixed', confidence:0..1 }]
  source      text not null default 'none', -- 'osm' | 'ai' | 'mixed' | 'none'
  status      text not null default 'building', -- 'building' | 'ready' | 'partial' (some holes missing) | 'failed'
  built_at    timestamptz,
  updated_at  timestamptz not null default now(),
  error       text
);
alter table public.course_geo enable row level security;
create policy course_geo_read on public.course_geo for select to anon, authenticated using (true);  -- read-only for phones
-- No insert/update/delete policies: the Edge Function writes with the service role.
-- Stage 4 adds fix_green(course_key, hole, lat, lng) (SECURITY DEFINER, anon): slides one hole's outline so
-- its center = the given point and sets source = 'fixed'.
