// Two-phone smoke test (BUILD.md stage 9), headless, against the in-memory mock:
//   1. Andrew (Hogan's Heroes) and Sam (Fore Play) join by tapping their names
//   2. Blocked edit: Sam can't enter Andrew's score on hole 3 (UI and server)
//   3. Holes 1–6 played on both phones; hole-7 swap puts Andrew with Fore Play
//   4. Offline: a score entered with no signal queues, then syncs
//   5. Clear-the-browser rejoin: a fresh phone asks to be Andrew, Sam lets them in,
//      the old phone drops to watch-only
//   6. Organizer resets the round (scores cleared, phones stay joined), then deletes it
// Realtime isn't mocked, so "the other phone sees it" is driven by a refetch —
// the same path the app uses when a phone comes back from the lock screen.
// Run: npm run test:smoke

import { chromium } from 'playwright';
import { createBackend, attach, serve, seedRound } from './mock-supabase.mjs';

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
    for (const k of ['tile', 'prov']) localStorage.setItem('glb.coach.' + k, 'true');
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
});

async function join(page, playerName) {
  await page.goto(link);
  await page.waitForSelector('.who-btn', { timeout: 8000 });
  await page.locator('.who-btn', { hasText: playerName }).first().tap();
  await page.waitForTimeout(300);
}

async function playHole(page) {
  await clearOverlays(page);
  const pids = await page.$$eval('.tile .face[data-act="tile-tap"]', (els) => els.map((e) => e.dataset.pid));
  for (const pid of pids) await page.tap(`.tile .face[data-pid="${pid}"]`);
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

// 2. Blocked edit outside your matchup
const blockedUi = await app(C.page, () => window.__glb.setScore('p1', 3, 4));
ok(blockedUi === false, 'Sam’s phone refuses to write Andrew’s hole 3 (UI)');
ok((await toastText(C.page)).includes('Not your matchup'), 'Sam sees “Not your matchup”');
const dev = await app(C.page, () => JSON.parse(localStorage.getItem('glb.device')));
const serverSays = be.rpc.upsert_score({ p_code: r.code, p_device_id: dev, p_player_id: 'p1', p_hole: 3, p_strokes: 4 });
ok(serverSays.error === 'not_your_foursome', `server rejects it too (${serverSays.error})`);
await C.page.goto(`${link}/card`);
await C.page.waitForTimeout(500);
ok(!(await C.page.$('[data-pid="p1"][data-h="3"]')), 'Andrew\u2019s cart starts collapsed on Sam\u2019s Card (not his foursome)');
await C.page.tap('[data-act="card-toggle"][data-v="A"]');
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
await A.page.tap('.face[data-pid="p5"]');
await A.page.waitForTimeout(900);
const sam7 = be.tables.scores.find((s) => s.player_id === 'p5' && s.hole === 7);
ok(sam7?.strokes === 4 && sam7.updated_by === 'Andrew', 'Andrew can now enter Sam’s hole 7 (stamped “Andrew”)');
await refetch(C.page);
await C.page.waitForTimeout(200);
const samSees = await app(C.page, () => window.__glb.snapshot.playerById.get('p5').gross[6]);
ok(samSees === 4, 'Sam’s phone shows the score Andrew entered for him');
const official = await app(C.page, () => window.__glb.snapshot.officialThrough);
ok(official === 6, `official line through 6 (${official})`);

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
ok(be.tables.scores.some((s) => s.player_id === 'p6' && s.hole === 7 && s.strokes === 4), 'back online: it synced');
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
ok(be.tables.scores.some((x) => x.player_id === 'p5' && x.hole === 1 && x.strokes === 6), 'play resumes after the reset');
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

const errors = [A, C, A2].flatMap((p) => p.page.errors);
ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);

await browser.close();
srv.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
