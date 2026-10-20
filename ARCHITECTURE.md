# Golf Live Board — Architecture

**Version:** v2.0 (ready to build) · Oct 16, 2026
**Owner:** Andrew (tiniryno-stack)
**First use:** Friday Oct 16, 2026 — 8 players, 2 foursomes on back-to-back tee times, rotating 2v2 at Twin Creeks

---

## 1. What this is

A mobile web app where each foursome enters hole-by-hole scores and **everyone sees one live leaderboard across all tee times.**

It has two layers:

| Layer | What it does | Always on? |
|---|---|---|
| **Core: live scorecard + leaderboard** | Raw strokes per player per hole → stroke-play leaderboard (gross, and net if handicaps are entered), across every group on the course | Yes |
| **Games (optional)** | Team formats computed from the same raw scores. v1 ships the **rotating 2v2** in two flavors: *Match Play* and *Plus/Minus* | Picked per round |

**Core principle: store raw strokes only. Every point, total, and standing is derived.** Switching game mode, team-score method, or gross/net mid-round never loses or corrupts data — it just recomputes.

## 2. Scope

**In scope for Friday (v1)**
- Create a round at the course in under 2 minutes: pick the course, type player names, name the teams, set groups and carts, optional handicaps, game settings. No tee times required
- **Reusable:** every round is its own event. "Run it back" starts a new round by copying players, team names, carts and settings from a past one
- Join by link or short code, then **tap your name**. No PINs for players. The app knows who you're playing on every hole, so you can only enter scores for the four people in your current matchup; everyone can watch everything
- Fast score entry for your cart and the cart you're playing, editable any time; carts swap foursomes every 6 holes so every matchup is played in person
- Live leaderboard (players + teams), live game standings, matchup detail
- **Season standings (lite):** player and pair records across every round your crew has played, kept **outside** the live round (Home screen, plus a link on the final leaderboard), so there's something to show the group after round one
- **Organizer** (one admin PIN, only the person who created the round) can change settings mid-round, fix any score, free up a player spot, and reset (clear all scores) or delete a round — handy for practice rounds
- Works with spotty course signal (offline queue)

**Out of scope for v1**
- Personal logins/accounts, App Store app, history across rounds
- Scramble / alternate shot (one score per team = different entry model)
- Skins, Nassau, presses, side bets, payouts
- Team counts other than 4 for the rotating game (stored as data so it can grow later)

## 3. Stack

```
 Phones (Safari/Chrome)                     GitHub Pages (static hosting)
 ┌──────────────────────┐   loads    ┌──────────────────────────────────┐
 │ index.html + JS      │◄───────────│ tiniryno-stack/golf-live-board   │
 │  scoring.js (pure)   │            └──────────────────────────────────┘
 │  db.js ──────────────┼── reads + RPC ──►┌──────────────────────────────┐
 │  offline queue       │◄── Realtime ─────│ Supabase (free tier)         │
 └──────────────────────┘    (websocket)   │  Postgres: events, scores    │
                                           │  PIN-checked write functions │
                                           │  Realtime on scores/events   │
                                           └──────────────────────────────┘
```

- **Frontend:** plain HTML/CSS + ES modules, **no build step**. Push to `main`, GitHub Pages serves it. Nothing to compile or break the morning of.
- **Backend:** Supabase via `@supabase/supabase-js` from a CDN. Postgres for storage, a few Postgres functions that check PINs before writing, Realtime so a birdie entered in Group 2 shows up on Group 1's phones in about a second.
- **Why not Google Sheets like G-League:** the published-CSV trick is read-only. Here 8 phones write.
- **Why no custom server:** scoring runs client-side from raw data. The only server logic is "is this PIN allowed to write this score?", which lives in database functions.

## 4. Repo layout

```
golf-live-board/
├── index.html              # shell, screen containers, CDN script tags
├── css/styles.css          # tokens (section 9) + components
├── js/
│   ├── config.js           # SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
│   ├── courses.js          # built-in courses (checked against the real card): Twin Creeks
│   ├── coursedata.js       # course search + scorecards from OpenGolfAPI (pure shaping + fetch)
│   ├── app.js              # routing (hash-based), state, rendering
│   ├── db.js               # load round, RPC writes, realtime subscribe, offline queue
│   ├── scoring.js          # PURE functions only — no DOM, no network
│   ├── headlines.js        # PURE: replays scores in time order → comeback / streak / lead-change headlines
│   └── screens/            # home, setup, enter, board, matches, card, host, sheets, toasts
├── supabase/schema.sql     # tables, RLS, write functions, realtime publication
├── supabase/functions/course-search/  # Edge Function: backup route to OpenGolfAPI
├── tests/scoring.test.mjs  # node --test, covers section 7 worked examples
├── ARCHITECTURE.md
└── README.md               # setup + how to run a round
```

`scoring.js` is the heart. It takes `(course, roster, settings, scores)` and returns every derived number. Keeping it pure means it can be unit-tested without a browser and every screen renders from one computed snapshot.

## 5. Data model

### 5.1 Tables, permissions, write functions

```sql
create table events (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- short join code, e.g. "TC7K2"
  name        text not null,
  played_on   date,
  crew_id     uuid,                          -- groups rounds into a season; "Run it back" keeps it
  course      jsonb not null,                -- copy of the course at creation (5.2)
  roster      jsonb not null,                -- 5.2
  settings    jsonb not null,                -- 5.2
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  finalized_at timestamptz                   -- organizer finalized: scores locked (organizer PIN to edit)
);

create table event_secrets (                 -- never readable from the browser
  event_id    uuid primary key references events(id) on delete cascade,
  admin_pin   text not null                  -- organizer only, 4–6 digits
);

create table claims (                        -- which phone is which player; never readable from the browser
  event_id    uuid references events(id) on delete cascade,
  player_id   text not null,
  device_id   uuid not null,                 -- random ID the phone generates and keeps in localStorage
  claimed_at  timestamptz default now(),
  primary key (event_id, player_id),
  unique (event_id, device_id)               -- one player per phone
);

create table join_requests (                 -- "let them in" asks; readable so foursome phones see them live
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references events(id) on delete cascade,
  player_id   text not null,
  status      text not null default 'pending',  -- pending | approved | denied | expired
  approved_by text,                             -- player name of whoever tapped "Let them in"
  created_at  timestamptz default now()
);

create table join_request_devices (          -- the requester's device ID, kept private
  request_id  uuid primary key references join_requests(id) on delete cascade,
  device_id   uuid not null
);

create table audit_log (                     -- organizer-only activity log; never readable from the browser
  id          bigint generated always as identity primary key,
  event_id    uuid references events(id) on delete cascade,
  at          timestamptz default now(),
  actor       text not null,                 -- player name, "Organizer", or "System"
  action      text not null                  -- plain English: "Hole 8 · Mike 5 → 4"
);

create table scores (
  event_id    uuid references events(id) on delete cascade,
  player_id   text not null,
  hole        smallint not null check (hole between 1 and 18),
  strokes     smallint check (strokes between 1 and 15),  -- null = cleared
  updated_by  text,                                       -- device label, for "who changed this"
  updated_at  timestamptz default now(),
  primary key (event_id, player_id, hole)
);

alter table events        enable row level security;
alter table event_secrets enable row level security;  -- no policies at all
alter table claims        enable row level security;  -- no policies at all
alter table join_request_devices enable row level security;  -- no policies at all
alter table audit_log     enable row level security;  -- no policies at all
alter table join_requests enable row level security;
alter table scores        enable row level security;

create policy "anyone can read events"        on events        for select using (true);
create policy "anyone can read scores"        on scores        for select using (true);
create policy "anyone can read join requests" on join_requests for select using (true);
-- No insert/update policies: the browser cannot write tables directly.

alter publication supabase_realtime add table scores, events, join_requests;
```

**Write functions** (`security definer`, the only way to write):

| Function | Who can call it | What it does |
|---|---|---|
| `create_event(name, course, roster, settings)` | Anyone | Creates the round, generates the join code and the organizer's admin PIN. Returns them once. |
| `claimed_players(code)` | Anyone | Returns which player IDs are taken (never device IDs), so the join screen can grey out names already in use. |
| `claim_player(code, player_id, device_id)` | A phone not currently playing | Gives that name to this phone if nobody has it. Fails with `taken` if another phone holds it, or `already_playing` if this phone already has a name (it must leave first; there is no silent switching). |
| `leave_round(code, device_id)` | A playing phone | Releases this phone's name and drops it to watch-only. |
| `request_join(code, player_id, device_id)` | Anyone | When a name is `taken`: creates a pending "let them in" request (expires after 5 minutes). |
| `approve_join(code, approver_device_id, request_id)` / `deny_join(...)` | Any phone in **that player's current foursome** (their partner or current opponents), or the organizer | Approve moves the name to the requesting phone (the old phone drops to watch-only). Deny closes the request. |
| `upsert_score(code, device_id, player_id, hole, strokes)` | A phone that has claimed a player | Rejects unless the player being scored is in the phone's **foursome for that hole**: their own cart or the cart they're playing on that hole (fixed mode: same group). Rejects with `finalized` once the organizer has finalized the round. Then upserts and stamps `updated_by` with the phone's player name. |
| `admin_upsert_score(code, admin_pin, ...)` | Organizer | Fix any foursome's score — also while the round is finalized. |
| `update_event(code, admin_pin, course, roster, settings)` | Organizer | Mid-round changes: rules, team names, strokes, player swaps, par corrections. |
| `release_player(code, admin_pin, player_id)` | Organizer | Backup: frees a name if nobody in that foursome is around to approve. |
| `get_audit_log(code, admin_pin)` | Organizer | Returns the round's activity log, newest first. |
| `reset_round(code, admin_pin)` | Organizer | Clears every score (to null, so Realtime carries it) and keeps players, carts, settings and joined phones; reopens a finalized round. For practice rounds. |
| `finalize_round(code, admin_pin, final = true)` | Organizer | Sets (or with `false` clears) `events.finalized_at`. While set, `upsert_score`, `fill_score` and `pick_team_name` refuse with `finalized`; `admin_upsert_score` still works. Realtime on `events` tells every phone. |
| `delete_round(code, admin_pin)` | Organizer | Deletes the round and everything in it (scores, claims, PIN, requests, activity log). |
| `pick_team_name(code, device_id, name)` | A phone that has claimed a player | Names that player's cart; refuses a name another cart already has (case-insensitive). |

**Audit log:** every write function above also inserts one plain-English line into `audit_log`, so the log can't be skipped or edited from a phone. Examples:

| Time | Who | What |
|---|---|---|
| 9:42 | System | Round created at Twin Creeks |
| 9:44 | Andrew | Joined as Andrew (Group 1) |
| 10:31 | Mike | Hole 8 · Mike 5 → 4 |
| 10:33 | Organizer | Strokes · Mike 15 → 18 |
| 11:02 | Tyler | Let in Jake's new phone |

Viewable in Host → Activity, or in Supabase → Table Editor → `audit_log`.

- One row per player per hole; writes are **upserts**, so double-taps and retries are harmless.
- Clearing a score sets `strokes = null` instead of deleting the row (Realtime can't filter deletes by `event_id`).
- **Security, honestly:** this blocks the realistic problem — someone in the other tee time entering scores for your foursome — without adding a PIN for players. Device IDs are random and never sent back to browsers, so nobody can pose as another phone. Taking over a name someone is already using needs a tap from their foursome, so nobody can impersonate an active player. The remaining gap: someone could deliberately grab an *unclaimed* name in another foursome. That's visible (every score shows who entered it) and fixable (organizer frees the name and corrects the score). Never put the Supabase `service_role` key in the frontend.

### 5.2 JSON shapes

**Course catalog (`js/courses.js`)** — built-in courses; any other course comes from course search (`js/coursedata.js`) in the same shape (plus `ogaId`, `source`, `lat`/`lng`, `holes`). The round stores a copy (with `tees`, `source`, `ogaId`), so later catalog edits never change past rounds.
```json
[{
  "id": "twin-creeks-allen-tx",
  "name": "The Golf Club at Twin Creeks",
  "location": "Allen, TX",
  "tees": [
    { "name": "Gold",  "yards": 6840, "rating": 73.2, "slope": 131 },
    { "name": "Blue",  "yards": 6288, "rating": 70.5, "slope": 123 },
    { "name": "White", "yards": 5651, "rating": 67.3, "slope": 111 },
    { "name": "Red",   "yards": 4602, "rating": 66.5, "slope": 107 }
  ],
  "par":         [5,4,3,4,4,5,3,4,4, 4,3,4,5,4,3,5,4,4],
  "strokeIndex": [5,9,15,1,17,11,3,7,13, 18,16,6,14,10,12,4,8,2]
}]
```
Par 72 (out 36, in 36). Source: GolfPass scorecard listing; check against the physical card on the first tee. The admin can correct any hole mid-round.

**roster** — teams are optional so the core leaderboard works for any group of golfers
```json
{
  "groups":  [{ "id": "g1", "name": "Group 1" }, { "id": "g2", "name": "Group 2" }],   // used in fixed mode; swap mode derives foursomes from the rotation
  "teams":   [{ "id": "A", "name": "Hogan's Heroes" }, { "id": "B", "name": "Shank Redemption" },
              { "id": "C", "name": "Cart C" },         { "id": "D", "name": "Cart D" }],
  "players": [{ "id": "p1", "personId": "7f3c…", "name": "Andrew", "groupId": "g1", "teamId": "A", "strokes": null },
              { "id": "p2", "personId": "a91d…", "name": "...",    "groupId": "g1", "teamId": "A", "strokes": null }]
}
```
Team names default to `Cart A`–`Cart D` until someone types a name (max 20 characters). The name is what shows everywhere: banners, match cards, the board.

`personId` is a stable ID for the human, carried across rounds by "Run it back" or by tapping a past player's name in Setup. It's what lets season stats (V2) follow Andrew from round to round even as carts, partners and team names change.

**settings**
```json
{
  "handicapMode": "full",             // "full" (strokes as entered) | "offLow" — advanced
  "allowancePct": 100,                // advanced
  "game": "rotationMatch",            // "none" | "rotationMatch" | "rotationPlusMinus"
  "teamScore": "bestBallAggregate",   // "bestBall" | "aggregate" | "bestBallAggregate" (Low Ball + Low Total)
  "halvedHolePoints": 0.5,            // 0.5 or 0
  "plusMinusCap": null,               // null = uncapped, or e.g. 5 (max swing per rotation)
  "maxHoleScore": "doublePar",        // "doublePar" | "netDoubleBogey" | "none" — enforced at entry (pick-up rule)
  "par3NoMax": false,                 // true = par 3s have no max hole score, all round
  "rotationMode": "swap",            // "swap" (carts change foursomes each rotation) | "fixed"
  "rotation": [
    { "holes": [1, 6],   "matches": [["A","B"], ["C","D"]] },
    { "holes": [7, 12],  "matches": [["A","C"], ["B","D"]] },
    { "holes": [13, 18], "matches": [["A","D"], ["B","C"]] }
  ]
}
```

## 6. Live updates, toasts, joining, offline

**Live, no refresh button.** While the page is open, each phone holds one open connection (a websocket) to Supabase. When anyone saves a score, Supabase **pushes** it to every connected phone within about a second, and the screen updates in place. Nobody polls or refreshes. When a phone locks or the browser goes to the background, iOS pauses that connection; the moment the page is visible again, the app refetches everything (at most 8 × 18 rows) and reconnects, so you're current within a second of looking.

1. **Load:** fetch the round by code, then all its scores. Build the snapshot with `scoring.compute()`.
2. **Join:** first open on a phone generates a random `device_id` (kept in `localStorage`). The player taps their name → `claim_player`. The phone remembers the round + player, so refreshes, closing the tab, or losing signal never ask again.
   - **Rejoin after clearing the browser ("Let them in"):** open the same link → tap your name. If the old phone still holds it, this phone shows "Waiting for your foursome to let you in…" and a request goes out. Every phone already playing in that foursome gets a banner: *"Someone wants to join as Andrew"* → **Let them in** / **Not them**. One tap from anyone in the foursome moves the name to the new phone. The organizer can also approve, as a backup if nobody else in that foursome has a phone.
   - **Organizer:** the phone that created the round is the organizer automatically. On any other phone, the organizer opens the private **organizer link** shown at Save (`…/#/e/TC7K2/host`) and enters the admin PIN. Players never see an admin login anywhere.
3. **Subscribe:** one Realtime channel for the round: `scores`, `events` (setting changes), and `join_requests`. Each change patches local state and recomputes.
4. **Write:** optimistic. Update the screen immediately, call `upsert_score` in the background.
5. **Toasts** (in-app, while the page is open): when a change arrives from **another** phone, a small toast slides down from the top, auto-dismisses after 3 seconds, and tapping it jumps to the relevant tab.
   - **Batched per hole:** scores for the same group and hole arriving within ~4 seconds become one toast, e.g. `Group 2 · Hole 8 — Mike 4, Tyler 5, Sam 3, Jake 6`.
   - **Highlights get called out:** `Sam birdied 8`, `Fore Play took both points on 8`, `New leader: Shank Redemption`.
   - **Joins and leaves** toast to that player's foursome: `Andrew joined`, `Andrew's phone left the round`. Anyone hopping between names is visible to the people it affects.
   - **Your own entries never toast, and neither do your current foursome's** (they update live on Enter). At most one toast on screen; newer ones replace older ones.
   - Lock-screen notifications while the app is closed need the site added to the home screen; that's in the V2 backlog.
6. **Headlines** (the big moments, rules in 7.10): unlike toasts, these **stick**.
   - **While you're looking:** a headline banner stays at the top until you tap or swipe it away. One at a time: when two land on the same score they show together for ~10 seconds, then it's back to one (the newest moment's most important).
   - **Color:** a headline wears the jersey of the team on its positive end (took the lead, came back, clinched, won the matchup, on a streak): green when it's your cart, the away color otherwise; sun-yellow when nobody is (halved, tied final). Same colors on the banner, the Board strip, the full list and "While you were away".
   - **When you come back:** the phone remembers when you last looked. Next time the page opens or comes back from the lock screen (usually when you pull it out to enter your score), a **"While you were away"** card slides over the top of Enter (it overlays, so it never pushes the score tiles off screen) with up to 3 headlines since then, newest first. One tap dismisses it; "See all" opens the Board.
   - **Feed:** the top of Board → Today shows the latest headlines for everyone, across both tee times.
   - **How it stays in sync without storing anything:** every phone replays the round's scores in the order they were entered (`updated_at`) through `headlines.js`, so all phones produce the same headlines from the same data.
7. **Offline queue:** failed writes go into a `localStorage` queue keyed by `(player, hole)` (latest value wins). Retry on `online`, on `visibilitychange`, and every 15s. A chip shows `Synced` / `2 unsynced`. A write the server *rejects* (not your foursome) is dropped with a visible error, not retried.
8. **Phones sleep on the course:** on `visibilitychange → visible` or a channel error, refetch all scores and resubscribe. If Realtime keeps failing, fall back to polling every 20s.
9. **Conflicts:** last write wins per `(player, hole)`. The Card tab shows who last edited a cell (`updated_by`).

## 7. Format rules (what `scoring.js` implements)

### 7.1 Rotation — 4 cart teams, carts swap foursomes every 6 holes

**Default for Friday (`rotationMode: "swap"`): you always play your opponent in person.** At holes 7 and 13 the foursomes reshuffle so each foursome is exactly one matchup. One cart from each foursome waits and one moves up; which goes where doesn't matter to the app.

| Rotation | Holes | Matchups (each one is its own foursome) |
|---|---|---|
| 1 | 1–6 | A v B · C v D |
| 2 | 7–12 | A v C · B v D |
| 3 | 13–18 | A v D · B v C |

- Every team plays every other team exactly once, face to face.
- **"Your foursome" changes by rotation:** it's your cart plus the cart you're playing on that hole. The app works it out from the hole number; nobody re-joins or re-selects anything at the swap.
- **Matchup order** is set in Setup: the default order above, or **Shuffle** to randomize who plays whom in which rotation.
- **Fixed foursomes** (`rotationMode: "fixed"`, Setup toggle off): Group 1 = A + B and Group 2 = C + D all day; rotations 2–3 are played against a cart in the other foursome by comparing hole scores. Same scoring; only who-plays-with-whom and editing rights differ.
- Matchups are keyed by **hole number**, so tee times and who goes first don't matter.

### 7.2 Strokes (optional handicaps)

Built for how the group actually does it on the tee box: **everyone plays even, and a newer player gets some strokes.**

- Each player has an optional **Strokes** number in Setup. **Blank = 0 = plays even.** Nobody has to enter anything.
- The number is **literal strokes for the round**, not compared to anyone else's. "Give Mike 15" → Mike gets 1 stroke on each of the 15 hardest holes (hole handicap 1–15); everyone else gets none.
- Over 18 doubles up on the hardest holes: 20 strokes = 1 on every hole + a second on hole handicaps 1 and 2.
- **Strokes on a hole:** `floor(s / 18) + (strokeIndex[hole] <= s % 18 ? 1 : 0)`. Negatives treated as 0 in v1.
- **Net** = gross − strokes on that hole. Games always use net; when nobody has strokes, net *is* gross, so there's no gross/net question in Setup.
- The Board's **Gross | Net** toggle only appears once someone has strokes.
- The organizer can add or change strokes mid-round from Host (e.g., after the front nine shows the new guy needs more); everything recomputes.
- **Advanced (hidden by default):** if everyone enters a real handicap instead, "Play off the low man" subtracts the lowest number from everyone, and an allowance % can scale them. Not needed for the tee-box style.

### 7.3 Team score on a hole

Each method produces one or more **components** per team per hole:

| teamScore | Components |
|---|---|
| `bestBall` | `[min(p1, p2)]` |
| `aggregate` | `[p1 + p2]` |
| `bestBallAggregate` | `[min(p1, p2), p1 + p2]` |

A team's hole is **pending** until both partners have posted.

**Default for Friday: `bestBallAggregate`, a.k.a. "Low Ball / Low Total."** Two points per hole: one for the team with the lowest single score, one for the lowest combined score.

Why it fits a mixed-handicap group:
- **Nobody's hole is ever over.** With best ball alone, once your partner is safe in the fairway, your score stops mattering. Here a bogey vs. a triple can swing the Low Total point even after your partner has the Low Ball locked.
- **Splits keep it close.** A team with one stud and one struggler often wins Low Ball and loses Low Total, so holes split 1–1 instead of 2–0.
- **Blow-ups are capped.** In Match Play a disaster hole costs one point, not the round. In Plus/Minus, the double-par max keeps a single blow-up from swinging the whole margin.

**Max hole score (pick-up rule):** default is the group's house rule, **double par** — par 3 → 6, par 4 → 8, par 5 → 10, the same for everyone. It's enforced at entry (the + button stops at the max), so the leaderboard and every game use the capped number, exactly like picking up and writing down double par.
- `netDoubleBogey` (optional): the official handicap-posting max, `par + 2 + the handicap strokes that player gets on that hole`. Tighter, and it varies by player.
- `none`: no cap.
- **No max on par 3s** (`par3NoMax`, round setting): par 3s play to the real score. Set in Setup, applies all 18 holes, and the Enter header shows `Max: none` on par 3s so nobody picks up by mistake.

### 7.4 Leaderboard (core, always on)

- **Players:** gross to par, net to par (if any handicaps), `thru N`.
- **Teams** (if teams exist): sum of the team's hole score (per `teamScore`) relative to par, over holes where both partners posted.
- **To par** is computed only over holes played, so groups on different holes compare fairly mid-round.
- Sort: to par ascending, then holes played descending.

**Official vs. provisional (team game standings).** The two foursomes tee off back to back, so one is usually a hole ahead (two at most). To keep the ranking fair:

- **Official line** = the last hole **both** foursomes have finished. If one foursome is through 10 and the other through 9, standings are official through 9.
- **The Board ranks teams by official points.** Points from the hole the front foursome is ahead on show as a small chip, e.g. `13½  +2 prov.`, and count as soon as the other foursome finishes that hole.
- With carts swapping (default), every matchup is played in person, so a matchup's holes are always posted together. The official line only exists because the two foursomes are a hole apart.
- All headlines (7.10) are computed from official standings only.

### 7.5 Game: Rotation Match Play *(headline game for Friday)*

**Points are the only currency.** Each team banks the points it earns on every hole, and the team with the most points after 18 wins the day. Beating an opponent head-to-head doesn't take anything from them; it just means you banked more than they did on those six holes.

- For each rotation, for each hole in its range, for each component: lower score banks **1 point**, a tie banks `halvedHolePoints` (default **½**) for each side.
- Why ½: it mirrors the Ryder Cup, where a halved match is worth ½ to each side. It also keeps every hole worth exactly the same total. With 0 for ties, a tight matchup full of halves would bank fewer points than a lopsided one, which skews the leaderboard.
- Each component is scored independently: tied Low Ball = ½ each, tied Low Total = ½ each, both tied = hole halved 1–1. No carryovers.
- A hole only scores once **all four** players in that matchup have posted.
- Team standing = total points across all three rotations (max 36 with Low Ball / Low Total).
- **Head-to-head split** is shown on each match card for bragging rights and tiebreaks, e.g. `Hogan's Heroes 7½ – Shank Redemption 4½`. Live: `Hogan's Heroes +2 thru 4`.
- **Match record** (W-L-H across the three 6-hole matchups) is shown alongside.
- **Final standings tiebreakers:** total points → match record → head-to-head result → Plus/Minus margin → shared position.

### 7.6 Game: Rotation Plus/Minus

Different from Match Play on purpose: this one **is** zero-sum. What you win, your opponent loses.

- Each rotation starts **even**. Over its 6 holes: `margin = opponent total − your total`, summed across components. Positive is good.
- If `plusMinusCap` is set, each rotation's margin is clamped to `±cap` so one blowout can't decide the day.
- Team standing = **running total** of margins across the three rotations. The whole field always sums to 0.
- Default is **uncapped**: every stroke counts all day.
- Live status: `+2 thru 4` over holes both teams have completed in that rotation.

Example (team score = best ball):

| | Rotation 1 (1–6) | Rotation 2 (7–12) | Rotation 3 (13–18) | Running total |
|---|---|---|---|---|
| Team A | shoots +6 vs B's +4 → **−2** | beats C by 3 → **+3** | loses to D by 1 → **−1** | **0** |
| Team B | **+2** | … | … | |

A carries the −2 into the afternoon as its own deficit. The next opponent doesn't inherit it. Each new match starts even, but the running total remembers.

### 7.7 Worked examples (also unit tests)

Rotation 1, best ball, gross, halves = 0.5.

| Hole | 1 | 2 | 3 | 4 | 5 | 6 | Total |
|---|---|---|---|---|---|---|---|
| Team A best ball | 4 | 5 | 3 | 5 | 4 | 6 | 27 |
| Team B best ball | 5 | 5 | 4 | 4 | 5 | 6 | 29 |
| Winner | A | — | A | B | A | — | |

- **Match Play:** A wins 3 holes, B wins 1, 2 halved → **A banks 4, B banks 2**
- **Plus/Minus:** **A +2, B −2**

**Low Ball / Low Total, single hole** (par 4, gross):

| | Player 1 | Player 2 | Low Ball | Low Total |
|---|---|---|---|---|
| Team A | 4 | 6 | **4** | **10** (+2) |
| Team B | 7 | 7 | 7 | 14 (+6) |

→ A banks both points: **A 2, B 0**.
Same hole, but A's Player 2 makes a 10: Low Total is 14–14, halved → **A 1½, B ½**. An 11 instead: B takes Low Total → **1–1**. That's the "keep grinding" effect: every stroke from the struggling partner still moves points.

**Strokes, single hole** (hole 4, par 4, hole handicap 1, Low Ball / Low Total):

| | Player | Strokes for round | Gross | Stroke here? | Net |
|---|---|---|---|---|---|
| Team A | Andrew | — | 5 | no | 5 |
| Team A | Mike (newer) | 15 | 7 | yes | 6 |
| Team B | Player 3 | — | 5 | no | 5 |
| Team B | Player 4 | — | 6 | no | 6 |

→ Low Ball 5 v 5 halved, Low Total 11 v 11 halved → **1–1**. Without Mike's stroke, B takes Low Total (12 v 11) → **B 1½, A ½**.

### 7.8 Two tee times

- **Swap mode (default):** each matchup's four players post together, so match cards never wait on anyone. Only the overall ranking uses the official line (7.4), because the two foursomes are on different holes.
- **At the swap:** with back-to-back tee times the foursomes are about a hole apart, so after holes 6 and 12 the front foursome waits briefly at the next tee and carts trade. The app needs nothing from this; scoring just continues.
- **Fixed mode:** cross-group holes stay pending until the trailing foursome posts them; match cards show `pending` rather than guessing.

### 7.9 Season standings (V1-lite)

Rounds with the same `crew_id` form a season. The Season view recomputes every round in the crew with the same `scoring.compute()` and adds them up by `personId`. Nothing extra is stored.

- **Player record (W-L-H):** each 6-hole matchup a player's team completes counts as a win, loss or halve for that player (by head-to-head points). Three per round. Ranked by win %, then total points.
- **Pair record:** the same, keyed by the **two people** in the cart (order doesn't matter), labeled with the team name they used most recently: `Team Bazinga · Andrew + Sean · 2-1-0`. Andrew + Justin as "Star Friends" is a separate row.
- **Columns:** rounds played, W-L-H, total points, rounds won (team finished 1st that day).
- Unfinished matchups don't count until all six holes are in; abandoned rounds simply contribute whatever matchups finished.
- Works with one round: after Friday it shows Friday's records, and new names and pairs appear as the crew keeps playing.

### 7.10 Headline rules (what counts as a big moment)

Strict on purpose: a headline should feel like news, not noise. Tuned for Match Play with Low Ball / Low Total (2 points a hole, 36 max).

**Confirmed scores only.** Every headline is computed from the **official** standings (7.4), never from a team that's simply played more holes. Example: Hogan's Heroes' foursome is a hole ahead, on 10. Fore Play's foursome finishes 9, which moves the official line to 9; if that puts Fore Play in front, **that's** when `Fore Play takes the lead` fires. Hogan's Heroes' points on 10 can't create a lead change until the other foursome finishes 10 too.

| Headline | Fires when | Example |
|---|---|---|
| **Lead change** | A different team takes over 1st in **official** points (ties don't count) | `Fore Play takes the lead` |
| **Comeback** | A team cuts its gap to the team directly ahead of it by **3+ points within its last 4 holes**, and the gap is now **2 or less** | `Fore Play is coming back — cut the lead from 6 to 2½` |
| **Matchup comeback** | Within a 6-hole matchup, a team that was down **3+** draws level or goes ahead | `Shank Redemption erased a 3-point hole vs Bogey Boys` |
| **Streak** | A team sweeps (2–0) **3 holes in a row**; fires again at 5, and at 6 (a perfect rotation) | `Bogey Boys swept 3 straight` |
| **Matchup clinched** | A team's lead in a matchup is bigger than the points left | `Hogan's Heroes clinched vs Fore Play with 2 holes to play` |
| **Matchup final** | All 6 holes of a matchup are in | `Hogan's Heroes beat Fore Play 8–4` |
| **Round final** | All 18 holes are in for every foursome | `Final: Hogan's Heroes win the day with 21` |

- **Noise limits:** at most one headline per team per hole; if several fire together, only the highest priority shows (Lead change → Comeback → Matchup comeback → Matchup clinched → Streak → Matchup final), the rest go to the feed only. Birdies and "both points on a hole" stay as 3-second toasts.
- **Plus/Minus version:** same shapes in strokes — comeback = cut the deficit by 4+ strokes within 4 holes to 2 or less; streak = lowest team score 3 holes in a row.
- Thresholds live in one config object in `headlines.js` so they can be tuned after Friday.

**Matchup alerts (just for the two carts in that matchup).** Shown as a **full-screen card right after you tap `Next hole →`**, the moment you're most likely looking at your phone, before the next hole appears (same style as Switch it up). One tap (`Let's go`) continues. Shown once per hole per phone; never a banner that sticks around, and not broadcast to the other foursome.

With `d` = how far you're behind in the matchup and `L` = points left in it:

| Alert | Fires when | Banner |
|---|---|---|
| **Lock in** (trailing team) | You can still halve or win, but only by taking nearly everything: `d ≤ L ≤ d + 1` | `Lock in — you need 3½ of the last 4 points to win this matchup` / `Lock in — win out to halve: you need all 4 points left` |
| **Close it out** (leading team) | Points on this hole would clinch: the fewest points `x` on this hole such that your lead after it beats the points left | `Take 1½ on this hole to clinch` / `Sweep this hole to clinch` |

Examples (2 points per hole): down 4 with 2 holes left → win out to halve; down 3 with 2 left → need 3½ of 4; up 3 with 3 holes left → sweep this hole to clinch. Once a matchup is clinched, both alerts stop.

## 8. Screens (mobile-first, one-handed)

**Players see six screens: two outside a round, four tabs inside one. The organizer also gets a Host screen (round button beside the tab bar).** No settings page for players. Hash routes, no page reloads.

```
 #/  HOME ──── new round / run it back ────►  #/setup        SETUP (new)
  │  join · recent rounds · season              #/setup/TC7K2  SETUP (run it back)
  │                                                │ save → join code, share link, organizer link + PIN
  ▼ open a round  ◄─────────────────────────────────┘
 ┌─────────────── inside a round: bottom tab bar ─────────────────────────┐
 │  ENTER            MATCHES            BOARD            CARD      │ (HOST)  │
 │  #/e/TC7K2/enter  #/e/TC7K2/matches  #/e/TC7K2/board  …/card    │ …/host  │
 └─────────────────────────────────────────────────────────────────┴─────────┘
                                       (HOST) = separate round button, organizer's phone only
 Top bar (every tab): your-name chip · round name (label) · light/dark icon · ⋯ menu (How today's game works, share, Go to Home, Switch to watching). No back button inside a round.
 Sheets (slide-up overlays): who are you? · player detail
 Toasts: other players' scores and highlights · "let them in" requests
```

### Fit-the-screen rule (iPhone Safari)

**High-yield info is never hidden under a scroll. Pages that are naturally long (leaderboards, scorecards, logs) can scroll.** Designed for the smallest phone first, then scaled up.

| Must fit with zero scrolling | Allowed to scroll |
|---|---|
| **Enter**, entirely: hole header, matchup banner, all four score tiles with − / +, Next hole | Board, Season standings, Matches, Card, Setup steps, Host, Activity log |
| Top bar and bottom tab bar, on every screen (pinned, never scroll away) | |
| The **top of Board**: the leader and your team's position show before any scrolling | |

- **Target sizes:** iPhone SE (375 × 667) as the floor, through 13 mini, 15/16, and Pro Max (430 × 932), all measured **with Safari's address bar showing** (worst case).
- **App shell:** fixed 3-row layout — top bar · content · bottom tab bar — sized with `100dvh` (the height Safari actually gives you, which changes as its toolbar shows/hides). Only the content area scrolls, and only on the pages listed above.
- **Notch and home bar:** `viewport-fit=cover` + `env(safe-area-inset-*)` padding, so nothing sits under the notch or the home indicator.
- **Fluid sizing on Enter:** score tiles, steppers and fonts use `clamp(min, % of screen height, max)`. They shrink on an SE and grow on a Pro Max, but **tap targets never drop below 48px**.
- **No sideways scrolling anywhere:** Card uses a **Front | Back** toggle so 9 holes fit across even an SE.
- **Safari quirks handled:** inputs use ≥16px text so Safari doesn't zoom in on tap; buttons use `touch-action: manipulation` so fast double-taps on − / + don't zoom the page.
- **Portrait only:** in landscape, a full-screen "Turn your phone upright" message instead of a squashed layout.
- **Automated check:** a test opens every screen at each target size in a headless browser and fails if Enter needs scrolling, if anything scrolls sideways, or if the top bar / tab bar / Next hole button is ever off screen.

### Permissions at a glance

| | Watch everything | Enter/edit own foursome | Edit any foursome | Change settings |
|---|---|---|---|---|
| Opened the link, hasn't picked a name | ✓ | | | |
| Picked their name | ✓ | ✓ (their current matchup: own cart + the cart they're playing) | | |
| Organizer (admin PIN) | ✓ | ✓ | ✓ | ✓ |

### 1. Home
Join by code, "New round", "Run it back" (copy a past round's players, team names, carts, settings), recent rounds on this device, and **Season standings** for your crew (section 7.9) — the only place it lives, so it never clutters a live round.

### 2. Setup — organizer only; step by step (Course → Players → Teams → Matchups → Game → Save)
Players never see Setup: they open the link and tap their name. ("New round" on Home is open to anyone; whoever starts a round is that round's organizer.)
- **Course:** a search box, then **Your courses** (built-in ones like Twin Creeks, plus every course your group has played — the copy from your last round there, so a fixed par or handicap sticks) and **Near you** (**Find courses near me** asks for location; if the site already has permission it loads by itself; nearest first, with miles). Typing 2+ letters searches by name (your matching courses first, then OpenGolfAPI results, nearest first when location is known; the list updates without stealing focus from the box). 9-hole courses show but can't be picked yet. **Can't find it? Enter the scorecard yourself** (a name box; the card is filled in on Save). **Nothing is preselected.**
  - Picking a course shows a card with its status and **Change**: "Getting the scorecard…" (it loads in the background while you do Players, Teams, …), "Scorecard ready · par 72 · from OpenGolfAPI / checked against the card / from your last round there", or what's missing ("Hole handicaps are missing… You'll fix it on the last step"). Then pick tees (from the course; same name for men and women gets "(M)" / "(W)").
  - **Data:** OpenGolfAPI (`js/coursedata.js`), free and keyless, built on OpenStreetMap — show "© OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI" wherever its data appears (Course step, scorecard card). Direct from the phone first; if blocked, the Supabase Edge Function `course-search` (GET only, our origins only, forwards search + one course; `verify_jwt` off because the publishable key isn't a JWT). A built-in course's `ogaId` makes search use the checked copy.
- **Save → Scorecard check:** a card above the summary: source, "Par 72 · hole handicaps 1–18" or the first problem, and **Check it against the card** (front 9 / back 9 grid of Par + Hcp inputs; opens by itself when something's wrong). Save stays off until the card is complete: 18 pars of 3–6, hole handicaps 1–18 each once, a name for an entered course, and not still loading.
- **Players:** tap names from past rounds of this crew (keeps their season history), or type new ones. Optional **Strokes** per player (blank = plays even). Helper text: "Giving a newer player 15 strokes = 1 stroke on the 15 hardest holes."
- **Teams:** tap players into Team A–D (one per cart), then **name each team** (defaults to `Cart A`–`Cart D`).
- **Matchups:** shows the three rotations in the default order with a **Shuffle** button, and the toggle **Carts swap foursomes every 6 holes** (on by default; turning it off = fixed foursomes and asks for Group 1/2).
- **Game:** game (none / Match Play / Plus-Minus), team score (Low Ball + Low Total / best ball / aggregate), max hole score, **no max on par 3s**, halves. *Advanced* fold: play off the low man, allowance %.
- **Save** → shows the join code and share link (safe to drop in the group chat), plus the **organizer link + admin PIN** (screenshot it, keep it private). This phone becomes the organizer automatically.

### 3. Enter *(default tab, where 90% of time is spent)*
- **First open:** "Who are you?" sheet lists every player, grouped by cart. Tap yours and you're in. Taken names show "in use"; tapping one sends a "let them in" request to that player's current foursome. Skipping the sheet still lets you watch.
- **Header:** `Hole 7 · Par 3 · Hcp 3 · Max: none` with ◀ ▶ arrows (swipe also works).
- **Going back to a hole:** ◀ (or swipe) steps back through **every** hole you've played, and **tapping the hole number opens a grid** of all 18 in play order, one row per matchup ("Holes 1–6 · vs Charmander"), with your score in each cell, "Now" on the hole to play, and holes ahead greyed. Tap a hole to view it on Enter. The hole you're on and the one you just finished are editable as usual; **two or more holes back open locked** (no − / +, a "Tap to edit" chip): tap the box to unlock it for that visit, so nobody fat-fingers an old hole. On a past hole the button reads "Back to hole N →" ("See the Board →" once you're done). Switch it up shows once per swap. Right after `Next hole →`, a toast shows `Hole 8 saved · Undo`; Undo jumps back to hole 8.
- **Matchup banner:** this hole's matchup with team names + live status, e.g. `Rotation 2 · Hogan's Heroes vs Fore Play · +1`.
- **Cart cards — the "enter you + your partner" mechanic:** players are grouped by team, **your cart on top** (known from the name you picked), the cart you're playing below (it changes at holes 7 and 13). Each card shows both partners side by side as two big score tiles, with the team's Low Ball / Low Total for the hole underneath, so entering your cart is two taps.
- **Score tiles:** an empty tile shows a **grey par**. **The first tap anywhere on an empty box (−, the number or +) is par**; after that − / + step (bogey = tap then +, birdie = tap then −), so a stray + never records a bogey. **Next hole waits until every box in your group has a score** — nothing is ever saved as par without a tap. While boxes are empty the button is greyed and says how many are left ("Next hole · 2 scores left"); tapping it anyway shakes the empty boxes, names who's missing in a toast, opens the other cart if all the missing scores are theirs ("Enter theirs here, or wait for their phone"), and pulls the latest scores so another phone's entries show up. (`fill_score` stays in the DB for older phones' queued fills but the app no longer calls it.) + stops at the max hole score. The player's name sits at the top of the tile (spanning it, above − / +) and the score dead center, level with − / +, so a birdie circle or bogey square never runs into the name. A dot beside the name for each handicap stroke on that hole (it doesn't push the name off center). Long-press clears.
- **70/30:** your cart takes ~70% of the space; the cart you're playing is **greyed** to one slim row of small scores (name + score) with a "Tap to enter" chip. A tap on the greyed cart never scores; it opens that cart at **50/50** (their tiles editable, yours greyed with "Tap to go back"). Tap yours to return to 70/30; any other hole opens on yours. A one-time tip ("You can enter scores for the other cart in your group too…") points at the greyed cart the first time your own cart is in and theirs isn't. On tall phones, spare height sits between the cards and the hole dots so Next hole stays at the bottom.
- **Jersey on a card:** a light tint plus a full ring in the cart's color (yours a thicker green ring). No edge stripes on rounded cards: they get clipped by the corners.
- **Next hole:** once all four players have posted, a full-width `Next hole →` button lights up at the bottom (thumb zone). No auto-advance, so nobody gets skipped mid-correction. Tapping it may first show a full-screen **Lock in** or **Close it out** card (7.10), or **Switch it up** after the last hole of a matchup.
- **Swap card:** after the last hole of a rotation is posted, `Next hole →` opens a short **Switch it up** screen: the rotation result (`Hogan's Heroes 7½ – Shank Redemption 4½`), who's next (`Holes 7–12 vs Fore Play · Tyler + Jake`), and "One cart waits, one moves up." Continue → hole 7 with the new foursome.
- Footer: 18-dot strip of completed holes · sync chip.
- **"While you were away" overlay:** on return, up to 3 headlines slide over the top of the screen; one tap dismisses.

### 4. Board
Today only. Headline at the top on the Teams view (the newest one, two for a few seconds when they land together; tap for all), then segmented controls for **Teams | Players** and **Gross | Net**. Teams are ranked by **official** points with a provisional chip for points beyond the official line; footer reads e.g. `Official through 9 · hole 10 provisional`. Tap a row → player detail sheet. Share icon copies the round link.
- **After Round final:** a `Final` banner on top plus a **See season standings** button. That's the end-of-round moment to show the group.
- **Finalize (organizer):** under the final card the organizer gets **Finalize round** (also Host → Rules → Finish the round; confirm sheet says how many scores are blank, if any). Once finalized the card reads `Final · locked`; everyone else sees "Scores can still be fixed until the organizer finalizes the round" before that. Finalized early (scores missing): a grey "finalized · scores locked" strip instead of the card.
- **Finished rounds open here:** opening a round that's over (finalized, or every score in) lands on the Board instead of Enter — from Home, the share link, or an old `/enter` link. Joining a finished round skips the cart-name and Today's game cards.

### 5. Matches — the showpiece
Segmented control **Rot 1 | Rot 2 | Rot 3** (defaults to the rotation you're playing; finished rotations show their final state).

- **Your matchup is the hero card, front and center:**
  - Team names and players at each end, yours on the left.
  - **Big point counters** at each end (e.g. `4½` vs `1½`).
  - **Tug-of-war bar of 12 points** (6 holes × 2): your points fill from your side, theirs from the other side, points not yet played sit in the middle. Half points fill half a segment. A dashed line marks the middle; **6½ clinches**.
  - Status line: `6 points left · you need 2 more to clinch`, then `Hogan's Heroes clinched the matchup`, or `Matchup halved 6–6`.
  - Hole strip (7–12, etc.) with two pips per hole (Low Ball, Low Total) colored by who took each point, split for a halve. Tap a hole to see the four scores.
  - When a point lands, the segment slides in and the counter ticks up (skipped if the phone has reduced motion on).
- **The other matchup** is one compact row below with its score and a mini bar; tap to expand it to full size.
- Clinch rule in general: a team clinches when its lead is bigger than the points left (works with ½ or 0 for ties).

### 6. Card
Segmented **Front | Back** (front nine, back nine); a 9-hole grid grouped **by cart** (name · 9 holes · total), so nothing scrolls sideways and nothing breaks when foursomes reshuffle.

- **Your cart always on top** (even if you're cart B or C), then the cart you're playing right now, both expanded.
- **The other two carts start collapsed** to one summary row each, e.g. `Fore Play · thru 9 · +3`. Tap to expand; tap again to collapse. Remembered per phone.
- Someone watching without a name picked sees every cart expanded.
- **This is where you fix past holes.** Tap a cell for any hole where that player was in **your** matchup (on holes 1–6 you can fix the cart you played then; on 7–12, the cart you played then) → an edit sheet slides up: `Hole 4 · Mike · Par 4`, the big score tile, − / +, Clear, Done. Same rules as Enter. Every other cell is view-only; the organizer can edit any cell.
- Enter is for the hole you're on; Card is for corrections and the big picture. (Enter's ◀ arrow also works for going back a hole.)
- Long-press a cell to see who last entered it.

### 7. Host *(organizer's phone only — players never see it)*
Segmented **Rules | Players | Activity**. Edit game rules mid-round, rename teams, add or change strokes, swap a player, correct par / hole handicap, edit any foursome's scores, approve a "let them in" request for any foursome, free up a player's spot, copy the organizer link. Bottom of Rules: **Reset scores** (replay from hole 1 with the same players and phones) and **Delete round** (gone for everyone; other phones show "Round deleted"), each behind a confirm. At the very bottom, collapsed: **Activity** — the audit log (time · who · what), newest first.

**What players would have used a settings page for, and where it lives instead:**

| Need | Where |
|---|---|
| Light / dark | Sun/moon icon in the top bar |
| Picked the wrong name | Tap your name chip → **Leave round** (confirm) → you're watch-only → pick the right name. No direct switching. |
| Share the round | Share icon on Board |

**Sheets:** *who are you?* (name picker; taken names show "in use" and offer "That's me — ask my foursome"), *player detail* (one player's 18-hole line, gross and net).

**Render flow** — no framework; each screen module exports `render(snapshot, ui)`:

```
Supabase ──realtime──► store { event, scores, deviceId, myPlayer, isOrganizer, offlineQueue }
                           │ any change
                           ▼
            scoring.compute(event, scores)  →  snapshot (every derived number)
                           │
            render(activeRoute, snapshot)   →  only the visible screen redraws
```

## 9. Design direction — Sundown base, Flighty-inspired layout, dark by default

- **Base look = Sundown** (`tiniryno-stack/sundown`, `frontend/src/theme.css`): sterile, finance-grade, monochrome shell, one restrained accent, Geist + Geist Mono, light/dark.
- **Layout ideas = Flighty** (screenshots via Mobbin): dark hero with a sheet over it, huge titles, big numeral columns, floating tab bar. Borrow the layout language only, not Flighty's branding, icons or imagery.
- **Dark mode is the default.** Light mode is one tap away (sun/moon in the top bar) for bright sun; the choice is remembered per phone.

### Tokens (Sundown's values)

```css
/* Fonts: Geist (UI + titles), Geist Mono (all scores and points), from Google Fonts
   with system-ui / ui-monospace fallbacks. Numbers also get font-variant-numeric: tabular-nums. */
:root, [data-theme="dark"] {                 /* DEFAULT */
  --hero:#000000;  --bg:#0B0C0E;
  --surface:#16181C; --surface-2:#20232A;    /* sheet, tiles/chips */
  --ink:#ECEEF1; --ink-soft:rgba(236,238,241,.60); --ink-faint:rgba(236,238,241,.36);
  --line:rgba(255,255,255,.09); --line-strong:rgba(255,255,255,.17);
  --accent:#ECEEF1; --accent-ink:#14161A;    /* active tab pill, primary buttons */
  --good:#34C281; --warn:#D6A23E; --bad:#F0564B;
  --sun:#F4C95D;                               /* Sundown's sun: headlines + Lock in / Close it out only */
}
[data-theme="light"] {
  --hero:#0B0C0E;  --bg:#F6F6F4;               /* hero stays dark in light mode too */
  --surface:#FFFFFF; --surface-2:#EFEFEC;
  --ink:#14161A; --ink-soft:#5A5F66; --ink-faint:#9A9FA6;
  --line:rgba(20,22,26,.09); --line-strong:rgba(20,22,26,.15);
  --accent:#14161A; --accent-ink:#FFFFFF;
  --good:#1E9E62; --warn:#A9802F; --bad:#CB4439;
  --sun:#A9802F;
}
:root { --radius-sheet:28px; --radius-card:18px; --radius-chip:12px; }
```

**Type scale:** title 34/800 Geist, tight tracking · section 20/700 · row title 17/600 (connector words like "vs" 17/400) · meta 13/500 `--ink-soft` · big numerals 34/700 Geist Mono · micro labels 11/600 uppercase, +0.06em tracking (`PTS`, `THRU`, `NET`).

### What we're taking from Flighty

| Flighty pattern | How it shows up here |
|---|---|
| **Hero on top, sheet sliding over it** with big rounded top corners | In-round screens: a compact black hero with the at-a-glance info (hole + matchup on Enter, the tug-of-war on Matches, the leader on Board); the `--surface` sheet below holds tiles and lists |
| **Huge, heavy screen titles** | `Leaderboard`, `Matches`, `Scorecard`, `New round`, `Who are you?` |
| **Big numeral column on the left of each row** ("1 DAY", "8 HOURS") | Board: points (`13½` over `PTS`) or to-par (`+5` over `NET`); Season: record |
| **Row anatomy:** small gray meta line, bold title with a lighter connector word, detail line | Board: `Andrew + Sean · thru 12` meta, **Hogan's Heroes** title; Matches: **Hogan's Heroes** vs **Fore Play** |
| **Green = good status** | `--good` for under par, your points, "Clinched", synced. `--bad` only for double bogey+ and errors |
| **Floating glass tab bar** (pill, blurred) **plus a separate round button** | Tab bar: Enter · Matches · Board · Card, active item as a filled `--accent` pill (Sundown's monochrome, not Flighty's blue). **Host** = the separate round button, organizer's phone only |
| **Circular icon buttons** (share, close, avatar) | Close on sheets, share on Board, your-name avatar chip, sun/moon |
| **Filled chips + outline pills** | Setup: filled `--surface-2` chips for Course / Tees / players; outline pills for toggles like "No max on par 3s" |
| **One saturated callout card** (PRO banner) | Headlines and Lock in / Close it out cards use `--sun`, the only warm color in the app |
| **Black launch screen with a dim icon** | Loading: black screen with a dim flag-in-cup silhouette while the round loads |

### Screen-by-screen

- **Enter:** compact hero (≈120px) with `Hole 8` big, `Par 4 · Hcp 7 · Max 8`, and the matchup line; the sheet holds the two cart cards and Next hole. Hero stays compact so the fit-the-screen rule holds on an SE.
- **Matches:** the hero *is* your matchup: names, big counters, and the 12-point tug-of-war bar; the sheet below holds the hole strip and the collapsed other matchup.
- **Board:** hero shows the current leader and `Official thru 9`; the sheet holds the rows.
- **Card, Setup, Season, Host:** plain sheet with a big title, no hero.

**UI patterns** (reference: Mobbin):
- **Floating tab bar** in this order: Enter · Matches · Board · Card; **Host** as a separate round button on the organizer's phone only.
- **Toasts** slide down from the top, one at a time, 3 seconds, tappable. "Let them in" requests use a sticky banner with two buttons instead, until someone answers.
- **Segmented controls** wherever there are 2–4 mutually exclusive options: Board (Teams | Players, Gross | Net), Matches (Rot 1 | Rot 2 | Rot 3), Card (Front | Back), Host (Rules | Players | Activity), Setup game options.
- **Coach marks — two, shown once per phone, tap anywhere to dismiss:**
  1. On the first score tile the first time Enter opens: "The grey number is par. Your first tap on the box makes it par, then + for bogey or − for birdie. Every box needs a score before Next hole." (`glb.coach.tile4`)
  2. On Board, the first time a provisional chip appears: "These points aren't official until the other foursome plays these holes."

Golf-specific rules:
- **Dark by default**; light mode one tap away for bright sun.
- Tap targets ≥ 48px; score tiles ≥ 64px. Primary controls in the bottom half of the screen.
- Scores in big Geist Mono. Under par in `--good` with a circle, bogey in `--ink` with a square, double+ in `--bad` with a double square.
- No hover-only UI; nothing needs two hands.

## 10. Build plan (one-shot order)

1. `supabase/schema.sql` (tables, RLS, write functions) → Andrew runs it in the Supabase SQL editor
2. `scoring.js` + `headlines.js` + tests — pass section 7 examples and scripted scenarios (comeback, streak, and a lead change that only fires when the trailing group posts) before any UI
3. `db.js` — load, device ID + name claim, RPC writes, realtime, offline queue
4. **Design tokens + app shell** (section 9: Sundown tokens, dark default, Flighty-inspired hero + sheet and floating tab bar)
5. Setup screen → creates the round, shows PINs
6. Enter screen
7. Board, Season standings (from Home), Matches, Card, Host, toasts, headlines + "While you were away", "let them in"
8. Fit-the-screen check: every screen at iPhone SE, 13 mini, 15/16 and Pro Max sizes with Safari's toolbar showing — no scrolling, nothing cut off
9. Deploy to GitHub Pages, smoke-test with two phones (one per foursome), including a blocked edit outside your matchup, the hole-7 swap, and a clear-the-browser rejoin

## 11. Setup status

- [x] GitHub repo `tiniryno-stack/golf-live-board` created (public)
- [x] Supabase project `golf-live-board` created (ref `yxreupqzwgjzhfosnjbj`, region us-east-2). URL and publishable key are in `BUILD.md`.
- [x] Apply `supabase/schema.sql` — applied Oct 16 (Andrew ran it in the SQL editor after the connector prompt kept cancelling); verified from the connector
- [ ] Andrew turns on GitHub Pages after the first code push: repo **Settings → Pages → Deploy from a branch → main, / (root) → Save**. Live at `https://tiniryno-stack.github.io/golf-live-board/`
- [x] Design direction set → section 9 (Sundown base, Flighty-inspired layout, dark default)
- [ ] At the course: open Setup, pick Twin Creeks, type names, name teams, drop the link in the group chat, everyone taps their name

## 12. Decisions log

- Halved holes → ½ each (Ryder Cup logic)
- Headline game → Match Play; points accumulate, nothing transfers between teams
- Plus/Minus → zero-sum running total of margins, uncapped by default
- Team score → Low Ball / Low Total (2 pts/hole) default; best ball and aggregate selectable
- Max hole score → double par default; optional no-max on par 3s
- Course → picked from a list (Twin Creeks only for now), never preselected
- Tee times → not needed
- Roster and team names → typed into Setup; "Run it back" reuses them
- Score entry → first tap = bogey; cart cards with your cart on top
- Rotation → carts swap foursomes every 6 holes so each matchup is played in person (default); fixed foursomes is a Setup toggle; matchup order default or shuffled
- Permissions → no player PINs. Join = tap your name; you can edit only your current matchup (your cart + the cart you're playing on that hole); organizer's admin PIN edits everything and settings
- Rejoin → same link, tap your name; if the old phone still holds it, anyone in that foursome taps "Let them in" (organizer as backup)
- Live updates → pushed over a websocket, no refreshing; in-app toasts for other players' scores and highlights
- No settings page for players → light/dark lives in the top bar; organizer gets a Host button via the organizer link
- Wrong name → no switching; **Leave round**, then pick the right name like a new join (claimed names still need "Let them in")
- Handicaps → optional **Strokes** per player, blank = even; literal strokes on the hardest holes; games always use net (identical to gross when nobody has strokes)
- UI patterns → floating tab bar, segmented controls, two coach marks
- Design → Sundown's look and tokens, **dark by default** with a light toggle; Flighty-inspired layout (hero + sheet, huge titles, big numeral columns, floating tab bar); Host as a separate round button for the organizer
- Audit log → v1; one line per write, written by the database functions, shown at the bottom of Host
- Season → V1-lite Season standings (player + pair W-L-H), reachable from Home and the final leaderboard only; never inside a live round. Round history list and deeper stats in V2
- Standings fairness → Board ranks by official points (holes every team has completed); headlines only fire on confirmed scores
- Notifications → 3-second toasts for scores/birdies; sticky headlines (lead change, comeback, streak, matchup/round final) with a "While you were away" card on return
- Matches → hero card for your matchup with big counters and a 12-point tug-of-war bar; other matchup collapsed; tabs ordered Enter · Matches · Board · Card
- Scorecard labels → Front / Back, not Out / In
- Matchup alerts → "Lock in" when you need nearly every remaining point, "Close it out" when this hole can clinch; full-screen card right after tapping Next hole, only for the two carts in that matchup
- Fixing mistakes → Enter's ◀ edits any hole in your current matchup, plus a 5-second Undo after Next hole; Card is for older holes from previous matchups
- Card → grouped by cart; your cart first (always), then current opponent, both expanded; other carts collapsed; tap a cell from one of your matchups to edit it
- Layout → high-yield info never under a scroll (Enter fits entirely, top/tab bars pinned); long pages like leaderboards may scroll; no sideways scroll; portrait only

- Practice rounds → organizer can Reset (clear all scores, keep everything else) or Delete a round from Host (added Oct 16 for test runs before the real round)
- Playtest changes (Oct 16) → see 13a: start on 1 or 10, carts pick team names, jersey colors, team bars, compact player board, 70/30 Enter, blank-tile −/+ steps from bogey, no back button in a round

Still open: nothing blocking. Design direction (section 9) is final.

## 13a. Changes from the Oct 16 playtest (built)

- **Start on hole 1 or 10** (`settings.startHole`, Setup → Course and Host → Rules). Rotations are play-order positions, so starting on 10 the matchups are holes 10–15, 16–18 + 1–3, 4–9; the official line, swap cards, alerts, foursome editing rights (`_same_foursome`) and let-them-in all follow play order. Screens always show real hole numbers.
- **Team names by the carts:** after joining, an unnamed cart gets a full-screen "Name your cart" card with six quick names (Bulbasaur, Charmander, Squirtle, Chikorita, Cyndaquil, Totodile). Either partner can pick; a name another cart has is greyed out and refused by `pick_team_name` (locks the round row). Tap your cart's name on Enter to change it. The organizer can still type names in Setup (team names now sit at the top of the Teams step) or Host.
- **Jerseys:** your own cart is always green on your phone; every other cart has a fixed away color that's the same for everyone — A orange, B blue, C pink, D violet (no red: red means double bogey). Used on Enter, Matches (counters, tug-of-war, pips), Board, Card and Who are you.
- **Board → Teams:** each team gets a bar in its jersey color — solid = official points, hatched = provisional; Plus/Minus bars grow left/right from even. **(Oct 17, final version)** The Board now **ranks on every point won so far** (`liveStandings`), and the big number includes them; the part won on holes the other foursome hasn't played yet is provisional: a "1½ prov." chip by the name (already in the number) and, on the bar, striped past a **divider line** where the confirmed points end. Match Play bar = points ÷ the most points any team could have won so far (max `available`: 2 per hole + each finished matchup's bonus), the same scale for every team, so the longest bar is always first. Hero: live leader, "Leader · official thru 9 + provisional". Coach tip key bumped to `prov2` ("These points already count…"). Headlines (lead changes, comebacks) still fire on the official line — confirmed moments. Final standings/recap are the same either way once all holes are in (the recap's bars use share of points on offer, `officialAvailable`). **Board → Players:** one compact line per player (rank · to par · name + team · thru · total) so all 8 fit on a 15/16 without scrolling; headlines show on the Teams view.
- **Enter, their cart greyed:** 70/30 with the other cart greyed to one row of small scores; tap it for 50/50 to enter their scores, tap yours to go back (see section 3). **Card:** your cart is always the top block, then the cart you're playing.
- **Headlines:** color-coded by the team on the positive end (yours green, others their away color); one at a time on the banner and Board, two only briefly when they land together (see 7.10 display).
- **Today's game:** after you pick your name (and name your cart, if asked), two swipe cards built from the round's settings, then **Let's play** → Enter. Once per phone per round; Skip any time; reopen from the ⋯ menu (watchers too). Card 1, how a hole is scored: game, points per hole (Low Ball / Low Total, or best ball / total), what a push is worth, Plus/Minus cap, a worked par-4 example, net-score note when anyone gets strokes. Card 2, your day: your cart and partner, each rotation's holes and opponent ("other group" in fixed foursomes), points per matchup and on the day, how the day is won, tee off on 10 if so, swap rule, pick-up max. Tiebreakers and other low-yield rules stay out. Watchers see every matchup instead. Fits an iPhone SE without scrolling.
- **Matchup win bonus (Match Play, added mid-round Oct 16):** the winner of each matchup gets **+1** on the Board once all its holes are in; a halved matchup splits it like a pushed hole (½ each, or nothing when ties score nothing). It's official once both foursomes are through the matchup's last hole, provisional before that. Setting `matchBonus` (1 / 0, default 1 so older rounds get it), on Host → Rules and Setup → Game. Counts toward lead-change headlines and Season points. Not used in Plus/Minus. **Board → tap a team:** breakdown sheet with each matchup (holes, opponent, score, status, +1 for the win), the total, and official vs provisional.
- **Par first (after the Oct 16 round):** blank tiles show grey par; the first tap on any button is par, then − / + step. New coach tip.
- **Every box needs a tap (Oct 16, later):** Next hole no longer saves blanks as par. It waits until your whole group has scores ("Next hole · 2 scores left"); a tap while waiting shakes the empty boxes, names who's missing, and opens the other cart if only theirs are missing. Coach tip bumped to `tile4`.
- **Finalize + lock (Oct 16, later):** the organizer finalizes the round from the Board's final card or Host (`finalize_round`, `events.finalized_at`). Every phone then locks — **the organizer's too** — and the server refuses players' score changes. Enter shows **Final** with See the final Board · Round recap · **Fix a score**: on the organizer's phone (PIN already saved) it unlocks in one tap; anyone else gets a PIN sheet. While unlocked, Enter's matchup line reads "Fixing a finalized round · **Done**" (Done locks it again); the unlock is in memory only, so a reload or a re-finalize locks it again. Writes go through `admin_upsert_score`. Host can **Reopen round**; Reset also reopens. Finished rounds (finalized or complete) open on the Board.
- **Add a course (Oct 17):** Setup's Course step searches OpenGolfAPI (name or near me, nearest first) with your group's courses first; the scorecard loads in the background; Save has a scorecard check that blocks gaps (missing hole handicaps, odd pars). Enter-it-yourself for courses it doesn't have. Twin Creeks' OpenGolfAPI card matched ours exactly. Backup route: Supabase function `course-search`.
- **Test with 8 phones (Oct 19):** `sim.html` (laptop page) makes a practice round and shows 8 phones as iframes of the app with `?sim=1…8`; `db.local` prefixes every key with `simN.` so each is its own device (own ID, name, PIN). Phone N is signed in as player N (`claim_player` with that phone's device), phone 1 holds the organizer PIN; join cards and tips are pre-dismissed. **Play a hole** calls each phone's own `setScore` (so `updated_by` is that player), refetches, then taps Next hole / Continue. Practice rounds get their own crew (`crew_id` null → new), so Season standings for the real group are untouched.
- **Hole grid + locked holes:** tap the hole number for a grid of all 18; view any hole you've played; two or more back are locked until you tap the box (see section 3).
- **Round recap:** when the round is final, the Board's top becomes a big tappable card (trophy · winner · "win the day · 39 pts · players" · "Round recap & scorecards →"), replacing the repeated final headline; the ⋯ menu has it too. It opens a swipeable recap of keepsake images drawn on a canvas (`js/screens/recap.js`, no libraries, dark Sundown look, 1080 px wide): **Final leaderboard** (winner, standings with bars, every matchup with its +1), **Your scorecard** (gross / to par / net if you get strokes, front and back nine with birdie circles and bogey squares, birdies-pars-bogeys counts), **Your cart** (both partners, Low Ball / Low Total per hole, your matchups), **Full report** (standings + all 18 holes for everyone, by cart). **Save or share** sends the PNG of the card you're on to the phone's share sheet (Save Image, Messages…), or downloads it on a laptop. Watchers get the leaderboard and full report.
- **Home:** recent rounds are tappable cards with **Open**; "Run it back as a new round" is a small secondary link.
- **Practice rounds:** organizer Reset scores / Delete round (see 5.1).

## 13. V2 backlog (running list)

- **Carryovers (skins-style):** a tied point rolls onto the next hole instead of halving, so the next hole can be worth 3–4 points. Open design question: does an unresolved carry die at the end of a 6-hole rotation, or roll into the next opponent?
- **More courses:** ~~add a course~~ (built Oct 17 via OpenGolfAPI search, see 13a); still open: a shared `courses` table so one group's fixes reach every group (today fixes carry within your group via its past rounds), **scan the scorecard** (photo → AI) and **AI lookup** when OpenGolfAPI lacks a course, both behind a Supabase function holding the AI key; 9-hole courses
- **More teams:** generic N-cart rotations (6 or 8 carts, three-plus foursomes)
- **More games:** skins, Nassau, presses, scramble / alternate shot
- **Round history:** list of past rounds → tap one to see its final board and match cards
- **Deeper season stats:** average gross/net, best round, birdies, head-to-head records between players, crew name
- **Install:** add-to-home-screen (PWA) so it opens like an app
- **Lock-screen notifications** for scores and lead changes while the app is closed (needs add-to-home-screen; pairs with the PWA item)
- **Stronger security:** admin PIN attempt limits, personal accounts
- **GPS yardages (behind a setting, off by default):** `settings.gps` (default `false`, so old rounds are unaffected); the organizer turns it on per round. Ideas, in order:
  1. **Front / middle / back of the green** on Enter, from the phone's location (`navigator.geolocation.watchPosition`; works on iPhone Safari and Android Chrome over HTTPS after the player taps Allow; roughly 3–10 yd outdoors).
  2. **Auto-advance:** notice you're standing on the next tee and offer that hole.
  3. **Mark your ball** to measure a drive.
  - **Limits:** web pages get no location while the phone is locked or the app is in the background, so yardages update only while it's open; GPS costs battery. A PWA install doesn't change this.
  - **Course data is the real work**, not the GPS. Per hole: green outline (front / middle / back come from it), tees, optionally hazards. Three sources:
    - **OpenStreetMap** (free, ODbL — needs an attribution line): `golf=green`, `golf=tee`, `golf=hole` (tee → pin line), `golf=bunker`, `golf=water_hazard`. Coverage is patchy — many courses have only a boundary, few have hole-level detail — so **first check whether Twin Creeks is mapped** (Overpass query for `golf=*` inside the course). If not, we can map it in OSM ourselves (FairwayMapper / iD editor) and everyone benefits.
    - **Map it ourselves in the app:** an organizer-only "map the course" screen over satellite imagery — tap each green's front/back edge and each tee, saved to a `course_geo` table (or the course catalog → table item above). ~20 minutes per course.
    - **Paid data** (iGolf-style providers): tens of thousands of courses mapped by in-house teams, but licensing costs and terms.
  - **Front / back is relative to where you're standing:** draw the line from the player (or the `golf=hole` line) to the green's center; front = where it enters the green outline, back = where it leaves. Pin position isn't known (it moves daily) — same as Garmin, which gives front/middle/back of the green, not the flag; a draggable pin on a green view is the usual fix.
  - **How the big apps do it (Oct 2026 look):** Garmin — 40k+ preloaded courses with front/middle/back, hazard and layup distances; pin not tracked (you mark it on green view); paid Green Contour slopes on ~8.9k courses; users report map errors through Garmin's course page. 18Birdies — 43k+ courses on satellite imagery, a drag-anywhere yardage cursor, 3D greens in Premium; adds missing courses from user-sent scorecards/course maps or a shared Google Map with tee and green pins. Golf GameBook — ~48k courses largely kept up by user reports; GPS map shows distance to the center of the green plus a drag-to-measure target; missing GPS maps come from users sending a course layout. iGolf — 33k+ courses mapped by internal and external mapping staff, the kind of provider apps license from.
