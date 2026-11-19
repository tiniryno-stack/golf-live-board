-- Handoff 029 (built with brief 031, Nov 19): a lobby for every round. Additive only (create or replace).
-- Before: _lobby_gate held scores back only for Team Ryder Cup rounds with settings.lobby. Now any round made with
-- settings.lobby waits until it opens (stage 'ready' + opensAt passed, or opened early). Rounds without
-- settings.lobby (every round played so far but the Ryder one) get null, exactly as before.
-- Checked live Nov 19: no non-Ryder round has settings.lobby. Revert with 2026-11-19-lobby-every-round-rollback.sql.

create or replace function public._lobby_gate(e public.events)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l jsonb := e.settings->'lobby'; v_at timestamptz;
begin
  -- 029 (Nov 19): every round made with a lobby is gated, not only Team Ryder Cup. Rounds without settings.lobby: null.
  if l is null or jsonb_typeof(l) <> 'object' then return null; end if;
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
