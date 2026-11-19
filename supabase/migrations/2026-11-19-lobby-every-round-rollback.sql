-- Rollback for 2026-11-19-lobby-every-round.sql: the gate goes back to Team Ryder Cup rounds only (025's version).

create or replace function public._lobby_gate(e public.events)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l jsonb := e.settings->'lobby'; v_at timestamptz;
begin
  if l is null or jsonb_typeof(l) <> 'object' or coalesce(e.settings->>'ryder', 'false') <> 'true' then return null; end if;
  begin
    v_at := nullif(l->>'opensAt', '')::timestamptz;
  exception when others then
    v_at := null;  -- a bad timestamp keeps the round closed rather than erroring
  end;
  if coalesce(l->>'stage', '') = 'ready' and v_at is not null
     and (coalesce(l->>'openedEarly', 'false') = 'true' or now() >= v_at) then
    return null;
  end if;
  return jsonb_build_object('ok', false, 'error', 'not_open', 'opens_at', v_at, 'now', now(),
                            'stage', coalesce(l->>'stage', 'lobby'));
end $$;
