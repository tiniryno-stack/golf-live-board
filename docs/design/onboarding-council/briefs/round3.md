# Onboarding council · round 3

Scores so far: r1 Interaction 6 · Visual 6.5 · Product 6 · Red 5 → r2 7.5 · 8 · 7.5 · 7. Same context (../BRIEF.md, ../r2/BRIEF.md for the owner's fixed decisions). Files here: `flow.png` (16 rows), `contact1.png` (1–11), `contact2.png` (12–22), `contact-light.png` (10 screens in light), `contact-big.png` (2 and 4 at 120% text), singles `NN-name.png`.

## What changed from round 2 (screen numbers are new)
- **Watching is no longer an easy exit.** On the landing (1, 19) it's a quiet muted line "Not playing today? Watch the Board", for spectators. A **roster player** who can't add the app gets there only through **4 → Having trouble? → 6 "Can't add it right now?"** ("Watch, Mitch scores for me"). Watching (17) is now the whole Board (all six matches), no upsell card, just "Playing today? Find my name ›" → **2** (fixes 12 → 4 without a name).
- **Cart-mate is told (18):** on Mitch's Enter, Baker's row says "watching · you enter his". **Host (22)** flags a cart where nobody is in the app ("cart has nobody in").
- **Host (22) is honest:** statuses the app can know: picked a name in Safari · a cart-mate scores for them · not yet. A **Waiting for you** row to let a new phone in. Primary **Share the link again** = the share sheet with a ready message (no phone numbers needed). No progress bar (not a component).
- **Not on the list (2):** opens the share sheet with "Andrew, add me to Chuck's Bday".
- **Approver's side (15, new):** a sheet on the others' phones: "Sean's new phone wants in · Is Sean with you? Letting it in signs out his other phone. His scores stay." · Let Sean in / Not him. Shown when they have Golf Board open (screen 14 now says exactly that).
- **Waiting (14):** "While you wait, add Golf Board. Being let in carries over to the app." (install overlaps the wait).
- **7 Added it? Open Golf Board:** worded as a question; big icon; "lands on your last home screen page" + Spotlight; **I didn't add it yet** is a full secondary button.
- **Welcome (8)** has no "I'm not Baker" (it lives in the You sheet, with a confirm: **16**, which says the scores stay, marked "entered by mistake"). **Night-before variant (9):** "See you tomorrow, Baker · In the morning, just tap Golf Board."
- **11 You have the app:** icon + the code in a card with Copy and where to type it ("Have a link or code?", the same label as App Home 21); primary is a quiet **Add it again**.
- **Chrome on iPhone (5):** its own steps, pointer at the top right.
- **Visual:** 44px search on surface-2 (hairline in light); balanced headline wraps and shorter headlines; the guide's menu pictures are captioned "What you'll see in Safari" and dimmed; "Having trouble?" moved above the Safari bar, left; kickers always start with the round name; light renders of 10 screens; 120% text renders of 2 and 4. Onboarding is dark by default, like the app.
- **To verify on real phones before building** (in the spec, not in pixels): the x-safari- link per app, where iOS 26 puts the new icon, the funnel events.

## Deliver (strict, under 300 words)
1. Score 1–10.
2. What's still wrong, most severe first.
3. What stands between this and a 9 (if anything).
