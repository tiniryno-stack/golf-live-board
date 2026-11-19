// Game compare: full-length Matches and Board (Standings, Players, tap-in, final) for every game, side by side.
// for the "Golf Board map" artifact. Not a test: it never fails, it lists what it couldn't reach.
// Run: node tests/screen-map.mjs   →  tests/screenshots/map/*.jpg + manifest.json
// One phone size (393×852, iPhone 15/16 without Safari bars), 2× pixels, dark mode.

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createBackend, attach, serve, seedRound } from './mock-supabase.mjs';
import { COURSES } from '../js/courses.js';
import { ryderSetup, threeCartRotation, normalizeSettings, pairRotation } from '../js/scoring.js';
import * as L from '../js/lobby.js';

const OUT = fileURLToPath(new URL('./screenshots/games/', import.meta.url));
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const W = 393, H = 852;
const DEV = '11111111-1111-4111-8111-111111111111';
const TC = COURSES[0];
const COURSE = { ...TC, tee: TC.tees[1] };
const BASE = { handicapMode: 'full', allowancePct: 100, teamScore: 'bestBallAggregate', halvedHolePoints: 0.5, matchBonus: 1, plusMinusCap: null, maxHoleScore: 'doublePar', par3NoMax: false, startHole: 1 };
const ROT = [
  { holes: [1, 6], matches: [['A', 'B'], ['C', 'D']] },
  { holes: [7, 12], matches: [['A', 'C'], ['B', 'D']] },
  { holes: [13, 18], matches: [['A', 'D'], ['B', 'C']] },
];

const srv = await serve();
const be = createBackend();
const spread = [0, 1, 0, -1, 1, 2, 0, 1, -1, 0, 1, 0, 2, 0, -1, 1];
function addScores(ev, holes, players = ev.roster.players) {
  for (let h = 1; h <= holes; h++) {
    players.forEach((p, i) => be.tables.scores.push({
      event_id: ev.id, player_id: p.id, hole: h, strokes: COURSE.par[h - 1] + spread[(i * 3 + h) % spread.length],
      updated_by: p.name, updated_at: new Date(Date.now() - (holes - h + 1) * 600000 + i * 1000).toISOString(),
    }));
  }
}
function mk(name, roster, settings, holes, crew) {
  const r = be.rpc.create_event({ p_name: name, p_course: COURSE, p_roster: roster, p_settings: { ...BASE, ...settings }, p_crew_id: crew });
  const ev = be.tables.events.find((x) => x.code === r.code);
  addScores(ev, holes);
  be.tables.claims.push({ event_id: ev.id, player_id: 'p1', device_id: DEV });
  return { ...r, event: ev };
}
const P = (names, extra = () => ({})) => names.map((n, i) => ({ id: `p${i + 1}`, personId: `person-${n.toLowerCase()}`, name: n, firstName: n, teamId: null, groupId: 'g1', strokes: null, ...extra(i) }));

// The Friday round: Partner Rider Cup, 8 players, official through 9, our foursome on 10 with half the scores in.
const r = seedRound(be, { holesPlayed: 9 });
for (const [pid, s] of [['p3', 5], ['p4', 4], ['p5', 4], ['p6', 4]]) be.tables.scores.push({ event_id: r.id, player_id: pid, hole: 10, strokes: s, updated_by: 'Sam', updated_at: new Date().toISOString() });
be.tables.claims.push({ event_id: r.id, player_id: 'p1', device_id: DEV });
const crew = r.crew_id;
// Finished (18 holes in), before the first score, and one round of each other game.
const rf = seedRound(be, { holesPlayed: 18 });
be.tables.claims.push({ event_id: rf.id, player_id: 'p1', device_id: DEV });
const r0 = seedRound(be, { holesPlayed: 0, extra: { rotationMode: 'fixed', teeTimes: ['08:40', '08:50'] } });
be.tables.claims.push({ event_id: r0.id, player_id: 'p1', device_id: DEV });
for (let i = 2; i <= 7; i++) be.tables.claims.push({ event_id: r0.id, player_id: `p${i}`, device_id: `00000000-0000-4000-8000-00000000000${i}` });

const sc = mk('Scorecard · Sun', { groups: [{ id: 'g1', name: 'Group 1' }], teams: [], players: P(['Andrew', 'Sean', 'Sam', 'Jake']) }, { game: 'none', solo: false, pairs: false, rotationMode: 'fixed', rotation: ROT }, 5);
const sp = mk('Split point · Bridlewood', { groups: [{ id: 'g1', name: 'Group 1' }], teams: [], players: P(['Andrew', 'Josh', 'Sean']) }, { game: 'rotationMatch', solo: true, pairs: false, rotationMode: 'fixed', rotation: ROT }, 7);
const mp = mk('Match play · 5', { groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }], teams: [], players: P(['Andrew', 'Sean', 'Sam', 'Jake', 'Chris'], (i) => ({ groupId: i < 3 ? 'g1' : 'g2' })) }, { game: 'rotationMatch', solo: true, pairs: false, rotationMode: 'fixed', rotation: ROT }, 14);
const v2 = mk('2v2 · Sat', { groups: [{ id: 'g1', name: 'Group 1' }], teams: [], players: P(['Andrew', 'Sean', 'Sam', 'Jake']) }, { game: 'rotationMatch', solo: false, pairs: true, pairSwitch: 'turn', rotationMode: 'fixed', rotation: pairRotation('turn') }, 11);
const c6 = mk('Rider Cup for 6', {
  groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }],
  teams: [{ id: 'A', name: 'Hogan’s Heroes' }, { id: 'B', name: 'Shank Redemption' }, { id: 'C', name: 'Fore Play' }],
  players: P(['Andrew', 'Sean', 'Mike', 'Tyler', 'Sam', 'Jake'], (i) => ({ teamId: 'ABC'[Math.floor(i / 2)], groupId: i < 4 ? 'g1' : 'g2' })),
}, { game: 'rotationMatch', solo: false, pairs: false, rotationMode: 'fixed', rotation: threeCartRotation() }, 6, crew);
const RY = ['Andrew', 'Alex', 'Ant', 'Steve', 'Justin', 'Chuck', 'Mitch', 'Peter', 'Sean', 'Baker', 'Josh', 'Brandon', 'Joseph', 'Jay', 'Elijah', 'Marcus'];
const ry0 = ryderSetup(P(RY));
const ry = mk('Team Ryder Cup · Nov 9', ry0.roster, { ...normalizeSettings({}), ...ry0.settings }, 7, crew);
const ryf = mk('Team Ryder Cup · final', ry0.roster, { ...normalizeSettings({}), ...ry0.settings }, 18, crew);
const FIN = {};
for (const [g, src] of [['scorecard', sc], ['split', sp], ['match', mp], ['2v2', v2], ['carts6', c6]]) {
  const e = src.event; const x = mk(e.name + ' · final', e.roster, e.settings, 18, e.crew_id);
  x.event.finalized_at = new Date().toISOString(); FIN[g] = x;
}
be.tables.events.find((x) => x.id === rf.id).finalized_at = new Date().toISOString();
be.tables.events.find((x) => x.id === ryf.event.id).finalized_at = new Date().toISOString();
FIN.carts8 = rf; FIN.ryder = ryf;
const ROUNDS = [r, rf, r0, sc, sp, mp, v2, c6, ry, ryf, ...Object.values(FIN)];

const browser = await chromium.launch();
const SHOTS = [];
const MISSED = [];

async function phone({ me = true, flags = null, geo = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', ...(geo ? { permissions: ['geolocation'], geolocation: geo } : {}) });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([rounds, dev, me, flags]) => {
    if (flags) window.__GLB_FLAGS = flags;
    if (localStorage.getItem('__seeded')) return;
    localStorage.setItem('__seeded', '1');
    if (me) localStorage.setItem('glb.device', JSON.stringify(dev));
    for (const k of ['tile5', 'prov2', 'oppcart3', 'pad1', 'pad3', 'quiet1', 'matches1', 'board1']) localStorage.setItem('glb.coach.' + k, 'true');
    for (const [code, pin] of rounds) {
      localStorage.setItem('glb.who.' + code, 'true');
      localStorage.setItem('glb.brief.' + code, 'true');
      localStorage.setItem('glb.seen.' + code, JSON.stringify({ last: Date.now(), ids: [] }));
      if (me) {
        localStorage.setItem('glb.me.' + code, '"p1"');
        localStorage.setItem('glb.admin.' + code, JSON.stringify(pin));
      }
    }
  }, [ROUNDS.map((x) => [x.code, x.admin_pin]), DEV, me, flags]);
  const page = await ctx.newPage();
  return { ctx, page };
}

const clean = (page) => page.evaluate(() => {
  const o = document.getElementById('overlay'); if (o) { o.innerHTML = ''; o.className = 'overlay-root'; }
  const b = document.getElementById('banners'); if (b) b.innerHTML = '';
  const t = document.getElementById('toasts'); if (t) t.innerHTML = '';
});
async function go(page, hash, { keep = false } = {}) {
  await page.goto('about:blank'); // a fresh load each time: a hash change alone keeps open sheets and screen state
  await page.goto(`${srv.origin}/${hash}`);
  await page.waitForSelector('#loader', { state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  if (!keep) await clean(page);
}
const sheet = (page, name, props = {}) => page.evaluate(([n, p]) => window.__glb.openSheet(n, p), [name, props]).then(() => page.waitForTimeout(450));
const closeSheet = (page) => page.evaluate(() => window.__glb.closeSheet?.()).then(() => page.waitForTimeout(350));

const tab = (code, t) => `#/e/${code}/${t}`;
async function full(page) {
  for (let i = 0; i < 3; i++) {
    const extra = await page.evaluate(() => { const c = document.getElementById('content'); return c ? Math.max(0, c.scrollHeight - c.clientHeight) : 0; });
    if (extra < 4) break;
    const vp = page.viewportSize();
    await page.setViewportSize({ width: W, height: vp.height + extra });
    await page.waitForTimeout(450);
  }
}
async function cap(page, id, meta, fn, { long = true } = {}) {
  try {
    if (fn) { const r = await fn(); if (r === false) throw new Error('nothing to tap'); }
    await page.waitForTimeout(350);
    if (long) await full(page);
    const h = page.viewportSize().height;
    await page.screenshot({ path: `${OUT}${id}.jpg`, type: 'jpeg', quality: 86 });
    SHOTS.push({ id, h, ...meta });
    console.log('ok  ', id, h);
  } catch (e) {
    MISSED.push({ id, ...meta, error: e.message.split('\n')[0] });
    console.log('MISS', id, e.message.split('\n')[0]);
  }
  await page.setViewportSize({ width: W, height: H });
}
const tapFirst = (page, sels) => page.evaluate((sels) => {
  for (const s of sels) { const b = document.querySelector(s); if (b) { b.click(); return s; } }
  return false;
}, sels).then(async (s) => { await page.waitForTimeout(500); return s; });

const GAMES = [
  ['ryder', ry, 'Team Ryder Cup · 16'],
  ['carts8', r, 'Partner Rider Cup · 8'],
  ['carts6', c6, 'Partner Rider Cup · 6'],
  ['2v2', v2, '2v2 · 4'],
  ['match', mp, 'Match play · 5'],
  ['split', sp, 'Split point · 3'],
  ['scorecard', sc, 'Scorecard only · 4'],
];
const { ctx, page } = await phone();
for (const [g, rr, label] of GAMES) {
  const m = { game: g, gameLabel: label };
  await cap(page, `${g}-matches`, { ...m, view: 'matches', title: 'Matches' }, () => go(page, tab(rr.code, 'matches')));
  await cap(page, `${g}-matches-tap`, { ...m, view: 'matches-tap', title: 'Matches · tap a match' }, async () => { await go(page, tab(rr.code, 'matches')); return tapFirst(page, ['[data-act="ryder-match"]', '[data-act="ry-match"]', '[data-act="match-expand"]', '[data-act="match-mine"]', '[data-act="match-hole"]']); }, { long: false });
  await cap(page, `${g}-board`, { ...m, view: 'board', title: 'Board · Standings' }, () => go(page, tab(rr.code, 'board')));
  await cap(page, `${g}-players`, { ...m, view: 'players', title: 'Board · Players' }, async () => { await go(page, tab(rr.code, 'board')); return tapFirst(page, ['[data-act="board-view"][data-v="players"]', '[data-act="ry-view"][data-v="players"]', '[data-v="players"]']); });
  await cap(page, `${g}-board-tap`, { ...m, view: 'board-tap', title: 'Board · tap the top row' }, async () => { await go(page, tab(rr.code, 'board')); return tapFirst(page, ['[data-act="ry-match"]', '[data-act="board-team"]', '[data-act="board-match"]', '[data-act="board-player"]']); }, { long: false });
  await cap(page, `${g}-final`, { ...m, view: 'final', title: 'Board · final' }, () => go(page, tab(FIN[g].code, 'board')));
}
writeFileSync(`${OUT}manifest.json`, JSON.stringify({ size: `${W}×${H} @2x`, made: new Date().toISOString(), shots: SHOTS, missed: MISSED }, null, 1));
await browser.close(); srv.close?.();
console.log(SHOTS.length, 'shots,', MISSED.length, 'missed');
process.exit(0);
