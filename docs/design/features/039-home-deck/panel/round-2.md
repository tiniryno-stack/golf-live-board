# 039 Home deck · Panel round 2

**Plan reviewed:** `docs/design/features/039-home-deck/PLAN.md` draft 2, a full rewrite (branch
`claude/039-home-deck`, commit 958ab36). Checked against the code on `main`.

**Panel:** the same four critics plus the Jester. In Round A each critic checked whether round 1's ten changes landed,
looked for stale text, and re-did §3 against the real CSS. Round B was a short rebuttal on a merged edit list (E1–E13)
and the Jester's new provocations.

Review only: no app code, database, preview or test suites were touched. A 9 means "I would build this as written".

## Scores

| Panelist | R1 final | R2 A | **R2 final: draft 2 as written** | **With E1–E13 applied** |
|---|---|---|---|---|
| Editor | 6 | 8 | **8** | **9** |
| Art Director | 6 | 8 | **8** | **9** |
| Golfer | 7 | 8 | **8** | **9** |
| Engineer | 5 | 8 | **8** | **9** |
| **Mean** | 6.0 | 8.0 | **8.0** | **9.0** |

**All ten of round 1's changes landed.** Two only partly, per the Engineer: the round's ‹ misses Enter, and the update
list has gaps. No stale text from draft 1 remains: no pack strip, no "Open your locker", no icons-only hub, no second
card browser.

**Draft 2 is an 8 because some specs fail when built.** Three numbers in the budget are wrong (all still fit). The rule
that the headline drops to one line under the nudge can't be met. The fan's rotated cards overflow their block. The
"grow from the deck" motion crosses a route change without saying how. A sealed pack now takes three taps to tear. The
round's ‹ disappears on Enter. Game labels go into sentences ("You're playing Everyone alone.").

**Every critic scores a 9 once the thirteen edits below are pasted in.** Apply them, and the plan is ready for the
prototype session.

### §3 arithmetic, re-checked (Engineer and Art Director)

The bar is 94 px in Safari and 128 px in the app (`styles.css:102-117`). The content's bottom padding sits under the
fixed bar, so it doesn't add to the height.

| Situation | 393 × 659 | 393 × 852 (793 below the status bar) |
|---|---|---|
| Normal day | 488 ✓ | 522 ✓ |
| + pass | 632 ✓ | 666 ✓ |
| + pass + nudge | 688 → **654** with the deck at its minimum (E2) | 722 → 688 (E2) |
| Live + pass, crew row hidden | 628 ✓ | **662**, not 738 |
| Zero cards | 488 ✓ | n/a |
| New friend: zero cards + pass + nudge, in a crew | **652**, not in the plan | n/a |
| New phone (no deck) | **358**, not 504 | n/a |
| New phone + nudge (two-line headline) | **414** | n/a |

At 402 × 681 every row is the **same height**. The pass and deck are fixed px, so the plan's "6 px taller" is wrong;
each row simply has 22 px more spare. The tightest row has 29 px to spare.

## The thirteen edits (paste-ready, as amended in Round B; all four agree)

**E1 · §3 budget figures.**
- **L56:** replace the row with:
  > `| New phone (no deck; join field in the crew slot, 92) | 52 + 120 + 92 + 94 = **358** (414 with the nudge) |`

  and add the row:
  > `| New friend: zero cards + pass + nudge, in a crew | 52 + 56 + 84 + 144 + 146 + 76 + 94 = **652** |`
- **L58:** replace with:
  > "At 402 × 681 every row is the same height (the pass and deck are fixed px) and has 22 px more spare (tightest row:
  > 29 spare)."
- **L59:** replace with:
  > "At 393 × 852 (793 below the status bar, bar 128): normal 522, + pass 666, + pass + nudge 688 (deck at minimum),
  > live + pass 662 (crew row hidden)."

**E2 · §3, the nudge rule.** Draft 2 dropped short forms, and most rows run past the ~21 characters that fit on one
line at title 32/800 (e.g. "Justin gave your spot to Sean."). So the one-line rule can't hold.
- At L61–62, replace "While the nudge shows, the headline is one line." with:
  > "While the nudge shows, the deck takes its minimum (112 × 80; block 112)."
- At L53, replace the pass + nudge figure with: "688 before the rules below; **654** with the deck at its minimum".
- Delete any other "headline is one line" mention (L69).

**E3 · §6 Closed, fan geometry.** At −6° with a 6 px offset, the cards behind rise about 15–18 px, which overflows the
146 block. Append after L107:
> "The cards behind rotate about their bottom-left corner (−2° / −4°, `transform-origin: bottom left`) and sit 4 px up.
> Their rise (≤ 16 px) is drawn into the headline's 16 px bottom margin, so the block stays 146. The measured fit reads
> the deck slot's box, not the rotated cards. Only the finish's existing drift runs on the deck (none under reduced
> motion); there is no tilt on Home."

**E4 · §6, the opening motion.** Replace L123–124:
> "Opening from the deck: the tap stores the deck card's rect in `app.ui.deck.from` before `app.go` (`app.ui` survives
> routes). `draw` sets `innerHTML` and calls `mount` in the same task (app.js:1419-1425), so the spread's mount
> applies the FLIP before paint:
> - the front card animates from that rect to its place (`--motion-grow`, `--ease-grow`), then the strips slide up
>   with a 30 ms stagger;
> - mount consumes `from` once (stores `t0`, sets `from = null`), and later redraws only replay via `data-t0` +
>   `ui.syncMotion`.
>
> Opened from the Cards tab instead: no grow, a 150 ms fade."

**E5 · §6, the pack tap.** L111 sends every deck tap to the Cards tab, and L121 opens the pack only from the spread.
That makes a waiting pack three taps from the tear, against one in 037 v2. Paste after L111:
> "Exception: when the deck's front is a sealed pack, tapping it opens the packs view directly (`lk-home-packs`,
> locker.js:751, one tap, as 037 v2). After the tear the Locker returns to `spread`, not `one`. The spread is the
> Locker's default view for your own locker only; `#/passport/<id>` and view-as keep `one` (locker.js:606)."

**E6 · §7.1, the way home from a round.**

A bare ‹ next to Enter's ◀ ▶ hole arrows reads as "previous hole". Enter also hides its whole top bar while the GPS
card shows (`hideTop`, enter.js:915; app.js:1409-1411). Replace "039 adds a visible **‹** before the name pill in a
round's top bar → Home." with:

> "039 adds **‹ Home** before the name pill in a round's top bar. It uses the existing `.topbar .back` (chevron + label,
> styles.css:86-90), not a new pattern: a 48 px target, no confirm (leaving loses nothing; scores are queued and the
> live strip's **Back to hole N** returns in one tap). It shows on every round tab. On Enter with the GPS card showing,
> where the top bar is hidden, it sits at the left of the hole header. On Board the bar is ‹ Home · name chip · title ·
> Share · ⋯; the chip and title ellipsize (~221 px between them at 393)."

In §10 L252 and §11 item 4, write "‹ Home".

**E7 · §4, game words in sentences.** `gameName` returns labels ("2v2", "Stroke play", "Everyone alone", "Team Ryder
Cup", playfor.js:29-32), which read badly mid-sentence.
- **L86:** replace the first sentence with:
  > "Game words in sentences come from a `GAME_PHRASE` map in `COPY`, keyed on `playFor(compute(event, []))`. All seven
  > keys are covered: `ryder` 'the Team Ryder Cup' · `alone` 'for points, everyone on their own' · `stroke` 'stroke
  > play' · `partners` 'a 2v2 match' · `oneMatch` 'a match' · `cart` 'the Rider Cup' · `legacy` 'the match'. A
  > `gameName` label never goes into a sentence."
- **L74 live row:** "You're playing `<game phrase>`." (e.g. "You're playing the Team Ryder Cup.").
- **L80:** "You and Sean won." / Team Ryder Cup: "Your side won the cup, 6½–5½."

**E8 · §7.4, the crew row.** Replace the rule with:
> "One rule: when the headline gives your place, the row shows the leader, or the runner-up when you lead
> (`seasonRecordTable` row 2); otherwise your place. Hidden with no crew or while a round is live."

**E9 · L171, the lit things.** Replace "two lit things: the strip and the tab highlight" with:
> "the design system's two glows: the dock (`--shadow-dock`) and the strip (`--glow-you`)."

**E10 · L156, the + button.** Replace "56 px glass circle" with:
> "56 px circle in `--button` / `--on-button` (the one primary action), centred on the dock's midline (7 px inset from
> the 70 px dock)."

**E11 · §4 / §5, ellipsis.** Add:
> "Course names in kickers and in the pass's course · game line truncate with an ellipsis."

**E12 · after L181, the no-crew route.** Add:
> "Route: the Crew tab with no crew is `#/season` (crew null, app.js:1330); season.js renders the empty Standings with
> **Start a crew** when `crewOf(app)` is null; `isHub` counts `season` with or without an id, but not its sub-views."

**E13 · paperwork and frames.**
- **L258, the update list, add:**
  - the fit test's round top-bar scenes (‹ Home touches every round header);
  - a unit test for `isHub` and the hub highlight;
  - a test that the dock rebuilds when crossing hub ↔ round (`data-set`);
  - a `homeview.js` `COPY` ladder test (incl. `GAME_PHRASE`);
  - CLAUDE.md's "No back button inside a round" line, once Andrew decides §11 #4.
- **§11 item 5:** replace "(one extra tap each)" with "New round costs one extra tap; Join is + then type, as today."
- **L253, frames, add:** Enter with the GPS card and its ‹ Home; a sealed-pack deck front.

## Points settled in Round B

| Question | Settled as | How |
|---|---|---|
| New phone + nudge height | **414**, not 378 | E2 removes the one-line rule and a new phone has no deck to shrink, so the headline stays two lines (Art Director; Engineer agreed). |
| ‹ vs ‹ Home | **‹ Home** everywhere, in the existing `.topbar .back` style | A bare ‹ on Enter reads as "previous hole". The Editor proposed `small`; the Art Director showed the existing back-button style already fits. |
| Does a sealed pack already go to the packs view? | **No** | L111 routes every deck tap to the Cards tab. The Editor misread it and conceded; E5 is required. |
| Live row wording | **"You're playing the Team Ryder Cup."**, from `GAME_PHRASE` | Golfer amendment, all agreed. |

Nothing is left open between the panelists.

## The Jester's round-2 provocations and the panel's answers

| # | Provocation | Panel's answer (unanimous) |
|---|---|---|
| P1 | Skip the ‹; give a live round its own fifth "Round" tab | **Rejected.** A tab that appears and disappears shifts the other four under people's thumbs and breaks the four-equal track (styles.css:111). Getting *into* the round is already the live strip's Back to hole N; the ‹ Home is for getting *out*. |
| P2 | Put the join code field on top in the + sheet | **Rejected.** The keyboard covers whatever sits under the focused field, which would be New round. With New round above, friends still type at once (+ then type) and Andrew taps. |
| P3 | Drop the hub labels to match the round's icons-only bar | **Rejected.** The round bar is learned every hole; the hub bar is visited weekly, and Rounds, Crew and Cards have no self-evident icons, so R1 needs labels. Two levels, two treatments, cleanly keyed on `data-set`. |
| P4 | Fill the calm 250 px with the weather at your next tee time | **Rejected.** It needs a weather API, a new allowed host and probably a key: new infrastructure, against R8's spirit. It isn't status from this app. |
| P5 | Make the fan deck shimmer with phone tilt on Home all the time | **Rejected.** iPhone tilt needs a granted motion permission (`glb.lockerTilt`) behind a button. A permanent animation loop on Home costs battery and breaks "animate only right after a tap". Only the finish's existing drift runs (E3). |

## For Andrew (§11, via the author)

1. **‹ Home inside a round (§11 #4).** This changes the "no back button inside a round" rule from Oct 21. The panel
   thinks it's low-risk and worth it: it's top-left, needs no confirm, and the live strip brings you back in one tap.
   But it's his convention. He should see it on the Enter frame (with the GPS card) and the Board frame.
2. **Calm or empty in the home screen app (§11 #3).** About 250 px is spare on a normal day at 852. The Art Director
   still thinks it reads as empty; the others say calm. He judges on the 852 frame.
3. **Tabs vs tiles (§11 #1).** The panel's default is tabs; the tiles frame is for feel only.
4. **Headline set A / B / C (§11 #2).** B ("You shot 87") is clearer for stroke play, but only A works for team games.
5. **Testing.** Run `smoke037` before merging, and a `test:fit` run is worth asking for, since ‹ Home touches every
   round header.
