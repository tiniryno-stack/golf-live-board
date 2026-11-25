Build feature 036 in the Golf Live Board app (repo `tiniryno-stack/golf-live-board`): landscape scorecard cards,
horizontal chrome packs with a swipe-to-tear opening, the Passport (a book of course and milestone stamps that is also
everyone's profile) and the 68-course stamp library. The design is finished and approved; this is the build.

**Start here**
1. The handoff is on branch `claude/brave-allen-rx1zum`, not on `main`. Fetch it and build on that branch (or a new
   branch made from it). Do not start from `main`.
2. Read `CLAUDE.md` first, then `docs/design/features/036-card-designs/SPEC.md` end to end. The SPEC is the source of
   truth. Section 0 is written for you; section 12 is the order of work; section 13 lists the open questions.
3. `docs/design/features/036-card-designs/components/` holds the approved code. `stamps.js` and `stamps-data.js` go in
   as `js/stamps.js` and `js/stamps-data.js` (adjust the import path). The other files are excerpts to port into the
   app's own screens. Each one names the prototype it came from, so read them side by side.
4. The prototypes are the HTML files in the same folder; SPEC §11 says which one is final for each part. Open one in
   headless Chromium if you need to see how something moves. Do not build anything from the files §11 lists as
   rejected.

**Rules**
- Follow SPEC §12 in order: stamps and their test first, then the locker rules and loading, the card, the pack and
  reveal, the Passport, routes and profile links, share images, and the docs last.
- 036 does not change the database. Do not add tables, RPCs or migrations. Do not change the live database.
- Leave score entry, sync, joining and the engine alone, apart from what SPEC §6.1 and §9 ask for. If you find you have
  to touch any of them, stop and tell me.
- Do not edit the 035 folder or the tracked `preview/` copy. Keep every new style in `css/locker.css`.
- Copy the emblems from `docs/design/features/036-card-designs/stamps/emblems/` to `img/stamps/`.
- Write `tests/stamps036.test.mjs` with the checks in SPEC §12 step 1, including my real passport (§6.2) and the card
  back's row fitting. Run `npm test` after each step. Do not run the smoke or fit suites, and do not take screenshot
  sets.
- For the six open questions in SPEC §13, build the default and do not ask me mid-build.
- Commit to the work branch after each step and push it. **Do not push to `main`** and do not run `npm run preview`
  (it writes to `main`); I will ask for that myself.
- When it's done, update `ARCHITECTURE.md` 13a, `CLAUDE.md` (a short 036 section like the 035 one) and `README.md`,
  set the SPEC status to "Status: built in <commit>", and run `npm run stamp`.

**Before you hand back**
- Load my locker read-only against the live data (personId `eeae7a48-33fa-4052-ad0c-fc7623173fe6`, Supabase project
  `yxreupqzwgjzhfosnjbj`, SELECT only). Check my passport shows Twin Creeks (3 visits, best 87), Bridlewood (97) and
  Firewheel Lakes (100), plus the four milestones in SPEC §6.2. Then check the back of my Nov 7 card (16 players, me
  11th).

**Hand back in plain English, short:**
- the branch name and the last commit;
- what was built, step by step, and anything you skipped and why;
- the `npm test` result;
- which of the §13 defaults you built, and anything else you had to decide;
- what I should try on my phone first.
