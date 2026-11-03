# 014 · Team Ryder Cup (8v8)

Status: designed, not built

A new 16-player game: **two sides of 4 carts**, cart v cart, a new opponent every 6 holes, **12 matches worth 1 point each to the side, 6½ wins**. This feature covers the screens. The scoring logic is being built from a separate handoff; section 9 lists what the screens need from it.

Screenshots: `screenshots/<Screen>-{dark,light}.png`, 393 × 852, Night Round. Mockups: `mockups/*.html` (clickable; add `?mode=light`). Sample data only (Sherrill Park, the 16 names, all scores). The mockups link `tokens.css` (a copy of the design system's) and use no other colors, sizes, radii or shadows. Rebuild in the app's components; don't copy markup.

| Screen | Mockup | Screenshots |
|---|---|---|
| **A. Board** (side race) | `Board.html?state=live\|empty\|clinched\|final` (tap a match to expand it) | `Board-live`, `Board-live-scrolled`, `Board-empty`, `Board-clinched`, `Board-final` |
| **B. Matches** | `Matches.html` (`&view=other` opens a match, `&rot=0/1` earlier matches) | `Matches-your-match`, `Matches-watching` |
| **C. Enter** (team) | `Enter.html` (`?rot=1` = opponent in your group) | `Enter-team-other-tee-time` |
| **D. Setup** ③ ④ ④b | `Setup.html?step=game\|sides\|tees` (`&sheet=1` rename sheet) | `Setup-3-game`, `Setup-4-sides`, `Setup-4-rename-sheet`, `Setup-4b-tee-times` |
| **E. Host → New lineup** | `Lineup.html` (`?matched=1` after "Play with your opponent") | `Host-new-lineup-sheet` |
| **F. Today's game** | `Brief.html` | `Brief-todays-game` |

Build order for the round this week: **Board → Matches → Setup → Enter header → Today's game → New lineup.** Recap (G) is copy only for v1.

---

## 0 · Decisions on the brief's open questions

1. **Colors are by side, not by cart.** On your phone your whole side is `cart-you` (green text, `tint-you` + `cart-you` outlines); the other side is `cart-b` (blue, `tint-b`), the same "them" color as 2v2. Carts are told apart by **name only** (pair names like "Andrew + Alex"). A spectator not on a side sees side 1 in `cart-a` and side 2 in `cart-b`. Your side is always shown first / on the left. Your own cart is singled out with the YOU tag and, on the Board, the tinted pinned row.
   - ⚠️ **Design-system rule change, please add to the README:** in Team Ryder Cup "green means you" widens to "green means your side". Inside a WATCHING box a teammate's cart is green text (no tint, no outline); the box itself keeps its `line` outline, and your own match is still the pinned green bar, so it can't be mistaken for yours.
2. **The race bar has one line, in the middle, labeled "6½ WINS".** 12 points across; your side fills from the left, theirs from the right. Passing the middle = 6½ = the cup. Same vertical-line language as the Matches points bar (2px `text`, sticks out 5px top and bottom). Clinched: the kicker turns into "TEAM ANDREW CLINCH IT · 6½" in the side's color and the fill visibly crosses the line. Nothing else changes (no confetti, no new color).
3. **Yes, one component: MatchRow.** Board's match list and Matches' "Also" list use the same row (section 3). On the Board a tap opens a compact hole grid in place; on Matches a tap opens the full WATCHING box (ExpandInPlace). Your own row on the Board goes to Matches.

## 1 · Flags (things that differ from the brief or need a yes)

- **Brief sample math.** "5½ · 4½ · 8 matches left" adds to 18 of 12 points. The mockups use a consistent state instead: **Team Andrew 5½ · Team Josh 3½ (1 prov) · 3 matches left**, your match "THRU 4 · YOU'RE UP 2" (5–3). Clinched: 6½–3½. Final: **7–5**. Full sample in section 10.
- **Enter header vs 013.** 013 deliberately removed the match strip from Enter. This design does **not** bring the strip back; the brief's line goes into the existing cart card header instead (section 5), replacing the low ball / low total line. If you'd rather keep Enter clean, drop it; nothing else depends on it.
- **"Provisional" in this mode** (needs your OK; the logic session should match): a match is provisional **from the moment it's decided early until both foursomes have finished its 6 holes**, the same rule as today's matchup win bonus. A hole only counts once both carts have scored it, so live matches are never "provisional", just live.
- **A 6–6 tie** isn't covered by the brief. Proposed: Board says "Tied 6–6 · cup shared". Real Ryder Cup "holder keeps it" needs a holder, which we don't have. Your call.
- **Player count:** v1 is **exactly 16** in the picker. The layout already works for 12 (3 tee times, 3 carts a side, 9 matches, 5 wins) if the engine supports it later; 8 would repeat opponents.
- **New pattern, no new tokens:** the cup race bar (built from the Board bar's hatch + the Matches clinch line), the MatchRow component, and CartChip showing a **pair name** instead of a letter (`.pchip`, 44px tall, same tint + outline rule). Add these three to the design system.
- Board's "Teams" segment is labeled **Cup** in this mode.

---

## 2 · A. Board (side race) · top priority

Top to bottom (`Board-live`):
1. **Top bar** unchanged (avatar, name, course · day, Share).
2. **Cup card** (`surface-1`, `radius-2xl`, padding 18/14/14, light-mode shadow as 012's score card):
   - Kicker `label`, centered: `THE CUP · OFFICIAL THRU 12` (`text-muted`).
   - Side names `row` 17/600 in side colors, left and right.
   - The two totals `number-xl` (64px mono) at the edges, a muted "–" between. The big number includes provisional points; a dashed `+1 prov` chip sits under the side that has them (LeaderboardRow style).
   - **Race bar**: 14px tall, `radius` 7, track `surface-2`. Left fill = your side ÷ 12, right fill = theirs ÷ 12. Provisional part is hatched (`repeating-linear-gradient` in the side color, as today) on the **inner** end of the fill. Center line + `6½ WINS` label 22px above it.
   - Footer line `body`: left `3 matches left` (600), right `Team Andrew need 1 more` (`text-muted`). Copy rules: "need N more" for the side that's ahead; if both can still win, the leader's line. Tied: "All square · 6½ wins".
3. **Headline ticker** (existing). Hero color = the side that the headline is about: `tint-b` + `cart-b` outline for Team Josh, `tint-you` + `cart-you` for yours. Scores in the headline are mono and never wrap (`7–1`).
4. **Toggles** unchanged: **Cup | Players** and **Gross | Net**. Players view is today's Players view.
5. **Match list**, grouped by rotation. Section label row: `HOLES 13–18 · LIVE` left, rotation tally right (`0 – 1` in side colors). Order: **current rotation first**, then earlier ones (live and clinched); in the empty and final states, 1–6 first. Inside each group your match is first, as the pinned row.
6. Legend line at the end: `[prov] Decided early. Official once both groups finish its 6 holes.`
7. Tab bar (Board active). The page scrolls vertically under the tab bar (`Board-live-scrolled` shows an expanded row).

**States**
| State | Kicker | Numbers | Ticker / card | Footer line |
|---|---|---|---|---|
| Empty (`Board-empty`) | `THE CUP · WAITING FOR THE FIRST SCORES` | none: "12 matches · 1 point each · 6½ wins" instead | EmptyState box: "Waiting for the first scores" / "Here are the 12 matches. Each one is worth 1 point to its side." | "Past the middle wins the cup". List shows all 12 matches with their tee times ("1st tee time", "1st + 2nd tee times") |
| Live | `THE CUP · OFFICIAL THRU N` | totals + prov chip | latest headline | `N matches left` / `Side need N more` |
| Clinched | `TEAM ANDREW CLINCH IT · 6½` (side color) | totals | clinch headline | `N matches still playing` / `for the final score` |
| Final | `FINAL · LOCKED` (side color) | final totals | **Trophy card**: `tint` + outline of the winning side, trophy icon, `THE CUP`, "Team Andrew win 7–5", "Andrew + Alex went 3–0. MVP cart." and a secondary **Round recap** button (opens today's recap pager) | `12 of 12 matches` / `Team Andrew win by 2` |

Organizer's **Finalize round** stays where it is today (under the trophy card and in Host).

## 3 · MatchRow (shared component)

- Min 64px tall, padding 10/12, `line` hairline between rows.
- **Left**, two lines `body` 15/600: line 1 = your side's cart, line 2 = "v " (`text-muted`) + their cart. Names in side colors. Once decided, the losing cart turns `text-muted` 500. Your cart gets a `YOU` tag (`label`, `cart-you-text`).
- **Right**, two lines:
  | Match | Line 1 (mono 15/700) | Line 2 (`small`, `text-muted`) |
  |---|---|---|
  | Not started | `–` muted | where/when: "Waiting on 4th tee time", or in the empty state the tee time(s) |
  | Live, someone up | `2 up` in the leader's side color | `thru 4` |
  | Live, level | `AS` | `thru 2` |
  | Won | `won 7–5` in the winner's color (winner's hole points first) | `+1 Team Andrew` (with a dashed `prov` chip in front when provisional) |
  | Halved | `halved` | `½ each` |
- Your match on the Board: `tint-you` fill, 1.5px `cart-you` outline, `radius-lg`. Tapping it opens Matches.
- Other matches that have started: a chevron; tapping expands in place. **Board**: the row moves into a `line`-outlined box labeled `WATCHING` with the 6-hole grid under it (HOLE with par, LOW BALL, LOW TOTAL rows of 18px dots: side color = that side won it, half-and-half = push, dashed = live, empty ring = not played). One open at a time. **Matches**: opens the full WATCHING box (section 4).
- Not started rows have no chevron and do nothing.

## 4 · B. Matches (your match + the cup)

Built on 012. Changes only (`Matches-your-match`):
- **Header**: `MATCH 3 OF 3 · LIVE`, "vs Joseph + Jay" (their color), subline `Holes 13–18 · they're in the 3rd tee time` (rotation 1: `in your group`).
- **Rotation picker**: 3 segments, the opponent's pair name (ellipsis if long) with a `cart-b` dot, and `13–18 · LIVE` / `7–12 · W` / `1–6 · L` / `½`.
- **Score card** (012): kicker `THRU 4 · YOU'RE UP 2`. ⚠️ Pair names are longer than team names, so the names sit **above** the score (yours left with "you", theirs right with "them") and the 64px score is centered under them. Bar and `4 pts left · 1½ more clinches it` unchanged (6½ of 12 hole points clinches a match).
- **Cup line** inside the bottom of the score card, under a `line` divider: `THE CUP` label, "Team Andrew 5½–3½ Team Josh", and a stakes line (`small`, muted): "Win this one and Team Andrew clinch it". Whole line is a 48px+ button → Board. Stakes copy, from your side: "Win this one and Team Andrew clinch it" / "Team Josh clinch it if they win this" / "Win this to keep Team Andrew alive" / nothing when it can't change the cup. Hidden once your match is decided.
- **Cross-tee-time hint** (Hint component) under the card when the opponent isn't in your group: "Joseph + Jay play in the 3rd tee time. A hole counts once both carts have finished it."
- **Hole table** unchanged (012: on the background, 24px margins, Hole · Low ball · Low total · Pts). A winning cell names the cart by its first player ("Andrew", "Joseph") with a dot in the side color.
- **Also list**: label `ALSO · HOLES 13–18`, then the other 3 matches of this rotation as MatchRows in one `line`-outlined box (radius 20). Tapping one: your match folds into the pinned green bar (`YOUR MATCH · THRU 4`, "Andrew + Alex 5–3 Joseph + Jay"), and that match opens above the remaining Also rows in its own `WATCHING` box: tee times line ("3rd tee time v 1st tee time · thru 4"), names above a 44px score, 12px bar, `Decided` / `[prov] +1 Team Josh` (or `N pts left` / `thru N`), full hole table (`Matches-watching`). Tap the bar or the WATCHING header to go back. Not-started matches don't open.

## 5 · C. Enter (team game) · small change

Everything from 011/013 stays. Two changes (`Enter-team-other-tee-time`):
1. **Cart card header** (replaces the low ball / low total line): left `● vs Joseph + Jay` (opponent in their color), right mono 13 `UP 2` in `cart-you-text` + ` · CUP 5½–3½` muted. Level: `AS`; down: `DOWN 1` in `text-muted` (never red).
2. **Opponent row**, only when your opponent is in another tee time: a 48px row under the usual "other cart in your group" row, `line` outline, no fill: their name, a `3RD TEE TIME` tag (mono `label`, `line` outline), and their scores for this hole as they arrive (score marks; dashed ghost = not in yet). Read only, no Edit. In holes 1–6 the opponent *is* the other cart in your group, so this row doesn't show.
- The other cart in your group keeps its row with Edit (you still enter their scores, e.g. Sean + Baker while you play Joseph + Jay).
- Size check: at 393 × 852 everything still fits above the tab bar with the green card at Regular; the 013 measuring rule handles smaller phones.

## 6 · D. Setup (kept short: one new screen, one optional)

Flow: ① Course → ② Players → ③ Pick a game → **④ Pick sides → Start**. ④b Tee times is optional, like the cart game's ④b.

**③ Pick a game** (`Setup-3-game`): new GameOption **Team Ryder Cup**, count `EXACTLY 16`, description "Two sides of 4 carts. Cart v cart, a new opponent every 6 holes. 12 matches, 6½ wins." With 16 players the others are dimmed with the fix spelled out ("Remove 10 players to play this."); the existing "Partner “Rider” Cup" reads `6 OR 8 PLAYERS`. Button: **Next: pick sides**.

**④ Pick sides** (`Setup-4-sides`), one screen:
- Title "Pick sides", kicker `STEP 4 · TEAM RYDER CUP`.
- Hint: "Paired in list order. Tap two names to swap." (changes to "Now tap the name to swap with." after the first tap) + ghost **Shuffle**.
- Two columns (your side left). Column header = the side name in its color + pencil, a 48px button that opens the **rename bottom sheet** (`Setup-4-rename-sheet`: "Name this side", TextField, "Default is “Team” plus the first player's name.", Done).
- 4 cart cards per side (TeamCard rule: tint + full outline, tag `CART 1 · YOU`), each with its two players as 48px buttons side by side. **Tapping two names swaps them**, within a cart, across carts or across sides, so the same gesture sets pairs and sides. Toast "Swapped".
- Defaults: players 1–8 of the list → your side, 9–16 → the other, paired in order. Side names default to "Team" + the first player of each half.
- Link row: **Tee times & matches** · "1st: Andrew + Alex v Sean + Baker · 12 matches" · Optional ›.
- Primary: **Start round · 16 players**.

**④b Tee times** (`Setup-4b-tee-times`, optional):
- Groups card: 4 rows, `1st`…`4th` with an optional clock pill (dashed "Add" or the time; "Set times" ghost), your side's cart chip v their cart chip (pair-name CartChips). Tap two of the other side's chips to swap their tee times (your side stays put).
- Hint: "Tap two Team Josh carts to swap their tee times. Nobody changes groups during the round unless the organizer sets a new lineup."
- **12 matches** grid: rows = your side's carts, columns 1–6 / 7–12 / 13–18, cells = the opponent (names may wrap to two lines). Under it: "Holes 1–6 against the cart in your tee time. Holes 7–18 against a cart in another tee time, scored from the app."
- Rules row (collapsed): "Low ball + low total decide each match · ½ for a halved match".
- Primary: **Start round · 16 players**.
- Schedule rule: in rotation r (0, 1, 2) your side's cart i plays their cart (i + r) mod 4, by tee-time order.

**⑤ Round is live**: unchanged; the share text adds the two sides and "12 matches · 6½ wins".

## 7 · E. Host → New lineup (bottom sheet, organizer only)

Host row **New lineup · From hole…** opens a BottomSheet (`Host-new-lineup-sheet`):
- Title "New lineup", subtitle "Organizer only · who plays in which tee time", 48px close.
- **From hole** stepper (48px − / +), default = the start of the next rotation (7 or 13), subline "Holes before 13 keep their results".
- Secondary button **Play with your opponent** + hint "Puts each cart in the same tee time as the cart it plays on holes 13–18. Team Josh carts move." (rotation of the chosen hole).
- `TEE TIMES FROM HOLE 13`: 4 rows (your side's cart v their cart); moved carts show `was 3rd` under the chip. Tap two of their chips to swap by hand.
- Footnote: "Tap two Team Josh carts to swap. The 12 matches don't change, only who plays together."
- Primary **Save lineup** → sheet closes, Toast "Lineup changed from hole 13".
- Meaning (for the logic session): a lineup change only changes which carts share a tee time from hole N (who enters scores together, the "other cart in your group" row, cross-tee-time tags). It never changes the match schedule or any earlier hole.

## 8 · F–H. Today's game, recap, headlines

**F. Today's game card** (`Brief-todays-game`), shown where today's Today's game pager shows: title "Team Ryder Cup", "Two sides of 8. Your cart plays a different cart every 6 holes."; two side cards (YOUR SIDE / THEM, "4 carts · 8 players"); "12 matches · 1 point each · 6½ wins" + "Each hole: low ball 1 point, low total 1 point. Most hole points after 6 holes wins the match for your side. A tie is ½ each."; `YOUR MATCHES · ANDREW + ALEX` with your 3 opponents and where they play; hint "Holes 7–18 are against a cart in another tee time. The app scores it hole by hole; nobody moves." Button **Let's go**.

**G. Recap image (optional for v1)**: same canvas pager; first image = side score big in side colors ("Team Andrew 7 – 5 Team Josh"), then the 12 match results grouped by rotation (MatchRow content, no chevrons), then **MVP cart** = most match points (ties: most hole points). Use the viewer's colors like today's recap.

**H. Headlines** (copy; hero color = the side the line is about):
- Lead change: "Team Josh take the lead 4–3"
- Tied: "All square 4–4 with 4 to play"
- Match won: "Andrew + Alex beat Mitch + Peter 7–5"; early: "Sean + Baker win 7–1 with 2 to play"
- Halved: "Ant + Steve and Joseph + Jay halve it 6–6"
- Can clinch: "Andrew + Alex can clinch it for Team Andrew"
- Clinched: "Team Andrew clinch it with 2 matches to play"
- Final: "Final: Team Andrew win 7–5"; tie: "Final: tied 6–6, the cup is shared" (if you approve the tie rule)

## 9 · What the screens need from the engine
- Per match: rotation, the two carts, both carts' tee times, status (not started / live / won / halved), hole points each, holes counted ("thru"), leader + margin, decided-early flag, provisional flag, per-hole low ball / low total winner.
- Per side: total (incl. provisional), provisional part, matches left, per-rotation tally, clinched flag, "needs N more".
- Official line (`OFFICIAL THRU N`), lineup changes (from hole N → tee-time map), viewer's side and cart.

## 10 · Sample state used everywhere
Schedule: 1–6 A1vJ1 A2vJ2 A3vJ3 A4vJ4 · 7–12 A1vJ2 A2vJ3 A3vJ4 A4vJ1 · 13–18 A1vJ3 A2vJ4 A3vJ1 A4vJ2 (A1 Andrew + Alex, A2 Ant + Steve, A3 Justin + Chuck, A4 Mitch + Peter; J1 Sean + Baker, J2 Josh + Brandon, J3 Joseph + Jay, J4 Elijah + Marcus).
- Holes 1–6: A1 won 7–5, A2 won 6½–5½, J3 won 8–4, A4 won 7–5 → **3–1**
- Holes 7–12: A1 won 7½–4½, A2/J3 halved 6–6, J4 won 8–4, A4 won 7–3 (with 1 to play) → **2½–1½**
- Holes 13–18 live: A1 v J3 5–3 thru 4 (you); J1 won 7–1 v A3 with 2 to play (**prov**); A2 v J4 and A4 v J2 waiting on the 4th tee time → **0–1**
- Total **5½–3½**, 3 left. Clinched: A1 wins 7–5 → 6½. Final: J4 wins 7½–4½, A4/J2 halved → **7–5**.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
