# 020 · Brand mark, app icon and one loading screen

Status: not built

The app gets its mark (a ring and a green ball), a real home screen icon, a favicon, iOS launch images, and one loading screen that replaces the splash flag, the "Opening…" spinner and the No signal page. Assets are in `assets/`; the loading screen's states are in `screenshots/` and the animation in `mockups/Loading.dc.html` (open it in a browser next to `support.js`; `?state=opening|slow|nosignal&mode=light` freezes a state).

## 1. Files

- Replace `icon-180.png` with `assets/icons/icon-180.png` (same name, same `<link rel="apple-touch-icon">`). Keep the label "Golf Board".
- Add `assets/icons/favicon.svg` as `favicon.svg` at the repo root and link it: `<link rel="icon" href="favicon.svg" type="image/svg+xml">` plus `<link rel="icon" href="favicon-32.png" sizes="32x32">` (`assets/icons/favicon-32.png`).
- Add `assets/startup/*.png` under `img/startup/` and link each as an `apple-touch-startup-image` with the matching media query (standalone only reads these). The seven files are named by device and pixel size; the media queries are:

| file | media |
|---|---|
| startup-se-750x1334.png | `(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)` |
| startup-13mini-1125x2436.png | `(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)` |
| startup-14-1170x2532.png | `(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)` |
| startup-15-16-1179x2556.png | `(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)` |
| startup-16pro-1206x2622.png | `(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)` |
| startup-plus-promax-1290x2796.png | `(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)` |
| startup-16promax-1320x2868.png | `(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)` |

  Add `(orientation: portrait)` to each. Mark the startup images in CLAUDE.md as the reason the Add-to-Home-Screen link must keep working (no manifest, as before).
- `assets/logo/mark-dark.svg` / `mark-light.svg` go in `img/` for the Home header and the recap image stamp (below). The lockup PNGs are for the recap image only.

## 2. The loading screen (replaces `#splash`, the `loading-state` spinner and the No signal page)

One fixed, full-screen element, `bg` fill, that stays up from first paint until the first real screen is ready, then fades out over `280ms`. Never a blank frame and never a flash of Home between launch and a round opening from a link.

Layout (393 wide; same at every size):
- The mark: a 120px SVG, its top at **300px** from the top of the screen, centered. Exactly where the startup image draws it, so the handoff from the static launch image to the live screen shows no jump. Ring: `text`, stroke 13 in a 100-unit box, centered at (42, 58) r 30. Ball: `cart-you`, r 11 at (82, 20).
- "Golf Live Board", 20px 800 −0.6px tracking, 22px under the mark.
- A text area under that (min-height 120px, 32px side padding, centered) that holds the state.

States and timing (from the moment the screen appears):
1. **Launch, 0–1.5 s:** mark + name only. **The ball is a putt circling the hole:** it sits on the lip (center 44 units from the ring's center, so it overlaps the stroke by ~3 units) and orbits the ring clockwise, one lap every **1.0 s, linear**, starting from the top-right (45° up-right). It keeps circling as long as the app is loading. Under `prefers-reduced-motion` it holds at the top-right and nothing moves.
   **When the screen is ready to go** (Home rendered, or `app.snapshot` in): let the ball finish its current lap so it is back at the top-right (wait `1000 − (elapsed mod 1000)` ms from when the orbit started), then play the **drop**: 460 ms, `cubic-bezier(.4,0,1,1)`, the ball moves to the ring's center (translate −31, +31 in the 100-unit box) while shrinking to 55% at 70% of the way and to 22% + opacity 0 at the end; the ring dips 2px and settles over 420 ms at the same time. 60 ms after the drop ends, the whole screen fades out over 280 ms. Total from "ready" to the app: at most 1.0 + 0.46 + 0.28 s, usually under a second. Even a fast launch shows one full lap, which is the point: the putt always goes around once before it drops. If reduced motion is on, skip the lap wait and the drop: just fade.
2. **Opening, after 1.5 s** (only when the app is opening a round, i.e. today's `app.loading`): "Opening TC482…" in `body` `text-muted`, fading in over `280ms` with a 6px rise.
3. **Slow, after 8 s:** "Still connecting…" plus, in `small`, "Scores you enter are saved on this phone and sync when you're back."
4. **No signal, after 12 s** (today's `app.loadError`): the ball stops on the lip where it is. "No signal" 22px 700, the same reassurance line in `body` `text-muted`, and a primary button "Try again" (52px, `button`/`on-button`). Try again restarts at state 1 with the ball moving.

Rules:
- The mark and the name never move between states; only the text under them changes.
- Home with no round to open: the screen hides as soon as Home has rendered (today's `hideSplash`), so most launches only ever see state 1 for well under a second.
- A round opening from a link or the home screen app: the screen stays until `app.snapshot` is in, through states 2–4 as needed. Today's in-page `loading-state` and `loadError` views are no longer rendered; the loading screen covers them.
- The "Turn your phone upright" overlay stays above it.
- Theme follows `glb.theme` as today (the startup image is always dark; the live screen takes the theme within the first frame).

## 3. Where else the mark goes

- Home header: the 30px mark to the left of "Golf Live Board", ring centered on the capitals (the L2 lockup), 10px gap.
- Recap images (`recap.js`): the lockup PNG as the corner stamp, 18px tall, `text-muted`, bottom right, replacing the plain text stamp.
- Nothing else. Not on in-round screens, not in the tab bar.

## Not in this handoff

- No manifest (the Add-to-Home-Screen move link depends on there being none).
- No motion tokens yet (021).
