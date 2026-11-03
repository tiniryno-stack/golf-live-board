// 016 Team Ryder Cup Enter: the one-row ScorePad window and the result label.
import test from 'node:test';
import assert from 'node:assert/strict';
import { padWindow, padLabel } from '../js/ui.js';

test('016 pad row: par−1 … par+2 by default, slides one at a time inside 1 … max; label follows the pick', () => {
  assert.deepEqual(padWindow(4, 8).pads, [3, 4, 5, 6]);
  assert.equal(padWindow(4, 8).canLower, true);
  assert.deepEqual(padWindow(4, 8, 5).pads, [5, 6, 7, 8]);
  assert.equal(padWindow(4, 8, 6).lo, 5, 'never past the max');
  assert.equal(padWindow(4, 8, 5).canHigher, false);
  assert.deepEqual(padWindow(3, 6, 0).pads, [1, 2, 3, 4], 'never under 1');
  assert.equal(padWindow(3, 6, 0).canLower, false);
  assert.deepEqual(padLabel(null, 4, 8), { text: 'TAP A SCORE', tone: 'even' });
  assert.deepEqual(padLabel(3, 4, 8), { text: 'BIRDIE', tone: 'under' });
  assert.deepEqual(padLabel(6, 4, 8), { text: 'DOUBLE', tone: 'dbl' });
  assert.equal(padLabel(8, 4, 8).text, '+4 · MAX');
  assert.equal(padLabel(1, 3, 6).text, 'ACE');
});
