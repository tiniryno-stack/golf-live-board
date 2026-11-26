# 037 · Home, second pass: the plan (draft 1, Nov 26)

Status: **draft for the panel.** Not approved, not built. Replaces the Home in `SPEC.md` (built on this branch, on the
preview) if Andrew approves a prototype made from it.

## 1. Why a second pass

Andrew, after using the first build on the preview (Nov 25):

> "How it finished is going against 'each screen serves one purpose and answers one question'. … this is info found
> deeper in the user journey and not high-yield, high-level info that would typically be associated with a home screen."

Also from him: likes what **Fuse**, **Apple Wallet** and **Focus Flight** do; not in love with bento boxes ("good when
used in the right spot"); fine if it drifts toward a finance-app look; "even without a card it still needs to hit
visually"; mock-ups must be shown **on a phone screen** so he can see where things land in space; an onboarding flow for
new users is welcome.

## 2. References — and what we could not see

**Honest gap:** the three Mobbin pages and both Instagram reels could not be opened from the build environment
(mobbin.com and instagram.com are blocked; no computer attached). The notes below are from general knowledge of those
apps, not from the pages Andrew linked. The reels' advice is unknown. Treat every note here as a hypothesis until Andrew
confirms or sends screenshots.

| Reference | What it does well (as understood) | What we take |
|---|---|---|
| **Apple Wallet** | Home *is* one object: a stack of cards drawn as real things, on black, with almost no chrome. Older cards show only their top edge. Detail (transactions) appears only after you pick a card. Passes (boarding pass, ticket) live in the same stack as cards. | One stack. Detail lives behind a tap. A round coming up is a *pass* in the same stack. |
| **Fuse** | Very large, confident type; few words; each tile carries one number and nothing else, so tiles read as statuses, not as a grid of features. | One big sentence at the top. If we use tiles, at most two, one number each. |
| **Focus Flight** | One metaphor (a flight) carried through every screen: ticket, departure board, logbook. Mono type for codes and times. The empty state is still an object (a ticket waiting to be issued). | We already have a metaphor (cards, packs, passport). Commit to it on Home: the empty state is a card too. |

## 3. Where our Home lands today (the 037 build on the preview)

| What's there | Status, door, or detail? | Verdict |
|---|---|---|
| Latest card, full scorecard on its face | status + door, but the face is **detail** | keep the card, simplify the face |
| "Your locker" row under the card | door (duplicates the card's tap) | cut |
| Coming up card | status + door | keep, but as a pass in the stack |
| **How it finished** (top 3 + you + Full board) | **detail** | **cut from Home** (lives on the round's Board and the card back) |
| Crew kicker + Invite + ⋯ + Standings row + All rounds row | doors with no status | collapse to one tile with a status |
| Pinned Join / New round, live bar on a round day | doors / status | keep (Andrew picked the bottom live bar) |
| Brand-new phone: dashed outline + code field | weak; "doesn't hit" | redo |

Overall: it reads top-to-bottom as a list. Nothing is big. A friend with no card gets a dashed box.

## 4. The proposal: "The wallet"

**The one question Home answers: "What's my golf right now?"** Everything on Home is either a **status** (read in one
glance) or a **door** (one tap deeper). No lists, no tables, no detail.

One phone screen, no scrolling on a normal day (iPhone 15: 393 × 852, about 759 usable):

```
┌─────────────────────────────┐
│ (AD) Andrew              ☼  │  48  top bar (unchanged)
│                             │
│ LAST OUT · FRI NOV 20       │  16  kicker (label, mono)
│ 87 at Twin Creeks.          │  36+ the headline (title 32/36, one sentence, ≤ 2 lines)
│                             │
│ ┌─ Bridlewood · 97 ───────┐ │  28  edge of an older card
│ ┌─ Twin Creeks · 93 ──────┐ │  28  edge of an older card
│ ┌─────────────────────────┐ │
│ │ PRISMATIC      FRI NOV 20│ │
│ │                         │ │ 223  the front card (Home face: course, score, finish, crew)
│ │ FOUNDERS CREW · ANDREW  │ │
│ │ Twin Creeks          87 │ │
│ └─────────────────────────┘ │
│                             │
│ ┌───────────┐ ┌───────────┐ │
│ │FOUNDERS   │ │PASSPORT   │ │  96  two tiles, one number each
│ │2nd        │ │3 stamps   │ │
│ └───────────┘ └───────────┘ │
│                             │
│ [Join with code][+ New round]│ 92  pinned (or the live bar)
└─────────────────────────────┘
```

### 4.1 The headline (Fuse's lesson)

One sentence in the title style, with a small mono kicker above it. It is the status; it changes with the situation.
First match wins:

| When | Kicker | Headline |
|---|---|---|
| a round is live | `LIVE · HOLE 7` | "You're up 2." (the round's own state line) |
| a pack is waiting | `NEW PACK` | "Friday's card is ready." |
| a round is coming up within 7 days | `SAT · DEC 5 · 8:40` | "Twin Creeks is next." |
| your last round was within 7 days | `LAST OUT · FRI NOV 20` | "87 at Twin Creeks." |
| otherwise | `FOUNDERS CREW` | "2nd in the standings." / "Nothing on the books." |
| no rounds yet | `WELCOME` | "Golf Board." |

No new type size: title (32/36) for the sentence, label (12, mono) for the kicker.

### 4.2 The stack (Wallet's lesson)

One stack, drawn as real objects, newest in front. From front to back:

1. **Pack** (if one is waiting) — the real chrome pack. Tap → the tear.
2. **Pass** for a round coming up — a ticket: date, course, tee time, "6 of 8 in". Tap → the round's lobby.
   Called off = the pass greyed with "Called off".
3. **Scorecards**, newest first — the front one shows a simplified **Home face** (finish, date, crew line, course,
   score, to-par). The full scorecard face stays in the Locker. Up to two older cards show only a 28 px top edge with
   course + score.
4. **Member card**, always at the back — name, crew, "Since Oct 2026". **Everyone has it from the first time the app
   knows their name**, so the stack is never empty.

Tap the front object → its place (tear / lobby / Locker). Tap anywhere else on the stack → Locker. No swiping, no
re-ordering on Home (the design system keeps swipes for Setup's back and closing sheets).

A person with **no scorecard yet** sees their member card in front, full size, in their name, with the headline
"Your first card is 18 holes away." That is the "hits without a card" answer: a real object, not a dashed box.

### 4.3 Two tiles (bento, used once)

- **Crew**: kicker = crew name, big = your place ("2nd") or "5 rounds" when unranked, door → Standings. Two crews:
  the tile shows the current crew and a small ‹ › to switch. No crew: "Start a crew".
- **Passport**: big = stamp count ("3"), sub "course stamps", door → Passport.

Invite and crew settings move to the Standings screen (they are actions about the crew, not about your day).
All rounds becomes a row at the top of the Locker ("Rounds"), since every finished round is a card anyway.

### 4.4 Bottom bar

Unchanged from what Andrew picked: Join with code / New round, replaced by the glowing live bar while a round is live
(then New round and Join are reachable from the Locker's Rounds row).

### 4.5 What leaves Home

| Leaves | Goes to |
|---|---|
| How it finished | the round's Board (tap the card → Locker → card back → Board), unchanged screens |
| "Your locker" row | the stack itself |
| Standings row, Invite, ⋯ | Crew tile → Standings screen |
| All rounds row | Locker |
| What's new line | a one-time sheet on open (never part of Home's layout) |
| Add to Home Screen row | the `home-me` sheet (tap your name), plus onboarding step 3 |

### 4.6 Opening

Deal the stack: back cards land first, the front object deals in last (0.7 s total), then the headline and tiles rise.
Fresh open or when the front object changed; quick fade otherwise. Same rules as the first build.

## 5. Onboarding (new phone, no name)

Three steps, each one screen, each skippable:

1. **"What's your name?"** First + last. On Continue, the member card prints with the name and deals in.
2. **"Got a code?"** Code field + Join, or "Start a round". (A phone that arrived from a round link skips to its round.)
3. **"Put it on your Home Screen"** (iPhone Safari only) — the existing Add to Home Screen flow.

Then Home, with the member card in front.

## 6. Requirements the plan must meet

- **R1** Home answers one question; a stranger can say what it is in five seconds.
- **R2** Every element is a status or a door. No lists, tables or detail.
- **R3** It hits visually with zero scorecards and with one.
- **R4** A normal day fits one iPhone 15 screen with no scrolling; the thumb reaches the main action.
- **R5** Design system only (tokens, type scale, components). Every new pattern is named and justified.
- **R6** A round day keeps the bottom live bar and Home is otherwise the same.
- **R7** Buildable on today's data with no database change; nothing touches joining, score sync, the queue or the engine.
- **R8** Works for the whole friend group: 0 rounds, 1 round, 16-player rounds, two crews, no crew, a new phone.
- **R9** The mock-ups can be judged at true phone size.

## 7. New patterns this would add (to flag)

Card-edge stack; the pass (ticket) card; the member card; the Home face of a scorecard; two status tiles; a headline
ladder. No new colours or type sizes.

## 8. Known weak spots (for the panel to attack)

- The member card is a new object that needs data we may not have ("since" date, crew when there are two).
- The headline ladder can say something dull on a quiet week.
- Tiles are bento, which Andrew is lukewarm on.
- Moving Invite off Home may hurt crew growth.
- The stack + headline + tiles + bar may not fit 759 px once a pass and a pack are both in the stack.
- The references were not actually seen.
