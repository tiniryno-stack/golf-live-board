// geobuild.js — pure helpers for building a course's green data (GPS yardages stage 3,
// docs/design/yardages/NOTES.md §7). Used by the course-geo Edge Function (Deno, via a symlink in
// supabase/functions/course-geo/) and unit-tested in tests/geo.test.mjs. No DOM, no network.
//
// Shapes: a point is [lat, lng]; a green is { pts: [[lat,lng],…], center: [lat,lng], confidence? };
// our card is [{ hole, par }] (18 holes); a built hole is
// { hole, par, tee, green, source: 'osm' | 'ai', confidence }.
import { metersBetween, yards, center, pixelToLatLng } from './geo.js';

const yd = (a, b) => yards(metersBetween(a, b));

/** Expected hole length by par (yards), used to number AI-traced greens. */
export const PAR_LENGTH = { 3: [120, 220], 4: [300, 450], 5: [450, 600] };

/** Overpass JSON → { greens, holes, tees } in our shapes. Ignores anything without geometry. */
export function parseOverpass(json) {
  const greens = [], holes = [], tees = [];
  for (const el of json?.elements || []) {
    if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
    const pts = el.geometry.map((p) => [p.lat, p.lon]);
    const t = el.tags || {};
    if (t.golf === 'green') {
      if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      if (pts.length >= 3) greens.push({ pts, center: center(pts), source: 'osm', confidence: 1 });
    } else if (t.golf === 'hole') {
      const ref = parseInt(t.ref, 10), par = parseInt(t.par, 10);
      holes.push({ ref: Number.isFinite(ref) ? ref : null, par: Number.isFinite(par) ? par : null, line: pts });
    } else if (t.golf === 'tee') {
      tees.push(center(pts));
    }
  }
  return { greens, holes, tees };
}

/**
 * Match OSM hole lines to our scorecard. Returns { holes: Map hole → built hole, matches, shift,
 * usedGreens: Set of green indexes }. A line's green = the green whose center is nearest its last
 * point (≤ 30 yd); its tee = the first point. OSM's hole numbers are checked against our pars: < 15/18
 * matching → try the +9 shift (nines swapped) and keep the better; still < 15 → keep a hole only where
 * its par matches ours.
 */
export function matchOsm(card, osm) {
  const parOf = new Map(card.map((h) => [h.hole, h.par]));
  const byRef = new Map();
  for (const h of osm.holes) {
    if (!h.ref || h.ref < 1 || h.ref > 18 || byRef.has(h.ref)) continue;
    const last = h.line[h.line.length - 1];
    let best = -1, bestD = 30;
    osm.greens.forEach((g, i) => { const d = yd(last, g.center); if (d <= bestD) { bestD = d; best = i; } });
    if (best < 0) continue;
    byRef.set(h.ref, { ref: h.ref, par: h.par, tee: h.line[0], gi: best });
  }
  const tryShift = (shift) => {
    let matches = 0, known = 0;
    for (const [ref, h] of byRef) {
      const hole = ((ref - 1 + shift) % 18) + 1;
      if (h.par == null) continue;
      known++;
      if (h.par === parOf.get(hole)) matches++;
    }
    return { shift, matches, known };
  };
  let best = tryShift(0);
  if (best.matches < 15) {
    const alt = tryShift(9);
    if (alt.matches > best.matches) best = alt;
  }
  const trustAll = best.matches >= 15 || (best.known === 0 && byRef.size >= 15);
  const holes = new Map(), usedGreens = new Set();
  for (const [ref, h] of byRef) {
    const hole = ((ref - 1 + best.shift) % 18) + 1;
    if (!trustAll && h.par !== parOf.get(hole)) continue;
    if (usedGreens.has(h.gi)) continue;
    usedGreens.add(h.gi);
    holes.set(hole, { hole, par: parOf.get(hole) ?? null, tee: h.tee, green: osm.greens[h.gi].pts, source: 'osm', confidence: 1 });
  }
  return { holes, matches: best.matches, shift: best.shift, usedGreens };
}

/**
 * Number unnumbered greens (OSM greens without hole lines, AI-traced greens) by chaining tee → green
 * from `start` (the course point / clubhouse) in play order. A beam search over the holes keeps the
 * 64 cheapest partial numberings; each step picks a tee near where the last green was and a green
 * whose distance from it fits the par (PAR_LENGTH), or skips the hole (expensive). `fixed` = Map
 * hole → built hole (kept as is). Returns Map hole → built hole (fixed + numbered).
 */
export function numberHoles(card, fixed, greens, tees, start, beamWidth = 64) {
  const gc = greens.map((g) => g.center);
  const SKIP = 4, NO_TEE = 1.5, MAX_WALK = 400;
  let beam = [{ cost: 0, pos: start, usedG: new Set(), usedT: new Set(), picks: new Map() }];
  for (const { hole, par } of card) {
    // holes 1 and 10 start near the clubhouse, 9 and 18 finish there
    const home = (p) => (yd(p, start) / 200) ** 2;
    const f = fixed.get(hole);
    if (f) { const c = center(f.green); beam = beam.map((b) => ({ ...b, pos: hole === 9 ? start : c })); continue; }
    const [lo, hi] = PAR_LENGTH[par] || [100, 650];
    const mid = (lo + hi) / 2;
    const next = [];
    for (const b of beam) {
      next.push({ ...b, cost: b.cost + SKIP }); // the hole stays missing
      // no tee known: the tee is somewhere within ~250 yd of where we are, so the green can be that much further
      const teeOpts = [{ ti: -1, tee: b.pos, c: NO_TEE, lo: lo - 40, hi: hi + 60 + 250, mid: mid + 120, span: hi - lo + 250 }];
      tees.forEach((t, ti) => {
        if (b.usedT.has(ti)) return;
        const walk = yd(b.pos, t);
        if (walk <= MAX_WALK) teeOpts.push({ ti, tee: t, c: (walk / 200) ** 2, lo: lo - 40, hi: hi + 60, mid, span: hi - lo });
      });
      for (const o of teeOpts) {
        gc.forEach((g, gi) => {
          if (b.usedG.has(gi)) return;
          const d = yd(o.tee, g);
          if (d < o.lo || d > o.hi) return;
          const cost = b.cost + o.c + Math.abs(d - o.mid) / o.span + (1 - (greens[gi].confidence ?? 0.5)) * 0.5 + (hole === 9 || hole === 18 ? home(g) : 0);
          const picks = new Map(b.picks);
          picks.set(hole, { gi, tee: o.tee });
          const usedG = new Set(b.usedG), usedT = new Set(b.usedT);
          usedG.add(gi);
          if (o.ti >= 0) usedT.add(o.ti);
          next.push({ cost, pos: hole === 9 ? start : g, usedG, usedT, picks });
        });
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, beamWidth);
  }
  const best = beam[0];
  const out = new Map(fixed);
  for (const { hole, par } of card) {
    const p = best.picks.get(hole);
    if (!p) continue;
    const g = greens[p.gi];
    out.set(hole, { hole, par, tee: p.tee, green: g.pts, source: g.source || 'ai', confidence: g.confidence ?? 0.5 });
  }
  return out;
}

/** The model's pixel polygons for one image → greens / tees / clubhouse in lat/lng. */
export function fromTrace(trace, img) {
  const toLL = (p) => pixelToLatLng(p[0], p[1], img.w, img.h, img.lat, img.lng, img.zoom, img.scale || 1);
  const greens = [];
  for (const g of trace?.greens || []) {
    const raw = (Array.isArray(g?.points) ? g.points : []).filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
    if (raw.length < 3) continue;
    const pts = raw.map(toLL);
    const c = center(pts);
    const conf = Math.max(0, Math.min(1, Number(g.confidence ?? 0.5)));
    greens.push({ pts, center: c, source: 'ai', confidence: conf });
  }
  const tees = (trace?.tees || []).filter((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)).map(toLL);
  const cb = trace?.clubhouse;
  const clubhouse = Array.isArray(cb) && cb.length === 2 && cb.every(Number.isFinite) ? toLL(cb) : null;
  return { greens, tees, clubhouse };
}

/** Sort a Map of built holes into the row's `holes` array; `status` = ready | partial. */
export function finish(holesMap) {
  const holes = [...holesMap.values()].sort((a, b) => a.hole - b.hole);
  const srcs = new Set(holes.map((h) => h.source));
  const source = srcs.size === 0 ? 'none' : srcs.size === 1 ? [...srcs][0] : 'mixed';
  const low = holes.filter((h) => h.confidence < 0.5).map((h) => h.hole);
  const missing = [];
  for (let h = 1; h <= 18; h++) if (!holesMap.has(h)) missing.push(h);
  const status = holes.length === 18 && low.length === 0 ? 'ready' : holes.length ? 'partial' : 'failed';
  const notes = [];
  if (missing.length) notes.push(`missing ${missing.join(', ')}`);
  if (low.length) notes.push(`check ${low.join(', ')}`);
  return { holes, source, status, error: notes.join(' · ') || null };
}
