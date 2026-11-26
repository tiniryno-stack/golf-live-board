# 038 · "Full board" on the card back

Status: built in 6f64489 (branch `claude/037-home-v2`). Approved by Andrew Nov 26, 2026 with 037's second pass.

Changes 036 (`docs/design/features/036-card-designs/`, live on `main`): one addition to the card back. 036 is not
edited; everything else about the card stays as it is.

**Why:** since 037's second pass, your latest card is the top of Home and "How it finished" is no longer on Home. The
card back already shows who you played with; without a link, the card is a dead end back to its round.

**What:** on the card back (`backHtml` in `js/screens/locker.js`), a small **Full board ›** chip, bottom-left, in the
card's own ink (`--m-ink`), `ts-label` type: drawn about 36 px tall with a 48 px tap area. Tap → `#/e/<code>` (the card
already carries `code`; a finished round opens on its Board).

- The chip's tap must **not** flip the card (stop the card's own `lk-card` action).
- Shown on every opened card's back, in the Locker, on someone else's passport, and when reached from Home.
- Not drawn on the share image.
- Target: the "card back with Full board" frame in `docs/design/features/037-home/prototype-v2.html`.

**Test:** one unit or DOM-level test that the chip's action routes to the round and does not toggle the flip.
No database change. Styles in `css/locker.css`.
