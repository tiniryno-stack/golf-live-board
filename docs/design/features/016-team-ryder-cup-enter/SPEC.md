# 016 · Team Ryder Cup: Enter (pads, flag, no scrolling)

Status: designed, not built

This replaces the Enter screen for the Team Ryder Cup mode: **014 §5 and 015 §5's Enter bullet are superseded** by this folder. The game logic is unchanged — build from `015/RULES.md`. Everything here is layout and input.

**Design canvas (source of truth for the look):** https://claude.ai/artifact/PpADT3Sjt2xMkjKKWjDHDA — "Team Ryder Cup · Handoff 015", row **Enter · entering scores**. The artboard `Enter · FINAL` is a working prototype: every number on it is computed from the four scores (low ball, low total, THRU, the flag), nothing is hard-coded. Tap pads, ‹ ›, Edit, the flag, Next hole and the hole arrows. Its source is `mockups/canvas/Enter.dc.html`; the green sticky note beside it is the decision list. `Enter · as built today` sits next to it for comparison.

Screen size 393 × 852 (iPhone 16), Night Round, dark default with a light tweak. Sample data only (holes 13–18 at Sherrill Park, Andrew + Alex v Joseph + Jay, Sean + Baker in the group).

---

## 0 · The one rule

**Enter has one job: what did we shoot on this hole.** Nothing on it says who won a point, what the cup score is, or who's missing. The only match information is the flag in the card header, and tapping it goes to the Matches tab. Everything deeper (hole points, low ball / low total, the clinch bar) lives on Matches (015 §3).

The screen **never scrolls** as a home-screen app on an iPhone 16 / 17 (59pt status inset, 38px above the home indicator for the dock). The 013 measuring rule still applies on smaller phones: drop the green card to Compact first, then let it scroll.

## 1 · Layout, top to bottom

| # | Block | Size | Notes |
|---|---|---|---|
| 1 | Status inset | 59 | |
| 2 | Hole header | 52 | ‹ 52×52 · **Hole 16** 36px/800 −1.3 · `Par 4 · Hcp 10 · Sherrill Park` 14px muted · › 52×52. Arrows at 35% when there's nowhere to go. ‹ › keep browsing all 18 as today (holes ahead open as the read-only preview); the prototype gates › only because it has no preview. |
| 3 | Green card | 92, 10 above | The 011/013 component, Regular size, unchanged. |
| 4 | Your cart card | ~226, 10 above | §2 |
| 5 | Other cart row | 52, 12 above | §3 |
| 6 | Progress bar | 6, 14 above | 18 segments, 3px gaps: current hole `text`, counted holes `text-muted`, the rest `surface-2`. |
| 7 | Next hole | 58, 14 above | §4 |
| 8 | Dock | 68 + 38 | 012 tab bar, 16px side margins, Enter active. |

Everything has 16px side margins. Blocks 4–7 are flush left/right with the green card.

## 2 · Your cart card

`surface-1`, radius 24, padding 10 / 12 / 12, **1.5px `cart-you` outline** (this is the only green border on the screen; the other cart's version uses `line`).

**Header row** (36px min): left `vs` in muted 600 + `Joseph + Jay` 15px/700. Right: `THRU 4` mono 12/600 +1 muted, then the **flag**.

**Flag**: 72 × 26, radius 8, mono 12/700, same shape as the Board flag (015 §2). Computed from counted holes only (all four scores in), never from the hole you're on:

| State | Look | Text |
|---|---|---|
| You're up | `cart-you` fill, `bg` text | `UP 2`, `UP ½` |
| You're down | `surface-3` fill, `text` | `DOWN 1` (never red) |
| Tied / nothing counted | `bg` fill, 1.5px `text-muted` outline | hole points `3–3`, `0–0` |

The flag is a **button**: tapping it opens the Matches tab on this match. No other match info on Enter.

**Two player rows**, 8px apart, 2px side padding:
- Name line (22px): `Andrew` 15px/700, a 7px `text` dot after the name when they get a stroke on this hole; right, the result label mono 11/600 +1: `TAP A SCORE` muted until they pick, then `BIRDIE` (`cart-you-text`), `PAR` / `BOGEY` (muted), `DOUBLE` / `TRIPLE` (`double`), `ACE`, `EAGLE`, `ALBATROSS`, and ` · MAX` appended at the hole's cap. The label moves with the pick; nothing else does.
- **Pad row** (52px, 6 above): grid `34px · 4 × 1fr · 34px`, 4px gaps. ‹ and › at the ends; four **score pads** in between. See §5 for the component.

## 3 · Other cart row

One 52px button, `surface-1`, radius 14, no outline: `Sean` + mark, `Baker` + mark (28px marks, dashed ghost of par when nothing is in), **Edit** at the right as a 40px `surface-2` chip. It's one tap target: tap anywhere to enter for them.

**Edit flips the card** (`Enter · FINAL`, tap Edit): the big card becomes **Sean + Baker** with the kicker `ENTERING FOR THEM` and a **Back** chip, `line` outline instead of `cart-you`, same two pad rows, and a source line under each name: `waiting · tap to enter` → `entered by you · Sean can still edit`. Your cart folds into the slim row with the tag `YOU` (mono, `cart-you-text`) in place of Edit. Back, or picking the second score, flips it home. Their own entry from their phone always wins over yours (ScorePad rule).

In holes 1–6 the other cart in your group *is* your opponent; the layout doesn't change, the header just reads `vs Sean + Baker`.

## 4 · Next hole

58px, radius 18, full width. Reads **Next hole**, and only that. `surface-2` + muted text while any of the four scores is missing; `text` fill + `bg` text once all four are in. On the last hole it reads **Round done**. Tapping it while grey may keep today's behavior (shake the empty boxes, flip to the other cart if only theirs are blank) — but the label never changes.

No "· 2 scores left" text, no points, no hint under it. The muted button is the whole message.

## 5 · Score pad row (new ScorePad variant: `row`)

The 3×2 ScorePad grid stays for the individual round. Team Enter uses a **one-row window of 4 pads with ‹ › on the ends**, replacing the − / + ScoreStepper.

- **Default window: par−1 … par+2** (birdie, par, bogey, double). For a 15–20 handicap that's ~90% of holes with no slide. ‹ › move the window one score at a time; range is **1 up to the hole's max** (double par unless the round's max-score setting says otherwise). At the ends the arrow goes to 30% and stops. The window is remembered per player per hole, so coming back shows where they left it.
- **Pad**: 52px tall, radius 12, `bg` fill, 1px `line` border, the number in its 30px Score mark (circle for under par, double circle for eagle, square for bogey, double square for double+ in `double` red). Par gets a `text-muted` outline as the likely pick while nothing is chosen. **Chosen** = `text` fill, `bg` text, no border. Tap again to clear.
- Each pad is ~78px wide at 393, so the four are the biggest targets on the screen. Five pads (through triple) were tried and rejected: ~63px targets for 5% more coverage, and a busier row.
- First tap enters the score; there's no "start from par and step". The result label (§2) is the confirmation.
- Accessibility: each pad is `aria-label="Alex 5"`; ‹ › are `Lower scores` / `Higher scores`.

Why 4 (per-hole odds for a 15–20 handicap, Shot Scope / Arccos): birdie 2–3% · par 21–29% · bogey 41–47% · double 16–22% · triple 5–10% · quad+ 2–4%. Triple or worse is one › tap, one or two holes a round.

## 6 · States not drawn

- Hole already counted (all four in, you come back): same screen, picks shown as chosen, label shows the result, Next hole solid. Changing a score re-runs the match (RULES §2).
- Opponent in another tee time: nothing changes on Enter. 014's opponent row and cross-tee hint are **dropped**; "they're on 15" lives on Matches.
- Max score: at the cap the label says ` · MAX` and › stops.
- Offline: the existing row note ("Will send when back online") under the name line, nothing else moves.

## 7 · Design-system notes for Andrew

Add when convenient: **ScorePad `row` variant** (4-pad window + ‹ ›, remembered window), the **flag as a button** on Enter, and the rule "Enter shows no match detail beyond the flag". ScoreStepper stays for the individual round until that's revisited.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
