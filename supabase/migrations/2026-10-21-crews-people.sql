-- Crews + people (Oct 21, 2026). Additive only: three new tables, a trigger that keeps them in
-- sync with every round's roster, two read RPCs, and a backfill from the rounds already played.
-- Mirrored in supabase/schema.sql and tests/mock-supabase.mjs.
--
-- A crew = a friend group (events.crew_id already groups rounds into a season).
-- A person = one human across rounds (roster players already carry a personId).
-- No sign-ups: people are first + last name (+ nickname when that full name is taken).

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

-- Backfill from the rounds already played (oldest first, so the latest name wins), then set
-- each member's round count and last round from the rounds themselves.
do $$
declare e public.events;
begin
  for e in select * from public.events where crew_id is not null order by played_on, created_at loop
    update public.events set roster = roster where id = e.id;   -- fires the sync trigger
  end loop;
  update public.crew_members m set rounds = x.n, last_played = x.lp
    from (select ev.crew_id, (p->>'personId')::uuid as pid, count(distinct ev.id)::int as n, max(ev.played_on) as lp
            from public.events ev, jsonb_array_elements(coalesce(ev.roster->'players', '[]'::jsonb)) p
           where ev.crew_id is not null and coalesce(ev.settings->>'practice', 'false') <> 'true'
             and coalesce(p->>'personId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           group by 1, 2) x
   where m.crew_id = x.crew_id and m.person_id = x.pid;
end $$;
