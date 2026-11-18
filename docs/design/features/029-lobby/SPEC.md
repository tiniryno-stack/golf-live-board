# 029 · A lobby for every round

Status: handed off (design), not built.

**What this is.** Every round link leads to the same place: a lobby with your start time, who you're playing with and how today's game works, which turns into “Scoring is open”. Team Ryder Cup's lobby (025) is the template; this is the version for games with no draft and no handicap to reveal. Built on **027** (one hero, lit, peek, grow, add at the end) and reusing **028**'s words.

**Supersedes** (folders are never edited, so this says it):
- “Round is live” (the code screen at the end of Setup, every game but Team Ryder Cup).
- The “Who are you?” name sheet: every link goes through 026's invite → full-screen “Which one are you?” → “You're Sean?”.
- Today's game as a full-screen pager: it becomes three lines in the lobby, with the full rules behind ⋯ → Rules.
- The full-screen cart-name picker (Rider Cup): naming moves into the lobby.

**Unchanged (built for Team Ryder Cup, now for every game):**
- the invite (026), the add-to-home-screen guide, “Which one are you?”, “You're Sean?”;
- the handicap reveal, only when the organizer set handicaps;
- scoring opens by itself 30 min before the first start time, and the organizer can open it sooner (025 §1–3);
- Team Ryder Cup's own lobby (025): its game slot is the team and the draft.

**Files:** `screenshots/NN-key.png` + `-light.png` (393 × 659 @2×); `mockups/screens.html#{"s":"<key>"}` (027 kit). Reference only.

**Decided by Andrew (Nov 18):**
- **Countdown as the hero:** yes on the day; the start time when it's further out.
- **A round made at the course** has no lobby to wait in: if scoring is open, the lobby is just “Scoring is open · Go to hole 1”.
- **Today's game:** three lines in the lobby; the full rules behind ⋯ → Rules.

---

## 1 · The player lobby (`01`–`08`)

Top to bottom, on Sean's phone (Match play, 8 players, start times 8:40 and 8:50):

| Block | What it shows |
|---|---|
| Top bar | avatar · `Sean` · `Saturday · Twin Creeks` · ⋯ (Rules, How today's game works, Theme, I'm not Sean). No tab bar until scoring opens. |
| Kicker (`label`) | when + where: `Saturday · Nov 22 · Twin Creeks` / `Tomorrow · Twin Creeks` / `Today · Twin Creeks`. |
| **Hero** (`number-xl`) | see §1.1. One per screen. |
| Sub line (`body` muted) | `your start time · 4 days away` / `your start time, Saturday` / `to your 8:40 start time`. |
| **Your start time** | `surface-1` card: `Your start time · 8:40` (`label`), then the names in your group, **you first in `cart-you-text`**. **Lit (027 rule 3) on the day only**, because that's when it's live. Days away it's a plain card: nothing is lit before it's live. |
| **The other start times** | one row each, **peeking** (027 rule 4): `8:50 · Mike · Tyler · Chris · Matt`. Not tappable. Three or more other groups: show the next one and `+2 more start times`. |
| Game slot | §2. Match play and Scorecard have none. |
| Today's game | `Today's game` label, then a box: the game's name (`row`) and **one short paragraph, at most three lines** (`body` muted). Full rules under ⋯ → Rules. |
| Who has Golf Board | `Who has Golf Board · 7 of 8`, then 36 px initials: in the app = `surface-2`; not yet = dashed `line` ring; you = `cart-you` ring. |
| Bottom | `Scoring opens by itself at 8:10.` (`small` muted, centered), then the secondary **Text Andrew** (share sheet to the organizer). |

### 1.1 The hero, by distance

| When | Kicker | Hero | Sub line | Your start time |
|---|---|---|---|---|
| 2+ days away (`01`) | `Saturday · Nov 22 · Twin Creeks` | `8:40` | `your start time · 4 days away` | plain |
| Tomorrow (`02`) | `Tomorrow · Twin Creeks` | `8:40` | `your start time, Saturday` | plain |
| Today, 60 min or more (`03`) | `Today · Twin Creeks` | `2h 10m` | `to your 8:40 start time` | **lit** |
| Within the hour (`04`) | `Today · Twin Creeks` | `42 min` | `to your 8:40 start time` | **lit** |

- The countdown counts to **your own** start time, not the first one. Scoring opens at the first start time − 30 min for everyone (025).
- It ticks once a minute, with no animation, from the server's `opensAt` and start times (025 §6: not the phone's clock alone).
- Under a minute: `1 min`. At your start time: `Now`.

### 1.2 Who's in (`05`, `06`)

- **Nobody else yet** (`05`): label `Who has Golf Board · just you so far`. Bottom: `Andrew is sending the link to everyone.` + **Share the link** (players may forward it; the link is the same).
- **Some in:** `7 of 8`, as above.
- **All in** (`06`): `Who has Golf Board · all 8`, every face solid.

### 1.3 One start time only (`07`)

A single foursome: no peek row, and the faces are just your group. Everything else is the same.

### 1.4 No date or time set yet (`08`)

The hero becomes a `title`: `Andrew hasn't set the day yet`, sub `The day and your start time show up here as soon as he does.`. The card is `Your group` with the names (no time). Nothing is lit, no countdown, no “Scoring opens” note. Bottom: **Text Andrew**.

## 2 · The game slot

| Game | Slot (under your start time) |
|---|---|
| Team Ryder Cup | your team and the draft (025, built). |
| Partner “Rider” Cup (`09`, `10`) | **Your cart** replaces the start-time card (the time is the hero, so it isn't lost): `Your cart` (`label`, `cart-you-text`) · `Andrew + Sean` · then the cart name **typed in place as the last row** (027 rule 5). Under it: **Your matches**: `1–6 vs Sam + Jake · same start time`, then 7–12 and 13–18 **peeking** with their group. |
| 2v2 (`11`) | Your start time card says who's with whom: `Sean + Jake vs Andrew + Sam`, and, with a switch, `Partners switch at the turn: with Andrew on 10–18.` |
| Match play, Scorecard | nothing extra. |

**Naming your cart (Rider Cup, `09` → `10`):**
- **Unnamed:** the last row of the card is an add row: dashed, `Name your cart`, with `or tap one: Snorlax · Eevee · Gengar` under it. The suggestions come from `TEAM_NAME_PICKS`, filtered as today.
- **Tapped:** the row becomes the input in place (solid `text` border, focus ring, keyboard). Return saves (`pick_team_name`); the name swaps in with the blur swap.
- **Named:** `Hogan's Heroes` in `cart-you-text` over `Andrew + Sean · Rename` (ghost link back into the input).
- Either cart-mate can name it; first save wins, as today. Matches show cart names once they exist (`vs Fore Play`).

## 3 · Scoring is open (`12`–`14`)

- **When `opensAt` passes while you're on the lobby (`12` → `13`):**
  - the kicker turns `Scoring is open` in `cart-you-text`;
  - the title becomes `8:40 with Andrew, Sam and Jake`;
  - the sub line becomes the game in one line;
  - **your start time card grows into hole 1** (027 rule 1, `motion-grow`; `12` is the 90 ms frame).
- The grown card reads `Hole 1 · par 4 · 382 yd` (from the first hole in play order: hole 10 on a back-nine start). It lists your group with ghost par marks, you first. It's read-only: a preview of Enter's first rows.
- The other start times still peek under it.
- Primary **Go to hole 1**: opens Enter, and the tab bar appears. Secondary: **How today's game works**.
- Shown once per round per phone (`glb.seen.CODE.open`, as 025). After that, the round opens on Enter.
- **On the first open after it opened:** the same screen, without the motion.
- **A round made at the course (`14`):** no lobby to wait in. Opening the link (or finishing Setup) goes straight to this screen. The title is `You, Andrew, Sam and Jake`, the kicker on the card is `Hole 1 · par 4 · 382 yd · starting now`, and there's no peek row when there's one group.

## 4 · Someone who isn't playing (`15`)

From 026's “Not playing? Follow along”, or a phone that picks no name:
- **Top bar:** `Watching` (outlined avatar).
- **Kicker:** `Andrew's Saturday round · Match play`.
- **Title:** `8 playing at Twin Creeks`.
- **Sub line:** `Saturday, start times 8:40 and 8:50. The Board goes live with the first score.`
- **The start times**, as plain cards (nothing lit; nothing here is yours).
- **Buttons:** primary **Follow along** (opens the Board read-only once scores start; until then this screen); secondary **I'm playing · find my name** (back to “Which one are you?”).

## 5 · The organizer's lobby (`16`–`21`)

Where Setup lands (“Next: invite”, 030), with the share sheet open the first time. Also ⋯ → Host settings until scoring opens.

| Block | What it shows |
|---|---|
| Kicker | `Saturday · host` |
| Title | `7 of 8 have Golf Board` (N = claims with `in_app`, 025 §3). `All 8 have Golf Board` when everyone does. |
| Sub line | `Saturday 8:40 · Twin Creeks · Match play` |
| **Scoring row** | `Scoring opens at 8:10` / `by itself, 30 min before the first tee time` + ghost **Open now** (filled `surface-2`). |
| Tee times and teams › | Back into 030's steps for this round (until the first score). |
| Everyone · not in the app first | Each player not in the app yet has a **Share** pill (share sheet with their invite line). Players in the app show `✓ has it`; you show `✓ organizer`. **Up to 4 rows**, then `4 more · 3 not in the app yet ⌄` (expands in place). |
| Primary (pinned) | **Share the invite**. `Share the invite again` once all are in. **Go to hole 1** once scoring is open. |

- **Open now: confirm in place, no dialog (`19`).** The scoring row grows into the confirm:
  - `Open scoring now?` (`row`);
  - `Everyone can enter scores from now on, 30 min early. It can't be closed again.`;
  - **Not yet** (secondary) and **Open now** (primary, 48 px) side by side.
  - Not yet folds it back. Open now opens scoring (`openedEarly`) and the row folds to `Scoring is open · opened by you at 7:40 ✓` (`20`).
  - Only allowed on the round's date (025 §2).
- **Nobody in yet (`17`):** `1 of 8 have Golf Board` (you), every row Share.
- **No date or start time (`21`):** the scoring row becomes an amber problem row (`warn-bg`, 1.5 px `warn`): `Set the day and first tee time` / `scoring opens 30 min before it` › (opens 030's Tee times step with the date). The share message still works; players see `08`.
- **“See what players see”** moves into ⋯ (it was a second button in 025's host lobby).
- The organizer is also a player: once scoring opens, their phone gets the player's `13` like everyone else's.

## 6 · Copy

- Players see **“start time”**, never “tee time” or “lobby” (025 §7). The organizer's screens may say “tee time” and “host”.
- Times use the round's time zone (`settings.lobby.tz`). Countdown units: `2h 10m`, `42 min`, `1 min`, `Now`.

## 7 · For the build

- **This needs a database change.** Today `settings.lobby` and the `_lobby_gate` only switch on for Team Ryder Cup rounds. Every game now creates its round with `settings.lobby` (stage `ready` once tee times are set in Setup; 030), and the gate applies to all.
  - Additive SQL, as 025 §3: mirror it in `schema.sql`, `tests/mock-supabase.mjs` and a migration plus rollback file.
  - Old rounds keep `lobby: null` and behave as today.
  - **This touches joining and the scoring gate: run the full smoke suite before it ships.**
- The lobby reads only `lobbyState()` (025), plus a pure `lobbyHero(nowMs, startISO, tz)` → `{ kicker, hero, sub, lit }`. One unit test for it covering the four distances, `Now` and no date.
- A round created “to play now” sets `opensAt = now` at creation, so §3's screen is the first thing anyone sees.

| # | key | # | key |
|---|---|---|---|
| 01 | player-days | 12 | open-grow-090 |
| 02 | player-tomorrow | 13 | open |
| 03 | player-today | 14 | open-on-spot |
| 04 | player-hour | 15 | follow |
| 05 | player-nobody | 16 | host |
| 06 | player-all | 17 | host-nobody |
| 07 | player-single | 18 | host-all |
| 08 | player-nodate | 19 | host-confirm |
| 09 | slot-rider (typing) | 20 | host-opened |
| 10 | slot-rider-named | 21 | host-nodate |
| 11 | slot-2v2 | | |
