# 021 · Enter: the calm screen + rewarding score entry

Status: built in 1becaa2

A redesign of the team Enter screen for the games that use `ryderEnterView` (Partner “Rider” Cup and Team Ryder Cup), done through a design council (three reviewers + a red team, 4 passes, final scores 9 · 9 · 9 and red team 8). Two parts:

1. **The calm screen** (§1–§6): fewer colors, no nested shapes, no status pips, flat rows, the app's yardage card unchanged.
2. **Rewards** (§7): every tap gets a small motion and a word that fades away on its own; the hole's points show when the last score lands.

Target screenshots: `screenshots/states/` (every state, 393 × 659 @2x) and `screenshots/motion/` (each reward as six frames at 0 · 120 · 260 · 450 · 900 · 2400 ms). Mockups in `mockups/` are reference only (see `mockups/README.md`). Design canvas: https://claude.ai/artifact/5gQDphWBkb6TRRjvpJiTWi — boards **Pass 3 · six ways to start a hole** (A2 is the pick), **Pass 4 · rewards, frame by frame (final)** and **Pass 4 · tap to play (prototype)**.

**What this supersedes** (feature folders are never edited, so this one says it):
- **016 §0 “Enter shows no points”**: Enter now shows one plain match line (`vs Fore Play · 2 UP`) and the hole's points for ~2.4 s when the last score lands (§7.5). Everything deeper (low ball / low total, the clinch line) stays on Matches.
- **016's flag** (`ry-eflag`, the filled 72 × 26 pill) and `THRU n`: replaced by the plain match line.
- **016's ‹ › window arrows on the pad strip**: replaced by 4 fixed pads + ⋯ (§3).
- **018 “Rider keeps cart colors” — on Enter only**: Enter uses no jersey colors at all (Board, Matches and the scorecard keep them). Green = you, red = a double bogey or worse, amber = offline. Nothing else.
- **013's location-off banner and `GPS · OFF` subtitle text** are not used; the app's own location-off card (`.green-card.denied`) sits in the card slot.

**Not changed:** the yardage card (`greenCard()`, 011/013) — drawn exactly as today, in the same slot. The engine, the own-entry rule, Next-hole gating (waits for all four scores), the hole grid, the ‹ › hole browsing, the tab bar.

---

## 1 · Layout, top to bottom (393 × 659, never scrolls)

| Block | Size | Notes |
|---|---|---|
| Header | 54 | `Hole 11` 24/700 −0.5 left-aligned at 16px + `Par 3` 17/500 `text-muted` after it. Right: ‹ › ⋯ (48 × 48 each; ⋯ in `text-muted`). Tap the title = the hole grid, as today. No Hcp, no course name, no progress dots. |
| Yardage card | 92, 6 above | `greenCard()` unchanged. **Only on your group's current hole** (preview / locked holes: no card, §5). |
| Match line | 36 | `vs Fore Play` 15/500 `text-muted` left; right: the standing in mono 15/700 `cart-you-text` (`2 UP`; `AS` / `1 DN` in `text-muted`). Source: the 015/018 match state (`riderState(...).flag.text` or `ryderState`). |
| Your players | 2 rows | §2. |
| Other cart | 60 | §4. |
| (space) | flex | Free space sits here, never between the pads. |
| Status + Next | pinned | Group pinned 16px above the dock: optional status line (§6) then **Next hole** (60px). It never moves between states. |
| Tab bar | as today | |

Spacing uses `space-*` steps; side gutter `space-4`.

## 2 · A player row (the A2 look)

- **Divider:** a 1px line above each row in **white at 5% opacity** (`rgba(255,255,255,.05)`), full width. ⚠ No token exists for this; it's the one new value. Proposal: add `line-faint` to the design system (dark: `rgba(255,255,255,.05)`, light: `rgba(11,13,16,.06)`). Rows are grouped by the line + spacing, never by a card: **no outer card around your cart, no tint, no outline.**
- **Name line** (24px): name `row` (17/600). On a hole where the player gets a handicap stroke: `1 stroke` in `small` `text-muted` after the name (`2 strokes` for two), plus `· net 3` once a score is in. The reward word (§7) appears after these.
- **Pads:** `grid-template-columns: repeat(4, 1fr) 56px; gap 6px`, **64px tall**, `radius-lg`, **no fill and no border** — the golf mark sits on the background (`ui.mark`). Unpicked marks: numeral `text`, outline `text-muted`. Picked = **white pill** (`text` fill, mark in `bg`); a picked double-or-worse uses the dark red `#b42318` (the light theme's `double`) for its mark on the white pill so it reads.
- Pads show **par−1 … par+2** (`ui.padWindow` with no shifting). The 5th slot is **⋯** (24px dots, `text`), the More button. When the score is outside the window (picked from More), the 5th slot shows that score as the white pill; tapping it reopens More.
- **No** `TAP A SCORE`, `PAR` tag, result label, `✓ Saved`, score-source line or window arrows.

## 3 · More sheet (⋯)

Bottom sheet titled `Sean · Hole 11` (`title`). Scores **1 to the hole's max** (`maxHoleScore`, double par by default: 1–6 on a par 3, 1–10 on a par 5) as the same bare pads on the **same columns as the pad row** (5 per row). The player's current score is the white pill when it opens. Below: a hairline, **`Picked up · counts as 6`** (row; records the max), a hairline, **`Clear score`** (`text-muted`). Picking closes the sheet; the reward plays after it has closed. Swipe down closes. See `05-more-sheet-par3`, `06-more-sheet-par5`.

## 4 · The other cart

- **On the screen:** one quiet row, 60px, full width, the whole row is the button: `Sam – · Jake –` in `row` `text`, each score as a 26px mark (or `–`), and `Enter ›` / `Edit ›` (once both are in) right-aligned. No jersey color, no box. While neither of theirs is in, nothing else is said (they normally enter on their own phone).
- **Tapping it opens a sheet** (`03-their-scores-sheet`): `Sam + Jake · Hole 11` (`title`) + `Done` (top right, 48px hit area). Their rows use the same pads. A score Sam entered on **his own phone** is a read-only line — `Sam [5] · From his phone` — no pads (the server would refuse a different number). The organizer path to override stays in Host, not here.
- The sheet **closes itself 1.2 s after both of their scores are in**, but only after a 1.2 s pause with no taps (any touch restarts the timer). Swipe down closes early. The screen under the sheet never moves.

## 5 · Holes that aren't your current hole

- **Preview (a hole ahead, `08-preview-hole-ahead`):** title `Hole 12 · Par 4 · 412 yds` (scorecard yards), **no yardage card**, match line `Up next`, then four read-only rows (68px: name; stroke info like `Sean · 1 stroke` only where it applies), no pads. Primary: `Back to hole 11`.
- **Locked (2+ holes back, `09-locked-hole-back`):** title with scorecard yards, no card, match line `Played · locked · 1 UP after 6` (`1 UP` green; the standing **after that hole**, from the snapshot through that hole — not today's standing) and `Edit` right-aligned on that line (48px hit area; opens today's unlock). Four read-only rows with each score's mark and `1 stroke · net N`. Primary: `Back to hole 11`.

## 6 · Status: only when something's wrong

- **Next hole label:** `Next hole · 4 to go` → once your cart is in, `Waiting on Sam + Jake` → when all four are in, white `Next hole`. Waiting state: `surface-1` fill, `text-muted`. A tap while waiting does what it does today (names who's missing; opens their sheet).
- **Offline (`07-offline`):** one left-aligned line in `small` `warn` just above Next: `Offline · your 2 scores will send when you're back`; the Next label reads `Can't see Sam + Jake yet` (we can't know whether they've entered). No `Synced`, ever. The match line stays.
- **Location off (`10-location-off`):** the app's `.green-card.denied` in the card slot, as today.

## 7 · Rewards (motion)

All motion is 160–450 ms ease-out (`cubic-bezier(.2,.8,.2,1)` for pops, `(.3,.7,.2,1)` for draws). **Rules that hold for every item:**
- The picked state (white pill + its number) is visible **at 0 ms**. Motion decorates it; it never delays or hides it.
- **Nothing ever moves a hit target.** Scale happens inside the pad; the pad's box doesn't change.
- **Interruptible:** a tap during any animation jumps it to its end state.
- **Animate once, right after the tap** — use the existing `ui.foldIn(app.ui)` pattern so the constant render loop can't restart or cut animations.
- **No haptics** (iPhone Safari has no vibration API). No shake (this app already uses a shake for "missing score"). No confetti, no emoji.
- **Reduced motion:** no scale, draw, ripple, stamp or roll; the word still shows with a plain fade.

### 7.1 Every tap
- **Bump:** the pad scales 0.92 → 1.06 → 1 over 220 ms.
- **Mark draws:** the mark's outline is drawn as an SVG stroke (`stroke-dasharray` 0 → full) over 320 ms, starting at 60 ms; a double ring / double square draws its second outline 120 ms after the first. A faint copy (30% opacity) of the outline sits underneath from 0 ms so the mark never vanishes. Par has no outline: bump only. Build the marks in `ui.mark` as SVG paths (circle / rounded square) so they can draw.

### 7.2 The word
A word appears right after the name line (after the stroke text), fades in with a 6px rise over ~240 ms, holds, and fades out by itself at **1.6 s** (eagle-or-better: **3 s**). It's never permanent. **Judged on net** when a stroke changes the result; the mark stays gross.

| Net result | Word | Style |
|---|---|---|
| Par | `Par` / `Net par` | 15/700 `text-muted` |
| Bogey | `Bogey` / `Net bogey` | 15/700 `text-muted` |
| Birdie | `Birdie` / `Net birdie` | 15/700 `text` |
| Eagle or better | `Eagle`, `Albatross`; a 1 is always `Ace` | 17/700 `text`, held 3 s |
| Double / Triple / Quad / +5… | `Double`, `Triple`, `Quad`, `+5` (net words: `Net double`…) | 15/700 `double`, tilts in from −4° |

While the word shows, the `· net N` detail hides (so “net” isn't said twice) and comes back when the word fades. If the line runs out of room (long name, 2 strokes), the net detail hides first, never the word.

### 7.3 Eagle or better
Two soft rings ripple out from the pad (2px `text`, scale 0.7 → 1.35, opacity .55 → 0, 450 ms, the second 150 ms later), kept inside the content edge. An ace is picked from More: the sheet closes, the 1 lands in the ⋯ slot, then the ripples + `Ace`. See `story-ace`.

### 7.4 Double bogey or worse — the group joke
Only when the **net** result is a double or worse (the stamp goes with the word): the number shows at 0 ms; the red double-square outline **stamps** in — from 1.45× and −4°, landing by 160 ms with a 1° overshoot — then the pad does a 2px “thud” (translateY 2px + scale .98, 220 ms, starting at 140 ms). The word tilts in (`story-double`, `story-triple-par3`, `story-quad-par4`). A **gross** double that is only a net bogey (a stroke) draws its red outline quietly like any mark and shows `Net bogey` in grey — no stamp (`story-net-bogey`).

### 7.5 The hole's points (when the last of the four scores lands)
Partner “Rider” Cup scores each hole as low ball 1 + low total 1, a tie = ½ each, so your cart gets 0, ½, 1, 1½ or 2. **Read it from the engine** (`riderState(...)` hole entry `points.us`; Team Ryder Cup: the equivalent in `ryderState`) — never recompute in the view.
- `Next hole` turns white at once and gets the same 220 ms bump as a pad (no sweep or shimmer — it reads as loading).
- The standing in the match line **rolls** to its new value (old value slides up, new one in from below, 300 ms, starting at 200 ms, masked to one line); down when it goes down.
- Then the points fade in to the left of the standing, 12px gap, for ~2.4 s (start at 500 ms):

| Your points | Text | Color |
|---|---|---|
| 2 | `+2 points` | `cart-you-text` |
| 1½ | `+1½ points` | `cart-you-text` |
| 1 | `+1 point` | `text-muted` |
| ½ | `+½ point` | `text-muted` |
| 0 | `No points` | `text-muted` |

  (`story-points-2`, `-1-5`, `-1`, `-0-5`.) Halves use `½`, as everywhere in the app. Later, for a match-play scoring mode, the same slot can read `Won the hole` / `Halved`.
- **If the deciding score arrives while your phone is away** (it came from Sam's phone): the moment plays the next time you open Enter, ~300 ms after the screen draws, naming the hole (`+1½ points on 11`), once — a per-hole `glb.seen.CODE` entry, like the other seen keys.

## 8 · Design-system notes (flag before building)

- New value: the 5% divider (§2) → propose token `line-faint`.
- The picked double on the white pill reuses the light theme's `double` (`#b42318`) in dark mode → propose token `double-on-light`, or document the reuse.
- Score pad component README: the bare (unfilled) pads, the ⋯ 5th slot, the More sheet on the pad's columns.
- Rider on Enter drops jersey colors (README's Direction table says Rider keeps them) → add the exception.
- Light theme was not reviewed by the council: build with tokens and check it on a phone.

## 9 · Build order + tests

1. Layout + calm look (§1–6). 2. Bump + mark draw (§7.1). 3. Words + stamp (§7.2–7.4). 4. The hole's points (§7.5) + the `seen` replay.

One unit test (pure, next to `enter016.test.mjs`): the reward for a pick — word from the **net** result, mark from the **gross** score, stamp only when the net result is a double or worse (e.g. par 3, 1 stroke: gross 3 → `Net birdie`, no stamp; gross 5 → `Net bogey`, red mark, no stamp; no stroke, gross 5 → `Double`, stamp). Put the word/stamp choice in a pure helper (e.g. `ui.reward(strokes, par, strokesHere)`).

This touches only the Enter view and `ui` helpers — no score sync, engine or database change.
