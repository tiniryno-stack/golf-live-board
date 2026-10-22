The floating glass tab bar on every in-round screen: Enter, Matches, Board, Card, in that order.

**Consumer provides:** the active tab, the four destinations, and whether Enter has missing scores (shows a dot).

**Rules**
- A centered, content-width capsule floating 26px above the bottom (plus the safe area). Fill `glass` with backdrop blur(22px) saturate(1.8), a 1px `glass-line` border, `shadow-float`, 32px radius, 6px padding, 4px gap.
- Each tab is 52px tall. Inactive tabs show only their 22px icon (52×52, `text-muted`).
- The active tab grows into a `button` pill with its icon and label (15px, 700) in `on-button`. The label slides in by animating max-width and opacity over 300ms, cubic-bezier(0.2, 0.9, 0.3, 1).
- Every tab has an aria-label with its name, since inactive tabs show no text.
- Dot on Enter: an 8px `text` dot with a 2px ring when your group's current hole is missing scores. Neutral, never green or red.
- The bar never changes height or shows status text. Alerts like "Sean hasn't entered hole 11" are a separate floating chip above it, shown only when needed.
- Screen content gets about 100px of bottom padding so the last row can scroll clear of the bar.
- Hidden during setup and while a bottom sheet is open. Respect reduced motion (no width animation).
