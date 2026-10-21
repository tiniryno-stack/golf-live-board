// Night Round games: availability by player count, foursomes for any count, 6-player match play,
// 2v2 (switching partners), cart game at the turn + custom matchups.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, gameFix, autoGroups, cartRotation, pairRotation, sideOn, sameFoursome, fmtPts } from '../js/scoring.js';
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
  assert.equal(gameFix('carts', 5), 'Add 3 more players to play this.');
  assert.equal(gameFix('carts', 8), null);
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
