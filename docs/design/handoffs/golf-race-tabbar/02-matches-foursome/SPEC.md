# Matches: foursome split point ("The race")

The Matches tab for an **individual 4-player split-point game** (no teams). This replaces the current screen with the four colored player boxes and the hole table. Board stays the ranked list and Card stays the grid; this screen should feel like a game.

- `screenshots/`: the target look at three moments in a round (thru 7, 14, 17), dark and light. **Start here.**
- `mockups/`: the design-tool source for those screenshots, for exact sizes, spacing and copy. Don't copy the markup; rebuild it with the app's components and `tokens.css`.

## The game (split point)
- 1 point per hole, 18 total.
- The lowest score on the hole takes the point. If several players tie for low, they split it: 2 tied = ½ each, 3 = ⅓, 4 = ¼.
- A hole counts only once all 4 scores are in.
- **Winner:** most points after 18.
- **Tiebreak: most outright wins** (holes won alone). If that's still tied, it's a shared win.

## The math the screen needs
- `left` = 18 − holes completed.
- `leader` = player with the most points. `chaser` = 2nd most.
- **Lock line** = chaser's points + `left`. It's the most the chaser can still reach. It moves toward the pack as holes are played.
- **Locked:** the leader's points > lock line (their lead is bigger than the points left), so the match is decided.
  - Lead exactly equal to `left`: not locked. The chaser can only tie, and then the tiebreak decides. Say that in the headline.
- **OUT:** a player whose points + `left` < the leader's points. They can't catch up even by winning every remaining hole.
- **Reach tail** (dotted line after each player's marker): from their points to their points + `left`, capped at 18. Show it only for players still alive and not leading.

## Layout, top to bottom
1. **Header:** your avatar and name, course and day, and a ⋯ round menu (48px).
2. **Title block:**
   - Label: `SPLIT POINT · THRU 7` (mono, uppercase).
   - Headline: the one thing that matters right now. See "Headline copy" below.
   - One-line subline.
   - A ghost **Rules** button on the right that opens the Rules bottom sheet.
3. **The race card** (`surface-1`, radius 18):
   - One lane per player, sorted by points.
   - Each lane: name (you in green, others in `text`) and rank under it (`1st`, `2nd`, `T3`, or `OUT`).
   - A 0–18 track with a filled bar up to their points: green for you, `text-muted` for others. Then the puck: a mono pill with their points (`3¼`, green for you), then the dotted reach tail.
   - The **lock line**: a vertical dashed line across all lanes at the lock value, labeled `LOCK 13¼` above. Animate it moving after each hole.
   - OUT players drop to 40% opacity, with `OUT` in place of their rank.
   - Axis labels under the track: 0, 9, 18.
   - A small explainer at the bottom of the card: "The lock line is the most Andrew can still reach. Get past it and the match is yours. Dashes show how far each player can still climb." Consider showing it only for the first few holes, or behind the Rules sheet, once people get it.
4. **Now card:**
   - `NOW · HOLE 8 · PAR 5` and `1 PT UP FOR GRABS`.
   - The 4 players, each with a score mark (circle, square, etc.) if entered, or a dashed empty circle if not.
   - Tapping it goes to Enter.
5. **Tab bar:** the new icon-only glass tab bar from `01-tab-bar`, with Matches active. Content needs bottom padding so nothing hides behind it.

## Headline copy (computed)
- Leading, not locked: "You lead by 1" / "Andrew leads by ½" (fractions as ½ ¼ ¾ ⅓ ⅔).
- Tied for the lead: "All square with Andrew".
- One hole left and it decides it: "18 decides it". The subline says exactly what has to happen, e.g. "You lead by ½. Andrew has to win 18 outright."
- Locked: "You've locked it" / "Andrew's locked it". Subline: "Up by 3 with 2 left."
- Finished: "Mitchell wins". If the tiebreak decided it: "Mitchell wins on outright wins (3 to 2)".
- Sublines also call out eliminations once: "Justin and Peter can't catch you anymore."
- "You" = the person holding the phone. Green is only ever them.

## Rules
- Individual game: **no team or cart colors.** You're green; everyone else is neutral.
- Fractions use real glyphs in Geist Mono (`3¼`, not `3.25`).
- Score marks follow the design system (circle birdie, square bogey, red double square for double+).
- Every tap target is at least 48px. Check at 393×852 in dark and light.
- Update the Rules sheet for this game: "Points: 1 a hole, low score takes it, ties split it" and "Tie at the end: most outright wins".

## Out of scope
- The team cart-game Matches screen (it stays as is).
- The floating "Sean hasn't entered" alert chip.
