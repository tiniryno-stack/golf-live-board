# Onboarding council · round 1 — Golf Board (iPhone-first web app for a friend group's golf rounds)

## Context you need
- Golf Board is a website that friends use on the course to enter hole-by-hole scores and watch one live leaderboard. An organizer (Andrew) sets up a round in the app (course, 8–16 names, tee times, game) and texts the group a link.
- Until now, people just used it in Safari. The owner's new decision: **Safari is never a place to play.** Everyone must add Golf Board to their iPhone home screen (it then runs full screen as its own app) and play there. Converting people to the home screen app is the win.
- No accounts, no passwords — friends pick their name from the round's list. A phone remembers who it belongs to (the "owner"), so after the first time you're joined automatically.
- Hard platform facts (iOS 26, Nov 2026):
  - A link tapped in Messages always opens Safari, never the home screen app; Safari and the home screen app have separate storage. The app can carry who-you-are into the home screen app via the saved link (built and working).
  - There is no API to add to the home screen: the user has to do it by hand (Safari ⋯ → Share → Add to Home Screen → Add on iOS 26's compact bar; older: the Share button).
  - Links opened inside WhatsApp / Instagram / Gmail open in that app's built-in browser, which can't add to the home screen.
  - A private (incognito) tab can't be reliably detected; its storage dies when the tab closes.
  - Safari can't tell whether the app is already installed, except a flag Safari set itself when the person tapped through the guide before.
  - Android Chrome can show a one-tap install prompt.
- If a name is already held by another phone (new phone, closed private tab), the person asks to be let in and anyone in their tee time approves with one tap (built in the identity work).
- Design system (Night Round): dark by default, calm, Apple-like; green only ever means "you"; red only double bogey; amber only warnings; type sizes 64 / 32 / 17 / 15 / 13 / 12 only; no nested cards; 44px+ tap targets; one primary button per screen.

## What's in this folder
- `r1/flow.png` — the flow map: 9 personas (rows), each a journey through numbered screens.
- `r1/contact1.png` (screens 1–6) and `r1/contact2.png` (7–12), plus each screen as its own PNG `r1/NN-name.png` (393×852, Safari's bottom bar is drawn where it would be):
  1 Landing (new person) · 2 Which one are you? (grouped by tee time) · 3 Confirm your name (first pick only) · 4 Add to home screen guide · 5 Welcome (first open of the app) · 6 Welcome back (Safari knows you) · 7 Open the app (you added it before) · 8 Open in Safari (in-app browser) · 9 Your name is on another phone · 10 Android · 11 Computer · 12 App Home with the new round.

## Deliver (strict, under 450 words)
1. Score the onboarding as a whole, 1–10 (9 = you'd ship it to the group tomorrow).
2. Your top 5 problems, most severe first, each tied to a screen number or a persona row, with the fix.
3. Personas or screens that are missing.
4. What specifically stands between this and a 9.
