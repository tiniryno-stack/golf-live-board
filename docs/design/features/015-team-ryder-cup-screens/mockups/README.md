# Mockups

The screens live on the Design canvas: https://claude.ai/artifact/PpADT3Sjt2xMkjKKWjDHDA (Team Ryder Cup · Handoff 015).
Open it there to see them rendered, toggle dark/light per artboard (Tweaks → mode), and tap the interactive ones.

`canvas/` holds a copy of every artboard's source (`.dc.html`) plus `canvas.json` (which artboard is which, and the decision notes).
They need the canvas runtime to render; read them for markup, spacing and the sample logic. The files that matter:

| File | Screen |
|---|---|
| `Board-v2.dc.html` | Board (one file; `time` tweak = empty / early / mid / late / final). `Board-empty`, `Board-prog-early`, `Board-prog-mid`, `Board-final`, `Board-light` are the same file with a different default. |
| `Board-watch.dc.html` | Board → tap a match → sheet |
| `Matches-fill-waiting.dc.html` | Matches (one file; `state` tweak = waiting / partial / chasing / history). The other `Matches-fill-*` files are the same with a different default. |
| `Board-crosstee.dc.html`, `Board-names.dc.html`, `Cup-bar.dc.html` | Rules illustrated |
| `Setup-*.dc.html` | Setup ② ④ ⑤ ⑥ and Round is live |
| everything else | Archive (explored, not chosen) |
