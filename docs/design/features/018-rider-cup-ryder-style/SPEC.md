# 018 · Partner “Rider” Cup on the Team Ryder Cup screens

Status: not built

Partner “Rider” Cup (game `carts`, 8 players in 4 carts or 6 in 3) adopts the Team Ryder Cup screens from handoffs 015 and 016. Same engine, same rules, same settings. What changes is how it looks and reads. Target screenshots are in `screenshots/`; the as-built Team Ryder Cup screens on `main` are the reference for anything not shown here. Mockups in `mockups/` are reference only (open with `?mode=light` for light).

## One rule for all of it

Everything is the Team Ryder Cup version **except colors**: Partner “Rider” Cup keeps the cart colors (your cart `cart-you`, the others `cart-a…d`) on every screen. Team Ryder Cup stays the only game where the other side is neutral grey.

## 1. Setup (same flow, no draft)

Course → Players → Game → **Carts** → **Tee times** → Start. Same screens as Team Ryder Cup's Carts (“Who rides together?”, tap two names to swap, Shuffle) and Tee times (“Who tees off together?”, optional times). The Draft step does not exist for this game.

- Carts keep their colors here: the cart card gets a 1px outline in its cart color (`cart-a…d`, yours `cart-you`) instead of the plain `surface-1` pair. Cart names stay (named on join, or the saved name per pair).
- **Matchups** (switch every 6 / at the turn, custom matchups, matchup win bonus) is Rider-only. Move it to one optional screen reachable from the Tee times step: a `nr-row` “Game & matchups · Optional ›” under the tee-time pairs. Default stays as today (every 6, win bonus +1). The old Step 4b screens go away.
- Round is live: unchanged.

## 2. Today's game: one page

Same single page as Team Ryder Cup: title, one-line rule, the two tiles become **your cart + your three opponents** (your cart tile in `tint-you`; the other three carts as plain `surface-2` tiles with a colored name), “2 points a hole” block, YOUR MATCHES list (Holes 1–6 vs …, 7–12 vs …, 13–18 vs …, each with the tee time or “in your group”). Drop the second page; its content (low ball / low total example) becomes the one sentence under the points block, as in Team Ryder Cup. Button: Let's play.

## 3. Enter (the big one)

Use `ryderEnterView` for `carts` rounds too (both 4-cart and 3-cart). Exactly the 016 layout:

- Header: Hole N, par · hcp · GPS state. Green card when GPS is on.
- **Your cart card** (`cart-you` outline): head = `vs` + the opponent cart's **name** in its cart color (not the two first names), THRU n, the match flag (UP in `cart-you`, DOWN `surface-3`, all square ring). Tap the flag → Matches.
- One **score pad strip** per player (par−1 … par+2 window, ‹ ›, remembered window per player per hole, tap again to clear). The − / + steppers are gone for this game.
- **Other cart slim row**: first names + score marks + Edit, with a **1px outline in that cart's color** and the names in that color. Edit flips it to the open card (ENTERING FOR THEM · Back), as in 016. 3-cart rounds: two slim rows (a cart has two matches per hole).
- Hole progress (18 segments, gaps after 6 and 12; for a 9-hole or at-the-turn switch, gaps where the rotation changes), sync state on the right.
- Next hole: plain, `surface-2` until every score in the group is in (“Next hole · 1 score left”), then `text`.
- Nothing else on Enter: no low ball / low total, no points. Those live on Matches.
- Never scrolls on an iPhone 16 (fit test).

## 4. Matches

The 015 Matches, with colors:

- Kicker HOLES 7–12 · LIVE, title `vs <cart name>` in the opponent's color, subline with their tee time and where they are.
- Rotation picker (1–6 · 7–12 · 13–18) with sublines: `won 7–5` / `live` / `up next`. History works the same way as Team Ryder Cup.
- Score card: THRU n · standing line, your cart name + points in `cart-you-text`, theirs in their color; the match bar fills `cart-you` from the left and the opponent's color from the right; “n pts left” · “6½ CLINCHES” (the matchup win bonus, when on, shows as one line under: “+1 to the winner”).
- Hole strip: six tiles, two dots each (low ball over low total). Solid = counted, colored by who won it (your green, their cart color, split for a halve); hatched = one cart in; dashed = nobody yet.
- Selected hole: names in cart colors over score marks, then Low ball · you / Low total · halved lines with the same dots.
- **Watching another match goes away from this screen.** Other matches open from the Board (tap a match row → the read-only `ryder-match` sheet), as in 015.

## 5. Board

Teams view = a hero card with the ranked carts (keep today's ranking, points, official solid + provisional hatched bars, colors, record line) and then the **rotation strips with match rows from 015** under the Teams / Players toggle: HOLES 7–12 · LIVE strip, one row per match (names stacked, in cart colors; the flag hangs off the center line: 2–2, 1 UP, ✓ 7–5, dashed with the tee time before it starts), done and up-next rotations fold. Tap a row → the read-only match sheet.

Players view: the 015 table, same columns in the same order: `#` · player · THRU · GROSS (to par over total) · PROJ · NET. Drop the gross/net toggle (both columns are there).

Headlines stay (they're Rider-only); they sit between the hero card and the toggle as today.

## 6. Scorecard

Unchanged. Already the 015 layout; carts keep their colors.

## 7. End of round

Unchanged for now (winner card, Finalize, recap).

## Not in this handoff

- Team Ryder Cup's end of round gets its own handoff (019).
- 2v2, Match play and Scorecard only keep their current screens.
- No engine or database changes. Official / provisional stays exactly as it is; only the visuals change.
