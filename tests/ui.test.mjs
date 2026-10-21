import test from 'node:test';
import assert from 'node:assert/strict';
import { mark, scoreClass, scoreName } from '../js/ui.js';

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
