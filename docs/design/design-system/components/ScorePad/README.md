A player row that opens into six one-tap score buttons, for entering someone else's score ("what'd you get?" from the cart).

**Consumer provides:** the player, where their current score came from (their phone, you, or none), the hole's par, and an onPick handler.

**Rules**
- The row's subline states the source: "✓ From Sam's phone" in `cart-you-text`, "Waiting on Jake · tap to enter", or "Entered by you · Sean can still edit" in `text-muted`.
- Opened, the row turns `surface-2` and shows a 3×2 grid: birdie, par, bogey, double, triple, max. Each number wears its Score mark; par gets a `text-muted` outline as the likely pick.
- Buttons are at least `tap-min` tall (52px used).
- Picking a score closes the row and opens the next player with no score.
- A player's own entry from their phone wins over one entered for them.
