# 032 · Today's game: the rules, played out in front of you

Status: built in c486974 (branch `claude/cool-heisenberg-j444xa`, Nov 20, 2026). Not on `main` yet.

**What this is.** The engineer brief for a new "Today's game" screen. It replaces today's text-only card
(`js/screens/brief.js`) with three or four short animated slides per game. Each slide has one small animation in the
top half and one headline under it. Andrew designed it with Claude over Nov 19–20 and approved the prototype in this
folder.

**The problem it fixes.** The old card read like a pop-up, so people tapped Skip or Let's play without reading it and
started the round not knowing how the game works. Its words were also out of date: it still says Partner "Rider" Cup,
Rotation Match Play and Split point, and describes the old 2-points-a-hole scoring.

**Where the work lives.** This folder is on branch `claude/affectionate-lamport-gp7ecm`. That branch has the latest
`main` plus docs only: no app code has changed. Start your branch from it.

## 1 · Where to look

| What | Where |
|---|---|
| The approved prototype: every game, every slide, the real timing | `prototype.html`. Open it in a browser at phone size. Also at https://claude.ai/artifact/KvicbaVei3LfD45YzdKSfp |
| The target screens | `screenshots/NN-name.png` (dark, 393 × 659 @2×). §7 lists all 31. |
| The look | `docs/design/design-system/` (rules, `tokens.css`, `components/*/README.md`) |
| Motion values (blur swap, lit, peek, grow) | `docs/design/features/027-feel/motion.css` + its SPEC.md |
| Score marks and the bump | `docs/design/features/022-enter-team-rail-and-exact-motion/motion.css`, `js/reward.js` |
| Earlier rounds of exploration (archive, not the target) | `docs/design/prototypes/032-todays-game-motion.html` |

The prototype is reference only. Rebuild it in the app's own components and tokens, the same way 031's mockups were.
It uses only the design system's colors and type sizes; a few weights differ from the six styles, so follow the styles. Its top-bar **Options** button (switch game and team
score) is a prototype control: it does not go in the app.

Re-render the screenshots after changing the prototype: `npm install`, then
`node docs/design/features/032-todays-game/shoot.mjs`.

## 2 · What Andrew approved

### 2.1 The screen

Full screen, from top to bottom:

1. **Top bar.** A label kicker, "Today's game · 2v2" (game names from 031 §2.3), and **Replay** on the right.
   Under it, one thin progress segment per slide; the current one fills over the slide's length.
2. **The animation.** One scene per slide, in a fixed-height area: `clamp(282px, 44vh, 400px)`, full width inside the
   20px gutter.
3. **One headline** (`title`) and **one sentence** (`body`, `text-muted`). They change with 027's blur swap.
4. **Let's play**, the primary button, pinned to the bottom.

The animation and the headline sit together in the vertical middle of the free space, so a tall phone gets even
space above and below instead of a blank strip at the bottom. Andrew chose "one headline". The three-line list in the
older prototype rounds is out.

How it moves:

- Slides play on their own. **Tapping the animation** jumps to the next slide.
- **Let's play** works at any time. There is no Skip button, because Let's play is the skip.
- After the last slide: Replay turns `text`, Let's play bumps once (022's bump), and nothing else moves.
- **Pace.** Andrew asked for everything 10% quicker than the first build. The prototype runs every timer at
  `PACE = 0.9` and sets `--motion-grow` to 270ms on this screen only. Use the timings in §2.4, which already include
  this. Don't change the app-wide token.

### 2.2 The slides for each game

Pick the game with `playFor(snap)` (`js/playfor.js`). Names below are the prototype's examples: use the round's real
display names (§3).

| Game (`playFor`) | Slide 1: who | Slide 2: one hole | Slide 3 | Slide 4 |
|---|---|---|---|---|
| **2v2, same partners** (`oneMatch`, 4 players) | Names sort into "Your side" and "Them". **You and Mike vs Tyler and Sam.** / Same partners, all 18. | Hole by the team score (§2.3) | **First to 9½ wins.** / 18 points out there. Get past halfway and nobody can catch you. (Halfway bar, §2.4. With low ball + total: **First to 18½ wins.** / 36 points out there, two a hole. …) | — |
| **2v2, partners switch** (`partners`) | Same sort, under "Holes 1–6". **You and Mike vs Tyler and Sam.** / For the first 6 holes. | **Your partner's ball counts too.** / Mike's 4 is your side's best. One point to you both. Hole label "Hole 2 · with Mike". | **Partners switch at 7 and 13.** / Every 6 holes is a new set, with a new partner. You play with everyone once. (Partner swap, §2.4.) | **Most sets won takes the day.** / Each set is its own match. Level on sets? Most points wins. (Three tiles Set 1–3: Won with Mike / Lost with Tyler / Won with Sam, then "2 sets won".) |
| **2v2 with 8: 4 carts** (`cart`, 4 teams) | Sort into "Your cart" and "First up", "Holes 1–6". **You and Mike are a cart.** / Four carts of two today. | **A tie splits it.** / Both carts' best is a 3. ½ point each. Short par 3. | **A new cart every 6 holes.** / Some of them are in the other tee time. Nobody moves; the app scores it. (2×2 carts; the opponent lights up in turn: 1–6, 7–12, 13–18.) | **Most points takes the day.** / Every hole against every cart adds to your total. (Bars, four carts.) |
| **2v2 with 6: 3 carts** (`cart`, 3 teams) | Six chips sort into three cart rows: "Your cart", "Cart", "Cart". **Three carts of two.** / You and Mike are a cart. Every cart plays both others. | **Both carts, every hole.** / Your 4 beats Tyler and Sam's 5 and ties Chris and Jake's 4. 1½ points. Six score tiles. | **Most points takes the day.** / Two chances every hole: one against each cart. (Bars, three carts.) | — |
| **Everyone alone** (`alone`) | The row breaks into four separate tiles. **Everyone for themselves.** / No partners today. | **Low score takes the point.** / Your 3 is the lowest. One point. A tie splits it. | **The race.** / Most points wins. Once your lead is more than they can make up, it's locked. (The race's lock line slides from Chris's 4 to 4 + 2 = 6; "Locked · 7 beats 6" lights.) | — |
| **Stroke play** (`stroke`) | Names line up as a list with "E" beside each, like the Board. **Just your score.** / Everyone plays their own ball. | **Every stroke counts.** / Five shots on a par 5. Your card stays level. Result pill "5 on your card · E". | **Lowest total wins.** / The Board shows where you stand, live. (Leaderboard rows swap places as the numbers change: Andrew singled this out as clean.) | — |
| **Team Ryder Cup** (`ryder`) | 16 dots, mixed, sort into two sides of 8; yours ringed. **Two sides of 8.** / Four carts a side. You and Mike are one of yours. | **A new cart every 6 holes.** / Your cart plays three of theirs, one every 6 holes. (Your cart; their cart swaps each stretch.) | **Cart against cart.** / Two hole points every hole: low ball and low total. Most hole points over the 6 holes wins the match. | **6½ wins the cup.** / 12 matches, a point each. Get past halfway and the cup is yours. (12 dots fill W / L / ½; halfway bar at 6; "6½ · Cup won" lights.) |

Partners switching **at the turn** (two sets of 9) uses the partners-switch slides with "at 10" and "two sets of 9".
It is not drawn.

### 2.3 The hole slide

One hole, seen from above, on a small **3D tile**: a rounded slab tilted back in perspective (`rotateX(26deg)`). It
has a raised side edge, a raised fairway and rough, a green with a flag and its shadow, a tee box, two bunkers, and
trees.

- **Shapes:** dogleg, bend, short par 3, long par 5, one per game as in §2.2. Each hole is fitted onto the tile
  automatically, so the fairway, rough and green stay inside its edges (Andrew checked that nothing hangs off).
- **Trees:** placed only where the whole tree, including its shadow and raised side, lands on the tile and clear of
  the hole. Each tree is a cluster of three circles; single circles read as golf balls.
- **Hole label:** "Hole 4 · Par 4" (or "Hole 2 · with Mike", "Hole 1 · vs Tyler + Sam") sits over the tile's top-left
  corner.
- **Shots:** every player's ball flies shot by shot, players a beat apart. A shot rises on an arc (height
  `min(46, 0.42 × distance, room left to the tile's top edge)` in tile units) while a shadow slides along the ground
  under it, and the ball grows slightly at the top. A dotted tracer follows each ball; yours is green and glows. Putts
  (under 30 units) roll along the ground. The last shot drops into the cup.
- **Score tiles** under the tile count each stroke up with a bump.
- **The result:** the winning score fills in (green for your side, `surface-3` for theirs) and the rest fade to peek.
  Andrew rejected outlining the whole row: it clashed with the bogey squares. Then a glowing pill: "+1 to you and
  Mike", "½ point each", "+1 to you", "5 on your card · E", "+1½ points".

**The 2v2 hole follows the round's team score** (Setup → Team score, `settings.teamScore`):

| Team score | What the hole shows |
|---|---|
| Best ball (`bestBall`) | Each side's best score fills in, then the pill. |
| Low ball + total (`bestBallAggregate`) | Two empty slots, "Point 1 · Low ball" and "Point 2 · Low total", sit under the tiles **from the start of the hole**, so people see two points are up for grabs. Once everyone's holed out, they fill in one at a time: "Low ball 4 v 5 · +1 you", then both your scores light up for "Total 10 v 11 · +1 you". A tie reads "½ each" and a loss "theirs", in grey. Headline: **Two points every hole.** / One for the low ball: your best 4 v their 5. One for the low total: your 4 + 6 = 10 v their 11. Both yours. |
| Aggregate (`aggregate`) | Both of your scores fill in, then "+1 to you and Mike · 10 v 11". Headline: **Both scores count.** / Add your two scores. 4 + 6 = 10 v their 11: one point to you. |

Team Ryder Cup always shows low ball + low total, with its own headline (§2.2).

The scores on the hole are a scripted example, not the round's real scores. Keep the prototype's numbers so the rule
always reads the same way.

### 2.4 The other scenes, and timing

All times include the 0.9 pace. "Ease" is 027's `--ease-grow`.

| Scene | What happens | Slide length |
|---|---|---|
| **Names sort** (slide 1) | Name chips (initial in a circle + name; yours green with glow) pop in as one centered row, 108ms apart. Then the cards fade in and the chips slide into their places (620ms, ease), "vs" appears. Kinds: two sides, three cart rows, four separate tiles (alone), a list with values (stroke), 16 dots into two sides (Ryder). | 3,960ms |
| **The hole** | First shot at 450ms, one stroke every 504ms, players 126ms apart, flight 378ms. Result about 360ms after the last ball drops. | (500 + 560 × most strokes + 400 + 2,600) × 0.9; + 1,440ms for low ball + total |
| **Halfway bar** ("9½ to win", "6½ wins the cup") | The line sits at the **middle** of the bar, labelled "Halfway · 9". Your green bar fills to the line (990ms) and holds; theirs fills from the right. At 1.8s yours pushes just past the line (450ms), the line turns green with glow, and the chip "9½ · Clinched" / "6½ · Cup won" lights. Ryder fills the bar one match dot at a time and clinches when it passes 6. | 4,320ms (Ryder 5,040ms) |
| **Partner swap** (partners switch) | Two cards, "Set 1 · holes 1–6" (yours, lit) and "Them". You stay put. At 1.5s Mike's chip slides down and Tyler's slides up next to you; at 3s Tyler and Sam swap. The card label changes to Set 2 / Set 3, and an 18-hole strip under the cards lights the current set. | 4,680ms |
| **Sets won** | Three tiles land 380ms apart, then "2 sets won" (`number-xl`) at 1.4s. | 3,780ms |
| **New cart every 6** | The opponent cart lights in its away color, one per stretch, about 900ms apart; "vs …" under it names it. | 3,960ms |
| **Bars** (most points) | Bars grow and the numbers count up together (1,080ms). | 3,240ms |
| **The race** | Bars count up, the dashed lock line slides from 2nd place's score to 2nd + holes left, then "Locked · 7 beats 6" lights. | 4,140ms |
| **Board** (stroke play) | Rows slide to their new places (500ms, ease) twice, about 1s apart, as the to-par numbers change. | 4,140ms |

### 2.5 Reduced motion

No flights, arcs, sorting or sliding: every scene shows its end state, with a 150ms fade at most. Numbers show their
final value and the blur swap becomes a plain fade. Slides still advance on their own at the same lengths, and tapping
still skips ahead.

### 2.6 Calls Andrew made along the way (not about this screen alone)

- **"Set", not "stretch".** Every 6-hole (or 9-hole) piece of a partners-switch round is a **set** in all UI copy:
  "Set 2 · holes 7–12", "2 sets won", "Most sets won". Grep the screens for user-visible "stretch": Enter's
  "Switch it up" card ("Last stretch: …", "Each stretch is its own match."), 031's Board ("Leaderboard · stretches
  won", `play031.js`), the Rules sheet ("Most stretches won", `sheets.js`), `board.js`, `gameBlurb` in `playfor.js`,
  and coach tips. Code names (`dayBy: 'stretches'`, `stretchesWon`) stay.
- **Partners switch scoring stays as built:** most sets won, points break ties. Andrew asked whether "most sets" and
  "most points" could pick different winners. With 4 players they can't: every way three sets of 6 or two sets of 9
  can go was checked (2,197 and 361 cases), and the most-sets winner always has the most points. No engine change.
- **The halfway line goes in the middle of the bar**, and the bar pushes past it to show the match is clinched.

## 3 · How it plugs in

- **Content.** Replace `briefPages()` in `js/screens/brief.js` with a pure model: `todaysGame(snap, meId)` in a new
  `js/todaysgame.js`. It returns `{ kicker, slides: [{ h, s, scene, args, ms }] }`, chosen by `playFor(snap)`,
  `snap.teams.length` (3 carts) and `settings.teamScore`. Fill in the real names:
  - **2v2:** you, your partner and your opponents for the first stretch (`sideOn` / `pairView`).
  - **4 carts:** your cart, then the other three in rotation order.
  - **3 carts:** all three carts.
  - **Everyone alone and Stroke play:** you plus up to three others from your tee time.
  - **Team Ryder Cup:** the sides from `roster.sides`.

  One unit test (`tests/todaysgame032.test.mjs`): each `playFor` value gives the right slide count, game name and
  headlines, and real names replace the examples.
- **The pager.** `showBrief` / `brief-next` / `brief-done` in `js/screens/toasts.js` become the new full-screen
  player: top bar, scene area, headline, Let's play, Replay, tap to advance. Keep it a full-screen card in the
  overlay root, so 024's rule still holds: no coach tip over it.
- **Scenes.** One small drawing function per scene kind, in a new `js/screens/todaysgame.js`. The hole is SVG
  (`viewBox 0 0 353 172`) inside a wrapper with `perspective: 700px`.
- **Seen flag.** `glb.brief.CODE`, as today.
- **When it shows.** Today it never opens on its own: since 029 every round has a lobby, and the join code in
  `js/app.js` returns before `maybeBrief()` whenever `app.lobby()` is set. It only opens from the lobby's "How today's
  game works" (`lb-how`, `lb-howday`) and ⋯ → How today's game works (`sheets.js`). **Ask Andrew** (§6). Suggested:
  automatically once per phone, the first time the player opens the round after scoring is open (before Enter), plus
  both buttons as today.
- **Old rounds.** `playFor` → `legacy`: keep today's text card for those.

## 4 · New patterns to flag (no new colors, sizes or type styles)

- **The 3D tile illustration** (slab, perspective tilt, trees, shadows) is a new illustration style. It is drawn only
  from `surface-1/2/3`, `bg`, `line`, `text`. In light mode the trees use `surface-2` (`--tree`), because `surface-3`
  is white there.
- **More than one glowing thing on a screen** (your ball, your tracer, the winning score, the result pill). The design
  system says one lit thing per screen; Andrew asked for more of "the glowy green" here. Dark mode only, as usual.
  The SVG glow is a blur filter (`--svg-glow: url(#gl)`, `none` in light).
- **Story-style progress segments** (3px, `surface-3` → `text`): not a component yet.
- **Name chips that sort into cards** (a FLIP-style move between two layouts).
- **Screen-local pace** (`PACE 0.9`, `--motion-grow: 270ms` on this screen only).

## 5 · Build order

Each step is its own commit(s). `npm test` after every change. After each step, tell Andrew in plain English what to
look at on his phone.

| # | Step | Ask first? |
|---|---|---|
| 1 | `js/todaysgame.js` (pure model) + its unit test, with the new copy for every game. | No |
| 2 | The player: full-screen layout, progress segments, tap to advance, Replay, Let's play, reduced motion. Wire it to the old content first so it works end to end. | No |
| 3 | The scenes other than the hole: names sort, halfway bar, partner swap, sets won, new cart every 6, bars, race, board, Ryder sides and matches. | No |
| 4 | The hole: the tile, shapes fitted to it, trees, shots with arcs and shadows, the three team-score results. | No |
| 5 | "Set" for "stretch" in every user-visible string (§2.6). | No |
| 6 | When it opens on its own (§3). | **Yes** |

Nothing here touches score sync, joining, the offline queue, the engine or the database, so no smoke run is needed.
Step 6 changes the join sequence slightly: say so when you get there.

## 6 · Still open: ask Andrew, don't guess

- **When it opens on its own** (§3). Today it never does on lobby rounds.
- **The team score choice for 4-player 2v2.** Setup only offers Best ball / Low ball + total / Aggregate for cart
  games; new 4-player 2v2 rounds are locked to best ball (031 step 3). Andrew said all three are game options. Does
  4-player 2v2 get the choice back? That changes "9½ to win" (18½ with two points a hole) and the engine's
  `holePoint` setup.
- **More than 4 players in Everyone alone or Stroke play.** The slides show you + 3. Suggested: you + your tee time.
- **Light mode** was not reviewed.
- **Not drawn:** partners switching at the turn, three carts with low ball + total, 8 players switching partners
  (still "coming soon"), old rounds. Follow the nearest drawn slide and show Andrew.

## 7 · The screens

All 393 × 659 @2×, dark. 01–27 are each slide at rest; 28–31 catch a motion part-way.

| # | Screenshot | Shows |
|---|---|---|
| 01 | `01-2v2-who` | 2v2 same partners · names sorted into sides |
| 02 | `02-2v2-hole-best-ball` | The hole · best ball · +1 to you and Mike |
| 03 | `03-2v2-first-to-9-and-a-half` | Halfway bar · 9½ clinched |
| 04 | `04-2v2-hole-low-ball-and-total` | The hole · low ball + total · both slots filled |
| 05 | `05-2v2-hole-aggregate` | The hole · aggregate · 10 v 11 |
| 06 | `06-2v2-first-to-18-and-a-half` | Halfway bar with two points a hole |
| 07 | `07-partners-who` | Partners switch · who, holes 1–6 |
| 08 | `08-partners-hole` | Your partner's ball counts too |
| 09 | `09-partners-switch` | Partner swap · set 3 |
| 10 | `10-partners-sets-won` | Most sets won takes the day |
| 11 | `11-carts-who` | 4 carts · your cart, first up |
| 12 | `12-carts-hole-tie` | Short par 3 · ½ each |
| 13 | `13-carts-new-cart` | A new cart every 6 holes |
| 14 | `14-carts-most-points` | Most points · four carts |
| 15 | `15-three-carts-who` | 3 carts · three rows |
| 16 | `16-three-carts-hole` | Both carts, every hole · +1½ |
| 17 | `17-three-carts-most-points` | Most points · three carts |
| 18 | `18-alone-who` | Everyone alone · four tiles |
| 19 | `19-alone-hole` | Low score takes the point |
| 20 | `20-alone-race` | The race · locked |
| 21 | `21-stroke-who` | Stroke play · the list, all E |
| 22 | `22-stroke-hole` | Long par 5 · 5 on your card |
| 23 | `23-stroke-board` | Lowest total wins · rows reordered |
| 24 | `24-ryder-sides` | Team Ryder Cup · two sides of 8 |
| 25 | `25-ryder-new-cart` | A new cart every 6 holes |
| 26 | `26-ryder-hole` | Cart against cart · low ball + total |
| 27 | `27-ryder-cup` | 6½ wins the cup |
| 28 | `28-motion-names-arrive` | Names popping in as a row, before they sort |
| 29 | `29-motion-ball-in-flight` | Shots in the air: arcs, shadows, tracers |
| 30 | `30-motion-bar-holds-at-halfway` | The bar holding at the line before it pushes past |
| 31 | `31-motion-partners-swapping` | Mike and Tyler mid-swap |

## 8 · How Andrew works

- Short, plain-English summaries; he tests on his phone and often sends voice notes.
- `npm test` only. No smoke suite, fit suite or screenshots unless he asks; say so in one line when a change touches
  score sync, joining, the offline queue, the engine or the database.
- A handed-off folder is never edited (this one too). Record what you build in `ARCHITECTURE.md` 13a and in the
  status line at the top of this file ("Status: built in <commit>").
- Nothing destructive in the database. No pull request unless he asks. Don't push to `main` without his OK; when you
  do, run `npm run stamp` first. `npm run preview` (branch → `/preview/` on the live site) also needs his OK.
