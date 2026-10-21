A radio card in the game picker: game name, how many players it needs, one line on how it works, and why it's unavailable when it is.

**Consumer provides:** name, player-count rule, description, selected and disabled states, and the reason text when disabled.

**Rules**
- Selected: `surface-2` with a 2px `text` outline and a filled radio. Unselected: `surface-1`.
- The count rule sits top right in mono caps ("ANY NUMBER", "2–6 PLAYERS", "EXACTLY 4", "EXACTLY 8").
- A game that doesn't fit the player count is dimmed (55%) but still shows, with the fix spelled out: "Add 3 more players to play this."
- Games: Scorecard only (any), Match play (2–6), 2v2 (exactly 4), Cart game (exactly 8; name still open).
- Picking a game is always its own step after Players. Team games continue to a team-setup screen; the others start the round.
