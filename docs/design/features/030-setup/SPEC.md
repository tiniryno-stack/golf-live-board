# 030 · One setup

Status: handed off (design), not built.

**What this is.** Setup asks the same questions in the same order for every game: **course → players → game → teams (only if the game has teams) → tee times → invite**. Course, players and game are already shared and don't change. This spec draws the last three:
- one **Teams** step;
- one **Tee times** step;
- the button that ends Setup: **Next: invite**, which lands on the organizer's lobby (029 §5).

Built on **027** (add at the end, peek).

**Supersedes** (folders are never edited, so this says it):
- the three “Who rides together?” screens: 2v2 “Pick partners”, Rider Cup carts with cart-name pickers, and Team Ryder Cup carts in Setup + the lobby;
- Rider Cup's own tee-time screen;
- tee times living only in Host → Rules for 2v2, Match play and Scorecard;
- “Round is live” (029);
- “Start round · N players” on the Game step: Match play and Scorecard now go on to Tee times.

**Files:** `screenshots/NN-key.png` + `-light.png` (393 × 659 @2×); `mockups/screens.html#{"s":"<key>"}` (027 kit). Reference only.

**Decided by Andrew (Nov 18):**
- **Team Ryder Cup:** Setup always makes the **carts**; the captains' **draft** happens only in the lobby.
- **Scorecard with four or fewer** still gets the tee times step, as **one group with a time**, so the lobby can count down.

---

## 1 · The steps, by game

| Game | Steps (the progress bar counts these) |
|---|---|
| Scorecard only, Match play | Course · Players · Game · **Tee times** (4) |
| 2v2, Partner “Rider” Cup, Team Ryder Cup | Course · Players · Game · **Teams** · **Tee times** (5) |

- Same header on every step: back chip (`‹ Game` / `‹ Teams`), progress dashes right.
- The kicker names the step and the game: `Step 4 · Teams · 2v2`.
- The step's `title` question, a `body` muted hint, then the content.
- One primary at the bottom: `Next: tee times ›` / `Next: invite ›`.
- Swipe right goes back a step (unchanged).

## 2 · Teams: one frame (`01`–`05`)

| Part | Rule |
|---|---|
| Title | By how people are grouped: **“Who's partners?”** (2v2), **“Who rides together?”** (Rider Cup, Team Ryder Cup). |
| Hint + Shuffle | `Tap two names to swap.` with a ghost **Shuffle** (filled `surface-2`) on the right. |
| The teams | TeamCards (design system): your team `tint-you` + `cart-you` outline with `YOU` in the tag, the others in their cart tint + outline. Player chips on `bg`, 48 px. Team Ryder Cup has no colors (design system): numbered rows of two `surface-1` chips, handicap on the right of each name, your name in `cart-you-text`. |
| The game's own setting | The only part that differs, under the teams (below). |

**Each game's own setting:**
- **2v2:** `Switch partners`: Never / Every 6 / At the turn, as a Segmented control, with a hint that says what the choice means: `Andrew + Sean and Sam + Jake on 10–18. Everyone plays with two partners.`
- **Rider Cup with 8:** a `Matchups` row (`standard · everyone plays everyone · optional` ›), which opens today's matchups sheet. **No cart names here**: the hint says `Carts name themselves in the lobby.` (029 §2).
- **Rider Cup with 6** (`04`): three carts stacked full width; `3 carts: every cart plays both others on every hole, 18 holes.` No matchups row (fixed).
- **Team Ryder Cup** (`05`): `8 carts of 2.` The list scrolls under the pinned primary. Under it, a row `Teams: the captains draft / in the lobby, once everyone's in` ›, which opens the Rules sheet explaining the draft. **No draft in Setup.**

**Swapping** (`02`):
- Tap a name → it's picked: `surface-3` fill, 2 px `text` outline. The hint changes to `Now tap a name on the other team.`
- Tap a second name → they swap places with a blur swap of the two chips (027).
- Tap the picked name again → unpick.
- Never drag-only. A long-press does nothing new.

## 3 · Tee times: every game (`06`–`16`)

**“Who tees off together?”** Groups in tee order. Each group is a `surface-1` card:
- the ordinal (`1st`, `label` muted) and the time pill on the right: `🕑 8:40` on `surface-2`, mono; not set = dashed `Add time`;
- the names, **four to a row**, 48 px chips (15 px), so every group is one row tall (a group of 5–6 wraps to two).

| Players | What the step shows |
|---|---|
| 2–4 (`06`, `07`) | Title **“What time do you tee off?”**, one group `Your group` with the time only (no swapping, no add row). Hint: `One group. The time lets everyone see a countdown.` Not set: `No time? Scoring opens as soon as you invite.` |
| 5–6, Match play (`08`) | One group of 6 by default (allowed for Match play), plus the add row. `6 in one group is fine for Match play. Add a tee time to split it.` |
| 8, no carts (`09`–`12`) | Two groups of 4 by default, the add row last. |
| Cart games (`15`) | Groups hold **carts**: two cart chips per group in their cart tint + outline, `Cart A · You` green. `Tap two carts to swap. Your first match is the other cart in your group.` Under the add row, **what it means for your matches peeks** (027 rule 4): `Your matches · Cart A / 1–6 Cart B · 7–12 Cart C · 13–18 Cart D`. |
| 16, Team Ryder Cup (`16`) | **“When do the groups go off?”** Four rows, `1st … 4th · a cart from each side`, a time each. Who plays whom comes from the draft (lobby), so there are no names here. Times default 10 min apart from the first: `Each new time is 10 min after the last. Tap one to change it.` |

- **Times are optional** everywhere except where the lobby needs one to count down. Not set, the lobby shows 029 `08`; the organizer's lobby shows the amber `Set the day and first tee time` row.
- **Times not set / one set / all set** (`09`, `10`, `11`): unset pills are dashed `Add time`. Setting the 1st offers the 2nd at +10 min as a pre-filled suggestion (shown in the pill in `text-muted` until tapped).
- **Swapping between groups** (`12`): tap a name (it's picked); the hint becomes `Now tap who Sam swaps with.`; the other groups get a 1.5 px `text` outline as drop targets. Tapping a name swaps the two; tapping an empty slot moves the name there.
- **Add a tee time (`14`)** is the last row (027 rule 5): tap it and it becomes the new group's time input in place (`3rd · 9:00`, caret, the native time wheel). Confirmed, it becomes a group card with four empty dashed slots and `Move here`.
- **While the last group still has empty slots, the add row hides**: one empty group at a time. This also keeps three groups of 8 players on one screen.
- **A group of one** (`13`): an amber dot line inside the group, `Sam is alone at 9:00`, in `warn`. It doesn't block Next (a single is allowed); it just says so. An empty group is dropped when you leave the step.
- **Picking the time:** the native `<input type="time">` wheel. Tapping a time pill opens it for that group.

## 4 · Next: invite

The last step's primary is **Next: invite ›** for every game. It:
- creates the round with `settings.lobby` (029 §7) and the tee times;
- lands on the organizer's lobby (029 `16`) with the share sheet open the first time.

“Round is live” retires. If the round's first time is now or past (made at the course), it opens straight to “Scoring is open” (029 `14`).

## 5 · Build notes

- One `setupTeams(game)` frame and one `setupTeeTimes(game, roster)` frame replace `ryCartsView` / the 2v2 partner screen / the Rider carts screen, and `ryTeeView` / the Rider tee screen. The game-specific setting is a slot.
- Tee time groups are saved as they are today (`settings.teeTimes` per group, groups = foursomes in roster order). Cart games keep carts as the unit.
- A pure helper `teeGroups(roster, game)` → default groups (≤4 one group; 5–6 one group for Match play; 8 → 4 + 4; carts → 2 carts a group; 16 → 4 groups). Plus `aloneWarnings(groups)`. One unit test.
- Setup → the lobby is part of 029's database change: **worth a smoke run before it ships** (it touches round creation and joining).

| # | key | # | key |
|---|---|---|---|
| 01 | teams-2v2 | 09 | tee-8-none |
| 02 | teams-2v2-pick | 10 | tee-8-one |
| 03 | teams-rider8 | 11 | tee-8-all |
| 04 | teams-rider6 | 12 | tee-8-pick |
| 05 | teams-ryder | 13 | tee-alone |
| 06 | tee-3 | 14 | tee-add-typing |
| 07 | tee-4-unset | 15 | tee-carts |
| 08 | tee-6 | 16 | tee-ryder |
