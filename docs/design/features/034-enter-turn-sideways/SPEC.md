# 034 · The turn, sideways: holes move left to right

Status: exploration, round 3 (Nov 21), waiting for Andrew's pick. Not built.

**Changes 033 §2.2–2.3** (how the card turns to the next hole). Everything else in 033 stands: Part 1 (score picks),
what moves and what never moves (§2.1), the yardage card rules (§2.4), what starts a turn (§2.6), the build notes and
reduced motion.

**Why.** Andrew, after trying 033 (Nov 20): the scoreboard flip is cool, but "every time you flip it's a new board
behind it". It's a magic trick, not the journey. Moving to the next hole should feel like moving **along** the course:
forward goes right, back goes left, like the ◀ ▶ arrows. 034 adds two sideways turns to compare with 033's.

## Round 3 (Nov 21): just the cards move — current proposal

**Andrew on round 2:** "it's good, but can we try one where just the yardage widget card moves and the scoring enter
card moves, and the rest of the UI stays, with some easy easing."

**(g) Just the cards.** The yardage card and the score card slide one screen-width together: Next hole = out to the
left, the next hole's cards in from the right; ◀ = the other way. Everything else stays where it is.

| Part | What it does |
|---|---|
| Yardage card + score card (or the read-only rows on a played / "Up next" hole) | Slide together, **420ms, `cubic-bezier(.4,0,.2,1)`** (a gentle ease-in-out: starts softly, glides, settles softly; slower than the 320ms of (e)). Old ones from 0 to −(screen width), new ones from +(screen width) to 0. |
| Title (Hole 4 → Hole 5 · Par), the quiet row (the rest of your tee time), the match line if it says something new | **Stay in place** and change their words with a short crossfade: old out over 0–160ms, new in over 120–340ms (a small overlap so it never blinks empty). |
| ◀ ▶ ⋯, Next hole, the tab bar | Never move (Next's label changes at 0ms). |

- Nothing changes inside a card: the next hole's yardage card arrives with its own green and numbers.
- **A yardage card that comes or goes** ("Up next", no GPS): it leaves (or arrives) with the score card; the match
  line and quiet row crossfade straight into their places on the new layout (`82`).
- Exact values: `motion.css`, "ROUND 3". Build: as (e) below, with two lists (the parts that slide get `.t-page`,
  the parts that stay get `.t-fade`).
- Reduced motion: unchanged from 033 §4 (a 150ms crossfade, nothing moves).

Screenshots: `70`–`77` at 0 / 90 / 150 / 300ms, Next 4 → 5 and ◀ 5 → 4, dark + light; strips `80` forward, `81` back
(0 / 60 / 120 / 180 / 240 / 320 / 420ms); `82` into "Up next", `83` 2v2 new partner, `84` no yardage card.

## Player rows, take 5: the name outside the card (Nov 21) — current proposal

**Andrew, building on take 4's pattern 5 (a card each):** "move the names outside the card to make the card even, and
then you have no weird header."

**6 · Name outside** (prototype default; ⋯ → Player rows):
- Each player in your cart gets their own card holding **only the pads**: 8px above and below them, 16px at the sides,
  `surface-1`, `radius-xl`, the green rail inside on the left (your cart only). Nothing else is in the card, so it's
  even top to bottom.
- The name sits **above** its card as a small group label, like a grouped-list section header: `label` (12 mono 600,
  uppercase, letter-spacing 1px), `text-muted`, 20px tall, lined up with the pads' left edge (16px in), 4px above the
  card. "· 1 STROKE" follows the name on a stroke hole; the reward word (033 Part 1) appears after the name in its
  own style (sans, 15 / 17).
- 12px between one player's card and the next player's label. Total height for two players ≈ today's card (≈ 212px).
- Pads, ⋯, marks, reward motion, the match line and the quiet row are unchanged. No new tokens or type styles.
- The turn (g) slides both cards together as the score card.

### One line: your name + partner on the left, the match on the right (Nov 21) — current proposal

**Andrew (comment on the prototype):** the match line and `ANDREW (WITH SEAN)` are on separate lines; put them on the
same line.

- There is **no separate match line.** Your card's label row carries both: `ANDREW (WITH SEAN)` on the left
  (`label` style), `4 UP  vs Sam + Jake` right-aligned on the same 20px row (standing mono 700, green when you're up;
  `vs …` 15/500 `text-muted`). Saves the 36px line.
- A long name + partner shrinks first with an ellipsis; the score never wraps.
- 2v2 holes 7–12: `ANDREW (WITH SAM) ……… AS  vs Sean + Jake`.
- The hole's points (022 §3) swap in where `vs …` is. Sitting out and Scorecard only keep their own line (below).
- Prototype ⋯ → "Match line": **One line** (default).

**Spacing (Andrew: each name should sit closer to its own card than to the card above it).** Measured from the text
(ink) to the card edges, on a 393 screen, with and without the yardage card:

| Between | Gap |
|---|---|
| Yardage card (or the hole title when there's none) → first name line | 24px |
| Name line → its own card | **6px** |
| One player's card → the next player's name line | 24px |
| Last card → the rest of your tee time (quiet row text) | 24px |

CSS that gives it: name row 20px tall with its text on the row's foot (`align-items: flex-end`, line-height 16px),
6px under it; 20px between groups; 20px above the first group; the quiet row 5px under the last card. Cards: 8px above
and below the 64px pads, 16px at the sides.

### Your partner in brackets on your name (Nov 21)

**Andrew on A / B below:** no to those conventions; keep the names outside the cards. "Whoever you're paired with
could just be the additional info, in parentheses next to my name."

- **Your label says who you're playing with:** `ANDREW (WITH SEAN)`. Same `label` style as the name, `text-muted`.
  Shown in every game with a match (Partner "Rider" Cup, 2v2, 6 players while you're in a match); not in Scorecard only
  or while your cart sits out.
- **It matters most in 2v2:** your cart (you + your cart mate) stays in the card all round, but your partner changes
  every 6 holes. Holes 7–12: `ANDREW (WITH SAM)` over your card, `SEAN` (your cart mate, an opponent this set) under
  it, and Sam in the quiet row. The prototype's 2v2 now models it this way.
- **The match line keeps only its right side**, where it is today: `4 UP   vs Sam + Jake` (standing green when
  you're up, `vs …` muted), right-aligned on the same 36px line. "Andrew + Sean" is gone from it. The hole's points
  still swap in where `vs …` is (022 §3).
- Prototype ⋯ → "Match line": **(with …) on your name** (default) · A · B · As today.
- Open question: in the cart game your partner is always the card right under yours, so `(WITH SEAN)` repeats it.
  It could show only when your partner isn't in your card (2v2 swaps).

### The match line with "name outside", A / B (Nov 21) — rejected

**Andrew:** best one yet, but "Andrew + Sean" right above "ANDREW" repeats. The partner has to be clear after a swap.

Your cart's names are now on the card labels, so the match line drops them and says only the score and who you play.
The partner fact moves onto the partner's label. Prototype ⋯ → "Match line": **A · Score first** (default) ·
**B · In the label** · As today.

- **A · Score first:** `4 UP   vs Sam + Jake`, left-aligned (standing in mono 700, green when you're up; then
  `vs …` in `text-muted`). Same 36px line as today.
- **B · In the label:** no match line at all. The same `4 UP  vs Sam + Jake` sits right-aligned on the first card's
  label row (`ANDREW ……… 4 UP vs Sam + Jake`). Saves the 36px line.
- **2v2:** the partner's label says it: `SAM · NEW PARTNER` on the first hole of a set, `SAM · PARTNER` after that.
  The match line reads `AS  vs Sean + Jake`. (Replaces today's "Holes 7–12 · with Sam".)
- **6 players sitting out:** `Sitting out · back on 7 vs Mike + Justin` on its own. **Scorecard only:**
  `+2 · 3RD   Leader Sean −1`.
- The hole's points (022 §3) still swap in where `vs Sam + Jake` is, in both A and B.

---

## Player rows, take 4: five patterns to compare (Nov 21)

**Andrew on take 3:** no. He'll look on Mobbin for references; first, one prototype of each pattern Claude suggested
(UDisc, Hevy / Strong, Apple Weather / Health, Airbnb's guest picker, Daylio were the references named).
Prototype ⋯ → "Player rows": **1 · Avatar** (default) · 2 · Name chip · 3 · One at a time · 4 · Stepper ·
5 · Card each · As today. All use existing tokens and the six type sizes; reward motion (033 Part 1) plays in each.

| # | Pattern | What it looks like | Tradeoff |
|---|---|---|---|
| 1 | **Avatar** | The name line starts with a 24px initial circle (`surface-3`, 13/600), like a contact row. Pads unchanged. | Smallest change; the line reads as a header with an identity, but the space on the right stays. |
| 2 | **Name chip** | No name line. The first tile of each strip is a 76px `surface-2` chip with the name and "More ⋯" under it; it **is** the more-scores button, so ⋯ goes away. Picked score outside the four shows as "Picked 8". | Pads ~58px wide (today ~62): close to full size. Card ~50px shorter. |
| 3 | **One at a time** | A segmented control of your cart's players at the top of the card (name + their mark, or the reward word), one row of full-size pads. After a pick it moves to the next player still missing a score (650ms). | Shortest card. One extra tap to fix your partner's score after it moved on. |
| 4 | **Stepper** | Like UDisc / Airbnb: name + "+2 through 5" on the left, − score + on the right (56px round buttons, a 72 × 64 score box). The first tap on any of the three = par, then − / + step (the old Enter's rule). The score box gets the marks and reward motion. Tap the box for every other score. | One row per player, biggest targets; usually 1–3 taps instead of 1. A return to the stepper the calm Enter (021) replaced. |
| 5 | **Card each** | One card per player with a small label in its corner (`label` 12 mono, uppercase), like Apple Weather's modules; the green rail on each of your cart's cards. Reward word sits after the label. | Same height as today; the name is quieter, so the blank space is a label row, not an empty name line. |

---

## Player rows, take 3: centred names (Nov 21) — rejected

**Andrew on take 2:** no, it makes the pads smaller to hit. "What if you just centred the names?"

- The name line stays exactly as today (24px, `row` 17/600), but the **name is centred over the pads** instead of
  sitting at the left edge. The space either side reads as deliberate, like a heading over the row.
- "1 stroke" and the reward word (033 Part 1) appear just to the **right** of the name, 8px after it, positioned off
  the name so the name never shifts when the word comes and goes. A long name is capped at 60% of the row.
- Pads, ⋯, card padding and the match line are all unchanged from today (022 / 031). Nothing new in the design system.
- Prototype ⋯ → "Player rows": **Centered names** (default) · As today.

---

## Player rows, take 2: the name beside the pads (Nov 21) — rejected (pads too small to hit)

**Andrew on take 1 (below):** no. Try other UI changes. So this time the layout changes instead of filling the gap:
**the name line is gone.** Each player is one row: name on the left, pads on the right.

Prototype ⋯ → "Player rows": **Name beside** (default) · **Name beside + labels** · As today.

- **Name beside:** a 76px name column (`row` 17/600) and the pads. Under the name, small: "1 stroke" on a stroke hole,
  or the reward word for 1.6–3s after a pick ("Birdie", 033 Part 1 sizes and motion). Pads stay **64px tall**; ⋯
  narrows from 56 to 32px so the four pads stay ≥ 48px wide (49px on a 393 screen). Card padding 4 / 12 / 4 / 16px
  (the green rail keeps its place). The card gets ~50px shorter for two players.
- **Name beside + labels:** the same, plus one row of column labels at the top of the card, `BIRDIE PAR BOGEY DOUBLE`
  (`label` 12 mono, `text-muted`, letter-spacing .5px so DOUBLE fits the 49px column). The four pads are always
  birdie…double, so the labels never change; they explain the marks once per card instead of a name line per player.
- The match line stays as 022 approved it (`Andrew + Sean   4 UP   vs Sam + Jake`).
- Flagged: ⋯ at 32px wide is narrower than the 48px tap minimum (it's 64px tall, and the whole column edge is hittable,
  so the target is 32 × 64 + the 6px gap). If that's a problem, the name column can drop to 68px and ⋯ go back to 40.

---

## Player rows, take 1: round score in the name line (Nov 21) — rejected



**The comment:** the line with each player's name above their pads leaves an awkward blank space on the right; and the
match line says "Andrew + Sean" right above a card that says Andrew and Sean again. (In a 2v2 swap your partner
changes, so the match line has to say who you're with, but not twice.)

**The pass** (prototype ⋯ → "Name line + match line": New / As today; New is the default):
- **Each name line shows that player's round so far on the right:** `Round +2` (`small` 13/500, `text-muted`; the
  number in mono 600, `text`). Players who get strokes read `Net −1` (net to par). It sits right-aligned; the reward
  word ("Birdie") still appears straight after the name, and "1 stroke" still shows on a stroke hole. It's real
  information each golfer checks anyway, in the space that was empty.
- **The match line names only the other side:** `vs Sam + Jake` on the left (`row` weight, `text`), the standing
  (`4 UP`, green when you're up) on the right. Your own names are in the card right under it.
  - 2v2: `With Sam · vs Sean + Jake` (your partner on this set, because it isn't always your cart partner).
  - 6 players sitting out: `Sitting out · back on 7 vs Mike + Justin` on its own.
  - Scorecard only: `Leader · Sean −1` on the left, your place (`3RD`) on the right; your own score is now on your
    name line.
  - The hole's points (022 §3) swap in where `vs Sam + Jake` is, as before.
- No new colors, sizes or type styles. Changes 022 §2 (the match line) if approved.

---

# Round 2 (Nov 21): the whole hole moves

**Andrew on round 1's (c) Slide:** "almost there. I like it sliding sideways, but the numbers changing sideways is
weird too. If anything the whole yardage card can just move with it."

So: **the whole hole is one page.** The title (Hole 5 · Par 4), the yardage card, the match line, the score card and
the quiet rows all slide together. Next hole = the page slides off to the left and the next hole's page comes in from
the right; ◀ = the other way. Nothing changes **inside** anything: no rolling hole number, no rolling or sliding
yardages, no blur-swapped green. You see hole 4 leave and hole 5 arrive, like walking to the next tee.

| | How it moves |
|---|---|
| **(e) Whole hole** *(recommended)* | One rigid page. Every part moves one screen-width in 320ms, `ease-grow`, all at once. |
| **(f) Whole hole, wave** | The same, but top to bottom 24ms apart (title, yardage card, match line, card, quiet rows), so the page arrives like a short wave. Livelier; the parts briefly separate (`62`). |

Exactly (`motion.css`, "ROUND 2"):
- Old parts move from 0 to −(screen width); new parts from +(screen width) to 0. 320ms, `cubic-bezier(.2,.8,.2,1)`.
  The gap between the two pages is the screen's own gutters (32px). The screen edge clips them.
- **Pinned, never move:** ◀ ▶ ⋯ (the sliding title passes **under** them: the button group gets the screen's `bg`
  with a 12px soft edge on its left), Next hole, the tab bar. Next hole's label changes at 0ms.
- **Each hole keeps its own layout.** If the next page has no yardage card ("Up next", locked holes, no GPS), it simply
  isn't on that page: no fading, no rows moving up (`64`). This also removes 033's FLIP.
- The new pads arrive with their page (no landing stagger). Score-pick motion (033 Part 1) is unchanged.
- **Reduced motion:** unchanged from 033 §4 (a 150ms crossfade, nothing moves).
- **Build:** the same pattern as 033 §3 (outgoing parts drawn from data on `.ce-turn-layer` at their tap-time places,
  `data-turn="hole"`, `data-t0`, `ui.syncMotion`), but simpler: no roll markup, no FLIP numbers, no per-digit plan. Set
  `--t-w` to the screen width on `.ce` at tap time. `ui.turnPlan` (033 §3) shrinks to `{ dir }` and its test to the
  play-order direction cases (18 → 1 on a round that starts on 10 = forward).

Why (e) over (f): one rigid page reads most clearly as "the next hole", and it's the calmest. (f) is there if (e) feels
too plain on the phone.

Round 2 screenshots: `40`–`47` (e) and `48`–`55` (f) at 0 / 90 / 150 / 300ms, Next 4 → 5 and ◀ 5 → 4, dark + light;
strips `60`–`63` (0 / 40 / 80 / 120 / 180 / 240 / 400ms); `64` (e) into "Up next", `65` (e) 2v2 new partner,
`66` (e) no yardage card, `67` (f) into "Up next".

---

# Round 1 (Nov 20): (c) slide and (d) book page

## 0 · Flagged

- No new colors, sizes, type styles or tokens. Durations and curves are 033's (300ms `ease-grow`, the ease-in for
  leaving, the 16px gutter as the gap between holes).
- **Swiping.** A sideways motion makes the card look like something you can drag. The design system says never swipe
  to change holes (too easy by accident). Keep that rule: swipes still do nothing. If people try to swipe, it's worth
  revisiting later (a deliberate swipe with a long threshold), but not in this change.
- 033's README line (033 §6) changes from "the score card flips, numbers that change roll" to "the score card slides
  to the next hole, numbers that change slide with it" if (c) wins.

## 1 · The options (prototype ⋯ → Turn to the next hole)

| | What it says | How it moves |
|---|---|---|
| **(c) Slide** *(new, recommended)* | Holes sit side by side. Next hole = the course moves left. | The score card and quiet rows slide out to the left as the new hole's slide in from the right, together, one card width + 16px apart. 300ms, `ease-grow`, no fade, no 3D. |
| **(d) Book page** *(new)* | The round is a scorecard booklet. Next = turn the page. | The card is a page hinged on its left edge: Next turns it over to the left (0 → −90°, darkening) and the new hole is underneath, coming out of its shadow. Back turns the previous page back over from the left. 300ms. |
| (a) Flip (033) | A scoreboard panel turns over. | Vertical, around the middle. |
| (b) Page turn (033) | | Slides 56px + tilts, crossfading. |

**Recommendation: (c) Slide.** It's the most literal: nothing magic appears behind anything, the old hole leaves the
way you're walking and the new one arrives from where you're going. (d) is linear too, but it still has "the next one
was underneath", the thing Andrew didn't like about the flip. (b) is sideways but fades both cards over each other,
which reads as a swap, not a move.

## 2 · (c) Slide, exactly (`motion.css`)

| ms | What (forward; back is the mirror image) |
|---|---|
| 0–300 | **Score card** slides from 0 to −(its width + 16px); the new card slides from +(width + 16px) to 0. Same curve, same time, so they travel as one strip. Quiet rows follow 20ms behind. Off-screen parts are clipped by the screen edge. |
| — | **The new pads come with their card.** 033's landing stagger is dropped for (c) and (d): the pads are part of the page that arrives. |
| 0–280 | **Hole number** slides sideways: the old number moves 14px left and fades (160ms), the new one comes in 14px from the right (220ms from 60ms). Par does the same from 40ms when it changes. |
| 0–300 | **Yardage card**: the frame stays put. The green picture slides 24px left and fades out (150ms), the new green slides in from the right (240ms from 60ms), clipped to the picture's box. FRONT / MIDDLE / BACK: each changed digit slides like the hole number, left to right (033's stagger: 60ms + 20ms per number + 30ms per digit), unchanged digits stay still. |
| 0–300 | **Match line**, only when it says something new: slides out left / in from the right like the green picture. |
| 0–300 | **Yardage card comes or goes** ("Up next", locked holes): it slides 24px and fades where it was; the rows below move up or down into place (033's FLIP). The rows move up while sliding in, so for that one turn the motion is diagonal (`30`). |

Everything moves the same way: forward, the whole screen's content travels left; back, right. Nothing goes up or down
except the FLIP when the yardage card comes or goes.

**Reduced motion:** unchanged from 033 §4: a 150ms crossfade, nothing moves.

## 3 · (d) Book page, exactly

- Forward: the old page (on the turn layer, on top) rotates `perspective(1200px) rotateY(0 → −90deg)` around its left
  edge, `cubic-bezier(.4,0,.2,1)`, 300ms, darkening to `--t-shade`; the new page underneath goes from `--t-shade` to
  full brightness over the same 300ms. Quiet rows 30ms behind.
- Back: the turn layer goes **under** the body; the previous page rotates in from −90° to 0 over the old one, which
  darkens.
- Quiet rows and read-only rows get the screen's `bg` as a background while turning (they have none at rest),
  so the text on the page underneath doesn't show through.
- Numbers, green picture, match line: the same sideways slide as (c).

## 4 · Files

| What | Where |
|---|---|
| Prototype: (g) Just the cards is the default; ⋯ switches to (e), (f), round 1's (c), (d) and 033's (a), (b) | `prototype.html`. Loads `../033-enter-motion/motion.css` then this folder's `motion.css`. Also at https://claude.ai/artifact/XEedkFZGGfzYwXx2Ti33wy (same link as 033: now opens on (g)). |
| Exact values for (c) and (d) | `motion.css` (adds to 033's; loads after it) |
| Screenshots | `screenshots/`, 393 × 659 @2×. Re-render: `node docs/design/features/034-enter-turn-sideways/shoot.mjs` |

| # | Name | What |
|---|---|---|
| 01–08 | `c-slide-forward-000` … `c-slide-back-300` | (c) at 0 / 90 / 150 / 300ms, Next 4 → 5 and ◀ 5 → 4, dark + light |
| 09–16 | `d-book-forward-000` … `d-book-back-300` | (d), same |
| 20–27 | `…-strip` | (c), (d), (a), (b) side by side frame for frame (0 / 60 / 120 / 180 / 240 / 300 / 600ms), forward and back |
| 30–32 | `c-slide-to-up-next`, `c-slide-2v2-new-partner`, `d-book-to-up-next` | The yardage card leaving, a partner switch |
| 33 | `c-slide-yardage-strip` | The yardage card close up, hole 9 → 10, dark + light |

## 5 · Build notes (only what differs from 033 §3)

- `data-turn` takes `slide` or `book` (and `fade` for reduced motion). No `t-land` on pads.
- The numbers keep 033's markup (`.t-roll > .t-col > .t-o / .t-n`); for (c) / (d) the CSS stacks them in place and
  slides them instead of rolling. `ui.turnPlan` from 033 §3 still says which digits change; its test stands.
- When a winner is picked, delete the losing keyframes from the build (keep this folder as the record).
