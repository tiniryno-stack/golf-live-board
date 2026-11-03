# Team Ryder Cup · game rules and engine decisions

Everything the logic needs, decided in the design session on Nov 3. Build the engine from this; `SPEC.md` says how it looks. Where a rule changed from 014, this file wins.

## 1 · The game

- **16 players, 4 tee times, two sides of 8.** Each side is 4 carts of 2. Each tee time has one cart from each side.
- **Three rotations** of 6 holes by play order: 1–6, 7–12, 13–18 (real hole numbers when the round starts on 10, as today).
- **Schedule:** in rotation r (0, 1, 2) your side's cart i plays their cart `(i + r) mod 4`, carts numbered by tee-time order. So 1–6 is the cart in your own group; 7–12 and 13–18 are carts in other tee times. Nobody changes groups.
- **12 matches, 1 point each to the side.** A halved match is ½ each. **6½ wins the cup.** A 6–6 final is a shared cup (no holder rule).
- **Inside a match:** each hole is low ball (1 pt) + low total (1 pt), net, ties halve the point. 12 hole points per match; **6½ clinches**; 6–6 is halved. Hole points decide the match only; they never add to the side total.
- Carts and players are never ranked in this mode. The Board's Players view stays the normal net leaderboard.

## 2 · When a hole counts

- **A hole counts for a match only when all four scores are in.** Until then it contributes nothing: not to the hole points, not to the match state, not to the bar.
- A match is **not started** until its first hole counts, **live** from then until all six count or it's clinched, **done** when clinched or all six are in.
- **Clinch early = done.** `6½–1½ with 2 to play` is final; the remaining holes still get scores for the scorecard but don't change the match.
- Nothing is "provisional" in this mode. 014's provisional marker is dropped for Team Ryder Cup (it stays for Partner "Rider" Cup).

## 3 · Rotations and the day

- A rotation is **live** while any of its matches is live or not started with scores pending, **done** when all four matches are done, **future** when no match has a counted hole and nobody in it has teed off into those holes.
- **Two rotations can be live at once.** The early groups move into 7–12 while the 4th tee time is still finishing 1–6. Don't gate the next rotation on the previous one.
- Order on the Board: live rotation(s) first (most recent first), then done, then future.

## 4 · Visibility

- **Scores are never hidden.** As soon as a score is entered, every phone can see it, including an opponent who hasn't played that hole yet. (Reason: teammates can text, so a lock only adds friction.) Remove any "hidden until yours are in" logic from 014.
- The Board sheet and Matches both show whatever exists for a hole: both carts, one cart, or none.

## 5 · Per-match state the screens need

For each of the 12 matches:
- rotation, the two carts, each cart's tee time
- status: `notStarted | live | done`
- `thru`: holes counted
- `holePts`: [ours, theirs] as halves (e.g. 5, 3)
- `leader` + `margin` while live (`UP 2`, `½ UP`); `tied` when equal
- result when done: `won | lost | halved` with final hole points; `decidedEarly: n` holes left when clinched
- per hole 1–6: `lowBall: us | them | halved | pending`, `lowTotal` same, each player's net score or null, and `whoIsIn: both | us | them | none`
- "where the other cart is": the hole number the trailing cart is currently on (drives `on 12` and `they're on 15, you're on 17`)

For each side: total (halves), matches left, per-rotation tally, `clinched`, `needs` (points to 6½).

## 6 · Copy the engine produces

- Flag text: `8:40` (tee time) · `on 12` (trailing cart's current hole) · `2 UP` / `½ UP` / `1½ UP` · `3–3` · `7–5` · `6½–1½` · `6–6`
- Cup line: `12 MATCHES · 6½ WINS` → `N LEFT · 6½ WINS` → `FINAL`
- Match kicker: `NOTHING COUNTS YET` → `THRU n · YOU'RE UP n | YOU'RE DOWN n | ALL SQUARE` → `FINAL · YOU WON 7–5 | THEY WON 7–5 | HALVED`
- Bar line: `N pts left` / `X more and it's yours` (X = 6½ − ours, as halves) / `Decided with n to play`
- Hole lines: `Low ball · you | them | halved` · `Low total · …`; when only their scores are in: `Joseph made 4, Jay 5. A 4 halves low ball; 8 or better between you takes low total.` (compute from their two nets: tie low ball = match their best; take low total = beat their sum)
- MVP cart (final): most match points, tiebreak most hole points.

## 7 · Setup data

- `settings.game = 'ryder'`, requires exactly 16 players.
- `carts`: 8 pairs in list order by default; swaps edit the pairs.
- `sides`: two arrays of 4 cart ids. Captains = the first player on each side (cart 1 of each). Default side names "Team <captain first name>".
- **Draft** (organizer's phone): captains' carts pre-placed; remaining 6 carts picked in snake order **J, A, A, J, J, A** (the side that didn't get first captain picks first); Skip = carts 1–4 vs 5–8 in cart order.
- `teeTimes`: 4 groups, each `[sideA cart, sideJ cart]`, default by cart order; optional `HH:MM` per group (existing `settings.teeTimes`).
- Share text: course, first tee time, join link, side names, the four tee-time pairings, "New opponent every 6 holes. 12 matches, 6½ wins the cup."

## 8 · Dropped from 014 (don't build)

- Provisional points/chips in this mode.
- Hidden opponent scores.
- Host → New lineup (mid-round cart swap). If groups physically swap at the turn, nothing in the engine changes; the "where they are" line just converges.
- Headline ticker on the Board (014 §8 headline copy can still feed the Home summary and recap).

## 9 · Open (decide before build if it matters)

- Mid-round "they're on 15": needs each cart's current hole, which the app already tracks per group. Confirm it's exposed to other phones.
- Recap image: v2.
