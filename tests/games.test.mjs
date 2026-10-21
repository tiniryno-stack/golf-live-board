// Night Round games: availability by player count, foursomes for any count, 6-player match play,
// 2v2 (switching partners), cart game at the turn + custom matchups, Partner “Rider” Cup for 6 (3 carts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, gameFix, autoGroups, cartRotation, pairRotation, sideOn, sameFoursome, fmtPts, threeCartRotation, cartIdsFor, matchesFor, matchFor, GAMES } from '../js/scoring.js';
import { makeEvent, scorebook, parFor, COURSE } from './helpers.mjs';

const solo = (ids) => ids.map((id) => ({ id, personId: id, name: id.toUpperCase(), teamId: null, groupId: 'g1', strokes: null }));

test('Games by player count: the fix is spelled out', () => {
  assert.equal(gameFix('scorecard', 1), null);
  assert.equal(gameFix('scorecard', 13), null);
  assert.equal(gameFix('match', 1), 'Add 1 more player to play this.');
  assert.equal(gameFix('match', 6), null);
  assert.equal(gameFix('match', 7), 'Remove 1 player to play this.');
  assert.equal(gameFix('2v2', 5), 'Remove 1 player to play this.');
  assert.equal(gameFix('2v2', 3), 'Add 1 more player to play this.');
  assert.equal(gameFix('carts', 5), 'Add 1 more player to play this.');
  assert.equal(gameFix('carts', 6), null, 'Partner “Rider” Cup with 3 carts');
  assert.equal(gameFix('carts', 7), 'Add 1 more player (8) or remove 1 (6) to play this.');
  assert.equal(gameFix('carts', 8), null);
  assert.equal(gameFix('carts', 9), 'Remove 1 player to play this.');
  assert.equal(GAMES.find((g) => g.id === 'carts').name, 'Partner “Rider” Cup');
  assert.deepEqual(cartIdsFor(6), ['A', 'B', 'C']);
  assert.deepEqual(cartIdsFor(8), ['A', 'B', 'C', 'D']);
});

test('Foursomes for any number of players: as even as possible', () => {
  assert.deepEqual(autoGroups(3), [0, 0, 0]);
  assert.deepEqual(autoGroups(5), [0, 0, 0, 1, 1]);
  assert.deepEqual(autoGroups(6), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(autoGroups(8), [0, 0, 0, 0, 1, 1, 1, 1]);
  assert.deepEqual(autoGroups(9), [0, 0, 0, 1, 1, 1, 2, 2, 2]);
});

test('Match play with 6 players: two groups, one point a hole, ties split', () => {
  const ev = makeEvent({ game: 'rotationMatch', solo: true, rotationMode: 'fixed' });
  const players = solo(['a1', 'b1', 'c1', 'd1', 'e1', 'f1']);
  players.forEach((p, i) => { p.groupId = i < 3 ? 'g1' : 'g2'; });
  ev.roster = { groups: [{ id: 'g1' }, { id: 'g2' }], teams: [], players };
  const sb = scorebook();
  sb.post(1, { a1: 4, b1: 5, c1: 5, d1: 5, e1: 4, f1: 6 }); // a1 + e1 tie: ½ each
  const snap = compute(ev, sb.rows());
  assert.equal(snap.game.type, 'splitPoint');
  assert.equal(snap.teams.length, 6);
  const pts = Object.fromEntries(snap.game.liveStandings.map((s) => [s.teamId, fmtPts(s.points)]));
  assert.deepEqual(pts, { A: '½', E: '½', B: '0', C: '0', D: '0', F: '0' });
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'c1', 1), true);
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'd1', 1), false, 'the other group');
});

test('2v2, never switch: Andrew + Sean vs Sam + Jake all 18, Low Ball + Low Total', () => {
  const ev = makeEvent({ pairs: true, pairSwitch: 'never' });
  ev.roster = { groups: [{ id: 'g1' }], teams: [], players: solo(['an', 'se', 'sa', 'ja']) };
  const sb = scorebook();
  sb.post(1, { an: 3, se: 5, sa: 4, ja: 4 }); // LB 3 v 4 → us; LT 8 v 8 → push
  const snap = compute(ev, sb.rows());
  const g = snap.game;
  assert.equal(g.type, 'rotationMatch');
  assert.equal(g.matches.length, 1);
  assert.deepEqual(g.matches[0].teams, ['AB', 'CD']);
  assert.equal(snap.teamById.get('AB').name, 'AN + SE');
  assert.equal(g.matches[0].points.AB, 1.5);
  assert.equal(g.matches[0].points.CD, 0.5);
  assert.deepEqual(g.people.map((r) => [r.playerId, r.points]), [['an', 1.5], ['se', 1.5], ['ja', 0.5], ['sa', 0.5]]);
  assert.equal(sideOn(snap, 'se', 1), 'AB');
  assert.equal(sameFoursome(ev.roster, snap.settings, 'an', 'ja', 1), true, 'one foursome');
});

test('2v2, switch every 6: everyone partners with everyone once; points add up per player', () => {
  const ev = makeEvent({ pairs: true, pairSwitch: 'six' });
  ev.roster = { groups: [{ id: 'g1' }], teams: [], players: solo(['an', 'se', 'sa', 'ja']) };
  assert.deepEqual(pairRotation('six').map((r) => r.pairs), [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]]);
  const sb = scorebook();
  const par = (h) => COURSE.par[h - 1];
  for (let h = 1; h <= 18; h++) sb.post(h, { an: par(h) - 1, se: par(h), sa: par(h), ja: par(h) }); // Andrew birdies every hole
  const snap = compute(ev, sb.rows());
  const g = snap.game;
  assert.deepEqual(g.matches.map((m) => m.teams.join(' v ')), ['AB v CD', 'AC v BD', 'AD v BC']);
  assert.equal(sideOn(snap, 'an', 7), 'AC');
  assert.equal(sideOn(snap, 'ja', 13), 'AD');
  // Andrew's side wins Low Ball and Low Total on every hole: 12 points a matchup + 1 bonus each.
  const by = Object.fromEntries(g.people.map((r) => [r.playerId, r.points]));
  assert.equal(by.an, 39);
  assert.equal(by.se, 13, 'partnered Andrew once');
  assert.equal(by.sa, 13);
  assert.equal(by.ja, 13);
  assert.equal(g.people[0].playerId, 'an');
  assert.equal(snap.roundComplete, true);
});

test('Cart game at the turn: 2 rotations of 9; custom matchups with a repeat', () => {
  assert.deepEqual(cartRotation('turn').map((r) => [r.holes, r.matches]), [[[1, 9], [['A', 'B'], ['C', 'D']]], [[10, 18], [['A', 'C'], ['B', 'D']]]]);
  assert.deepEqual(cartRotation('six', ['D', 'D', 'B']).map((r) => r.matches), [[['A', 'D'], ['B', 'C']], [['A', 'D'], ['B', 'C']], [['A', 'B'], ['C', 'D']]]);
  const ev = makeEvent({ rotation: cartRotation('turn'), rotationMode: 'swap' });
  const sb = scorebook();
  for (let h = 1; h <= 9; h++) sb.post(h, parFor(['A', 'B', 'C', 'D'], h));
  const snap = compute(ev, sb.rows());
  assert.equal(snap.game.rotations.length, 2);
  assert.equal(snap.game.matches[0].total, 9);
  assert.equal(snap.game.matches[0].final, true);
  assert.equal(snap.officialThrough, 9);
  // Play together: carts swap foursomes at the turn (A plays with C on the back nine).
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'b1', 9), true);
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'c1', 10), true);
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'b1', 10), false);
});

test('Partner “Rider” Cup for 6: 3 carts, every cart plays both others on every hole, all 18', () => {
  const ev = makeEvent({ rotation: threeCartRotation(), rotationMode: 'fixed' });
  ev.roster.teams = ev.roster.teams.slice(0, 3);
  ev.roster.players = ev.roster.players.filter((p) => p.teamId !== 'D').map((p) => ({ ...p, groupId: p.teamId === 'C' ? 'g2' : 'g1' }));
  const sb = scorebook();
  // Hole 1 (par 4 at Twin Creeks? use the real par): A has the low ball, B and C tie on everything.
  const par = ev.course.par[0];
  sb.post(1, { a1: par - 1, a2: par + 1, b1: par, b2: par, c1: par, c2: par });
  let snap = compute(ev, sb.rows());
  const g = snap.game;
  assert.equal(g.rotations.length, 1);
  assert.deepEqual(g.matches.map((m) => m.teams), [['A', 'B'], ['A', 'C'], ['B', 'C']]);
  assert.equal(g.matches[0].total, 18);
  // A v B: low ball A (par−1 v par), low total push (2par v 2par) → A 1½, B ½. Same for A v C. B v C: push, push.
  assert.equal(g.matches[0].points.A, 1.5);
  assert.equal(g.matches[0].points.B, 0.5);
  assert.equal(g.matches[2].points.B, 1);
  assert.equal(g.pointsByHole[0].points.A, 3, 'two matches on the same hole add up');
  assert.equal(g.pointsByHole[0].points.B, 1.5);
  assert.equal(g.pointsByHole[0].points.C, 1.5);
  const pts = Object.fromEntries(g.liveStandings.map((s) => [s.teamId, s.points]));
  assert.deepEqual(pts, { A: 3, B: 1.5, C: 1.5 });
  assert.equal(g.liveStandings.find((s) => s.teamId === 'A').available, 4, '2 points a hole against each of 2 carts');
  // The second tee time hasn't played: hole 1 isn't official yet only if C hasn't posted. C has, so it is.
  assert.equal(snap.officialThrough, 1);
  // Two matches for a cart on a hole; matchFor gives the first.
  assert.deepEqual(matchesFor(snap, 'A', 5).map((m) => m.teams), [['A', 'B'], ['A', 'C']]);
  assert.deepEqual(matchesFor(snap, 'C', 5).map((m) => m.teams), [['A', 'C'], ['B', 'C']]);
  assert.deepEqual(matchFor(snap, 'B', 5).teams, ['A', 'B']);
  // Fixed groups: A + B tee off together, C is the second tee time.
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'b2', 7), true);
  assert.equal(sameFoursome(ev.roster, snap.settings, 'a1', 'c1', 7), false);
  // All 18 in: every matchup final, the win bonus lands, the round is complete.
  for (let h = 2; h <= 18; h++) sb.post(h, parFor(['A', 'B', 'C'], h));
  snap = compute(ev, sb.rows());
  assert.equal(snap.roundComplete, true);
  assert.equal(snap.game.matches[0].result, 'A');
  assert.equal(snap.game.matches[2].result, 'halved');
  const fin = Object.fromEntries(snap.game.standings.map((s) => [s.teamId, [s.points, s.rank, `${s.record.w}-${s.record.l}-${s.record.h}`]]));
  // Holes 2–18 all pushed: ½ + ½ a hole in each of a cart's 2 matches = 34. A: 3 + 34 + 2 wins = 39;
  // B and C: 1½ + 34 + ½ (their halved matchup splits the bonus) = 36.
  assert.deepEqual(fin, { A: [39, 1, '2-0-0'], B: [36, 2, '0-1-1'], C: [36, 2, '0-1-1'] });
});
