// node --test tests/
// Section 7 worked examples + the rules scoring.js implements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compute, strokesOnHole, maxHoleScore, componentsFor, sameFoursome, foursomeFor,
  fmtPts, fmtToPar, playerLeaderboard, seasonStandings, nextHoleFor, playerStrokes,
} from '../js/scoring.js';
import { makeEvent, scorebook, COURSE } from './helpers.mjs';

const match = (snap, id) => snap.game.matches.find((m) => m.id === id);

// ───────────────────────────────────────────── 7.7 worked example: rotation 1, best ball

test('7.7 rotation 1 best ball: Match Play A banks 4, B banks 2', () => {
  const ev = makeEvent({ teamScore: 'bestBall', game: 'rotationMatch' });
  const aBB = [4, 5, 3, 5, 4, 6], bBB = [5, 5, 4, 4, 5, 6];
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) {
    sb.post(h, { a1: aBB[h - 1], a2: aBB[h - 1] + 1, b1: bBB[h - 1], b2: bBB[h - 1] + 2 });
  }
  const m = match(compute(ev, sb.rows()), 'r1m1');
  assert.equal(m.played, 6);
  assert.equal(m.points.A, 4);
  assert.equal(m.points.B, 2);
  assert.equal(m.final, true);
  assert.equal(m.result, 'A');
});

test('7.7 rotation 1 best ball: Plus/Minus A +2, B −2', () => {
  const ev = makeEvent({ teamScore: 'bestBall', game: 'rotationPlusMinus' });
  const aBB = [4, 5, 3, 5, 4, 6], bBB = [5, 5, 4, 4, 5, 6];
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) sb.post(h, { a1: aBB[h - 1], a2: 9, b1: bBB[h - 1], b2: 9 });
  const m = match(compute(ev, sb.rows()), 'r1m1');
  assert.equal(m.margin.A, 2);
  assert.equal(m.margin.B, -2);
});

// ───────────────────────────────────────────── 7.7 Low Ball / Low Total single hole

test('7.7 Low Ball / Low Total: 4+6 vs 7+7 → A 2, B 0', () => {
  const ev = makeEvent();
  const m = match(compute(ev, scorebook().post(2, { a1: 4, a2: 6, b1: 7, b2: 7 }).rows()), 'r1m1');
  assert.deepEqual(m.holes[1].points, { A: 2, B: 0 });
});

test('7.7 Low Ball / Low Total: partner makes a 10 → Low Total halved → A 1½, B ½', () => {
  const ev = makeEvent();
  const m = match(compute(ev, scorebook().post(2, { a1: 4, a2: 10, b1: 7, b2: 7 }).rows()), 'r1m1');
  assert.deepEqual(m.holes[1].points, { A: 1.5, B: 0.5 });
});

test('7.7 Low Ball / Low Total: partner makes an 11 → B takes Low Total → 1–1', () => {
  const ev = makeEvent();
  const m = match(compute(ev, scorebook().post(2, { a1: 4, a2: 11, b1: 7, b2: 7 }).rows()), 'r1m1');
  assert.deepEqual(m.holes[1].points, { A: 1, B: 1 });
});

test('a hole only scores once all four players have posted', () => {
  const ev = makeEvent();
  const m = match(compute(ev, scorebook().post(2, { a1: 4, a2: 6, b1: 7 }).rows()), 'r1m1');
  assert.equal(m.holes[1].complete, false);
  assert.equal(m.points.A, 0);
});

// ───────────────────────────────────────────── 7.7 strokes single hole

test('7.7 strokes: hole 4 (hcp 1), Mike gets 15 → net 6 → 1–1', () => {
  const ev = makeEvent();
  ev.roster.players.find((p) => p.id === 'a2').strokes = 15;
  assert.equal(COURSE.strokeIndex[3], 1);
  const snap = compute(ev, scorebook().post(4, { a1: 5, a2: 7, b1: 5, b2: 6 }).rows());
  assert.equal(snap.playerById.get('a2').net[3], 6);
  assert.deepEqual(match(snap, 'r1m1').holes[3].points, { A: 1, B: 1 });
});

test('7.7 strokes: without Mike’s stroke → B 1½, A ½', () => {
  const ev = makeEvent();
  const snap = compute(ev, scorebook().post(4, { a1: 5, a2: 7, b1: 5, b2: 6 }).rows());
  assert.deepEqual(match(snap, 'r1m1').holes[3].points, { A: 0.5, B: 1.5 });
});

test('7.2 strokes on a hole: 15 → hardest 15 holes; 20 → every hole + 2nd on hcp 1–2', () => {
  assert.equal(strokesOnHole(15, 15), 1);
  assert.equal(strokesOnHole(15, 16), 0);
  assert.equal(strokesOnHole(20, 1), 2);
  assert.equal(strokesOnHole(20, 2), 2);
  assert.equal(strokesOnHole(20, 3), 1);
  assert.equal(strokesOnHole(20, 18), 1);
  assert.equal(strokesOnHole(null, 1), 0);
  assert.equal(strokesOnHole(-4, 1), 0);
});

test('7.2 advanced: off the low man + allowance', () => {
  const roster = { players: [{ id: 'x', strokes: 10 }, { id: 'y', strokes: 4 }, { id: 'z', strokes: null }] };
  const s = playerStrokes(roster, { handicapMode: 'offLow', allowancePct: 100 });
  assert.equal(s.get('x'), 10); // low is 0 (z blank)
  const roster2 = { players: [{ id: 'x', strokes: 10 }, { id: 'y', strokes: 4 }] };
  assert.equal(playerStrokes(roster2, { handicapMode: 'offLow', allowancePct: 100 }).get('x'), 6);
  assert.equal(playerStrokes(roster2, { handicapMode: 'full', allowancePct: 50 }).get('x'), 5);
});

test('no strokes → net is gross; hasStrokes false', () => {
  const snap = compute(makeEvent(), scorebook().post(1, { a1: 6 }).rows());
  assert.equal(snap.hasStrokes, false);
  assert.equal(snap.playerById.get('a1').net[0], 6);
});

// ───────────────────────────────────────────── 7.3 team score + max hole score

test('7.3 team components', () => {
  assert.deepEqual(componentsFor('bestBall', 4, 6), [4]);
  assert.deepEqual(componentsFor('aggregate', 4, 6), [10]);
  assert.deepEqual(componentsFor('bestBallAggregate', 4, 6), [4, 10]);
  assert.equal(componentsFor('bestBall', 4, null), null);
});

test('7.3 max hole score: double par, net double bogey, no max on par 3s', () => {
  const s = { maxHoleScore: 'doublePar' };
  assert.equal(maxHoleScore(COURSE, s, 3, 0), 6); // par 3
  assert.equal(maxHoleScore(COURSE, s, 2, 0), 8); // par 4
  assert.equal(maxHoleScore(COURSE, s, 1, 0), 10); // par 5
  assert.equal(maxHoleScore(COURSE, { maxHoleScore: 'netDoubleBogey' }, 4, 1), 7);
  assert.equal(maxHoleScore(COURSE, { maxHoleScore: 'none' }, 2, 0), 15);
  assert.equal(maxHoleScore(COURSE, { maxHoleScore: 'doublePar', par3NoMax: true }, 3, 0), 15);
  assert.equal(maxHoleScore(COURSE, { maxHoleScore: 'doublePar', par3NoMax: true }, 2, 0), 8);
});

// ───────────────────────────────────────────── 7.1 rotation + foursomes

test('7.1 swap mode: your foursome is your cart + the cart you play on that hole', () => {
  const ev = makeEvent();
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 3), false);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'b2', 3), true);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 8), true);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'b1', 8), false);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'd2', 14), true);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'a2', 14), true);
  assert.deepEqual(foursomeFor(ev.roster, ev.settings, 'a1', 7), ['a1', 'a2', 'c1', 'c2']);
  assert.deepEqual(foursomeFor(ev.roster, ev.settings, 'c2', 7), ['c1', 'c2', 'a1', 'a2']);
});

test('7.1 fixed mode: same group all day', () => {
  const ev = makeEvent({ rotationMode: 'fixed' });
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'b1', 8), true);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 8), false);
});

test('fixed mode scores the same; cross-group holes stay pending until both groups post', () => {
  const ev = makeEvent({ rotationMode: 'fixed' });
  const sb = scorebook().post(7, { a1: 3, a2: 3, b1: 3, b2: 3 });
  const m = match(compute(ev, sb.rows()), 'r2m1'); // A v C
  assert.equal(m.holes[0].complete, false);
  sb.post(7, { c1: 4, c2: 4 });
  assert.deepEqual(match(compute(ev, sb.rows()), 'r2m1').holes[0].points, { A: 2, C: 0 });
});

// ───────────────────────────────────────────── 7.4 leaderboard + official line

test('7.4 players: to par over holes played, sorted, then thru', () => {
  const sb = scorebook().post(1, { a1: 4, b1: 5, c1: 5 }).post(2, { a1: 4, b1: 4 });
  const board = playerLeaderboard(compute(makeEvent(), sb.rows()), 'gross');
  assert.equal(board[0].id, 'a1');
  assert.equal(fmtToPar(board[0].grossToPar), '−1');
  // b1: 5 on par 5, 4 on par 4 = E thru 2; c1: E thru 1 → b1 first (more holes played)
  assert.equal(board[1].id, 'b1');
  assert.equal(board[2].id, 'c1');
});

function postAll(sb, hole, teams, strokes = null) {
  const by = {};
  for (const t of teams) {
    by[`${t}1`] = strokes ?? COURSE.par[hole - 1];
    by[`${t}2`] = strokes ?? COURSE.par[hole - 1];
  }
  return sb.post(hole, by);
}

test('7.4 official line: one foursome through 10, the other through 9 → official through 9', () => {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 9; h++) postAll(sb, h, ['a', 'b', 'c', 'd']);
  // Rotation 2 is A v C and B v D. A/C's foursome plays 10 first; A sweeps.
  sb.post(10, { a1: 3, a2: 4, c1: 4, c2: 5 });
  const snap = compute(ev, sb.rows());
  assert.equal(snap.officialThrough, 9);
  const a = snap.game.standings.find((s) => s.teamId === 'A');
  assert.equal(a.officialPoints, 9.5); // 9 holes of halves + ½ for the halved holes 1–6 matchup
  assert.equal(a.provisionalPoints, 2);
  assert.deepEqual(snap.game.provisionalHoles, [10]);
  postAll(sb, 10, ['b', 'd']);
  assert.equal(compute(ev, sb.rows()).officialThrough, 10);
});

test('7.5 clinch: lead bigger than the points left', () => {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 3; h++) sb.post(h, { a1: 3, a2: 3, b1: 9, b2: 9 });
  let m = match(compute(ev, sb.rows()), 'r1m1');
  assert.equal(m.points.A, 6);
  assert.equal(m.left, 6);
  assert.equal(m.clinchedBy, null); // 6 vs 6 left: B could still halve
  sb.post(4, { a1: 3, a2: 3, b1: 9, b2: 9 });
  m = match(compute(ev, sb.rows()), 'r1m1');
  assert.equal(m.clinchedBy, 'A');
});

test('7.5 six and a half clinches a 12-point matchup', () => {
  const ev = makeEvent();
  const sb = scorebook();
  // A: 2, 2, 2, ½ → 6½ after 4 holes; B: 0, 0, 0, 1½
  for (let h = 1; h <= 3; h++) sb.post(h, { a1: 3, a2: 3, b1: 9, b2: 9 });
  sb.post(4, { a1: 4, a2: 6, b1: 4, b2: 5 }); // LB halved, B takes LT → A ½, B 1½
  const m = match(compute(ev, sb.rows()), 'r1m1');
  assert.equal(m.points.A, 6.5);
  assert.equal(m.clinchedBy, 'A');
});

test('7.5 halved points 0: a tie banks nothing', () => {
  const ev = makeEvent({ halvedHolePoints: 0 });
  const m = match(compute(ev, scorebook().post(2, { a1: 4, a2: 4, b1: 4, b2: 4 }).rows()), 'r1m1');
  assert.deepEqual(m.holes[1].points, { A: 0, B: 0 });
});

test('7.6 Plus/Minus: zero-sum, cap clamps each rotation', () => {
  const ev = makeEvent({ game: 'rotationPlusMinus', teamScore: 'bestBall', plusMinusCap: 2 });
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) {
    sb.post(h, { a1: 3, a2: 9, b1: 4, b2: 9 }); // A wins every hole by 1 → raw +6
    sb.post(h, { c1: 4, c2: 9, d1: 4, d2: 9 });
  }
  const snap = compute(ev, sb.rows());
  const m = match(snap, 'r1m1');
  assert.equal(m.rawMargin.A, 6);
  assert.equal(m.margin.A, 2);
  const total = snap.game.standings.reduce((a, s) => a + s.pm, 0);
  assert.equal(total, 0);
  assert.equal(snap.game.standings[0].teamId, 'A');
});

test('7.5 standings tiebreak: points → record → head-to-head', () => {
  const ev = makeEvent();
  const sb = scorebook();
  // Rotation 1: A beats B (A 7, B 5); C halves D 6–6
  for (let h = 1; h <= 5; h++) sb.post(h, { a1: 4, a2: 4, b1: 4, b2: 4, c1: 4, c2: 4, d1: 4, d2: 4 });
  sb.post(6, { a1: 3, a2: 4, b1: 4, b2: 5, c1: 4, c2: 4, d1: 4, d2: 4 });
  const st = compute(ev, sb.rows()).game.standings;
  assert.equal(st[0].teamId, 'A');
  assert.equal(st[0].points, 8); // 7 hole points + 1 for winning the matchup
  assert.deepEqual(st[0].record, { w: 1, l: 0, h: 0 });
  // C and D are level on everything → shared position
  const c = st.find((s) => s.teamId === 'C'), d = st.find((s) => s.teamId === 'D');
  assert.equal(c.rank, d.rank);
  assert.equal(c.shared, true);
});

test('matchup win bonus: +1 to the winner once the matchup is in; halved splits it', () => {
  const ev = makeEvent();
  const sb = scorebook();
  // Rotation 1: A beats B; C and D halve every hole
  for (let h = 1; h <= 5; h++) sb.post(h, { a1: 3, a2: 4, b1: 4, b2: 5, c1: 4, c2: 4, d1: 4, d2: 4 });
  let snap = compute(ev, sb.rows());
  let a = snap.game.standings.find((s) => s.teamId === 'A');
  assert.equal(a.points, 10, 'no bonus until the matchup is finished');
  sb.post(6, { a1: 3, a2: 4, b1: 4, b2: 5, c1: 4, c2: 4, d1: 4, d2: 4 });
  snap = compute(ev, sb.rows());
  const m1 = match(snap, 'r1m1'), m2 = match(snap, 'r1m2');
  assert.deepEqual(m1.bonus, { A: 1, B: 0 });
  assert.deepEqual(m2.bonus, { C: 0.5, D: 0.5 });
  a = snap.game.standings.find((s) => s.teamId === 'A');
  assert.equal(a.points, 13);
  assert.equal(a.officialPoints, 13, 'official: both foursomes are through 6');
  assert.equal(snap.game.standings.find((s) => s.teamId === 'C').points, 6.5);
});

test('matchup win bonus is provisional until both foursomes finish the matchup', () => {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) sb.post(h, { a1: 3, a2: 4, b1: 4, b2: 5 }); // A/B foursome done, C/D still out
  const a = compute(ev, sb.rows()).game.standings.find((s) => s.teamId === 'A');
  assert.equal(a.officialPoints, 0);
  assert.equal(a.provisionalPoints, 13);
});

test('matchup win bonus: off, ties worth nothing, and never in Plus/Minus', () => {
  const sweep = (ev) => {
    const sb = scorebook();
    for (let h = 1; h <= 6; h++) sb.post(h, { a1: 3, a2: 4, b1: 4, b2: 5, c1: 4, c2: 4, d1: 4, d2: 4 });
    return compute(ev, sb.rows()).game;
  };
  let g = sweep(makeEvent({ matchBonus: 0 }));
  assert.equal(g.standings.find((s) => s.teamId === 'A').points, 12);
  g = sweep(makeEvent({ halvedHolePoints: 0 }));
  assert.deepEqual(match({ game: g }, 'r1m2').bonus, { C: 0, D: 0 }, 'a halved matchup splits nothing when ties score nothing');
  g = sweep(makeEvent({ game: 'rotationPlusMinus' }));
  assert.deepEqual(match({ game: g }, 'r1m1').bonus, { A: 0, B: 0 });
  // An older round saved without the setting gets the bonus (the default).
  const old = makeEvent();
  delete old.settings.matchBonus;
  assert.equal(sweep(old).standings.find((s) => s.teamId === 'A').points, 13);
});

test('nextHoleFor: first hole the foursome hasn’t fully posted', () => {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) postAll(sb, h, ['a', 'b']);
  sb.post(7, { a1: 3, a2: 3 });
  const snap = compute(ev, sb.rows());
  assert.equal(nextHoleFor(snap, 'a1'), 7); // C hasn't posted 7 yet
  assert.equal(nextHoleFor(snap, 'c1'), 1);
});

test('formatting', () => {
  assert.equal(fmtPts(4.5), '4½');
  assert.equal(fmtPts(0.5), '½');
  assert.equal(fmtPts(0), '0');
  assert.equal(fmtPts(13), '13');
  assert.equal(fmtPts(-1.5), '−1½');
  assert.equal(fmtToPar(0), 'E');
  assert.equal(fmtToPar(3), '+3');
  assert.equal(fmtToPar(-2), '−2');
});

// ───────────────────────────────────────────── 7.9 season

test('7.9 season: player + pair W-L-H across rounds, by personId', () => {
  const ev = makeEvent();
  ev.id = 'r1'; ev.played_on = '2026-10-16';
  const sb = scorebook();
  for (let h = 1; h <= 18; h++) {
    const par = COURSE.par[h - 1];
    const by = {};
    for (const t of ['a', 'b', 'c', 'd']) { by[`${t}1`] = par; by[`${t}2`] = par; }
    by.a1 = par - 1; by.a2 = par - 1; // A sweeps every hole
    sb.post(h, by);
  }
  const season = seasonStandings([{ event: ev, scores: sb.rows() }]);
  assert.equal(season.rounds, 1);
  const a1 = season.players.find((p) => p.key === 'person-a1');
  assert.deepEqual([a1.w, a1.l, a1.h], [3, 0, 0]);
  assert.equal(a1.roundsWon, 1);
  assert.equal(a1.points, 39); // 36 hole points + 3 matchup wins
  assert.equal(season.players[0].key.startsWith('person-a'), true);
  const pair = season.pairs.find((p) => p.key === 'person-a1|person-a2');
  assert.equal(pair.teamName, 'Hogan’s Heroes');
  assert.deepEqual([pair.w, pair.l, pair.h], [3, 0, 0]);
  const b = season.players.find((p) => p.key === 'person-b1');
  assert.deepEqual([b.w, b.l, b.h], [0, 1, 2]);
});

test('7.9 season: unfinished matchups do not count', () => {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 5; h++) postAll(sb, h, ['a', 'b', 'c', 'd']);
  const season = seasonStandings([{ event: ev, scores: sb.rows() }]);
  assert.equal(season.players.every((p) => p.games === 0), true);
  assert.equal(season.pairs.length, 0);
});

// ───────────────────────────────────────────── starting on the back nine

import { playOrder, posOf, holeAt, holesLabel, currentHoleOf } from '../js/scoring.js';

test('start on 10: play order, positions and labels', () => {
  const st = { startHole: 10 };
  assert.deepEqual(playOrder(st), [10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(posOf(st, 10), 1);
  assert.equal(posOf(st, 1), 10);
  assert.equal(holeAt(st, 7), 16);
  assert.equal(holesLabel(st, 1, 6), 'Holes 10–15');
  assert.equal(holesLabel(st, 7, 12), 'Holes 16–18, 1–3');
  assert.equal(holesLabel(st, 13, 18), 'Holes 4–9');
  assert.deepEqual(playOrder({}), Array.from({ length: 18 }, (_, i) => i + 1));
});

test('start on 10: matchups follow play order (10–15, 16–3, 4–9)', () => {
  const ev = makeEvent({ startHole: 10 });
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'b1', 12), true); // rot 1: A v B
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 12), false);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 16), true); // rot 2: A v C
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 2), true);
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'd1', 4), true); // rot 3: A v D
  assert.equal(sameFoursome(ev.roster, ev.settings, 'a1', 'c1', 4), false);
  const snap = compute(ev, []);
  assert.deepEqual(snap.game.matches[0].holes.map((h) => h.hole), [10, 11, 12, 13, 14, 15]);
  assert.equal(snap.game.matches[2].label, 'Holes 16–18, 1–3');
  assert.equal(nextHoleFor(snap, 'a1'), 10);
  assert.equal(currentHoleOf(snap, 'a1'), 10);
});

test('start on 10: official line runs 10 → 18 → 1, holes 1–9 come last', () => {
  const ev = makeEvent({ startHole: 10 });
  const sb = scorebook();
  for (const h of [10, 11, 12, 13, 14, 15, 16, 17, 18]) postAll(sb, h, ['a', 'b', 'c', 'd']);
  sb.post(1, { a1: 3, a2: 3, c1: 5, c2: 5 }); // A/C's foursome is a hole ahead, on 1
  const snap = compute(ev, sb.rows());
  assert.equal(snap.officialThrough, 9);
  assert.equal(snap.officialHole, 18);
  assert.deepEqual(snap.game.provisionalHoles, [1]);
  assert.equal(nextHoleFor(snap, 'a1'), 2);
  assert.equal(nextHoleFor(snap, 'b1'), 1);
  // all 18 in → round complete, nextHoleFor is null
  postAll(sb, 1, ['b', 'd']);
  for (let h = 2; h <= 9; h++) postAll(sb, h, ['a', 'b', 'c', 'd']);
  const done = compute(ev, sb.rows());
  assert.equal(done.roundComplete, true);
  assert.equal(done.officialHole, 9);
  assert.equal(nextHoleFor(done, 'a1'), null);
});

test('Board bars: share of points on offer always ranks like the points (random rounds)', () => {
  // Deterministic pseudo-random scores: both foursomes through `shared` holes, group 1 a few ahead.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let round = 0; round < 60; round++) {
    const ev = makeEvent({ halvedHolePoints: round % 3 === 0 ? 0 : 0.5, matchBonus: round % 2 });
    const sb = scorebook();
    const shared = 1 + Math.floor(rnd() * 17);
    const ahead = Math.min(18 - shared, Math.floor(rnd() * 4));
    for (let h = 1; h <= shared + ahead; h++) {
      const par = COURSE.par[h - 1];
      const ids = h <= shared ? ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2'] : ['a1', 'a2', 'b1', 'b2'];
      sb.post(h, Object.fromEntries(ids.map((id) => [id, par - 1 + Math.floor(rnd() * 4)])));
    }
    const g = compute(ev, sb.rows()).game;
    const avail = new Set(g.standings.map((s) => s.officialAvailable));
    assert.equal(avail.size, 1, 'every team has the same points on offer on the official line');
    const share = g.standings.map((s) => (s.officialAvailable ? s.officialPoints / s.officialAvailable : 0));
    for (let i = 1; i < share.length; i++) assert.ok(share[i] <= share[i - 1] + 1e-9, `rank ${i + 1} never has a longer bar (round ${round})`);
  }
});

test('Board bars: 3 holes, 4 of 6 points = two-thirds of the bar; holes played ahead stay out', () => {
  const ev = makeEvent();
  const sb = scorebook();
  // A wins Low Ball on 1 and 2 (Low Total halved), all square on 3: A 4 of 6, B 2. C/D push everything.
  sb.post(1, { a1: 4, a2: 6, b1: 5, b2: 5, c1: 5, c2: 5, d1: 5, d2: 5 });
  sb.post(2, { a1: 3, a2: 5, b1: 4, b2: 4, c1: 4, c2: 4, d1: 4, d2: 4 });
  sb.post(3, { a1: 3, a2: 3, b1: 3, b2: 3, c1: 3, c2: 3, d1: 3, d2: 3 });
  sb.post(4, { a1: 9, a2: 9, b1: 3, b2: 3 }); // group 1 ahead: B sweeps hole 4, provisional
  const s = compute(ev, sb.rows()).game.standings;
  const a = s.find((x) => x.teamId === 'A');
  const b = s.find((x) => x.teamId === 'B');
  assert.equal(a.officialAvailable, 6);
  assert.equal(a.officialPoints, 4);
  assert.equal(b.officialPoints, 2);
  assert.equal(b.provisionalPoints, 2);
  assert.equal(a.available, 8, 'live: 4 holes on offer for group 1');
  // The Board ranks on everything won so far: B's 2 provisional points count (4, level with A).
  const live = compute(ev, sb.rows()).game.liveStandings;
  const lb = live.find((x) => x.teamId === 'B');
  assert.equal(lb.points, 4);
  assert.ok(lb.rank <= 2, 'B moves up on its provisional points');
});
