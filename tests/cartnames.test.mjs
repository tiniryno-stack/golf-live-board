// Nov 19: cart names off by default (FLAGS.cartNames). Carts show their players' first names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cartDisplayName, displayEvent } from '../js/teams.js';

const players = [
  { id: 'p1', name: 'Andrew', teamId: 'A' }, { id: 'p2', name: 'Sean', teamId: 'A' },
  { id: 'p3', name: 'Sam', teamId: 'B' }, { id: 'p4', name: 'Jake', teamId: 'B' },
  { id: 'p5', name: 'Chris', teamId: 'C' },
];
const event = { code: 'X', roster: { players, teams: [
  { id: 'A', name: "Hogan's Heroes" }, { id: 'B', name: 'Cart B' }, { id: 'C', name: 'Chris' },
  { id: 'AB', name: 'Pair', members: ['p3', 'p1'] },
] } };

test('carts of two are their players, in roster order or member order', () => {
  assert.equal(cartDisplayName(event.roster.teams[0], players, false), 'Andrew + Sean');
  assert.equal(cartDisplayName(event.roster.teams[1], players, false), 'Sam + Jake');
  assert.equal(cartDisplayName(event.roster.teams[3], players, false), 'Sam + Andrew');
});

test('a one-player team keeps its name; names on keeps every name', () => {
  assert.equal(cartDisplayName(event.roster.teams[2], players, false), 'Chris');
  assert.equal(cartDisplayName(event.roster.teams[0], players, true), "Hogan's Heroes");
});

test('displayEvent renames a copy and never touches the saved round', () => {
  const v = displayEvent(event, false);
  assert.equal(v.roster.teams[0].name, 'Andrew + Sean');
  assert.equal(event.roster.teams[0].name, "Hogan's Heroes");
  assert.equal(displayEvent(event, true), event);
});
