# 027 · The feel: grow in place, one lit thing, the next thing peeks

Status: handed off (design), not built.

**What this is.** Five rules for how every screen in the app moves and what it lights up, borrowed from the feel of the Anchor concept (Alexpuda, the two screen recordings sent with the brief). We take its feel, not its look: no purple, no white panel over a dark screen, no Dynamic Island. 028, 029 and 030 are designed on these rules, so build this one first.

**Files**
- `motion.css`: the exact values (grow, fold, blur swap, lit, peek, add row, reduced motion). Copy it; don't re-derive it.
- `design-system/`: drop-in changes for the design system: `tokens-027.json` (the four tokens), `README-changes.md` (exact new text for Depth, Motion, Principles, Interaction patterns), and `components/GrowCard/README.md` (replaces Expand in place).
- `screenshots/NN-key.png` (dark) and `NN-key-light.png`, all at **393 × 659 @2×**, the iPhone 15/16 usable area the fit check uses. Grow frames are real stills of the motion at the stated millisecond.
- `mockups/`: `screens.html#{"s":"<key>"}` (add `"light":true`), plus `kit.css` / `kit.js` (the shared mockup kit 028–030 also use) and `shoot.mjs` (re-renders the screenshots: `node docs/design/features/027-feel/mockups/shoot.mjs 027-feel grow-rest …`). Run `npm install` once so Geist loads. Mockups are reference only: rebuild in the app's components.

**Decided by Andrew (Nov 18):** grow-in-place **replaces** the “Their scores” sheet on Enter. A second glow is OK if it's only ever on your live thing, **dark mode only**.

---

## 1 · Rule 1: grow where you tapped

A quiet row grows **in place** into its full card. The content inside swaps with a short blur (soft → sharp). Whatever was open folds back into its quiet row **in the same motion**. No new screen, no sheet sliding up.

**First uses:**
- **Enter:** the other cart / the rest of your tee time. This replaces the “Their scores” sheet (021 §4).
- **Board:** a match row or a player row. This replaces the read-only match sheet (015) and the team breakdown sheet. Drawn in 028.
- **Lobby:** your tee time card grows into hole 1 when scoring opens. Drawn in 029.

Sheets stay for side tasks: Rules, handicaps, fixing a hole, More scores (⋯), the PIN.

### 1.1 Enter, step by step (`01`–`07`)

| # | key | State |
|---|---|---|
| 01 | `grow-rest` | Your cart open (Andrew 4, Sean 5, green rail), theirs a quiet row: `Sam 4 · Jake –   Enter ›`. Next hole · 1 to go. |
| 02 | `grow-090` | 90 ms after the tap: both faces blurred, the old faces fading, the new faces starting. Nothing is ever empty. |
| 03 | `grow-150` | 150 ms: your cart is nearly folded into its row; their card is mostly open and sharpening. |
| 04 | `grow-open` | Open. Your cart is one quiet row (`Andrew 4 · Sean 5`, green rail in the gutter). Their card is in its place. Sam scored on his own phone, so his row is read-only (`from his phone`, 021 §4). Jake has pads. |
| 05 | `grow-open-picked` | Jake's 5 picked. Next hole turns white. |
| 06 | `fold-150` | Their card folding back, 150 ms in. It folds by itself 1.2 s after the last score with no taps (021 §4 timer, unchanged), or on **Done**, or on a tap on your folded row. |
| 07 | `fold-done` | Back at rest: `Sam 4 · Jake 5   Edit ›`. |

- **The head of the open card is the match line**, swapped in place with the same blur: `Entering for Sam + Jake` on the left, `Done` on the right (48 px hit area). This keeps Enter at its fixed height: no extra header row. Your standing comes back when it folds.
- **Their card has no jersey color.** Enter uses no jersey colors (021, unchanged). The brief's sketch drew their card in their cart color; this spec keeps 021's rule: `surface-1` card, no outline. Green stays only on your rail.
- **Your folded row** keeps the green rail (022 §1) and shows your marks. Tapping it swaps back (theirs folds, yours grows) in one motion.
- **Nothing pinned moves.** Next hole and the tab bar stay put. Your card shrinks by as much as theirs grows, so the rows trade space through the flex gap.
- The reward motion (021 §7 / 022) plays inside their card exactly as in yours.

## 2 · Rule 2: one hero fact per screen

One thing at `number-xl`; everything else is quiet. This is already the rule on Board and Matches. New uses: the lobby countdown (`42 min`, 029) and the final card's score (028). No system change.

## 3 · Rule 3: only the live thing is lit (`09`, `10`)

The one thing that is live **and yours** right now glows: your live hole tile on Matches, your tee time in the lobby on the day, your live rotation header on the Board.
- **Finished** things are solid and quiet.
- **Upcoming** things are dashed: hole tiles with a 1.5 px `line` outline and no fill, numbers `text-muted`.
- **Lit**, dark: `tint-you` fill, a 1.5 px `cart-you` inset outline, and `glow-you`.
- **Lit**, light: `tint-you` + outline, no glow (`09-lit-peek-light`).
- **At most one lit element per screen.** The dock's glow is the other one.
- **Nothing is lit before it's live** (`10-nothing-live`). Before the first score of the rotation, every tile is dashed, the score card says `Waiting for the first scores` with the matchup, and nothing glows.
- **When the live thing moves** (hole 10 → 11 is fully in), the old tile turns solid with its dots and the new one lights over `motion-grow`. No other motion.

## 4 · Rule 4: the next thing peeks (`09`)

What comes next sits dimmed at the bottom edge, so you know it's there without it competing.
- **Matches:** `Up next · holes 13–18 · 2nd tee time / vs Shank Redemption`, as a `surface-1` box above the tab bar.
- **Lobby:** the other tee times (029).
- **Setup:** what your tee times mean for your matches (030).
- **Opacity `peek` = 0.6 in both themes**, and **every text inside a peek is `text`**, never `text-muted`.
  - The brief's starting values (.4 dark, .5 light) fail contrast for the 12 px label inside: dark .4 → 3.6 : 1; light .5 → 3.6 : 1.
  - `text` at .6 → 6.5–6.8 : 1 dark, 5.0–5.1 : 1 light (on `bg` and `surface-1`), which passes 4.5 : 1.
  - `text-muted` at any of these opacities fails (≤ 3.7 : 1).
- A peek isn't a button unless it shows a chevron. When the thing it shows goes live, it **wakes**: opacity → 1 over `motion-grow`, and it takes the lit treatment if it's yours.

## 5 · Rule 5: new things go at the end

Adding something is always the **last row of its list, typed in place**: add a player (already how Setup works), add a tee time (030), name your cart (029).
- **The add row:** 56 px, `radius-lg`, 1.5 px **dashed** `line`, a plus icon + label in `text-muted` (`Add a tee time`).
- **Tapped:** the same box becomes the input. The border goes solid `text` with the focus ring, the caret is in it and the keyboard opens. Nothing slides in, and no sheet.
- **Confirmed** (return / Add): the new item swaps in with the blur swap, and a fresh add row appears under it.
- **Cancelled** (tap away with nothing typed): it turns back into the dashed row.

No system change; it's a pattern note in the README (`design-system/README-changes.md`).

## 6 · Motion: the numbers, and how they were tuned

Measured frame by frame (30 fps) in the two recordings. The brief's starting guesses came from stills; these are the tuned values.

| Moment in Anchor | What the frames show | Our value |
|---|---|---|
| Set Due Date → Repeat (UIXI, 10.9–12.2 s): content swaps inside one card | Sharp at frame 0. Fading and blurring from frame 1 (33 ms). Fully blurred, dim shapes still visible at frames 3–4 (~100–130 ms). The new content sharpens frames 5–9; sharp by frame 10 (~330 ms). The card's height changes over frames 2–7. | **blur-swap 8 px**: old out 0–40 % (0–120 ms, ease-in); new in 20–100 % (60–300 ms, ease-out); they overlap so no frame is empty. |
| Event → Deep work card (UIXI2, 15.7 s) | The card grows from the tapped event; settled ~8 frames later (~270 ms); ease-out, no overshoot. | **motion-grow 300 ms**, `cubic-bezier(.2,.8,.2,1)` (the app's existing pop curve). The brief guessed 320 ms. |
| Card → full-screen focus (UIXI2, 16.8 s) | ~9 frames to fill (~300 ms). The hero number settles last. | Same 300 ms. The hero is just content in the card face. |
| Back → card (UIXI2, 21.1 s) | Folds in ~5–6 frames (~180–200 ms), quicker than the grow. | A fold on its own (nothing opening at the same time) = **0.75 × motion-grow = 225 ms**. A swap (one folds while another grows) is a single 300 ms. |
| Lists pager (UIXI2, 8.2 s) | The next list's name sits dimmed at the edge, ~35–45 % in their light-on-black. | **peek 0.6**, tuned up for contrast (§4). Our pager is tap-only: no swipe. |

- **Easing:** `cubic-bezier(.2,.8,.2,1)` for grow / fold and the new face. `cubic-bezier(.4,0,1,1)` (ease-in) for the old face leaving.
- **What animates:** the slot's height (FLIP in JS: measure the old and new heights, animate `height` with Web Animations, `overflow: hidden`). The two faces' `opacity` + `filter: blur()`. Nothing else: no scale, no slide.
- **Interruptible:** a tap mid-motion jumps to the end state, then handles the tap.
- **Only right after a tap:** use `ui.foldIn(app.ui)`, as the reward motion does. A redraw never replays it.
- **Reduced motion** (`08-reduced-075`, 75 ms into the fade): the slot jumps to its new size; the new face fades in over 150 ms; no blur; lit and wake have no animation.

## 7 · The four tokens (`design-system/tokens-027.json`)

| Token | Dark | Light | Used for |
|---|---|---|---|
| `motion-grow` | 300 ms, `cubic-bezier(.2,.8,.2,1)` | same | Row → card, card → row. Fold alone = 0.75×. |
| `blur-swap` | 8 px (out 0–40 %, in 20–100 %) | same | Content changing inside a growing card. |
| `glow-you` | `0 0 20px rgba(61,220,132,.35)` | `none` | The one live thing that's yours. |
| `peek` | 0.6 | 0.6 | The next thing at the bottom edge; text inside is `text`. |

Also reused, not new: the 021/023 hairline `rgba(255,255,255,.05)` (`line-faint`, still a proposal from 021 §8), and the green rail (022).

## 8 · Build notes

- No engine, sync or database change. Enter's other-cart sheet (`ce-theirs`) is replaced by the grow. Its pads, own-entry read-only rows and auto-close timer move into the open card unchanged.
- Update the design system first (`design-system/` here → `docs/design/design-system/` → `npm run tokens`), so the token drift test stays green.
- One unit test: a pure helper for the frame math, e.g. `ui.growFrame(t, dir)` → `{ heightP, outOpacity, inOpacity, blurOut, blurIn }` at 0 / 60 / 120 / 300 ms. That's the only logic here.
- This touches only screens and `ui`; no smoke run needed for 027 itself (028's Enter change does touch score entry, see there).
