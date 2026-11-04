# 019 · Team Ryder Cup · a bigger finish

Status: built in 25dcd48

When a Team Ryder Cup round is over (every score in, or finalized), the Board's cup card becomes the **final card**. Today the final state is the same card with FINAL on it; it should land like a result. Screenshots in `screenshots/`, mockup in `mockups/Ryder-Final.dc.html` (`?mode=light` for light).

## The final card (Board, replaces the cup card once the round is over)

- `surface-1`, `radius-2xl`, a 1.5px `cart-you` outline when your side won (a `line` outline when they did). The top 190px of the card get a `tint-you` wash (none when you lost). Centered layout.
- Kicker `label`: FINAL · 12 MATCHES.
- A 44px trophy line icon in `cart-you` (in `text-muted` when you lost).
- Winner: the side name in `title` size (36px 800) in `cart-you-text` (or `text` for them), then “wins the cup” in 17px 600 `text-muted`. A 6–6 round reads “Cup shared”.
- Cup score in mono, **88px** 700, −4px tracking: your points in `cart-you-text`, theirs in `text-muted`, a smaller en dash between.
- The 12-segment cup bar under it, same as the live card.
- One line in `small` `text-muted`: “Clinched on hole 16 · MVP cart **Joseph + Jay** 3–0” (MVP = most points; ties by fewest holes lost; the MVP cart name in `text`).
- Buttons inside the card: **Round recap** (primary, 56px) and **Share the result** (ghost). Share uses the share sheet with the existing recap image + the one-line result text.
- The organizer's **Finalize round** button stays where it is today (under the card) until the round is finalized; then the kicker reads FINAL · LOCKED.

## Under the card

Two stacked lists instead of the rotation strips (the strips stay reachable by tapping Players → Cup toggle; default view after the round is this):

- `label` header: TEAM ANDREW · 7 (in `cart-you-text` for your side), then one 40px row per cart: cart names, record in mono `small` `text-muted` (3–0, 1–1–1), points in mono 17px 700. Sorted by points, then wins.
- Same for the other side in plain `text`.
- Rows separated by `line` hairlines.

## Elsewhere

- Enter when final: the locked Final view as today, its button “See the final Board”.
- Matches when final: unchanged (rotation history).
- Headlines: the final headline (“Team Andrew take the cup 7–5”) fires once when the last counted hole lands.

## Not in this handoff

No engine changes. MVP cart is computed from the existing `ryderState`.
