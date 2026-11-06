// geoload.js — gets a course's green outlines onto this phone (GPS yardages stage 3,
// docs/design/yardages/NOTES.md §7.3). Order: built in (js/geodata.js) → phone cache (`glb.geo.<key>`)
// → the shared `course_geo` table → if the course has no row yet (or an unfinished one), ask the
// `course-geo` Edge Function to build it (fire and forget, 20 s) and take what it returns.
// Never blocks anything: the card simply stays off until greens arrive, then `onReady` re-renders.
import { SUPABASE_URL } from './config.js';
import { sb, local, NetworkError } from './db.js';
import { geoFor, geoKey, setGeo } from './geo.js';

export const GEO_FN = `${SUPABASE_URL}/functions/v1/course-geo`;
export const GEO_ATTRIBUTION = 'Greens © OpenStreetMap contributors (ODbL) · Imagery © Mapbox';
const BUILD_TIMEOUT_MS = 20000;
const STALE_BUILDING_MS = 2 * 60 * 1000, STALE_PARTIAL_MS = 7 * 24 * 60 * 60 * 1000, STALE_FAILED_MS = 60 * 60 * 1000;
const inflight = new Map(); // key → promise (one load per course per visit)

const cacheKey = (key) => `glb.geo.${key}`;

/** Should we ask the function to (re)build this row? */
export function needsBuild(row, now = Date.now()) {
  if (!row) return true;
  const age = now - Date.parse(row.updated_at || 0);
  if (row.status === 'ready') return false;
  if (row.status === 'partial') return /^pending/.test(row.error || '') || age > STALE_PARTIAL_MS;
  if (row.status === 'building') return age > STALE_BUILDING_MS;
  return age > STALE_FAILED_MS; // failed
}

/** A table row (or the function's reply) → what the card needs, or null when it has no greens. */
function fromRow(row) {
  if (!row || !Array.isArray(row.holes) || !row.holes.length) return null;
  const holes = row.holes.filter((h) => h && h.hole >= 1 && h.hole <= 18 && Array.isArray(h.green) && h.green.length >= 3 && Array.isArray(h.tee));
  return holes.length ? { name: row.name, source: row.source, status: row.status, updated_at: row.updated_at, holes } : null;
}

/** The body the function needs: our card's pars + the course point. Null when the course can't be built (no location). */
export function buildBody(course) {
  const key = geoKey(course);
  const pars = (course?.par || []).map((p, i) => ({ hole: i + 1, par: Number(p), ...(course.yards?.[i] ? { yards: course.yards[i] } : {}) }));
  if (!key || !Number.isFinite(course?.lat) || !Number.isFinite(course?.lng) || pars.length !== 18 || pars.some((h) => !(h.par >= 3 && h.par <= 6))) return null;
  return { course_key: key, name: course.name || course.shortName || key, lat: course.lat, lng: course.lng, holes: pars };
}

/**
 * Load the greens for a course. Resolves to the geo (or null); calls `onReady(geo)` each time something
 * usable arrives (cache, then a newer row, then a freshly built one) so the caller can re-render.
 */
export function loadGeo(course, onReady) {
  const key = geoKey(course);
  if (!key) return Promise.resolve(null);
  const builtIn = geoFor(course);
  if (builtIn && builtIn.status !== 'partial') return Promise.resolve(builtIn);
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    let have = null;
    const take = (row) => {
      const geo = fromRow(row);
      if (!geo) return false;
      if (have && have.updated_at && geo.updated_at && geo.updated_at <= have.updated_at && geo.holes.length <= have.holes.length) return false;
      have = geo;
      setGeo(key, geo);
      local.set(cacheKey(key), { ...geo, cachedAt: new Date().toISOString() });
      try { onReady?.(geo); } catch { /* render errors are the caller's */ }
      return true;
    };
    take(local.get(cacheKey(key)));
    let row = null;
    try {
      const res = await sb().from('course_geo').select('*').eq('course_key', key).maybeSingle();
      if (res.error) throw new NetworkError(res.error.message);
      row = res.data;
      take(row);
    } catch { /* no signal: the cache is what we have */ }
    if (needsBuild(row)) {
      const body = buildBody(course);
      if (body) {
        try {
          const ctl = new AbortController();
          const t = setTimeout(() => ctl.abort(), BUILD_TIMEOUT_MS);
          const r = await fetch(GEO_FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
          clearTimeout(t);
          if (r.ok) take(await r.json());
        } catch { /* building takes longer than we wait, or no signal: the next load picks it up */ }
      }
    }
    return have;
  })();
  inflight.set(key, p);
  p.finally(() => inflight.delete(key));
  return p;
}
