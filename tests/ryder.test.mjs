// Team Ryder Cup (8v8 and smaller): side rollup + the 6½ clinch, a mid-round lineup change
// (holes before it keep their results), the game list, and the headlines (sides, not carts).
// Also the 2v2 headline fix (Nov 2 audit): board-level headlines rank people, not pairings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, gameFix, GAMES, ryderSetup, ryderCartIds, ryderFoursomes, sameFoursome, foursomeFor, normalizeSettings, matchSidePoints, sideOf } from '../js/scoring.js';
import { replayHeadlines } from '../js/headlines.js';
import { teamColor, headlineColor } from '../js/teams.js';
import { scorebook, COURSE } from './helpers.mjs';

const NAMES = ['Andrew', 'Alex', 'Ant', 'Steve', 'Justin', 'Chuck', 'Mitch', 'Peter', 'Sean', 'Baker', 'Josh', 'Brandon', 'Joseph', 'Jay', 'Elijah', 'Marcus'];

function ryderEvent(n = 16, extra = {}) {
  const players = NAMES.slice(0, n).map((name, i) => ({ id: `p${i + 1}`, personId: `person-${i}`, name, firstName: name, strokes: null }));
  const { roster, settings } = ryderSetup(players);
  return { id: 'ev-ryder', code: 'RYDER', course: { ...COURSE }, roster, settings: { ...normalizeSettings({}), ...settings, ...extra } };
}
const par = (h) => COURSE.par[h - 1];
/** Post a hole for every cart: `wins` = cart ids that take both points of their match (their partner pars, they birdie). */
function postHole(sb, ev, h, wins = []) {
  const out = {};
  for (const t of ev.roster.teams) {
    const ps = ev.roster.players.filter((p) => p.teamId === t.id);
    out[ps[0].id] = wins.includes(t.id) ? par(h) - 1 : par(h);
    out[ps[1].id] = par(h);
  }
  sb.post(h, out);
}

test('Team Ryder Cup: game list (16 only), carts per side, default sides and tee times', () => {
  assert.equal(gameFix('ryder', 16), null, '015 RULES §7: exactly 16');
  assert.equal(gameFix('ryder', 12), 'Add 4 more players to play this.');
  assert.equal(GAMES.find((g) => g.id === 'ryder').name, 'Team Ryder Cup');
  assert.deepEqual(ryderCartIds(16), ['1A', '2A', '1B', '2B', '1C', '2C', '1D', '2D']);
  assert.deepEqual(ryderCartIds(8), ['1A', '2A', '1B', '2B']);
  const ev = ryderEvent(16);
  assert.deepEqual(ev.roster.sides.map((s) => s.name), ['Team Andrew', 'Team Sean']);
  assert.deepEqual(ev.roster.sides[1].teamIds, ['2A', '2B', '2C', '2D']);
  assert.equal(ev.roster.teams.find((t) => t.id === '1C').name, 'Justin + Chuck');
  // Tee time 1 = Andrew + Alex and Sean + Baker; the roster says so with groupId.
  assert.equal(ev.roster.players.find((p) => p.name === 'Sean').groupId, 'g1');
  assert.equal(ev.roster.players.find((p) => p.name === 'Marcus').groupId, 'g4');
  assert.equal(sideOf('2C'), '2');
  assert.equal(teamColor('1A', '1A'), 'var(--cart-you)');
  assert.equal(teamColor('1A', '1B'), 'var(--text-muted)', 'own side neutral (015)');
  assert.equal(teamColor('1A', '2D'), 'var(--text-muted)', 'other side neutral (015)');
});

test('Team Ryder Cup: 12 matches, 1 point each to the side, 6½ wins; provisional until both foursomes finish', () => {
  const ev = ryderEvent(16);
  let snap = compute(ev, []);
  const g = snap.game;
  assert.equal(g.matches.length, 12);
  assert.deepEqual(g.rotations.map((r) => r.matches.map((m) => m.teams.join('v')).join(' ')), [
    '1Av2A 1Bv2B 1Cv2C 1Dv2D', '1Av2B 1Bv2C 1Cv2D 1Dv2A', '1Av2C 1Bv2D 1Cv2A 1Dv2B',
  ]);
  assert.equal(g.sides[0].toWin, 6.5);
  assert.equal(g.sides[0].left, 12);
  // Rotation 1: side 1 sweeps every hole in its 4 matches … but only the first tee time has played hole 1 so far.
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) postHole(sb, ev, h, ['1A', '1B', '1C', '1D']);
  snap = compute(ev, sb.rows());
  const s1 = snap.game.sides.find((s) => s.sideId === '1'), s2 = snap.game.sides.find((s) => s.sideId === '2');
  assert.equal(s1.points, 4);
  assert.equal(s1.officialPoints, 4, 'every foursome finished holes 1–6');
  assert.equal(s2.points, 0);
  assert.equal(s1.matchesWon, 4);
  assert.equal(s2.matchesLost, 4);
  assert.equal(s1.left, 8);
  assert.equal(s1.rank, 1);
  assert.equal(s1.clinched, false);
  // Rotation 2: side 2 wins 1Av2B? No: give side 1 three more wins, one halved → 7½ … clinched at 6½.
  for (let h = 7; h <= 12; h++) postHole(sb, ev, h, ['1A', '1B', '1C']); // 1D v 2A pushes every hole → halved
  snap = compute(ev, sb.rows());
  const t1 = snap.game.sides.find((s) => s.sideId === '1');
  assert.equal(t1.points, 7.5);
  assert.equal(t1.matchesHalved, 1);
  assert.equal(t1.clinched, true);
  assert.equal(snap.game.sides.find((s) => s.sideId === '2').points, 0.5);
  // Per-hole points decide matches only: the side total is match points, not 48.
  assert.ok(snap.game.liveStandings.find((x) => x.teamId === '1A').points > 10, 'carts still have their hole points for breakdowns');
  // Provisional: tee time 1 plays hole 13–18 ahead of everyone → 1A v 2C decided but not official.
  for (let h = 13; h <= 18; h++) {
    const ps = ev.roster.players.filter((p) => ['1A', '2C'].includes(p.teamId));
    const o = {};
    for (const p of ps) o[p.id] = p.teamId === '1A' && p.id === 'p1' ? par(h) - 1 : par(h);
    sb.post(h, o);
  }
  snap = compute(ev, sb.rows());
  const u1 = snap.game.sides.find((s) => s.sideId === '1');
  assert.equal(u1.points, 8.5);
  assert.equal(u1.officialPoints, 7.5);
  assert.equal(u1.provisionalPoints, 1);
  assert.equal(snap.officialThrough, 12);
  assert.equal(snap.roundComplete, false);
  assert.deepEqual(matchSidePoints(snap.game.matches[0]), { 1: 1, 2: 0 });
});

test('Team Ryder Cup: 8 players = 2 carts a side, 6 matches, 3½ wins; a 6–6 day is shared', () => {
  const ev = ryderEvent(8);
  let snap = compute(ev, []);
  assert.equal(snap.game.matches.length, 6);
  assert.equal(snap.game.sides[0].toWin, 3.5);
  assert.deepEqual(snap.game.rotations.map((r) => r.matches.map((m) => m.teams.join('v')).join(' ')), ['1Av2A 1Bv2B', '1Av2B 1Bv2A', '1Av2A 1Bv2B']);
  const sb = scorebook();
  for (let h = 1; h <= 18; h++) postHole(sb, ev, h, h <= 6 ? ['1A', '1B'] : h <= 12 ? ['2A', '2B'] : []);
  snap = compute(ev, sb.rows());
  assert.equal(snap.roundComplete, true);
  assert.deepEqual(snap.game.sides.map((s) => [s.sideId, s.points, s.rank, s.shared]), [['1', 3, 1, true], ['2', 3, 1, true]]);
});

test('Team Ryder Cup: a lineup change from hole 10 — holes before it keep their results, carts now ride together and play each other', () => {
  const ev = ryderEvent(16);
  const sb = scorebook();
  for (let h = 1; h <= 9; h++) postHole(sb, ev, h, ['1A', '1B', '1C', '1D']);
  const before = compute(ev, sb.rows());
  assert.equal(before.game.sides.find((s) => s.sideId === '1').points, 4);
  // Tee times 1 and 4 trade places at the turn: Andrew/Alex now ride with Elijah/Marcus (2D), Mitch/Peter with Sean/Baker (2A).
  const lineups = [{ fromHole: 10, foursomes: [['1A', '2D'], ['1B', '2C'], ['1C', '2B'], ['1D', '2A']] }];
  const ev2 = { ...ev, settings: { ...ev.settings, lineups } };
  const after = compute(ev2, sb.rows());
  // Matches: 1–6 (4), 7–9 (4, the planned rotation-2 opponents, ended early), 10–12 (4 new), 13–18 (4, same lineup held).
  assert.deepEqual(after.game.rotations.map((r) => `${r.from}–${r.to}`), ['1–6', '7–9', '10–12', '13–18']);
  assert.equal(after.game.matches.length, 16);
  assert.equal(after.game.sides[0].toWin, 8.5);
  const s1 = after.game.sides.find((s) => s.sideId === '1');
  assert.equal(s1.points, 8, 'rotation 1 wins + the cut-short 7–9 matches side 1 was winning');
  assert.deepEqual(after.game.rotations[2].matches.map((m) => m.teams.join('v')), ['1Av2D', '1Bv2C', '1Cv2B', '1Dv2A']);
  assert.deepEqual(after.game.rotations[3].matches.map((m) => m.teams.join('v')), ['1Av2D', '1Bv2C', '1Cv2B', '1Dv2A'], 'the lineup holds until the next one');
  // Who enters whose scores: hole 9 = tee times, hole 10 = the new lineup. Server mirror: _same_foursome.
  const pid = (name) => ev.roster.players.find((p) => p.name === name).id;
  assert.equal(sameFoursome(ev2.roster, ev2.settings, pid('Andrew'), pid('Sean'), 9), true);
  assert.equal(sameFoursome(ev2.roster, ev2.settings, pid('Andrew'), pid('Sean'), 10), false);
  assert.equal(sameFoursome(ev2.roster, ev2.settings, pid('Andrew'), pid('Marcus'), 10), true);
  assert.equal(sameFoursome(ev2.roster, ev2.settings, pid('Andrew'), pid('Alex'), 10), true, 'partners always');
  assert.deepEqual(foursomeFor(ev2.roster, ev2.settings, pid('Mitch'), 14).map((id) => ev.roster.players.find((p) => p.id === id).name), ['Mitch', 'Peter', 'Sean', 'Baker']);
  assert.deepEqual(ryderFoursomes(ev2.roster, normalizeSettings(ev2.settings), 3), [['1A', '2A'], ['1B', '2B'], ['1C', '2C'], ['1D', '2D']]);
  // A lineup that just makes the planned pairs physical doesn't split anything.
  const same = { ...ev, settings: { ...ev.settings, lineups: [{ fromHole: 10, foursomes: [['1A', '2B'], ['1B', '2C'], ['1C', '2D'], ['1D', '2A']] }] } };
  const s = compute(same, sb.rows());
  assert.deepEqual(s.game.rotations.map((r) => `${r.from}–${r.to}`), ['1–6', '7–12', '13–18']);
  assert.deepEqual(s.game.rotations[2].matches.map((m) => m.teams.join('v')), ['1Av2B', '1Bv2C', '1Cv2D', '1Dv2A'], 'rotation 3 repeats the lineup until the organizer sets the next one');
  assert.equal(normalizeSettings({ lineups: [{ fromHole: 'x' }, { fromHole: 13, foursomes: [['1A', '2A']] }] }).lineups.length, 1, 'junk lineups are dropped');
});

test('Team Ryder Cup headlines are about sides and matches, not carts', () => {
  const ev = ryderEvent(8);
  const sb = scorebook();
  // Rotation 1: side 1 takes both matches. Rotation 2: side 2 takes both → 2–2, then side 2 wins both in rotation 3.
  for (let h = 1; h <= 18; h++) postHole(sb, ev, h, h <= 6 ? ['1A', '1B'] : ['2A', '2B']);
  const hl = replayHeadlines(ev, sb.rows());
  const types = hl.map((h) => h.type);
  assert.ok(!types.includes('comeback'), 'no cart comebacks');
  const lc = hl.filter((h) => h.type === 'leadChange');
  assert.equal(lc.length, 1);
  assert.equal(lc[0].text, 'Team Justin take the lead 4–2', '8 players: side 2 starts at Justin');
  assert.equal(lc[0].hole, 18);
  assert.equal(lc[0].unit, 'sides');
  assert.equal(headlineColor('1A', lc[0]), 'var(--text-muted)', 'side 2 neutral (015)');
  const cl = hl.find((h) => h.type === 'cupClinched');
  assert.equal(cl, undefined, '4–2 at the very end = the final says it');
  const fin = hl.find((h) => h.type === 'roundFinal');
  assert.equal(fin.text, 'Final: Team Justin win 4–2');
  assert.equal(fin.hero, '2');
  const mf = hl.find((h) => h.type === 'matchupFinal');
  assert.match(mf.text, /^Andrew \+ Alex beat Justin \+ Chuck 12–0$/);
  // Clinch the cup early: side 1 wins the first 4 matches of 6 (3½ wins).
  const sb2 = scorebook();
  const ev16 = ryderEvent(16);
  for (let h = 1; h <= 12; h++) postHole(sb2, ev16, h, ['1A', '1B', '1C', '1D']);
  const hl2 = replayHeadlines(ev16, sb2.rows());
  const cup = hl2.find((h) => h.type === 'cupClinched');
  assert.equal(cup.text, 'Team Andrew clinch the cup — 8–0 with 4 matches left');
  assert.equal(cup.primary, true);
});

// ───────────────────────────────────────────── 2v2 (Nov 2 audit, round BSZTH)

/** 4 players, partners switch every 6: six pairings over the day. Board headlines must rank PEOPLE. */
function twoVtwo() {
  const players = [['an', 'Andrew'], ['al', 'Alex'], ['ju', 'Justin'], ['se', 'Sean']].map(([id, name]) => ({ id, personId: id, name, teamId: null, groupId: 'g1', strokes: null }));
  return { id: 'ev-2v2', code: 'BSZTH', course: { ...COURSE }, roster: { groups: [{ id: 'g1' }], teams: [], players }, settings: { ...normalizeSettings({}), pairs: true, pairSwitch: 'six', rotationMode: 'fixed' } };
}

test('2v2 headlines: lead change, comeback and the final rank players, never a pairing from a finished rotation', () => {
  const ev = twoVtwo();
  const sb = scorebook();
  // Holes 1–6 (Andrew+Alex v Justin+Sean): Andrew's side sweeps → AB 12, CD 0 (+1 bonus).
  for (let h = 1; h <= 6; h++) sb.post(h, { an: par(h) - 1, al: par(h), ju: par(h), se: par(h) });
  // Holes 7–12 (Andrew+Justin v Alex+Sean): Justin birdies every hole → Andrew + Justin sweep.
  for (let h = 7; h <= 12; h++) sb.post(h, { an: par(h), al: par(h), ju: par(h) - 1, se: par(h) });
  let hl = replayHeadlines(ev, sb.rows());
  // Nobody "cut the gap to Justin + Sean": that pairing is done. People: Andrew 26, Justin 13, Alex 13, Sean 0.
  assert.ok(!hl.some((h) => h.type === 'comeback' && /\+/.test(h.text)), `comebacks name people, got: ${hl.filter((h) => h.type === 'comeback').map((h) => h.text).join(' | ')}`);
  assert.ok(hl.every((h) => h.type !== 'leadChange' || h.unit === 'people'));
  // Holes 13–18 (Andrew+Sean v Alex+Justin): Alex and Justin sweep → Justin catches Andrew.
  for (let h = 13; h <= 18; h++) sb.post(h, { an: par(h), al: par(h) - 1, ju: par(h) - 1, se: par(h) });
  hl = replayHeadlines(ev, sb.rows());
  const snap = compute(ev, sb.rows());
  const pts = Object.fromEntries(snap.game.people.map((r) => [r.playerId, r.points]));
  assert.deepEqual(pts, { an: 26, ju: 26, al: 26, se: 0 }, 'three-way tie at the top (13 a rotation: 12 + 1 bonus)');
  const fin = hl.find((h) => h.type === 'roundFinal');
  assert.equal(fin.text, 'Final: Alex and Andrew and Justin share the day at 26');
  assert.equal(fin.hero, null);
  assert.equal(fin.unit, 'people');
  const cb = hl.find((h) => h.type === 'comeback');
  if (cb) assert.match(cb.text, /^(Alex|Justin|Sean|Andrew) is coming back/);
  assert.equal(headlineColor('AB', { hero: 'an', unit: 'people' }, 'an'), 'var(--cart-you)');
  assert.equal(headlineColor('AB', { hero: 'ju', unit: 'people' }, 'an'), 'var(--t-B)');
});

test('2v2 final: one player on top wins the day with their summed points', () => {
  const ev = twoVtwo();
  const sb = scorebook();
  for (let h = 1; h <= 18; h++) sb.post(h, { an: par(h) - 1, al: par(h), ju: par(h), se: par(h) }); // Andrew birdies all day
  const hl = replayHeadlines(ev, sb.rows());
  assert.equal(hl.find((h) => h.type === 'roundFinal').text, 'Final: Andrew wins the day with 39');
  assert.equal(hl.find((h) => h.type === 'roundFinal').hero, 'an');
  const lc = hl.filter((h) => h.type === 'leadChange');
  assert.equal(lc.length, 0, 'Andrew led all day');
});
