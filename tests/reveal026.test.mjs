// 026: the invitation and the press-and-hold reveal — the pure parts (js/lobby.js): the hold, the phases, the words,
// the field rail and the invite's faces.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/lobby.js';

const FIRST = ['Andrew', 'Alex', 'Josh', 'Brandon', 'Ant', 'Steve', 'Joseph', 'Jay', 'Sean', 'Baker', 'Mitch', 'Peter', 'Kyle', 'Chuck', 'Elijah', 'Marcus'];
const HCP = [8, 15, 4, 10, 6, 12, 11, 9, 5, 12, 7, 20, 16, 18, 14, 13];
const roster = (hcp = HCP) => ({ players: FIRST.map((f, i) => ({ id: `p${i + 1}`, name: f, firstName: f, lastName: 'Test', strokes: hcp[i] })) });

test('holdStep: 1.4 s to fill while held, 0.4 s to drain, clamped, frame-rate independent', () => {
  assert.equal(L.holdStep(0, 700, true), 0.5);
  assert.equal(L.holdStep(0, 1400, true), 1);
  assert.equal(L.holdStep(0.9, 500, true), 1, 'never past full');
  assert.equal(L.holdStep(0.5, 200, false), 0);
  assert.equal(L.holdStep(1, 100, false), 0.75);
  assert.equal(L.holdStep(0.2, 1000, false), 0, 'never below empty');
  let v = 0; for (let i = 0; i < 84; i++) v = L.holdStep(v, 1400 / 84, true); // 60 fps
  let w = 0; for (let i = 0; i < 7; i++) w = L.holdStep(w, 200, true); // a stuttering 5 fps
  assert.ok(Math.abs(v - 1) < 1e-9 && Math.abs(w - 1) < 1e-9, 'a slow frame never changes the 1.4 s');
  assert.equal(L.holdStep(0.3, NaN, true), 0.3);
  assert.equal(L.holdStep(NaN, 700, true), 0.5);
  assert.equal(L.holdStep(0.3, -50, true), 0.3, 'a clock step back changes nothing');
});

test('revealPhase: idle → holding → freeze 150 ms → burst → final (900 ms later); Just show me skips the freeze; reduced = final', () => {
  assert.equal(L.revealPhase(null, 0), 'idle');
  assert.equal(L.revealPhase({ v: 0.4, holding: false }, 0), 'idle');
  assert.equal(L.revealPhase({ v: 0.4, holding: true }, 0), 'holding');
  const r = { doneAt: 1000 };
  assert.deepEqual([999, 1000, 1149, 1150, 2049, 2050].map((t) => L.revealPhase(r, t)), ['freeze', 'freeze', 'freeze', 'burst', 'burst', 'final']);
  const fast = { doneAt: 1000, fast: true };
  assert.deepEqual([1000, 1899, 1900].map((t) => L.revealPhase(fast, t)), ['burst', 'burst', 'final']);
  assert.equal(L.revealPhase(r, 1000, true), 'final');
  assert.deepEqual([L.landsAt(r), L.landsAt(fast), L.landsAt({ v: 1 })], [1150, 1000, null], 'seen is written when the number lands');
  const f = (ms) => L.finalFades(ms);
  assert.deepEqual(f(0), [0, 0, 0, 0]);
  assert.ok(f(300)[0] > f(300)[1] && f(300)[2] === 0, 'in order, 220 ms apart');
  assert.equal(f(1239)[3], 0, 'the button 800 ms after the note');
  assert.deepEqual(f(5000), [1, 1, 1, 1]);
  assert.deepEqual(L.finalFades(0, true), [1, 1, 1, 1]);
});

test('the words: strokes line (0, 1, 12, over 18), rank label with ties, the real date', () => {
  assert.equal(L.strokesLine(0), null);
  assert.equal(L.strokesLine(1), 'You get 1 stroke: on the hardest hole.');
  assert.equal(L.strokesLine(12), 'You get 12 strokes: one on each of the 12 hardest holes.');
  assert.equal(L.strokesLine(18), 'You get 18 strokes: one on each of the 18 hardest holes.');
  assert.equal(L.strokesLine(20), 'You get 20 strokes: one on every hole, two on the 2 hardest.');
  assert.equal(L.strokesLine(36), 'You get 36 strokes: two on every hole.');
  const r = roster();
  assert.equal(L.rankLabel(L.hcpOf(r, 'p10')), 'You · T9th of 16', 'Baker and Steve share 12');
  assert.equal(L.rankLabel(L.hcpOf(r, 'p3')), 'You · 1st of 16');
  assert.equal(L.rankLabel(L.hcpOf(roster(HCP.map((h, i) => (i === 5 ? 13.5 : h))), 'p10')), 'You · 9th of 16');
  assert.equal(L.rankLabel(null), '');
  assert.equal(L.inviteDate('2026-11-14'), 'Sat, Nov 14');
  assert.equal(L.ownRoundName({ name: 'Chuck’s Bday', course: { shortName: 'Twin Creeks' } }), 'Chuck’s Bday');
  assert.equal(L.ownRoundName({ name: 'Bridlewood · Sat, Nov 7', course: { shortName: 'Bridlewood' } }), '', 'Setup’s default name says nothing new');
});

test('fieldTicks: min → 0%, max → 100%, mine marked; a one-handicap field sits in the middle', () => {
  const t = L.fieldTicks(roster(), 'p10');
  assert.equal(t.ticks.length, 16);
  assert.deepEqual([t.min, t.max, t.mine], [4, 20, 50]);
  assert.equal(t.ticks.find((x) => x.me).pct, 50);
  assert.equal(Math.min(...t.ticks.map((x) => x.pct)), 0);
  assert.equal(Math.max(...t.ticks.map((x) => x.pct)), 100);
  assert.equal(t.ticks.filter((x) => x.me).length, 1);
  const same = L.fieldTicks(roster(HCP.map(() => 9)), 'p1');
  assert.ok(same.ticks.every((x) => x.pct === 50) && same.mine === 50);
  const alone = L.fieldTicks({ players: [{ id: 'p1', strokes: 7 }, { id: 'p2', strokes: null }] }, 'p1');
  assert.deepEqual([alone.ticks.length, alone.mine], [1, 50], 'a one-player field (the screen hides the rail)');
  assert.deepEqual(L.fieldTicks(roster(), 'p99').ticks.some((x) => x.me), false, 'not on the roster: no green tick');
});

test('inviteFaces: one per player, A–Z, filled = claimed (claimed_players), no names', () => {
  const r = roster();
  const f = L.inviteFaces(r, new Set(['p1', 'p10', 'p3']));
  assert.deepEqual([f.in, f.total], [3, 16]);
  assert.deepEqual(f.faces.slice(0, 4), [{ initial: 'A', in: false }, { initial: 'A', in: true }, { initial: 'A', in: false }, { initial: 'B', in: true }], 'Alex, Andrew, Ant, Baker');
  assert.ok(f.faces.every((x) => Object.keys(x).join() === 'initial,in'));
  assert.deepEqual(L.inviteFaces(r, ['p1']).in, 1, 'a plain list works too');
  assert.deepEqual(L.inviteFaces({ players: [] }), { faces: [], in: 0, total: 0 });
});
