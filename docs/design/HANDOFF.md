# Design handoff: Golf Live Board redesign (direction A · Night Round)

Drop this whole folder into the repo at `docs/design/` and point Claude Code at it.

## What's in here
- `designspec.md`: the rules and decisions. **This is the source of truth.** When a screen and the spec disagree, the spec wins.
- `screens/`: one HTML mockup per screen, for visual reference (layout, spacing, colors, copy, sizes). They're design-tool files: inline styles plus `{{…}}` placeholders, `<sc-for>` / `<sc-if>` loops, and a small `renderVals()` script with sample data and interactions. **Don't copy the markup.** Rebuild each screen in the app's own components, and use the CSS variables at the top of each file (`--bg`, `--s1`, `--me`, …) as the color tokens.
- All sample data (Twin Creeks, Hogan's Heroes, scores, handicaps, PIN, links) is placeholder.

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

## Suggested first prompt for Claude Code
> Read `docs/design/HANDOFF.md` and `docs/design/designspec.md`, then look through `docs/design/screens/`. Compare them to the current app and write a plan: which existing screens/components change, what's new (setup flow, game picker, scorecard check, score marks, expand-in-place other match), and any data-model changes (game type, swap schedule, physical vs scoring-only groups, custom matchups, score source "entered by"). Start with shared pieces: color tokens, the score-mark component, and the segmented control. Then go screen by screen. Ask me about anything listed under "Open items" in the spec before building it.
