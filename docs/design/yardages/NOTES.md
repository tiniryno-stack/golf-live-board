# GPS yardages — architecture notes (discussion, nothing built)

Goal: on the Enter screen, show distance from the player's phone to the green (front / middle / back),
maybe hazards later. Must work on iPhone Safari and the home screen app, mid-round, with spotty signal.

## Known facts
- OpenGolfAPI has pars, handicaps, tees, course lat/lng — **no green or hole coordinates** (checked Oct 19).
- No backend besides Supabase (Postgres + Edge Functions). Static site on GitHub Pages.
- Phone location: `navigator.geolocation.watchPosition` works in Safari over HTTPS; iPhone asks once per site
  (home screen app asks separately). Accuracy outdoors is typically 3–10 m (≈3–11 yd).

## Where green coordinates could come from
1. **OpenStreetMap** (`golf=green`, `golf=hole` ways via Overpass). Free, ODbL. Coverage varies: check Twin
   Creeks, Bridlewood, Indian Creek first. Fetching from the browser may hit CORS / be blocked; a Supabase
   Edge Function could proxy + cache.
2. **Map it ourselves:** a one-time "map this course" tool (tap front/middle/back of each green on a
   satellite map, or stand on the green and tap "mark green"). Stored in a shared `course_geo` table.
3. **Crowd-learn:** record where players are when they enter a score / last position per hole, average it.
   Slow to converge, cheap.
4. **Paid API** (e.g. golf GPS data providers): costs money, key must live in a function secret.

## Open questions for Andrew
- Front/middle/back only, or also hazards / layups / tap-to-measure on a map?
- Map view (satellite tiles) or just numbers on Enter?
- Who maps a course if OSM lacks it — organizer before the round, anyone on the course?
- Battery: GPS on only while Enter is open? Off by default per round (`settings.gps`)?
- Which hole is "current" — play-order hole on Enter, or auto-detect from position?

## Constraints
- Design system only (docs/design/design-system/); flag any new pattern.
- Behind a flag; old rounds and courses with no geo data show nothing (no blank space, no errors).
- Mirror any DB change in `schema.sql` + `tests/mock-supabase.mjs`; no destructive SQL.
