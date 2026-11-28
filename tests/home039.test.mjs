// 039 Home is the wallet (docs/design/features/039-home-deck/SPEC.md §4): the pure model in js/homeview.js — the wallet's
// item order (next round → pack → cards; member; none), the next-round card's fields (partners / none / live), the
// headline ladder (PLAN §4 set A, one copy table), the wallet's fit; js/hub.js (isHub, the dock's set and rebuild);
// the tee sheet (lobby.teeSheet); Standings' header and 038's Full board chip (kept from 037's test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeModel, ladder, passOf, resultOf, resultSentence, finishUnits, lineResult, topKey, COPY, GAME_PHRASE, GAME_SHORT, allRounds, nextFields, walletItems, walletFit, poseOne, settleTo, rubber, EDGES } from '../js/homeview.js';
import { isHub, hubTab, dockSet, needsRebuild, HUB_TABS } from '../js/hub.js';
import { teeSheet } from '../js/lobby.js';
import { buildLocker, boardChip, boardHref, BOARD_ACT } from '../js/locker.js';
import { standingsHeader } from '../js/seasons.js';
import { COURSES } from '../js/courses.js';

const NOW = Date.parse('2026-11-25T18:00:00Z');
const TODAY = '2026-11-25';
const TC = COURSES.find((c) => /twin/i.test(c.id));
const NAMES = ['Andrew', 'Justin', 'Sean', 'Mitchell', 'Baker'];

/** A finished stroke-play round: five people, `extra[i]` strokes over par for player i. */
function round(id, day, extra, { crew = 'crew-1' } = {}) {
  const players = NAMES.map((n, i) => ({ id: `p${i + 1}`, personId: `person-${n.toLowerCase()}`, name: n, firstName: n }));
  const scores = [];
  players.forEach((p, i) => TC.par.forEach((par, h) => scores.push({ player_id: p.id, hole: h + 1, strokes: par + (h < extra[i] ? 1 : 0) })));
  return {
    event: { id, code: id.toUpperCase(), name: 'Round', played_on: day, created_at: `${day}T15:00:00Z`, finalized_at: `${day}T23:00:00Z`,
      course: TC, roster: { players }, settings: {}, crew_id: crew },
    scores,
  };
}
const R1 = round('ev1', '2026-11-07', [10, 4, 6, 6, 12]);
const R2 = round('ev2', '2026-11-20', [3, 7, 10, 10, 12]); // Andrew low
const ROWS = [R1, R2];
const ME = 'person-andrew';
const cards = (opened) => buildLocker(ROWS, ME, { today: TODAY, opens: opened.map((id) => ({ event_id: id, opened_at: '2026-11-21T00:00:00Z' })) });
const locker = (opened) => ({ cards: cards(opened), rows: ROWS, sub: '' });
const recentRound = (code, extra = {}) => ({ code, name: code, played_on: '2026-11-20', at: NOW - 86400000 * 5, ...extra });
const pass = (code, date, extra = {}) => recentRound(code, { played_on: date, lobby: {
  kind: 'coming', date, when: 'Sat Nov 28', host: 'Justin', startTime: '8:40', startsAt: Date.parse(`${date}T14:40:00Z`),
  course: 'Twin Creeks', game: '2v2', players: 8, onRoster: true, mate: 'Sean', ...extra } });
const CREWS = { list: [{ id: 'crew-1', name: 'Founders Crew' }], currentId: 'crew-1', name: 'Founders Crew', rounds: 5,
  standing: { place: '2nd', myRounds: 5, iLead: false, leader: 'Sean', next: null } };
const base = { now: NOW, today: TODAY, personId: ME, crews: CREWS, crewNames: { 'crew-1': 'Founders Crew' }, meName: 'Andrew', meFull: 'Andrew Duong' };
const line = (h, safari = false) => (safari ? h.safari : h.app).map((f) => f.b + f.g);


const keys = (m) => m.items.map((it) => it.key);

test('§4 the wallet order: next round → the newest pack → your cards newest first; member; none', () => {
  // A coming round, a sealed pack (ev2) and an opened card (ev1).
  let m = homeModel({ ...base, rounds: [pass('SAT', '2026-11-28')], locker: locker(['ev1']) });
  assert.deepEqual(keys(m), ['next:SAT', 'pack:EV2', 'card:EV1']);
  assert.equal(m.join, false);
  // Both opened: cards newest first, no pack.
  m = homeModel({ ...base, rounds: [], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual(keys(m), ['card:EV2', 'card:EV1']);
  // A live round goes in front of a coming one.
  const live = recentRound('LIVE', { live: { hole: 7, line: 'Up 2', card: { pk: 'cart', thru: 6, match: 'Up 2', mate: 'Sean', players: 8 } }, seen: NOW - 60000, course: 'Twin Creeks' });
  m = homeModel({ ...base, rounds: [live, pass('SAT', '2026-11-28')], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual(keys(m), ['next:LIVE', 'card:EV2', 'card:EV1']);
  assert.deepEqual(m.live, { code: 'LIVE', hole: 7, line: 'Up 2' });
  // Zero cards and a person: the paper member card (behind the next round if there is one).
  m = homeModel({ ...base, rounds: [pass('SAT', '2026-11-28')], locker: { cards: [], rows: [] } });
  assert.deepEqual(keys(m), ['next:SAT', 'member']);
  assert.equal(m.items[1].name, 'Andrew Duong');
  // No person: no wallet, the join field in its place.
  m = homeModel({ now: NOW, today: TODAY, rounds: [] });
  assert.deepEqual([m.items.length, m.join, m.headline.rung], [0, true, 'empty']);
  // Locker loading: a plain box behind the next round; failed after it once had cards: the offline box.
  assert.deepEqual(keys(homeModel({ ...base, rounds: [pass('SAT', '2026-11-28')], lockerState: 'loading' })), ['next:SAT', 'loading']);
  assert.deepEqual(keys(homeModel({ ...base, rounds: [], lockerState: 'failed', hadCards: true })), ['offline']);
  assert.equal(topKey(m.items[0]), null);
  assert.equal(topKey({ key: 'card:EV2' }), 'card:EV2');
  // walletItems alone: only the newest pack, with the count.
  const w = walletItems({ packs: [{ code: 'A' }, { code: 'B' }], opened: [] });
  assert.deepEqual(w.map((x) => [x.key, x.count]), [['pack:B', 2]]);
});

test('§4 the A3 fields: partners (Game · Cart · With) / none (Players · Partner on the tee) / live (Thru · Match · With)', () => {
  const p = (extra) => passOf(pass('SAT', '2026-11-26', extra), { now: NOW, today: TODAY });
  let n = nextFields({ pass: p({ pk: 'cart', cart: 'A', startTime: '8:40' }) });
  assert.deepEqual(n.fields, [['Game', 'Rider Cup'], ['Cart', 'A'], ['With', 'Sean']]);
  assert.deepEqual([n.big, n.dd, n.stamp, n.kicker, n.btn.label, n.btn.v, n.share], ['8:40', ['Thu', 'NOV 26'], 'Tomorrow', 'Next round', 'Open', '#/e/SAT', true]);
  // No partners drawn yet: Players + Partner "On the tee".
  n = nextFields({ pass: p({ pk: 'cart', mate: null, cart: null }) });
  assert.deepEqual(n.fields, [['Game', 'Rider Cup'], ['Players', '8'], ['Partner', 'On the tee']]);
  // A game without partners: who's in your tee time instead.
  n = nextFields({ pass: p({ pk: 'stroke', mate: null, with: 'Sean +2' }) });
  assert.deepEqual(n.fields, [['Game', 'Stroke'], ['Players', '8'], ['With', 'Sean +2']]);
  // Called off: greyed, Text the host, no share.
  n = nextFields({ pass: p({ kind: 'off' }) });
  assert.deepEqual([n.off, n.stamp, n.btn.act, n.btn.label, n.share], [true, 'Called off', 'home-text', 'Text Justin', false]);
  // Live: the hole huge, Thru · Match · With, Hole 7 ›, no share; no partner → Thru · Place · Players.
  const live = (card) => nextFields({ live: { code: 'LIVE', course: 'Twin Creeks', live: { hole: 7, card } } });
  n = live({ pk: 'cart', thru: 6, match: 'Up 2', mate: 'Sean', players: 8 });
  assert.deepEqual([n.big, n.dd, n.fields, n.btn.label, n.btn.v, n.share, n.stamp], ['7', ['Hole', 'of 18'], [['Thru', '6'], ['Match', 'Up 2'], ['With', 'Sean']], 'Hole 7 ›', '#/e/LIVE', false, 'Hole 7']);
  n = live({ pk: 'alone', thru: 6, place: '2nd', players: 4 });
  assert.deepEqual(n.fields, [['Thru', '6'], ['Place', '2nd'], ['Players', '4']]);
  // Every playFor key has a short game word and a phrase.
  for (const k of ['ryder', 'alone', 'stroke', 'partners', 'oneMatch', 'cart', 'legacy']) { assert.ok(GAME_SHORT[k], k); assert.ok(GAME_PHRASE[k], k); }
});

test('§4 the tee sheet (card back): tee times → carts (your row), names only before partners, long rosters cut', () => {
  const players = ['Andrew', 'Sean', 'Justin', 'Mitchell', 'Baker', 'Kyle', 'Sam', 'Jake'].map((n, i) => ({ id: `p${i + 1}`, name: n, firstName: n, groupId: i < 4 ? 'g1' : 'g2', teamId: 'ABCD'[Math.floor(i / 2)] }));
  const ev = { roster: { players, teams: ['A', 'B', 'C', 'D'].map((id) => ({ id })), groups: [{ id: 'g1' }, { id: 'g2' }] }, settings: { teeTimes: ['08:40', '08:50'] } };
  const t = teeSheet(ev, 'p1');
  assert.deepEqual(t.groups.map((g) => [g.time, g.label, g.rows.map((r) => `${r.id}:${r.names}${r.me ? '*' : ''}`)]),
    [['8:40', '1st tee time', ['A:Andrew · Sean*', 'B:Justin · Mitchell']], ['8:50', '2nd tee time', ['C:Baker · Kyle', 'D:Sam · Jake']]]);
  const none = teeSheet({ ...ev, roster: { ...ev.roster, players: players.map((p) => ({ ...p, teamId: null })) } }, 'p2');
  assert.deepEqual(none.groups[0].rows.map((r) => `${r.names}${r.me ? '*' : ''}`), ['Andrew', 'Sean*', 'Justin', 'Mitchell']);
  const cut = teeSheet({ ...ev, roster: { ...ev.roster, players: players.map((p) => ({ ...p, teamId: null })) } }, 'p2', { max: 6 });
  assert.deepEqual([cut.groups.map((g) => g.rows.length), cut.more], [[4, 2], 2]);
});

test('§4 isHub + the dock: Home · Rounds · Crew are hub roots; a round has its own bar; crossing rebuilds it', () => {
  assert.deepEqual(HUB_TABS.map((t) => t[0]), ['home', 'rounds', 'crew']);
  const R = { home: { name: 'home' }, locker: { name: 'locker', mode: 'mine' }, passport: { name: 'locker', mode: 'mine', tab: 'passport' },
    view: { name: 'locker', mode: 'view', person: 'x', tab: 'passport' }, admin: { name: 'locker', mode: 'admin' },
    season: { name: 'season', crew: null, view: null }, crew: { name: 'season', crew: 'c1', view: null }, past: { name: 'season', crew: 'c1', view: 'past' },
    setup: { name: 'setup' }, start: { name: 'crew', mode: 'start' }, enter: { name: 'enter', round: true, tab: 'enter', code: 'X' } };
  assert.deepEqual(Object.fromEntries(Object.entries(R).map(([k, r]) => [k, hubTab(r)])),
    { home: 'home', locker: 'rounds', passport: 'rounds', view: null, admin: null, season: 'crew', crew: 'crew', past: null, setup: null, start: null, enter: null });
  assert.equal(isHub(R.home), true); assert.equal(isHub(R.enter), false); assert.equal(isHub(R.setup), false);
  assert.equal(dockSet(R.home), 'hub'); assert.equal(dockSet(R.setup), null);
  assert.equal(dockSet(R.enter, { ready: true }), 'round');
  assert.equal(dockSet(R.enter, { ready: false }), null, 'a round still loading: no bar');
  assert.equal(dockSet(R.enter, { ready: true, inLobby: true }), null, 'a lobby: no bar');
  assert.equal(needsRebuild(undefined, 'hub'), true);
  assert.equal(needsRebuild('hub', 'hub'), false);
  assert.equal(needsRebuild('hub', 'round'), true, 'hub → round rebuilds the dock');
  assert.equal(needsRebuild('round', 'hub'), true, 'round → hub rebuilds the dock');
});

test('§1 the wallet fit + physics: full width at 7:5, 2 edges in the app / 1 in Safari, edges drop before 200 tall', () => {
  assert.deepEqual(walletFit(361, 600, 5, { app: true }), { K: 2, CW: 361, CH: 258, need: 24 + 258 + 96 });
  assert.deepEqual(walletFit(361, 600, 5, { app: false }).K, 1);
  assert.equal(walletFit(361, 600, 1, { app: true }).K, 0, 'one item: no edges');
  const tight = walletFit(361, 300, 5, { app: true });
  assert.ok(tight.K < 2 && tight.CH >= 200, `edges drop first (${JSON.stringify(tight)})`);
  assert.deepEqual(EDGES, { app: 2, safari: 1 });
  const g = { K: 2, CH: 258, yF: 104 };
  assert.deepEqual(poseOne(0, g), { y: 104, s: 1, o: 1, z: 50, lab: 0 });
  assert.equal(poseOne(1, g).y, 104 - 48); assert.equal(poseOne(1, g).lab, 1, 'behind = the flat plate');
  assert.ok(poseOne(-1, g).y > 104 + 258, 'pulled down = into the pocket');
  assert.equal(settleTo(0.4, 0, 5), 0); assert.equal(settleTo(0.4, 1, 5), 2, 'a fling carries on'); assert.equal(settleTo(3.9, 5, 5), 4);
  assert.ok(rubber(-1, 5) > -1 && rubber(5, 5) < 5, 'rubber band at both ends');
});

test('PLAN §4 set A: the ladder in plain full sentences (one copy table)', () => {
  const live = recentRound('LIVE', { live: { hole: 7, line: 'You’re up 2', card: { pk: 'ryder' } }, seen: NOW - 60000, course: 'Twin Creeks' });
  let m = homeModel({ ...base, rounds: [live], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.rung, m.headline.kicker, m.headline.text], ['live', 'LIVE · TWIN CREEKS', 'You’re playing the Team Ryder Cup.']);
  m = homeModel({ ...base, rounds: [pass('GONE', '2026-11-28', { kind: 'removed', sub: 'Sean' })], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.kicker, m.headline.text, m.headline.tap], ['SATURDAY · TWIN CREEKS', 'Justin gave your spot to Sean.', '#/e/GONE']);
  m = homeModel({ ...base, rounds: [pass('OFF', '2026-11-28', { kind: 'off' })], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.text, 'Justin called off Saturday’s round.');
  m = homeModel({ ...base, rounds: [pass('SAT', '2026-11-26')], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.rung, m.headline.kicker, m.headline.text], ['soon', 'NEXT ROUND · TWIN CREEKS', 'You’re riding with Sean.']);
  m = homeModel({ ...base, rounds: [pass('SAT', '2026-11-26', { onRoster: false, mate: null })], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.text, '8 players are in.');
  m = homeModel({ ...base, rounds: [], locker: locker(['ev1']) });
  assert.deepEqual([m.headline.rung, m.headline.text], ['pack', 'Your card from Friday is ready to open.']);
  m = homeModel({ ...base, rounds: [pass('LATER', '2026-12-04')], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.rung, m.headline.text], ['coming', 'You play in 9 days.']);
  m = homeModel({ ...base, rounds: [], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.rung, m.headline.kicker, m.headline.text], ['recent', 'LAST ROUND · TWIN CREEKS · FRI NOV 20', 'You had the low round of the group.']);
  m = homeModel({ ...base, today: '2026-12-10', now: Date.parse('2026-12-10T18:00:00Z'), rounds: [], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.rung, m.headline.kicker, m.headline.text], ['crew', 'FOUNDERS CREW', 'You’re 2nd in the standings.']);
  m = homeModel({ ...base, crews: null, today: '2026-12-10', now: Date.parse('2026-12-10T18:00:00Z'), rounds: [], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual([m.headline.rung, m.headline.kicker], ['older', 'LAST ROUND · 3 WEEKS AGO']);
  m = homeModel({ now: NOW, today: TODAY, rounds: [recentRound('X')] });
  assert.equal(m.headline.text, 'No finished rounds yet.');
  for (const k of Object.keys(COPY)) { assert.equal(typeof COPY[k].kicker, 'function', k); assert.equal(typeof COPY[k].text, 'function', k); }
});

test('PLAN §4 results: low round, a place out of what, you and your partner, a cup; the stored line without its score', () => {
  assert.deepEqual(resultOf(finishUnits(R2.event, R2.scores, ME), 'Andrew'), { kind: 'low', of: 5, unit: 'players' });
  const p4 = resultOf(finishUnits(R1.event, R1.scores, ME), 'Andrew');
  assert.equal(resultSentence(p4), 'You finished 4th of 5 players.');
  const team = { kind: 'team', players: 8, units: [{ rank: 1, names: ['Andrew', 'Sean'], me: true }, { rank: 2, names: ['Justin', 'Mitch'] }] };
  assert.equal(resultSentence(resultOf(team, 'Andrew')), 'You and Sean won.');
  const third = { kind: 'team', units: [{ rank: 1, names: ['A', 'B'] }, { rank: 2, names: ['C', 'D'] }, { rank: 3, names: ['Andrew', 'Sean'], me: true }, { rank: 4, names: ['E', 'F'] }] };
  assert.equal(resultSentence(resultOf(third, 'Andrew')), 'You and Sean finished 3rd of 4 carts.');
  const cup = { kind: 'ryder', units: [{ rank: 1, name: 'Jordans', value: '6½', me: true }, { rank: 2, name: 'Hogans', value: '5½' }] };
  assert.equal(resultSentence(resultOf(cup)), 'Your side won the cup, 6½–5½.');
  const lost = { kind: 'ryder', units: [{ rank: 1, name: 'Jordans', value: '6½' }, { rank: 2, name: 'Hogans', value: '5½', me: true }] };
  assert.equal(resultSentence(resultOf(lost)), 'Your side lost the cup, 5½–6½.');
  assert.deepEqual(lineResult('You 1st · 87'), { kind: 'line', line: 'You 1st' });
  assert.deepEqual(lineResult('You 2nd · net 71'), { kind: 'line', line: 'You 2nd' });
  assert.equal(lineResult('87'), null);
  const live = recentRound('L', { live: { hole: 3 }, seen: NOW - 1000 });
  assert.equal(allRounds([pass('C', '2026-12-04'), live], NOW).length, 1, 'the list leaves out the coming rounds (they are its Now rows)');
});

test('§7 Standings header: switcher with 2+ crews, Invite, Name your crew while unnamed', () => {
  const two = [{ id: 'a', name: 'Founders Crew' }, { id: 'b', name: null }];
  const h = standingsHeader({ list: two, id: 'b', name: null });
  assert.deepEqual(h.switcher, [{ id: 'a', name: 'Founders Crew', on: false }, { id: 'b', name: 'Your crew', on: true }]);
  assert.equal(h.invite, true); assert.equal(h.nameCrew, true);
  const one = standingsHeader({ list: [two[0]], id: 'a', name: 'Founders Crew' });
  assert.deepEqual([one.switcher, one.invite, one.nameCrew], [null, true, false]);
});

test('038 the card back’s Full board chip routes to the round and never flips the card', () => {
  const html = boardChip({ code: 'V4T3M' }, '<svg></svg>');
  assert.equal(boardHref({ code: 'V4T3M' }), '#/e/V4T3M');
  assert.match(html, new RegExp(`^<button [^>]*data-act="${BOARD_ACT}" data-v="#/e/V4T3M"`));
  // The app dispatches the closest [data-act]: the chip carries its own, never the card's flip (lk-card).
  assert.notEqual(BOARD_ACT, 'lk-card'); assert.doesNotMatch(html, /lk-card/);
  assert.equal(boardChip({}), '', 'no round code → no chip');
  assert.equal(boardHref({ code: '"><x' }), '#/e/x', 'the code is cleaned before it lands in markup');
});
