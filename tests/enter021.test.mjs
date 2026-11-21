// The calm Enter's pick rules (021 + 022, then 033 Part 1 + 034 "Score picks v2"): what a pick earns (word and motion
// on NET, mark on GROSS, stamp only for a net double+), the hole's points line, and which way the cards turn (034).
import test from 'node:test';
import assert from 'node:assert/strict';
import { reward, markKind, pointsLine, standing, turnPlan } from '../js/ui.js';

test('021/022 reward: word from the net result, mark from the gross score, stamp only on a net double or worse', () => {
  // par 3, one stroke here
  assert.equal(reward(3, 3, 1).word, 'Net birdie');
  assert.equal(reward(3, 3, 1).stamp, false);
  assert.equal(reward(5, 3, 1).word, 'Net bogey');
  assert.equal(reward(5, 3, 1).stamp, false, 'a gross double that is only a net bogey draws quietly');
  assert.equal(markKind(5, 3), 'd', '…but its mark is still the red double square');
  // no stroke
  assert.deepEqual(reward(5, 3), { word: 'Double', kind: 'double', tone: 'dbl', stamp: true, ripples: 0, burst: false, sparks: 8, burst2: false, pulse: false, flash: false, holdMs: 1600 });
  assert.deepEqual(reward(1, 3), { word: 'Ace', kind: 'eagle', tone: 'big', stamp: false, ripples: 3, burst: true, sparks: 12, burst2: true, pulse: false, flash: true, holdMs: 3500 });
  assert.equal(reward(6, 3).word, 'Triple');
  assert.equal(reward(8, 4).word, 'Quad');
  // the hole's points + the standing
  assert.deepEqual([2, 1.5, 1, 0.5, 0].map((p) => pointsLine(p).text), ['+2 points', '+1½ points', '+1 point', '+½ point', 'No points']);
  assert.deepEqual([2, 1.5, 1].map((p) => pointsLine(p).tone), ['text', 'text', 'muted']);
  assert.deepEqual([2, 1.5, 0, -1].map(standing), ['2 UP', '1½ UP', 'AS', '1 DN']);
});

test('033 + 034 score picks v2: par → ace get louder, bogey and double stay quiet; the turn follows play order', () => {
  // par 4 with 2 / 3 / 4 / 5 / 6
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).kind), ['eagle', 'birdie', 'par', 'bogey', 'double']);
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).tone), ['big', 'lift', 'par', 'quiet', 'dbl']);
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).ripples), [3, 2, 0, 0, 0]);
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).burst), [true, true, false, false, false]);
  assert.deepEqual([2, 3].map((s) => reward(s, 4).sparks), [12, 8]);
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).pulse), [false, false, true, false, false]);
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).flash), [true, true, true, false, false]);
  assert.deepEqual([2, 3, 4, 5, 6].map((s) => reward(s, 4).holdMs), [3500, 2600, 2000, 1600, 1600]);
  // a second burst only for an albatross or an ace
  assert.deepEqual([reward(2, 4).burst2, reward(2, 5).burst2, reward(1, 3).burst2, reward(1, 4).burst2], [false, true, true, true]);
  // net drives the motion: a gross bogey with a stroke is par's pop + pulse, word "Net par" (the mark stays a square)
  const netPar = reward(5, 4, 1);
  assert.deepEqual([netPar.kind, netPar.word, netPar.pulse, netPar.flash, markKind(5, 4)], ['par', 'Net par', true, true, 's']);
  // 034 the turn: forward = later in play order
  assert.equal(turnPlan(4, 5, 1).dir, 'fwd');
  assert.equal(turnPlan(5, 4, 1).dir, 'back');
  assert.equal(turnPlan(11, 3, 1).dir, 'back', 'a jump from the grid is one turn');
  assert.equal(turnPlan(18, 1, 10).dir, 'fwd', 'a round that starts on 10 turns forward from 18 to 1');
  assert.equal(turnPlan(1, 18, 10).dir, 'back');
  assert.equal(turnPlan(9, 10, 10).dir, 'back', 'starting on 10, hole 9 is the last hole');
  assert.equal(turnPlan(18, 1, 1).dir, 'back');
});
