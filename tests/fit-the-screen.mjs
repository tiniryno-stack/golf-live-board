// Fit-the-screen check (ARCHITECTURE.md §8). Opens every screen at each target
// phone size in headless Chromium and FAILS if:
//   • Enter needs any scrolling, or a tile / Next hole is cut off
//   • anything scrolls sideways
//   • the top bar or tab bar is ever off screen
//   • the top of Board doesn't show the leader and your position without scrolling
//   • Board → Players can't show all 8 players without scrolling (15/16 size and up)
//   • a stepper is under 48px or a score tile under 64px
//
// Sizes are CSS px with Safari's toolbars showing (worst case). Run: npm run test:fit
// Screenshots land in tests/screenshots/fit/ for a visual once-over.

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createBackend, attach, serve, seedRound } from './mock-supabase.mjs';

const SIZES = [
  ['iPhone SE', 375, 548],
  ['iPhone 13 mini', 375, 629],
  ['iPhone 15/16', 393, 659],
  ['iPhone Pro Max', 430, 739],
];
const DEV = '11111111-1111-4111-8111-111111111111';
const OUT = new URL('./screenshots/fit/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const srv = await serve();
const be = createBackend();
// Mid-round: official through 9, Andrew's foursome a hole ahead on 10. Long names on purpose.
const r = seedRound(be, { holesPlayed: 9 });
r.event.roster.teams[3].name = 'The Bogey Brigade 20';
r.event.roster.players[0].name = 'Andrew B.';
r.event.roster.players[7].name = 'Christopher';
for (const [pid, s] of [['p1', 3], ['p2', 5], ['p5', 4], ['p6', 4]]) {
  be.tables.scores.push({ event_id: r.id, player_id: pid, hole: 10, strokes: s, updated_by: 'Sam', updated_at: new Date().toISOString() });
}
be.tables.claims.push({ event_id: r.id, player_id: 'p1', device_id: DEV });

const browser = await chromium.launch();
const failures = [];
const rows = [];

async function check(page, size, screen, extra) {
  await page.waitForTimeout(150);
  const res = await page.evaluate((extra) => {
    const vw = innerWidth, vh = innerHeight;
    const content = document.getElementById('content');
    const box = (el) => el?.getBoundingClientRect();
    const onScreen = (el) => {
      const b = box(el);
      return !!b && b.top >= -0.5 && b.bottom <= vh + 0.5 && b.left >= -0.5 && b.right <= vw + 0.5;
    };
    const within = (el, outer) => {
      const b = box(el), o = box(outer);
      return b.top >= o.top - 0.5 && b.bottom <= o.bottom + 0.5 && b.left >= o.left - 0.5 && b.right <= o.right + 0.5;
    };
    const problems = [];
    const de = document.documentElement;
    if (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) problems.push(`page scrolls sideways (${de.scrollWidth}px)`);
    if (content.scrollWidth > content.clientWidth + 1) problems.push(`content scrolls sideways (${content.scrollWidth} > ${content.clientWidth})`);
    const top = document.getElementById('topbar');
    if (!onScreen(top)) problems.push('top bar off screen');
    if (top.scrollWidth > top.clientWidth + 1) problems.push('top bar overflows');
    const tab = document.getElementById('tabbar');
    if (tab.childElementCount) {
      if (!onScreen(tab)) problems.push('tab bar off screen');
      if (tab.scrollWidth > tab.clientWidth + 1) problems.push('tab bar overflows');
    }
    for (const el of content.querySelectorAll('button, input, .tile, .cart, .row, .card, table')) {
      const b = box(el);
      if (b.width && (b.left < -1 || b.right > vw + 1)) {
        problems.push(`${el.className || el.tagName} sticks out sideways`);
        break;
      }
    }
    if (extra === 'enter') {
      if (content.scrollHeight > content.clientHeight + 1) problems.push(`Enter needs scrolling (${content.scrollHeight} > ${content.clientHeight})`);
      const next = document.querySelector('.next-btn');
      if (!next || !onScreen(next) || !within(next, content)) problems.push('Next hole off screen');
      document.querySelectorAll('.tile').forEach((t, i) => {
        if (!within(t, content)) problems.push(`tile ${i + 1} cut off`);
        // Score tiles you tap need 64px; the greyed cart's small rows aren't tap targets (the whole card is).
        if (!t.classList.contains('mini') && box(t).height < 63.5) problems.push(`tile ${i + 1} only ${Math.round(box(t).height)}px tall`);
        if (t.classList.contains('mini') && box(t).height < 36) problems.push(`their row ${i + 1} only ${Math.round(box(t).height)}px tall`);
      });
      document.querySelectorAll('.tile .step, .hole-row .arrow').forEach((s) => {
        const b = box(s);
        if (b.width < 47.5 || b.height < 47.5) problems.push(`tap target ${Math.round(b.width)}×${Math.round(b.height)} < 48`);
      });
      if (!document.querySelectorAll('.tile').length) problems.push('no score tiles rendered');
      const carts = [...document.querySelectorAll('.cart')].map((c) => box(c).height);
      if (document.querySelector('.sheet.even')) {
        if (carts.length === 2 && Math.abs(carts[0] - carts[1]) > 2) problems.push(`50/50 split is ${Math.round(carts[0])}/${Math.round(carts[1])}`);
        if (document.querySelectorAll('.cart.opp.focus .tile .step').length < 4) problems.push('their cart is open but not editable');
        if (!document.querySelector('.cart.mine.dim')) problems.push('your cart should be greyed while theirs is open');
      } else if (carts.length === 2) {
        const share = carts[0] / (carts[0] + carts[1]);
        if (share < 0.62) problems.push(`your cart is only ${Math.round(share * 100)}% (want ~70)`);
        if (!document.querySelector('.cart.opp.dim') || document.querySelector('.cart.opp .tile .step')) problems.push('their cart should be greyed and not editable');
      }
    }
    if (extra === 'board-players') {
      const rows = [...document.querySelectorAll('.prow')];
      const hidden = rows.filter((r) => !within(r, content)).length;
      if (rows.length < 8) problems.push(`only ${rows.length} player rows`);
      if (hidden) problems.push(`${hidden} of ${rows.length} player rows need scrolling`);
    }
    if (extra === 'board') {
      const name = document.querySelector('.board-hero .leader-name');
      const you = document.querySelector('.board-hero .you');
      if (!name || !within(name, content)) problems.push('leader not visible before scrolling');
      if (!you || !within(you, content)) problems.push('your position not visible before scrolling');
    }
    return { problems, scrollH: content.scrollHeight, clientH: content.clientHeight };
  }, extra);
  const name = `${size[0]} · ${screen}`;
  rows.push([name, res.problems.length ? `FAIL: ${res.problems.join('; ')}` : 'ok']);
  if (res.problems.length) failures.push(name);
  await page.screenshot({ path: `${OUT}${size[1]}x${size[2]}-${screen.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png` });
}

for (const size of SIZES) {
  const [, w, h] = size;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([code, dev, pin]) => {
    localStorage.setItem('glb.device', JSON.stringify(dev));
    localStorage.setItem('glb.who.' + code, 'true');
    localStorage.setItem('glb.seen.' + code, JSON.stringify({ last: Date.now(), ids: [] }));
    for (const k of ['tile', 'prov', 'oppcart2']) localStorage.setItem('glb.coach.' + k, 'true');
    localStorage.setItem('glb.me.' + code, '"p1"');
    localStorage.setItem('glb.admin.' + code, JSON.stringify(pin));
  }, [r.code, DEV, r.admin_pin]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const go = async (hash) => {
    await page.goto(`${srv.origin}/${hash}`);
    await page.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.getElementById('overlay').innerHTML = '';
      document.getElementById('overlay').className = 'overlay-root';
      document.getElementById('banners').innerHTML = '';
    });
  };

  await go('#/');
  await check(page, size, 'Home');
  await go('#/setup');
  for (let i = 0; i < 6; i++) {
    if (i === 0) await page.tap('[data-act="setup-course"]');
    if (i === 1) for (const n of ['Andrew', 'Sean', 'Mike', 'Tyler', 'Sam', 'Jake', 'Chris', 'Christopher']) {
      await page.fill('#new-player', n);
      await page.press('#new-player', 'Enter');
    }
    if (i === 2) for (let p = 0; p < 8; p++) await page.tap(`[data-act="setup-team"][data-i="${p}"][data-v="${'AABBCCDD'[p]}"]`);
    await check(page, size, `Setup ${i + 1}`);
    if (i < 5) await page.tap('[data-act="setup-next"]');
  }
  await go(`#/e/${r.code}/enter`);
  await check(page, size, 'Enter', 'enter');
  await page.evaluate(() => { window.__glb.ui.hole = 6; window.__glb.render(); });
  await check(page, size, 'Enter (hole 6)', 'enter');
  await page.tap('.cart.opp.dim');
  await check(page, size, 'Enter (their cart open, 50/50)', 'enter');
  await page.tap('.cart.mine.dim');
  if (!(await page.$('.cart.opp.dim'))) { failures.push(`${size[0]} · tap back`); rows.push([`${size[0]} · Enter tap back to yours`, 'FAIL: still 50/50']); }
  for (const tab of ['matches', 'board', 'card', 'host']) {
    await go(`#/e/${r.code}/${tab}`);
    await check(page, size, tab[0].toUpperCase() + tab.slice(1), tab);
  }
  await go(`#/e/${r.code}/board`);
  await page.tap('[data-act="board-view"][data-v="players"]');
  // All 8 players on one screen: required from iPhone 15/16 size up (SE / mini may scroll).
  await check(page, size, 'Board players', w >= 393 ? 'board-players' : null);
  await go(`#/e/${r.code}/host`);
  await page.tap('[data-act="host-tab"][data-v="players"]');
  await check(page, size, 'Host players');
  await page.tap('[data-act="host-tab"][data-v="activity"]');
  await check(page, size, 'Host activity');
  await go(`#/season/${r.crew_id}`);
  await check(page, size, 'Season');
  // Someone who hasn't picked a name yet (fresh phone)
  const ctx2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await attach(ctx2, be, srv.origin);
  await ctx2.addInitScript((code) => localStorage.setItem('glb.who.' + code, 'true'), r.code);
  const watcher = await ctx2.newPage();
  await watcher.goto(`${srv.origin}/#/e/${r.code}/enter`);
  await watcher.waitForTimeout(800);
  await check(watcher, size, 'Enter (watching)');
  await watcher.evaluate(() => window.__glb.openSheet('who', {}));
  await watcher.waitForTimeout(400);
  await check(watcher, size, 'Who are you? sheet');
  if (errors.length) {
    failures.push(`${size[0]} · page errors`);
    rows.push([`${size[0]} · page errors`, `FAIL: ${errors.join('; ')}`]);
  }
  await ctx.close();
  await ctx2.close();
}

await browser.close();
srv.close();

const width = Math.max(...rows.map((r) => r[0].length));
for (const [name, status] of rows) console.log(`${name.padEnd(width)}  ${status}`);
console.log(`\n${rows.length - failures.length}/${rows.length} checks passed`);
if (failures.length) {
  console.log(`FAILED: ${failures.join(', ')}`);
  process.exit(1);
}
