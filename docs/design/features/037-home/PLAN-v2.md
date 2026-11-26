# 037 · Home, second pass: the plan (draft 5, Nov 26)

Status: **passed the panel in round 4 (9 / 9 / 9 / 9), with its ten cleanups applied.** Not approved by Andrew, not built. Replaces the Home in `SPEC.md` (built
on this branch, on the preview) if Andrew approves a prototype made from it.
Panel so far (`panel/round-N.md` on `claude/037-panel`): draft 1 → 5 / 4 / 5 / 4; draft 3 → 6 / 6 / 7 / 7; draft 4 → 8 / 8 / 8 / 8; draft 5 → 9 / 9 / 9 / 9.
§16 maps round 2's ten changes; §17 lists round 3's eight paste-ready edits, all applied.

## 1. Why a second pass

Andrew, after using the first build on the preview (Nov 25): "How it finished is going against 'each screen serves one
purpose and answers one question' … info found deeper in the user journey". Also: likes **Fuse**, **Apple Wallet** and
**Focus Flight**; lukewarm on bento ("good in the right spot"); fine with a finance-app look; "even without a card it
still needs to hit visually"; mock-ups on a real phone screen; onboarding for new users welcome.

## 2. References (`references/NOTES.md` + screenshots), read correctly this time

| Reference | What it actually does | What this plan takes |
|---|---|---|
| **Fuse** home (`fuse-01`) | A small grey kicker over one hero value. The grey part is the *less important part of the same value* ("$10**.04**"). | §5: every headline's **bright half carries the fact**; the grey half only qualifies it. Safari uses each rung's written short form (§5), never a bare bright half. |
| **Fuse** empty home (`fuse-02`) | Same layout with zeroes + one sentence + one button where the missing thing would be. | §6.4: the zero-card Home keeps the layout; the join field sits under the card. |
| **Wallet** stack (`wallet-01`) | Edges are about 50 pt tall and each is identifiable from its own art and logo. | §6.1: edges are 48 px and carry the course name on the card's finish. |
| **Wallet** nudges (`wallet-02`, `-03`) | A nudge is a full dismissible card *above* the stack; the stack starts lower. | §4.2: the nudge is its own strip above the stack, not an edge. |
| **Wallet** detail (`wallet-04`) | Bento and lists only after you pick a card. | No tiles on Home; How it finished stays off Home; the card back gets the door to the Board (§9). |
| **Focus Flight** pass (`focusflight-04`) | Big mono codes, 2×2 of grey labels over mono values, tear line with notches, a state badge. | §6.2: the pass. |
| **Reels** | Polish rules. | §13.1, each mapped to an existing token. |

## 3. The one question

**"What's my golf right now?"** Everything on Home is a **status** (one glance) or a **door** (one tap deeper). No
lists, tables or detail. No element repeats a fact another element on the screen already shows.

## 4. The screen

| # | Block | Height | What it is |
|---|---|---|---|
| 1 | Top bar | 52 | unchanged: avatar → Passport, name → `home-me`, theme |
| 2 | Nudge strip | 48 + 8, only when there is one | §4.2: directly under the top bar |
| 3 | Headline | 8 + 76 (one line) / 112 (two) | kicker 16, gap 8, sentence 36 per line, 16 below |
| 4 | The stack | edges 48 each + front 258 (264 at 402 wide; pack 266) | §6 |
| 5 | Crew row | 12 + 64, or absent | §7 |
| 6 | Doors row | 48 | at most two text doors (§8); hidden while the nudge shows |
| 7 | Pinned foot | 88 Safari / 96 app; live 160 / 168 | §8 |

`.home` sets `padding-bottom: 0`: it renders inside `.plain`, whose 32 px bottom padding (styles.css:170) would
otherwise sit under the pinned foot. This is a one-line CSS change in the 037 block. The measured fit never takes a
pass below 336 wide (240 high, its content's height). If a pass can't get that, edges drop to 0 first, then the doors
row hides.

### 4.1 The budget (R4)

Sizes: Safari **393 × 659**, Safari **402 × 681**, home screen app **393 × 852** (793 below the status bar).
The rules, in the order they give way:

1. **The front object is a measured fit**, done in `mount` the way `enter.mount` measures the pads: its width is
   `min(content width, leftover × 7 / 5)`, never under 300. Nothing else on the screen changes size.
2. **Edges yield first.** App: up to 2. Safari: 1, and 0 when a pack is in front, a nudge is showing or a round is live.
3. **Safari headlines are one line.** Each rung has a written Safari form (§5), a complete sentence of ≤ 20 characters
   at title 32 / 800, chosen when the two-tone sentence doesn't fit one measured line. Two lines only in the app.
4. **The doors row is hidden while the nudge shows** (All rounds is empty for a new friend, and Add to Home Screen is
   already in the nudge).
5. While a round is live the crew row is hidden.

| Situation | 659 | 681 (402 wide) | 852 app (793) |
|---|---|---|---|
| Normal day | 52+84+48+258+76+48+88 = **654** (1 edge) | 660 | 52+120+96+258+76+48+96 = **746** (2 edges) |
| Pack in front | 52+84+266+76+48+88 = **614** (0 edges) | 621 | 754 |
| Pass in front + pack edge | 654 | 660 | 746 |
| Nudge showing (no doors row) | 52+56+84+258+76+88 = **614** (0 edges) | 620 | 52+56+120+96+258+76+96 = **754** |
| Zero cards + pass + nudge (a new friend in Safari) | 52+56+84+258+92+88 = **630** (doors row hidden) | 636 | 674 |
| Round live | 52+84+258+48+160 = **602** (0 edges, no crew row) | 608 | 52+120+96+258+48+168 = **742** |
| Zero cards | 52+84+258+92 (join field in the crew slot)+48+88 = **622** | 628 | 666 |
| No crew | 52+84+48+258+76 (Start a crew row)+48+88 = 654 | 660 | 746 |

Every row fits; the tightest is the normal day at 659 (5 px spare, with rule 1 behind it). The fit test gets all of
these as scenes.

### 4.2 The nudge strip

One 48 px strip in `--surface-2`, its own object (not an edge), **directly under the top bar and above the headline**,
so the headline stays on the object it captions: text left, ✕ right, the whole strip a 48 px target. At most one, never while a round is live:

1. **Add to Home Screen** (iPhone Safari, first): "Add Golf Board to your Home Screen" (`home-add`).
2. **What's new** (`whatsNew()`; skipped for anyone whose first round is after the release): "New · Cards, packs and a
   Passport" (it names what isn't on screen, not the screen it sits on). Tap (`home-news-open`) opens a small **sheet** with the release's lines and **Got it** (`home-news`). A sheet
   the user opens collides with nothing: Home is only tappable when no sheet, pack overlay or hand-off is up, and
   `checkVersion` already waits while a sheet is open. It also keeps the fit, since nothing expands in the page.

✕ stores `glb.seen.homeNudge.<id>` (a `glb.seen.*` key, so it moves with the Add to Home Screen link). After its ✕,
Add to Home Screen is the doors row's second door, so the move link is never lost.

## 5. The headline ladder

Kicker (`ts-label`) + one sentence (`ts-title`, `text-wrap: balance`). **The bright half (`--text`) is the fact; the
grey half (`--text-muted`) only qualifies it** (shown as `bright | grey`). Pure function, first match wins. **No rung
says anything the object under it, the crew row or the bar shows.**

Each rung has a written Safari form: a complete sentence of ≤ 20 characters at title 32 / 800, chosen when the two-tone
sentence doesn't fit one measured line. A bright half is never shown alone unless it is a complete sentence. A sentence
with no `|` is all bright and is never cut. No action ever goes in a grey half.

| # | When | Kicker | App (two-tone) | Safari | Tap |
|---|---|---|---|---|---|
| 1 | a round is live | `ON THE COURSE` | "`<gameName>` \| at `<course>`." | "`<gameName>`." | — (the bar) |
| 2 | the front pass: your spot was given away | `NEEDS YOU · SAT` | "Sean has your spot." | same | the round |
| 3 | the front pass was called off | `SATURDAY` | "`<Host>` called it off." (the first word of `homeCard.host`) | "`<Host>` cancelled." | — (Text host on the pass) |
| 4 | *(cut, see below)* | | | | |
| 5 | a pass is due within 48 h | `NEXT ROUND` | "Riding with Sean." · not on its roster (watcher, organizer not playing): "8 players in." | same; a long first name still fits ("Riding with Chris.") | — (the pass) |
| 6 | a pack is waiting | `NEW PACK` | the sealed round's **game result, never strokes**: "Won \| with Sean." / "2nd of 5." / "Low round \| of 5." | "Won." / "2nd of 5." / "Low round." | — (the pack) |
| 7 | a round is coming up (≤ 14 days) | `NEXT ROUND` | "9 days out." · not on its roster: "8 players in." | same | — |
| 8 | your last finished round was ≤ 7 days ago | `LAST OUT` | as rung 6; "12th of 16." | as rung 6 | — |
| 9 | you're ranked in a crew season | the crew's name | "Sean leads." · when you lead: "Sean is next." | same | Standings |
| 10 | you have an older finished round | `LAST OUT · 3 WEEKS AGO` | as rung 6 | as rung 6 | — |
| 11 | rounds, none finished | `GOLF BOARD` | "No rounds finished." | same | — |
| 12 | no rounds on this phone | `GOLF BOARD` | "Live scores \| for your group." | "Live scores." | — |

`<gameName>` is the real output of `gameName(compute(event, []))`, computed in `homeCard` (2v2, Stroke play, Team Ryder
Cup…, `playfor.js`), not a hand-written name. Rung 2 says "has", not "took": the host gave the spot away, not Sean.

**Rung 4 is cut.** A round you're on the roster of but haven't opened on this phone needs no rung: its pass is in the
stack with **Open**. Home can't tell an unopened round from one claimed on your other device (synced entries,
`db.js:356`), or a taken spot from a watched round, so it says nothing it can't know. (The Golfer's alternative, a
`YOU'RE IN` "Justin added you." moment, is in `panel/round-3.md` if Andrew wants it.)

Where each fact comes from:

- **Rungs 6, 8, 10** come from the locker row of that round through the first build's `finishUnits` / `finishRows`
  (rank, field size, unit names). Team Ryder Cup uses the cup line ("Jordans won \| 6½–5½."). Fallback when the locker
  row is missing: `recent.result.line` with any score stripped; if nothing is left, fall to the next rung.
  Never "net 87" or any stroke total on rung 6: that would spoil the pack.
- **Rungs 2 and 3 apply only to the front pass** (the round §6 puts in front). A removed or called-off round further
  out shows only on its own pass (badge + Text host) and never takes the headline from a nearer round or a pack.
  Either way it never reads "you tee off".
- **Rung 5** carries "Riding with Sean", so the pass's 2×2 does not (§6.2). It never repeats the pass's TODAY /
  TOMORROW badge.
- **Rung 9** is from `seasonRecordTable` (the top row's name, or the second row's when you lead). "3 back" is not
  offered: standings are a win rate.

Exact text for Andrew's real days. **Fri Nov 20, evening** (pack waiting; a 5-player scorecard round he led):
`NEW PACK` "Low round \| of 5." **Sat Nov 21** (opened): `LAST OUT` "Low round \| of 5." **Mon Nov 30** (nothing
coming, 10 days on): `FOUNDERS CREW` "Sean leads." (whoever really does), crew row showing his own place.

## 6. The stack

One stack of real objects. **One front object, edges behind it.**

**Front** (first match): a pass due within 48 h → a pack → a later pass → your latest scorecard → the plain card.
**Edges**, in order until the limit of §4.1: another pass (soonest first) → the pack → opened scorecards, newest first.
The plain card is never an edge.

### 6.1 Edges

**48 px of the object is visible** above the one in front of it (Wallet's are about 50 pt), and that visible strip is
the tap target: no hidden hit areas. The strip is **Home-only** (the 036 front's own top line has no course):

- **Scorecard edge:** the card's finish art, the **course name** in `ts-label` in the card's ink (`--m-ink`) on the
  left, the finish name on the right. **Never a score.**
- **Pack edge:** the foil, "1 PACK TO OPEN". Never a course result or score.
- **Pass edge:** the day and time ("SAT 8:40") and the course.

The edge strip is drawn (the finish's `.lk-mat` + its own label row), never a clipped `frontHtml`.
The prototype also draws the Golfer's alternative (a 32 px strip with its hit area extended to 48) so Andrew can pick.

**Every visible object opens itself.** There is no "tap elsewhere" target.

| Object | Tap goes to |
|---|---|
| Scorecard (front or edge) | `#/locker` on that card (`app.ui.lk.key`, one-card view) |
| Pack (front or edge) | `lk-home-packs` (the packs view, where the tear happens) |
| Pass (front or edge) | `#/e/CODE` |
| Member card | `#/passport` |
| Blank card | nothing; the join field under it is the action |

No swiping, no re-ordering. Plain stacked strips, not a fan.

**The scorecard on Home is the real 036 front** (`frontHtml`, with the crew line as the first build draws it): the
stack holds the real object, there is one face to maintain, and its gross is the screen's single hero number.

### 6.2 The pass (new pattern)

The card's 7:5 box on `--surface-1`, 1 px `--glass-line` border, `--shadow-card`.

- **Top:** the day and time in **mono 32/36/700, −1px, `--text`** (`.lc-pts` is green, so not that class): "SAT 8:40", or "SAT DEC 5" with no time.
  `number-xl` would overflow the box.
- **Badge** (top right): `TODAY` / `TOMORROW` when due within 48 h, **inverted** (fill `--button`, text `--on-button`);
  `CALLED OFF` and `SPOT GIVEN` on `--surface-3`. **Never green** (green is the live bar's and your cart's).
- **2×2** of `ts-small` grey labels over mono values: Course · Game · Tee time ("Times soon") · Host.
  ("Riding with" is the headline's on rung 5, so it is not here.)
- **Tear line:** dashed `--line`, a half-circle notch each side with `--radius-md`.
- **Under the tear, the buttons**, which stop the pass's own tap (`stopPropagation`): **Open** and **Share link** on every
  coming pass (two 48 px buttons; it is the link the host already texts: an unclaimed name can be picked by anyone who has
  it, a taken one needs Ask to join, exactly as today; and the pass is Home's growth door), a new `home-share` action (`navigator.share` with the round link, copy as the fallback); called off / removed: **Text Justin** (`home-text`, as today).
- Data: `homeCard` additionally returns `startTime`, `course`, `game` (`gameName(compute(event, []))`, see §5),
  `players`, `onRoster` — a pure change. Fix the hard-coded "Team Ryder Cup" wording in both places
  (`lobby.js` `homeCard`, `home.js:47`).
- No "6 of 8 in" count (it needs `lobby_counts`; keeps Home off the joining path). The roster size is enough.
- Old `recent.lobby` entries missing the new fields fall back to `recent.course` / `played_on`; empty cells hide.
- A pass leaves Home the day after its date (today's `coming` filter), so a called-off pass never goes stale.
- A friend with a round coming and no scorecard sees **the pass in front**: their first Home hits.

### 6.3 The plain card (no scorecard and no pack)

Laid out on the 036 card's own grid, in the **`lkf-rookie`** finish (paper: it reads as "not issued yet", where a
Standard card would look like a scraped one).

- **Member card** (the phone knows the person): top line = the mark + `MEMBER`; the name at the course size; bottom line
  = crew (left out with none) · `FIRST ROUND NOV 2026`, counting only rounds played **as that person** (their personId on
  the roster), else `NO ROUNDS YET`.
- **Blank card** (no person): top line = the mark + `GOLF BOARD`; middle = "Your card prints after your first round."
- Light theme: the plain card gets `--shadow-float` plus a 1 px `--line` outline (paper on a light page needs an edge).

### 6.4 Zero cards: one sentence, one action (Fuse's empty home)

In the crew row's slot, for both plain cards: the **join code field + Join** (`codeField`, `home-join`). It is the
action a new friend actually has; "Start a round" is already the pinned New round. If they're in a crew with rounds,
the crew row shows instead and Join with code stays in the foot.
**Whenever the join field is on the page, the foot is New round only.**

## 7. Under the stack: the crew row

One 64 px `.home-row` with a `--glass-line` border: crew name (`ts-label`) over "Standings"; on the right your place
in mono 32/36/700, −1px, `--text`; chevron. → `#/season/<id>`. **The only visible door to Standings, so it shows on rung 9 too**
(the headline names the leader, the row shows your place: no repeat).

- Ranked: "2nd". Not yet ranked: "1 of 3 rounds" (`MIN_ROUNDS`). Crew still loading: the stored name, the number
  appears in place; the row's height never changes.
- Hidden only while a round is live, and when the crew has no rounds.
- **No crew:** the slot holds a **Start a crew** row (→ `#/crew/start`).
- Two crews: the row shows the current crew (`db.crews.current()`).

**Standings takes over the crew's controls, built in this feature** (`js/screens/season.js`): the crew switcher
(`crew-pick`, the same `.seg`, which here also routes to `#/season/<newId>`) when you're in two or more, **Invite** (`crew-invite`), **⋯** (`crew-settings`) and
**Name your crew** when it's unnamed. Without that, moving them off Home would silently drop two-crew switching.
Tests: one in `tests/home037.test.mjs` for the row's states, one for Standings' header model.

## 8. Doors row and foot (R6)

**Doors row** (hidden while the nudge shows): at most two text doors, each a 48 px target: **All rounds** (`#/rounds`), and **Add to Home Screen**
(iPhone Safari, once its nudge has been dismissed; `home-add`).

**Foot, normal:** Join with code (`home-joinsheet`) + New round, pinned.
**Foot, live:** the green live bar (`LIVE · HOLE 7`, the round's state line, **Back to hole 7**), the only thing on Home
that glows, and under it Join with code + New round as two 48 px half-width buttons (same actions). The headline
(rung 1) names the round and says nothing the bar says. The stack is unchanged.

## 9. What leaves Home, and where it lands

| Leaves | Lands |
|---|---|
| How it finished | the round's Board. **Folder 038, built alongside:** a "Full board ›" link on the card back → `#/e/CODE` (the card already has `code`). Without it the hero card is a dead end back to its round. 036 is frozen, hence its own folder. |
| "Your locker" row | the stack |
| Standings row | the crew row |
| Invite, ⋯, Name your crew, crew switcher | Standings (§7) |
| Recent rounds list | `#/rounds`, from the doors row. The Locker is not All rounds. |
| What's new line | the nudge strip (§4.2) |

## 10. A new phone

No new screens and no typed-name step (a person only exists through a roster or crew pick with a personId, `joinPlan`).

1. **Texted a round link, no app:** Safari opens the round → the existing "Who are you?" pick sets the owner → they play
   or watch. Home then shows the pass (or their member card), and the Add to Home Screen nudge.
2. **Texted a link, has the app:** the existing **Open Golf Board** hand-off.
3. **Opened cold:** rung 12, the blank card, the join field under it, one pinned **New round**.

## 11. States (R8)

| Situation | Headline | Front | Edges (Safari / app) | Crew slot | Foot |
|---|---|---|---|---|---|
| Normal day, 5 cards | 8, 9 or 10 | latest scorecard | 1 / 2 cards | crew row | buttons |
| One card | 8–10 | it | 0 | crew row | buttons |
| Zero cards, person known | 5, 7 or 11 | member card (or a pass) | 0 | join field (also under a pass; crew row instead when in a crew with rounds) | New round only when the join field shows |
| Brand-new phone | 12 | blank card | 0 | join field | New round only |
| Pack waiting | 6 | pack | 0 / 2 cards | crew row | buttons |
| Several packs | 6 (newest) | newest pack + count pip | 0 / 2 | crew row | buttons |
| Pass ≤ 48 h | 5 | pass | 1 / 2 | crew row | buttons |
| Pass ≤ 48 h + pack | 5 | pass | pack / pack + card | crew row | buttons |
| Later pass | 6 or 7 | pack if any, else the pass | per §6 | crew row | buttons |
| Several passes | 5 or 7 | soonest | next pass first | crew row | buttons |
| Removed | 2 | per §6; that pass shows `SPOT GIVEN` + Text host | per §6 | crew row | buttons |
| Called off | 3 | per §6; that pass greyed, gone the day after | per §6 | crew row | buttons |
| On the roster, not opened here | 5 or 7 | the pass (Open) | per §6 | crew row | buttons |
| Watching a coming round (not on its roster) | 7 or by date, sentence "8 players in." | the pass | per §6 | crew row | buttons |
| Organizer, not playing | 5 / 7 with "8 players in." | pass with Open + Share link | per §6 | crew row | buttons |
| Organizer the night before | 5 | their pass, Open + Share link | 1 / 2 | crew row | buttons |
| Same person, second device | as normal: nothing on Home depends on which device claimed a round | | | | |
| Round live | 1 | unchanged | 0 / 2 | hidden | live bar + two buttons |
| Nudge showing | any | measured fit | 0 / 2 | per row | buttons |
| Locker loading | from `glb.recent` | a 258 box in the plain card's finish, no text | 0 | per crew data | buttons |
| Locker failed / offline, had cards (`glb.seen.homeCards`) | from `glb.recent` | the same box: "Your cards load with signal." | 0 | name only | buttons |
| Locker failed, never had cards | from `glb.recent` | member or blank card | 0 | per row | buttons |
| No crew | any | any | any | Start a crew row | any |
| Two crews | any | any | any | current crew; switch on Standings | any |
| Long names | cards and rows truncate with an ellipsis; a headline only ever holds first names | | | | |

"Had cards" is `glb.seen.homeCards`, set true whenever the locker loads with any card (a `glb.seen.*` key, so it moves
with the move link), not `glb.seen.homeTop`, which holds the last front object and reads `pass:CODE` when a pass is in
front.

**No reflow, one deal.** The front slot is its fitted height from the first paint and the foot never moves. The deal
(0.7 s) waits for the locker or 1.5 s, whichever is first; a late locker cross-fades into the same box. It never plays
twice. Reduced motion: no deal, no fade. `topKey` kinds: `card:CODE`, `pack:CODE`, `pass:CODE`, `member`, `blank`.

**Type:** the front object's number is the only `number-xl`-scale thing; headline `ts-title`; kickers, edges and
badges `ts-label`; the crew place and the pass's day in mono 32/36/700, −1px, `--text`. **Light theme:** only the front object
has `--shadow-float`; edges get a 1 px line in their own `--m-edge`; pass and crew row use `--shadow-card`.
**Standalone:** the foot sits inside the home line's safe area as today.

## 12. Tap targets

Every target is at least `--tap-min` (48): edges 48, the nudge 48, each door 48, the two buttons under the live bar 48,
the pass's buttons 48, the crew row 64. Pressed state: `scale(.97)` (the design system's value).

## 13. Patterns and paperwork (R5)

| Pattern | New? | Nearest existing thing | Why |
|---|---|---|---|
| Stack with edge strips | **new** | `.lk-fan` (old Locker row thumbnail) | the idea: one object instead of a list (Wallet) |
| Pass | **new** | `.card.lb-card` content, the 036 box | the first object many friends will have (Focus Flight) |
| Nudge strip | small new | the first build's `hm-news` line | Wallet: a dismissible nudge above the stack |
| Plain card | no | `lkf-rookie` on the 036 grid | new words only |
| Two-tone headline | no | `ts-title` with `--text` / `--text-muted` | Fuse |
| Crew row, doors row | no | `.home-row`; `.btn.ghost` text buttons | — |

Cut along the way: tiles, a separate Home face, "Since", the Passport tile, the ‹ › switcher, a What's new sheet that opens by itself, the
"N in" count, "Nothing on the books.", the plain card's Start a round button.

### 13.1 Craft checklist, mapped to tokens (no new tokens)

Tabular numbers on every digit · score and to-par on the baseline · more space above a kicker than below, and the
kicker-to-sentence gap = `--space-2` · `text-wrap: balance` on the headline · motion easing `--ease-grow` · shadows
only `--shadow-card` / `--shadow-float` · borders `--glass-line` · notches `--radius-md`, inner radii concentric ·
press `scale(.97)` · saturated colour only on a card's finish and the live bar · every button says what it does ·
kickers uppercase mono (the system's `.label`), sentences in sentence case.

### 13.2 To update when built

`tests/home037.test.mjs` (ladder with both forms per rung, stack order, edges per size, crew slot, nudge order);
a Standings header test; `tests/smoke037.mjs` (the `hm-news` and `.lb-home` selectors, check 3, the What's new text);
the smoke Add to Home Screen checks (`home-add` stays on Home, in the nudge or the doors row); the screen map;
`RELEASES` copy; `glb.seen.homeNudge.*` and `glb.seen.homeCards` in CLAUDE.md's key list; `tests/lobby025.test.mjs:179-187`
(`homeCard` gains fields; the not-on-roster wording); `tests/returning037.test.mjs:29-30` (What's new skips anyone
whose first round is after the release); folder 038's own SPEC plus a test that the card back's link doesn't flip the
card; `SPEC.md` gets a line pointing here. No database
change; nothing on the joining, score sync, queue or engine paths. **Run `smoke037` before merging** (Home drives the
returning-player flow).

## 14. The prototype (R9), built next as an artifact

Every frame is a **true-size phone**: 393 × 852 with the status bar and home line drawn, dark and light, each with its
tap map. Plus 393 × 659 Safari frames for: normal day, pack, a pass in front at the fit, zero cards + pass + nudge, round live
(the sunlight case; friends mostly use Safari), offline with cards. One 402 × 681 frame.
Frames: brand-new phone · member card · a friend with a pass and no card · one card · normal day · pack · pass ≤ 48 h +
pack · round live · organizer the night before · rung 9 (dull week) · locker loading · offline with cards · removed pass · called-off pass · a
watcher's pass ("8 players in.") · a long first name on rung 5 · the plain card in light theme · the What's new
sheet · the card back with Full board · Standings with the crew controls. **Both edge versions** (48 px strip; 32 px strip with a 48 px
hit area) side by side for Andrew to pick. R9 can only be scored on this list until the frames exist: they are the
step after the plan passes.

## 15. For Andrew (the plan's defaults; say if any is wrong)

1. After a round the headline is the **game result**, not your score.
2. A live round shows **only in the bottom bar**. (Wallet's alternative: fold the stack away and put the live round on top.)
3. A round within 48 hours goes **in front of a waiting pack**.
4. **Invite, crew settings and the crew switch move to Standings** (extra work on that screen, included).
5. **"Full board" on the card back ships alongside** as folder 038 (it touches the finished 036 card).
6. Edges: **48 px strips with the course name**, or the thinner strip. The prototype shows both.
7. The no-card card is **paper** (`lkf-rookie`), not Standard. Rookie is also the finish of your first three real
   cards, so the plain card and your first card will look alike (arguably a feature: it grows into the real thing).
8. No name step for new phones.
9. Both pinned buttons stay.
10. **Share link on every coming pass**, not only the organizer's. It is the link the host already texts (an unclaimed
    name can be picked by anyone who has it); a growth bet. Organizer-only is the safe alternative.
11. No "added you" headline for a round you haven't opened yet (the pass with Open does that job).

## 16. Round 2's ten changes

| # | Change | Where |
|---|---|---|
| 1 | Tap targets ≥ 48, press .97, tokens mapped | §12, §13.1 |
| 2 | Budget from the real CSS, measured fit, Safari copy | §4, §4.1, §5 |
| 3 | Edges carry the course, no score, contradiction fixed, named as a pattern | §6.1, §13 |
| 4 | Ladder copy as facts, bright half carries the fact | §5 |
| 5 | Rung order, rung 4's conditions, results from `finishUnits` | §5 |
| 6 | Crew row stays on the crew rung; Standings gets the controls, with tests | §7 |
| 7 | The pass: mono title, inverted badges, buttons under the tear, `home-share`, game name, both fixes | §6.2 |
| 8 | Nudge is its own strip, Add to Home Screen first, `glb.seen.*`, two doors | §4.2, §8 |
| 9 | Plain card on the 036 grid in `lkf-rookie`, join field, first round as that person | §6.3, §6.4 |
| 10 | Offline-with-cards box, four new state rows, paperwork, frames, smoke | §11, §13.2, §14 |

## 17. Round 3's eight edits (all applied as written)

| # | Edit | Where |
|---|---|---|
| 1 | `.home { padding-bottom: 0 }` stated as a change; the pass's 336 × 240 floor | §4 |
| 2 | 402 pack row 621, join field 92, the new-friend row, doors row hidden with the nudge | §4.1 |
| 3 | Rung 4 cut | §5, §11, §13.2, §14 |
| 4 | Rungs 2 and 3 only for the front pass | §5 |
| 5 | One copy table with a written Safari form; real game names; "Sean is next." | §5 |
| 6 | Mono 32/36/700 in `--text`; badge fill `--button`, text `--on-button` | §6.2, §7 |
| 7 | Nudge under the top bar; New round only with the join field; `glb.seen.homeCards`; old lobby entries; drawn edge strip; plain card in light theme; `crew-pick` routes | §4.2, §6, §7, §11 |
| 8 | Paperwork and frame additions | §13.2, §14 |

Settled by the author: **What's new opens a sheet on tap** (3 of 4; reason in §4.2). **Share link on every coming pass**
(3 of 4; listed for Andrew in §15).
