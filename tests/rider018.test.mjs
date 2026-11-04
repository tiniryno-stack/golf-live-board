// 018: Partner “Rider” Cup on the Team Ryder Cup screens — the view adapter (no engine change).
import test from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../js/scoring.js';
import { riderState, isRider } from '../js/riderview.js';
import { makeEvent, scorebook, COURSE } from './helpers.mjs';

test('018 rider view: flags, kicker, hole dots and rotations from the existing match engine, cart colors kept', () => {
  const ev = makeEvent({ rotationMode: 'fixed' });
  const sb = scorebook();
  const par = (h) => COURSE.par[h - 1];
  // Hole 1: A's a1 birdies (A takes low ball and low total v B). C v D: only C is in.
  sb.post(1, { a1: par(1) - 1, a2: par(1), b1: par(1), b2: par(1), c1: par(1), c2: par(1) });
  const snap = compute(ev, sb.rows());
  assert.equal(isRider(snap), true);
  const st = riderState(snap, 'A');
  const ab = st.matches.find((m) => m.us.id === 'A' && m.rotation === 0);
  assert.deepEqual(ab.holePts, [2, 0]);
  assert.deepEqual(ab.flag, { look: 'up', side: 'us', text: '2 UP' });
  assert.equal(ab.kicker, "THRU 1 · YOU'RE UP 2");
  assert.equal(ab.us.color, 'var(--cart-you)');
  assert.equal(ab.them.color, 'var(--t-B)', 'other carts keep their colors');
  assert.equal(ab.holes[0].lowBall, 'us');
  assert.equal(ab.clinchAt, 6.5);
  assert.equal(ab.bonus, '+1 to the winner');
  const cd = st.matches.find((m) => m.us.id === 'C' && m.rotation === 0);
  assert.equal(cd.status, 'notStarted');
  assert.equal(cd.holes[0].whoIsIn, 'us', 'one cart in = hatched dot');
  assert.deepEqual(st.rotations.map((r) => r.status), ['live', 'future', 'future']);
  assert.equal(st.rotations[1].center, `vs ${ev.roster.teams.find((t) => t.id === 'C').name}`);
});
