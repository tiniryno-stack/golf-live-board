-- Handoff 024 · "I'm not Baker": additive (create or replace + grant). Mirrors supabase/schema.sql.
-- not_me(code, device) frees this device's claim and relabels the scores it entered as that player since the
-- claim (updated_by = '<name> (picked by mistake)'), so they stop counting as the player's own entry.
-- Applied to the live DB on Nov 6, 2026 with apply_migration (Andrew OK), verified with a rolled-back anon test.

-- "I'm not Baker" (handoff 024 §4): this device picked the wrong name. Frees this device's claim and relabels
-- the scores it entered as that player since the claim, so they stop counting as the player's own entry
-- (upsert_score's own_entry rule keys on updated_by = the player's name): the real Baker's phone, or
-- anyone in the foursome, can then fix them. Only this device's claim; only rows still marked as Baker's own.
create or replace function public.not_me(p_code text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text; v_at timestamptz; v_name text; v_n int := 0;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  delete from public.claims where event_id = e.id and device_id = p_device_id
    returning player_id, claimed_at into v_pid, v_at;
  if v_pid is null then return jsonb_build_object('ok', true, 'player_id', null, 'relabeled', 0); end if;
  v_name := public._player_name(e.roster, v_pid);
  update public.scores set updated_by = v_name || ' (picked by mistake)'
   where event_id = e.id and player_id = v_pid and updated_by = v_name
     and updated_at >= coalesce(v_at, '-infinity'::timestamptz);
  get diagnostics v_n = row_count;
  perform public._log(e.id, v_name, 'A phone picked ' || v_name || ' by mistake and let go'
    || case when v_n > 0 then ' (' || v_n || ' score' || case when v_n = 1 then '' else 's' end || ' no longer locked as theirs)' else '' end);
  return jsonb_build_object('ok', true, 'player_id', v_pid, 'relabeled', v_n);
end $$;

grant execute on function public.not_me(text, uuid) to anon, authenticated;
