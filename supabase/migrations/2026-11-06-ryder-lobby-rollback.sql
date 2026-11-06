-- Handoff 025 rollback: paste into Supabase → SQL Editor → New snippet → Run.
-- Restores upsert_score / fill_score / update_event / _setting_label as they were before 025 and drops what 025 added.
-- Only run it once phones no longer run the 025 app (Host's lobby view calls these functions), or the lobby screens
-- will show errors. Rounds that still carry settings.lobby take scores again as soon as this runs.

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
    when 'ryder'            then 'Team Ryder Cup'
    when 'lineups'          then 'Lineup'
    else p_key end
$$;

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

create or replace function public.whoami(p_code text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select player_id into v_pid from public.claims where event_id = e.id and device_id = p_device_id;
  return jsonb_build_object('ok', true, 'player_id', v_pid);
end $$;

drop function if exists public.mark_in_app(text, uuid);
drop function if exists public.lobby_status(text, text);
drop function if exists public.set_round_date(text, text, date, timestamptz);
drop function if exists public._lobby_gate(public.events);
alter table public.claims drop column if exists in_app;
