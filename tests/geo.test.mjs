import { test } from 'node:test';
import assert from 'node:assert/strict';
import { yardages, greenFor, geoFor, greenSvg, center, metersBetween, yards } from '../js/geo.js';

const twin = { id: 'twin-creeks-allen-tx', ogaId: '45bc4e3e-1174-4dac-b3c8-6d58a3be2116' };

test('Twin Creeks has 18 greens, found by course id or OpenGolfAPI id (with or without #N)', () => {
  assert.equal(geoFor(twin).holes.length, 18);
  assert.ok(geoFor({ id: 'oga:45bc4e3e-1174-4dac-b3c8-6d58a3be2116' }));
  assert.ok(geoFor({ id: 'oga:45bc4e3e-1174-4dac-b3c8-6d58a3be2116#2' }));
  assert.equal(geoFor({ id: 'somewhere-else' }), null);
  assert.equal(greenFor(twin, 19), null);
});

test('front < middle < back from the tee; hole 11 (par 3) is about 158 to the middle', () => {
  for (let h = 1; h <= 18; h++) {
    const g = greenFor(twin, h);
    const y = yardages(g.tee, g.green);
    assert.ok(y.front < y.middle && y.middle < y.back, `hole ${h}: ${y.front}/${y.middle}/${y.back}`);
    assert.ok(y.back - y.front > 10 && y.back - y.front < 60, `hole ${h} green depth ${y.back - y.front}`);
  }
  const y11 = yardages(greenFor(twin, 11).tee, greenFor(twin, 11).green);
  assert.ok(Math.abs(y11.middle - 158) <= 2, `hole 11 middle ${y11.middle}`);
});

test('standing on the green, a few yards short of the middle: front is behind you (negative), back is ahead', () => {
  const g = greenFor(twin, 1);
  const c = center(g.green);
  const y = yardages([c[0] - 0.00005, c[1]], g.green);
  assert.ok(y.front < 0 && y.middle > 0 && y.middle < 10 && y.back > y.middle, JSON.stringify(y));
  assert.deepEqual(yardages(c, g.green), { front: 0, middle: 0, back: 0, bearing: 0 }); // dead center: no direction
});

test('yards: 4 m accuracy ≈ 4 yd; 100 m due north ≈ 109 yd', () => {
  assert.equal(Math.round(yards(4)), 4);
  assert.equal(Math.round(yards(metersBetween([33.1, -96.7], [33.1 + 100 / 111320, -96.7]))), 109);
});

test('green svg draws three bands, two gaps, the outline and the middle dot inside the box', () => {
  const g = greenFor(twin, 11);
  const svg = greenSvg(g.tee, g.green, 62, 64);
  assert.equal((svg.match(/<rect /g) || []).length, 3);
  assert.equal((svg.match(/<line /g) || []).length, 2);
  assert.ok(svg.includes('fill-opacity="0.3"') && svg.includes('fill-opacity="0.19"') && svg.includes('fill-opacity="0.1"'));
  assert.ok(svg.includes('<circle'));
  const nums = [...svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => [+m[1], +m[2]])[0];
  assert.ok(nums[0] > 0 && nums[0] < 62 && nums[1] > 0 && nums[1] < 64, `dot at ${nums}`);
});

// ───────────────────────────────────────────── stage 3: building a course's geo (js/geobuild.js)
import { pixelToLatLng, latLngToPixel } from '../js/geo.js';
import { parseOverpass, matchOsm, numberHoles, fromTrace, finish, PAR_LENGTH } from '../js/geobuild.js';
import { COURSES } from '../js/courses.js';

const twinCard = COURSES[0].par.map((par, i) => ({ hole: i + 1, par }));

test('pixelToLatLng round-trips with latLngToPixel; at zoom 16 a pixel is about 2 m at Dallas latitudes', () => {
  const img = [1024, 1024, 33.02, -97.08, 16, 1];
  const ll = pixelToLatLng(600, 400, ...img);
  const px = latLngToPixel(ll[0], ll[1], ...img);
  assert.ok(Math.abs(px[0] - 600) < 1e-6 && Math.abs(px[1] - 400) < 1e-6);
  const a = pixelToLatLng(512, 512, ...img), b = pixelToLatLng(612, 512, ...img);
  assert.ok(Math.abs(metersBetween(a, b) / 100 - 2.0) < 0.1, `m per px ${metersBetween(a, b) / 100}`);
  assert.deepEqual(pixelToLatLng(512, 512, ...img).map((v) => +v.toFixed(6)), [33.02, -97.08]);
});

/** Fake Overpass JSON from Twin Creeks' built-in greens: hole lines numbered with `shift`, pars from the card. */
function fakeOverpass(shift = 0, { pars = true, lines = true } = {}) {
  const elements = [];
  for (const h of geoFor(twin).holes) {
    elements.push({ type: 'way', id: h.hole, tags: { golf: 'green' }, geometry: [...h.green, h.green[0]].map(([lat, lon]) => ({ lat, lon })) });
    if (lines) {
      const ref = ((h.hole - 1 + shift) % 18) + 1;
      const tags = { golf: 'hole', ref: String(ref) };
      if (pars) tags.par = String(twinCard[h.hole - 1].par);
      elements.push({ type: 'way', id: 100 + h.hole, tags, geometry: [h.tee, center(h.green)].map(([lat, lon]) => ({ lat, lon })) });
    }
  }
  return { elements };
}

test('OSM hole lines + greens match our card: 18 holes, no shift, greens closed-ring duplicate dropped', () => {
  const osm = parseOverpass(fakeOverpass(0));
  assert.equal(osm.greens.length, 18);
  assert.equal(osm.greens[0].pts.length, geoFor(twin).holes[0].green.length);
  const m = matchOsm(twinCard, osm);
  assert.equal(m.holes.size, 18);
  assert.equal(m.shift, 0);
  assert.equal(m.matches, 18);
  assert.deepEqual(m.holes.get(11).tee, geoFor(twin).holes[10].tee);
});

test('OSM numbered the nines the other way round (Twin Creeks case): the +9 shift wins and every hole lands on our number', () => {
  const m = matchOsm(twinCard, parseOverpass(fakeOverpass(9)));
  assert.equal(m.shift, 9);
  assert.equal(m.holes.size, 18);
  for (let h = 1; h <= 18; h++) assert.deepEqual(m.holes.get(h).green, geoFor(twin).holes[h - 1].green, `hole ${h}`);
});

test('OSM numbers that fit neither way: only holes whose par matches are trusted', () => {
  const m = matchOsm(twinCard, parseOverpass(fakeOverpass(5)));
  assert.ok(m.holes.size < 18 && m.holes.size > 0, `kept ${m.holes.size}`);
  for (const [h, b] of m.holes) assert.equal(b.par, twinCard[h - 1].par);
});

test('greens with no hole lines are left for numbering; numbering fills gaps in a card by chaining tee → green and the par\'s expected length', () => {
  const osm = parseOverpass(fakeOverpass(0, { lines: false }));
  const m = matchOsm(twinCard, osm);
  assert.equal(m.holes.size, 0);
  assert.equal(osm.greens.length, 18);
  const real = geoFor(twin).holes;
  const clubhouse = [33.1048, -96.7133];
  // OSM (or the model) placed every hole but these; the beam search numbers the leftover greens
  for (const gaps of [[7, 15], [4, 5], [1, 18], [9, 10, 11], [3, 8, 12, 16]]) {
    const fixed = new Map(real.filter((h) => !gaps.includes(h.hole)).map((h) => [h.hole, { ...h, par: twinCard[h.hole - 1].par, source: 'osm', confidence: 1 }]));
    const greens = real.filter((h) => gaps.includes(h.hole)).map((h) => ({ pts: h.green, center: center(h.green), source: 'ai', confidence: 0.7 }));
    const tees = real.filter((h) => gaps.includes(h.hole)).map((h) => h.tee);
    const out = numberHoles(twinCard, fixed, greens, tees, clubhouse);
    for (const h of gaps) assert.deepEqual(out.get(h)?.green, real[h - 1].green, `gap ${h} of ${gaps.join(',')}`);
    assert.equal(out.get(gaps[0]).source, 'ai');
    assert.equal(out.get(1).source, gaps.includes(1) ? 'ai' : 'osm');
  }
  // every numbered hole's length fits its par
  const out = numberHoles(twinCard, new Map(), osm.greens.map((g) => ({ ...g, source: 'ai', confidence: 0.7 })), real.map((h) => h.tee), clubhouse);
  for (const [, b] of out) {
    const d = yards(metersBetween(b.tee, center(b.green)));
    const [lo, hi] = PAR_LENGTH[b.par];
    const noTee = !real.some((h) => h.tee === b.tee); // no tee box: measured from the last green, so up to ~250 yd longer
    assert.ok(d >= lo - 40 && d <= hi + 60 + (noTee ? 250 : 0), `hole ${b.hole} par ${b.par}: ${Math.round(d)} yd`);
  }
});

test('fromTrace turns pixel polygons into lat/lng greens and drops junk; finish() grades the row', () => {
  const img = { w: 1024, h: 1024, lat: 33.02, lng: -97.08, zoom: 16, scale: 1 };
  const got = fromTrace({ greens: [{ points: [[500, 500], [520, 500], [520, 520], [500, 520]], confidence: 0.8 }, { points: [[1, 2]] }, { points: 'no' }], tees: [[100, 100], [1, 'x']], clubhouse: [512, 512] }, img);
  assert.equal(got.greens.length, 1);
  assert.equal(got.tees.length, 1);
  assert.deepEqual(got.clubhouse.map((v) => +v.toFixed(5)), [33.02, -97.08]);
  assert.ok(Math.abs(yards(metersBetween(got.greens[0].pts[0], got.greens[0].pts[1])) - 44) < 3);
  const full = new Map(geoFor(twin).holes.map((h) => [h.hole, { ...h, par: 4, source: 'osm', confidence: 1 }]));
  assert.deepEqual(finish(full).status, 'ready');
  assert.equal(finish(full).source, 'osm');
  full.delete(7);
  full.set(3, { ...full.get(3), source: 'ai', confidence: 0.3 });
  const p = finish(full);
  assert.equal(p.status, 'partial');
  assert.equal(p.source, 'mixed');
  assert.equal(p.error, 'missing 7 · check 3');
  assert.equal(finish(new Map()).status, 'failed');
});

import { needsBuild, buildBody } from '../js/geoload.js';
import { geoKey, geoKeys, setGeo } from '../js/geo.js';

test('loadGeo asks the function to build only when the row is missing, unfinished or stale', () => {
  const t = Date.parse('2026-10-22T20:00:00Z');
  const row = (status, error = null, agoMs = 0) => ({ status, error, updated_at: new Date(t - agoMs).toISOString() });
  assert.equal(needsBuild(null, t), true);
  assert.equal(needsBuild(row('ready'), t), false);
  assert.equal(needsBuild(row('partial', 'missing 7'), t), false);
  assert.equal(needsBuild(row('partial', 'pending: refine 3, 4'), t), true);
  assert.equal(needsBuild(row('partial', 'missing 7', 8 * 24 * 3600e3), t), true);
  assert.equal(needsBuild(row('building', null, 30e3), t), false);
  assert.equal(needsBuild(row('building', null, 3 * 60e3), t), true);
  assert.equal(needsBuild(row('failed', 'x', 10 * 60e3), t), false);
  assert.equal(needsBuild(row('failed', 'x', 2 * 3600e3), t), true);
});

test('the build request carries the course key, point and 18 pars; a course without a location can\'t be built', () => {
  const c = { id: 'oga:abc', ogaId: 'abc', name: 'Somewhere GC', lat: 33.0, lng: -97.0, par: COURSES[0].par };
  assert.deepEqual(buildBody(c), { course_key: 'oga:abc', name: 'Somewhere GC', lat: 33, lng: -97, holes: COURSES[0].par.map((par, i) => ({ hole: i + 1, par })) });
  assert.equal(buildBody({ ...c, lat: null }), null);
  assert.equal(buildBody({ ...c, par: Array(18).fill(null) }), null);
  assert.equal(geoKey(c), 'oga:abc');
  assert.equal(geoKey({ ogaId: 'abc' }), 'oga:abc');
  assert.deepEqual(geoKeys({ id: 'oga:abc#2', ogaId: 'abc' }), ['oga:abc#2', 'oga:abc']);
});

test('greens loaded from the table are found by the course key, after the built-ins', () => {
  assert.equal(geoFor({ id: 'oga:loaded#1' }), null);
  setGeo('oga:loaded', { name: 'Loaded', source: 'osm', holes: [{ hole: 1, tee: [1, 2], green: [[1, 2], [1, 3], [2, 3]] }] });
  assert.equal(geoFor({ id: 'oga:loaded#1' })?.name, 'Loaded');
  assert.equal(greenFor({ id: 'oga:loaded' }, 1).tee[1], 2);
  assert.equal(greenFor({ id: 'oga:loaded' }, 2), null);
  setGeo('twin-creeks-allen-tx', { name: 'Not the built-in', holes: [{ hole: 1 }] });
  assert.equal(geoFor(twin).name, 'Twin Creeks');
  setGeo('x', { holes: [] }); // nothing to show: ignored
  assert.equal(geoFor({ id: 'x' }), null);
});
