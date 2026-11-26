// Standings fixes (Nov 26): Back / up never piles up history, the switcher tells unnamed crews apart, each ‹ goes one level up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { track, upPlan, previous } from '../js/nav.js';
import { standingsHeader, switcherLabels, upTarget } from '../js/seasons.js';

test('Standings: crew switches replace, ‹ steps back, unnamed crews get told apart', () => {
  // Home → Standings (Founders) → switch to two other crews in place → Back = Home, not the crews you looked at.
  let s = track([], '#/');
  s = track(s, '#/season/f');
  s = track(s, '#/season/u1', true);
  s = track(s, '#/season/u2', true);
  assert.deepEqual(s, ['#/', '#/season/u2']);
  assert.equal(upPlan(s, '#/'), 'back');
  // Standings → Seasons → one season, then ‹ ‹ walks back the way you came (history.back pops).
  s = track(track(s, '#/season/u2/past'), '#/season/u2/first');
  assert.equal(upPlan(s, upTarget('u2', 'first')), 'back');
  s = track(s, '#/season/u2/past');
  assert.equal(upPlan(s, upTarget('u2', 'past')), 'back');
  s = track(s, '#/season/u2');
  assert.deepEqual(s, ['#/', '#/season/u2']);
  // Opened straight from a link / after a reload: nothing behind, so ‹ replaces instead of pushing.
  assert.equal(upPlan(['#/season/u2/first'], upTarget('u2', 'first')), 'replace');
  assert.equal(previous(['#/season/u2', '#/crew/rename/u2']), '#/season/u2');
  assert.deepEqual([upTarget('u2', null), upTarget('u2', 'past'), upTarget('u2', 'k1'), upTarget(null, 'past')],
    ['#/', '#/season/u2', '#/season/u2/past', '#/']);

  // Four crews, three unnamed: each goes by its latest round's name; clashes are numbered; no hint = "Your crew".
  const list = [{ id: 'f', name: 'Founders Crew' }, { id: 'a', name: null, hint: 'Bridlewood' }, { id: 'b', name: null, hint: 'Bridlewood' }, { id: 'c', name: null }];
  assert.deepEqual(switcherLabels(list), ['Founders Crew', 'Bridlewood', 'Bridlewood 2', 'Your crew']);
  const h = standingsHeader({ list, id: 'b', name: null });
  assert.deepEqual(h.switcher.map((x) => `${x.on ? '*' : ''}${x.name}`), ['Founders Crew', 'Bridlewood', '*Bridlewood 2', 'Your crew']);
  assert.equal(h.nameCrew, true);
});
