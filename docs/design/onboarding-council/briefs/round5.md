# Onboarding council · round 5 (confirming)

Scores: r1 6 · 6.5 · 6 · Red 5 → r2 7.5 · 8 · 7.5 · 7 → r3 8.5 · 8.5 · 8.5 · 8 → r4 9 · 8.5 · 9 · 8.5 (Interaction · Visual · Product · Red). Same numbering as round 4. Files: `flow.png`, `contact1.png` (1–13), `contact2.png` (14–26), `contact-light.png`, `contact-big.png`, singles.

## Fixed since round 4
- **Secondary buttons now render** in sheets (they were surface-2 on a surface-2 sheet, so they looked like links): "Not him" (17), "Cancel" (18), "Text your group" (15, 16). In sheets the secondary sits on surface-3 (light: surface-1 + hairline).
- **Host (26):** one honest list. "Waiting for you · Sean's new phone · Let in" (opens the 17 sheet), then **Not in the app yet · 5**, which matches 11 of 16: Justin + Chuck (amber dot, "nobody in their cart yet", **Share with them**), Peter ("picked his name in Safari", Share), Elijah ("watching · Marcus scores for him"), Jay ("not yet": the app can't tell opened from not, so it doesn't claim to). Rows 60pt, pills 36pt drawn with a 44pt hit area. Primary **Share the link with all 5**. "Enter for them" is now only a fallback, in the cart row's ⋯ once their round has started (spec), and it opens that cart's Enter as the organizer, recorded in the audit log.
- **Almost in (16):** "Waiting for the OK, Sean"; **I'm not Sean** to get out. Spec: if turned down it says "Not let in" with Pick again (→ the app's name list); re-asks every 5 minutes, like 15.
- **"Text Mitch" → "Text your group"** (15, 16): the share sheet, ready message.
- **Can't add it now (7):** one sentence for the real case (Mitch has the app). If nobody in the cart has it, the sentence names Andrew instead (spec).
- **Mitch is told (21):** same timing rule as 17: after his current score saves, never mid-tap.
- Kickers "asked 1 min ago / 3 min ago"; 12's widow ("Deleted it? Add it again."); real screens behind the scrims on 17 (Enter) and 18 (Home).
- Not changed on purpose: no green rail on 22, because handoff 023 replaced the rail with the grouped card (your cart = the card), so Mitch and Baker are both "your cart" on Mitch's phone.
- Added to the real-phone checks: "Add it again" after deleting the app keeps the same device id (otherwise you'd be asked to let in your own old phone).

## Deliver (under 150 words)
Score 1–10, anything still blocking, ship yes/no.
