# 015 · Team Ryder Cup: Board, Matches, Setup (v2)

Status: designed, not built

This replaces the screens in **014** (never edit 014; this folder supersedes its §0–§4 and §6–§7). 014's §5 (Enter header), §8 (Today's game, headlines) and §10 (sample data) still stand. The game logic is in `RULES.md` in this folder; build from that, not from screenshots.

**Design canvas (source of truth for the look):** https://claude.ai/artifact/PpADT3Sjt2xMkjKKWjDHDA — "Team Ryder Cup · Handoff 015". Rows: Board · Matches · Rules illustrated · Setup · Archive. Every artboard is a `.dc.html` file in the canvas; copies are in `mockups/canvas/` here for reference (they need the canvas runtime to render; read them for markup, spacing and the sample logic, not to open in a browser). The Golf Live Board design system is installed on the canvas. The green sticky note at the end of each row is the decision list for that row.

Screen size 393 × 852, Night Round, dark default with a light tweak on every artboard. Sample data only.

---

## 0 · The two tabs

- **Matches = my match.** Only the viewer's cart. Answers "how's my match going?"
- **Board = my team.** The cup score, then every match. Answers "are we winning?" Tap a row for another match's detail.

Nothing is hidden from anyone: scores show as soon as they're entered (see RULES §4).

## 1 · Shared language

| Thing | Rule |
|---|---|
| Colors | `cart-you` for the viewer's own cart only (name + their side's points). Everyone else `text`, opponents / losers `text-muted`. No other hue. |
| Names | Two first names stacked, no "+", `small` 13px/16px, 600. Never shrinks, never pushes a flag. A single first name that can't fit gets an ellipsis. |
| Score marks | As today. |
| Sentences | Labels only. No descriptions on screens. Status lives in position, fill and the number. |
| Sheets | Read-only sheets (match detail) have **no close button**: grab handle, swipe down or tap the scrim. Sheets with a form keep the X. (Design-system note: add this split to BottomSheet.) |

## 2 · Board

One screen, five states driven by the round: **empty, morning, midday, afternoon, final** (canvas row 1, left to right; the artboards share one file with a `time` tweak).

Top to bottom:
1. Top bar, title "Board".
2. **Cup card** (`surface-1`, `radius-2xl`): side names (yours green, left), 48px mono totals, a `label` between them (`3 LEFT · 6½ WINS` / `12 MATCHES · 6½ WINS` / `FINAL` in green). Under it the **cup bar**: 12 segments (3px gaps, 12px tall) in two groups of six, your side fills from the left in green, theirs from the right in `text-muted`, a halved match fills half a segment, a 2px `text` line in the middle. **Final** adds one line under the bar: trophy icon, "Andrew + Alex 3–0 · MVP cart", secondary **Recap** button.
3. **Rotations**, each = one outlined header strip + rows on the background. No hairlines, no cards around rows, no team column header, no legend.
   - **Header strip**: 1px `line` border, `radius-md`, 40px; left `HOLES 13–18` (`label`, `text` when live, `text-muted` otherwise), center tally `0 – 1` (yours green), right `LIVE` (green) or `DONE` (muted) or nothing.
   - Order: live rotation(s) first, then done, then future. **Two rotations can be LIVE at once** (groups crossing over). Live and done rotations are always open; done rows at 85% opacity.
   - **Future rotations** fold: header strip + chevron on the right, tap to open the four upcoming matchups (70% opacity, dashed flags). The first rotation before the round starts is open by default with tee times in the flags.
4. **Row** (54px min): `1fr 0 1fr` grid. Your side's cart stacked left, theirs stacked right-aligned. The cell on the side holding the point has a `surface-1` fill (`radius-lg` on the outer corners) and reserves 76px for the flag.
5. **Flag**: one shape per match, **always 72 × 26**, mono 12/700, hangs off the center line toward whoever holds the point (square inner corners, `radius-sm` outer). Five looks, one per state:

| State | Look | Text |
|---|---|---|
| Not started | dashed `line` border, on the line | tee time (`8:40`) or where the trailing cart is (`on 12`) |
| Live, someone up | solid `text` fill, `bg` text, leader's side | margin: `2 UP`, `½ UP`, `1½ UP` |
| Live, tied | solid `text` fill, on the line | hole points: `3–3` |
| Done, won | `surface-3` fill, `text` text, check icon, winner's side | final hole points: `7–5`, `6½–1½` |
| Done, halved | `surface-2` fill, `text-muted` text, check icon, on the line | `6–6` |

   The score never changes a flag's width or position; only who holds the point does. The margin is enough on the Board; the full score is one tap away.
6. Tab bar (z-index above the list; nothing scrolls over it).

**Tap a row → match sheet** (`Board · tap a match → sheet`): grab handle, kicker `HOLES 13–18 · FINAL`, each cart’s pair name once, directly over its own 44px number with a dot beside it (left `text`, right `text-muted`; loser's number muted), the match bar with the 6½ line, one line (`Decided with 2 to play`), the six-hole strip, tap a hole for the four score marks and `Low ball · 4 v 5` / `Low total · 10 v 10` with the dot saying who. No green in the sheet. No X.

## 3 · Matches

One screen, states **A nothing counts yet · B live · C they're ahead of you · D history** (canvas row 2). The layout never changes between states; only words, fill and dots do.

Top to bottom:
1. Kicker `HOLES 13–18 · LIVE` (green) or `· WAITING ON THEM` (muted). Title `vs Joseph + Jay`. Subline: where both groups are, `3rd tee time · they're on 15, you're on 17`.
2. **Rotation picker**: the existing segmented control, three two-line segments: `1–6 / won 7–5`, `7–12 / won 7½–4½`, `13–18 / live`. Tap one and the whole screen shows that match in the same layout; a finished one reads `FINAL · YOU WON 7–5`. That's history.
3. **Score card** (`surface-1`, `radius-2xl`): kicker `THRU 4 · YOU'RE UP 2` (green; `NOTHING COUNTS YET` muted in A), your pair name over your 44px points (green) left, theirs right, the **match bar** (one smooth 12px bar, your points from the left in green, theirs from the right in muted, a 2px line at 6½ with `6½ CLINCHES` under it), then `4 pts left` / `1½ more and it's yours`. The bar fills only for counted holes.
4. **Hole strip**: six 60px tiles (hole number + two 11px dots: top low ball, bottom low total). Tap a tile to select it.
   - Dot states: **solid** = counted (green you, muted them, half/half = halved) · **hatched** = one cart's scores in, waiting on the other · **dashed** = nobody yet. The hatched dot is a drawn SVG: 1.5px ring, three 45° stripes clipped inside (never a CSS gradient; it must look identical in every tile). Legend line under the strip: counted · one cart in · nobody yet.
5. **Hole detail**: `Hole 16 · par 4` and the hole's points, four score marks with first names (yours green), two lines `● Low ball · halved` / `● Low total · you`. When only their scores are in (state C), their marks show and the line says what you need: `Joseph made 4, Jay 5. A 4 halves low ball; 8 or better between you takes low total.` When only yours are in: `Your scores are in, waiting on them.`
6. Tab bar.

Difference from the Board bar, on purpose: Board = 12 separate segments (side points, one per match); Matches = one smooth bar (hole points inside a match) with the clinch line labeled.

## 4 · Setup

Flow: ① Course → ② Players → ③ Pick a game (014) → **④ Carts → ⑤ Draft → ⑥ Tee times** → Start → Round is live. One decision per screen; every screen ends in one primary button.

- **② Players**: unchanged list; subline reads `16 in. That's a Team Ryder Cup.`
- **④ Carts** ("Who rides together?"): 8 rows, `CART n` label + two 48px name buttons. Paired in the order added. Tap two names to swap (within a cart, across carts). Shuffle in the top bar. Next: pick sides.
- **⑤ Draft** ("Andrew picks" / "Josh picks"): the two captains' carts are pre-placed at the top of each column. Remaining 6 carts sit in a 2-column pool. Snake order **J, A, A, J, J, A**; `PICKING` tag on the side that's up; tap a cart to take it; **Start over** in the top bar. The primary button is `Skip the draft · split in cart order` (secondary look) until the draft is done, then `Next: tee times`. One phone, both captains looking.
- **⑥ Tee times** ("Who tees off together?"): 4 rows `1st…4th` with an optional time pill (dashed `Add time`), your side's cart (fixed) v a tappable Team Josh cart; tap two to swap. Under it, **your three matches** (1–6 same tee time, 7–12 · 2nd, 13–18 · 3rd) so the schedule means something. Start round · 16 players.
- **Round is live**: join code (mono 64px), link, Copy link / Copy the text, the share text (sides, four tee times with pairings, the one-line rule), the organizer-only amber box, primary `Text the group`.

## 5 · Not in this handoff

- Enter: 014 §5 stands (cart-card header line; opponent row only when the opponent is in another tee time).
- Today's game card and headline copy: 014 §8.
- Host → New lineup (mid-round cart swap): dropped for v1. If a swap happens at the turn, the organizer redoes tee times in setup or everyone keeps their group.
- Recap image: v2.
- Two-phone draft: v2.

## 6 · Design-system notes for Andrew

Add to the system when convenient: the flag (five states), the stacked-name cell, the cup bar (12 segments), the hatched dot, the read-only sheet without an X, and "green means your side's points" for this mode.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
