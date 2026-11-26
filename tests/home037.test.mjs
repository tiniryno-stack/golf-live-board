// 037 Home, second pass (PLAN-v2.md; §0 wins): the pure model in js/homeview.js — the headline ladder (app + Safari
// forms per rung, one copy table), the stack (front order, edges per size), the crew slot, the nudge order, doors and
// foot, topKey kinds; Standings' header (§7) and 038's Full board chip on the card back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { homeModel, ladder, passOf, crewSlot, resultOf, finishUnits, lineResult, topKey, fitWidth, COPY, EDGES, allRounds } from '../js/homeview.js';
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

test('§5 the ladder: every rung, its kicker, its app form and its Safari form (one copy table)', () => {
  // 1 · live (bar-only; the headline names the round)
  const live = recentRound('LIVE', { live: { hole: 7, line: 'You’re up 2' }, seen: NOW - 60000, game: '2v2', course: 'Twin Creeks' });
  let m = homeModel({ ...base, rounds: [live, recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'live'); assert.equal(m.headline.kicker, 'On the course');
  assert.deepEqual(m.headline.app[0], { b: '2v2', g: ' at Twin Creeks.' }); assert.deepEqual(line(m.headline, true), ['2v2.']);
  // 2 · the front pass: your spot was given away · 3 · called off
  m = homeModel({ ...base, rounds: [pass('GONE', '2026-11-26', { kind: 'removed', sub: 'Kyle' })], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'removed'); assert.equal(m.headline.kicker, 'Needs you · THU'); assert.deepEqual(line(m.headline), ['Kyle has your spot.']);
  assert.equal(m.headline.tap, '#/e/GONE');
  m = homeModel({ ...base, rounds: [pass('OFF', '2026-11-28', { kind: 'off' })], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'off'); assert.equal(m.headline.kicker, 'Saturday');
  assert.deepEqual([line(m.headline)[0], line(m.headline, true)[0]], ['Justin called it off.', 'Justin cancelled.']);
  // 5 · a pass within 48 h: Riding with Sean; the roster form is the Safari fallback (§0 fix 4); a watcher gets it first
  m = homeModel({ ...base, rounds: [pass('SAT', '2026-11-26')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'soon'); assert.equal(m.headline.kicker, 'Next round');
  assert.deepEqual(line(m.headline, true), ['Riding with Sean.', '8 players in.']);
  m = homeModel({ ...base, rounds: [pass('SAT', '2026-11-26', { onRoster: false, mate: null })], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual(line(m.headline), ['8 players in.']);
  // 6 · a pack: the game result, never strokes
  m = homeModel({ ...base, rounds: [recentRound('EV2')], locker: locker(['ev1']) });
  assert.equal(m.headline.rung, 'pack'); assert.equal(m.headline.kicker, 'New pack');
  assert.deepEqual(m.headline.app[0], { b: 'Low round', g: ' of 5.' }); assert.deepEqual(line(m.headline, true), ['Low round.']);
  assert.ok(![...line(m.headline), ...line(m.headline, true)].some((s) => /\d{2}/.test(s)), 'no stroke total on a pack');
  // 7 · a round coming up (≤ 14 days), not within 48 h
  m = homeModel({ ...base, rounds: [pass('DEC', '2026-12-04'), recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'coming'); assert.deepEqual(line(m.headline), ['9 days out.']);
  // 8 · last out ≤ 7 days ago
  m = homeModel({ ...base, rounds: [recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'recent'); assert.equal(m.headline.kicker, 'Last out'); assert.deepEqual(m.headline.app[0], { b: 'Low round', g: ' of 5.' });
  // 9 · a dull week: your crew's leader (you lead → who's next), taps to Standings
  const later = { ...base, now: NOW + 10 * 86400000, today: '2026-12-05' };
  m = homeModel({ ...later, rounds: [recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'crew'); assert.equal(m.headline.kicker, 'Founders Crew'); assert.deepEqual(line(m.headline), ['Sean leads.']);
  assert.equal(m.headline.tap, '#/season/crew-1');
  m = homeModel({ ...later, crews: { ...CREWS, standing: { place: '1st', myRounds: 5, iLead: true, leader: 'Andrew', next: 'Sean' } }, rounds: [recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.deepEqual(line(m.headline), ['Sean is next.']);
  // 10 · older, not ranked anywhere
  m = homeModel({ ...later, crews: { list: [] }, rounds: [recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m.headline.rung, 'older'); assert.equal(m.headline.kicker, 'Last out · 2 weeks ago');
  // 11 · rounds, none finished · 12 · nothing on this phone
  m = homeModel({ ...base, personId: 'person-sam', meFull: 'Sam Lee', crews: { list: [] }, rounds: [recentRound('OPEN')], locker: { cards: [], rows: [] } });
  assert.equal(m.headline.rung, 'unfinished'); assert.deepEqual(line(m.headline), ['No rounds finished.']);
  m = homeModel({ now: NOW, today: TODAY });
  assert.equal(m.headline.rung, 'empty'); assert.deepEqual(m.headline.app[0], { b: 'Live scores', g: ' for your group.' }); assert.deepEqual(line(m.headline, true), ['Live scores.']);
  // Every rung has both forms in the one table; every Safari form is short (≤ 20 characters for these names).
  for (const k of Object.keys(COPY)) assert.equal(typeof COPY[k].safari, 'function', k);
});

test('§5 results: won with your partner, a place, a cup; the stored line without its score', () => {
  const fu = finishUnits(R2.event, R2.scores, ME);
  assert.deepEqual(resultOf(fu, 'Andrew'), { kind: 'low', of: 5 });
  assert.deepEqual(resultOf(finishUnits(R1.event, R1.scores, ME), 'Andrew'), { kind: 'place', place: '4th', of: 5 });
  const team = { kind: 'team', players: 8, units: [{ rank: 1, names: ['Andrew', 'Sean'], me: true }, { rank: 2, names: ['Justin', 'Mitch'] }] };
  assert.deepEqual(resultOf(team, 'Andrew'), { kind: 'won', mates: 'Sean', of: 2 });
  const cup = { kind: 'ryder', units: [{ rank: 1, name: 'Jordans', value: '6½' }, { rank: 2, name: 'Hogans', value: '5½' }] };
  const h = ladder({ live: null, front: { kind: 'pack' }, passes: [], newestPack: { code: 'X', eventId: 'x' }, opened: [], rounds: [], crews: null, today: TODAY, locker: null, rowOf: () => null });
  assert.equal(h.rung, 'empty', 'a pack whose round can’t be read (no row, no line) falls past the pack rung');
  assert.deepEqual(resultOf(cup), { kind: 'cup', side: 'Jordans', score: '6½–5½' });
  assert.deepEqual(lineResult('You 1st · 87'), { kind: 'line', line: 'You 1st' });
  assert.deepEqual(lineResult('You 2nd · net 71'), { kind: 'line', line: 'You 2nd' });
  assert.deepEqual(lineResult('Won with Sean'), { kind: 'line', line: 'Won with Sean' });
  assert.equal(lineResult('87'), null);
});

test('§6 the stack: front order, edges nearest first, edges per size (§0: 3 in the app, 1 in Safari, 0 with a pack / nudge / live)', () => {
  // A normal day: the latest card in front, older cards behind.
  const m1 = homeModel({ ...base, rounds: [recentRound('EV2'), recentRound('EV1')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m1.front.kind, 'card'); assert.equal(m1.front.card.eventId, 'ev2'); assert.equal(m1.front.crewLine, 'Founders Crew · Andrew');
  assert.deepEqual(m1.edges.map((e) => e.kind + ':' + e.card.eventId), ['card:ev1']);
  assert.equal(m1.edgeMax, EDGES.safari);
  assert.equal(homeModel({ ...base, standalone: true, rounds: [recentRound('EV2')], locker: locker(['ev1', 'ev2']) }).edgeMax, 3);
  // A pack in front: 0 edges in Safari, the cards behind it in the app.
  const m2 = homeModel({ ...base, rounds: [recentRound('EV2')], locker: locker(['ev1']) });
  assert.equal(m2.front.kind, 'pack'); assert.equal(m2.front.count, 1); assert.equal(m2.edgeMax, 0);
  assert.deepEqual(m2.edges.map((e) => e.kind), ['card']);
  // A pass within 48 h goes in front of the pack; the pack is the first edge, then the cards.
  const m3 = homeModel({ ...base, standalone: true, rounds: [pass('SAT', '2026-11-26'), recentRound('EV2')], locker: locker(['ev1']) });
  assert.equal(m3.front.kind, 'pass'); assert.equal(m3.front.pass.badge, 'Tomorrow'); assert.equal(m3.front.pass.day, 'THU 8:40');
  assert.deepEqual(m3.edges.map((e) => e.kind), ['pack', 'card']);
  // A later pass sits behind the pack: pack → that pass as an edge.
  const m4 = homeModel({ ...base, rounds: [pass('DEC', '2026-12-04'), recentRound('EV2')], locker: locker(['ev1']) });
  assert.equal(m4.front.kind, 'pack'); assert.equal(m4.edges[0].kind, 'pass');
  // Several passes: the soonest in front, the next as the first edge.
  const m5 = homeModel({ ...base, rounds: [pass('LATE', '2026-12-04'), pass('SOON', '2026-11-26')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m5.front.pass.code, 'SOON'); assert.equal(m5.edges[0].pass.code, 'LATE');
  // Live round: the stack is unchanged; 0 edges in Safari.
  const live = recentRound('LIVE', { live: { hole: 7 }, seen: NOW - 60000 });
  const m6 = homeModel({ ...base, rounds: [live, recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(m6.front.kind, 'card'); assert.equal(m6.edgeMax, 0);
  // Locker loading / failed with cards before / failed with none / no person.
  assert.equal(homeModel({ ...base, rounds: [recentRound('EV2')], lockerState: 'loading' }).front.kind, 'loading');
  assert.equal(homeModel({ ...base, rounds: [recentRound('EV2')], lockerState: 'failed', hadCards: true }).front.kind, 'offline');
  const mem = homeModel({ ...base, rounds: [recentRound('EV2')], lockerState: 'failed' });
  assert.deepEqual([mem.front.kind, mem.front.name, mem.front.line], ['member', 'Andrew Duong', 'No rounds yet']);
  const member = homeModel({ ...base, personId: 'person-sam', meFull: 'Sam Lee', crews: { list: [] }, rounds: [recentRound('OPEN')], locker: { cards: [], rows: [R2] } });
  assert.equal(member.front.kind, 'member'); assert.equal(member.front.line, 'No rounds yet', 'Sam is not on R2’s roster');
  const sean = homeModel({ ...base, personId: 'person-sean', meFull: 'Sean Smith', crews: { list: [] }, rounds: [recentRound('OPEN')], locker: { cards: [], rows: [R2] } });
  assert.equal(sean.front.line, 'First round Nov 2026');
  assert.equal(homeModel({ now: NOW, today: TODAY }).front.kind, 'blank');
  // topKey kinds
  assert.equal(topKey(m1.front), 'card:EV2'); assert.equal(topKey(m2.front), 'pack:EV2'); assert.equal(topKey(m3.front), 'pass:SAT');
  assert.equal(topKey(member.front), 'member'); assert.equal(topKey({ kind: 'blank' }), 'blank'); assert.equal(topKey({ kind: 'loading' }), null);
  // The measured fit's width rule: min(content, leftover × 7/5), never under 300.
  assert.equal(fitWidth(361, 300), 361); assert.equal(fitWidth(361, 240), 336); assert.equal(fitWidth(361, 100), 300);
  assert.equal(fitWidth(361, 100, { min: 336 }), 336);
});

test('§6.2 passes: day + badge, old entries fall back, called off / removed', () => {
  const p = passOf(pass('SAT', '2026-11-25'), { now: NOW, today: TODAY });
  assert.deepEqual([p.day, p.badge, p.due, p.game, p.course, p.host], ['WED 8:40', 'Today', true, '2v2', 'Twin Creeks', 'Justin']);
  const old = passOf({ code: 'OLD', name: 'Old', played_on: '2026-12-05', course: 'Firewheel', lobby: { kind: 'coming', when: 'Sat Dec 5', host: 'Andrew Duong' } }, { now: NOW, today: TODAY });
  assert.deepEqual([old.day, old.badge, old.course, old.host, old.due, old.onRoster], ['SAT DEC 5', null, 'Firewheel', 'Andrew', false, true]);
  assert.equal(passOf(pass('X', '2026-11-26', { kind: 'off' }), { now: NOW, today: TODAY }).badge, 'Called off');
  assert.equal(passOf(pass('X', '2026-11-26', { kind: 'removed' }), { now: NOW, today: TODAY }).badge, 'Spot given');
});

test('§7 the crew slot, §6.4 the join field, §4.2 the nudge order, §8 doors and foot', () => {
  // Crew row: ranked, not yet ranked, still loading, no crew, a crew with no rounds.
  assert.deepEqual(crewSlot(CREWS), { kind: 'crew', id: 'crew-1', name: 'Founders Crew', place: '2nd', sub: null });
  assert.equal(crewSlot({ ...CREWS, standing: { place: null, myRounds: 1 } }).sub, '1 of 3 rounds');
  assert.deepEqual(crewSlot({ ...CREWS, rounds: null, standing: null }), { kind: 'crew', id: 'crew-1', name: 'Founders Crew', place: null, sub: null });
  assert.deepEqual(crewSlot({ list: [] }), { kind: 'start' });
  assert.equal(crewSlot({ ...CREWS, rounds: 0 }), null);
  // Zero cards → the join field and New round only; in a crew with rounds → the crew row instead.
  const zero = homeModel({ ...base, crews: { list: [] }, rounds: [recentRound('OPEN')], locker: { cards: [], rows: [] } });
  assert.equal(zero.slot.kind, 'join'); assert.equal(zero.foot.kind, 'new');
  const zeroCrew = homeModel({ ...base, rounds: [recentRound('OPEN')], locker: { cards: [], rows: [] } });
  assert.equal(zeroCrew.slot.kind, 'crew'); assert.equal(zeroCrew.foot.kind, 'buttons');
  // Live: no crew row, the live bar.
  const live = recentRound('LIVE', { live: { hole: 7, line: 'Up 2' }, seen: NOW - 60000 });
  const ml = homeModel({ ...base, ios: true, rounds: [live, recentRound('EV2')], locker: locker(['ev1', 'ev2']) });
  assert.equal(ml.slot, null); assert.deepEqual(ml.foot, { kind: 'live', code: 'LIVE', hole: 7, line: 'Up 2' }); assert.equal(ml.nudge, null);
  const stale = homeModel({ ...base, rounds: [{ ...live, seen: NOW - 13 * 3600000, at: 0 }], locker: locker(['ev1', 'ev2']) });
  assert.equal(stale.foot.kind, 'buttons', 'last seen live 13 h ago → not playing now');
  // Nudge: Add to Home Screen first (iPhone Safari), then What's new; doors hidden while it shows.
  const news = { id: '2026-11-26', title: 'Cards, packs and a Passport', lines: [] };
  const r = [recentRound('EV2'), recentRound('EV1')];
  let m = homeModel({ ...base, ios: true, news, rounds: r, locker: locker(['ev1', 'ev2']) });
  assert.equal(m.nudge.kind, 'add'); assert.deepEqual(m.doors, { allRounds: false, addHome: false }); assert.equal(m.edgeMax, 0);
  m = homeModel({ ...base, ios: true, seen: { add: true }, news, rounds: r, locker: locker(['ev1', 'ev2']) });
  assert.equal(m.nudge.kind, 'news'); assert.equal(m.nudge.id, '2026-11-26');
  m = homeModel({ ...base, ios: true, seen: { add: true }, rounds: r, locker: locker(['ev1', 'ev2']) });
  assert.equal(m.nudge, null); assert.deepEqual(m.doors, { allRounds: true, addHome: true }, 'after its ✕, Add to Home Screen is a door');
  assert.equal(homeModel({ ...base, standalone: true, ios: true, rounds: r, locker: locker(['ev1', 'ev2']) }).nudge, null, 'never in the app');
  // Brand-new phone: rung 12, blank card, join field, New round only.
  const bn = homeModel({ now: NOW, today: TODAY, rounds: [], crews: { list: [] }, ios: true });
  assert.deepEqual([bn.brandNew, bn.front.kind, bn.slot.kind, bn.foot.kind, bn.nudge.kind], [true, 'blank', 'join', 'new', 'add']);
  assert.equal(allRounds([pass('C', '2026-12-04'), live], NOW).length, 1, 'All rounds leaves out the coming passes');
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
