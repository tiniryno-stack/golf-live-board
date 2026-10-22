# 013 · Team Enter cleanup + the green card sizes itself

Status: built in 338441f (behind `FLAGS.gps`, off)

Two changes to the **team / cart-game Enter screen** (where you enter your score and your partner's), plus one rule for the green card component from 011. It builds on 011 (the card, its states and the numbers) and 012 (the tab bar). Do those first.

Screenshots are in `screenshots/Team-Enter-{GPS-off,GPS-on}-{dark,light}.png`. Mockups are in `mockups/Team-Enter-{GPS-off,GPS-on}.html` (clickable): add `?mode=light` for light mode. Sample data only. Screen size is 393 × 852, Night Round.

## 1 · Remove the rotation strip (always, GPS on or off)
Delete the strip under the hole header ("Rot 2 · vs Fore Play · UP 2 · 5–3 · thru 4"). Enter is for entering scores; match status lives on the Matches tab. Nothing replaces it. Everything else on team Enter stays as it is today: the name row, hole header, your cart card with both score pads at full size (88px − / +, 112px score mark), the other cart's row, the progress bar, Next hole, and the tab bar.

## 2 · GPS on: the green card under the hole
- The green card goes **directly under the hole header**, 10px down and 16px from each side. That's its home on every Enter screen.
- **The name row goes** (avatar, name, course · day). The course name moves into the hole subtitle: "Par 3 · Hcp 16 · Twin Creeks". The hole title is 36px.
- Everything else stays at full size, including the score pads and the progress bar.

## 3 · The green card sizes itself (component rule, also applies to 011)
**Don't hard-code a size per game.** The green card is one component with two sizes, and the screen picks one from the room it has:

| Size | Height | Green | Front / Back | Middle |
|---|---|---|---|---|
| **Regular** | 92px | 62 × 64 | 20px | 38px |
| **Compact** | 68px | 44 × 46 | 18px | 32px |

- **Rule:** use **Regular** when everything below it still fits above the tab bar without scrolling; otherwise use **Compact**. Measure the space; don't key it off the game type.
- On a 393 × 852 screen, both individual Enter and team Enter fit Regular now that the rotation strip is gone. Compact is for smaller phones (iPhone SE, 375 × 667) and any future Enter layout with more rows.
- If even Compact doesn't fit (very small screens), keep Compact and let Enter scroll. Never shrink the score pads below 80px to make room.
- **Same card everywhere:** same position, same states (011), not tappable, `role="group"` with an `aria-label` that reads all three numbers.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
