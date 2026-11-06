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

1. **A player's second phone.** Someone who picks his name in Safari, then opens Golf Board on a home screen app that
   was set up earlier (a different device), finds his own name "in use". Today: Andrew frees it up from Host → Players
   (built), or the player asks to be let in (only the organizer can approve before scoring opens). A server rule
   "before scoring opens, the owner's other device can take over a claim with no scores" would remove the step. Not
   built: it changes claim rules (red team + product QA raised it).
2. **Lost organizer phone.** Only the organizer PIN can draft and set start times. The Host lobby shows the PIN with
   "screenshot it" and offers Co-host; a server fallback that opens scoring by itself on the day was not built (it
   would override SPEC §6 "scoring waits on start times").
3. **Changing the course** in a lobby round isn't built (Round options shows the course only). Delete and recreate
   before people join if it's wrong.

## 11 · Council scores

| Round | Architect | Database | Frontend | Tests | Product QA | Red team | What changed |
|---|---|---|---|---|---|---|---|
| 0 · plan | 6.5 | 7 | 6.5 | 7 | 7 | 6 | Plan reviewed; every point below folded into §12 before code. |
| 1 · code | 8 | 8 | 8 | 8 | 8 | 7 | Code reviewed after the build; every confirmed bug fixed the same night (§14). Owner asked for two rounds, so no third round. |

## 12 · Round 0 changes (what the council asked for, as built)

- **Lobby edits stay inside the round** (architect): Start the draft / Set start times render Setup's own step views
  inside Host (`app.setup` with `s.lobby`), so `closeRound()` never runs, `#/setup/CODE` (Run it back) is untouched and
  `persist()` never writes `glb.setupDraft` for a lobby. The last button saves to the event.
- **Ids**: `lobby.draftedRoster()` (pure) is the one place ids are set for Team Ryder Cup: kept when present, `p1…` for a
  new round; both `buildRyder` spots use it. Tested by personId through draft + start-time swap. Add a player = highest
  number + 1.
- **Names stay put** through Set start times (`keepNames`: side names by side id, cart names by the pair).
- **Stale writes** (red team, architect): every lobby save fetches the event first and applies its one change to the fresh
  copy; the draft and start times refuse (`toast: someone changed the players`) when the roster's ids/personIds moved
  since the step opened. No new RPC.
- **Replace** = `release_player` first, then `update_event` (a failure leaves a free spot, never an old phone holding the
  new name); Undo = restore the name + release the sub. The old phone's auto-join isn't blocked by `glb.who.CODE` in a
  lobby. "Free up" per player in the lobby Players sheet (stuck names, long-lived asks).
- **Server time**: `whoami` (every load) and every `not_open` / `mark_in_app` answer carry `now`; the phone keeps the skew.
  `keepQueued()` keeps a `not_open` score queued when the round opens within 2 h (fast phone clock) and drops every
  other refusal; one toast per flush.
- **Gate** also requires `settings.ryder`; Run it back strips `lobby`; `set_round_date(…, p_opens_at)` writes the date and
  opensAt in one statement; `update_event` logs "Round plan · lobby → teams", not the object; the helper's revoke is its
  own migration file.
- **Start times saved late on the day open at once** (`withStartTimes(…, nowMs)`); every group needs a time.
- **Bring it back** until 30 days after the date (a rain-out moves the date in the same sheet).
- **in_app** flag keyed by player id (`glb.inapp.CODE = pid`), re-marked after "I'm not X" / re-claims.
- **Players see "haven't added Golf Board"** (SPEC wording kept) through a count-only `lobby_counts(p_code)` RPC (numbers,
  no ids).
- **Seasons / crew / Setup's last groups** skip lobby rounds that never opened.
- **Words**: "first start around 8:00" (not "first tee"); kickers that confirm ("you're in", "scoring is open") are muted,
  never green; only your cart row is green; notice = amber dot only; row actions = `.btn.small`; Home's Coming up uses
  `.card`, never `.live-card`; screen 26 says "N of 16 have Golf Board" (no presence data).
- **Lobby ⋯ menu**: Share round link · Light/Dark · How Team Ryder Cup works · Host settings (organizer). No Rules, Run it
  back, Fix hole or the `who` sheet while gated (Pick my name opens the A–Z list).
- **Safari players** get an "Add Golf Board to your home screen" row on every lobby view and the join code on the landing
  ("Already have Golf Board? Open it and Join with code V4T3M").
- **Organizer** is claimed as himself right after creating (024 owner on the roster).
- Tests added to §7: TZ loop (`process.env.TZ` UTC / Tokyo / Los Angeles), mock clock edges (−1 ms / 0), unclaimed →
  not_open, fill_score parity, Postgres timestamp strings, combined `nextHostStep` priorities, `keepQueued`,
  `draftedRoster` ids, Run it back strip, seasons skip.

## 13 · Live database (Nov 6, overnight)

1. **Rollback test on live** (`do $$ … raise exception $$`, the whole migration + revoke, then `set local role anon`):
   create=true · unclaimed=not_open · claim=true · lobby=not_open/lobby (with `now`) · fill=not_open · admin=true ·
   whoami.now=true · mark=true · status bad PIN=bad_pin · status 16 rows, p1 claimed + in_app · counts {16,1,1} ·
   ready in the future=not_open · ready in the past=ok · off=not_open · openedEarly=ok · bad date=bad_date ·
   set_round_date=ok (played_on moved) · bad PIN=bad_pin · old-style round=ok · anon calling the helper=denied.
   Everything rolled back.
2. **Applied** with `apply_migration`: `ryder_lobby_025` (= `supabase/migrations/2026-11-06-ryder-lobby.sql`) and
   `ryder_lobby_025_revoke` (= `-revoke.sql`).
3. **Verified** (read-only `pg_proc` / `information_schema`): `upsert_score` and `fill_score` call `_lobby_gate`;
   `admin_upsert_score` doesn't; `_lobby_gate` is SECURITY DEFINER and not executable by anon; the four new RPCs are
   SECURITY DEFINER and executable by anon; `whoami`, `mark_in_app`, `lobby_status` return `now`; `claims.in_app` exists.
4. **Rollback**: `supabase/migrations/2026-11-06-ryder-lobby-rollback.sql` (one paste in the SQL Editor; restores the
   previous `upsert_score`, `fill_score`, `update_event`, `_setting_label`, `whoami` and drops what 025 added). The live
   bodies before 025 were checked against it.

## 14 · Round 1 fixes (code council, after the build)

- **Lobby steps check the round as it is now** (architect): the draft / start times refuse to save when the players
  changed, the round was called off, or scoring opened meanwhile (`lobby.maySaveStep`, tested).
- **Remove** decides "redraft" from the fresh roster and only says "off the list" when the save worked; a called-off
  round stays off. **Undo** restores only who the slot is (never stale cart data), then frees the sub's phone.
- **Replace** saves the roster first, then frees the old phone (tried twice; a toast if it still holds the spot), so a
  phone opening in between can't take the slot back (red team).
- **When sheet**: the date (with opensAt, one statement) goes first; a failed fetch or date says "Nothing changed".
- **Host Rules save** (after the round opens) always keeps the latest `settings.lobby`, never a stale draft's opensAt (database).
- **Spot given to a sub** survives reopening the round (`recent.remember` keeps `lobbyPid`) (red team).
- **"I'm not X" in a lobby** goes to the A–Z list; the lobby's "ask" has its own skip key, and a watcher gets the normal
  Who are you? the moment scoring opens (product QA).
- **Kept not_open scores** no longer refetch every flush; Text Andrew's cancel no longer toasts; Home's cards use the
  server-corrected clock.
- **Phone and server read `openedEarly` the same way** (boolean or "true"), with edge tests (2 h cutoff, zero-fraction
  timestamps, fill on off / teams, a bad opensAt stays closed, open beats an untold notice) (tests).
- **Copy**: "· teams are set" kicker and "your team" on screen 5; Scoring is open title never shows a stray "·";
  the lobby screen never draws blank.
- **Not done (low, noted for the owner):** the audit log line for "Open scoring now" says "Round plan · ready → ready"
  (no "opened early" wording); `_lobby_gate` could be SECURITY INVOKER (it's already not callable by anon, verified
  live); "organizer" tag in Who's playing (the round stores the organizer's name, not his player); `lobby_counts` with
  a non-array roster would error (the app never writes one). Each would be a small follow-up migration.

---

# Part 2 · SPEC revision (Nov 6 evening): carts before the draft + the handicap reveal

The owner sent a revised 025 zip (same folder, now in the repo). Part 1 above is built and live on `main`
(`33708fe`). Part 2 builds only what the revision changes. Branch: `claude/new-session-a0hcnv` (the session's branch,
off `main`).

## P2.1 · What the revision changes (diff of SPEC.md)

1. **New stage `carts`** between `lobby` and `teams`: carts are paired before the draft. `roster.teams` = 8 carts with
   temporary ids `C1`…`C8`, no `sides`, no `groups`; every player sees who they ride with. The draft gives each cart
   its real id (`1A`…`2D`). Player ids never change (claims are keyed by player id). `compute` / `ryderState` ignore
   carts without sides.
2. **Setup:** Invite now → When → create → **Who rides together?** (`ryCartsView`, handicaps beside names, **Skip**
   allowed) → Host lobby with the invite share sheet.
3. **Host primary:** `lobby` (carts skipped) → **Pair the carts**; `carts` → **Enter the draft** = two steps on the open
   round: `ryDraftView` ("draft · 1 of 2 · Drafting in person? Tap each cart as it's picked.") then `ryTeeView` ("draft ·
   2 of 2", Start times). New Host row **Carts · 8 paired ›** (the carts step reopens only from there).
4. **Players, the handicap flow** (invite links): invite (“Andrew set your handicap”) → guide (Add to Home Screen, Step 1
   of 2, pointer at Safari's ⋯, “Can't add it? Reveal it here”) → in the app: 024 auto-join or the A–Z list (“Step 2 of
   2 · reveal your handicap”) → 024 confirm → **the reveal** (blur → roll → number, rank line, once per phone,
   `glb.seen.CODE.hcp`) → the lobby. “See you Saturday” (3) leaves this path.
5. **Lobby before the draft (4):** **Your handicap · 12** card (“Andrew sets these. Think it's off? Text Andrew.”, text
   only), **Your cart · Baker + Mitch** (green, “team after the draft”) once paired (else Coming up), **Who's playing ·
   handicap** with each handicap on the right.
6. **Landing (1)** for a plain lobby link: “Add Golf Board to my home screen” first, “Join in Safari for now”.
7. **Share message:** “You're on the list for Chuck's Bday on Saturday. Tap this to reveal your handicap.”

No database change: the server gate already refuses every stage but an open `ready`; `update_event` takes any roster.

## P2.2 · Data shapes

```
settings.lobby.stage: 'lobby' | 'carts' | 'teams' | 'ready' | 'off'      (prevStage may be 'carts')
settings.lobby.hostId: playerId | null    // NEW, optional: the organizer's own player (024 owner on the roster at
                                          // creation) → "organizer" tag in Who's playing. Absent on Part 1 rounds.
roster at 'carts': { groups: [], sides: [], teams: [{ id:'C1', name:'Baker + Mitch' } … 'C8'],
                     players: [{ …, teamId:'C1', groupId:null }] }
localStorage (new): glb.seen.CODE.hcp (the reveal was shown on this phone). glb.seen.CODE.welcome is no longer read.
route (new): #/e/CODE/hcp = the invite link (opens the round like #/e/CODE; marks this load as an invite).
```

`lobbyState()` gains `paired` (stage `carts`) and checks the stage against the roster: `carts` needs C-carts and no
sides (else `lobby`); `teams`/`ready` need two sides (else `lobby`). Old rounds: `lobbyState` = null, nothing changes.

## P2.3 · Pure additions in `js/lobby.js` (all tested)

- `STAGES` + `'carts'`; `lobbyOf` keeps `hostId`; `lobbyState` → `paired`, `hostId`.
- `pairedRoster(roster, order)`: `order` = player ids, pairs in order → carts `C1`…`C8` (name "A + B"), `teamId` set,
  `groupId` null, sides/groups empty. Refuses (null) unless exactly 16 known, distinct ids.
- `cartOrder(roster)`: the player ids in cart order (C1's pair, C2's…), or roster order when unpaired: what the carts
  and draft steps start from.
- `toCartsStage(settings)`: stage `carts`, opensAt null, teeTimes [].
- `nextHostStep`: `lobby` → `pair` (16) / `need16`; `carts` → `draft`.
- `maySaveStep`: `carts` mode in `lobby`|`carts`; `draft` mode in `carts` only; `tee` in `teams`|`ready`.
- `myCart(event, pid)`: `{ id, names, mate }` for the player's cart at any stage with carts (C or real).
- `hcpOf(roster, pid)` → `{ strokes, rank, tied, of, min, max }` (rank = 1 + number strictly lower, among players with a
  handicap; null when the player has none). `ordinal(n)`.
- `revealFrame(strokes, elapsedMs, reduced)` → `{ value, blur, opacity, done, fade: [kicker, rank, note, button] }`:
  1.2 s ease-out roll through ~4 values ending on the real one (last 300 ms settled), then four 200 ms fade-ins.
  Reduced motion = the final frame at once.
- `lobbyView(state, ctx)`: ctx gains `invite`, `guide`, `standalone`, `revealing`, `seenHcp`, `hasHcp`; drops
  `seenWelcome`. Order: open → gameday · removed · off · not joined: picking → who, watching → watch, standalone → who,
  guide → guide, invite (and the roster has handicaps) → invite, else landing · joined: revealing or (hasHcp and not
  seenHcp) → reveal · ready → ready · day → dayWait · teams → drafted · lobby/carts → early.
- `homeCard` at `carts`: “Riding with Mitch · teams after Andrew’s draft”.
- `inviteText(ev, day, hcp)`: the share line (reveal wording only when the roster has handicaps; else Part 1's).

## P2.4 · Screens

- **Setup (`setup.js`)**: after create, Host opens the carts step in lobby mode with `fromSetup` (kicker “New round ·
  NAME · carts”, top link **Skip**, primary **Open the lobby**). Skip or save → Host lobby → the invite share sheet
  (`host.mount` waits until no lobby step is open). `ryCartsView` shows each handicap beside the name (also in the
  normal Setup flow: `swapBtn` extra, mono muted).
- **Lobby edit mode** (`startLobbyEdit(app, mode, opts)`): `carts` (screen `teams`, players in `cartOrder`), `draft`
  (screen `draft`, players in cart order: captains = carts 1 and 2 as today), `tee` (screen `tee`). Draft done →
  **Next: start times** saves the draft (stage `teams`) and opens the tee step on the fresh round (`chain`: kicker
  “draft · 2 of 2”); its top link “Back to Host” leaves start times for later. The Host’s own Set start times = kicker
  “start times”. Headlines say “Start times” (organizer screens) in lobby mode.
- **Host lobby (`hostlobby.js`)**: primaries `pair` (“Pair the carts”) and `draft` (“Enter the draft”); row **Carts ·
  8 paired / not paired** in lobby/carts (hidden after the draft and when off); Remove at `carts` = confirm “Removing
  him unpairs the carts. Replacing him keeps his cart.” (primary Replace … instead, alt Remove); Replace blurb at
  `carts` = “with his cart”. Invite/person/sub share messages use `#/e/CODE/hcp` + the reveal line.
- **Player lobby (`screens/lobby.js`)**: new views `invite`, `guide`, `reveal`; `landing` reworded; `who` kicker
  “Step 2 of 2 · reveal your handicap” (handicap flow) / “NAME · in Golf Board” (app) / “NAME” (Safari); `early` = handicap
  card, Your cart (stage carts) or Coming up, Who's playing · handicap (numbers right, “organizer” tag via `hostId`);
  `lobby-all` sheet shows handicaps; `dayWait` says “drafting” at lobby/carts. `welcome` (3) is removed.
- **Reveal motion**: drawn from `revealFrame(now − t0)` every render (redraw-safe, like `data-t0`), and while it runs a
  rAF loop in `mount` updates only the number/blur/opacity nodes (no full redraws). `t0` in `app.ui.reveal`;
  `glb.seen.CODE.hcp` is written on the first frame, so a reload never replays it.
- **Guide pointer** (new pattern, flagged): “Start here ↓”, fixed bottom-right above Safari's toolbar, existing label
  type + `icon('down')`-style arrow, no new colour or size.
- **Engine**: `ryderView` returns the safe empty view when there are carts but no two sides (stage `carts`).

## P2.5 · Tests (`tests/lobby025.test.mjs`, extended; one file)

`pairedRoster` (ids/personIds kept, C1…C8, refuses 15/dupes) · `lobbyState` at carts, carts without carts → lobby,
lobby with C-carts stays lobby · `nextHostStep` pair/need16/draft · `maySaveStep` per mode × stage · draft from carts
keeps every player id and gives real cart ids (claims survive) · `compute` + `ryderState` + headlines on a carts roster
don't throw, no matches · mock gate: carts = not_open, admin ok · `hcpOf` ranks with ties, nobody set, me unset ·
`revealFrame` (start blurred, ends exact at 1.2 s, fades in order, reduced motion) · `lobbyView` order incl. invite
without handicaps → landing, standalone → who, reveal once · `homeCard` carts line · `withWhen`/callOff/bringBack keep
`carts` · old rounds (`lobby: null`) unchanged.

## P2.6 · Decided overnight (Part 2)

- No SQL: the gate already treats `carts` as not open, and `update_event` takes any roster. So nothing to apply to
  the live database this time (no migration, no rollback file).
- The invite link is `#/e/CODE/hcp`; Host's invite / person / sub messages use it. The teams / tell / co-host
  messages keep the plain link (those people already joined).
- The handicap screens show only when the roster has at least one handicap; otherwise the plain landing (1) and the
  Part 1 wording. A player with no handicap skips the reveal (SPEC).
- Not iPhone Safari (Android, desktop): “Reveal my handicap” goes straight to the A–Z list (the guide is iOS Safari steps).
- The home screen app with no claim on a lobby round shows the A–Z list at once (whoapp), never the Safari landing.
- “See you Saturday” (3) is removed from every path: after joining, the reveal (or the lobby).
- After the draft, carts are fixed: the Carts row disappears (Remove and redraft is the way back).
- Enter the draft's step 2 has no “later” button: “Back to Host” at the top leaves start times for later (Host then
  offers Share the teams, as in Part 1).
- `settings.lobby.hostId` added (optional) for the “organizer” tag; Part 1 rounds simply don't show the tag.

## P2.7 · Council scores (Part 2)

| Round | Architect | Database | Frontend | Tests | Product QA | Red team | What changed |
|---|---|---|---|---|---|---|---|
