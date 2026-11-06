// 024: who this phone is — the join decision, the owner migration, Who are you? grouping (js/identity.js, pure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { joinPlan, migratedOwner, whoGroups } from '../js/identity.js';

const roster = {
  groups: [{ id: 'g1' }, { id: 'g2' }],
  teams: [{ id: 'A', name: 'Hogan’s Heroes' }, { id: 'B', name: 'Shank Redemption' }, { id: 'C', name: 'Fore Play' }, { id: 'D', name: 'Bogey Boys' }],
  players: [
    { id: 'p1', personId: 'andrew', name: 'Andrew', teamId: 'A', groupId: 'g1' },
    { id: 'p2', personId: 'sean', name: 'Sean', teamId: 'A', groupId: 'g1' },
    { id: 'p3', personId: 'mike', name: 'Mike', teamId: 'B', groupId: 'g1' },
    { id: 'p4', personId: 'tyler', name: 'Tyler', teamId: 'B', groupId: 'g1' },
    { id: 'p5', personId: 'sam', name: 'Sam', teamId: 'C', groupId: 'g2' },
    { id: 'p6', personId: 'jake', name: 'Jake', teamId: 'C', groupId: 'g2' },
    { id: 'p7', name: 'Chris', teamId: 'D', groupId: 'g2' }, // an old round's player: no personId
    { id: 'p8', name: 'Matt', teamId: 'D', groupId: 'g2' },
  ],
};
const andrew = { personId: 'andrew', name: 'Andrew' };

test('§3 joinPlan: open → auto (free) → ask (taken) → pick (no owner / not on roster / practice)', () => {
  assert.deepEqual(joinPlan({ owner: andrew, roster, claims: [], deviceClaim: 'p5' }), { plan: 'open', pid: 'p5' });
  assert.deepEqual(joinPlan({ owner: andrew, roster, claims: new Set(['p3']) }), { plan: 'auto', pid: 'p1' });
  assert.deepEqual(joinPlan({ owner: andrew, roster, claims: new Set(['p1']) }), { plan: 'ask', pid: 'p1' });
  assert.equal(joinPlan({ owner: null, roster, claims: [] }).plan, 'pick');
  assert.equal(joinPlan({ owner: { personId: 'baker' }, roster, claims: [] }).plan, 'pick'); // not on this roster
  assert.equal(joinPlan({ owner: andrew, roster, claims: [], practice: true }).plan, 'pick'); // practice never auto-joins
  // Players without a personId (old rounds) can never be auto-joined.
  assert.equal(joinPlan({ owner: { personId: undefined }, roster, claims: [] }).plan, 'pick');
});

test('§2 migration: the crew me first, else the first person this phone played as, else nobody', () => {
  // The owner's phone: crew me = Andrew, though glb.people also holds Baker (oldest first).
  assert.equal(migratedOwner({ crews: [{ id: 'c1', me: null }, { id: 'c2', me: 'andrew' }], people: ['baker', 'andrew'] }), 'andrew');
  assert.equal(migratedOwner({ crews: [{ id: 'c1', me: null }], people: ['baker', 'andrew'] }), 'baker');
  assert.equal(migratedOwner({ crews: [], people: [] }), null);
});

test('§5.1 Who are you? groups: tee time → carts; no headers without tee times; plain list outside cart games', () => {
  const label = (id) => ({ g1: '8:40 tee time', g2: '8:50 tee time' })[id];
  const timed = whoGroups({ roster, settings: { teeTimes: ['08:40', '08:50'] }, players: roster.players }, label);
  assert.deepEqual(timed.map((g) => g.label), ['8:40 tee time', '8:50 tee time']);
  assert.deepEqual(timed.map((g) => g.carts.map((c) => c.teamId)), [['A', 'B'], ['C', 'D']]);
  assert.deepEqual(timed[0].carts[0].players.map((p) => p.id), ['p1', 'p2']);

  const untimed = whoGroups({ roster, settings: { teeTimes: [] }, players: roster.players }, label);
  assert.deepEqual(untimed.map((g) => g.label), ['', '']); // same order, no headers

  const solo = whoGroups({ roster, settings: { solo: true, teeTimes: ['08:40', '08:50'] }, players: roster.players }, label);
  assert.deepEqual(solo.map((g) => g.carts.length), [1, 1]); // one plain list per tee time
  assert.equal(solo[0].carts[0].label, '');
});
