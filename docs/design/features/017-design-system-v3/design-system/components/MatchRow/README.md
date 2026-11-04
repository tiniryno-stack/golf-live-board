One cart-vs-cart match on the Team Ryder Cup Board: your side's cart stacked on the left, theirs on the right, and a flag hung off the center line on the side that holds it.

**Consumer provides:** both carts' first names, the match state (not started, live with margin, done with result) and which side holds it; whether it's your cart.

**Rules**
- Rows sit under a rotation header: a 40px outlined strip (1px `line`, `radius-md`, no fill) with HOLES 7–12 in `label`, the rotation tally in the middle, and LIVE (`cart-you-text`) / DONE / UP NEXT on the right. Future rotations fold away under a chevron.
- Row: at least 54px, a 1fr · 0 · 1fr grid. Names are first names stacked, 13px / 16px 600. Your cart's names `cart-you-text`; a finished match's losing names `text-muted`.
- The half that holds the match gets a `surface-1` fill with `radius-lg` on its outer corners, and the Match flag hangs off the center line into it. All square: the flag sits centered on the line.
- Flag: 72×26px, mono 12px 700, `radius-sm`. Not started: 1px dashed `line`, `text-muted`, the tee time. Live (UP or all square): `text` fill, `bg` text ("2 UP", "2–2"). Done: `surface-3` with a check and the score ("✓ 6½–5½"). Halved: `surface-2`, `text-muted`.
- Tapping a row opens that match as a read-only sheet. Never color the flag by side.
