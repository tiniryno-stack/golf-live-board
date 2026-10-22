import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonLabel, nextSeasonLabel, buildSeasons, placeLabel } from '../js/seasons.js';

const r = (played_on, created_at = `${played_on}T15:00:00Z`) => ({ event: { id: played_on, played_on, created_at, roster: { players: [] }, settings: {}, course: { par: Array(18).fill(4), strokeIndex: [...Array(18)].map((_, i) => i + 1) } }, scores: [] });

test('Season names follow the date; the next one follows the current', () => {
  assert.equal(seasonLabel('2026-10-16'), 'Fall 2026');
  assert.equal(seasonLabel('2026-12-05'), 'Winter 2027');
  assert.equal(seasonLabel('2027-04-01'), 'Spring 2027');
  assert.equal(nextSeasonLabel('Fall 2026'), 'Winter 2027');
  assert.equal(nextSeasonLabel('Winter 2027'), 'Spring 2027');
});

test('First season is implicit: it starts with the crew’s first round, so every existing round lands in it', () => {
  const s = buildSeasons([], [r('2026-10-16'), r('2026-10-20')], '2026-10-22');
  assert.equal(s.length, 1);
  assert.equal(s[0].name, 'Fall 2026');
  assert.equal(s[0].start, '2026-10-16');
  assert.equal(s[0].current, true);
  assert.equal(s[0].rounds.length, 2);
});

test('A new season splits rounds by day: no gaps, no overlap; "Next round" starts with the next round created', () => {
  const rounds = [r('2026-10-16'), r('2026-10-20'), r('2027-03-02', '2027-03-02T15:00:00Z')];
  const dated = buildSeasons([{ name: 'Spring 2027', startsOn: '2027-03-01', createdAt: '2027-02-20T00:00:00Z' }], rounds, '2027-03-05');
  assert.deepEqual(dated.map((x) => [x.name, x.rounds.length, x.current]), [['Fall 2026', 2, false], ['Spring 2027', 1, true]]);
  assert.equal(dated[0].end, '2027-03-01');
  const next = buildSeasons([{ name: 'Spring 2027', startsOn: null, createdAt: '2027-01-10T00:00:00Z' }], rounds, '2027-03-05');
  assert.equal(next[1].start, '2027-03-02');
  const waiting = buildSeasons([{ name: 'Spring 2027', startsOn: null, createdAt: '2027-04-10T00:00:00Z' }], rounds, '2027-04-11');
  assert.equal(waiting[0].current, true, 'until the next round, the old season is still current');
  assert.equal(waiting[1].upcoming, true);
});

test('Place labels: 3rd, T2', () => {
  assert.equal(placeLabel({ rank: 3, tied: false }), '3rd');
  assert.equal(placeLabel({ rank: 2, tied: true }), 'T2');
});
