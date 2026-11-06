-- Handoff 025: the gate helper is internal (only upsert_score / fill_score call it). Supabase grants execute on new
-- public functions to anon by default, so take it back. Harmless if it waits: the helper only reads the row it's given.
revoke all on function public._lobby_gate(public.events) from public, anon, authenticated;
