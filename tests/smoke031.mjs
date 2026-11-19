// smoke031.mjs — the multi-phone rehearsal for the Nov 19 redesign (brief 031 + 027/028/029/030), against the mock,
// at iPhone 15/16 size. tests/smoke.mjs still drives the Nov 4 Enter (016) and stops at its first hole; this one covers
// what 031 changed: the lobby for every round (the gate, joining, Open now, Scoring is open), the calm Enter for every
// game with the rest of your group grown in place, own entry wins, the offline queue, Switch it up for a partner
// swap, and the 031 Board / Matches per game. Run: npm run test:smoke031 (PW_CHROMIUM=<path> if Playwright's own
// browser isn't installed).

import { chromium } from 'playwright';
import { createBackend, attach, serve, seedRound } from './mock-supabase.mjs';
import { COURSES } from '../js/courses.js';
import { pairRotation, sameOppsRotation, playOrder } from '../js/scoring.js';
import { wallDate, addMinutes, wallClock } from '../js/lobby.js';

const srv = await serve();
const be = createBackend();
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = [];
let failed = 0;
const ok = (cond, msg) => { results.push(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`); if (!cond) failed++; };
const COACH = ['tile5', 'prov2', 'oppcart3', 'pad1', 'pad3', 'quiet1', 'matches1', 'board1'];
const TC = COURSES[0];
const COURSE = { ...TC, tee: TC.tees[1] };
const BASE = { handicapMode: 'full', allowancePct: 100, teamScore: 'bestBallAggregate', halvedHolePoints: 0.5, matchBonus: 1, plusMinusCap: null, maxHoleScore: 'doublePar', par3NoMax: false, startHole: 1, rotationMode: 'fixed' };
const P = (names, extra = () => ({})) => names.map((n, i) => ({ id: `p${i + 1}`, personId: `person-${n.toLowerCase()}`, name: n, firstName: n, teamId: null, groupId: 'g1', strokes: null, ...extra(i) }));
let devN = 0;

function mk(name, roster, settings, { lobby = null, playedOn = null } = {}) {
  const r = be.rpc.create_event({ p_name: name, p_course: COURSE, p_roster: roster, p_settings: { ...BASE, ...settings, ...(lobby ? { lobby } : {}) }, p_played_on: playedOn });
  const ev = be.tables.events.find((x) => x.code === r.code);
  if (playedOn) ev.played_on = playedOn;
  return { ...r, ev };
}

/** A phone already in the round as `pid` (claim on the server + glb.me), or a fresh one (pid null). */
async function phone(label, round = null, pid = null, { admin = false } = {}) {
  const dev = `00000000-0000-4000-8000-${String(++devN).padStart(12, '0')}`;
  if (round && pid) be.tables.claims.push({ event_id: round.ev.id, player_id: pid, device_id: dev });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 659 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await attach(ctx, be, srv.origin);
  await ctx.addInitScript(([dev, code, pid, pin, coach]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('glb.device', JSON.stringify(dev));
    for (const k of coach) localStorage.setItem(`glb.coach.${k}`, 'true');
    if (code) { localStorage.setItem(`glb.brief.${code}`, 'true'); localStorage.setItem(`glb.who.${code}`, 'true'); }
    if (code && pid) { localStorage.setItem(`glb.me.${code}`, JSON.stringify(pid)); localStorage.setItem(`glb.seen.${code}.open`, 'true'); }
    if (code && pin) localStorage.setItem(`glb.admin.${code}`, JSON.stringify(pin));
  }, [dev, round?.code || null, pid, admin ? round.admin_pin : null, COACH]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`${label}: ${e.message}`));
  return { ctx, page, dev, label };
}
const pages = [];
const open = async (ph, hash) => { await ph.page.goto(`${srv.origin}/${hash}`); await ph.page.waitForSelector('#loader', { state: 'hidden', timeout: 8000 }).catch(() => {}); await ph.page.waitForTimeout(500); };
const text = (ph) => ph.page.evaluate(() => document.getElementById('content').innerText.replace(/\s+/g, ' ').trim());
const g = (ph, fn, arg) => ph.page.evaluate(fn, arg);
const scoreOn = (round, pid, h) => be.tables.scores.find((s) => s.event_id === round.ev.id && s.player_id === pid && s.hole === h)?.strokes ?? null;
const continueCard = async (ph) => {
  const card = await g(ph, () => document.getElementById('overlay')?.innerText || '');
  if (/continue to hole|let’s go/i.test(card)) { await ph.page.waitForTimeout(750); await ph.page.click('[data-act="card-continue"]'); await ph.page.waitForTimeout(150); }
  return card.replace(/\s+/g, ' ');
};

/** The calm Enter: pick par for `pids` (your card's players, or inside the grown card), the score shown on screen. */
async function pick(ph, pid, d = 0) {
  const v = await g(ph, ([pid, d]) => { const a = window.__glb; return a.snapshot.holes[a.ui.hole - 1].par + d; }, [pid, d]);
  const sel = `.grow.open .g-card .ce-pad[data-act="ce-pick"][data-pid="${pid}"][data-v="${v}"]`;
  if (!(await ph.page.$(sel))) {
    const row = `.ce-their [data-act="ce-padto"][data-pid="${pid}"]`; // 3+ others: move the pad row to them first
    if (await ph.page.$(row)) { await ph.page.click(row); await ph.page.waitForTimeout(80); }
  }
  await ph.page.click(sel);
  await ph.page.waitForTimeout(120);
  return v;
}
const mine = (ph) => g(ph, () => [...document.querySelectorAll('[data-grow="ce-mine"].open .g-card .ce-row .ce-pads')].map((el) => el.querySelector('[data-pid]')?.dataset.pid).filter(Boolean));
async function openTheirs(ph) {
  const sel = '.ce-slot:not([data-grow="ce-mine"]):not(.open) .ce-line';
  if (!(await ph.page.$(sel))) return false;
  await ph.page.click(sel);
  await ph.page.waitForTimeout(450);
  return true;
}
/** Wait (refetching) until every score in your group is in and Next hole is white. */
async function waitGo(ph, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await ph.page.$('.ce-next.go')) return true;
    await g(ph, () => window.__glb.refetch());
    await ph.page.waitForTimeout(300);
  }
  return false;
}
async function next(ph) {
  await ph.page.click('.ce-next');
  await ph.page.waitForTimeout(250);
  return continueCard(ph);
}

// ───────────────────────────────────────────── 1 · a lobby round: the gate, joining, Open now, Scoring is open
{
  const tz = 'UTC';
  const now = Date.now();
  const today = wallDate(now, tz);
  const later = addMinutes(wallClock(now, tz), 120); // 2 h from now (the mock uses the real clock)
  const lobby = { stage: 'ready', startTime: later, tz, opensAt: new Date(now + 90 * 60000).toISOString(), openedEarly: false, notice: null, cohost: null, prevStage: null, hostName: 'Andrew', hostId: 'p1' };
  const R = mk('Lobby · stroke play', { groups: [{ id: 'g1' }], teams: [], players: P(['Andrew', 'Sean', 'Sam', 'Jake']) }, { game: 'none', teeTimes: [later] }, { lobby, playedOn: today });
  ok(be.rpc.upsert_score({ p_code: R.code, p_device_id: '00000000-0000-4000-8000-999999999999', p_player_id: 'p1', p_hole: 1, p_strokes: 4 }).error !== undefined, 'server: nobody claimed, nothing written');
  const host = await phone('Andrew (organizer)', R, 'p1', { admin: true });
  pages.push(host);
  const gate = be.rpc.upsert_score({ p_code: R.code, p_device_id: host.dev, p_player_id: 'p1', p_hole: 1, p_strokes: 4 });
  ok(gate.error === 'not_open', `029: a non-Ryder round with a lobby refuses scores before it opens (${gate.error})`);
  // A friend opens the link: the invite, Find my name, pick Sean, the confirm.
  const sean = await phone('Sean', R, null);
  pages.push(sean);
  await open(sean, `#/e/${R.code}`);
  const inv = await text(sean);
  ok(/Andrew invited you/i.test(inv) && /Stroke play/i.test(inv), `the invite names the host and the game (${inv.slice(0, 70)}…)`);
  await sean.page.click('[data-act="lb-find"]');
  await sean.page.waitForTimeout(400);
  await sean.page.locator('[data-act="lb-pick"]', { hasText: 'Sean' }).first().click();
  await sean.page.waitForTimeout(600);
  if (await sean.page.$('[data-act="me-yes"]')) { await sean.page.click('[data-act="me-yes"]'); await sean.page.waitForTimeout(600); }
  ok((await g(sean, () => window.__glb.me)) === 'p2', 'Sean’s phone claimed Sean');
  const lob = await text(sean);
  ok(/today ·/i.test(lob) && /\dh \d+m|\d+ min/.test(lob) && /Your start time/i.test(lob) && /Scoring opens by itself/.test(lob), `the lobby: countdown hero, your start time, when it opens (${lob.slice(0, 90)}…)`);
  ok(!!(await sean.page.$('.lb-start.lit')), 'on the day your start time is the one lit thing');
  ok((await g(sean, () => window.__glb.setScore('p2', 1, 4))) === false, 'Sean can’t enter a score before it opens (UI)');
  // The organizer opens it early: the scoring row grows into its confirm in place.
  await open(host, `#/e/${R.code}/host`);
  const hl = await text(host);
  ok(/have Golf Board/.test(hl) && /Scoring opens at/.test(hl), `the organizer’s lobby (${hl.slice(0, 80)}…)`);
  await host.page.click('[data-act="hl-open-ask"]');
  await host.page.waitForTimeout(400);
  ok(!!(await host.page.$('.hl-open.open')) && /Open scoring now\?/.test(await text(host)), 'Open now grows into the confirm (no dialog)');
  await host.page.click('[data-act="hl-open-go"]');
  await host.page.waitForTimeout(800);
  ok(be.tables.events.find((x) => x.id === R.ev.id).settings.lobby.openedEarly === true, 'Open now saved (openedEarly)');
  await g(sean, () => window.__glb.refetch());
  await sean.page.waitForTimeout(800);
  const gd = await text(sean);
  ok(/Scoring is open/i.test(gd) && /Go to hole 1/.test(gd), `Sean’s phone: Scoring is open (${gd.slice(0, 70)}…)`);
  await sean.page.click('[data-act="lb-go1"]');
  await sean.page.waitForTimeout(600);
  ok(!!(await sean.page.$('.ce')), 'Go to hole 1 → the calm Enter');
  await pick(sean, 'p2');
  await sean.page.waitForTimeout(500);
  ok(scoreOn(R, 'p2', 1) === COURSE.par[0], `Sean’s par on 1 reached the server (${scoreOn(R, 'p2', 1)})`);
  await host.ctx.close(); await sean.ctx.close();
}

// ───────────────────────────────────────────── 2 · 2v2, partners switch every 6 (new scoring): two phones, the switch
{
  const R = mk('2v2 · partners', { groups: [{ id: 'g1' }], teams: [], players: P(['Andrew', 'Sean', 'Sam', 'Jake']) },
    { game: 'rotationMatch', pairs: true, pairSwitch: 'six', rotation: pairRotation('six'), holePoint: true, dayBy: 'stretches' });
  const A = await phone('Andrew', R, 'p1'), S = await phone('Sam', R, 'p3');
  pages.push(A, S);
  await open(A, `#/e/${R.code}/enter`); await open(S, `#/e/${R.code}/enter`);
  const line = await text(A);
  ok(/Andrew \+ Sean/i.test(line) && /vs Sam \+ Jake/i.test(line), `the line on top: your pair vs theirs (${line.slice(0, 80)}…)`);
  ok(JSON.stringify(await mine(A)) === '["p1","p2"]', 'your card: you, then your partner');
  let cards = [];
  for (let h = 1; h <= 6; h++) {
    for (const pid of await mine(A)) await pick(A, pid, pid === 'p1' ? -1 : 0); // Andrew's pair takes every hole
    for (const pid of await mine(S)) await pick(S, pid);
    const go = (await waitGo(A)) && (await waitGo(S));
    if (h === 1) ok(go, 'all four in: Next hole turns white on both phones');
    const c = [await next(A), await next(S)];
    for (const [i, ph] of [[0, A], [1, S]]) if (!/switch it up/i.test(c[i])) c[i] += await continueCard(ph); // a Lock in card, then on
    if (h === 6) cards = c;
  }
  ok(/Switch it up/i.test(cards[0]) && /With Sam/.test(cards[0]) && /vs Sean \+ Jake/.test(cards[0]), `Andrew’s Switch it up: who you’re with and who you play (${cards[0].slice(0, 90)})`);
  ok(/Switch it up/i.test(cards[1]) && /With Andrew/.test(cards[1]), 'Sam gets his own');
  ok(be.tables.scores.filter((s) => s.event_id === R.ev.id).length === 24, '6 holes × 4 scores on the server');
  const snap = await g(A, () => { const s = window.__glb.snapshot; return { ncomp: s.game.ncomp, won: Object.fromEntries(s.game.people.map((r) => [r.playerId, r.won])) }; });
  ok(snap.ncomp === 1 && snap.won.p1 === 1 && snap.won.p2 === 1 && snap.won.p3 === 0, `holes are one point; Andrew + Sean won stretch 1 (${JSON.stringify(snap.won)})`);
  await open(A, `#/e/${R.code}/board`);
  const bd = await text(A);
  ok(/stretches won/i.test(bd) && /Your matches/.test(bd) && /1st|T1/.test(bd), `031 Board: players by stretches won, your matches (${bd.slice(0, 80)}…)`);
  await open(A, `#/e/${R.code}/matches`);
  const mt = await text(A);
  ok(/^With Sam/.test(mt) && /to win/.test(mt), `031 Matches: one tab per partner (${mt.slice(0, 60)}…)`);
  // Own entry wins: Sam entered his own 7; Andrew sends a different number.
  await open(S, `#/e/${R.code}/enter`);
  const h7 = await g(S, () => window.__glb.ui.hole);
  await pick(S, 'p3', 2);
  await S.page.waitForTimeout(800);
  ok(scoreOn(R, 'p3', h7) != null, `Sam entered his own score on ${h7}`);
  const res = be.rpc.upsert_score({ p_code: R.code, p_device_id: A.dev, p_player_id: 'p3', p_hole: h7, p_strokes: 3 });
  ok(res.error === 'own_entry', `own entry wins: Andrew can’t overwrite Sam’s own score (${res.error})`);
  await A.ctx.close(); await S.ctx.close();
}

// ───────────────────────────────────────────── 3 · Everyone alone, 5 in one group: one phone enters everyone (grown card)
{
  const R = mk('Everyone alone · 5', { groups: [{ id: 'g1' }], teams: [], players: P(['Andrew', 'Josh', 'Sean', 'Chris', 'Jake']) }, { game: 'rotationMatch', solo: true });
  const A = await phone('Andrew', R, 'p1');
  pages.push(A);
  await open(A, `#/e/${R.code}/enter`);
  ok(JSON.stringify(await mine(A)) === '["p1"]', 'no carts: your card is just you');
  const quiet = await A.page.textContent('.ce-slot:not([data-grow="ce-mine"]) .ce-line');
  ok(/\+\d/.test(quiet) && /Enter/.test(quiet), `the rest of your tee time is one quiet row (${quiet.replace(/\s+/g, ' ').trim()})`);
  await pick(A, 'p1', -1);
  ok(await openTheirs(A), 'tap the quiet row');
  ok(/Entering for 4 players/.test(await text(A)) && !!(await A.page.$('[data-grow="ce-mine"]:not(.open)')), 'it grows open in place; your card folds into a row');
  for (const pid of ['p2', 'p3', 'p4', 'p5']) await pick(A, pid);
  await A.page.waitForTimeout(1800);
  ok(!(await A.page.$('.ce-slot.open:not([data-grow="ce-mine"])')), 'it folds by itself after the last score');
  ok(['p1', 'p2', 'p3', 'p4', 'p5'].every((p) => scoreOn(R, p, 1) != null), 'all five scores on the server');
  ok(/PTS · 1ST/.test(await text(A)), 'the line on top: points and place');
  await next(A);
  await open(A, `#/e/${R.code}/matches`);
  ok(/The race · thru 1/i.test(await text(A)), 'Matches: the race');
  // Offline: a score waits in the queue, then syncs.
  await open(A, `#/e/${R.code}/enter`);
  be.offline = true;
  await pick(A, 'p1');
  await A.page.waitForTimeout(1200);
  ok((await g(A, () => window.__glb.unsynced)) >= 1 && scoreOn(R, 'p1', 2) == null, 'no signal: the score waits in the queue');
  be.offline = false;
  await g(A, () => window.dispatchEvent(new Event('online')));
  await A.page.waitForTimeout(1000);
  ok(scoreOn(R, 'p1', 2) === COURSE.par[1], 'back online: it synced');
  await A.ctx.close();
}

// ───────────────────────────────────────────── 4 · Partner “Rider” Cup (8) and 2v2 Same all 18 (8): the cart views
{
  const R = seedRound(be, { holesPlayed: 3 });
  const round = { ...R, ev: be.tables.events.find((x) => x.code === R.code) };
  const A = await phone('Andrew', round, 'p1'), M = await phone('Mike', round, 'p3');
  pages.push(A, M);
  await open(A, `#/e/${R.code}/enter`); await open(M, `#/e/${R.code}/enter`);
  const h = await g(A, () => window.__glb.ui.hole);
  for (const pid of await mine(A)) await pick(A, pid);
  ok(await openTheirs(A), 'Andrew opens the other cart in place');
  for (const pid of ['p3', 'p4']) await pick(A, pid);
  await A.page.waitForTimeout(500);
  ok(['p1', 'p2', 'p3', 'p4'].every((p) => scoreOn(round, p, h) != null), `hole ${h}: Andrew entered his foursome from one phone`);
  await g(M, () => window.__glb.refetch()); await M.page.waitForTimeout(500);
  ok(!!(await M.page.$('.ce-next.go')), 'Mike’s phone sees them and can move on');
  await open(A, `#/e/${R.code}/board`);
  ok(/Leaderboard · official thru/i.test(await text(A)) && !!(await A.page.$('.p31-br.me.lit')), 'Board: carts ranked, your row lit');
  await A.ctx.close(); await M.ctx.close();
}
{
  const roster = {
    groups: [{ id: 'g1' }, { id: 'g2' }],
    teams: ['A', 'B', 'C', 'D'].map((id) => ({ id, name: `Cart ${id}` })),
    players: P(['Andrew', 'Sean', 'Sam', 'Jake', 'Mike', 'Tyler', 'Chris', 'Matt'], (i) => ({ teamId: 'ABCD'[Math.floor(i / 2)], groupId: i < 4 ? 'g1' : 'g2' })),
  };
  const R = mk('Same all 18', roster, { game: 'rotationMatch', rotation: sameOppsRotation(), holePoint: true });
  for (const p of roster.players) be.tables.scores.push({ event_id: R.ev.id, player_id: p.id, hole: 1, strokes: COURSE.par[0], updated_by: p.name, updated_at: new Date().toISOString() });
  const A = await phone('Andrew', R, 'p1');
  pages.push(A);
  await open(A, `#/e/${R.code}/board`);
  const t = await text(A);
  ok(/9½ to win/.test(t) && /Your match/i.test(t), `Same all 18: one match card per foursome, 9½ to win (${t.slice(0, 80)}…)`);
  await A.ctx.close();
}

// ───────────────────────────────────────────── 5 · Stroke play: one phone, the group view
{
  const R = mk('Stroke play · 3', { groups: [{ id: 'g1' }], teams: [], players: P(['Andrew', 'Sean', 'Sam']) }, { game: 'none' });
  const A = await phone('Andrew', R, 'p1');
  pages.push(A);
  await open(A, `#/e/${R.code}/enter`);
  await pick(A, 'p1');
  await openTheirs(A);
  await pick(A, 'p2', 1); await pick(A, 'p3', -1);
  await A.page.waitForTimeout(1800); // their card folds by itself; the line on top comes back
  ok(/T?\d(ST|ND|RD|TH)/.test(await text(A)), 'the line on top: to par and place');
  await next(A);
  await open(A, `#/e/${R.code}/matches`);
  ok(/^Your group/.test(await text(A)) && /Everyone on the Board/.test(await text(A)), 'Matches: your group’s last holes');
  await open(A, `#/e/${R.code}/board`);
  ok(/strokes to par/i.test(await text(A)), 'Board: to par');
  await A.ctx.close();
}

const errs = pages.flatMap((p) => p.page.errors || []).filter((e) => !/localStorage/.test(e));
ok(!errs.length, `no page errors${errs.length ? `: ${errs.slice(0, 3).join(' | ')}` : ''}`);
console.log(results.join('\n'));
console.log(`\n${results.length - failed} of ${results.length} passed`);
await browser.close();
srv.close?.();
process.exit(failed ? 1 : 0);
