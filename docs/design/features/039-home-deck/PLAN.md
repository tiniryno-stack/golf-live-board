# 039 · Home is a home screen; the cards are a deck (draft 3, Nov 26)

Status: **passed the panel** (round 2: 8 / 8 / 8 / 8 as written, 9 / 9 / 9 / 9 with its thirteen edits, all applied here
as draft 3). Not approved by Andrew, not built: the prototype is next. Changes 037's second pass ("the wallet", live on
`main` since Nov 26, `docs/design/features/037-home/PLAN-v2.md`). 037 is not edited.
Panel round 1 (`panel/round-1.md` on `claude/037-panel`): 6 / 6 / 7 / 5. §12 maps its ten changes.

## 1. What Andrew said after using the live Home (Nov 26)

> "The card stack after using it is a little clunky. Tapping on it should honestly move it to the front. And what is
> the point of having all the card edges exposed initially? Now the card takes up too much of the UI and takes away
> from the app. I love the cards, I think it's a main part of the app, but now the home screen is basically all card
> and it just leads you to the locker. Maybe ditch how much the cards show, but when you click into it the cards expand
> into a spread; initially a small stack, like you can just barely tell they are there. … It's a home screen, so the
> question is about navigation and finding where things are, and that comes with UI elements and conventions that we
> are most familiar with. … A card-driven home screen still, but it still needs to be a home screen at the end of the
> day, not a card gallery."
>
> "I also don't understand the headline of '2nd of 5.' That doesn't make much sense to me."
>
> "Standings is also a little buggy when you click into it and explore around." (chased separately, branch
> `claude/standings-fixes`)

He still likes the wallet idea. So: keep the objects, shrink their footprint, and give Home back to navigation.

## 2. The question changes

037 v2 asked "What's my golf right now?" and answered with one big object. **039 asks "Where do I go from here?"**
Home is a hub: one plain sentence of status, the next round if there is one, a small deck, and navigation in a
convention everyone already knows. Cards are the app's signature on Home, not its content.

## 3. The screen

| # | Block | Height | What it is |
|---|---|---|---|
| 1 | Top bar | 52 | unchanged: avatar → Passport, name → `home-me`, theme |
| 2 | Nudge strip | 48 + 8, only when there is one | unchanged from 037 v2 |
| 3 | Headline | 8 + kicker 16 + 8 + up to two lines of 36 + 16 = 120 | §4: a plain full sentence |
| 4 | Up next | 0 or 132 + 12 | §5: a compact pass for the next round. Nothing when there is none |
| 5 | The deck | 112–146 | §6: a small fan; tap opens the spread in the Cards tab |
| 6 | Crew row | 12 + 64 | your place or the leader, door to the Crew tab (§7.4) |
| 7 | Live strip | 64 + 8, only while a round is live | §7.3: docked on top of the tab bar |
| 8 | Tab bar + New | 94 Safari / 128 app | §7: Home · Rounds · Crew · Cards, and a round + |

Tab bar: 94 Safari / 128 app (dock 70 incl. its 1 px border, fixed at bottom 24 + `--sab`, styles.css:102-117).
Content `padding-bottom` = bar + 16, +72 while live.

Budget at 393 × 659 (deck block 146):

| Situation | Height |
|---|---|
| Normal day | 52 + 120 + 146 + 76 + 94 = **488** |
| + pass | **632** |
| + pass + nudge | 688 before the rules below; **654** with the deck at its minimum |
| Live + pass | 704 before the rules below; **628** with the crew row hidden |
| Zero cards (paper card as the deck) | 488 |
| New phone (no deck; join field in the crew slot, 92) | 52 + 120 + 92 + 94 = **358** (414 with the nudge) |
| New friend: zero cards + pass + nudge, in a crew | 52 + 56 + 84 + 144 + 146 + 76 + 94 = **652** |

At 402 × 681 every row is the same height (the pass and deck are fixed px) and has 22 px more spare (tightest row:
29 spare). At 393 × 852 (793 below the status bar, bar 128): normal 522, + pass 666, + pass + nudge 688 (deck at
minimum), live + pass 662 (crew row hidden).

Rules: the deck is a **measured fit in `mount`**, clamp(112, spare, 146) high. While the nudge shows, the deck takes its
minimum (112 × 80; block 112). While a round is live, the crew row hides (as in 037). Content is top-aligned; **spare height stays above
the tab bar** and nothing grows to fill it (the home screen app has about 250 px spare on a normal day: calm, not
empty; the prototype's 852 frame is there for Andrew to judge).

## 4. The headline: plain words

**A full sentence a friend would say, that makes sense with nothing else on the screen.** Two lines are fine. All `--text`; the two-tone treatment is dropped (it made fragments). **The sentence may repeat
the deck, but never the Up next pass or the live strip directly under it.**

| When | Kicker | Sentence |
|---|---|---|
| a round is live | `LIVE · <COURSE>` | "You're playing `<game phrase>`." (e.g. "You're playing the Team Ryder Cup."; the strip keeps hole, score and Back to hole N) |
| your spot in the next round was given away | `SATURDAY · <COURSE>` | "Justin gave your spot to Sean." |
| the next round was called off | `SATURDAY · <COURSE>` | "Justin called off Saturday's round." |
| a round within 48 h | `NEXT ROUND · <COURSE>` | "You're riding with Sean." (the pass carries the day and time) · no cart yet / not on the roster: "8 players are in." |
| a pack is waiting | `NEW CARD · <COURSE>` | "Your card from Friday is ready to open." |
| a round coming up (≤ 14 days) | `NEXT ROUND · <COURSE>` | "You play in 9 days." |
| last round ≤ 7 days ago | `LAST ROUND · <COURSE> · FRI NOV 20` | "You had the low round of the group." / "You finished 2nd of 5 players." / "You and Sean won." / Team Ryder Cup: "Your side won the cup, 6½–5½." / "You and Sean finished 3rd of 4 carts." |
| ranked in a crew season | the crew's name | "You're 2nd in the standings." |
| older last round | `LAST ROUND · 3 WEEKS AGO` | as last round |
| rounds, none finished | `GOLF BOARD` | "No finished rounds yet." |
| nothing on this phone | `GOLF BOARD` | "Live scores for your group's round." |

Game words in sentences come from a `GAME_PHRASE` map in `COPY`, keyed on `playFor(compute(event, []))`. All seven
keys are covered: `ryder` 'the Team Ryder Cup' · `alone` 'for points, everyone on their own' · `stroke` 'stroke play'
· `partners` 'a 2v2 match' · `oneMatch` 'a match' · `cart` 'the Rider Cup' · `legacy` 'the match'. A `gameName` label
never goes into a sentence. Course names in kickers and in the pass's course · game line truncate with an ellipsis. Results come from `finishUnits` on the locker row, as in
037 v2. Every result sentence has a subject, a verb, and says out of what. All copy stays in `homeview.js`'s `COPY`.

The plan's set is **(A)**, above. The prototype also shows **(B)** the score ("You shot 87 at Twin Creeks."; fine for
stroke play, wrong for team games) and **(C)** what's next first ("Nothing planned yet." / "Saturday at Twin Creeks.")
on the normal-day frame only, for Andrew to pick.

## 5. Up next: rounds only

A **compact pass**, 132 px, a `.card` on `--surface-1` with a `--glass-line` border: on the left the day and time in
mono 32/36/700 `--text`, then course · game on one line and the TODAY / TOMORROW badge (fill `--button`, text
`--on-button`); on the right **Open** and **Share link** stacked (48 px each). Called off / spot given: the same card
greyed with its `--surface-3` badge and **Text host**. The full 7:5 pass from 037 v2 is retired from Home.

Several coming rounds: the soonest; "+1 more" opens Rounds, which gains a **Coming up** section on top (`allRounds`
drops coming rounds today, homeview.js:171). There is no pack strip in any state (§6).

## 6. The deck, and the spread

**Closed (on Home).** The real front of your latest card, left-aligned at 168 × 120 (down to 112 × 80 by the measured
fit), with up to two cards behind it offset 6 px up-right and fanned (as `.lk-fan`; geometry below), its finish motion
running. Under it, one `label`: "5 CARDS · TWIN CREEKS". A waiting pack is the deck's sealed front with a count pip and
the label "1 CARD TO OPEN". The cards behind rotate about their bottom-left corner (−2° / −4°, `transform-origin: bottom left`) and sit 4 px
up. Their rise (≤ 16 px) is drawn into the headline's 16 px bottom margin, so the block stays 146. The measured fit
reads the deck slot's box, not the rotated cards. Only the finish's existing drift runs on the deck (none under reduced
motion); there is no tilt on Home. No scorecard yet, person known: the paper member card is the deck ("YOUR FIRST CARD COMES
AFTER 18 HOLES"). No person: no deck; the join field shows (§7.5).

**Tap the deck → the Cards tab** (`#/locker`), which opens on **the spread**, a Locker view
(`app.ui.lk.view = 'spread'`). The 036 carousel is one tap further, **All cards**, and Passport stays in Cards: one
card browser, not two. (Decision: a Locker view, not an overlay. It gets scrolling, the tab bar, and the existing tilt
and flip for free, and a sheet would be redrawn by the render loop.)

**Exception:** when the deck's front is a sealed pack, tapping it opens the packs view directly (`lk-home-packs`,
locker.js:751, one tap, as 037 v2). After the tear the Locker returns to `spread`, not `one`. The spread is the
Locker's default view for your own locker only; `#/passport/<id>` and view-as keep `one` (locker.js:606).

- The front card is the locker's exported card slot (tilt + flip, locker.js:201). The strips are plain markup, 56 px:
  course in `row` on the left, date `label` and score mark on the right, on the card's own finish.
- The strips scroll in content (from about 4–5 cards at 659), and the front card stays pinned at the bottom.
- **Tap any strip → that card comes to the front.** No navigation.
- **Tap the front card → it flips** (036's flip; the back has 038's Full board).
- A waiting pack is the front of the spread, sealed: tap → the packs view (`lk-home-packs`).
- Motion:
  - Opening from the deck: the tap stores the deck card's rect in `app.ui.deck.from` before `app.go` (`app.ui`
    survives routes). `draw` sets `innerHTML` and calls `mount` in the same task (app.js:1419-1425), so the spread's
    mount applies the FLIP before paint: the front card animates from that rect to its place (`--motion-grow`,
    `--ease-grow`), then the strips slide up with a 30 ms stagger. Mount consumes `from` once (stores `t0`, sets
    `from = null`); later redraws only replay via `data-t0` + `ui.syncMotion`.
  - Opened from the Cards tab instead: no grow, a 150 ms fade.
  - Tapping a strip: it lifts (−8 px, `--shadow-float`), the others close the gap, and it settles in front over
    300 ms. A tap mid-motion jumps to the end.
  - Reduced motion: 150 ms crossfades, no lift.

## 7. Navigation

### 7.1 The hub tab bar

**A bottom tab bar at the top level:** the app's tab bar component (001) with a **`small` label under each icon**
(Home · Rounds · Crew · Cards) on this hub bar only; a round's bar stays icons-only.

- Home = this screen. Rounds = `#/rounds`. Crew = Standings for the current crew. Cards = the Locker (spread first).
- It shows on those four screens and nowhere else. A round is a full-screen mode above the hub with its own tab bar.
  **Getting back out of a round:** today it's avatar → You sheet → Go to Home (two taps, hidden). 039 adds **‹ Home** before the
  name pill in a round's top bar. It uses the existing `.topbar .back` (chevron + label, styles.css:86-90), not a new
  pattern: a 48 px target, no confirm (leaving loses nothing; scores are queued and the live strip's **Back to hole N**
  returns in one tap). It shows on every round tab. On Enter with the GPS card showing, where the top bar is hidden, it
  sits at the left of the hole header. On Board the bar is ‹ Home · name chip · title · Share · ⋯; the chip and title
  ellipsize (~221 px between them at 393). This changes the "no back button inside a round" convention,
  so it is listed for Andrew (§11).

**Wiring (app.js):**
- `renderTabbar` keys its dock on `data-set="round|hub"`; it builds once today (app.js:1532).
- Hub tabs use a new `hub-tab` action, not `tab`, which smoke.mjs drives in rounds.
- The highlight follows `route.name` (the locker routes set `tab: 'passport'`, app.js:1334-1340).
- `.has-tabbar` follows `isHub(route) || inRound`.
- `checkVersion` and `onReturn` treat every hub tab as Home (app.js:1282, 1295, ~1313).
- The live strip hides under `.sheet-open` like the bar does (styles.css:717).

**Tab roots (Rounds, Crew, Cards) have no back button.** Today `topBack` returns "Home" on the Season root and `''` on
the Locker (season.js:137, locker.js:631). Sub-views keep theirs: past seasons, `#/passport/<id>`, `#/locker/admin`,
crew settings.

### 7.2 The + button

The **+** is its own 56 px circle in `--button` / `--on-button` (the one primary action), centred on the dock's
midline (7 px inset from the 70 px dock), to the right of a narrowed dock (8 px gap, dock right edge at
calc(16 + 56 + 8)). This is a named change to 001; the highlight track stays four equal tabs.

Tap → one sheet: **New round** on top, then the join code field with **Join** (`codeField`, `home-join`). The field is
**focused synchronously in the tap handler, right after `openSheet`, never after the slide-in animation**, or iOS
won't raise the keyboard. New round sits **above** the field because the keyboard covers whatever is under it.
Join = + → type; New round = + → tap. This replaces the two pinned buttons.

After the nudge's ✕, **Add to Home Screen** is a row at the top of the Rounds tab in iPhone Safari (`home-add`, the
move link; smoke.mjs:1393).

### 7.3 The live strip

While a round is live, a 64 px green strip is docked 8 px above the tab bar on all four hub tabs, like a music app's
mini player: `LIVE · HOLE 7`, the round's state line, **Back to hole 7**. `--tint-you`, a 1.5 px `--cart-you` ring and
`--glow-you`. With it, Home has exactly the design system's two glows: the dock (`--shadow-dock`) and the strip (`--glow-you`).

### 7.4 The crew row

One rule: when the headline gives your place, the row shows the leader, or the runner-up when you lead
(`seasonRecordTable` row 2); otherwise your place. Hidden with no crew or while a round is live. → the Crew tab.

### 7.5 No crew, no person

- **No crew:** the crew row on Home is hidden, and the Crew tab is a hub-level empty Standings with **Start a crew**
  (`#/crew/start` stays a pushed screen). Route: the Crew tab with no crew is `#/season` (crew null, app.js:1330);
  season.js renders the empty Standings with **Start a crew** when `crewOf(app)` is null; `isHub` counts `season` with
  or without an id, but not its sub-views.
- **No person / brand-new phone:** no deck; the join code field + Join sits in the crew slot (as 037 v2), the headline
  is the last row of §4, and the tab bar and + are still there.

### 7.6 The alternative, for Andrew to feel

**Default: the tab bar.** One alternative frame: no tab bar, three door tiles (Rounds · Crew · Cards, one status line
each) with the two pinned buttons. The same destinations, so the comparison is fair. Passport stays on the avatar in
both.

## 8. Patterns, states, and what changes

### 8a. Patterns, each with its nearest existing thing

- the labelled hub dock (001);
- the + circle (new: the one new control);
- the fan deck (`.lk-fan`);
- the spread view (037's stack + Wallet);
- the compact pass (037's pass, reshaped);
- the live mini-strip (037's live bar at 64 px, docked above the bar).

Light theme: the dock is light `--glass`; the strip is `--tint-you` + 1.5 px `--cart-you`, no glow; the paper card
gets `--shadow-float` + 1 px `--line`; the spread sits on `--bg` with `--shadow-card` per strip.
No new colours, sizes or type styles.

### 8b. States

| Situation | Headline | Up next | Deck | Crew row | Tabs |
|---|---|---|---|---|---|
| 0 cards, person known | next round or "No finished rounds yet." | pass if any | paper member card | per §7.4 | all |
| 1 card | last round | pass if any | that card, no fan behind | per §7.4 | all |
| 20 cards | last round | pass if any | latest + two behind; label "20 CARDS · …" | per §7.4 | Cards → spread scrolls |
| Pack | "Your card from Friday is ready to open." | pass if any | sealed pack in front, count pip | per §7.4 | all |
| Pack + pass ≤ 48 h | the 48 h row | the pass | sealed pack in front | per §7.4 | all |
| Called off | "Justin called off Saturday's round." | greyed pass, Text host | as normal | per §7.4 | all |
| Spot given | "Justin gave your spot to Sean." | greyed pass, Text host | as normal | per §7.4 | all |
| Live | "You're playing `<game phrase>`." | pass for a *later* round only | as normal | hidden | live strip on all four |
| No crew | as normal | as normal | as normal | hidden | Crew tab = Start a crew |
| Two crews | as normal | as normal | as normal | current crew | Crew tab has the switcher |
| No person | "Live scores for your group's round." | — | none; join field | — | all |
| Offline / locker failed | from `glb.recent` | from `glb.recent` | had cards (`glb.seen.homeCards`): the deck's box with "Your cards load with signal."; else the paper card | name only | all |

### 8c. What changes from 037 v2

| 037 v2 | 039 |
|---|---|
| The front object fills the screen with edges | A small fan deck; the spread in the Cards tab |
| Tapping an edge opens the Locker on that card | Tapping a strip in the spread brings it to the front |
| The full pass in the stack | A compact pass under the headline |
| Two-tone short headline ("2nd of 5.") | A plain full sentence |
| Doors row | The hub tab bar; Add to Home Screen in the nudge, then at the top of Rounds |
| Pinned Join / New round; live bar in the foot | The + and its sheet; the live strip on the tab bar |
| Crew row | Kept, with the leader / place rule |
| Standings holds Invite / switcher / Name your crew | Kept (bugs fixed separately) |

## 9. Requirements

- **R1** Home reads as a home screen: a stranger can say where each main part of the app is within five seconds.
- **R2** Cards are present and desirable but take no more than about a fifth of the screen until asked for.
- **R3** In the spread, tapping a card brings it to the front; nothing navigates away unless it says so.
- **R4** Every headline is a full plain sentence that makes sense alone.
- **R5** Navigation uses conventions the group already knows (tab bar, +, sheets), reusing the app's components.
- **R6** Design system only; new patterns named and justified.
- **R7** Works for 0 cards, 1 card, 20 cards, no crew, two crews, a new phone, a live round, a coming round, a pack.
- **R8** No database change; nothing on joining, score sync, the queue or the engine.
- **R9** The prototype shows it at true phone size, with the alternatives.

## 10. The prototype, and what to update when built

Frames at 393 × 659 and 393 × 852, dark and light, each a true-size phone with a tap map: normal day · pass + nudge ·
live · zero cards · new phone · the spread open · the spread with 20 cards · the + sheet with the keyboard up · the
labelled tab bar on Rounds, Crew and Cards · a round's top bar with ‹ Home · Enter with the GPS card and its ‹ Home · a
sealed-pack deck front · the tiles alternative. Headline sets B and C
on the normal-day frame. The deck must visibly grow into the spread (Replay).

To update when built: `tests/smoke037.mjs` (`home-news`, `.hm-nudge`, `.hm-doors`, lines 118-176); `smoke.mjs:609`
(`home-joinsheet` → +); `tests/home037.test.mjs` (stack / edge / budget asserts); the fit and screen-map Home scenes;
the `.home.hm2` CSS (styles.css:2848-2899); `topKey` / `glb.seen.homeTop`; a 039 `RELEASES` entry; CLAUDE.md's UI
conventions (tab bar; the "No back button inside a round" line, once Andrew decides §11 #4); the fit test's round
top-bar scenes (‹ Home touches every round header); a unit test for `isHub` and the hub highlight; a test that the dock
rebuilds when crossing hub ↔ round (`data-set`); a `homeview.js` `COPY` ladder test (incl. `GAME_PHRASE`). **Run `smoke037` before merging.**

## 11. For Andrew

1. **Tabs or tiles** for getting around (default: the tab bar).
2. **Headline set A, B or C** (default A: the result in plain words).
3. **Spare height in the home screen app:** kept calm (default), or let the deck grow.
4. **A visible "‹ Home" in a round's top bar** to get back to Home. Today that is two taps through the You sheet.
5. New round and Join move behind the **+**: New round costs one extra tap; Join is + then type, as today.

## 12. Round 1's ten changes

| # | Change | Where |
|---|---|---|
| 1 | Tab bar 94 / 128, padding, the 659 budget, measured deck, 681 and 852 | §3 |
| 2 | The fan deck; the pack is its sealed front; no pack strip; Coming up in Rounds | §5, §6 |
| 3 | The spread lives in the Cards tab as a Locker view; motion; no "Open your locker" | §6 |
| 4 | Labelled hub bar and its wiring; tab roots without back; no crew; a round as a mode with ‹ Home | §7.1, §7.5 |
| 5 | The + circle, the sheet with synchronous focus, Add to Home Screen in Rounds | §7.2 |
| 6 | Headline rule and full-sentence rows; A default, B and C on one frame | §4 |
| 7 | One crew row rule | §7.4 |
| 8 | Tab bar default; a fair three-tile alternative | §7.6 |
| 9 | Patterns with light theme; the states table | §8a, §8b |
| 10 | Frames and the update list; smoke037 before merge | §10 |

Open items the author picked: New round **above** the code field (the keyboard covers what's under it); the round's way
home is a **visible ‹ in its top bar** (the ⋯ menu isn't visible); spare height **stays calm**; the spread is a
**Locker view**.
