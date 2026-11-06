# Lobby council (Nov 6): join days ahead, play on Saturday (design only)

The organizer opens a round as soon as he has the names ("Invite now, draft later"), shares the link (Partiful / group text); players join, add the app, and see who's playing and what's coming; teams appear when drafted, tee times when set, and scoring opens by itself 30 min before the first tee.

Four council rounds (Interaction · Visual · Product · Red): 6.5 · 7 · 7 · 6 → 8 · 8 · 8.5 · 7.5 → 9 · 8.5 · 9 · 8.5 → **9 · 9 · 9.5 · 8.5**.

- `screens/`: the 28 final screens (Nov 6 owner edit: no “Can’t make it”; players see “start time”, never “tee time”) (`NN-name.png`), reused onboarding screens (`o-*.png`), light (`L-*`) and 120% text (`B-*`), `flow.png` (17 journeys).
- `lobby-screens.html`: the mockup (`#{"s":"early"}` etc.; `"light":true`, `"big":true`).
- `briefs/round1–4.md`: every decision, round by round.
- On the App Screens canvas: page **Lobby · join days ahead (Nov 6)**.

**Owner decision needed before building:** the short-handed rule. A Ryder hole counts only with all four scores; with one player in a cart (no-show, unfilled open spot), does his ball count twice for Low Total, or does the full cart take that point?

Build notes: round status (lobby → teams → tee times → open), course time zone, a server scoring gate in `upsert_score` + a phone countdown, holes credited per person across a Replace, Call it off / bring it back. Touches score sync: smoke run. Builds on 024 (identity) and the onboarding screens (`../onboarding-council/`).
