import test from 'node:test';
import assert from 'node:assert/strict';
import { splitName, displayNames, fullName, nameKey } from '../js/names.js';
import { createBackend } from './mock-supabase.mjs';

test('Names: "andrew  duong" splits into first + last; one word has no last name', () => {
  assert.deepEqual(splitName('andrew  duong'), { first: 'Andrew', last: 'Duong' });
  assert.deepEqual(splitName('Mary Beth de la Cruz'), { first: 'Mary', last: 'Beth De La Cruz' });
  assert.deepEqual(splitName('Sean'), { first: 'Sean', last: '' });
  assert.deepEqual(splitName('DJ McCoy'), { first: 'DJ', last: 'McCoy' });
});

test('Names: a round shows first names; two Andrews become "Andrew D." / "Andrew S."; nickname if still the same', () => {
  assert.deepEqual(displayNames([{ firstName: 'Andrew', lastName: 'Duong' }, { firstName: 'Sean', lastName: 'Baker' }]), ['Andrew', 'Sean']);
  assert.deepEqual(displayNames([{ firstName: 'Andrew', lastName: 'Duong' }, { firstName: 'andrew', lastName: 'Smith' }]), ['Andrew D.', 'andrew S.']);
  assert.deepEqual(displayNames([{ firstName: 'Andrew', lastName: 'Duong' }, { firstName: 'Andrew', lastName: 'Dunn', nickname: 'Drew' }]), ['Andrew Duong', 'Drew']);
  assert.deepEqual(displayNames([{ name: 'Josh' }, { firstName: 'Sean', lastName: 'Baker' }]), ['Josh', 'Sean'], 'older rounds only have name');
  assert.equal(fullName({ firstName: 'Andrew', lastName: 'Duong', nickname: 'Drew' }, { withNick: true }), 'Andrew Duong (Drew)');
  assert.equal(nameKey({ firstName: 'Andrew', lastName: 'Duong' }), nameKey({ firstName: 'andrew', lastName: ' duong ' }));
});

test('Crews + people: rounds keep a crew’s people in step; a taken full name never blocks a round', () => {
  const be = createBackend();
  const crew = '3519327b-6bad-4467-b561-a6b01c111224';
  const A = 'eeae7a48-33fa-4052-ad0c-fc7623173fe6', S = '7ee08322-7d37-4dec-bb96-c9e781836500';
  const make = (players, played, crewId = crew, settings = {}) => be.rpc.create_event({
    p_name: 'R', p_course: { name: 'X' }, p_roster: { teams: [], players }, p_settings: settings, p_played_on: played, p_crew_id: crewId,
  });
  make([{ id: 'p1', personId: A, name: 'Andrew' }, { id: 'p2', personId: S, name: 'Sean' }], '2026-10-16');
  make([{ id: 'p1', personId: A, name: 'Andrew', firstName: 'Andrew', lastName: 'Duong' }], '2026-10-20');
  const people = be.rpc.crew_people({ p_crew_id: crew }).people;
  assert.deepEqual(people.map((p) => [p.firstName, p.lastName, p.rounds]), [['Andrew', 'Duong', 2], ['Sean', null, 1]], 'most recent first; last name filled in; round counts');
  assert.deepEqual(be.rpc.person_name_check({ p_first: 'andrew', p_last: 'duong', p_crew_id: crew }), { ok: true, taken: true, crewMate: true, id: A }, 'a crew-mate: that’s them');
  const other = 'aaaaaaaa-1111-4222-8333-444444444444';
  const r = make([{ id: 'p1', personId: other, name: 'Andrew', firstName: 'Andrew', lastName: 'Duong' }], '2026-10-21', null);
  assert.equal(r.ok, true, 'the clashing round still saves');
  assert.deepEqual(be.rpc.person_name_check({ p_first: 'Andrew', p_last: 'Duong', p_crew_id: r.crew_id }), { ok: true, taken: true, crewMate: false }, 'a stranger: only yes/no');
  assert.equal(be.rpc.person_name_check({ p_first: 'Andrew', p_last: 'Duong', p_nickname: 'Drew' }).taken, false, 'with a nickname it’s free');
  make([{ id: 'p1', personId: 'bbbbbbbb-1111-4222-8333-444444444444', name: 'Player 1' }], '2026-10-21', null, { practice: true });
  assert.equal(be.tables.people.has('bbbbbbbb-1111-4222-8333-444444444444'), false, 'practice rounds stay out of people');
});
