# Developer prompt · build handoff 026 (the invite + press-and-hold reveal)

Paste everything below the line into a new Claude Code conversation on the repo.

---

You're building **handoff 026** in Golf Live Board: a new layout for the Team Ryder Cup **invite**, and a **press-and-hold handicap reveal** that replaces 025's blur-and-roll reveal. It's front-end only: no database changes. Read this whole prompt before starting.

## 0 · Where things are

- **Repo:** `tiniryno-stack/golf-live-board`. The handoff is at `docs/design/features/026-invite-and-reveal/` on branch `claude/epic-knuth-bfruju`.
- **Base:** 026 changes screens that 025 built. 025 is on branch **`claude/new-session-a0hcnv`**, which is **not merged to `main`**. Check with `git merge-base --is-ancestor origin/claude/new-session-a0hcnv origin/main`:
  - if it's merged, branch off `main`;
  - if not, branch off `claude/new-session-a0hcnv`.
  
  Name the branch `design/026-invite-reveal`. Copy the 026 folder in from `claude/epic-knuth-bfruju` (`git checkout origin/claude/epic-knuth-bfruju -- docs/design/features/026-invite-and-reveal`).
- **Read, in this order:**
  1. `CLAUDE.md` (house rules).
  2. `docs/design/features/026-invite-and-reveal/SPEC.md`: **the source of truth.**
  3. Its `screenshots/` (01–06), then `mockups/invite.html` and `mockups/reveal.html` in a browser, as reference only. In the reveal mockup, concept 1 is the one. Its timings and touch handling are a good starting point, but rebuild in the app's components.
  4. 025's SPEC §6, for the context around these two screens.
- **Code you'll touch:**
  - `js/screens/lobby.js`: `invite()`, `reveal()`, `hcpCard()`, and its `mount`.
  - `js/lobby.js`: `revealFrame`, `rankLine`, `hcpOf`, plus the new pure helpers.
  - `js/app.js`: where `revealing` / `seenHcp` are set and the seen key is written.
  - `css/styles.css`: the `lb-` rules.

## 1 · What to build

1. **The invite** (SPEC §1): who invited you, the big round name, what/where, the real date + start, the faces grid from `claimed_players`, one line, **Reveal my handicap**, and "Not playing? Follow along".
2. **The reveal** (SPEC §2): idle → holding → burst → final; quick-tap nudge; Just show me; keyboard; reduced motion with a visible Reveal button; touch rules; state in `app.ui.reveal` so redraws never restart it.
3. **Seen when the number lands**, and **See it again ›** on the lobby's handicap card.
4. **Pure helpers + `tests/reveal026.test.mjs`** (SPEC §5).

## 2 · Rules from the owner

- **Testing:** `npm test` only. **Don't run `npm run test:smoke` or `npm run test:fit`, and don't take screenshots**, unless the owner asks. One focused test file. Debug by reading the code.
- **Design system:** no new colors, sizes or type styles beyond the four flagged in SPEC §3. Green = you only. If anything else seems to need a new pattern, use the closest existing one and note it in the summary.
- **Old rounds and other games must behave exactly as before.** These screens only show for a Team Ryder Cup lobby round with handicaps.
- **Never stop to ask.** If a decision isn't covered, pick the safest option, note it in the summary, and carry on.
- **Commits:** small commits on your branch, pushed as you go. When done, run `npm run preview` so the owner can try it (same database as live: use a practice round). **Don't merge to `main`.**
- **Wrap-up:** set the SPEC status to "Status: built in <commit>" and add a line to ARCHITECTURE.md §13a.

## 3 · The code council (3 reviewers; the owner is saving tokens)

Run three subagents in parallel with the Agent tool. Give each one only its role, the SPEC, the screenshots and the diff. Don't give them your opinion of the diff. Keep the same three agents across rounds (resume them with SendMessage). Each scores 1–10 (9 = "I'd merge this today") and lists its problems, most severe first, with file:line and the fix, in under 300 words.

1. **Frontend fidelity:** each state against its screenshot and the SPEC, word for word; one primary; green only for you; no new tokens; light mode and large text, checked by reading the CSS; nothing blank.
2. **Interaction and accessibility:** the hold feels right (timing from real elapsed time, drain, nudge, cancel cases, no iOS long-press menu); Just show me / Enter / Space; VoiceOver labels and the live announcement; reduced motion; redraws never restart or drop the hold; seen only when the number lands.
3. **Red team:** break it with a redraw mid-hold, the app killed mid-hold, a second finger, a rotated phone, no handicap, a tie, a one-player field, the organizer's own phone, "I'm not Baker" after the reveal, and old rounds or other games.

Review once after the build, fix, and review again. **Stop when all three are at 9 or above, or after 3 rounds**, whichever comes first. Put the score table in your summary.

## 4 · When you finish

1. `npm test` green.
2. The council table.
3. `npm run preview`, with the link (https://tiniryno-stack.github.io/golf-live-board/preview/).
4. A short plain-English summary for the owner (he's not a developer): what changed, how to try it, and what you guessed. Remind him to try the hold on his phone and to say whether the burst feels big enough.
