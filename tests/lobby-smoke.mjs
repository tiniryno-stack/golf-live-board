// tests/lobby-smoke.mjs — a quick 4-phone rehearsal of the Team Ryder Cup lobby (025 + 026 + Order and carts) against
// the in-memory mock. Rough pass for sharp edges, not the full smoke suite. Run: node tests/lobby-smoke.mjs
//   phone 1 = the organizer (PIN) · phone 2 = iPhone Safari, opens the invite · phone 3 = the home screen app ·
//   phone 4 = a late joiner after scoring opens. The roster has 16 names; only these 4 are phones.
import { createRequire } from 'node:module';
import { createBackend, attach, serve } from './mock-supabase.mjs';
import * as L from '../js/lobby.js';
import { ryderSetup } from '../js/scoring.js';
import { COURSES } from '../js/courses.js';

let chromium;
// The cloud sandbox's preinstalled Playwright first (its browser is installed), else the repo's.
try { ({ chromium } = createRequire('/opt/node-tools/package.json')('playwright')); } catch { ({ chromium } = await import('playwright')); }

const FIRST = ['Andrew', 'Alex', 'Josh', 'Brandon', 'Ant', 'Steve', 'Joseph', 'Jay', 'Sean', 'Baker', 'Mitch', 'Peter', 'Kyle', 'Chuck', 'Elijah', 'Marcus'];
const HC = [8, 15, 4, 10, 6, 12, 11, 9, 5, 12, 7, 20, 16, 18, 14, 13];
const players = FIRST.map((f, i) => ({ id: `p${i + 1}`, personId: `person-${f.toLowerCase()}`, name: f, firstName: f, lastName: 'Test', strokes: HC[i], teamId: null, groupId: null }));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
const settings = { ...ryderSetup(players).settings, teeTimes: [], lobby: L.newLobby({ startTime: '23:00', tz: 'America/Chicago', hostName: 'Andrew', hostId: 'p1' }) };

const srv = await serve();
const be = createBackend();
const made = be.rpc.create_event({ p_name: 'Smoke Bday', p_course: COURSES[1], p_roster: { groups: [], teams: [], sides: [], players }, p_settings: settings, p_played_on: today });
const code = made.code;
const ev = () => be.tables.events.find((x) => x.code === code);
const browser = await chromium.launch();
const errs = [];
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function phone(name, init = () => {}, arg = null) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(init, arg);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  return page;
}
const text = (p) => p.evaluate(() => document.getElementById('content').innerText.replace(/\s+/g, ' ').trim());
const tap = async (p, sel) => { await p.locator(sel).first().tap(); await wait(400); };
const refetch = (p) => p.evaluate(() => window.__glb.refetch()).then(() => wait(600));

// 1 · organizer: Host lobby → pair the carts → enter the draft (skip) → start times
const host = await phone('host', ([c, pin]) => { localStorage.setItem('glb.admin.' + c, JSON.stringify(pin)); }, [code, made.admin_pin]);
await host.goto(`${srv.origin}/#/e/${code}/host`); await wait(1500);
ok(/Pair the carts/.test(await text(host)), 'host: lobby view offers Pair the carts');
await tap(host, '[data-act="lh-carts"]');
await tap(host, '[data-act="setup-lobby-save"]'); await wait(800);
ok(ev().settings.lobby.stage === 'carts' && L.isPaired(ev().roster), 'host: carts saved (stage carts, C1…C8)');

// 2 · iPhone Safari player opens the invite → steps → (3 min) → name → confirm → reveal
const safari = await phone('safari', () => { window.__GLB_IOS = true; });
await safari.goto(`${srv.origin}/#/e/${code}/hcp`); await wait(1500);
ok(/Andrew invited you/.test(await text(safari)) && /Reveal my handicap/.test(await text(safari)), 'safari: invite screen');
await tap(safari, '[data-act="lb-guide"]');
ok(await safari.locator('[data-act="lb-here"]').count() === 0, 'safari: no "Can’t add it?" before 3 minutes');
await safari.evaluate(() => { window.__glb.ui.guideAt.at -= 181000; window.__glb.render(); }); await wait(300);
await tap(safari, '[data-act="lb-here"]');
await tap(safari, '[data-act="lb-pick"][data-v="p10"]'); await wait(500);
await tap(safari, '[data-act="me-yes"]'); await wait(500);
ok(/set your handicap/.test(await text(safari)), 'safari: the reveal (idle) after the confirm');
await tap(safari, '[data-act="lb-rv-now"]'); await wait(2600);
ok(/has you at 12/.test(await text(safari)), 'safari: Just show me → the number');
await tap(safari, '[data-act="lb-revealed"]');
ok(/your cart/i.test(await text(safari)) && /your handicap/i.test(await text(safari)), 'safari: lobby (the day) shows Your handicap + Your cart');

// 3 · home screen app player: name list (no Back), pick, reveal by holding
const app = await phone('app', () => { window.__GLB_STANDALONE = true; window.__GLB_IOS = true; });
await app.goto(`${srv.origin}/#/e/${code}`); await wait(1500);
ok(/Which one are you/.test(await text(app)) && await app.locator('[data-act="lb-back"]').count() === 0, 'app: name list, no Back');
await tap(app, '[data-act="lb-pick"][data-v="p11"]'); await wait(500);
await tap(app, '[data-act="me-yes"]'); await wait(500);
const box = await app.locator('#lbr-disc').boundingBox();
await app.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await app.mouse.down(); await wait(1700); await app.mouse.up(); await wait(2600);
ok(/has you at 7/.test(await text(app)), 'app: press and hold → the number');
await tap(app, '[data-act="lb-revealed"]');

// 4 · organizer drafts (skip = split in cart order) → start times → share teams → Order and carts
await host.reload(); await wait(1500);
await tap(host, '[data-act="lh-draft"]');
await tap(host, '[data-act="setup-ry-skip"]');
await tap(host, '[data-act="setup-lobby-save"]'); await wait(1200);
ok(ev().settings.lobby.stage === 'teams' && ev().roster.sides.length === 2, 'host: draft saved (two sides)');
ok(/Start times/.test(await text(host)), 'host: straight on to start times (2 of 2)');
await tap(host, '[data-act="setup-lobby-save"]'); await wait(1200);
ok(ev().settings.lobby.stage === 'ready', 'host: start times saved (stage ready)');
await host.evaluate(() => document.querySelector('[data-act="sheet-close"]')?.click()); await wait(300);
const before = ev().roster.players.find((p) => p.id === 'p10').teamId;
await tap(host, '[data-act="lh-order"]');
await tap(host, '[data-act="lh-o-p"][data-v="p10"]'); await tap(host, '[data-act="lh-o-p"][data-v="p16"]');
await tap(host, '[data-act="lh-o-save"]'); await wait(1200);
ok(ev().roster.players.find((p) => p.id === 'p16').teamId === before, 'host: Order and carts swapped two players');

// 5 · players see their team; organizer opens scoring now; Scoring is open → hole 1 → a score
await refetch(app);
// Saved on the day of the round, start times open scoring at once (the rule): no Open scoring now needed.
ok(L.lobbyState(ev(), Date.now()).open, 'start times saved on the day → scoring open');
ok(/scoring is open/i.test(await text(app)), 'app: Scoring is open');
await tap(app, '[data-act="lb-go1"]'); await wait(1200);
ok(await app.locator('#tabbar').isVisible(), 'app: tab bar back once open');
await host.reload(); await wait(1500);
ok(await host.locator('[data-act="lh-order"]').count() === 1, 'host: Order and carts still open before the first score');
be.tables.scores.push({ event_id: ev().id, player_id: 'p11', hole: 1, strokes: 4, updated_by: 'Mitch', updated_at: new Date().toISOString() });
await refetch(host);
ok(await host.locator('[data-act="lh-order"]').count() === 0, 'host: Order and carts locks at the first score');

// 6 · late joiner after it opens: normal Who are you?
const late = await phone('late');
await late.goto(`${srv.origin}/#/e/${code}`); await wait(1800);
ok(!/Andrew invited you/.test(await text(late)), 'late joiner: no lobby screens once open');

ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
await browser.close();
srv.close?.();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
