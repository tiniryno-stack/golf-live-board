# 032 · Games by player count

Status: handed off (design), not built.

**What this is.** Setup knows how many are playing when it reaches the Game step, so it shows only the games that fit. Five games become three, plus Team Ryder Cup for 16. How a hole is scored is a setting of the game you pick. Built on **027** (grow in place) and **030** (the step order).

**Canvas (Claude Design):** “Golf Board · briefs 028–032”, page **032 · Games by player count**. `mockups/*.dc.html` are the same artboards (they use `../031-one-board/mockups/kit.css`); `screenshots/NN-key.png` + `-light.png` are 393 × 659 @2×. Re-render with `node docs/design/features/031-one-board/mockups/shoot.mjs 032-games-by-player-count`. Mockups are reference only.

**What this changes** (handed-off folders are never edited, so this says it):
- **030 §1:** the Game step itself (it was “already shared, unchanged”), and the step kickers, which now use the names below.
- **028 §1:** the five-game slot table. Read it through §5 here.
- **029 §2, §4:** the lobby's “Today's game” lines and game slot use the names and lines in §4.
- **Design system:** Game option (no count rule top right, no dimmed rows, a setting that grows inside the picked row) and the README's Games table.

**Decided by Andrew (Nov 18):**
- 2v2 counts **holes up**, best ball by default. Best ball + total stays at 2 points a hole. With a partner switch, each stretch is its own match and the day goes to whoever wins the most.
- Everyone alone stays **2–6 players**.
- **Names say what the game is.** “Split point” and “Partner Rider Cup” leave the app. Team Ryder Cup keeps its name.
- **Scramble and Carries over** are built later. They're drawn as options, marked `later`.
- 8 players, Rotate: **keep today's points scoring.** Same all day: carts ranked by result, then holes up (Board: 031).

---

## 1 · The three games

| Game | What it is | Players | Today |
|---|---|---|---|
| **Everyone alone** | A point a hole to the low net score. A tie for low splits it. | 2–6 | Match play / split point |
| **2v2 with your partner** | Your cart against theirs. Win the hole, go 1 up. Ties push. | 4, 6, 8 | 2v2, Partner “Rider” Cup |
| **Stroke play** | Just the scorecard. Lowest total wins. | any | Scorecard only |
| **Team Ryder Cup** | Two sides of four carts. As is. | 16 | Team Ryder Cup |

## 2 · The Game step: one frame (`01`–`11`)

Top to bottom:
1. Header: `‹ Players`, progress dashes. The dashes follow the pick: 4 steps without teams, 5 with.
2. Kicker (`label`): `Step 3 · Game · 4 players`.
3. Title (`title`): `Pick a game`.
4. **The shape** (`body`, `text-muted`): one line, from the count (§3).
5. **The list:** only the games that fit, as Game option rows. Name in `row`, one `body` line saying what it is, a radio on the right. Nothing is dimmed. “Add 2 more players to play this” is gone.
6. One primary button, named for the next step.

**Order of the list:** Everyone alone, 2v2, Stroke play. At 8 and 16 the team game comes first.

**Nothing picked (`02`):** the first time, no row is picked and the button is disabled: `Pick a game to go on`. If the group's last round with this count used a game that fits, that row starts picked.

**Picked:** the row gets `surface-2` + a 2px `text` outline + a filled radio (Game option, as today) and **grows in place** (027 rule 1) to show its setting. Nothing else on the step changes.

**Switching (`06`):** one `motion-grow`. The old row's setting blurs out and its height folds; the new row's setting sharpens in as it grows. The rows between them move with the height. The button's words change at the start of the motion. Reduced motion: a 150ms cross-fade, no size animation.

**One choice (`11`):** with 1, 7 or 9–15 players only Stroke play fits. The title is `Stroke play`, the row is already picked, and one `body` line says why: `It's the one game that fits 7. Everyone alone needs 2–6 players; 2v2 needs 4, 6 or 8. Add or remove one player to play 2v2.` (1 player: `Just you today.`)

## 3 · Every player count

| Players | The shape line | Rows | Key |
|---|---|---|---|
| 1 | `Just you.` | Stroke play (picked) | – |
| 2 | `A twosome.` | **1v1 match play** · Stroke play | `01` |
| 3 | `A threesome.` | Everyone alone · Stroke play | `02` |
| 4 | `A foursome.` | Everyone alone · 2v2 with your partner · Stroke play | `03`–`06` |
| 5 | `Five in one group.` | Everyone alone · Stroke play | – |
| 6 | `Three carts.` | Everyone alone · **2v2 with three carts** · Stroke play | `07` |
| 7 | `Two tee times, of 4 and 3.` | Stroke play (picked) | `11` |
| 8 | `Two foursomes.` | **2v2 in every foursome** · Stroke play | `08`, `09` |
| 9–15 | `Three tee times.` (by count) | Stroke play (picked) | – |
| 16 | `Four foursomes.` | Team Ryder Cup · Stroke play | `10` |

**The row's words change with the count; the game doesn't:**

| Row | Its line |
|---|---|
| Everyone alone | `A point a hole to the low net score.` |
| 1v1 match play (Everyone alone for 2) | `You against Sean. Win the hole, go 1 up. Ties push.` |
| 2v2 with your partner (4) | `Your cart against theirs. Win the hole, go 1 up. Ties push.` |
| 2v2 with three carts (6) | `Your cart plays the other two carts at once, all 18 holes.` |
| 2v2 in every foursome (8) | `Each cart plays a cart. All four carts on one Board.` |
| Stroke play | `Just the scorecard. Lowest total wins.` |
| Team Ryder Cup | `Two sides of four carts. Cart against cart, a point a match. 6½ wins the cup.` + `The captains draft the sides in the lobby.` (`small`) |

## 4 · What grows inside the picked row

Each setting is a `label` kicker, a Segmented control (two-line segments) and one Hint that changes with the choice.

| Game | Setting | Options | Hint |
|---|---|---|---|
| 2v2 (4, 6, 8) | `A hole is won by` | **Best ball** `low ball` · Ball + total `2 a hole` · Scramble `later` | `Your cart's low net score against theirs.` / `1 point for the low ball, 1 for the low total.` |
| 2v2 for 8 | `Opponents`, above the other | **Same all day** `your tee time` · Rotate `every cart · 6 holes` | `One 18-hole match against the cart you tee off with.` / `You play each of the other three carts for six holes. Points add up over the day.` |
| Everyone alone (3–6) | `A tie for low` | **Splits it** `½ each` · Carries over `later · skins` | `Two tie for low: ½ a point each. Three: ⅓ each.` |
| 1v1, Stroke play, Team Ryder Cup | none | – | The row doesn't grow. |

- **Bold = the default.**
- **Rotate** (`09`) is today's Partner “Rider” Cup, so it defaults to Ball + total, and Best ball's second line reads `1 a hole`.
- **`later` options** are drawn at `peek` opacity and don't respond to a tap. They're in the drawing so the layout is ready; leave them out of the build until they exist.
- With two settings (`08`, `09`) only the first has a Hint, so the step still fits 393 × 659 without scrolling.
- Partners, Switch partners, carts and Matchups stay on 030's Teams step. Rotate keeps 030's optional Matchups row.

**The button:**

| Pick | Button |
|---|---|
| 2v2 for 4 | `Next: partners` |
| 2v2 for 6 or 8, Team Ryder Cup | `Next: carts` |
| Everyone alone, 1v1, Stroke play | `Next: tee times` |

## 5 · The names everywhere else

The Rules sheet, the lobby's “Today's game” (029), Home's round summary and 028's slots use these.

| Round | Name | Today's game, three lines (029 §3) | Enter · the line on top (028 §2.1) | Board top (031) |
|---|---|---|---|---|
| Everyone alone, 3–6 | `Everyone alone` | `1 point a hole to the low net score. A tie for low splits it. Most points after 18 wins.` | `Andrew · 3.3 PTS · 2ND · Chris +1` | bug: leader and you |
| Everyone alone, 2 | `1v1 match play` | `You against Sean. Win the hole and go 1 up. A tie pushes.` | `Andrew · 2 UP · vs Sean` | head to head |
| 2v2 for 4 | `2v2` | `Your cart against theirs. Win the hole and go 1 up. A tie pushes.` | `Andrew + Sam · 1 UP · vs Sean + Jake` | head to head |
| 2v2 for 4, partners switch | `2v2 · partners switch` | `A new partner at the turn. Each nine is its own match. Win the most matches to win the day.` | first hole of a stretch: `Holes 10–18 · with Sam · AS · vs Sean + Jake` | bug: 4 players |
| 2v2 for 6 | `2v2 · three carts` | `Your cart plays the other two at once. A point for the low ball on every hole, against each.` | `Andrew + Sean · 2 UP · vs Chris + Matt` (the first of your two matches; Matches shows both) | bug: 3 carts |
| 2v2 for 8, same all day | `2v2` | `Your cart against the cart you tee off with, all 18. Win the hole and go 1 up.` | `Andrew + Sean · 1 UP · vs Sam + Jake` | bug: 4 carts |
| 2v2 for 8, rotate | `2v2 · opponents rotate` | `You play every other cart for six holes. Low ball 1 point, low total 1 point.` | the same | bug: 4 carts |
| Stroke play | `Stroke play` | `Just the scorecard. Lowest total wins.` | `Andrew · +3 · 3RD · Sam +1` | bug: leader and you |

- **“Match play” means only head to head with holes up:** 2v2, 1v1, a cart against a cart.
- In sentences the game is lower case after the first word: “a 2v2 round”, “Stroke play”.
- Home's summary: `2v2 · Andrew · 2 UP thru 11`, `Everyone alone · Andrew · 2nd, 3.3 pts`.

## 6 · Build notes

- **Old rounds keep working:** the stored game ids don't change (`scorecard`, `match` / `solo`, `2v2`, `carts`, `ryder`). What changes is Setup, the names, and three new rules.
- **Already in the engine, just moved:** a point a hole with ties split; best ball and best ball + total; switch partners; three carts for six; Rotate (= `carts` with `cartRotation`).
- **New engine work:** 2v2 as holes up with a clinch (`3 & 2`) and each partner stretch as its own match; 1v1 shown as holes up; **Same all day** for 8 (two fixed matches, carts ranked by result then holes up). One unit test for each.
- **Later, not in this build:** Scramble (one score per cart, so Enter needs one pad row per cart) and Carries over.
- `scoring.GAMES` / `gameFix` become “games for this count” (§3's table as one pure function, with one test).
- Season standings count only Rotate's points today. This doesn't change that (still open in the briefs).
- **This touches the engine. Worth a smoke run before it ships.**

## Open (my calls; say if you want them changed)

1. **Two players read “1v1 match play”**, not “Everyone alone”. The brief's table says it plays as match play; the row says so too.
2. **Nothing is picked the first time** (button disabled), then the step remembers the group's last game for that count.
3. **Six players:** the row is “2v2 with three carts” and keeps today's scoring, as the brief says.
4. **Rotate defaults to Ball + total**, because that's what the group has played.

| # | key | # | key |
|---|---|---|---|
| 01 | game-2 | 07 | game-6 |
| 02 | game-3-none | 08 | game-8-same |
| 03 | game-4-2v2 | 09 | game-8-rotate |
| 04 | game-4-alone | 10 | game-16 |
| 05 | game-4-stroke | 11 | game-7-one-choice |
| 06 | game-4-switching | | |
