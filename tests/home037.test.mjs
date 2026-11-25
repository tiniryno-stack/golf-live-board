// 037 Home: the pure model (js/homeview.js) — §3.1's top rule, §3.3's rows, §3.4's crew block, §3.5's bar, §4's
// situations, and "How it finished" from a real round through the engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeModel, topOf, topKey, finishRows, finishUnits, crewModel, allRounds } from '../js/homeview.js';
import { buildLocker } from '../js/locker.js';
import { COURSES } from '../js/courses.js';

const NOW = Date.parse('2026-11-25T18:00:00Z');
const TC = COURSES.find((c) => /twin/i.test(c.id));
const NAMES = ['Andrew', 'Justin', 'Sean', 'Mitchell'];

/** A finished stroke-play round: four people, `extra[i]` strokes over par for player i (spread over the first holes). */
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
const R1 = round('ev1', '2026-11-07', [10, 4, 6, 6]);
const R2 = round('ev2', '2026-11-20', [3, 7, 10, 10]);
const ROWS = [R1, R2];
const ME = 'person-andrew';
const cards = (opened) => buildLocker(ROWS, ME, { today: '2026-11-25', opens: opened.map((id) => ({ event_id: id, opened_at: '2026-11-21T00:00:00Z' })) });
const recentRound = (code, extra = {}) => ({ code, name: code, played_on: '2026-11-20', at: NOW - 86400000 * 5, ...extra });
const CREWS = { list: [{ id: 'crew-1', name: 'Founders Crew' }], currentId: 'crew-1', name: 'Founders Crew', seasonLine: '', rounds: 5 };

test('§3.1 the top: pack beats card beats empty outline; nothing until the locker is ready', () => {
  assert.equal(topOf({ personId: ME, cards: null, hasRounds: true }), null, 'not loaded → nothing');
  assert.equal(topOf({ personId: null, cards: [], hasRounds: true }), null, 'no person → nothing');
  assert.equal(topOf({ personId: ME, cards: [], hasRounds: true }).kind, 'empty');
  const pack = topOf({ personId: ME, cards: cards(['ev1']), hasRounds: true });
  assert.equal(pack.kind, 'pack'); assert.equal(pack.card.eventId, 'ev2'); assert.equal(pack.count, 1);
  const card = topOf({ personId: ME, cards: cards(['ev1', 'ev2']), hasRounds: true });
  assert.equal(card.kind, 'card'); assert.equal(card.card.eventId, 'ev2', 'the latest card, not the best');
  assert.equal(topKey(card), 'card:EV2');
  assert.equal(topKey({ kind: 'empty' }), null);
});

test('§3.3 How it finished: the engine’s order, top three, you after a break, ties as T', () => {
  const fu = finishUnits(R2.event, R2.scores, ME);
  assert.deepEqual(fu.units.map((u) => [u.name, u.rank, u.value, u.me]),
    [['Andrew', 1, '75', true], ['Justin', 2, '79', false], ['Sean', 3, '82', false], ['Mitchell', 3, '82', false]]);
  assert.deepEqual(finishRows(fu.units).map((r) => r.pos), ['1', '2', 'T3', 'T3']);
  // 16 players, you 12th: top three, a break, your line.
  const big = Array.from({ length: 16 }, (_, i) => ({ unit: `p:${i}`, rank: i + 1, name: `P${i + 1}`, value: String(76 + i), me: i === 11 }));
  const rows = finishRows(big);
  assert.deepEqual(rows.map((r) => (r.gap ? '—' : r.pos)), ['1', '2', '3', '—', '12']);
  assert.equal(rows[4].me, true);
  // A team unit is one row with both names.
  assert.equal(finishRows([{ unit: 't:A', rank: 1, name: 'Andrew + Sean', value: '9½', me: true }, { unit: 't:B', rank: 2, name: 'Justin + Mitchell', value: '8½' }])[0].name, 'Andrew + Sean');
});

test('§3.4 the crew block: one crew, two crews, unnamed, none', () => {
  assert.deepEqual(crewModel({ list: [] }), { kind: 'none' });
  const one = crewModel(CREWS);
  assert.equal(one.kicker, 'Founders Crew'); assert.equal(one.sub, '5 rounds this season'); assert.equal(one.switcher, null);
  assert.equal(crewModel({ ...CREWS, seasonLine: 'Fall · you’re 2nd' }).sub, 'Fall · you’re 2nd');
  const two = crewModel({ ...CREWS, list: [...CREWS.list, { id: 'crew-2', name: 'Work guys' }] });
  assert.equal(two.kicker, 'Your crews · 2'); assert.deepEqual(two.switcher.map((x) => x.on), [true, false]);
  assert.equal(crewModel({ ...CREWS, name: null }).named, false);
});

test('§4 the seven situations', () => {
  const base = { now: NOW, personId: ME, crews: CREWS, crewNames: { 'crew-1': 'Founders Crew' } };
  const locker = (opened) => ({ cards: cards(opened), rows: ROWS, sub: '2 scorecards · 1 course' });
  // 1 · a normal day
  const m1 = homeModel({ ...base, rounds: [recentRound('EV2'), recentRound('EV1')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m1.top.kind, 'card'); assert.equal(m1.top.crewLine, 'Founders Crew · Andrew');
  assert.equal(m1.caption.sub, '2 scorecards · 1 course');
  assert.equal(m1.result.label, 'How it finished'); assert.equal(m1.result.code, 'EV2');
  assert.deepEqual(m1.endRows.allRounds, { count: 2, since: 'Nov 20' });
  assert.equal(m1.bar.kind, 'buttons'); assert.equal(m1.endRows.newRound, false);
  // 2 · pack to open
  const m2 = homeModel({ ...base, rounds: [recentRound('EV2')], locker: locker(['ev1']) });
  assert.equal(m2.top.kind, 'pack'); assert.equal(m2.caption.sub, '1 pack to open · 1 scorecard'); assert.equal(m2.result.code, 'EV2');
  // 3 · round coming up → "Last time out"
  const lobby = recentRound('LOBBY', { played_on: '2026-12-05', lobby: { kind: 'coming', when: 'Sat, Dec 5', line: '6 of 8 are in' } });
  const m3 = homeModel({ ...base, rounds: [lobby, recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m3.coming.length, 1); assert.equal(m3.result.label, 'Last time out · Nov 20');
  assert.equal(m3.endRows.allRounds.count, 1, 'Coming up is not an old round');
  // 4 · round on → the bar is the live round, New round / Join move to the end
  const live = recentRound('LIVE', { live: { hole: 7, line: 'You’re up 2' }, seen: NOW - 60000 });
  const m4 = homeModel({ ...base, rounds: [live, recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual(m4.bar, { kind: 'live', code: 'LIVE', hole: 7, line: 'You’re up 2' });
  assert.equal(m4.endRows.newRound, true); assert.equal(m4.endRows.join, true);
  assert.equal(m4.result.label, 'Last time out · Nov 20');
  const stale = homeModel({ ...base, rounds: [{ ...live, seen: NOW - 13 * 3600000, at: 0 }], locker: locker(['ev1', 'ev2']) });
  assert.equal(stale.bar.kind, 'buttons', 'last seen live 13 h ago → not playing now');
  // 6 · no card yet → the empty outline, no caption, no result; crew still there
  const m6 = homeModel({ ...base, personId: 'person-sam', rounds: [lobby], locker: { cards: [], rows: [], sub: '' } });
  assert.equal(m6.top.kind, 'empty'); assert.equal(m6.caption, null); assert.equal(m6.result, null); assert.equal(m6.crew.kind, 'crew');
  // the locker failed → Home still complete, just no top
  const mx = homeModel({ ...base, rounds: [recentRound('EV2')], locker: null });
  assert.equal(mx.top, null); assert.equal(mx.result, null); assert.equal(mx.bar.kind, 'buttons');
  // 7 · brand-new phone
  const m7 = homeModel({ now: NOW, rounds: [], crews: { list: [] }, ios: true, standalone: false });
  assert.equal(m7.brandNew, true); assert.equal(m7.bar.kind, 'new'); assert.equal(m7.crew.kind, 'none'); assert.equal(m7.endRows.addHome, true);
  assert.equal(homeModel({ now: NOW, rounds: [], ios: true, standalone: true }).endRows.addHome, false);
  assert.equal(allRounds([lobby, live], NOW).length, 1);
});
