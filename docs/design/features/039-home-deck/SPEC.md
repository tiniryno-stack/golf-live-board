# 039 · Home is the wallet (handoff)

Status: **approved by Andrew Nov 28, 2026** on `prototype-v7.html` (A3 chosen). Not built.
Changes 037's second pass ("the wallet", live since Nov 26). 037 is not edited.

Read in this order: this file → `DECISIONS.md` (the nine picks, one table) → open `prototype-v7.html` and use it as the
visual + motion target (every frame is true size; the wallet's scroll physics and the A3 card markup/CSS are in it and
are meant to be ported, not re-invented). `PLAN.md` (draft 3) is history: where this SPEC and PLAN disagree, **this
SPEC wins**. Still valid from PLAN: §4 headline copy (set A), §7.2 the + sheet, §7.3 the live strip, ‹ Home in a
round (§7.1), §8b states, §10's list of tests to update. Prototypes 1–6 are the path here; ignore them when building.

Why (Andrew, Nov 26): "the home screen is basically all card and it just leads you to the locker … a card-driven
home screen still, but a home screen, not a card gallery." Then, through 7 prototypes: he wants the **wallet** back,
cards **physical** (scroll), the next round **as a card in the stack**, and the gallery + Passport **kept** in Rounds.

## 1. The screens

### Home (`#/`, `js/screens/home.js`)
Top to bottom: top bar (avatar → Passport, name → `home-me`, theme) · nudge strip (unchanged) · headline (PLAN §4,
set A, all copy in `homeview.js` `COPY`) · **the wallet** · `1 of 6` count line. No crew row, no doors row, no pinned
buttons, no All rounds link: the dock has them. Content stops above the dock (`padding-bottom` = dock + 16, + 72 while
live). Spare height goes to the bottom, never above the cards (the wallet is only as tall as it needs).

### The wallet (port from `prototype-v7.html`: `setupWallet`, `poseOne` scroll branch, `pose`, `bindWallet`, `animateTo`, `tapCard`, `dealIn`)
- Items, front to back: **the next-round card** (a live round, else the soonest coming round; §2) → a sealed pack (the
  newest, if any) → your cards, newest first. Zero cards + a person: the paper member card. No person: no wallet; the
  join field (as 037) in its place.
- Front card centred, full content width (361 at 393), 7:5, shrinking to fit (min 200 tall before edges drop). Edges of
  the cards behind peek above it: **2 in the app, 1 in Safari**, 48 px each.
- Cards behind the front are **flat finish plates** (the card's own finish over the whole card, no 3D edge layers, no
  perspective) with course · date · score on top (`.wel` in the prototype). They crossfade to the full face as they come
  forward. This is what fixed the "glitchy line" Andrew saw; keep it.
- **Scroll**: drag down ≈ 170 px = one card back in time; the front card slides down into a clipped "pocket"; drag up to
  come back; momentum on release (≈ 200 ms projection), rubber band at both ends, settle with `--ease-grow`. Tap an
  edge → that card animates to the front. Tap the front card → flip (036 flip; card back has 038's Full board). The
  next-round card flips to its tee sheet. A pack in front: tap → packs view (`lk-home-packs`).
- `touch-action: none` on the wallet only; reduced motion = no momentum, snap instantly.
- Under it: `N of M` (ts-label, muted).

### The dock (feature 001's tab bar, extended; `renderTabbar` in `js/app.js`)
**Home · Rounds · Crew**, icons + a `small` label each, the sliding highlight over three equal tabs, and the **+**
circle (56, `--button` / `--on-button`) to its right (dock right edge at 16 + 56 + 8; + centred on the dock's midline).
Shows on Home, Rounds (`#/locker`, both tabs) and Crew (`#/season`, crew root) only. A round keeps its own icons-only
4-tab bar (`data-set="round|hub"` on the dock; hub tabs use a new `hub-tab` action, not `tab`). Tab roots have no back
button. `.has-tabbar` and `checkVersion` / `onReturn` treat every hub tab as Home (PLAN §7.1 wiring list).
+ → one sheet: **New round** on top, then the code field + Join, field focused **synchronously** in the tap handler.

### The live strip (PLAN §7.3)
While a round is live: 64 px green strip docked 8 px above the dock on all three hub tabs, `LIVE · HOLE 7`, state line,
**Back to hole 7**. Hides under `.sheet-open`.

### Rounds (`#/locker` becomes "Rounds"; `js/screens/locker.js`)
Title **Rounds**, the existing seg renamed **Rounds | Passport**. On Rounds, the existing view icons become **gallery ↔
list** (cardone / board icons) next to the title.
- **Gallery** = the 036 carousel (`oneView`, one card at a time, neighbours peeking, tap to flip, Full board on the
  back) with dots and a caption (course · date · finish · grade · gross, who you played with). Packs lead it.
- **List** = every round by month (cards as rows with a finish swatch + gross; then "Other rounds": watched / practice,
  which make no card). Tap a row → the gallery opens on that card. The coming/live round is a row on top ("Now").
- **Passport** tab = today's passport, unchanged.
- `#/rounds` (037's All rounds) redirects to `#/locker` list view. View-as (`#/locker/p/…`) and admin keep today's
  behaviour.

### Crew (`#/season`)
Standings as today, as a tab root (no back). No crew: Start a crew (PLAN §7.5).

### In a round: ‹ Home
`.topbar .back` "‹ Home" before the name pill on every round tab; at the left of the hole header on Enter when the GPS
card hides the top bar (PLAN §7.1). No confirm.

## 2. The next-round card (A3)
Same 7:5 size as a scorecard, the app's glass (`--surface-2 → --surface-1` gradient, 1 px `--glass-line` ring), type in
cqw like the 036 card. Front, top to bottom (prototype `tixHybrid`):
- `x-top`: mark + "NEXT ROUND" · a stamp pill with TODAY / TOMORROW (none further out).
- Hero: the **tee time** huge in Geist Mono (19cqw), beside it the day ("SAT") and date ("NOV 28").
- Course name (5.6cqw bold).
- Bottom row: three fields **Game · Cart · With** (label ts-label style, value bold), and on the right **Open** (filled
  pill) + share (round icon button).
- **No partners set** (`settings.pairs` empty / carts not drawn): fields **Game · Players · Partner "On the tee"**;
  headline "8 players are in." (PLAN §4 row).
- **Live**: hero = the hole number + "Hole · of 18"; fields **Thru · Match · With** (no partners: Thru · Place ·
  Players); button **Hole 7 ›** (no share).
- Back (tap to flip): **tee sheet**: every tee time with its carts and names (your row bold; names only when no partners),
  a one-line "how the game works", Host · Players · Code.
- Game words: `GAME_PHRASE` short form ("Rider Cup", "2v2", "Stroke play", …), never `gameName` in a sentence.
- Data: `lobby.homeCard` / `homeview.passOf` (day, time, course, code, badge), the roster + `settings.teeTimes` +
  `settings.pairs` / carts for the fields and tee sheet, `settings.lobby.hostId` for Host; live from the round's snapshot
  (`standingLine` / `riderState`). Called off / spot given: the same card greyed with its badge and **Text host**
  (PLAN §8b rows).

## 3. Rules
- Design system only (README, tokens). The card's internal cqw scale is the 036 card's own scale, as today.
- No database change. Nothing on joining, score sync, the queue or the engine beyond reading.
- Home must still render (headline + member/offline card) if the locker can't load (`glb.seen.homeCards`: "Your cards
  load with signal.").
- Keep `glb.seen.homeTop` / `topKey` meaningful or retire them cleanly.

## 4. Done means
- `npm test` green, with: a unit test for the wallet item order (next round → pack → cards; member; none), one for the
  A3 field rules (partners / none / live), and `isHub` + the dock rebuild across hub ↔ round.
- `tests/smoke037.mjs` updated (Home no longer has `.hm-doors` / pinned buttons / crew row; + sheet; dock) and **one
  run of `npm run test:smoke037` at iPhone 16 size (393 × 659, its current viewport)** passing.
- `npm run stamp`, `RELEASES` entry in `js/whatsnew.js` (`2026-11-28`, "A new Home: your rounds as a wallet"),
  ARCHITECTURE.md 13a "039", CLAUDE.md section, this file's status → "Status: built in <commit>".
