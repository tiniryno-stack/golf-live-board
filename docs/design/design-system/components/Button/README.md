Buttons in three weights: primary (one per screen, full width at the bottom), secondary (`surface-2`), and ghost (no fill until pressed).

**Consumer provides:** the label (what happens, with a count or who's left when useful), the weight, the state, and onPress.

**Rules**
- Primary: `button-primary` tall (56–58px on Enter), `radius-xl`, `row` type, `button` fill and `on-button` text.
- Secondary and ghost inline buttons: at least `tap-min` tall, about twice as wide as tall, `radius-md`.
- States, all required:
  - Pressed: scale to 0.97 and darken (primary) or fill with `surface-2` (ghost).
  - Disabled: `surface-2` fill, `text-muted` label that says what's missing ("Next hole · Sean left", "Fix 3 things to continue").
  - Loading: a spinner before the label; the label stays ("Saving"); width doesn't jump.
  - Focused: `focus` ring.
- Use ghost for Edit, Change, Shuffle and Show more; secondary for the second choice beside a primary ("Copy link" next to "Text the group").
