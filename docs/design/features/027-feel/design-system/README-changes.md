# Design system README: the changes 027 makes

Apply these to `docs/design/design-system/README.md` (and the claude.ai design system page). Each block says which section, and gives the exact new text. Bump the README's version heading to **Version 4**.

## Depth: replace the "The one glow" bullet

- **Two glows, never more.** In dark mode the floating tab bar uses `shadow-dock` (a lit top edge plus a soft white glow). The one live thing on the screen that's yours may use `glow-you` (027): your live hole tile, your tee time on the day, your live rotation. Never both a lit thing and a second lit thing; never on anything that isn't yours; nothing is lit before it's live. Cards, segmented controls, selected segments and anything nested never glow. In light mode `glow-you` is `none`: the lit thing is `tint-you` + a 1.5px `cart-you` outline.
- **Peek:** what comes next (the next rotation, the other tee times) sits at the bottom edge at `peek` opacity (0.6). Inside a peek every text uses `text`, never `text-muted`, so 12px labels still pass 4.5:1. A peek wakes to full opacity, over `motion-grow`, when it goes live.

## Motion and gestures: replace the last bullet

- Motion is short and functional: **grow / fold** (`motion-grow`, 300ms, `cubic-bezier(.2,.8,.2,1)`; a fold on its own 225ms), **blur swap** when content changes inside a growing card (`blur-swap`, 8px), sheets (300ms), score bumps and the reward motion (021/022). Nothing else moves.
- **Grow where you tapped.** Looking at someone else's cart, match or tee time grows their row into a card in place; whatever was open folds back to its row in the same motion. No new screen, no sheet for this. Sheets stay for side tasks.
- Animate only right after a tap (`ui.foldIn`), never on a redraw. A tap mid-motion jumps to the end. Nothing pinned to the bottom (Next hole, primary button, tab bar) ever moves.
- **Reduced motion:** no blur, no size animation, no glow fade: things jump to their end size and the new content fades in over 150ms.

## Principles: add one bullet after "One screen does one thing."

- **One hero, one lit thing, the next thing peeks.** Each screen has one `number-xl` fact, at most one lit (live, yours) element, and what comes next waiting dimmed at the bottom edge. Finished things are solid and quiet, upcoming things are dashed.

## Interaction patterns: replace the "Expand in place" bullet, and add one

- **Grow card** for looking at someone else's cart, match or group: their quiet row grows into their card in place, yours folds into a row (with the green rail on Enter). See components/GrowCard. Replaces Expand in place and the "Their scores" / read-only match sheets.
- **New things go at the end.** Adding something is always the last row of its list, typed in place: add a player, add a tee time, name your cart. The add row is a 56px dashed `line` box; tapped, it becomes the input in the same box (solid `text` border + focus ring) and the keyboard opens. Confirming swaps the new item in with the blur swap and puts a fresh add row under it. No separate screen, no sheet.

## Direction table: change the Matches and Board rows' "Replaces" column

- Matches: … + "Expand in place for watching others" → now replaced by the Grow card.
- Board: "tap a row for a read-only sheet" → "tap a row and it grows in place (Grow card)".

## Components

- Add **Grow card** (`components/GrowCard/README.md`, in this folder).
- Mark **Expand in place** as retired once the 028 build lands (keep the README until no screen uses it).
