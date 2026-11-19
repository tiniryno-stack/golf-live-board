# 028 · Game slots: one round screen for every game

Status: handed off (design), not built.

**What this is.** Every game uses Team Ryder Cup's four tabs as they are (Enter 021/022/023, Matches 015/023, Board 015, final card 019). This spec draws only the **slots** each game fills:
- the line on top of Enter;
- who gets pads;
- what Matches shows;
- the Board's top card;
- the final card's winner line.

Everything else is the template, unchanged. Built on **027** (grow in place, lit, peek): build 027 first.

**What this supersedes** (feature folders are never edited, so this one says it):
- **For 2v2, Match play and Scorecard only:** the − / + Score stepper Enter and the “you first” hero Enter (013, design system “Legacy”). They move to the calm Enter.
- **On the Board, for every game but Team Ryder Cup:** the Leaderboard-row Board layout with its own switch words (Teams / Players, Points / Strokes, Cup / Players). Team Ryder Cup keeps its cup card.
- **Every game but Team Ryder Cup:** the winner card under the ranked list (“Board turns final”).
- **015's read-only match sheet and the team breakdown sheet:** they become rows that grow in place (027 rule 1).

**Files:** `screenshots/NN-key.png` + `NN-key-light.png` at 393 × 659 @2×. `mockups/screens.html#{"s":"<key>"}` uses 027's kit; re-render with `node docs/design/features/027-feel/mockups/shoot.mjs 028-game-slots <keys>`. Mockups are reference only.

**Decided by Andrew (Nov 18):**
- **Scorecard Matches** shows your tee time: the players you're with, to par, last three holes. The tab stays.
- **The switch** reads **Standings / Players** in every game. Scorecard has no switch.
- **Rider Cup's ranked-carts card becomes the leader card**, with all four carts in the list under it. Two top-card layouts in total: the **cup card** for two sides and the **leader card** for everything else.

---

## 1 · The slots, per game

| Game | Enter · the line on top | Enter · who has pads | Matches | Board · top card | Final · winner line |
|---|---|---|---|---|---|
| Team Ryder Cup (template, built) | `Andrew + Alex · 2 DN · vs Josh + Brandon` | your cart; the other cart quiet | match card + hole strip | cup card | `Team Sean wins the cup` · `4½–7½` |
| Partner “Rider” Cup | `Andrew + Sean · 1 UP · vs Sam + Jake` | your cart; the other cart quiet | match card + hole strip (built) | leader card: the top cart | `Shank Redemption` · `24` · “points · Mike + Tyler win the day” |
| 2v2 | `Andrew + Sam · 1 UP · vs Sean + Jake`; first hole after a switch: `Holes 10–18 · with Sean · AS · vs Sam + Jake` | you + your partner; the other pair quiet | match card + hole strip (no design: same as Rider) | leader card: the top player | `Jake wins` · `15½` · “points · 3 ahead of Andrew” |
| Match play (split point, 2–6) | `Andrew · 3½ PTS · 2ND · Chris +1` | you; the rest of your tee time quiet | the race (keep) | leader card | `Chris wins` · `5⅓` · “points · 6 holes won outright” |
| Scorecard only | `Andrew · +3 · 3RD · Sam +1` | you; the rest of your tee time quiet | your tee time (§3) | leader card: low score to par, no switch | `Sam wins` · `73` · “+1 · 2 better than Jake” |

## 2 · Enter (`01`–`16`)

The order is always **your score first, then your cart partner's if you have one, then the rest of your tee time**. A game with no carts gets one row of pads (yours) in the card. The rest of your tee time is **one quiet row** that grows into their pads (027 rule 1). It's the Rider Cup Enter with the partner row left out: one screen, not a new one.

### 2.1 The line on top (the match line, 36 px)

Left: who you are (`row`-weight 15/600 `text`). Right: the standing (mono 15/700) then the context (15/500 `text-muted`). This is 022 §2's line, filled per game:

| Game | Left | Standing | Context |
|---|---|---|---|
| Cart games, 2v2 | your two first names, `Andrew + Sean` | `2 UP` / `AS` / `1 DN` from the match on the hole shown | `vs Sam + Jake` |
| 2v2, first hole of a new pairing (`04`) | `Holes 10–18 · with Sean` | `AS` | `vs Sam + Jake`. From the second hole on: back to `Andrew + Sean`. |
| Match play | `Andrew` | `3½ PTS · 2ND` (live points incl. provisional, place) | the leader and their lead over you: `Chris +1`. When you lead (`06`): `4½ PTS · 1ST` · `1 ahead of Chris`. Tied: `T1ST` · `level with Chris`. |
| Scorecard | `Andrew` | `+3 · 3RD` (to par, place) | `Sam +1` (the leader's to par). You lead: `1 ahead of Sam`. |

- **Green is only for your standing when you're winning:** `UP`, `1ST`, `T1ST`. `AS`, `DN` and any other place are `text-muted`, as 022. One green per line.
- **Long names:** the left side truncates first. The standing never truncates. The context drops before the standing if the line is too narrow (rare at 393).

### 2.2 Your card

- **Cart games and 2v2:** your two rows with the green rail (022 §1), as built.
- **No carts** (Match play, Scorecard): one row, yours, rail included (`05`, `07`). The stroke note works as today: `1 stroke · net 3`.

### 2.3 The quiet row (the rest of your tee time)

- **Up to 3 players:** each name with their 26 px mark or `–`: `Sean 4 · Sam 5 · Jake –`. Right: `Enter ›` while any is missing, `Edit ›` once all are in (`08`).
- **4 or more** (a tee time of 5–6, Match play only): the first two names, then `+N`. Missing players come first: `Chris, Jake +3   Enter ›` (`13`). The count of what's missing is already on Next hole.
- **One other player** (a twosome, `11`): `Sean –   Enter ›`.
- No jersey color, no box (021 §4). The whole row is the button.

### 2.4 Grown open

The quiet row grows into a `surface-1` card in its place; your card folds to a row with the rail (027 §1). The match line becomes the head: `Entering for Sean, Sam + Jake` / `Done`. With 4+ players: `Entering for 5 players`.

- **A score from the player's own phone** is a read-only 52 px row: name, `from his phone`, the mark. Own entry wins (unchanged).
- **Two players or fewer to enter for:** every one gets a full pad row (`12`, the 3-ball).
- **Three or more:** one pad row at a time, the **first player still missing**. The others are 52 px rows: name, then `tap to enter` / `entered by you` / `from his phone`, then the mark. Picking a score moves the pads to the next missing player with the blur swap (`09` → `10`). Tapping any row moves the pads to it.
- **Fit:** the open card is never taller than your open card plus their quiet row (~214 px), so Enter stays still. The exception is a 5–6 player tee time: there **the yardage card folds away** while their card is open (`14`), and comes back when it folds.
- Folding works as 021 §4: by itself 1.2 s after the last score with no taps, or on `Done`, or on a tap on your folded row.

| Tee time | Rest of tee time, closed | Open card |
|---|---|---|
| 2 | `Sean –` | 1 pad row |
| 3 | `Sean 5 · Sam –` | 2 pad rows |
| 4 | `Sean 4 · Sam 5 · Jake –` | 1 pad row + 2 compact rows |
| 5–6 | `Chris, Jake +3` | 1 pad row + 3–4 compact rows, yardage card folded |

### 2.5 Next hole (`15`, `16`)

- Labels as 021 §6: `Next hole · 2 to go` → `Waiting on Jake` (or `Waiting on Sam + Jake`) → white `Next hole`.
- **A tap while waiting:**
  - If only others are missing, it **grows their card** (instead of 021's sheet), with the pads on the first missing player and the row's source reading `missing · tap a score`.
  - The status line above Next names the hole: `Jake hasn't got a score on 10 yet.` (`small`, `text-muted`; amber stays for offline only).
  - If your own row is missing, your row's pads do 021's nudge, as today.
- Offline and location-off states are unchanged (021 §6).

## 3 · Matches

- **Rider Cup, Team Ryder Cup, 2v2:** the match card + hole strip (built for Rider; 2v2 moves onto it as is, no design). The live hole tile is lit and the next rotation peeks (027 `09`).
- **Match play:** keeps the race (002/003), as the design system says.
- **Scorecard (`24`, `25`):** your tee time.
  - Kicker `Matches · your group · thru 5`.
  - Hero line in `title`: `2 back of Sam` (`1 ahead of Sam` when you lead; `Level with Sam` when tied; `Your group` before the first score).
  - A `surface-1` list of the players you're with, **sorted by to-par**: to par in mono 17/700 (yours `cart-you-text`), the name, and their last three holes as 26 px marks.
  - Under the list: `To par · holes 3, 4, 5` and the ghost link `Everyone on the Board ›`.
  - At the bottom edge the next hole peeks: `Next · hole 6 · par 5 · 512 yd` / `Sam has 2 on you with 13 to play`.
  - Before the first score: every player at `E` with three `–`, plus `Waiting for the first scores`.

## 4 · Board: the leader card (`17`–`23`)

The one top card for every game without two sides: a `hero` card (`radius-2xl`).
- Kicker (`label`): `Leader · official thru 9`.
- The leader's name in `title`, in their cart color (green if it's you).
- The leader's points in `number-xl` on the right.
- One `body` `text-muted` line about you: `6 ahead of you`, or `1 ahead of you · Mike + Tyler` for a cart.

Under it: **Standings / Players** (Segmented control), then the list.

| Game | Leader card | Standings list |
|---|---|---|
| Rider Cup (`17`) | top cart, cart color, its players on the sub line | all 4 carts (3 for 6 players): name, players · record · thru, points in cart color, your row tinted; then the rotation strips as today, **your live rotation's header lit** |
| 2v2 (`18`) | top player | 4 players: points, who they partnered and when |
| Match play (`19`) | top player | 2–6 players: won · split · thru |
| Scorecard (`20`) | lowest to par, `text` color (no jerseys in Scorecard), `+1` | everyone by to par: gross thru N and their tee time; **no switch, no bars** |

- **The number** is the live total (official + provisional). The kicker says what's official, as today; the provisional chip and hatching stay on the list rows.
- **Tie for the lead (`21`):** kicker `Tied for the lead · thru 14`; title `Chris and you` (your word in `cart-you-text`, `and` in `text-muted`, others in plain `text`); `4⅓` with `each · Jake 1⅚ back`. List ranks read `T1`. Three or more tied: `Chris, Sam and you` → `3 tied for the lead` when the names don't fit one line.
- **Before the first score (`22`):** the card shows the first matchups (`First up · holes 1–6`, cart vs cart in cart colors) and `Waiting for the first scores · 8:40 and 8:50`. The list shows tee times where the points go, never zeros. Games without matchups: kicker `Today · Match play` and the tee times.
- **Tap a row → it grows in place (`23`).** It shows a small summary: won alone / split / to par in three `surface-2` tiles, the last three holes as marks, and `Scorecard ›` (opens Card scrolled to that player). `Close` sits on the row's sub line. One open at a time. This replaces the team breakdown sheet and 015's read-only match sheet: a match strip grows into that match's hole strip the same way.
- **Fit:** the leader card + switch + your row show without scrolling (design system rule). The list then scrolls.

## 5 · The final card (`26`–`31`)

Team Ryder Cup's final card (019), with each game's words in the slot:
- `Final · 18 holes` kicker;
- trophy icon in `text-muted`;
- the winner line in `title`, in the winner's cart color (`cart-you-text` when it's you: `You win`, `30`);
- the score in `number-xl`;
- one `body` `text-muted` line;
- **Round recap** (primary) and **Share the result** (outlined);
- organizer only: **Finalize round** (secondary, with the lock icon) under the card. After finalizing it's gone and the kicker reads `Final · locked`.
- Under it, Standings / Players and the list (Scorecard: just the list).

| Game | Winner line | Number | Sub line |
|---|---|---|---|
| Rider Cup | `Shank Redemption` | `24` | `points · Mike + Tyler win the day` |
| 2v2 | `Jake wins` | `15½` | `points · 3 ahead of Andrew` |
| Match play | `Chris wins` | `5⅓` | `points · 6 holes won outright` |
| Scorecard | `Sam wins` | `73` | `+1 · 2 better than Jake` |
| You won | `You win` (green) | yours | same sub line |
| Shared (`31`) | `Chris and Andrew` (plain `text`) | `4⅓` | `each · level on holes won too, so they share it` (Match play's tiebreak, `rankStandings`). Scorecard: `each · 74 (+2)`. Kicker `Final · 18 holes · shared`. |

The final Board scrolls (card + list). That's allowed: only the top card must show without scrolling.

## 6 · Copy

- Players see **“your group”** on Enter and Matches (live wording) and “start time” in the lobby (025 §7). Never “Group 1”, never “tee time” to players. The organizer's Setup says “tee times” (030).
- Halves as `½`, thirds as `⅓`, sixths as `⅚` (split point), as today.

## 7 · Build notes

- **This touches score entry** (the other players' pads move into the grown card, the own-entry rows, the Next-hole tap). **Worth a smoke run before it ships.**
- No engine or database change:
  - the line on top reads existing state: `pairView` / `game.people` for 2v2, `soloView` / `rankStandings` for Match play, to-par from the snapshot for Scorecard;
  - the leader card reads `liveStandings`;
  - the winner line reads the final standings.
- Put each game's slot text in one pure function, e.g. `slots(event, snap, me)` → `{ line, padsFor, boardTop, finalLine }`. One unit test for it, covering all five games plus a tie.
- Retire `ScoreStepper`, the “you first” Enter, `LeaderboardRow`'s Board layout and the winner card once no game uses them (design system “Legacy”).

| # | key | # | key |
|---|---|---|---|
| 01 | enter-ryder | 17 | board-rider |
| 02 | enter-rider | 18 | board-2v2 |
| 03 | enter-2v2 | 19 | board-match |
| 04 | enter-2v2-switch | 20 | board-scorecard |
| 05 | enter-match | 21 | board-tie |
| 06 | enter-match-lead | 22 | board-before |
| 07 | enter-scorecard | 23 | board-grow |
| 08 | quiet-all-in | 24 | matches-scorecard |
| 09 | quiet-open | 25 | matches-scorecard-before |
| 10 | quiet-open-next | 26 | final-rider |
| 11 | tee-2 | 27 | final-2v2 |
| 12 | tee-3-open | 28 | final-match |
| 13 | tee-6 | 29 | final-scorecard |
| 14 | tee-6-open | 30 | final-you |
| 15 | next-waiting | 31 | final-shared |
| 16 | next-tapped | | |
