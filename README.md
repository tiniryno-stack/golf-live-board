# Golf Live Board

A mobile web app where each foursome enters hole-by-hole scores and everyone sees one live leaderboard across tee times, plus the rotating 2v2 cart game (Match Play or Plus/Minus). Spec: [ARCHITECTURE.md](ARCHITECTURE.md). Build log: [BUILD.md](BUILD.md).

Live at **https://tiniryno-stack.github.io/golf-live-board/** once GitHub Pages is on.

## One-time setup

1. **Database** — `supabase/schema.sql` is applied to the `golf-live-board` Supabase project. If you ever need to re-run it: Supabase → SQL Editor → new snippet → paste the file → Run.
2. **GitHub Pages** — repo **Settings → Pages → Deploy from a branch → `main`, `/ (root)` → Save**. Takes a minute or two; then open the live URL on your phone.

No build step: push to `main` and Pages serves it. The browser only ever holds the publishable key (`js/config.js`).

## Running a round

1. **Organizer:** open the site → **New round** → Course (pick Twin Creeks; nothing is preselected; first tee Hole 1 or Hole 10) → Players (type names; optional strokes) → Teams (tap players into carts A–D, name them) → Matchups (carts swap every 6 by default; Shuffle if you like) → Game → **Save**.
2. Save shows the **join code + share link** (drop it in the group chat) and the **organizer link + admin PIN** (screenshot it, keep it private). This phone is the organizer automatically.
3. **Everyone:** open the link → **tap your name**. No PINs. New phones then get **Today's game**: two swipe cards (what a hole is worth, pushes, your three matchups, points up for grabs), then **Let's play** → Enter. Reopen it any time from the ⋯ menu.
4. **Enter:** your cart is on top (about 70%, always green to you); the cart you're playing sits greyed below as one row of small scores. Tap it to open it 50/50 and enter their scores; tap yours to go back. A blank tile shows a grey par: your first tap anywhere on it is par, then + for bogey or − for birdie. Leave it and **Next hole** saves it as par. Long-press clears. Tap **Next hole →** when the hole's done (blanks count as par). At the swap (7 and 13, or 16 and 4 when starting on 10) a **Switch it up** card shows the next matchup.
   - **Team names:** after you join, if your cart hasn't been named, pick one of six names (first cart to tap a name gets it). Tap your cart's name on Enter to change it.
   - **Leaving:** the ⋯ menu (or your name) → Go to Home (you stay joined) or Switch to watching (frees your name).
5. **Fixing:** tap the hole number for a grid of all 18 holes (or use ◀); holes two or more back open locked, so tap the box to edit. The **Card** works too (tap a shaded cell). The organizer can fix any cell and change rules, strokes, team names, par and hole handicaps from **Host** (the round button next to the tab bar).
6. **New phone / cleared browser:** open the link, tap your name → "That's me — ask my foursome". Anyone in your foursome taps **Let them in** (the organizer can too, or can **Free up** the name from Host).
7. **When it's over:** the Board shows a big Final card: tap it (or ⋯ → Round recap) for keepsake images (leaderboard, your scorecard, your cart, everyone) and **Save or share** any of them.
8. **Run it back:** Home → Run it back on a past round copies players, team names, carts and settings. **Season standings** live on Home.
9. **Practice rounds:** Host → Rules → bottom: **Reset scores** clears every score (same players, carts and joined phones; replay from hole 1). **Delete round** removes it for everyone. Delete your test rounds before the real one so they don't show up in Season standings.

## Testing with a laptop and a phone

Any browser counts as a phone. Each browser (and each private/incognito window) gets its own device ID, so a laptop, your phone, and an incognito window can be three different players. Create the round on one, open the share link on the others, and tap a different name on each. To test "Let them in", open the link in a new incognito window and tap a name that's already taken.

## Tests

```bash
npm install            # test tooling only (Playwright, supabase-js, Geist fonts)
npm test               # scoring + headlines: section 7 worked examples and scenarios
npm run test:fit       # every screen at iPhone SE / 13 mini / 15-16 / Pro Max sizes
npm run test:smoke     # two-phone run: blocked edit, hole-7 swap, offline queue, rejoin, reset, delete
```

The fit and smoke checks run headless Chromium against an in-memory stand-in for Supabase (`tests/mock-supabase.mjs`) that mirrors the database functions.
