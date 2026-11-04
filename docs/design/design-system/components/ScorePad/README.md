One-tap score buttons instead of − / +, in two layouts: the **grid** (open a player row to enter someone else's score) and the **strip** (Team Ryder Cup Enter, one row per player).

**Consumer provides:** the player, where their current score came from (their phone, you, or none), the hole's par, and an onPick handler.

**Grid (others' scores, "you first" Enter)**
- The row's subline states the source: "✓ From Sam's phone" in `cart-you-text`, "Waiting on Jake · tap to enter", or "Entered by you · Sean can still edit" in `text-muted`.
- Opened, the row turns `surface-2` and shows a 3×2 grid: birdie, par, bogey, double, triple, max. Each number wears its Score mark; par gets a `text-muted` outline as the likely pick.
- Buttons are 52px tall. Picking a score closes the row and opens the next player with no score.

**Strip (Team Ryder Cup Enter, handoff 016)**
- One row per player: ‹ · four pads · ›, in a 34px / 4 equal / 34px grid with a 4px gap. Pads and arrows are 52px tall, `radius-lg`, `bg` fill with a 1px `line` border.
- The four pads show a window of par−1 to par+2 by default, each number in its Score mark. ‹ › slide the window one stroke; the app remembers each player's window per hole.
- The likely pick (par) has a `text-muted` border. The picked pad fills `text` with the mark in `bg`. Tap the picked pad again to clear it.
- Above the pads: the name (15px, 700), a 7px dot per handicap stroke, and on the right TAP A SCORE (`label`), or the result in `cart-you-text` (under par) or `double`.
- Enter must not scroll: two strips plus the other cart's slim row, the Hole progress and Next hole fit an iPhone 16.

**Both**
- A player's own entry from their phone wins over one entered for them.
