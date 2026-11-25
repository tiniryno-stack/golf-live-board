# Course stamp library (036)

Hard-coded for now. One entry per course in `courses.json`; its emblem is `emblems/<slug>.png`.

- **Emblem:** cut from the club's own logo (reference files on branch `design/036-course-logos`,
  `docs/design/features/036-card-designs/logos/`), words removed. White on transparent, max 200 px,
  so the app can tint it any ink with a CSS or SVG mask.
- **`emblemRatio`:** width ÷ height, used to pick the stamp shape (wide = box).
- **`monogram`:** set only for the five lettering-only logos (Tierra Verde, Riverchase, Tangle Ridge,
  Grey Rock, Hancock). The stamp prints the letters instead of a picture.
- **`stamp`:** `{ shape: ring | oval | box, ink: blue | red | green | violet | amber | teal }`, fixed per
  course so it looks the same for everyone. The three played courses keep the inks agreed in the session.
- **`drawn`, `sure`:** notes from the logo collection (what the mark is, how sure we are it is current).
- Course key is `slug`. Matching a round's course to a slug (by name or OpenGolfAPI id) is still to do.

To redo a crop: edit its line in `SPEC` in `make-emblems.py` (needs the logo PNGs from the logos branch
in `lg/png/` and `mask.py` beside it), run it, then rebuild `courses.json`.
