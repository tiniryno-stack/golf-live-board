# GPS yardages — architecture notes

Status: **decided Oct 22, 2026; spike done the same day (Twin Creeks greens from OSM, `geo-check.html`); features 011 + 013 built, `FLAGS.gps` on; stage 3 (§7) built and deployed Oct 22 evening** (table live, function `course-geo` v3, app `loadGeo`). Next: confirm the Supabase secrets exist and build Bridlewood + Indian Creek for real, then stage 4 (§8).

Goal: on Enter, a green card above your score with front / middle / back yards from your phone to the green,
the green outline with a flag, and `GPS · ±N YD` in the hole header (designer mockup
`Green card E1`). No satellite map, no hazards, no tap-to-measure in V1. Must work on iPhone Safari and the
home screen app, mid-round, with spotty signal. Andrew: "if it's not a good golf app, people won't use it."

## 1. Known facts
- OpenGolfAPI has pars, handicaps, tees, course lat/lng — **no green or hole coordinates** (checked Oct 19).
- No backend besides Supabase (Postgres + Edge Functions). Static site on GitHub Pages.
- `navigator.geolocation.watchPosition` works in Safari over HTTPS; iPhone asks once per site (the home
  screen app is a separate site and asks again). Outdoors accuracy 3–10 m (≈3–11 yd).
- The distance math is trivial and proven (haversine, meters ÷ 0.9144): ~15 lines, no library, offline.
  Front/back = where the tee→green-center line enters and leaves the green outline; middle = outline center.
- The sandbox can't reach Overpass, Mapbox or any AI API; those steps need a session with network or
  run from Andrew's browser.

## 2. Where green coordinates come from — decided
One pipeline, one data shape (a tee point + a green **outline polygon** per hole, so front/back are measured
from day one, not estimated):

1. **OpenStreetMap first** (`way["golf"="green"]` via Overpass). Free, ODbL. An OSM green is already a
   polygon of lat/lng points. Coverage is course by course; not yet checked for Twin Creeks / Bridlewood /
   Indian Creek — paste this into https://overpass-turbo.eu to see:
   ```
   [out:json][timeout:60];
   (
     way["golf"="green"](around:1500,33.1084,-96.7181);  // Twin Creeks
     way["golf"="green"](around:1500,33.0215,-97.0855);  // Bridlewood
     way["golf"="green"](around:1500,32.9845,-96.9305);  // Indian Creek
   );
   out tags center;
   ```
2. **AI traces the rest off satellite imagery** (Andrew's idea). Mapbox satellite tiles (free tier) + a
   vision model trace each green's outline and tee box; chain tee→green from the clubhouse to number the
   holes. Risk: wrong hole numbers on tight layouts, wrong blob on double greens. Costs cents per course.
   Mapbox token + AI key live in **Supabase function secrets only**.
3. **Human fix, two places:** (a) **long-press the green card mid-round** → "Mark this as the middle of
   N?" → the outline slides so its center is where the phone is, saved for everyone (`source: 'fixed'`);
   (b) an **organizer map page** (the spike's check page, promoted), tucked under Host settings, to see all
   18 greens on satellite and drag a pin.

Rejected: walking every green before the first round (Andrew doesn't love it as the plan — it's only the fix
tool now); paid golf-data APIs (monthly cost + dependency; revisit only if the AI route is too inaccurate).

## 3. Phone side — decided
- **Permission:** never ask on open. Start the watch when Enter renders and GPS is on for the round. Denied
  → card shows "Turn on location for yardages" + the same iOS steps Near you shows. Most phones already said
  yes in Setup's Near you, but grants expire; handle it every time.
- **Accuracy:** show `±N YD` from `coords.accuracy`. Worse than ~25 yd → keep the card, hide the numbers,
  "Finding you…". A wrong number is worse than none.
- **Battery:** `enableHighAccuracy: true` only while Enter is the visible tab and the page is visible; stop
  the watch on other tabs / hidden. First fix 5–15 s → show the last known numbers greyed + "updating",
  never a spinner.
- **Weak signal:** GPS needs no cell signal; only the course data does. Download the course geo (a few KB)
  when the round loads, cache in `db.local` next to the scorecard → fully offline after that.
- **Which hole:** the hole Enter is on. No auto-detect in V1. Later nudge: within ~30 yd of a different
  green's center → "Looks like you're on 12" in the header, tap to jump.

## 4. Data model — decided
One new table, keyed by course (this is the V2 "shared courses table", arriving early):
```
course_geo
  course_key  text primary key   -- the key Setup saves: 'oga:<id>', 'oga:<id>#N', or a built-in id
  holes       jsonb              -- [{ hole, tee: [lat,lng], green: [[lat,lng],…], source: 'osm'|'ai'|'fixed' }] ×18
  source      text               -- osm / ai / mixed
  built_at, updated_at timestamptz
```
- RLS: anon `select` only. Writes via SECURITY DEFINER RPCs returning `{ok, error}`:
  `build_course_geo(course_key, holes)` (called by the Edge Function that does Overpass + Mapbox + AI) and
  `fix_green(course_key, hole, lat, lng)` (the long-press / organizer fix).
- Trigger: Setup picks a course → the app calls the Edge Function in the background (like the scorecard
  load, `s.courseStatus`). Never blocks Save; a round without geo picks it up on the next load.
- Mock: `tests/mock-supabase.mjs` gets a `course_geo` table seeded from `tests/fixtures/geo.json` (fake
  Twin Creeks: 18 made-up polygons near the real lat/lng) so fit + smoke tests render the card offline.
- Flags: `FLAGS.gps` (off until Andrew says go) · `settings.gps` default `true`, switch in Host → Rules.
  Card renders only when flag on **and** round setting on **and** a `course_geo` row exists. Old rounds and
  unmapped courses: no card, no gap. Mirror every DB change in `schema.sql` + the mock; no destructive SQL.

## 5. Enter — decided
- The card is a new block in the `hero`, between the hole row and the score sheet; nothing else moves.
- Height tiers, like the score tiles: tall screen = full mockup (outline + three numbers); iPhone 16 =
  smaller outline; **SE = collapses to one line in the hole header** `Par 3 · Hcp 16 · 156 yd`. One new
  fit check per size: Enter still fits with the card on.
- States, never blank: has geo + good fix → numbers · waiting → last numbers greyed + "updating" ·
  denied → "Turn on location" line · no geo → no card.
- New patterns to flag for the design system: green outline component, `±N YD` accuracy chip, long-press
  fix sheet.

## 6. Done so far (Oct 22)
- Spike: Twin Creeks' 18 greens + hole lines from OpenStreetMap (`twin-creeks.geo.json`, `geo-check.html`).
  **Lesson: OSM numbered Twin Creeks' nines the other way round from the card** — the pars matched 18/18 only
  after a +9 shift. Stage 3 must check pars against our scorecard and try the shift.
- Features 011 + 013 built and **live with `FLAGS.gps` on**: `js/geo.js` (math), `js/geodata.js` (built-in
  Twin Creeks), `js/gps.js` (watcher), `js/screens/greencard.js` (card), Enter wiring, Host → Rules pill.
  Andrew saw the card work on his phone (position + math + states). Real-green accuracy still unchecked.

## 7. Stage 3 — any course: `course_geo` + the `course-geo` Edge Function (BUILT Oct 22 evening)

**What landed** (commit on `main`, see CLAUDE.md): `course_geo` table (migration `supabase/migrations/2026-10-22-course-geo.sql`,
applied), `supabase/functions/course-geo/index.ts` (deployed, `verify_jwt` off; `geo.js` / `geobuild.js` are symlinks to the app's
files, `geodata.js` an empty stub), pure build helpers in `js/geobuild.js` (Overpass parsing, par matching + the +9 shift, a
**beam-search** numbering for AI-traced greens, pixel → lat/lng), `js/geoload.js` (`loadGeo`: built-in → `glb.geo.<key>` cache →
table → function, 20 s), `geo.js` `setGeo` / `geoKey`, Setup + round-load wiring, the Rules-sheet credit, mock + fixture
(`tests/fixtures/geo.json`), 11 unit + 12 smoke checks. Differences from the spec below: the model is asked to **number the holes
itself** from our pars + routing hints (the beam search only fills what it leaves), the overview image is 1024 px at zoom 16 (one
Mapbox request, ~2 km across) and the per-hole refine is 768 px at zoom 18; a `failed` row is retried after an hour, not on every
load. `POST …/course-geo?diag=1` (from our origin) reports which secrets the function can see and whether Overpass answers — no values.
**Found while testing:** overpass-api.de answers the Edge runtime with 406 and every public mirror timed out that evening (OSM is
best-effort, as planned); the function saw **no `MAPBOX_TOKEN` / `ANTHROPIC_API_KEY`** in the project — Andrew to re-check Supabase →
Edge Functions → Secrets, then the first real builds (Bridlewood `oga:e8640131-8678-4550-9c5c-4f240ca6bd60`, Indian Creek
`oga:aa01d8c5-7791-4a69-8cd1-821a63b1b851`) run on the next round load or Setup pick. Bridlewood currently has a `failed` row from
the test call (retried after an hour).

Original spec:

Goal: a round at any course gets green outlines without anyone mapping anything. OSM where traced, AI-traced
satellite imagery where not, stored once per course in Supabase, loaded with the round, cached on the phone.
Twin Creeks keeps working from `geodata.js` even if the table is empty.

### 7.1 Data: the `course_geo` table
```sql
create table public.course_geo (
  course_key  text primary key,          -- 'twin-creeks-allen-tx' | 'oga:<id>' | 'oga:<id>#N' (same key Setup saves as course.id)
  name        text not null,
  lat         double precision, lng double precision,   -- course point (OpenGolfAPI / built-in)
  holes       jsonb not null default '[]',  -- [{ hole, par, tee:[lat,lng], green:[[lat,lng],…], source:'osm'|'ai'|'fixed', confidence:0..1 }]
  source      text not null default 'none', -- 'osm' | 'ai' | 'mixed' | 'none'
  status      text not null default 'building', -- 'building' | 'ready' | 'partial' (some holes missing) | 'failed'
  built_at    timestamptz, updated_at timestamptz not null default now(), error text
);
alter table public.course_geo enable row level security;
create policy course_geo_read on public.course_geo for select to anon using (true);  -- read-only for phones
-- Writes: only the Edge Function (service role) in stage 3; stage 4 adds fix_green(course_key, hole, lat, lng) as a
-- SECURITY DEFINER RPC (anon) that slides one hole's outline so its center = the given point and sets source='fixed'.
```
Mirror in `schema.sql` **and** `tests/mock-supabase.mjs` (table + `from('course_geo').select` + the function route).
Phone cache: `glb.geo.<course_key>` = the row's `holes` + `updated_at` (via `db.local`); refreshed when the round
loads and the table's `updated_at` is newer.

### 7.2 The Edge Function `supabase/functions/course-geo/index.ts` (`verify_jwt` off, our origins only, like course-search)
`POST { course_key, name, lat, lng, holes: [{ hole, par }] }` → builds (or returns) the row. Steps:
1. **Return early** if the row is `ready` (or `partial` and younger than 7 days). Insert `building` otherwise
   (one build at a time per key: `insert … on conflict do nothing`, bail if someone else is building).
2. **OSM (Overpass):** `way[golf=green|hole|tee](around:1500, lat, lng)` with `out geom`, from
   `https://overpass-api.de/api/interpreter`, fallback `https://overpass.kumi.systems/api/interpreter`;
   POST form body (`data=`), 60 s timeout, one retry. Server-side, so no CORS; the public API is flaky at
   peak — treat failure as "no OSM", not an error.
3. **Match OSM to our card:**
   - Hole lines with `ref` → green = the one whose center is nearest the line's last point (≤ 30 yd), tee = the
     line's first point. Compare pars (`tags.par`) to our card: if < 15/18 match, try the +9 shift
     (Twin Creeks case) and keep the better; still < 15 → trust our hole numbers only where the par matches.
   - Greens but no hole lines → unnumbered: hand them to step 4's numbering with the AI tees.
   - Nothing → step 4 for all 18.
4. **AI tracing for missing holes (Mapbox + Claude):**
   - Imagery: Mapbox Static Images API, `mapbox/satellite-v9`, 1280×1280 @2x, zoom 16 (≈1.2 m/px), centered
     on the course; a second tile set at zoom 17 per missing hole once a rough green position is known.
     Secret `MAPBOX_TOKEN`.
   - Model: `claude-sonnet-4-5` (vision), secret `ANTHROPIC_API_KEY`. Prompt: the image + "This is a golf
     course. Return JSON: every putting green as a closed polygon of pixel points (8–20 points), every tee
     box as a point, and the clubhouse/first tee if visible. Pixel coordinates, origin top-left." Ask for
     `confidence` per green. Convert pixels → lat/lng with Web Mercator (`lon = cx + (px - w/2) * 360 /
     (256 * 2^z * scale)`, lat via `atan(sinh(…))`). Pure, unit-tested in `js/geo.js` (`pixelToLatLng`).
   - **Numbering:** known OSM/our greens are fixed; for the rest, chain tee → green greedily from the
     clubhouse (course point) in play order, scoring each assignment by distance to the par's expected
     length (par 3 ≈ 120–220 yd, par 4 ≈ 300–450, par 5 ≈ 450–600). `confidence` < 0.5 → mark the hole
     `source:'ai'`, keep it, status `partial` so the organizer page (stage 4) flags it.
   - Cost: ~2–4 model calls per course, cents. Cache the satellite tiles nowhere (fetch per build only).
5. **Save** the row (`ready` if 18 holes, else `partial` + `error` text), return it.
6. Budget: Edge Function 60 s wall clock → do OSM + one AI pass in the request; if AI needs more, save
   `partial` and let the next request (the round load) continue. Never leave `building` for > 2 min (stale
   `building` rows are retried).

### 7.3 App side
- `js/geo.js`: `geoFor(course)` stays sync (built-ins + an in-memory map); new `loadGeo(course)` (async):
  built-in → phone cache → `supabase.from('course_geo').select('*').eq('course_key', key)` → if missing /
  stale, POST the Edge Function (fire and forget, 20 s timeout) → put in the map + cache → `app.render()`.
- Kick off `loadGeo` **in Setup when a course is picked** (same moment as the scorecard load, so it's usually
  ready by Save) and **when a round loads** (covers old rounds + the second phone). Never blocks anything;
  `cardOn()` is simply false until the greens arrive.
- Attribution: "Greens © OpenStreetMap contributors (ODbL) · Imagery © Mapbox" in the Rules sheet / About.
- Mock: `tests/fixtures/geo.json` gains a fictional course row; `be.geo.osmDown` / `be.geo.aiDown` toggles.

### 7.4 Tests
- Unit: `pixelToLatLng` round-trip; par matching + the +9 shift; greedy numbering on a synthetic course.
- Smoke: a course with a `course_geo` row shows the card; a course without one calls the function once and
  stores the result; a `partial` row shows the card only on its holes.

### 7.5 What Andrew sets up before the session (keys never in the repo or in chat)
1. **Mapbox**: account → Tokens → a token with the `styles:tiles` / Static Images scope → Supabase →
   Edge Functions → Secrets → `MAPBOX_TOKEN`.
2. **Anthropic API key** (console.anthropic.com, billing on) → Supabase secret `ANTHROPIC_API_KEY`.
3. Nothing else: Edge Functions get `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` automatically.

## 8. Stage 4 — fixes (after stage 3)
- Long-press the green card → "Mark this as the middle of N?" → `fix_green` RPC (slides the outline).
- Organizer page under Host settings: `geo-check.html` promoted into the app (`#/geo/<course_key>`): every
  green numbered on satellite, drag to fix, "looks wrong" flags from `partial` rows.
- Then re-check accuracy at Twin Creeks against the markers before calling it done.
