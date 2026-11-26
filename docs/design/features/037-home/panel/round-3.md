# 037 Home, second pass · Panel round 3

**Plan reviewed:** `docs/design/features/037-home/PLAN-v2.md` draft 4, a full rewrite (branch `claude/037-home`,
commit af5eb18).

**Panel:** the same four critics plus the Jester. Round A was each critic's own critique; Round B was a rebuttal after
reading the others. The critics checked §16's claims for round 2's ten changes against the plan text and the code, and
re-did §4.1 against the real CSS.

**How R9 was scored:** on whether §14's frame list is the right and complete brief for the prototype session. The frames
themselves are not expected yet.

**§15 items** were scored as the author's defaults. Review only: no app code, database, preview or test suites were
touched. A 9 means "I would build this as written".

## Scores

| Panelist | R1 final | R2 final | R3 A | **R3 final** |
|---|---|---|---|---|
| Editor | 5 | 6 | 8 | **8** |
| Art Director | 4 | 6 | 8 | **8** |
| Golfer | 5 | 7 | 8 | **8** |
| Engineer | 4 | 7 | 8 | **8** |
| **Mean** | 4.5 | 6.5 | 8.0 | **8.0** |

**All four critics say the same thing: draft 4 is one round of paste-in edits from a 9.**
- Tap targets are all ≥ 48.
- §13.1 uses only existing tokens.
- Edges are identifiable.
- The pass is laid out.
- The crew controls are costed on Standings.
- 038 is built alongside.
- No DB change.

Three defects hold it at 8: one wrong claim in the budget, a headline rule that leaves fragments, and rung 4's logic.
Every edit needed is written out below, ready for the author to paste in.

### Per requirement (final, condensed)

| Req | Finding |
|---|---|
| R1 | Met. One question; every rung is a fact; "Your group's live scores" works cold. |
| R2 | Met, with one exception: "You \| lead." repeats the crew row's "1st". |
| R3 | Met. `lkf-rookie` exists. The pass is in front for a friend with no card. Two notes: in light theme the paper fades into the background, and paper is also the finish of a player's first three real cards. |
| R4 | **Not quite.** §4 claims "`.home` has no bottom padding of its own". It does: it renders inside `.plain`, which adds 32 px (`styles.css:170`; `.home` resets only the top, `styles.css:1307`). Every §4.1 row is 32 px short, and a normal day at 659 is really 686. With `padding-bottom: 0` written in as a change, the arithmetic holds except three numbers (below). |
| R5 | Met. One snag: the plan names `.lc-pts` as the pass day / crew place style, and that class is green (`styles.css:1330`). |
| R6 | Met. The bar is the only live element, the headline names the round, and Join / New round are 48 px under the bar. |
| R7 | Met: no DB change. Two corrections: the game name must be `gameName(compute(event, []))`, because `playfor.js:16-25` reads `snap.game`; and "Rider Cup" isn't a `gameName` output. |
| R8 | **Not quite.** Rung 4 fires for the wrong people. Rungs 2 and 3 have no date limit. The offline-with-cards check reads the wrong key. A known person with zero cards sees two join doors. |
| R9 | The frame list is right in shape but missing about eight frames (below). |

## Round 2's ten changes: final verdict

| # | Change | Verdict | What's left |
|---|---|---|---|
| 1 | Taps ≥ 48, press 0.97, tokens | **Satisfied** | none |
| 2 | Real-CSS budget, measured fit | **Partly** | Padding claim false (it must be specified as a change). Pack at 402 = **621**, not 614 (pack 370 × 6.2/8.4 = 273). Join field = **92**, not 76 (20 + 8 + 52 + 12, `styles.css:1343-1344`). Missing row: zero cards + pass + nudge at 659 = 678. No floor for a pass. |
| 3 | Edges show the course, no score | **Satisfied** | Say the strip is *drawn* (the finish's `.lk-mat` + its own label row), never a clipped `frontHtml`: that top line is 8.7 px brand text (`locker.css:133`). |
| 4 | Ladder copy as facts, bright = fact | **Partly** | "Drop the grey half" leaves fragments: "Your spot", "Open", "Riding", "No finished", "Your group's". |
| 5 | Rung order, rung 4 conditions, `finishUnits` | **Partly** | Order and `finishUnits` are right (`homeview.js:46-87`). **Rung 4 is inverted**, and rungs 2 and 3 have no date limit. |
| 6 | Crew row + Standings controls | **Satisfied** | `crew-pick` only sets `glb.crew` (`crew.js:290-294`); on Standings it must also route to `#/season/<newId>`. |
| 7 | The pass | **Satisfied** | Day style in `--text`, not `.lc-pts`. Badge: fill `--button`, text `--on-button` (the plan has it backwards). |
| 8 | Nudge as its own strip | **Satisfied** | Placement: see change 6 below. |
| 9 | Plain card | **Satisfied** | Light-theme outline; state the Rookie collision. |
| 10 | States, paperwork, frames, smoke | **Partly** | `glb.seen.homeCards`, old `recent.lobby` entries, §13.2 gaps, frames. |

## Required changes for a 9 (consensus, paste-ready)

**1. §4, replace the line "`.home` has no bottom padding of its own…" with:**

> `.home` sets `padding-bottom: 0`: it renders inside `.plain`, whose 32 px bottom padding (styles.css:170) would
> otherwise sit under the pinned foot. This is a one-line CSS change in the 037 block. The measured fit never takes a
> pass below 336 wide (240 high, its content's height). If a pass can't get that, edges drop to 0 first, then the doors
> row hides.

**In §4.1:**
- Correct the 402 × 681 pack row to **621** and the join field to **92**.
- Add the row "**Zero cards + pass + nudge, 393 × 659: doors row hidden → 630**". This is the most common first Home: a
  friend in iPhone Safari.
- Add the rule "**The doors row is hidden while the nudge shows.**" All rounds is empty for a new friend, and Add to Home
  Screen is already in the nudge.

**2. §5, cut rung 4** (Golfer's Fix A, verbatim):

> 4. *(cut)* A round you're on the roster of but haven't opened on this phone needs no rung: its pass is in the stack
> with **Open**. Home can't tell an unopened round from one claimed on your other device (synced entries, `db.js:356`),
> or a taken spot from a watched round, so it says nothing it can't know. §11 "On the roster, not opened here" →
> headline 5 or 7, front = the pass.

Also remove rung 4 from §13.2 and §14.

Why: `synced: true` exists only on entries `syncMyRounds` added and this phone never opened (`db.js:356`), and
`remember` drops it on open (`db.js:220-230`). So draft 4's "not synced" condition fires only for a taken spot or a
deliberate watch. The inverted condition would still misfire for a round claimed in Safari and then synced into the home
screen app. The move link shares `glb.device` but not `glb.recent` / `glb.me.*`, so Home can't know the claim without a
server read.

**3. §5, replace the bullet "Rungs 2 and 3 sort before…" with** (Golfer's Fix B):

> - **Rungs 2 and 3 apply only to the front pass** (the round §6 puts in front). A removed or called-off round further
>   out shows only on its own pass (badge + Text host) and never takes the headline from a nearer round or a pack.
>   Either way it never reads "you tee off".

**4. §4.1 rule 3 and §5, one copy table replacing "the grey half is dropped".** The base is the Editor's merged table.
Add the rule:

> Each rung has a written Safari form, a complete sentence of ≤ 20 characters at title 32 / 800, chosen when the
> two-tone sentence doesn't fit one measured line. A bright half is never shown alone unless it is a complete sentence.
> A sentence with no `|` is all bright and is never cut.

| # | Kicker | App (two-tone) | Safari |
|---|---|---|---|
| 1 | `ON THE COURSE` | "`<gameName>` \| at `<course>`." | "`<gameName>`." |
| 2 | `NEEDS YOU · SAT` | "Sean has your spot." | same |
| 3 | `CALLED OFF` | "Saturday is off." | same |
| 4 | *(cut)* | | |
| 5 | `NEXT ROUND` | "Riding with Sean." · for a phone not on the roster (watcher, organizer not playing) on rungs 5 and 7: "8 players in." | same; with a long first name, "Riding with Chris." |
| 6 / 8 / 10 | `NEW PACK` / `LAST OUT` / `LAST OUT · 3 WEEKS AGO` | "Won \| with Sean." / "2nd of 5." / "Low round \| of 5." | "Won." / "2nd of 5." / "Low round." |
| 9 | crew name | "Sean leads." · when you lead: "Sean is next." | same |
| 11 | `GOLF BOARD` | "No rounds finished." | same |
| 12 | `GOLF BOARD` | "Live scores \| for your group." | "Live scores." |

Notes on the table:
- `<gameName>` is a real output of `gameName(compute(event, []))` computed in `homeCard`: 2v2, Stroke play, Everyone
  alone, Team Ryder Cup… (`playfor.js:29-32`). Not "Rider Cup".
- Rung 2 says "has", not "took": the host gave the spot away, not Sean.
- No action goes in a grey half. "Text Justin." repeats the pass's own button.

**5. Type, in §6.2 and §7:**
- Replace "(`.lc-pts`)" with "**mono 32/36/700, −1px, `--text`**".
- Badge: "fill `--button`, text `--on-button`".

**6. Nudge and What's new, in §4.2:**

> The nudge strip sits directly under the top bar, above the headline, so the headline stays on the object it
> captions.

What's new on tap: see the open disagreements below.

**7. States, in §6.4 and §11:**
- §6.4: "**Whenever the join field is on the page, the foot is New round only.**"
- §11: "Offline / locker failed *with cards* is decided by `glb.seen.homeCards` (set true whenever the locker loads with
  any card; a `glb.seen.*` key, so it moves with the move link), not `glb.seen.homeTop`, which holds the last front
  object (`home.js:255-259`) and reads `pass:CODE` when a pass is in front."
- §11: "Old `recent.lobby` entries missing the new pass fields fall back to `recent.course` / `played_on`; empty cells
  hide."
- §6.1: "The edge strip is drawn (the finish's `.lk-mat` + its own label row), never a clipped `frontHtml`."
- §6.3: in light theme, the plain card gets `--shadow-float` plus a 1 px `--line` outline.
- Standings: `crew-pick` also routes to `#/season/<newId>`.

**8. Paperwork and frames.**

§13.2 adds:
- `tests/lobby025.test.mjs:179-187` (`homeCard` gains fields; the not-on-roster line wording)
- `tests/returning037.test.mjs:29-30` (What's new skips anyone whose first round is after the release)
- folder 038's own SPEC, plus a test that the card back's link doesn't flip the card
- `glb.seen.homeCards` in CLAUDE.md's key list
- `smoke037` before merging

§14 adds these frames:
- At 393 × 659:
  - zero cards + pass + nudge
  - a pass in front at the fit
  - a round live (the sunlight case; friends mostly use Safari)
  - offline with cards
- Removed pass and called-off pass
- A watcher's pass ("8 players in.")
- A long first name on rung 5
- One 402 × 681 frame
- The plain card in light theme
- The What's new state

## Open disagreements

- **Rung 4: cut (3) vs keep a fixed version (1).**
  - Editor, Art Director and Engineer: cut. The Engineer conceded, and the Editor withdrew "Claim your spot.".
  - Golfer, in Round B: keep it with the condition corrected (`synced === true`, `onRoster`, no `glb.me.CODE`, not
    host), kicker `YOU'RE IN`, sentence "`<Host>` added you.". That is true on every device and states the one fact the
    pass doesn't.
  - The Engineer's two-device case still applies: the rung would show for someone who already joined in Safari.
  - The panel's position is **cut**. The Golfer's version is a reasonable alternative if Andrew wants an "added you"
    moment.
- **What's new on tap.**
  - Editor, Art Director, Golfer: a tap opens a sheet. A sheet the user opens collides with nothing, and it keeps the
    fit.
  - Engineer: keep it in place. One `app.sheet` still competes with `open-app`, the pack overlay and `checkVersion`.
    Budget only the resting state and let a user-started expansion scroll.
  - Not settled; the author should pick one and say how it avoids the collision.
- **Rung 9 when you lead.**
  - Golfer, Art Director, Engineer: "Sean is next."
  - Editor: skip to rung 10.
  - The table follows the majority.
- **The 48 px edge strip vs the 32 px alternative (§15 #6).** The Golfer prefers 48. The others leave it to Andrew. The
  budget already assumes 48, so the 32 version needs no new arithmetic.

## §15 defaults

None is wrong. Two additions:
- **#7 (paper plain card):** add "Rookie is also the finish of your first three real cards, so the plain card and your
  first card will look alike." Andrew should choose knowing that. The panel thinks the continuity is arguably a feature.
- **New item for Andrew: Share link on every pass, or the organizer's only (Jester L6).** Golfer, Editor and Engineer
  would put it on every pass: the link is harmless, because joining still needs approval, and the pass is Home's growth
  door. The Art Director calls it Andrew's decision. Two 48 px buttons fit under the tear.

## The Jester's round-3 provocations and the panel's answers

| # | Provocation | Panel's answer |
|---|---|---|
| L1 | Cut the headline: Wallet has none | **Rejected.** Rungs 2, 3 and 6/8 carry facts no object shows (your spot was given away, the result). Grain: 12 rungs is a lot. Cutting rung 4 leaves 11, and the 84 px is reclaimed by the padding fix, not by cutting the headline. |
| L2 | Add to Home Screen as a full-screen gate in Safari | **Rejected.** It would fire right after the first pick, often on the first tee, and it collides with the `open-app` handoff and the 025 "Join in Safari for now" path. `syncMyRounds` already answers "where did my rounds go". The nudge comes first, then lives in the doors row. |
| L3 | A free sealed "Member" welcome pack | **Rejected.** A pack means a finished 18. `open_card` keys on an event, so this needs a DB change or a fake local pack, and a pack with nothing in it teaches people packs are empty. The paper card is honest. |
| L4 | Order edges by rarity | **Rejected.** Feasible (a sort on `card.fin`), but edges are doors to *recent* things. Rarity order would break "newest behind front" and the LAST OUT headline. The flex belongs to the Locker. |
| L5 | Front card opens the Board, so 038 isn't needed | **Rejected.** The same card would mean two things (Board on Home, flip in the Locker), and Home would lose its door to the Locker. 038's link on the card back gives both. |
| L6 | Share link on every pass | **Accepted by three critics, Andrew to confirm.** No DB change, the link is harmless (approval gates joining), and the pass is now Home's growth door. |
| L7 | Doors row becomes a grey "All rounds" edge | **Rejected.** It's a door dressed as an object: it breaks "every edge is a real thing", counts against Safari's 0–1 edge cap, and would usually be hidden. |
| L8 | Guilt-trip rung 10: "21 days \| since you last played." | **Rejected.** It's the wrong tone for a friend group, and a counter that keeps rising nags. "LAST OUT · 3 WEEKS AGO" already states the gap; the result is the better sentence. |
