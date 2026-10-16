// node --test tests/
// Scripted scenarios for 7.10: official-line lead change, comeback, matchup
// comeback, streak, clinch, final, and the Lock in / Close it out alerts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../js/scoring.js';
import { latestMoment, replayHeadlines, matchupAlert } from '../js/headlines.js';
import { makeEvent, scorebook, COURSE } from './helpers.mjs';

const par = (h) => COURSE.par[h - 1];

/** Team scores on a hole: 'sweep' = LB par−1 / LT 2par−1, 'lose' = par / par+1, 'even' = par / par. */
function teamScores(team, kind, h) {
  const p = par(h);
  const [x, y] = kind === 'win' ? [p - 1, p] : kind === 'lose' ? [p, p + 1] : [p, p];
  return { [`${team}1`]: x, [`${team}2`]: y };
}
function hole(sb, h, results) {
  // results: { a: 'win' | 'lose' | 'even', ... } — posted in the order given
  for (const [team, kind] of Object.entries(results)) sb.post(h, teamScores(team, kind, h));
  return sb;
}

test('lead change fires only when the trailing foursome finishes the hole', () => {
  const ev = makeEvent();
  const sb = scorebook();
  hole(sb, 1, { a: 'lose', b: 'win', c: 'even', d: 'even' }); // B leads after 1
  for (let h = 2; h <= 6; h++) hole(sb, h, { a: 'even', b: 'even', c: 'even', d: 'even' });
  // After 6: A 5, B 7, C 6, D 6. Rotation 2: A v C, B v D.
  // B/D's foursome plays 7 first: D sweeps B → D 8, B 7 (provisional).
  hole(sb, 7, { b: 'lose', d: 'win' });
  let hl = replayHeadlines(ev, sb.rows());
  assert.equal(hl.filter((h) => h.type === 'leadChange').length, 0, 'no lead change on provisional points');
  // A/C finish 7 → official line moves to 7 → Bogey Boys lead.
  hole(sb, 7, { a: 'even', c: 'even' });
  hl = replayHeadlines(ev, sb.rows());
  const lc = hl.filter((h) => h.type === 'leadChange');
  assert.equal(lc.length, 1);
  assert.equal(lc[0].text, 'Bogey Boys takes the lead');
  assert.equal(lc[0].hole, 7);
  assert.equal(lc[0].primary, true);
  const lastRow = sb.rows().sort((a, b) => a.updated_at.localeCompare(b.updated_at)).at(-1);
  assert.equal(lc[0].at, lastRow.updated_at, 'stamped with the score that made it official');
});

test('ties never count as a lead change', () => {
  const ev = makeEvent();
  const sb = scorebook();
  hole(sb, 1, { a: 'win', b: 'lose', c: 'even', d: 'even' }); // A 2, C 1, D 1, B 0
  hole(sb, 2, { a: 'lose', b: 'win', c: 'even', d: 'even' }); // A 2, B 2, C 2, D 2 — all tied
  const hl = replayHeadlines(ev, sb.rows());
  assert.equal(hl.filter((h) => h.type === 'leadChange').length, 0);
});

// Rotation 1: A sweeps B every hole; C sweeps D on 1–2 then halves.
// After 6: A 12, C 8, D 4, B 0. Rotation 2 (A v C): C sweeps 7, takes 1½ on 8.
function comebackRound() {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 6; h++) {
    hole(sb, h, { a: 'win', b: 'lose' });
    hole(sb, h, h <= 2 ? { c: 'win', d: 'lose' } : { c: 'even', d: 'even' });
  }
  // Hole 7 (par 3): C 2+3 vs A 3+3 → C sweeps. B v D halved.
  sb.post(7, { a1: 3, a2: 3, c1: 2, c2: 3 });
  hole(sb, 7, { b: 'even', d: 'even' });
  // Hole 8 (par 4): C 3+5 (LB 3, LT 8) vs A 4+4 (LB 4, LT 8) → C 1½, A ½.
  sb.post(8, { a1: 4, a2: 4, c1: 3, c2: 5 });
  return { ev, sb };
}

test('comeback: cut the gap to the team ahead by 3+ within 4 holes, now 2 or less', () => {
  const { ev, sb } = comebackRound();
  let hl = replayHeadlines(ev, sb.rows());
  assert.equal(hl.filter((h) => h.type === 'comeback').length, 0, 'not yet: B/D haven’t finished 8');
  hole(sb, 8, { b: 'even', d: 'even' });
  hl = replayHeadlines(ev, sb.rows());
  const cb = hl.filter((h) => h.type === 'comeback');
  assert.equal(cb.length, 1);
  assert.equal(cb[0].text, 'Fore Play is coming back — cut the lead from 4 to 1');
  assert.equal(cb[0].hole, 8);
  assert.deepEqual(cb[0].teams, ['C', 'A']);
});

test('streak: sweeps 3 straight, fires again at 5 and at 6 (a perfect rotation)', () => {
  const { ev, sb } = comebackRound();
  const streaks = replayHeadlines(ev, sb.rows()).filter((h) => h.type === 'streak' && h.teams[0] === 'A');
  assert.deepEqual(streaks.map((s) => s.text), [
    'Hogan’s Heroes swept 3 straight',
    'Hogan’s Heroes swept 5 straight',
    'Hogan’s Heroes swept 6 straight — a perfect rotation',
  ]);
});

test('matchup clinched and matchup final', () => {
  const { ev, sb } = comebackRound();
  const hl = replayHeadlines(ev, sb.rows());
  const cl = hl.find((h) => h.type === 'matchupClinched' && h.teams[0] === 'A');
  assert.equal(cl.text, 'Hogan’s Heroes clinched vs Shank Redemption with 2 holes to play');
  assert.equal(cl.hole, 'r1m1');
  const fin = hl.find((h) => h.type === 'matchupFinal' && h.teams.includes('A') && h.teams.includes('B'));
  assert.equal(fin.text, 'Hogan’s Heroes beat Shank Redemption 12–0');
  // The streak and the clinch don't both banner for A on the same hole.
  const ids = new Set();
  for (const h of hl.filter((x) => x.primary)) {
    for (const t of h.teams) {
      const key = `${t}@${h.at}`;
      assert.equal(ids.has(key), false, `two banners for ${t} at once`);
      ids.add(key);
    }
  }
});

test('matchup comeback: down 3, draws level or goes ahead', () => {
  const ev = makeEvent();
  const sb = scorebook();
  hole(sb, 1, { a: 'win', b: 'lose', c: 'even', d: 'even' }); // A 2–0
  sb.post(2, { a1: 3, a2: 5, b1: 4, b2: 4 }); // LB A, LT halved → A 1½, B ½ → 3½–½
  hole(sb, 2, { c: 'even', d: 'even' });
  hole(sb, 3, { a: 'lose', b: 'win', c: 'even', d: 'even' }); // 3½–2½
  hole(sb, 4, { a: 'lose', b: 'win', c: 'even', d: 'even' }); // 3½–4½ → B ahead
  const mc = replayHeadlines(ev, sb.rows()).filter((h) => h.type === 'matchupComeback');
  assert.equal(mc.length, 1);
  assert.equal(mc[0].text, 'Shank Redemption erased a 3-point hole vs Hogan’s Heroes');
  assert.equal(mc[0].hero, 'B', 'the comeback wears the jersey of the team that came back');
  hole(sb, 5, { a: 'even', b: 'even', c: 'even', d: 'even' });
  hole(sb, 6, { a: 'even', b: 'even', c: 'even', d: 'even' });
  const fin = replayHeadlines(ev, sb.rows()).find((h) => h.type === 'matchupFinal' && h.teams.includes('A') && h.teams.includes('B'));
  assert.match(fin.text, /^Shank Redemption beat Hogan’s Heroes/);
  assert.equal(fin.hero, 'B', 'matchup final: the winner, even when listed second');
  const halved = replayHeadlines(ev, sb.rows()).find((h) => h.type === 'matchupFinal' && h.teams.includes('C'));
  assert.match(halved.text, /halved/);
  assert.equal(halved.hero, null, 'a halved matchup has no hero');
});

test('round final names the winner', () => {
  const ev = makeEvent();
  const sb = scorebook();
  for (let h = 1; h <= 18; h++) {
    const r = { a: 'win', b: 'even', c: 'even', d: 'even' };
    // A's opponent each rotation loses; everyone else halves.
    const opp = h <= 6 ? 'b' : h <= 12 ? 'c' : 'd';
    r[opp] = 'lose';
    hole(sb, h, r);
  }
  const hl = replayHeadlines(ev, sb.rows());
  const fin = hl.find((h) => h.type === 'roundFinal');
  assert.equal(fin.text, 'Final: Hogan’s Heroes win the day with 39'); // 36 + 3 matchup wins
  assert.equal(fin.primary, true);
  assert.equal(fin.hero, 'A');
  // The newest moment: everything the last score produced, most important first.
  const now = latestMoment(hl);
  assert.equal(now[0].type, 'roundFinal');
  assert.ok(now.length >= 2, `hole 18 also finishes a matchup (${now.map((h) => h.type).join(', ')})`);
  assert.ok(now.every((h) => h.primary && h.at === fin.at));
});

test('replay is deterministic regardless of row order', () => {
  const { ev, sb } = comebackRound();
  const rows = sb.rows();
  const a = replayHeadlines(ev, rows).map((h) => h.id);
  const b = replayHeadlines(ev, [...rows].reverse()).map((h) => h.id);
  assert.deepEqual(a, b);
});

// ───────────────────────────────────────────── Lock in / Close it out

function matchState(holes) {
  // holes: array of [aKind] for A v B on holes 1..n ('win' | 'lose' | 'even' | 'aHalfB' (A ½, B 1½))
  const ev = makeEvent();
  const sb = scorebook();
  holes.forEach((k, i) => {
    const h = i + 1;
    if (k === 'bOneHalf') sb.post(h, { a1: par(h), a2: par(h) + 2, b1: par(h), b2: par(h) + 1 }); // LB halved, B LT
    else hole(sb, h, { a: k, b: k === 'win' ? 'lose' : k === 'lose' ? 'win' : 'even' });
  });
  return compute(ev, sb.rows());
}

test('Lock in: down 4 with 2 holes left → win out to halve', () => {
  const snap = matchState(['lose', 'lose', 'even', 'even']); // A 2, B 6
  const a = matchupAlert(snap, 'A', 5);
  assert.equal(a.kind, 'lockIn');
  assert.equal(a.text, 'Lock in — win out to halve: you need all 4 points left');
});

test('Lock in: down 3 with 2 holes left → need 3½ of the last 4', () => {
  const snap = matchState(['bOneHalf', 'lose', 'even', 'even']); // A 2½, B 5½
  const a = matchupAlert(snap, 'A', 5);
  assert.equal(a.kind, 'lockIn');
  assert.equal(a.text, 'Lock in — you need 3½ of the last 4 points to halve, all 4 to win');
});

test('Close it out: up 3 with 3 holes left → sweep this hole to clinch', () => {
  const snap = matchState(['bOneHalf', 'lose', 'even']); // B 4½, A 1½
  const b = matchupAlert(snap, 'B', 4);
  assert.equal(b.kind, 'closeItOut');
  assert.equal(b.text, 'Close it out — sweep this hole to clinch');
  assert.equal(matchupAlert(snap, 'A', 4), null, 'down 3 with 6 left is not a Lock in yet');
});

test('Close it out: up 2 with 2 holes left → take 1½ on this hole', () => {
  const snap = matchState(['lose', 'even', 'even', 'even']); // B 5, A 3
  assert.equal(matchupAlert(snap, 'B', 5).text, 'Close it out — take 1½ on this hole to clinch');
});

test('alerts stop once a matchup is clinched, and never fire when level', () => {
  const clinched = matchState(['lose', 'lose', 'lose', 'lose']); // B 8, A 0, 4 left
  assert.equal(matchupAlert(clinched, 'A', 5), null);
  assert.equal(matchupAlert(clinched, 'B', 5), null);
  const level = matchState(['even', 'even', 'even', 'even']);
  assert.equal(matchupAlert(level, 'A', 5), null);
});

test('alerts are Match Play only', () => {
  const ev = makeEvent({ game: 'rotationPlusMinus' });
  const sb = scorebook();
  hole(sb, 1, { a: 'lose', b: 'win' });
  assert.equal(matchupAlert(compute(ev, sb.rows()), 'A', 2), null);
});

// ───────────────────────────────────────────── starting on the back nine

test('start on 10: lead change still waits for the trailing foursome (hole 16 = 2nd matchup)', () => {
  const ev = makeEvent({ startHole: 10 });
  const sb = scorebook();
  hole(sb, 10, { a: 'lose', b: 'win', c: 'even', d: 'even' });
  for (const h of [11, 12, 13, 14, 15]) hole(sb, h, { a: 'even', b: 'even', c: 'even', d: 'even' });
  hole(sb, 16, { b: 'lose', d: 'win' }); // B v D foursome first
  assert.equal(replayHeadlines(ev, sb.rows()).filter((h) => h.type === 'leadChange').length, 0);
  hole(sb, 16, { a: 'even', c: 'even' });
  const lc = replayHeadlines(ev, sb.rows()).filter((h) => h.type === 'leadChange');
  assert.equal(lc.length, 1);
  assert.equal(lc[0].text, 'Bogey Boys takes the lead');
});

test('start on 10: Lock in uses the matchup played 10–15', () => {
  const ev = makeEvent({ startHole: 10 });
  const sb = scorebook();
  hole(sb, 10, { a: 'lose', b: 'win' });
  hole(sb, 11, { a: 'lose', b: 'win' });
  hole(sb, 12, { a: 'even', b: 'even' });
  hole(sb, 13, { a: 'even', b: 'even' }); // A 2, B 6, two holes left (14, 15)
  const a = matchupAlert(compute(ev, sb.rows()), 'A', 14);
  assert.equal(a.text, 'Lock in — win out to halve: you need all 4 points left');
});
