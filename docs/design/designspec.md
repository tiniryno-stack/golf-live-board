# Golf Live Board — Design Spec

Running notes from design sessions. Source of truth for rules the screens can't show on their own.
Visual reference: the "Golf Live Board — Visual Directions" Design canvas (direction A · Night Round).
Last updated: 2026-10-21

---

## 1. Visual direction: A · Night Round

- Polished evolution of today's Flighty-style dark look. Calm, precise; numbers do the talking.
- Fonts: **Geist** (UI) + **Geist Mono** (numbers, labels, codes).
- Dark is default; every screen has a light theme.
- Phone-first. Design target is **iPhone 15 (393 × 852)**; must still work on iPhone SE.
- Tap targets ≥ 48px. Readable in direct sun.
- Bottom tab bar: **Enter · Matches · Board · Card**.

### Color rules
- **Your own cart/team is always green on your phone.** Other carts: A orange, B blue, C pink, D violet.
- **Never red for a team.** Red only means double bogey (or worse) on scores.
- Warnings use **amber**, not red.
- On rounded cards, a team color is shown as a **tint + full outline**, never a stripe down one edge.

### Score marks (everywhere a score appears)
Golfers read scores visually, so marks are mandatory on Enter, Scorecard, and Player card:
| Result | Mark |
|---|---|
| Eagle or better | double circle |
| Birdie | circle |
| Par | plain number |
| Bogey | square |
| Double bogey or worse | double square, light red fill |

---

## 2. Enter screens

### Main Enter (team game) — "stacked rows"
- Your cart's 2 players are full-width rows stacked vertically: name, big **−** (88px), the score in its score mark, big **+**.
- A player with no score yet shows a dashed ghost of par ("TAP − / + · PAR"); first tap starts from par.
- Score label updates live (BIRDIE, PAR, BOGEY…). Stroke dot next to a name = gets a stroke on this hole.
- Team line shows live Low Ball / Low Total.
- Other cart in your foursome: one slim row (scores with marks) + Edit.
- 18-hole progress strip, then **Next hole** button (grey with "Sean left" until all scores are in).

### Individual-round Enter (≤ 4 players, no teams) — "you first"
- Your score is the hero card at the top (big −/+, score mark).
- Everyone else is a compact row below showing **where their score came from**:
  - "✓ From Sam's phone" (they entered it themselves)
  - "Waiting on Jake · tap to enter"
  - "Entered by you · Sean can still edit"
- Tap a row → inline one-tap score pad (2 Birdie, 3 Par, 4 Bogey… with score marks; par outlined). Picking a score auto-advances to the next empty player ("car-ride mode").
- Strip shows "Stroke play · net" and your position.

### Open question
- If two people enter different scores for the same player: proposal — **the player's own entry wins**, and whoever entered it for them gets a small notice.

---

## 3. Matches screen (team game)

- Header: "MATCH 2 OF 3 · LIVE", "vs Fore Play", players + hole range.
- **Segmented control** with one segment per match (opponent name + color dot, holes, short result like "1–6 · L"). Keep it sleek — no extra scores crammed into segments; tap a segment to see that match.
- Big score (5–3), points bar with clinch line, "4 pts left · 1½ more clinches it".
- Hole-by-hole table: Hole · Low Ball · Low Total · Pts (one row per hole, 6 rows).
- **Other match in the round** ("ALSO · Shank 5½–½ Bogey Brigade"): tapping it **expands in place** on the same screen. Your match collapses into a pinned green bar at the top ("YOUR MATCH · Hogan's 5–3 Fore Play"); the other match opens below in its own outlined box labeled "WATCHING", in its team colors only, same full table layout. Tap the bar or the row to switch back. Do **not** navigate to a separate screen (people confuse it with their own score).

---

## 4. Board

- Leader hero, headline ticker ("Hogan's Heroes is coming back"), Teams/Players and Gross/Net toggles.
- 4 teams ranked with progress bars; **provisional** points shown striped/hatched with a "+1½ prov" tag.

---

## 5. Scorecard (Card tab)

- Keep it a **classic scorecard** — scannability beats charts. No stat bars on this screen.
- Front 9 / Back 9 toggle. Rows: Hole, Par, Hcp, then players grouped under team headers; OUT/IN total column.
- Current hole column tinted; a missing score shows a dashed circle.
- Other group: same expand-in-place pattern as Matches (your group collapses to a green bar).
- Tap a player → **Player card**: total and to-par, net, both nines with score marks and "par 4" labels under each hole, stat tiles (birdies / pars / bogeys / double+), one highlight line.

---

## 6. New-round setup

### Flow
```
① Course → ② Players → ③ Pick a game ─┬─ Scorecard only / Match play → Start → ⑤ Round is live
                                      ├─ 2v2 → ④ 2v2 setup (partners, when they switch) → Start → ⑤
                                      └─ Cart game → ④ Carts → (④b Matchups, optional) → Start → ⑤
① → ①a Which course? (multi-course clubs)
② ✓ card line → Scorecard check
```
- **Picking a game is always its own step (③), right after Players.** The game is decided there; the team screens (④) only set who's with who and when partners/opponents switch. Never toggle the game type on a team-setup screen.
- Quick round: Course → Players → Game (Scorecard only is preselected) → Start.
- Nothing is required that has a sensible default.

### ① Course
- Search; "Looks like you're at" card (only if phone is within ~1 mile; up to 3 side-by-side clubs) with one-tap Pick; Your courses; Near you (9-hole courses greyed, "not supported yet").
- "Can't find it? Enter the scorecard yourself."
- Nothing about the course is preselected unless the phone is clearly at it.
- Location blocked → steps to turn it on + Try again. Never a blank screen.

### ①a Which course? (multi-course clubs)
- "This club has 2 courses. Which one are you playing?"
- Each option: name (or "Course 2"), total par, and 2 identifying holes ("Hole 1 par 5 · Hole 18 par 4").
- Unnamed course: first person can name it once; everyone after sees the name.
- Remember the choice: next time the club shows as separate picks ("Bear Creek · West").

### ② Players
- Course line with ✓ card status (tap → scorecard check) + Change.
- Player list takes **any number** of players.
- Row convention: **name (left) · handicap pill in a fixed HCP column · remove ×**. Your row has no × but keeps the same spacing so columns align. Missing handicap = dashed "Add" pill. Last round's handicaps prefill.
- Recent players as tap-to-add chips; add-a-name field.
- Bottom button: **Next: pick a game** → ③.

### ③ Pick a game (availability by player count)
| Game | Players |
|---|---|
| Scorecard only | any number |
| Match play (low net wins each hole, 1 pt, ties split) | 2–6 |
| 2v2 | exactly 4 |
| Cart game (name TBD, see §8) | exactly 8 |
- Games that don't fit are greyed with the fix spelled out ("Add 3 more players to play this").
- Max score per hole (default double par).
- Bottom button: **Start round** for Scorecard only / Match play; **Next** for 2v2 and Cart game.

### ④ 2v2 setup (foursome)
- Title "Pick partners", subline "2v2 · 4 players". No game toggle here.
- Your team (green) vs them (blue); tap two names to swap partners; Shuffle.
- **Switch partners: Never / Every 6 / At the turn.** Tip: every 6 = everyone partners with everyone once. Nobody changes groups.

### ④ Cart game setup (8 players)
- 4 carts as tinted, outlined cards; pre-paired like last round; team names optional ("names itself on join"). Shuffle carts, Edit players.
- Start round available right here; matchups screen is optional.

### ④b Matchups & rules (optional; defaults set)
Two separate questions:
1. **Switch opponents (scoring):** Every 6 holes / At the turn. Hint changes per choice ("You face all 3 other carts: B, then C, then D" / "You face 2 of the 3").
2. **On the course (physical):** Keep tee times / Play together.
   - Keep tee times: groups never change; the app scores you against an opponent in the other group. Best for pace of play. **Default.**
   - Play together: carts swap foursomes at the switch so you play next to your opponent; both groups must meet up.
- Matchups list with **Shuffle** and **Custom**. Custom = for each rotation, pick "You vs B/C/D"; the other matchup fills in automatically. Repeats allowed.
- Line under matchups explains groups ("1st tee time: A + C · 2nd: B + D, all 18. Nobody moves").
- Rules collapsed to one row showing defaults: Match play · Low ball + total · Net double bogey max · ½ point ties · +1 matchup win.

### Scorecard check
- Pre-filled from course data or the group's last round; collapsed when OK ("✓ Card ready · par 72").
- Editable Par and Hcp for all 18 holes (Hcp 1 = hardest, 18 = easiest, each used once).
- Problems flagged in plain English (missing par, par outside 3–6, handicap used twice/missing); amber highlight; **can't start until fixed**.
- Source + trust tags: "Checked against the card", "From your group's last round", "From course data", "Used in 3 rounds".
- Credit line when from the database: *Course data © OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI*.
- Entered by hand: progress ("9 of 18 holes"), option to start now and finish during the round.
- Organizer can fix any hole mid-round.

### ④ Round is live (after save)
- Big join code + link, Text the group / Copy link.
- Organizer-only box (dashed amber): admin PIN + host link, "screenshot this, keep it private".
- Open the round.

---

## 7. Decisions log
- Picked direction **A · Night Round** over Members' Card, Sunday Coverage, Trash Talk.
- Matches: segmented control (v3a) with names/short results only; other match expands in place.
- Main Enter = stacked rows; individual rounds (≤4, no teams) use the "you first" Enter.
- Scorecard: classic grid, no charts; player card keeps stat tiles.
- Score marks required on every score.
- iPhone 15 is the main design size.
- Setup: player count drives available games; removed "Never" from opponent switching (8-somes should play everyone).
- Setup: game is always picked on its own step after Players; team screens come after and never re-ask the game.

## 8. Open items
- **Name for the 8-player cart game.** Candidates: Ryder Cup Pairs (likes it; "Ryder Cup" is a trademark, fine for a private app but worth avoiding if published), Cart Cup, Pairs Rotation, Round Robin.
- Conflict rule when two people enter different scores for the same player.
- Score-entry stepper for the narrow scorecard-check cells (tap a cell → big stepper).
- Whether 6-player rounds get a 3-cart version of the cart game.
