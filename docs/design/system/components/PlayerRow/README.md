A row in the setup player list: name on the left, the handicap pill in a fixed column, then a remove button.

**Consumer provides:** name, optional subline ("You · organizer", "New player"), handicap (or none), whether it can be removed, and handlers.

**Rules**
- Every row uses the same columns: name (flex), a 64px handicap pill under an `HCP` header label, then a 48px remove ×. Your own row has no × but keeps a 48px spacer so the pills line up.
- Handicap pill: `surface-2`, mono 16px. No handicap: a dashed `line` pill reading "Add". Last round's handicaps prefill.
- Rows are 58px tall with `line` dividers inside one `surface-1` card.
- The list takes any number of players; the game picker decides what games fit the count.
