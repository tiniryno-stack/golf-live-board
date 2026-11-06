# Onboarding council · round 4

Scores: r1 6 · 6.5 · 6 · Red 5 → r2 7.5 · 8 · 7.5 · 7 → r3 8.5 · 8.5 · 8.5 · 8 (Interaction · Visual · Product · Red). Context as before (../BRIEF.md, ../r2/BRIEF.md, ../r3/BRIEF.md). Files: `flow.png`, `contact1.png` (1–13), `contact2.png` (14–26), `contact-light.png` (12 screens), `contact-big.png` (120% text), singles `NN-name.png`. Screen numbers changed again; the flow map labels them.

## What changed from round 3
- **Search field is a true 44pt** (it was being squashed by the overflowing list; every page now stops children shrinking). Measured: 44.
- **Approver sheet (17):** shows "his other phone (last used 8:02)"; **Not him** is a full secondary button. Behaviour (spec, not pixels): it never pops over Enter mid-tap. It waits until the approver's current score has saved and no pad is being touched, and both buttons ignore taps for the first 1 s. If Sean's old phone is still active it's asked first ("Is this you on a new phone?"). Once anyone answers, it closes on every phone with a toast ("Mitch let Sean in"). **Host's Let in (26) opens this same sheet.**
- **Wrong name (18):** the 3 scores stay "unlocked and flagged on his phone to check". This matches 024: `not_me` removes their own-entry protection and the real Baker's Enter flags those holes. Cancel is a full secondary button.
- **Pending approval in the app (16, new):** "Almost in, Sean · this moves on by itself", for someone who added the app while waiting (no fake Welcome, no blank screen). Waiting in Safari (15) and 16 both offer **Text Mitch to open Golf Board** (share sheet, ready message).
- **Can't add it now (7):** names whoever in the cart actually has Golf Board, else "Andrew can". **Mitch is told once (21)**: "Baker is watching today · you enter his scores · when he adds it, his row goes back to him". Host (26) has a **Needs you** section: an amber-dot cart row "Justin + Chuck · Enter for them" (the organizer override) and "Sean's new phone · Let in", with pills ≥ 44pt; full-weight names; sorted by urgency.
- **Watching:** the spectator version (19) says "Playing today? Find my name ›"; a person Safari already knows (20) sees "Baker, add Golf Board to score ›" → the guide.
- **Night before:** landing (2) says "Chuck's Bday is tomorrow at Twin Creeks · set it up tonight, and in the morning it's one tap". Welcome (10): "Sat Nov 9 · 8:20 tee time. Your match shows up in the morning" + **How tomorrow's game works**.
- **You have the app (12):** a plain-sentence code card ("Round not there? In Golf Board, tap Have a link or code? and paste:"), V4T3M at 17 mono, a 44pt **Copy code** pill. **Add it again** (secondary, a Button variant in the design system) now asks your name first (→ 3), so the new icon carries it.
- **Guide (5):** "Don't see ⋯? Tap the address bar first" for iOS 26's collapsed bar.
- **Visual:** the Welcome note sits right above its button; "8:20 tee time, with Mitch" headline (11); the cart-mate Enter (22) is rebuilt like the real calm Enter (header ◀ ▶ ⋯ at 44pt, match line, grouped card, ScorePads, the app's own tab icons).
- Still to verify on real phones before building (spec): the x-safari- link per app, where iOS 26 puts the icon, that 8 shows after a cancelled menu, the funnel events (shipped in the first build).

## Deliver (strict, under 250 words)
1. Score 1–10.
2. Anything still wrong, most severe first.
3. Ship it? If not, what exactly stands between this and a 9.
