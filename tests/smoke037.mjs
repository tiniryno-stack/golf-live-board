// smoke037.mjs — returning players (Nov 24) on iPhone-size phones against the mock: a round link in Safari on a phone
// that has Golf Board says Open Golf Board and leaves the spot free; Stay in Safari still joins; the home screen app
// finds a round it was just added to (on open and on return), auto-joins its owner and marks in_app; your name on
// Home fixes who this phone is; What's new shows once. Run: node tests/smoke037.mjs (PW_CHROMIUM=<path> if needed).

import { chromium } from 'playwright';
import { createBackend, attach, serve } from './mock-supabase.mjs';
import { COURSES } from '../js/courses.js';
import { wallDate, addMinutes, wallClock } from '../js/lobby.js';

const srv = await serve();
const be = createBackend();
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = [];
let failed = 0;
const ok = (cond, msg) => { results.push(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const TC = COURSES[0];
const COURSE = { ...TC, tee: TC.tees[1] };
const BASE = { handicapMode: 'full', allowancePct: 100, teamScore: 'bestBallAggregate', halvedHolePoints: 0.5, matchBonus: 1, plusMinusCap: null, maxHoleScore: 'doublePar', par3NoMax: false, startHole: 1, rotationMode: 'fixed', game: 'none' };
const NAMES = [['Andrew', 'Duong'], ['Sean', 'Smith'], ['Sam', 'Lee'], ['Jake', 'Ross']];
const roster = () => ({ groups: [{ id: 'g1' }], teams: [], players: NAMES.map(([f, l], i) => ({ id: `p${i + 1}`, personId: `person-${f.toLowerCase()}`, name: f, firstName: f, lastName: l, teamId: null, groupId: 'g1', strokes: null })) });
const tz = 'UTC';
const lobby = () => {
  const now = Date.now();
  return { stage: 'ready', startTime: addMinutes(wallClock(now, tz), 120), tz, opensAt: new Date(now + 90 * 60000).toISOString(), openedEarly: false, notice: null, cohost: null, prevStage: null, hostName: 'Andrew', hostId: 'p1' };
};
function mk(name, { withLobby = true } = {}) {
  const r = be.rpc.create_event({ p_name: name, p_course: COURSE, p_roster: roster(), p_settings: { ...BASE, ...(withLobby ? { lobby: lobby(), teeTimes: [] } : {}) }, p_played_on: wallDate(Date.now(), tz) });
  const ev = be.tables.events.find((x) => x.code === r.code);
  ev.played_on = wallDate(Date.now(), tz);
  return { ...r, ev };
}
let devN = 0;
async function phone(label, { standalone = false, ios = true, seed = {} } = {}) {
  const dev = `00000000-0000-4000-8000-${String(++devN).padStart(12, '0')}`;
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([dev, standalone, ios, seed]) => {
    window.__GLB_STANDALONE = standalone;
    window.__GLB_IOS = ios;
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('glb.device', JSON.stringify(dev));
    for (const k of ['tile5', 'prov2', 'oppcart3', 'pad1', 'pad3', 'quiet1', 'matches1', 'board1']) localStorage.setItem(`glb.coach.${k}`, 'true');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v));
  }, [dev, standalone, ios, seed]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${label}: ${e.message}`));
  return { ctx, page, dev, label };
}
const open = async (ph, hash) => { await ph.page.goto(`${srv.origin}/${hash}`); await ph.page.waitForSelector('#loader', { state: 'hidden', timeout: 8000 }).catch(() => {}); await ph.page.waitForTimeout(700); };
const text = (ph) => ph.page.evaluate(() => document.getElementById('content').innerText.replace(/\s+/g, ' ').trim());
const sheet = (ph) => ph.page.evaluate(() => (document.querySelector('.sheet.open, #sheet.open, .panel.open')?.innerText || document.getElementById('sheet')?.innerText || '').replace(/\s+/g, ' ').trim());
const claimOn = (R, pid) => be.tables.claims.find((c) => c.event_id === R.ev.id && c.player_id === pid) || null;
const errors = [];

// Sean already plays in his home screen app: an old round he opened there (in_app on his claim).
const OLD = mk('Last week', { withLobby: false });
be.tables.claims.push({ event_id: OLD.ev.id, player_id: 'p2', device_id: '00000000-0000-4000-8000-0000000000aa', in_app: true });

// ── 1 · The group-chat link opens in Safari: the server says Sean has the app → Open Golf Board, spot stays free.
{
  const R = mk('Saturday at Twin Creeks');
  const s = await phone('Sean · Safari');
  await open(s, `#/e/${R.code}`);
  await s.page.click('[data-act="lb-find"]');
  await s.page.waitForTimeout(400);
  await s.page.locator('[data-act="lb-pick"]', { hasText: 'Sean' }).first().click();
  await s.page.waitForTimeout(900);
  const sh = await sheet(s);
  ok(/Open Golf Board/.test(sh) && /waiting there as Sean/.test(sh), `Safari, picked Sean: Open Golf Board (${sh.slice(0, 90)}…)`);
  ok(!claimOn(R, 'p2'), 'Safari did not take Sean’s spot');
  await s.page.click('[data-act="oa-here"]');
  await s.page.waitForTimeout(800);
  if (await s.page.$('[data-act="me-yes"]')) { await s.page.click('[data-act="me-yes"]'); await s.page.waitForTimeout(600); }
  ok(claimOn(R, 'p2')?.device_id === s.dev, 'Stay in Safari instead → joined as Sean in Safari');
  errors.push(...s.page.errors);
  await s.ctx.close();
}

// ── 2 · Safari remembers Add to Home Screen: the invite says Open it in Golf Board, not Add a second icon.
{
  const R = mk('Sunday scramble');
  const s = await phone('Sam · Safari', { seed: { 'glb.hasApp': true } });
  await open(s, `#/e/${R.code}`);
  const t = await text(s);
  ok(/This round is waiting there/.test(t) && /Open it in Golf Board/.test(t) && !/Add Golf Board to my home screen/.test(t), `invite on a phone with the app (${t.slice(-110)})`);
  await s.page.click('[data-act="lb-openapp"]');
  await s.page.waitForTimeout(500);
  ok(/Open Golf Board/.test(await sheet(s)), 'Open it in Golf Board → the steps sheet');
  // Someone with no app and no note: the invite is as before.
  const j = await phone('Jake · Safari');
  await open(j, `#/e/${R.code}`);
  ok(/Add Golf Board to my home screen/.test(await text(j)), 'a phone without the app still gets Add Golf Board');
  errors.push(...s.page.errors, ...j.page.errors);
  await s.ctx.close(); await j.ctx.close();
}

// ── 3 · The home screen app (owner Sean): Home finds today's round, What's new once, a new round on return.
{
  const R = mk('Tuesday nine');
  const a = await phone('Sean · app', { standalone: true, seed: {
    'glb.owner': { personId: 'person-sean', name: 'Sean Smith' }, 'glb.people': ['person-sean'],
    'glb.recent': [{ code: OLD.code, name: OLD.ev.name, at: 1 }],
  } });
  await open(a, '');
  await a.page.waitForTimeout(800);
  let t = await text(a);
  const coming = () => a.page.evaluate(() => [...document.querySelectorAll('.lb-home:not([role=status])')].map((el) => el.innerText.replace(/\s+/g, ' ')).join(' | '));
  ok((await coming()).includes('Tuesday nine'), `Home found the round Sean was added to, under Coming up (${await coming()})`);
  ok(/What’s new/i.test(t) && /Round links find your app/.test(t), 'What’s new shows on a phone that used the app before');
  const top = await a.page.evaluate(() => document.querySelector('[data-act="home-me"]')?.innerText || '');
  ok(/Sean Smith/.test(top), `your name at the top is a button (${top})`);
  await a.page.click('[data-act="home-news"]');
  await a.page.waitForTimeout(300);
  ok(!/What’s new/i.test(await text(a)), 'Got it → gone');
  // Andrew makes another round while the app sits in the background; Sean comes back to it.
  await a.page.evaluate(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); document.dispatchEvent(new Event('visibilitychange')); });
  const R2 = mk('Thursday twilight');
  await a.page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await a.page.waitForTimeout(1500);
  ok((await coming()).includes('Thursday twilight'), 'back from the background: the new round is on Home without a reload');
  // Open it: the app joins Sean by itself and tells the server it's the app.
  await open(a, `#/e/${R2.code}`);
  await a.page.waitForTimeout(800);
  if (await a.page.$('[data-act="me-yes"]')) { await a.page.click('[data-act="me-yes"]'); await a.page.waitForTimeout(500); }
  const c = claimOn(R2, 'p2');
  ok(c?.device_id === a.dev, 'the app joined as Sean on its own');
  ok(c?.in_app === true, 'and marked the claim in_app (Safari can now tell he has the app)');
  // Reload Home: What's new stays seen.
  await open(a, '');
  ok(!/What’s new/i.test(await text(a)), 'What’s new never comes back after Got it');
  // Wrong person? Your name → Who are you? → pick Jake.
  await a.page.click('[data-act="home-me"]');
  await a.page.waitForTimeout(900);
  const sh = await sheet(a);
  ok(/You’re Sean( Smith)? on this phone/.test(sh) && /Jake Ross/.test(sh), `your name → who this phone is, names from your rounds (${sh.slice(0, 100)}…)`);
  await a.page.locator('[data-act="home-me-pick"]', { hasText: 'Jake Ross' }).click();
  await a.page.waitForTimeout(500);
  const owner = await a.page.evaluate(() => JSON.parse(localStorage.getItem('glb.owner')));
  ok(owner?.personId === 'person-jake', `picked Jake → this phone is Jake (${JSON.stringify(owner)})`);
  await a.page.click('[data-act="home-me"]');
  await a.page.waitForTimeout(700);
  await a.page.click('[data-act="home-me-clear"]');
  await a.page.waitForTimeout(400);
  const cleared = await a.page.evaluate(() => JSON.parse(localStorage.getItem('glb.owner')));
  ok(cleared?.personId === null, 'I’m not Jake → cleared');
  errors.push(...a.page.errors);
  await a.ctx.close();
}

// ── 4 · A brand-new phone: nothing is news.
{
  const n = await phone('New phone', { standalone: true });
  await open(n, '');
  ok(!/What’s new/i.test(await text(n)), 'a brand-new phone sees no What’s new');
  ok((await n.page.evaluate(() => JSON.parse(localStorage.getItem('glb.seen.whatsnew')))) != null, 'and it is marked seen');
  errors.push(...n.page.errors);
  await n.ctx.close();
}

ok(!errors.length, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
srv.close?.();
console.log(results.join('\n'));
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
