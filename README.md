# Golf Live Board

A mobile web app where each foursome enters hole-by-hole scores and everyone sees one live leaderboard across tee times, plus Partner “Rider” Cup, the rotating cart game (Match Play or Plus/Minus; 8 players in 4 carts, or 6 in 3). Spec: [ARCHITECTURE.md](ARCHITECTURE.md). Build log: [BUILD.md](BUILD.md).

Live at **https://tiniryno-stack.github.io/golf-live-board/** once GitHub Pages is on.

## One-time setup

1. **Database** — `supabase/schema.sql` is applied to the `golf-live-board` Supabase project. If you ever need to re-run it: Supabase → SQL Editor → new snippet → paste the file → Run.
2. **GitHub Pages** — repo **Settings → Pages → Deploy from a branch → `main`, `/ (root)` → Save**. Takes a minute or two; then open the live URL on your phone.

No build step: push to `main` and Pages serves it. The browser only ever holds the publishable key (`js/config.js`).

## Running a round

1. **Organizer:** open the site → **New round** → **Course** (nearby courses load as soon as you open it, and the one you're standing at sits on top as **Looks like you're at** with a Pick button; or search by name; your group's courses are listed too. A club listed with two courses mixed together asks **Which course?** once) → **Players** (first and last name — only first names show during the round; recent players as chips; Hcp = strokes; the course line shows whether the card is ready — tap it for the **Scorecard check**, tees, first tee Hole 1 or 10 and the round name) → **Pick a game** (Scorecard only for any number, Match play 2–6, 2v2 with exactly 4, Partner “Rider” Cup with 6 or 8; the ones that don't fit are greyed with the fix spelled out) → **Start round**. 2v2 has one more screen (partners; switch never / every 6 / at the turn); Partner “Rider” Cup too (4 carts, or 3 with 6 players; tap two names to swap; optional **Game & matchups**: opponents switch every 6 or at the turn, keep tee times (default) or play together, Shuffle or Custom matchups, rules). A broken scorecard opens the Scorecard check instead of starting.
2. **Round is live** shows the **join code + share link** (Text the group / Copy link) (drop it in the group chat) and the **organizer link + admin PIN** (screenshot it, keep it private). This phone is the organizer automatically.
3. **Everyone:** open the link → **tap your name**. No PINs. New phones then get **Today's game**: two swipe cards (what a hole is worth, pushes, your three matchups, points up for grabs), then **Let's play** → Enter. Reopen it any time from the ⋯ menu.
4. **Enter:** in a team game your cart's two players are big stacked rows (− · score · +, always green to you); the cart you're playing is one slim row below with **Edit** to enter theirs (yours collapses to the slim row with **Back**). In a round without teams it's **you first**: your score is the big card, everyone else a row that says where their score came from (✓ from their phone / entered by you / waiting) — tap a row for a one-tap score pad that jumps to the next player. Every score wears its mark (circle birdie, double circle eagle, square bogey, red double square double+). A blank score shows a dashed par: your first tap is par, then + for bogey or − for birdie. Long-press clears. **Next hole →** unlocks once every box in your group has a score (until then it says how many are left, and tapping it points at who's missing — enter theirs or wait for their phone). At the swap (7 and 13, or 16 and 4 when starting on 10) a **Switch it up** card shows the next matchup.
   - **Team names:** after you join, if your cart hasn't been named, pick one of six names (first cart to tap a name gets it). Tap your cart's name on Enter to change it.
   - **Leaving:** the ⋯ menu (or your name) → Go to Home (you stay joined) or Switch to watching (frees your name).
5. **Fixing:** tap the hole number for a grid of all 18 holes (or use ◀); holes two or more back open locked, so tap the box to edit. The **Card** works too (tap a shaded cell). The organizer can fix any cell and change rules, strokes, team names, tee times, par and hole handicaps from **Host** (the round button next to the tab bar).
6. **New phone / cleared browser:** open the link, tap your name → "That's me — ask my foursome". Anyone in your foursome taps **Let them in** (the organizer can too, or can **Free up** the name from Host).
7. **When it's over:** the Board shows a big Final card: tap it (or ⋯ → Round recap) for keepsake images (leaderboard, your scorecard, your cart, everyone) and **Save or share** any of them. Once everyone's checked their card, the organizer taps **Finalize round** (under the Final card, or Host → Rules): scores lock for everyone. Your phone locks too: to fix one, Enter → **Fix a score** (one tap on the organizer's phone, the PIN on anyone else's), then **Done** to lock it again; Host can **Reopen round**. Finished rounds open on the Board.
8. **Run it back:** the round's ⋯ menu → Run it back copies players, team names, carts and settings. **Season standings** live on Home.
9. **Other games:** Scorecard only works for any number (foursomes made automatically, as even as possible). **Match play** (2–6; also Host → Rules mid-round, which recounts from hole 1): everyone plays their own ball, each hole is worth 1 point, the low score takes it and a tie for low splits it. **2v2** (exactly 4): Low Ball + Low Total per hole between the two pairs; with switching partners everyone partners with everyone, and the Board ranks the four players on their points. Matches shows each match with the other one expanding in place; the Card shows your group with the other group expanding in place.
10. **Practice rounds:** Host → Rules → bottom: **Reset scores** clears every score (same players, carts and joined phones; replay from hole 1; reopens a finalized round). **Delete round** removes it for everyone. Delete your test rounds before the real one so they don't show up in Season standings.

## Testing with a laptop and a phone

Any browser counts as a phone. Each browser (and each private/incognito window) gets its own device ID, so a laptop, your phone, and an incognito window can be three different players. Create the round on one, open the share link on the others, and tap a different name on each. To test "Let them in", open the link in a new incognito window and tap a name that's already taken.

## Test with 8 phones (laptop or phone)

Open **https://tiniryno-stack.github.io/golf-live-board/sim.html**. On a laptop you see all 8 side by side; on a phone you see one test phone at full size with buttons **1–8** (with names) to switch between them — the other 7 keep running, and **Play a hole** still plays all 8 (Reset / Delete / the Next-hole checkbox are under **More**). **Make a practice round** creates a real round (Twin Creeks, 8 players in 4 carts, named "Practice · date time", on its own crew so it never shows up in your group's Season standings) and shows 8 small phones, each its own device signed in as a different player. Phone 1 is the organizer (its PIN is shown at the top).

- Tap scores on any phone like a real player, or **Play a hole**: every phone enters a realistic score for its own player, then taps Next hole (uncheck "Tap Next hole after" to do that yourself).
- **Other group only** / **Phone 1's group only** puts one foursome ahead, so you can see provisional points, swap cards and headlines land.
- **Reset scores** replays from hole 1; **Delete round** removes it. **Reopen last practice** brings the phones back after a reload. You can also open any round by code (phones sign in as players 1–8 where those names are free; the rest watch).

## Tests

```bash
npm install            # test tooling only (Playwright, supabase-js, Geist fonts)
npm test               # scoring + headlines: section 7 worked examples and scenarios
npm run test:fit       # every screen at iPhone SE / 13 mini / 15-16 / Pro Max sizes
npm run test:smoke     # two-phone run: blocked edit, hole-7 swap, offline queue, rejoin, reset, delete
npm run design:compare # design mockups vs the app, side by side → tests/screenshots/design/vs-*.png
```

## Home screen app

On iPhone, Home shows **Add to Home Screen** in Safari. Use that button (then Share → Add to Home Screen):
it carries this phone's sign-in, rounds and crew into the home screen app, which otherwise starts fresh
(iPhone keeps its storage separate from Safari's). Round links and join codes are always safe to share;
only the link shown during that step carries your sign-in.

## Design

The look ("Night Round") is defined by the design system in `docs/design/design-system/`: `tokens.css`
(colors for dark + light, spacing, corner sizes, sizes, shadows and the 6 type styles), the rules in its
`README.md`, and one spec per component in `components/`. `css/styles.css` uses those token names and
values; product rules are in `docs/design/designspec.md` and the mockups in `docs/design/screens/`.

The fit and smoke checks run headless Chromium against an in-memory stand-in for Supabase (`tests/mock-supabase.mjs`) that mirrors the database functions.
