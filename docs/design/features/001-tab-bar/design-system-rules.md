The floating glass tab bar on every in-round screen: Enter, Matches, Board, Card, in that order. Icons only, because the screen title already says where you are.

**Consumer provides:** the active tab, the four destinations, and whether Enter has missing scores (shows a dot).

**Rules**
- A full-width capsule: 16px from each screen edge, floating 24px above the bottom (plus the safe area). Fill `glass` with backdrop blur(22px) saturate(1.8), a 1px `glass-line` border, `shadow-float`, 34px radius, 6px padding.
- Four equal tabs that split the width (about 87×56 each on a 393px screen), each with a 22px line icon. No labels. Tabs never change size.
- Active tab: the icon is `text`, on a soft `surface-3` pill the size of one tab (radius 28). Inactive icons are `text-muted`.
- Switching tabs slides the highlight to the new tab: translateX, 280ms, cubic-bezier(0.25, 0.1, 0.25, 1). No bounce, no growing, no label animation. Icon color fades over 250ms. With reduced motion it jumps.
- Every tab has an aria-label, and the active one gets aria-current="page".
- Dot on Enter: an 8px `text` dot with a 2px ring when your group's current hole is missing scores. Hidden while Enter is active. Neutral, never green or red.
- The bar never shows status text and never changes height. Alerts like "Sean hasn't entered hole 11" go in a separate floating chip above it, shown only when needed.
- Every screen it sits on has a clear title at the top (Matches, Board, Scorecard, Hole 11).
- Screen content gets about 110px of bottom padding. Hidden during setup and while a bottom sheet is open.
