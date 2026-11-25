// 036 stamps + passport + card back (docs/design/features/036-card-designs/SPEC.md §12 step 1):
// matchCourse / stampFor, Andrew's real passport (§6.2), and the card back's row fitting on the Nov 7 field (§2.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCourse, stampFor, courseStampSvg, stampDate, passportOf, goalsOf } from '../js/stamps.js';
import { STAMP_COURSES } from '../js/stamps-data.js';
import { buildLocker, backRows } from '../js/locker.js';
import { existsSync } from 'node:fs';

const TC = { id: 'twin-creeks-allen-tx', name: 'The Golf Club at Twin Creeks', shortName: 'Twin Creeks', par: [5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4, 3, 5, 4, 4] };
const BW = { id: 'oga:bridlewood', name: 'Bridlewood Golf Course', shortName: 'Bridlewood', par: [4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4] };
const FL = { id: 'firewheel-lakes-garland-tx', name: 'Firewheel Golf Park · Lakes', shortName: 'Firewheel Lakes', par: [4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4] };
const ME = 'eeae7a48-33fa-4052-ad0c-fc7623173fe6';

test('matchCourse finds the library course from what rounds store (§7.2)', () => {
  assert.equal(matchCourse({ name: 'The Golf Club at Twin Creeks' })?.slug, 'twin-creeks');
  assert.equal(matchCourse({ name: 'Firewheel Golf Park · Lakes' })?.slug, 'firewheel');
  assert.equal(matchCourse({ name: 'Bridlewood Golf Course' })?.slug, 'bridlewood');
  assert.equal(matchCourse({ name: 'Bear Creek Golf Club' })?.slug, 'bear-creek');
  assert.equal(matchCourse(TC)?.slug, 'twin-creeks');
  assert.equal(matchCourse(BW)?.slug, 'bridlewood');
  assert.equal(matchCourse(FL)?.slug, 'firewheel');
  assert.equal(STAMP_COURSES.length, 68);
  for (const c of STAMP_COURSES) if (c.emblem) assert.ok(existsSync(new URL(`../${c.emblem}`, import.meta.url)), c.emblem);
});

test('An unknown course gets a stable monogram stamp', () => {
  const c = { id: 'oga:12345', name: 'Mesquite Hollow Golf Club', location: 'Somewhere, TX' };
  assert.equal(matchCourse(c), null);
  const a = stampFor(c), b = stampFor(c);
  assert.deepEqual(a, b);
  assert.equal(a.emblem, null);
  assert.equal(a.monogram, 'MH');
  assert.ok(['ring', 'oval'].includes(a.stamp.shape));
  assert.match(courseStampSvg(a, stampDate('2026-11-20')), /20 NOV 2026/);
});

let n = 0;
const round = (day, course, strokes, others = []) => {
  const id = `ev-${++n}`;
  const players = [{ id: 'p1', personId: ME, name: 'Andrew', firstName: 'Andrew', groupId: 'g1' }, ...others.map((o, i) => ({ id: `p${i + 2}`, personId: `x-${o[0]}`, name: o[0], firstName: o[0], groupId: o[2] || 'g2' }))];
  const scores = strokes.map((s, i) => ({ player_id: 'p1', hole: i + 1, strokes: s }));
  others.forEach((o, k) => shoot(course, o[1]).forEach((s, i) => scores.push({ player_id: `p${k + 2}`, hole: i + 1, strokes: s })));
  return { event: { id, code: `C${n}`, played_on: day, created_at: `${day}T15:00:00Z`, finalized_at: `${day}T23:00:00Z`, course, roster: { players }, settings: {} }, scores };
};
const shoot = (course, gross) => {
  const s = [...course.par];
  let left = gross - s.reduce((a, b) => a + b, 0);
  for (let i = 0; left; i = (i + 1) % 18) { if (left > 0) { s[i]++; left--; } else { s[i]--; left++; } }
  return s;
};
// Nov 7 Firewheel Lakes (AMTXQ): 16 players; Andrew's tee time = Alex, Chuck, Anthony.
const FIELD = [['Alex', 95, 'g1'], ['Chuck', 90, 'g1'], ['Anthony', 94, 'g1'], ['Elijah', 113], ['Marcus', 94], ['Justin', 94], ['Baker', 105], ['Josh', 82], ['Brandon', 95], ['Sean', 104], ['Harold', 76], ['Joseph', 110], ['Jay', 129], ['Mitchell', 89], ['Peter', 97]];
const ANDREW = [
  round('2026-10-16', TC, [9, 4, 4, 5, 5, 7, 6, 6, 4, 5, 5, 4, 5, 5, 4, 7, 6, 6]),
  round('2026-10-20', BW, [8, 7, 6, 6, 5, 5, 5, 3, 5, 8, 5, 3, 7, 5, 5, 5, 5, 4]),
  round('2026-10-31', TC, [6, 5, 4, 8, 5, 4, 5, 4, 6, 5, 4, 4, 7, 5, 4, 6, 6, 5]),
  round('2026-11-07', FL, [6, 5, 3, 7, 6, 5, 6, 4, 6, 6, 4, 5, 10, 8, 3, 5, 5, 6], FIELD),
  round('2026-11-20', TC, [6, 3, 4, 4, 4, 7, 4, 6, 6, 5, 3, 4, 6, 5, 4, 6, 5, 5], [['Justin', 91], ['Sean', 94], ['Mitchell', 94], ['Baker', 108]]),
];

test("Andrew's real passport (§6.2)", () => {
  const cards = buildLocker(ANDREW, ME, { today: '2026-11-24' });
  const pp = passportOf(cards);
  assert.deepEqual(pp.courses.map((c) => [matchCourse(c.courseObj)?.slug, c.visits, c.best, c.first]),
    [['twin-creeks', 3, 87, '2026-10-16'], ['bridlewood', 1, 97, '2026-10-20'], ['firewheel', 1, 100, '2026-11-07']]);
  assert.deepEqual(pp.milestones.map((m) => `${m.label} ${m.day}`),
    ['Lowest round · 93 2026-10-31', 'First birdie 2026-10-31', 'Broke 90 2026-11-20', 'Lowest round · 87 2026-11-20']);
  assert.equal(pp.milestones[1].hole, 6); // First birdie: Twin Creeks hole 6
  assert.deepEqual(goalsOf(pp, cards), ['Broke 80', 'Eagle']);
});

test('Card back: the 16-player field fits 11 rows; the 14th-place view shows a gap (§2.3)', () => {
  const cards = buildLocker(ANDREW, ME, { today: '2026-11-24' });
  const nov7 = cards[3];
  assert.equal(nov7.group.length, 16);
  assert.equal(nov7.group[0].name, 'Harold');
  assert.deepEqual(nov7.group.filter((x) => x.gross === 94).map((x) => x.rank), [5, 5, 5]);
  const a = backRows(nov7.group);
  assert.equal(a.rows.length, 11);
  assert.deepEqual([a.rows[10].name, a.rows[10].rank, a.more, a.tee], ['Andrew', 11, 5, true]);
  assert.deepEqual(nov7.group.filter((x) => x.sameTeeTime).map((x) => x.name).sort(), ['Alex', 'Anthony', 'Chuck']);
  // the same field seen by the 14th-place player (Joseph)
  const asJoseph = nov7.group.map((x) => ({ ...x, me: x.name === 'Joseph' }));
  const j = backRows(asJoseph);
  assert.equal(j.rows.length, 11);
  assert.ok(j.rows[7].gap);
  assert.deepEqual(j.rows.slice(8).map((x) => x.rank), [13, 14, 15]);
  assert.equal(j.more, 1);
  // Nov 20, 5 players: everyone listed, Andrew low
  const nov20 = cards[4];
  assert.deepEqual(nov20.group.map((x) => `${x.name} ${x.gross}`), ['Andrew 87', 'Justin 91', 'Sean 94', 'Mitchell 94', 'Baker 108']);
});
