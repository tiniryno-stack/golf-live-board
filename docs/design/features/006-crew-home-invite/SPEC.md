Status: built in 65529e0

# 006 · Crew home + invite

Nine screens, each in dark and light, at 393 × 852. They follow the Night Round rules: dark by default, Geist and Geist Mono, green only means "you", red only for errors, and taps of 48px or more. All the logic, database work, the iPhone share sheet, toasts and confirms are yours; this spec covers what each screen shows.

Screenshots are in `screenshots/<Screen>-{dark,light}.png`. Standalone mockups are in `mockups/<Screen>.html`; add `?light` to the URL for light mode. Text shown is sample data.

## 1 · Crew card on Home
Sits between the header and **Recent rounds**. When a round is live, the existing **Playing now** card stays above it. The card uses the surface color (`--s1`), radius 22, and padding 16.

| State | Screen | What's on the card |
|---|---|---|
| Normal | `Crew-Home` | Name (22/800). "9 players · 14 rounds" (15, secondary). A mono line with the season and your place, e.g. "FALL 2026 · YOU'RE 3RD"; hide it when there's no season data. Two equal buttons: **Standings** and **Invite**. A ⋯ button (48px, top right) opens Crew settings. |
| Not named yet | `Crew-Home-Unnamed` | "Your crew" in secondary color as a placeholder. Primary button **Name your crew** opens the Start / name screen with an empty field. **Invite** stays available. |
| No crew | `Crew-Home-None` | Dashed-border card: "Play with the same people?", one line of copy, and a full-width primary **Start a crew** button. |
| In two or more crews | `Crew-Home-Switcher` | Label "YOUR CREWS · 2". A segmented switcher (44px tall inside a 4px track, the same as Front/Back 9) sits above the card. The card shows the selected crew. Remember the last one used. With 4 or more crews, the switcher becomes a horizontally scrolling row of the same pills. |

## 2 · Start / name a crew (`Crew-Start`)
- A back button, the title "Name your crew", and one line of help.
- A labeled input, 60px tall with a 2px border while focused, 24 characters max, with a counter.
- Optional suggestion chips (44px) that fill the field when tapped.
- A primary **Create and invite** button pinned to the bottom (it rides above the keyboard). It creates the crew and opens the share sheet right away.
- The same screen handles **renaming**: the title becomes "Rename crew" and the button becomes **Save**.

## 3 · Join (`Crew-Join`) and the dead-link error (`Crew-Join-Dead`)
- **Join** shows "INVITE FROM ANDREW", **Join Saturday Crew?** (34/800), the player count with "since <month>", an overlapping stack of initials avatars (6 plus a "+N" count), and the 3 most recent crew rounds as plain rows with no chevrons. The bottom has a primary **Join Saturday Crew** button and a text button **Not now**.
- **Dead link** is used for a reset or invalid link. It shows a 64px circle with a broken-link icon in `--err` (red is allowed here because this is an error), the heading "This invite link doesn't work anymore", and an explanation. Buttons: **Go to Home** and **Join a round with a code**.

## 4 · Which one are you? (`Crew-Which-One`)
- Shown right after joining. It lists the crew's players: initials, name, and handicap in mono.
- The selected row gets the "you" treatment: green border, tint, a green avatar and a check. This is the one place where green marks the player you're claiming.
- Players already claimed on another phone are dimmed (55% opacity), labeled "ON ANOTHER PHONE", and can't be tapped.
- The list scrolls. The bottom stack is a primary **I'm <name>** button, disabled until a row is picked, then **I'm new** (adds you as a new player) and **Skip**.

## 5 · Crew settings sheet (`Crew-Sheet-Settings`)
Uses the standard bottom sheet (scrim, 28px top radius, handle, × close), and the tab bar hides while it's open. It has four rows, each with a mono label and a 48px button on the right:
1. **Name**: **Rename** opens screen 2 in rename mode.
2. **Invite link**: the link in mono with **Copy**, which shows a toast.
3. **Reset link**: **Reset** asks for confirmation, then the old link goes dead and leads to the dead-link screen.
4. **Leave**: an outline **Leave** button that asks for confirmation. It isn't red, because leaving isn't an error.

## New components (add to the design system)
- **Crew card**: a surface card with title, meta, an optional mono status line, two equal actions and a ⋯ button.
- **Crew switcher**: the existing segmented control reused above the crew card.
- **Avatar stack**: 40px initials circles overlapping by 8px with a 2px ring in the background color, plus a mono "+N".
- **Claim row**: a selectable player row. Selected uses the "you" green; claimed is dimmed with a mono tag.
- **Invite link row**: a settings row with the link in mono and a Copy button.

## Testing
Don't run the full test suite or screenshot review after small changes. Run them once before pushing.
