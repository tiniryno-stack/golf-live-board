A quiet row that grows in place into its full card when you tap it, and folds back to the row when you're done. Replaces **Expand in place** (and the read-only sheets that showed someone else's match or scores).

**Consumer provides:** the row face (one line: names, marks or a summary, and the action word: Enter, Edit, Open), the card face (the full content), which one is showing, and what the open card's head says.

**Rules**
- **Row face:** at least 60px, full width, the whole row is the button. `row` text, scores as 26px Score marks or `–`, the action word + chevron right-aligned in `body` 600. No fill, separated by a `line-faint` hairline (or `surface-1` when it stands alone, as on the Board). Pressed: `surface-1` fill.
- **Card face:** `surface-1`, `radius-xl`, `shadow-card` (light only), the same side gutters as the row. Other people's content keeps their own colors; green only for what's yours.
- **Grow where you tapped:** the card opens in the row's place and pushes what's under it down. It never slides up from the bottom or covers the screen. Anything pinned to the bottom (Next hole, the primary button, the tab bar) never moves.
- **One open at a time** per screen. Opening one folds whatever was open into its row in the same motion. On Enter, opening the other cart folds your cart into a row with the green rail (tap it to swap back).
- **The head of an open card** says what you're looking at and how to close it, on the line that was already there (on Enter: the match line becomes "Entering for Sam + Jake · Done"). No extra header row.
- **Motion:** `motion-grow` (300ms, `cubic-bezier(.2,.8,.2,1)`) on the slot's height; the faces swap with `blur-swap` (old out 0–40%, new in 20–100%). A fold with nothing opening: 225ms. Animate only right after the tap (`ui.foldIn`), so the render loop can't restart it. Interruptible: a tap mid-motion jumps to the end state.
- **Reduced motion:** the slot jumps to its new size and the new face fades in over 150ms. No blur, no height animation.
- **Closing:** tap Done on the head line, tap the folded row, or it folds by itself where the screen says so (Enter: 1.2s after the last score with no taps, as 021 §4).
- **Not for side tasks.** Rules, handicaps, fixing a hole, the More scores sheet stay Bottom sheets.
- **Fit:** an open card must fit the screen without scrolling the page. If it can't (Enter with 5–6 others in a tee time), the card shows one pad row at a time and the yardage card folds away while it's open (028 SPEC §2.4).
