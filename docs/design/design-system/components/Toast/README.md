A small pill that slides up from the bottom to confirm an action ("Link copied", "Score saved"), sometimes with Undo; plus the connection pill.

**Consumer provides:** a short message, an optional Undo action.

**Rules**
- `surface-2` pill, `shadow-float`, a check icon in `text` (neutral, never green), 15px `body` text, at least 48px tall.
- Sits above the tab bar or primary button, centered. Slides up and fades in (200ms), leaves after 2 seconds, or 5 seconds when it has Undo.
- Use for one-off actions: copy, share, remove a player (with Undo), save a scorecard fix. For repeated actions like entering scores, an inline check on the row is enough.
- Connection pill: an outlined `line` pill with a `warn` dot, "Reconnecting… scores will send when you're back", under the header until the connection returns.
