# 023 · Matches: who won each point · Enter: your cart in a card

Status: built in 3bf1229

**Changes 015 §3 (Matches) and 021/022 (team Enter).** Where they differ, this wins. It applies to every game that uses the Ryder screens: Team Ryder Cup and Partner “Rider” Cup (018). Board, the final card (019), the Enter motion (021/022) and the yardage card stay exactly as they are.

The owner asked two things after a week on the new Enter. Matches mid-round should answer “how are we doing, and what do we need this hole?” on one screen, without making you decode dots. Enter felt like “just text on a black background”. A council of four ran three rounds on it. Final scores were 9 · 9 · 8.5 · 8.5, and the two blockers raised in the last round are fixed in these frames.

- **Screenshots:** `screenshots/` shows the target in dark and light.
- **Mockups:** `mockups/matches.html` and `mockups/enter-d1.html` are reference only; rebuild them in our components. Run `npm install` first so the fonts load. `mockups/README.md` lists the URL for each state.
- **Canvas:** the boards **Pass 6 · Ryder Cup Matches + Enter depth** at https://claude.ai/artifact/5gQDphWBkb6TRRjvpJiTWi.

## 1 · Matches, top to bottom (replaces 015 §3)

The layout never changes between states; only the words, fills and dimming do. The whole page fits **393 × 659 with no scroll**. The hole detail ends ≥ 12px above the tab bar in every state (it measures 12px in all nine frames).

Below the top bar (unchanged: avatar · name · round name · ⋯):

1. **Head.**
   - Title: `vs Josh + Brandon`, 24/28 700, −0.5px tracking. The names are the opponents in the match being shown, `displayNames` style.
   - Subline (13px `text-muted`), live rotation: where the two groups are, `they’re on 10 · you’re on 11`. When both groups are on the same hole, it reads `Holes 7–12`.
   - Subline, finished rotation: `Holes 1–6 · final · Back to live ›`. `Back to live` is in `text`, weight 600, and selects the live rotation. Pad its tap target to 44px tall with negative margin so the line doesn't move.
   - The 015 kicker (`HOLES 13–18 · LIVE` / `WAITING ON THEM`) is gone.
2. **Rotation picker.** The segmented control, 44px tall, three **one-line** segments: `1–6`, `7–12`, `13–18`. These replace the two-line `won 7–5` segments.
   - Won: `W` after the numbers, mono 12/700, `cart-you-text`.
   - Lost: `L`, same style, in `text-muted`.
   - Halved (6–6): `½` in `text-muted`. Not drawn; flagged in §6.
   - The live rotation, while you're looking at another one, shows `LIVE` in mono 12/700 `cart-you-text` (frame 06). While you're on it, nothing extra: the selected segment says it.
   - No dot, no ring, no red. The council ranked the live dot red < white < green and then dropped the dot altogether: the word plus `Back to live` did the job without adding a new mark.
   - Light theme: the selected segment also gets `shadow-card`.
3. **Score card** (`surface-1`, `radius-xl`, padding 14 / 16, `shadow-card`):
   - Kicker (label style): `THRU 4 · 2 UP` in `cart-you-text` only when you're up. `2 DN` and `ALL SQUARE` are `text-muted`.
   - Finished rotation kicker: `FINAL · YOU WON 7–5` (green) or `FINAL · LOST 5–7` (muted).
   - Sides: pair names 15/600 over their points (mono 40/44 700, −1.5px). Yours sit on the left in `cart-you-text`; theirs on the right in `text-muted`.
   - Match bar: 10px tall, radius 5, track `surface-2`. Your points fill from the left in `cart-you`. Theirs fill from the right in `text-muted` at opacity .7 (.55 in light). A track-coloured part would look empty, which was a council blocker.
   - The bar has a 2px `text-muted` line at 6½ / 12 (54.17%), sticking out 3px above and below.
   - Under the bar (13px `text-muted`): `4 pts left` on the left (2 × holes not yet counted), and `6½ wins` (weight 600) centred under the 6½ line. A finished rotation says `Match over`.
   - The bar fills only for counted holes.
4. **Hole strip.** Six tiles, 56px tall, gap 4, `radius-md`.
   - Hole number: 15/600 `text-muted`. The selected tile has a `surface-2` fill and its number in `text`.
   - Under the number: **your points on that hole**, mono 15/700. `+2` / `+1½` / `+1` / `+½` are in `cart-you-text` (green whenever > 0, selected or not); `0` is `text-muted`.
   - Scores in but not counted yet: `–` muted. Not started: blank.
   - No dots and no legend. They're replaced by this number and by §1.5.
   - Tap a tile to select it. The default selection stays as today (`defaultHole`).
5. **Hole detail** — 6px under the strip, a 1px top divider (the 021 5% line, `--ce-line`), 10px top padding.
   - **Four columns:** first names 15/600 (yours `cart-you-text`, theirs `text-muted`), each over a 34px score mark (`ui.mark`, mono 20). A missing score shows as `–` in muted.
   - **Scores that didn't count are dimmed** (§2): the number goes `text-muted` and a circle / square outline goes `--line`. A double keeps its red rings, so red always means double; only its number mutes. This is the visual cue the owner asked for beyond words; all four reviewers proposed it independently.
   - **Lines under the scores, 18px below them** (the owner asked for more room than the 10px drawn earlier).
   - Hole counted: two rows, 6px apart.
     - `Low ball` / `Low total` label: 15px `text-muted`, 86px wide.
     - Winner: 15/600. Your names are in `cart-you-text`, theirs in `text`, and a tie says `Tied` in `text`.
     - On the right, mono 15/700: `+1` (green if yours, muted if theirs), or `½ each` (muted) for a tie. Never a bare `½`.
     - The low-ball winner is the player(s) who made it (`Josh`; `Andrew` in the history frame). Low total names the pair (`Andrew + Alex`).
   - Not counted yet: one 17/23 line instead.
     - Yours in: `Your scores are in.` then, in muted, `Josh + Brandon haven’t posted yet.`
     - Theirs in: `Josh made 4, Brandon 5.` then, in muted, `A 4 halves low ball. 8 or better between you takes low total.` Compute it from **net** scores. When a stroke applies, say `Josh made a net 4` (flagged).
     - Nothing in: no line.
   - One-number team scores (`g.ncomp === 1`): only the `Low ball` row (`riderview` already copies it into `lowTotal`). Plus/Minus: keep today's detail; out of scope.
6. Tab bar, unchanged.

3 carts for 6: your cart has two matches per hole. Whatever picks the match on Matches today keeps doing so; each match uses this layout.

## 2 · The rule for which scores count (pure, one unit test)

A score counts only once all four are in, and it's judged on **net** scores:
- **Low ball:** your pair's lowest net counts if it's ≤ their lowest, and theirs counts if it's ≤ yours. A tie keeps both. Two equal lows in one pair both count.
- **Low total:** if your pair's total is ≤ theirs, both your scores count; likewise for theirs. A tie keeps all four.
- Everything else is dimmed. Until all four are in, nothing is dimmed.

Examples (frames 03 / 04 / 06):
- Andrew 4, Alex 5 v Josh 4, Brandon 6: Brandon is dimmed.
- Andrew 5, Alex 4 v Josh 3, Brandon 7: Andrew and Brandon are dimmed.
- Andrew 3, Alex 5 v Ant 4, Steve 4: nothing is dimmed, since low total is tied 8–8.

Put it in a pure helper next to `riderState` / `ryderState`, for example `holeLines(hole, usNames, themNames)` in `js/riderview.js`. It returns `{ counts: [bool ×4], lowBall: { who, text, pts }, lowTotal: {…}, need }` and builds every word in §1.5. It **reads** the engine's hole entry (`lowBall` / `lowTotal` = `us` | `them` | `halved` | `pending`, `net.us` / `net.them`, `points`, `whoIsIn`) and never re-scores. One test covers the three examples plus a not-all-in hole.

## 3 · Enter: your cart in a card (changes 022 §1 and the 021 header)

Frames 10 (dark) and 11 (light).

- **Your cart's rows sit in one card:** `surface-1`, `radius-xl`, padding **2px 16px 6px**, 2px below the match line.
  - The owner flagged 8px as too tight against a picked pill; the inner padding is now 16px.
  - Pad gap 6px. The divider between your two rows is `rgba(255,255,255,.06)` (light `rgba(11,13,16,.06)`); the first row has no top border.
  - Unpicked pads take the card's colour. Light theme adds `shadow-card`.
- **The green rail (022 §1) is removed:** the card now says “your team”. In the council, all four picked this “d1” option over wells, a green tint, or card + wells.
- **The match line (022 §2) is unchanged** and sits above the card. The standing is green only when you're up (`2 DN` muted).
- **The other cart's quiet row:** no top border after the card, 4px gap.
  - When that cart isn't the one you're playing on this hole (Team Ryder Cup: your foursome's other cart is often not your opponent), it starts with `Your group` (13/500 `text-muted`).
  - When it *is* your opponent, there's no label; the match line already names them.
- **Header, left-aligned:** `Hole 11` (24/28 700, −0.5px), then `Par 3` inline (17/500 `text-muted`, 8px gap). On the right: ◀ ▶ ⋯, 44px each.
  - Tapping `Hole 11` still opens the hole grid.
  - The ⋯ is the round menu. For the organizer, `Fix hole 11` (`fixhole-open`) becomes its first item (flagged).
  - The team Enter header drops `Hcp` and the course name, as in the approved frames; strokes already show per row (`1 stroke · net 4`).
- Light theme: a picked double on the dark pill uses `#ff6b6b`, as shipped in 022's `.ce` light override.

## 4 · Motion: “new since you last looked” (build last)

The rings are required; the fill is small and can ship in the same change.

- **What's new:** a hole counted in this match since you last had Matches open on it.
  - Store `glb.seen.CODE.mx` = `{ [matchId]: countedHoles }` through `db.local`.
  - Update it once the screen has been shown (after the motion, or at once with reduced motion).
  - The first visit sets it without rings.
- **Static:** each new tile gets a 1px **dashed** `text-muted` ring, inset 0, `radius-md` (frame 05).
- **On open:** the new tiles' values appear one by one, **120 ms apart**, each a 200 ms opacity 0 → 1 with scale .9 → 1, ease-out.
  - At most 4 tiles animate; older ones simply show. Whole sequence < 700 ms.
  - The card's numbers roll from the old to the new value over **300 ms**, and the bar widths ease over 300 ms.
- **Rings fade** (200 ms) after **2 s** or at the first touch, whichever comes first.
- Plays once per hole. Nothing moves a hit target. Survives redraws the 021 way (`data-t0` + `ui.syncMotion`).
- Reduced motion: rings only (no fill, no roll), still faded at 2 s.

## 5 · Open question for the owner (motion pass, not this build)

When a rotation **finishes while you're away**, should opening Matches first show that finished rotation (its final result, the last hole's points landing), then move you to the live rotation? The owner's instinct is yes: “bring you back to show you what happened and then move you to the next screen”. He wants to decide the timing in a dedicated motion pass. **Build nothing for this yet:** Matches opens on the live rotation, as today.

## 6 · Flags (decide while building; note them in your summary)

- `½` for a halved rotation in the picker (not drawn).
- `made a net 4` wording when strokes apply.
- Moving the organizer's Fix hole into the ⋯ menu.
- No new tokens: everything above uses existing ones, plus 021's 5% divider (already flagged as `line-faint` in 021 §8).

## 7 · Build order and testing

1. Matches layout + `holeLines` with its test (`npm test`).
2. Enter card + header + `Your group`.
3. Motion (§4).

The change touches only views and a pure helper: no engine, sync or database work. Set this status to “Status: built in <commit>” when done, and update ARCHITECTURE.md §13a.
