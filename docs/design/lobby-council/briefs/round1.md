# Lobby council · round 1 — Golf Board

## Context
Golf Board: a home-screen web app a friend group uses on the course to enter hole-by-hole scores and watch one live board (iPhone-first; no accounts, pick your name; a phone remembers who it belongs to). Today an organizer (Andrew) sets up a round all at once in Setup (course → players → game → teams/draft → tee times) and texts the link on the morning.

**The owner's new idea (this council):** for team games like Team Ryder Cup (8, 12 or 16 players), everyone knows days ahead that they're playing Saturday. So the organizer should be able to **open a lobby** as soon as he has the names, days before teams and tee times exist, and share the link (on Partiful or a group text) on Wednesday or Friday evening. A player taps it, picks their name, adds Golf Board to their home screen (the onboarding the council already approved at 9+, `../../r5/` has all 27 screens), and is "in the party": they see the round's info and who's playing. They must **not** be able to tap into scoring yet. Optionally a short "what it'll look like" preview. On Saturday they just open the icon: the lobby has turned into the round (teams set, draft done, tee times), and they go in.

Platform facts: links open in Safari (or an app's built-in browser, which then needs "Open in Safari"); no push notifications (the app only updates when it's open); no accounts or phone numbers. Design system: dark, calm, Apple-like; green only means "you"; red only double bogey; amber only warnings; type 64/32/17/15/13/12; no nested cards; 44pt targets; one primary per screen. The existing Team Ryder Cup setup already has Carts → Draft (snake order) → Tee times; "Today's game" pages explain the game.

## Files
- `flow.png` — 9 rows: organizer Wednesday, new player Friday, curious player, returning player with the app, in-app browser, Thursday check-in, organizer draft → go live, Saturday morning, late joiner.
- `contact.png` — 11 screens: 1 lobby landing · 2 which one are you (A–Z, no tee times yet) · 3 confirm · 4 "See you Saturday" (first open of the app) · 5 the lobby · 6 what it'll look like (1 of 3) · 7 Home with the lobby card · 8 game day: teams are set · 9 organizer: "Invite now, set teams later?" · 10 host lobby checklist · 11 Go live?
- Singles `NN-name.png`; `o-*.png` are the reused onboarding screens.

## Deliver (strict, under 400 words)
1. Score 1–10 (9 = you'd ship it for Saturday's round).
2. Top problems, most severe first, with the screen and the fix.
3. Missing personas, states or screens.
4. What stands between this and a 9.
