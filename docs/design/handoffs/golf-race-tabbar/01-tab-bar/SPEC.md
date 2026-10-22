# Tab bar: floating glass pill ("dock 1")

Replaces the current solid bottom bar on every in-round screen (Enter, Matches, Board, Card). Open `tab-bar-demo.html` in a browser to see and click it; it's plain HTML/CSS/JS and is the reference for behavior. `design-system-rules.md` is the same rule set as it appears in the design system.

## Look
- A centered capsule that's only as wide as its content (not full width), floating 26px above the bottom plus the safe area.
- Frosted glass: `glass` fill, `backdrop-filter: blur(22px) saturate(1.8)`, 1px `glass-line` border, `shadow-float`, 32px radius, 6px padding, 4px gap.
- Tabs are 52px tall:
  - Inactive: 22px icon only, 52×52, `text-muted`.
  - Active: grows into a `button`-colored pill with icon + label (15px, weight 700), in `on-button`. Padding is 0 18px 0 16px, with an 8px gap.
- Icons are 2px-stroke line icons, the same four the app uses now: flag, two rings, list bars, grid.

## Motion
- Switching tabs animates the label's max-width (0 → about 90px) and opacity, plus the pill's background and padding, over 300ms, cubic-bezier(0.2, 0.9, 0.3, 1).
- Pressed: scale 0.96.
- `prefers-reduced-motion`: no animation, instant swap.

## Behavior
- Every tab needs `aria-label`, and the active one gets `aria-current="page"`, since inactive tabs show no text.
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

Everything else uses existing tokens (`button`, `on-button`, `text`, `text-muted`, `surface-1`, `shadow-float`).

## Done when
- All four in-round screens use the new bar, and the old bar and the settings button are gone.
- It works in dark and light, the label animates, the Enter dot works, and nothing is hidden behind the bar at the bottom of a scroll.
