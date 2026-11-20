# 033 · Enter motion: louder score picks, and the card turns to the next hole

Status: handed off (design), not built.

**Changes 022** (Part 1 replaces 022 §4's per-result motion; everything else in 022 stays) and **adds to 027**
(a new motion, the turn, next to grow / fold). Applies to the calm Enter that every game uses since 031 / 028.

**The problem.** The 022 reward motion is about 80–90% there, but people don't notice it moves. Changing holes has
no motion at all: the screen just redraws. Andrew wants both to feel alive without getting loud.

## 0 · Needs a new token or pattern (flagged)

No new colors, sizes or type styles. No new design tokens: every duration and curve reuses `motion-grow` (300ms),
`ease-grow` (`cubic-bezier(.2,.8,.2,1)`), 027's leaving curve `cubic-bezier(.4,0,1,1)`, 022's roll curve
`cubic-bezier(.3,.7,.2,1)` and `blur-swap`. What's new:

| # | New | What it needs |
|---|---|---|
| 1 | **Pattern: the turn** (changing holes on Enter) | A line in the design system README, Motion: today it says "Nothing else moves." Proposed text in §6. |
| 2 | **Pattern: the wince** (bogey / double shake of one picked pad) | Same README line. It must stay distinct from the existing nudge (§1.4). |
| 3 | Rolling numbers used beyond the standing (hole number, Par, yardage digits) | Same README line ("numbers that change roll"). 022 already rolls the standing. |
| 4 | Par's word changes from `text-muted` to `text`; birdie's word goes from 15px to 17px | Not new styles: both are existing sizes / colors used on a new state. Listed because it changes 022. |
| 5 | Two local constants (not tokens): `perspective(1200px)` for the turn, and `--t-shade` (how dark a panel gets edge-on: .5 dark, .88 light) | Kept local to `.ce` in `motion.css`. Say if you'd rather they become tokens. |
| 6 | A small build change: `html.rm` while the phone asks for reduced motion | One `matchMedia` listener in app.js, so the reduced rules are written once (§4). |

**Andrew's pick:** (a) **scoreboard flip** or (b) **page turn** for the score card. **Recommendation: (a)**, see §2.3.

## Files

| What | Where |
|---|---|
| The prototype: tap scores, Next hole, ◀ ▶, the hole number (grid), ⋯ for options | `prototype.html` (open in a browser at phone size; on a laptop the options sit beside the phone). Also at https://claude.ai/artifact/XEedkFZGGfzYwXx2Ti33wy |
| Exact motion values (durations, delays, easings, distances) | `motion.css`. The prototype loads it as it is. Copy it; don't re-derive it. |
| Target screens | `screenshots/NN-name.png` (dark) and `NN-name-light.png`, 393 × 659 @2×. §5 lists them. Strips show several frames of one motion with their times. |
| Re-render the screenshots | `npm install`, then `node docs/design/features/033-enter-motion/shoot.mjs` (or `… shoot.mjs 20 13` for some). Every frame is exact: the script pauses every animation at the stated millisecond. |

The prototype is reference only. Rebuild in the app's Enter (`js/screens/enter.js` `ryderEnterView`, `css/styles.css` `.ce-*`).
Its ⋯ opens prototype options (game, flip style, yardage card, slow motion, reduced motion, theme, finalized, "Try a
pick"); in the app ⋯ stays the round menu. Its quiet row fills the rest of your tee time with made-up scores so you can
try Next hole; in the app it grows open (027).

---

## 1 · Part 1: score picks — each result gets its own feel

### 1.1 The five results (`10`–`14`)

Every pick still starts the same way as 022: the picked pill is there at 0ms (white, or the red-number pill for a
gross double), the mark's outline draws over its faint copy (320ms from 60ms), and the word appears after the name.
On top of that, rarer = bigger:

| Result (net) | Pad | Around the pad | Word | Holds |
|---|---|---|---|---|
| **Eagle or better** | 022 bump (scale .92 → 1.06 → 1, 220ms) | 022's 2 ripples (100ms, 250ms) **+ new burst**: 8 short sparks (2 × 8px, `text`) fly from the pill edge (34px from centre) to 54px and fade, 500ms from 140ms | 17px, **lifts in** (10px up, 2px overshoot) | 3s |
| **Birdie** | bump | **1 ripple** (the eagle's first ring) | **17px** (was 15), lifts in | **2.2s** (was 1.6) |
| **Par** | **bigger pop**: .9 → 1.10 → 1, 260ms | **one soft pulse**: a 2px `text` ring in the pill's own rounded-square shape, opacity .4 → 0, scale 1 → 1.16, 500ms from 120ms | 15px, **`text`** (was `text-muted`), fades in as 022 | 1.6s |
| **Bogey** | bump, then **the wince**: one decaying side-to-side shake of that pill with a slight twist: −6 / +5 / −3 / +2 / 0 px, −1.5 / 1.2 / −.6 / .3 / 0°, 360ms from 160ms, ease-out | — | 15px, `text-muted` (as 022) | 1.6s |
| **Double or worse** | 022 stamp (mark scales in from 1.45, 160ms) + thud (220ms from 140ms), then **the hard wince**: −9 / +8 / −6 / +4 / −2 / 0 px, −2.5 / 2 / −1.2 / .6 / 0 / 0°, 420ms from 300ms | — | 15px, `double`, tilts in (022) | 1.6s |

- The wince uses the individual `translate` / `rotate` properties, so it composes with the bump or thud (`transform`)
  without fighting it. It moves the pill, never its box: nothing around it reflows.
- The burst's sparks go past the pill into the gap and the neighbouring pad for half a second. They're `pointer-events:
  none` and gone by 640ms.
- The hole's points (022 §3: the standing rolls, "+1 point" swaps in for "vs …", Next hole bumps) are unchanged and
  still play on the deciding score, on top of that score's own motion.
- A tap on the same score again replays its motion (as today). A new tap jumps the last one to its end.

### 1.2 Net vs gross: which one drives what

| | Driven by | Why |
|---|---|---|
| The **mark** (circle, double circle, square, double square; red for a double) | **gross** | The scorecard rule, unchanged since 021. |
| **Everything else**: pop, pulse, ripples, burst, wince, stamp, thud, the word and its size / hold | **net** | It's the result that counts in the game. |

So a player with a stroke who makes a gross bogey sees a **square** drawn but gets **par's** pop + pulse and the word
"Net par" in `text` (`15-pick-net-par`). A gross double that's a net bogey keeps its red double square (drawn, not
stamped) and gets the bogey wince, word "Net bogey". A net double or worse is always a gross double too, so the stamp
always has a red mark to stamp.

### 1.3 The rules in code (changes `js/reward.js`)

`reward(strokes, par, strokesHere)` gains `kind` and new tones; the rest of 022's helpers stay:

```js
const kind = d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
return {
  word, kind,                                   // kind → class .k-<kind> on the picked .ce-pad (only with .anim)
  tone: { eagle: 'big', birdie: 'lift', par: 'par', bogey: 'quiet', double: 'dbl' }[kind],   // .ce-word.<tone>
  stamp: d >= 2,                                // unchanged
  ripples: d <= -2 ? 2 : d === -1 ? 1 : 0,      // birdie now gets one
  burst: d <= -2,                               // new: <span class="ce-burst anim"> with 8 <i style="--a:0deg…315deg">
  pulse: d === 0,                               // new: <span class="ce-pulse anim">
  holdMs: d <= -2 ? 3000 : d === -1 ? 2200 : 1600,
};
```

Update `tests/enter021.test.mjs`' expectations (par's tone is `par`, birdie's ripples 1 and hold 2200) and add the
`kind` cases: par 4 with 2 / 3 / 4 / 5 / 6 → eagle / birdie / par / bogey / double; par 4, 1 stroke, 5 → `par`, word
"Net par".

### 1.4 The wince is not the nudge (`16-wince-vs-nudge`)

The existing nudge (Next hole tapped with a score missing) stays exactly as it is. They can't be confused:

| | Wince (bogey / double) | Nudge (a score is missing) |
|---|---|---|
| What moves | **one** pad: the white pill you just picked | **every** pad of each row that has no score (none of them picked) |
| Shape | one burst that dies away, with a twist | an even ±4px wobble, twice, no twist |
| Length | 360ms (bogey) / 420ms (double) | 900ms |
| When | right after a tap on a score, with the word "Bogey" / "Double" | right after a tap on Next hole, with "Next hole · 2 to go" / "Waiting on …" |

---

## 2 · Part 2: the card turns to the next hole

### 2.1 What moves and what never does

**Moves:** the hole number (rolls), Par (rolls when it changes), the yardage card's **contents** (green picture and the
three numbers), the match line **only when it says something new**, and the **score card** (your rows) plus each quiet
row (the rest of your tee time), or the read-only rows on a played / "Up next" hole.

**Never moves:** the ◀ ▶ ⋯ buttons, the yardage card's frame, Next hole, the tab bar (027: nothing pinned moves).
Next hole's label and color change at 0ms with no motion ("Next hole" white → "Next hole · 4 to go" grey).

### 2.2 The timeline (forward; back mirrors it) — `motion.css` Part 2

| ms | What |
|---|---|
| 0 | The new hole is drawn. The outgoing faces sit on a layer above it, at their old places. |
| 0–300 | **Hole number rolls** 4 → 5: the old number goes up and out, the new one comes up from below (022's roll curve). Par rolls the same way from 40ms when it changes (`40-turn-2v2-new-partner`: Par 3 → Par 4). When the number gets wider or narrower (9 → 10), "Par 4" slides to its new place over the same 300ms. |
| 0–120 / 60–300 | **Green picture**: 027's blur swap (old blurs out, new sharpens in). |
| 60–460 | **FRONT / MIDDLE / BACK roll**, odometer style: only the digits that change roll, left to right 30ms apart; FRONT starts at 60ms, MIDDLE 80, BACK 100. 142 → 148 rolls one digit; 98 → 112 rolls all three (the new leading digit comes in from blank). |
| (a) 0–150 / 140–300 | **Score card flips**: turns away around its middle (top tips back, 0 → 90°, ease-in), the new hole's card turns up from below (−90 → 0°, ease-out). Edge-on it darkens a little (`--t-shade`). Each quiet row follows 40ms behind. |
| (b) 0–150 / 100–300 | **Score card page-turns**: slides 56px left and tilts 18° while fading, the new card slides + tilts in from the right. Each quiet row 30ms behind. |
| 240–584 | **The new pads land**: fade + scale .82 → 1.04 → 1, 200ms each, 24ms apart along a row, 48ms per row (2 rows of 5 pads). |
| 0–300 | **Match line**, only if its text changes (new opponent, new partner, sitting out starts / ends): 027 blur swap. Otherwise it doesn't move. |

Stills at 0 / 90 / 150 / 300ms: `20`–`23` (a) forward, `24`–`27` (a) back, `28`–`31` (b) forward, `32`–`35` (b) back,
dark + light. Strips `36`–`39` add 450 and 600ms to show the pads landing.

### 2.3 (a) Flip or (b) page turn — recommend (a)

- **(a) keeps one direction for everything.** Forward, the number, the yardage digits and the card all move up; back,
  they all move down. (b) mixes a sideways card with vertical numbers.
- **(a) doesn't suggest a swipe.** A sideways page slide looks like something you can drag, and the design system
  forbids swiping between holes (too easy by accident). People will try it.
- **(a) stays in the card's own footprint.** (b) slides 56px past the 16px gutter and overlaps the quiet row with its
  neighbour for a moment (`30-b-page-forward-150`): busier.
- (b) reads as "next page" faster on a first look. If Andrew prefers it, it's the same build with the other keyframes.

### 2.4 The yardage card (`47`, `48`)

It's the first thing people look at on the course, so it stays put: same frame, same size, same labels. Only the green
picture swaps and the digits roll. Regular (92px) and Compact (68px) do the same thing; Compact's side numbers roll
at their 15px height. Rules:

- **GPS updates never roll.** The numbers change as you walk (watchPosition); those changes stay instant text swaps as
  today. Only a hole change rolls.
- **No yardage card on either hole** (GPS off, no green data, far from the course): nothing else changes (`45`).
- **The card comes or goes** (it only shows on your hole and the one you just finished, never on "Up next" or locked
  holes, 021 §1): the old card blurs out where it was, and everything below it (match line + rows) slides to its new
  place over 300ms, FLIP-style with transform only (`43-turn-to-up-next`). Coming back, the card blurs in and the rows
  slide down.
- **Finding you / weak:** the "–" or muted numbers roll like any digit.

### 2.5 By game (`40`–`46`)

| State | What turns |
|---|---|
| Team cart (`01`, `36`) | Your card (2 rows, green rail inside it) flips, then the quiet row ("Sam – Jake – Enter ›") 40ms later. |
| 2v2 (`04`, `40`) | Same. On a partner switch (7, 13) the match line blur-swaps to "Holes 7–12 · with Sam" and the rows change people as they flip. |
| 6 players, sitting out (`05`, `41`) | Your card only (your tee time is just your cart: no quiet row). Coming out of the sit-out, the match line swaps from "Sitting out · back on 7 vs …" to the standing. |
| Scorecard only (`06`, `42`) | Your one row flips (one row of pads lands, 5 pads); the quiet row with the other 3 follows. |
| "Up next" / played holes (`08`, `43`, `44`) | The read-only rows flip as one panel; no pads land (there are none). |

### 2.6 What starts a turn, and which way

- **Next hole** (all scores in) → forward. **◀** → back. **▶** → forward (into "Up next" past your hole).
  **Back to hole N** → toward N. A hole in the **grid** → forward if it comes later in play order, back if earlier
  (play order, so a round that starts on 10 turns forward from 18 to 1).
- **A jump of several holes from the grid is one turn**, the same 300ms: the number rolls straight from 11 to 3 (no
  counting through), the yardages roll straight to the new hole's (`44-turn-grid-jump-back`).
- **No turn:** a redraw (realtime scores, the clock, GPS), opening Enter or switching tabs, the last hole's
  **Round done** (goes to the Board: a tab change), a **finalized** round (◀ ▶ redraw at once), and while a sheet is
  open.
- **Switch it up** (`52`): Next hole draws the new hole under the full-screen card; the turn waits and plays when the
  card closes (Continue to hole 7), from the old hole to the new one.
- **Interruptible:** any tap during a turn (a score, ◀ ▶, Next) jumps it to the end first, then does what was tapped.

---

## 3 · Build notes

- **Only transform, opacity and filter** animate (and the individual `translate` / `scale` / `rotate`). Nothing changes
  a box's size, so `enter.mount`'s Regular / Compact measuring is untouched: measure with `offsetHeight` (layout), never
  `getBoundingClientRect` (it includes transforms), or measure before the turn classes go on.
- **The app redraws constantly.** Follow the reward pattern: on the tap, set `app.ui.ceTurn = { from, to, dir, at }`;
  `ryderEnterView` reads it while `now < at + 600` and draws: `data-turn` / `data-dir` on `.ce`, `data-t0="at"`, the
  roll markup for the hole number / Par / changed digits, `t-in` + `--t-lag` on the panels, `t-land` + `--t-r` /
  `--t-i` on the pads. `ui.syncMotion` puts every animation back at `now − at` after each redraw.
- **The outgoing faces are drawn from data, not cloned.** Each redraw renders the old hole's card / quiet rows /
  match line / green picture from `ceTurn.from` (same functions, read-only, no `data-act`) into `.ce-turn-layer`,
  `aria-hidden`. Their old places come from one measurement at tap time (`ceTurn.rects`), so a redraw never moves them.
  Remove the layer at `at + 600`.
- **FLIP numbers** (`--t-dy`, `--t-dx`): measured once at tap time (old top / left − new top / left).
- **Reduced motion:** add `rm` on `<html>` from `matchMedia('(prefers-reduced-motion: reduce)')` (and its change
  event), and use `data-turn="fade"`. `motion.css` holds both. Remove the existing `@media (prefers-reduced-motion)`
  block for `.ce-*` when you paste Part 1, since `.rm` replaces it.
- **One unit test** (CLAUDE.md: one per feature): a pure `ui.turnPlan(fromHole, toHole, startHole)` →
  `{ dir, rolls: { hole, par, digits: [front, middle, back] } }` where each digit list says which positions roll
  (e.g. 142 → 148 = `[false, false, true]`, 98 → 112 = `[true, true, true]`), plus `dir` for 18 → 1 on a round that
  starts on 10 = forward. And the `reward()` cases in §1.3.
- No engine, score sync or database change: Enter's view and `ui` only, so no smoke run is needed.
- Design system: add §6's lines to `docs/design/design-system/README.md` (Motion and gestures).
- When built, set this file's status to "Status: built in <commit>".

## 4 · Reduced motion (`50`, `51`)

- **Picks:** no bump, pop, pulse, ripple, burst, wince, stamp, thud or draw. The pill and its mark are there at once;
  the word fades in and out (same hold as full motion: 3s / 2.2s / 1.6s). The hole's points line shows without
  sliding (022).
- **Turn:** a 150ms cross-fade of everything that changes (old faces fade out, new fade in, both in place); numbers
  cross-fade in place, no roll; no flip, no slide, no pad stagger; a yardage card that comes or goes just fades, and
  the rows jump to their new place.
- The nudge doesn't shake (unchanged).

## 5 · Screenshots

All 393 × 659 @2×. Dark `NN-name.png`, light `NN-name-light.png`.

| # | Name | What |
|---|---|---|
| 01–08 | `team-cart`, `team-cart-no-yardage`, `team-cart-compact`, `2v2`, `six-sitting-out`, `scorecard`, `scorecard-no-yardage`, `up-next` | The states at rest, dark + light |
| 10–14 | `pick-eagle` … `pick-double` | Andrew's row at 0 / 80 / 160 / 260 / 400 / 560 / 1000ms, dark + light |
| 15 | `pick-net-par` | Sean with a stroke: gross bogey mark, net par motion |
| 16 | `wince-vs-nudge` | The two shakes, frame by frame, dark + light |
| 20–35 | `a-flip-forward-000` … `b-page-back-300` | The turn at 0 / 90 / 150 / 300ms: (a) and (b), forward and back, dark + light |
| 36–39 | `…-strip` | The same four as strips with 450 / 600ms (pads landing) |
| 40–46 | `turn-2v2-new-partner`, `turn-six-back-in`, `turn-scorecard`, `turn-to-up-next`, `turn-grid-jump-back`, `turn-no-yardage`, `turn-compact` | Each state mid-turn, 0 / 90 / 150 / 300 / 600ms, (a) |
| 47–48 | `yardage-regular-strip`, `yardage-compact-strip` | The yardage card, hole 9 → 10, 0–420ms, dark + light |
| 50 | `reduced-turn-075` | Reduced motion, 75ms into the cross-fade, dark + light |
| 51 | `reduced-pick-double` | Reduced motion, a double: nothing moves, the word fades |
| 52 | `switch-it-up-then-turn` | The turn waits under Switch it up |

## 6 · Design system README: proposed text (Motion and gestures)

Replace "…score bumps and the reward motion (021/022). Nothing else moves." with:

> …score bumps and the reward motion (021/022/033: rarer results get more: eagle burst, birdie ripple, par pulse,
> bogey wince). **Changing holes on Enter turns the card** (033): the score card flips, numbers that change roll, the
> green picture blur-swaps, the yardage card's frame stays. **A wince** (one picked pad, a decaying shake with a twist)
> means a bad score; **a nudge** (every empty pad in a row, an even wobble) means a missing score. Nothing else moves.
