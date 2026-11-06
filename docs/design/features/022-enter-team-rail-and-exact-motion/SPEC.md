# 022 · Enter: team rail, named match line, and the exact motion

Status: built in 1becaa2

**Changes 021** (build 021 and this together; where they differ, this wins). The owner approved the 021 prototype “to a tee” and asked for three things before shipping: a subtle sign of which players are your team, the opponents' names instead of a cart name, and one touch that makes the screen feel a little less bare. A council round compared four versions (`screenshots/explored/team-signal-four-versions.png`); the green rail won (8.5 · 8.5 · 7.5, Product 7). A section label and a two-sided match bar both brought clutter back and were dropped.

**Ship the prototype exactly.** `mockups/enter-final.html` is the approved behaviour: open it in a browser from this folder (it loads the repo's tokens and fonts) and tap the scores; tap the Mike / Justin row to fill their scores and see the hole's points. `motion.css` holds its exact animation values and `reward.js` its exact rules as pure functions — copy them, don't re-derive them. `mockups/canvas/Play.dc.html` is the same prototype as a canvas artboard (with the ⋯ sheet and par 3 / 4 / 5 holes); it's on the design canvas at https://claude.ai/artifact/5gQDphWBkb6TRRjvpJiTWi, board **Pass 4 · tap to play (prototype)**.

## 1 · The team rail (new)

- A **3px** wide line in `cart-you`, `border-radius: 2px`, in the left gutter **10px left of the content edge** (x ≈ 6px on a 393 screen), running from the top of your first player's name (12px below the row's top divider) to the bottom of your second player's pads (8px above the next divider). One continuous line for your cart's rows. See `01-hole-start.png`.
- It never animates, never changes with a pick, and isn't a tap target (`aria-hidden`).
- Only on the live hole's rows of **your** cart. Not on the other cart's row, not inside the other cart's sheet, not on preview / locked read-only rows (021 §5).
- 3 carts for 6 (`threeCartRotation`): same rail on your two rows.
- Design system: the README says “never a colored stripe down one edge” — that rule is about **rounded cards**; this rail sits in the gutter beside flat rows, with no card. Add that clarification to the README when building.

## 2 · The match line (replaces 021 §1 “Match line”)

`Andrew + Sean` on the left (`row`-weight 15/600, `text`) · on the right, the standing `2 UP` (mono 15/700, `cart-you-text`; `AS` / `1 DN` in `text-muted`) then, 12px after it, `vs Mike + Justin` (15/500, `text-muted`).

- Names: the two first names of each cart in your current match, `displayNames` style (“Andrew B.” only on a clash), joined with “ + ”. **Your cart first, then theirs.** Read them from the match on the hole being shown (`matchesFor(hole)` / the 015/018 match state), so they change on the first hole of each rotation. In 3 carts for 6 your cart has two matches per hole: show the first (`matchFor`) — the same match the standing comes from.
- No cart names (“Fore Play”) on this line.
- Long names: the left side (`Andrew + Sean`) truncates with an ellipsis first; the standing never truncates.

## 3 · The hole's points (changes 021 §7.5 placement and color)

When the last of the four scores lands:
- The standing rolls to its new value (300 ms from 200 ms, as 021).
- `vs Mike + Justin` fades out (from 450 ms) and the points fade in **in the same spot** (one grid cell, so nothing moves or collides), hold ~2.4 s, then `vs Mike + Justin` fades back. Frames: `03-points-0450`, `04-points-1200`, `05-points-3400`, and `06-half-point-1200`.
- Points color: **`text`** for `+2 points` / `+1½ points`, **`text-muted`** for `+1 point`, `+½ point`, `No points`. (021 said green for 1½+; green now stays only on the standing, so one line has one green.)
- Text from `reward.js → pointsLine(points.us)`.

## 4 · Exact motion — `motion.css` (adds to 021 §7)

`motion.css` is the prototype's CSS, cleaned of dropped ideas; class names are mapped to the Enter markup in its header comment. Everything in 021 §7 still holds (picked state visible at 0 ms, nothing moves a hit target, interruptible, animate only right after the tap via `ui.foldIn`, no haptics, reduced motion keeps only a word fade). Two exact values not spelled out in 021:
- The SVG mark paths and their lengths come from `reward.js → markPaths()` (circle r = size/2 − 1 and − 5.5; rounded square inset 1 and 5.5, corner 4). Set `--len` on each `.ln.draw` path to its length. Second outline's draw delay: `.18s`.
- The picked double on the white pill: `#b42318` (the light theme's `--double`) for the number and outline — see 021 §8 for the token proposal.

## 5 · Exact rules — `reward.js`

| Function | What it decides |
|---|---|
| `reward(strokes, par, strokesHere)` | the word (**net**), its tone (`quiet` par/bogey · `''` birdie · `big` eagle+ · `dbl` double+), `stamp` (net double or worse), `ripples` (2 for eagle+), `holdMs` (3000 eagle+, else 1600) |
| `markKind(strokes, par)` | the mark (**gross**): `cc` `c` `''` `s` `d` |
| `markPaths(strokes, par, size)` | SVG `d` + length per outline |
| `pointsLine(pts)` | `+2 points` … `+½ point` / `No points`, and its tone |
| `standing(diff)` | `2 UP` / `AS` / `1 DN` |

Move them into `js/ui.js` and write the one unit test 021 §9 asks for against them. Checked cases (all pass against this file): par 3 with 1 stroke — 3 → `Net birdie` no stamp, 5 → `Net bogey` red mark no stamp; no stroke — 5 → `Double` stamp, 1 → `Ace` 2 ripples 3 s, 6 → `Triple`, par 4 8 → `Quad`; points 2 / 1½ / 1 / ½ / 0 → `+2 points` / `+1½ points` / `+1 point` / `+½ point` / `No points`.

## 6 · Copy changes

- Other cart row and sheet use their **players' names** (`Mike – · Justin –`, `Mike + Justin · Hole 11`); Next waiting label: `Waiting on Mike + Justin`; offline: `Can't see Mike + Justin yet`.

Still only the Enter view and `ui` helpers — no score sync, engine or database change.
