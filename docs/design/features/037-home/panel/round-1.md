# 037 Home, second pass · Panel round 1

Plan reviewed: `docs/design/features/037-home/PLAN-v2.md` (draft 1, branch `claude/037-home` at 33007c6).
The panel had four critics and a Jester, each a separate reviewer. They gave independent critiques first (Round A),
then each critic read the other three and the Jester's provocations and gave a rebuttal and a final score (Round B).
This was a review only: no app code, database, preview or test suites were touched.
A 9 means "I would build this as written".

## Scores

| Panelist | Seat | Round A | Final |
|---|---|---|---|
| Editor | information architecture | 6 | **5** |
| Art Director | visual design + type | 5 | **4** |
| Golfer | user journey | 6 | **5** |
| Engineer | feasibility + states | 5 | **4** |
| **Mean** | | 5.5 | **4.5** |

All four agree the direction is right: one stack of real objects, detail behind a tap, How it finished off Home, and a
real object instead of the dashed box. Every score went down in Round B for three reasons:

- The Engineer measured the layout with the real CSS. It does not fit (R4).
- The onboarding name step has nowhere to go in the app's identity model (R7/R8).
- The "What leaves Home" table sends things to places that don't exist.

### Per requirement (final, condensed)

| Req | What the panel found |
|---|---|
| R1 one question | Mostly met by the headline. "WELCOME / Golf Board." tells a stranger nothing. |
| R2 status or door | Mostly met. The headline repeats the object under it on every rung. Older-card edges are a score list, and they aren't doors. |
| R3 hits at 0 / 1 card | The member card is the right idea. It is undesigned, and it has no data ("Since" doesn't exist) and no person to print for. |
| R4 fits, thumb | **Fails.** Card is 258 px (not 223), pack 266, two-line headline 72, foot about 96, and no gaps are counted. Safari 393 × 659 is about 110 px over on a *normal* day. Standalone 852 fits by about 15 px. Pack + pass overflows everywhere. |
| R5 design system | Six new patterns, none justified. No named `number-xl` hero. Tile number style unnamed. The 7:5 card and the 8.4:6.2 pack are mixed in one stack. |
| R6 round day | **Fails as written.** The live headline repeats the bar ("You're up 2." twice), and Join / New round are buried in the Locker, whose one-card view is `noscroll`. |
| R7 today's data | No DB change is needed, **but** "Since" has no source, "6 of 8 in" needs a new `lobby_counts` fetch, and the typed onboarding name has no personId (touches identity / joining). |
| R8 whole group | No crew, unranked, two crews, several coming rounds, the `removed` pass and a failing locker are all unspecified. |
| R9 true size | Not met: an ASCII diagram, measured against the wrong viewport (759 instead of the fit size 659 / 681). |

## Consensus required changes (ordered)

1. **Re-budget the screen at 393 × 659 and 402 × 681 (Safari) and 393 × 852 (standalone)** with the real sizes: card 258,
   pack 266, title 36 per line, top bar + status bar, foot 88–110, and gaps.
   - The front object's width is set by the height left over: `min(full width, leftover × 7/5)`, with a minimum width.
   - **At most two edges in total, of any kind**, the member card's edge included.
   - The headline is one line in Safari.
   - One table per situation.
2. **Onboarding goes code first; drop the typed-name step.**
   - The owner and the member card come only from a roster or crew pick that has a personId. Nothing changes in `joinPlan`.
   - A name is asked only on the Start-a-round path, through `person_name_check`.
   - A phone with no person gets an **unissued card**: a dashed 7:5 outline, "Your card prints after your first round".
   - Write out the link-arrival path step by step: Safari's **Open Golf Board** handoff → the round → back to Home → the
     card deals in → Add to Home Screen.
3. **Rewrite the headline ladder so no rung repeats a fact visible below it** (card, pass, tile or bar).
   - Order: Live → Today / within 48 h → Needs you (not joined, handicap invite, join request, Add to Home Screen) →
     Pack → Coming up → Last out → Quiet week → Welcome.
   - The "Last out" rung uses the game result, `recent.result.line` ("Won with Sean", "3rd, 1½ back"), with gross as the
     fallback. "Your normal" only when `card.line` exists, which is never in the first rounds.
   - Quiet week = the crew season line ("2nd in Founders, 1½ back"). Then the crew status must not say it again.
   - Welcome says what the app is ("Live scores for your group's round.").
   - Write the exact text for Nov 20 and for a dull week.
   - Put the date in the kicker or on the card, not both.
4. **Round day: the bottom bar is the only live element.**
   - The headline does not repeat the bar's score line.
   - **Join with code and New round stay one tap away on Home**, as two small rows under the bar (as today,
     `home.js:106-111`). Never inside the Locker.
5. **Stack rules.**
   - A pass due within 48 h goes in front of a waiting pack; the pack becomes a NEW PACK chip. (Andrew to confirm: see
     below.)
   - Edges show **opened cards only, course name only, no score**. A pack never shows a score, because that spoils the rip.
   - Every visible edge opens its own object. The plan's "tap anywhere else → Locker" goes.
   - The member card is drawn only when there are no scorecards.
   - The pack's tap goes to `lk-home-packs` (the packs view), not "the tear". Say so.
6. **Specify the pass fully.**
   - States: coming; called off, keeping its **Text host** button (`home.js` `comingCard`); `removed` (your spot was
     given away, `lobby.js:339`); several coming rounds, soonest in front.
   - The organizer's own pass gets **Share link**.
   - Data: add `startTime` and the player count to `homeCard` (a pure change). Call `lobby_counts` only for the front
     pass, at most once a minute, stored on the recent entry. Hide the "N in" line if the call fails.
   - Fix the hard-coded "Team Ryder Cup" wording (`home.js:47`, `lobby.js:346`).
7. **Make the member card buildable.**
   - Content: name, crew (`db.crews.current()`, left out with no crew), and "First round Oct 2026" from the earliest
     locker row or the round count.
   - No "Since", and no member number by join order: `joined_at` isn't returned anywhere, and the founders were all
     backfilled the same day.
   - Draw it at 7:5 in an existing finish (`lkf-standard`), with no score marks.
8. **Tiles become at most one crew status row.**
   - The Passport tile goes: the avatar already opens the Passport, and the count rarely changes.
   - The crew row is a `label` kicker plus a mono `title` place.
   - It hides when the number is zero, unranked with nothing to say, or already in the headline.
   - No ‹ › switcher: Standings switches crews.
   - Crew comes from `db.crews.all()`, which already includes every crew this phone has played a round in
     (`db.js:181-183`). Only the name waits for `loadCrew`.
9. **Fix the landings in "What leaves Home".**
   - Keep `#/rounds` with its own door from Home. The Locker is not All rounds: `personRounds` drops practice, partial
     and watched rounds (`locker.js:77-88`).
   - "Full board ›" on the card back, done as a **new numbered folder** because 036 is frozen. Without it, the result
     has no way back to the Board.
   - **Add to Home Screen stays on Home in iPhone Safari.** It carries the move link, and `smoke.mjs:1393-1447` expects
     `home-add`.
   - What's new keeps its in-place line (`newsLine`, `home.js:127`). As a sheet on open it collides with `open-app`,
     the pack overlay, coach tips and `checkVersion`.
   - If Invite and crew settings leave Home, they must be built on Standings (`season.js` has neither).
10. **Write a state table.** One row per situation, with headline / kicker / front object / edges / crew row / bar / doors
    at both heights. The situations:
    - zero cards, one card, normal day
    - pack, pass within 48 h, pack + pass, several packs, several passes
    - live
    - called off, removed
    - locker loading: a skeleton at the same height, no reflow, no second deal
    - locker failed or offline: headline from `glb.recent`, no Passport number, member or unissued card only
    - crew loading, no crew, unranked, two crews
11. **One type hierarchy per state.** The front object's score is the one `number-xl` hero, the headline is `title`,
    and the crew row is `label` + mono `title`.
    - Light theme: only the front object gets a shadow, edges get a 1 px `--m-edge` line, and the pass and crew row use
      `shadow-card`.
12. **True-size mock-ups, dark and light, each with its tap map:** brand new, zero cards, one card, normal day,
    pack + pass, live, the organizer the night before, two crews.
13. **Paperwork.**
    - A patterns table that justifies each new pattern against an existing component (stack, edge, pass, member /
      unissued card, headline ladder) and cuts the ones it can't.
    - An update list:
      - the `home037` tests (§3.3, caption, endRows, crew kicker)
      - `smoke037` check 3
      - the smoke Add to Home Screen checks
      - screen-map
      - `topKey` kinds (`pass:`, `member`)
      - RELEASES copy
    - `smoke037` before merging, since `lobby_counts` and the identity flow touch joining.

## Open disagreements between panelists

- **What's in front while a round is live.**
  - Golfer: the live round as a pass-style ticket that taps back to the hole, because otherwise the biggest tap target
    mid-round leads away from the round.
  - Editor and Art Director: no. It puts the live round on screen twice, and the bar is the only lit thing.
  - Engineer: feasible from `recent.live`, but it conflicts with the bar Andrew picked.
  - → Andrew.
- **The headline after a round.**
  - Editor (Round A): personal, "3 better than your normal".
  - Golfer and Engineer: the game result line first. "Normal" breaks for anyone with fewer than about 5 rounds and
    misses points games.
  - The Editor moved toward the result line in Round B.
  - → Andrew (tone for the group).
- **The Home face of the card.**
  - Art Director: prototype 5's card art (already approved) is the Home face, so name it as the spec.
  - Engineer: reuse 036's `frontHtml` at full size and don't invent a second face to keep in sync.
  - Unresolved; the author should pick one and justify it.
- **Crew row or nothing.**
  - Art Director: keep one row, for rhythm under the stack.
  - Editor: one row only if the headline doesn't already carry the season line, otherwise nothing.
  - Engineer: one 64 px row, or fold it into the headline.
- **Invite.**
  - Golfer: on the crew row for the owner.
  - Editor: a one-time headline rung for a small crew, plus a button on Standings.
  - Engineer: anyone can invite already (`_crew_card.code`), so limiting it to the owner is a product choice.
  - → Andrew.
- **The member card's one fact.**
  - Art Director wanted a bag-tag number. The Engineer showed join order has no data.
  - The panel settled on the round count or "First round <month>". The Art Director's final list still says bag-tag.
- **Older edges.**
  - Editor (Round A): cut them.
  - Art Director: keep them, course only. They are the visual idea.
  - Settled: keep them, course only, at most two, each a door.

## The Jester's provocations and the panel's answers

| # | Provocation | Panel's answer |
|---|---|---|
| J1 | Put How it finished back, as the hero | **Grain accepted, table rejected.** Who won is the group's question, so the "Last out" headline uses `recent.result.line` ("Won with Sean", "3rd of 8 · Sean took it"). A top-3 table is detail, and the Board keeps it. |
| J2 | Swap the stack for a crew activity feed | **Rejected.** A feed is a list, which is what Andrew asked to remove, and no cross-person events are stored (`card_opens` is per person, stamps are derived), so it breaks R7. Grain: the quiet week is dull. Fix it with the crew season rung, not a feed. |
| J3 | Add streaks and XP | **Rejected for this plan.** It is a new system with new data and patterns, so it belongs in the backlog. The locker's `normalLine` already gives a sense of progress. Andrew can decide if he wants it as a product idea. |
| J4 | Cut the card from Home | **Rejected.** Andrew picked "your card first" on Nov 25, and it is the only thing on Home that hits visually. Grain: a thinner copy looks cheap, so the Home face must be the approved prototype 5 art or 036's own `frontHtml`, not a stripped 036 face. |
| J5 | Let people swipe the stack | **Rejected, grain accepted.** A fan invites a flick, so don't draw a fan: at most two plain edges, each tapping open its own card. Swipes fight the pack's tear and Safari's page scroll, and the design system keeps swipes for Setup back and closing sheets. |
| J6 | Make the member card a full club membership | **Rejected.** There's no home course or bag-tag data, handicaps are behind a flag that's off, and a QR repeats the join code. Grain: the card needs one fact. Use the round count or "First round Oct 2026". |
| J7 | Onboarding should ask for a code first, or skip it | **Accepted by all four.** The roster pick is the only thing that sets the owner and personId. Code first, no typed-name step, an unissued card until the first pick. |
| J8 | "One question" is a slogan; go full bento | **Rejected.** Six tiles is the list problem again as a grid: six heroes at 32 px, six fetches and six fallbacks, and the 659 budget can't hold it. Andrew said he's lukewarm on bento. Grain: the plan's references were unseen, so each state needs an exact answer (the state table), and Andrew should send the screenshots. |

## Needs Andrew's decision, not the author's

1. **The headline after a round:** the group result ("Won with Sean" / "3rd, Sean took it") or your own score or normal.
2. **While a round is live:** the bottom bar alone (his Nov 25 pick), or also a live pass in front of the stack.
3. **The morning of a round:** does a pass due within 48 h always go in front of a waiting pack? (The panel recommends yes.)
4. **Under the stack:** one crew status row, or nothing (he's lukewarm on bento).
5. **Invite:** stays on Home, and for everyone or only the crew owner, or moves to Standings. It's a crew-growth trade-off.
6. **Onboarding:** drop the name step (the panel recommends this), or accept a new person-create RPC (a DB change) plus
   identity work on the join path. Also: should a brand-new phone with no round get any onboarding beyond the unissued
   card and a code field?
7. **A "Full board ›" link on the 036 card back.** It changes a feature that has already been handed off, so it needs a
   new folder.
8. **Does the member card exist at all**, now that "Since" has no source? The alternative is the unissued card until the
   first pack.
9. **Send the references:** screenshots of the Fuse, Apple Wallet and Focus Flight pages and the two Instagram reels.
   No panelist saw them, and the plan's §2 lessons are guesses until he does.
