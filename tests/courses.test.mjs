// Course search shaping: OpenGolfAPI records → our course shape, scorecard checks, names, distance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromOpenGolf, fromSearchRow, shortCourseName, scorecardProblems, sortByDistance, distanceMi, fmtMiles, builtInFor } from '../js/coursedata.js';
import { COURSES } from '../js/courses.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/opengolf.json', import.meta.url)));

test('Twin Creeks from OpenGolfAPI matches the built-in card exactly', () => {
  const c = fromOpenGolf(fx.twinCreeks);
  const built = COURSES.find((x) => x.id === 'twin-creeks-allen-tx');
  assert.deepEqual(c.par, built.par);
  assert.deepEqual(c.strokeIndex, built.strokeIndex);
  assert.deepEqual(c.tees.map((t) => [t.name, t.yards, t.rating, t.slope]), built.tees.map((t) => [t.name, t.yards, t.rating, t.slope]));
  assert.equal(c.shortName, 'Twin Creeks');
  assert.equal(c.location, 'Allen, TX');
  assert.equal(c.id, `oga:${fx.twinCreeks.id}`);
  assert.deepEqual(scorecardProblems(c), []);
});

test('built-in courses are linked to their OpenGolfAPI listing', () => {
  assert.equal(builtInFor(fx.twinCreeks.id)?.id, 'twin-creeks-allen-tx');
  assert.equal(builtInFor('00000000-0000-4000-8000-000000000000'), null);
});

test('missing hole handicaps are caught; the same tee for men and women gets labeled', () => {
  const c = fromOpenGolf(fx.mesquiteHollow);
  assert.equal(c.par.filter(Boolean).length, 18);
  assert.ok(c.strokeIndex.every((v) => v == null));
  assert.match(scorecardProblems(c)[0], /Hole handicaps are missing/);
  assert.deepEqual(c.tees.map((t) => t.name), ['Black', 'White (M)', 'White (W)']);
});

test('scorecard checks: duplicates, gaps, odd pars, 9-hole courses', () => {
  const base = fromOpenGolf(fx.twinCreeks);
  const dup = { ...base, strokeIndex: base.strokeIndex.map((v) => (v === 18 ? 1 : v)) };
  assert.match(scorecardProblems(dup)[0], /Hole handicap 1 is used twice/);
  const gap = { ...base, strokeIndex: base.strokeIndex.map((v, i) => (i === 6 ? null : v)) };
  assert.match(scorecardProblems(gap)[0], /missing on hole 7\./);
  const par = { ...base, par: base.par.map((v, i) => (i === 2 ? 9 : v)) };
  assert.match(scorecardProblems(par)[0], /Par missing or off on hole 3\./);
  assert.match(scorecardProblems(fromOpenGolf(fx.pecanNine))[0], /9-hole course/);
});

test('short names drop the "golf club" words', () => {
  assert.equal(shortCourseName('The Golf Club at Twin Creeks'), 'Twin Creeks');
  assert.equal(shortCourseName('Ridgeview Ranch Golf Course'), 'Ridgeview Ranch');
  assert.equal(shortCourseName('Eldorado Country Club'), 'Eldorado');
  assert.equal(shortCourseName('The Courses at Watters Creek'), 'Watters Creek');
  assert.equal(shortCourseName('TPC Craig Ranch'), 'TPC Craig Ranch');
  assert.equal(shortCourseName('Golf Club'), 'Golf Club');
});

test('search rows: nearest first, by API distance or our own', () => {
  const rows = fx.near.courses.map(fromSearchRow).reverse();
  assert.deepEqual(sortByDistance(rows, null).map((r) => r.distance), [0, 1.39, 2.27, 6.9, 14.2]);
  const noDist = rows.map((r) => ({ ...r, distance: null }));
  const here = { lat: 33.2, lng: -96.65 };
  assert.equal(sortByDistance(noDist, here)[0].name, 'Cedar Bend Country Club');
  assert.ok(Math.abs(distanceMi({ lat: 33.1084, lng: -96.7181 }, { lat: 33.1084, lng: -96.7181 })) < 1e-9);
  assert.equal(fmtMiles(1.391), '1.4 mi');
  assert.equal(fmtMiles(12.6), '13 mi');
  assert.equal(fmtMiles(null), '');
  assert.equal(fmtMiles(0.04), 'here');
});

test('Multi-course club: the same hole numbers twice split into Course 1 / Course 2 in listing order', async () => {
  const { fromOpenGolf, splitCourses } = await import('../js/coursedata.js');
  const a = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4];
  const b = [5, 4, 4, 3, 4, 5, 4, 3, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4];
  const holes_data = [];
  for (let i = 0; i < 18; i++) {
    holes_data.push({ number: i + 1, par: a[i], handicap: i + 1 });
    holes_data.push({ number: i + 1, par: b[i], handicap: 18 - i }); // alternating rows
  }
  const c = fromOpenGolf({ id: '11111111-2222-4333-8444-555555555555', course_name: 'Bear Creek Golf Club', holes_data });
  assert.equal(c.variants.length, 2);
  assert.deepEqual(c.variants.map((v) => [v.label, v.parTotal, v.par[0], v.par[17]]), [['Course 1', 72, 4, 4], ['Course 2', 72, 5, 4]]);
  assert.deepEqual(c.variants[1].strokeIndex.slice(0, 3), [18, 17, 16]);
  assert.deepEqual(c.par, a, 'the plain card still takes the first of each hole');
  assert.deepEqual(splitCourses([{ n: 1, par: 4 }]), [], 'a normal course has no variants');
  const named = fromOpenGolf({ id: '11111111-2222-4333-8444-555555555556', course_name: 'Club', holes_data: holes_data.map((h, i) => ({ ...h, course_name: i % 2 ? 'East' : 'West' })) });
  assert.deepEqual(named.variants.map((v) => v.label), ['West', 'East'], 'uses the listing’s own course names when it has them');
});
