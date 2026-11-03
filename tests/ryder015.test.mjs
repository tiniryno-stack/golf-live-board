// Team Ryder Cup v2 engine (handoff 015, RULES.md §2–§3): one test per rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, ryderSetup, normalizeSettings, ryderState, ryderNeedLine } from '../js/scoring.js';
import { scorebook, COURSE } from './helpers.mjs';

const NAMES = ['Andrew', 'Alex', 'Ant', 'Steve', 'Justin', 'Chuck', 'Mitch', 'Peter', 'Sean', 'Baker', 'Josh', 'Brandon', 'Joseph', 'Jay', 'Elijah', 'Marcus'];
const ev = (() => {
  const players = NAMES.map((name, i) => ({ id: `p${i + 1}`, name, firstName: name, strokes: null }));
  const { roster, settings } = ryderSetup(players);
  return { id: 'ev', code: 'RYDER', course: { ...COURSE }, roster, settings: { ...normalizeSettings({}), ...settings, teeTimes: ['08:40'] } };
})();
const par = (h) => COURSE.par[h - 1];
const cart = (tid) => ev.roster.players.filter((p) => p.teamId === tid).map((p) => p.id);
/** Post a hole for some carts. win = carts that take both points (one birdie, one par). */
function post(sb, h, tids, win = []) {
  const out = {};
  for (const t of tids) { const [a, b] = cart(t); out[a] = win.includes(t) ? par(h) - 1 : par(h); out[b] = par(h); }
  sb.post(h, out);
}
const ALL = ['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D'];
const state = (sb, me = '1A') => ryderState(compute(ev, sb.rows()), me);
const m1 = (st) => st.matches.find((m) => m.us.id === '1A' && m.rotation === 0);

test('§2 a hole counts only when all four scores are in', () => {
  const sb = scorebook();
  post(sb, 1, ['1A', '2A'], ['1A']);
  sb.post(1, { [cart('2A')[0]]: null }); // one of their scores missing
  let m = m1(state(sb));
  assert.equal(m.thru, 0);
  assert.deepEqual(m.holePts, [0, 0]);
  assert.equal(m.holes[0].whoIsIn, 'us');
  assert.equal(m.holes[0].lowBall, 'pending');
  post(sb, 1, ['2A']);
  m = m1(state(sb));
  assert.equal(m.thru, 1);
  assert.deepEqual(m.holePts, [2, 0]);
});

test('§2 match status: not started → live → done', () => {
  const sb = scorebook();
  let m = m1(state(sb));
  assert.equal(m.status, 'notStarted');
  assert.equal(m.kicker, 'NOTHING COUNTS YET');
  assert.deepEqual(m.flag, { look: 'tee', side: 'line', text: '8:40' });
  post(sb, 1, ['1A', '2A']);
  m = m1(state(sb));
  assert.equal(m.status, 'live');
  assert.deepEqual(m.flag, { look: 'tied', side: 'line', text: '1–1' });
  assert.equal(m.kicker, 'THRU 1 · ALL SQUARE');
  for (let h = 2; h <= 6; h++) post(sb, h, ['1A', '2A'], h === 2 ? ['1A'] : []);
  m = m1(state(sb));
  assert.equal(m.status, 'done');
  assert.equal(m.result, 'won');
  assert.equal(m.kicker, 'FINAL · YOU WON 7–5');
  assert.deepEqual(m.flag, { look: 'won', side: 'us', text: '7–5' });
});

test('§2 clinch early = done; later holes are scored but change nothing', () => {
  const sb = scorebook();
  for (let h = 1; h <= 4; h++) post(sb, h, ['1A', '2A'], h === 4 ? [] : ['1A']); // 6–0, then 1–1 → 7–1
  let st = state(sb), m = m1(st);
  assert.equal(m.status, 'done');
  assert.deepEqual(m.holePts, [7, 1]);
  assert.equal(m.decidedEarly, 2);
  assert.equal(m.barLine, 'Decided with 2 to play');
  assert.equal(st.sides.us.total, 1);
  post(sb, 5, ['1A', '2A'], ['2A']);
  post(sb, 6, ['1A', '2A'], ['2A']);
  m = m1(state(sb));
  assert.deepEqual(m.holePts, [7, 1], 'frozen at the clinch');
  assert.equal(m.holes[5].counts, false);
  assert.equal(m.holes[5].lowBall, 'them', 'still scored for the scorecard');
});

test('§2 nothing is provisional: a done match counts for the side while other groups play on', () => {
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) post(sb, h, ['1A', '2A'], ['1A']); // only tee time 1 has played
  const st = state(sb);
  assert.equal(st.sides.us.total, 1);
  assert.equal(st.cupLine, '11 LEFT · 6½ WINS');
  assert.equal(st.sides.us.needs, 5.5);
});

test('§3 rotations: future until scores land, live while playing, done when all four matches are', () => {
  const sb = scorebook();
  let st = state(sb);
  assert.deepEqual(st.rotations.map((r) => r.status), ['future', 'future', 'future']);
  post(sb, 1, ['1A', '2A']);
  st = state(sb);
  assert.deepEqual(st.rotations.map((r) => r.status), ['live', 'future', 'future']);
  for (let h = 1; h <= 6; h++) post(sb, h, ALL, ['1A', '1B', '1C', '2D']);
  st = state(sb);
  assert.equal(st.rotations[0].status, 'done');
  assert.deepEqual(st.rotations[0].tally, { us: 3, them: 1 });
});

test('§3 two rotations can be live at once (early groups into 7–12 while the 4th finishes 1–6)', () => {
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) post(sb, h, ['1A', '2A', '1B', '2B', '1C', '2C']);
  for (let h = 1; h <= 3; h++) post(sb, h, ['1D', '2D']);
  post(sb, 7, ['1A', '2A']); // 1A plays 2B on 7–12, 2B hasn't posted 7 yet
  const st = state(sb);
  assert.deepEqual(st.rotations.map((r) => r.status), ['live', 'live', 'future']);
  const m = st.matches.find((x) => x.us.id === '1A' && x.rotation === 1);
  assert.equal(m.status, 'notStarted');
  assert.equal(m.holes[0].whoIsIn, 'us');
  assert.equal(m.flag.text, 'on 7', 'where the trailing cart is');
  assert.equal(ryderNeedLine(m, m.holes[0]), 'Your scores are in, waiting on them.');
});

test('§3 Board order: live rotations first (most recent first), then done, then future', () => {
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) post(sb, h, ['1A', '2A', '1B', '2B']);
  for (let h = 1; h <= 5; h++) post(sb, h, ['1C', '2C', '1D', '2D']);
  post(sb, 7, ['1A', '2A']);
  let st = state(sb);
  assert.deepEqual(st.order.map((r) => r.index), [1, 0, 2]);
  post(sb, 6, ['1C', '2C', '1D', '2D']);
  st = state(sb);
  assert.deepEqual(st.order.map((r) => r.index), [1, 0, 2]);
  assert.deepEqual(st.order.map((r) => r.status), ['live', 'done', 'future']);
  // Only their scores in: what you need.
  const sb2 = scorebook();
  sb2.post(1, { [cart('2A')[0]]: 4, [cart('2A')[1]]: 5 });
  const m = m1(state(sb2));
  assert.equal(ryderNeedLine(m, m.holes[0]), 'Sean made 4, Baker 5. A 4 halves low ball; 8 or better between you takes low total.');
});
