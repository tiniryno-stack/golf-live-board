// 021 + 022 calm team Enter: what a pick earns (word on NET, mark on GROSS, stamp only for a net double+)
// and the hole's points line. Cases are the ones 022 §5 lists as checked against the prototype.
import test from 'node:test';
import assert from 'node:assert/strict';
import { reward, markKind, pointsLine, standing } from '../js/ui.js';

test('021/022 reward: word from the net result, mark from the gross score, stamp only on a net double or worse', () => {
  // par 3, one stroke here
  assert.equal(reward(3, 3, 1).word, 'Net birdie');
  assert.equal(reward(3, 3, 1).stamp, false);
  assert.equal(reward(5, 3, 1).word, 'Net bogey');
  assert.equal(reward(5, 3, 1).stamp, false, 'a gross double that is only a net bogey draws quietly');
  assert.equal(markKind(5, 3), 'd', '…but its mark is still the red double square');
  // no stroke
  assert.deepEqual(reward(5, 3), { word: 'Double', tone: 'dbl', stamp: true, ripples: 0, holdMs: 1600 });
  assert.deepEqual(reward(1, 3), { word: 'Ace', tone: 'big', stamp: false, ripples: 2, holdMs: 3000 });
  assert.equal(reward(6, 3).word, 'Triple');
  assert.equal(reward(8, 4).word, 'Quad');
  assert.equal(reward(3, 3).tone, 'quiet');
  // the hole's points + the standing
  assert.deepEqual([2, 1.5, 1, 0.5, 0].map((p) => pointsLine(p).text), ['+2 points', '+1½ points', '+1 point', '+½ point', 'No points']);
  assert.deepEqual([2, 1.5, 1].map((p) => pointsLine(p).tone), ['text', 'text', 'muted']);
  assert.deepEqual([2, 1.5, 0, -1].map(standing), ['2 UP', '1½ UP', 'AS', '1 DN']);
});
