# 037 Home, second pass · Panel round 2

**Plan reviewed:** `docs/design/features/037-home/PLAN-v2.md` draft 3 (branch `claude/037-home`, commit 454ce81). The
references in `references/` (NOTES.md plus screenshots) were in scope this time.

**Same panel as round 1:** four critics plus a Jester. Round A was each critic's own critique; in Round B each critic
read the others and the Jester's new provocations and gave a final score. The critics checked draft 3's §12 claims
against the plan text and the code. §15 items were scored as the author's defaults.

Review only: no app code, database, preview or test suites were touched. A 9 means "I would build this as written".

## Scores

| Panelist | Round 1 final | Round 2 A | **Round 2 final** |
|---|---|---|---|
| Editor | 5 | 7 | **6** |
| Art Director | 4 | 7 | **6** |
| Golfer | 5 | 7 | **7** |
| Engineer | 4 | 7 | **7** |
| **Mean** | 4.5 | 7.0 | **6.5** |

Draft 3 is a real plan now:
- the tiles are gone and one card is the hero
- the pass has a shape (from Focus Flight)
- a phone with no card shows a real object (Fuse's empty Home)
- code-first arrival with no typed name
- the bottom bar is the only live element, with Join and New round still under it
- no database change, and nothing on the joining path

Two critics came down a point in Round B for two reasons:
- The real CSS still overflows Safari 393 × 659 on a **normal day** (7 px), before the required tap-size fix.
- Every edge, door, nudge and live button is under the design system's **48 px** tap minimum
  (`docs/design/design-system/tokens.css:18`, `README.md:19`; the Engineer conceded his 44).

### Per requirement (final, condensed)

| Req | Finding |
|---|---|
| R1 one question | Met. The Welcome line now says what the app is. On busy days the biggest text is filler. |
| R2 status or door | Met. One snag: edges are doors to cards that look identical ("Golf Live Board · FINISH"; empty for Standard). |
| R3 hits at 0 / 1 card | Met in principle. The member / plain card face is not laid out and its finish is not picked. |
| R4 fits, thumb | **Not met.** Real sizes: top bar 52, first child 8, foot 88 Safari / 96 standalone (the plan's 130 counted the home line twice), `.home` keeps 32 px of bottom padding. 393 × 659: normal 666, pack + edge 674, nudge 682. Two-line rungs (3, 9) add 36. With 48 px edges and `.home { padding-bottom: 0 }`: normal 658, nudge 658, pack + 1 edge 666. Standalone 852 fits. |
| R5 design system | **Not met.** Controls are under 48 px. §13.1's craft values contradict the tokens (scale .96 vs 0.97, a new easing vs `--ease-grow`, layered shadows, alpha borders, concentric radii). The pass's "big mono" type is unnamed. The green TODAY badge is a second green beside the live bar. |
| R6 round day | Met, but the live headline is filler ("Keep it going." when you're down 5). |
| R7 today's data | No DB change. Three claims are wrong in code: rung 3's `lobbyPid` source, rung 6's copy (not in `result.line`), and the pass's "pure" Share link / game name. |
| R8 whole group | Mostly. Missing or wrong: watcher, non-playing organizer, offline-with-cards, two devices, stale called-off pass, 16-player row, two-crew switching. |
| R9 true size | Frames listed in §14, not drawn yet. |

## Round-1 required changes: where they stand

| # | Round-1 change | Verdict (panel consensus) | What's still missing |
|---|---|---|---|
| 1 | Re-budget at 659 / 681 / 852 | **Partly** | Real CSS sizes (52 / 8 / 88 / 96, `.home` padding), 48 px edges, a measured fit in `mount` |
| 2 | Code-first onboarding, no typed name | **Satisfied** | The blank card replacing the dashed outline is accepted (Andrew rejected the dashed one) |
| 3 | Headline ladder, no repeats | **Partly** | Filler rungs (1, 2, 4, 8). Rung 2 repeats the pass badge; rung 3 repeats the removed pass's sentence. Rung order bug. Rung 3 and rung 6 data don't exist as described. |
| 4 | Round day: bar only, Join / New on Home | **Satisfied** | Buttons need to be 48 px |
| 5 | Stack rules | **Partly** | §12 says "edges kept, course only". §6 draws the 036 top line, which has no course (`screens/locker.js:155-156`). Edges are 28 px. |
| 6 | Pass fully specified | **Partly** | `home-share` needs a new action (`board-share` → `copyLink` shares the *open* round, `board.js:432`). Game name needs the settings, not `gameName(snap)` (`playfor.js:29`). The "Team Ryder Cup" text in `home.js:47` isn't covered either. |
| 7 | Member card buildable | **Satisfied** (content) | Face layout and finish. FIRST ROUND must count only rounds played as that person. |
| 8 | One crew row | **Partly** | "Standings already has the switcher" is false (`crew-pick` is Home-only, `home.js:172`). Rung 7 hides the row and its door. |
| 9 | Fix the landings | **Mostly** | `#/rounds`, Add to Home Screen and in-place What's new are kept. Full board is deferred, and three of four critics say wrongly (see §15 below). |
| 10 | State table | **Partly** | Offline shows "Finish 18 holes…" to someone with 10 cards. Missing: watcher, non-playing organizer, two devices, stale called-off pass. 16-player row is wrong (Ryder = the cup). |
| 11 | Type hierarchy, light theme | **Satisfied** | Apart from §13.1 |
| 12 | True-size mock-ups | **Not yet** | Deferred to the prototype; the frame list is right |
| 13 | Patterns + paperwork | **Partly** | Missing from the update list: §13.1 not mapped to tokens; the nudge-dismiss storage key; smoke037 selectors (`hm-news`, `.lb-home`); Standings switcher / Invite / rename tests; the 2026-11-25 What's new copy (it describes How it finished) |

## The references: did §2 take the right lessons?

The Editor and Art Director looked at the images themselves:

- **fuse-02 (empty Home): read correctly.** Keep the layout and put one sentence and one button where the missing thing
  would be. One correction: fuse-02's tiles *are* dashed, so the plan's "nothing dashed" is wrong. The blank-card choice
  still stands on Andrew's own rejection of the dashed box.
- **fuse-01 (two-tone): misread, but keep it.** Fuse's grey is the *cents of one number* (lower precision inside a figure),
  not half a sentence. Splitting a sentence is an Apple-editorial device. It can stay, with one rule: **the bright part
  carries the fact, and the grey part never carries information.** That flips e.g. "Won | with Sean.", which hides the
  partner in grey.
- **wallet-01 (edges): misread twice.**
  - The edges are about 50 pt at true scale, not 28.
  - They are told apart because every card's art differs, while ours are identical dark gradients for
    Standard / Bronze / Silver (`locker.css:12-14`).
  - Lesson: an edge must carry its identifier.
- **wallet-02 (the nudge): misread.** Wallet's nudge is a full-size card with its own art, ✕ and Apply, set apart by page
  dots. It is not dressed up as an edge. Ours expands and has ✕, so it must not look like an edge, because edges open
  objects.
- **focusflight-04 (the pass): read correctly.** The pass with its buttons where the barcode sits is the right
  adaptation.

## Remaining required changes for a 9 (consensus, ordered)

1. **Tap targets.** Every one is ≥ 48 px: edges, the doors row, the nudge, the two buttons under the live bar.
   - Press scale is 0.97 (`README.md:95`).
   - Map every §13.1 item to an existing token: `--ease-grow`, `--shadow-card` / `--shadow-float`, `--glass-line`,
     `radius-md` notches. Anything without a token goes in §13 as a token proposal.
2. **Re-budget with the real CSS** at 393 × 659, 402 × 681 and 393 × 852.
   - Sizes: top bar 52, first child 8, foot 88 / 96, edges 48, the card 264 at 402 wide, `.home { padding-bottom: 0 }`.
   - The front object is a **measured fit in `mount`**, the way `enter.mount` measures the pads: `min(361, leftover × 7/5)`,
     never under 300 wide.
   - Safari shows 0–1 edges; a pack in front shows 0.
   - Safari headline copy is written to the measured one-line width, about 20 characters at title 32 / 800. Examples:
     "Your spot went to Sean." / "Join Saturday's round." / "Your group's live scores.".
3. **Edges carry identity.** A Home-only edge strip: the card's own finish art plus the **course** in `label` (12 px) in
   `--m-ink`, no score. Never a pack's score. Each edge opens its own card. Fix the §6 vs §12 contradiction, and name the
   strip as a new pattern (036's top line has no course).
4. **Rewrite the ladder's copy as facts the object below doesn't show**, with the bright / grey split written per rung:
   - Live: names the round, e.g. "Rider Cup | at Twin Creeks."
   - Pass due: say nothing the pass already shows (no TODAY / TOMORROW repeat). If "Riding with Sean" goes in the
     headline, take it out of the pass's 2×2.
   - Pack: the sealed round's game result, built from `finishUnits` on the pack's locker row, **never strokes**
     (stroke-play `result.line` carries "net 87" and would spoil the rip).
   - Quiet week: the last result with no age limit, its date in the kicker (`LAST OUT · NOV 2`). Never "Nothing on the
     books." while any result exists.
5. **Fix rungs 3 and 6 and the rung order.**
   - Rung 3 fires only when the owner's personId is on that round's roster, this phone has no claim, and they are not
     the host. `homeCard` returns `onRoster` (same `me` lookup as `lobby.js:342`). Never for watchers, never for synced
     rounds already joined on another device. Wording: "Open Saturday's round."
   - Removed / called-off rounds come before rung 2 and never match "you tee off".
   - The removed sentence lives in the headline only; the pass shows a badge and **Text <host>**.
   - Rung 6 comes from the locker row (`finishUnits` / `finishRows`: rank, field size, gap). Team Ryder Cup uses the cup
     line. Fallback: `result.line` with the score stripped. Fix the 16-player row.
6. **Crew row and Standings.**
   - The crew row stays visible on rung 7. Rung 7's sentence changes so it doesn't repeat the place, e.g.
     "Sean | is 1st.". The Engineer notes "3 back" isn't computable, because standings are win-rate
     (`seasons.js:160-190`).
   - Standings gets the **crew switcher, Invite, ⋯ and rename**, costed in §13 with tests. Without this, §15 #5 silently
     drops two-crew switching.
7. **The pass.**
   - Day and time in mono `title` (`number-xl` overflows the 7:5 box).
   - Badges inverted (`button` / `on-button`), CALLED OFF on `surface-3`, never green.
   - The buttons sit under the tear and stop the pass's own tap from firing.
   - Add a new `home-share` action (`navigator.share` with `#/e/CODE`), the organizer from `glb.admin.CODE`, and the game
     name derived from settings.
   - Add `home.js:47` to the "Team Ryder Cup" fix.
8. **The nudge.**
   - Draw it as its own strip above the stack, not overlapping it and not styled as an edge.
   - In Safari, Add to Home Screen comes first. Skip What's new for anyone whose first round is after the release.
   - Dismissal is a `glb.seen.*` key, so it moves with the move link.
   - The doors row holds **at most two** doors. Add to Home Screen joins it only after the nudge is dismissed.
9. **The plain / member card.**
   - Lay the face out on the 036 grid: top line = mark + MEMBER; the name at the course size; bottom line = crew ·
     FIRST ROUND NOV 2026.
   - Pick the finish and say why. The Art Director recommends `lkf-rookie` (paper, reads as "not yet issued") over a
     scraped-looking Standard.
   - Replace its "Start a round" button, which duplicates the pinned New round, with the join field.
   - FIRST ROUND counts only rounds played as that person.
10. **State rows and paperwork.**
    - Offline or locker failed with cards → a 258 px box "Your cards load with signal". Never the zero-card text, and it
      never pushes the foot down.
    - Add rows: watched lobby round, non-playing organizer, the same person on two devices, a stale called-off pass.
    - Update the smoke037 selectors (`hm-news`, `.lb-home`), the RELEASES copy, and the new key and tests.
    - Then draw the §14 true-size frames, dark and light, with tap maps. Include 393 × 659 with pack + 1 edge, the nudge,
      and rung 3.
    - `smoke037` before merging.

## Open disagreements between panelists

- **How edges reach 48 px.**
  - Art Director and Editor: show 48 px of the real card, with no hidden hit areas, because those send taps to the wrong
    object.
  - Golfer: draw a 28–32 px strip with the course label and extend its hit area to 48.
  - The Engineer budgeted with 48 px visible edges in Round B.
  - Unresolved; the prototype should show both.
- **Two-line headlines in Safari.**
  - Art Director: hard cap of about 20 characters. Never take 36 px from the card, which is the hero.
  - Engineer: a cap, or allow 2 lines and shrink the card.
  - Editor: measure in `mount`, don't count characters.
  - All agree copy must be written to fit; they disagree on the fallback.
- **The rung-7 door.**
  - Golfer and Engineer: keep the crew row and change the sentence.
  - Editor: alternatively make the headline the door with a visible chevron (`FOUNDERS CREW ›`).
  - All agree there must be one visible door to Standings.
- **Full board on the card back.**
  - Editor, Art Director and Engineer: build it in this release as folder 038. The work is small (`card.code` exists).
  - Golfer: in 037's build order but not blocking Home.

## §15 defaults the panel thinks are wrong or conditional

- **#7 Full board "a follow-up": wrong** (Editor, Art Director, Engineer; Golfer partly). The card is Home's hero. Without
  the link it is a dead end back to its round, and How it finished is only reachable through All rounds. Ship folder 038
  alongside 037.
- **#5 Invite → Standings: conditional.** All four accept it only if Standings gets the switcher, Invite, ⋯ and rename in
  this feature, and the crew row stays a visible door on rung 7.
- **#2 live = bar only: conditional.** Accepted by all four, provided the live headline names the round instead of filler.
- **#1, #3, #4, #6, #8, #9: fine.** Keep both pinned buttons (#9): Join is the friends' weekly action, New round is Andrew's.

## The Jester's round-2 provocations and the panel's answers

| # | Provocation | Panel's answer |
|---|---|---|
| K1 | Make the pass a real Apple Wallet pass | **Rejected for 037.** A `.pkpass` needs an Apple Developer certificate, server-side signing (a new Edge Function + secret) and a pass update service, which breaks R7. V2 backlog. Grain: the pass should look like it belongs in Wallet, which §6.2 already does. |
| K2 | Let Claude write each headline | **Rejected.** A call on every Home open costs money and time and fails offline on the course. It can't be tested or measured to a 20-character fit, and unreviewed trash talk about named friends is risky on a shared screen. If ever: generate once at finalize, cache it on the round, keep the ladder as fallback. Grain: the ladder's copy is dull, so fix the copy (change 4). |
| K3 | Permanent nudges, stacked three deep | **Rejected.** Three strips is a feed and breaks the edge cap and the budget; join requests and handicap reveals need new Home fetches. Grain: Invite really is hidden on Standings, hence change 6. |
| K4 | Drop the edge cap, show every card, let Home scroll | **Rejected.** It breaks R4 and turns Home into a list; the flex belongs in the Locker. Grain accepted: edges without text are confetti, so they carry the course (change 3). |
| K5 | A ghosted sample card with a made-up 82 | **Rejected.** A fake score on your own Home reads as yours and confuses a newcomer. Grain: the zero-card object must look desirable, so lay out a real finish (`lkf-rookie`). |
| K6 | One + at the top, no pinned foot | **Rejected.** Andrew picked the pinned buttons, and a + at the top is out of one-thumb reach on the course. Fuse's + belongs to a tab bar Home doesn't have. Grain: the foot is the budget's biggest cost, so measure it honestly (88 / 96). |
| K7 | The crew row names your rival and sits above the stack | **Copy accepted, position rejected.** "Sean is 1st" is buildable from `seasonRecordTable`; "3 back" is not (win-rate standings). It becomes rung 7's sentence or the crew row's line, below the stack: the stack is the hero. |
| K8 | On a round day Home is just Enter | **Rejected.** A live round's link already opens on Enter. Home on a round day is where you go on purpose for the other jobs (Join, New round, last week's card). Always opening Enter would hide Home all day and override Andrew's bar pick. |

## Needs Andrew's decision

1. **Full board on the card back (§15 #7):** the panel recommends folder 038 in this build. It touches the frozen 036
   card, so it's his call.
2. **Edges:** 48 px of real card versus a thin strip with a 48 px hit area. And should edges carry the course name at
   all, versus draft 3's "nothing added"? The panel says carry it. Ask for a prototype frame of each.
3. **Plain / member card finish:** paper (`lkf-rookie`) or Standard.
4. **Standings work in 037** (switcher, Invite, rename): accept the extra scope, or keep Invite and the crew switch on Home.
