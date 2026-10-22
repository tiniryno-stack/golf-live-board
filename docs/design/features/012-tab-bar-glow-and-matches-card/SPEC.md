# 012 · Tab bar glow (global) + Matches score card

Status: built in 69f61d7

Two visual changes with no logic or data changes: a **global** change to the tab bar component, and a layout refresh of the team / cart-game Matches screen.

Screenshots are in `screenshots/Matches-{your-match,watching}-{dark,light}.png`; every screenshot shows the new tab bar. The mockup is `mockups/Matches.html` (clickable): add `?mode=light` for light mode, and `&view=other` to open with the other match expanded. Sample data only. Screen size is 393 × 852, Night Round.

## 1 · Tab bar glow: global component (do this first)
The floating tab bar (Enter · Matches · Board · Card) appears on every in-round screen, so change it **once, in the shared component**, not per screen.
- **Dark mode:** it glows, with a faint lit top edge and a soft white halo. This replaces its current dark drop shadow.
- **Light mode:** unchanged.
```css
/* dark  */ box-shadow: inset 0 1px 0 rgba(255,255,255,.10), 0 0 28px rgba(255,255,255,.06);
/* light */ box-shadow: 0 8px 24px rgba(11,13,16,.12);
```
- It's in the design system as the new token **`shadow-dock`** (shadow family). Add it to the app's tokens and use it on the tab bar.
- **Rule: the tab bar is the only thing that glows.** Cards, segmented controls, the selected segment, rows and sheets get no glow, and still have no shadow in dark mode. Nothing inside the tab bar glows either; the active-tab highlight stays a flat fill that slides.

## 2 · Matches: the score becomes the card
Before, the score, bar and points-left line sat on the background, and the hole table was in a card. That's now reversed:
- **Score card:** `surface-1`, radius 24, padding 18 / 14 / 14, 14px below the rotation picker. It contains, top to bottom:
  - A new kicker line in mono `label` style, `cart-you-text`, centered: **"THRU 4 · YOU'RE UP 2"** (or "YOU'RE DOWN 1", or "ALL SQUARE"). This is the only new text.
  - The existing team names, 5–3 score and "you / them" lines, unchanged.
  - The points bar: unchanged, now inset 4px inside the card.
  - "4 pts left · 1½ more clinches it": unchanged, inset 4px.
- **Hole table:** no card at all. It sits on the background, inset to 24px side margins, with the same columns, header, hairlines, rows and content.
- **Light mode score card:** `0 1px 2px rgba(11,13,16,.06), 0 10px 28px rgba(11,13,16,.09)`. In dark mode it has no shadow and no glow.
- **The rest is unchanged:** the match header, rotation picker (the selected segment is flat and has no glow), the "Also" row, expanding in place, and the pinned "Your match" bar when watching the other match.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
