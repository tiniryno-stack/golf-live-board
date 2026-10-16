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
//   9. Headlines wear the jersey of the team on their positive end; two that land on the
//      same score show together, then it's back to one (banner and Board).
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
    for (const k of ['tile2', 'prov', 'oppcart2']) localStorage.setItem('glb.coach.' + k, 'true');
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
const cardOrder = await C.page.$$eval('.cart-block .cb-head .name', (els) => els.map((e) => e.textContent));
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
await P.page.evaluate(() => localStorage.removeItem('glb.coach.oppcart2'));
await P.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="-1"]');
await P.page.tap('[data-act="tile-step"][data-pid="p2"][data-d="1"]');
await P.page.waitForTimeout(900);
const tip = await P.page.evaluate(() => document.querySelector('.coach')?.textContent || '');
ok(/enter scores for the other cart/i.test(tip), `your cart done: a tip points at their greyed cart (\u201c${tip.slice(0, 40)}\u2026\u201d)`);
if (tip) await P.page.tap('.coach');
const par10 = r2.event.course.par[9];
const s1 = be.tables.scores.find((x) => x.event_id === r2.id && x.player_id === 'p1' && x.hole === 10);
const s2 = be.tables.scores.find((x) => x.event_id === r2.id && x.player_id === 'p2' && x.hole === 10);
ok(s1?.strokes === par10 - 1, `\u2212 on a blank tile = birdie (${s1?.strokes} on a par ${par10})`);
ok(s2?.strokes === par10 + 1, `+ on a blank tile = bogey (${s2?.strokes})`);
const cartRatio = await P.page.evaluate(() => {
  const [a, b] = [...document.querySelectorAll('.cart')].map((c) => c.getBoundingClientRect().height);
  return a / (a + b);
});
ok(cartRatio > 0.64 && cartRatio < 0.76, `your cart gets ~70% of the space (${Math.round(cartRatio * 100)}%)`);
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

// 8. Their cart: greyed until tapped, then 50/50; back to 60/40 by tapping yours or moving on
const shares = (page) => page.evaluate(() => {
  const [a, b] = [...document.querySelectorAll('.cart')].map((c) => c.getBoundingClientRect().height);
  return a / (a + b);
});
ok(!!(await P.page.$('.cart.opp.dim')) && !(await P.page.$('.cart.opp .step')), 'their cart starts greyed, with no − / +');
await P.page.tap('.cart.opp .face[data-pid="p4"]');
await P.page.waitForTimeout(400);
ok(!be.tables.scores.some((x) => x.event_id === r2.id && x.player_id === 'p4' && x.hole === 10), 'tapping it doesn\u2019t score anyone');
const even = await shares(P.page);
ok(!!(await P.page.$('.sheet.even .cart.mine.dim')) && Math.abs(even - 0.5) < 0.02, `tapped: 50/50 (${Math.round(even * 100)}%), theirs open, yours greyed`);
await P.page.tap('[data-act="tile-step"][data-pid="p4"][data-d="-1"]');
await P.page.waitForTimeout(900);
const s4 = be.tables.scores.find((x) => x.event_id === r2.id && x.player_id === 'p4' && x.hole === 10);
ok(s4?.strokes === par10 - 1, `entered their score while open (${s4?.strokes})`);
await P.page.tap('.cart.mine.dim');
await P.page.waitForTimeout(200);
const back = await shares(P.page);
ok(!!(await P.page.$('.cart.opp.dim')) && back > 0.64, `tap yours: back to 70/30 (${Math.round(back * 100)}%)`);
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
await O.page.tap('[data-act="setup-course"]');
await O.page.tap('[data-act="setup-next"]');
for (const n of ['Andrew', 'Justin', 'Sean', 'Mitchell', 'Ryan', 'Joseph', 'Chuck', 'Peter']) {
  await O.page.fill('#new-player', n);
  await O.page.press('#new-player', 'Enter');
}
await O.page.tap('[data-act="setup-next"]');
for (let p = 0; p < 8; p++) await O.page.tap(`[data-act="setup-team"][data-i="${p}"][data-v="${'ABADCCBD'[p]}"]`);
for (let i = 0; i < 3; i++) await O.page.tap('[data-act="setup-next"]');
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
ok(!!(await O.page.$('.cart.mine')) && /grey number is par/.test((await O.page.textContent('.coach').catch(() => '')) || ''), 'then Enter, and the first tip shows there');

// 12. Blank tiles are par: Next hole saves them, but never over a score already on the server
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
    for (const k of ['tile2', 'prov', 'oppcart2']) localStorage.setItem('glb.coach.' + k, 'true');
  }, [r3.code, DEV3]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`Par phone: ${e.message}`));
  return { ctx, page };
})();
await F.page.goto(`${srv.origin}/#/e/${r3.code}/enter`);
await F.page.waitForTimeout(900);
const par1 = r3.event.course.par[0];
const ghosts = await F.page.$$eval('.score.ghost', (els) => els.map((e) => e.textContent.trim()));
ok(ghosts.length === 4 && ghosts.every((g) => g === String(par1)), `blank tiles show a grey par (${ghosts.join(', ')})`);
await F.page.tap('[data-act="tile-step"][data-pid="p1"][data-d="1"]'); // Andrew: bogey
await F.page.waitForTimeout(800);
ok(/Next hole · 3 at par/.test(await F.page.textContent('.next-btn')), `the button says what happens: “${(await F.page.textContent('.next-btn')).trim()}”`);
be.tables.scores.push({ event_id: r3.id, player_id: 'p3', hole: 1, strokes: 7, updated_by: 'Mike', updated_at: new Date().toISOString() }); // Mike's 7 already on the server
await F.page.tap('.next-btn');
await F.page.waitForTimeout(1500);
const at = (pid) => be.tables.scores.find((x) => x.event_id === r3.id && x.player_id === pid && x.hole === 1)?.strokes;
ok(at('p1') === par1 + 1 && at('p2') === par1 && at('p4') === par1, `Next hole: Andrew\u2019s bogey kept, Sean + Tyler saved at par (${at('p1')}, ${at('p2')}, ${at('p4')})`);
ok(at('p3') === 7, `Mike\u2019s 7 that was already on the server is not overwritten (${at('p3')})`);
ok((await F.page.evaluate(() => window.__glb.scoreOf('p3', 1))) === 7, 'and Andrew\u2019s phone shows Mike\u2019s 7');
ok((await F.page.textContent('.hole-title')) === 'Hole 2', 'on to hole 2');

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

const errors = [A, C, A2, P, Q, O, F].flatMap((p) => p.page.errors);
ok(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);

await browser.close();
srv.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
