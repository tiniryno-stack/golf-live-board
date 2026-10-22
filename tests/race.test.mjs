import test from 'node:test';
import assert from 'node:assert/strict';
import { racePoints, raceState } from '../js/race.js';
import { compute } from '../js/scoring.js';

const P = [{ id: 'm', name: 'Mitchell' }, { id: 'a', name: 'Andrew' }, { id: 'j', name: 'Justin' }, { id: 'p', name: 'Peter' }];
// One hole from a winner list: winners shoot 4, everyone else 5.
const hole = (...winners) => ({ scores: Object.fromEntries(P.map((p) => [p.id, winners.includes(p.id) ? 4 : 5])) });
const race = (holes, me = 'm', extra = {}) => raceState({ players: P, holes, me, ...extra });

test('Race: 1 point a hole, ties split it, a hole counts only when all 4 scores are in', () => {
  const r = racePoints([hole('m'), hole('m', 'a'), hole('m', 'a', 'j'), { scores: { m: 3, a: 4, j: 4, p: null } }], P.map((p) => p.id));
  assert.equal(r.done, 3);
  assert.ok(Math.abs(r.points.m - (1 + 1 / 2 + 1 / 3)) < 1e-9);
  assert.ok(Math.abs(r.points.a - (1 / 2 + 1 / 3)) < 1e-9);
  assert.deepEqual([r.won.m, r.won.a], [1, 0], 'outright wins only count holes won alone');
});

test('Race: lock line = 2nd place + holes left; Locked only when the lead is bigger than that', () => {
  // 14 holes: Mitchell 6½, Andrew 5½, 4 left → lock 9½, not locked.
  const holes = [...Array(6)].map(() => hole('m')).concat([...Array(5)].map(() => hole('a')), [hole('m', 'a')], [hole('j'), hole('p')]);
  const s = race(holes);
  assert.equal(s.left, 4);
  assert.equal(s.leader, 'm');
  assert.equal(s.lock, 9.5);
  assert.equal(s.locked, false);
  assert.equal(s.headline, 'You lead by 1');
  // Lead exactly = holes left: not locked (the chaser can still tie).
  const even = race([...Array(9)].map(() => hole('m')).concat([...Array(8)].map(() => hole('a'))), 'a');
  assert.equal(even.left, 1);
  assert.equal(even.lead, 1);
  assert.equal(even.locked, false);
  // Bigger lead than holes left: locked.
  const lk = race([...Array(14)].map(() => hole('a')).concat([hole('m'), hole('m')]), 'a');
  assert.equal(lk.locked, true);
  assert.equal(lk.headline, 'You’ve locked it');
  assert.equal(lk.subline.startsWith('Up by 12 with 2 left.'), true);
  assert.equal(race([...Array(14)].map(() => hole('a')).concat([hole('m'), hole('m')]), 'm').headline, 'Andrew’s locked it');
});

test('Race: OUT = can’t reach the leader even winning every hole left; reach tails only for live chasers', () => {
  const holes = [...Array(8)].map(() => hole('m')).concat([...Array(6)].map(() => hole('a')));
  const s = race(holes); // m 8, a 6, j 0, p 0, 4 left
  const row = (id) => s.rows.find((r) => r.id === id);
  assert.equal(row('j').out, true);
  assert.equal(row('j').rankLabel, 'OUT');
  assert.deepEqual(row('a').reach, [6, 10]);
  assert.equal(row('m').reach, null, 'no tail for the leader');
  assert.equal(row('j').reach, null, 'no tail once OUT');
});

test('Race: eliminations are called out once, on the hole they happen', () => {
  const base = [...Array(10)].map(() => hole('m'));
  const at = (n) => race(base.slice(0, n));
  // 9 holes: m 9, others 0, 9 left → nobody out. 10 holes: 8 left → everyone else out.
  assert.equal(at(9).newlyOut.length, 0);
  assert.match(at(10).subline, /Andrew, Justin and Peter can’t catch you anymore\./);
  assert.ok(!/can’t catch/.test(race([...base, hole('a')]).subline), 'not repeated a hole later');
});

test('Race: tied for the lead says All square; one hole left says which hole decides it', () => {
  assert.equal(race([hole('m'), hole('a')]).headline, 'All square with Andrew');
  const close = [...Array(8)].map(() => hole('m')).concat([...Array(8)].map(() => hole('a')), [hole('m', 'a')]);
  const s = race([...close.slice(0, 16), hole('m', 'a', 'j'), hole('j')].slice(0, 17).concat([]), 'm');
  assert.equal(s.left, 1);
  const half = race([...Array(8)].map(() => hole('m')).concat([...Array(8)].map(() => hole('a')), [hole('m')].map(() => ({ scores: { m: 4, a: 5, j: 4, p: 5 } }))), 'm');
  assert.equal(half.headline, '18 decides it');
  assert.equal(half.subline, 'You lead by ½. Andrew has to win 18 outright.');
  assert.equal(race(close.slice(0, 17).map((h, i) => (i === 16 ? hole('m', 'a') : h)), 'm', { lastHole: 9 }).headline, '9 decides it', 'started on 10: the last hole is 9');
});

test('Race: finished — winner, tiebreak on outright wins, and a shared win', () => {
  const win = race([...Array(10)].map(() => hole('m')).concat([...Array(8)].map(() => hole('a'))), 'a');
  assert.equal(win.headline, 'Mitchell wins');
  // Level on 9: Mitchell 5 outright + 8 halves with Andrew; Andrew 1 outright… make it explicit:
  const holes = [...Array(3)].map(() => hole('m')).concat([...Array(2)].map(() => hole('a')), [...Array(13)].map(() => hole('m', 'a')));
  const tb = race(holes, 'j');
  assert.equal(tb.points.m, tb.points.a + 1, 'sanity: Mitchell leads by 1 here');
  const level = [...Array(3)].map(() => hole('m')).concat([...Array(2)].map(() => hole('a')), [hole('a', 'j')].map(() => ({ scores: { m: 5, a: 4, j: 4, p: 5 } })), [hole('a', 'p')].map(() => ({ scores: { m: 5, a: 4, j: 5, p: 4 } })), [...Array(11)].map(() => hole('m', 'a')));
  const t = race(level, 'j');
  assert.equal(t.points.m, t.points.a);
  assert.equal(t.headline, 'Mitchell wins on outright wins (3 to 2)');
  const shared = race([...Array(2)].map(() => hole('m')).concat([...Array(2)].map(() => hole('a')), [...Array(14)].map(() => hole('m', 'a'))), 'm');
  assert.equal(shared.headline, 'You share the win with Andrew');
});

test('Engine: split point ties at the end go to most outright wins (Board, recap); mid-round they stay tied', () => {
  const course = { name: 'T', par: Array(18).fill(4), strokeIndex: [...Array(18)].map((_, i) => i + 1) };
  const roster = { players: P.map((p) => ({ id: p.id, name: p.name, strokes: 0 })), groups: [{ id: 'g1', playerIds: P.map((p) => p.id) }], teams: [] };
  const ev = { course, roster, settings: { solo: true } };
  const level = [[3, 'm'], [2, 'a']].flatMap(([n, w]) => Array(n).fill([w])).concat([[['a', 'j']], [['a', 'p']]], Array(11).fill(['m', 'a']));
  const scores = [];
  level.forEach((ws, i) => P.forEach((p) => scores.push({ player_id: p.id, hole: i + 1, strokes: ws.flat().includes(p.id) ? 4 : 5 })));
  const g = compute(ev, scores).game;
  const s = g.standings;
  const top = s.find((x) => x.rank === 1);
  assert.equal(s.filter((x) => x.rank === 1).length, 1, 'one winner, not shared');
  assert.equal(compute(ev, scores).teamById.get(top.teamId).playerIds[0], 'm');
  const mid = compute(ev, scores.filter((x) => x.hole <= 5)).game.standings;
  assert.ok(mid.filter((x) => x.rank === 1).length >= 1);
});

// ── bottom card (feature 003-race-bottom): the spec's thru 14 and thru 17 cases
import { holeOutcomes, holeShares, showStakes } from '../js/race.js';
const rep = (n, ...w) => [...Array(n)].map(() => hole(...w));
// Thru 14: Mitchell 6, Andrew 5½, Justin 1½, Peter 1 (4 left).
const THRU14 = [...rep(5, 'm'), ...rep(4, 'a'), ...rep(2, 'm', 'a'), hole('a', 'j'), hole('j'), hole('p')];
// Thru 17: Mitchell 7½, Andrew 7, Justin 1½, Peter 1 (1 left).
const THRU17 = [...rep(6, 'm'), ...rep(5, 'a'), ...rep(3, 'm', 'a'), hole('a', 'j'), hole('j'), hole('p')];

test('What this hole does, thru 14 (hole 15): up 1½ / still up ½ / still up ½ · lock 8½ / down ½', () => {
  const s = race(THRU14);
  assert.deepEqual([s.points.m, s.points.a, s.points.j, s.points.p], [6, 5.5, 1.5, 1]);
  const rows = holeOutcomes({ players: P, holes: THRU14, me: 'm' });
  assert.deepEqual(rows.map((r) => [r.label, r.result]), [
    ['You win it alone', 'UP 1½'],
    ['You split it with Andrew', 'STILL UP ½'],
    ['Justin or Peter win it', 'STILL UP ½ · LOCK 8½'],
    ['Andrew wins it alone', 'DOWN ½'],
  ]);
  assert.deepEqual(rows.map((r) => r.good), [true, false, false, false], 'green only when it helps you');
  assert.equal(showStakes({ players: P, holes: THRU14, me: 'm' }), true, 'hole 15, top two within 1');
});

test('What this hole does, thru 17 (hole 18): anything but Andrew alone → you win; Andrew alone → Andrew wins 8 to 7½', () => {
  const s = race(THRU17);
  assert.deepEqual([s.points.m, s.points.a], [7.5, 7]);
  const rows = holeOutcomes({ players: P, holes: THRU17, me: 'm' });
  assert.equal(rows[0].result, 'YOU WIN 8½ TO 7');
  assert.match(rows[1].result, /^YOU WIN/);
  assert.match(rows[2].result, /^YOU WIN/);
  assert.equal(rows[3].label, 'Andrew wins it alone');
  assert.equal(rows[3].result, 'ANDREW WINS 8 TO 7½');
  assert.ok(rows.length <= 4);
});

test('What this hole does: a points tie at the end goes to most outright wins', () => {
  // Thru 17, level: Mitchell 7 (3 alone), Andrew 7 (2 alone). Rival splits 18 with a third player → still level.
  const level = [...rep(3, 'm'), ...rep(2, 'a'), ...rep(8, 'm', 'a'), ...rep(2, 'a', 'j'), hole('j'), hole('p')];
  assert.equal(race(level).points.m, race(level).points.a);
  const rows = holeOutcomes({ players: P, holes: level, me: 'm' });
  const jp = rows.find((r) => /win it$|wins it$/.test(r.label) && !/You|Andrew/.test(r.label));
  assert.equal(jp.result, 'YOU WIN ON OUTRIGHT WINS');
});

test('Points by hole: each played cell is that player’s share; the hole in progress stays empty', () => {
  const sh = holeShares([hole('m'), hole('m', 'a'), hole('m', 'a', 'j', 'p'), { scores: { m: 4, a: 4, j: null, p: 5 } }], P.map((p) => p.id));
  assert.deepEqual(sh.m.slice(0, 4), [1, 0.5, 0.25, null]);
  assert.deepEqual(sh.j.slice(0, 4), [0, 0, 0.25, null]);
  assert.equal(sh.m.length, 18);
  assert.equal(showStakes({ players: P, holes: rep(7, 'm'), me: 'm' }), false, 'thru 7 with a big lead: points by hole');
});
