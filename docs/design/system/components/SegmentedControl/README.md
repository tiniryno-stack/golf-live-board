A track of 2–4 equal segments for switching views (matches, front/back nine) or picking one option (switch opponents, game options).

**Consumer provides:** the segments (a short label and optionally one short subline), the selected one, and onChange.

**Rules**
- Track is `surface-1` (`surface-2` in light), `space-1` padding and gap; the selected segment is `surface-3` with a soft shadow.
- Segments are at least `tap-min` tall: 48px for one line, 54px for label + subline.
- Keep segments sleek: one name and at most one short line (holes · result). Don't pack scores or extra stats into segments; show details below the control.
- A segment can carry a team color dot; never color the whole segment.
- Under a choice, a Hint can explain the selected option; it changes with the selection.
