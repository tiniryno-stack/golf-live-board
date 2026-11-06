// 025: the Team Ryder Cup lobby — stages, opening time across zones and DST, the organizer's next step, counts,
// the A–Z list, ids through the draft, Home's cards, the queue rule, and the server gate (via the mock).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/lobby.js';
import { compute, ryderState, ryderSetup, sameFoursome, seasonStandings } from '../js/scoring.js';
import { replayHeadlines } from '../js/headlines.js';
import { COURSES } from '../js/courses.js';
import { createBackend, seedRound } from './mock-supabase.mjs';

const TZ = 'America/Chicago';
const at = (iso) => Date.parse(iso);
const FIRST = ['Andrew', 'Alex', 'Josh', 'Brandon', 'Ant', 'Steve', 'Joseph', 'Jay', 'Sean', 'Baker', 'Mitch', 'Peter', 'Kyle', 'Chuck', 'Elijah', 'Marcus'];
const people = () => FIRST.map((f, i) => ({ id: `p${i + 1}`, personId: `person-${f.toLowerCase()}`, name: f, firstName: f, lastName: 'Test', strokes: null }));
const ryderSettings = (lobby) => ({ ...ryderSetup(people()).settings, teeTimes: [], lobby });
const lobbyEvent = (lobby = {}, extra = {}) => ({
  code: 'LOBBY', played_on: '2026-11-07', course: COURSES[0],
  roster: { groups: [], teams: [], sides: [], players: people() },
  settings: ryderSettings({ ...L.newLobby({ startTime: '08:00', tz: TZ, hostName: 'Andrew' }), ...lobby }),
  ...extra,
});
/** The draft: a reshuffled order (players keep their ids), as buildRyder hands it to draftedRoster. */
function drafted(lobby = {}, teeTimes = []) {
  const order = [9, 10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15];
  const { roster } = L.draftedRoster(order.map((k) => people()[k]));
  const ev = lobbyEvent({ stage: 'teams', ...lobby }, { roster });
  ev.settings.teeTimes = teeTimes;
  return ev;
}

test('opensAtFor: 30 min before the first start, right across DST and in other zones, whatever the phone\'s zone', () => {
  const cases = [
    ['2026-11-07', '08:00', TZ, '2026-11-07T13:30:00.000Z'], // CST
    ['2026-10-31', '08:00', TZ, '2026-10-31T12:30:00.000Z'], // CDT, the day before fall-back
    ['2026-11-01', '08:00', TZ, '2026-11-01T13:30:00.000Z'], // fall-back day
    ['2026-03-08', '08:00', TZ, '2026-03-08T12:30:00.000Z'], // spring-forward day
    ['2026-03-08', '02:30', TZ, '2026-03-08T08:00:00.000Z'], // doesn't exist: 3:30 CDT
    ['2026-11-01', '01:30', TZ, '2026-11-01T06:00:00.000Z'], // happens twice: the first (CDT)
    ['2026-03-08', '08:00', 'Europe/London', '2026-03-08T07:30:00.000Z'], // US has moved, UK hasn't
    ['2026-03-29', '08:00', 'Europe/London', '2026-03-29T06:30:00.000Z'], // BST
    ['2026-11-07', '08:00', 'Asia/Kolkata', '2026-11-07T02:00:00.000Z'], // +5:30
    ['2026-11-07', '00:15', TZ, '2026-11-07T05:45:00.000Z'], // opens the night before
    ['2026-11-07', '08:00', 'Bogus/Zone', '2026-11-07T07:30:00.000Z'], // bad zone → UTC, never a throw
  ];
  const was = process.env.TZ;
  try {
    for (const phone of ['UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      process.env.TZ = phone; // the bug to catch: reading the phone's own zone
      for (const [d, t, z, want] of cases) assert.equal(L.opensAtFor(d, t, z), want, `${d} ${t} ${z} on a ${phone} phone`);
      assert.equal(L.wallDate(at('2026-11-07T05:30:00Z'), TZ), '2026-11-06');
      assert.equal(L.dayName('2026-11-07', at('2026-11-06T18:00:00Z'), TZ), 'Saturday');
      assert.equal(L.dayName('2026-11-14', at('2026-11-06T18:00:00Z'), TZ), 'Sat Nov 14');
      assert.equal(L.shortDate('2026-11-09'), 'Mon Nov 9');
    }
  } finally { process.env.TZ = was; if (was === undefined) delete process.env.TZ; }
  assert.equal(L.opensAtFor('2026-11-07', '8:00 am', TZ), null);
  assert.equal(L.clock12('14:05'), '2:05');
  assert.equal(L.clock12('00:15'), '12:15');
  assert.equal(L.addMinutes('23:50', 20), '00:10');
});

test('lobbyState: every stage, sanity against the roster, opening to the millisecond, the day, notices', () => {
  assert.equal(L.lobbyState({ ...lobbyEvent(), settings: { ...ryderSettings(null) } }, Date.now()), null);
  assert.equal(L.lobbyState({ settings: { lobby: { stage: 'lobby' } } }, Date.now()), null, 'not Team Ryder Cup: no lobby');
  const wed = at('2026-11-04T18:00:00Z');
  const s0 = L.lobbyState(lobbyEvent(), wed);
  assert.deepEqual([s0.stage, s0.open, s0.day, s0.past, s0.startLabel, s0.hostName], ['lobby', false, false, false, '8:00', 'Andrew']);
  assert.equal(L.lobbyState(lobbyEvent({ stage: 'teams' }), wed).stage, 'lobby', 'teams without carts → lobby');
  assert.equal(L.lobbyState(drafted(), wed).stage, 'teams');
  assert.equal(L.lobbyState(drafted({ stage: 'ready', opensAt: null }), wed).stage, 'teams', 'ready without opensAt → teams');
  const ready = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']);
  const before = L.lobbyState(ready, at('2026-11-07T13:29:59.999Z'));
  assert.deepEqual([before.stage, before.open, before.day, before.msToOpen, before.opensLabel], ['ready', false, true, 1, '7:30']);
  assert.equal(L.lobbyState(ready, at('2026-11-07T13:30:00.000Z')).open, true);
  const early = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z', openedEarly: true }, ['08:00', '08:10', '08:20', '08:30']);
  assert.equal(L.lobbyState(early, at('2026-11-07T12:00:00Z')).open, true);
  const off = L.lobbyState(drafted({ stage: 'off', prevStage: 'teams', opensAt: '2026-11-01T00:00:00Z' }), wed);
  assert.deepEqual([off.stage, off.open, off.prevStage], ['off', false, 'teams']);
  assert.equal(L.lobbyState(lobbyEvent(), at('2026-11-08T18:00:00Z')).past, true);
  const noted = lobbyEvent({ notice: { text: 'Andrew moved the start to 9:10 (was 8:00).', at: '2026-11-04T18:00:00Z', until: '2026-11-07' } });
  assert.ok(L.lobbyState(noted, at('2026-11-07T20:00:00Z')).notice);
  assert.equal(L.lobbyState(noted, at('2026-11-08T07:00:00Z')).notice, null, 'the note goes after the round date (in its zone)');
  assert.equal(L.lobbyState(lobbyEvent({ cohost: 'p3' }), wed).cohostName, 'Josh');
  assert.equal(L.hostLine(L.lobbyState(lobbyEvent({ cohost: 'p3' }), wed)), 'Andrew or Josh');
});

test('nextHostStep: the one primary for each stage, in priority order', () => {
  const wed = at('2026-11-04T18:00:00Z');
  const st = (ev, now = wed) => L.lobbyState(ev, now);
  assert.equal(L.nextHostStep(st(lobbyEvent())), 'draft');
  assert.equal(L.nextHostStep(st(lobbyEvent()), { count: 15 }), 'need16');
  assert.equal(L.nextHostStep(st(drafted())), 'shareTeams');
  assert.equal(L.nextHostStep(st(drafted()), { teamsShared: true }), 'setTimes');
  assert.equal(L.nextHostStep(st(drafted(), at('2026-11-07T13:00:00Z'))), 'setTimes', 'on the day: straight to start times (26)');
  const ready = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']);
  assert.equal(L.nextHostStep(st(ready)), 'waitOpen');
  assert.equal(L.nextHostStep(st(ready, at('2026-11-07T14:00:00Z'))), 'open');
  assert.equal(L.nextHostStep(st(drafted({ stage: 'off' }))), 'off');
  const note = { text: 'x', at: '2026-11-04T17:00:00.000Z', until: '2026-11-07' };
  assert.equal(L.nextHostStep(st(drafted({ stage: 'off', notice: note }))), 'tell', 'call it off → Tell the group first');
  assert.equal(L.nextHostStep(st(drafted({ stage: 'off', notice: note })), { told: note.at }), 'off');
  assert.equal(L.nextHostStep(st(lobbyEvent({ notice: note })), { count: 15 }), 'tell');
  assert.equal(L.nextHostStep(st(ready, at('2026-11-07T13:00:00Z'))), 'waitOpen', 'the day, before it opens');
  const openNote = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z', notice: note }, ['08:00', '08:10', '08:20', '08:30']);
  assert.equal(L.nextHostStep(st(openNote, at('2026-11-07T14:00:00Z'))), 'open', 'open beats an untold notice');
  assert.equal(L.nextHostStep(null), null);
});

test('lobbyCounts adds up to the roster; joinList is A–Z with search and "on another phone"', () => {
  const roster = lobbyEvent().roster;
  const status = [
    { player_id: 'p1', claimed: true, in_app: true }, { player_id: 'p2', claimed: true, in_app: false },
    { player_id: 'p3', claimed: false, in_app: true }, // released: not in the app any more
    { player_id: 'p99', claimed: true, in_app: true }, // not on the roster: ignored
  ];
  const c = L.lobbyCounts(roster, status);
  assert.equal(c.total, 16);
  assert.equal(c.inApp + c.notYet.length, 16);
  assert.equal(c.inApp, 1);
  assert.deepEqual(c.notYet.slice(0, 2).map((x) => [x.id, x.why]), [['p2', 'safari'], ['p3', 'none']]);
  assert.equal(L.lobbyCounts(roster, null).notYet.length, 16);
  const list = L.joinList(roster, new Set(['p4']));
  assert.deepEqual(list.slice(0, 5).map((x) => x.name), ['Alex', 'Andrew', 'Ant', 'Baker', 'Brandon']);
  assert.equal(list.find((x) => x.id === 'p4').taken, true);
  assert.equal(L.joinList(roster, ['p4'], '', 'p4').find((x) => x.id === 'p4').taken, false, 'your own claim isn\'t "another phone"');
  assert.deepEqual(L.joinList(roster, [], 'jo').map((x) => x.name), ['Joseph', 'Josh']);
  assert.equal(L.joinList(roster, [], 'test').length, 16, 'last names match too');
});

test('the draft keeps every player id (claims survive), names survive Set start times; new rounds stay p1…p16', () => {
  const ev = drafted();
  for (const p of people()) assert.equal(ev.roster.players.find((x) => x.personId === p.personId).id, p.id, p.name);
  const baker = ev.roster.players.find((p) => p.name === 'Baker');
  assert.ok(baker.teamId && baker.groupId);
  const fresh = L.draftedRoster(people().map(({ id, ...p }) => p)).roster;
  assert.deepEqual(fresh.players.map((p) => p.id), people().map((p) => p.id));
  // Start times swap side 2's carts: side and cart names stay what players already saw.
  const named = { ...ev.roster, sides: ev.roster.sides.map((s) => ({ ...s, name: s.id === '2' ? 'Team Josh' : s.name })), teams: ev.roster.teams.map((t, i) => (i === 5 ? { ...t, name: 'Fore Play' } : t)) };
  const cart = named.teams[5];
  const pair = named.players.filter((p) => p.teamId === cart.id).map((p) => p.personId).sort().join();
  const swapped = L.draftedRoster([...named.players.slice(0, 8), ...named.players.slice(10, 12), ...named.players.slice(8, 10), ...named.players.slice(12)]).roster;
  const kept = L.keepNames(swapped, named);
  assert.equal(kept.sides.find((s) => s.id === '2').name, 'Team Josh');
  const where = kept.teams.find((t) => kept.players.filter((p) => p.teamId === t.id).map((p) => p.personId).sort().join() === pair);
  assert.equal(where.name, 'Fore Play');
  assert.equal(L.rosterKey(swapped), L.rosterKey(ev.roster));
  assert.equal(L.nextPlayerId({ players: [{ id: 'p1' }, { id: 'p16' }, { id: 'p3' }] }), 'p17');
  assert.equal(L.allTimesSet(['08:00', '08:10', '', '08:30'], 4), false);
  assert.equal(L.allTimesSet(['08:00', '08:10', '08:20', '08:30'], 4), true);
});

test('myLobby, lobbyView and Home\'s cards', () => {
  const ev = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']);
  const baker = ev.roster.players.find((p) => p.name === 'Baker');
  const m = L.myLobby(ev, baker.id);
  assert.equal(m.mate, 'Mitch');
  assert.equal(m.tee, '8:00');
  assert.deepEqual(m.matches.map((x) => x.holes), ['1–6', '7–12', '13–18']);
  assert.ok(m.matches.every((x) => x.vs.includes(' + ')));
  assert.equal(new Set(m.matches.map((x) => x.vs)).size, 3, 'three different opponents');
  assert.equal(L.myLobby(lobbyEvent(), 'p1'), null);
  const wed = at('2026-11-04T18:00:00Z');
  const v = (e, ctx, now = wed) => L.lobbyView(L.lobbyState(e, now), ctx);
  assert.equal(v(lobbyEvent(), {}), 'landing');
  assert.equal(v(lobbyEvent(), { picking: true }), 'who');
  assert.equal(v(lobbyEvent(), { watching: true }), 'watch');
  assert.equal(v(lobbyEvent(), { me: 'p1' }), 'welcome');
  assert.equal(v(lobbyEvent(), { me: 'p1', seenWelcome: true }), 'early');
  assert.equal(v(drafted(), { me: 'p1', seenWelcome: true }), 'drafted');
  assert.equal(v(drafted(), { me: 'p1', seenWelcome: true }, at('2026-11-07T13:00:00Z')), 'dayWait');
  assert.equal(v(ev, { me: 'p1', seenWelcome: true }), 'ready');
  assert.equal(v(ev, { me: 'p1', seenWelcome: true }, at('2026-11-07T14:00:00Z')), 'gameday');
  assert.equal(v(ev, { me: 'p1', seenOpen: true }, at('2026-11-07T14:00:00Z')), null, 'open + seen: the normal round');
  assert.equal(v(ev, {}, at('2026-11-07T14:00:00Z')), null, 'late joiner after it opens: normal joining');
  assert.equal(v(drafted({ stage: 'off' }), { me: 'p1', seenWelcome: true }), 'off');
  assert.equal(v(lobbyEvent(), { removed: true }), 'removed');
  assert.equal(L.homeCard(lobbyEvent(), { pid: 'p1', personId: 'person-andrew' }, wed).line, 'Teams after Andrew’s draft');
  assert.match(L.homeCard(drafted(), { personId: baker.personId }, wed).line, /^You’re on Team .+ · start times not set yet$/);
  assert.match(L.homeCard(ev, { personId: baker.personId }, wed).line, / · 8:00 with Mitch$/);
  const subbed = lobbyEvent();
  subbed.roster.players[9] = { ...subbed.roster.players[9], personId: 'person-kyle2', name: 'Kyle', firstName: 'Kyle' };
  assert.deepEqual([L.homeCard(subbed, { pid: 'p10', personId: 'person-baker' }, wed).kind, L.homeCard(subbed, { pid: 'p10', personId: 'person-baker' }, wed).line], ['removed', 'Andrew gave your spot to Kyle.']);
  assert.equal(L.homeCard(drafted({ stage: 'off' }), { pid: 'p1', personId: 'person-andrew' }, wed).kind, 'off');
  assert.equal(L.homeCard(lobbyEvent(), { pid: 'p1' }, at('2026-11-09T18:00:00Z')), null, 'gone after the date');
  assert.equal(L.homeCard(ev, { pid: 'p1' }, at('2026-11-07T14:00:00Z')), null, 'open: the normal Playing now card');
});

test('writers: start times (late on the day opens at once), moving the start, open early, off and back, Run it back', () => {
  const ev = drafted();
  const s1 = L.withStartTimes(ev.settings, '2026-11-07', ['08:00', '08:10', '08:20', '08:30'], at('2026-11-04T18:00:00Z'));
  assert.deepEqual([s1.lobby.stage, s1.lobby.opensAt, s1.teeTimes[2]], ['ready', '2026-11-07T13:30:00.000Z', '08:20']);
  const late = L.withStartTimes(ev.settings, '2026-11-07', ['08:20', '08:30', '08:40', '08:50'], at('2026-11-07T13:40:00Z'));
  assert.equal(late.lobby.opensAt, '2026-11-07T13:40:00.000Z', 'saved 7:40 for an 8:20 start: opens now (26)');
  const { settings: moved, moved: by } = L.withWhen(s1, '2026-11-07', '09:10');
  assert.equal(by, 70);
  assert.deepEqual(moved.teeTimes, ['09:10', '09:20', '09:30', '09:40']);
  assert.equal(moved.lobby.opensAt, '2026-11-07T14:40:00.000Z');
  assert.equal(L.notices.moved('Andrew', '09:10', '08:00'), 'Andrew moved the start to 9:10 (was 8:00).');
  assert.equal(L.withWhen(lobbyEvent().settings, '2026-11-08', '08:00').settings.lobby.opensAt, null, 'before start times: no opensAt');
  assert.equal(L.openNow(s1, at('2026-11-07T13:10:00Z')).lobby.openedEarly, true);
  const off = L.callOff(ev.settings);
  assert.deepEqual([off.lobby.stage, off.lobby.prevStage], ['off', 'teams']);
  assert.equal(L.bringBack(off).lobby.stage, 'teams');
  assert.equal(L.canBringBack({ stage: 'off', date: '2026-11-07', today: '2026-12-01' }), true);
  assert.equal(L.canBringBack({ stage: 'off', date: '2026-11-07', today: '2026-12-08' }), false);
  const back = L.toLobbyStage(s1);
  assert.deepEqual([back.lobby.stage, back.lobby.opensAt, back.teeTimes], ['lobby', null, []]);
  assert.equal('lobby' in L.withoutLobby(s1), false);
  assert.equal(ev.settings.lobby.stage, 'teams', 'writers never mutate');
  // A step opened earlier never undoes a call-off or closes an opened round.
  const st = (e2, now = at('2026-11-04T18:00:00Z')) => L.lobbyState(e2, now);
  assert.equal(L.maySaveStep('draft', st(lobbyEvent())), true);
  assert.equal(L.maySaveStep('draft', st(drafted())), true, 'redraft over teams');
  assert.equal(L.maySaveStep('tee', st(lobbyEvent())), false, 'no carts yet');
  assert.equal(L.maySaveStep('tee', st(drafted())), true);
  assert.equal(L.maySaveStep('draft', st(drafted({ stage: 'off' }))), false, 'called off meanwhile');
  const opened = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']);
  assert.equal(L.maySaveStep('tee', st(opened, at('2026-11-07T13:31:00Z'))), false, 'scoring already open');
  assert.equal(L.maySaveStep('tee', st(opened)), true, 'ready, not open yet: start times can move');
});

test('the queue keeps a not_open score only when the round is about to open; server timestamps parse', () => {
  const r = (o) => ({ ok: false, error: 'not_open', ...o });
  assert.equal(L.keepQueued(r({ stage: 'ready', opens_at: '2026-11-07T13:30:00.000000+00:00', now: '2026-11-07T13:29:00.000000+00:00' })), true);
  assert.equal(L.keepQueued(r({ stage: 'ready', opens_at: '2026-11-07 13:30:00+00', now: '2026-11-07 09:00:00+00' })), false, 'hours away: drop');
  for (const stage of ['lobby', 'teams', 'off']) assert.equal(L.keepQueued(r({ stage, opens_at: null, now: '2026-11-07T13:29:00Z' })), false);
  for (const error of ['finalized', 'own_entry', 'not_your_foursome']) assert.equal(L.keepQueued({ ok: false, error }), false);
  assert.equal(L.keepQueued({ ok: true }), false);
  assert.equal(L.parseTime('2026-11-07T13:30:00.123456+00:00'), at('2026-11-07T13:30:00.123Z'));
  assert.equal(L.parseTime('2026-11-07 13:30:00+00'), at('2026-11-07T13:30:00Z'));
  assert.equal(L.parseTime('2026-11-07T13:30:00+00:00'), at('2026-11-07T13:30:00Z'), 'Postgres drops a zero fraction');
  const near = (opens, now) => L.keepQueued(r({ stage: 'ready', opens_at: opens, now }));
  assert.equal(near('2026-11-07T15:30:00Z', '2026-11-07T13:30:00Z'), true, 'exactly 2 h: keep');
  assert.equal(near('2026-11-07T15:30:00.001Z', '2026-11-07T13:30:00Z'), false, '2 h + 1 ms: drop');
  assert.equal(near(null, '2026-11-07T13:30:00Z'), false);
  assert.equal(near('2026-11-07T13:30:00Z', '2026-11-07T13:31:00Z'), true, 'server says it just opened (skew): keep');
});

test('server gate (mock mirrors _lobby_gate): not_open until open, upsert + fill alike, admin always, old rounds untouched', () => {
  const be = createBackend();
  const rpc = be.rpc;
  const ev = lobbyEvent();
  const made = rpc.create_event({ p_name: 'Chuck’s Bday', p_course: ev.course, p_roster: ev.roster, p_settings: ev.settings, p_played_on: '2026-11-07' });
  const code = made.code, pin = made.admin_pin;
  const D = 'dev-baker', E = 'dev-sean';
  be.clock = at('2026-11-04T18:00:00Z');
  assert.equal(rpc.upsert_score({ p_code: code, p_device_id: D, p_player_id: 'p10', p_hole: 1, p_strokes: 4 }).error, 'not_open', 'unclaimed still gets not_open');
  assert.equal(rpc.claim_player({ p_code: code, p_player_id: 'p10', p_device_id: D }).ok, true);
  const res = rpc.upsert_score({ p_code: code, p_device_id: D, p_player_id: 'p10', p_hole: 1, p_strokes: 4 });
  assert.deepEqual([res.ok, res.error, res.stage], [false, 'not_open', 'lobby']);
  assert.match(res.now, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}\+00:00$/, 'Postgres timestamp form');
  assert.equal(rpc.fill_score({ p_code: code, p_device_id: D, p_player_id: 'p10', p_hole: 1, p_strokes: 4 }).error, 'not_open');
  assert.equal(rpc.admin_upsert_score({ p_code: code, p_admin_pin: pin, p_player_id: 'p10', p_hole: 1, p_strokes: 5 }).ok, true, 'organizer can always fix');
  // Organizer-only reads; counts for everyone, no ids.
  assert.equal(rpc.lobby_status({ p_code: code, p_admin_pin: '0000x' }).error, 'bad_pin');
  assert.equal(rpc.mark_in_app({ p_code: code, p_device_id: D }).marked, true);
  const st = rpc.lobby_status({ p_code: code, p_admin_pin: pin });
  assert.deepEqual(st.players.find((p) => p.player_id === 'p10'), { player_id: 'p10', claimed: true, in_app: true });
  assert.ok(st.players.every((p) => !('device_id' in p)) && st.players.length === 16);
  assert.deepEqual(rpc.lobby_counts({ p_code: code }), { ok: true, total: 16, claimed: 1, in_app: 1 });
  // The draft (ids kept): the same device is still Baker, now in a cart, and may score his cart-mate once open.
  const d = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']);
  assert.equal(rpc.update_event({ p_code: code, p_admin_pin: pin, p_course: ev.course, p_roster: d.roster, p_settings: d.settings }).ok, true);
  assert.equal(rpc.whoami({ p_code: code, p_device_id: D }).player_id, 'p10');
  const e = be.tables.events.find((x) => x.code === code);
  const mate = e.roster.players.find((p) => p.teamId === e.roster.players.find((x) => x.id === 'p10').teamId && p.id !== 'p10');
  assert.ok(sameFoursome(e.roster, e.settings, 'p10', mate.id, 1));
  rpc.claim_player({ p_code: code, p_player_id: mate.id, p_device_id: E });
  const write = (dev, pid, hole, s) => rpc.upsert_score({ p_code: code, p_device_id: dev, p_player_id: pid, p_hole: hole, p_strokes: s });
  const fill = (dev, pid, hole, s) => rpc.fill_score({ p_code: code, p_device_id: dev, p_player_id: pid, p_hole: hole, p_strokes: s });
  be.clock = at('2026-11-07T13:29:59.999Z');
  assert.equal(write(D, 'p10', 2, 4).error, 'not_open');
  assert.equal(fill(D, mate.id, 2, 4).error, 'not_open');
  be.clock = at('2026-11-07T13:30:00.000Z');
  assert.equal(write(D, 'p10', 2, 4).ok, true, 'open at opensAt exactly');
  assert.equal(fill(D, mate.id, 2, 4).ok, true);
  // Called off: closed again; admin still fine. Opened early: open before opensAt.
  e.settings = L.callOff(e.settings);
  assert.equal(write(D, 'p10', 3, 4).error, 'not_open');
  assert.equal(rpc.admin_upsert_score({ p_code: code, p_admin_pin: pin, p_player_id: 'p10', p_hole: 3, p_strokes: 4 }).ok, true);
  assert.equal(fill(D, mate.id, 3, 4).error, 'not_open', 'fill: off');
  e.settings = { ...e.settings, lobby: { ...e.settings.lobby, stage: 'teams' } };
  assert.equal(fill(D, mate.id, 3, 4).error, 'not_open', 'fill: teams');
  for (const bad of [null, 'garbage']) {
    e.settings = { ...e.settings, lobby: { ...e.settings.lobby, stage: 'ready', opensAt: bad } };
    assert.equal(write(D, 'p10', 3, 4).error, 'not_open', `ready with opensAt ${bad}: closed`);
  }
  // The phone and the server read openedEarly the same way (boolean or the text "true").
  for (const early of [true, 'true']) {
    const s2 = { ...e.settings, lobby: { ...e.settings.lobby, stage: 'ready', opensAt: '2026-11-07T15:00:00.000Z', openedEarly: early } };
    e.settings = s2;
    assert.equal(L.lobbyState({ ...e, settings: s2 }, be.clock).open, true);
    assert.equal(write(D, 'p10', 5, 4).ok, true, `openedEarly ${JSON.stringify(early)}`);
  }
  e.settings = L.openNow(L.bringBack(L.callOff({ ...e.settings, lobby: { ...e.settings.lobby, openedEarly: false } })), at('2026-11-07T13:40:00Z'));
  be.clock = at('2026-11-07T13:00:00Z');
  assert.equal(write(D, 'p10', 4, 4).ok, true, 'openedEarly: open');
  // set_round_date: organizer only, sane dates, and opensAt in the same write.
  assert.equal(rpc.set_round_date({ p_code: code, p_admin_pin: 'nope', p_date: '2026-11-08' }).error, 'bad_pin');
  assert.equal(rpc.set_round_date({ p_code: code, p_admin_pin: pin, p_date: '2030-01-01' }).error, 'bad_date');
  assert.equal(rpc.set_round_date({ p_code: code, p_admin_pin: pin, p_date: '2026-11-08', p_opens_at: '2026-11-08T13:30:00.000Z' }).ok, true);
  assert.deepEqual([e.played_on, e.settings.lobby.opensAt], ['2026-11-08', '2026-11-08T13:30:00.000Z']);
  // Not gated: old rounds, a null / non-object lobby, a lobby on a non-Ryder round.
  const old = seedRound(be);
  rpc.claim_player({ p_code: old.code, p_player_id: 'p1', p_device_id: 'dev-old' });
  be.clock = at('2026-11-04T18:00:00Z');
  for (const lobby of [undefined, null, 'null', []]) {
    old.event.settings = { ...old.event.settings, lobby };
    assert.equal(rpc.upsert_score({ p_code: old.code, p_device_id: 'dev-old', p_player_id: 'p1', p_hole: 1, p_strokes: 5 + (lobby === null ? 1 : 0) }).ok, true, String(lobby));
  }
  old.event.settings = { ...old.event.settings, lobby: { stage: 'lobby' } };
  assert.equal(rpc.upsert_score({ p_code: old.code, p_device_id: 'dev-old', p_player_id: 'p1', p_hole: 2, p_strokes: 4 }).ok, true, 'not a Ryder round: no gate');
});

test('engine: a lobby roster gives a safe snapshot; old rounds are identical with lobby null; seasons skip unplayed lobbies', () => {
  const ev = lobbyEvent();
  const snap = compute(ev, []);
  assert.equal(snap.game, null);
  assert.equal(ryderState(snap, null), null);
  assert.deepEqual(replayHeadlines(ev, []), []);
  assert.equal(compute(drafted(), []).game.matches.length, 12, 'once drafted it is a normal Team Ryder Cup');
  const be = createBackend();
  const rider = seedRound(be, { holesPlayed: 9 }).event;
  const scores = be.tables.scores.filter((s) => s.event_id === rider.id);
  const ryder = { ...drafted(), settings: { ...ryderSetup(people()).settings } };
  const split = { course: COURSES[0], roster: { groups: [{ id: 'g1' }], teams: [], players: people().slice(0, 4).map((p) => ({ ...p, groupId: 'g1' })) }, settings: { game: 'rotationMatch', solo: true } };
  const strip = (s) => { const { settings, ...rest } = s; return rest; };
  for (const e of [rider, ryder, split]) {
    const rows = e === rider ? scores : [];
    assert.deepEqual(strip(compute({ ...e, settings: { ...e.settings, lobby: null } }, rows)), strip(compute(e, rows)));
  }
  const played = { event: { ...rider, id: 'r1' }, scores };
  const unplayed = { event: { ...lobbyEvent(), id: 'r2', roster: rider.roster }, scores: [] };
  assert.deepEqual(seasonStandings([played, unplayed]), seasonStandings([played]));
  assert.equal(L.countsAsPlayed(lobbyEvent(), []), false);
  assert.equal(L.countsAsPlayed(rider, scores), true);
});
