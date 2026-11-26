# 039 · Home is a home screen; the cards are a deck (draft 1, Nov 26)

Status: **draft for the panel.** Not approved, not built. Changes 037's second pass ("the wallet", live on `main` since
Nov 26, `docs/design/features/037-home/PLAN-v2.md`). 037 is not edited.

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
> "Standings is also a little buggy when you click into it and explore around." (being chased separately)

He still likes the wallet idea. So: keep the objects, shrink their footprint, and give Home back to navigation.

## 2. The question changes

037 v2 asked "What's my golf right now?" and answered with one big object. **039 asks "Where do I go from here?"**
Home is a hub: one plain sentence of status, the next thing if there is one, a small deck, and navigation in a
convention everyone already knows. Cards are the app's signature on Home, not its content.

## 3. The screen

Top to bottom (393 wide):

| # | Block | Height | What it is |
|---|---|---|---|
| 1 | Top bar | 52 | unchanged: avatar → Passport, name → `home-me`, theme |
| 2 | Nudge strip | 48 + 8, only when there is one | unchanged from 037 v2 |
| 3 | Headline | 8 + kicker 16 + 8 + up to two lines of 36 + 16 | §4: a plain full sentence |
| 4 | Up next | 0, 72 or 132 | §5: a pack strip, or a compact pass. Nothing when there is nothing |
| 5 | The deck | 96 | §6: a small closed stack; tap opens the spread |
| 6 | Crew row | 12 + 64 | from 037 v2 (your place, door to the Crew tab); Start a crew with none |
| 7 | Live strip | 64, only while a round is live | §7: sits on top of the tab bar |
| 8 | Tab bar + New | 84 | §7: Home · Rounds · Crew · Cards, and a round **+** button |

Budget: normal day in Safari (393 × 659) = 52 + 120 + 96 + 76 + 84 = **428**; with a compact pass and a pack strip =
428 + 144 + 84 = 656; live adds 64 and hides the pack strip. Everything fits every size with room to spare; content is
top-aligned and the spare height sits above the tab bar. No measured fit is needed any more.

## 4. The headline: plain words

The rule changes from "short and never repeats the card" (the card is now small, so the sentence does the telling) to:
**a full sentence a friend would say, that makes sense with nothing else on the screen.** Two lines are fine at every
size. The kicker says what it's about; the sentence says what happened or what's next.

| When | Kicker | Sentence |
|---|---|---|
| a round is live | `LIVE · TWIN CREEKS` | "You're on hole 7." (the live strip carries the score line) |
| your spot was given away | `SATURDAY · TWIN CREEKS` | "Sean has your spot now." |
| a coming round was called off | `SATURDAY · TWIN CREEKS` | "Justin called it off." |
| a round within 48 h | `NEXT ROUND · TWIN CREEKS` | "You tee off tomorrow at 8:40." |
| a pack is waiting | `NEW CARD · TWIN CREEKS` | "Your card from Friday is ready to open." |
| a round coming up (≤ 14 days) | `NEXT ROUND · TWIN CREEKS` | "You play in 9 days." |
| last round ≤ 7 days ago | `LAST ROUND · TWIN CREEKS · FRI NOV 20` | "You shot the low round of the group." / "You finished 2nd out of 5." / "You and Sean won." / "You and Sean finished 3rd out of 4 carts." |
| ranked in a crew season | `FOUNDERS CREW` | "You're 2nd in the standings." (the crew row then shows the leader) |
| older last round | `LAST ROUND · 3 WEEKS AGO` | as last round |
| rounds, none finished | `GOLF BOARD` | "No finished rounds yet." |
| nothing on this phone | `GOLF BOARD` | "Live scores for your group's round." |

"2nd of 5." is gone: every result sentence has a subject ("You", "You and Sean"), a verb, and says out of what.
The two-tone treatment from 037 v2 is dropped (it made fragments). The sentence is all `--text`.

The prototype shows **three headline sets to choose from** on the same layout: (A) the result in plain words, above;
(B) the score ("You shot 87 at Twin Creeks."), since the card no longer shouts it; (C) what's next first
("Nothing planned. Start a round?" / "Saturday at Twin Creeks."). All copy stays in `homeview.js`'s `COPY` table.

## 5. Up next (only when there is something)

- **A pack is waiting:** one 72 px strip in the chrome foil: "1 pack to open · Twin Creeks", chevron. → the packs view.
- **A round is coming up:** a **compact pass**, 132 px: the day and time in mono 32, course and game on one line,
  the TODAY / TOMORROW badge, and **Open** + **Share link** on the right. The full 7:5 pass from 037 v2 is retired
  from Home. Called off / spot given: same strip, greyed, **Text host**.
- Both at once: the pass, then the pack strip. Several coming rounds: the soonest; "+1 more" opens Rounds.

## 6. The deck, and the spread

**Closed (on Home):** a 96 px row. Left: a miniature of your latest card (112 × 80, the real front scaled down) with
the tops of up to two more cards showing 3 px each behind it, so you can just tell there's a stack. Right: "Your
cards" and one line ("5 cards · latest Twin Creeks"). No card, person known: the paper member card as the miniature
and "Your first card comes after 18 holes". No person: no deck row (the join field shows instead, as 037 v2).

**Tap the deck → the spread opens over Home** (it grows from the row; swipe down or ✕ closes it, like a sheet):

- Your cards laid down the screen like Wallet: each a 56 px strip in its own finish showing course, date and score
  (they are your opened cards; nothing to spoil), newest at the bottom, full size.
- **Tap any strip → that card comes to the front**: it lifts, the others close up behind it. No navigation.
- **Tap the front card → it flips** to its back (who you played with, and 038's Full board).
- A waiting pack sits at the front of the spread, sealed: tap → the packs view.
- One quiet link at the bottom: **Open your locker** (the Cards tab), for the full carousel, sharing and the Passport.
- More than ~8 cards: the spread scrolls; the front card stays pinned at the bottom.

The Locker itself (036) is unchanged. The spread is Home's own view (a full-height sheet), built from the same card
markup.

## 7. Navigation: the conventions people already know

**A bottom tab bar at the top level**, using the app's own tab bar component (001: full-width glass bar, icons, one
sliding highlight; the screen title says where you are): **Home · Rounds · Crew · Cards**.

- Home = this screen. Rounds = `#/rounds`. Crew = Standings for the current crew (Start a crew with none).
  Cards = the Locker (with its Passport tab).
- It shows on those four screens and nowhere else: a round keeps its own tab bar; Setup, sheets and the spread have none.
- **A round + button** sits at the right end of the bar, apart from the tabs (Fuse's pattern): tap → a small sheet with
  **New round** and **Join with code**. This replaces the two pinned buttons.
- **While a round is live**, a 64 px green strip sits directly on top of the tab bar, like a music app's mini player:
  `LIVE · HOLE 7`, "You're up 2", **Back to hole 7**. It is the only thing that glows. It shows on all four tabs.
- A brand-new phone: the join code field is in Home's content (as 037 v2); the tab bar and + are still there.

The prototype also shows the alternative for Andrew to feel: **no tab bar, four door tiles** on Home in a 2 × 2 (Fuse's
home: Rounds · Crew · Cards · Passport, one line of status each) with the two pinned buttons kept.

## 8. What changes from 037 v2

| 037 v2 | 039 |
|---|---|
| The front object fills the screen (258 px) with edges | A 96 px deck; the spread on tap |
| Tapping an edge opens the Locker on that card | Tapping a card in the spread brings it to the front |
| The full pass in the stack | A compact pass under the headline |
| Two-tone short headline ("2nd of 5.") | A plain full sentence |
| Doors row (All rounds, Add to Home Screen) | The tab bar (Rounds); Add to Home Screen stays in the nudge, then in the `home-me` sheet |
| Pinned Join / New round; live bar in the foot | The + button; the live strip on the tab bar |
| Crew row | Kept |
| Standings holds Invite / switcher / Name your crew | Kept (and its bugs fixed separately) |

## 9. Requirements

- **R1** Home reads as a home screen: a stranger can say where each main part of the app is within five seconds.
- **R2** Cards are present and desirable but take no more than about a fifth of the screen until asked for.
- **R3** In the spread, tapping a card brings it to the front; nothing navigates away unless it says so.
- **R4** Every headline is a full plain sentence that makes sense alone.
- **R5** Navigation uses conventions the group already knows (tab bar, +, sheets), reusing the app's components.
- **R6** Design system only; new patterns named and justified.
- **R7** Works for 0 cards, 1 card, 20 cards, no crew, two crews, a new phone, a live round, a coming round, a pack.
- **R8** No database change; nothing on joining, score sync, the queue or the engine.
- **R9** The prototype shows it at true phone size, with the alternatives (three headline sets; tabs vs tiles).

## 10. Known weak spots (for the panel)

- A top-level tab bar is a new level of navigation: what happens to each screen's back button, to `#/passport`, to
  crew screens, and to the round's own tab bar when you come back out?
- Icons-only tabs at the top level may be harder to read than in a round.
- The + sheet adds a tap to New round and Join.
- Home on a normal day is sparse (about 430 of 659 px used). Is that calm, or empty?
- The spread duplicates part of the Locker.
- Removing the pinned buttons changes what `smoke037` and friends expect.
