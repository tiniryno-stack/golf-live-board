A panel that slides up over the current screen for a quick side task, so you never lose your place.

**Consumer provides:** a title, an optional one-line subtitle, the content, and the confirm action (or none, when changes apply as you go).

**Use it for:** the handicap stepper, the full rules list, max score per hole, changing tees, fixing a hole's par or handicap mid-round, and the long-press score details on the scorecard.

**Rules**
- `surface-1` panel, `radius-sheet` top corners, `shadow-sheet`, a 40×5px grab handle, over a `scrim`.
- Header: `title`-weight 20px title, `small` subtitle, a 48px close button on the right.
- One primary action at the bottom (often "Done"); the tab bar hides while it's open.
- Height fits its content, up to about 85% of the screen; taller content scrolls inside.
- Closes on swipe down, on the close button, or on tapping the scrim. Slide up about 300ms ease-out.
- Don't stack a sheet on a sheet; go to a full screen instead.
