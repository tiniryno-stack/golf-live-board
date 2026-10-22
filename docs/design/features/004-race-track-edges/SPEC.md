# 004 · Race track: keep the lock line and pucks off the card edge

Status: built in 3a2346b
Changes: 002-matches-race (the race card on the foursome Matches screen)

## Problem
Early in a round the lock line sits near 18 (e.g. 17½ after a split on hole 1). It, its `LOCK 17½` label, and any puck at 18 end up jammed against the card's padding and border, or half outside it.

## Fix
1. **Inset the track.** Every lane's track has a 20px inner margin on both ends (half a puck's width), so 0 and 18 are never at the card edge.
   - Position of a value `v` (0–18): `left: calc(20px + (100% - 40px) * v / 18)`.
   - Use the same formula for the puck center, the filled bar's width (from the 20px start), the dotted reach tail, the lock line, and the axis labels (0 at 20px, 9 at 50%, 18 at 100% − 20px).
   - The track's gray line runs from 20px to 100% − 20px.
2. **Anchor the lock label by position**, so it never runs off the card:
   - lock / 18 > 0.78 → the label's **right** edge sits on the line (`transform: translateX(-100%)`).
   - lock / 18 < 0.22 → the label's **left** edge sits on the line.
   - Otherwise → centered on the line.
3. Pucks are centered on their value (`translateX(-50%)`); thanks to the inset, a puck at 0 or 18 stays fully inside. Remove any old "minimum 5%" clamp.

## Check
- `screenshots/lock-17-5-*`: hole 1 split between Mitchell and Andrew, lock line at 17½. The line, label and pucks all sit clear of the edge.
- `screenshots/lock-13-dark.png`: a mid-round case, unchanged apart from the inset.
- Also check a puck at exactly 18 (end of a dominant round) and the lock line at 0–2.
