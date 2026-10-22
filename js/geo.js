// geo.js — pure yardage math for the green card (features 011 + 013). No DOM, no network.
// A green is a closed outline of [lat, lng] points; "from" is the phone (or a tee) as [lat, lng].
// Middle = the outline's center; front / back = where the line from `from` through the center
// enters and leaves the outline (the outline's extent along that line). Whole yards.
import { GEO } from './geodata.js';

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
const YD_PER_DEG = 111320 / 0.9144; // yards per degree of latitude

export function metersBetween(a, b) {
  const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const yards = (m) => m / 0.9144;

export function center(pts) {
  let la = 0, ln = 0;
  for (const p of pts) { la += p[0]; ln += p[1]; }
  return [la / pts.length, ln / pts.length];
}

/** Local flat coordinates in yards around `origin`: x east, y north. */
function local(p, origin) {
  return [(p[1] - origin[1]) * Math.cos(rad(origin[0])) * YD_PER_DEG, (p[0] - origin[0]) * YD_PER_DEG];
}

/** { front, middle, back, bearing } from `from` to the green; bearing = radians clockwise from north. */
export function yardages(from, green) {
  const c = center(green);
  const [ux, uy] = local(c, from);
  const L = Math.hypot(ux, uy) || 1e-9;
  let lo = Infinity, hi = -Infinity;
  for (const p of green) {
    const [px, py] = local(p, from);
    const s = (px * ux + py * uy) / L; // distance along the line of play
    if (s < lo) lo = s;
    if (s > hi) hi = s;
  }
  return { front: Math.round(lo), middle: Math.round(yards(metersBetween(from, c))), back: Math.round(hi), bearing: Math.atan2(ux, uy) };
}

/** Keys a course can be found under: its id, 'oga:<ogaId>', and both without a '#N' course suffix. */
export function geoKeys(course) {
  if (!course) return [];
  const keys = [course.id, course.ogaId && `oga:${course.ogaId}`, course.source, course.key].filter(Boolean).map(String);
  return [...new Set(keys.flatMap((k) => [k, k.replace(/#\d+$/, '')]))];
}

/** The key the shared course_geo table uses for this course (the id Setup saved), or null. */
export const geoKey = (course) => (course?.id ? String(course.id) : course?.ogaId ? `oga:${course.ogaId}` : null);

// Courses loaded this visit from the shared course_geo table (js/geoload.js): key → { name, source, holes }.
const LOADED = new Map();
export function setGeo(key, geo) {
  if (key && geo?.holes?.length) LOADED.set(key, geo);
}

/** Course geo for a round's course, or null: built-ins (js/geodata.js) first, then what's been loaded. */
export function geoFor(course) {
  for (const k of geoKeys(course)) {
    const g = GEO[k] || LOADED.get(k);
    if (g) return g;
  }
  return null;
}

/** The green for a hole (1–18) of a course, or null. */
export function greenFor(course, hole) {
  const g = geoFor(course);
  return g?.holes.find((h) => h.hole === hole) || null;
}

/**
 * Web Mercator: a pixel in a map image centered on (cLat, cLng) at `zoom` (Mapbox Static Images,
 * `scale` 1 or 2 for @2x) → [lat, lng]. Origin top-left; the image's center is the map center.
 */
export function pixelToLatLng(px, py, w, h, cLat, cLng, zoom, scale = 1) {
  const world = 256 * 2 ** zoom * scale;
  const latr = rad(cLat);
  const cx = ((cLng + 180) / 360) * world;
  const cy = ((1 - Math.log(Math.tan(latr) + 1 / Math.cos(latr)) / Math.PI) / 2) * world;
  const x = cx + (px - w / 2), y = cy + (py - h / 2);
  const lng = (x / world) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world))) * 180) / Math.PI;
  return [lat, lng];
}

/** The inverse of pixelToLatLng (tests, and centering a zoomed-in image on a rough green). */
export function latLngToPixel(lat, lng, w, h, cLat, cLng, zoom, scale = 1) {
  const world = 256 * 2 ** zoom * scale;
  const merc = (la) => { const r = rad(la); return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * world; };
  return [w / 2 + (((lng - cLng) / 360) * world), h / 2 + (merc(lat) - merc(cLat))];
}

/** Round off the outline for drawing (display only): each point eases toward its neighbours, n passes. */
export function relax(pts, n = 4) {
  let q = pts;
  for (let k = 0; k < n; k++) {
    const m = q.length;
    q = q.map((c, i) => { const a = q[(i - 1 + m) % m], b = q[(i + 1) % m]; return [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4]; });
  }
  return q;
}

/** Closed Catmull-Rom spline through the points as an SVG path (cubic Béziers). */
export function splinePath(p) {
  const n = p.length;
  if (n < 3) return '';
  const f = (v) => v.toFixed(1);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

/**
 * The green drawn into a w × h box, rotated so the approach from `from` comes from the bottom,
 * split into three bands of equal depth along the line of play (back 30%, middle 19%, front 10%
 * of `text`, 2px surface gaps), outline in text-muted, a dot in `text` at the middle.
 * Returns an SVG string (currentColor = text; --surface-1 for the gaps).
 */
export function greenSvg(from, green, w, h) {
  const c = center(green);
  const rot = -yardages(from, green).bearing; // line of play → up
  const pts = relax(green.map((p) => {
    const [x, y] = local(p, c);
    return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
  }));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 2;
  const s = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const sp = pts.map((p) => [w / 2 + (p[0] - cx) * s, h / 2 - (p[1] - cy) * s]); // y down on screen
  const path = splinePath(sp);
  const top = h / 2 - (maxY - cy) * s, bot = h / 2 - (minY - cy) * s, third = (bot - top) / 3;
  const band = (y0, y1, a) => `<rect x="0" y="${y0.toFixed(1)}" width="${w}" height="${(y1 - y0).toFixed(1)}" fill="currentColor" fill-opacity="${a}" clip-path="url(#gc)"/>`;
  const gap = (y) => `<line x1="0" x2="${w}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--surface-1)" stroke-width="2"/>`;
  const dot = [w / 2 - cx * s + 0 * s, h / 2 + cy * s]; // the outline's center sits at (−cx, −cy) relative to the box center
  return `<svg class="green-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <defs><clipPath id="gc"><path d="${path}"/></clipPath></defs>
    ${band(top, top + third, 0.30)}${band(top + third, top + 2 * third, 0.19)}${band(top + 2 * third, bot, 0.10)}
    ${gap(top + third)}${gap(top + 2 * third)}
    <path d="${path}" fill="none" stroke="var(--text-muted)" stroke-width="1.5"/>
    <circle cx="${dot[0].toFixed(1)}" cy="${dot[1].toFixed(1)}" r="3" fill="currentColor"/>
  </svg>`;
}
