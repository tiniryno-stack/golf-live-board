// Test fixtures: an 8-player, 4-cart round at Twin Creeks, and a score builder
// that stamps rows with increasing updated_at so replays are deterministic.
import { COURSES } from '../js/courses.js';
import { DEFAULT_SETTINGS } from '../js/scoring.js';

export const COURSE = COURSES[0];

export function makeEvent(overrides = {}) {
  const players = [
    ['a1', 'A'], ['a2', 'A'], ['b1', 'B'], ['b2', 'B'],
    ['c1', 'C'], ['c2', 'C'], ['d1', 'D'], ['d2', 'D'],
  ].map(([id, teamId]) => ({
    id, personId: `person-${id}`, name: id.toUpperCase(), teamId,
    groupId: teamId === 'A' || teamId === 'B' ? 'g1' : 'g2', strokes: null,
  }));
  return {
    id: 'ev1',
    code: 'TEST1',
    course: { ...COURSE },
    roster: {
      groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }],
      teams: [
        { id: 'A', name: 'Hogan’s Heroes' }, { id: 'B', name: 'Shank Redemption' },
        { id: 'C', name: 'Fore Play' }, { id: 'D', name: 'Bogey Boys' },
      ],
      players,
    },
    settings: { ...DEFAULT_SETTINGS, ...overrides },
  };
}

/** Collects score rows; each post() stamps a later updated_at than the last. */
export function scorebook() {
  const rows = new Map();
  let t = Date.parse('2026-10-16T14:00:00Z');
  return {
    post(hole, byPlayer) {
      for (const [pid, strokes] of Object.entries(byPlayer)) {
        t += 1000;
        rows.set(`${pid}:${hole}`, { player_id: pid, hole, strokes, updated_by: 'test', updated_at: new Date(t).toISOString() });
      }
      return this;
    },
    rows() {
      return [...rows.values()];
    },
  };
}

/** Everyone posts par on a hole for the given teams (2 players per team). */
export function parFor(teams, hole) {
  const par = COURSE.par[hole - 1];
  const out = {};
  for (const t of teams) {
    out[`${t.toLowerCase()}1`] = par;
    out[`${t.toLowerCase()}2`] = par;
  }
  return out;
}
