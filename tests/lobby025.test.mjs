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
  assert.equal(L.nextHostStep(st(lobbyEvent())), 'pair', '025 rev: carts come before the draft');
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
  const who = (r) => r.players.map((p) => `${p.id}:${p.personId}`).sort().join();
  assert.equal(who(swapped), who(ev.roster), 'start times move carts, never people or ids');
  assert.notEqual(L.rosterKey(swapped), L.rosterKey(ev.roster), 'rosterKey sees carts move (a stale step refuses)');
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
  assert.equal(v(lobbyEvent(), { me: 'p1' }), 'early', '025 rev: See you Saturday is gone (no handicap → no reveal)');
  assert.equal(v(drafted(), { me: 'p1' }), 'drafted');
  assert.equal(v(drafted(), { me: 'p1' }, at('2026-11-07T13:00:00Z')), 'dayWait');
  assert.equal(v(ev, { me: 'p1' }), 'ready');
  assert.equal(v(ev, { me: 'p1' }, at('2026-11-07T14:00:00Z')), 'gameday');
  assert.equal(v(ev, { me: 'p1', seenOpen: true }, at('2026-11-07T14:00:00Z')), null, 'open + seen: the normal round');
  assert.equal(v(ev, {}, at('2026-11-07T14:00:00Z')), null, 'late joiner after it opens: normal joining');
  assert.equal(v(drafted({ stage: 'off' }), { me: 'p1' }), 'off');
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
  assert.equal(L.maySaveStep('draft', st(lobbyEvent())), false, '025 rev: the draft starts from paired carts');
  assert.equal(L.maySaveStep('draft', st(drafted())), true, 'redo the draft over teams');
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

// ───────────────────────────────────────────── 025 rev (Part 2): carts before the draft + the handicap reveal

const ORDER = ['p10', 'p11', 'p3', 'p4', 'p1', 'p2', 'p5', 'p6', 'p7', 'p8', 'p9', 'p12', 'p13', 'p14', 'p15', 'p16'];
/** Stage 'carts': C1 = Baker + Mitch, C2 = Josh + Brandon, … (the order Andrew paired them in). */
function paired(lobby = {}) {
  const ev = lobbyEvent({ stage: 'carts', ...lobby });
  ev.roster = L.pairedRoster(ev.roster, ORDER);
  return ev;
}
const withHcp = (ev, list = [8, 15, 4, 10, 6, 12, 11, 9, 5, 12, 7, 20, 16, 18, 14, 13]) => {
  ev.roster.players.forEach((p, i) => { p.strokes = list[i]; });
  return ev;
};

test('rev · pairedRoster / isPaired / cartOrder / undraft / renameCarts: C1…C8, ids and people kept, strict shape', () => {
  const base = lobbyEvent().roster;
  const r = L.pairedRoster(base, ORDER);
  assert.deepEqual(r.teams.map((t) => t.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
  assert.equal(r.teams[0].name, 'Baker + Mitch');
  assert.deepEqual([r.sides, r.groups], [[], []]);
  assert.ok(r.players.every((p) => /^C[1-8]$/.test(p.teamId) && p.groupId === null));
  assert.deepEqual(r.players.map((p) => `${p.id}:${p.personId}:${p.strokes}`), base.players.map((p) => `${p.id}:${p.personId}:${p.strokes}`));
  assert.ok(L.isPaired(r));
  assert.ok(!base.players[0].teamId, 'never mutates');
  // Refusals: 15, 17, a dupe, an unknown id.
  assert.equal(L.pairedRoster(base, ORDER.slice(1)), null);
  assert.equal(L.pairedRoster(base, [...ORDER, 'p1']), null);
  assert.equal(L.pairedRoster(base, [...ORDER.slice(1), 'p11']), null);
  assert.equal(L.pairedRoster(base, [...ORDER.slice(1), 'p99']), null);
  assert.equal(L.pairedRoster({ ...base, players: base.players.slice(1) }, ORDER.slice(1)), null);
  // isPaired is strict: 7 carts, a cart of 3, someone in no cart, real carts → false.
  assert.equal(L.isPaired({ ...r, teams: r.teams.slice(1) }), false);
  const three = structuredClone(r); three.players[2].teamId = 'C1';
  assert.equal(L.isPaired(three), false);
  const loose = structuredClone(r); loose.players[0].teamId = null;
  assert.equal(L.isPaired(loose), false);
  assert.equal(L.isPaired(drafted().roster), false);
  // cartOrder round-trips; unpaired = roster order.
  assert.deepEqual(L.cartOrder(r), ORDER);
  assert.deepEqual(L.cartOrder(base), base.players.map((p) => p.id));
  const again = L.pairedRoster(r, L.cartOrder(r));
  assert.deepEqual(again.players.map((p) => p.teamId), r.players.map((p) => p.teamId));
  // Re-pairing after a draft (Redo the draft): the same pairs, back to C ids, no sides.
  const d = drafted();
  const u = L.undraft(d.roster);
  assert.ok(L.isPaired(u));
  const pairs = (ro) => new Set(ro.teams.map((t) => ro.players.filter((p) => p.teamId === t.id).map((p) => p.id).sort().join('+')));
  assert.deepEqual(pairs(u), pairs(d.roster));
  // Cart names follow a Replace.
  const sub = structuredClone(r); sub.players.find((p) => p.id === 'p10').firstName = 'Kyle';
  assert.equal(L.renameCarts(sub).teams[0].name, 'Kyle + Mitch');
  assert.equal(L.renameCarts(d.roster), d.roster, 'real carts keep their names');
});

test('rev · stages: carts checked against the roster; next step, saves allowed, writers, Remove keeps a call-off', () => {
  const wed = at('2026-11-04T18:00:00Z');
  const st = (ev) => L.lobbyState(ev, wed);
  assert.deepEqual([st(paired()).stage, st(paired()).paired], ['carts', true]);
  assert.equal(st(lobbyEvent({ stage: 'carts' })).stage, 'lobby', 'carts without carts → lobby');
  assert.equal(st(paired({ stage: 'teams' })).stage, 'carts', 'teams with only C-carts → carts (the highest the roster supports)');
  const fifteen = paired(); fifteen.roster.players.pop();
  assert.equal(st(fifteen).stage, 'lobby', 'a 15-player C roster is not paired');
  const realAtCarts = drafted({ stage: 'carts' });
  assert.equal(st(realAtCarts).stage, 'lobby', 'never above the saved stage');
  assert.equal(st(paired({ stage: 'lobby' })).stage, 'lobby');
  assert.equal(L.nextHostStep(st(paired())), 'draft');
  assert.equal(L.nextHostStep(st(paired()), { count: 15 }), 'need16');
  // maySaveStep: 3 modes × 5 stages, + open.
  const evs = { lobby: lobbyEvent(), carts: paired(), teams: drafted(), ready: drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']), off: paired({ stage: 'off', prevStage: 'carts' }) };
  const want = { carts: ['lobby', 'carts'], draft: ['carts', 'teams'], tee: ['teams', 'ready'] };
  for (const mode of Object.keys(want)) for (const [stage, ev] of Object.entries(evs)) {
    assert.equal(L.maySaveStep(mode, st(ev)), want[mode].includes(stage), `${mode} at ${stage}`);
  }
  assert.equal(L.maySaveStep('tee', L.lobbyState(evs.ready, at('2026-11-07T14:00:00Z'))), false, 'open');
  // Writers.
  const s = L.toCartsStage({ ...evs.ready.settings });
  assert.deepEqual([s.lobby.stage, s.lobby.opensAt, s.lobby.openedEarly, s.teeTimes], ['carts', null, false, []]);
  assert.equal(evs.ready.settings.lobby.stage, 'ready', 'never mutates');
  const off = L.callOff(paired().settings);
  assert.deepEqual([off.lobby.prevStage, L.bringBack(off).lobby.stage], ['carts', 'carts']);
  const removedOff = L.toLobbyStage(off);
  assert.deepEqual([removedOff.lobby.stage, removedOff.lobby.prevStage], ['off', 'lobby'], 'Remove on a called-off round keeps it off');
  assert.equal(L.toLobbyStage(paired().settings).lobby.stage, 'lobby');
  assert.equal(L.withWhen(paired().settings, '2026-11-08', '09:00').settings.lobby.stage, 'carts');
  assert.equal(L.newLobby({ startTime: '08:00', tz: TZ, hostName: 'Andrew', hostId: 'p1' }).hostId, 'p1');
  assert.equal(st(lobbyEvent({ hostId: 'p1' })).hostId, 'p1');
});

test('rev · the draft from paired carts: mates stay together, real cart ids, ids/people/handicaps kept; engine is safe at carts', () => {
  const ev = withHcp(paired());
  // Setup's draft reads the players in cart order; buildRyder hands draftedRoster side 1's carts, then side 2's.
  const byId = new Map(ev.roster.players.map((p) => [p.id, p]));
  const order = L.cartOrder(ev.roster);
  const sideA = [0, 2, 4, 6], sideJ = [1, 3, 5, 7]; // cart indexes
  const players = [...sideA, ...sideJ].flatMap((k) => [order[2 * k], order[2 * k + 1]]).map((id) => byId.get(id));
  const { roster } = L.draftedRoster(players);
  assert.ok(roster.players.every((p) => /^[12][A-D]$/.test(p.teamId)), 'no C ids left');
  const mates = (ro) => new Set(ro.teams.map((t) => ro.players.filter((p) => p.teamId === t.id).map((p) => p.id).sort().join('+')));
  assert.deepEqual(mates(roster), mates(ev.roster), 'every C pair lands in one real cart');
  assert.deepEqual(roster.players.map((p) => `${p.id}:${p.personId}:${p.strokes}`).sort(), ev.roster.players.map((p) => `${p.id}:${p.personId}:${p.strokes}`).sort());
  // Engine: a carts roster scores nothing and never throws; season and crew skip it.
  const snap = compute(ev, [{ player_id: 'p10', hole: 1, strokes: 4, updated_at: '2026-11-07T14:00:00Z', updated_by: 'Baker' }]);
  assert.equal(snap.game ?? null, null);
  assert.equal(ryderState(snap, 'C1'), null);
  assert.doesNotThrow(() => replayHeadlines(ev, []));
  assert.equal(L.countsAsPlayed(ev, []), false);
  // Old Ryder rosters with real cart ids but no sides still score (the guard reads cart ids, not sides).
  const d = drafted();
  const noSides = { ...d, roster: { ...d.roster, sides: [] } };
  assert.ok(compute(noSides, []).game?.matches?.length > 0);
});

test('rev · the mock at carts: not_open, admin ok; a cart-mate can approve an ask (as at teams), not at lobby', () => {
  const be = createBackend();
  const rpc = be.rpc;
  const ev = paired();
  const made = rpc.create_event({ p_name: 'Chuck’s Bday', p_course: ev.course, p_roster: ev.roster, p_settings: ev.settings, p_played_on: '2026-11-07' });
  const code = made.code, pin = made.admin_pin;
  be.clock = at('2026-11-07T15:00:00Z'); // after the would-be opening: still not open (stage carts)
  rpc.claim_player({ p_code: code, p_player_id: 'p10', p_device_id: 'dev-baker' });
  const res = rpc.upsert_score({ p_code: code, p_device_id: 'dev-baker', p_player_id: 'p10', p_hole: 1, p_strokes: 4 });
  assert.deepEqual([res.error, res.stage], ['not_open', 'carts']);
  assert.equal(rpc.fill_score({ p_code: code, p_device_id: 'dev-baker', p_player_id: 'p11', p_hole: 1, p_strokes: 4 }).error, 'not_open');
  assert.equal(rpc.admin_upsert_score({ p_code: code, p_admin_pin: pin, p_player_id: 'p10', p_hole: 1, p_strokes: 5 }).ok, true);
  assert.equal(rpc.pick_team_name({ p_code: code, p_device_id: 'dev-baker', p_name: 'X' }).ok !== undefined, true, 'never throws on C carts');
  // Mitch (p11, Baker's cart-mate) is taken on another phone; his new phone asks; Baker's phone may let him in.
  rpc.claim_player({ p_code: code, p_player_id: 'p11', p_device_id: 'dev-mitch-old' });
  const ask = rpc.request_join({ p_code: code, p_player_id: 'p11', p_device_id: 'dev-mitch-new' });
  assert.equal(ask.ok, true);
  assert.equal(rpc.approve_join({ p_code: code, p_approver_device_id: 'dev-baker', p_request_id: ask.request_id }).ok, true);
});

test('rev · handicaps: rank with ties and zero, the rank line, invite wording only when everyone has one', () => {
  const ev = withHcp(lobbyEvent());
  const h = L.hcpOf(ev.roster, 'p10'); // Baker 12 (Steve too)
  assert.deepEqual(h, { strokes: 12, rank: 9, tied: true, of: 16, min: 4, max: 20 });
  assert.equal(L.rankLine(h), 'Tied 9th lowest of 16 · the field runs 4 to 20.');
  assert.equal(L.rankLine(L.hcpOf(ev.roster, 'p3')), 'Lowest of 16 · the field runs 4 to 20.');
  assert.equal(L.rankLine(L.hcpOf(ev.roster, 'p11')), '4th lowest of 16 · the field runs 4 to 20.');
  const zero = withHcp(lobbyEvent(), [0, '12', null, ...Array(13).fill(null)]);
  assert.deepEqual(L.hcpOf(zero.roster, 'p1'), { strokes: 0, rank: 1, tied: false, of: 2, min: 0, max: 12 }, 'a scratch golfer is a handicap');
  assert.equal(L.hcpOf(zero.roster, 'p2').strokes, 12, 'the string "12" counts');
  assert.equal(L.hcpOf(zero.roster, 'p3'), null, 'not set');
  assert.equal(L.rankLine({ strokes: 3, rank: 1, tied: false, of: 1, min: 3, max: 3 }), null, 'nobody to compare with');
  assert.deepEqual([L.hasHandicaps(ev.roster), L.hasHandicaps(zero.roster), L.handicapCount(zero.roster)], [true, false, 2]);
  assert.equal(L.inviteText('Chuck’s Bday', 'Saturday', true), 'You’re on the list for Chuck’s Bday on Saturday. Tap this to reveal your handicap.');
  assert.equal(L.inviteText('Chuck’s Bday', 'Saturday', false), 'You’re on the list for Chuck’s Bday on Saturday. Tap to join.');
  assert.equal(L.inviteText('Chuck’s Bday', 'Saturday', true, 'Kyle'), 'Kyle, you’re on the list for Chuck’s Bday on Saturday. Tap this to reveal your handicap.');
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(L.ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st']);
});

test('rev · revealFrame: deterministic, blurred → exact by 900 ms, fades in order, reduced motion, bad elapsed', () => {
  const f = (e, r = false) => L.revealFrame(12, e, r);
  assert.deepEqual(f(500), f(500), 'same input, same frame (redraws never flicker)');
  assert.deepEqual([f(0).blur, f(0).settled, f(0).fade], [6, false, [0, 0, 0, 0]]);
  assert.notEqual(f(0).value, 12, 'starts somewhere else');
  let lastBlur = 7;
  for (let e = 0; e <= 2400; e += 50) {
    const x = f(e);
    assert.ok(x.blur <= lastBlur, `blur never grows (${e})`);
    lastBlur = x.blur;
    if (e >= 900) assert.equal(x.value, 12, `settled from 900 ms (${e})`);
    assert.ok(x.fade.every((o, i) => o >= 0 && o <= 1 && (i === 0 || o <= x.fade[i - 1])), `fades in order (${e})`);
    assert.equal(x.done, e >= 2000);
  }
  assert.deepEqual([f(1200).blur, f(1300).fade, f(2000).fade], [0, [0.5, 0, 0, 0], [1, 1, 1, 1]]);
  assert.deepEqual(f(0, true), f(99999), 'reduced motion = the final frame at once');
  for (const bad of [NaN, -500, undefined]) assert.deepEqual(L.revealFrame(12, bad), f(0), `elapsed ${bad} → the first frame`);
  for (let e = 0; e < 900; e += 50) assert.ok(L.revealFrame(0, e).value >= 0, 'never below zero');
  assert.ok(L.revealFrame(50, 0).value <= 54, 'never above 54');
});

test('rev · lobbyView precedence (table) and Home at carts', () => {
  const wed = at('2026-11-04T18:00:00Z');
  const v = (ev, ctx, now = wed) => L.lobbyView(L.lobbyState(ev, now), ctx);
  const lob = lobbyEvent(), car = paired();
  const ready = drafted({ stage: 'ready', opensAt: '2026-11-07T13:30:00.000Z' }, ['08:00', '08:10', '08:20', '08:30']);
  const me = { me: 'p10', hasHcp: true };
  const rows = [
    [lob, {}, 'landing'],
    [lob, { invite: true }, 'landing', 'invite without everyone’s handicap → the plain landing'],
    [lob, { invite: true, hcpFlow: true }, 'invite'],
    [lob, { invite: true, hcpFlow: true, guide: true }, 'guide'],
    [lob, { guide: true, standalone: true }, 'who', 'the home screen app goes straight to the list'],
    [lob, { standalone: true, watching: true }, 'watch'],
    [lob, { picking: true, watching: true, guide: true }, 'who'],
    [lob, me, 'reveal'],
    [lob, { ...me, seenHcp: true }, 'early'],
    [lob, { ...me, seenHcp: true, revealing: true }, 'reveal', 'seen is written on the first frame: still revealing'],
    [lob, { ...me, safariPhone: true }, 'guide', 'joined in Safari (024 auto-join): the steps before the reveal'],
    [lob, { ...me, safariPhone: true, revealHere: true }, 'reveal', 'Can’t add it? Reveal it here'],
    [lob, { me: 'p10', hasHcp: false }, 'early', 'no handicap: no reveal'],
    [car, { ...me, seenHcp: true }, 'early'],
    [car, { ...me, seenHcp: true }, 'dayWait', at('2026-11-07T13:00:00Z')],
    [paired({ stage: 'off' }), me, 'off', 'off beats the reveal'],
    [lob, { ...me, removed: true }, 'removed'],
    [ready, me, 'gameday', at('2026-11-07T14:00:00Z')],
    [ready, { ...me, seenOpen: true }, null, at('2026-11-07T14:00:00Z')],
  ];
  for (const [ev, ctx, want, why, now] of rows.map((r) => (typeof r[3] === 'number' ? [r[0], r[1], r[2], '', r[3]] : r))) {
    assert.equal(v(ev, ctx, now), want, why || JSON.stringify(ctx));
  }
  assert.equal(L.homeCard(car, { pid: 'p10', personId: 'person-baker' }, wed).line, 'Riding with Mitch · teams after Andrew’s draft');
  assert.deepEqual(L.myCart(car, 'p11'), { id: 'C1', names: 'Mitch + Baker', mate: 'Baker' }, 'you first');
  assert.equal(L.myCart(lob, 'p11'), null);
  assert.equal(L.myCart(drafted(), 'p10').id.length, 2);
  // Old rounds: no lobby → no view, whatever the phone says.
  const old = { ...lob, settings: { ...lob.settings, lobby: null } };
  assert.equal(L.lobbyView(L.lobbyState(old, wed), { ...me, invite: true, hcpFlow: true }), null);
});
