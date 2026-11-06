# Lobby council · round 3

Scores: r1 6.5 · 7 · 7 · Red 6 → r2 8 · 8 · 8.5 · 7.5 (Interaction · Visual · Product · Red). Context: ../r1/BRIEF.md, ../r2/BRIEF.md. Files: `flow.png` (15 rows), `contact1.png` (1–15 player), `contact2.png` (16–25 organizer), `contact-lightbig.png` (4, 5, 6, 17 in light, then at 120% text), singles; `o-*.png` = reused onboarding screens.

## Changed since round 2
- **Draft waits for 16 (17):** with an unresolved Can't make it, Host's primary is **Replace Justin**; "The draft opens once there are 16". Counts leave out who's out: "9 of 15 have Golf Board · 1 out · Team Ryder Cup needs 16". Not-in list is **one row per person** with a Share pill.
- **Replace (18 → 19):** real name field (surface-3); after Replace, **Send Kyle the link** (share sheet with a ready message) + Undo; after the draft it says what he inherits ("Kyle takes Justin's spot": Team, cart, tee time; Saturday version on 25 "Kyle can take Team Andrew, 8:20 with Marcus"). Justin's Home (10) says "Andrew gave your spot to Kyle" with **Text Andrew**.
- **Can't make it (11 → 12):** after the draft it says the team is a player short; **I can make it after all** until Andrew replaces him (his Needs you row clears itself).
- **After the draft (20):** the one-time primary is **Share the teams**; Set tee times is secondary. **Round options (21):** date and start time, course, co-host (a real row, changeable), **Call it off**; "Removing a player after the draft starts it over. Replace keeps the teams."
- **Changes (22 → 8):** after any edit, Host's primary is **Tell the group** (ready message, how many haven't opened since); players see the note (an amber dot on a normal card, `--warn` / `--warn-bg` are existing tokens) **until Saturday**, not once. "Start time", not "tee times", before tee times exist.
- **Scoring opens by itself** 30 min before the first tee, **enforced by the server** (`upsert_score` refuses before then unless opened early; moving the start time moves it; tee times saved after that point open it at once). **Open scoring now** (23 → 24) needs a confirm and only works on the day.
- **Saturday (7):** copy matches what's missing ("Andrew or Josh is setting tee times · teams are set") + **Text Andrew**. **Saturday no-show (25):** Needs you stays after scoring opens; Replace works then too (scores already entered for that spot stay with the spot).
- **Co-host (15):** Josh's own view shows "you're co-host" + a Host row.
- **Visual:** teams (5) neutral, only your cart green ("your cart"), Team Andrew collapsed to one row, one kicker; notes sit above the primary everywhere; Twin Creeks once on 4; example round uses made-up names (Sam, Jordan); "on another phone" in the list (the pick time only on the approval sheet).
- Funnel adds: joined in the app before vs after draft day.

## Deliver (strict, under 300 words)
1. Score 1–10. 2. Still wrong, most severe first. 3. What stands between this and a 9.
