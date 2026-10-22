Status: built in 65529e0

# 008 · Seasons

Crew standings split into seasons. It needs 006 (crews) first; Standings opens from the crew card's **Standings** button. Screens are 393 × 852 in dark and light, following Night Round.

Screenshots are in `screenshots/<Screen>-{dark,light}.png`. Mockups are in `mockups/<Screen>.html`; add `?light` to the URL for light mode. Sample data only.

## Season-Standings · current season (default)
- The header has Back, the ⋯ menu (opens the 006 Crew settings sheet), the crew name in mono, and "Standings".
- **Season card** (56px, tappable): season name, "SEP 6 – NOW · 14 ROUNDS" in mono, a CURRENT tag and a chevron. Tapping it opens Season-Past.
- **Table:** # · Player · Rds · Pts. Points are in mono and can show halves (½). Your row gets the green tint, a 3px inset bar on the left, and green bold text. The table scrolls for crews bigger than about 7 players.
- A note under the table says points come from every crew round this season.
- **Start a new season** is pinned to the bottom. Decide who can see it: everyone, or only whoever started the crew.

## Season-Past · seasons list
- The current season is first with its CURRENT tag, then past seasons, newest first. Each row shows the name, dates and round count in mono, plus one line: "Won by Mike T. · you 2nd", or "Won by you".
- Rounds played before seasons existed sit in one **Before seasons** block.
- Tapping a past season opens Standings with that season selected (no CURRENT tag, and no Start-new button).

## Season-Sheet-New · start a new season
- Standard bottom sheet with a × close.
- **Name:** a text field, prefilled with the next season name (Spring 2027).
- **Starts:** chips for **Today**, **Next round**, and **Pick date** (opens the iOS date picker).
- **"What happens to Fall 2026" box:** it ends with the current leader in 1st, the final standings are saved under Past seasons, and nothing is deleted. The new season starts everyone at 0. Rounds in progress count toward the old season.
- The primary button states the action: **End Fall 2026 and start Spring 2027**.

## Rules for the logic
- A round belongs to the season that was active on the day it started.
- Only one season can be current at a time. Seasons can't overlap or leave gaps; the end of one is the start of the next.
- Ties in standings use the same tiebreak as the current Board rules, unless you decide otherwise.

## New components (add to the design system)
- **Season card:** a tappable picker row with name, mono dates and a status tag.
- **Standings table:** a 4-column grid with your row highlighted.
- **Explainer box:** an inset box in the background color inside a sheet, with a mono label and plain-language consequences.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
