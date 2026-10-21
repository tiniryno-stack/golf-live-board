The scorecard mark drawn around every score: double circle for eagle or better, circle for birdie, plain for par, square for bogey, double square in `double` for double bogey or worse.

**Consumer provides:** the score, the hole's par, and a size (24–28px in scorecard cells, 40px in rows, 112–124px on the Enter hero).

**Rules**
- Use it everywhere a score appears: Enter, scorecard, player card, score pickers. Never show a bare score where a mark belongs.
- Eagle and double use a CSS double border (`border-style: double`, 4–9px depending on size) so the mark stays inside its box and never overlaps a neighbor.
- Circle and eagle strokes use `text`; the bogey square uses `text-muted`; double uses `double` with a `double-bg` fill and `double` text.
- Square corners are about 16% of the size (`radius-sm` at cell size).
- A score not entered yet: dashed circle in `line`, the par value shown in `text-muted` at reduced opacity.
- Don't color birdies green or use red for anything but double+.
