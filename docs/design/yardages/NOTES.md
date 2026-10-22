# GPS yardages — architecture notes

Status: **decided Oct 22, 2026; spike done the same day (Twin Creeks greens from OSM, `geo-check.html`); features 011 + 013 built behind `FLAGS.gps` (off).** Next: §4's `course_geo` table + the Overpass / AI Edge Function so courses other than Twin Creeks get greens, then the fixes (§2.3), then flip the flag.

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

## 6. Next: the spike (prove the mapping before any app UI)
1. Mapbox account (Andrew) + satellite tiles for Twin Creeks.
2. Throwaway script: Overpass for Twin Creeks; vision model on the satellite image for any holes OSM
   misses → 18 tee points + green outlines, `source` per hole.
3. `geo-check.html` (dev page like `sim.html`, not the app): satellite map, every green numbered,
   front/middle/back from the 1st tee. Andrew judges it on his phone, then stands on a green and compares.
4. Greens right → build §4–5 behind `FLAGS.gps`. Mis-numbered a lot → fix the numbering step first.
   Either way `geo-check.html` becomes the organizer pin-placing page.

## 7. Open items
- Multi-course clubs: `course_geo` is per `oga:<id>#N`, so the "Which course?" pick must happen before
  the geo build.
- Tee point per tee color (back/middle/front tees) if front/back lines differ noticeably — V2.
- Hazards = more polygons in the same `holes` entry, same pipeline — later.
- Attribution: OSM data is ODbL (show it next to the OpenGolfAPI line); Mapbox terms for cached imagery.
