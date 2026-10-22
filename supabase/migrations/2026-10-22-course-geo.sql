-- GPS yardages stage 3 (docs/design/yardages/NOTES.md §7): one row of green outlines per course, built
-- once by the course-geo Edge Function (OpenStreetMap first, Mapbox satellite + Claude tracing for the
-- holes OSM lacks) and read by every phone with the round. Only adds. Applied to the live database Oct 22.
-- Also applies the 'gps' label in _setting_label (schema.sql had it since feature 011, DB didn't).

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
-- Writes: only the Edge Function (service role). Stage 4 adds fix_green(course_key, hole, lat, lng).

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
