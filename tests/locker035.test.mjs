// 035 Scorecard locker: the rules (SPEC §3) against the live data table (SPEC §2), your normal + cut-offs,
// stamps, stats, and open_card / locker_admin in the mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocker, normalOf, finishForDiff, cardStats, packsOf, openedOf, adminTotals, LAUNCH_DATE } from '../js/locker.js';
import { createBackend } from './mock-supabase.mjs';

const TC = { id: 'twin-creeks-allen-tx', shortName: 'Twin Creeks', par: [5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4, 3, 5, 4, 4] };
const BW = { id: 'oga:bridlewood', shortName: 'Bridlewood', par: [4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4] };
const FL = { id: 'firewheel-lakes-garland-tx', shortName: 'Firewheel Lakes', par: [4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4] };

let n = 0;
/** One finished round for one person (others on the roster make it "with the crew"). */
function round(day, course, strokes, { person = 'person-andrew', others = 3, final = true, practice = false } = {}) {
  const id = `ev-${++n}`;
  const players = [{ id: 'p1', personId: person, name: 'Andrew', firstName: 'Andrew' },
    ...Array.from({ length: others }, (_, i) => ({ id: `p${i + 2}`, personId: `person-x${i}`, name: `X${i}` }))];
  return {
    event: { id, code: `C${n}`, played_on: day, created_at: `${day}T15:00:00Z`, finalized_at: final ? `${day}T23:00:00Z` : null,
      course, roster: { players }, settings: practice ? { practice: true } : {} },
    scores: strokes.map((s, i) => ({ player_id: 'p1', hole: i + 1, strokes: s })),
  };
}
/** Strokes on a course adding up to `gross` (pars, then spread the extra). */
const shoot = (course, gross) => {
  const s = [...course.par];
  let left = gross - s.reduce((a, b) => a + b, 0);
  for (let i = 0; left; i = (i + 1) % 18) { if (left > 0) { s[i]++; left--; } else { s[i]--; left++; } }
  return s;
};
const finishes = (cards) => cards.map((c) => `${c.gross} ${c.fin}`);

// Andrew, Sean and Alex: their real rounds (read from the live database Nov 21).
const ANDREW = [
  ['2026-10-16', TC, [9, 4, 4, 5, 5, 7, 6, 6, 4, 5, 5, 4, 5, 5, 4, 7, 6, 6]],
  ['2026-10-20', BW, [8, 7, 6, 6, 5, 5, 5, 3, 5, 8, 5, 3, 7, 5, 5, 5, 5, 4]],
  ['2026-10-31', TC, [6, 5, 4, 8, 5, 4, 5, 4, 6, 5, 4, 4, 7, 5, 4, 6, 6, 5]],
  ['2026-11-07', FL, [6, 5, 3, 7, 6, 5, 6, 4, 6, 6, 4, 5, 10, 8, 3, 5, 5, 6]],
  ['2026-11-20', TC, [6, 3, 4, 4, 4, 7, 4, 6, 6, 5, 3, 4, 6, 5, 4, 6, 5, 5]],
];
const SEAN = [
  ['2026-10-16', TC, [7, 6, 5, 4, 6, 6, 3, 8, 5, 6, 5, 6, 6, 5, 4, 5, 5, 7]],
  ['2026-10-20', BW, [5, 6, 4, 4, 5, 5, 7, 6, 5, 5, 6, 3, 7, 4, 5, 6, 5, 5]],
  ['2026-10-31', TC, [6, 6, 3, 6, 5, 7, 6, 6, 6, 6, 6, 7, 7, 8, 4, 7, 5, 8]],
  ['2026-11-07', FL, [5, 6, 5, 6, 8, 6, 5, 4, 7, 5, 6, 5, 6, 6, 6, 7, 6, 5]],
  ['2026-11-20', TC, [6, 5, 5, 4, 5, 5, 3, 5, 6, 6, 5, 6, 5, 5, 5, 7, 5, 6]],
];
const ALEX = [
  ['2026-10-31', TC, [8, 4, 3, 5, 5, 6, 4, 7, 5, 4, 6, 5, 6, 5, 4, 7, 6, 4]],
  ['2026-11-07', FL, [4, 6, 4, 7, 5, 5, 5, 3, 6, 6, 4, 4, 9, 7, 4, 5, 5, 6]],
];
const real = (list, person) => list.map(([d, c, s]) => round(d, c, s, { person }));

test('Launch cards match the live data table (SPEC §2)', () => {
  const today = '2026-11-21';
  const a = buildLocker(real(ANDREW, 'person-andrew'), 'person-andrew', { today });
  assert.deepEqual(finishes(a), ['97 silver', '97 bronze', '93 gold', '100 standard', '87 prismatic']);
  assert.equal(a[4].line, 'Launch card · your best of your first 5 rounds');
  assert.equal(a[2].line, 'Launch card · your 2nd best of your first 5 rounds');
  assert.equal(a[4].grade, 'S');
  assert.equal(a[3].grade, null);
  const s = buildLocker(real(SEAN, 'person-sean'), 'person-sean', { today });
  assert.deepEqual(finishes(s), ['99 silver', '93 prismatic', '109 standard', '104 bronze', '94 gold']);
  const x = buildLocker(real(ALEX, 'person-alex'), 'person-alex', { today });
  assert.deepEqual(finishes(x), ['94 gold', '95 silver']);
  // Justin (4 rounds), Mitchell (3), one round
  const j = buildLocker([98, 101, 94, 91].map((g, i) => round(`2026-11-0${i + 1}`, TC, shoot(TC, g), { person: 'j' })), 'j', { today });
  assert.deepEqual(finishes(j), ['98 silver', '101 bronze', '94 gold', '91 prismatic']);
  const m = buildLocker([97, 89, 94].map((g, i) => round(`2026-11-0${i + 1}`, TC, shoot(TC, g), { person: 'm' })), 'm', { today });
  assert.deepEqual(finishes(m), ['97 bronze', '89 gold', '94 silver']);
  const one = buildLocker([round('2026-11-01', TC, shoot(TC, 99), { person: 'o' })], 'o', { today });
  assert.deepEqual(finishes(one), ['99 silver']);
  assert.equal(one[0].line, 'Launch card');
});

test('Only finished, non-practice, over rounds of this person count', () => {
  const today = '2026-11-21';
  const rows = [
    round('2026-11-01', TC, shoot(TC, 90)),
    round('2026-11-02', TC, shoot(TC, 90), { practice: true }),
    round('2026-11-21', TC, shoot(TC, 90), { final: false }), // today, not finalized: still going
    round('2026-11-20', TC, shoot(TC, 90), { final: false }), // yesterday: over
    { ...round('2026-11-03', TC, shoot(TC, 90)), scores: shoot(TC, 90).slice(0, 17).map((s, i) => ({ player_id: 'p1', hole: i + 1, strokes: s })) },
    round('2026-11-04', TC, shoot(TC, 90), { person: 'someone-else' }),
  ];
  assert.deepEqual(buildLocker(rows, 'person-andrew', { today }).map((c) => c.day), ['2026-11-01', '2026-11-20']);
});

test('After launch: rookie cards, then your normal (last 20, worst fifth out)', () => {
  assert.equal(normalOf([90, 92, 94, 96, 120]), 93); // 5 rounds: worst 1 out → avg(90,92,94,96)
  assert.equal(normalOf([90, 91, 92, 93]), 92); // 4 rounds: none out, 91.5 rounds to 92
  assert.equal(normalOf([...Array(25)].map((_, i) => (i < 5 ? 200 : 90))), 90); // only the last 20 count
  assert.deepEqual([5, 4, 3, 2, 0, -1, -3, -4].map(finishForDiff), ['prismatic', 'gold', 'gold', 'silver', 'silver', 'bronze', 'bronze', 'standard']);
  const today = '2026-12-31';
  // One launch round, then post-launch rounds: 2nd and 3rd ever are rookies; the 4th is graded.
  const rows = [round('2026-11-01', TC, shoot(TC, 95)), round('2026-12-01', TC, shoot(TC, 93)), round('2026-12-02', TC, shoot(TC, 97)),
    round('2026-12-03', TC, shoot(TC, 87)), round('2026-12-04', TC, shoot(TC, 96)), round('2026-12-05', TC, shoot(TC, 101))];
  const c = buildLocker(rows, 'person-andrew', { today });
  assert.deepEqual(c.map((x) => x.kind), ['launch', 'rookie', 'rookie', 'graded', 'graded', 'graded']);
  assert.equal(c[1].line, 'Rookie card 2 of 3');
  assert.equal(c[1].grade, null);
  assert.equal(c[3].normal, 95); // avg(95, 93, 97)
  assert.equal(c[3].line, '8 better than your normal of 95');
  assert.equal(c[3].fin, 'prismatic');
  assert.equal(c[4].normal, 93); // 4 before: avg(95,93,97,87) = 93
  assert.equal(c[4].line, '3 over your normal of 93');
  assert.equal(c[4].fin, 'bronze');
  assert.equal(c[5].fin, 'standard');
  assert.equal(c[5].line, '');
  assert.ok(c[0].day <= LAUNCH_DATE);
});

test('Stamps and back-of-card stats', () => {
  const a = buildLocker(real(ANDREW, 'person-andrew'), 'person-andrew', { today: '2026-11-21' });
  assert.deepEqual(a[0].stamps, []);
  assert.deepEqual(a[2].stamps, ['Lowest round yet', 'First birdie', 'Best at Twin Creeks']); // 93 after 97, 97; 4 on the par-5 6th
  assert.deepEqual(a[3].stamps, []); // 100 at Firewheel: nothing new
  assert.deepEqual(a[4].stamps, ['Broke 90', 'Lowest round yet', 'Best at Twin Creeks']);
  const st = cardStats([3, 4, 5, 6, 4, 4, 2, 4, 4, ...Array(9).fill(4)], [4, 4, 4, 4, 4, 4, 4, 4, 4, ...Array(9).fill(4)]);
  assert.deepEqual(st.count, { eagles: 1, birdies: 1, pars: 14, bogeys: 1, doubles: 1 });
  assert.equal(st.bestRun, 14); // holes 5–18
  assert.deepEqual(st.byType, [{ par: 4, holes: 18, toPar: 0 }]);
  assert.equal(st.front, 36);
});

test('Packs: unopened oldest first; opened (server or offline-pending) newest first', () => {
  const rows = real(ANDREW, 'person-andrew');
  const opens = [{ event_id: rows[0].event.id, opened_at: '2026-11-21T10:00:00Z' }];
  const c = buildLocker(rows, 'person-andrew', { today: '2026-11-21', opens, pending: [rows[2].event.code] });
  assert.deepEqual(packsOf(c).map((x) => x.day), ['2026-10-20', '2026-11-07', '2026-11-20']);
  assert.deepEqual(openedOf(c).map((x) => x.day), ['2026-10-31', '2026-10-16']);
});

test('open_card in the mock: ok once, not_finished, not_you; locker_admin counts it', () => {
  const be = createBackend();
  const roster = { players: [{ id: 'p1', personId: 'person-andrew', name: 'Andrew', firstName: 'Andrew', lastName: 'Duong' }, { id: 'p2', personId: 'person-sean', name: 'Sean' }] };
  const r = be.rpc.create_event({ p_name: 'R', p_course: TC, p_roster: roster, p_settings: {}, p_played_on: '2026-11-01' });
  const e = be.tables.events.find((x) => x.code === r.code);
  TC.par.forEach((p, i) => be.tables.scores.push({ event_id: e.id, player_id: 'p1', hole: i + 1, strokes: p + 1 }));
  TC.par.slice(0, 9).forEach((p, i) => be.tables.scores.push({ event_id: e.id, player_id: 'p2', hole: i + 1, strokes: p }));
  const dev = '11111111-1111-4111-8111-111111111111';
  be.rpc.claim_player({ p_code: r.code, p_player_id: 'p1', p_device_id: dev });
  assert.equal(be.rpc.open_card({ p_code: r.code, p_person_id: 'person-andrew', p_device_id: '22222222-2222-4222-8222-222222222222' }).error, 'not_you');
  assert.equal(be.rpc.open_card({ p_code: r.code, p_person_id: 'person-sean', p_device_id: dev }).error, 'not_finished');
  assert.equal(be.rpc.open_card({ p_code: r.code, p_person_id: 'person-nobody', p_device_id: dev }).error, 'not_on_roster');
  const ok = be.rpc.open_card({ p_code: r.code, p_person_id: 'person-andrew', p_device_id: dev });
  assert.equal(ok.ok, true);
  assert.equal(be.rpc.open_card({ p_code: r.code, p_person_id: 'person-andrew', p_device_id: dev }).unchanged, true);
  assert.equal(be.tables.card_opens.length, 1);
  const adm = be.rpc.locker_admin();
  assert.deepEqual(adm.people.map((p) => [p.name, p.rounds, p.opened]), [['Andrew Duong', 1, 1]]);
  assert.deepEqual(adminTotals(adm.people), { people: 1, packs: 1, opened: 1 });
  be.rpc.delete_round({ p_code: r.code, p_admin_pin: be.tables.secrets.get(e.id) });
  assert.equal(be.tables.card_opens.length, 0);
});
