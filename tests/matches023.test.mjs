// 023 §2: holeLines — the dimming rule + the words, read from a hole entry, never re-scored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { holeLines } from '../js/riderview.js';

const cmp = (a, b) => (a < b ? 'us' : b < a ? 'them' : 'halved');
/** A hole entry in the shape ryderMatch / riderMatch build, from four net scores (null = not posted). */
function hole(u, t) {
  const uIn = u.every((v) => v != null), tIn = t.every((v) => v != null);
  const whoIsIn = uIn && tIn ? 'both' : uIn ? 'us' : tIn ? 'them' : 'none';
  const both = whoIsIn === 'both';
  return {
    whoIsIn,
    lowBall: both ? cmp(Math.min(...u), Math.min(...t)) : 'pending',
    lowTotal: both ? cmp(u[0] + u[1], t[0] + t[1]) : 'pending',
    net: { us: u, them: t },
    points: both ? {} : null,
  };
}
const US = ['Andrew', 'Alex'];

test('§2 example: Andrew 4, Alex 5 v Josh 4, Brandon 6 → only Brandon dims', () => {
  const r = holeLines(hole([4, 5], [4, 6]), US, ['Josh', 'Brandon']);
  assert.deepEqual(r.counts, [true, true, true, false]);
  assert.equal(r.lowBall.who, 'tie'); // both pairs made a 4
  assert.equal(r.lowBall.text, 'Tied');
  assert.equal(r.lowBall.pts, '½ each');
  assert.deepEqual([r.lowTotal.who, r.lowTotal.text, r.lowTotal.pts], ['us', 'Andrew + Alex', '+1']);
  assert.equal(r.need, null);
});

test('§2 example: Andrew 5, Alex 4 v Josh 3, Brandon 7 → they take low ball, you take low total', () => {
  const r = holeLines(hole([5, 4], [3, 7]), US, ['Josh', 'Brandon']);
  // The frame (04) dims only Brandon: Andrew counts via the won low total.
  assert.deepEqual(r.counts, [true, true, true, false]);
  assert.deepEqual([r.lowBall.who, r.lowBall.text, r.lowBall.pts], ['them', 'Josh', '+1']);
  assert.deepEqual([r.lowTotal.who, r.lowTotal.text, r.lowTotal.pts], ['us', 'Andrew + Alex', '+1']);
});

test('§2 example: Andrew 3, Alex 5 v Ant 4, Steve 4 → nothing dims (low total tied 8–8)', () => {
  const r = holeLines(hole([3, 5], [4, 4]), US, ['Ant', 'Steve']);
  assert.deepEqual(r.counts, [true, true, true, true]);
  assert.deepEqual([r.lowBall.who, r.lowBall.text, r.lowBall.pts], ['us', 'Andrew', '+1']);
  assert.equal(r.lowTotal.who, 'tie');
  assert.equal(r.lowTotal.pts, '½ each');
});

test('§2 not all in: nothing dims, and the need line reads their scores', () => {
  const r = holeLines(hole([null, null], [4, 5]), US, ['Josh', 'Brandon']);
  assert.deepEqual(r.counts, [true, true, true, true]);
  assert.equal(r.lowBall, null);
  assert.equal(r.lowTotal, null);
  assert.equal(r.need.lead, 'Josh made 4, Brandon 5.');
  assert.equal(r.need.rest, 'A 4 halves low ball. 8 or better between you takes low total.');

  const yours = holeLines(hole([4, 5], [null, null]), US, ['Josh', 'Brandon']);
  assert.equal(yours.need.lead, 'Your scores are in.');
  assert.equal(yours.need.rest, 'Josh + Brandon haven’t posted yet.');

  // A stroke on one of their holes → "a net 4".
  const net = holeLines(hole([null, null], [4, 5]), US, ['Josh', 'Brandon'], [false, false, true, false]);
  assert.equal(net.need.lead, 'Josh made a net 4, Brandon 5.');
});
