How you look at another match (Matches) or another group (Card) without leaving the screen: yours folds into a pinned green bar, theirs opens below in its own box.

**Consumer provides:** your summary (label + score), the other item's header row and its full content, and which one is open.

**Rules**
- Your item collapsed: a 60px bar at the top with a `cart-you` outline on `tint-you`, a mono kicker ("YOUR MATCH · THRU 4") and the score. Tapping it reopens yours.
- The other item lives in a box with a `line` outline. Its header row reads "ALSO" when closed and "WATCHING" when open, with a chevron that flips.
- Open, it shows the same full layout as yours (score, bar, hole-by-hole table), full width, in the other teams' colors only. No green inside it.
- Their score is smaller than yours (44px vs 64px) so it reads as secondary.
- Animate with a height + opacity fold (about 450ms, ease-out); respect reduced motion.
- Never navigate to a separate screen for this; people mistake it for their own score.
