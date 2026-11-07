// Matchup draft (owner, Nov 7): snake offers, one cart per rotation, no repeat matchups, engine reads the result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { offerSide, draftState, toMatchups, canFinish } from '../js/mdraft.js';
import { ryderSetup, ryderMatchupsAt } from '../js/scoring.js';

const A = ['1A', '1B', '1C', '1D'], B = ['2A', '2B', '2C', '2D'];

test('matchup draft: snake, no repeats, always finishable, engine uses it', () => {
  assert.deepEqual([...Array(12).keys()].map((k) => offerSide(k, '2')).join(''), '211221122112');
  // greedy: always take the first option; it must finish 12 picks with no repeat and one cart per rotation
  const picks = [];
  let pending = null;
  while (true) {
    const s = draftState(picks, pending, A, B, '1');
    if (s.done) break;
    assert.ok(s.options.length > 0, `stuck at pick ${s.k}`);
    if (s.offering) pending = s.options[0];
    else { picks.push(s.side === '2' ? [pending, s.options[0]] : [s.options[0], pending]); pending = null; }
  }
  assert.equal(new Set(picks.map((p) => p.join())).size, 12);
  const m = toMatchups(picks);
  for (const r of m) { assert.equal(new Set(r.map((p) => p[0])).size, 4); assert.equal(new Set(r.map((p) => p[1])).size, 4); }
  // a repeat is never offered: after 1A v 2A in rotation 1, 1A can't answer/meet 2A again
  const s = draftState([['1A', '2A'], ['1B', '2B'], ['1C', '2C'], ['1D', '2D']], '1A', A, B, '1');
  assert.ok(!s.options.includes('2A'));
  assert.equal(canFinish([], A, B), true);
  // engine: the drafted matches replace the standard rotation
  const players = Array.from({ length: 16 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, strokes: 0 }));
  const { roster, settings } = ryderSetup(players);
  const std = ryderMatchupsAt(roster, settings, 7);
  const drafted = ryderMatchupsAt(roster, { ...settings, ryderMatchups: m }, 7);
  assert.deepEqual(drafted, m[1]);
  assert.deepEqual(ryderMatchupsAt(roster, { ...settings, ryderMatchups: [[['1A', '2A']]] }, 7), std); // broken = standard
});
