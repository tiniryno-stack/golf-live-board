import test from 'node:test';
import assert from 'node:assert/strict';
import { mark, scoreClass, scoreName, growFrame } from '../js/ui.js';

test('Score marks: eagle double circle, birdie circle, par plain, bogey square, double+ double square', () => {
  assert.match(mark(2, 4), /mk-e/);
  assert.match(mark(3, 4), /mk-u/);
  assert.match(mark(4, 4), /mk-p/);
  assert.match(mark(5, 4), /mk-b/);
  assert.match(mark(6, 4), /mk-d/);
  assert.match(mark(9, 4), /mk-d/);
  assert.match(mark(null, 4, 40, { ghost: 4 }), /mk-ghost[^>]*>4</);
  assert.match(mark(null, 4), /mk-none/);
  assert.match(mark(3, 3, 112), /--mk:112px/);
  assert.equal(scoreClass(1, 3), 'u e');
  assert.deepEqual([scoreName(1, 3), scoreName(3, 5), scoreName(4, 5), scoreName(5, 5), scoreName(6, 5), scoreName(7, 5), scoreName(8, 5), scoreName(10, 5)],
    ['ACE', 'EAGLE', 'BIRDIE', 'PAR', 'BOGEY', 'DOUBLE', 'TRIPLE', '+5']);
});

test('027 grow: frames at 0 / 60 / 120 / 300 ms; the faces overlap so no frame is empty; a fold alone is 225 ms', () => {
  const f = (t, d) => growFrame(t, d);
  assert.deepEqual([f(0).heightP, f(0).outOpacity, f(0).inOpacity, f(0).blurIn], [0, 1, 0, 8]);
  assert.ok(f(60).outOpacity > 0 && f(60).inOpacity === 0 && f(60).blurOut > 0, '60 ms: old face fading, new not started');
  assert.ok(f(120).outOpacity === 0 && f(120).inOpacity > 0.5, '120 ms: old gone, new mostly in');
  for (let t = 0; t <= 300; t += 10) assert.ok(f(t).outOpacity + f(t).inOpacity > 0.3, `a face shows at ${t} ms`);
  assert.deepEqual(f(300), { dur: 300, heightP: 1, outOpacity: 0, blurOut: 8, inOpacity: 1, blurIn: 0 });
  assert.equal(f(0, 'fold').dur, 225);
  assert.equal(f(225, 'fold').heightP, 1);
});
