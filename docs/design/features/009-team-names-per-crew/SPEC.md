# 009 · Team names per crew

A crew remembers what each pair called their cart. It needs 006 (crews) first. Screens are 393 × 852 in dark and light, following Night Round.

Screenshots are in `screenshots/<Screen>-{dark,light}.png`. Mockups are in `mockups/<Screen>.html`; add `?light` to the URL for light mode. Sample data only.

## Team-Names-Carts · ④ cart setup
- This is the same screen as today's cart game setup, with the cart name row changed:
  - The name (15/700) has a mono tag under it: **YOUR USUAL** (your cart), **THEIR USUAL** (another pair's saved name), or **NEW PAIR**.
  - A new pair shows "Pick a name" in italic, secondary color.
  - The whole name row (48px or more, with a chevron) opens the picker.
- Copy above the grid: "Pairs that have played together before get their usual name back. Tap a name to change it."

## Team-Names-Picker · name picker sheet
- A tall sheet (starts 96px from the top) titled "Name cart A", with the pair under it.
- **YOUR USUAL** (or THEIR USUAL): the pair's saved name in an outlined card with "USED 6 TIMES · LAST OCT 16". If it's the current name it shows IN USE; otherwise it shows a **Use** button. A new pair doesn't get this section.
- **Search field:** "Search or type your own". Typing a name that isn't in the list offers it as a custom name. Next to it is **Shuffle**, which picks a random unused name.
- **ALL NAMES · N:** a scrolling list with 52px rows that fades out at the bottom. Names used by another cart in this round are dimmed and tagged with that cart ("CART B"), and can't be picked. The list can be as long as you like.
- The names shown are placeholder golf puns; use your existing list.

## Rules for the logic
- A saved name belongs to the pair within the crew, in any order (A+B is the same pair as B+A).
- The usual name is the one the pair used most recently. Picking a new name updates it.
- Two carts in the same round can't share a name.

## New components (add to the design system)
- **Usual card:** an outlined card with the name, mono usage stats, and a Use button or IN USE tag.
- **Tagged name row:** a cart name with a mono provenance tag under it.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
