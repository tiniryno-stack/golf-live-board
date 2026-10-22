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

/** Dev override (db.geoTest): the whole course slid so hole 1's green center sits at [lat, lng]. */
let testAt = null;
const shifted = new Map();
export function setGeoTest(at) { testAt = Array.isArray(at) ? at : null; shifted.clear(); }
function slide(g) {
  if (!testAt) return g;
  if (shifted.has(g)) return shifted.get(g);
  const h1 = g.holes.find((h) => h.hole === 1) || g.holes[0];
  const c = center(h1.green);
  const d = [testAt[0] - c[0], testAt[1] - c[1]];
  const mv = (p) => [p[0] + d[0], p[1] + d[1]];
  const out = { ...g, name: `${g.name} (test)`, holes: g.holes.map((h) => ({ ...h, tee: mv(h.tee), green: h.green.map(mv) })) };
  shifted.set(g, out);
  return out;
}

/** Course geo for a round's course, or null. `course` is the snapshot's course ({ id, ogaId }). */
export function geoFor(course) {
  if (!course) return null;
  const keys = [course.id, course.ogaId && `oga:${course.ogaId}`, course.source, course.key].filter(Boolean);
  for (const k of keys) {
    const g = GEO[k] || GEO[String(k).replace(/#\d+$/, '')];
    if (g) return slide(g);
  }
  return null;
}

/** The green for a hole (1–18) of a course, or null. */
export function greenFor(course, hole) {
  const g = geoFor(course);
  return g?.holes.find((h) => h.hole === hole) || null;
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
