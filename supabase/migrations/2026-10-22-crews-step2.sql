-- Crews step 2+ (features 006–009). Paste into Supabase → SQL Editor → New snippet → Run. Only adds; nothing is deleted.
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
  if not exists (select 1 from public.crew_members where crew_id = p_crew_id and person_id = p_person_id) then
    return jsonb_build_object('ok', false, 'error', 'not_in_crew');
  end if;
  if exists (select 1 from public.crew_claims where crew_id = p_crew_id and person_id = p_person_id and device_id <> p_device_id) then
    return jsonb_build_object('ok', false, 'error', 'claimed');
  end if;
  delete from public.crew_claims where crew_id = p_crew_id and device_id = p_device_id;
  insert into public.crew_claims (crew_id, person_id, device_id) values (p_crew_id, p_person_id, p_device_id);
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
  delete from public.crew_claims where crew_id = p_crew_id and device_id = p_device_id;
  insert into public.crew_claims (crew_id, person_id, device_id) values (p_crew_id, v_id, p_device_id);
  return jsonb_build_object('ok', true, 'personId', v_id, 'crew', public._crew_card(p_crew_id, p_device_id));
end $$;

-- Owner: take someone off the crew list (their rounds stay). Sticky: playing again doesn't re-add them.
create or replace function public.remove_crew_person(p_crew_id uuid, p_device_id uuid, p_person_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._crew_owner_ok(p_crew_id, p_device_id) then return jsonb_build_object('ok', false, 'error', 'not_owner'); end if;
  update public.crew_members set removed = true where crew_id = p_crew_id and person_id = p_person_id;
  delete from public.crew_claims where crew_id = p_crew_id and person_id = p_person_id;
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
