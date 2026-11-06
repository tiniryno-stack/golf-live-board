# 024 · Who you are: phone owner, auto-join, “I’m not Baker”

Status: built in ab6445e

The logic and data for identity, built **before** the new onboarding screens (025). The owner's goals are:
- Friends never sign up and never pick their name twice.
- A fat-fingered name is one tap to undo.
- Playing as someone else (for testing, or when a phone is shared) never changes who the phone belongs to.

From 025 on, the app is only played as the home screen app. This spec builds that gate's logic behind a flag; the screens come with 025.

`screenshots/flow-map.png` is the whole flow on one page; `mockups/flow-map.html` is the same page. It's also on the App Screens canvas (https://claude.ai/artifact/8MbVkckNCqVo65jBGTEKSA), page **Identity & devices**, with the plain-English map above it. There are no new screens here, only the four small UI pieces in §5.

## 1 · Words (use them in code and comments)

- **Person:** the human (`personId`, name, crew). On the server; the same on every phone.
- **Device:** one browser storage (`glb.device`). Safari, the home screen app and each private tab are different devices, even on one phone.
- **Claim:** “this device is Andrew in round V4T3M” (`claims` table). One player per device per round, one device per player. **Unchanged.**
- **Owner (new):** the one person this device belongs to. `glb.owner = { personId, name }`.
- **Playing as:** the player this device has claimed in this round (`glb.me.CODE`, as today). Usually the owner; it can be someone else for one round.

## 2 · The owner

- **Set** the first time the device claims a player who has a `personId` and the owner is empty. Not from a practice round (`settings.practice`). Not from a round whose player has no `personId` (old rounds).
- **Never changed** by claiming someone else. Only “I’m not <name>” (§4) clears it.
- `db.owner.get()` / `set()` / `clear()` in `js/db.js`, through `db.local` (so `?sim=N` phones stay separate). Add `glb.owner` to `MOVE_KEYS`, so Add to Home Screen carries it.
- **Migration** (first run of this version, owner empty): the owner is the first crew's `me` (`db.crews`). If there's no crew `me`, use the first entry of `glb.people` (`glb.people` keeps the oldest first, so that's the person this phone played as first). If neither exists, leave it empty. The owner's own phone has Andrew as crew `me`, so it stays Andrew even though `glb.people` also holds Baker.
- `rememberCrewMe()` stays, but fills a crew's `me` from the owner, not from whoever was just claimed.
- `glb.people`: from now on, only the owner is added. `syncMyRounds()` uses the owner (fall back to `glb.people` only while the owner is empty).

## 3 · Joining a round (lane B of the flow map)

On opening a round in the app, in this order:
1. **This device already has a claim in this round:** open as that player (today).
2. **The owner is on the roster** (match by `personId`):
   - **Their spot is free:** claim it automatically (`claim_player`), with no Who are you?. Show the “Playing as” line (§5.3) for this round.
   - **Taken:** today's flow, Who are you? → taken → Ask to join → a phone in their current foursome or the organizer taps Let in. Pre-select the owner's name in the sheet, so it's one tap to ask.
3. **No owner, or the owner isn't on the roster:** Who are you?, grouped by tee time and cart (§5.1). Picking a name claims it. If the device has no owner, the first pick shows the confirm (§5.2) and then sets the owner. If the device has an owner, the pick is “playing as” only.
4. Watching stays as today: no claim, the Board.

The takeover stays **foursome + organizer only** (owner, Nov 6). No change to `_join_approver`.

Auto-join runs only on a real open, not on every render or poll. If it fails (`taken`, `already_playing`), fall through to the sheet; never loop.

## 4 · Undo and change

- **“I’m not Baker”** (You sheet, and the Playing-as line). One new RPC, `not_me(p_code, p_device_id)`, SECURITY DEFINER, returning `{ ok, error }`:
  - It deletes this device's claim.
  - It **relabels the scores this device entered as that player**, so they stop counting as the player's own entry (the `own_entry` rule in `upsert_score` keys on `updated_by` = the player's name). Set `updated_by = '<name> (picked by mistake)'`, only for that player's rows whose `updated_by` is still the player's name and whose `updated_at` is after the claim's `claimed_at` (the column already exists).
  - It logs the action.

  On the phone: **if the owner is that same person, clear the owner too.** That one rule covers both the first-pick fat finger (the mis-tap set the owner) and a hand-me-down phone (“I’m not Andrew” on Andrew's old phone). Then show Who are you? again: the real Baker can just pick his name, with no “taken”, and your pick sets the new owner, with the confirm. There is no separate “This isn’t my phone” button (owner, Nov 6: one action, not two).
- **Switch to watching** (today): `leave_round`. The owner is unchanged.

Mirror `not_me` in `supabase/schema.sql` **and** `tests/mock-supabase.mjs`. It's additive SQL (`create or replace function` + `grant`), so `apply_migration` works. Write it as `supabase/migrations/2026-11-XX-not-me.sql`.

## 5 · UI pieces (existing components only, no new tokens)

1. **Who are you?, grouped.** Today's `who` sheet, with the names in groups headed by `teeTimeName()` (“8:40 tee time”), then the cart within each group. Taken names keep today's look. Rounds without tee times fall back to `autoGroups` order with no headers.
2. **Confirm (first pick on a device without an owner):** a small sheet. Title `You’re Baker Test?` (full name, `fullName()`), one line `8:40 tee time · with Sean` (the cart-mate's first name), primary **Yes, that’s me**, secondary **Pick again**. It shows once per device.
3. **Playing-as line:** one quiet line (13px, `text-muted`) where the You sheet's name is shown. It reads `Playing as Andrew · Not you?` after an auto-join. When playing as someone other than the owner, it reads `Playing as Baker this round · this phone stays Andrew’s · Not you?`. `Not you?` runs §4's “I’m not Baker”.
4. **You sheet:** add `I’m not <name>` (the same action). That's the only identity action on the sheet besides today's Switch to watching.

## 6 · The app-only gate (logic now, screens in 025)

- `app.mustUseApp()` is true when **all** of these hold:
  - `FLAGS.appOnly` is on (default **off** in 024);
  - it's not standalone (`db.STANDALONE`);
  - it's an iPhone or Android phone (not a computer);
  - this Safari device has **no claim in this round**. Anyone already playing in Safari keeps playing; nobody is kicked out mid-round.
- While it's true, opening a round shows a placeholder (the current Home “Add to Home Screen” sheet with this round's name). 025 replaces it with the real landing. The move link must carry the round code, so the home screen app opens straight into that round.
- In Safari, after the user taps Add to Home Screen, store `glb.hasApp = true`. 025 uses it to say “open Golf Board from your home screen”.

## 7 · Gaps checked (and where they land)

| Gap | Decision |
|---|---|
| Practice-round fake names becoming the owner | Never set the owner from a practice round (§2). |
| A phone that already played as two people (the owner's) | Migration picks the crew `me` first (§2). |
| The fat-fingered player's scores locked as their “own entry” | `not_me` relabels them (§4). |
| Auto-join onto a spot someone else fat-fingered | It falls to taken → Ask to join. The mistaken phone can also undo with “I’m not X”. |
| People mid-round in Safari when the gate ships | Grandfathered by their claim (§6). |
| Private tab closed before adding the app | The claim sits on a dead device → the takeover handles it (today). 025 should push Add to Home Screen right after the pick. |
| A deleted app, a new phone, cleared data | A new device with no owner → pick + confirm → taken → takeover. The person is the same; never a second account. |
| Old rounds / players without a `personId` | No auto-join; Who are you? as today. |
| Two people sharing one phone | One owner; the other plays “as” each round (the line says so). |
| A hand-me-down phone | The new user taps “I’m not Andrew” once: it frees the spot and clears the owner, because the owner is Andrew. |
| Computer | Can't add the app; watching is allowed; scoring is not (025 decides the copy). |
| Trust | The same as today: friends, no passwords. Anyone can still pick any free name; the confirm and the undo cover mistakes, not bad actors. The organizer's Free up is the backstop. |
| The organizer's phone | The PIN is per device and already moves with Add to Home Screen; a lost phone = type the PIN again. No change. |

Open for 025 (onboarding screens): the landing copy, the private-tab advice, whether a computer gets watch-only, and the Android install prompt.

## 8 · Testing

- One unit test file `tests/identity024.test.mjs` for the pure parts:
  - the join decision `joinPlan({ owner, roster, claims, deviceClaim, practice })` → `'open' | 'auto' | 'ask' | 'pick'`, which you pull out of `app.js` so it can be tested;
  - the migration choice;
  - grouping for the sheet.
- This touches joining and the database (one new RPC). **That is what the smoke suite exists for: ask the owner for a smoke run before pushing** (CLAUDE.md, Testing).
- Replay check: open the real rounds (V4T3M, Oct 16, and the Bridlewood split-point round, Oct 20) in the mock as a device with an owner. It should auto-join the right player, and the rounds' results should be unchanged.

When built, set the status to “Status: built in <commit>” and add ARCHITECTURE.md §13a + the localStorage key list in CLAUDE.md (`glb.owner`, `glb.hasApp`).
