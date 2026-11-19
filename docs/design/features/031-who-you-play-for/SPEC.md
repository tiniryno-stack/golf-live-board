# 031 · Who you play for: one Board, Matches and Setup for every game

Status: handed off Nov 19, 2026. Built: §2.4 standings (8edba84), the cart flags in §2.5 (06caa7c), step 1 the feel (027) + the Standings grow, step 2 Board and Matches by who you play for + the race (display only), step 4 Setup (Game, Teams, Tee times; ends on Start round until the lobby). step 7 coach tips + Switch it up. See ARCHITECTURE.md 13a. Steps 3, 5, 6 wait for Andrew.

**What this is.** The one engineer brief for the Nov 19 redesign, approved by Andrew on the Claude Design canvas. It
decides what the Board and Matches show for every game, redraws the race, moves partner and opponent switching into
2v2's settings in Setup, and turns season standings into a record. It replaces the two drafts that were numbered 031
(One Board) and 032 (Games by player count); those folders are gone.

**Where the work lives.** Branch `claude/friendly-lovelace-g5kzki`, not `main`. `main` has everything through 026
and none of this. Start your branch from `claude/friendly-lovelace-g5kzki`.

**If this file and an older brief disagree, this file wins.** §3 says which parts of 027–030 still stand.

## 1 · Where to look

| What | Where |
|---|---|
| The target screens | `screenshots/NN-name.png` (dark, 393 × 659 @2×). §7 lists all 22. |
| Their markup: exact copy, spacing, classes | `mockups/<key>.dc.html`, styled by `mockups/kit.css`. Class names are mockup names, not app names. |
| The same screens on the canvas, with notes | https://claude.ai/artifact/6d76RhvkedJGkb7R3gM6MR, page “Hand-off · approved screens”. Other pages are archive. |
| Andrew's hand-off page (same content as this file, with pictures) | `docs/design/briefs/index.html` → https://claude.ai/artifact/6vqsiX9291bNpoBccCt8hB |
| The look | `docs/design/design-system/` (rules, `tokens.css`, `components/*/README.md`) |
| Motion values (grow, lit, peek) | `docs/design/features/027-feel/motion.css` + its SPEC.md |

Mockups are reference only: rebuild in the app's own components and tokens. The six type styles and the token list
are enforced by a unit test. No new colors, sizes or type styles; flag anything that needs one. Light mode was not
drawn: it follows the tokens.

Re-render the screenshots: `node docs/design/features/031-who-you-play-for/mockups/shoot.mjs 031-who-you-play-for`
(add `light` for light versions). `mockups/kit.css` is built by `mockups/build-kit.sh` from the design system's
tokens, 027's motion and kit, and `kit-src.css`.

## 2 · What Andrew approved

### 2.1 The rule: who are you playing for?

Partner swap and opponent swap are different games. What the Board and Matches show follows who you play for.

| You play for | How it's set up | Board | Matches | Screens |
|---|---|---|---|---|
| **Yourself** | 2v2, partners switch | Players leaderboard ranked by **stretches won** (points only break ties), your place on top, then “Your matches” | The stretch you're in, one tab per partner | `03`, `04` |
| **Your cart** | 2v2, partner fixed, opponents switch (8 players), or three carts (6) | Carts ranked by points (today's Partner “Rider” Cup scoring), then the live matches | Your match, one tab per opponent / six holes | `05`, `06`, `07` |
| **Your cart, one match** | 2v2, partner and opponents the same all day (a foursome, or each foursome of 8) | The match card: two totals, one bar that fills up. With 8, both matches, yours lit. | The hole calendar: W / L / ½, empty holes outlined, live hole lit | `08`, `09`, `10` |
| **Yourself, no partner** | Everyone alone (2–6) | The leaderboard, nothing above it but a short place headline | **The race** (§2.2) | `11`, `12`–`16` |
| **Nobody, just your score** | Stroke play (any number) | The leaderboard, to par | Your group's last three holes | `17`, `18` |

Team Ryder Cup (16 players) is unchanged.

How today's stored rounds map onto the rows (read from CLAUDE.md's game notes; check it against `js/scoring.js`):

| Stored round | Row |
|---|---|
| `2v2`, `pairSwitch: 'never'` | Your cart, one match |
| `2v2`, `pairSwitch: 'six'` or `'turn'` | Yourself |
| `carts` with 8 players (rotation `six` / `turn`), `carts` with 6 (three carts) | Your cart |
| match play with `settings.solo` (split point), 2–6 players | Yourself, no partner |
| scorecard only | Nobody |
| 8 players, same opponents all 18 | Your cart, one match. **New**, comes with step 3. |
| 8 players, partners switch | Yourself. **New**, see §6. |

Rules for every row:
- **One-match scoring:** each hole is a point (halved = ½ each). One cumulative bar. Its middle line is always half
  the total, labeled with what wins: “9½ to win” over 18, “3½ to win” over a six-hole stretch.
- **Partners switch:** each stretch is its own match. The day goes to whoever wins the most stretches. Points break ties.
- **Headlines are short:** your place (“2nd”) with the detail small beside it (“1 back of Chris”). No giant mono type on words.
- **No hole-by-hole bar on the Board.** The hole calendar lives on Matches.
- **Never two scoreboards.** A mini leaderboard only where the matches under it make up the standings.
- **The glow goes on the one live thing** on each screen (027 `lit`).
- **One decimal** for point totals (4.3).
- **Tap a player** opens the round card the app already has (`js/screens/sheets.js` `player()`), screen `19`. Don't build a new one.
- **Not built yet = “coming soon”** (Scramble, Carries over).

### 2.2 The race (Everyone alone, Matches)

Approved: “yes I like this a lot”. Screens `12`–`16`.
- Kicker “THE RACE · THRU N · M HOLES LEFT”, place headline, table Pos / Player / Pts / Back.
- An **“OUT OF REACH” dashed line** appears only when someone can't catch up (back > holes left). They sit under it.
- A card on top **only when a hole decides something**:
  - early holes: “How it works” (`12`);
  - one hole before you'd be out, amber (`14`): “Hole 15 · you need this one / Lose it to Chris and you're out of reach. / Win or tie the hole and you're still alive.”;
  - the clinch hole, amber (`15`): “Hole 16 decides it · Chris clinches if he wins it alone.”;
  - clinched (`16`): “Chris wins the day. Two holes left. You're playing for 2nd”.
- No bars, no lock number.
- The math is already in pure `js/race.js` (`tests/race.test.mjs`). This replaces the screen from features 002–004, not their math.

### 2.3 Setup: the Game step (screens `01`, `02`)

- The step still says **“Pick a game”**. Game names: **2v2, Everyone alone, Stroke play, Team Ryder Cup**.
- Only the games that fit the player count are listed. Nothing is dimmed.

| Players | Shape line | Games listed |
|---|---|---|
| 1 | `Just you.` | Stroke play |
| 2, 3, 5 | `A twosome.` / `A threesome.` / `Five in one group.` | Everyone alone · Stroke play |
| 4 | `A foursome.` | 2v2 · Everyone alone · Stroke play |
| 6 | `Three carts.` | 2v2 (three carts) · Everyone alone · Stroke play |
| 8 | `Two foursomes.` | 2v2 · Stroke play |
| 7, 9–15 | by tee times | Stroke play |
| 16 | `Four foursomes.` | Team Ryder Cup · Stroke play |

- The picked row grows in place (027) to show its settings. **Switching is a setting inside 2v2:**
  - **Partners:** Keep `all 18` · Switch `every 6` · Switch `at the turn` (4 players). With 8: Keep · Switch `every 6`.
  - **Opponents** (8 players only): Switch `every 6` · Same `all 18`.
  - One hint line under the setting, as drawn.
- The button names the next step: `Next: partners` (4), `Next: carts` (6, 8, 16), `Next: tee times` (no teams).
- “Split point” and “Partner Rider Cup” leave the UI. **Stored game ids and settings do not change** (`carts`,
  `settings.solo`, `settings.pairs`, `pairSwitch`…): old rounds must keep working.
- After it: one Teams step and one Tee times step for every game (brief 030).

### 2.4 Season standings = a season record. **Built** (8edba84)

Screens `20`, `21`, `22`. Every round gives a finishing order; your record is players finished ahead of – behind
(partners never count against each other, ties ½); records add up, so a big round counts for more; ranked by win
rate (.643), 3 rounds to be ranked. Your season peeks at the bottom edge and grows into a card: win rate, four tiles
(best day, game, partner, low round), then every round.

### 2.5 Smaller calls

- **Cart colors off everywhere**, behind `FLAGS.cartColors`. **Built** (06caa7c). Green = you, grey = everyone else.
- **Cart names cut**, behind `FLAGS.cartNames`. **Built** (06caa7c). Carts read “Andrew + Sean”. Brief 029's cart-name row stays off.
- **“Switch it up” card** stays, wherever partners or opponents switch. Once per switch: who you're with and who you're playing now.
- **Coach tips rewritten**, four of them, each once per phone (bump each key's suffix):
  - Enter, first hole: “Tap the score you made. ⋯ has every other score.”
  - Enter, the quiet row: “Tap here to enter scores for the rest of your group.”
  - Matches, first visit: “Tap a hole to see everyone's score on it.”
  - Board, first visit: “Tap a name to see their round.”

## 3 · What stands from the older briefs

| Brief | Status |
|---|---|
| `027-feel` | **Stands.** Grow in place, one lit thing, the next thing peeks, new things at the end. Build first. Known bug: in light mode its `--glow-you: none` breaks the whole `box-shadow`; use `0 0 0 0 transparent`. |
| `028-game-slots` | **Enter stands** (the same Enter for every game). Its Board, Matches and final card are replaced by §2. |
| `029-lobby` | **Stands**, with the game names from §2.3 and without the cart-name row. Needs a database change. |
| `030-setup` | **Teams and Tee times steps stand.** The Game step is §2.3. |

A handed-off folder is never edited (this one too). Record what you build in `ARCHITECTURE.md` 13a and in the status
line at the top of this file.

## 4 · Already built on this branch

- `js/flags.js`: `cartColors: false`, `cartNames: false`.
- `js/teams.js`: `cartDisplayName()`, `displayEvent()` (display only; saved rosters and SQL untouched). Used in
  `js/app.js` before `compute` and `replayHeadlines`. `html.no-cart-colors` in `css/styles.css` greys `--t-A…F`.
- `js/seasons.js`: `roundFinish`, `roundRecord`, `seasonRecordTable`, `seasonBests`, `MIN_ROUNDS = 3`.
  `js/screens/season.js` (table, “3 rounds to be ranked”, the peek, `myCard`), `js/screens/crew.js` (crew card line).
- Tests: `tests/cartnames.test.mjs`, `tests/seasonrecord.test.mjs`. `npm test` = 168 passing.
- Checked against the crew's four real rounds (V4T3M, MDAX3, BSZTH, AMTXQ).
- **Not done on Standings:** nobody has looked at it in the real app yet, and the peek → card is a plain swap, not
  the 027 grow. Do it with step 1.

## 5 · Build order

Each step is its own commit(s). `npm test` after every change. After each step tell Andrew, in plain English, what
changed and what to look at on his phone.

| # | Step | Ask first? |
|---|---|---|
| 1 | **The feel (027):** grow, lit, peek as shared pieces; use the grow on the Standings peek. | No |
| 2 | **Boards and Matches by who you play for (§2.1), the race (§2.2), Stroke play.** Display only. Pick the view from the round's existing settings in one pure function with a unit test, then draw each view. One-match rounds show today's points until step 3. | No |
| 3 | **Scoring:** one match = holes as points with “9½ to win”; Same all 18 for 8 players; partners switch won by most stretches; one decimal. Touches the engine: replay the real rounds through it and recommend a smoke run. | **Yes** |
| 4 | **Setup:** “Pick a game” by player count with Partners / Opponents inside 2v2 (§2.3), one Teams step, one Tee times step (030). | No |
| 5 | **The same Enter for every game (028).** Touches score entry: recommend a smoke run. | **Yes** |
| 6 | **A lobby for every round (029).** Needs SQL: write the migration and its rollback, mirror them in `supabase/schema.sql` and `tests/mock-supabase.mjs`, and give Andrew the snippet to run in the SQL Editor. Nothing destructive. | **Yes** |
| 7 | **Coach tips and “Switch it up”** for partner and opponent swaps (§2.5). | No |

## 6 · Still open: ask Andrew, don't guess

- **The Board, Matches and Setup screens (`01`–`11`, `17`, `18`) were not signed off one by one.** The rule in §2.1,
  the race and Standings were. Build them as drawn and show him; expect notes.
- **8 players switching partners:** Andrew wants any kind of switching supported. Switching across both foursomes
  needs a rule first (tee times would change mid-round). Suggested: ship switching inside your foursome first.
- **How a hole is won in 2v2** (best ball, or low ball + low total) is not on the drawn Game step. As drawn: one
  match = best ball, opponents switch = today's low ball + low total. Keep today's setting where it lives now.
- **Defaults** for Partners and Opponents are not decided. Keep what the app does today.
- **Standings, tapping someone else's row:** the same card as yours (suggested), or a row that opens in place?
- **Standings, moving between seasons:** a pager at the top, or today's dropdown? Keep the dropdown until he says.
- **Not drawn:** the final card for each way of playing (every game ends on Team Ryder Cup's final card, 019, with
  its own winner line), Enter's top line for each, each Board before the first score, Setup for 2 / 3 / 5 / 6 / 7 /
  16 players, Matches for three carts and for 8 players switching partners, light mode. Follow the nearest drawn
  screen and the design system, and show Andrew before going far.

## 7 · The screens

| # | Screenshot | Mockup | Shows |
|---|---|---|---|
| 01 | `01-setup-4-players` | `f-setup4` | Game step, a foursome: 2v2 picked, Partners setting |
| 02 | `02-setup-8-players` | `f-setup8` | Game step, 8 players: Partners and Opponents |
| 03 | `03-partners-switch-board` | `f-sw-board` | Yourself · Board: stretches won, then your matches |
| 04 | `04-partners-switch-matches` | `f-sw-match` | Yourself · Matches: one tab per partner |
| 05 | `05-opponents-switch-board` | `f-rot-board` | Your cart · Board: carts ranked, then live matches |
| 06 | `06-opponents-switch-matches` | `f-rot-match` | Your cart · Matches: one tab per six holes |
| 07 | `07-three-carts-board` | `f-3c-board` | Your cart · Board with three carts |
| 08 | `08-one-match-board` | `f-1m-board` | One match · Board: two totals, one bar, “9½ to win” |
| 09 | `09-one-match-matches` | `f-1m-match` | One match · Matches: the hole calendar |
| 10 | `10-one-match-8-players-board` | `f-8same-board` | One match in each foursome · Board |
| 11 | `11-everyone-alone-board` | `t-alone-board` | Everyone alone · Board |
| 12 | `12-race-after-hole-1` | `r-1` | The race, hole 1: “How it works” |
| 13 | `13-race-at-the-turn` | `r-9` | The race, nothing to decide yet |
| 14 | `14-race-one-hole-from-out` | `r-warn` | The race, the warning |
| 15 | `15-race-hole-decides-it` | `r-15` | The race, clinch hole, someone out of reach |
| 16 | `16-race-clinched` | `r-won` | The race, clinched |
| 17 | `17-stroke-play-board` | `f-stroke-board` | Stroke play · Board |
| 18 | `18-stroke-play-matches` | `t-stroke-match` | Stroke play · Matches: your group's last three holes |
| 19 | `19-tap-a-player` | `b-player-open` | The round card that exists today |
| 20 | `20-standings` | `s-standings` | Standings table (built) |
| 21 | `21-standings-your-season-peeks` | `s-peek-rest` | Your season at the bottom edge (built) |
| 22 | `22-standings-your-season-card` | `p-bd1` | Your season card (built) |

## 8 · How Andrew works

- Design happens on the canvas, he approves, then it's built. Don't add new numbered folders for this work.
- Short, plain-English summaries. He tests on his phone.
- `npm test` only. No smoke suite, fit suite or screenshots unless he asks; say so in one line when a change touches
  score sync, joining, the offline queue, the engine or the database.
- Nothing destructive in the database. No pull request unless he asks. Don't push to `main` without his OK; when
  you do, `npm run stamp` first. `npm run preview` (branch → `/preview/` on the live site) also needs his OK.
