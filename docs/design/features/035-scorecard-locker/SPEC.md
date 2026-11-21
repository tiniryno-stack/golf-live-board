# 035 · Scorecard locker

Status: approved by Andrew Nov 21 for a first build ("plan this and then try to one-shot it"). Not built.

Players keep a collectible scorecard for every finished round. Cards arrive as sealed packs; you hold a pack to
rip it, the card's finish (standard, bronze, silver, gold, prismatic) is revealed, and it lands in your Locker.
`prototype.html` in this folder is the look and feel to port (cards, finishes, carousel, flip, pack rip). It is
reference only: rebuild it in the app. Where this SPEC and the prototype disagree, the SPEC wins (the prototype
still grades by "beat all of your last 20" and has the short reveal).

Goal of this first build: Andrew's friends open the app, see "N packs ready" for the rounds they already played,
and rip them. Everyone with a finished round gets it (Andrew, Nov 21).

---

## 1. Decisions (all from Andrew, Nov 21)

1. Every finished 18 earns a card. Solo rounds count; rounds with other players carry a "with the crew" mark.
2. Cards come as packs. Packs wait until you open them (people can hold on to them). Home shows how many are ready.
3. Rounds already played are backfilled as **launch cards** (rule 3.2), generous on purpose so the demo shows
   every finish, including prismatic.
4. Rounds played after launch are graded against **your normal** (rule 3.3).
5. The wait before the reveal is longer than the prototype's, and gold and prismatic are celebrated more (§6).
6. The back of the card shows more stats (§5.2).
7. Andrew gets an admin list: who has packs, who opened them, and a read-only view of anyone's locker (§8).
8. Goes to `main` for everyone with a finished round. No flag list.

## 2. Who has what in the live data (read Nov 21, for checking the build)

| Person | personId | Finished rounds (gross) | Launch cards they should get |
|---|---|---|---|
| Andrew Duong | `eeae7a48-33fa-4052-ad0c-fc7623173fe6` | 97, 97, 93, 100, 87 | 87 prismatic, 93 gold, 97 (Oct 16) silver, 97 (Oct 20) bronze, 100 standard |
| Sean Lee | `7ee08322-7d37-4dec-bb96-c9e781836500` | 99, 93, 109, 104, 94 | 93 prismatic, 94 gold, 99 silver, 104 bronze, 109 standard |
| Justin Nguyen | `316604a9-becc-452e-97aa-eb29c5b8013d` | 98, 101, 94, 91 | 91 prismatic, 94 gold, 98 silver, 101 bronze |
| Mitchell Ho | `9c4ca6d9-ad6d-4d7f-8846-b04898b1ed68` | 97, 89, 94 | 89 gold, 94 silver, 97 bronze |
| Alex Ho | `27793fb2-7fc0-40cc-90fe-7856aeff6466` | 94, 95 | 94 gold, 95 silver |
| Baker Jeon | `b49ca225-3a90-45cf-9627-5e36027bfe71` | 105, 108 | 105 gold, 108 silver |

Eleven more people have one or two finished rounds (silver, or gold + silver). All finished rounds are finalized
and none is a practice round. Every one of these people has at least one device with a claim in `claims`, which is
what `open_card` checks.

## 3. Rules (pure, in `js/locker.js`, tested)

### 3.1 Which rounds count for a person

A round counts for person P when: the event is not a practice round (`String(settings.practice) !== 'true'`), a
roster player has `personId === P`, that player has all 18 strokes, and the round is over
(`finalized_at` set, or `played_on` is before today). Order rounds by `played_on`, then `created_at`.

### 3.2 Launch cards (rounds played on or before `LAUNCH_DATE = '2026-11-21'`)

Rank the person's launch rounds by gross, best first (a tie goes to the earlier round). Finish by rank:

| Launch rounds | Finishes, best round first |
|---|---|
| 1 | silver |
| 2 | gold, silver |
| 3 | gold, silver, bronze |
| 4 | prismatic, gold, silver, bronze |
| 5 or more | prismatic, gold, silver, bronze, then standard for the rest |

Line on the card: "Launch card · your best of your first 5 rounds", "… your 2nd best of your first 5 rounds";
with one round, just "Launch card".

### 3.3 Rounds after launch

- The person's 1st, 2nd and 3rd rounds ever (launch rounds count toward the three) are **rookie** cards, ungraded:
  "Rookie card 2 of 3".
- From the 4th round on: **your normal** = take your rounds before this one, up to the last 20, leave out the worst
  `floor(count / 5)` of them, average the rest and round to a whole number (`Math.round`).
- `diff = normal − gross`. 5 or more → prismatic. 3 or 4 → gold. 0 to 2 → silver. −1 to −3 → bronze.
  −4 or worse → standard.
- Line on the card: "8 better than your normal of 92", "Right on your normal of 92", "2 over your normal of 92".
  A standard card shows no comparison line.
- Compare raw gross for now (course rating / tee per player is a later step).

Grade letters: prismatic S, gold A, silver B, bronze C. Standard and rookie show no letter.

### 3.4 Stamps (permanent, separate from the grade)

Computed in round order: **Broke 100 / 90 / 80** (first round under it, and an earlier round was not),
**Lowest round yet** (beats every earlier round; needs one), **Eagle**, **First birdie**, **Best at <course>**
(beats every earlier round on that course; needs one). The front shows the first two; the back shows all.
"Won the match" is left for later (it needs the game result, not just your scores).

### 3.5 Stats for the back of the card (from the 18 scores and pars)

- Counts: eagles, birdies, pars, bogeys, doubles or worse.
- By hole type: total against par on the par 3s, par 4s and par 5s ("Par 3s +4").
- Best run: longest stretch of holes at par or better (shown when 2 or more).
- Front and back nine totals (already in the scorecard table).

## 4. Data

### 4.1 What is stored

Cards are **derived** from `events` + `scores` (both readable by the browser) with the rules above; nothing about
a card is stored. Only the fact that a pack was opened is stored, in one new table.

Migration `supabase/migrations/2026-11-21-card-opens.sql` (additive only: mirror it in `supabase/schema.sql` and
`tests/mock-supabase.mjs`; rollback file beside it with the two drops, for the SQL Editor):

```sql
create table if not exists public.card_opens (
  event_id   uuid not null references public.events(id) on delete cascade,
  person_id  text not null,                 -- = roster player personId
  player_id  text not null,                 -- that person's roster id in this round
  opened_at  timestamptz not null default now(),
  primary key (event_id, person_id)
);
create index if not exists card_opens_person_idx on public.card_opens (person_id);
alter table public.card_opens enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'card_opens' and policyname = 'card_opens_read') then
    create policy card_opens_read on public.card_opens for select to anon, authenticated using (true);
  end if;
end $$;
-- No insert/update/delete policies: writes go through open_card only.

create or replace function public.open_card(p_code text, p_person_id text, p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e public.events; v_pid text; v_n int; v_at timestamptz;
begin
  e := public._event(p_code);
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(e.settings->>'practice', 'false') = 'true' then return jsonb_build_object('ok', false, 'error', 'practice'); end if;
  select p->>'id' into v_pid from jsonb_array_elements(coalesce(e.roster->'players', '[]'::jsonb)) p
   where p->>'personId' = p_person_id limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'not_on_roster'); end if;
  select count(*) into v_n from public.scores where event_id = e.id and player_id = v_pid and strokes is not null;
  if v_n < 18 then return jsonb_build_object('ok', false, 'error', 'not_finished', 'holes', v_n); end if;
  if not exists (select 1 from public.claims c join public.events e2 on e2.id = c.event_id
                  where c.device_id = p_device_id and public._player(e2.roster, c.player_id)->>'personId' = p_person_id)
     and not exists (select 1 from public.crew_claims cc where cc.device_id = p_device_id and cc.person_id::text = p_person_id) then
    return jsonb_build_object('ok', false, 'error', 'not_you');
  end if;
  insert into public.card_opens (event_id, person_id, player_id) values (e.id, p_person_id, v_pid)
  on conflict (event_id, person_id) do nothing returning opened_at into v_at;
  if v_at is null then
    select opened_at into v_at from public.card_opens where event_id = e.id and person_id = p_person_id;
    return jsonb_build_object('ok', true, 'opened_at', v_at, 'unchanged', true);
  end if;
  return jsonb_build_object('ok', true, 'opened_at', v_at);
end $$;
grant execute on function public.open_card(text, text, uuid) to anon, authenticated;
```

Plus `locker_admin()` (`language sql stable security definer`, granted to anon): one row per person with a finished
round, `{ person_id, name, rounds, opened, last_opened }`, built from `events.roster` (name =
`firstName`/`name` + `lastName`), `scores` (18 non-null strokes) and `card_opens`; practice rounds and roster
players without a `personId` left out. It returns nothing that `events` does not already expose to the browser,
so it has no server-side admin check; the admin gate is in the app (§8). It exists because reading every score
from the browser would hit the 1,000-row limit.

Check `crew_claims` column names in `schema.sql` before applying. Apply with `apply_migration`, then verify with a
read-only select and a `do $$ … raise exception $$` block (CLAUDE.md → Database). **Apply the migration before the
app code reaches `main`.**

### 4.2 Loading (`js/db.js` + `js/screens/locker.js`)

- `db.fetchPersonRounds(personId)`: `events` where `roster` contains `{ players: [{ personId }] }` (no `limit`),
  then, per event, that one player's scores (`.eq('event_id', …).eq('player_id', …)`, 18 rows each, in
  parallel). Do not use `.or()`: the test mock ignores it. Do not fetch whole events' scores in one query.
- `db.fetchCardOpens(personId)`: `card_opens` where `person_id` equals it.
- `db.api.openCard(code, personId)` and `db.api.lockerAdmin()`.
- `loadLocker(app, personId, { force })` in the screen module, modelled on `loadCrew` (`js/screens/crew.js`
  20–40): fills `app.locker = { personId, cards, loading, error }` and calls `app.render()`. Any failure (offline,
  table missing) leaves Home exactly as it is today: no card, no row, no error.
- A pack opened while offline still reveals; its code is kept in `glb.lockerPending` and sent on the next load.
- New storage keys: `glb.lockerPending`, `glb.lockerTilt`. Neither needs to move with Add to Home Screen.

## 5. The card (port from `prototype.html`)

### 5.1 Front

Portrait card, 5 : 7, every size in `cqw` so the same markup works in the carousel, the grid and the pack.
Brand mark + finish name; course label; gross (very large); to-par and date; the 18-hole strip (dot = par,
circle = birdie, square = bogey, filled square = double or worse); up to two stamps; name, "with the crew" or
"solo", card number. Finishes are the prototype's `.f-standard / .f-rookie / .f-bronze / .f-silver / .f-gold /
.f-prismatic` (the prismatic `holo` + `facet` layers, the moving `sheen`).

### 5.2 Back (tap to flip)

Course, date, gross and to-par; front and back nine tables with the app's score marks; then, in the space under
the tables: the grade chip + comparison line; **four big count tiles** (birdies or better, pars, bogeys, doubles
or worse); **one row by hole type** (Par 3s / Par 4s / Par 5s against par); **best run**; stamps pinned to the
bottom. The prototype's one grey line of counts is replaced by the tiles.

## 6. The pack (full-screen overlay)

Built like the Today's game player: it owns `#overlay` (`toasts.showBrief` / `todaysgame.js` are the pattern) so
the render loop never redraws it. Add `showPack` / `closePack` beside `showBrief` in `js/screens/toasts.js` and
call `closePack` from `closeOverlay`, so a route change stops its timers.

| Step | What happens | Time |
|---|---|---|
| 1. Sealed | Pack breathes. "Press and hold to open" + course, date, "you shot 87". Close button. | until touched |
| 2. Hold | Shake grows, a tear line runs across the top. Let go early and it settles back. | 1.3 s |
| 3. Tear | Top strip flies off, flash. `open_card` is sent here. | 0.45 s |
| 4. **The wait (new)** | Card rises halfway out, still white-hot. The pack keeps trembling and light pulses out of the opening, each pulse quicker than the last. On the last pulse the light takes the finish's color: that is the tell. | standard, bronze, rookie 1.4 s (2 pulses) · silver 1.6 s · gold 2.0 s (3 pulses) · prismatic 2.6 s (4 pulses, then 0.3 s of stillness) |
| 5. Reveal | Pack drops away, the glare clears, celebration by finish (below). | 0.9 to 3 s |
| 6. Result | Finish name + grade chip, comparison line, stamps pop in one at a time. **Add to locker** (primary); **Open next pack · 2 left** when there are more. | |

Celebration by finish:

- **Standard, bronze, rookie:** one ring, the card settles.
- **Silver:** one ring and a sheen sweep across the card.
- **Gold:** the screen flashes gold, two rings, about 16 sparks, the card overshoots (1.08 → 1), "Gold" stamps in.
- **Prismatic:** a held dark beat, a white flash, rainbow rays turning slowly behind the card (they stay while the
  result is up), three staggered rings, about 28 sparks in two bursts, the card spins once as it scales in, a
  short screen shake, the name lands letter by letter.

Reduced motion: a tap opens it, everything is a 150 ms fade. No sound, no haptics.

"Add to locker" closes the overlay and opens the Locker on that card. A card already opened can be **ripped
again** from the Locker (replay only, nothing is sent), so the demo can be repeated.

## 7. Screens

### 7.1 Home (`js/screens/home.js`)

Only when this phone has an owner (`db.owner.get()`) and that person has at least one card or pack:

- **Packs card**, above the crew card, when packs are waiting: pack thumbnail with a count pip, "3 PACKS READY",
  "Open your scorecards", the newest waiting round ("Twin Creeks · Nov 20"). Tap → Locker, packs view.
- **Locker row** in the `extras` `.home-list`: a small fan of the three newest opened finishes (a sealed pack if
  none), "Locker", "5 scorecards" or "3 packs to open". Tap → `#/locker`. Note `extras.trim()` decides whether
  that list renders.
- Home starts `loadLocker` once per page load, next to `syncMyRounds`.

### 7.2 Locker (`#/locker`, new `js/screens/locker.js`, wired like `season`)

- Title "Locker", "5 scorecards since Oct 16", a two-button toggle (one at a time / all), and a **Packs · 3** pill
  while packs are waiting. With no opened cards yet it opens on the packs view.
- **Packs view:** the sealed packs in a two-column grid, each labelled with course and date. Tap one to open it
  (any order). Oldest first is the "Open next pack" order.
- **One at a time:** the prototype's carousel (scroll-snap, neighbours peeking, cards turn as they pass), caption
  under the card (finish + grade chip, comparison line), "2 of 5", **Rip again**, and **Turn on tilt** on phones.
- **All:** two-column grid of fronts; tap one to open it in the carousel.
- **How cards work** (top right ⓘ): a sheet with the six finishes and the two rules (launch cards, your normal).
- Things that keep this screen stable: `mount()` runs after every redraw, so restore the carousel's `scrollLeft`
  from `app.ui`, start the tilt loop there and stop it when the element is gone or the route changed; add
  `window` listeners once; flip a card and update the caption directly in the DOM, without `app.render()`;
  return true from `keepContent` while a finger is on the carousel. Action names are one global table: prefix
  them `lk-`.
- Tilt: pointer, a slow idle sway, and phone tilt via `DeviceOrientationEvent.requestPermission()` from the
  button (it needs a tap on iPhone).

### 7.3 Routes (`js/app.js` `parseHash`, `SCREENS`)

`#/locker` · `#/locker/admin` · `#/locker/p/<personId>` (admin's read-only view of someone's locker).

## 8. Admin

- Who: `LOCKER_ADMINS` in `js/locker.js`, a list of personIds (Andrew's to start). The check is in the app only:
  it hides the screen, it does not protect anything, and nothing here is secret (names and scores are already
  readable).
- **`#/locker/admin`:** totals ("17 people · 36 packs · 6 opened"; 36 is the real count of finished rounds on Nov 21), then one row per person from `locker_admin()`:
  name, rounds, opened, waiting, last opened. Reached from an icon on the Locker's top bar, admins only.
- **Tap a person** → `#/locker/p/<personId>`: their locker exactly as they see it, read-only. Their waiting packs
  show sealed and cannot be opened from here (the server would refuse it anyway: `not_you`).

## 9. Files

| File | Change |
|---|---|
| `js/locker.js` (new, pure) | rules 3.1 to 3.5, `LAUNCH_DATE`, `LOCKER_ADMINS` |
| `js/screens/locker.js` (new) | Locker, packs view, admin list, view-as, `loadLocker`, card markup |
| `js/screens/pack.js` (new) | pack overlay markup + player (`{ stop }`) |
| `css/locker.css` (new) | every new style. Add it to the array in `index.html` (line ~97) after `css/styles.css`; nothing loads a new CSS file otherwise. `tools/stamp.mjs` picks it up by itself. |
| `js/app.js` | import + `SCREENS.locker`, `parseHash` |
| `js/screens/home.js` | packs card, Locker row, start `loadLocker` |
| `js/screens/toasts.js` | `showPack` / `closePack`, called from `closeOverlay` |
| `js/screens/sheets.js` | `lockerHow` sheet in `BODIES` |
| `js/db.js` | `fetchPersonRounds`, `fetchCardOpens`, `api.openCard`, `api.lockerAdmin` |
| `js/ui.js` | icons the screens need (there is no card, stack or pack icon today) |
| `supabase/schema.sql`, `supabase/migrations/2026-11-21-card-opens.sql` (+ rollback) | §4.1 |
| `tests/mock-supabase.mjs` | `card_opens` in `t` and in the readable-tables map, `rpc.open_card`, `rpc.locker_admin`, drop a round's opens in `delete_round` |
| `tests/locker035.test.mjs` (new) | the rules against §2's table, the normal + cut-offs, stats, `open_card` in the mock (ok, `not_you`, `not_finished`). Mock fixtures use non-UUID personIds, which is why `person_id` is text. |
| `ARCHITECTURE.md` 13a, `CLAUDE.md`, `README.md` | what was built; set this SPEC's status to "built in <commit>" |

Do not edit the tracked `preview/` copy.

## 10. New patterns to flag (not in the design system)

All of it lives in `css/locker.css` and only on the Locker, the pack and Home's two entries; round screens are
untouched. The token tests read `css/styles.css` and `css/tokens.css` only, so they do not see this file.

- New colors and gradients: the five finishes and the pack foil (README: no new colors).
- Shine on cards and light on the reveal (README: "Two glows, never more").
- A reveal lasting several seconds and cards that move continuously (README: motion is short and functional).
- Phone tilt as an input, with an iPhone permission prompt.
- Card-face type in `cqw`, outside the six type styles.
- Green still means you and nothing else: no finish uses it.

## 11. Order of work, and checks

1. `js/locker.js` + `tests/locker035.test.mjs`; `npm test`.
2. Migration: `schema.sql`, the migration file, the mock; apply to the live database; verify.
3. `db.js`, then the Locker screen, the pack overlay, Home, admin.
4. `npm test`. No smoke or fit runs unless Andrew asks (this does not touch score entry, sync or joining; the
   Home screen and one new table are the only shared surface).
5. Docs, `npm run stamp`, push to `main` (Andrew asked for this build to go to `main`).

Check against live data before pushing: load Andrew's, Sean's and Alex's lockers (read-only) and compare with §2.

## 12. Left for later

- A pack offered on the Board's final card the moment a round is finalized.
- "Won the match" stamp, other players' lockers for everyone, profile borders.
- Cut-offs sized to how steady each player is; comparing across courses by rating and tee.
- A neutral record of the grade at the time (cards are derived, so fixing an old score can change an old card).
