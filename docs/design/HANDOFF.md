# Design handoff: Golf Live Board redesign (direction A · Night Round)

Put this whole folder in the repo at `docs/design/` and point Claude Code at it.

## What's in here
- **`design-system/`: how everything looks. Every screen, including new features, follows it.**
  - `README.md`: the brand book. It covers principles, color rules (green is only for you), the 6 type styles, depth, layout, states and feedback, gestures, empty states, buttons and voice.
  - `tokens.css`: CSS variables for every color, size, radius, spacing step and shadow, plus the 6 type classes. Dark is the default; put `light` on `<html>` for light mode. Import it once and use only these variables.
  - `tokens.json`: the same tokens as data, with a usage note for each one.
  - `components/<Name>/README.md`: what each component is for and its rules. `preview.html` shows how it looks.
- **`designspec.md`: product rules and decisions** (flows, games, setup, what each screen does). When a screen and the spec disagree, the spec wins.
- **`screens/`: one HTML mockup per screen, for visual reference.** These are design-tool files, so **don't copy the markup.** Rebuild each screen from the app's components using `tokens.css`. The short variable names in the mockups (`--s1`, `--tx2`, `--me`…) map to the tokens like this:
  - `--s1`/`--s2`/`--s3` = `surface-1/2/3`
  - `--tx`/`--tx2` = `text`/`text-muted`
  - `--ln` = `line`
  - `--me` = `cart-you`
  - `--btn` = `button`
- All sample data (Twin Creeks, Hogan's Heroes, scores, handicaps, PIN, links) is placeholder.

## Building something new (no mockup)
New features follow the design system; they don't invent new styles.
1. Reuse an existing component first; check `design-system/components/`.
2. Use only `tokens.css` variables and the 6 type classes. No new colors, font sizes, radii or shadows.
3. Follow the README rules:
   - taps at least 48px
   - one primary button per screen, at the bottom
   - green only for you
   - red only for double bogey and errors
   - side tasks go in a bottom sheet
   - other people's stuff expands in place
   - every list has an empty state
   - every action gets a response
4. If something really needs a new pattern or token, build it, then tell Andrew so it can be added to the design system and this folder.

## Screen index
| File | Screen | Spec section |
|---|---|---|
| `screens/enter-team.html` | Enter, team game (stacked rows) | §2 |
| `screens/enter-individual.html` | Enter, ≤4 players, no teams ("you first") | §2 |
| `screens/matches.html` | Matches (segmented control + other match expands in place) | §3 |
| `screens/board.html` | Board / leaderboard | §4 |
| `screens/card.html` | Scorecard (Front/Back, other group expands in place) | §5 |
| `screens/card-player.html` | Player card | §5 |
| `screens/setup-1-course.html` | ① Course | §6 |
| `screens/setup-1a-which-course.html` | ①a Which course? (multi-course club) | §6 |
| `screens/setup-2-players.html` | ② Players | §6 |
| `screens/setup-3-game.html` | ③ Pick a game | §6 |
| `screens/setup-4-2v2.html` | ④ 2v2 setup | §6 |
| `screens/setup-4-carts.html` | ④ Cart game setup | §6 |
| `screens/setup-4b-matchups.html` | ④b Matchups & rules (optional) | §6 |
| `screens/setup-5-live.html` | ⑤ Round is live (share) | §6 |
| `screens/scorecard-check.html` | Scorecard check (has all 3 states: `variant` good / fix / hand) | §6 |
| `screens/home.html` | Home, with a round in progress | §6b |
| `screens/home-empty.html` | Home, first time (empty state) | §6b |
| `screens/course-noresults.html` | ① Course search, no results | §6b |
| `screens/sheet-handicap.html` | Handicap bottom sheet (from ② Players) | §6b |
| `screens/sheet-fixhole.html` | Fix-a-hole bottom sheet (hole menu, organizer only) | §6b |
| `screens/sheet-rules.html` | Rules bottom sheet (from Matches) | §6b |
| `screens/board-empty.html` | Board before the first scores | §6b |

## Add this to the repo's CLAUDE.md
```
## Design
- All UI follows docs/design/design-system/ (README.md rules, tokens.css variables, components/*/README.md).
- Product rules live in docs/design/designspec.md; mockups are in docs/design/screens/ (reference only, rebuild in our components).
- New features: reuse existing components and tokens; no new colors, sizes or type styles. Flag anything that needs a new pattern.
```

## Suggested first prompt for Claude Code
> Read `docs/design/HANDOFF.md`, `docs/design/design-system/README.md` and `docs/design/designspec.md`, then look through `docs/design/design-system/components/` and `docs/design/screens/`. Add the CLAUDE.md snippet from HANDOFF.md. Compare all of this to the current app and write a plan:
> - which existing screens and components change
> - what's new: Home, the setup flow, the game picker, scorecard check, score marks, expand-in-place for the other match, bottom sheets, toasts, empty states
> - any data-model changes: game type, swap schedule, physical vs scoring-only groups, custom matchups, score source "entered by", rules per round
>
> Start with the shared pieces: import `tokens.css`, then build Button, ScoreMark, SegmentedControl, BottomSheet and Toast. Then go screen by screen. Ask me about anything listed under "Open items" in the spec before building it.
