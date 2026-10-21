# Design system build plan (second handoff)

Branch `design/design-system`, from `main` at `bfa48a2` (Oct 21). Source of truth for the look:
`docs/design/design-system/` (README rules, `tokens.css`, `components/*/README.md`). Product rules:
`designspec.md`. Mockups in `screens/` are reference only.

Status: **plan only, nothing built yet.** Takes over the open items from the first `PLAN.md`
(section 9). Andrew answered the spec's open items, tee times and the Rules sheet on Oct 21 (section 9).
Questions still open are marked **Ask**; until he answers, the default in bold is what gets built.

---

## 1. What already matches

- **Every token value.** All colors (dark and light), spacing, radius and size values in `tokens.css` are
  already in `css/styles.css` `:root` under the same names, with the same values. The first system was
  copied in exactly; this one didn't change any of them.
- **Light mode switch.** The app sets `data-theme="light"` on `<html>`; `tokens.css` reads
  `html.light` **or** `[data-theme="light"]`, so it works as is.
- **Components that exist and mostly fit** (deltas are in section 5 and 7):

| Design system | In the app today | Gap |
|---|---|---|
| ScoreMark | `ui.mark()` / `.mk-*` | matches (double borders, 16% corners, dashed ghost) |
| SegmentedControl | `ui.seg` / `ui.seg2` | live subline is green; heights/shadow token |
| ExpandInPlace | `.mine-bar` / `.watch-box` | watching score size (44px isn't a type style) |
| TabBar | `.tabbar` / `.tab` | light-mode `shadow-card` |
| ScoreStepper | Enter tiles | type sizes (72px hero → 64) |
| ScorePad | `pad-toggle` / `pad-pick` | green source line and selected chip |
| TeamCard | `.cart-card`, `.pair-card` | fine |
| GameOption | Setup ③ | fine |
| PlayerRow | Setup ② | HCP pill is a typed input (44px); spec: 48px+ tap → Handicap sheet; ✕ column 48px |
| CartChip | `.mu-chip` | fine |
| Hint | `.nr-tip`, `.sc-status`, `.saved-box.secret` | green bulb, green "All good" |
| Button | `.btn` (primary / ghost / danger / sun) | no pressed / loading states, disabled is just 38% opacity, red and amber weights |
| BottomSheet | `.sheet-root` / `.panel` | no close button, no swipe-down, 30px title, 88% height |
| Toast | `.toast` (slides from the **top**) | must slide up from the bottom, neutral check, 2s / 5s with Undo |
| TextField | `.input` | focus ring, error / warning message under it |
| EmptyState | none | new |
| LeaderboardRow | Board `.team-row` | fine apart from type sizes |

---

## 2. Tokens: `tokens.css` becomes the source

**Diff against the `:root` block in `css/styles.css`:**

| | Tokens |
|---|---|
| Same name, same value | `--bg`, `--surface-1…3`, `--text`, `--text-muted`, `--line`, `--cart-you`, `--cart-you-text`, `--cart-a…d`, `--tint-you`, `--tint-a…d`, `--double`, `--double-bg`, `--warn`, `--warn-bg`, `--button`, `--on-button`, `--font-sans`, `--font-mono`, `--space-1…6`, `--radius-sm…2xl`, `--radius-sheet`, `--radius-pill`, `--tap-min`, `--stepper`, `--button-primary`, `--screen-width` |
| In `tokens.css`, missing in the app | `--icon` (24px), `--focus`, `--error`, `--shadow-card`, `--shadow-float`, `--shadow-sheet` |
| Different value | `--scrim`: dark `.55` → `.6`; light `rgba(10,12,14,.40)` → `rgba(11,13,16,.35)` |
| App only (not in the system) | `--cart-e`, `--cart-f` (5–6 player match play), `--line-strong`, `--text-faint`, `--tint-n`, `--glass`, `--shadow-seg`; `--sat` / `--sab` are safe-area helpers, not design tokens |
| Old aliases | `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--accent`, `--accent-ink`, `--good`, `--good-ink`, `--tint`, `--bad`, `--dbl-bg`, `--sun`, `--t-A…F`, `--hero*`, `--font`, `--mono`, `--tap`, `--gutter`, `--radius-card`, `--radius-chip` |

**Problem with importing `tokens.css` as is:** its 6 type classes are bare names: `.title`, `.row`,
`.body`, `.small`, `.label`, `.number-xl`. The app already uses `title`, `row`, `body`, `small` and
`label` as class names about 70 times (the Board team rows are `class="row team-row"`, Home's text
block is `class="body"`…). Loading it unchanged would restyle all of them at once.

**Plan:**
1. `css/tokens.css` = the `:root` and light blocks of `docs/design/design-system/tokens.css`, **copied
   byte for byte**, plus the 6 type styles under our prefix: `.ts-number-xl`, `.ts-title`, `.ts-row`,
   `.ts-body`, `.ts-small`, `.ts-label` (same declarations). Loaded before `styles.css` in `index.html`.
2. A unit test reads both files and fails if the variable blocks differ, so the copy can't drift. Updating
   the design system = paste the new file's blocks in.
3. `styles.css` drops its own copies of those tokens and keeps only: the app-only extras (until they're
   retired, below) and the aliases.
4. Aliases go screen by screen. The misleading ones (`--good`, `--good-ink`, `--tint`, `--bad`,
   `--dbl-bg`, `--sun`) are replaced at every use by the real names, because "good" invites using green
   for success. Last step: delete all aliases and add a test that fails if any old name comes back.
5. App-only extras: `--line-strong` → `--line`; `--glass` → `--surface-1`; `--tint-n` → `--surface-2`;
   `--text-faint` → `--text-muted`; `--shadow-seg` → `--shadow-card` (none in dark, soft in light).
   `--cart-e` / `--cart-f` stay (6-player match play needs six jerseys) and are flagged (section 9).

Alternative considered: link `docs/design/design-system/tokens.css` directly and rename our ~70
colliding classes. More churn for the same result; the cleaner fix is for the design system to prefix
its type classes (flagged).

---

## 3. Green and red the new rules forbid

Green is only for **you** (your cart, team, row, match). Red is only for **double bogey and errors**.
Amber is for **problems, the organizer-only box and "what's at stake" callouts**.

**Green that isn't "you" → neutral**

| # | Where | Today | Change to |
|---|---|---|---|
| 1 | Setup ② course line "✓ Card ready" | `.nc-line.good` / `.sc-line.good` | `text` with check icon |
| 2 | Enter score source "✓ From Sam's phone" | `.gsub.good` | `text-muted`, check in `text` |
| 3 | Scorecard check "✓ All good" | `.sc-status.good` (green border, tint) | `surface-1` + `line` border, check in `text` |
| 4 | Enter sync dot ("Synced") | `.sync::before` green | `text-muted` dot (pending stays `warn`, offline `line`) |
| 5 | Lightbulb hint icon | `.nr-tip svg` | `text-muted` |
| 6 | "Enter the scorecard yourself" link | `.nr-manual span` | `text`, ghost button |
| 7 | "Round is live" check mark | `.live-check` green circle | `surface-2` circle, check in `text` |
| 8 | Course "Looks like you're at" cards | `.here-list .course-opt` green border + tint | `surface-1` + `line` (Pick button carries it) |
| 9 | Score pad: the chip already picked | `.pad-chip.on` | `text` outline on `surface-3` |
| 10 | Hole grid: current hole | `.hg-cell.now` green ring + number | `text` ring |
| 11 | Enter progress strip: current hole | `.holedots i.here` | `text` |
| 12 | Matches segment subline "Live" | `.seg2 .s-sub.live` | `text`, weight carries it |
| 13 | Board → Players: anyone's under-par number | `.ptp.good` | `text` (your own row stays green) |
| 14 | Player card: current hole tint, highlight box | `.pc-h.cur`, `.pc-hl` | `surface-2`; highlight icon `text-muted` |
| 15 | Generic `.good` / `.good-ink` helper classes | `css` | removed once unused |

**Green that is "you" (stays):** your cart on Enter, `.mine-bar`, your Board row and YOU tag, your
Matches kicker and Enter match status, your team-name pick, "You vs" in custom matchups, your pair card,
your team in Today's game, headlines where your team is the hero, your group's tint on the Card.

**Ask:** the ScoreStepper README colors the result label ("BIRDIE", "EAGLE") in `cart-you-text`. That's
a result color, and it shows on your cart-mate's row too. **Default: follow the README (keep it)**
until you say otherwise. Also, the ScorePad README says "✓ From Sam's phone" in `cart-you-text`; your
rule wins (row 2), so that README line needs updating in the design system.

**Red that isn't double bogey or an error**

| # | Where | Today | Change to |
|---|---|---|---|
| 16 | ⋯ menu + confirm: "Switch to watching" | `.btn.danger` | secondary button |
| 17 | Host: Delete round, Reset scores, Free it up (+ their confirm sheets) | `.btn.danger` | secondary button; the confirm sheet says what happens ("can't be undone") |

Red that stays: double bogey marks and labels, error toasts, input errors.

**Amber that isn't a problem or a stake**

| # | Where | Today | Change to |
|---|---|---|---|
| 18 | Player card "Birdies" stat tile | `var(--sun)` | `text` |
| 19 | Board final trophy card, final banner | hard-coded `#F4C95D` / `#14161A` (also ignores light mode) | **Ask** (winner pattern, section 9). Default: tint + outline in the winning team's color (green if it's you), trophy icon in `text` |
| 20 | Recap images: "WIN THE DAY", winner numbers | `C.sun` | same rule as 19 |

Amber that stays (it's a stake): the Lock in / Close it out full-screen card, Today's game big numbers,
headlines with no team. But they use hard-coded `#F4C95D` / `#14161A` and a solid amber fill, which in
light mode is dark brown with near-black text. Change to `warn-bg` fill + 1.5px `warn` outline + `text`
(the Hint problem-box look).

**Other hard-coded colors:** splash and error screens (`#000`, `#ECEEF1`) → `bg` / `text`; toast and banner
shadows → `shadow-float`; recap canvas colors → read from the tokens (`getComputedStyle`) instead of a
copied list; Join-later ghost button `rgba(255,255,255,.2)` → `line`. The `theme-color` meta values in
`app.js` stay (they must be literal, and they equal `--bg`).

---

## 4. Type: 26 font sizes → 6 styles

Today: 26 different `font-size` values in `styles.css` plus 13 `.ts-*` styles. **37 rules are below the
12px floor** (10px, 11px, 11.5px), mostly kickers, legends and sublines.

| New style | Size / line / weight | Replaces |
|---|---|---|
| `number-xl` (mono) | 64 / 64 / 700, −2px | `ts-score-hero` 72, `ts-score-big` 64, 46–64px heroes |
| `title` | 32 / 36 / 800, −1px (mono for point totals) | `ts-screen-title`, `ts-hole-title` 40, `ts-match-title` 28, `ts-points` 34, `.title` 34, 26–40px |
| `row` | 17 / 22 / 600 | `ts-row-title`, `ts-button-lg` 18, `.row-title`, 16–22px names and buttons |
| `body` | 15 / 20 / 500 (mono for scores) | `ts-body` 16, `ts-body-sm` 14, `ts-score-cell`, 14–16px |
| `small` | 13 / 18 / 500 | `.meta`, 13–14px notes, tab labels |
| `label` (mono, uppercase) | 12 / 16 / 600, 1px | `ts-label` 11, `.micro`, `ts-caption`, every 10–12px kicker |

- Inputs use `row` (17px): anything under 16px makes iPhone Safari zoom in.
- Recap images are canvas PNGs at 1080px wide; their sizes stay (they're scaled down), colors come from
  tokens.
- **Ask, spec sizes that aren't one of the 6** (defaults in bold): BottomSheet title 20px → **`row` at
  800 weight**; ExpandInPlace watching score 44px → **`title` mono**; PlayerRow HCP pill 16px →
  **`row` mono**; Home mockup's card name 22px → **`row`**, live points 40px → **`title` mono**.
- `tokens.css`'s `.label` has no `text-transform: uppercase` though the README calls labels uppercase;
  ours adds it (flagged).

---

## 5. Shared pieces first (one commit each)

0. **Light-mode switch for the checks.** `FIT_THEME=light` makes `fit-the-screen.mjs` set `glb.theme`
   through `db.local` before load; `design-mockups.mjs` renders each mockup a second time with
   `?mode=light`; `design-pairs.py` writes `vs-<name>-light.png` next to `vs-<name>.png`. New mockups
   get mapped in `design-pairs.py` as their screens are built.
1. **Import tokens** (section 2). No visible change; the drift test is the check.
2. **Button.** `ui.button({ label, weight: primary|secondary|ghost, state, act })` so every screen gets
   the same markup. Primary: `button-primary` tall, `radius-xl`, `row`. Inline: ≥48px, `radius-md`.
   States: pressed (scale .97, darker fill / ghost fills `surface-2`), disabled (`surface-2` fill,
   `text-muted` label saying what's missing), loading (spinner before the label, width fixed), focus
   ring. `.btn.danger` and `.btn.sun` retired.
3. **ScoreMark.** Already right. Remove the old `.score.d::before` decoration if nothing uses it; make
   every score cell go through `ui.mark()`.
4. **SegmentedControl.** Track `surface-1` (`surface-2` light), selected `surface-3` + `shadow-card`,
   48px / 54px heights, no green subline.
5. **BottomSheet.** 40×5 grab handle, header (title + optional `small` subtitle + 48px ✕), one primary at
   the bottom, max ~85% height, `shadow-sheet` in light, swipe down / ✕ / scrim to close, 300ms slide,
   tab bar hidden. Opening a sheet from a sheet **replaces** it (no stacking). All 14 existing sheets move
   onto it.
6. **Toast.** Slides up from the bottom above the tab bar or primary button; `surface-2` pill,
   `shadow-float`, neutral check icon, `body` text, ≥48px; leaves after 2s, or 5s with Undo (the "Hole 7
   saved · Undo" toast is 3s today). Error toasts keep a red border. Plus the **connection pill**:
   "Reconnecting… scores will send when you're back" under the header while offline (the action-level
   "No signal" error toasts stay).
7. **EmptyState.** `ui.empty({ icon, headline, help, action })`: dashed `line` box, 56px `surface-2`
   icon circle, `row` headline, `body` help in `text-muted`.
8. **Small ones along the way:** TextField states (focus ring, error / warning line under the field),
   Hint (muted bulb), PlayerRow columns (64px pill, 48px ✕ or spacer, 58px rows).

---

## 6. New screens

| Screen | What it needs | Data |
|---|---|---|
| **Home** (§6b) | Playing-now card (green outline: it's yours) with "LIVE · HOLE 11", course · game, your team · place · behind, your points, "Back to hole 11"; recent rounds as plain rows with a result line; bottom: Join with code (secondary, opens a sheet with the code field) + New round (primary) | Live card: one fetch of the newest unfinalized round this phone joined. Result line ("You 4th", "Won with Sean"): cached in `glb.recent` when a round ends on this phone; older entries show no result line. **No DB change** |
| **Home, first time** | EmptyState "No rounds yet" + "Got a code from a friend?" field + Join, New round | none |
| **Course, no results** | Search field keeps focus, "No courses match '…'", Did you mean (fuzzy match against Your courses and Near you), "Played 3 times", Enter the scorecard yourself | Times played: counted from the group's past rounds Setup already loads. **No DB change** |
| **Handicap sheet** | Tap an HCP pill on Players → big − / + stepper, "was 17 last round", Use full / No strokes, Done; tap the number to type | "Last round": the person's strokes in the newest crew round that has them (Setup already loads those rosters). **No DB change** |
| **Fix-a-hole sheet** | Organizer-only ⋯ button next to the hole number on Enter (hidden for everyone else) → Par 3–6 buttons, stroke-index stepper, amber note "Changes the card for all 8 players", Save hole 14 → toast | Uses the same `update_event` path Host uses for par / hole handicaps. Yardage: see Ask below |
| **Rules sheet** | Rules button on Matches → read-only rows: format, points, opponents, handicaps, max score, winner + tiebreak; "Edit · organizer" opens Host → Rules; Share rules (share sheet, plain text) | Reads the round's settings. Values are placeholders until confirmed (section 9) |
| **Board before first scores** | EmptyState over the real structure: "Waiting for the first scores", "7 of 8 joined · Waiting on Tyler" + Send code, teams with "–" and their tee time | Joined count from claims (already loaded). Tee times: "tees off 8:40" when the organizer set one, else "1st tee time" / "2nd tee time" (section 8) |

Matches before the first scores has no mockup ("still to draw"): **default: same pattern as the Board**
(matchups listed, "Waiting for the first scores").

---

## 7. Remaining screen updates (one commit each, dark + light at 393×852)

Enter (team) → Enter (individual) → Matches → Board → Card + Player card → Setup ①–⑤ + Scorecard check →
Host → the other sheets (menu, who, waiting, holes, team, edit, hole, headlines, pin, confirm, home
screen) → Today's game, banners and full-screen cards → Season → recap colors → splash / error screen.
Each one: tokens instead of literals and aliases, the 6 type styles, the section 3 fixes, Button /
SegmentedControl / BottomSheet / Toast where they apply.

**Behavior the new spec changes (these replace current behavior):**
- **Swipe left/right on Enter no longer changes holes** (`app.js` swipe handler goes). Arrows and the hole
  grid stay. ARCHITECTURE §8 lines that mention "swipe also works" get updated.
- **Swipe right = back in Setup; swipe down closes a sheet** (new).
- **Toasts come up from the bottom** instead of dropping from the top.
- **Handicaps are set in a sheet** instead of typing in the pill.
- **Destructive buttons are no longer red** (section 3, 16–17).

**UI conventions in CLAUDE.md:** all kept. The spec doesn't replace any of them; the jersey and
"your cart is always green" rules already match. The CLAUDE.md "Light/dark toggle: Home + round ⋯ menu
only" line changes only if theme moves into Home's Settings (section 9). Still true: no web manifest,
all storage through `db.local`.

---

## 8. Data model

Only one item needs the database: the "player's own entry wins" rule (decided Oct 21). Everything
else lives in the round's settings JSON or on the phone.

- **Rules per round:** already in `settings` (`maxHoleScore` doublePar | netDoubleBogey | none +
  `par3NoMax`, `handicapMode` full | offLow + `allowancePct`, `halvedHolePoints`, `matchBonus`,
  `teamScore`). The Rules sheet reads them and writes them out in plain English. No new setting.
- **Tiebreak:** stays the engine's fixed order (`rankStandings`); the Rules sheet just says it: "Tie on
  points: better matchup record (wins minus losses, then most wins), then who won between the two,
  then the stroke margin. Still tied = shared." No `settings.tiebreak`.
- **Tee times (decided Oct 21):** new `settings.teeTimes`, a list of clock times, one per tee time in
  group order (`["8:40", "8:50"]`). Default `[]` → every screen says "1st tee time", "2nd tee time"…
  Old rounds normalize to `[]`, so nothing changes for them. Set in Host → round settings (and in
  Setup where the first tee and round name are). Shown on the waiting Board, matchup lines and the
  Rules sheet. Input: the TextField with the phone's time picker (no new pattern).
- **Entered by:** already stored (`scores.updated_by` = the writer's name or "Organizer", `meta.by`).
- **Player's own entry wins (decided Oct 21, needs the database):** in `upsert_score`, when someone
  writes a score for another player and the saved score was entered **by that player themselves**
  (`updated_by` = the player's own name) with a different value, the write is refused with
  `{ ok: false, error: 'own_entry', strokes, updated_by }`. The player can always change their own
  score; entering for someone who hasn't entered yet works as today; the organizer's
  `admin_upsert_score` still overrides (fixes and finalized rounds). The refused phone takes the
  player's score and shows a toast: "Sam entered 5 himself. His score stays." Additive
  `create or replace function` only, mirrored in `supabase/schema.sql` and `tests/mock-supabase.mjs`,
  with smoke tests for each case. Older phones on the live site drop a refused write (the queue settles
  it and calls `onReject`) rather than retrying, so applying it early is safe; still, it goes live with
  the merge to `main`, after the mid-round check.
- **Partner Rider Cup for 6 (decided Oct 21: build it):** 3 carts of 2 (A, B, C). Format: see
  section 9, item 4. Stored like the 8-player game (`settings` + 3 teams), no migration.
- **Home result line, last handicap, times played:** derived on the phone (section 6).
- **Per-hole yards** for the Fix-a-hole sheet: not stored; only if asked later (course JSON, no migration).

---

## 9. Open items and questions

From the spec's "Open items" (carried over from the first PLAN.md). **Andrew decided these Oct 21:**
1. **Name for the cart game: "Partner Rider Cup".** Renames "Cart game" everywhere it shows (game
   picker, Today's game, Rules sheet, Home, recap). Internal ids (`carts`) stay.
2. **Two phones enter different scores: the player's own entry wins** (section 8 has the exact rule).
3. **Scorecard-check cells: keep typing with the number keypad** (Claude's call; faster than a stepper
   for 18 holes entered by hand). The cells get the TextField states (focus ring, amber problem
   border) and at least 48px tap height. Mid-round fixes use the Fix-a-hole sheet's stepper.
   **Closed.**
4. **Partner Rider Cup for 6 players: build it** (3 carts of 2). **Ask, format:** default is
   **every cart plays both other carts on every hole, all 18 holes** (A v B, A v C, B v C at once; Low
   Ball + Low Total each, ties ½, +1 for winning each matchup), so there's no switching and nobody sits
   out. Groups: carts A + B in the first tee time, C in the second. The other way (switching every 6)
   leaves one cart idle each stretch. The game picker's count becomes "6 OR 8 PLAYERS".
5. **Rules sheet: shows the round's real settings.** The mockup's lines were sample text. Defaults
   today: handicaps full, off zero; max score double par; tiebreak as in section 8. If the organizer
   changed a setting, the sheet shows that instead. **Closed.**

Carried over from the first plan's known limits: naming an unnamed course in "Which course?" is
remembered per group (shared courses table = V2); "start now, finish the card during the round" isn't
built; mid-round Host still edits the cart game / split point the old way.

New questions from this handoff (default in bold):
6. **Home's header** ("AD · Andrew" + a "Settings" button) appears only in the two Home mockups
   (`screens/home.html`, `screens/home-empty.html`); the spec never says what Settings opens.
   Andrew (Oct 21): Home needs a bigger revamp anyway; build the header from the design system for
   now. **Default: name and initials from the newest round you joined (hidden on a phone that never
   joined one); no Settings button until there's something to put in it**, so theme stays on Home's
   top bar and in the round ⋯ menu. Also: the mockup has two primary-style buttons (Back to hole 11 in
   the card, New round at the bottom). **Default: Back to hole 11 as secondary**, so New round is the
   one primary. A new Home mockup from the designer replaces all of this when it comes.
7. **Where Run it back, Season standings and Add to Home Screen go on the new Home.** **Default: Season
   and Add to Home Screen stay as rows under Recent rounds; Run it back moves into a finished round's
   ⋯ menu.**
8. **Tee times: decided Oct 21.** Optional clock time per tee time in the round settings; without one
   it says "1st tee time", "2nd tee time"… (section 8). **Closed.**
9. **Yardage on the Fix-a-hole sheet** ("Par 5 · 512 yd"): rounds don't keep per-hole yards. **Default:
   "Par 5 · SI 7" only.**
10. **Destructive buttons** need a pattern (the system has primary / secondary / ghost only).
    **Default: secondary, with the consequence in the confirm sheet.**
11. **Winner / trophy look** (Board final card, recap) needs a pattern. **Default: winner's team colors.**
12. **Spec sizes outside the 6 styles** (section 4).
13. **Birdie label in green** (section 3).
14. **Carts E and F** (5–6 player match play) aren't in `tokens.css`; they stay as app extras until
    added to the system.
15. **`tokens.css` type class names collide** with ours; the system could prefix them.
16. **Selected segment's "soft shadow"** has no token; using `shadow-card`.
17. **Mockup colors differ a little from `tokens.css`** (red `#FF5A5A` vs `#ff6b6b`, light surface-3,
    orange). `tokens.css` wins, so design:compare will show small color differences.

---

## 10. How each step is checked

- `npm run design:compare` in dark and light at 393×852 for every screen touched.
- `npm test`, `npm run test:fit`, `npm run test:smoke` before every push; update the counts in
  CLAUDE.md. New tests: token drift, no old alias names, no green / red outside the allowed selectors.
- Nothing goes to `main` until Andrew says so, and only after checking nobody is mid-round (no
  unfinalized round with recent scores).
