# 005 · Scorecard spacing

**Screen:** Card tab (scorecard grid), in-round.
**Type:** Visual polish only. No logic, data or behavior changes.

## Problem
On a 393px-wide phone, the score symbols (birdie circles, bogey squares, double+ boxes) are 26px wide in hole columns about 26px wide, so neighboring marks touch.

## Change
Give each hole column more width and make the marks a bit smaller so there's a visible gap between them. Apply this to every scorecard grid: your group, the expanded other group, Front 9 and Back 9, and Gross and Net.

| Property | Before | After |
|---|---|---|
| Grid columns | `74px repeat(9, 1fr) 34px` | `70px repeat(9, 1fr) 28px` |
| Grid card inner padding (sides) | 8px | 4px |
| Score mark size (all symbols, plus the dashed "pending" circle) | 26 × 26px | 24 × 24px |
| Circle radius (eagle, birdie, pending) | 13px | 12px |
| Score number size inside marks | 15px | 14px |
| Player row height | 38px | 42px |

Result: each hole column is about 28px wide, which leaves roughly 4px between marks horizontally and about 18px vertically between rows.

## Unchanged
- Symbol styles (border weights, double borders, square 3px radius, red only for double+), colors, the green current-hole column tint, and the legend.
- Hole, Par and Hcp header rows.
- Long player names still cut off with an ellipsis. At 70px, "Andrew B." shows as "Andrew…". That's acceptable.
- Tab bar, segmented controls and the other-group fold.

## Files
- `screenshots/card-front9-{dark,light}.png`: shows full rows, the best view of the spacing.
- `screenshots/card-back9-{dark,light}.png`: mid-round, with the current-hole tint and pending circle.
- `mockup.html`: standalone and interactive (Front/Back, other group). Add `?mode=light` to the URL for light mode.

## Testing
Small visual change. Don't run the full test suite or screenshot review for it; a quick visual check of the Card tab is enough.
