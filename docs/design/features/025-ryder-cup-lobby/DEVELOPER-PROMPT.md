# Developer prompt · build handoff 025 (Team Ryder Cup lobby)

Paste everything below the line into a new Claude Code conversation on the repo. Attach `025-ryder-cup-lobby.zip` if the folder isn't on the branch.

---

You're building **handoff 025: the Team Ryder Cup lobby** in Golf Live Board. It's a bigger lift than usual: new round stages, three additive database pieces, new Setup and Host paths, and new player screens. You'll run a **six-person code council** (subagents) to review the plan and the code until every reviewer scores it 9 or above. Read this whole prompt before starting.

## 0 · Where things are

- **Repo:** `tiniryno-stack/golf-live-board`. The handoff is committed on branch `claude/epic-knuth-bfruju` at `docs/design/features/025-ryder-cup-lobby/`, and is also in the zip. If it isn't on your branch, unzip it into `docs/design/features/`.
- **Build on a new branch off `main`,** for example `design/025-ryder-lobby`. `main` already has 024 (phone owner, auto-join, `js/identity.js` `joinPlan`, "I'm not Baker", `not_me`), and 023 (Matches who-won + the Board match sheet).
- **Read, in this order:**
  1. `CLAUDE.md`: house rules, the file map, the database rules, and how to apply SQL safely.
  2. `docs/design/features/025-ryder-cup-lobby/SPEC.md`: **the source of truth.**
  3. The screenshots in that folder (`NN-name.png`), with the SPEC's table mapping numbers to keys.
  4. `mockups/lobby-screens.html` and `mockups/flow-map.html` in a browser (`npm install` first, so the fonts load). Use them as reference only and rebuild in the app's components.
  5. As needed: `docs/design/features/015-team-ryder-cup-screens/SPEC.md` (the Ryder engine and screens), 024's SPEC (identity), and `docs/design/lobby-council/briefs/` (why each design decision was made).
- **Code you'll touch most:**
  - `js/screens/setup.js`: `ryCartsView`, `ryDraftView`, `ryTeeView`, the step flow at about line 514.
  - `js/screens/host.js`: the `draft(app)` copy of the event, `update_event` saves, `host-release`.
  - `js/app.js`: routing, `homeTab`, the join flow (`joinPlan`), and the render loop.
  - `js/screens/home.js`: Recent rounds, the "Coming up" card.
  - `js/scoring.js`: `normalizeSettings`, `compute`, `ryderState`, `ryderSetup`.
  - `js/db.js`: RPC wrappers, `STANDALONE`, `MOVE_KEYS`, the offline queue.
  - `supabase/schema.sql`: `create_event`, `upsert_score`, `fill_score`, `update_event`, `release_player`, `_admin_ok`.
  - `tests/mock-supabase.mjs`.

## 1 · What to build (short version; the SPEC has every detail)

1. **`js/lobby.js` (pure):**
   - `lobbyState(event, nowMs)`
   - `opensAtFor(date, 'HH:MM', tz)` (time-zone correct, and across DST)
   - `nextHostStep`
   - `lobbyCounts`
   - the A–Z join list
   
   Screens read only these functions.
2. **The engine guard:** a Team Ryder Cup round with no teams yet must not throw; return a safe snapshot.
3. **Server (additive):**
   - the scoring gate in `upsert_score` and `fill_score` (`not_open` before `opensAt`, and when the round is `off`); `admin_upsert_score` is not gated;
   - `claims.in_app` + `mark_in_app`;
   - `lobby_status` (organizer-only read);
   - `set_round_date`.
   
   Mirror all of it in `schema.sql`, the mock and a migration file, then **apply it to the live database yourself** (see §2). The offline queue must drop `not_open` refusals rather than retry them forever.
4. **Setup:** for Team Ryder Cup, the choice screen (Invite now, draft later / Draft and tee times first), then a **When** step (date + start time), then create, then Host's lobby view with the share sheet open.
5. **Host lobby view:**
   - the counts and the per-person rows with Share;
   - Players → Replace;
   - Co-host;
   - Round options (date and start time, course, co-host, Call it off, Bring it back);
   - a primary that's always the next step: Start the draft (reuses `ryCartsView` → `ryDraftView` on the existing event; player ids never change), Share the teams, Set start times (reuses `ryTeeView`, sets `opensAt`), and Open scoring now (with a confirm, on the day only).
6. **Player side:**
   - the lobby landing, the A–Z name list, then 024's confirm, then "See you Saturday";
   - the lobby screen in its five states;
   - Home's "Coming up", "spot given to a sub" and "called off" cards;
   - the countdown, then "Scoring is open", then Go to hole 1.
   
   No cart-name picker in a lobby. Players never see "lobby" or "tee time": say "start time".
7. **Replace and co-host:**
   - **Replace** keeps the slot and swaps the name and personId, calls `release_player`, then the share sheet to the sub, with Undo.
   - **Co-host** = share the organizer PIN through the existing PIN sheet. There are no new permissions.
8. **Not in this push:** "Play without him", the app-only Safari gate, captains drafting on their own phones.

## 2 · Rules from the owner (these override generic habits)

- **Testing:** unit tests and `npm test` only. **Do not run `npm run test:smoke`, `npm run test:fit`, or take screenshots**, unless the owner asks. Write **one focused unit test file**, `tests/lobby025.test.mjs`, for the pure logic, and update any existing tests the change breaks. Keep the mock in sync, so the mock-backed unit tests exercise the gate.
- **Design system:** no new colors, sizes or type styles. Green means "you" only (only your cart is green). Amber means warnings only. Use existing tokens and components, and flag anything new (the When step is the one known new piece).
- **Database: don't ask, just do it.** This runs overnight with nobody to answer. Apply the additive migration to the live database yourself with `apply_migration` once the council has passed the SQL. Steps:
  1. Run a `do $$ … raise exception $$` rollback test on live first (CLAUDE.md, Database).
  2. Apply the migration.
  3. Verify it with a read-only query.
  4. Write a rollback file next to it, so the owner can revert in one paste.

  Additive only (`create or replace`, `add column if not exists`). If something truly needs a drop or delete, don't run it: write it in the rollback or notes file and carry on. Keep `schema.sql` and `tests/mock-supabase.mjs` in sync with every change.
- **Old rounds must behave exactly as before.** `settings.lobby` defaults to `null`, and every new branch keys off `lobbyState`.
- **Commits:** small commits on your branch, pushed as you go. When it's done, run `npm run preview` so the owner can try it in the morning (same database as live, so use a practice round). Don't merge to `main`: the owner merges after trying the preview. Run `npm run stamp` before any push to `main`.
- **Never stop to ask.** You're running unattended overnight. If a decision isn't covered, pick the safest option, write it down in BUILD-PLAN.md under "Decided overnight", and keep going.
- **Wrap-up:** set the SPEC status to "Status: built in <commit>", and update ARCHITECTURE.md §13a and the CLAUDE.md key/settings lists.
- **The owner** is not a developer. Finish with a short plain-English summary: what changed for players and for him, how to try it on the preview link, and what you guessed.

## 3 · The code council (6 reviewers, scored, iterate until everyone is at 9 or above)

Run the council with the Agent tool: **six subagents in parallel, each given only its role below plus the files it needs.** Give each one the diff (or the plan) and the SPEC; don't give them your opinion of it. Keep the same six agents across rounds by resuming them with SendMessage, so they remember what they asked for.

Each reviewer scores **1–10**, where 9 means "I'd merge this today". Each lists its problems, most severe first, with the file:line and the fix. Each answers "what stands between this and a 9" in under 300 words.

**Round 0 reviews the plan, before you write code.** Write `docs/design/features/025-ryder-cup-lobby/BUILD-PLAN.md` (the steps, the data shapes, the SQL, the test list) and have the council review that. Fix the plan until every score is 7 or above, then build. After each build step (SPEC §8), run a council round on the diff since the last round. **You're done when all six score 9 or above in the same round.** Keep a score table in BUILD-PLAN.md (rows = rounds, columns = reviewers, plus what changed), and include it in your final summary.

The six roles (paste each into its agent's prompt):

1. **Architect.** Does the design fit this codebase (static ES modules, a pure engine, `db.local` for storage, the render loop with `ui.foldIn`)? Is `lobbyState` the single source of truth, read everywhere instead of raw settings? Are the stage transitions complete and impossible to get into a bad state (lobby → teams → ready → open; off and back; remove-and-redraft)? Are old rounds and other games untouched? Look for duplication with existing Setup and Host code instead of reuse.
2. **Database and security.** Is every SQL change additive and idempotent (`create or replace`, `add column if not exists`)? Does every RPC use SECURITY DEFINER with `set search_path`, grant only what's needed, and keep the helpers non-executable for anon? Is the gate correct and unbypassable: does `fill_score` match `upsert_score`, and is `admin_upsert_score` deliberately open? Is `lobby_status` limited to the organizer? Check that the mock matches the SQL exactly, and that the migration file matches `schema.sql`. Look for injection or size limits, `played_on` changes, and claims still being unreadable to anon.
3. **Frontend fidelity.** Compare each built screen with its screenshot and the SPEC table: the copy word for word ("start time", never "tee time" or "lobby" for players), one primary per screen, notes above the primary, only your cart in green, amber for notices, 44pt targets, no new tokens. Check light mode and large text by reading the CSS, since there are no screenshots. Check that nothing renders a blank screen, and that the tab bar is hidden until the round is open.
4. **Test engineer.** Does `tests/lobby025.test.mjs` cover, at minimum:
   - `opensAtFor` across a DST boundary and a different time zone;
   - every `lobbyState` stage, including `off`, `openedEarly`, and missing start times;
   - `nextHostStep` for each stage;
   - `lobbyCounts` adding up to the roster;
   - the A–Z list;
   - the mock gate (`not_open` before `opensAt`, ok after; `admin_upsert_score` always ok);
   - old rounds with `lobby: null` unchanged?
   
   Is every test meaningful, with no snapshot padding? Does `npm test` pass? Don't ask for the smoke or fit suites: the owner said no.
5. **Product and flow QA.** Walk all 15 rows of `screenshots/flow.png` through the code, from a link to playing on Saturday, and confirm each one ends somewhere sensible:
   - a returning player with the app is joined automatically (024);
   - a Safari-only joiner;
   - draft day: players see their team on their next open;
   - start times: Saturday at 7:29 → 7:30 unlocks without a reload;
   - Replace: the old phone sees its card, the sub gets the share;
   - co-host: Josh with the PIN sees Host;
   - Call it off and Bring it back;
   - a late joiner after it opens goes through normal joining.
   
   Flag any step that needs the owner to know something he can't see.
6. **Red team.** Break it:
   - time zones (the organizer travels, or a phone clock is wrong; the server must decide);
   - races (two organizers saving at once; Replace during a claim; the draft saved while a player joins);
   - the offline queue filling up with `not_open` writes;
   - a round edited after people joined;
   - 12 or 8 players (Team Ryder Cup v2 is 16-only: what does the draft do?);
   - regressions in Rider Cup, 2v2, split point, finalize, recap and season standings when `settings.lobby` is null;
   - a fat-fingered name in a lobby (024's undo still works);
   - an organizer who loses his phone (the co-host PIN path).
   
   Score honestly, and challenge the design where the code shows it's wrong.

If a reviewer and the SPEC disagree, the SPEC wins, unless the reviewer has found a real bug or a contradiction. In that case, write it down as an open question for the owner in BUILD-PLAN.md, pick the safest option, and carry on. Don't stop and wait.

## 4 · When you finish

1. All six at 9 or above, with the table in BUILD-PLAN.md.
2. `npm test` green.
3. Migration applied to the live database and verified, with the rollback file written.
4. `npm run preview`, with the link given to the owner.
5. A short plain-English summary. Don't merge to `main` until the owner says so.
