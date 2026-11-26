# 037 · Home: your card, then the clubhouse

> **Superseded for Home's layout by `PLAN-v2.md` (approved Nov 26, target `prototype-v2.html`).** This file is the first
> pass, built on this branch; its `#/rounds` screen, opening-motion rules and model structure carry over.

Status: built in dd787bd (branch `claude/037-home`). Approved by Andrew Nov 25, 2026 (prototype 5).

Changes Home (`js/screens/home.js`, live on `main` at b047ea2) and the two Home entries of 035 / 036
(`homeLocker()` in `js/screens/locker.js`) and of 006 (`homeCrew()` in `js/screens/crew.js`). Those feature folders are
not edited; where this SPEC and they disagree about **Home**, this SPEC wins. The Locker, Passport, packs, crew screens,
Standings, the returning-player flow and every round screen stay exactly as they are.

One sentence: Home stops being a stack of separate parts and becomes one page with one thing on top (your latest
scorecard card, carrying your crew's name), how that round finished right under it, one quiet crew block, and pinned
buttons at the bottom that turn into the live round when you're playing.

---

## 0. Read this first (for the engineer)

- **The truth is `prototype.html` in this folder** (prototype 5: seven phones, one per situation). Open it in a browser;
  it is self-contained. Earlier prototypes (1–4) are in git history only and are not the target.
- The prototype's card art is a **stand-in**. Use the real 036 card (`frontHtml` / `slotHtml` in `js/screens/locker.js`)
  and the real chrome pack (`chromePack()` in `js/screens/pack.js`).
- The prototype's results use **gross scores**. The build shows the game's real finishing order (§3.3).
- Follow `docs/design/design-system/`. No new colours, sizes or type styles. §8 lists the three things that are new
  patterns; everything else reuses existing components (`.home-row`, `.card`, `.btn`, `.seg`, `.nr-foot`, `ts-*`).
- Home is drawn by the render loop, which redraws constantly. Motion must survive redraws: use the `data-t0` +
  `ui.syncMotion` pattern from the calm Enter (ARCHITECTURE.md §8.3), never a class that restarts on every render.
- Keep every existing action name and aria-label that `tests/smoke037.mjs` and other tests use (`home-me`,
  `home-joinsheet`, `home-join`, `home-add`, `home-news`, `home-text`, `lk-home-packs`, `crew-*`, the avatar's
  "Your passport"). Where a control moves, keep its `data-act`.

## 1. What Andrew picked (Nov 25)

| Question | Pick |
|---|---|
| What is Home about | Your card first, then the crew ("Crew on the card", prototype 3 → 5) |
| What bugs him today | Too many parts; the locker feels bolted on; the crew section; the rounds list |
| Round day | Same Home. The live round sits at the **bottom**, in the pinned bar |
| Opening | **Deal the card** on a fresh open; a quick fade when just coming back |
| Spacing | Left to the design system (no custom numbers) |

Calls made for him in prototype 5, which he approved as shown ("love it"):

1. The top card is your **latest** finished round, not your best.
2. The result under it is **your** last round, not the crew's.
3. While a round is live, Join and New round move to two rows at the end of the page.
4. What's new is one slim line under the top bar, not a card.
5. Add to Home Screen stays a row at the end of the page, iPhone Safari only.
6. Old rounds leave Home for their own screen.

## 2. The page, top to bottom

Only the blocks that apply are drawn; there are no empty sections.

1. **Top bar** — unchanged: avatar → `#/passport`, name → `home-me` sheet, theme button.
2. **What's new line** (when `whatsNew()` has something) — §3.6.
3. **The top** — exactly one of: pack, card, empty outline (§3.1).
4. **Locker caption** under the top — one row, "Your locker" + the counts (§3.2).
5. **Coming up** — today's `comingCard` for each lobby round, unchanged content (incl. the called-off variant).
6. **How it finished** — the result of the round on the card (§3.3).
7. **Crew block** — §3.4.
8. **End rows** — `All rounds` (§5); `Add to Home Screen` (iPhone Safari only, same action as today); when a round is
   live also `New round` and `Join with code` as two plain rows.
9. **Pinned bottom bar** — Join with code / New round, or the live round (§3.5).

The "Golf Live Board" title is gone from Home, except on a brand-new phone (§4.7).

## 3. The parts

### 3.1 The top: one rule

Pure function, first match wins:

| Order | When | The top is |
|---|---|---|
| 1 | this phone's person has ≥ 1 pack to open | the newest **pack** (real chrome pack, full width). Tap = today's `lk-home-packs`. More than one: the count pip, as today. |
| 2 | they have ≥ 1 opened card | their **latest** opened card (by round day), the real 036 front, full width. Tap → `#/locker`. |
| 3 | they have rounds but no card and no pack | the **empty outline**: "Your first card goes here" / "Finish 18 holes and it shows up as a pack." |
| 4 | the locker hasn't loaded, failed, or there is no person | **nothing**. Blocks 3, 4 and 6 are skipped; the rest of Home draws normally. |

Row 4 replaces 035's "Home must stay exactly as it was if the locker can't load": Home must still be complete, never
blank, never an error, and must not jump around while the locker loads (reserve nothing; let the card deal in when it
arrives, §6).

**Crew on the card.** The card on Home carries a line `FOUNDERS CREW · ANDREW` (the crew of that round, from
`events.crew_id`, + the display name; no crew → just the name). It is a Home-only label drawn over the card front in the
card's own ink (`--m-ink`), `ts-label` style. The card itself (Locker, share image) is not changed. If the 036 front has
no clean spot for it, put the same line directly above the card as a `ts-label` and flag it on the preview (§9).

### 3.2 Locker caption

One `.home-row` without the fan thumbnail: **Your locker** + today's `homeSub()` text ("5 scorecards · 3 courses ·
2 milestones"), or "1 pack to open · 4 scorecards" when a pack is on top. → `#/locker`. Replaces both the packs card
and the Locker row.

### 3.3 How it finished

The finishing order of the round on the top card (when the top is a pack: the pack's round; label stays "How it
finished"). When a Coming up card or a live round is on the page, the label is "Last time out · Nov 20".

- Source: `roundFinish(event, scores)` in `js/seasons.js` (the same order Standings uses: the game's result, carts and
  sides as units). Value on the right: what that game counts (points / match result); for a scorecard round, gross.
  The round's `{ event, scores }` is already fetched for the locker (`db.fetchPersonRounds`); do not fetch again.
- Rows: the **top three**, then **you** if you're not in them (with a dashed break), then a `Full board ›` row →
  `#/e/CODE` (a finished round opens on its Board). Ties show "T3". Your row is green (`--cart-you-text`).
- Team games: one row per unit ("Andrew + Sean"), your unit green.
- `roundFinish` returns null (round doesn't count yet) → skip this block.

### 3.4 Crew block

Replaces `homeCrew`'s card.

- Kicker: the crew's name (`ts-label`), with **Invite** (small pill, `crew-invite`) and ⋯ (`crew-settings`) on the right.
- Two or more crews: kicker "Your crews · N" and today's `.seg` switcher (`crew-pick`) under it.
- Row **Standings** → `#/season/<id>`. Sub line: today's season line when there is one ("Fall · you're 2nd"), else
  "N rounds this season".
- Unnamed crew: the first row is **Name your crew** (→ `#/crew/rename/<id>`) instead of Standings.
- No crew: one row **Start a crew** ("One link for the group, standings in one place") → `#/crew/start`.

### 3.5 Pinned bottom bar

`.nr-foot` (already sticky). Normal: `Join with code` (`home-joinsheet`) + `New round`, as today.

**Live round** (same rule as today's Playing now card: `r.live`, not done, seen within `LIVE_FOR`): the bar becomes one
green-tinted card: dot, `LIVE · HOLE 7`, the round's one-line state (`L.line`, e.g. "You're up 2"), and the button
`Back to hole 7` → `#/e/CODE`. It uses `--tint-you`, the `--cart-you` ring and `--glow-you`. Nothing else on Home
glows. The Playing now card at the top of Home is removed.

### 3.6 What's new line

One slim row under the top bar: `NEW` + the release title + chevron. Tap expands it in place (`ui.foldIn`) to the
release's lines and **Got it** (`home-news`, same seen key). `js/whatsnew.js` is unchanged. Add a `RELEASES` entry for
036 + 037 as part of this build ("Your card is on Home now" or similar; Andrew approves the words on the preview).

## 4. The seven situations (prototype.html, phones 1–7)

1. **A normal day** — card, caption, How it finished, crew, All rounds, buttons.
2. **Pack to open** — the pack on top; caption counts the pack.
3. **Round coming up** — Coming up card between the caption and "Last time out".
4. **Round on** — same page; the bottom bar is the live round; New round / Join rows at the end.
5. **After a big group** — 16 players: top three, break, your line. A plain Standard card is fine on top.
6. **No card yet** — empty outline; Coming up and the crew block still show.
7. **Brand-new phone** (no rounds at all) — today's empty state, re-laid: the title with the mark, the empty outline
   "No rounds yet / Start one and text the code to your group, or join a round a friend started.", the join-code
   field in the page (`codeField()`), rows Start a crew + Add to Home Screen, and a single pinned **New round**.

## 5. All rounds screen

New route `#/rounds`: a plain screen titled "Rounds" with a back to Home, listing what Home's Recent rounds list shows
today (same `roundRow`, same order, same data from `recent.all()`). Home's Recent rounds list is removed. The row on
Home reads **All rounds** · "5 since Oct 16".

## 6. Opening motion

Two openings, both only on Home, both skipped under reduced motion:

- **Deal** (0.7 s): the top (card or pack) drops in from slightly above with a small rotation
  (`translateY(-40px) rotate(-5deg) scale(1.06)` → rest), while the other blocks rise 14 px and fade in, staggered
  ~70 ms, the bottom bar last. Plays (a) on the first Home render after a page load, and (b) whenever the top is
  different from the last one this phone showed (new pack, new card): remember it in `glb.seen.homeTop`
  (`"pack:CODE"` / `"card:CODE"`).
- **Quick fade** (0.22 s, whole page): coming back to Home any other time (from a round, a sheet route, the app
  resuming).

Ordinary redraws play nothing. When the locker arrives after Home is already on screen, the top deals in then.

## 7. Build order

1. Pure model `js/homeview.js`: `homeModel({ rounds, locker, crews, now, … })` → `{ top, caption, coming, result,
   crew, endRows, bar }` (§3.1's rule, §3.3's rows, §3.5's bar). One test file `tests/home037.test.mjs`.
2. `home.js` renders from the model; move the crew block and locker entries in; `#/rounds`.
3. Styles: a `/* 037 Home */` block at the end of `css/styles.css` (locker-specific bits stay in `css/locker.css`).
4. Motion (§6).
5. `RELEASES` entry; ARCHITECTURE.md 13a "037 · Home"; README if it describes Home; CLAUDE.md's Home notes; set this
   file's status to "built in <commit>".
6. `npm test`. Then `npm run preview` for Andrew's iPhone.

No database change. No change to joining, score sync, the offline queue or the engine. `tests/smoke037.mjs` drives
Home (returning players): it is not run by default; list in the hand-back which of its selectors moved.

## 8. New patterns to flag (design system)

- **Deal** motion (§6): new keyframes; uses `--ease-grow`.
- **Live bar** in the pinned footer with `--glow-you` (today only the tab-bar dock glows; Home has no tab bar).
- **Empty outline**: dashed `--line` box at the card's aspect ratio (same family as the dashed ghost par).

No new colours, sizes or type styles.

## 9. Open questions (for the preview)

1. Does the crew line sit well on the real 036 card front, or above it?
2. The real card front is dense at full width on Home. If it reads badly, a simpler Home face is a follow-up decision.
3. Deal speed and how often it plays, by feel.
4. The words of the What's new entry.
5. Team games in "How it finished": unit rows ("Andrew + Sean") vs. people rows.
