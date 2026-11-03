-- Team Ryder Cup (8v8): additive. _same_foursome learns settings.ryder + settings.lineups
-- (a Host lineup puts carts together from a hole on); _setting_label names the two new keys.
-- Mirrors supabase/schema.sql. Applied to the live DB on Nov 3, 2026 with apply_migration.

create or replace function public._same_foursome(p_roster jsonb, p_settings jsonb, p_a text, p_b text, p_hole int)
returns boolean language plpgsql immutable set search_path = public as $$
declare
  a jsonb; b jsonb; rot jsonb; m jsonb; v_pos int := public._play_pos(p_settings, p_hole);
  lu jsonb; best jsonb := null; best_pos int := 0; lp int; f jsonb;
begin
  if p_a = p_b then return true; end if;
  a := public._player(p_roster, p_a);
  b := public._player(p_roster, p_b);
  if a is null or b is null then return false; end if;
  if coalesce(p_settings->>'ryder', 'false') = 'true' and a->>'teamId' is not null and b->>'teamId' is not null then
    if a->>'teamId' = b->>'teamId' then return true; end if;
    if jsonb_typeof(p_settings->'lineups') = 'array' then
      for lu in select * from jsonb_array_elements(p_settings->'lineups') loop
        if jsonb_typeof(lu->'foursomes') <> 'array' or jsonb_array_length(lu->'foursomes') = 0 then continue; end if;
        lp := public._play_pos(p_settings, (lu->>'fromHole')::int);
        if lp <= v_pos and lp >= best_pos then best := lu; best_pos := lp; end if;
      end loop;
    end if;
    if best is not null then
      for f in select * from jsonb_array_elements(best->'foursomes') loop
        if f ? (a->>'teamId') and f ? (b->>'teamId') then return true; end if;
      end loop;
      return false;
    end if;
    return a->>'groupId' is not null and a->>'groupId' = b->>'groupId';
  end if;
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
