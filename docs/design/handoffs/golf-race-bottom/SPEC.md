# Race screen: bottom card (replaces "Now · hole 8")

An update to the foursome split-point Matches screen ("The race", in `golf-race-tabbar/02-matches-foursome/`). The static **"NOW · HOLE 8 · PAR 5 · 1 PT UP FOR GRABS"** card under the race is removed: it never changed and only linked to Enter. In its place is **one card that switches between two views** on its own:

| When | Card shows |
|---|---|
| Normally | **Points by hole**: where everyone's points came from |
| From hole 16 on, **or** from hole 13 on when the top two are within 1 point, **or** the hole being played could lock the match | **What this hole does**: the stakes of the current hole |
| Round finished | Points by hole (final) |

No toggle and no tap action; it just switches. Screenshots: `screenshots/race-thru7` shows Points by hole; `race-thru14` and `race-thru17` show What this hole does. The `mockups/` are design-tool files for reference only; don't copy their markup.

## 1. Points by hole
- Card: `surface-1`, radius 18, label `POINTS BY HOLE`, with `7 OF 18 PLAYED` in mono on the right.
- One row per player, sorted the same as the race (leader first):
  - Name (you in green, others in `text`), 58px wide.
  - **18 equal cells**, 22px tall, radius 4, 2px gap. Each played cell is a `surface-2` box filled from the bottom by the player's share of that hole: 100% = won alone, 50% = 2-way split, 33% = 3-way, 25% = 4-way, 0 = no point. Fill is green for you and `text` for everyone else.
  - Unplayed holes are 1px dashed `line` outlines.
  - Total points on the right (mono, `3¼`).
- Axis under the cells: hole numbers 1, 9 and 18 only (10px mono, `text-muted`).
- Legend line: "Full = won alone · Half = split 2 ways · Quarter = 4 ways".
- Only completed holes count (all 4 scores in). The hole in progress stays dashed.

## 2. What this hole does
- Card: label `WHAT HOLE 15 DOES`, with `PAR 4 · 1 PT` on the right.
- Up to 4 outcome rows (15px text on the left, a mono uppercase result on the right, hairline dividers):
  1. **You win it alone**: your new margin ("UP 1½").
  2. **You split it with [closest rival]**: "STILL UP ½".
  3. **[Everyone else] win it**: e.g. "Justin or Peter win it" → "STILL UP ½ · LOCK 8½" (show the new lock line when it changes).
  4. **[Closest rival] wins it alone**: "DOWN ½" / "ALL SQUARE".
- Results are worded from **your** side: UP x, STILL UP x, ALL SQUARE, DOWN x, LOCKED (if that outcome clinches it), and on the last hole YOU WIN / ANDREW WINS with the final score ("8 TO 7½"). Use the tiebreak (most outright wins) if an outcome ends in a points tie: "YOU WIN ON OUTRIGHT WINS".
- Results that are good for you are green; the rest are `text`. Never red.
- If you're OUT, word it from the leader vs the chaser instead: "Mitchell wins it alone → Mitchell locks it".
- Combine outcomes that end the same way into one row ("Justin or Peter win it") so it stays at 4 rows max.

### How to compute it
Simulate each outcome on top of the current points: who takes the hole's point and how it splits. Then recompute margin, lock line, locked and OUT with the same game-math module as the race. Keep this in that module so it's testable. Sample cases from the screenshots:
- Thru 14 (M 6, A 5½, 4 left), hole 15: M alone → up 1½; M+A split → up ½; J or P → up ½, lock 8½; A alone → down ½.
- Thru 17 (M 7½, A 7, 1 left), hole 18: anything except Andrew winning alone → you win; Andrew alone → Andrew wins 8 to 7½.

## Rules
- Same design system as the rest of the screen: tokens.css, Geist/Geist Mono, fractions as real glyphs, green only for you.
- The card sits above the floating tab bar with enough bottom padding to scroll clear of it.
