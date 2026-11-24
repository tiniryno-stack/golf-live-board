-- Nov 24 · returning players: Safari asks "has this person opened a round in the home screen app?" before it claims
-- a spot, so a friend who taps the group-chat link is sent to their app instead of starting over in Safari.
-- Additive (one read-only function + grant). Rollback: 2026-11-24-person-has-app-rollback.sql.
create or replace function public.person_has_app(p_person_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', true, 'has_app', exists (
    select 1 from public.claims c join public.events e on e.id = c.event_id
     where c.in_app and coalesce(p_person_id, '') <> ''
       and public._player(e.roster, c.player_id)->>'personId' = p_person_id));
$$;
grant execute on function public.person_has_app(text) to anon, authenticated;
