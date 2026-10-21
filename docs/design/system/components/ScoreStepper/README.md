A full-width player row with big − and + buttons and the score in its score mark; two of them stacked make the main team Enter screen.

**Consumer provides:** player name, the hole's par, current score (or none yet), whether the player gets a stroke, and the minus/plus handlers.

**Rules**
- Buttons are `stepper` (88px) square, `radius` 20px, `line` border on `bg`.
- The score uses Score mark at 112px with `score-hero` numbers; the label at top right names the result (BIRDIE, PAR, BOGEY…) in `label` style. Under par uses `cart-you-text`; double+ uses `double`.
- No score yet: the row gets a dashed `line` outline, the mark shows par as a dashed ghost, and the label reads "TAP − / + · PAR". The first tap starts from par.
- A stroke on this hole is a small `text` dot after the name.
- Wrap your cart's rows in a `surface-1` card with a `cart-you` outline and the team name plus live low ball / low total in the header.
- For an individual round (4 or fewer, no teams) use one hero row for yourself and compact rows with Score pad for others.
