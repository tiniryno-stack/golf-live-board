// Season record (Nov 19): every game becomes a finishing order; you go ahead–behind for the day.
import test from 'node:test';
import assert from 'node:assert/strict';
import { roundRecord, roundFinish, seasonRecordTable, recordLabel, pctLabel, MIN_ROUNDS } from '../js/seasons.js';

const course = { par: Array(18).fill(4), strokeIndex: Array.from({ length: 18 }, (_, i) => i + 1) };
const people = ['Andrew', 'Sam', 'Jake', 'Sean'].map((n) => ({ id: n.toLowerCase(), name: n, personId: `pp-${n}` }));
/** A stroke-play round: totals[i] strokes spread over 18 holes for people[i]. */
function strokeRound(day, totals) {
  const scores = [];
  people.forEach((p, i) => { for (let h = 1; h <= 18; h++) scores.push({ player_id: p.id, hole: h, strokes: 4 + (h <= totals[i] - 72 ? 1 : 0) }); });
  return { event: { code: day, played_on: day, created_at: `${day}T15:00:00Z`, settings: {}, course, roster: { players: people } }, scores };
}

test('a cart round: you count everyone but your partner; the winning cart of 4 goes 6–0', () => {
  const fin = [['a', 1, 'A'], ['b', 1, 'A'], ['c', 2, 'B'], ['d', 2, 'B'], ['e', 3, 'C'], ['f', 3, 'C'], ['g', 4, 'D'], ['h', 4, 'D']]
    .map(([key, rank, unit]) => ({ key, rank, unit }));
  const rec = roundRecord(fin);
  assert.deepEqual(rec.get('a'), { w: 6, l: 0 });
  assert.deepEqual(rec.get('e'), { w: 2, l: 4 });
});

test('stroke play ranks low total; a tie is half each', () => {
  const fin = roundFinish(strokeRound('2026-10-30', [73, 74, 75, 75]).event, strokeRound('2026-10-30', [73, 74, 75, 75]).scores);
  const rec = roundRecord(fin);
  assert.deepEqual(rec.get('pp-Andrew'), { w: 3, l: 0 });
  assert.deepEqual(rec.get('pp-Jake'), { w: 0.5, l: 2.5 });
  assert.equal(recordLabel(0.5, 2.5), '½–2½');
});

test('the season adds rounds up as they are, ranks by win rate, and needs 3 rounds to be ranked', () => {
  const rounds = [strokeRound('2026-10-01', [73, 74, 75, 76]), strokeRound('2026-10-08', [76, 73, 74, 75])];
  let t = seasonRecordTable({ rounds });
  assert.ok(t.rows.every((r) => !r.ranked && r.rank === null), `under ${MIN_ROUNDS} rounds nobody is ranked`);
  rounds.push(strokeRound('2026-10-15', [73, 76, 74, 75]));
  t = seasonRecordTable({ rounds }, 'pp-Andrew');
  const a = t.rows.find((r) => r.name === 'Andrew');
  assert.equal(recordLabel(a.w, a.l), '6–3');
  assert.equal(pctLabel(a.pct), '.667');
  assert.equal(a.rank, 1);
  assert.equal(t.me, a);
  assert.deepEqual(a.days.map((d) => d.place), [1, 4, 1]);
});

test('a round still being played does not count', () => {
  const r = strokeRound('2026-11-01', [73, 74, 75, 76]);
  r.scores = r.scores.filter((s) => !(s.player_id === 'sean' && s.hole === 18));
  assert.equal(roundFinish(r.event, r.scores), null);
});

test('the season card bests: best day, best game, low round', async () => {
  const { seasonBests } = await import('../js/seasons.js');
  const rounds = [strokeRound('2026-10-01', [73, 74, 75, 76]), strokeRound('2026-10-08', [76, 73, 74, 75]), strokeRound('2026-10-15', [72, 76, 74, 75])];
  const a = seasonRecordTable({ rounds }).rows.find((r) => r.name === 'Andrew');
  const b = seasonBests(a);
  assert.equal(b.bestDay.date, '2026-10-01');
  assert.equal(b.bestGame.key, 'Stroke play');
  assert.equal(b.lowRound.gross, 72);
  assert.equal(b.bestPartner, null);
});
