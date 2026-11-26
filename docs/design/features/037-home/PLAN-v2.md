# 037 · Home, second pass: the plan (draft 2, Nov 26)

Status: **draft for the panel, round 2.** Not approved, not built. Replaces the Home in `SPEC.md` (built on this branch,
on the preview) if Andrew approves a prototype made from it. Draft 1 scored 5 / 4 / 5 / 4 (`panel/round-1.md` on branch
`claude/037-panel`); §12 says what changed for each of the panel's 13 required changes.

## 1. Why a second pass

Andrew, after using the first build on the preview (Nov 25):

> "How it finished is going against 'each screen serves one purpose and answers one question'. … this is info found
> deeper in the user journey and not high-yield, high-level info that would typically be associated with a home screen."

Also from him: likes what **Fuse**, **Apple Wallet** and **Focus Flight** do; not in love with bento boxes ("good when
used in the right spot"); fine if it drifts toward a finance-app look; "even without a card it still needs to hit
visually"; mock-ups must be shown **on a phone screen**; an onboarding flow for new users is welcome.

## 2. References — still unseen

The Mobbin pages and both Instagram reels could not be opened from the build environment. Andrew has a prompt for a
local session that will save screenshots and notes to `docs/design/features/037-home/references/`. Until that lands,
the three lessons below are from general knowledge of those apps and are **hypotheses**:

- **Apple Wallet:** Home is one stack of real objects; detail appears only after you pick one; passes share the stack.
- **Fuse:** one large confident sentence; very few words; a number is a status, not a feature tile.
- **Focus Flight:** one metaphor on every screen; the empty state is still an object.

Nothing in this plan depends on a detail of those apps that would be embarrassing if wrong.

## 3. The one question

**"What's my golf right now?"** Everything on Home is a **status** (one glance) or a **door** (one tap deeper).
No lists, no tables, no detail. No element repeats a fact another element on the screen already shows.

## 4. The screen

Top to bottom. Heights are the real ones (card 7:5 at 361 wide = 258; pack 266; title line 36).

| # | Block | Height | What it is |
|---|---|---|---|
| 1 | Top bar | 48 | unchanged: avatar → Passport, name → `home-me`, theme |
| 2 | What's new line | 44, only when there is news | unchanged from the first build (`newsLine`, in place) |
| 3 | Headline | 80 (one line) / 116 (two) | kicker (`ts-label`) + one sentence (`ts-title`) |
| 4 | The stack | edges 28 each + front 258 (pack 266) | §6 |
| 5 | Crew row | 64 + 12 gap, or absent | §7 |
| 6 | Doors row | 44 | text doors: All rounds · Start a crew (no crew only) · Add to Home Screen (iPhone Safari only) |
| 7 | Pinned foot | 96 (130 standalone) / 156 live | Join with code + New round, or the live bar (§8) |

### 4.1 The budget (R4)

Three sizes: Safari **393 × 659**, Safari **402 × 681**, home screen app **393 × 852** (59 status bar, 34 home line).
Rules that make it fit, in the order they give way:

1. The headline is **one line in Safari** (copy is written to fit; it may wrap to two only in the home screen app).
2. **Edges yield first.** Home screen app: up to 2 edges. Safari: 1 edge. With the What's new line showing: 0 edges.
3. **While a round is live the crew row is hidden** (you're playing; the foot is taller).
4. The front object's width is `min(361, leftover × 7 / 5)`, never under 300. If even that doesn't fit, the page scrolls
   (not expected at these three sizes).

| Situation | 659 Safari | 681 Safari | 852 app |
|---|---|---|---|
| Normal day (1 edge Safari / 2 app) | 48+80+286+76+44+96 = **630** | 630 | 59+48+116+314+76+44+130 = **787** |
| Pack in front (266) | 638 | 638 | 795 |
| Pass in front + pack edge | 630 | 630 | 787 |
| What's new showing (0 edges) | 48+44+80+258+76+44+96 = **646** | 646 | 831 (2 edges) |
| Round live (no crew row, foot 156) | 48+80+286+44+156 = **614** | 614 | 59+48+116+314+44+190 = **771** |
| Zero cards (plain card, 0 edges) | 602 | 602 | 731 |
| No crew (no crew row) | 554 | 554 | 711 |

Every row fits with at least 13 px spare. The fit test (`npm run test:fit`, on request) gets these as scenes.

## 5. The headline ladder

Kicker + one sentence. Pure function, first match wins. **Rule: the sentence never repeats what the front object, the
crew row or the bar shows** (so it never says the course, the date or the score when a card or pass is in front).

| # | When | Kicker | Sentence | Tap |
|---|---|---|---|---|
| 1 | a round is live | `ON THE COURSE` | "Good luck out there." (first 3 holes) / "Keep it going." | none (the bar is the door) |
| 2 | a pass is due within 48 h | `NEXT ROUND` | "You tee off tomorrow." / "You tee off today." | none (the pass is the door) |
| 3 | a pass needs you | `NEEDS YOU` | "You haven't joined Saturday yet." / "Justin gave your spot to Sean." | the round |
| 4 | a pack is waiting | `NEW PACK` | "Your card is sealed." | none (the pack is the door) |
| 5 | a round is coming up (≤ 14 days) | `NEXT ROUND` | "Nine days out." | none |
| 6 | your last round was ≤ 7 days ago | `LAST OUT` | the game result from `recent.result.line` without the score: "Won with Sean." / "3rd, 1½ back." Scorecard round: "Low round of 5." / "2nd of 5." | none |
| 7 | you're ranked in a crew season | the crew's name | "2nd in the standings." (then the crew row is hidden) | Standings |
| 8 | you have rounds, nothing else to say | `GOLF BOARD` | "Nothing on the books." | none |
| 9 | no rounds on this phone | `GOLF BOARD` | "Live scores for your group's round." | none |

Rung 3 uses only what Home already stores per round (`recent.lobby.kind === 'removed'`, a lobby round with no
`lobbyPid`). Join requests, handicap invites and Add to Home Screen are **not** rungs: they'd need new fetches on Home
(R7) or would nag.

Exact text for Andrew's real days: **Fri Nov 20 evening** (pack waiting) → `NEW PACK` "Your card is sealed."
**Sat Nov 21** (opened) → `LAST OUT` "Low round of 5." **Mon Nov 30, a dull week** → `FOUNDERS CREW` "2nd in the
standings." (his real place, computed), crew row hidden.

## 6. The stack

One stack of real objects. **One front object, at most two edges.**

**Front object** (first match): a pass due within 48 h → a pack → a later pass → your latest scorecard → the plain
card (§6.3).

**Edges** (28 px strips showing the top of an object behind the front one), in this order until the limit: another
pass (soonest first) → the pack (`1 PACK TO OPEN`, never a score or course result) → opened scorecards, newest first
(**course name only, no score**). The plain card is never an edge.

**Every visible object is its own door.** There is no "tap elsewhere" target.

| Object | Tap goes to |
|---|---|
| Scorecard (front or edge) | `#/locker` opened on that card (`app.ui.lk.key`, one-card view) |
| Pack (front or edge) | `lk-home-packs` (the packs view, where the tear happens) |
| Pass (front or edge) | `#/e/CODE` (its lobby) |
| Plain card, person known | `#/passport` |
| Plain card, no person | nothing; the code field under it is the action |

No swiping and no re-ordering on Home. Two plain edges, not a fan, so nothing invites a flick.

### 6.1 The scorecard on Home

**Decision: the real 036 front (`frontHtml`) at full width, with the crew line as the first build draws it.** The
panel split between this and prototype 5's simpler art. Reasons: Wallet's lesson is that the stack holds the *real*
object; one face means nothing to keep in sync with the Locker and the share image; it is already built and on the
preview, where Andrew has not objected to it. Its score is the screen's one `number-xl`-scale hero.

### 6.2 The pass

Not a new component: the existing Coming up card's content (`comingCard`, `.card.lb-card`) laid out in the same 7:5 box
as a scorecard, so the stack keeps one shape.

- **Coming:** kicker "SAT, DEC 5 · TWIN CREEKS", the round's name, the existing one-line state (`homeCard().line`),
  button **Open**. Add the start time to the kicker when the lobby has one (`startTime` added to `homeCard`'s result,
  a pure change).
- **Organizer's own pass:** **Open** + **Share link** side by side (the existing share action).
- **Called off:** kicker "CALLED OFF · WAS SAT, DEC 5", greyed, button **Text Justin** (`home-text`, as today).
- **Removed** (your spot was given away): the existing line "Justin gave your spot to Sean.", button **Text Justin**.
- **Several coming rounds:** soonest in front, the next one an edge.
- Fix the hard-coded "Team Ryder Cup · N players" (`lobby.js` `homeCard`) to use the round's game name.
- **No "6 of 8 in" count.** It would need a `lobby_counts` call from Home; the organizer sees it one tap away in the
  lobby. Cutting it keeps Home off the joining path entirely (R7).

### 6.3 The plain card (no scorecard yet)

One object, an existing finish (`lkf-standard`, 7:5, the mark), two states. It is drawn **only when there are no
scorecards and no pack**; it is never an edge.

- **Member card** (the phone knows the person: an owner or a roster pick with a personId): their name, their crew
  (`db.crews.current()`; left out with no crew), and one fact, "FIRST ROUND · NOV 2026" from the earliest round this
  phone has for them (`glb.recent`), or "NO ROUNDS YET". No "Since", no member number: neither has a data source.
- **Blank card** (no person): the same object with no name and one line, "Your card prints after your first round."

Why an object and not the panel's dashed outline: Andrew's "even without a card it still needs to hit visually". It
costs nothing new (same finish, same box), and the dashed outline is exactly what he saw and rejected.

## 7. Under the stack: one crew row, or nothing

No tiles. One 64 px row (`.home-row`): the crew's name as a `ts-label` kicker over "Standings", your place on the right
in the existing mono 32/36 number style (`.lc-pts`), chevron. → `#/season/<id>`.

- Ranked: "2nd". Not ranked yet: "1 of 3 rounds" (the real `MIN_ROUNDS`). No rounds in the crew: row hidden.
- Hidden when the headline is rung 7 (it already says it), while a round is live, and with no crew.
- Two crews: the row shows the current crew (`db.crews.current()`); switching happens on Standings, which already has
  the switcher. The crew list is `db.crews.all()` (already includes every crew this phone has played in); only the name
  waits for `loadCrew`, and the row's height never changes while it loads.
- No Passport tile: the avatar already opens the Passport and the count rarely changes.

**Invite, crew settings (⋯) and Name your crew move to the Standings screen**, built there as part of this feature with
the existing actions (`crew-invite`, `crew-settings`, the rename route). Anyone in the crew can invite, as today.

## 8. The foot, and a round day (R6)

- Normal: Join with code (`home-joinsheet`) + New round, pinned, as today.
- **Live:** the pinned foot is the green live bar (`LIVE · HOLE 7`, the round's state line, **Back to hole 7**), the
  only thing on Home that glows, and under it **Join with code** and **New round** as two 44 px half-width buttons
  (same actions). They are never moved into the Locker.
- The headline (rung 1) says nothing the bar says. The stack is unchanged. The crew row is hidden.

## 9. What leaves Home, and where it really lands

| Leaves | Lands |
|---|---|
| How it finished | the round's Board: Home → All rounds → the round (a finished round opens on its Board). Unchanged screens. |
| "Your locker" row | the stack (each card is its own door) |
| Standings row | the crew row |
| Invite, ⋯, Name your crew | the Standings screen (built in this feature) |
| Recent rounds list | stays at `#/rounds` (first build), door in the doors row. The Locker is **not** All rounds (it drops practice, partial and watched rounds). |

**Stays on Home:** the What's new line, in place (a sheet on open would collide with `open-app`, the pack overlay,
coach tips and `checkVersion`); **Add to Home Screen** in iPhone Safari (`home-add`; it carries the move link).

Recommended follow-up, **not part of 037**: a "Full board ›" link on the 036 card back, as its own numbered folder
(036 is frozen), so the card leads straight to its round.

## 10. A new phone (the onboarding answer)

**No new screens and no typed-name step.** The app only knows a person through a roster or crew pick that carries a
personId (`joinPlan`, 024); a typed name would have nowhere to go without a new RPC and identity work. So onboarding is
the paths that already exist, ending on a Home that hits:

1. **Texted a round link, no app** (most friends): Safari opens the round → the existing "Who are you?" pick sets the
   owner → they play or watch. Going Home shows their **member card** dealing in, headline rung 2 or 5, and
   Add to Home Screen in the doors row.
2. **Texted a link, has the app:** the existing **Open Golf Board** hand-off → the round in the app.
3. **Opened cold, nothing stored:** headline rung 9 "Live scores for your group's round.", the **blank card**, the join
   code field in the page directly under it (`codeField`, `home-join`), Add to Home Screen, and one pinned
   **New round**. Starting a round asks for names in Setup, as today (`person_name_check`).

## 11. States (R8)

H = headline rung. Edges are for Safari / app.

| Situation | H | Front | Edges | Crew row | Foot |
|---|---|---|---|---|---|
| Normal day, 5 cards | 6, 7 or 8 | latest scorecard | 1 / 2 cards | shown (hidden on rung 7) | buttons |
| One card | 6–8 | that scorecard | 0 | shown if in a crew | buttons |
| Zero cards, person known | 2, 5 or 8 | member card | 0 | shown if in a crew with rounds | buttons |
| Brand-new phone | 9 | blank card + code field | 0 | hidden | New round only |
| Pack waiting | 4 | pack | 1 / 2 cards | shown | buttons |
| Several packs | 4 ("2 cards are sealed.") | newest pack + count pip | cards | shown | buttons |
| Pass within 48 h | 2 | pass | 1 / 2 cards | shown | buttons |
| Pass within 48 h + pack | 2 | pass | pack, then a card | shown | buttons |
| Later pass | 5 | pack if any, else the pass | per §6 | shown | buttons |
| Several passes | 2 or 5 | soonest | next pass, then pack / card | shown | buttons |
| Called off / removed | 3 for removed; else next rung | per §6 (the pass keeps its place) | per §6 | shown | buttons |
| Round live | 1 | whatever §6 gives (unchanged) | 1 / 2 | **hidden** | live bar + two small buttons |
| Organizer, night before | 2 | their pass with Open + Share link | 1 / 2 | shown | buttons |
| Locker loading | from `glb.recent` | the plain card's box, empty (no text), same 258 height | 0 | per crew data | buttons |
| Locker failed / offline | from `glb.recent` | member card (person known) or blank | 0 | name only, no number | buttons |
| Crew loading | any | any | any | stored name, number appears in place | any |
| No crew | any | any | any | hidden; "Start a crew" in the doors row | any |
| Two crews | any | any | any | current crew | any |
| 16-player round | 6 ("12th of 16.") | scorecard | per §6 | shown | buttons |
| Long names | — | card and row text truncate with an ellipsis; the headline never contains a name longer than a first name | | | |

**No reflow, one deal.** The front slot is always 258 high from the first paint. The deal (0.7 s) waits for the locker
or 1.5 s, whichever is first; if the locker arrives later the real object cross-fades into the same box. The deal never
plays twice. Reduced motion: no deal, no fade. `topKey` kinds become `card:CODE`, `pack:CODE`, `pass:CODE`, `member`,
`blank`.

**Type, one hierarchy:** the front object's score is the only `number-xl`-scale thing; the headline is `ts-title`;
kickers and edges are `ts-label`; the crew place is the existing mono 32. **Light theme:** only the front object has a
shadow (`--shadow-float`); edges get a 1 px line in their own `--m-edge`; the pass and crew row use `--shadow-card`.
**Standalone:** the foot sits inside the home line's safe area as today (`.standalone .nr-foot`).

## 12. What changed since draft 1 (the panel's 13)

| # | Required change | Done in |
|---|---|---|
| 1 | Re-budget at the real sizes | §4, §4.1 |
| 2 | Onboarding code first, no typed name, link path written out | §10, §6.3 (blank card is an object, not a dashed outline: reason given) |
| 3 | Headline ladder with no repeats, exact text | §5 |
| 4 | Round day: bar is the only live element, Join / New stay on Home | §8 |
| 5 | Stack rules (48 h pass before pack, edges course-only, every edge a door, pack → `lk-home-packs`) | §6 |
| 6 | Pass fully specified | §6.2 (the "N in" count is cut instead of fetched) |
| 7 | Member card buildable | §6.3 |
| 8 | At most one crew row | §7 |
| 9 | Fix the landings | §9 |
| 10 | State table | §11 |
| 11 | One type hierarchy, light theme | §11 |
| 12 | True-size mock-ups with tap maps | §14 (they are the prototype's job; this plan lists exactly which) |
| 13 | Patterns table and update list | §13 |

Panel disagreements the author settled: live day = bar only (Andrew's Nov 25 pick); headline after a round = the game
result; scorecard on Home = the real 036 front; crew = one row that hides when the headline carries it; Invite =
Standings, for everyone; member card fact = first-round month; edges kept, course only.

## 13. Patterns and paperwork (R5)

| Pattern | New? | Nearest existing thing | Why |
|---|---|---|---|
| Stack with edges | **new** | the `.lk-fan` thumbnail on the old Locker row | the whole idea: one object instead of a list |
| Pass | no | `.card.lb-card` (Coming up) | same content, in the card's box |
| Plain card (member / blank) | no | `lkf-standard` + the mark | existing finish, new words |
| Headline + kicker | no | `ts-title` + `ts-label` (Board, lobby) | the ladder is copy rules in the pure model |
| Crew row | no | `.home-row` + `.lc-pts` | — |
| Doors row | **small new** | `.btn.ghost` text buttons | three quiet doors in 44 px |

Cut from draft 1: the tiles, the ticket notch, the separate Home face, "Since", the Passport tile, the ‹ › switcher,
the What's new sheet, the "N in" count.

To update when built: `tests/home037.test.mjs` (ladder, stack order, edges per size, crew row rules);
`tests/smoke037.mjs` check 3 (already stale from the first build) and its What's new text; the smoke Add to Home Screen
checks keep working (`home-add` stays on Home); the design system's screen map; `RELEASES` copy; `SPEC.md` gets a line
pointing here. No database change; nothing on the joining, score sync, queue or engine paths. Home drives the
returning-player flow, so a `smoke037` run before merging is worth it.

## 14. The prototype (R9)

Built next, as an artifact, by a separate session. Every frame is a **true-size phone**: 393 × 852 with the status bar
and home line drawn, plus a 393 × 659 Safari frame for the three tightest rows of §4.1. Dark and light. Each frame has
its tap map (what each object opens). Frames: brand-new phone; zero cards (member card); one card; normal day;
pack; pass within 48 h + pack; round live; organizer the night before; two crews; dull week (rung 7); locker loading.

## 15. For Andrew to confirm (the author's picks are in the plan; say if any is wrong)

1. After a round the headline is the **game result** ("Won with Sean."), not your score.
2. While a round is live, **only the bottom bar** shows it (your Nov 25 pick); the stack doesn't change.
3. A round within 48 hours goes **in front of a waiting pack**.
4. Under the stack: **one crew row**, no tiles.
5. **Invite and crew settings move to Standings.**
6. **No name step** for new phones; the member card appears once you've picked who you are in a round.
7. A "Full board" link on the card back is a separate small follow-up, not part of this.
8. Screenshots of Fuse, Wallet and Focus Flight and the reels' advice are still wanted.
