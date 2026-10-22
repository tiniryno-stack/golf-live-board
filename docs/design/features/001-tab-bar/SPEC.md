Status: built in eee3874

# Tab bar: floating glass pill, icons only

Replaces the current solid bottom bar on every in-round screen (Enter, Matches, Board, Card). Open `tab-bar-demo.html` in a browser to see and click it; it's plain HTML/CSS/JS and is the reference for behavior. `design-system-rules.md` is the same rule set as it appears in the design system.

## Look
- A full-width capsule: 16px from each screen edge, floating 24px above the bottom plus the safe area. Wide tabs are easy to hit with a thumb or a glove.
- Frosted glass: `glass` fill, `backdrop-filter: blur(22px) saturate(1.8)`, 1px `glass-line` border, `shadow-float`, 34px radius, 6px padding.
- **Icons only, no labels.** The screen title at the top already says where you are (Hole 11, Matches, Board, Scorecard), so every in-round screen needs a clear title.
- Four equal tabs that split the width (about 87×56 each on a 393px screen), each with a 22px icon. Tabs never change size.
- Active tab: the icon is `text`, on a soft `surface-3` highlight pill the size of one tab (radius 28). Inactive icons are `text-muted`.
- Icons are 2px-stroke line icons, the same four the app uses now: flag, two rings, list bars, grid.

## Motion (calm, Instagram-style)
- The only movement: the highlight slides to the tapped tab with `transform: translateX(index × 100%)` (the highlight is one tab wide), 280ms, `cubic-bezier(0.25, 0.1, 0.25, 1)`. No bounce, no scaling, no growing pill, no label animation.
- Icon color fades over 250ms.
- `prefers-reduced-motion`: the highlight jumps, no animation.

## Behavior
- Every tab needs `aria-label` (there is no visible text), and the active one gets `aria-current="page"`.
- **Enter dot:** an 8px `text`-colored dot with a 2px `surface-1` ring, top right of the Enter icon. It shows when your group's current hole is missing scores and hides when Enter is the active tab. Neutral color, never green or red.
- The bar never shows status text and never changes height.
  - Alerts like "Sean hasn't entered hole 11" don't go in the bar. They'll be a separate floating chip above it later, shown only when needed (not in this task).
- Hidden on setup screens and while a bottom sheet is open.
- Scrollable screens need about 110px of bottom padding so the last row scrolls clear of the bar.
- Remove the separate settings/sliders button that currently sits next to the bar. Its contents move into the header's ⋯ round menu.

## New tokens to add to tokens.css
| Token | Dark | Light |
|---|---|---|
| `--glass` | `rgba(24,26,31,0.72)` | `rgba(255,255,255,0.74)` |
| `--glass-line` | `rgba(255,255,255,0.09)` | `rgba(11,13,16,0.08)` |

Everything else uses existing tokens (`surface-3`, `text`, `text-muted`, `surface-1`, `shadow-float`).

## Done when
- All four in-round screens use the new bar, and the old bar and the settings button are gone.
- It works in dark and light, the highlight slides calmly between tabs, the Enter dot works, and nothing is hidden behind the bar at the bottom of a scroll.
