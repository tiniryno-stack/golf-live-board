# 017 · Design system v3 (sync the repo copy)

Status: built in 81d6b20

Changes the look's source of truth only. No screen changes, no new behavior.

## What this does

The Golf Live Board design system on claude.ai was updated on Nov 3 to match what the app ships after handoffs 011–016. This brings the repo copy, `docs/design/design-system/`, in line with it.

## Do

1. Copy `design-system/README.md`, `design-system/tokens.json` and every folder under `design-system/components/` over `docs/design/design-system/`. That means 7 changed components (TabBar, ScorePad, GameOption, LeaderboardRow, TeamCard, ScoreStepper, ExpandInPlace, plus previews where included) and 6 new ones (CupBar, MatchRow, MatchFlag, HoleStrip, HoleProgress, GreenCard).
2. Update `docs/design/design-system/tokens.css` so it matches the new tokens.json:
   - add `--cart-e: #36c5c5` / light `#0e8c8c` and `--cart-f: #e3b341` / light `#8a6000`
   - `--glass`: dark `rgba(21,23,27,0.92)`, light `rgba(255,255,255,0.94)`
3. `npm run tokens`. Then delete the now-duplicate overrides from the top of `css/styles.css`: `--cart-e`, `--cart-f` and `--glass` (dark and light). Keep `line-strong`, `text-faint` and `tint-n` for now.
4. `npm test` (the tokens drift test should pass). Nothing should look different on the phone.
5. CLAUDE.md: the Team Ryder Cup line "Colors: your cart green, side 1 blue, side 2 orange" is out of date. Since 015 the other side is neutral grey. Fix that line.

## Direction (no code change yet)

The README now says Team Ryder Cup (015 + 016) is the standard for every game. Score stepper, Expand in place and Leaderboard row are marked legacy. Moving the other games over comes as separate numbered handoffs; this one only records the rule.

## Not in this handoff (known gaps, listed in the system's README)

- The green card's radius is 22px; the system says `radius-2xl` (24). Leave it for now.
- `tint-e` / `tint-f` don't exist yet.
