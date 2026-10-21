// coursedata.js — find a course and its scorecard.
//
// Source: OpenGolfAPI (https://opengolfapi.org), free and keyless to read, built on
// OpenStreetMap: © OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI. Show ATTRIBUTION
// wherever its data appears. The phone calls the API directly; if that's blocked (CORS or
// a network that filters it), it switches to our Supabase function `course-search`, which
// forwards the same two read-only calls.
//
// Everything here except the fetch helpers is pure (unit-tested in tests/courses.test.mjs).

import { SUPABASE_URL } from './config.js';
import { COURSES } from './courses.js';

export const OGA = 'https://api.opengolfapi.org/api/v1/courses';
export const PROXY = `${SUPABASE_URL}/functions/v1/course-search`;
export const ATTRIBUTION = '© OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI';
const TIMEOUT_MS = 9000;

// ───────────────────────────────────────────── fetching

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

let viaProxy = false; // once the direct route is blocked, use the proxy for the rest of the visit

async function getJson(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new HttpError(r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** One read call: direct first, then the proxy if the direct route is blocked. */
async function call(direct, proxied) {
  if (!viaProxy) {
    try {
      return await getJson(direct);
    } catch (e) {
      if (e.name === 'HttpError' && e.status !== 403) throw e; // the API answered: don't retry elsewhere
      viaProxy = true;
    }
  }
  try {
    return await getJson(proxied);
  } catch (e) {
    if (e.name !== 'HttpError') viaProxy = false; // probably just no signal: try direct next time
    throw e;
  }
}

/** Courses near a point, nearest first (each has `distance`, in miles). */
export async function nearbyCourses(lat, lng, radiusMi = 25) {
  const p = new URLSearchParams({ lat: lat.toFixed(4), lng: lng.toFixed(4), radius_mi: String(radiusMi), limit: '25' });
  const res = await call(`${OGA}/search?${p}`, `${PROXY}?${p}`);
  return sortByDistance(listOf(res).map(fromSearchRow), { lat, lng });
}

/** Courses matching a name; nearest first when we know where the phone is. */
export async function searchCourses(q, here = null) {
  const p = new URLSearchParams({ q: q.trim().slice(0, 60), limit: '25' });
  const res = await call(`${OGA}/search?${p}`, `${PROXY}?${p}`);
  return sortByDistance(listOf(res).map(fromSearchRow), here);
}

/** The full course (scorecard + tees) in our course shape. */
export async function fetchCourse(ogaId) {
  if (!/^[0-9a-f-]{36}$/i.test(ogaId)) throw new Error('bad course id');
  const res = await call(`${OGA}/${ogaId}`, `${PROXY}?id=${ogaId}`);
  return fromOpenGolf(res?.course || res?.data || res);
}

// ───────────────────────────────────────────── shaping (pure)

function listOf(res) {
  if (Array.isArray(res)) return res;
  return res?.courses || res?.results || res?.data || [];
}

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** A search result row → { ogaId, name, city, state, lat, lng, par, distance }. */
export function fromSearchRow(r) {
  return {
    ogaId: String(r.id),
    name: (r.name || r.course_name || r.club_name || 'Golf course').trim(),
    city: r.city || '',
    state: r.state || '',
    lat: num(r.latitude ?? r.lat),
    lng: num(r.longitude ?? r.lng),
    par: num(r.par),
    distance: num(r.distance_mi),
  };
}

/** "The Golf Club at Twin Creeks" → "Twin Creeks"; "Ridgeview Ranch Golf Course" → "Ridgeview Ranch". */
export function shortCourseName(name) {
  const full = String(name || '').trim().replace(/\s+/g, ' ');
  let s = full.replace(/^the\s+/i, '');
  s = s.replace(/^(golf club|golf course|golf courses|golf links|country club|courses|course|club|links)\s+(at|of)\s+/i, '');
  s = s.replace(/\s+(golf (&|and) country club|golf club|golf course|golf courses|golf links|golf resort|golf center|golf centre|country club|municipal golf course|golf|gc|cc)$/i, '');
  s = s.trim();
  return (s || full).slice(0, 28);
}

/**
 * A club listed as one course with two or three courses' holes mixed in (the same hole number
 * more than once): split it in listing order — the first hole 1, 2 … 18 is Course 1, the second
 * of each is Course 2, … Each variant: label (the listing's own course name if a hole row has
 * one, else "Course N"), pars, hole handicaps, total par, and holes 1 + 18 for matching the card.
 * Fewer than 2 complete 18-hole sets → [] (a normal course).
 */
export function splitCourses(rows) {
  const by = new Map();
  for (const r of rows || []) {
    if (!(r.n >= 1 && r.n <= 18)) continue;
    if (!by.has(r.n)) by.set(r.n, []);
    by.get(r.n).push(r);
  }
  const k = Math.max(0, ...[...by.values()].map((l) => l.length));
  if (k < 2) return [];
  const out = [];
  for (let j = 0; j < k; j++) {
    const at = (n) => by.get(n)?.[j];
    if (!Array.from({ length: 18 }, (_, i) => at(i + 1)).every(Boolean)) continue;
    const par = Array.from({ length: 18 }, (_, i) => at(i + 1).par ?? null);
    const strokeIndex = Array.from({ length: 18 }, (_, i) => at(i + 1).si ?? null);
    const named = at(1).course || null;
    out.push({ n: j + 1, label: named || `Course ${j + 1}`, named: !!named, par, strokeIndex, parTotal: par.reduce((a, b) => a + (b || 0), 0) });
  }
  return out.length > 1 ? out : [];
}

/** OpenGolfAPI course detail → our course shape (the same shape js/courses.js uses). */
export function fromOpenGolf(d) {
  if (!d || !d.id) throw new Error('no course');
  const name = (d.course_name || d.club_name || d.name || 'Golf course').trim();
  const rows = (d.holes_data || d.scorecard || []).map((h) => ({
    n: num(h.number ?? h.hole),
    par: num(h.par),
    si: num(h.handicap_index ?? h.handicap ?? h.stroke_index),
    yards: h.yardages || null,
    course: (h.course_name || h.course || h.layout || '').toString().trim() || null,
  }));
  const holes = num(d.holes) || rows.filter((h) => h.n).length || 18;
  const at = (n) => rows.find((h) => h.n === n);
  const par = Array.from({ length: 18 }, (_, i) => at(i + 1)?.par ?? null);
  const strokeIndex = Array.from({ length: 18 }, (_, i) => at(i + 1)?.si ?? null);
  const raw = (d.tees || []).filter((t) => t.tee_name || t.name);
  const named = (t) => (t.tee_name || t.name).trim();
  const dupes = new Set(raw.map(named).filter((n, i, a) => a.indexOf(n) !== i));
  const tees = raw
    .map((t) => {
      const g = String(t.gender || '').toLowerCase();
      const label = dupes.has(named(t)) && g ? `${named(t)} (${g.startsWith('f') ? 'W' : 'M'})` : named(t);
      return { name: label, yards: num(t.yardage ?? t.yards), rating: num(t.course_rating ?? t.rating), slope: num(t.slope) };
    })
    .sort((a, b) => (b.yards || 0) - (a.yards || 0));
  const variants = splitCourses(rows);
  return {
    ...(variants.length > 1 ? { variants } : {}),
    id: `oga:${d.id}`,
    ogaId: String(d.id),
    name,
    shortName: shortCourseName(name),
    location: [d.city, d.state].filter(Boolean).join(', '),
    lat: num(d.lat ?? d.latitude),
    lng: num(d.lng ?? d.longitude),
    tees,
    par,
    strokeIndex,
    holes,
    source: 'opengolfapi',
  };
}

/** A built-in (checked against the real card) course for an OpenGolfAPI id, if we have one. */
export function builtInFor(ogaId) {
  return COURSES.find((c) => c.ogaId && c.ogaId === ogaId) || null;
}

/** Everything wrong with a scorecard, in plain English (empty = good to play). */
export function scorecardProblems(c) {
  if (!c) return ['Pick a course.'];
  const out = [];
  if (c.holes && c.holes !== 18) {
    out.push(`${c.holes}-hole course: the app needs 18 holes for now.`);
    return out;
  }
  const list = (holes) => (holes.length > 4 ? `${holes.slice(0, 4).join(', ')}…` : holes.join(', '));
  const badPar = [];
  (c.par || []).forEach((p, i) => { if (!(Number.isInteger(p) && p >= 3 && p <= 6)) badPar.push(i + 1); });
  if ((c.par || []).length !== 18) out.push('The scorecard needs 18 pars.');
  else if (badPar.length) out.push(`Par missing or off on hole${badPar.length > 1 ? 's' : ''} ${list(badPar)}.`);
  const si = c.strokeIndex || [];
  const missing = [];
  si.forEach((v, i) => { if (!(Number.isInteger(v) && v >= 1 && v <= 18)) missing.push(i + 1); });
  if (si.length !== 18 || missing.length === 18) out.push('Hole handicaps are missing. Copy them from the card (1 = hardest hole).');
  else if (missing.length) out.push(`Hole handicap missing on hole${missing.length > 1 ? 's' : ''} ${list(missing)}.`);
  else {
    const seen = new Map();
    si.forEach((v) => seen.set(v, (seen.get(v) || 0) + 1));
    const twice = [...seen].filter(([, n]) => n > 1).map(([v]) => v);
    if (twice.length) out.push(`Hole handicap ${twice.join(', ')} is used twice. Each number 1–18 goes on one hole.`);
  }
  return out;
}

/** Straight-line miles between two points. */
export function distanceMi(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null;
  const R = 3958.8;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest first (keeps the API's distance when it gave one). */
export function sortByDistance(rows, here) {
  const out = rows.map((r) => ({ ...r, distance: r.distance ?? (here ? distanceMi(here, r) : null) }));
  if (!out.some((r) => r.distance != null)) return out;
  return out.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
}

/** "here" / "1.4 mi" / "12 mi" / "" */
export function fmtMiles(d) {
  if (d == null) return '';
  if (d < 0.15) return 'here';
  return d < 10 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`;
}

// ───────────────────────────────────────────── did you mean (course search, no results)

const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Edit distance (insert / delete / substitute = 1). */
export function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/**
 * Courses whose name is a near miss for what was typed ("twin crek" → Twin Creeks), best first.
 * Compares the words typed with each stretch of the name that starts at a word, allowing about one
 * slip per 4 letters. Courses the search already found aren't repeated.
 */
export function didYouMean(q, courses, max = 2) {
  const t = normName(q);
  if (t.length < 3) return [];
  const slack = Math.max(1, Math.floor(t.length / 4));
  const seen = new Set();
  const out = [];
  for (const c of courses || []) {
    const key = c.ogaId || c.id || c.name;
    if (!c?.name || seen.has(key)) continue;
    const name = normName(`${c.name} ${c.shortName || ''}`);
    if (name.includes(t)) continue; // a real hit, not a near miss
    let best = Infinity;
    const starts = [0, ...[...name.matchAll(/ /g)].map((m) => m.index + 1)];
    for (const st of starts) {
      for (let len = Math.max(1, t.length - slack); len <= t.length + slack; len++) best = Math.min(best, editDistance(t, name.slice(st, st + len)));
    }
    if (best <= slack) {
      seen.add(key);
      out.push({ c, d: best });
    }
  }
  return out.sort((a, b) => a.d - b.d).slice(0, max).map((x) => x.c);
}
