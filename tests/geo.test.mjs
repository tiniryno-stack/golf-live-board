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
