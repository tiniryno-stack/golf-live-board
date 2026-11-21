-- Rollback for 2026-11-21-card-opens.sql (035 Scorecard locker). Run in Supabase → SQL Editor only if the
-- locker has to come out. Dropping card_opens forgets which packs were opened (every card becomes a pack again).
drop function if exists public.locker_admin();
drop function if exists public.open_card(text, text, uuid);
drop table if exists public.card_opens;
