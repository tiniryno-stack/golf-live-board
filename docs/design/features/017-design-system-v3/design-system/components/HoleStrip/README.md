Six hole tiles for one rotation of your match, each with two dots: low ball on top, low total under it. Tap a tile to see that hole's scores below.

**Consumer provides:** the six holes, per hole and per point who won it (us, them, halved) or how many carts are in, and the selected hole.

**Rules**
- Six equal tiles, `space-1` gap, 60px tall, `radius-lg`, `surface-1`; hole number in mono 15px 700 over the two 11px dots. Selected tile: 2px `text` outline inset.
- **Solid** = counted (all four scores in): `cart-you` for your point, `text-muted` for theirs, split half-and-half for a halved point.
- **Hatched** = one cart is in: a `text-muted` ring with three 45° stripes.
- **Dashed** = nobody yet: a dashed `line` ring.
- A legend under the strip names the three states (counted · one cart in · nobody yet) in `small`.
- Above it, the 1–6 · 7–12 · 13–18 Segmented control picks the rotation (history), with LIVE / WON n–n sublines.
