# Golf Live Board — handoff notes for Claude sessions

Read this first. It replaces re-reading the whole repo. `ARCHITECTURE.md` (≈735 lines) is the full
spec: **grep the section you need, don't read it end to end.** Section 13a lists every change made
after the first playtest; section 13 is the V2 backlog.

## What it is / where things stand

- Mobile web app for Andrew's friend group: each foursome enters hole-by-hole scores on their
  phones; everyone sees one live board across tee times, plus a rotating 2v2 cart game
  (Rotation Match Play or Plus/Minus). Sundown design, dark by default, Flighty-inspired.
- Live: https://tiniryno-stack.github.io/golf-live-board/ (GitHub Pages, `main`, root). Repo:
  `tiniryno-stack/golf-live-board`.
- **Played for real on Oct 16, 2026** ("Chucks Bday", code `V4T3M`, Twin Creeks, 8 phones). It
  went well. All BUILD.md stages are done; everything since is playtest-driven iteration.
- Andrew's style: voice-note messages, wants plain-English results, short summaries. When he's
  **mid-round**, replay the live round's data through the new code before pushing (see Testing),
  and never make destructive DB changes.

## Stack and file map

Static site, no build step: plain HTML/CSS + ES modules. supabase-js 2.118.0 (UMD from jsdelivr).

| File | What it does |
|---|---|
| `index.html` | shell, fonts (Geist / Geist Mono from Google Fonts), loads `js/app.js` |
| `js/config.js` | Supabase URL + **publishable** key (browser-safe). Never commit the secret/service_role key or DB password. |
| `js/courses.js` | built-in courses (Twin Creeks: par, stroke index, tees, `ogaId`) |
| `js/coursedata.js` | course search + scorecards from **OpenGolfAPI** (free, keyless, ODbL — show `ATTRIBUTION`): direct from the phone, falling back to the `course-search` Edge Function; pure shaping (`fromOpenGolf`, `scorecardProblems`, `shortCourseName`, distances) |
| `js/scoring.js` | **pure** engine: `compute(event, scores)` → snapshot; play order (start on 1 or 10), rotations, Low Ball/Low Total, halves, clinch, official line, matchup win bonus, standings + tiebreakers, season |
| `js/headlines.js` | **pure**: replays scores by `updated_at` → headlines (each has a `hero` team for color); `latestMoment`; Lock in / Close it out alerts |
| `js/teams.js` | jersey colors (`teamColor`), `headlineColor`, Pokémon quick names |
| `js/db.js` | localStorage helpers, device ID, RPC wrappers (`api.*`), reads, offline queue (latest wins; `fill` flag), realtime subscribe |
| `js/app.js` | router/state, render loop (wrapped in an error boundary → "Something went wrong"), round loading (12 s timeout → "No signal / Try again"), join flow (name → cart-name picker → Today's game), realtime handlers, actions |
| `js/ui.js` | `esc`, `icon` (SVG set), `seg`, formatting helpers |
| `js/screens/*.js` | `enter` (score entry), `matches`, `board` (+ final card), `card`, `host` (organizer), `home`, `setup`, `season`, `sheets` (all bottom sheets incl. hole grid, team breakdown, menu), `toasts` (toasts, banners, full-screen cards, picker, Today's game pager, recap pager, coach tips), `brief` (Today's game content), `recap` (canvas-drawn keepsake PNGs) |
| `sim.html` + `js/sim.js` | **Test with 8 phones** (laptop: 8 side by side; phone ≤700px: one full-size phone + 1–8 switcher, extras under More): makes a practice round (own crew → never in Season standings), 8 iframes `index.html?sim=N`, each its own device signed in as player N (phone 1 = organizer), **Play a hole** (random realistic score per phone, then taps Next hole), one-group-only buttons, reset/delete. `?sim=N` prefixes every storage key with `simN.` (`db.local`, `local.keys()`) |
| `supabase/schema.sql` | **source of truth for the DB**; keep it in sync with what's live |
| `supabase/functions/course-search/index.ts` | Edge Function (deployed, `verify_jwt` off): GET-only backup route to OpenGolfAPI search + one course, our origins only. Redeploy with `deploy_edge_function` after edits |
| `tests/` | unit tests (`*.test.mjs`), `fit-the-screen.mjs`, `smoke.mjs`, `mock-supabase.mjs` (in-memory stand-in mirroring every RPC, plus OpenGolfAPI + the backup route from `fixtures/opengolf.json`: Twin Creeks' real record and fictional test courses; `be.oga.blocked` / `be.oga.down`), `helpers.mjs` |

## Database (Supabase project `yxreupqzwgjzhfosnjbj`, via the Supabase connector)

- Tables: `events`, `event_secrets`, `claims`, `join_requests`, `join_request_devices`, `audit_log`,
  `scores`. RLS: anon may only `select` events / scores / join_requests. **All writes go through
  SECURITY DEFINER RPCs** returning `{ ok, error }`.
- RPCs: `create_event, verify_admin, claimed_players, whoami, claim_player, leave_round,
  request_join, approve_join, deny_join, upsert_score, admin_upsert_score, fill_score,
  update_event, release_player, get_audit_log, reset_round, finalize_round, delete_round, pick_team_name`.
  Helpers `_same_foursome`, `_play_pos`, `_hole_at`, `_join_approver`, `_write_score`, … are not
  executable by anon.
- **Finalize:** `events.finalized_at` (set/cleared by `finalize_round` with the organizer PIN). While
  set, `upsert_score` / `fill_score` / `pick_team_name` return `finalized`; `admin_upsert_score` still
  works, and the app routes organizer writes through it when final. `reset_round` clears it.
- `fill_score` (legacy: the app no longer calls it, kept for older phones' queued fills): one atomic
  insert-or-update-**where strokes is null**, so it never overwrites another phone's score.
- **Applying changes:** additive SQL (`create or replace function`, `grant`) works with
  `apply_migration`. Anything with drop / delete / revoke tends to stall on an approval prompt —
  give Andrew a snippet to run in Supabase → SQL Editor → New snippet instead. Always mirror the
  change in `schema.sql` **and** `tests/mock-supabase.mjs`.
- **Testing against live data safely:** a `do $$ … $$` block that ends with
  `raise exception '…'` (rolls everything back), optionally `set local role anon` to exercise
  RPCs as the browser would. Never read server files or run OS commands via SQL.

## Rules of the game (what the engine does)

- Play order: `settings.startHole` 1 or 10; rotations are **play-order positions** (1–6, 7–12,
  13–18); screens always show real hole numbers ("Holes 16–18, 1–3").
- Match Play: each hole Low Ball 1 pt + Low Total 1 pt (or 1 pt best ball / total); push =
  `halvedHolePoints` (½ default). **Matchup win bonus** `matchBonus` (default 1; halved splits like a
  push; official once both foursomes finish that matchup). Plus/Minus: stroke margins, optional cap.
- Official line = holes every foursome has finished (play order); beyond it is provisional.
- Settings are normalized from `DEFAULT_SETTINGS`, so new settings must default sensibly for old
  rounds.

## UI conventions (don't regress these)

- **Enter:** your cart ~70% with full tiles; the other cart greyed to one slim row of small scores
  ("Tap to enter" → 50/50, yours greyed, "Tap to go back"). Empty box shows a **grey par**; the
  **first tap on any button (−, number, +) = par**, then − / + step. **Next hole** waits until every
  box in the foursome has a score ("Next hole · 2 scores left", greyed); a tap then shakes the
  empty boxes, names who's missing, and opens the other cart if only theirs are blank. Nothing is
  ever auto-saved as par. Name pinned at the top of
  a tile, score dead center level with − / +.
- **Holes:** tap the hole number → grid of 18 (one row per matchup). The current hole and the one
  just finished are editable; **2+ holes back open locked** ("Tap to edit"). Switch it up shows
  once per swap.
- **Jerseys:** your cart is always green on your phone; others fixed away colors A orange, B blue,
  C pink, D violet (no red — red = double bogey). On rounded cards use a tint + full ring, never
  an edge stripe (it clips at the corners).
- No back button inside a round (name pill / ⋯ menu: Round recap when final, How today's game
  works, Share, Go to Home, Switch to watching). Your cart is always first (Card, Matches).
- Headlines: colored by `hero`; one at a time, two for ~10 s when they land together.
- Board → Teams: ranked on **all points won so far** (`g.liveStandings`); big number includes the
  provisional part, shown as a "1½ prov." chip and, on the bar, striped past a divider line (`.cut`).
  Match Play bar = points ÷ max `available` across teams (same scale → longest bar = 1st).
  Headlines still use the official line (holes all 8 finished); the recap uses final standings.
- Board: tap a team → breakdown sheet. When final: big trophy card → **Round recap** (4 canvas
  PNGs: leaderboard, your scorecard, your cart, full report; Save or share via share sheet).
  Organizer gets **Finalize round** under it (also Host → Rules); then the card says `Final · locked`.
- **Setup → Course:** search box, **Your courses** (built-ins + courses from your group's past rounds,
  latest copy wins so fixes stick), **Near you** (location only on tap, or automatically if already
  allowed). Picking loads the scorecard in the background (`s.courseStatus`). **Save** has a
  scorecard check (front/back 9 grid) and won't save gaps (`scorecardProblems`). "Enter the
  scorecard yourself" for missing courses. Search results/location are never saved to the draft.
- **Finalized round:** every phone locks, **the organizer's too**. Enter shows a locked "Final" view
  (See the final Board · Recap · Fix a score). Fix a score → `app.unlockFinal()`: one tap on the
  organizer's phone, the `pin` sheet elsewhere; then Enter says "Fixing a finalized round · Done"
  (Done re-locks). The unlock (`app.ui.finalUnlock`) is in memory only. `app.isFinal()`,
  `app.finalUnlocked()`, `app.roundOver()` (final or every score in), `app.homeTab()`. A round that's over opens on the **Board**, also from an old `/enter` link.
- Never a blank screen; never a coach tip over a sheet / full-screen card.
- All storage goes through `db.local` (never `localStorage` directly) so `?sim=N` test phones stay
  separate. localStorage keys: `glb.device`, `glb.me.CODE`, `glb.admin.CODE`, `glb.recent`,
  `glb.queue.CODE`, `glb.seen.CODE`, `glb.alert.CODE.H`, `glb.switch.CODE.H`, `glb.brief.CODE`,
  `glb.who.CODE`, `glb.cardOpen.CODE`, `glb.coach.{tile4,oppcart2,prov2}`, `glb.setupDraft`,
  `glb.theme`. Bump a coach key's suffix when its text changes so people see the new tip.

## Testing (run before every push; all headless, no network needed)

```bash
npm install
npm test               # 57 unit tests: scoring + headlines + course data (spec examples, bonus, back nine)
npm run test:fit       # 128 checks: every screen at SE / 13 mini / 15-16 / Pro Max, no scroll on Enter
npm run test:smoke     # 169 checks: multi-phone flows against the mock (join, swap, offline, rejoin,
                       # reset/delete, back nine, Next waits for every score, grid/locks, recap,
                       # finalize + PIN unlock, add a course, test phones, blank-screen guards)
```

- Playwright 1.56 with Chromium at `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` (don't run
  `playwright install`; WebKit isn't available). Screenshots land in `tests/screenshots/`
  (git-ignored) — look at them after UI changes.
- The sandbox can't reach supabase.co, OpenGolfAPI or the CDNs (WebFetch can read
  `api.opengolfapi.org` with Andrew's OK); realtime isn't exercised (the mock aborts it;
  the app falls back to refetch-on-return and 20 s polling).
- To check a change against a real round: pull its event + scores with `execute_sql` (read-only),
  seed them into the mock (`be.rpc.create_event` + push rows into `be.tables.scores`), and render.
- When behavior changes, update the affected test expectations and add a test for the new rule.

## Workflow

- Small commits straight to `main`, push after each change (Pages redeploys in ~1 min; phones can
  cache files up to 10 min — tell people to refresh/reopen). End commit messages with the
  attribution lines your session provides.
- Update `ARCHITECTURE.md` (section 3 for Enter, 13a for changes) and `README.md` when behavior
  changes.

## Open items / ideas

- `_setting_label` in the DB doesn't know `matchBonus` (audit log shows the raw key): one-line
  additive migration if wanted.
- The recap images use the viewer's perspective (their cart green); a neutral "everyone's jersey"
  variant could be nicer for group-chat sharing.
- **Add a course, next steps** (Andrew's ideas): scan the scorecard from a photo and AI lookup when
  OpenGolfAPI lacks a course — kicked off at the start of Setup so it's ready by Save; needs an AI
  key in a Supabase function secret (never in the site, never pasted in chat). Not yet confirmed
  whether phones can call OpenGolfAPI directly (CORS) or always use the backup route.
- V2 backlog (ARCHITECTURE.md §13): carryovers, shared courses table, more teams/games,
  round history, deeper season stats, add-to-home-screen (PWA) + lock-screen notifications,
  stronger security (PIN attempt limits), **GPS yardages behind `settings.gps`** (front/middle/back
  from OpenStreetMap or our own course mapping; first step: check if Twin Creeks is in OSM).
