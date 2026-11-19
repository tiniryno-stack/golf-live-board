// Brief 031: which Board / Matches a round gets (playFor, from settings rounds already store), the 2v2 match
// state read from your side, the place headline, and the race's one card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../js/scoring.js';
import { playFor, placeLine, stretchesWon } from '../js/playfor.js';
import { matchState } from '../js/riderview.js';
import { raceCard } from '../js/race.js';
import { makeEvent, scorebook } from './helpers.mjs';

const solo = (ids) => ids.map((id) => ({ id, personId: id, name: id.toUpperCase(), teamId: null, groupId: 'g1', strokes: null }));
const four = (settings) => { const ev = makeEvent(settings); ev.roster = { groups: [{ id: 'g1' }], teams: [], players: solo(['an', 'se', 'sa', 'ja']) }; return ev; };

test('031 playFor: every stored round gets its view; nothing stored changes', () => {
  assert.equal(playFor(compute(four({ pairs: true, pairSwitch: 'never' }), [])), 'oneMatch');
  assert.equal(playFor(compute(four({ pairs: true, pairSwitch: 'six' }), [])), 'partners');
  assert.equal(playFor(compute(four({ pairs: true, pairSwitch: 'turn' }), [])), 'partners');
  assert.equal(playFor(compute(four({ pairs: true }), [])), 'oneMatch', 'old 2v2 rounds without pairSwitch never switched');
  assert.equal(playFor(compute(makeEvent(), [])), 'cart', 'Partner “Rider” Cup, 8 players');
  const six = makeEvent({ rotationMode: 'fixed', rotation: [{ holes: [1, 18], matches: [['A', 'B'], ['A', 'C'], ['B', 'C']] }] });
  six.roster.teams = six.roster.teams.slice(0, 3);
  six.roster.players = six.roster.players.filter((p) => p.teamId !== 'D');
  assert.equal(playFor(compute(six, [])), 'cart', 'three carts for 6');
  assert.equal(playFor(compute(four({ solo: true }), [])), 'alone', 'split point');
  assert.equal(playFor(compute(four({}), [])), 'stroke', 'scorecard only');
  assert.equal(playFor({ settings: { ryder: true }, game: { sides: [] } }), 'ryder');

  // Partners switch: "us" is always your pairing, whichever stretch it is.
  const ev = four({ pairs: true, pairSwitch: 'six' });
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) sb.post(h, { an: 4, se: 4, sa: 5, ja: 5 });
  const snap = compute(ev, sb.rows());
  const st = matchState(snap, 'an');
  assert.deepEqual(st.matches.map((m) => m.us.names.includes('AN')), [true, true, true]);
  assert.deepEqual(st.matches[0].holePts, [12, 0]);
  assert.equal(st.matches[0].result, 'won');
  const won = stretchesWon(snap);
  assert.deepEqual([won.an, won.se, won.sa, won.ja], [1, 1, 0, 0]);

  const rows = [{ id: 'm', name: 'Mike + Tyler', rank: 1, value: 14 }, { id: 'c', name: 'Chris + Matt', rank: 2, value: 9 }, { id: 'a', name: 'Andrew + Sean', rank: 3, value: 8 }];
  assert.deepEqual(placeLine(rows, 'a'), { place: '3rd', detail: '6 back of Mike + Tyler' });
  assert.deepEqual(placeLine(rows, 'm'), { place: '1st', detail: '5 ahead of Chris + Matt' });
  assert.deepEqual(placeLine([{ id: 's', name: 'Sam', rank: 1, value: 1 }, { id: 'a', name: 'Andrew', rank: 3, value: 3 }, { id: 'x', name: 'Sean', rank: 3, value: 3 }], 'a', { ahead: (x, y) => y.value - x.value }), { place: 'T3', detail: '2 back of Sam' });
});

test('031 the race card: how it works, you need this one, the hole that decides it, clinched, else nothing', () => {
  const players = ['an', 'ch', 'ja', 'sa', 'se'].map((id) => ({ id, name: id === 'an' ? 'Andrew' : id === 'ch' ? 'Chris' : id === 'ja' ? 'Jake' : id === 'sa' ? 'Sam' : 'Sean' }));
  const ids = players.map((p) => p.id);
  const race = (winners) => Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    scores: i < winners.length ? Object.fromEntries(ids.map((id) => [id, id === winners[i] ? 3 : 4])) : {},
  }));
  const seq = (o) => Object.entries(o).flatMap(([id, n]) => Array(n).fill(id));
  const card = (o) => raceCard({ players, holes: race(seq(o)), me: 'an' });
  assert.equal(card({ se: 1 }).kind, 'how');
  assert.equal(card({ ch: 3, an: 2, ja: 2, sa: 1, se: 1 }), null, 'thru 9, nothing to decide');
  const need = card({ ch: 5, ja: 4, an: 2, sa: 2, se: 1 }); // thru 14: Chris winning 15 alone puts you out, Jake stays alive
  assert.deepEqual([need.kind, need.stake, need.kicker, need.title], ['need', true, 'Hole 15 · you need this one', 'Lose it to Chris and you’re out of reach.']);
  const dec = card({ ch: 6, an: 4, ja: 2, sa: 2, se: 1 }); // thru 15: Chris clinches by winning 16 alone
  assert.deepEqual([dec.kind, dec.kicker, dec.title, dec.sub], ['decides', 'Hole 16 decides it', 'Chris clinches by winning it alone.', 'Win or tie the hole and you’re still alive.']);
  const won = card({ an: 4, ja: 2, sa: 1, se: 1, ch: 8 }); // thru 16, Chris's run at the end clinched it on 16
  assert.deepEqual([won.kind, won.kicker, won.title, won.sub], ['clinched', 'Clinched on 16', 'Chris wins the day.', 'Two holes left. You’re playing for 2nd: 2 ahead of Jake.']);
});

test('031 Setup: games by player count (only what fits), the next step, default tee groups', async () => {
  const { gameChoices, gameNext, teeGroups, aloneIn, groupsFit } = await import('../js/playfor.js');
  const list = (n) => gameChoices(n).games.map((g) => `${g.name}${g.tag ? ` (${g.tag})` : ''}`).join(' · ');
  assert.equal(list(1), 'Stroke play');
  assert.equal(list(3), 'Everyone alone · Stroke play');
  assert.equal(list(4), '2v2 · Everyone alone · Stroke play');
  assert.equal(list(6), '2v2 (three carts) · Everyone alone · Stroke play');
  assert.equal(list(8), '2v2 · Stroke play');
  assert.equal(list(7), 'Stroke play');
  assert.equal(list(16), 'Team Ryder Cup · Stroke play');
  assert.deepEqual([4, 6, 8, 9, 2, 5].map((n) => gameChoices(n).shape), ['A foursome.', 'Three carts.', 'Two foursomes.', 'Three tee times.', 'A twosome.', 'Five in one group.']);
  assert.deepEqual(gameChoices(8).games.map((g) => g.id), ['carts', 'scorecard'], 'stored ids unchanged');
  assert.deepEqual(['2v2', 'carts', 'ryder', 'match', 'scorecard'].map((g) => gameNext(g).label), ['Next: partners', 'Next: carts', 'Next: carts', 'Next: tee times', 'Next: tee times']);
  assert.deepEqual(teeGroups(3, 'scorecard'), [[0, 1, 2]]);
  assert.deepEqual(teeGroups(6, 'match'), [[0, 1, 2, 3, 4, 5]], 'Everyone alone: 6 in one group is fine');
  assert.deepEqual(teeGroups(6, 'scorecard'), [[0, 1, 2], [3, 4, 5]]);
  assert.deepEqual(teeGroups(8, 'scorecard'), [[0, 1, 2, 3], [4, 5, 6, 7]]);
  assert.equal(teeGroups(8, 'carts'), null);
  assert.deepEqual(aloneIn([[0, 1, 2], [3], []]), [1]);
  assert.ok(groupsFit([[0, 2], [1], []], 3) && !groupsFit([[0, 1]], 3) && !groupsFit([[0, 0, 1]], 3));
});

test('031 step 3 (new rounds only): a hole is one point, stretches decide partner rounds, Same all 18 for 8; old rounds unchanged', async () => {
  const { sameOppsRotation } = await import('../js/scoring.js');
  const post = (ev, holes) => { const sb = scorebook(); for (const [h, sc] of holes) sb.post(h, sc); return compute(ev, sb.rows()); };
  // One match, 4 players: Andrew 3 / Sean 5 vs Sam 4 / Jake 4 → best ball 3 beats 4: one point. Old round: 2 points (LB 1 + LT push ½ ×2).
  const one = post(four({ pairs: true, pairSwitch: 'never', holePoint: true }), [[1, { an: 3, se: 5, sa: 4, ja: 4 }]]);
  const m = one.game.matches[0];
  assert.deepEqual([one.game.ncomp, m.points.AB, m.points.CD, one.game.bonus], [1, 1, 0, 0]);
  assert.equal(matchState(one, 'an').matches[0].clinchAt, 9.5, '9½ to win over 18');
  const old = post(four({ pairs: true, pairSwitch: 'never' }), [[1, { an: 3, se: 5, sa: 4, ja: 4 }]]);
  assert.deepEqual([old.game.ncomp, old.game.matches[0].points.AB], [2, 1.5], 'a round made before stays low ball + low total');

  // Partners every 6: Andrew + Sean win holes 1–6, every hole after is halved → stretches 2, 2, 1, 1 (½ for a halved one).
  const holes = [];
  for (let h = 1; h <= 18; h++) holes.push([h, h <= 6 ? { an: 3, se: 4, sa: 5, ja: 5 } : { an: 4, se: 4, sa: 4, ja: 4 }]);
  const p = post(four({ pairs: true, pairSwitch: 'six', holePoint: true, dayBy: 'stretches' }), holes);
  const by = (k) => Object.fromEntries(p.game.people.map((r) => [r.playerId, r[k]]));
  assert.deepEqual(by('won'), { an: 2, se: 2, sa: 1, ja: 1 });
  assert.deepEqual(by('points'), { an: 12, se: 12, sa: 6, ja: 6 });
  assert.deepEqual(by('rank'), { an: 1, se: 1, sa: 3, ja: 3 });
  // 8 players, same opponents all 18 → one match in each foursome; the Board shows one match each.
  const ev8 = makeEvent({ holePoint: true, rotationMode: 'fixed', rotation: sameOppsRotation() });
  const s8 = compute(ev8, []);
  assert.deepEqual([playFor(s8), s8.game.matches.length, s8.game.matches[0].total], ['oneMatch', 2, 18]);
});

test('028 Enter line on top: Everyone alone and Stroke play, leading, trailing and tied', async () => {
  const { enterLine } = await import('../js/playfor.js');
  const sb = scorebook();
  sb.post(1, { an: 4, se: 5, sa: 3, ja: 5 });
  sb.post(2, { an: 4, se: 4, sa: 5, ja: 4 });
  const alone = compute(four({ solo: true }), sb.rows()); // sa 1, an ⅓, se ⅓, ja ⅓
  assert.deepEqual(enterLine(alone, 'an'), { standing: '0.3 PTS · T2ND', context: 'SA +0.7', you: false });
  assert.deepEqual(enterLine(alone, 'sa'), { standing: '1 PTS · 1ST', context: '0.7 ahead of AN', you: true });
  const stroke = compute(four({}), sb.rows()); // par 4 + 4? to par from the test course
  const line = enterLine(stroke, 'an');
  assert.match(line.standing, /^(E|[+−]\d+) · T?\d+(ST|ND|RD|TH)$/);
  const lead = stroke.players.filter((p) => p.thru).sort((a, b) => a.grossToPar - b.grossToPar)[0];
  assert.equal(enterLine(stroke, lead.id).you, true);
  assert.equal(enterLine(compute(four({}), []), 'an'), null, 'nothing posted: no line');
});

test('029 lobby hero: days away, tomorrow, today (hours, minutes, 1 min, Now), no date', async () => {
  const { lobbyHero } = await import('../js/lobby.js');
  const tz = 'America/Chicago', course = 'Twin Creeks';
  const now = Date.parse('2026-11-18T14:00:00Z'); // Wed Nov 18, 8:00 in Chicago
  const h = (date, start, ms = now) => lobbyHero(ms, { date, start, tz, course });
  assert.deepEqual(h('2026-11-22', '08:40'), { kicker: 'Sunday · Nov 22 · Twin Creeks', hero: '8:40', sub: 'your start time · 4 days away', lit: false });
  assert.deepEqual(h('2026-11-19', '08:40'), { kicker: 'Tomorrow · Twin Creeks', hero: '8:40', sub: 'your start time, Thursday', lit: false });
  assert.deepEqual(h('2026-11-18', '10:10'), { kicker: 'Today · Twin Creeks', hero: '2h 10m', sub: 'to your 10:10 start time', lit: true });
  assert.equal(h('2026-11-18', '08:42').hero, '42 min');
  assert.equal(h('2026-11-18', '08:00', now - 30000).hero, '1 min');
  assert.equal(h('2026-11-18', '08:00').hero, 'Now');
  assert.equal(h(null, '08:40').nodate, true);
});
