# 011 · Green card on Enter (compact, replaces 010's design)

This replaces the **design** in 010. Step 0 in 010 (the feasibility report on OSM data, GPS and effort) still applies, so do that first if you haven't. Changes from 010:
- The card is the compact **one-row** version (92px tall instead of 164px).
- **There is no green view.** The card isn't tappable. Ignore 010's Yds-B2 screen and its pin, carries and course-map colors.

Screenshots are in `screenshots/Yds-E1b-Card-Row-{dark,light}.png`. The mockup is `mockups/Yds-E1b-Card-Row.html`; add `?light` to the URL for light mode. Numbers are sample data. Screen size is 393 × 852, Night Round.

The glowing tab bar in the screenshots comes from **012** (a global component change); it isn't part of this feature.

## Where it goes
On Enter, between the hole header and your score card, **only when GPS is on for the round** (`settings.gps`). With GPS off, Enter stays exactly as it is today. With the card showing, your score card uses its compact size (72px − / + buttons, 96px score mark) so your whole group still fits above the tab bar.

## The card
- `surface-1`, radius 22, 92px tall, 14px side padding, 14px gap. It isn't a button, so it has no pressed state. Give it `role="group"` with an `aria-label` that reads all three numbers ("Green: front 149, middle 156, back 168").
- **Left: the green, 62 × 64.** The real green outline from course data, scaled to fit and rotated so your approach comes from the bottom. It's split into three bands of equal depth along your line, filled with `text` at 30% (back), 19% (middle) and 10% (front), with 2px `surface-1` gaps between bands. The outline is `text-muted`, and a dot in `text` marks the middle.
- **Right: one row, three columns (1 : 1.35 : 1), centered:**
  - FRONT: 20px mono 600 in `text-muted`, with a `label` (10px) under it.
  - **MIDDLE: 38px mono 700, letter-spacing −1.5px, in `text`**, with its label in `text`.
  - BACK: same as front.
- **GPS badge** in the hole subtitle: "Par 3 · Hcp 16 · ◢ GPS · ±4 YD", in mono `label` style, `text-muted`.

## States (not drawn; use the same card)
| State | What shows |
|---|---|
| Finding location | Numbers show "–", and the badge says "GPS · FINDING YOU" |
| Weak (worse than about ±15 yd) | Numbers drop to `text-muted`, and the badge says "GPS · WEAK" |
| Location permission denied | The card becomes a single 56px row, "Turn on location for yardages", with a ghost **Turn on** button |
| No green data for this hole, or more than about 600 yd away | The card is hidden |
| GPS off for the round | The card is hidden |

## How the numbers work
Draw a line from the player to the green's center. **Front** is where that line enters the green outline, **back** is where it leaves, and **middle** is the center. Round to whole yards, and update while Enter is open (`watchPosition`).

## New component (add to the design system)
- **Green card:** green outline with three bands, plus Front / Middle / Back in one row.
- **GPS badge:** mono, with an arrow icon, accuracy, and the states above.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
