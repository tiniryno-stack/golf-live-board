-- 035 Scorecard locker (docs/design/features/035-scorecard-locker/SPEC.md §4.1). Additive only.
-- Cards are derived in the app from events + scores; this table only records that a pack was opened.
-- Rollback: 2026-11-21-card-opens-rollback.sql (SQL Editor).

create table if not exists public.card_opens (
  event_id   uuid not null references public.events(id) on delete cascade,
  person_id  text not null,                 -- = roster player personId (text: test fixtures use ids like person-andrew)
  player_id  text not null,                 -- that person's roster id in this round
  opened_at  timestamptz not null default now(),
  primary key (event_id, person_id)
);
create index if not exists card_opens_person_idx on public.card_opens (person_id);
alter table public.card_opens enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'card_opens' and policyname = 'card_opens_read') then
    create policy card_opens_read on public.card_opens for select to anon, authenticated using (true);
  end if;
end $$;
-- No insert/update/delete policies: writes go through open_card only.

-- Open one pack: the person must be on the roster with 18 scores, and this device must be them
-- (a claim on any round as that person, or a crew claim). Opening twice is fine (unchanged).
create or replace function public.open_card(p_code text, p_person_id text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text; v_n int; v_at timestamptz;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(e.settings->>'practice', 'false') = 'true' then return jsonb_build_object('ok', false, 'error', 'practice'); end if;
  select p->>'id' into v_pid from jsonb_array_elements(coalesce(e.roster->'players', '[]'::jsonb)) p
   where p->>'personId' = p_person_id limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'not_on_roster'); end if;
  select count(*) into v_n from public.scores where event_id = e.id and player_id = v_pid and strokes is not null;
  if v_n < 18 then return jsonb_build_object('ok', false, 'error', 'not_finished', 'holes', v_n); end if;
  if not exists (select 1 from public.claims c join public.events e2 on e2.id = c.event_id
                  where c.device_id = p_device_id and public._player(e2.roster, c.player_id)->>'personId' = p_person_id)
     and not exists (select 1 from public.crew_claims cc where cc.device_id = p_device_id and cc.person_id::text = p_person_id) then
    return jsonb_build_object('ok', false, 'error', 'not_you');
  end if;
  insert into public.card_opens (event_id, person_id, player_id) values (e.id, p_person_id, v_pid)
  on conflict (event_id, person_id) do nothing returning opened_at into v_at;
  if v_at is null then
    select opened_at into v_at from public.card_opens where event_id = e.id and person_id = p_person_id;
    return jsonb_build_object('ok', true, 'opened_at', v_at, 'unchanged', true);
  end if;
  return jsonb_build_object('ok', true, 'opened_at', v_at);
end $$;
grant execute on function public.open_card(text, text, uuid) to anon, authenticated;

-- Admin list (§8): one row per person with a finished round (not practice, 18 scores, round over:
-- finalized or played before today). Nothing here that events + scores don't already show the browser;
-- the admin gate is in the app. It exists so the app needn't read every score (the 1,000-row limit).
create or replace function public.locker_admin()
returns jsonb language sql stable security definer set search_path = public as $$
  with rp as (
    select distinct on (e.id, p->>'personId')
           e.id as event_id, e.played_on, e.created_at, p->>'personId' as person_id, p->>'id' as player_id,
           nullif(trim(concat_ws(' ', coalesce(p->>'firstName', p->>'name'), p->>'lastName')), '') as name
      from public.events e
      cross join lateral jsonb_array_elements(coalesce(e.roster->'players', '[]'::jsonb)) p
     where coalesce(e.settings->>'practice', 'false') <> 'true'
       and coalesce(p->>'personId', '') <> ''
       and (e.finalized_at is not null or e.played_on < current_date)
     order by e.id, p->>'personId'
  ), fin as (
    select rp.* from rp
     where (select count(*) from public.scores s where s.event_id = rp.event_id and s.player_id = rp.player_id and s.strokes is not null) >= 18
  ), per as (
    select f.person_id,
           (array_agg(coalesce(f.name, f.person_id) order by f.played_on desc nulls last, f.created_at desc))[1] as name,
           count(*) as rounds,
           count(o.event_id) as opened,
           max(o.opened_at) as last_opened
      from fin f
      left join public.card_opens o on o.event_id = f.event_id and o.person_id = f.person_id
     group by f.person_id
  )
  select jsonb_build_object('ok', true, 'people', coalesce(jsonb_agg(jsonb_build_object(
           'person_id', person_id, 'name', name, 'rounds', rounds, 'opened', opened, 'last_opened', last_opened)
           order by rounds desc, name), '[]'::jsonb))
    from per
$$;
grant execute on function public.locker_admin() to anon, authenticated;
