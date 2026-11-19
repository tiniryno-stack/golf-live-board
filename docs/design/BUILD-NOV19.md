# Build hand-off · the Nov 19 redesign

Read this before building any of the new Board / Matches / Setup / Standings work. It is the one place that says
what Andrew approved on Nov 19, 2026, where the drawings are, what is already built, and what to build next, in order.

**Where the work lives.** Branch `claude/friendly-lovelace-g5kzki` (not `main`). `main` has everything through
handoff 026 and none of this. Start a new branch from `claude/friendly-lovelace-g5kzki`.

**If this file and a brief disagree, this file wins.** Briefs 027–030 were handed off before the redesign; 031 and
032 are drafts that were never approved. Section 3 says which parts of each still stand.

## 1. Where to look

| What | Where |
|---|---|
| The decisions, with pictures (Andrew's review page) | `docs/design/briefs/index.html`, section `#agreed` and `#skip`. Published: https://claude.ai/artifact/6vqsiX9291bNpoBccCt8hB |
| Reference images (dark, 393 × 659 @2×) | `docs/design/briefs/agreed/*.png` |
| Mockup markup for every screen (HTML + the CSS it uses) | `docs/design/canvas-nov19/*.dc.html` + `kit.css`. Open the markup to read exact copy, spacing and classes. |
| The live canvas (all four passes, with Andrew's comments) | https://claude.ai/artifact/6d76RhvkedJGkb7R3gM6MR, page “Fourth pass · who you play for” |
| The look | `docs/design/design-system/` (rules, `tokens.css`, `components/*/README.md`) |
| Motion values (grow, lit, peek) | `docs/design/features/027-feel/motion.css` and its SPEC.md |
| Mockup-only CSS added for these screens | `docs/design/features/031-one-board/mockups/kit-031.css` (class names are mockup names, not app names) |

Mockups are reference only: rebuild in the app's own components and tokens. The six type styles and the token list
are enforced by a unit test; no new colors, sizes or type styles. Flag anything that needs one.

To re-render a mockup: copy its `.dc.html` into `docs/design/features/<tmp>/mockups/`, write `order.json`
(`[["file.dc.html","name"]]`), run `node docs/design/features/031-one-board/mockups/shoot.mjs <tmp>`.

## 2. What Andrew approved

### 2.1 The rule: who are you playing for?

Partner swap and opponent swap are different games. What the Board and Matches show follows who you play for.

| You play for | How it's set up | Board | Matches | Images |
|---|---|---|---|---|
| **Yourself** | 2v2, partners switch (a foursome, or 8) | Players leaderboard ranked by **stretches won** (points only break ties), your place on top, then “Your matches” | The stretch you're in, one tab per partner | `f-sw-board`, `f-sw-match` |
| **Your cart** | 2v2, partner fixed, opponents switch (8 players), or three carts for 6 | Carts ranked by points (today's Partner Rider Cup scoring), then the live matches | Your match, one tab per opponent / six holes | `f-rot-board`, `f-rot-match`, `f-3c-board` |
| **Your cart, one match** | 2v2, partner and opponents the same all day (a foursome, or each foursome of 8) | Ryder-style match card: two totals, one bar that fills up | The hole calendar: W / L / ½, empty holes outlined, live hole lit | `f-1m-board`, `f-1m-match`, `f-8same-board` |
| **Yourself, no partner** | Everyone alone (2–6) | The leaderboard, nothing above it but a short place headline | **The race** (2.2) | `t-alone-board`, `r-*` |
| **Nobody, just your score** | Stroke play (any number) | The leaderboard, to par | Your group's last three holes | `f-stroke-board`, `t-stroke-match` |

Team Ryder Cup (16 players) is unchanged.

Rules that apply to all of them:
- **One-match scoring:** each hole is a point (halved = ½ each). One cumulative bar. Its middle line is always half
  the total, labeled with what wins (“9½ to win” over 18).
- **Partners switch:** the day goes to whoever wins the most stretches. Points break ties.
- **Headlines are short:** your place (“2nd”) with the detail small beside it (“2 back of Chris”). No giant mono type on words.
- **No hole-by-hole bar on the Board.** The hole calendar lives on Matches.
- **Never two scoreboards.** A mini leaderboard only where the matches under it make up the standings.
- **The glow goes on the one live thing** on each screen (027 `lit`).
- **One decimal** for point totals (4.3).
- **Tap a player** opens the round card the app already has (`js/screens/sheets.js` `player()`), image `b-player-open`. Don't build a new one.
- **Not built yet = “coming soon”** (Scramble, Carries over).

### 2.2 The race (Everyone alone, Matches). Approved: “yes I like this a lot”

Images `r-1`, `r-9`, `r-warn`, `r-15`, `r-won`.
- Kicker “THE RACE · THRU N · M HOLES LEFT”, place headline, table Pos / Player / Pts / Back.
- An **“OUT OF REACH” dashed line** appears only when someone can't catch up (back > holes left). They sit under it.
- A card on top **only when a hole decides something**:
  - early holes: “How it works”;
  - one hole before you'd be out (amber): “Hole 15 · you need this one / Lose it to Chris and you're out of reach. / Win or tie the hole and you're still alive.”;
  - clinch hole (amber): “Hole 16 decides it · Chris clinches if he wins it alone.”;
  - clinched: “Chris wins the day. Two holes left. You're playing for 2nd”.
- No bars, no lock number. (The “to catch” bar was tried and rejected as confusing.)
- The math is already in pure `js/race.js` (tested in `tests/race.test.mjs`); this replaces features 002–004's screen, not their math.

### 2.3 Setup (images `f-setup4`, `f-setup8`)

- The step still says **“Pick a game”**. Game names: **2v2, Everyone alone, Stroke play, Team Ryder Cup**, shown by
  player count (brief 032's table).
- **Partners** (Keep all 18 / Switch every 6 / Switch at the turn) and **Opponents** (Switch every 6 / Same all 18)
  are **settings inside 2v2**. Opponents only shows with 8 players.
- “Split point” and “Partner Rider Cup” leave the UI. **Stored game ids and settings do not change** (`carts`,
  `settings.solo`, `settings.pairs`, `pairSwitch`…): old rounds must keep working.
- Then one Teams step and one Tee times step for every game (brief 030).

### 2.4 Season standings = a season record. **Built** (commit 8edba84)

Images `s-standings`, `s-peek-rest`, `p-bd1`. Every round gives a finishing order; your record is players finished
ahead of – behind (partners never count against each other, ties ½); records add up, so a big round counts for
more; ranked by win rate (.643), 3 rounds to be ranked. Your season peeks at the bottom edge and grows into a card:
win rate, four tiles (best day, game, partner, low round), then every round.

### 2.5 Smaller calls

- **Cart colors off everywhere**, behind `FLAGS.cartColors`. **Built** (06caa7c). Green = you, grey = everyone else.
- **Cart names cut**, behind `FLAGS.cartNames`. **Built** (06caa7c). Carts read “Andrew + Sean”. Brief 029's cart-name row stays off.
- **Warning before you're out of reach:** yes (the amber card in 2.2).
- **“Switch it up” card** stays, wherever partners or opponents switch.
- **Coach tips rewritten**, four of them (bump each key's suffix):
  - Enter, first hole: “Tap the score you made. ⋯ has every other score.”
  - Enter, the quiet row: “Tap here to enter scores for the rest of your group.”
  - Matches: “Tap a hole to see everyone's score on it.”
  - Board: “Tap a name to see their round.”

## 3. What stands from the briefs

| Brief | Status |
|---|---|
| `027-feel` | **Stands.** Grow in place, one lit thing, the next thing peeks, new things at the end. Build first. Known bug: in light mode its `--glow-you: none` breaks the whole `box-shadow`; use `0 0 0 0 transparent`. |
| `028-game-slots` | **Enter stands** (same Enter for every game). Its Board, Matches and final card are replaced by section 2. |
| `029-lobby` | **Stands**, with the new game names and without the cart-name row. Needs a database change. |
| `030-setup` | **Teams and Tee times steps stand.** The Game step is section 2.3. |
| `031-one-board` | Draft, superseded by section 2. Don't build from its SPEC.md. Its `mockups/` folder holds the mockup kit and `shoot.mjs`. |
| `032-games-by-player-count` | The by-player-count table stands. “How a hole is scored as a setting” is replaced by Partners / Opponents inside 2v2. |

A handed-off folder is never edited. When a step below is built, write what was built in `ARCHITECTURE.md` 13a and
set the status line of the brief it finishes.

## 4. Already built on this branch

- `js/flags.js`: `cartColors: false`, `cartNames: false`.
- `js/teams.js`: `cartDisplayName()`, `displayEvent()` (display only; saved rosters and SQL untouched). Used in
  `js/app.js` before `compute` and `replayHeadlines`. `html.no-cart-colors` in `css/styles.css` greys `--t-A…F`.
- `js/seasons.js`: `roundFinish`, `roundRecord`, `seasonRecordTable`, `seasonBests`, `MIN_ROUNDS = 3`.
  `js/screens/season.js` (table, “3 rounds to be ranked”, the peek, `myCard`), `js/screens/crew.js` (crew card line).
- Tests: `tests/cartnames.test.mjs`, `tests/seasonrecord.test.mjs`. `npm test` = 168 passing.
- Checked against the crew's four real rounds (V4T3M, MDAX3, BSZTH, AMTXQ).
- **Not done on Standings:** nobody has looked at it in the real app yet, and the peek → card is a plain swap, not
  the 027 grow. Do it with step 1.

## 5. Build order

Each step is its own commit(s). `npm test` after every change. Tell Andrew in plain English what changed after each step.

1. **The feel (027):** grow, lit, peek as shared pieces; apply the grow to the Standings peek. Display only.
2. **Boards and Matches by who you play for (2.1), the race (2.2), Stroke play.** Display only: pick the view from
   the round's existing settings in one pure function (with a unit test), then draw each view. No engine changes yet,
   so one-match rounds can show today's points until step 3.
3. **Scoring:** one-match = holes as points with “9½ to win”; “Same all 18” for 8 players; partners-switch won by
   most stretches; one decimal. Touches the engine → replay the real rounds through it and **recommend a smoke run**.
4. **Setup:** “Pick a game” with Partners / Opponents inside 2v2 (2.3), one Teams step, one Tee times step (030).
5. **Same Enter for every game (028).** Touches score entry → **recommend a smoke run**.
6. **A lobby for every round (029).** Needs SQL: write the migration + rollback, mirror in `supabase/schema.sql` and
   `tests/mock-supabase.mjs`, and give Andrew the snippet to run in the SQL Editor. Nothing destructive.
7. **Coach tips and “Switch it up”** for partner and opponent swaps (2.5).

Ask Andrew before starting steps 3, 5 and 6. Steps 1, 2, 4 and 7 can go without asking.

## 6. Still open (ask Andrew, don't guess)

- **Fourth-pass screens** (`f-*` Boards, Matches, Setup) were not approved one by one. The rule in 2.1, the race and
  Standings were. Build them as drawn and show him; expect notes.
- **Tapping someone else's row in Standings:** the same card as yours (suggested), or a row that opens in place?
- **Seasons:** a pager at the top (image `s-peek-pager`) or today's dropdown?
- **8 players switching partners across both foursomes:** needs a rule (tee times would change mid-round).
  Suggested: ship switching inside your foursome first.
- **Not drawn:** the final card for each way of playing, Enter's top line for each, each Board before the first
  score, Setup for 2 / 3 / 5 / 6 / 7 / 16 players, Matches for three carts and for 8 players switching partners,
  light mode. For these, follow the nearest drawn screen and the design system, and show Andrew before going far.

## 7. Which mockups are current

In `docs/design/canvas-nov19/`:
- **Current:** `f-setup4`, `f-setup8`, `f-sw-board`, `f-sw-match`, `f-rot-board`, `f-rot-match`, `f-3c-board`,
  `f-1m-board`, `f-1m-match`, `f-8same-board`, `f-stroke-board`, `t-alone-board`, `t-stroke-match`, `r-1`, `r-9`,
  `r-warn`, `r-15`, `r-won`, `s-standings`, `s-peek-rest`, `p-bd1`, `b-player-open` (the sheet as it is today).
- **Dropped, kept for the record only:** `Main`, every `b-*` except `b-player-open`, `o-*`, `g-*`, every other
  `t-*`, `f-race-a…g`, `s-player`, `s-form`, `s-peek-open`, `s-peek-pager`, `p-ladder`, `p-story`, `p-h2h`,
  `p-best`, `p-bd2`.

## 8. How Andrew works

- Design happens on the canvas, he approves, then it's built. Don't add new numbered brief folders for this work.
- Short, plain-English summaries. He tests on his phone.
- `npm test` only. No smoke suite, fit suite or screenshots unless he asks; say so in one line when a change touches
  score sync, joining, the offline queue, the engine or the database.
- Nothing destructive in the database. No pull request unless he asks. Don't push to `main` without his OK; when
  you do, `npm run stamp` first. `npm run preview` (branch → `/preview/` on the live site) also needs his OK.
