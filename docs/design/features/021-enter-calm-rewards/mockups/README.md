# Mockups (reference only — rebuild in our components)

- `enter-states.html` — every static state. Open it in a browser from this folder; pick the state with the URL hash, e.g.
  `enter-states.html#{"div":"faint","more":"dots","a":3,"b":5}`. Keys: `a` `b` (your cart), `c` `d` (theirs), `par`, `hole`,
  `mode:"them"` + `refused:true` (their sheet), `sheet:true` (More sheet for Sean), `offline:2`, `ro:"preview"|"locked"` (+ `yds`),
  `gpsOff:true`. Always add `"div":"faint","more":"dots"` (the chosen look).
- `enter-motion.html` — the reward animations. Tap the score buttons; tap the Sam / Jake row to fill their scores and see the hole points.
  Hash keys as above plus `last` (who was just tapped). Reduced motion is honoured (`prefers-reduced-motion`).
- `canvas/Play.dc.html` — source of the playable artboard on the design canvas (needs the canvas runtime; read it, don't run it).
  It has the More sheet and three holes (par 3 / 4 / 5) so triple and quad bogeys can be tried.
- `greencard.css` — a copy of the app's `.green-card` rules so the mockups draw the real yardage card. The card itself is **not** part of this change.

Both HTML files load `../../../design-system/tokens.css` and the Geist fonts from the repo's `node_modules/geist` (run `npm install` first).
