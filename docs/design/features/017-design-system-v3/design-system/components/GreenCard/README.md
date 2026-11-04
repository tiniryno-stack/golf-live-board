The green yardage card on Enter (direction E1b): a small drawn green split into back / middle / front bands, with the three numbers lined up beside it. Behind the `gps` flag.

**Consumer provides:** the green outline for the hole, the three distances (yards), and the GPS state (finding, weak, live, location off).

**Rules**
- One row on `surface-1`, 92px tall (68px compact when space is tight), 14px gaps, 0 14px padding.
- Numbers in a 1 : 1.35 : 1 grid, centered: FRONT and BACK in 17px 600 `text-muted`, MIDDLE in 32px 700 `text` with −1.5px tracking. A `label` under each.
- The drawing is the real green outline turned so the line of play points up: three bands in `text` at 30% / 19% / 10% (back, middle, front), split by 2px `surface-1` gaps, a 1.5px `text-muted` outline and a 3px dot at the center. No satellite photo, no slope data.
- Finding or weak signal: every number goes `text-muted`. Location off: the card becomes a 56px row, "Turn on location for yardages" + a small Turn on button.
- Radius: 22px in today's code, between the scale's steps. Use `radius-2xl` (24) going forward.
