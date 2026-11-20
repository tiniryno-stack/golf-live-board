// 032 Today's game: each playFor value gives the right slide count, game name and headlines, real names
// replace the prototype's examples, and old rounds keep the text card (null).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, ryderSetup, threeCartRotation } from '../js/scoring.js';
import { todaysGame } from '../js/todaysgame.js';
import { makeEvent } from './helpers.mjs';

const NAMES = ['Andrew', 'Mike', 'Tyler', 'Sam', 'Chris', 'Jake', 'Ben', 'Luke'];
const named = (ev) => { ev.roster.players.forEach((p, i) => { p.name = NAMES[i] || p.name; }); return ev; };
const four = (settings) => {
  const ev = makeEvent(settings);
  ev.roster = { groups: [{ id: 'g1' }], teams: [], players: ['an', 'mi', 'ty', 'sa'].map((id, i) => ({ id, personId: id, name: NAMES[i], teamId: null, groupId: 'g1', strokes: null })) };
  return ev;
};
const heads = (tg) => tg.slides.map((s) => s.h);

test('032 todaysGame: slides per game, real names, team score, old rounds keep the text card', () => {
  // 2v2, same partners: who · the hole · first to 9½ (18½ with two points a hole).
  const one = todaysGame(compute(four({ pairs: true, pairSwitch: 'never', holePoint: true }), []), 'an');
  assert.equal(one.kicker, 'Today’s game · 2v2');
  assert.deepEqual(heads(one), ['You and Mike vs Tyler and Sam.', 'Best ball takes the hole.', 'First to 9½ wins.']);
  assert.deepEqual(one.slides.map((s) => s.scene), ['meet', 'hole', 'tug']);
  assert.equal(one.slides[1].args.win, '+1 to you and Mike');
  const lbt = todaysGame(compute(four({ pairs: true, pairSwitch: 'never', teamScore: 'bestBallAggregate' }), []), 'an');
  assert.equal(lbt.kicker, '2v2 · Low ball + total');
  assert.deepEqual(heads(lbt).slice(1), ['Two points every hole.', 'First to 18½ wins.']);
  assert.equal(lbt.slides[1].ms - one.slides[1].ms, 1440, 'two point slots take longer');
  const agg = todaysGame(compute(four({ pairs: true, pairSwitch: 'never', teamScore: 'aggregate' }), []), 'an');
  assert.match(agg.slides[1].s, /^Add your two scores\. 4 \+ 6 = 10 v their 11: one point to you\.$/);

  // Partners switch: four slides; at the turn = two sets.
  const six = todaysGame(compute(four({ pairs: true, pairSwitch: 'six', dayBy: 'stretches', holePoint: true }), []), 'an');
  assert.deepEqual(heads(six), ['You and Mike vs Tyler and Sam.', 'Your partner’s ball counts too.', 'Partners switch at 7 and 13.', 'Most sets won takes the day.']);
  assert.deepEqual(six.slides[2].args.sets.map((x) => x.partner), ['Mike', 'Tyler', 'Sam']);
  assert.equal(six.slides[1].args.label, 'Hole 2 · with Mike');
  const turn = todaysGame(compute(four({ pairs: true, pairSwitch: 'turn', dayBy: 'stretches', holePoint: true }), []), 'an');
  assert.equal(turn.slides[2].h, 'Partners switch at 10.');
  assert.equal(turn.slides[3].args.res.length, 2);

  // 2v2 with 8, four carts: your cart, first up, a new cart every 6, most points.
  const carts = todaysGame(compute(named(makeEvent({ rotationMode: 'fixed', holePoint: true })), []), 'a1');
  assert.deepEqual(heads(carts), ['You and Mike are a cart.', 'A tie splits it.', 'A new cart every 6 holes.', 'Most points takes the day.']);
  assert.deepEqual(carts.slides[0].args.groups[1].names.map((n) => n.name), ['Tyler', 'Sam']);
  assert.deepEqual(carts.slides[2].args.others.map((o) => o.name), ['Tyler + Sam', 'Chris + Jake', 'Ben + Luke']);

  // 2v2 with 6, three carts.
  const ev6 = named(makeEvent({ rotationMode: 'fixed', holePoint: true, rotation: threeCartRotation() }));
  ev6.roster.teams = ev6.roster.teams.slice(0, 3);
  ev6.roster.players = ev6.roster.players.filter((p) => p.teamId !== 'D');
  const three = todaysGame(compute(ev6, []), 'a1');
  assert.deepEqual(heads(three), ['Three carts of two.', 'Both carts, every hole.', 'Most points takes the day.']);
  assert.equal(three.slides[1].s, 'Your 4 beats Tyler and Sam’s 5 and ties Chris and Jake’s 4. 1½ points.');

  // Everyone alone and Stroke play: you + three from your tee time.
  const al = todaysGame(compute(four({ solo: true }), []), 'mi');
  assert.equal(al.kicker, 'Today’s game · Alone');
  assert.deepEqual(heads(al), ['Everyone for themselves.', 'Low score takes the point.', 'The race.']);
  assert.deepEqual(al.slides[0].args.groups.map((g) => g.names[0].name), ['You', 'Andrew', 'Tyler', 'Sam']);
  const sp = todaysGame(compute(four({}), []), 'an');
  assert.equal(sp.kicker, 'Today’s game · Stroke play');
  assert.deepEqual(heads(sp), ['Just your score.', 'Every stroke counts.', 'Lowest total wins.']);
  assert.equal(sp.slides[2].args.steps[2][0].name, 'You');

  // Team Ryder Cup: sides of 8, a new cart every 6, cart against cart, 6½ wins the cup.
  const sixteen = Array.from({ length: 16 }, (_, i) => ({ id: `p${i}`, personId: `p${i}`, name: i < 8 ? NAMES[i] : `X${i}`, strokes: null }));
  const rs = ryderSetup(sixteen);
  const ev = makeEvent(rs.settings);
  ev.roster = rs.roster;
  const ry = todaysGame(compute(ev, []), 'p0');
  assert.equal(ry.kicker, 'Today’s game · Ryder Cup');
  assert.deepEqual(heads(ry), ['Two sides of 8.', 'A new cart every 6 holes.', 'Cart against cart.', '6½ wins the cup.']);
  assert.equal(ry.slides[0].s, 'Four carts a side. You and Mike are one of yours.');
  assert.equal(ry.slides[1].args.opps.length, 3);
  assert.equal(ry.slides[3].ms, 5040);

  // Watching: the first player's seat, by name.
  const w = todaysGame(compute(four({ pairs: true, pairSwitch: 'never', holePoint: true }), []), null);
  assert.equal(w.slides[0].h, 'Andrew and Mike vs Tyler and Sam.');
  // Old shapes keep the text card.
  assert.equal(todaysGame(compute(named(makeEvent({ game: 'rotationPlusMinus' })), []), 'a1'), null);
});
