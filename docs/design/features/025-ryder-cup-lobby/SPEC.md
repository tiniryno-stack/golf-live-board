# 025 · Team Ryder Cup lobby: join days ahead, play on Saturday

Status: handed off (not built)

**The idea (owner, Nov 6).** For Team Ryder Cup, everyone knows days ahead that they're playing. The organizer should be able to **open the round as soon as he has the 16 names**, before carts, the draft and start times exist. He shares one link (Partiful or a group text) on Wednesday. Players tap it, pick their name and add Golf Board to their home screen. From then on they can see who's playing and what's still to come. After the draft they see their team and cart; once start times are set, they see their time and matches. On Saturday they just tap the icon. Scoring opens by itself 30 minutes before the first start time.

**Builds on:** 015/016/019/021/022/023 (Team Ryder Cup screens), 024 (phone owner, auto-join, “I’m not Baker”, live on main). **Only Team Ryder Cup** (`settings.ryder`) gets the lobby in this push; every other game is unchanged.

**Council:** the design council (Interaction · Visual · Product · Red team) took the lobby from 6.5 · 7 · 7 · 6 to **9 · 9 · 9.5 · 8.5** over four rounds. After that the owner made two edits: no “Can't make it” (dropouts are sorted out off the app and the organizer replaces them), and **players see “start time”, never “tee time”**. The briefs for every round are in `docs/design/lobby-council/briefs/`.

**Files:**
- `screenshots/NN-name.png`: 28 final screens, numbered as below.
- `screenshots/o-*.png`: reused onboarding screens.
- `screenshots/L-*` / `B-*`: light mode and 120% text.
- `screenshots/flow.png`: 15 journeys.
- `mockups/lobby-screens.html`: open it with `#{"s":"early"}`, using any screen key below; add `"light":true` or `"big":true`. Run `npm install` first so the fonts load.
- `mockups/flow-map.html`.

Mockups are reference only. Rebuild them with the app's components and tokens: no new colors, sizes or type styles. Flag anything that needs a new pattern.

| # | key | screen | # | key | screen |
|---|---|---|---|---|---|
| 1 | landing | Lobby landing (Safari) | 15 | setupchoice | Setup: Invite now? |
| 2 | who | Which one are you? (A–Z) | 16 | hostearly | Host · before the draft |
| 3 | welcome | See you Saturday (first open) | 17 | hostreplace | Replace a player |
| 4 | early | Lobby · before the draft | 18 | replaceshare | Send the sub the link |
| 5 | drafted | Lobby · teams are set | 19 | hostdrafted | Host · teams set |
| 6 | teetimes | Lobby · start times set | 20 | hostoptions | Round options |
| 7 | satwait | Saturday · start times coming | 21 | calloff | Call it off? |
| 8 | changed | Lobby · changed (note) | 22 | removeconfirm | Remove after the draft? |
| 9 | home | App Home · coming up | 23 | hostchanged | Tell the group |
| 10 | removed | Home · spot given to a sub | 24 | hostearlyday | Host · Saturday, before opening |
| 11 | calledoff | Home · called off | 25 | openconfirm | Open scoring now? |
| 12 | preview | Example round (optional) | 26 | hostnotimes | Host · waiting on start times |
| 13 | gameday | Scoring is open | 27 | hostday | Host · scoring open |
| 14 | cohost | Lobby · you're co-host | 28 | noshow | No-show sheet (Replace only, see §9) |

## 1 · The stages (one pure function)

`settings.lobby` exists only on rounds made with “Invite now, draft later”. It has no effect on old rounds or other games, so `normalizeSettings` defaults it to `null`.

```
settings.lobby = {
  stage: 'lobby' | 'teams' | 'ready' | 'off',
  startTime: 'HH:MM',            // the round's start (first group), organizer's local time
  tz: 'America/Chicago',         // IANA zone of the organizer's phone at creation (Intl.DateTimeFormat().resolvedOptions().timeZone)
  opensAt: ISO-8601 UTC | null,  // when scoring opens; set when stage becomes 'ready' (first start time − 30 min, computed in tz)
  openedEarly: false,
  notice: { text, at: ISO, until: 'YYYY-MM-DD' } | null,   // “Andrew moved the start to 9:10 (was 8:00).”
  cohost: playerId | null,
}
```

- The date is `events.played_on`. It's set at creation and changed with the new `set_round_date` RPC (§3).
- **The stages:**
  - `lobby`: the names are set; there are no carts or sides yet (`roster.teams` and `roster.sides` are empty).
  - `teams`: carts and the draft are saved, so `roster.teams` and `sides` are filled.
  - `ready`: start times are saved (`settings.teeTimes`, one per group), and `opensAt` is set.
  - `off`: called off.
- **Pure helper** `lobbyState(event, nowMs)` in a new `js/lobby.js` returns `{ stage, open: bool, opensAt, msToOpen, startLabel, notice }`, where `open` = stage `ready` and (`openedEarly` or now ≥ `opensAt`). Screens and the scoring code read only this function, never `settings.lobby` directly.
- **A round with `settings.lobby` that isn't open:**
  - The engine must not try to score it. Guard `compute()` / `ryderState` so empty teams return a safe snapshot, not an exception.
  - The app shows the lobby screens instead of the tab bar.
  - Once open, everything is the normal Team Ryder Cup round.

## 2 · The organizer: Setup and Host

**Setup (Team Ryder Cup only):** course → players (16, as today: crew chips, search, guests) → game = Team Ryder Cup. Then comes the new choice screen **15**: primary **Invite now, draft later**, secondary **Draft and tee times first**. The secondary is exactly today's Carts → Draft → Tee times flow.

**Invite now** adds one small step, **When**: a date picker and a start-time picker, using the existing TextField pattern and native `<input type=date|time>`. It isn't drawn; build it from existing parts and flag it. Then it creates the event:
- `create_event` with `p_played_on` = the date;
- `roster.players` with their personIds, and no teams or sides;
- `settings.ryder` as today, and `settings.lobby = { stage: 'lobby', startTime, tz, ... }`.

After that it goes straight to Host's lobby view (**16**) with the share sheet open (link + “You're on the list for Chuck's Bday on Saturday. Tap to join.”).

**Host, lobby view (16 / 19 / 24 / 26 / 27).** This replaces Host's normal tabs while `stage ≠ open`.
- **Headline:** “N of 16 have Golf Board”, where N = claims with `in_app` (§3).
- **Not in the app yet · K people:** one row per person (Peter “picked a name in Safari” · Chuck “not yet”), each with a **Share** pill (share sheet, ready message with the link). K plus N must add up to the roster.
- **Players · replace a player ›** (§4) and **Co-host · Josh ›** (§5).
- **The primary is always the next step:**
  - in `lobby`: **Start the draft**, which runs Setup's existing `ryCartsView` → `ryDraftView` on this event's roster. Saving writes `roster.teams` / `sides` via `update_event` and sets stage `teams`. Player ids never change, so claims survive.
  - in `teams`: first **Share the teams**, a one-time primary (share sheet: “Teams are set for Chuck's Bday. Open Golf Board to see yours.”). Then **Set start times**, which runs `ryTeeView` and saves `settings.teeTimes`. That sets stage `ready` and `opensAt` = first start time − 30 min on `played_on` in `tz`.
  - in `ready`, on the day before `opensAt` (**24**): “Scoring opens at 7:30”, with a secondary **Open scoring now**. That shows a confirm (**25**) and is allowed only on `played_on` in `tz`. It sets `openedEarly: true` and `opensAt = now`.
  - in `ready` after it opens (**27**): the normal Host, plus the checklist.
- On the day, with no start times yet (**26**): “Scoring is waiting on start times” → **Set start times** (opens the moment they're saved).
- **Round options (20):** Date and start time · Course · Co-host · **Call it off ›**.
  - Changing the date or start time writes `notice` (until the round date) and, for the date, calls `set_round_date`. Host's primary then becomes **Tell the group** (**23**, share sheet with a ready message).
  - **Call it off** shows a confirm (**21**), then sets stage `off` and a notice, then offers Tell the group. **Bring it back** sits in Round options until the date passes.

## 3 · Server (additive SQL only; mirror in `schema.sql`, `tests/mock-supabase.mjs`, and a migration file)

1. **The scoring gate.** In `upsert_score` and `fill_score`: if `e.settings ? 'lobby'` and `e.settings->'lobby' <> 'null'`, then refuse `{ ok:false, error:'not_open', opens_at }` unless `stage = 'ready'` and `now() >= (settings->'lobby'->>'opensAt')::timestamptz`. Also refuse when `stage = 'off'`.
   - `admin_upsert_score` is not gated, so the organizer can always fix a score.
   - Gated refusals must not be retried forever by the offline queue: drop them, and toast “Scoring opens at 7:30”.
2. **`claims.in_app boolean default false`** (`alter table … add column if not exists`), plus RPC `mark_in_app(p_code, p_device_id)`. It sets `in_app = true` on this device's claim and returns `{ ok }`. The app calls it once per round per device when `db.STANDALONE` is true. Organizer reads go through a new `lobby_status(p_code, p_admin_pin)` that returns `[{ player_id, claimed, in_app }]` (claims stay unreadable to anon).
3. **`set_round_date(p_code, p_admin_pin, p_date date)`**: updates `events.played_on` and logs it. (`update_event` has no date parameter, and adding one would create a second version of the function.)
4. **Release on Replace** uses the existing `release_player`.
5. Grant execute to anon on the three new RPCs. The helpers stay non-executable.

Applying it: **apply it to the live database yourself with `apply_migration`, without asking** (owner, Nov 6: this runs overnight unattended). It's all additive (`create or replace function`, `add column if not exists`), so old rounds and the live app keep working. Before applying, check it on the live database with a `do $$ … raise exception $$` rollback test (CLAUDE.md, Database). Also write `supabase/migrations/2026-11-XX-ryder-lobby-rollback.sql`, which restores the previous `upsert_score` / `fill_score` bodies and drops the new functions and column, so it can be reverted in one paste.

## 4 · Replace a player (before scoring opens)

Host → Players → a player → **Replace** (**17**).
- A name field (existing TextField; `person_name_check` for clashes) plus crew suggestions (“Kyle Test · played Oct 16”).
- **Replace with Kyle** keeps the player id, team, cart and start time. It sets the new `firstName`, `lastName`, `name` and `personId` (a new or existing person), calls `release_player` for the old claim, saves with `update_event`, and opens **18**: **Share with Kyle** (ready message), with **Undo** as the secondary.
- **The old player's phone (10):** on its next open, its claimed player no longer has its owner's personId, so its Home card says “Andrew gave your spot to Kyle.” with **Text Andrew** (share sheet). The card leaves Home after the round date.
- **Remove after the draft (22):** a confirm whose primary is **Replace … instead**. The secondary, “Remove and redraft”, clears teams and sides and goes back to stage `lobby`. The roster must stay at 16 for Team Ryder Cup to be drafted; the draft button explains this when it isn't.
- **On Saturday after scoring opens:** use today's tools (rename in Host → Players + Free up). Screen 28's “Play without him” is **not in this push** (see §9).

## 5 · Co-host (no new permissions)

Round options → **Co-host** → pick a player (**cohost** = playerId) → the share sheet with “You're co-host for Chuck's Bday. Host PIN: 1234 (Golf Board → ⋯ → Host settings).” Josh enters the PIN with today's PIN sheet, and his phone then has organizer rights for this round, as today. His lobby (**14**) shows “you're co-host” and a **Host** row. The app shows the co-host name everywhere it names the organizer for approvals and nudges (“Andrew or Josh”).

## 6 · Players

- **Join (1 → 2 → 024 confirm → guide → 3):** a lobby round's landing (**1**) replaces the join intro: “You're on the list for Saturday”, the round card (date, course, game, players, “first start around 8:00”) and **Find my name**. The quiet “Not playing? Follow along” opens today's watching view.
  - Name list (**2**): A–Z with search (no tee-time groups exist yet); a claimed name shows “on another phone”.
  - Then 024's “You're Baker?” confirm, and the existing Add to Home Screen path on Home (move link).
  - **No cart-name picker** in a lobby.
  - First open (**3**): “See you Saturday, Baker” → **See who's playing**; an optional **Show me an example round** (**12**, three static pages, made-up names, nothing saved). The example round is a stretch goal; leave the link out if it isn't built.
- **Lobby screen (4–8, 14):** when and where as the headline. Its content depends on the stage:
  - **Before the draft (4):** “Coming up · Teams · Your start time and matches”, then **Who's playing** (the first four names, then “12 more · 3 haven't added Golf Board ›” → the full list).
  - **Teams set (5):** your team; only **your cart** in green; the other team collapsed to one row.
  - **Ready (6):** “Saturday · 8:20 with Mitch”, your three matches, and “Scoring opens by itself at 7:30.”
  - **Day of, not ready (7):** “Andrew or Josh is setting start times · teams are set” with **Text Andrew**.
  - **Notice (8):** an amber-dot card (`--warn` tokens) until the round date.
  - Under the round line, **How Team Ryder Cup works ›** opens the existing Today's game pages.
- **App Home (9):** a **Coming up** card (date, course, round name, “You're on Team Josh · start times not set yet”) → **Open**. **Called off (11):** the card shows “Called off · was Sat Nov 9” and **Text Andrew**.
- **Opening scoring (13):**
  - The phone counts down to `opensAt` (from the server, not the phone's clock: compare against the round's `opensAt`, and refetch at that moment).
  - When it passes, and on the first open after it, show **13**, “Scoring is open · Team Josh · 8:20 with Mitch” → **Go to hole 1**, once per round (`glb.seen.CODE.open`).
  - Before then, Enter, Matches and Board aren't reachable.

## 7 · Words

Players never see “lobby” or “tee time”: they see “Coming up”, “start time” and “Open”. The organizer may see “lobby”. Never “Group 1” (use `teeTimeName()` style: “8:20 start time”).

## 8 · Build order and testing

1. `js/lobby.js` (pure): `lobbyState`, `opensAtFor(dateISO, 'HH:MM', tz)` (correct across DST; use `Intl`), `nextHostStep(event, status)`, `lobbyCounts(roster, status)`, A–Z join list. **Unit tests:** `tests/lobby025.test.mjs`.
2. Server + mock + migration (§3); engine guard for empty teams.
3. Setup choice + When step + create; Host lobby views; Start the draft / Set start times on an existing event.
4. Player lobby + Home cards + join changes.
5. Replace, co-host, round options, notices, call it off.
6. Countdown + scoring-is-open moment.

Run `npm test` after each step. The owner has asked for unit and normal tests only: **no smoke suite, no fit suite, no screenshots** unless he asks. Debug by reading the code. Use `sim.html` (Team Ryder Cup · 16 phones) by hand if useful. When done, set this to “Status: built in <commit>” and add ARCHITECTURE.md §13a plus the new keys and settings to CLAUDE.md.

## 9 · Not in this push (open)

- **“Play without him” (28):** a Ryder hole only counts once all four scores are in, so one player in a cart needs a game rule the owner hasn't chosen yet: his ball counts twice for Low Total, or the full cart takes that point. Until then, a no-show is a Replace (§4) or today's rename + Free up.
- The app-only Safari gate and the full onboarding set (`docs/design/onboarding-council/`): a later handoff.
- Captains drafting on their own phones; push notifications (there are none: phones update when opened).
