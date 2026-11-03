# Mockups

The screen lives on the Design canvas: https://claude.ai/artifact/PpADT3Sjt2xMkjKKWjDHDA (Team Ryder Cup · Handoff 015), row **Enter · entering scores**.
Open it there to tap through it (pads, ‹ ›, Edit, the flag, Next hole, hole arrows) and toggle dark/light (Tweaks → mode).

`canvas/` holds the source of the two artboards in that row plus `canvas.json` (the decision notes). They need the canvas runtime to render; read them for markup, spacing and the sample logic.

| File | Screen |
|---|---|
| `Enter.dc.html` | **Enter · FINAL** — working prototype. `holeResult()` computes low ball / low total from the four scores; the flag and THRU come from counted holes only; the pad window is `par−1` by default, clamped to `1 … cap−3`, remembered per player per hole (`win`). The `pads` tweak (5/4) is there for comparison; 4 is the decision. |
| `Enter-today.dc.html` | Enter as built today (013 layout + 014 header), for comparison only. |
