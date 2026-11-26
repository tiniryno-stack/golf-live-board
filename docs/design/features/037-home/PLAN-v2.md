# 037 · Home, second pass: the plan (draft 3, Nov 26)

Status: **draft 3, for the panel's round 2** (draft 2 answered round 1; draft 3 adds what the references showed, §2). Not approved, not built. Replaces the Home in `SPEC.md` (built on this branch,
on the preview) if Andrew approves a prototype made from it. Draft 1 scored 5 / 4 / 5 / 4 (`panel/round-1.md` on branch
`claude/037-panel`); §12 says what changed for each of the panel's 13 required changes.

## 1. Why a second pass

Andrew, after using the first build on the preview (Nov 25):

> "How it finished is going against 'each screen serves one purpose and answers one question'. … this is info found
> deeper in the user journey and not high-yield, high-level info that would typically be associated with a home screen."

Also from him: likes what **Fuse**, **Apple Wallet** and **Focus Flight** do; not in love with bento boxes ("good when
used in the right spot"); fine if it drifts toward a finance-app look; "even without a card it still needs to hit
visually"; mock-ups must be shown **on a phone screen**; an onboarding flow for new users is welcome.

## 2. References — now seen

Andrew's local session saved screenshots and notes to `references/` (`NOTES.md` + 72 images; Mobbin's free view only,
and the reels without audio). The author has looked at the Fuse home and empty home, Wallet's stack, and Focus Flight's
boarding pass. What they show, and what this draft takes from each:

| Reference | What it actually does | Taken into this plan |
|---|---|---|
| **Fuse** home (`fuse-01`) | A small grey kicker, then one hero value where the important part is black and the rest grey ("$10**.04**"). Only two other text sizes on the screen. | §5: the headline's first phrase is in `--text`, the rest in `--text-muted`. |
| **Fuse** empty home (`fuse-02`) | Same layout with zeroes, plus **one sentence and one button** where the missing thing would be. Nothing dashed. (Reel 1 tip 19 says the same.) | §6.3: the zero-card Home keeps the layout and gets one sentence + one button under the card. |
| **Wallet** (`wallet-01`) | Edges are the card's **own art, with no added text**. | §6: an edge is the top strip of the real object, nothing added. |
| **Wallet** (`wallet-02`, `-03`) | Nudges (set-up, new features) are **dismissible cards on top of the stack**, not banners or sheets. | §4.2: What's new and the first Add to Home Screen are a nudge edge on the stack. |
| **Wallet** (`wallet-04`) | Bento and lists appear only **after** you pick a card. | Confirms: no tiles on Home, How it finished stays off Home. |
| **Focus Flight** (`focusflight-04`) | The boarding pass: big mono codes, a 2×2 of small grey labels over mono values, a tear line with notches, a state badge (LANDED). | §6.2: the pass is a designed object in that shape. |
| **Reels** (20 + 10 tips) | Polish rules. | §13.1: the ones that apply are a checklist for the build. |

Not taken: Wallet's small + at the top and Fuse's single + (Andrew's two pinned buttons stay, both are weekly actions);
Wallet's stack collapsing while one card is in use (offered to Andrew in §15 as the alternative for a live round).

## 3. The one question

**"What's my golf right now?"** Everything on Home is a **status** (one glance) or a **door** (one tap deeper).
No lists, no tables, no detail. No element repeats a fact another element on the screen already shows.

## 4. The screen

Top to bottom. Heights are the real ones (card 7:5 at 361 wide = 258; pack 266; title line 36).

| # | Block | Height | What it is |
|---|---|---|---|
| 1 | Top bar | 48 | unchanged: avatar → Passport, name → `home-me`, theme |
| 2 | Nudge edge | 44, only when there is one | §4.2: sits on the stack like an edge; replaces the first build's What's new line |
| 3 | Headline | 80 (one line) / 116 (two) | kicker (`ts-label`) + one sentence (`ts-title`) |
| 4 | The stack | edges 28 each + front 258 (pack 266) | §6 |
| 5 | Crew row | 64 + 12 gap, or absent | §7 |
| 6 | Doors row | 44 | text doors: All rounds · Start a crew (no crew only) · Add to Home Screen (iPhone Safari only) |
| 7 | Pinned foot | 96 (130 standalone) / 156 live | Join with code + New round, or the live bar (§8) |

### 4.1 The budget (R4)

Three sizes: Safari **393 × 659**, Safari **402 × 681**, home screen app **393 × 852** (59 status bar, 34 home line).
Rules that make it fit, in the order they give way:

1. The headline is **one line in Safari** (copy is written to fit; it may wrap to two only in the home screen app).
2. **Edges yield first.** Home screen app: up to 2 edges. Safari: 1 edge. With a nudge showing in Safari: 0 edges (the nudge is the edge).
3. **While a round is live the crew row is hidden** (you're playing; the foot is taller).
4. The front object's width is `min(361, leftover × 7 / 5)`, never under 300. If even that doesn't fit, the page scrolls
   (not expected at these three sizes).

| Situation | 659 Safari | 681 Safari | 852 app |
|---|---|---|---|
| Normal day (1 edge Safari / 2 app) | 48+80+286+76+44+96 = **630** | 630 | 59+48+116+314+76+44+130 = **787** |
| Pack in front (266) | 638 | 638 | 795 |
| Pass in front + pack edge | 630 | 630 | 787 |
| Nudge showing (0 edges Safari) | 48+44+80+258+76+44+96 = **646** | 646 | 831 (2 edges) |
| Round live (no crew row, foot 156) | 48+80+286+44+156 = **614** | 614 | 59+48+116+314+44+190 = **771** |
| Zero cards (plain card, 0 edges) | 602 | 602 | 731 |
| No crew (no crew row) | 554 | 554 | 711 |

Every row fits with at least 13 px spare. The fit test (`npm run test:fit`, on request) gets these as scenes.

### 4.2 The nudge edge (Wallet's lesson)

One 44 px strip that sits on top of the stack exactly like an edge (same radius, same overlap), in `--surface-2`, with
its text on the left and ✕ on the right. At most one at a time:

1. **What's new** (`whatsNew()`): "New · Your card is on Home now". Tap expands it in place to the release's lines and
   **Got it** (`home-news-open` / `home-news`, as the first build). ✕ = Got it.
2. **Add to Home Screen** (iPhone Safari, until tapped or dismissed once): "Add Golf Board to your Home Screen"
   (`home-add`). After ✕ it stays available in the doors row, so the move link is never lost.

A nudge never opens a sheet by itself and never shows while a round is live.

## 5. The headline ladder

Kicker + one sentence. **The sentence's first phrase is in `--text` and the rest in `--text-muted`** (Fuse's black-and-grey hero; in the table the split is marked with `|`), set with `text-wrap: balance`. Pure function, first match wins. **Rule: the sentence never repeats what the front object, the
crew row or the bar shows** (so it never says the course, the date or the score when a card or pass is in front).

| # | When | Kicker | Sentence | Tap |
|---|---|---|---|---|
| 1 | a round is live | `ON THE COURSE` | "Good luck | out there." (first 3 holes) / "Keep it | going." | none (the bar is the door) |
| 2 | a pass is due within 48 h | `NEXT ROUND` | "Tomorrow | you tee off." / "Today | you tee off." | none (the pass is the door) |
| 3 | a pass needs you | `NEEDS YOU` | "You haven't joined Saturday yet." / "Justin gave your spot to Sean." | the round |
| 4 | a pack is waiting | `NEW PACK` | "One card | is sealed." | none (the pack is the door) |
| 5 | a round is coming up (≤ 14 days) | `NEXT ROUND` | "9 days | out." | none |
| 6 | your last round was ≤ 7 days ago | `LAST OUT` | the game result from `recent.result.line` without the score: "Won | with Sean." / "3rd, | 1½ back." Scorecard round: "Low round | of 5." / "2nd | of 5." | none |
| 7 | you're ranked in a crew season | the crew's name | "2nd | in the standings." (then the crew row is hidden) | Standings |
| 8 | you have rounds, nothing else to say | `GOLF BOARD` | "Nothing on the books." | none |
| 9 | no rounds on this phone | `GOLF BOARD` | "Live scores for your group's round." | none |

Rung 3 uses only what Home already stores per round (`recent.lobby.kind === 'removed'`, a lobby round with no
`lobbyPid`). Join requests, handicap invites and Add to Home Screen are **not** rungs: they'd need new fetches on Home
(R7) or would nag.

Exact text for Andrew's real days: **Fri Nov 20 evening** (pack waiting) → `NEW PACK` "One card | is sealed."
**Sat Nov 21** (opened) → `LAST OUT` "Low round of 5." **Mon Nov 30, a dull week** → `FOUNDERS CREW` "2nd in the
standings." (his real place, computed), crew row hidden.

## 6. The stack

One stack of real objects. **One front object, at most two edges.**

**Front object** (first match): a pass due within 48 h → a pack → a later pass → your latest scorecard → the plain
card (§6.3).

**Edges** (28 px strips), in this order until the limit: another pass (soonest first) → the pack → opened scorecards,
newest first. **An edge is the top strip of the real object and nothing is added to it** (Wallet): for a scorecard that
is the 036 front's own top line (the mark and the finish name, on the finish's art), so you tell cards apart by finish
and no score is ever shown; for a pass, its day and time; for the pack, its foil. The plain card is never an edge.

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

### 6.2 The pass (Focus Flight's lesson)

A designed object in the card's 7:5 box, on `--surface-1` with a 1 px alpha border: **the day and tee time big, in
mono** ("SAT 8:40"; "SAT DEC 5" when no time is set), then a 2×2 of small grey labels over mono values (Course ·
Game · Tee time or "Times soon" · Riding with or "Draft pending"), then a dashed tear line with a half-circle notch
cut into each side (inner radius follows the reels' concentric-radius rule), then the button row under the tear.
All from what `homeCard` already derives (plus `startTime` and the game name, a pure change).

- **Badge** (top right, like LANDED): `TODAY` / `TOMORROW` in green when due within 48 h; `CALLED OFF` in grey.
- **Coming:** button **Open**. **Organizer's own pass:** **Open** + **Share link** (the existing share action).
- **Called off:** greyed, badge, button **Text Justin** (`home-text`, as today).
- **Removed** (your spot was given away): the line "Justin gave your spot to Sean." replaces the 2×2, button **Text Justin**.
- **Several coming rounds:** soonest in front, the next one an edge.
- Fix the hard-coded "Team Ryder Cup · N players" (`lobby.js` `homeCard`) to use the round's game name.
- **No "6 of 8 in" count.** It would need a `lobby_counts` call from Home; the organizer sees it one tap away in the
  lobby. Cutting it keeps Home off the joining path entirely (R7).
- A friend with a round coming and no scorecard sees **the pass in front**, not the plain card: their first Home hits.

### 6.3 The plain card (no scorecard yet)

One object, an existing finish (`lkf-standard`, 7:5, the mark), two states. It is drawn **only when there are no
scorecards and no pack**; it is never an edge.

- **Member card** (the phone knows the person: an owner or a roster pick with a personId): their name, their crew
  (`db.crews.current()`; left out with no crew), and one fact, "FIRST ROUND · NOV 2026" from the earliest round this
  phone has for them (`glb.recent`), or "NO ROUNDS YET". No "Since", no member number: neither has a data source.
- **Blank card** (no person): the same object with no name and one line, "Your card prints after your first round."

**One sentence and one button under it (Fuse's empty home, reel 1 tip 19).** In the crew row's place: for a member
card, "Finish 18 holes and your first card arrives as a pack." + **Start a round** (→ Setup); for the blank card, the
join code field + **Join** (§10). The pinned foot is unchanged.

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
| Pass | **new** | `.card.lb-card` (Coming up) for content; the 036 card for the box | a round coming up is the first thing many friends will have; it has to be an object (Focus Flight) |
| Nudge edge | **small new** | the first build's `hm-news` line | Wallet: nudges live on the stack, dismissible |
| Two-tone headline | no | `ts-title` with `--text` / `--text-muted` | Fuse |
| Plain card (member / blank) | no | `lkf-standard` + the mark | existing finish, new words |
| Headline + kicker | no | `ts-title` + `ts-label` (Board, lobby) | the ladder is copy rules in the pure model |
| Crew row | no | `.home-row` + `.lc-pts` | — |
| Doors row | **small new** | `.btn.ghost` text buttons | three quiet doors in 44 px |

Cut from draft 1: the tiles, the separate Home face, "Since", the Passport tile, the ‹ › switcher,
the What's new sheet, the "N in" count.

To update when built: `tests/home037.test.mjs` (ladder, stack order, edges per size, crew row rules);
`tests/smoke037.mjs` check 3 (already stale from the first build) and its What's new text; the smoke Add to Home Screen
checks keep working (`home-add` stays on Home); the design system's screen map; `RELEASES` copy; `SPEC.md` gets a line
pointing here. No database change; nothing on the joining, score sync, queue or engine paths. Home drives the
returning-player flow, so a `smoke037` run before merging is worth it.

### 13.1 Craft checklist for the build (from the two reels)

Tabular numbers everywhere a digit shows; the score and its to-par aligned on the **baseline**; more space above a
kicker than below it, and the kicker-to-sentence gap equal to the kicker's own height; `text-wrap: balance` on the
headline; **layered** shadows (light theme) on the front object; **alpha borders** on the pass and the crew row;
concentric radius on the pass's notches and anything inset; colours muted in dark mode (the only saturated things are
the card's finish and the live bar); the deal uses a strong ease-out (`cubic-bezier(.22, 1, .36, 1)`); buttons press
to `scale(.96)`; every button says what it does; kickers stay uppercase mono (they are labels, the design system's
`.label`), sentences are sentence case.

## 14. The prototype (R9)

Built next, as an artifact, by a separate session. Every frame is a **true-size phone**: 393 × 852 with the status bar
and home line drawn, plus a 393 × 659 Safari frame for the three tightest rows of §4.1. Dark and light. Each frame has
its tap map (what each object opens). Frames: brand-new phone; zero cards (member card); one card; normal day;
pack; pass within 48 h + pack; a friend with a pass and no card; a nudge showing; round live; organizer the night before; two crews; dull week (rung 7); locker loading.

## 15. For Andrew to confirm (the author's picks are in the plan; say if any is wrong)

1. After a round the headline is the **game result** ("Won with Sean."), not your score.
2. While a round is live, **only the bottom bar** shows it (your Nov 25 pick); the stack doesn't change.
3. A round within 48 hours goes **in front of a waiting pack**.
4. Under the stack: **one crew row**, no tiles.
5. **Invite and crew settings move to Standings.**
6. **No name step** for new phones; the member card appears once you've picked who you are in a round.
7. A "Full board" link on the card back is a separate small follow-up, not part of this.
8. **Live round, the alternative the references suggest:** Wallet folds the stack away while a card is in use. We could
   fold the stack to edges and put the live round's pass on top instead of the bottom bar. The plan keeps your bottom bar.
9. Two pinned buttons stay (Fuse and Wallet each have a single +). Say if one of them is *the* action.
