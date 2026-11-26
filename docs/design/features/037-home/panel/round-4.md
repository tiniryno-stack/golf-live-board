# 037 Home, second pass · Panel round 4 (final)

**Plan reviewed:** `docs/design/features/037-home/PLAN-v2.md` draft 5 (branch `claude/037-home`, commit 467251d).

**Panel:** the same four critics plus the Jester. In Round A each critic checked that round 3's eight paste-ready edits
landed, looked for leftover text that contradicts them, and re-did §4.1 against the real CSS. Round B was a short
rebuttal on a merged cleanup list and the Jester's new provocations.

Review only: no app code, database, preview or test suites were touched. A 9 means "I would build this as written".

## Scores

| Panelist | R1 | R2 | R3 | **R4 final** |
|---|---|---|---|---|
| Editor | 5 | 6 | 8 | **9** |
| Art Director | 4 | 6 | 8 | **9** |
| Golfer | 5 | 7 | 8 | **9** |
| Engineer | 4 | 7 | 8 | **9** |
| **Mean** | 4.5 | 6.5 | 8.0 | **9.0** |

**The plan passes.** All four critics would build draft 5 as written, once the ten one-line text cleanups below are
applied. None of the cleanups changes the design: each fixes an old line that contradicts newer text, or one false
sentence. The next step is the prototype session (§14).

### Per requirement

All nine requirements are at 9 from every seat. One small exception: the Art Director gives R7 an 8 from their seat and
defers it to the Engineer, who gives it a 9.

| Req | Final finding |
|---|---|
| R1 | One question; every rung is a fact; a cold open explains itself. |
| R2 | Every element is a status or a door. The one remaining repeat is rung 3 (C2). |
| R3 | The pass is in front for a friend with no card. The plain card is paper (`lkf-rookie`, `locker.css:18`) with an outline in light theme. |
| R4 | Real CSS; `padding-bottom: 0` is stated as a change; the pass floor is 336 × 240; the doors row hides with the nudge. Re-checked (table below). |
| R5 | Only existing tokens. Taps are ≥ 48. The pass day is a named style in `--text`, not `.lc-pts`. Badges are the right way round. |
| R6 | The bar is the only live element; the headline names the round with the real `gameName`; Join / New round are 48 px under the bar. |
| R7 | No DB change and no new fetch. `gameName(compute(event, []))`, `glb.seen.homeCards`, and rung 4 cut. |
| R8 | Every situation has a state row: watcher, organizer not playing, second device, offline with cards, removed, called off, two crews. |
| R9 | §14 is the right and complete brief for the prototype: 659 frames, one 402 × 681 frame, both edge versions, light theme, the What's new sheet, removed and called-off passes, a long name. |

### Arithmetic, re-checked (Engineer and Art Director independently)

Sizes used: `padding-bottom: 0`, top bar 52, foot 88 in Safari / 96 in the app, join field 92, card 258 / 264, pack
266 / 273.

| Situation | 393 × 659 | 402 × 681 | 393 × 852 app |
|---|---|---|---|
| Normal day | 654 | 660 | 746 |
| Pack in front | 614 | 621 | 754 |
| Pass + pack edge | 654 | 660 | 746 |
| Nudge | 614 | 620 | 754 (2 edges) |
| Zero cards + pass + nudge | 630 | 636 | 674 |
| Round live | 602 | 608 | 742 |
| Zero cards | 622 | 628 | 666 |

- Every figure matches the plan.
- The pass is never fitted below 258 tall, above the 240 floor.
- Open and Share link fit under the tear at about 160 px each in 329.
- There is ±8 px of ambiguity from `.home > :first-child` (`styles.css:2848`) now landing on the nudge. The nudge rows'
  spare covers it.

## Round 3's eight edits: all landed

| # | Edit | Verdict |
|---|---|---|
| 1 | Padding as a stated change + pass floor | Landed (§4, L44-47) |
| 2 | §4.1 numbers, the 630 row, doors row hidden with the nudge | Landed (L59-72) |
| 3 | Rung 4 cut | Landed (L106, 119-122, 281, 285, §13.2, §14, §15 #11). The §16 history row (L382) is harmless. |
| 4 | Rungs 2–3 only for the front pass | Landed (L130-132) |
| 5 | One copy table with a written Safari form, real game names | Landed (L97-117) |
| 6 | Mono 32 in `--text`, badges inverted | Landed (L182, 184, 221) |
| 7 | Nudge position, join-field foot, `homeCards`, lobby fallbacks, drawn edge, light plain card, `crew-pick` routing | Landed |
| 8 | §13.2 tests, §14 frames | Landed (L337-357) |

The author settled two open items:
- **What's new opens a sheet on tap (§4.2).** This answers the Engineer's collision concern:
  - it opens only on a tap;
  - any open sheet or overlay already blocks Home's taps;
  - `checkVersion` waits for an open sheet;
  - `open-app` is raised on the round route (`app.js:482`), not on Home.
- **Share link on every coming pass (§6.2).** Left to Andrew as §15 #10, with the corrected facts below.

## Ten cleanups to apply before the build session reads the plan (paste-ready)

All four critics agree on every item. Where they amended a wording, the amended text is given.

- **C1 · L19 (§2, Fuse row, last cell):** replace the "can be dropped" wording with:
  > "§5: every headline's **bright half carries the fact**; the grey half only qualifies it. Safari uses each rung's
  > written short form (§5), never a bare bright half."
- **C2 · L105 (rung 3):** the kicker `CALLED OFF` and "Saturday is off." both repeat the pass's own CALLED OFF badge.
  The panel's round-3 table introduced this. Replace with:
  > `| 3 | the front pass was called off | SATURDAY | "<Host> called it off." | "<Host> cancelled." | — (Text host on the pass) |`
  > `<Host>` = the first word of `homeCard.host` (`hostName`, `lobby.js:337`).

  Use the first word so a full name still fits 20 characters. The Safari form is the Art Director's "Justin cancelled.";
  the Golfer's alternative "It's off." also fits.
- **C3 · L190, a false justification.** `claim_player` takes any unclaimed spot with no approval
  (`schema.sql` ~326-331); `request_join` applies only to a taken spot. Round 3's panel report repeated the same error,
  and the panel owns it. Replace "the link is harmless since joining still needs approval, and the pass is Home's growth
  door" with:
  > "it is the link the host already texts: an unclaimed name can be picked by anyone who has it, a taken one needs Ask
  > to join, exactly as today; and the pass is Home's growth door."

  Add the same fact to §15 #10.
- **C4 · L192:** replace "`game` (the round's game name from its settings)" with "`game` (`gameName(compute(event, []))`, see §5)".
- **C5 · L271 (§11 zero cards, person known, crew slot):**
  > "join field (also under a pass; crew row instead when in a crew with rounds)".
- **C6 · L282–283:** replace `"8 players \| in."` with `"8 players in."` in both rows, matching §5 L107 and L109.
- **C7 · L287 (§11 nudge row):** replace edges `0 / 1` with `0 / 2`, matching L68's app total of 754.
- **C8 · L304 (§13):** replace "in the existing mono 32" with "in mono 32/36/700, −1px, `--text`". The Art Director's
  light-theme sentence is optional but recommended:
  > "**Light theme:** only the front object has `--shadow-float`, except a pass, which keeps `--shadow-card` in front
  > too; edges get a 1 px line in their own `--m-edge`; the crew row uses `--shadow-card`."
- **C9 · L324:** replace "a What's new sheet," with "a What's new sheet that opens by itself,".
- **C10 · the What's new copy** (§4.2 / `whatsnew.js` RELEASES). "Your card is on Home", read while looking at your
  card on Home, describes the screen it's shown on. Write the line about something not on screen, e.g. "Cards, packs
  and a Passport". Raised by the Art Director, Golfer and Editor from the Jester's M2.

## For Andrew (§15)

No default is wrong. The panel's notes on the ones that matter most:

1. **#6, edge size: 48 px strip or the thinner one.** Pick on the prototype. Three critics lean 48 px: Wallet's edges
   are about 50 pt, and the course name needs the room in sunlight. The budget already assumes 48.
2. **#7, paper plain card.** The no-card card and a player's first three real cards (Rookie 1/3) will both be paper.
   Judge it on the light-theme frame next to a real Rookie card.
3. **#10, Share link on every pass: a growth bet.** With C3's facts: anyone the link reaches can pick an unclaimed
   name, which is already true of the host's texted link. Every player becoming a sharer widens who can pass it on.
   - Organizer-only is the safe default.
   - Every pass is the growth bet; the organizer can still release a player.
   - Golfer, Editor and Engineer would keep it on every pass. The Art Director says to own it knowingly.
4. **#2, live day: bar only, or the stack folding away with the live round on top.** The panel accepts bar only, now
   that the headline names the round.
5. **#11, an "added you" headline.** If real rounds show friends missing rounds they were added to but never opened,
   the Golfer's `YOU'RE IN` · "`<Host>` added you." (with `synced === true`, `onRoster`, no `glb.me.CODE`, not host) is
   ready in `panel/round-3.md`. The Engineer still flags that Home can't check the claim. The panel would add it only on
   evidence.
6. **Merge:** a `smoke037` run before merging. Home drives the returning-player flow.

## The Jester's round-4 provocations and the panel's answers

| # | Provocation | Panel's answer |
|---|---|---|
| M1 | Drop the app column; ship the Safari copy everywhere | **Rejected.** The home screen app has room for the grey half, which adds who or how ("with Sean"). Both forms come from one pure function with one test, so it's one product, not two. The Engineer calls it a matter of taste with no build risk. |
| M2 | Take What's new off Home; put it in the `home-me` sheet | **Move rejected, grain accepted (C10).** Nobody would find it there, and the strip shows once per release, on tap only. The real problem is the self-referential copy. |
| M3 | Share as the pass's only button: Open repeats the pass's tap | **Rejected.** "No repeats" is about facts, not a labelled door. A new friend in sunlight may not know the ticket is tappable, and a labelled Open costs nothing at 329 px. The Engineer agrees Open does duplicate the tap, but keeping it is more discoverable. |
| M4 | Bring rung 4 back as "You're in", even if sometimes a guess | **Rejected as a guess.** Home has no claim data: it would be wrong for watchers, a second device (separate storage) and a taken spot (`joinPlan` → ask), and a guess under `NEEDS YOU` misleads. The Golfer's always-true "`<Host>` added you." stays parked as §15 #11. |
| M5 | Hide the headline, not the doors row, while the nudge shows | **Rejected.** The headline is the status: for a new friend it captions their pass ("Riding with Sean."). The nudge is one-time housekeeping. All rounds is empty for a new friend, and 630 already fits. |
| M6 | Make the pass a 120 px ticket stub | **Rejected.** The pass needs about 240 px for the day, the 2×2, the tear and the 48 px buttons, so a stub drops the buttons or the grid. It would also break the shared 7:5 front box and the fit rule. For a friend with no card, the full pass in front *is* the moment Home lands. |
