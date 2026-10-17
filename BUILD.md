# Build checklist

The spec is `ARCHITECTURE.md`. Build in the order below, commit and push after each stage, and tick the box in the same commit. If a session stops, the next one resumes at the first unticked box.

## Project facts

| | |
|---|---|
| Repo | `tiniryno-stack/golf-live-board` (public, GitHub Pages from `main` / root) |
| Live URL (after Pages is on) | `https://tiniryno-stack.github.io/golf-live-board/` |
| Supabase project | `golf-live-board` · ref `yxreupqzwgjzhfosnjbj` · us-east-2 |
| Supabase URL | `https://yxreupqzwgjzhfosnjbj.supabase.co` |
| Publishable key (safe in the browser) | `sb_publishable_L7J7qoEdJStCh1WSLBneBA_Bfr6zRik` |
| Schema changes | apply through the Supabase connector (`apply_migration`); keep `supabase/schema.sql` in sync |
| Never commit | the Supabase secret / service_role key or the database password |

## Stages (ARCHITECTURE.md section 10)

- [x] 1. `supabase/schema.sql` — tables, RLS, write functions (incl. claims, join requests, audit log), realtime publication; applied to the project
- [x] 2. `js/scoring.js` + `js/headlines.js` + `tests/` — section 7 worked examples, official-line lead change, comeback, streak, clinch, Lock in / Close it out all passing (`node --test`)
- [x] 3. `js/db.js` — load, device ID + name claim, leave, let-them-in, RPC writes, realtime, offline queue, audit log read
- [x] 4. Design tokens + app shell (Sundown tokens, dark by default, Flighty-inspired layout — section 9; fit-the-screen rule, section 8)
- [x] 5. Home + Setup (organizer flow, Twin Creeks in `js/courses.js`, nothing preselected)
- [x] 6. Enter (cart cards, first tap = bogey, ◀ back + Undo, Switch it up, Lock in / Close it out cards, While you were away)
- [x] 7. Matches (hero card, 12-point tug-of-war bar), Board (official + provisional, headlines strip), Card (Front | Back, grouped by cart), Host (Rules | Players | Activity), Season (from Home), toasts
- [x] 8. Fit-the-screen check at iPhone SE / 13 mini / 15-16 / Pro Max sizes
- [x] 9. Smoke test: two phones, blocked edit outside your matchup, hole-7 swap, clear-the-browser rejoin; then Andrew turns on GitHub Pages

## Notes for whoever picks this up

- Stay on spec; extras go to the V2 backlog (section 13).
- Needed for a round on Fri Oct 16, 2026 at Twin Creeks.
- **Stage 9 status (Oct 16, ~3am):** smoke-tested two ways and passing — headless two-phone run (`npm run test:smoke`, 34/34: blocked edit, hole-7 swap, offline queue, clear-the-browser rejoin) and the same rules run against the live database in rolled-back transactions. The smoke run found and fixed one real bug: "let them in" keyed off a player's highest posted hole, so a stray future score locked their foursome out; it now uses the first hole they haven't posted (what Enter shows) or the hole before it (applied as migration `join_approver_current_hole`). **Left to tick this box:** Andrew turns on GitHub Pages, then a two-real-phones check on the live URL.
- **Stage 9 done (Oct 16):** GitHub Pages is on and the app ran a full live round ("Chucks Bday", 8 phones, all 18 holes). Everything after that is playtest iteration — see ARCHITECTURE.md §13a and `CLAUDE.md` (handoff notes for new sessions).
