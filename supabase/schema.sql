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
  updated_at  timestamptz default now()
);
create index if not exists events_crew_idx on public.events (crew_id);

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

-- Is player B in player A's foursome on this hole? (section 7.1)
-- Swap mode: your cart + the cart you're playing on that hole's rotation.
-- Fixed mode (or no teams): same group all day.
create or replace function public._same_foursome(p_roster jsonb, p_settings jsonb, p_a text, p_b text, p_hole int)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  a jsonb; b jsonb; rot jsonb; m jsonb;
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
      if p_hole between (rot->'holes'->>0)::int and (rot->'holes'->>1)::int then
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
create or replace function public._join_approver(e public.events, p_player_id text, p_device_id uuid, p_admin_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare v_pid text; v_last int;
begin
  if p_admin_pin is not null and public._admin_ok(e.id, p_admin_pin) then return 'Organizer'; end if;
  select player_id into v_pid from public.claims where event_id = e.id and device_id = p_device_id;
  if v_pid is null then return null; end if;
  v_last := public._last_hole(e.id, p_player_id);
  if public._same_foursome(e.roster, e.settings, v_pid, p_player_id, greatest(v_last, 1))
     or public._same_foursome(e.roster, e.settings, v_pid, p_player_id, least(v_last + 1, 18)) then
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
declare e public.events; v_actor text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select player_id into v_actor from public.claims where event_id = e.id and device_id = p_device_id;
  if v_actor is null then return jsonb_build_object('ok', false, 'error', 'not_claimed'); end if;
  if not public._same_foursome(e.roster, e.settings, v_actor, p_player_id, p_hole) then
    return jsonb_build_object('ok', false, 'error', 'not_your_foursome');
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

-- ─────────────────────────────────────────────────────────────── function permissions

revoke execute on function
  public._player(jsonb, text), public._player_name(jsonb, text), public._team_name(jsonb, text),
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
  public.update_event(text, text, jsonb, jsonb, jsonb, text),
  public.release_player(text, text, text),
  public.get_audit_log(text, text)
  to anon, authenticated;

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
