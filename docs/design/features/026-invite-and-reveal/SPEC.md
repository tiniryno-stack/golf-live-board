# 026 · The invite and the press-and-hold reveal

Status: built in 415229e (branch claude/new-session-a0hcnv; preview, not merged to main). Council: frontend 7 → 9 → 9, interaction 6 → 8 → 9, red team 6 → 8 → 9.

**What this changes:** two player screens from handoff 025 (§6 "Join: the handicap flow"), and nothing else.
1. The **invite** (025 step 1, `invite()` in `js/screens/lobby.js`) gets a new layout.
2. The **reveal** (025 step 4, `reveal()` + `revealFrame()` in `js/lobby.js`): the blur-and-roll is replaced by **press and hold**.

Everything else in 025 stays as built: the guide (step 1 of 2), Who are you? (step 2 of 2), the lobby, the stages, the server. The once-per-phone rule (`glb.seen.CODE.hcp`, `revealCtx`), "skip the reveal when there's no handicap", and the organizer never seeing his own reveal all stay too.

**Base branch:** 025 is built on `claude/new-session-a0hcnv` and is **not on `main` yet**. Build 026 on top of that branch (or on `main` once 025 is merged).

**Owner's goals (brief, Nov 7):** it reads as an invitation; each thing is said once; it uses the screen; it's home screen first; and the reveal is suspenseful and grand. The owner picked press and hold from three concepts.

## Screens

| # | File | Key |
|---|---|---|
| 01 | `screenshots/01-invite.png` | invite |
| 02 | `screenshots/02-hold-idle.png` | reveal · idle |
| 03 | `screenshots/03-hold-quicktap.png` | reveal · quick tap (nudge) |
| 04 | `screenshots/04-holding.png` | reveal · holding |
| 05 | `screenshots/05-burst.png` | reveal · burst |
| 06 | `screenshots/06-final.png` | reveal · final |

Mockups (reference only; rebuild in the app's components): `mockups/invite.html`, and `mockups/reveal.html` (concept 1 is the one; concepts 2 and 3 were rejected). Sample data: Baker, 12, 9th of 16, field 4–20.

## 1 · The invite (01)

Top to bottom, at the page's normal gutters:
- **Who invited you:** avatar (44, the host's initial, `surface-2`) + "**Andrew** invited you" (17, the name in `text`, the rest `text-muted`). Use `st.hostName`; with no host name, "You're invited" and no avatar.
- **The round name, big:** `event.name` at **64 / 800**, letter-spacing −2.5px, line-height 64, wrapping onto two lines if it needs to ("Chuck's / Bday").
- **What and where:** "TEAM RYDER CUP · TWIN CREEKS" (the 12 mono label, in `text`), using the course's short name.
- **When:** "Sat, Nov 14 · 8:00 start" (17 mono). Always the real date (`st.date`) and the first start time (`st.startLabel`). If there's no start time yet, show the date only ("Sat, Nov 14"). Never just "Saturday".
- **Who's in:** label "10 OF 16 ARE IN", then a grid of 16 faces (8 across, initials). A filled face (`surface-2`) = that player has claimed their spot; a dashed ring (`line`) = not yet. Order = the roster's A–Z join list. "In" comes from `claimed_players`, which the app already reads, so there's **no new database read**. No names, and no green: nobody is "you" yet.
- **Spacer**, so the action sits at the bottom.
- **One line above the primary:** "Your handicap opens in Golf Board on your home screen. About a minute." (15, `text-muted`). On a phone that isn't iPhone Safari (no guide), drop this line.
- **Primary:** **Reveal my handicap** (unchanged action: `lb-guide` on iPhone Safari, else `lb-find`).
- **Quiet:** "Not playing? Follow along" (`lb-follow`, unchanged).

The 025 kicker/headline/sub ("Andrew set your handicap", "16 players. Two teams. One cup.") are gone from the invite: the reveal screen now says "Andrew set your handicap". The 025 notice card stays (above the line, if any).

## 2 · The reveal: press and hold (02–06)

### Idle (02)
- Kicker: "CHUCK'S BDAY · BAKER" (label, `text-muted`). Title: "**Andrew set your handicap**" (the page title style).
- Centered in the remaining space: a **240pt disc** (`surface-2`, a faint inner highlight) with a **?** at 64 mono in `text-muted`. It **breathes** (scale 1 → 1.025, 2.6 s, ease-in-out, looping).
- Under it: "PRESS AND HOLD" (13 mono label, `text-muted`). After 3 s with no touch, it brightens to `text` twice (1.2 s each) as a cue.
- Under that: quiet **Just show me** (15, `text-muted`, 44pt tall).
- The green ring (below) is **not drawn at all** until the fill starts (opacity 0). An empty ring with a round line cap shows as a stray green dot.

### Holding (04)
- Pointer down on the disc: the breathing stops, the label reads "KEEP HOLDING", and **Just show me fades out** while the finger is down.
- A **green ring** (`--cart-you`, 4pt stroke) fills clockwise from 12 o'clock **on the disc's edge** (r = 118 in a 240 box), over **1.4 s** of holding.
- Past 35% the disc **shakes** (a 0.1 s jitter loop), and the title dims to 40% as the ring fills.
- **Let go early:** the ring drains back over 0.4 s, the label returns to "PRESS AND HOLD", and Just show me comes back.
- **Quick tap (03):** a press under 250 ms gives a sideways **nudge** (±6px, 0.35 s), and the label says "KEEP HOLDING".

### Burst (05)
- At full: **freeze 150 ms** (no shake, nothing moves). Then, at once:
  - a solid green ring bursts out from the disc (scale 1 → 1.6, fading out, 0.6 s, ease-out);
  - the disc background clears and the ring fades;
  - the **12 replaces the ?** at its final size (64 mono, `text`) with a small landing bounce, no resizing afterwards;
  - the kicker turns green (`--cart-you-text`: it's you), and the title changes to "**Andrew has you at**" (stays `text`, not green).
- **Check on a real phone:** the council flagged that the burst may read as a soft ripple. It should feel like a pop at its peak. Tune the first ~100 ms (opacity and spread), not the colors.

### Final (06), 900 ms after the burst
- Fading in, in order (220 ms apart), with **nothing moving or resizing**:
  1. Under the number: "**You get 12 strokes: one on each of the 12 hardest holes.**" (17, `text-muted`, centered, max ~300pt). Use "1 stroke: on the hardest hole" for 1; skip the line for 0.
  2. **The field:** a thin rail with a tick per player at their handicap (`text-muted`, 55%), the field's min and max at the ends (12 mono), and yours taller in green with the label "**You · 9th of 16**" above it (12 mono, green). Ties share a rank ("You · T9th of 16" when tied). Owner: the rank stays (it's trash talk). This replaces 025's `rankLine` sentence on this screen.
  3. "Think it's off? Text Andrew." (15, `text-muted`, **plain text, no button**).
  4. **800 ms later:** the primary **See who you're up against** (`lb-revealed`, unchanged).
- The number sits between the title and the note. Keep the gaps even, and don't leave a big empty band.

### Just show me, keyboard, reduced motion
- **Just show me**, and **Enter / Space** on the focused disc: skip the hold and go straight to the burst (no freeze).
- The disc is a `<button aria-label="Reveal your handicap">`. When the number lands, announce "Andrew has you at 12" (`aria-live="polite"` on the number).
- **Reduced motion** (`prefers-reduced-motion`): no breathing, shaking or burst. The disc shows "Tap to reveal" with a visible **Reveal** button under it (a normal tap, no hold). Then the final frame appears at once (06), with a short fade at most. Test it with VoiceOver.

### Touch rules
- `touch-action: none`, `-webkit-touch-callout: none`, no text selection, and `contextmenu` prevented on the disc (no iOS magnifier or long-press menu).
- Pointer up, `pointercancel` and `pointerleave` all count as letting go.
- The fill runs on `requestAnimationFrame` from real elapsed time, so a slow frame doesn't change the 1.4 s.

### Plays once, and See it again
- Played once per phone per round (025's `glb.seen.CODE.hcp`). It's marked seen **when the number lands**, not on tap, so killing the app mid-hold shows the hold again.
- **See the reveal again:** the lobby's "Your handicap · 12" card gets a quiet "See it again ›" that replays the whole screen (idle → hold). It doesn't change `seen`.
- **Render loop:** the app redraws constantly. Keep the hold state in `app.ui.reveal` (`{ code, pid, phase, v, t0 }`) and let `mount()` drive the frames, like 025's `revealFrame`. A redraw must never restart or drop the hold.

## 3 · Design system notes (flag, don't invent)

These are new patterns, reviewed by the council and accepted by the owner for this screen only:
- **64 / 800 headline** on the invite: the 64 size exists; the 800 weight in sans is new.
- **The disc, the ring and the burst glow.** The design system says only the dock glows. The burst is a 0.6 s moment, not a resting glow, and the green field tick's soft glow is the same exception. Keep both on this screen only.
- **The faces grid** (8 across, initials, dashed for not-yet).
- **The field rail.**

No new colors: everything uses `--surface-2`, `--line`, `--text`, `--text-muted`, `--cart-you` / `--cart-you-text`. Light mode: the same tokens, so check the disc's contrast on light `surface-2` by reading the CSS.

## 4 · Not in this push

- The Add to Home Screen guide redraw from the owner's iOS 26 Safari screenshots (pending; the guide stays as 025 built it).
- Carrying the invitation style to the guide, Who are you? and the lobby (a later handoff).
- Haptics (Safari has no vibration API on iPhone).

## 5 · Testing

- `npm test` only: **no smoke suite, no fit suite, no screenshots** unless the owner asks.
- One unit test file, `tests/reveal026.test.mjs`, for the pure parts. Pull these into `js/lobby.js`:
  - the hold step `holdStep(v, dtMs, holding)` → new v (1.4 s fill, 0.4 s drain, clamped);
  - the phase from elapsed time (`idle / holding / freeze / burst / final`);
  - the strokes line (0, 1 and 12);
  - the rank label with ties ("9th", "T9th");
  - the tick positions (min → 0%, max → 100%, one-player field);
  - the invite's "in" faces from `claimed_players`.
- Remove or update 025's `revealFrame` tests that no longer apply.

When done, set this to "Status: built in <commit>" and add a line to ARCHITECTURE.md §13a.
