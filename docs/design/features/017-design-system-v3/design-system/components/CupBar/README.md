The Team Ryder Cup score: both sides' points, what wins it, and a 12-segment bar with one segment per match.

**Consumer provides:** both side names, both point totals, matches left, the winning line (6½ of 12), and per match: whose point it is (us, them, halved) or not decided.

**Rules**
- A hero card: `surface-1`, `radius-2xl`, `space-4` padding, `shadow-card` (light only).
- Kicker on its own centered row in `label`: "8 LEFT · 6½ WINS", then "YOU WIN THE CUP" / "CLINCHED" when it's settled (`cart-you-text` when it's yours).
- Side names 15px 700 (they wrap, never cut off) over point totals in `number-xl` mono. Your side is `cart-you-text`; the other side's name is `text-muted`, its number `text`.
- Bar: 12 segments in two groups of 6, 3px gaps, each 12px tall with 3px radius on `surface-2`, and a 2×20px `text` center line between the groups (the 6½ line). A won match fills `cart-you` from the left (yours) or `text-muted` from the right (theirs); a halved match fills half of each.
- The other side never gets a cart color.
