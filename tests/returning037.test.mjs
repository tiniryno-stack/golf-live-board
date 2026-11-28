// Nov 24 · returning players: Safari → your app, who this phone is, the one-time What's new (pure rules).
import test from 'node:test';
import assert from 'node:assert/strict';
import { appHandoff, phonePeople } from '../js/identity.js';
import { whatsNew, RELEASES } from '../js/whatsnew.js';

test('Returning players: Safari sends you to the app, Home finds who you are, What’s new shows once', () => {
  const safari = { ios: true };
  // The link opened in iPhone Safari: the app when Safari remembers adding it, or the server says this person has it.
  assert.equal(appHandoff({ ...safari, hint: true }), 'app');
  assert.equal(appHandoff({ ...safari, serverHasApp: true }), 'app');
  assert.equal(appHandoff({ ...safari, serverHasApp: false }), 'here');
  assert.equal(appHandoff({ ...safari, serverHasApp: null }), 'here'); // no answer: Safari as before
  // Never in the app itself, off iPhone, in a practice round, or after Stay in Safari.
  for (const x of [{ standalone: true }, { ios: false }, { practice: true }, { stayed: true }]) {
    assert.equal(appHandoff({ ...safari, hint: true, serverHasApp: true, ...x }), 'here');
  }

  // Who are you? on Home: people from real rounds, the ones this phone played as first.
  const rows = [
    { code: 'AAAAA', roster: { players: [{ id: 'p1', personId: 'sean', firstName: 'Sean', lastName: 'Smith' }, { id: 'p2', personId: 'andrew', firstName: 'Andrew', lastName: 'Duong' }] } },
    { code: 'BBBBB', roster: { players: [{ id: 'p1', personId: 'sean', firstName: 'Sean', lastName: 'Smith' }, { id: 'p3', personId: 'ben', name: 'Ben' }] } },
    { code: 'PRACT', settings: { practice: true }, roster: { players: [{ id: 'p1', personId: 'ghost', name: 'Ghost' }] } },
  ];
  const ppl = phonePeople(rows, { AAAAA: 'p1', BBBBB: 'p1' });
  assert.deepEqual(ppl.map((p) => [p.name, p.mine]), [['Sean Smith', 2], ['Andrew Duong', 0], ['Ben', 0]]);

  // What's new: the newest release once; a brand-new phone just marks it seen.
  const id = RELEASES[0].id;
  assert.equal(whatsNew({ seen: null, hasRounds: true }).show.id, id);
  assert.deepEqual(whatsNew({ seen: null, hasRounds: false }), { show: null, markSeen: id });
  assert.deepEqual(whatsNew({ seen: id, hasRounds: true }), { show: null, markSeen: null });
  assert.equal(whatsNew({ seen: 'older', hasRounds: true }).show.id, id);
  // 037 v2: skipped for anyone whose first round is after the release (it was never new to them).
  assert.deepEqual(whatsNew({ seen: null, hasRounds: true, firstRound: '2026-12-01' }), { show: null, markSeen: id });
  assert.equal(whatsNew({ seen: null, hasRounds: true, firstRound: '2026-11-07' }).show.id, id);
  assert.equal(RELEASES[0].title, 'A new Home: your rounds as a wallet'); // 039
  assert.ok(RELEASES[0].lines.length >= 2 && RELEASES[0].lines.length <= 3);
});
