# 031 · One Board

Status: handed off (design), not built.

**What this is.** One Board for every game: one top card, one switch, one list, one Players table, one final card, and one color rule. It comes from the Game Screens page (`docs/design/games/`, Nov 18), which found four different tops, four switch labels, two Players tables, three sheets and three color rules. Built on **027** (grow in place, lit, one hero fact) and drawn with **032**'s games.

**Canvas (Claude Design):** “Golf Board · briefs 028–032”, page **031 · One Board**. `mockups/*.dc.html` are the same artboards; `screenshots/NN-key.png` + `-light.png` are 393 × 659 @2×. Re-render with `node docs/design/features/031-one-board/mockups/shoot.mjs 031-one-board`. Mockups are reference only.

**What this changes** (handed-off folders are never edited, so this says it):

| Folder | Was | Now |
|---|---|---|
| 028 §4, `17`–`22` | The leader card: leader's name in their cart color, points in `number-xl`, list rows with cart-colored numbers and bars | **The score bug** (§1) or the **head-to-head card** (§2). No bars, no cart colors. |
| 028 §4, `23` | A tapped row grows into three stat tiles + last 3 holes | **The player card** (§5): the round hole by hole. |
| 028 §5, `26`–`31` | Winner line in the winner's cart color | Winner line in `text`; `cart-you-text` only when it's you (§6). |
| 028 §4 | Standings / Players in every game but Scorecard | Standings / Players **only where the game has matches** (§3). Needs Andrew's OK, see Open. |
| 027 `04`, `05` (grow open) and 028 `02` | The other cart's card and rows in its cart color | Plain `surface-1`, names in `text` (§7, `13`). |
| 029 `09`–`11`, 030 `01`–`05`, `15`, `16` | Cart cards tinted in cart colors | Your cart `tint-you` + `cart-you`; every other cart `surface-1` with a `line` outline. Same layout. |
| 018 | Partner “Rider” Cup keeps cart colors | It doesn't (§7). |

---

## 1 · The score bug (`01`–`05`, `07`–`10`)

The top card of every Board where three or more carts or players are ranked. A hero card: `surface-1`, `radius-2xl`, `shadow-card` in light.

Top to bottom:
1. **Kicker** (`label`, `text-muted`): `Leaderboard · official thru 9` left, `9 left` right.
2. **The fact**: one `number-xl`, with two lines beside it (`row`, then `body` `text-muted`). This is the one hero fact on the Board (027 rule 2).
3. **Column heads** (`label`): `Pos · Cart / Player · <score> · Thru`.
4. **Rows**, 40px: position (mono `body`, `text-muted`), name (`row`), score (mono 17/700), thru (mono `body`, `text-muted`). **Your row is `cart-you-text`.** Every other row is `text`.

**The fact, by game:**

| You are in | Fact | Beside it |
|---|---|---|
| A points or strokes field, behind | `6` | `back of 1st` / `Mike + Tyler lead` |
| The same, leading (`04`) | `2` in `cart-you-text` | `ahead of 2nd` / `Chris + Matt are next` |
| The same, tied for 1st | `T1` in `cart-you-text` | `level with Chris` / `4 holes left` |
| A holes-up match of your own (`03`, `07`) | your match: `1 UP` (`cart-you-text`), `AS` or `2 DN` (`text-muted`) | `on Sam + Jake` / `2nd of 4 carts` |
| Before the first score (`05`) | your tee time, `8:40` | `your tee time` / `No scores yet` |

Green on the fact only when you're winning, as 028 §2.1.

**The score column and the rows, by game:**

| Game (032's names) | Rows | Score column | Ranked by |
|---|---|---|---|
| 2v2 for 8, rotate (`01`) | all 4 carts | `Pts` | points (today's Rider Cup scoring) |
| 2v2 for 8, same all day (`03`) | all 4 carts | `Match`: `4 UP`, `1 DN`, `AS`; when done `3 & 2` | result (won, halved, lost), then holes up |
| 2v2 with three carts (`04`) | all 3 carts | `Pts` | points |
| 2v2 for 4 with a partner switch (`07`) | all 4 players | `Won` (matches won) and `Up` (holes up, all matches added) in place of Thru | matches won, then holes up |
| Everyone alone, 3–6 (`08`) | **the leader and you** | `Pts` | points |
| Stroke play (`09`) | **the leader and you** | `To par` | to par |

- **Carts are named by their two players** (`Mike + Tyler`), never a cart name (Andrew, Nov 18).
- **Why two rows:** where every player is their own team, the Players table right under the bug already ranks everyone. So the bug shows only the leader and you. If you lead: you and 2nd. If you're tied with the leader: both rows read `T1`.
- Ties show as `T2`. Under par is `text`, never red (red is double bogey).
- **Split point totals use one decimal** (`4.3`, `1.8`) everywhere on the Board. A single hole still says `½` or `⅓` (§5). Needs Andrew's OK, see Open.
- **Before the first score (`05`):** no zeros. The rows list the carts (or players) with their tee time in the last column.
- **Fit:** the bug, the switch and your row show without scrolling at 393 × 659. The list under it scrolls.

## 2 · Head to head (`06`)

When the whole game is one match, the top card is left against right, like the cup card. Used by **2v2 for 4 with no partner switch** and **1v1** (2 players).

- Kicker centered: `Thru 11 · 7 left`.
- Left: your names stacked, `cart-you-text`, `your cart` under them (1v1: your name, `you`). Right: theirs in `text`, `their cart`.
- Middle: the match in `number-xl`: `2 UP` (`cart-you-text`), `AS` or `1 DN` (`text-muted`). When it's over: `3 & 2`.
- **Hole bar:** 18 segments in two nines. Won = `cart-you`; lost = `text-muted`; halved = half and half; not played = outlined in `line`; **the live hole is the one lit thing** (027 rule 3).
- No switch. The Players table sits right under the card.

## 3 · The switch and what's under it

| Game | Switch | Standings shows | Players shows |
|---|---|---|---|
| Team Ryder Cup | Standings · Players | rotation strips (built) | Players table (built) |
| 2v2 for 8 or 6, and 2v2 for 4 with a switch | Standings · Players | **live matches** (§4) | Players table |
| 2v2 for 4 (one match), 1v1 | none | – | Players table |
| Everyone alone, Stroke play | none | – | Players table |

The rule: the bug shows the game's standings; the list under it never repeats them. So “Standings” is the matches behind the standings, and a game with no matches has no switch.

## 4 · Live matches (`01`, `03`, `04`, `05`, `07`)

Team Ryder Cup's rotation header and Match row, as built, for every game with matches. No new component.

- Header: `Holes 7–12 · live` + `thru 3`. **Your live rotation's header is the one lit thing.** Done: `Holes 1–9` + `done`. Not started: `up next`.
- Row: two carts, first names stacked, yours `cart-you-text`. The flag hangs on the side that's up (`1 UP`), centered when level (`AS`), `3 & 2` when done, the tee time (dashed) before it starts.
- 2v2 with a partner switch: one header per stretch (`Holes 1–9`, `Holes 10–18`).
- Three carts: one header, three rows (A v B, A v C, B v C).
- Tap a row → it grows into that match's hole strip (028 §4, unchanged).

## 5 · The Players table and the player card (`02`, `06`, `08`, `09`, `10`)

**The table** is Team Ryder Cup's, in every game: `Player · Thru · Gross · Proj · Net`.
- Gross is to par (`+3`). Net shows only when the round has handicaps.
- Everyone alone adds `Pts` as the first column.
- Finished players show `F` under Thru.
- Your row is `cart-you-text`. No jersey dots, and each name is printed once.

**Tap a player → the row grows in place** (027 rule 1) into the player card (`10`). It replaces 028's stat tiles, the points-by-hole sheet and the scorecard sheet.
- Head: name (`row`), `3 won · 3 split` (`small`), `Scorecard ›` (opens Card on that player), `Close`.
- **The round:** two rows of nine tiles. Each tile: hole number (`label`), the score mark, and what the hole earned (`1`, `½`, `⅓`, `·` for nothing). Holes not played are outlined. Stroke play shows no earned line.
- **Tap a hole:** it gets the 2px `text` outline, and its line shows under the tiles: `Hole 11 · par 3 · won it alone`, then everyone's score on it.
- One open at a time. The row is `surface-2`, `radius-lg`.

The brief called this a “player sheet”. 027 keeps sheets for side tasks, so it's a grown row with the same content.

## 6 · The final card (`11`, `12`)

019's final card for every game. Nothing sits above it, so the winner shows once.

| Game | Winner line (`title`) | Number (`number-xl`) | Sub line |
|---|---|---|---|
| A field of carts (`11`) | `Mike + Tyler win` | `24` | `points · 2½ ahead of you, in 2nd` |
| 2v2 for 8, same all day | `Mike + Tyler win` | `5 & 4` | `the biggest win of the day` |
| Head to head, you win (`12`) | `You win` (`cart-you-text`) | `3 & 2` | `Andrew + Sam beat Sean + Jake` + the hole bar |
| Head to head, you lose | `Sean + Jake win` | `3 & 2` | `over Andrew + Sam` |
| Everyone alone | `Chris wins` | `5.3` | `points · 6 holes won outright` |
| Stroke play | `Sam wins` | `73` | `+1 · 2 better than Jake` |
| Shared | `Chris and Andrew` | `4.3` | `each · level on holes won too` |

- The winner line is `text`. It's `cart-you-text` only for `You win`. No colored border.
- “wins” for one person, “win” for a pair. Pairs are written with `+`.
- 2v2 crowns what the Board ranks: the pair (one match) or the player (partner switch), never a pairing's points.
- Under the card: organizer's **Finalize round**, then the switch (if the game has one), the final standings (the bug's rows, with `W-L-H` in place of Thru for carts) and the Players table.

## 7 · Color: green is you, everyone else is not colored (`13`)

- On Enter, Matches, the Board, the lobby, Setup and the final card, in every game: your cart or you = `cart-you` / `cart-you-text`. Everyone else = `text`, `text-muted`, `surface-1`, `line`.
- `cart-a` … `cart-f` and `tint-a` … `tint-d` are no longer used on these screens. They stay in the recap images for now.
- Carts are told apart by their players' names.
- `13`: Enter with the other cart grown open (027 rule 1). Their card is plain `surface-1`; your folded row keeps the green rail.

## 8 · Design system changes (flagged)

- **New component: Score bug** (§1). Tokens and type styles only.
- **Players table** and **Match row** become shared components, not Team Ryder Cup's.
- **Leaderboard row** retires once this is built.
- README “Color”: the two-side rule (“no cart colors”) becomes the rule for every game. README “Games” table: rewrite with 032's names.
- No new color, size or type style.

## 9 · Build notes

- **027's `motion.css` has a light-mode bug:** `--glow-you: none` makes the whole `.lit` box-shadow invalid, so the outline disappears too. Use `0 0 0 0 transparent` (as `mockups/kit-031.css` does).
- The bug reads existing state: `liveStandings` / `game.people` / `rankStandings`; to par from the snapshot. One pure function, e.g. `bug(event, snap, me)` → `{ kicker, fact, cols, rows }`, with one unit test covering each row of §1's table.
- “Same all day” ranking and 2v2 holes-up are new engine work (032). The rest is display only.
- Fixes the five bugs listed on the Game Screens page (names printed twice, 2v2's wrong winner, “Chris win the day”, the winner shown twice, `&` for pairs).
- No database change. Board only, so no smoke run needed for this folder on its own.

## Open (my calls; say if you want them changed)

1. **Jersey colors come off everywhere** (the Game Screens page's lean, not marked decided).
2. **One decimal for split point totals** (same).
3. **No switch where there are no matches.** 028's decision said Standings / Players in every game but Scorecard. With the bug on top, a Standings tab in Everyone alone would repeat the table.
4. **The fact is `number-xl`.** The Game Screens page put it as a sentence under the rows. 027 rule 2 wants one hero number per screen, so it moved to the top.
5. **2v2 with a partner switch** ranks the four players by matches won, then holes up. 032 says only “whoever wins the most of them”.

| # | key | # | key |
|---|---|---|---|
| 01 | board-carts-rotate | 08 | board-alone |
| 02 | board-carts-players | 09 | board-stroke |
| 03 | board-carts-same | 10 | board-player-open |
| 04 | board-carts-6-lead | 11 | final-field |
| 05 | board-before | 12 | final-h2h |
| 06 | board-2v2 | 13 | enter-open |
| 07 | board-2v2-switch | | |
