# 034 · The turn, sideways: holes move left to right

Status: exploration, round 2 (Nov 21), waiting for Andrew's pick. Not built.

**Changes 033 §2.2–2.3** (how the card turns to the next hole). Everything else in 033 stands: Part 1 (score picks),
what moves and what never moves (§2.1), the yardage card rules (§2.4), what starts a turn (§2.6), the build notes and
reduced motion.

**Why.** Andrew, after trying 033 (Nov 20): the scoreboard flip is cool, but "every time you flip it's a new board
behind it". It's a magic trick, not the journey. Moving to the next hole should feel like moving **along** the course:
forward goes right, back goes left, like the ◀ ▶ arrows. 034 adds two sideways turns to compare with 033's.

## Round 2 (Nov 21): the whole hole moves — current proposal

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
| Prototype: (e) Whole hole is the default; ⋯ switches to (f), and to round 1's (c), (d) and 033's (a), (b) | `prototype.html`. Loads `../033-enter-motion/motion.css` then this folder's `motion.css`. Also at https://claude.ai/artifact/XEedkFZGGfzYwXx2Ti33wy (same link as 033: now opens on (e)). |
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
