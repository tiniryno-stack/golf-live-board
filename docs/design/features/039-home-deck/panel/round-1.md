# 039 Home deck · Panel round 1

**Plan reviewed:** `docs/design/features/039-home-deck/PLAN.md` draft 1 (branch `claude/039-home-deck`, commit
609168e).

**Code it changes:** checked against `main` as it is after 037 v2 shipped on Nov 26.

**Panel:** the same four critics plus the Jester. Round A was each critic's own critique; in Round B each critic read
the others and the Jester and gave a final score.

**Scored against:** the plan's own R1–R9 (§9).

Review only: no app code, database, preview or test suites were touched. A 9 means "I would build this as written".

## Scores

| Panelist | Round A | **Final** |
|---|---|---|
| Editor | 6 | **6** |
| Art Director | 6 | **6** |
| Golfer | 7 | **7** |
| Engineer | 5 | **5** |
| **Mean** | 6.0 | **6.0** |

**All four agree the direction answers Andrew's Nov 26 feedback:**
- Home is a place to go from, not a card gallery.
- Cards become a small deck that opens into a spread.
- Tapping a card brings it to the front.
- The headlines are full plain sentences ("2nd of 5." is gone).
- A familiar tab bar.
- No DB change.

**All four also agree draft 1 can't be built as written:**
- The budget uses the wrong tab-bar height and overflows.
- The plan would create two card browsers.
- The + sheet makes Join slower than today.
- The top-level tabs are unlabelled and look identical to a round's tabs.
- The tab-bar wiring assumes tabs only exist inside a round.
- None of the new patterns is specified.

The Engineer: "The fixes are all buildable, and with them I'd score it 9."

### Per requirement (final, condensed)

| Req | Finding |
|---|---|
| R1 findable in 5 s | **Not met.** Icons-only tabs at the top level, with no obvious icon for Rounds or Cards. The bar is identical to the round's own bar (`app.js:1533` renders `aria-label` only). |
| R2 cards ≈ a fifth of the screen | Met in size. But the Art Director says the 112 × 80 thumbnail beside text reads as the old Locker row Andrew called bolted on (`.lk-fan`, `locker.css:74-75`). |
| R3 tap brings to front | Right behaviour. Unspecified motion, and impossible inside a standard sheet (see change 4). |
| R4 plain sentences | Mostly met. Some lines don't stand alone ("Justin called it off.", "You and Sean won."). The live and pack headlines repeat the strips under them. |
| R5 familiar conventions | Tabs are right. The + can't sit inside today's four-equal dock (`styles.css:111`), and a two-step + sheet is slower than today's Join. |
| R6 design system only | Six new patterns (hub dock, +, deck, spread, compact pass, live strip), none named. No light theme. |
| R7 every situation | No state table. Nudge + pass + pack overflows 659. "+1 more → Rounds" lands on a list that drops coming rounds (`homeview.js:171-174`). With no crew there are two "Start a crew" doors. |
| R8 no DB change | Met. |
| R9 prototype with alternatives | Good intent, but there's no default (tabs vs tiles), the tiles frame isn't like-for-like, and there's no frame list with sizes or themes. |

## How the panel settled its seven clashes

| # | Question | Panel position | Vote |
|---|---|---|---|
| X1 | Where the spread lives | **The deck opens the Cards tab, which opens on the spread.** The 036 carousel is one tap further ("All cards"); Passport stays in Cards. One card browser. Built as a Locker view (`app.ui.lk.view = 'spread'` at `#/locker`), which gives scroll, the tab bar, the existing tilt / flip slot (`locker.js:201`) and no sheet redraws. | Golfer, AD, Engineer (the Editor proposed it, then moved to a Home overlay) |
| X2 | Deck size | **The Art Director's fan, not a row:** the real front at 168 × 120, two cards behind offset 6 px and rotated −3° / −6°, a `label` under it. **A measured fit between 112 and 146 px tall**, with no growth beyond. | Shape: all four. Size: three (the AD wanted it to grow to 196 wide) |
| X3 | + sheet | **One sheet: New round on top, then the code field focused synchronously in the tap handler, with Join.** Join = + → type; New round = + → tap. Add to Home Screen is **not** in the + sheet. | Content: all four. New round above the field: Golfer, Editor (the keyboard covers whatever sits under the field). The AD and Engineer had it under; see open items. |
| X4 | Tab-bar height | **94 px Safari / 128 px home screen app.** The dock is 6 + 56 + 6 + 1 px border top and bottom = 70 (`styles.css:105-117`), fixed at `bottom: calc(24px + var(--sab))` (`styles.css:102`). The AD conceded its 92. | All four |
| X5 | Pack strip | **Folded into the deck, always.** A waiting pack is the deck's sealed front with a count pip; there is no pack strip in any state. Up next is for rounds only. | All four |
| X6 | Live headline | **`LIVE · <COURSE>` "You're playing `<gameName>`."** The strip keeps the hole, the score and Back to hole N. It needs no new data. "You and Sean are up 2." would need new pair and margin fields, and the line is stale whenever the phone isn't in the round. | Editor, AD, Engineer (the Golfer moved to "up 2") |
| X7 | Tab labels | **`small` labels under the icons on the top-level bar only** (the README's tab-label style). The round's bar stays icons-only. | All four |

## Required changes for a 9 (consensus, ordered, paste-ready)

**1. §3, replace the tab-bar row and the budget paragraph** ("Budget: normal day in Safari … No measured fit is needed any more.") with:

> Tab bar: 94 Safari / 128 app (dock 70 incl. its 1 px border, fixed at bottom 24 + `--sab`, styles.css:102-117).
> Content `padding-bottom` = bar + 16, +72 while live.
>
> Budget at 393 × 659 (deck block 146):
>
> | Situation | Height |
> |---|---|
> | Normal day | 52 + 120 + 146 + 76 + 94 = **488** |
> | + pass | **632** |
> | + pass + nudge | 688 before the rules below; **652** with a one-line headline |
> | Live + pass | 704 before the rules below; **628** with the crew row hidden |
>
> Rules: the deck is a **measured fit in `mount`**, clamp(112, spare, 146) high. While the nudge shows, the headline is one line. While a round is live, the crew row hides (as in 037). Table also at 402 × 681 and 393 × 852 for: normal, + pass, + pass + nudge, live + pass, zero cards, new phone.

**2. §6, the closed deck. Replace the paragraph** starting "Left: a miniature of your latest card (112 × 80…" with:

> The real front of your latest card, left-aligned at 168 × 120 (down to 112 × 80 by the measured fit), with up to two
> cards behind it offset 6 px up-right and rotated −3° / −6° (as `.lk-fan`), its finish motion running. Under it, one
> `label`: "5 CARDS · TWIN CREEKS". A waiting pack is the deck's sealed front with a count pip and the label
> "1 CARD TO OPEN".

**In §5:** delete the bullet "A pack is waiting: one 72 px strip…". Replace "Both at once: the pass, then the pack strip."
with:

> Up next is rounds only (the compact pass). Several coming rounds: the soonest; "+1 more" opens Rounds, which gains a
> **Coming up** section on top (`allRounds` drops coming rounds today, homeview.js:171).

**3. §6, the spread. Replace** "Tap the deck → the spread opens over Home…" and "The spread is Home's own view (a
full-height sheet)…". **Delete** "One quiet link at the bottom: Open your locker". The replacement:

> Tap the deck → the **Cards tab** (`#/locker`), which opens on the spread, a Locker view (`app.ui.lk.view = 'spread'`).
> The 036 carousel is one tap further, **All cards**, and Passport stays in Cards: one card browser, not two.
>
> - The front card is the locker's exported card slot (tilt + flip, locker.js:201). The strips are plain markup, 56 px:
>   course in `row` on the left, date `label` and score mark on the right.
> - The strips scroll in content (from about 4–5 cards at 659), and the front card stays pinned.
> - Motion:
>   - Opening: the front card grows from the deck (`--motion-grow`, `--ease-grow`, keyed on `data-t0` +
>     `ui.syncMotion`), and the strips slide up with a 30 ms stagger.
>   - Tapping a strip: it lifts (−8 px, `--shadow-float`), the others close the gap, and it settles in front over
>     300 ms. A tap mid-motion jumps to the end.
>   - Tapping the front card flips it (036's flip).
>   - Reduced motion: 150 ms crossfades, no lift.

**4. §7, the tab bar. Replace** "using the app's own tab bar component (001: full-width glass bar, icons, one sliding
highlight; the screen title says where you are)" with:

> the app's tab bar component (001) with a **`small` label under each icon** (Home · Rounds · Crew · Cards) on this hub
> bar only; a round's bar stays icons-only. A round is a full-screen mode above the hub, with a visible **‹ Home**.
>
> **Wiring (app.js):**
> - `renderTabbar` keys its dock on `data-set="round|hub"`; it builds once today (app.js:1532).
> - Hub tabs use a new `hub-tab` action, not `tab`, which smoke.mjs drives in rounds.
> - The highlight follows `route.name` (the locker routes set `tab: 'passport'`, app.js:1334-1340).
> - `.has-tabbar` follows `isHub(route) || inRound`.
> - `checkVersion` and `onReturn` treat every hub tab as Home (app.js:1282, 1295, ~1313).
> - The live strip hides under `.sheet-open` like the bar does (styles.css:717).
>
> **Tab roots (Rounds, Crew, Cards) have no back button.** Today `topBack` returns "Home" on the Season root and `''` on
> the Locker (season.js:137, locker.js:631). Sub-views keep theirs: past seasons, `#/passport/<id>`, `#/locker/admin`,
> crew settings.
>
> **With no crew:** the crew row on Home is hidden, and the Crew tab is a hub-level empty Standings with **Start a
> crew** (`#/crew/start` stays a pushed screen).

**5. §7, the + button. Replace** "tap → a small sheet with **New round** and **Join with code**. This replaces the two
pinned buttons." with:

> The **+** is its own 56 px glass circle to the right of a narrowed dock (8 px gap, dock right edge at
> calc(16 + 56 + 8)). This is a named change to 001; the highlight track stays four equal tabs.
>
> Tap → one sheet: **New round** on top, then the join code field with **Join** (`codeField`, `home-join`). The field is
> **focused synchronously in the tap handler, right after `openSheet`, never after the slide-in animation**, or iOS
> won't raise the keyboard. Join = + → type; New round = + → tap. This replaces the two pinned buttons.
>
> After the nudge's ✕, **Add to Home Screen** is a row at the top of the Rounds tab in iPhone Safari (`home-add`, the
> move link; smoke.mjs:1393).

**6. §4, headlines.**

Add the rule:

> The sentence may repeat the deck, but never the Up next pass or the live strip directly under it.

Rows:

| Situation | Kicker | Sentence |
|---|---|---|
| live | `LIVE · <COURSE>` | "You're playing `<gameName>`." (the strip keeps hole, score and Back to hole N) |
| within 48 h | `NEXT ROUND · <COURSE>` | "You're riding with Sean." (the pass carries the day and time) |
| spot given away | | "Justin gave your spot to Sean." |
| called off | | "Justin called off Saturday's round." |
| last round | | "You had the low round of the group." / "You finished 2nd of 5 players." / "You and Sean won the `<gameName>`." / "You and Sean finished 3rd of 4 carts." |
| crew | | "You're 2nd in the standings." |

Replace "The prototype shows **three headline sets to choose from**" with:

> The plan's set is (A), above. The prototype shows (B) and (C) on the normal-day frame only.

**7. §3 row 6, the crew row.** Pick one rule:

> Shows the leader when the headline gives your place, otherwise your place; hidden with no crew or while a round is
> live.

**8. §7, the default. Replace** the tiles paragraph ("The prototype also shows the alternative…") with:

> **Default: the tab bar.** One alternative frame for Andrew to feel: no tab bar, three door tiles (Rounds · Crew ·
> Cards, one status line each) with the two pinned buttons. The same destinations, so the comparison is fair. Passport
> stays on the avatar in both.

**9. New §8a patterns and §8b states.**

§8a, patterns, each with its nearest existing thing:
- the labelled hub dock (001);
- the + circle (new, the one new control);
- the fan deck (`.lk-fan`);
- the spread view (037's stack + Wallet);
- the compact pass (037's pass, 132 px `.card` on `--surface-1`, `--glass-line`; mono-32 day, course · game and badge
  on the left; Open + Share link **stacked** on the right);
- the live mini-strip (037's live bar at 64 px, docked 8 px above the bar; with it, Home has exactly two lit things).

Light theme:
- the dock is light `--glass`;
- the strip is `tint-you` + 1.5 px `cart-you`, with no glow;
- the paper card gets `--shadow-float` + 1 px `--line`;
- the spread sits on `--bg` with `--shadow-card` per strip.

§8b, states, one row each with headline / Up next / deck / crew row / tabs:
- 0 / 1 / 20 cards
- pack
- pack + pass
- called off
- spot given
- live
- no crew
- two crews
- no person
- offline

**10. §9 R9 / §10, frames and paperwork.**

Frames at 393 × 659 and 393 × 852, dark and light:
- normal day
- pass + nudge
- live
- zero cards
- new phone
- the spread open, and the spread with 20 cards
- the + sheet with the keyboard up
- the labelled tab bar
- the tiles alternative

To update:
- smoke037 (`home-news`, `.hm-nudge`, `.hm-doors`, lines 118-176)
- smoke.mjs:609 (`home-joinsheet` → +)
- home037.test (stack / edge / budget asserts)
- fit and screen-map Home scenes
- `.home.hm2` CSS (styles.css:2848-2899)
- `topKey` / `glb.seen.homeTop`
- a 039 `RELEASES` entry

Run smoke037 before merging.

## Open items (for the author to pick, with a reason)

- **New round above or below the code field in the + sheet.** Golfer and Editor: above, because the keyboard covers
  whatever sits under the field. Art Director and Engineer wrote it under. The panel leans **above**.
- **Where a round's "‹ Home" lives.** Editor: in the round's header. Engineer: in its ⋯ menu (today it's in the You
  sheet). It must be visible either way.
- **Spare height in the home screen app (about 250 px on a normal day).** Art Director: put up to 64 px above the
  headline and let the deck grow to 196 wide. Editor and Golfer: spare height stays above the tab bar ("calm is not
  empty"; Andrew said "barely tell they are there"). The prototype should show the 852 normal day so Andrew can judge.
- **Spread implementation.** The Engineer's Locker view (`#/locker`, scrolls in content) is the panel default. The Art
  Director described it as an overlay like `showPack`. Same look, different build. The author should name one; the
  panel prefers the Locker view.

## The Jester's provocations and the panel's answers

| # | Provocation | Panel's answer |
|---|---|---|
| N1 | Take Andrew literally: tapping the deck cycles the front card in place, no spread | **Rejected.** The same quote says the stack, "when you click into it, the cards expand into a spread". At 112–168 px a cycled card can't be read. Grain: the deck must visibly *grow* into the spread (change 3's motion). |
| N2 | Headline set B: talk in strokes ("You shot 87 at Twin Creeks.") | **Kept as prototype set B, nothing more.** It's buildable from `card.gross` but wrong for team games. Andrew picks on the frames. |
| N3 | Cut the Home tab; open on Rounds | **Rejected.** Andrew asked for a home screen; Rounds is a list. The sparse gap is answered by the fan deck, not by deleting Home. |
| N4 | A big raised + straight to New round; Join on long-press | **Rejected.** Join is every friend's weekly action and long-press can't be discovered. New round is Andrew's. Both stay one tap after + (change 5). |
| N5 | The spread replaces the Locker; drop the Cards tab | **Grain accepted as X1:** one card browser, with the Cards tab opening on the spread. Sharing, the carousel and Passport stay in Cards, so the tab stays. |
| N6 | Swipe sideways between the four tabs | **Rejected.** The design system reserves swipes for Setup's back and closing sheets, and sideways swipes would fight the spread, the Locker carousel and the pack tear. |
| N7 | The live strip shows every live round in the crew | **Rejected for 039.** The strip's job is one tap back to *your* hole, and lit means yours. `glb.recent` holds only this phone's rounds, so this needs crew-round polling plus a `compute` per round. Backlog. |

## For Andrew (via the author)

- **Tabs vs tiles:** the panel's default is the tab bar, with a fair tiles frame for comparison.
- **Headline set A, B or C:** A is the default; B and C appear on the normal-day frame.
- **Spare height in the home screen app:** keep it calm, or grow the deck. Judge on the 852 frame.
