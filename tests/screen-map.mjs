// Screen map: photographs every screen, sheet and state of the app against the mock backend,
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

const OUT = fileURLToPath(new URL('./screenshots/map/', import.meta.url));
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
const ROUNDS = [r, rf, r0, sc, sp, mp, v2, c6, ry, ryf];

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

let order = 0;
/** Run `fn` (navigate / tap), then photograph. A failure is listed, never fatal. */
async function cap(page, id, meta, fn) {
  try {
    if (fn) await fn();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}${id}.jpg`, type: 'jpeg', quality: 90 });
    SHOTS.push({ id, order: order++, ...meta });
    console.log('ok  ', id);
  } catch (e) {
    MISSED.push({ id, ...meta, error: e.message.split('\n')[0] });
    console.log('MISS', id, e.message.split('\n')[0]);
  }
}
const tab = (code, t) => `#/e/${code}/${t}`;

// ───────────── Home, crews, season (fresh phone first) ─────────────
{
  const { ctx, page } = await phone({ me: false });
  await cap(page, 'loader', { area: 'home', title: 'Loading screen', how: 'Every open, while the app loads', file: 'index.html · #loader' }, async () => { await page.goto(`${srv.origin}/#/`); await page.waitForTimeout(60); });
  await cap(page, 'home-fresh', { area: 'home', title: 'Home · first open', how: 'Open the site on a new phone', file: 'js/screens/home.js' }, () => go(page, '#/'));
  await cap(page, 'join-sheet', { area: 'home', title: 'Join a round', how: 'Home → Join with code', file: 'js/screens/sheets.js · join' }, () => sheet(page, 'join'));
  await closeSheet(page);
  await cap(page, 'homescreen-sheet', { area: 'home', title: 'Add to Home Screen', how: 'Home → Add to Home Screen (iPhone Safari only)', file: 'js/screens/sheets.js · homescreen' }, () => sheet(page, 'homescreen'));
  await closeSheet(page);
  await cap(page, 'crew-start', { area: 'home', title: 'Start a crew', how: 'Home → Start a crew', file: 'js/screens/crew.js' }, () => go(page, '#/crew/start'));
  // Joining a round from the group text link
  await cap(page, 'join-watching', { area: 'join', title: 'Round link, not signed in', how: 'Open the round link on a new phone', file: 'js/screens/enter.js' }, () => go(page, tab(r.code, 'enter')));
  await cap(page, 'join-who', { area: 'join', title: 'Who are you?', how: 'Round link → pick your name', file: 'js/screens/sheets.js · who' }, () => sheet(page, 'who'));
  await cap(page, 'join-confirm', { area: 'join', title: '“You’re Sean?” confirm', how: 'Who are you? → tap a name', file: 'js/screens/sheets.js · me-confirm' }, async () => { await closeSheet(page); await sheet(page, 'me-confirm', { pid: 'p2' }); });
  await cap(page, 'join-taken', { area: 'join', title: 'Name already taken', how: 'Who are you? → a name another phone has', file: 'js/screens/sheets.js · taken' }, async () => { await closeSheet(page); await sheet(page, 'taken', { pid: 'p1' }); });
  await cap(page, 'join-waiting', { area: 'join', title: 'Waiting to be let in', how: 'Taken → Ask to join', file: 'js/screens/sheets.js · waiting' }, async () => { await closeSheet(page); await page.evaluate(() => { window.__glb.waiting = { playerId: 'p1', status: 'pending' }; }); await sheet(page, 'waiting'); });
  await closeSheet(page);
  await ctx.close();
}

// ───────────── Setup (organizer) ─────────────
{
  const { ctx, page } = await phone();
  const S = { area: 'setup', file: 'js/screens/setup.js' };
  await cap(page, 'setup-course', { ...S, title: '1 · Find a course', how: 'Home → New round' }, () => go(page, '#/setup'));
  await cap(page, 'setup-noresults', { ...S, title: '1 · No results', how: 'Course search with a typo' }, async () => { await page.fill('#course-q', 'twin crek'); await page.waitForTimeout(900); });
  await page.fill('#course-q', ''); await page.waitForTimeout(400);
  await page.tap('[data-act="setup-mine"][data-v="twin-creeks-allen-tx"]').catch(() => {});
  await cap(page, 'setup-players-empty', { ...S, title: '2 · Players (empty)', how: 'Pick a course' });
  for (const n of ['Andrew Duong', 'Sean Baker', 'Mike Ortiz', 'Tyler Nguyen', 'Sam Patel', 'Jake Miller', 'Chris Young', 'Matt Ross']) {
    await page.fill('#new-player', n).catch(() => {}); await page.press('#new-player', 'Enter').catch(() => {}); await page.waitForTimeout(120);
  }
  await cap(page, 'setup-players', { ...S, title: '2 · Players', how: 'Add 8 players' });
  await cap(page, 'setup-hcp', { ...S, title: 'Handicap sheet', how: 'Players → tap a handicap', file: 'js/screens/sheets.js · hcp' }, () => page.tap('[data-act="setup-hcp"][data-i="1"]').then(() => page.waitForTimeout(400)));
  await page.tap('[data-act="hcp-done"]').catch(() => closeSheet(page));
  await page.waitForTimeout(300);
  await cap(page, 'setup-game', { ...S, title: '3 · Pick a game', how: 'Players → Next' }, () => page.tap('[data-act="setup-go"][data-v="game"]'));
  await page.tap('[data-act="setup-game"][data-v="carts"]').catch(() => {});
  await cap(page, 'setup-carts', { ...S, title: '4 · Carts', how: 'Pick Partner Rider Cup → Next' }, () => page.tap('[data-act="setup-go"][data-v="teams"]'));
  await cap(page, 'setup-tee', { ...S, title: '5 · Tee times', how: 'Carts → Next' }, () => page.tap('[data-act="setup-go"][data-v="tee"]'));
  await cap(page, 'setup-matchups', { ...S, title: '5b · Matchups (optional)', how: 'Tee times → Matchups' }, () => page.tap('[data-act="setup-go"][data-v="matchups"]'));
  await cap(page, 'setup-matchups-custom', { ...S, title: '5 · Custom matchups', how: 'Matchups → Custom' }, () => page.tap('[data-act="setup-custom"]'));
  await cap(page, 'setup-teamname', { ...S, title: 'Cart name picker', how: 'Carts → tap a cart name', file: 'js/screens/sheets.js · teamName' }, async () => { await page.evaluate(() => { const s = window.__glb.setup; s.screen = 'teams'; window.__glb.render(); }); await sheet(page, 'teamName', { teamId: 'A', setup: true }); });
  await closeSheet(page);
  await cap(page, 'setup-check', { ...S, title: 'Scorecard check', how: 'Start with a card that has gaps' }, () => page.evaluate(() => { const s = window.__glb.setup; s.screen = 'check'; window.__glb.render(); }));
  // Team Ryder Cup needs 16: add 8 more, then walk its own steps.
  await page.evaluate(() => { const s = window.__glb.setup; s.screen = 'players'; window.__glb.render(); });
  for (const n of ['Alex Kim', 'Josh Lee', 'Brandon Fox', 'Ant Diaz', 'Steve Park', 'Joseph Hall', 'Jay Cruz', 'Baker Moss']) {
    await page.fill('#new-player', n).catch(() => {}); await page.press('#new-player', 'Enter').catch(() => {}); await page.waitForTimeout(120);
  }
  await page.evaluate(() => document.activeElement?.blur()); // the app holds redraws while a text box has focus
  for (const [scr, t, how] of [['invite', '4 · Ryder: invite now or draft now', 'Pick Team Ryder Cup → Next'], ['when', '4b · When is the round', 'Invite now'], ['teams', '5 · Ryder carts', 'Draft now'], ['draft', '6 · Captains’ draft', 'Carts → Next'], ['tee', '7 · Ryder tee times', 'Draft → Next']]) {
    await cap(page, `setup-ryder-${scr}`, { ...S, game: 'ryder', title: t, how }, () => page.evaluate((scr) => { const s = window.__glb.setup; s.game = 'ryder'; s.screen = scr; window.__glb.render(); }, scr));
  }
  await cap(page, 'setup-2v2', { ...S, title: '4 · 2v2 partners', how: '4 players → 2v2 → Next' }, () => page.evaluate(() => { const s = window.__glb.setup; s.players = s.players.slice(0, 4); s.game = '2v2'; s.screen = 'teams'; window.__glb.render(); }));
  await cap(page, 'setup-live', { ...S, title: 'Round is live', how: 'Start round' }, () => page.evaluate(() => { const s = window.__glb.setup; s.saved = { code: 'TC482', admin_pin: '7319' }; window.__glb.render(); }));
  await page.evaluate(() => { window.__glb.setup = null; localStorage.removeItem('glb.setupDraft'); });
  await ctx.close();
}

// ───────────── In a round: one set of tabs per game ─────────────
const GAMES = [
  ['carts8', r, 'Partner Rider Cup · 8'],
  ['carts6', c6, 'Partner Rider Cup · 6'],
  ['ryder', ry, 'Team Ryder Cup · 16'],
  ['2v2', v2, '2v2'],
  ['match', mp, 'Match play · 5'],
  ['split', sp, 'Split point · 3'],
  ['scorecard', sc, 'Scorecard only · 4'],
];
const TABS = [['enter', 'Enter', 'js/screens/enter.js'], ['matches', 'Matches', 'js/screens/matches.js'], ['board', 'Board', 'js/screens/board.js'], ['card', 'Card', 'js/screens/card.js']];
{
  const { ctx, page } = await phone();
  for (const [g, rr, label] of GAMES) {
    for (const [t, tl, file] of TABS) {
      await cap(page, `${g}-${t}`, { area: 'round', game: g, gameLabel: label, tab: t, title: `${tl}`, how: `${label} round → ${tl} tab`, file }, () => go(page, tab(rr.code, t)));
    }
  }
  // Extra states on the Friday round
  const R = { area: 'round', game: 'carts8', gameLabel: 'Partner Rider Cup · 8' };
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'enter-their-cart', { ...R, tab: 'enter', title: 'Their scores sheet', how: 'Enter → tap the other cart’s row', file: 'js/screens/enter.js · ce-theirs' }, () => page.tap('.ce-line').then(() => page.waitForTimeout(450)));
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'enter-more', { ...R, tab: 'enter', title: 'Other scores (⋯)', how: 'Enter → ⋯ next to the 4 pads', file: 'js/screens/enter.js · ce-more' }, () => page.tap('[data-act="ce-more"]').then(() => page.waitForTimeout(450)));
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'enter-locked', { ...R, tab: 'enter', title: 'Enter · old hole (locked)', how: 'Enter → ◀ back 2+ holes', file: 'js/screens/enter.js' }, () => page.evaluate(() => { window.__glb.ui.hole = 3; window.__glb.render(); }));
  await cap(page, 'enter-preview', { ...R, tab: 'enter', title: 'Enter · hole ahead (Up next)', how: 'Enter → ▶ past your hole', file: 'js/screens/enter.js' }, () => page.evaluate(() => { window.__glb.ui.hole = 12; window.__glb.render(); }));
  await cap(page, 'enter-next-waiting', { ...R, tab: 'enter', title: 'Enter · Next hole tapped with blanks', how: 'Enter → Next hole before every score is in', file: 'js/screens/enter.js' }, async () => { await page.evaluate(() => { window.__glb.ui.hole = null; window.__glb.render(); }); await page.tap('.ce-next, .next-btn'); await page.waitForTimeout(200); });
  await go(page, tab(r.code, 'board'));
  await cap(page, 'board-players', { ...R, tab: 'board', title: 'Board · Players view', how: 'Board → Players', file: 'js/screens/board.js' }, () => page.tap('[data-act="board-view"][data-v="players"]'));
  await go(page, tab(ry.code, 'board'));
  await cap(page, 'ryder-match-sheet', { area: 'round', game: 'ryder', gameLabel: 'Team Ryder Cup · 16', tab: 'board', title: 'One Ryder match', how: 'Board / Matches → tap a match', file: 'js/screens/ryder.js · ryder-match' }, async () => { const ok = await page.evaluate(() => { const b = document.querySelector('[data-act="ry-match"]'); b?.click(); return !!b; }); if (!ok) throw new Error('no ry-match row'); await page.waitForTimeout(450); });
  await ctx.close();
}

// ───────────── Sheets & menus (Friday round) ─────────────
{
  const { ctx, page } = await phone();
  const S = { area: 'sheets', file: 'js/screens/sheets.js' };
  await go(page, tab(r.code, 'board'));
  const sheets = [
    ['menu', 'Round menu (⋯)', 'Any tab → ⋯', {}],
    ['you', 'You', 'Tap your name / avatar', {}],
    ['leave', 'Switch to watching', 'You → Switch to watching', {}],
    ['rules', 'Rules', '⋯ → Rules', {}],
    ['holes', 'Hole grid', 'Enter → tap the hole number', {}],
    ['team', 'Cart breakdown', 'Board → tap a cart', { teamId: 'A' }],
    ['player', 'Player scorecard', 'Card → tap a player', { pid: 'p3' }],
    ['hole', 'One hole of a match', 'Matches → tap a hole', { matchId: 'r1m1', hole: 2 }],
    ['edit', 'Edit someone’s score', 'Card → tap a score', { pid: 'p3', hole: 4 }],
    ['headlines', 'All headlines', 'Board → headline → See all', {}],
    ['pin', 'Organizer PIN', 'Fix a score on a finished round', {}],
    ['fixhole', 'Fix a hole (par / SI)', 'Enter → hole menu (organizer)', { hole: 10, par: 4, si: 7 }],
    ['confirm', 'Confirm (example)', 'Any destructive action', { title: 'Reset this round?', body: 'Every score is cleared for all 8 phones.', ok: 'Reset', danger: true }],
  ];
  for (const [n, title, how, props] of sheets) {
    await cap(page, `sheet-${n}`, { ...S, title, how, file: `js/screens/sheets.js · ${n}` }, () => sheet(page, n, props));
    await closeSheet(page);
  }
  // Full-screen cards and overlays
  const F = { area: 'overlays', file: 'js/screens/toasts.js' };
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'brief-1', { ...F, title: 'Today’s game · Rider Cup', how: 'First open of a round (also ⋯ → How today’s game works)', file: 'js/screens/brief.js' }, () => page.evaluate(() => window.__glb.openBrief()).then(() => page.waitForTimeout(500)));
  for (const [g, rr, label] of [['ryder', ry, 'Team Ryder Cup'], ['split', sp, 'Split point'], ['2v2', v2, '2v2']]) {
    await go(page, tab(rr.code, 'enter'));
    await cap(page, `brief-${g}`, { ...F, title: `Today’s game · ${label}`, how: 'First open of a round', file: 'js/screens/brief.js' }, () => page.evaluate(() => window.__glb.openBrief()).then(() => page.waitForTimeout(500)));
  }
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'team-picker', { ...F, title: 'Cart name picker (in round)', how: 'Joining a cart that has no name yet', file: 'js/screens/toasts.js · picker' }, () => page.evaluate(() => window.__glb.openTeamPicker()).then(() => page.waitForTimeout(500)));
  await go(page, tab(r.code, 'board'));
  await cap(page, 'headline-toast', { ...F, title: 'Headline banner', how: 'A score lands that changes the race', file: 'js/screens/toasts.js · showHeadlines' }, () => page.evaluate(() => { const h = window.__glb.snapshot && window.__glb.headlines?.slice?.(-2); window.__glb.toast({ title: 'Hogan’s Heroes take the lead', sub: 'Andrew birdies 9 · up 1½ with 9 to play' }); }));
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'card-switch', { ...F, title: 'Switch it up card', how: 'Finish the last hole of a rotation', file: 'js/screens/toasts.js · showCard' }, () => page.evaluate(() => window.__glb.showCard({ kicker: 'Switch it up', big: 'On to rotation 2', result: 'Hogan’s Heroes won holes 1–6, 3½ – 2½', sub: 'Holes 7–12: you play Fore Play', sub2: 'Mike + Tyler ride with Chris + Matt', button: 'Continue to hole 7' })).then(() => page.waitForTimeout(500)));
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'card-lockin', { ...F, title: 'Lock in / Close it out card', how: 'A hole that can clinch your match', file: 'js/screens/toasts.js · showCard' }, () => page.evaluate(() => window.__glb.showCard({ kicker: 'Hole 16', big: 'Close it out', result: 'Win this hole and the match is yours', sub: 'You’re up 2 with 3 to play', sunny: true, button: 'Let’s go' })).then(() => page.waitForTimeout(500)));
  await go(page, tab(r.code, 'enter'));
  await cap(page, 'coach-tip', { ...F, title: 'Coach tip', how: 'First time on Enter (once per phone)', file: 'js/screens/toasts.js · coach' }, async () => {
    await page.evaluate(() => { localStorage.removeItem('glb.coach.tile5'); });
    await go(page, tab(r.code, 'enter'), { keep: true });
  });
  await ctx.close();
}

// ───────────── Host (organizer) ─────────────
{
  const { ctx, page } = await phone();
  const S = { area: 'host', file: 'js/screens/host.js' };
  await cap(page, 'host-main', { ...S, title: 'Host settings', how: '⋯ → Host settings · organizer' }, () => go(page, tab(r.code, 'host')));
  for (const [v, t] of [['players', 'Host · Players'], ['rules', 'Host · Rules'], ['activity', 'Host · Activity']]) {
    await cap(page, `host-${v}`, { ...S, title: t, how: `Host → ${t.split('· ')[1]}` }, () => page.tap(`[data-act="host-tab"][data-v="${v}"]`).then(() => page.waitForTimeout(300)));
  }
  await cap(page, 'host-pin', { ...S, title: 'Host · organizer PIN', how: 'Host on a phone without the PIN' }, async () => { await page.evaluate((c) => localStorage.removeItem('glb.admin.' + c), r.code); await go(page, tab(r.code, 'host')); });
  await go(page, tab(ry.code, 'host'));
  await cap(page, 'host-ryder-rules', { ...S, game: 'ryder', title: 'Host · Rules (Team Ryder Cup lineups)', how: 'Ryder round → Host → Rules' }, () => page.tap('[data-act="host-tab"][data-v="rules"]').then(() => page.waitForTimeout(300)));
  await ctx.close();
}

// ───────────── End of round ─────────────
{
  const { ctx, page } = await phone();
  const E = { area: 'end' };
  be.tables.events.find((x) => x.id === rf.id).finalized_at = null;
  await cap(page, 'final-board', { ...E, title: 'Board · round over (Finalize)', how: 'Every score in, organizer’s phone', file: 'js/screens/board.js' }, () => go(page, tab(rf.code, 'board')));
  await cap(page, 'final-host', { ...E, title: 'Host · Finalize round', how: 'Host → Rules → Finalize', file: 'js/screens/host.js' }, async () => { await go(page, tab(rf.code, 'host')); await page.tap('[data-act="host-tab"][data-v="rules"]'); await page.evaluate(() => document.querySelector('[data-act="host-finalize"]')?.scrollIntoView({ block: 'center' })); });
  be.tables.events.find((x) => x.id === rf.id).finalized_at = new Date().toISOString();
  await cap(page, 'final-board-locked', { ...E, title: 'Board · Final, locked', how: 'After Finalize', file: 'js/screens/board.js' }, () => go(page, tab(rf.code, 'board')));
  await cap(page, 'final-enter', { ...E, title: 'Enter on a finished round', how: 'Enter tab once the round is over: opens the Board', file: 'js/screens/enter.js' }, () => go(page, tab(rf.code, 'enter')));
  await cap(page, 'final-fixing', { ...E, title: 'Enter · Fixing a finalized round', how: 'Final → Fix a score (organizer)', file: 'js/screens/enter.js' }, () => page.evaluate(() => document.querySelector('[data-act="pin-open"]').click()).then(() => page.waitForTimeout(400)).then(() => clean(page)));
  await cap(page, 'ryder-final', { ...E, game: 'ryder', title: 'Team Ryder Cup · final card', how: 'Every Ryder match done', file: 'js/screens/ryder.js · finalCard' }, () => go(page, tab(ryf.code, 'board')));
  await go(page, tab(rf.code, 'board'));
  await cap(page, 'recap', { ...E, title: 'Round recap (keepsake images)', how: 'Board → Round recap', file: 'js/screens/recap.js' }, async () => { await page.evaluate(() => window.__glb.openRecap()); await page.waitForSelector('.recap-img', { timeout: 8000 }); });
  await cap(page, 'recap-2', { ...E, title: 'Round recap · scrolled', how: 'Recap → scroll', file: 'js/screens/recap.js' }, () => page.evaluate(() => { const el = document.querySelector('.recap-img')?.closest('[class*="recap"]'); const sc = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== 'visible' && e.querySelector?.('.recap-img')); if (sc) sc.scrollTop = sc.clientHeight * 0.9; }));
  await ctx.close();
}

// ───────────── Before the first score, season, home with rounds ─────────────
{
  const { ctx, page } = await phone();
  const X = { area: 'states' };
  await cap(page, 'empty-board', { ...X, title: 'Board · before the first score', how: 'Round started, no scores yet', file: 'js/screens/board.js' }, () => go(page, tab(r0.code, 'board')));
  await cap(page, 'empty-matches', { ...X, title: 'Matches · before the first score', how: 'Round started, no scores yet', file: 'js/screens/matches.js' }, () => go(page, tab(r0.code, 'matches')));
  await cap(page, 'empty-enter', { ...X, title: 'Enter · hole 1, nothing in', how: 'Round started, no scores yet', file: 'js/screens/enter.js' }, () => go(page, tab(r0.code, 'enter')));
  // Visit rounds so Home has history, then Home + crew + season
  for (const x of [r, rf, c6, ry, sc]) await go(page, tab(x.code, 'board'));
  const HM = { area: 'home' };
  await cap(page, 'home-rounds', { ...HM, title: 'Home · with rounds + crew', how: 'Home after playing', file: 'js/screens/home.js' }, () => go(page, '#/'));
  await cap(page, 'home-rounds-2', { ...HM, title: 'Home · bottom', how: 'Home → the crew row, doors and foot', file: 'js/screens/home.js' }, () => page.evaluate(() => { const c = document.getElementById('content'); c.scrollTop = c.scrollHeight; }));
  await cap(page, 'crew-settings', { ...HM, title: 'Crew settings', how: 'Home → crew row → Standings → ⋯', file: 'js/screens/crew.js · crewSettings' }, async () => { await go(page, '#/'); await sheet(page, 'crewSettings', { id: crew }); });
  await closeSheet(page);
  await cap(page, 'crew-new-player', { ...HM, title: 'I’m new (crew)', how: 'Crew invite → I’m new', file: 'js/screens/crew.js · crewNew' }, () => sheet(page, 'crewNew', { id: crew }));
  await closeSheet(page);
  await cap(page, 'season', { area: 'season', title: 'Season standings', how: 'Home → crew card → Standings', file: 'js/screens/season.js' }, () => go(page, `#/season/${crew}`));
  await cap(page, 'season-2', { area: 'season', title: 'Season · scrolled', how: 'Season → scroll', file: 'js/screens/season.js' }, () => page.evaluate(() => { const c = document.getElementById('content'); c.scrollTop = c.scrollHeight; }));
  await cap(page, 'season-past', { area: 'season', title: 'Past seasons', how: 'Season → Seasons', file: 'js/screens/season.js' }, () => go(page, `#/season/${crew}/past`));
  await cap(page, 'crew-which', { area: 'home', title: 'Which one are you? (crew)', how: 'Crew invite link → pick yourself', file: 'js/screens/crew.js' }, () => go(page, `#/crew/which/${crew}`));
  await cap(page, 'crew-rename', { area: 'home', title: 'Name your crew', how: 'Standings → Name your crew', file: 'js/screens/crew.js' }, () => go(page, `#/crew/rename/${crew}`));
  await go(page, `#/season/${crew}`);
  await cap(page, 'season-new', { area: 'season', title: 'New season', how: 'Season → New season (crew owner)', file: 'js/screens/season.js · seasonNew' }, () => sheet(page, 'seasonNew', { id: crew }));
  await ctx.close();
}

// ───────────── GPS green card (flag on, standing on the tee) ─────────────
{
  const g = await import('../js/geodata.js');
  const tee10 = g.GEO['twin-creeks-allen-tx'].holes[9].tee;
  const { ctx, page } = await phone({ flags: { gps: true }, geo: { latitude: tee10[0], longitude: tee10[1], accuracy: 4 } });
  await cap(page, 'gps-enter', { area: 'round', game: 'carts8', gameLabel: 'Partner Rider Cup · 8', tab: 'enter', title: 'Enter · GPS green card', how: 'Enter on the course (GPS yardages on)', file: 'js/screens/greencard.js' }, () => go(page, tab(r.code, 'enter')));
  await ctx.close();
}

// ───────────── Team Ryder Cup lobby: invite now, draft later (025 + 026), driven like tests/lobby-smoke.mjs ─────────────
{
  const FIRST = ['Andrew', 'Alex', 'Josh', 'Brandon', 'Ant', 'Steve', 'Joseph', 'Jay', 'Sean', 'Baker', 'Mitch', 'Peter', 'Kyle', 'Chuck', 'Elijah', 'Marcus'];
  const HC = [8, 15, 4, 10, 6, 12, 11, 9, 5, 12, 7, 20, 16, 18, 14, 13];
  const lp = FIRST.map((f, i) => ({ id: `p${i + 1}`, personId: `person-lobby-${f.toLowerCase()}`, name: f, firstName: f, lastName: 'Test', strokes: HC[i], teamId: null, groupId: null }));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
  const lset = { ...ryderSetup(lp).settings, teeTimes: [], lobby: L.newLobby({ startTime: '23:00', tz: 'America/Chicago', hostName: 'Andrew', hostId: 'p1' }) };
  const made = be.rpc.create_event({ p_name: 'Bday Ryder Cup', p_course: COURSE, p_roster: { groups: [], teams: [], sides: [], players: lp }, p_settings: lset, p_played_on: today });
  const code = made.code;
  const LB = { area: 'lobby', file: 'js/screens/lobby.js' }, LH = { area: 'lobbyhost', file: 'js/screens/hostlobby.js' };
  const mkCtx = async (init, arg) => {
    const c = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    await attach(c, be, srv.origin);
    await c.addInitScript(init, arg);
    return c;
  };
  const hostCtx = await mkCtx(([c, pin]) => { localStorage.setItem('glb.admin.' + c, JSON.stringify(pin)); for (const k of ['tile5', 'prov2', 'oppcart3', 'pad1', 'pad3', 'quiet1', 'matches1', 'board1']) localStorage.setItem('glb.coach.' + k, 'true'); }, [code, made.admin_pin]);
  const host = await hostCtx.newPage();
  const t = (sel) => host.locator(sel).first().tap().then(() => host.waitForTimeout(450));
  await cap(host, 'lh-lobby', { ...LH, title: 'Host lobby · before carts', how: 'Organizer opens an invite-now round' }, () => go(host, tab(code, 'host')));
  await cap(host, 'lh-carts', { ...LH, title: 'Pair the carts', how: 'Host lobby → Pair the carts' }, () => t('[data-act="lh-carts"]'));
  await t('[data-act="setup-lobby-save"]').catch(() => {}); await host.waitForTimeout(800);
  await cap(host, 'lh-paired', { ...LH, title: 'Host lobby · carts paired', how: 'After saving carts' }, () => clean(host));
  const pctx = await mkCtx(() => { window.__GLB_IOS = true; });
  const pl = await pctx.newPage();
  const pt = (sel) => pl.locator(sel).first().tap().then(() => pl.waitForTimeout(500));
  await cap(pl, 'lb-invite', { ...LB, title: 'Invite (handicap reveal link)', how: 'Tap the invite link in the group text' }, () => go(pl, `#/e/${code}/hcp`));
  await cap(pl, 'lb-guide', { ...LB, title: 'Add to Home Screen guide', how: 'Invite → get started' }, () => pt('[data-act="lb-guide"]'));
  await cap(pl, 'lb-guide-late', { ...LB, title: 'Guide · “Can’t add it?” after 3 min', how: 'Guide, 3 minutes later' }, () => pl.evaluate(() => { window.__glb.ui.guideAt.at -= 181000; window.__glb.render(); }));
  await cap(pl, 'lb-names', { ...LB, title: 'Which one are you? (lobby)', how: 'Guide → Can’t add it, or the home screen app' }, () => pt('[data-act="lb-here"]'));
  await cap(pl, 'lb-confirm', { ...LB, title: '“You’re Baker?” confirm', how: 'Pick your name', file: 'js/screens/sheets.js · me-confirm' }, () => pt('[data-act="lb-pick"][data-v="p10"]'));
  await cap(pl, 'lb-reveal', { ...LB, title: 'Handicap reveal · press and hold', how: 'Confirm your name' }, () => pt('[data-act="me-yes"]'));
  await cap(pl, 'lb-revealed', { ...LB, title: 'Handicap revealed', how: 'Hold (or Just show me)' }, () => pt('[data-act="lb-rv-now"]').then(() => pl.waitForTimeout(2600)));
  await cap(pl, 'lb-day', { ...LB, title: 'Lobby · waiting for the draft', how: 'After the reveal' }, () => pt('[data-act="lb-revealed"]'));
  await host.reload(); await host.waitForTimeout(1500); await clean(host);
  await cap(host, 'lh-draft', { ...LH, title: 'Team draft', how: 'Host lobby → Draft' }, () => t('[data-act="lh-draft"]'));
  await t('[data-act="setup-ry-skip"]').catch(() => {});
  await t('[data-act="setup-lobby-save"]').catch(() => {}); await host.waitForTimeout(1000);
  await cap(host, 'lh-times', { ...LH, title: 'Start times', how: 'Draft saved' }, () => clean(host));
  await t('[data-act="setup-lobby-save"]').catch(() => {}); await host.waitForTimeout(1000);
  await host.evaluate(() => document.querySelector('[data-act="sheet-close"]')?.click()); await host.waitForTimeout(300);
  await cap(host, 'lh-ready', { ...LH, title: 'Host lobby · ready to play', how: 'Start times saved' }, () => clean(host));
  await cap(host, 'lh-order', { ...LH, title: 'Order and carts', how: 'Host lobby → Order and carts (until the first score)' }, () => t('[data-act="lh-order"]'));
  await pl.evaluate(() => window.__glb.refetch()); await pl.waitForTimeout(800);
  await cap(pl, 'lb-open', { ...LB, title: 'Scoring is open', how: 'Organizer saves start times on the day' }, () => clean(pl));
  await hostCtx.close(); await pctx.close();
}

// ───────────── Edge states ─────────────
{
  const { ctx, page } = await phone();
  await ctx.route('**/rest/v1/**', (route) => route.abort());
  await cap(page, 'no-signal', { area: 'states', title: 'No signal', how: 'Open a round with no connection (12 s)', file: 'js/app.js' }, async () => { await page.goto(`${srv.origin}/${tab(r.code, 'board')}`); await page.waitForTimeout(13500); });
  await cap(page, 'bad-code', { area: 'states', title: 'Round not found', how: 'Open a link with a wrong code', file: 'js/app.js' }, async () => { await ctx.unroute('**/rest/v1/**'); await attach(ctx, be, srv.origin); await go(page, tab('ZZZZZ', 'board')); });
  await ctx.close();
}

await browser.close();
srv.close();
writeFileSync(`${OUT}manifest.json`, JSON.stringify({ size: `${W}×${H} @2x`, made: new Date().toISOString(), shots: SHOTS, missed: MISSED }, null, 1));
console.log(`\n${SHOTS.length} screens, ${MISSED.length} missed`);
for (const m of MISSED) console.log('  missed', m.id, '·', m.error);
