The head of the Team Ryder Cup Enter card: who you're playing, THRU n, and a 72×26 flag with the match state. Tapping the flag opens Matches.

**Consumer provides:** the opponent cart's names, holes counted (thru), the state (up, down, all square) and margin.

**Rules**
- Head row 36px: "vs" in `text-muted` 600, then their names 15px 700 (ellipsis), then THRU n in `label`, then the flag.
- Flag: 72×26px, `radius-sm`, mono 12px 700. Up: `cart-you` fill, `bg` text ("2 UP"). Down: `surface-3`, `text` ("1 DN"). All square: `bg` with a 1.5px `text-muted` inset ring ("2–2").
- The Enter card is the only place it appears. Enter never shows the cup score, low ball / low total or anyone else's match: that lives on Matches and the Board.
- When you're entering for the other cart, the head swaps to ENTERING FOR THEM with a Back chip, and the card's outline goes from `cart-you` to `line`.
