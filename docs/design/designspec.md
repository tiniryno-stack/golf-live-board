# Golf Live Board — Design Spec

Running notes from design sessions. Source of truth for rules the screens can't show on their own.
Visual reference: the "Golf Live Board — Visual Directions" design board (rows 1–5 are the current design; ARCHIVE is reference only). See §11 for links.
Last updated: 2026-10-22

---

> Visual rules, tokens and components live in `design-system/` (see HANDOFF.md). This spec covers product rules and screen decisions.

## 1. Visual direction: A · Night Round

- Polished evolution of today's Flighty-style dark look. Calm, precise; numbers do the talking.
- Fonts: **Geist** (UI) + **Geist Mono** (numbers, labels, codes).
- Dark is default; every screen has a light theme.
- Phone-first. Design target is **iPhone 15 (393 × 852)**; must still work on iPhone SE.
- Tap targets ≥ 48px. Readable in direct sun.
- Bottom tab bar: **Enter · Matches · Board · Card** (floating glass, icons only; see §9).

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

## 6b. Home, empty states, sheets and feedback
Added from the two UI/UX video takeaways. The design system ("Golf Live Board") holds the matching tokens and components.

**Type and color rules**
- Six type styles only: number-xl 64, title 32, row 17, body 15, small 13, label 12 (mono, uppercase). 12px is the floor.
- Big type is tight: letter-spacing about −3%, line-height 110–120%.
- Green = you only. Confirmations ("Copied", "Saved") are neutral with a check, never green. Hint icons are muted.
- Light mode gets soft shadows on cards, the tab bar, toasts and sheets. Dark mode uses lighter surfaces instead.
- No cards inside cards: group with spacing; nest only controls.

**Buttons and inputs**
- Primary (one per screen, full width at the bottom), secondary (surface-2), ghost (no fill until pressed).
- Every button has pressed, disabled (says what's missing), loading (spinner, label stays) and focus states.
- Inputs have a visible label, focus ring, error (red border and fix-it message, blocks) and warning (amber, doesn't block).

**Feedback**
- Every action gets a response. One-off actions show a Toast (2s, or 5s with Undo). Repeated actions like scores get an inline check.
- Offline: a "Reconnecting… scores will send when you're back" pill under the header.

**Gestures**
- Swipe right for back in setup; swipe down to close a sheet.
- No swiping between holes on Enter. Use arrows or the hole grid.
- Long-press a scorecard cell to see who entered it and edit it.

**New screens (canvas row "Home, empty states and bottom sheets")**
- **Home:** the live round is one green-outlined card with "Back to hole 11". Recent rounds are plain rows. Bottom: Join with code (secondary) + New round (primary).
- **Home, first time:** "No rounds yet" empty state, a join-code field, and New round.
- **Course, no results:** the focused search field, "No courses match '…'", a "Did you mean" row, and "Enter the scorecard yourself".
- **Handicap sheet:** tap an HCP pill on Players. Big stepper, "was 17 last round", Use full / No strokes, Done.
- **Fix-a-hole sheet:** opened from the hole menu (⋯) by the organizer or host link. Par 3–6 buttons and a stroke-index stepper. An amber note says it changes the card for everyone. Save hole 14.
- **Board before first scores:** "Waiting for the first scores", a joined count with Send code, and the teams with tee times showing "–", not zeros.
- **Rules sheet:** a Rules button on Matches. Rows: format, points (1 low ball + 1 low total, ties ½), opponents (switch every 6), handicaps, max score, winner and tiebreak. Edit is organizer-only; Share rules.
- Still to draw: an empty Matches screen (same pattern as Board).

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
- Applied UI/UX video takeaways: 6 type styles, green only for you, button and input states, toasts, bottom sheets, empty states, light-mode shadows, gesture rules.
- Tab bar: frosted glass, full width, icons only, calm sliding highlight. Rejected: labels that grow (too busy), a live hole row inside the dock (too much info), a big separate Enter button.
- Status like "Sean hasn't entered" never goes in the tab bar: a quiet dot on Enter, plus (later) a floating alert chip shown only when needed.
- Foursome split point Matches = "the race" (lock line), chosen over hole chips and a momentum chart.
- Split point tiebreak: most outright wins, then a shared win.
- The race's bottom card: Points by hole by default, What this hole does near the end. Rejected: a static "Now · hole X" card, head-to-head records.
- Design work reaches the coder as numbered feature folders (§11); a handed-off feature is never edited, and changes get a new number.

## 8. Open items
- **Name for the 8-player cart game.** Candidates: Ryder Cup Pairs (likes it; "Ryder Cup" is a trademark, fine for a private app but worth avoiding if published), Cart Cup, Pairs Rotation, Round Robin.
- Conflict rule when two people enter different scores for the same player.
- Score-entry stepper for the narrow scorecard-check cells (tap a cell → big stepper).
- Whether 6-player rounds get a 3-cart version of the cart game.
- The floating "hasn't entered" alert chip above the tab bar: trigger rules are sketched (current hole incomplete, you've left Enter for about a minute), but no design yet.
- Matches for other individual games (match play with 2–3 or 5–6 players, stroke play): the race is designed for 4. Decide whether it scales to 2–6 lanes.
- Matches empty state for the foursome race (before hole 1 is complete).

## 9. Tab bar (all in-round screens)
- Floating frosted-glass capsule, full width with 16px gutters, 24px above the bottom (plus the safe area).
- **Icons only, no labels.** The screen title says where you are, so every in-round screen needs a clear title (Hole 11, Matches, Board, Scorecard).
- Four equal tabs (about 87×56 each on iPhone 15). Tabs never change size.
- The active tab has a soft highlight one tab wide. Switching tabs slides the highlight over 280ms with an ease-out curve: no bounce, no growing, no label animation. No animation with reduced motion.
- **Dot on Enter:** shows when your group's current hole is missing scores. Neutral color, hidden while you're on Enter.
- The bar never shows status text and never changes height. It hides during setup and while a bottom sheet is open.
- The old settings button beside the bar moves into the header's ⋯ round menu.
- New tokens: `glass`, `glass-line`. Spec: feature 001.

## 10. Matches: foursome split point ("the race")
For an **individual 4-player split-point game** (no teams). Team and cart games keep the §3 screen.

**Game rules**
- 1 point per hole, 18 total. Low score takes the point; ties for low split it (½, ⅓, ¼).
- A hole counts once all 4 scores are in.
- Winner: most points after 18. Tiebreak: **most outright wins** (holes won alone), then a shared win.

**The math**
- `left` = 18 − holes completed. The **lock line** = 2nd place's points + `left`.
- The leader has **locked** it when their lead is bigger than `left`. A lead exactly equal to `left` means the chaser can only tie, and then the tiebreak decides.
- A player is **OUT** when their points + `left` < the leader's points.

**Screen, top to bottom**
1. **Header:** `SPLIT POINT · THRU 7`, a headline (You lead by 1 / All square with Andrew / 18 decides it / You've locked it / Mitchell wins), a one-line subline, and a Rules button that opens the rules sheet.
2. **Race card:** one lane per player, sorted by points, on a 0–18 track.
   - Each lane has a filled bar, a puck with the player's points (`3¼`, green for you), and a dotted tail showing how far they can still climb.
   - A dashed **LOCK** line crosses all lanes and moves in every hole.
   - OUT players fade.
   - The track is inset 20px at both ends. The LOCK label right-aligns near 18 and left-aligns near 0, so nothing touches the card edge (feature 004).
3. **Bottom card**, which switches on its own:
   - **Points by hole** (default): 18 cells per player, each filled by their share of the hole (full, half, quarter). Unplayed holes are dashed.
   - **What this hole does**: from hole 16, or from hole 13 when the top two are within 1 point, or when the hole could lock it. Up to 4 outcomes worded from your side: UP x, STILL UP, ALL SQUARE, DOWN x, LOCKED, YOU WIN, [NAME] WINS.
   - No toggle and no tap action.
4. **Tab bar** (§9), with Matches active.

**Rules**
- No team colors in an individual game: you're green, everyone else is neutral.
- Fractions use real glyphs.

Specs: features 002 (race), 003 (bottom card), 004 (track edges).

## 11. Where things live and how work is handed off
**Design (claude.ai, saved to Andrew's account)**
- Design board, "Golf Live Board — Visual Directions": https://claude.ai/artifact/VGVHfzakP4NtQxMQ9rtoJF
  - Rows: 1 In the round · 2 Empty states, edge cases, sheets · 3 Home and new round · 4 Scorecard check · 5 Components · ARCHIVE (explored, not chosen).
- Design system, "Golf Live Board" (tokens, rules, 17 components): https://claude.ai/artifact/QwDPXUHrooVcCrx3t8ezxM

**Repo (GitHub, built by Claude Code in the cloud)**
- `docs/design/designspec.md`: this file.
- `docs/design/design-system/`: tokens.css, README rules, component notes.
- `docs/design/screens/`: the original handoff mockups.
- `docs/design/features/NNN-name/`: one folder per feature, with SPEC.md (the source of truth, plus a Status line), screenshots in dark and light, and optional mockups.

**Features so far**
| # | Feature |
|---|---|
| 001 | Tab bar: glass, icons only, full width, sliding highlight |
| 002 | Foursome Matches: the race |
| 003 | Race bottom card: Points by hole / What this hole does |
| 004 | Race track edges: inset and label anchoring |

The next feature is **005**.

**Workflow**
1. Design it in a Cowork session, which updates the board and the design system.
2. Package it as `NNN-name.zip`, a single feature folder.
3. Attach it in Claude Code with "Build the attached NNN-name."
4. The coder unzips it into `docs/design/features/`, plans, builds, commits, and pushes.
5. A handed-off feature is never edited; changes come as a new number.
6. Coder sessions don't run full test suites or screenshots after small changes. Andrew tests on his phone.
7. Before leaving a long design session, update this file. Start new sessions from the board and design system links above.
