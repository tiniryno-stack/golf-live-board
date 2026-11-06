# 025 · Team Ryder Cup lobby: build plan

Branch: `claude/vigilant-hopper-wlls0o` (the session's branch, cut from `main` at 1e65434, which already has 023 + 024).
SPEC.md is the source of truth; this file is how it gets built. Owner asked for **two council rounds** (plan, then code),
not "until everyone is at 9" (Nov 6 message).

## 0 · Principles

- One pure module, `js/lobby.js`, decides everything about a lobby round. Screens, Home, the router and the queue read
  `lobbyState(event, nowMs)`; nothing outside `lobby.js` reads `settings.lobby` directly (Setup / Host *write* it
  through helpers in `lobby.js`).
- Old rounds: `settings.lobby` is absent or `null` → `lobbyState` returns `null` → every new branch is skipped. The server
  gate also only fires when `settings->'lobby'` is a JSON object.
- Reuse: Setup's `ryCartsView` / `ryDraftView` / `ryTeeView`, `buildRyder` (ids preserved), `ryderSetup`, the PIN sheet,
  `release_player`, `update_event`, the `confirm` sheet, 024's `joinPlan` / `me-confirm`, the `homescreen` sheet + move link.
- No new tokens, colors, sizes or type styles. New CSS is layout only (`.lb-*`), built from existing tokens and the
  existing `.card`, `.btn`, `.pill`, `.home-row`, `.lbl`/`.ts-label`, `.nr-*` classes. The **When** step is the one new
  pattern (TextField + native `<input type=date|time>`); flagged.

## 1 · Data shapes

```
settings.lobby = {
  stage: 'lobby' | 'teams' | 'ready' | 'off',
  startTime: 'HH:MM',          // first start, organizer's wall clock in tz
  tz: 'America/Chicago',       // IANA, from Intl at creation
  opensAt: ISO UTC | null,     // set with stage 'ready' = first start − 30 min (on played_on, in tz)
  openedEarly: false,
  notice: { text, at: ISO, until: 'YYYY-MM-DD' } | null,
  cohost: playerId | null,
  hostName: 'Andrew',          // NEW (decided overnight): who "Andrew gave your spot…" / "Text Andrew" names
  prevStage: stage | null,     // NEW: what Bring it back restores after 'off'
}
events.played_on               // the date (set_round_date changes it)
claims.in_app boolean          // new column
```

Local keys (all through `db.local`):
- `glb.seen.CODE.welcome` ("See you Saturday" shown), `glb.seen.CODE.open` ("Scoring is open" shown). Separate keys,
  not fields inside `glb.seen.CODE` (that object is overwritten by headlines). Both move with Add to Home Screen (`seen.`).
- `glb.inapp.CODE` = this device already called `mark_in_app` (not moved: only the home screen app sets it).
- `glb.lobbyhost.CODE` = `{ teamsShared, told }` (organizer's one-time primaries: Share the teams, Tell the group).
  Added to `MOVE_KEYS`.
- `glb.recent` entries gain `lobby` (Home's card, see §5) via `roundSummary`.

## 2 · `js/lobby.js` (pure, no DOM, no storage)

- `lobbyOf(settings)` → normalized lobby or `null` (stage outside the four → `'lobby'`; bad `HH:MM` → `'08:00'`).
- `opensAtFor(dateISO, 'HH:MM', tz)` → ISO UTC of that wall time in `tz` (Intl offset, two passes, so it's right on
  DST-change days; a wall time that doesn't exist, 2:30 on spring-forward, resolves forward one hour) **minus 30 min**.
  `startAtFor` = the same without the 30 min.
- `wallDate(ms, tz)` → `'YYYY-MM-DD'` in tz (used for "on the day" and "notice until").
- `lobbyState(event, nowMs)` → `null` or
  `{ stage, open, opensAt, msToOpen, startTime, startLabel ('8:00'), firstTee ('8:00' from teeTimes[0] else start),
     day (today in tz is played_on), past (played_on < today in tz), notice (only while today ≤ until), cohost,
     hostName, hasTeams, date }`.
  Stage is sanity-checked against the roster so the screens can't be in a bad state: `'teams'`/`'ready'` with no
  `roster.teams` → `'lobby'`; `'ready'` with no `opensAt` → `'teams'`. `open = stage==='ready' && (openedEarly || now ≥ opensAt)`.
- `nextHostStep(state, { teamsShared, told, count })` →
  `'off'` (Bring it back in Round options) · `'tell'` (a notice newer than `told`) · `'draft'` (lobby; `count !== 16`
  → `'need16'`) · `'shareTeams'` (teams, not yet shared) · `'setTimes'` (teams; on the day it says "Scoring is waiting on
  start times", 26) · `'waitOpen'` (ready, before opensAt: secondary Open scoring now only when `day`) · `'open'`.
- `lobbyCounts(roster, status)` → `{ total, inApp, notYet: [{ id, name, why: 'safari'|'none' }] }`, with
  `inApp + notYet.length === total` always (players missing from `status` count as "not yet").
- `joinList(roster, claimed, q)` → A–Z by display name, `{ id, name, taken }`, filtered by `q` (first or last name).
- `myLobby(event, pid)` → `{ side, cart, mate, tee ('8:20'), matches: [{ holes:'1–6', vs:'Sean + Peter' }…] }` from
  the roster + `scoring.ryderMatchupsAt` (no scores needed).
- `homeCard(event, { pid, personId }, nowMs)` → `null` | `{ kind: 'coming'|'removed'|'off', … }` (Home, §5).
- Writers (return a new settings object, never mutate): `withStage`, `withTimes(lobby, date, teeTimes)` (sets
  `opensAt` and stage `'ready'`), `withNotice`, `openNow(nowMs)`.
- Copy helpers: `dayName(dateISO, nowMs, tz)` ("Saturday" within 6 days, else "Sat Nov 9"), `clock12('14:05')` = "2:05".

## 3 · Server (additive; `schema.sql` + `tests/mock-supabase.mjs` + `supabase/migrations/2026-11-06-ryder-lobby.sql`)

```sql
alter table public.claims add column if not exists in_app boolean not null default false;

-- null = scoring allowed; else the refusal. Only for rounds whose settings.lobby is a JSON object.
create or replace function public._lobby_gate(e public.events) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l jsonb := e.settings->'lobby'; v_at timestamptz;
begin
  if l is null or jsonb_typeof(l) <> 'object' then return null; end if;
  begin v_at := nullif(l->>'opensAt', '')::timestamptz; exception when others then v_at := null; end;
  if coalesce(l->>'stage', '') = 'ready' and v_at is not null
     and (coalesce(l->>'openedEarly', 'false') = 'true' or now() >= v_at) then return null; end if;
  return jsonb_build_object('ok', false, 'error', 'not_open', 'opens_at', v_at, 'now', now(),
                            'stage', coalesce(l->>'stage', 'lobby'));
end $$;
```
- `upsert_score` and `fill_score`: `v_gate := public._lobby_gate(e); if v_gate is not null then return v_gate; end if;`
  **right after `not_found`** (before the claim / foursome checks, so a lobby phone gets `not_open`, not
  `not_your_foursome`). Bodies otherwise identical. `admin_upsert_score` is **not** gated (organizer can always fix).
  `openedEarly` is honored by the server too (a superset of the SPEC's `now() >= opensAt`: Open scoring now works even
  if the organizer's phone clock is behind).
- `mark_in_app(p_code, p_device_id)` → sets `in_app = true` on this device's claim; `{ ok, marked, now }`.
- `lobby_status(p_code, p_admin_pin)` → organizer only (`_admin_ok`) → `{ ok, players: [{ player_id, claimed, in_app }] }`
  for every roster player (claims stay unreadable to anon; no device ids returned).
- `set_round_date(p_code, p_admin_pin, p_date date)` → organizer only; date within `current_date - 1 .. + 400`; updates
  `played_on` + `updated_at`, audit line "Date · Sat Nov 9 → Sun Nov 10"; `{ ok, played_on }`.
- `_setting_label('lobby')` → `'Round plan'` (update_event logs settings diffs by key).
- Grants: `execute` to anon/authenticated on the three RPCs; `_lobby_gate` revoked from public/anon/authenticated.
- Rollback file `supabase/migrations/2026-11-06-ryder-lobby-rollback.sql`: restores the previous `upsert_score` /
  `fill_score` / `_setting_label` bodies, drops `mark_in_app`, `lobby_status`, `set_round_date`, `_lobby_gate`, and the
  column (with a comment: only after the app version that uses them is gone).
- Mock: same functions, same answers; `backend.clock` (ms or null) so tests drive `now()`.
- Live: rollback-test on live (`do $$ … raise exception $$`, `set local role anon`: create a lobby round, not_open before,
  ok after opensAt / openedEarly, admin ok, lobby_status bad_pin as anon without PIN) → `apply_migration` → read-only
  verify (`pg_proc` + `information_schema.columns` + grants).

## 4 · Engine guard

`compute()` already returns `game: null` for a Team Ryder Cup roster with no carts; `ryderState()` returns `null`
for no game; `replayHeadlines` returns `[]`. The guard is made explicit (comment + early return in `ryderView` when
there are no sides) and pinned by tests. Screens that read `ryderState` aren't drawn while gated (§6).

## 5 · App changes

**db.js:** `api.markInApp`, `api.lobbyStatus`, `api.setRoundDate`; `MOVE_KEYS` + `lobbyhost.`;
`refreshLobbies()` (one `events` select for recent lobby rounds not past, Home calls it once per open, updates
`recent.note`); `app.clockSkew` learned from `now` in `mark_in_app` / `not_open` answers.

**app.js:**
- `app.lobby()` = `lobbyState(app.event, Date.now() + app.clockSkew)`; `app.gated()` = lobby and (not open, or open but
  this phone has a player who hasn't seen "Scoring is open"). While gated: content = `screens/lobby.js` (except the
  Host route for the organizer), **no tab bar**, `canEdit` false, `setScore` toasts "Scoring opens at 7:30".
- Join: `maybeAskWho` in a gated lobby: `auto` claims as today (024); `ask` → taken sheet (the organizer can approve);
  `pick` → no sheet, the lobby screen shows the landing (1). `afterJoin` in a lobby: never the cart-name picker, never
  Today's game; the lobby shows "See you Saturday" (3) once.
- `mark_in_app` once per device per round when `db.STANDALONE` and claimed.
- `onQueueReject('not_open')`: the queue already drops every non-network refusal (settle, then onReject), so nothing
  retries; one toast per flush "Scoring opens at 7:30", learn skew from `now`, `refetchAll()`.
- Open timer: while gated and stage `ready`, one timeout to `opensAt` (+skew) and a 30 s tick under an hour; at zero
  → `refetchAll()` (the server's `opensAt` / stage wins) → render → "Scoring is open" (13).
- `onRemoteEvent`: no "organizer updated the round" toast while gated (the lobby screen shows what changed).
- `roundSummary` (home.js): lobby rounds report `lobby: homeCard(...)` instead of live/places.

**screens/lobby.js (new, player side):** views chosen by a pure `lobbyView(state, { me, seenWelcome, seenOpen, removed,
cohost, organizer, watching })`:
landing (1) · who (2: search + A–Z, "on another phone") · welcome (3, + Add to Home Screen in iPhone Safari) ·
early (4) · drafted (5) · ready (6) · waiting on the day (7) · notice card (8, amber dot) · off · co-host / organizer
Host row (14) · removed (10) · gameday (13). "How Team Ryder Cup works ›": Today's game pages once carts exist, a short
static rules sheet before (the brief needs carts).

**screens/home.js:** "Coming up" section above Recent rounds: one card per lobby round with `homeCard` kind
`coming` (Open), `removed` ("Andrew gave your spot to Kyle." · Text Andrew), `off` ("Called off · was Sat Nov 9" ·
Text Andrew). Dropped once the date passes; once open it's the normal Playing now card.

**screens/setup.js:** Team Ryder Cup with 16: Game → **invite** (15: Invite now, draft later / Draft and start times
first) → **when** (date + start time + round name) → `create_event` (`p_played_on` = date, roster 16 players `p1…p16`
with personIds, no teams/sides/groups, `settings.lobby` stage `lobby`) → `#/e/CODE/host` with the share sheet open.
Lobby edit mode (`s.lobby = { code, mode: 'draft'|'tee'|'course' }`, never persisted to `glb.setupDraft`): Host opens
Setup on the existing event's players (ids kept) at `teams` (Carts → Draft → **Save the teams**), `tee`
(sides from the roster, `rySkip` order; **Save start times**), or `course` (**Use this course**). `buildRyder` keeps
`p.id` when present (today it's `p${i+1}`, which equals the old ids for non-lobby rounds). Back from the first lobby
screen = Host.

**screens/host.js:** while `lobbyState` exists and not open (or `off`): `lobbyHost(app)` replaces the tabs:
headline per `nextHostStep` (16 / 19 / 23 / 24 / 26), "Not in the app yet · K" rows with Share, Waiting to be let in,
Players (→ sheet: each player → Replace / Remove), Co-host, Round options, then the one primary. After it opens: the
normal Host with a one-line "Scoring is open · opened at 7:30" note.
Sheets (sheets.js): `lobby-share` (generic ready message + Share / Copy link), `lobby-players`, `lobby-replace`
(TextField + crew suggestions via `crew_people`, `person_name_check`, nickname when needed) → Replace = keep id / team /
cart / tee, new names + personId, `update_event`, then `release_player`, then share-to-sub with **Undo** (restores the
name + personId; the old phone re-joins by 024 auto-join), `lobby-remove` (22 after the draft: Replace instead / Remove
and redraft → stage `lobby`, teams/sides/groups cleared; before the draft a plain confirm) plus **Add a player** (so a
removal is never a dead end; decided overnight), `lobby-cohost` (pick a player → share with the PIN text),
`lobby-options` (20), `lobby-when` (date + start: notice + `set_round_date`; at `ready` the tee times shift by the same
delta and `opensAt` is recomputed), `lobby-calloff` (21), `lobby-open` (25).

Concurrency: every lobby write re-reads `app.event` right before `update_event` (refetch, then apply the one change to
the fresh copy), so two organizers saving at once lose at most a same-field race, never each other's unrelated edits.

## 6 · Words (SPEC §7)

Players: "Coming up", "start time", "Open", "Scoring opens at 7:30"; never "lobby", "tee time", "Group 1". The organizer
may see "lobby". Times with `clock12`; tee rows with "8:20 start time" (`teeTimeName` style but "start time").

## 7 · Tests: `tests/lobby025.test.mjs` (one file) + existing tests kept green

1. `opensAtFor`: Chicago normal day; across the Nov 1 2026 fall-back and Mar 8 2026 spring-forward; a different zone
   (Europe/London, Asia/Kolkata +5:30); the 30-minute rule; a nonexistent wall time.
2. `lobbyState` for every stage, `off`, `openedEarly`, ready without opensAt (→ teams), teams without carts (→ lobby),
   `open` flipping exactly at opensAt, `day` / `past`, notice expiry.
3. `nextHostStep` for each stage (+ need16, tell, day-without-times).
4. `lobbyCounts` sums to the roster (missing rows, Safari vs not yet).
5. `joinList` A–Z, search, taken.
6. `myLobby` matches for a drafted 16 (three opponents, holes labels).
7. `homeCard` coming / removed / off / past.
8. Mock gate: `not_open` before opensAt, ok after; `off`; `openedEarly`; `fill_score` same; `admin_upsert_score`
   always ok; old round (`lobby` absent / null) unaffected; `lobby_status` organizer-only; `mark_in_app`;
   `set_round_date` bad PIN / bad date.
9. Engine: lobby roster → `compute` / `ryderState` / `replayHeadlines` don't throw; old Team Ryder Cup, Partner Rider
   Cup, 2v2 and split point give identical snapshots with `lobby: null` vs absent.
10. Setup: `buildRyder` keeps lobby ids (exported helper) and non-lobby ids unchanged.

`npm test` only (owner: no smoke, no fit, no screenshots).

## 8 · Build steps (one commit + council-ready diff each)

1. `lobby.js` + tests. 2. SQL + mock + migration + rollback + engine guard. 3. Setup choice/When/create + Host lobby +
draft/tee on an existing event. 4. Player lobby + Home cards + join changes. 5. Replace / co-host / options / notices /
call off. 6. Countdown + Scoring is open. Then: live DB (rollback test → apply → verify), docs, preview.

## 9 · Decided overnight

- Branch is the session's `claude/vigilant-hopper-wlls0o` (the session can only push there), not `design/025-ryder-lobby`.
- Two council rounds (owner, Nov 6), not "until all ≥ 9".
- `lobby.hostName` and `lobby.prevStage` added to the shape (the SPEC names the organizer on player screens but stores no
  name; Bring it back needs to know what to restore).
- The server honors `openedEarly` as well as `opensAt` (safer when the organizer's phone clock is off).
- Players see "N haven't joined yet" (claims, which are public as a list of player ids) instead of "haven't added Golf
  Board": `in_app` is organizer-only per SPEC §3.2.
- Server time: phones learn the clock offset from `now` in `mark_in_app` and `not_open` answers; otherwise the phone
  clock drives the countdown and the server's refusal corrects it.
- "Add a player" exists in the lobby Players sheet so Remove isn't a dead end (the SPEC needs 16 to draft).
- "Show me an example round" (12) is a stretch goal: left out.
- Changing the course in a lobby reuses Setup's course step (lobby edit mode).

## 10 · Open questions for the owner

(filled in as the council raises them)

## 11 · Council scores

| Round | Architect | Database | Frontend | Tests | Product QA | Red team | What changed |
|---|---|---|---|---|---|---|---|
| 0 · plan | | | | | | | |
| 1 · code | | | | | | | |
