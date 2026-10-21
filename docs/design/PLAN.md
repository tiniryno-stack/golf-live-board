# Night Round redesign — build plan

Branch: `design/night-round`. Source of truth: `designspec.md` (spec wins over a mockup).
The mockups in `screens/` are references for layout, sizes, colors and copy; everything is rebuilt
in the app's own screens (`js/screens/*.js`) and stylesheet (`css/styles.css`). Game logic stays in
`js/scoring.js` (pure) and is extended, not rewritten.

## What's there today vs the design

| Today | Design | Change |
|---|---|---|
| Sundown tokens (`--bg #0B0C0E`, `--good #34C281`, …) | Night Round tokens (`--bg #0A0B0D`, `--s1/s2/s3`, `--me #3DDC84` + text green `--meT`, `--dbl` / `--dblBg`, amber `--warn`) for dark **and** light | Swap token values in `:root` / `[data-theme]`; add the new ones; keep the old names as aliases so every screen picks them up at once |
| Tab bar: flat row + host button | Floating pill nav (`--s1`, 22px radius, active tab = filled `--btn`) | Restyle `.tabbar` / `.tab` (same markup + host button) |
| `scoreClass()` circle/square classes, not used everywhere | Score marks everywhere: double circle (eagle−), circle (birdie), plain (par), square (bogey), double square + red tint (double+) | One `mark(score, par, size)` helper in `ui.js` + `.mk` CSS; used on Enter, Card, Player card, score pad |
| `seg()` segmented control (small) | 48px segments, `--s1` track, active = `--s3` + shadow; 2-line segments on Matches | Restyle `.seg`; add `seg2()` for label + sub-label segments |
| Enter: your cart 70% tiles + greyed other cart | **Team:** stacked full-width rows (88px −/+, score in its mark, live label BIRDIE/PAR…, dashed ghost of par), team line LB/LT, other cart = one slim row + Edit, 18-hole strip, Next hole. **≤4, no teams:** "you first" hero card + compact rows with *where the score came from* + inline one-tap score pad that auto-advances | Rebuild `enter.js` views; keep every behaviour (first tap = par, Next waits + nudges, locked old holes, Switch it up / alerts cards, coach tips, long-press clear) |
| Matches: Rot 1/2/3 seg + tug bar + hole strip; other matchup collapsed card | Header "MATCH 2 OF 3 · LIVE / vs Fore Play", one segment per match (opponent + dot + "1–6 · L"), big score, points bar with clinch line, Hole · Low Ball · Low Total · Pts table; other match **expands in place** (yours collapses to a green bar, theirs opens in a "WATCHING" box) | Rebuild `matches.js` (split-point view restyled, kept) |
| Board | Leader hero, headline card, Teams/Players + Gross/Net segs, rows with hatched provisional + "+1½ prov" tag | Restyle `board.js` markup/CSS; same data |
| Card: collapsible cart tables | Classic grid: Front/Back seg, Hole/Par/Hcp rows, team header rows, OUT/IN, current-hole column tint, dashed circle for the missing current score, marks; other group expands in place; marks legend | Rebuild `card.js` |
| Player sheet | Player card: total + to-par, net, both nines with marks + "par 4", stat tiles (birdies/pars/bogeys/double+), one highlight line | Rebuild the `player` sheet in `sheets.js` |
| Setup: 6 steps Course → Players → Teams → Matchups → Game → Save | ① Course → ② Players → ③ Pick a game → (④ 2v2 / ④ Carts → ④b Matchups, optional) → Start → ⑤ Round is live; ①a Which course?; Scorecard check as its own screen | Rebuild `setup.js` flow on top of the existing course search, draft, names/crews logic |

## New screens (setup)

- **① Course** — search, "Looks like you're at" card with Pick, Your courses, Near you (9-hole greyed "not supported yet"), enter-it-yourself. Same logic as today, new look.
- **①a Which course?** — shown when a picked club's card has the same hole number more than once. Splits the holes in listing order into Course 1/2/3 (each: total par + "Hole 1 par 5 · Hole 18 par 4"); optional name ("e.g. East"). The pick is saved as its own course (`oga:<id>#2`, name "Bear Creek · East") so the group's "Your courses" shows it next time.
- **② Players** — course line with ✓ card status (tap → Scorecard check) + Change; rows = name · HCP pill (fixed column; dashed "Add" when blank) · ×; your row first, no ×; recent chips; add-a-name; any number of players; "Next: pick a game".
- **③ Pick a game** — Scorecard only (any) · Match play (2–6) · 2v2 (exactly 4) · Cart game (exactly 8); games that don't fit are greyed with the fix spelled out; Max score per hole row; Start round (scorecard / match play) or Next (2v2 / cart game).
- **④ 2v2** — Your team (green) vs Them (blue), tap two names to swap, Shuffle; Switch partners: Never / Every 6 / At the turn; Rules row; Start round · 2v2.
- **④ Carts** — 4 tinted + outlined cart cards (pre-paired like last round, team names optional), tap two names to swap, Shuffle carts, Edit players; Game & matchups (optional) row; Start round · 8 players.
- **④b Matchups & rules** — Switch opponents: Every 6 holes / At the turn (hint per choice); On the course: Keep tee times (default) / Play together (hint); Matchups list with Shuffle + Custom (per rotation "You vs B/C/D", the other matchup fills in); group line; Rules row.
- **Scorecard check** — good / fix / entered-by-hand states, Par + Hcp for 18 holes, plain-English problems, amber cells, source tags, OSM credit; can't start until fixed.
- **⑤ Round is live** — check mark, big join code + link, Text the group / Copy link, dashed amber organizer box (PIN + host link), Open the round.

## Shared pieces first

1. **Color tokens** dark + light (+ two extra jersey colors for 5–6 player match play).
2. **Score mark** `mark(score, par, size)` → circle / double circle / square / double square.
3. **Segmented control** restyle + 2-line variant.
4. **Expand in place** pattern (`.fold` max-height/opacity transition, pinned "YOUR …" bar, "WATCHING" box) used by Matches and Card.

## Data-model changes (all inside the round's JSON — no database migration)

- **Game type by player count** (`settings.game` + flags):
  - Scorecard only: `game:'none'`, any count. Players split into foursomes automatically (g1 = first 4, g2 = next 4, …).
  - Match play: `solo:true` (split point), now **2–6** players (ids A–F; 5–6 players play as two groups).
  - 2v2: `pairs:true` + `pairSwitch: 'never'|'six'|'turn'`, exactly 4, one group. The engine builds the pairs per rotation (AB v CD, then AC v BD, AD v BC) and adds up each player's points; standings are per player.
  - Cart game: `rotationMatch` / `rotationPlusMinus`, exactly 8 (unchanged).
- **Opponent switch schedule**: `settings.rotation` = 3 rotations of 6 (every 6) or 2 of 9 (at the turn). The engine and the DB's foursome rule already read rotations generically.
- **Physical vs scoring-only groups**: existing `rotationMode` — `'fixed'` = keep tee times (**new default**), `'swap'` = play together. Labels change only.
- **Custom matchups**: per rotation, your opponent; the other matchup is the remaining two carts. Stored as the rotation's `matches`. Repeats allowed.
- **Who entered each score**: already stored (`scores.updated_by`, snapshot `meta.by`). Enter shows "✓ From Sam's phone" (entered by that player), "Entered by you · Sam can still edit", "Waiting on Sam".

## Build order (one commit each, tests after each)

1. `docs/design/PLAN.md` (this file)
2. Tokens (dark + light) + pill tab bar
3. Score-mark helper + segmented control restyle + expand-in-place CSS
4. Engine: match play 2–6, foursomes for any count, 2v2 pairs (switching partners), at-the-turn rotations, custom matchups + unit tests
5. Enter — team (stacked rows)
6. Enter — individual ("you first", entered-by, score pad, car-ride auto-advance)
7. Matches (match segments, table, expand in place)
8. Board restyle
9. Card (classic grid, marks, expand in place) + Player card
10. Setup ① Course + ①a Which course?
11. Setup ② Players + Scorecard check
12. Setup ③ Pick a game + ④ 2v2 + ④ Carts + ④b Matchups + ⑤ Round is live
13. Docs (CLAUDE.md, ARCHITECTURE.md, README.md) + test-count updates

## Open items (from the spec) — default taken until Andrew decides

1. **Name for the 8-player cart game** — shipping as **"Cart game"** (the spec's working name). Easy rename later.
2. **Two people enter different scores for the same player** — unchanged for now: **last entry wins** (today's behaviour). The proposal ("the player's own entry wins, the other person gets a notice") needs a database rule; not built.
3. **Stepper for the narrow scorecard-check cells** — using the phone's number keypad in each cell for now.
4. **3-cart version of the cart game for 6 players** — not built; 6 players can pick Match play or Scorecard only.

## Known limits / flags

- Naming an unnamed course in "Which course?" is remembered for **your group** (it's saved in your rounds). Sharing that name with *every* group needs the shared courses table (V2 backlog).
- "Start now, finish it during the round" (scorecard entered by hand) is not built: every hole needs a par and handicap before Start, as today.
- Mid-round Host still edits the cart game / split point the old way; 2v2 rules are set at setup.
