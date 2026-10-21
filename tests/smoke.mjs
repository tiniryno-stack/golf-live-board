// Two-phone smoke test (BUILD.md stage 9), headless, against the in-memory mock:
//   1. Andrew (Hogan's Heroes) and Sam (Fore Play) join by tapping their names
//   2. Blocked edit: Sam can't enter Andrew's score on hole 3 (UI and server)
//   3. Holes 1–6 played on both phones; hole-7 swap puts Andrew with Fore Play
//   4. Offline: a score entered with no signal queues, then syncs
//   5. Clear-the-browser rejoin: a fresh phone asks to be Andrew, Sam lets them in,
//      the old phone drops to watch-only
//   6. Organizer resets the round (scores cleared, phones stay joined), then deletes it
//   7. Back-nine start + unnamed carts: name picker (taken names greyed), − / + on a blank
//      tile, your cart ~70% of Enter, toasts only for the other foursome
//   8. Their cart is greyed: a stray tap doesn't score, it opens 50/50; tap yours to go
//      back; the next hole opens on yours again. Your cart tops the Card even as cart C.
//   0. Joining shows "Today's game" (your matchups, what's up for grabs) once per phone
//  10. Organizer: Setup → Save → Open the round on a fresh phone, pick a name, keep the
//      cart name, Today's game, Enter (the first tip waits until the cards are gone)
//  11. Never a blank screen: a stalled connection shows "Opening…" then Try again; a
//      drawing error shows "Something went wrong" + Reload
//  17. Test phones (sim.html): practice round, 8 phones, Play a hole, one group ahead, delete;
//      on a phone: one full-size test phone + 1–8 switcher
//  16. Add a course: near me (via the backup route), search, background scorecard, fix it at
//      Save, your group's card reused next time, enter it yourself, no signal
//  15. Finalize: finished rounds open on the Board; the organizer finalizes (scores locked on
//      server and screen); the organizer PIN unlocks a phone; Host can reopen
//  18. Split point (2–4 players, no carts) switched on mid-round from Host: recounts from hole 1
//   9. Headlines wear the jersey of the team on their positive end; two that land on the
//      same score show together, then it's back to one (banner and Board).
// Realtime isn't mocked, so "the other phone sees it" is driven by a refetch —
// the same path the app uses when a phone comes back from the lock screen.
// Run: npm run test:smoke

import { chromium } from 'playwright';
import { createBackend, attach, serve, seedRound, OGA_FIXTURES } from './mock-supabase.mjs';
import { COURSES } from '../js/courses.js';
const COURSES_TC = COURSES[0];

const srv = await serve();
const be = createBackend();
const r = seedRound(be);
const link = `${srv.origin}/#/e/${r.code}`;
const browser = await chromium.launch();
const results = [];
let failed = 0;

function ok(cond, msg) {
  results.push(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!cond) failed++;
}

async function phone(name) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 548 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(() => {
    for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true');
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${name}: ${e.message}`));
  return { ctx, page };
}

const app = (page, fn, arg) => page.evaluate(fn, arg);
const refetch = (page) => page.evaluate(() => window.__glb.refetch());
const toastText = (page) => page.evaluate(() => document.getElementById('toasts').innerText.replace(/\s+/g, ' ').trim());
const clearOverlays = (page) => page.evaluate(() => {
  document.querySelector('[data-act="away-dismiss"]')?.click();
  document.querySelector('[data-act="brief-done"]')?.click();
});
const briefText = (page) => page.evaluate(() => [...document.querySelectorAll('.brief-page')].map((p) => p.innerText.replace(/\s+/g, ' ').trim()));
const briefFits = (page) => page.evaluate(() => [...document.querySelectorAll('.brief-page')].every((p) => p.scrollHeight <= p.clientHeight + 1));

async function join(page, playerName) {
  await page.goto(link);
  await page.waitForSelector('.who-btn', { timeout: 8000 });
  await page.locator('.who-btn', { hasText: playerName }).first().tap();
  await page.waitForTimeout(700);
}

async function tapTiles(page) {
  const pids = await page.$$eval('.cart.focus .tile .face[data-act="tile-tap"]', (els) => els.map((e) => e.dataset.pid));
  for (const pid of pids) await page.tap(`.tile .face[data-pid="${pid}"]`);
}
async function playHole(page) {
  await clearOverlays(page);
  await tapTiles(page); // your cart
  if (await page.$('.cart.opp.dim')) {
    await page.tap('.cart.opp.dim'); // open theirs (50/50)
    await tapTiles(page);
  }
  await page.waitForTimeout(100);
  await page.tap('.next-btn');
  await page.waitForTimeout(150);
  const card = await page.evaluate(() => document.getElementById('overlay').innerText);
  if (/LOCK IN|CLOSE IT OUT/i.test(card)) {
    alerts.push(card.replace(/\s+/g, ' ').trim());
    await page.tap('[data-act="card-continue"]');
    await page.waitForTimeout(100);
  }
}
const alerts = [];

// 1. Join
const A = await phone('Andrew');
const C = await phone('Sam');
await join(A.page, 'Andrew');
await join(C.page, 'Sam');
ok((await app(A.page, () => window.__glb.me)) === 'p1', 'Andrew’s phone claimed Andrew');
ok((await app(C.page, () => window.__glb.me)) === 'p5', 'Sam’s phone claimed Sam');
ok(be.tables.claims.length === 2, 'server holds two claims');
const cartsA = await A.page.$$eval('.cart .name', (els) => els.map((e) => e.textContent));
ok(cartsA.join() === 'Hogan’s Heroes,Shank Redemption', `hole 1 cards on Andrew’s phone: ${cartsA.join(' + ')}`);
const briefA = await briefText(A.page);
ok(briefA.length === 2 && /Rotation Match Play/.test(briefA[0]) && /2 points every hole/.test(briefA[0]) && /Push A tie: ½ point each/.test(briefA[0]),
  `joining shows Today\u2019s game: how a hole is scored (${(briefA[0] || 'none').slice(0, 60)}\u2026)`);
ok(/Holes 1–6 vs Shank Redemption/.test(briefA[1] || '') && /Holes 7–12 vs Fore Play/.test(briefA[1] || '') && /12 points per matchup, \+1 for winning it/.test(briefA[1] || ''),
  'card 2: Andrew\u2019s three matchups and what\u2019s up for grabs');
ok(await briefFits(A.page), 'both cards fit an iPhone SE without scrolling');
await A.page.tap('[data-act="brief-next"]');
await A.page.waitForTimeout(600);
ok((await A.page.textContent('[data-act="brief-next"]')).includes('Let’s play'), 'Next swipes to card 2 \u2192 \u201cLet\u2019s play\u201d');
await A.page.tap('[data-act="brief-next"]');
await A.page.waitForTimeout(200);
ok(!(await A.page.$('.fullcard.brief')) && (await A.page.evaluate(() => window.__glb.route.tab)) === 'enter' && !!(await A.page.$('.cart.mine')), 'Let\u2019s play \u2192 Enter');
ok(await A.page.evaluate((c) => localStorage.getItem('glb.brief.' + c) === 'true', r.code), 'remembered on this phone');
ok(!!(await C.page.$('.fullcard.brief')), 'Sam gets it too');
await C.page.tap('[data-act="brief-done"]');
await C.page.waitForTimeout(200);
ok(!(await C.page.$('.fullcard.brief')), 'Skip closes it');

// 2. Blocked edit outside your matchup
const blockedUi = await app(C.page, () => window.__glb.setScore('p1', 3, 4));
ok(blockedUi === false, 'Sam’s phone refuses to write Andrew’s hole 3 (UI)');
ok((await toastText(C.page)).includes('Not your matchup'), 'Sam sees “Not your matchup”');
const dev = await app(C.page, () => JSON.parse(localStorage.getItem('glb.device')));
const serverSays = be.rpc.upsert_score({ p_code: r.code, p_device_id: dev, p_player_id: 'p1', p_hole: 3, p_strokes: 4 });
ok(serverSays.error === 'not_your_foursome', `server rejects it too (${serverSays.error})`);
await C.page.goto(`${link}/card`);
await C.page.waitForTimeout(500);
ok(!(await C.page.$('[data-pid="p1"][data-h="3"]')), 'Andrew\u2019s group starts collapsed on Sam\u2019s Card (not his foursome)');
await C.page.tap('[data-act="card-other"]');
await C.page.waitForTimeout(200);
const andrewCellEditable = await C.page.$eval('[data-pid="p1"][data-h="3"]', (el) => el.dataset.act === 'cell-edit');
ok(!andrewCellEditable, 'Andrew’s hole 3 cell is view-only on Sam’s Card');
await C.page.goto(`${link}/enter`);
await C.page.waitForTimeout(400);

// 3. Holes 1–6 on both phones, then the swap
for (let h = 1; h <= 6; h++) {
  await playHole(A.page);
  await playHole(C.page);
  if (h === 6) {
    for (const p of [A.page, C.page]) {
      const card = await p.evaluate(() => document.getElementById('overlay').innerText);
      ok(/switch it up/i.test(card), `${p === A.page ? 'Andrew' : 'Sam'} gets Switch it up after 6`);
      if (p === A.page) ok(card.includes('vs Fore Play') && card.includes('Sam + Jake'), 'Andrew’s next matchup: Fore Play · Sam + Jake');
      await p.tap('[data-act="card-continue"]');
    }
  }
}
ok(alerts.some((a) => /Lock in/i.test(a)), `a Lock in card fired for the trailing cart (${alerts[0] || 'none'})`);
await A.page.waitForTimeout(1000);
const h6 = be.tables.scores.filter((s) => s.hole === 6 && s.strokes != null).length;
ok(h6 === 8, `all 8 players posted hole 6 on the server (${h6})`);
ok((await A.page.textContent('.hole-title')) === 'Hole 7', 'Andrew is on hole 7');
const carts7 = await A.page.$$eval('.cart .name', (els) => els.map((e) => e.textContent));
ok(carts7.join() === 'Hogan’s Heroes,Fore Play', `hole 7 cards on Andrew’s phone: ${carts7.join(' + ')}`);
await A.page.tap('.face[data-pid="p5"]'); // greyed: this tap only opens Fore Play's side
await A.page.waitForTimeout(300);
ok(!be.tables.scores.some((s) => s.player_id === 'p5' && s.hole === 7), 'a tap on the greyed cart doesn\u2019t enter a score');
await A.page.tap('.face[data-pid="p5"]');
await A.page.waitForTimeout(900);
const sam7 = be.tables.scores.find((s) => s.player_id === 'p5' && s.hole === 7);
ok(sam7?.strokes === 3 && sam7.updated_by === 'Andrew', 'Andrew can now enter Sam’s hole 7: a tap = par 3 (stamped “Andrew”)');
await refetch(C.page);
await C.page.waitForTimeout(200);
const samSees = await app(C.page, () => window.__glb.snapshot.playerById.get('p5').gross[6]);
ok(samSees === 3, 'Sam’s phone shows the score Andrew entered for him');
const official = await app(C.page, () => window.__glb.snapshot.officialThrough);
ok(official === 6, `official line through 6 (${official})`);
await C.page.goto(`${link}/card`);
await C.page.waitForTimeout(500);
const cardOrder = await C.page.$$eval('.card-nr > .cgrid .cg-team .name', (els) => els.map((e) => e.textContent));
ok(cardOrder[0] === 'Fore Play' && cardOrder[1] === 'Hogan\u2019s Heroes', `Sam\u2019s Card: his cart (C) first, then who he\u2019s playing (${cardOrder.slice(0, 2).join(', ')})`);
// Matchup win bonus: rotation 1 is in → the winner's +1 shows; tap a team for the breakdown
await C.page.goto(`${link}/board`);
await C.page.waitForTimeout(500);
const r1 = await app(C.page, () => {
  const g = window.__glb.snapshot.game;
  const m = g.matches.find((x) => x.id === 'r1m1');
  const w = m.result;
  const st = g.liveStandings.find((x) => x.teamId === w);
  return { w, holePts: m.points[w], bonus: m.bonus[w], total: st?.points, name: window.__glb.snapshot.teamById.get(w)?.name };
});
ok(r1.w && r1.w !== 'halved' && r1.bonus === 1, `holes 1–6 winner (${r1.name}) gets +1 for the matchup`);
await C.page.tap(`[data-act="board-team"][data-v="${r1.w}"]`);
await C.page.waitForTimeout(400);
const bd = (await C.page.textContent('#sheet')).replace(/\s+/g, ' ');
const fmt = (n) => String(Math.floor(n)) .replace(/^0$/, n % 1 ? '' : '0') + (n % 1 ? '½' : '');
ok(bd.includes('+1 for the win') && bd.includes(`Total`) && bd.includes(fmt(r1.holePts + 1)), `tap ${r1.name} \u2192 breakdown: matchup ${fmt(r1.holePts)} + 1 for the win (${bd.slice(0, 90)}\u2026)`);
ok(bd.includes(fmt(r1.total)), `breakdown total matches the Board (${fmt(r1.total)})`);
await C.page.goto(`${link}/enter`);
await C.page.waitForTimeout(400);

// 4. Offline queue
be.offline = true;
await C.page.tap('.face[data-pid="p6"]');
await C.page.waitForTimeout(1200);
const chip = await C.page.textContent('[data-sync]');
ok(/1 unsynced/.test(chip), `no signal: Jake’s 7 waits in the queue (chip: ${chip})`);
ok(!be.tables.scores.some((s) => s.player_id === 'p6' && s.hole === 7), 'server doesn’t have it yet');
be.offline = false;
await app(C.page, () => window.dispatchEvent(new Event('online')));
await C.page.waitForTimeout(800);
ok(be.tables.scores.some((s) => s.player_id === 'p6' && s.hole === 7 && s.strokes === 3), 'back online: it synced');
ok(/Synced|Reconnecting/.test(await C.page.textContent('[data-sync]')) && !/unsynced/.test(await C.page.textContent('[data-sync]')), 'chip cleared');

// 5. Clear-the-browser rejoin
const A2 = await phone('Andrew (cleared browser)');
await A2.page.goto(link);
await A2.page.waitForSelector('.who-btn', { timeout: 8000 });
const tag = await A2.page.locator('.who-btn', { hasText: 'Andrew' }).first().innerText();
ok(/in use/i.test(tag), 'Andrew shows “in use” on the fresh phone');
await A2.page.locator('.who-btn', { hasText: 'Andrew' }).first().tap();
await A2.page.waitForSelector('[data-act="who-ask"]');
await A2.page.tap('[data-act="who-ask"]');
await A2.page.waitForTimeout(300);
ok((await A2.page.textContent('#sheet')).includes('Waiting'), 'fresh phone: “Waiting for your foursome to let you in…”');
ok(be.tables.joins.filter((j) => j.status === 'pending').length === 1, 'one pending request on the server');
await refetch(C.page);
await C.page.waitForTimeout(300);
const banner = await C.page.textContent('#banners');
ok(banner.includes('Someone wants to join as Andrew'), 'Sam (same foursome on 7) sees “Someone wants to join as Andrew”');
await C.page.tap('[data-act="join-approve"]');
await C.page.waitForTimeout(400);
ok(be.tables.joins[0].status === 'approved' && be.tables.joins[0].approved_by === 'Sam', 'approved by Sam');
await refetch(A2.page);
await A2.page.waitForTimeout(400);
ok((await app(A2.page, () => window.__glb.me)) === 'p1', 'fresh phone is now Andrew');
ok(!(await A2.page.textContent('#sheet')).includes('Waiting'), 'waiting sheet closed');
await refetch(A.page);
await A.page.waitForTimeout(400);
ok((await app(A.page, () => window.__glb.me)) === null, 'old phone dropped to watch-only');
ok((await A.page.textContent('#topbar')).includes('Watching'), 'old phone’s chip says Watching');
const owner = be.tables.claims.filter((c) => c.player_id === 'p1');
ok(owner.length === 1 && owner[0].device_id !== (await app(A.page, () => JSON.parse(localStorage.getItem('glb.device')))), 'server: Andrew belongs to the new phone only');

// 6. Organizer resets the round, then deletes it (practice-round cleanup)
await app(A2.page, (pin) => window.__glb.setAdmin(pin), r.admin_pin);
await A2.page.goto(`${link}/host`);
await A2.page.waitForTimeout(500);
const before = be.tables.scores.filter((x) => x.strokes != null).length;
await A2.page.tap('[data-act="host-reset"]');
await A2.page.waitForSelector('[data-act="confirm-ok"]');
await A2.page.tap('[data-act="confirm-ok"]');
await A2.page.waitForTimeout(600);
ok(before > 40 && be.tables.scores.every((x) => x.strokes == null), `reset cleared all ${before} scores on the server`);
ok((await toastText(A2.page)).includes('Round reset'), 'organizer sees \u201cRound reset\u201d');
ok(be.tables.claims.length === 2, 'everyone stays joined after a reset');
await refetch(C.page);
await C.page.goto(`${link}/enter`);
await C.page.waitForTimeout(500);
ok((await C.page.textContent('.hole-title')) === 'Hole 1', 'Sam\u2019s phone is back on hole 1');
ok(!(await app(C.page, () => window.__glb.snapshot.anyPosted)), 'Sam\u2019s phone shows no scores');
await C.page.tap('.face[data-pid="p5"]');
await C.page.waitForTimeout(900);
ok(be.tables.scores.some((x) => x.player_id === 'p5' && x.hole === 1 && x.strokes === 5), 'play resumes after the reset');
await A2.page.goto(`${link}/host`);
await A2.page.waitForTimeout(400);
await A2.page.tap('[data-act="host-delete"]');
await A2.page.waitForSelector('[data-act="confirm-ok"]');
await A2.page.tap('[data-act="confirm-ok"]');
await A2.page.waitForTimeout(600);
ok(be.tables.events.length === 0 && be.tables.scores.length === 0 && be.tables.claims.length === 0, 'delete removed the round, its scores and claims');
ok((await A2.page.evaluate(() => location.hash)) === '#/', 'organizer lands on Home');
const recentA2 = await app(A2.page, () => JSON.parse(localStorage.getItem('glb.recent') || '[]').map((x) => x.code));
ok(!recentA2.includes(r.code), 'deleted round is gone from the organizer\u2019s recent rounds');
await refetch(C.page);
await C.page.waitForTimeout(400);
ok((await C.page.textContent('#content')).includes('Round deleted'), 'Sam\u2019s phone shows \u201cRound deleted\u201d');
const recentC = await app(C.page, () => JSON.parse(localStorage.getItem('glb.recent') || '[]').map((x) => x.code));
ok(!recentC.includes(r.code), 'and drops it from Sam\u2019s recent rounds');

// 7. A back-nine round with unnamed carts: name picker, − / + from a blank tile, toast filter
const r2 = seedRound(be, { extra: { startHole: 10 } });
r2.event.roster.teams.forEach((t) => (t.name = `Cart ${t.id}`));
const link2 = `${srv.origin}/#/e/${r2.code}`;
const P = await phone('Andrew (round 2)');
const Q = await phone('Sam (round 2)');
for (const [ph, nm] of [[P, 'Andrew'], [Q, 'Sam']]) {
  await ph.page.goto(link2);
  await ph.page.waitForSelector('.who-btn', { timeout: 8000 });
  await ph.page.locator('.who-btn', { hasText: nm }).first().tap();
  await ph.page.waitForTimeout(800);
}
ok(/name your cart/i.test(await P.page.textContent('#overlay')), 'unnamed cart: \u201cName your cart\u201d card after joining');
await P.page.tap('[data-act="team-pick"][data-v="Charmander"]');
await P.page.waitForTimeout(500);
ok(r2.event.roster.teams.find((t) => t.id === 'A').name === 'Charmander', 'Andrew\u2019s cart is now Charmander on the server');
const briefP = await briefText(P.page);
ok(/^Charmander/.test(briefP[1] || '') && /Holes 10–15 vs/.test(briefP[1] || '') && /Tee off on 10, finish on 9/.test(briefP[1] || ''),
  `named the cart \u2192 Today\u2019s game with the new name and back-nine holes (${(briefP[1] || 'none').slice(0, 50)}\u2026)`);
ok(await briefFits(P.page), 'still fits an SE with the extra “tee off on 10” line');
await P.page.tap('[data-act="brief-done"]');
await P.page.waitForTimeout(200);
await refetch(Q.page);
await Q.page.waitForTimeout(300);
ok(await Q.page.isDisabled('[data-act="team-pick"][data-v="Charmander"]'), 'Sam sees Charmander taken');
await Q.page.tap('[data-act="team-pick"][data-v="Squirtle"]');
await Q.page.waitForTimeout(500);
await clearOverlays(Q.page);
ok(r2.event.roster.teams.find((t) => t.id === 'C').name === 'Squirtle', 'Sam\u2019s cart is Squirtle');
const taken = be.rpc.pick_team_name({ p_code: r2.code, p_device_id: await app(Q.page, () => JSON.parse(localStorage.getItem('glb.device'))), p_name: 'charmander' });
ok(taken.error === 'taken', 'the server refuses a name another cart has (any capitals)');
ok((await P.page.textContent('.hole-title')) === 'Hole 10', 'starting on 10: Enter opens on Hole 10');
await P.page.evaluate(() => localStorage.removeItem('glb.coach.oppcart3'));
await P.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="-1"]');
await P.page.tap('[data-act="tile-step"][data-pid="p2"][data-d="1"]');
await P.page.waitForTimeout(900);
const tip = await P.page.evaluate(() => document.querySelector('.coach')?.textContent || '');
ok(/enter scores for the other cart/i.test(tip), `your cart done: a tip points at their greyed cart (\u201c${tip.slice(0, 40)}\u2026\u201d)`);
if (tip) await P.page.tap('.coach');
const par10 = r2.event.course.par[9];
const s1 = be.tables.scores.find((x) => x.event_id === r2.id && x.player_id === 'p1' && x.hole === 10);
const s2 = be.tables.scores.find((x) => x.event_id === r2.id && x.player_id === 'p2' && x.hole === 10);
ok(s1?.strokes === par10, `first tap on an empty box is par, even on \u2212 (${s1?.strokes} on a par ${par10})`);
ok(s2?.strokes === par10, `\u2026and on + (${s2?.strokes})`);
const cartRatio = await P.page.evaluate(() => {
  const [a, b] = [...document.querySelectorAll('.cart')].map((c) => c.getBoundingClientRect().height);
  return a / (a + b);
});
ok(cartRatio > 0.75, `your cart is the big card (stacked rows), theirs one slim row (${Math.round(cartRatio * 100)}%)`);
await P.page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
const t0 = Date.now();
const push = async (pid, by, i) => {
  const row = { event_id: r2.id, player_id: pid, hole: 10, strokes: 4, updated_by: by, updated_at: new Date(t0 + i).toISOString() };
  be.tables.scores.push(row);
  await P.page.evaluate((row) => window.__glb._remote.score(row), row);
};
await push('p3', 'Mike', 1); // Mike plays with Andrew on 10
await P.page.waitForTimeout(1900);
ok(!(await toastText(P.page)), 'no toast for a score in your own foursome');
await push('p7', 'Chris', 2); // Chris is in the other foursome
await P.page.waitForTimeout(1900);
ok((await toastText(P.page)).includes('Chris 4'), 'toast for the other foursome\u2019s score');

// 8. Their cart: one slim row until tapped (Edit), then theirs is the big card and yours the slim
//    row; back by tapping yours (Back) or moving on
const shares = (page) => page.evaluate(() => {
  const [a, b] = [...document.querySelectorAll('.cart')].map((c) => c.getBoundingClientRect().height);
  return a / (a + b);
});
ok(!!(await P.page.$('.cart.opp.dim')) && !(await P.page.$('.cart.opp .step')), 'their cart starts as one slim row, with no − / +');
await P.page.tap('.cart.opp .face[data-pid="p4"]');
await P.page.waitForTimeout(400);
ok(!be.tables.scores.some((x) => x.event_id === r2.id && x.player_id === 'p4' && x.hole === 10), 'tapping it doesn\u2019t score anyone');
const even = await shares(P.page);
ok(!!(await P.page.$('.cart.mine.dim')) && !!(await P.page.$('.cart.opp.focus')) && even > 0.75, `tapped: theirs open as the big card, yours the slim row (${Math.round(even * 100)}%)`);
await P.page.tap('[data-act="tile-step"][data-pid="p4"][data-d="-1"]');
await P.page.waitForTimeout(900);
const s4 = be.tables.scores.find((x) => x.event_id === r2.id && x.player_id === 'p4' && x.hole === 10);
ok(s4?.strokes === par10, `entered their score while open (${s4?.strokes})`);
await P.page.tap('.cart.mine.dim');
await P.page.waitForTimeout(200);
const back = await shares(P.page);
ok(!!(await P.page.$('.cart.opp.dim')) && back > 0.75, `tap yours (Back): yours open again (${Math.round(back * 100)}%)`);
await P.page.tap('.cart.opp.dim');
await P.page.waitForTimeout(150);
await P.page.tap('.next-btn');
await P.page.waitForTimeout(400);
ok((await P.page.textContent('.hole-title')) === 'Hole 11' && !!(await P.page.$('.cart.opp.dim')), 'next hole opens on your cart again (theirs greyed)');

// 9. Two carts sweep holes 10–12: both streak headlines land on the same score
for (let i = be.tables.scores.length - 1; i >= 0; i--) if (be.tables.scores[i].event_id === r2.id) be.tables.scores.splice(i, 1);
const sweep = { p1: 3, p2: 3, p3: 6, p4: 6, p5: 3, p6: 3, p7: 6, p8: 6 }; // Charmander (A) and Squirtle (C) sweep
const base = Date.now() - 60000;
let n = 0;
for (const hole of [10, 11, 12]) for (const [pid, strokes] of Object.entries(sweep)) {
  const row = { event_id: r2.id, player_id: pid, hole, strokes, updated_by: 'x', updated_at: new Date(base + 1000 * n++).toISOString() };
  if (hole === 12 && pid === 'p8') continue; // the last score arrives live
  be.tables.scores.push(row);
}
await refetch(P.page);
await P.page.evaluate(() => window.__glb.go(window.__glb.tabHash('board')));
await P.page.waitForTimeout(300);
await P.page.evaluate(() => { document.getElementById('banners').innerHTML = ''; });
const lastRow = { event_id: r2.id, player_id: 'p8', hole: 12, strokes: 6, updated_by: 'Jake', updated_at: new Date(base + 1000 * n).toISOString() };
be.tables.scores.push(lastRow);
await P.page.evaluate((row) => window.__glb._remote.score(row), lastRow);
await P.page.waitForTimeout(700);
const bannersNow = await P.page.$$eval('#banners .headline-b', (els) => els.map((e) => [e.textContent.replace(/\s+/g, ' ').trim(), e.style.getPropertyValue('--jersey')]));
ok(bannersNow.length === 2, `two headlines at once show together (${bannersNow.map((b) => b[0]).join(' | ')})`);
ok(bannersNow[0]?.[0].startsWith('Charmander swept 3 straight') && bannersNow[0]?.[1] === 'var(--good)', 'your cart\u2019s headline is green on your phone');
ok(bannersNow[1]?.[0].startsWith('Squirtle swept 3 straight') && bannersNow[1]?.[1] === 'var(--t-C)', 'another cart\u2019s headline wears its away jersey (pink)');
const stripNow = await P.page.$$eval('.headlines.compact .headline', (els) => els.length);
ok(stripNow === 2, `Board strip shows both for now (${stripNow})`);
await P.page.waitForTimeout(10300);
const bannersLater = await P.page.$$eval('#banners .headline-b', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
const stripLater = await P.page.$$eval('.headlines.compact .headline', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
ok(bannersLater.length === 1 && bannersLater[0].startsWith('Charmander'), `a few seconds later: one banner (${bannersLater.join(' | ')})`);
ok(stripLater.length === 1, `and one headline on the Board (${stripLater.join(' | ')})`);
await P.page.tap('[data-act="board-headlines"]');
await P.page.waitForTimeout(300);
const feed = await P.page.$$eval('#sheet .headline', (els) => els.map((e) => e.style.getPropertyValue('--jersey')));
ok(feed.includes('var(--good)') && feed.includes('var(--t-C)'), `the full list is color-coded too (${feed.join(', ')})`);

// 10. The organizer's path, from a phone that has never seen the app
const O = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Organizer: ${e.message}`));
  return { ctx, page };
})();
await O.page.goto(`${srv.origin}/#/setup`);
await O.page.waitForTimeout(800);
await O.page.tap('[data-act="setup-mine"][data-v="twin-creeks-allen-tx"]');
await O.page.waitForTimeout(200);
for (const n of ['Andrew Duong', 'Justin Lee', 'Sean Baker', 'Mitchell Ray', 'Ryan Cole', 'Joseph Park', 'Chuck Wells', 'Peter Shaw']) {
  await O.page.fill('#new-player', n);
  await O.page.press('#new-player', 'Enter');
  await O.page.waitForTimeout(150);
}
await O.page.tap('[data-act="setup-go"][data-v="game"]');
ok(!(await O.page.$('[data-act="setup-game"][data-v="carts"][aria-disabled]')) && !!(await O.page.$('[data-act="setup-game"][data-v="2v2"][aria-disabled]')) && /Remove 4 players to play this/.test(await O.page.textContent('[data-act="setup-game"][data-v="2v2"]')),
  'Pick a game with 8: the cart game fits, 2v2 is greyed with the fix spelled out');
await O.page.tap('[data-act="setup-game"][data-v="carts"]');
await O.page.tap('[data-act="setup-go"][data-v="teams"]');
await O.page.waitForTimeout(200);
ok((await O.page.$$('.cart-card')).length === 4 && (await O.page.$$('.cart-card .swap-name')).length === 8, 'Cart game setup: 4 carts of 2, pre-paired');
await O.page.tap('[data-act="setup-swapsel"][data-i="1"]');
await O.page.tap('[data-act="setup-swapsel"][data-i="2"]');
ok((await O.page.textContent('.cart-card')).includes('Sean'), 'tap two names to swap: Sean is in cart A now');
await O.page.tap('[data-act="setup-save"]');
await O.page.waitForTimeout(800);
await O.page.tap('[data-act="setup-open"]');
await O.page.waitForTimeout(1200);
ok(/Watching/.test(await O.page.textContent('#content')) && /Who are you/.test(await O.page.textContent('#sheet')), 'Open the round \u2192 the round (watching) with \u201cWho are you?\u201d');
await O.page.locator('.who-btn', { hasText: 'Andrew' }).first().tap();
await O.page.waitForTimeout(900);
ok(/name your cart/i.test(await O.page.textContent('#overlay')) && !(await O.page.$('.coach')), 'picked Andrew \u2192 cart-name card, with no tip popping over it');
await O.page.tap('[data-act="team-later"]');
await O.page.waitForTimeout(500);
ok(!!(await O.page.$('.fullcard.brief')) && !(await O.page.$('.coach')), 'kept \u201cCart A\u201d \u2192 Today\u2019s game, still no tip on top');
await O.page.tap('[data-act="brief-done"]');
await O.page.waitForTimeout(500);
ok(!!(await O.page.$('.cart.mine')) && /dashed number is par/.test((await O.page.textContent('.coach').catch(() => '')) || ''), 'then Enter, and the first tip shows there');

// 10b. Names: first + last name required; a full name someone else already has asks for a
//      nickname; two Andrews in one round show as "Andrew D." / "Andrew S."; people + crew saved.
const N = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Names phone: ${e.message}`));
  return { ctx, page };
})();
await N.page.goto(`${srv.origin}/#/setup`);
await N.page.waitForTimeout(800);
await N.page.tap('[data-act="setup-mine"][data-v="twin-creeks-allen-tx"]');
await N.page.waitForTimeout(200);
await N.page.fill('#new-player', 'Sean');
await N.page.press('#new-player', 'Enter');
await N.page.waitForTimeout(300);
ok(/Add their last name too/.test(await N.page.textContent('body')) && !(await N.page.$('.player-row')), 'just a first name → “Add their last name too”, nobody added');
await N.page.fill('#new-player', 'andrew duong');
await N.page.press('#new-player', 'Enter');
await N.page.waitForTimeout(400);
ok(!!(await N.page.$('#new-nick')) && /already plays in another crew/.test(await N.page.textContent('.nick-ask')), 'Andrew Duong is taken (another crew) → asks for a nickname');
await N.page.screenshot({ path: 'tests/screenshots/setup-players-nickname.png' });
await N.page.fill('#new-nick', 'Drew');
await N.page.press('#new-nick', 'Enter');
await N.page.waitForTimeout(400);
await N.page.fill('#new-player', 'Andrew Smith');
await N.page.press('#new-player', 'Enter');
await N.page.waitForTimeout(400);
const rowsN = await N.page.$$eval('.player-row .pname', (els) => els.map((e) => e.innerText.trim()));
ok(rowsN.join(' | ') === 'Andrew Duong | Andrew Smith', `added with full names in Setup, no nickname shown when nobody shares the full name (${rowsN.join(' | ')})`);
await N.page.screenshot({ path: 'tests/screenshots/setup-players-names.png' });
await N.page.tap('[data-act="setup-go"][data-v="game"]');
ok(!!(await N.page.$('.game-opt.on[data-v="scorecard"]')), 'quick round: Scorecard only is preselected');
await N.page.tap('[data-act="setup-save"]');
await N.page.waitForTimeout(900);
const madeN = be.tables.events[be.tables.events.length - 1];
ok(madeN.roster.players.map((p) => p.name).join(',') === 'Andrew D.,Andrew S.' && madeN.roster.players[0].nickname === 'Drew' && madeN.roster.players[1].lastName === 'Smith',
  `in the round: “Andrew D.” / “Andrew S.”, full names kept (${madeN.roster.players.map((p) => p.name).join(', ')})`);
const peopleN = be.rpc.crew_people({ p_crew_id: madeN.crew_id }).people;
ok(peopleN.length === 2 && peopleN.some((p) => p.nickname === 'Drew') && peopleN.every((p) => p.lastName), 'both saved as people in the new crew (with last names)');
await N.ctx.close();

// 10c. Crew-mates from before last names: tap Sean and type his last name, or type
//      "josh reyes" → both stay the same person (season history kept), last names saved.
const LC = '3519327b-6bad-4467-b561-a6b01c111224';
const LIDS = ['eeae7a48-33fa-4052-ad0c-fc7623173fe6', '7ee08322-7d37-4dec-bb96-c9e781836500', '11be6384-781c-42c7-a574-b79e5767e431'];
const lr = be.rpc.create_event({ p_name: 'Bridlewood', p_course: { name: 'Bridlewood' }, p_roster: { teams: [], players: ['Andrew', 'Sean', 'Josh'].map((n, i) => ({ id: `p${i + 1}`, personId: LIDS[i], name: n })) }, p_settings: {}, p_played_on: '2026-10-20', p_crew_id: LC });
const L = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([code, crew]) => { localStorage.setItem('glb.recent', JSON.stringify([{ code, name: 'Bridlewood', played_on: '2026-10-20', crew_id: crew }])); }, [lr.code, LC]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Crew phone: ${e.message}`));
  return { ctx, page };
})();
await L.page.goto(`${srv.origin}/#/setup`);
await L.page.waitForTimeout(900);
await L.page.tap('[data-act="setup-mine"][data-v="twin-creeks-allen-tx"]');
await L.page.waitForTimeout(300);
await L.page.tap(`[data-act="setup-past"][data-v="${LIDS[1]}"]`);
await L.page.waitForTimeout(200);
ok(!!(await L.page.$('[data-input="setup-last"]')), 'a crew-mate from before last names gets a “Last name” box');
await L.page.fill('#new-player', 'josh reyes');
await L.page.press('#new-player', 'Enter');
await L.page.waitForTimeout(500);
await L.page.fill('[data-input="setup-last"]', 'mills');
await L.page.tap('.nr-title');
await L.page.tap('[data-act="setup-go"][data-v="game"]');
await L.page.tap('[data-act="setup-save"]');
await L.page.waitForTimeout(900);
const madeL = be.tables.events[be.tables.events.length - 1];
ok(madeL.crew_id === LC && madeL.roster.players.map((p) => `${p.personId}:${p.firstName} ${p.lastName}`).join(',') === `${LIDS[1]}:Sean Mills,${LIDS[2]}:Josh Reyes`,
  'Sean (tapped) and Josh (typed) are the same people as before, now with last names, same crew');
ok(JSON.stringify(be.rpc.crew_people({ p_crew_id: LC }).people.map((p) => [p.firstName, p.lastName, p.rounds])) === '[["Josh","Reyes",2],["Sean","Mills",2],["Andrew",null,1]]', 'crew list: 2 rounds each for Sean and Josh');
await L.ctx.close();

// 11b. "You first" Enter (≤4, no teams): your score is the hero card; the rest of your group are
//      rows saying where each score came from; tap a row → one-tap score pad that jumps to the next
//      player still waiting (car-ride mode).
const YP = ['Andrew', 'Sean', 'Sam', 'Jake'].map((n, i) => ({ id: `p${i + 1}`, personId: `yf${i}`, name: n, teamId: null, groupId: 'g1', strokes: null }));
const yr = be.rpc.create_event({ p_name: 'You first', p_course: { ...COURSES[0], tee: COURSES[0].tees[0] }, p_roster: { groups: [{ id: 'g1', name: 'Group 1' }], teams: [], players: YP }, p_settings: { game: 'none', solo: false, rotationMode: 'fixed' } });
const yev = be.tables.events.find((e) => e.code === yr.code);
const YDEV = '66666666-6666-4666-8666-666666666666';
be.tables.claims.push({ event_id: yev.id, player_id: 'p1', device_id: YDEV });
be.tables.scores.push({ event_id: yev.id, player_id: 'p3', hole: 1, strokes: 4, updated_by: 'Sam', updated_at: new Date().toISOString() });
const YF = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([code, dev]) => {
    localStorage.setItem('glb.device', JSON.stringify(dev));
    localStorage.setItem('glb.me.' + code, '"p1"');
    localStorage.setItem('glb.who.' + code, 'true');
    localStorage.setItem('glb.brief.' + code, 'true');
    for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true');
  }, [yr.code, YDEV]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`You-first phone: ${e.message}`));
  return { ctx, page };
})();
await YF.page.goto(`${srv.origin}/#/e/${yr.code}/enter`);
await YF.page.waitForTimeout(900);
const yText = async () => (await YF.page.textContent('.group-list')).replace(/\s+/g, ' ');
ok(!!(await YF.page.$('.you-card .you-badge')) && (await YF.page.$$('.grow')).length === 3, 'you first: your score is the hero card, the other three are rows');
ok(/From Sam’s phone/.test(await yText()) && /Waiting on Sean · tap to enter/.test(await yText()), `rows say where each score came from (${(await yText()).slice(0, 80)}…)`);
await YF.page.tap('[data-act="pad-toggle"][data-pid="p2"]');
await YF.page.waitForTimeout(300);
ok((await YF.page.$$('.grow.open .pad-chip')).length >= 5 && !!(await YF.page.$('.grow.open .pad-chip.par')), 'tap Sean → the score pad opens, par outlined');
const ypar = COURSES[0].par[0];
await YF.page.tap(`[data-act="pad-pick"][data-pid="p2"][data-v="${ypar + 1}"]`);
await YF.page.waitForTimeout(1000);
ok(be.tables.scores.find((x) => x.event_id === yev.id && x.player_id === 'p2' && x.hole === 1)?.strokes === ypar + 1, 'picked bogey for Sean: saved');
ok(!!(await YF.page.$('.grow.open [data-act="pad-pick"][data-pid="p4"]')), 'and the pad jumped to Jake (next one waiting)');
ok(/Entered by you · Sean can still edit/.test(await yText()), 'Sean’s row: “Entered by you · Sean can still edit”');
await YF.ctx.close();

// 11c. Matches: one segment per match; the other match expands IN PLACE (yours collapses to a
//      pinned green bar), and back.
const mr = seedRound(be, { holesPlayed: 9 });
const MDEV = '88888888-8888-4888-8888-888888888888';
be.tables.claims.push({ event_id: mr.id, player_id: 'p1', device_id: MDEV });
const MX = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([code, dev]) => {
    localStorage.setItem('glb.device', JSON.stringify(dev));
    localStorage.setItem('glb.me.' + code, '"p1"');
    localStorage.setItem('glb.who.' + code, 'true');
    localStorage.setItem('glb.brief.' + code, 'true');
    localStorage.setItem('glb.seen.' + code, JSON.stringify({ last: Date.now(), ids: [] }));
    for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true');
  }, [mr.code, MDEV]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Matches phone: ${e.message}`));
  return { ctx, page };
})();
await MX.page.goto(`${srv.origin}/#/e/${mr.code}/matches`);
await MX.page.waitForTimeout(900);
await clearOverlays(MX.page);
const segTxt = await MX.page.$$eval('[data-act="matches-rot"]', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
ok(segTxt.length === 3 && /MATCH 2 OF 3/.test(await MX.page.textContent('.m-kicker')) && /7–12 · LIVE/.test(segTxt[1]), `a segment per match (${segTxt.join(' | ')})`);
ok((await MX.page.$$('.mtable .mt-row:not(.mt-head)')).length === 6, 'Hole · Low Ball · Low Total · Pts: 6 rows');
await MX.page.tap('[data-act="match-expand"]');
await MX.page.waitForTimeout(400);
ok(!!(await MX.page.$('.mine-bar')) && !(await MX.page.$('.m-hero')) && /WATCHING/.test(await MX.page.textContent('.watch-box')) && !!(await MX.page.$('.watch-box .mtable')), 'tap the other match: yours collapses to the green bar, theirs opens in place (WATCHING)');
ok(/YOUR MATCH/.test(await MX.page.textContent('.mine-bar')) && (await MX.page.evaluate(() => window.__glb.route.tab)) === 'matches', 'still on Matches (no separate screen)');
await MX.page.tap('.mine-bar');
await MX.page.waitForTimeout(400);
ok(!!(await MX.page.$('.m-hero')) && !(await MX.page.$('.mine-bar')) && /ALSO/.test(await MX.page.textContent('.watch-box')), 'tap the bar: back to your match');
await MX.ctx.close();

// 11d. 2v2 (exactly 4): pick partners + switch every 6 → one foursome, pairings rotate, the
//      Board ranks the four players on their summed points.
const V = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(() => { for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true'); });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`2v2 phone: ${e.message}`));
  return { ctx, page };
})();
await V.page.goto(`${srv.origin}/#/setup`);
await V.page.waitForTimeout(800);
await V.page.tap('[data-act="setup-mine"][data-v="twin-creeks-allen-tx"]');
for (const n of ['Vic Abel', 'Wes Bond', 'Xan Cole', 'Yul Dorn']) {
  await V.page.fill('#new-player', n);
  await V.page.press('#new-player', 'Enter');
  await V.page.waitForTimeout(150);
}
await V.page.tap('[data-act="setup-go"][data-v="game"]');
await V.page.tap('[data-act="setup-game"][data-v="2v2"]');
await V.page.tap('[data-act="setup-go"][data-v="teams"]');
await V.page.tap('[data-act="setup-pairswitch"][data-v="six"]');
await V.page.tap('[data-act="setup-save"]');
await V.page.waitForTimeout(900);
const ve = be.tables.events[be.tables.events.length - 1];
ok(ve.settings.pairs === true && ve.settings.pairSwitch === 'six' && ve.roster.players.every((p) => p.groupId === 'g1' && !p.teamId), '2v2 saved: one foursome, partners switch every 6');
for (let h = 1; h <= 7; h++) for (const p of ve.roster.players) be.tables.scores.push({ event_id: ve.id, player_id: p.id, hole: h, strokes: p.id === 'p1' ? 3 : 5, updated_by: p.name, updated_at: new Date(Date.now() + h).toISOString() });
await V.page.goto(`${srv.origin}/#/e/${ve.code}/board`);
await V.page.waitForTimeout(1200);
await clearOverlays(V.page);
const vrows = await V.page.$$eval('.team-row .row-title', (els) => els.map((e) => e.textContent.trim()));
ok(vrows.length === 4 && vrows[0].startsWith('Vic') && /Points/.test(await V.page.textContent('.board-segs')), `2v2 Board: the four players ranked on points (${vrows.join(', ')})`);
await V.page.goto(`${srv.origin}/#/e/${ve.code}/matches`);
await V.page.waitForTimeout(800);
const vsegs = await V.page.$$eval('[data-act="matches-rot"]', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
ok(vsegs.length === 3, `Matches: a segment per pairing (${vsegs.join(' | ')})`);
await V.ctx.close();

// 12. Every box needs a score: Next hole waits, points at who's missing, never saves par on its own
const r3 = seedRound(be);
const DEV3 = '33333333-3333-4333-8333-333333333333';
be.tables.claims.push({ event_id: r3.id, player_id: 'p1', device_id: DEV3 });
const F = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([code, dev]) => {
    localStorage.setItem('glb.device', JSON.stringify(dev));
    localStorage.setItem('glb.me.' + code, '"p1"');
    localStorage.setItem('glb.who.' + code, 'true');
    localStorage.setItem('glb.brief.' + code, 'true');
    for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true');
  }, [r3.code, DEV3]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Par phone: ${e.message}`));
  return { ctx, page };
})();
await F.page.goto(`${srv.origin}/#/e/${r3.code}/enter`);
await F.page.waitForTimeout(900);
const par1 = r3.event.course.par[0];
const ghosts = await F.page.$$eval('.tile .mk-ghost', (els) => els.map((e) => e.textContent.trim()));
ok(ghosts.length === 2 && ghosts.every((g) => g === String(par1)), `blank rows show a dashed ghost of par (${ghosts.join(', ')})`);
await F.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="1"]'); // Andrew: first tap = par…
await F.page.waitForTimeout(150);
ok((await F.page.evaluate(() => window.__glb.scoreOf('p1', 1))) === par1, 'first tap on + is par, not bogey');
await F.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="1"]'); // …second tap = bogey
await F.page.waitForTimeout(800);
const nextText = async () => (await F.page.textContent('.next-btn')).replace(/\s+/g, ' ').trim();
ok(/Next hole · 3 scores left/.test(await nextText()) && !!(await F.page.$('.next-btn.waiting')), `blanks left: the button waits and says how many (“${await nextText()}”)`);
be.tables.scores.push({ event_id: r3.id, player_id: 'p3', hole: 1, strokes: 7, updated_by: 'Mike', updated_at: new Date().toISOString() }); // Mike's 7 already on the server
await F.page.tap('.next-btn');
await F.page.waitForTimeout(250);
const at = (pid) => be.tables.scores.find((x) => x.event_id === r3.id && x.player_id === pid && x.hole === 1)?.strokes;
ok((await F.page.textContent('.hole-title')) === 'Hole 1' && at('p2') == null && at('p4') == null, 'Next with blanks: stays on hole 1 and saves nobody at par');
ok(/Still need/.test(await toastText(F.page)) && (await F.page.$$('.cart.focus .tile.empty.nudge')).length > 0, `it points at the empty boxes (“${await toastText(F.page)}”)`);
await F.page.waitForTimeout(1200);
ok((await F.page.evaluate(() => window.__glb.scoreOf('p3', 1))) === 7 && /Sean, Tyler left/.test(await nextText()), `and pulls the latest: Mike’s 7 from his phone shows up, “Sean, Tyler left” (${await nextText()})`);
await F.page.tap('.cart.mine .face[data-pid="p2"]'); // Sean: par
await F.page.waitForTimeout(300);
await F.page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
await F.page.tap('.next-btn');
await F.page.waitForTimeout(400);
ok(!!(await F.page.$('.sheet.even .cart.opp.focus')) && /Tyler/.test(await toastText(F.page)), `only their cart is missing one: Next opens their cart and names him (“${await toastText(F.page)}”)`);
await F.page.tap('.cart.opp .face[data-pid="p4"]');
await F.page.waitForTimeout(300);
ok(/^Next hole →$/.test(await nextText()) && !(await F.page.$('.next-btn.waiting')), `all four in: “${await nextText()}”`);
await F.page.tap('.next-btn');
await F.page.waitForTimeout(1200);
ok(at('p1') === par1 + 1 && at('p2') === par1 && at('p3') === 7 && at('p4') === par1, `hole 1 saved as tapped (${at('p1')}, ${at('p2')}, ${at('p3')}, ${at('p4')})`);
ok((await F.page.textContent('.hole-title')) === 'Hole 2', 'on to hole 2');

// 13. Hole grid + locked holes: look back at any hole; two or more back needs a tap to edit
for (let i = 0; i < 2; i++) { await playHole(F.page); await F.page.waitForTimeout(600); await clearOverlays(F.page); }
ok((await F.page.textContent('.hole-title')).startsWith('Hole 4'), 'played 2 and 3 → hole 4');
await F.page.tap('[data-act="hole-prev"]');
await F.page.waitForTimeout(200);
ok(!(await F.page.$('.cart.locked')) && !!(await F.page.$('.cart.mine .step')) && /Next hole/.test(await F.page.textContent('.next-btn')), 'one hole back (3): still editable, Next hole');
await F.page.tap('[data-act="hole-prev"]');
await F.page.waitForTimeout(200);
ok(!!(await F.page.$('.cart.mine.locked')) && !(await F.page.$('.cart.mine .step')) && /Back to hole 4/.test(await F.page.textContent('.next-btn')), 'two back (2): locked, no \u2212 / +, \u201cBack to hole 4\u201d');
await F.page.tap('.cart.mine.locked .face[data-pid="p1"]');
await F.page.waitForTimeout(200);
ok(!!(await F.page.$('.cart.mine .step')) && !(await F.page.$('.cart.mine.locked')), 'tap the box \u2192 unlocked for editing');
await F.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="-1"]');
await F.page.waitForTimeout(900);
const par2 = r3.event.course.par[1];
ok(be.tables.scores.find((x) => x.event_id === r3.id && x.player_id === 'p1' && x.hole === 2)?.strokes === par2 - 1, 'edit on the unlocked hole saves (birdie on 2)');
await F.page.tap('[data-act="hole-grid"]');
await F.page.waitForTimeout(400);
const grid = await F.page.evaluate(() => ({
  cells: document.querySelectorAll('#sheet .hg-cell').length,
  now: document.querySelector('#sheet .hg-cell.now .hg-n')?.textContent,
  ahead: document.querySelector('#sheet .hg-cell[data-v="5"]')?.disabled,
  h1: document.querySelector('#sheet .hg-cell[data-v="1"] .score')?.className,
  label: document.querySelector('#sheet .hg-label')?.textContent,
}));
ok(grid.cells === 18 && grid.now === '4' && grid.ahead === true, `tap the hole number \u2192 grid of 18, hole 4 is \u201cNow\u201d, can\u2019t jump ahead`);
ok(/score b/.test(grid.h1 || '') && /Holes 1–6 · vs/.test(grid.label || ''), `grid shows your bogey on 1 and the matchup per row (${grid.label})`);
await F.page.tap('#sheet .hg-cell[data-v="1"]');
await F.page.waitForTimeout(300);
ok((await F.page.textContent('.hole-title')).startsWith('Hole 1') && !!(await F.page.$('.cart.mine.locked')), 'tap hole 1 \u2192 Enter shows hole 1, locked');
await F.page.tap('[data-act="hole-current"]');
await F.page.waitForTimeout(200);
ok((await F.page.textContent('.hole-title')).startsWith('Hole 4'), 'Back to hole 4');

// 14. Final: a big card on the Board opens the recap — four keepsake images to save or share
const r4 = seedRound(be, { holesPlayed: 18 });
const DEV4 = '44444444-4444-4444-8444-444444444444';
be.tables.claims.push({ event_id: r4.id, player_id: 'p1', device_id: DEV4 });
const R = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([code, dev]) => {
    localStorage.setItem('glb.device', JSON.stringify(dev));
    localStorage.setItem('glb.me.' + code, '"p1"');
    localStorage.setItem('glb.who.' + code, 'true');
    localStorage.setItem('glb.brief.' + code, 'true');
    localStorage.setItem('glb.seen.' + code, JSON.stringify({ last: Date.now(), ids: [] }));
    for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true');
  }, [r4.code, DEV4]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Recap phone: ${e.message}`));
  return { ctx, page };
})();
await R.page.goto(`${srv.origin}/#/e/${r4.code}/board`);
await R.page.waitForTimeout(1000);
await clearOverlays(R.page);
const fc = await R.page.evaluate(() => document.querySelector('.final-card')?.innerText.replace(/\s+/g, ' ').trim() || '');
ok(/Final/i.test(fc) && /win the day/.test(fc) && /Round recap/.test(fc), `round over \u2192 big final card on the Board (${fc.slice(0, 70)}\u2026)`);
ok(!(await R.page.$('.headlines.compact')), 'the final headline isn\u2019t repeated under it');
await R.page.tap('[data-act="recap-open"]');
await R.page.waitForSelector('.recap-img', { timeout: 8000 });
await R.page.waitForTimeout(300);
const recapImgs = await R.page.$$eval('.recap-img', (els) => els.map((e) => [e.alt, e.naturalWidth, e.naturalHeight]));
ok(recapImgs.length === 4 && recapImgs.every(([, w, h]) => w === 1080 && h > 900), `recap: ${recapImgs.map(([a, w, h]) => `${a} ${w}×${h}`).join(', ')}`);
ok((await R.page.evaluate(() => document.querySelectorAll('.brief-dots i').length)) === 4, 'four cards to swipe through');
await R.page.evaluate(() => { const t = document.querySelector('.recap .brief-track'); t.scrollTo({ left: t.clientWidth, behavior: 'auto' }); });
await R.page.waitForTimeout(300);
const [dl] = await Promise.all([R.page.waitForEvent('download', { timeout: 6000 }).catch(() => null), R.page.tap('[data-act="recap-save"]')]);
ok(!!dl && /scorecard|-me\.png$/.test(dl.suggestedFilename()), `Save or share \u2192 a PNG of the card you\u2019re on (${dl?.suggestedFilename() || 'none'})`);
await R.page.tap('[data-act="recap-close"]');
await R.page.waitForTimeout(200);
await R.page.tap('[data-act="round-menu"]');
await R.page.waitForTimeout(400);
ok(/Round recap/.test(await R.page.textContent('#sheet')), 'the round menu has Round recap too');

// 11. Never a blank screen
const S = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 548 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(() => { window.__glbLoadTimeout = 2000; localStorage.setItem('glb.who.x', 'true'); });
  const page = await ctx.newPage();
  page.errors = [];
  return { ctx, page };
})();
await S.page.goto(`${srv.origin}/#/`);
await S.page.waitForTimeout(600);
be.stall = true;
await S.page.evaluate((code) => window.__glb.go(`#/e/${code}/board`), r2.code);
await S.page.waitForTimeout(400);
ok(/Opening/.test(await S.page.textContent('#content')), `stalled connection: \u201cOpening ${r2.code}\u2026\u201d, not a blank screen`);
await S.page.waitForTimeout(2200);
ok(/No signal/.test(await S.page.textContent('#content')) && !!(await S.page.$('[data-act="retry-load"]')), 'gives up after a while: \u201cNo signal\u201d + Try again');
be.stall = false;
await S.page.tap('[data-act="retry-load"]');
await S.page.waitForTimeout(900);
ok(/Charmander|Squirtle/.test(await S.page.textContent('#content')), 'Try again loads the round');
await S.page.evaluate(() => { window.__glb.snapshot = { broken: true }; window.__glb.render(); });
await S.page.waitForTimeout(200);
ok(/Something went wrong/.test(await S.page.textContent('#content')) && !!(await S.page.$('[data-act="reload"]')), 'a drawing error shows \u201cSomething went wrong\u201d + Reload (and the error text)');

// 15. Finalize: a finished round opens on the Board; the organizer finalizes it, which locks every
//     score (server and screen); the organizer PIN unlocks a phone to fix one; Host can reopen.
const r5 = seedRound(be, { holesPlayed: 18 });
const DEV5 = '55555555-5555-4555-8555-555555555555';
be.tables.claims.push({ event_id: r5.id, player_id: 'p1', device_id: DEV5 });
async function presetPhone(label, code, { dev, me, pin } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([c, d, m, p]) => {
    if (d) localStorage.setItem('glb.device', JSON.stringify(d));
    if (m) localStorage.setItem('glb.me.' + c, JSON.stringify(m));
    if (p) localStorage.setItem('glb.admin.' + c, JSON.stringify(p));
    localStorage.setItem('glb.who.' + c, 'true');
    localStorage.setItem('glb.brief.' + c, 'true');
    localStorage.setItem('glb.seen.' + c, JSON.stringify({ last: Date.now(), ids: [] }));
    for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true');
  }, [code, dev || null, me || null, pin || null]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${label}: ${e.message}`));
  return { ctx, page };
}
const X = await presetPhone('Final player', r5.code, { dev: DEV5, me: 'p1' });
await X.page.goto(`${srv.origin}/#/e/${r5.code}`);
await X.page.waitForTimeout(1000);
await clearOverlays(X.page);
ok((await X.page.evaluate(() => location.hash)).endsWith('/board') && !!(await X.page.$('.final-card')), 'opening a finished round lands on the Board (final card), not Enter');
ok(/until the organizer finalizes/.test((await X.page.textContent('.final-note').catch(() => '')) || ''), 'players see that scores can be fixed until the organizer finalizes');
const Y = await presetPhone('Organizer', r5.code, { pin: r5.admin_pin });
await Y.page.goto(`${srv.origin}/#/e/${r5.code}/board`);
await Y.page.waitForTimeout(1000);
await clearOverlays(Y.page);
await Y.page.tap('[data-act="board-finalize"]');
await Y.page.waitForTimeout(400);
ok(/Finalize the round\?/.test(await Y.page.textContent('#sheet')), 'organizer: Finalize round asks first');
await Y.page.tap('[data-act="confirm-ok"]');
await Y.page.waitForTimeout(900);
const ev5 = be.tables.events.find((x) => x.id === r5.id);
ok(!!ev5.finalized_at && /locked/i.test(await Y.page.textContent('.final-card')) && !(await Y.page.$('[data-act="board-finalize"]')), 'finalized on the server; the final card says locked');
ok(be.rpc.upsert_score({ p_code: r5.code, p_device_id: DEV5, p_player_id: 'p1', p_hole: 18, p_strokes: 3 }).error === 'finalized', 'the server refuses a player’s score change once final');
await X.page.evaluate((at) => window.__glb._remote.event({ finalized_at: at }), ev5.finalized_at);
await X.page.waitForTimeout(400);
ok(/The round is final/.test(await toastText(X.page)), 'other phones hear it: “The round is final”');
await Y.page.tap('[data-act="tab"][data-v="enter"]');
await Y.page.waitForTimeout(400);
ok(!!(await Y.page.$('.final-lock')) && (await Y.page.evaluate(() => window.__glb.setScore('p1', 18, 3))) === false, 'the organizer’s phone locks too once final');
await Y.page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
await Y.page.tap('[data-act="pin-open"]');
await Y.page.waitForTimeout(400);
ok(!(await Y.page.$('.final-lock')) && !(await Y.page.$('#sheet .panel')) && /Unlocked/.test(await toastText(Y.page)), 'organizer: Fix a score unlocks in one tap (PIN already on the phone)');
await Y.page.tap('[data-act="final-relock"]');
await Y.page.waitForTimeout(300);
ok(!!(await Y.page.$('.final-lock')), 'Done \u2192 locked again');
await X.page.tap('[data-act="tab"][data-v="enter"]');
await X.page.waitForTimeout(400);
ok(!!(await X.page.$('.final-lock')) && !(await X.page.$('.tile .step')) && !!(await X.page.$('[data-act="pin-open"]')), 'Enter: “Final”, no score boxes, “Fix a score (organizer PIN)”');
ok((await X.page.evaluate(() => window.__glb.setScore('p1', 18, 3))) === false && /round is final/i.test(await toastText(X.page)), 'any other way in (Card, grid) is refused on the phone too');
await X.page.tap('[data-act="pin-open"]');
await X.page.waitForTimeout(400);
await X.page.fill('#pin-unlock', '0000' === r5.admin_pin ? '1111' : '0000');
await X.page.tap('[data-act="pin-unlock"]');
await X.page.waitForTimeout(400);
ok(/didn’t work/.test(await toastText(X.page)) && !!(await X.page.$('#sheet .panel')), 'wrong PIN: “That PIN didn’t work”, still locked');
await X.page.fill('#pin-unlock', r5.admin_pin);
await X.page.tap('[data-act="pin-unlock"]');
await X.page.waitForTimeout(600);
ok(!(await X.page.$('.final-lock')) && !!(await X.page.$('.cart.mine .tile .step')) && /Fixing a finalized round/.test(await X.page.textContent('.matchup-line')), 'right PIN: the score boxes come back, marked \u201cFixing a finalized round\u201d');
const before18 = be.tables.scores.find((x) => x.event_id === r5.id && x.player_id === 'p1' && x.hole === 18).strokes;
await X.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="1"]');
await X.page.waitForTimeout(900);
const s18 = be.tables.scores.find((x) => x.event_id === r5.id && x.player_id === 'p1' && x.hole === 18);
ok(s18.strokes === before18 + 1 && s18.updated_by === 'Organizer', `fixed a score with the PIN while final (${before18} → ${s18.strokes}, by ${s18.updated_by})`);
await Y.page.tap('.host-btn');
await Y.page.waitForTimeout(500);
await Y.page.tap('[data-act="host-reopen"]');
await Y.page.waitForTimeout(300);
await Y.page.tap('[data-act="confirm-ok"]');
await Y.page.waitForTimeout(800);
ok(!ev5.finalized_at && !!(await Y.page.$('[data-act="host-finalize"]')), 'Host: Reopen round unlocks it (and offers Finalize again)');
be.rpc.finalize_round({ p_code: r5.code, p_admin_pin: r5.admin_pin });
const Z = await presetPhone('Late phone', r5.code, {});
await Z.page.goto(`${srv.origin}/#/e/${r5.code}/enter`);
await Z.page.waitForTimeout(1000);
ok((await Z.page.evaluate(() => location.hash)).endsWith('/board'), 'a finalized round opens on the Board even from an old Enter link');
ok(be.rpc.reset_round({ p_code: r5.code, p_admin_pin: r5.admin_pin }).ok && !ev5.finalized_at, 'Reset scores also reopens a finalized round');

// 16. Add a course: Setup's Course step finds courses near the phone (OpenGolfAPI, here through
//     the Supabase backup route because the direct one is "blocked"), searches by name, loads
//     the scorecard in the background, and Save won't go until the card is complete. The
//     group's corrected card is reused next time. Can't find it: enter it yourself.
const fx = OGA_FIXTURES;
be.oga.blocked = true;
be.oga.calls.length = 0;
const G = await (async () => {
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true,
    geolocation: { latitude: 33.1084, longitude: -96.7181 }, permissions: ['geolocation'],
  });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(() => { for (const k of ['tile5', 'prov2', 'oppcart3']) localStorage.setItem('glb.coach.' + k, 'true'); });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Course phone: ${e.message}`));
  return { ctx, page };
})();
const listText = () => G.page.evaluate(() => document.getElementById('course-results')?.innerText.replace(/\s+/g, ' ').trim() || '');
await G.page.goto(`${srv.origin}/#/setup`);
await G.page.waitForTimeout(1200);
const nearText = await listText();
ok(/^Looks like you’re at The Golf Club at Twin Creeks Allen, TX · here · checked/i.test(nearText) && !!(await G.page.$('.here-list [data-act="setup-mine"][data-v="twin-creeks-allen-tx"]')), `standing at Twin Creeks → it's on top ("Looks like you're at"), ready to tap (${nearText.slice(0, 80)}…)`);
ok(/Near you.*Mesquite Hollow.*1\.4 mi.*Cedar Bend.*6\.9 mi/i.test(nearText) && (nearText.match(/Twin Creeks/g) || []).length === 1, `courses near you load on their own (no button), nearest first, Twin Creeks not listed twice (${nearText.slice(0, 120)}…)`);
ok(!!(await G.page.$('[data-act="setup-pick"][data-v="' + fx.pecanNine.id + '"][disabled]')) && /9 holes/.test(nearText), 'a 9-hole course shows but can’t be picked yet');
ok(be.oga.calls[0]?.via === 'direct' && be.oga.calls.some((c) => c.via === 'proxy'), 'direct route blocked → it went through the Supabase backup route');
ok(/OpenStreetMap contributors/.test(nearText), 'the OpenStreetMap / OpenGolfAPI credit is shown');
await G.page.fill('#course-q', 'cedar');
await G.page.waitForTimeout(900);
const cedar = await listText();
ok(/Cedar Bend/.test(cedar) && !/Mesquite/.test(cedar) && (await G.page.evaluate(() => document.activeElement?.id)) === 'course-q', 'search by name: results update while you type (the box keeps focus)');
await G.page.fill('#course-q', 'mesquite');
await G.page.waitForTimeout(900);
await G.page.tap(`[data-act="setup-pick"][data-v="${fx.mesquiteHollow.id}"]`);
await G.page.waitForTimeout(900);
const picked = await G.page.textContent('#content');
ok(/Mesquite Hollow/.test(picked) && /to fix on the card/.test(picked) && (await G.page.evaluate(() => window.__glb.setup.screen)) === 'players', 'picked it → on to Players; the card line says it needs fixing (loaded in the background)');
for (const n of ['Andy Hall', 'Jay Lin', 'Shawn Bell', 'Mitch Ford', 'Rob Kim', 'Joe Diaz', 'Charlie Webb', 'Pete Ross']) {
  await G.page.fill('#new-player', n);
  await G.page.press('#new-player', 'Enter');
  await G.page.waitForTimeout(150);
}
await G.page.tap('[data-act="setup-go"][data-v="game"]');
await G.page.tap('[data-act="setup-game"][data-v="carts"]');
await G.page.tap('[data-act="setup-go"][data-v="teams"]');
await G.page.tap('[data-act="setup-save"]');
await G.page.waitForTimeout(300);
ok((await G.page.evaluate(() => window.__glb.setup.screen)) === 'check' && /Not ready yet/.test(await toastText(G.page)) && !!(await G.page.$('.sc-status.warn')) && await G.page.isDisabled('.nr-cta'),
  'Start with a broken card: no round; it opens the Scorecard check (amber, can’t continue)');
const teeNames = await G.page.$$eval('[data-act="setup-tee"]', (els) => els.map((e) => e.dataset.v));
ok(teeNames.join(',') === 'Black,White (M),White (W)', `tees from the course (${teeNames.join(', ')})`);
await G.page.tap('[data-act="setup-tee"][data-v="Black"]');
const si = [7, 11, 17, 1, 5, 13, 15, 3, 9, 8, 2, 18, 4, 12, 10, 16, 14, 6];
for (let i = 0; i < 18; i++) await G.page.fill(`[data-input="setup-scsi"][data-i="${i}"]`, String(si[i]));
await G.page.tap('.nr-title');
await G.page.waitForTimeout(300);
ok(!(await G.page.isDisabled('.nr-cta')) && /All good · par 72 · hole handicaps 1–18/.test(await G.page.textContent('.sc-status')), 'filled in the 18 hole handicaps → “All good”, Looks right is on');
await G.page.tap('.nr-cta');
await G.page.waitForTimeout(200);
ok(/Card ready · par 72/.test(await G.page.textContent('.nr-course')), 'back on Players: ✓ Card ready');
await G.page.tap('[data-act="setup-go"][data-v="game"]');
await G.page.tap('[data-act="setup-go"][data-v="teams"]');
await G.page.tap('[data-act="setup-save"]');
await G.page.waitForTimeout(900);
const made = be.tables.events[be.tables.events.length - 1];
ok(made.course.id === `oga:${fx.mesquiteHollow.id}` && made.course.shortName === 'Mesquite Hollow' && made.course.tee?.name === 'Black' && made.course.source === 'opengolfapi', `the round has the course (${made.course.shortName}, ${made.course.tee?.name} tees)`);
ok(JSON.stringify(made.course.strokeIndex) === JSON.stringify(si) && made.course.par.reduce((a, b) => a + b, 0) === 72 && made.course.tees.length === 3, 'with the pars, your hole handicaps and its tees');
ok(!!(await G.page.$('.live-check')) && /Round is live/.test(await G.page.textContent('#content')) && /Organizer only/.test(await G.page.textContent('.secret')), 'Round is live: join code + the organizer-only box');
// Next round: the group's corrected card comes back instantly, no lookup.
be.oga.calls.length = 0;
await G.page.evaluate(() => { localStorage.removeItem('glb.setupDraft'); });
await G.page.goto(`${srv.origin}/#/`);
await G.page.waitForTimeout(500);
await G.page.goto(`${srv.origin}/#/setup`);
await G.page.waitForTimeout(1200);
ok(/Mesquite Hollow.*played before/.test(await listText()), 'next round: Mesquite Hollow is in Your courses (played before)');
await G.page.tap(`[data-act="setup-mine"][data-v="oga:${fx.mesquiteHollow.id}"]`);
await G.page.waitForTimeout(300);
ok(/Card ready · par 72/.test(await G.page.textContent('.nr-course')) && !be.oga.calls.some((c) => c.url.includes(fx.mesquiteHollow.id)), 'picked it → ready right away with your hole handicaps, no lookup');
await G.page.tap('.nc-main');
await G.page.waitForTimeout(200);
ok(/From your group’s last round/.test(await G.page.textContent('.sc-tags')), 'Scorecard check says where the card came from (your group’s last round)');
await G.page.tap('#topbar [data-act="setup-go"]');
// Enter it yourself
await G.page.tap('[data-act="setup-unpick"]');
await G.page.waitForTimeout(200);
await G.page.tap('[data-act="setup-manual"]');
await G.page.waitForTimeout(300);
ok(!!(await G.page.$('#course-name')) && await G.page.isDisabled('.nr-cta') && /0 of 18 holes filled in/.test(await G.page.textContent('.sc-status')) && /18 holes left/.test(await G.page.textContent('.nr-cta')),
  'Enter the scorecard yourself: a name box and an empty card (“0 of 18 holes filled in”)');
await G.page.tap('#topbar [data-act="setup-go"]');
await G.page.waitForTimeout(150);
await G.page.tap('[data-act="setup-unpick"]');
await G.page.waitForTimeout(200);
// Multi-course club: one listing with two courses mixed → "Which course?", named once, saved as its own pick
await G.page.fill('#course-q', 'oak twins');
await G.page.waitForTimeout(900);
await G.page.tap(`[data-act="setup-pick"][data-v="${fx.oakTwins.id}"]`);
await G.page.waitForTimeout(900);
ok(/This club has 2 courses · tap to pick one/.test(await G.page.textContent('.nr-course')), 'a club with 2 courses mixed together: the card line says pick one');
await G.page.tap('.nc-main');
await G.page.waitForTimeout(200);
const opts = await G.page.$$eval('.which-pick', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
ok(opts.length === 2 && /Course 1 par 72 Hole 1 par 4 · Hole 18 par 4/.test(opts[0]) && /Course 2 par 72 Hole 1 par 5 · Hole 18 par 5/.test(opts[1]), `Which course?: each with its par and holes 1 + 18 (${opts.join(' | ')})`);
ok(await G.page.isDisabled('.nr-cta'), 'nothing picked yet: can’t continue');
await G.page.tap('[data-act="setup-which"][data-v="2"]');
await G.page.fill('#which-name', 'East');
await G.page.tap('.nr-cta');
await G.page.waitForTimeout(200);
const oc = await G.page.evaluate(() => window.__glb.setup.course);
ok(oc.id.endsWith('#2') && oc.shortName === 'Oak Twins · East' && oc.par[0] === 5 && oc.strokeIndex[0] === 18 && !oc.variants, `picked Course 2, named it East: its own card (${oc.shortName}, hole 1 par ${oc.par[0]})`);
ok(/Oak Twins · East/.test(await G.page.textContent('.nr-course')) && /Card ready/.test(await G.page.textContent('.nr-course')), 'back on Players with “Oak Twins · East” and its card ready');
await G.page.tap('[data-act="setup-unpick"]');
await G.page.waitForTimeout(200);
// No signal at all
be.oga.down = true;
await G.page.fill('#course-q', 'zzz');
await G.page.waitForTimeout(1000);
ok(/Couldn’t reach course search/.test(await listText()) && !!(await G.page.$('[data-act="setup-search-retry"]')), 'no signal: “Couldn’t reach course search” + Try again');
be.oga.down = false;
be.oga.blocked = false;

// 16b. Location blocked by the phone: say how to turn it on (iPhone steps) + Try again.
const NL = await (async () => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1',
  });
  await attach(ctx, be, srv.origin);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`No-location phone: ${e.message}`));
  return { ctx, page };
})();
await NL.page.goto(`${srv.origin}/#/setup`);
await NL.page.waitForTimeout(800);
const locMsg = (await NL.page.textContent('#course-results')).replace(/\s+/g, ' ');
ok(/blocking location/.test(locMsg) && /Safari Websites/.test(locMsg) && /Website Settings/.test(locMsg) && !!(await NL.page.$('#course-results [data-act="setup-near"]')), 'location blocked: asked on open, then iPhone steps to turn it on + Try again');

// 17. Test phones (sim.html): make a practice round, 8 phones each signed in as their own player,
//     "Play a hole" enters a score on every phone and moves them on, "Other group only" puts one
//     foursome ahead (provisional points), Delete cleans it up.
const T = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await attach(ctx, be, srv.origin);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Test phones: ${e.message}`));
  return { ctx, page };
})();
const nEvents = be.tables.events.length;
await T.page.goto(`${srv.origin}/sim.html`);
await T.page.waitForTimeout(500);
await T.page.click('#make');
await T.page.waitForTimeout(4500);
const pr = be.tables.events[be.tables.events.length - 1];
ok(be.tables.events.length === nEvents + 1 && /^Practice/.test(pr.name) && pr.crew_id && !be.tables.events.slice(0, -1).some((e) => e.crew_id === pr.crew_id), `practice round made (${pr.name}), on its own crew so Season standings stay clean`);
const prClaims = be.tables.claims.filter((c) => c.event_id === pr.id);
ok(prClaims.length === 8 && new Set(prClaims.map((c) => c.device_id)).size === 8, '8 phones, 8 different devices, each signed in as its own player');
const phoneFrame = (i) => T.page.frames().find((f) => new RegExp(`[?&]sim=${i}(#|&|$)`).test(f.url()));
const titleOf = async (i) => (await phoneFrame(i)?.textContent('.hole-title').catch(() => '')) || '';
ok((await titleOf(1)).startsWith('Hole 1') && (await titleOf(8)).startsWith('Hole 1'), 'every phone opens on Enter, hole 1 (no join cards in the way)');
ok(!!(await phoneFrame(1).evaluate(() => window.__glb.isOrganizer())) && !(await phoneFrame(2).evaluate(() => window.__glb.isOrganizer())), 'phone 1 is the organizer, the others aren’t');
await T.page.click('#play-all');
await T.page.waitForTimeout(4500);
const h1 = be.tables.scores.filter((x) => x.event_id === pr.id && x.hole === 1 && x.strokes != null);
ok(h1.length === 8 && new Set(h1.map((x) => x.updated_by)).size === 8, `Play a hole: all 8 entered hole 1 from their own phone (${h1.map((x) => x.strokes).join(' ')})`);
ok((await titleOf(1)).startsWith('Hole 2') && (await titleOf(5)).startsWith('Hole 2'), '…and every phone moved on to hole 2');
await T.page.click('#play-other');
await T.page.waitForTimeout(4500);
const h2 = be.tables.scores.filter((x) => x.event_id === pr.id && x.hole === 2 && x.strokes != null);
const prov = await phoneFrame(1).evaluate(() => window.__glb.snapshot.game.liveStandings.some((s) => s.provisionalPoints > 0));
ok(h2.length === 4 && prov && (await titleOf(1)).startsWith('Hole 2') && (await titleOf(5)).startsWith('Hole 3'), 'Other group only: that foursome plays hole 2 and goes ahead (provisional points on the Board)');
T.page.once('dialog', (d) => d.accept());
await T.page.click('#delete');
await T.page.waitForTimeout(800);
ok(!be.tables.events.some((e) => e.id === pr.id) && !(await T.page.$('.frame')), 'Delete round: gone, phones cleared');
ok(!(await T.page.evaluate(() => Object.keys(localStorage).some((k) => /^sim\d+\..*\.[A-Z0-9]{5}$/.test(k) && k.includes('glb.me.')))), 'the test phones forget the deleted round');

// 17b. Test phones on a phone: one full-size test phone, buttons 1–8 to switch, Play a hole still
//      plays all 8.
const TP = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Test phones (phone): ${e.message}`));
  return { ctx, page };
})();
await TP.page.goto(`${srv.origin}/sim.html`);
await TP.page.waitForTimeout(500);
await TP.page.tap('#make');
await TP.page.waitForTimeout(4500);
const pr2 = be.tables.events[be.tables.events.length - 1];
const visibleFrames = () => TP.page.$$eval('.phone', (els) => els.map((e, k) => (getComputedStyle(e).display !== 'none' ? k + 1 : 0)).filter(Boolean));
const frameBox = await TP.page.$eval('.phone.on .frame', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.bottom)]; });
ok(JSON.stringify(await visibleFrames()) === '[1]' && frameBox[0] === 390 && frameBox[1] >= 540, `phone layout: one test phone at full width (${frameBox[0]}×${frameBox[1]})`);
ok((await TP.page.$$('#switcher button')).length === 8 && /1\s*Andrew/.test(await TP.page.textContent('#switcher')), 'buttons 1–8 with names to switch phones');
await TP.page.tap('#switcher [data-phone="5"]');
await TP.page.waitForTimeout(300);
ok(JSON.stringify(await visibleFrames()) === '[5]', 'tap 5 → phone 5 (Sam) on screen');
await TP.page.tap('#play-all');
await TP.page.waitForTimeout(4500);
ok(be.tables.scores.filter((x) => x.event_id === pr2.id && x.hole === 1 && x.strokes != null).length === 8, 'Play a hole still plays all 8 phones, shown or not');
const phone5 = TP.page.frames().find((f) => /[?&]sim=5(#|&|$)/.test(f.url()));
ok(((await phone5.textContent('.hole-title').catch(() => '')) || '').startsWith('Hole 2'), 'and phone 5 moved on to hole 2');
ok(!(await TP.page.isVisible('#reset')), 'Reset / Delete tucked under More');
await TP.page.tap('#more-btn');
ok(await TP.page.isVisible('#reset') && await TP.page.isVisible('#delete'), 'More shows them');
TP.page.once('dialog', (d) => d.accept());
await TP.page.tap('#delete');
await TP.page.waitForTimeout(800);
ok(!be.tables.events.some((e) => e.id === pr2.id), 'deleted from the phone too');

// 18. Split point, switched on mid-round: a 3-player round (no carts) started as a scorecard.
//     Matches offers it (no "4 carts" talk), Host → Rules → Match play → Save, and it counts back
//     from hole 1: 1 point a hole, ties split. Scores replayed from the Oct 20 Bridlewood round.
const sp = be.rpc.create_event({
  p_name: 'Split point test', p_course: { ...COURSES_TC, tee: COURSES_TC.tees[1] },
  p_roster: { groups: [{ id: 'g1', name: 'Group 1' }], teams: [], players: ['Josh', 'Andrew', 'Sean'].map((name, i) => ({ id: `p${i + 1}`, personId: `person-sp-${i}`, name, teamId: null, groupId: 'g1', strokes: null })) },
  p_settings: { handicapMode: 'full', allowancePct: 100, game: 'none', teamScore: 'bestBall', halvedHolePoints: 0.5, matchBonus: 1, plusMinusCap: null, maxHoleScore: 'doublePar', par3NoMax: false, rotationMode: 'fixed', startHole: 1,
    rotation: [{ holes: [1, 6], matches: [['A', 'B'], ['C', 'D']] }, { holes: [7, 12], matches: [['A', 'C'], ['B', 'D']] }, { holes: [13, 18], matches: [['A', 'D'], ['B', 'C']] }] },
});
const spEv = be.tables.events.find((x) => x.code === sp.code);
// [Josh, Andrew, Sean] holes 1–7
[[5, 8, 5], [5, 7, 6], [4, 6, 4], [4, 6, 4], [5, 5, 5], [5, 5, 5], [4, 4, 4]].forEach((row, i) =>
  row.forEach((strokes, k) => be.tables.scores.push({ event_id: spEv.id, player_id: `p${k + 1}`, hole: i + 1, strokes, updated_at: new Date(Date.now() - (60 - i) * 60000).toISOString(), updated_by: 'Sean' })));
const DEVSP = '18181818-1818-4818-8818-181818181818';
be.tables.claims.push({ event_id: spEv.id, player_id: 'p2', device_id: DEVSP });
const SP = await presetPhone('Split point', sp.code, { pin: sp.admin_pin, me: 'p2', dev: DEVSP });
await SP.page.goto(`${srv.origin}/#/e/${sp.code}/matches`);
await SP.page.waitForTimeout(1000);
await clearOverlays(SP.page);
const spNoGame = await SP.page.textContent('#content');
ok(/No game on this round/.test(spNoGame) && !/4 carts/.test(spNoGame) && !!(await SP.page.$('[data-act="tab"][data-v="host"].btn')), 'Matches (scorecard only, 3 players): offers Match play, no "4 carts" talk');
await SP.page.tap('[data-act="tab"][data-v="host"].btn');
await SP.page.waitForTimeout(500);
await SP.page.tap('[data-act="host-solo"][data-v="on"]');
await SP.page.waitForTimeout(200);
ok(/ties? for low splits it/.test(await SP.page.textContent('#content')) && !(await SP.page.$('[data-k="matchBonus"]')), 'Host → Rules: Match play explains the split; no match bonus / halved points');
await SP.page.tap('[data-act="host-save"]');
await SP.page.waitForTimeout(900);
ok(spEv.settings.solo === true && spEv.settings.game === 'rotationMatch', 'saved: no "needs 4 carts of 2" error');
await SP.page.tap('[data-act="tab"][data-v="matches"]');
await SP.page.waitForTimeout(500);
await clearOverlays(SP.page);
const tots = await SP.page.$$eval('.sp-tot', (els) => els.map((e) => `${e.querySelector('.sp-name').textContent.replace(' (you)', '')} ${e.querySelector('.sp-pts').textContent}`));
ok(JSON.stringify(tots) === JSON.stringify(['Josh 3½', 'Sean 2½', 'Andrew 1']), `recounted from hole 1: ${tots.join(', ')}`);
const spRows = await SP.page.$$eval('.sp-table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.querySelector('.pt')?.textContent || '').join('|')));
ok(spRows.length === 7 && spRows[0] === '½||½' && spRows[1] === '1||' && spRows[6] === '⅓|⅓|⅓', `Matches: hole by hole, who took the point and how it split (${spRows.join(' / ')})`);
await SP.page.tap('[data-act="tab"][data-v="board"]');
await SP.page.waitForTimeout(500);
await clearOverlays(SP.page);
if (await SP.page.$('[data-act="board-view"][data-v="teams"]')) await SP.page.tap('[data-act="board-view"][data-v="teams"]');
await SP.page.waitForTimeout(300);
const firstRow = await SP.page.textContent('.team-row');
ok(/Josh/.test(firstRow) && /3½/.test(firstRow) && /1 won · 6 split/.test(firstRow), 'Board: Josh leads, 3½ pts, 1 won · 6 split');
await SP.page.tap('.team-row');
await SP.page.waitForTimeout(400);
ok(/split with Sean/.test(await SP.page.textContent('#sheet')), 'tap a player: their holes and who they split with');
await SP.page.evaluate(() => window.__glb.closeSheet?.());
await SP.page.goto(`${srv.origin}/#/e/${sp.code}/enter`);
await SP.page.waitForTimeout(900);
await clearOverlays(SP.page);
const spLine = await SP.page.textContent('.matchup-line');
ok(/Josh\s*3½/.test(spLine) && /YOU 3RD · 1 PT\b/.test(spLine), `Enter: the others' points + your place under the hole (${spLine.replace(/\s+/g, ' ').trim()})`);
const spBrief = await SP.page.evaluate(async () => (await import('/js/screens/brief.js')).briefPages(window.__glb).join(' '));
ok(/Split point/.test(spBrief) && /⅓ point/.test(spBrief), 'Today’s game: one card for split point');

const errors = [A, C, A2, P, Q, O, F, R, X, Y, Z, G, T, TP, NL, SP].flatMap((p) => p.page.errors);
ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);

await browser.close();
srv.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
