A labeled text or number input with focused, error and warning states.

**Consumer provides:** a visible label, the value, an optional placeholder, input mode (text or numeric), and an error or warning message when there is one.

**Rules**
- 52px tall, `radius-md`, `surface-1` fill, 1.5px `line` border, `row`-size text.
- Focused: `text` border plus a 2px `focus` ring offset 2px.
- Error: `error` border and a one-line message under it in `error` that says how to fix it. Blocks progress.
- Warning: `warn` border and message. Doesn't block progress.
- Always a visible label above; placeholders only show an example ("e.g. Tyler").
- Numbers (par, handicap) use the numeric keyboard; handicaps are usually changed with the stepper in a Bottom sheet instead.
