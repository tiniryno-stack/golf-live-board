# Golf Live Board: tab bar + foursome Matches handoff

Two pieces of work, done in this order:

1. **`01-tab-bar/`: new floating glass tab bar (icons only, calm sliding highlight).** A shared component, so build it first. The Matches screen uses it.
2. **`02-matches-foursome/`: "The race" Matches screen** for 4-player split-point (individual) rounds.

Each folder has a `SPEC.md` (the source of truth) plus visual references. Everything follows the existing design system in `docs/design/design-system/` (tokens.css, README rules). This handoff adds two tokens, `--glass` and `--glass-line`, listed in `01-tab-bar/SPEC.md`.

## Files
- `01-tab-bar/SPEC.md`: look, motion, behavior and tokens for the tab bar.
- `01-tab-bar/tab-bar-demo.html`: a working demo; open it in a browser. Plain HTML/CSS/JS, fine to port.
- `01-tab-bar/tab-bar-dark.png`, `tab-bar-light.png`: what it should look like.
- `01-tab-bar/design-system-rules.md`: the same rules as written in the design system.
- `02-matches-foursome/SPEC.md`: game rules, lock-line math, layout, headline copy.
- `02-matches-foursome/screenshots/`: the target screen thru 7, 14 and 17, dark and light.
- `02-matches-foursome/mockups/`: design-tool source (reference only; don't copy the markup).

Sample names and scores (Mitchell, Andrew, Justin, Peter at Bridlewood) are placeholders.
