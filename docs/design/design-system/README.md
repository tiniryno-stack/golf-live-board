Night Round is the look of Golf Live Board: a calm, dark, instrument-panel style where the numbers do the talking. It is built for phones held in one hand on a golf course, often in bright sun, often with a glove on. Dark is the default theme; light is a full second theme, not an afterthought.

## Source of truth

This system is the north star for how the app looks. Three things, one direction:

| What | Where | Role |
|---|---|---|
| **This design system** | claude.ai (this page); mirrored in the repo at `docs/design/design-system/` | Tokens, components, rules. Change the look here first. |
| **App Screens** canvas | claude.ai | Every screen as it is built today, dark and light, rendered from the app's code. Its **North star** page is the target; its **Archive** page holds older-style screens still live in other games. Start new designs from a North star screen. |
| **Feature handoffs** | repo `docs/design/features/NNN-name/` | What a change does (SPEC.md is the truth; mockups are reference). Never edited after handoff; a change gets a new number. |

- The code's `css/tokens.css` is copied byte for byte from the repo copy of `tokens.css`, and a test fails if they drift. So a token change goes here → repo `docs/design/design-system/` → `npm run tokens`.
- Exploration canvases are scratch. Once a feature is handed off, its canvas is archived or deleted; what got built shows up in App Screens.
- New features reuse these tokens and components. Anything that needs a new color, size or type style is flagged and added here first.

## Principles

- **Fast and impossible to mess up.** Every tap target is at least `tap-min` (48px). Score steppers are `stepper` (88px). One primary action per screen, at the bottom, `button-primary` tall.
- **One screen does one thing.** Setup is one decision per screen; Enter is entering scores. Side tasks open in a Bottom sheet instead of a new layout.
- **Green means you, and only you.** On your phone, your cart or team is always `cart-you`. Not success, not hints, not confirmations.
- **Scores look like a scorecard.** Golfers read marks, not numbers: every score anywhere uses the Score mark component.
- **Red means something is wrong.** `double` for double bogey or worse; `error` (the same red) for input errors. No team is ever red. Problems that need fixing use `warn` (amber).
- **Every action gets a response.** Pressed, loading, saved, copied: the user always sees that the app heard them.
- **Defaults over questions.** Setup asks only what has no sensible default; everything else shows its default value and can be changed.

## Color

- Ground is `bg`; content sits on `surface-1`; inset controls on `surface-2`; the selected segment of a segmented control is `surface-3`.
- Text is `text`; secondary text and labels are `text-muted`. Both read on `bg`, `surface-1` and `surface-2` in both themes.
- Teams: your own cart is `cart-you` (text in `cart-you-text`). Other carts keep their letter's color: A `cart-a` (orange), B `cart-b` (blue), C `cart-c` (pink), D `cart-d` (violet); E `cart-e` (teal) and F `cart-f` (gold) only exist in 5–6 player Match play.
- **Two-side games (Team Ryder Cup) use no cart colors at all.** Your side and your cart are `cart-you`; the other side is neutral `text-muted` (cup segments, match bar, dots) and plain `text` for names. No blue "away" team.
- A team card is a tint plus a full outline in the team's color (`tint-you` + `cart-you`, `tint-b` + `cart-b`…). Never a colored stripe down one edge.
- Teams are also told apart by name, letter or position, never by hue alone.
- Confirmations ("Saved", "Copied") are neutral: `text` with a check icon on `surface-2`. Never green.
- `warn` / `warn-bg` for scorecard problems, the organizer-only box and "what's at stake" callouts.
- `button` / `on-button` for the primary button and the active tab. `focus` is a 2px ring, offset 2px, on any focused control.
- `scrim` dims the screen behind a bottom sheet.

## Depth

- Dark mode: depth comes from lighter surfaces (`bg` → `surface-1` → `surface-2`), not shadows. Keep borders low-contrast (`line`).
- **The one glow:** in dark mode the floating tab bar uses `shadow-dock`, a lit top edge plus a soft white glow. It is the only glowing surface. Cards, segmented controls, selected segments and anything nested never glow.
- Light mode: cards get `shadow-card`, the tab bar `shadow-dock`; toasts `shadow-float`; bottom sheets `shadow-sheet`. If a shadow is the first thing you notice, it's too strong.
- Avoid cards inside cards. Group with spacing first; nest only when the inner thing is a control (a score tile, a pill).

## Type

Six styles, no more:

| Style | Use |
|---|---|
| `number-xl` | The one hero number per screen: big score, match score, leader points |
| `title` | Screen titles, the hole number, match headers (mono for point totals) |
| `row` | Names in rows, buttons, game options |
| `body` | Sublines, hints, segment labels, sheet text (mono for scores in rows and cells) |
| `small` | Score source, notes, tab labels |
| `label` | Uppercase mono kickers and section labels |

- Geist (`sans`) for words, Geist Mono (`mono`) for every number, code and uppercase label. Both load from Google Fonts.
- Big type is tight: letter-spacing about −3% and line-height 110–120% on `title` and `number-xl`.
- 12px (`label`) is the smallest text anywhere; it has to read in sun.

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

- Design width `screen-width` (393px, iPhone 15/16); must still work at 375px (iPhone SE).
- The group plays from the **home screen app** (standalone, no Safari bars). Every screen must fit an **iPhone 16** at minimum. Enter never scrolls; Matches and the top of the Board (leader and your position) show without scrolling. The repo's fit check (`npm run test:fit`) enforces this at SE, 13 mini, 15/16 and Pro Max sizes.
- **One screen, one purpose.** Enter is for entering scores (no cup score there); Matches is your match; Board is everyone; Card is the scorecard. If a screen needs a second job, it gets a sheet.
- Side gutter `space-4`; section labels and titles sit at `space-5`. Spacing uses the `space-*` steps only.
- Each section scrolls in one direction: vertical lists, or a horizontal row, never both.
- Cards use `radius-xl`; hero cards and the tab bar `radius-2xl`; rows and tiles `radius-lg`; buttons and segments `radius-md`; sheets `radius-sheet` on top.
- Bottom tab bar on game screens: Enter, Matches, Board, Card. It floats 24px above the bottom (plus the safe area) and hides while a sheet is open and during setup.
- Lay out lists as aligned columns: in a player list the handicap pill sits in a fixed column under an `HCP` label, then the remove button; a row without a remove button keeps an empty spacer so columns line up.

## States and feedback

Every control has these states, all designed:

| Control | States |
|---|---|
| Button | default, pressed (scale 0.97, darker fill), disabled (says what's missing), loading (spinner, label stays) |
| Input | default, focused (`focus` ring), error (`error` border + message under it), warning (`warn` border + message) |
| Score stepper | pressed (button darkens), changed (the score bumps), saved (small check), offline (row shows "Will send when back online") |

- After an action, confirm it: a Toast slides up for "Copied" or "Score saved" and leaves on its own after 2 seconds; an inline check is enough for repeat actions like entering scores.
- Loading data: keep the layout and show placeholders; never a blank screen.
- Connection: a small "Reconnecting…" pill under the header while offline; scores entered meanwhile are kept and sent later.

## Motion and gestures

- Swipe right to go back in setup. Swipe down to close a sheet.
- Never swipe to change holes on Enter (too easy to do by accident); use the arrows or the hole grid.
- Long-press a score on the scorecard to see who entered it and edit it.
- Motion is short and functional: 200–450ms ease-out; folds, sheets and score bumps only. Respect reduced motion.

## Empty states

Design the first-time and no-results views for every list:

- Say what's missing in one line, show the one action that fills it ("New round"), and point at it.
- No search results: say nothing matched the words typed, offer a fix ("Check the spelling", "Enter the scorecard yourself").
- Before scores exist, the Board and Matches show the matchups and "Waiting for the first scores", not zeros.

## Games

Five games. They share Enter, Matches, Board and Card, and differ only in the pieces listed.

| Game | Players | Board shows | Enter input |
|---|---|---|---|
| Scorecard only | any | Players table (gross / net) | Score stepper, or "you first" with Score pads for others |
| Match play | 2–6, carts A–F | Leaderboard rows | Score stepper |
| 2v2 | exactly 4 | Leaderboard rows; Matches is the race view | Score stepper |
| Partner “Rider” Cup | 6 or 8, carts of 2 | Leaderboard rows, official solid + provisional hatched | Score stepper, your cart open, theirs a slim row |
| Team Ryder Cup | exactly 16, two sides of 4 carts | Cup bar + Match rows by rotation | Score pad strip (4 pads), Match flag in the card head |

- Partner “Rider” Cup is the name (quotes intentional). Team Ryder Cup setup adds Carts → Draft (snake) → Tee times.
- Team Ryder Cup holes count only when all four scores are in, so it has no provisional points: a hole is solid (counted), hatched (one cart in) or dashed (nobody yet).

## Direction: the Team Ryder Cup style is the standard

Team Ryder Cup on `main` (handoffs 015 + 016) is how every game should look. Other games adopt its patterns wherever the game allows; a game keeps its own piece only where its rules need one.

- **Keep as is:** split point's race (Matches and its Board). It already works the way it should.
- **First to move over: Partner “Rider” Cup** (handoff 018). It is the closest to Team Ryder Cup (carts of 2, cart vs cart, rotating opponents) and takes its screens as they are, with one difference: **it keeps the cart colors** (your cart green, the others `cart-a…d`) on Enter, Matches, Board and the scorecard. Setup is Carts → Tee times (no draft); matchups become one optional Rider-only screen. Four carts stay a ranked list on the Board, never a cup card.
- **Team Ryder Cup's finish gets bigger** (handoff 019): the cup card becomes a result card with the trophy, the winner in title size, an 88px cup score and both sides' cart records.
- Later: 2v2, Match play (carts A–F stay) and Scorecard only ("you first").

| Screen | The standard (Team Ryder Cup) | Replaces (legacy, still live in other games) |
|---|---|---|
| Enter | One card per cart: Match flag head, Score pad strip per player, other cart as a slim row with Edit, Hole progress, plain Next hole. Never scrolls. | Score stepper rows (− · mark · +), the "you first" hero row |
| Matches | Your match only: rotation picker, score card with a match bar, Hole strip, the selected hole's scores (split point keeps the race) | Score card + hole table, Expand in place for watching others |
| Board | A hero card (Cup bar) over rows grouped by rotation; tap a row for a read-only sheet; Players table (thru · gross · proj · net) | Leaderboard rows with hatched provisional points |
| Color | Your cart green, everyone else neutral (Team Ryder Cup only) | Cart colors stay on every other game |

- Counting rule that goes with it: a hole counts once every score in the match is in. No provisional points.
- New game designs start from the North star page of App Screens, not from the Archive.
- Legacy components stay documented (Score stepper, Expand in place, Leaderboard row) until no game uses them.

## Interaction patterns

- **Segmented control** for switching views or picking one of a few options. Keep segments short: a name and one short line at most.
- **Bottom sheet** for side tasks that should keep you in place: handicap stepper, rules, max score, fixing a hole, changing tees.
- **Expand in place** for looking at someone else's match or group: your item folds into a pinned green bar at the top, theirs opens below in its own outlined box labeled WATCHING, in its own colors only. Never navigate to a separate screen for this.
- **Hints** under a choice change with the choice and say only what that option means.
- **Progress** under the Enter card: Hole progress, 18 short segments with a gap where each rotation ends.
- **Score source** on rows you can enter for others: "✓ From Sam's phone", "Waiting on Jake · tap to enter", "Entered by you".

## Buttons

- **Primary**: `button` fill, one per screen, full width at the bottom.
- **Secondary**: `surface-2` fill, for the other choice beside or under a primary.
- **Ghost**: no fill until pressed; for low-weight actions (Edit, Change, Shuffle) and list links.
- Width about twice the height for inline buttons; full width at the bottom of a screen.

## Voice

- Plain, short, golf words: hole, par, birdie, low ball, low total, the turn, tee time, cart.
- Say what happens: "Start round · 5 players", "Next: pick a game", "Tap two names to swap partners."
- Errors say what's wrong and how to fix it: "Hole 14 says par 8. Par is always 3 to 6."
- Sentence case. No emoji in the UI.

## Iconography

Simple 2px-stroke line icons with round caps (flag, two rings, list bars, grid, chevrons, share, check). Size icons to the line height of the text beside them: `icon` (24px) next to `row`, 20px next to `body`. There is no icon set in this system yet; draw icons inline in `currentColor`. A good match when one is chosen: Lucide.

## Logo

There is no logo yet. Set the name "Golf Live Board" in Geist 800. The home screen icon is labelled "Golf Board"; everywhere else the product is Golf Live Board.

## Version 3 (Nov 3, 2026)

Synced to what the app ships after handoffs 011–016:

- New components: Cup bar, Match row, Match flag, Hole strip, Hole progress, Green card.
- Score pad gains the strip layout (Team Ryder Cup Enter). Game option lists all five games.
- Tokens: `cart-e` and `cart-f` (5–6 player Match play) join the system; `glass` takes the near-opaque values the app uses; the tab bar's active pill is `surface-2` in light.
- Rule: two-side games never color the other side.

Known gaps between this system and the code, to close in a later handoff:

- Green card radius is 22px in code; the system says `radius-2xl` (24).
- `tint-e` and `tint-f` don't exist yet, so carts E/F get an outline without a fill.
- The app still carries old alias names (`--ink`, `--good`, `--t-A`…) and `line-strong`, `text-faint` and `tint-n`, which are being retired (repo BUILD-PLAN.md §2).
