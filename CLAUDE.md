# Golf Live Board — handoff notes for Claude sessions

Read this first. It replaces re-reading the whole repo. `ARCHITECTURE.md` (≈735 lines) is the full
spec: **grep the section you need, don't read it end to end.** Section 13a lists every change made
after the first playtest; section 13 is the V2 backlog.

## What it is / where things stand

- Mobile web app for Andrew's friend group: each foursome enters hole-by-hole scores on their
  phones; everyone sees one live board across tee times, plus the rotating 2v2 cart game
  **Partner “Rider” Cup** (Rotation Match Play or Plus/Minus; 8 players in 4 carts, or 6 in 3). Night Round design (docs/design/design-system), dark by default.
- Live: https://tiniryno-stack.github.io/golf-live-board/ (GitHub Pages, `main`, root).
  **Preview of a work branch:** `npm run preview` copies the branch's app files to `main` under
  `/preview/` → https://tiniryno-stack.github.io/golf-live-board/preview/ (live app untouched; same
  database and same phone storage as the live site, so make practice rounds and delete them). Repo:
  `tiniryno-stack/golf-live-board`.
- **Played for real on Oct 16, 2026** ("Chucks Bday", code `V4T3M`, Twin Creeks, 8 phones). It
  went well. All BUILD.md stages are done; everything since is playtest-driven iteration.
- Andrew's style: voice-note messages, wants plain-English results, short summaries. When he's
  **mid-round**, replay the live round's data through the new code before pushing (see Testing),
  and never make destructive DB changes.

## Night Round redesign (Oct 21, live on `main`)

- Design handoff in `docs/design/` (`HANDOFF.md`, `designspec.md` = product rules, `screens/` = mockups,
  `design-system/` = the look, `BUILD-PLAN.md` = the current build plan + open items). First pass built
  on `design/night-round`, merged to `main` Oct 21 (both real rounds replayed through the new engine
  first: identical results). The second handoff (design system, Home, sheets, empty states) is being
  built on `design/design-system`.
- **012 (Oct 22, live):** the dock is the only thing that glows in dark mode (`--shadow-dock`, from the design
  system's tokens.css → `npm run tokens`); Matches = score card (`.m-card`: kicker `standingLine()` "THRU 4 · YOU'RE
  UP 2", score, bar, points-left line) with the hole table on the background. **011 + 013 (green card on Enter,
  rotation strip gone)** built Oct 22, card behind `FLAGS.gps` — see Open items.
- Tokens in `css/styles.css` `:root` (dark + light): `--bg/--surface/--surface-2/--surface-3`,
  `--good` (me) + `--good-ink` (green text), `--warn` amber (warnings only), `--bad` + `--dbl-bg`
  (double bogey only), jerseys `--t-A…F`. Score marks everywhere: `ui.mark(score, par, size)`.
  `ui.seg2` (2-line segments), `ui.foldIn(app.ui)` (fold animation only right after a tap — the
  render loop redraws constantly), `.mine-bar` / `.watch-box` = expand-in-place.

## Design
- All UI follows docs/design/design-system/ (README.md rules, tokens.css variables, components/*/README.md).
- Product rules live in docs/design/designspec.md; mockups are in docs/design/screens/ (reference only, rebuild in our components).
- New features: reuse existing components and tokens; no new colors, sizes or type styles. Flag anything that needs a new pattern.
- In this repo: CSS uses the design system's token names (`--surface-1`, `--text-muted`, `--cart-you`,
  `--radius-xl`, `--space-4`…; older names are aliases until `BUILD-PLAN.md` retires them). Check a UI
  change with `npm run design:compare` → `tests/screenshots/design/vs-*.png` (mockup left, app right).
  Light/dark toggle: Home + round ⋯ menu only.

## Design handoffs
- New features arrive as docs/design/features/NNN-name/. SPEC.md is the source of truth; screenshots show the target; mockups are reference only.
- A feature folder is never edited after it's handed off. Changes come as a new numbered folder that says what it changes.
- When I attach NNN-name.zip, unzip it into docs/design/features/ and build it: plan first, then build on a branch, then commit.
- Follow docs/design/design-system/. No new colors, sizes or type styles; flag anything that needs a new token or pattern.
- When a feature is done, set its SPEC.md status to "Status: built in <commit>".
- Don't run the full test suite or take screenshots after small changes; run only the tests for what changed. I test on my phone.

## Home screen app (Oct 21)

- iPhone gives a home screen app (standalone, no Safari bars) **its own storage**, so it starts as
  a new phone. Home (iPhone Safari only) has **Add to Home Screen** → `db.moveLink()` puts this
  phone's keys in the link (`#move=<base64 JSON>`: `glb.device`, `me.*`, `admin.*`, `recent`,
  `theme`, `brief.*`, `who.*`, `coach.*`, `seen.*` — not the queue or setup draft), iPhone saves
  that link with the icon, and `db.moved` (runs in db.js before `deviceId`) copies them in on the
  home screen app's first open, then clears the link. Safari ignores `#move=` (a mis-sent link does
  nothing for a friend); a home screen app that already has a `glb.me.*` ignores it too. Closing the
  sheet clears the hash. **No web manifest**: a manifest `start_url` would replace the saved link.
- `db.STANDALONE` → `html.standalone` → the tab bar / setup footers / sheets sit inside the home
  line's safe area instead of leaving it blank. Tests force it with `window.__GLB_STANDALONE` /
  `window.__GLB_IOS`. Icon: `icon-180.png` (apple-touch-icon), name "Golf Board".
- iPhone bug: the home screen app's page is ~one status bar shorter than the screen (blank strip at
  the bottom, under sheets too). app.js sets `--app-h` = real screen height; `.standalone .app` and
  the fixed overlay roots use it. Host's Save bar only shows when something changed.

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
| `js/names.js` | **pure**: `splitName`, `fullName`, `nameKey`, `displayNames` (first names; "Andrew D." on a clash) |
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
  `scores`, and (Oct 21) `crews`, `people`, `crew_members` — no anon access at all; kept in sync with
  every roster by trigger `events_sync_crew` → `_sync_crew()` (skips `settings.practice`; a clashing
  full name never blocks a round). RLS: anon may only `select` events / scores / join_requests. **All writes go through
  SECURITY DEFINER RPCs** returning `{ ok, error }`.
- RPCs: `create_event, verify_admin, claimed_players, whoami, claim_player, leave_round,
  request_join, approve_join, deny_join, upsert_score, admin_upsert_score, fill_score,
  update_event, release_player, get_audit_log, reset_round, finalize_round, delete_round, pick_team_name,
  crew_people, person_name_check`.
  Helpers `_same_foursome`, `_play_pos`, `_hole_at`, `_join_approver`, `_write_score`, … are not
  executable by anon.
- **Finalize:** `events.finalized_at` (set/cleared by `finalize_round` with the organizer PIN). While
  set, `upsert_score` / `fill_score` / `pick_team_name` return `finalized`; `admin_upsert_score` still
  works, and the app routes organizer writes through it when final. `reset_round` clears it.
- `fill_score` (legacy: the app no longer calls it, kept for older phones' queued fills): one atomic
  insert-or-update-**where strokes is null**, so it never overwrites another phone's score.
- **A player's own entry wins (Oct 21, branch `design/design-system`):** `upsert_score` refuses to change
  or clear a score the player entered on their own phone (`updated_by` = their name) when someone else
  sends a different number → `{ ok: false, error: 'own_entry', strokes, updated_by }`; the app takes their
  number and toasts why. The player can always change it; `admin_upsert_score` still overrides.
  **Live since Oct 22** (migration `own_entry_wins_and_setting_labels`, with the `_setting_label` additions).
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
- **Games (Oct 21):** Scorecard only (any count, `autoGroups`), Match play 2–6 (`solo`, jerseys A–F),
  **2v2** (`settings.pairs` + `pairSwitch` never/six/turn: `pairView` makes one team per pairing with
  `members`; `game.people` = each player's summed points; `sideOn()` = your pair on a hole),
  **Partner “Rider” Cup** (game id `carts`; 8 = 4 carts, `cartRotation('six'|'turn', opps)`,
  `rotationMode` fixed = keep tee times = new default; **6 = 3 carts**, `threeCartRotation()`: one
  18-hole rotation with A v B, A v C, B v C at once, groups A + B / C, always fixed; a cart has two
  matches per hole, so use `matchesFor()`; `matchFor()` returns the first).
- **Small groups:** any roster that isn't 4 carts of 2 is a scorecard round (no teams).
  With 2–6 players, `settings.solo` = **split point** (`game.type 'splitPoint'`): 1 point a hole to the
  low net score, ties for low split it 1/k; level after 18 → **most outright wins** (`rankStandings`), still level = shared. Teams A–D are made in `soloView`, so Host can switch it on
  mid-round and it recounts from hole 1. Matches tab = **The race** (feature 002-matches-race, 2–6 players): math + headline copy in pure
  `js/race.js` (lock line = 2nd + holes left, locked when the lead beats it, OUT, reach tails), tests in
  `tests/race.test.mjs`; explainer shows for the first 6 holes. Bottom card (feature 003-race-bottom):
  **Points by hole** (`holeShares`) or **What this hole does** (`holeOutcomes`, shown per `showStakes`: hole 16+,
  13+ within 1, or this hole could lock it); no tap action.
- **Crews + people (Oct 21):** a crew = a friend group (`events.crew_id`; Andrew wants the word
  "crew", not "league"). A person = `personId`, with first + last name (+ nickname when that full
  name is taken; unique app-wide). Roster players carry `firstName`/`lastName`/`nickname`; `name` is
  the display name (`names.displayNames`: first name, "Andrew D." when two share it). Season shows
  full names; a nickname shows only when two people share the exact full name (placeholder "e.g.
  Tini Ryno", Andrew's gamer tag — keep it). **Live since Oct 21** (1 crew, 9 people, last names
  backfilled into `people` and both rounds' rosters). Old rounds
  only have `name` — everything must still work with that.
- Settings are normalized from `DEFAULT_SETTINGS`, so new settings must default sensibly for old
  rounds. **Tee times (Oct 21):** `settings.teeTimes` (`"HH:MM"` per group, default `[]`), set in
  Host → Rules; say them with `teeTimeName()` ("8:40 tee time" / "1st tee time"), never "Group 1".

## UI conventions (don't regress these)

- **Enter (team game):** your cart's players as stacked rows (− · score mark · +, 88px / 112px on tall
  screens, shrinking by height tiers; ≥48px on an SE); the other cart = one slim row + Edit (then
  theirs is the card and yours the slim row with Back). **Individual (no carts):** "you first" hero
  card + compact rows with where each score came from + one-tap pad (`pad-toggle` / `pad-pick`,
  jumps to the next player waiting). Empty box shows a **dashed ghost par**; the
  **first tap on any button (−, number, +) = par**, then − / + step. **Next hole** waits until every
  box in the foursome has a score ("Next hole · 2 scores left", greyed); a tap then shakes the
  empty boxes, names who's missing, and opens the other cart if only theirs are blank. Nothing is
  ever auto-saved as par. Name pinned at the top of
  a tile, score dead center level with − / +.
- **Holes:** tap the hole number → grid of 18 (one row per matchup). **No swiping between holes**
  (design system, Oct 21): ◀ ▶ and the grid only. Swipe right = back in Setup; swipe down closes a sheet. The current hole and the one
  just finished are editable; **2+ holes back open locked** ("Tap to edit"). Switch it up shows
  once per swap.
- **Jerseys:** your cart is always green on your phone; others fixed away colors A orange, B blue,
  C pink, D violet (no red — red = double bogey). On rounded cards use a tint + full ring, never
  an edge stripe (it clips at the corners).
- **Tab bar (Oct 21, feature 001-tab-bar):** full-width glass bar, icons only, 4 equal tabs, one
  `surface-3` highlight that slides (`.tab-hl`), built once in `renderTabbar` and updated in place; the
  screen title says where you are (Hole N · MATCHES · Board · Scorecard); Enter dot = your group's hole still
  missing scores. Host is no longer a button beside it: ⋯ → **Host settings · organizer**.
- No back button inside a round. Name pill / avatar → short **You** sheet (Go to Home, Switch to
  watching); ⋯ → round actions (Recap when final, Rules, How today's game works, Share, Theme, Run it back). Your cart is always first (Card, Matches).
- Headlines: colored by `hero`; one at a time, two for ~10 s when they land together.
- Board → Teams: ranked on **all points won so far** (`g.liveStandings`); big number includes the
  provisional part, shown as a "1½ prov." chip and, on the bar, striped past a divider line (`.cut`).
  Match Play bar = points ÷ max `available` across teams (same scale → longest bar = 1st).
  Headlines still use the official line (holes all 8 finished); the recap uses final standings.
- Board: tap a team → breakdown sheet. When final: big trophy card → **Round recap** (4 canvas
  PNGs: leaderboard, your scorecard, your cart, full report; Save or share via share sheet).
  Organizer gets **Finalize round** under it (also Host → Rules); then the card says `Final · locked`.
- **Setup (designspec §6):** screens `course → which? → players → (check) → game → teams → matchups`,
  `s.screen`, back button in the app top bar (`screen.topBack`). Games by count: `scoring.GAMES` /
  `gameFix`; `s.game` scorecard | match | 2v2 | carts. Start (`setup-save`) with a broken card opens
  the Scorecard check. Multi-course club: `coursedata.splitCourses` → "Which course?" → saved as
  `oga:<id>#N`, name "Club · Label".
- **Setup → Course:** search box, **Your courses** (built-ins + courses from your group's past rounds,
  latest copy wins so fixes stick), **Near you** (looked up as soon as Setup opens; the phone asks once).
  A course ≤1 mi away goes on top as **Looks like you're at** (`hereCourses`, max 3, your copy wins). Picking loads the scorecard in the background (`s.courseStatus`). **Save** has a
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
  `glb.who.CODE`, `glb.cardOpen.CODE`, `glb.coach.{tile5,oppcart3,prov2}`, `glb.setupDraft`,
  `glb.theme`. Bump a coach key's suffix when its text changes so people see the new tip.
  `glb.recent` entries also carry Home's summary for each round (`recent.note`, from
  `home.roundSummary`: game, your name, live hole / place / points, or how it went).

## Testing (all headless, no network needed)

**How much to run (Andrew, Oct 21):** `npm test` (seconds) after every change. UI-only work: one
`FIT_SIZE=393x852 npm run test:fit` (iPhone 16 size only) per batch; no screenshot reviews unless Andrew
asks: he tries the app and reports back. `npm run test:smoke` only when a change touches score
sync, joining, the engine or the database, and once before anything merges to `main`.

```bash
npm install
npm test               # 95 unit tests (incl. race.test.mjs, seasons.test.mjs): scoring + headlines + course data + names/crews + games (2v2, at the turn, 6-player match play, Partner “Rider” Cup for 6, tee times) + score marks + design tokens (drift, retired colors, type scale)
npm run test:fit       # 160 checks: every screen at SE / 13 mini / 15-16 / Pro Max, no scroll on Enter
npm run test:smoke     # 272 checks (incl. crews): multi-phone flows against the mock (join, swap, offline, rejoin,
                       # reset/delete, back nine, Next waits for every score, grid/locks, recap,
                       # finalize + PIN unlock, add a course, which course?, names/nicknames/crew-mates, you-first pad,
                       # matches expand in place, 2v2, 3 carts for 6, own entry wins, Add to Home Screen move, test phones, blank-screen guards)
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

- Small commits straight to `main`, push after each change (Pages redeploys in ~1 min). **Run `npm run stamp`
  before every push to `main`** (commit `version.json`): index.html's loader fetches `version.json` uncached and
  loads that version's JS/CSS via an import map + `?v=`, so phones (home screen apps too) get the update on
  the next open instead of running cached files. `npm run preview` stamps its own copy. End commit messages with the
  attribution lines your session provides.
- Update `ARCHITECTURE.md` (section 3 for Enter, 13a for changes) and `README.md` when behavior
  changes.

## Open items / ideas

- **Crews (features 006–009, Oct 22, branch `design/crews`):** crew card on Home (`screens/crew.js`: start / rename /
  join `#/crew/<INVITE>` / Which one are you? / settings sheet), owner = the phone that started it (rename, reset
  link, new season, remove player); `db.crews` keeps this phone's crews (`glb.crews`, `glb.crew`); Quick players in
  Setup (chips, regulars, search, guests); Standings by season (`js/seasons.js`, pure + tested; first season is
  implicit from the first round; points = Partner Rider Cup until the standings rework); usual cart names per pair
  + 151 Pokémon. Handicap numbers on crew screens behind `FLAGS.crewHandicaps` (off). **Merged to `main` and live
  Oct 22** (DB migration applied in parts, verified with a rollback test; `supabase/migrations/2026-10-22-crews-step2.sql`).
- **Crews roadmap (agreed Oct 21, step 1 built):** 2) crew name + invite link + "Start a crew",
  3) seasons = date ranges per crew (standings default to the current one), 4) Players step: recent
  groups as one-tap chips + ~8 frequent players + search within the crew, 5) team names reserved per
  pair **within a crew** + the first 151 Pokémon (`TEAM_NAME_PICKS`). Keep UI changes small until the
  Claude Design setup redesign lands.
- **Design open items, decided Oct 21** (docs/design/BUILD-PLAN.md §8–9): the cart game is
  **Partner “Rider” Cup** (built, quotes on purpose) with a **3-carts-for-6** version (built);
  **a player's own entry wins** over one entered for them (DB rule); scorecard-check cells keep the
  keypad; optional **tee times** per round (`settings.teeTimes`, else "1st tee time"); the Rules sheet
  shows the round's real settings. Naming a course in "Which course?" is remembered per group (shared
  courses table = V2). "Start now, finish the card during the round" not built.
- **Split point played for real Oct 20** (Bridlewood, 3 players, switched on mid-round). Worked;
  Andrew may want some optimization later but asked for no changes for now.
- The recap images use the viewer's perspective (their cart green); a neutral "everyone's jersey"
  variant could be nicer for group-chat sharing.
- **OpenGolfAPI coverage (checked Oct 19):** 25 of 29 courses in Flower Mound / Plano / Richardson /
  Garland / Dallas have full cards (pars + hole handicaps + tee ratings); no green coordinates
  anywhere. Multi-course clubs (Bear Creek, Dallas Athletic Club, Firewheel, Tenison, Sherrill Park,
  Indian Creek) are one listing with extra holes mixed in (`fromOpenGolf` takes the first row per hole
  number) — idea: warn "this club has more than one course, check the card". Search rows use
  `course_name`, `lat`/`lng`, `distance_mi` under `courses`; `completeness` is 0 everywhere (useless).
- **Near me on iPhone:** "blocking location" = Safari Websites location off in iOS Settings, or the
  site's aA → Website Settings → Location. The app now lists those steps + Try again.
- **Add a course, next steps** (Andrew's ideas): scan the scorecard from a photo and AI lookup when
  OpenGolfAPI lacks a course — kicked off at the start of Setup so it's ready by Save; needs an AI
  key in a Supabase function secret (never in the site, never pasted in chat). Not yet confirmed
  whether phones can call OpenGolfAPI directly (CORS) or always use the backup route.
- V2 backlog (ARCHITECTURE.md §13): carryovers, shared courses table, more teams/games,
  round history, deeper season stats, add-to-home-screen (PWA) + lock-screen notifications,
  stronger security (PIN attempt limits).
- **GPS yardages (Oct 22): built behind `FLAGS.gps` (off).** Andrew's priority: "if it's not a good golf app,
  people won't use it." Decisions + source plan in `docs/design/yardages/NOTES.md` (OSM greens first, AI-traced
  satellite for the rest, long-press / organizer fixes; shared `course_geo` table + Edge Function = next).
  What's built (features 011 + 013): `js/geo.js` (pure: front/middle/back along the line of play from a green
  outline, `greenSvg` with the three bands), `js/geodata.js` (Twin Creeks' 18 greens from OpenStreetMap, keyed by
  course id + `oga:` id; OSM numbers the nines the other way round, renumbered), `js/gps.js` (one `watchPosition`,
  only while Enter is open + visible; states off/finding/ok/weak(>±15 yd)/denied; `app._gps._fake()` for tests),
  `js/screens/greencard.js` (card + badge; hidden when no green data, `settings.gps` off, or > 600 yd away),
  Enter: card under the hole header, name row hidden (`screen.hideTop`), course name in the subtitle (team) /
  GPS badge (individual, and team when finding/weak), **Regular/Compact picked by measuring** the pads in
  `enter.mount` (compact when they'd shrink under 88px; never under 80px), Host → Rules "GPS yardages" pill,
  `_setting_label('gps')` in schema.sql (**not yet applied to the live DB**: additive `create or replace`). Fit
  test has "Enter (GPS card)" scenes with Playwright geolocation at the tee. To turn on: `FLAGS.gps = true`, stamp,
  push. **Flag ON since Oct 22 (testing).** Dev check page: `docs/design/yardages/geo-check.html` (also published as an
  artifact). **Test from home:** open the app at `#geotest=lat,lng` once → every course's greens slide so hole 1's
  green sits there (`db.geoTest`, this phone only; course name shows "(test)"); `#geotest=off` clears it.
  **013 also removed the rotation strip from team Enter (live).**
- Other open items (Oct 22): standings rework (ELO-style across games, needs design), `FLAGS.crewHandicaps`
  off until Andrew asks, practice rounds HXPY4 / B5PGH to delete in-app, neutral recap images,
  "hasn't entered" chip (awaiting handoff), multi-course club warning, merged branches
  `design/race-tabbar` + `design/crews` can be deleted.
