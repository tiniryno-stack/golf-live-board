Night Round is the look of Golf Live Board: a calm, dark, instrument-panel style where the numbers do the talking. It is built for phones held in one hand on a golf course, often in bright sun, often with a glove on. Dark is the default theme; light is a full second theme, not an afterthought.

## Principles

- **Fast and impossible to mess up.** Every tap target is at least `tap-min` (48px). Score steppers are `stepper` (88px). One primary action per screen, at the bottom, `button-primary` tall.
- **Your stuff is green.** On your phone, your cart or team is always `cart-you`. Nothing else is green.
- **Scores look like a scorecard.** Golfers read marks, not numbers: every score anywhere uses the Score mark component.
- **Red means double bogey.** `double` is used only for double bogey or worse. No team is ever red. Problems and warnings use `warn` (amber).
- **Defaults over questions.** Setup asks only what has no sensible default; everything else shows its default value and can be changed.

## Color

- Ground is `bg`; content sits on `surface-1`; inset controls on `surface-2`; the selected segment of a segmented control is `surface-3`.
- Text is `text`; secondary text and labels are `text-muted`. Both read on `bg`, `surface-1` and `surface-2` in both themes.
- Teams: your own cart is `cart-you` (text in `cart-you-text`). Other carts keep their letter's color: A `cart-a` (orange), B `cart-b` (blue), C `cart-c` (pink), D `cart-d` (violet).
- A team card is a tint plus a full outline in the team's color (`tint-you` + `cart-you`, `tint-b` + `cart-b`…). Never a colored stripe down one edge.
- Teams are also told apart by name, letter or position, never by hue alone.
- `warn` / `warn-bg` for scorecard problems, the organizer-only box and "what's at stake" callouts.
- `button` / `on-button` for the primary button and the active tab.

## Type

- Geist (`sans`) for words, Geist Mono (`mono`) for every number, code and uppercase label. Both load from Google Fonts.
- Screen titles `screen-title`; the hole number `hole-title`; match and leader headers `match-title`.
- Rows `body` / `row-title`; sublines and hints `body-sm`; small notes `caption`.
- Numbers: `score-hero` inside big score marks, `score-big` for match scores, `points` on the leaderboard, `score-cell` in scorecards.
- Uppercase kickers and section labels use `label` (mono, 11px, +1.1px tracking).

## Score marks

| Result | Mark |
|---|---|
| Eagle or better | double circle |
| Birdie | circle |
| Par | plain number |
| Bogey | square, `text-muted` |
| Double bogey or worse | double square in `double` with `double-bg` fill |

The same marks show on Enter, the scorecard, the player card and score pickers. A score not entered yet is a dashed outline in `line`.

## Layout

- Design width `screen-width` (393px, iPhone 15); must still work at 375px.
- Side gutter `space-4`; section labels and titles sit at `space-5`.
- Cards use `radius-xl`; hero cards and the tab bar `radius-2xl`; rows and tiles `radius-lg`; buttons and segments `radius-md`.
- Bottom tab bar on game screens: Enter, Matches, Board, Card. The active tab is a `button` fill.
- Lay out lists as aligned columns: in a player list the handicap pill sits in a fixed column under an `HCP` label, then the remove button; a row without a remove button keeps an empty spacer so columns line up.

## Interaction patterns

- **Segmented control** for switching views or picking one of a few options. Keep segments short: a name and one short line at most.
- **Expand in place** for looking at someone else's match or group: your item folds into a pinned green bar at the top, theirs opens below in its own outlined box labeled WATCHING, in its own colors only. Never navigate to a separate screen for this.
- **Hints** under a choice change with the choice and say only what that option means.
- **Score source** on rows you can enter for others: "✓ From Sam's phone", "Waiting on Jake · tap to enter", "Entered by you".

## Voice

- Plain, short, golf words: hole, par, birdie, low ball, low total, the turn, tee time, cart.
- Say what happens: "Start round · 5 players", "Next: pick a game", "Tap two names to swap partners."
- Errors say what's wrong and how to fix it: "Hole 14 says par 8. Par is always 3 to 6."
- Sentence case. No emoji in the UI.

## Iconography

Simple 2px-stroke line icons with round caps (flag, two rings, list bars, grid, chevrons, share). There is no icon set in this system yet; draw icons inline at 20–24px in `currentColor`.

## Logo

There is no logo yet. Set the name "Golf Live Board" in Geist 800.
