# 007 · Quick players

This is the new **② Players** step for a round with a crew, and it replaces the old Players screen. It needs 006 (crews) first. All screens are 393 × 852 in dark and light, following Night Round: green means only "you", taps are 48px or more, and side tasks use sheets.

Screenshots are in `screenshots/<Screen>-{dark,light}.png`. Mockups are in `mockups/<Screen>.html`; add `?light` to the URL for light mode. Names and numbers shown are sample data.

## Quick-Players · normal
- The header, the step label "STEP 2 · PLAYERS", "Who's playing?" and the course card stay the same as today.
- **Last group chips:** label "LAST GROUP · <day> AT <course>". The first chip is primary (**+ All 8 from Friday**) and adds everyone from the crew's most recent round. The next chips are the 2–3 rounds before it ("Sat 2v2 · 4"). The row scrolls sideways. Tapping a chip ticks those players and leaves anyone already ticked.
- **Regulars list:** labeled "<CREW> · N PICKED", with a **Search** button on the right of the label. Each row (56px) has an initials avatar, the name, the handicap in mono, and a 28px checkbox. Tapping anywhere on the row toggles it.
  - You're always the first row: green avatar, "You" under your name, ticked.
  - Order: you first, then the most frequent players in recent rounds. The list scrolls past ~8 with a "+N more in the crew · scroll" hint.
- **+ Guest** sits under the list on the right and adds someone for this round only.
- The bottom button shows the count: **Next: pick a game · 4**.
- Tapping a handicap still opens the existing handicap sheet.

## Quick-Players-Search · searching
- **Search** turns the list area into a focused search field (2px border) that filters the crew as you type.
- Results come first. A non-member who has played with the crew before shows a note such as "Played once · Aug".
- Under "NOT IN THE CREW" is a dashed row, **Add "<query>" as a guest · this round only**.
- A line under the results keeps track of who's picked ("4 picked · Andrew D., Sean M., …").

## Quick-Players-Empty · brand-new crew
- The list shows only you, labeled "<CREW> · JUST YOU SO FAR".
- A dashed card follows: "Your regulars show up here", one line of copy, and **Invite crew** (opens the share sheet) and **Add by name**.
- A note explains that people added by name join the crew list after the round.

## Rules for the logic
- A guest who plays a round with the crew becomes a regular in the list next time, unless they're removed in crew settings.
- Picking 8 still routes to the cart game step, the same as today.

## New components (add to the design system)
- **Pick row:** avatar, name, mono handicap and checkbox, all as one toggle button.
- **Group chip:** a pill chip for a recent group. The primary version has a + icon.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
