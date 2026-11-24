// locker.js (screen) — 035 Scorecard locker (docs/design/features/035-scorecard-locker/SPEC.md §5, §7, §8).
// #/locker = your locker (one at a time · all · packs) · #/locker/admin = who has opened what (admins only)
// #/locker/p/<personId> = an admin's read-only view of someone's locker. Rules: js/locker.js (pure, tested).
//
// Stable under the render loop: mount() runs after every redraw, so the carousel's position comes back from
// app.ui.lk, the tilt loop stops itself once its track is gone, window listeners are added once, a flip and the
// caption are changed in the DOM (never app.render()), and keepContent holds redraws while a finger is on it.
// Home's two entries (homeLocker) render nothing at all if anything about the locker failed.

import * as db from '../db.js';
import * as fx from './toasts.js';
import { chromePack } from './pack.js';
import { landsFor, bookHtml, mountBook, pageOf } from './passport.js';
import { passportOf } from '../stamps.js';
import { esc, icon, reducedMotion } from '../ui.js';
import {
  buildLocker, packsOf, openedOf, FINISHES, isAdmin, LOCKER_ADMINS, shortDay, longDay, toParLabel, finName, adminTotals, backRows,
} from '../locker.js';

const STALE = 2 * 60 * 1000;
/** Preview copy only (…/preview/): test as a person in Safari (glb.previewAs) + practice packs. Never on the live site. */
const PREVIEW = typeof location !== 'undefined' && /\/preview\//.test(location.pathname);
const today = () => new Date().toLocaleDateString('en-CA');
/** The real mark (img/mark-dark.svg, 036 §2.1): the ring in the ink, the ball green. */
export const MARK = '<svg class="glb-mark" viewBox="0 0 100 100" aria-hidden="true"><circle cx="42" cy="58" r="30" fill="none" stroke="currentColor" stroke-width="13"/><circle cx="82" cy="20" r="11" fill="#3DDC84"/></svg>';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

let A = null; // the app, for the noscroll getter (read before render)

// ───────────────────────────────────────────── data

/** Fill app.lockers[personId] (and app.locker for this phone's owner) and redraw. Never throws. */
export async function loadLocker(app, personId, { force = false } = {}) {
  if (!personId) return null;
  app.lockers ||= {};
  const L = (app.lockers[personId] ||= { personId, cards: null, loading: false, error: null, at: 0, local: new Set() });
  const mine = personId === lockerPerson();
  if (mine) app.locker = L;
  if (L.loading || L.practice) return L; // preview practice packs: keep the resealed copy until it's switched off
  if (L.cards && !force && Date.now() - L.at < STALE) return L;
  L.loading = true;
  try {
    if (mine) await sendPending(personId, L);
    const [rows, opens] = await Promise.all([db.fetchPersonRounds(personId), db.fetchCardOpens(personId)]);
    const pending = db.lockerPending.all().filter((x) => x.personId === personId).map((x) => x.code);
    L.cards = buildLocker(rows, personId, { today: today(), opens, pending: [...pending, ...L.local] });
    L.error = null;
    L.at = Date.now();
  } catch {
    L.error = 'No signal';
  }
  L.loading = false;
  try { app.render(); } catch { /* the next render shows it */ }
  return L;
}

/** Packs opened offline: send them now. A refusal is dropped (kept opened for this session only). */
async function sendPending(personId, L) {
  for (const x of db.lockerPending.all().filter((y) => y.personId === personId)) {
    try {
      const res = await db.api.openCard(x.code, personId);
      if (!res?.ok) L.local.add(x.code);
      db.lockerPending.remove(x.code, personId);
    } catch {
      return; // still offline: try on the next load
    }
  }
}

/** Mark a pack opened here at once (the reveal never waits) and tell the server; offline → glb.lockerPending. */
function openNow(L, card) {
  if (card.opened) return;
  if (L.practice) { card.opened = true; return; } // preview practice: nothing is sent or saved
  card.opened = true;
  card.openedAt = new Date().toISOString();
  L.local.add(card.code);
  db.api.openCard(card.code, L.personId)
    .then((res) => { if (!res?.ok) console.warn('open_card', res?.error); })
    .catch(() => db.lockerPending.add(card.code, L.personId));
}

/**
 * Whose locker this phone shows: its owner (024); with no owner, the latest person it played as (glb.people, as
 * syncMyRounds does); else the person its own claims in Recent rounds belong to (found once, see startHomeLocker).
 */
let resolved = null, resolving = false;
function practiceRow(app, L) {
  if (!PREVIEW || !L?.cards?.length) return '';
  return L.practice
    ? `<div class="lk-practice ts-small"><span>Preview · practice packs. Nothing is saved; a reload puts your cards back.</span><button class="pill" data-act="lk-practice">Stop</button></div>`
    : `<div class="lk-practice ts-small"><span>Preview · reseal your ${L.cards.length} cards here to test opening them (nothing is saved)</span><button class="pill" data-act="lk-practice">Reseal</button></div>`;
}
export function lockerPerson() {
  const o = db.owner.get()?.personId;
  if (o) return o;
  const ppl = db.people.all();
  if (ppl.length) return ppl[ppl.length - 1];
  return (PREVIEW && db.local.get('glb.previewAs')) || resolved;
}
async function resolveFromClaims() {
  const mine = db.recent.all().map((r) => ({ code: r.code, pid: db.me.get(r.code) })).filter((x) => x.pid);
  if (!mine.length) return null;
  const rows = await db.fetchRosters(mine.map((x) => x.code));
  const n = new Map();
  for (const ev of rows) {
    if (String(ev.settings?.practice) === 'true') continue;
    const pid = mine.find((x) => x.code === ev.code)?.pid;
    const person = (ev.roster?.players || []).find((p) => p?.id === pid)?.personId;
    if (person) n.set(person, (n.get(person) || 0) + 1);
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
/** Home, every render: start this phone's locker once per person per page load. Never throws. */
let homeFor = null;
export function startHomeLocker(app) {
  A = app;
  try {
    const pid = lockerPerson();
    if (pid && homeFor !== pid) { homeFor = pid; loadLocker(app, pid).catch(() => {}); }
    if (!pid && !resolving) {
      resolving = true;
      resolveFromClaims().then((id) => { if (id) { resolved = id; app.render(); } }).catch(() => {});
    }
  } catch { /* Home as it was */ }
}
const ownerId = () => lockerPerson();
/** The locker this screen shows: yours, or (admin) the person in the route. */
const shownId = (app) => (app.route.mode === 'view' ? app.route.person : ownerId());
const lockerOf = (app, id) => (id ? app.lockers?.[id] : null) || null;

// ───────────────────────────────────────────── the card (§5): every size in cqw

const kind = (s, p) => { const d = s - p; return d <= -2 ? 'e' : d === -1 ? 'u' : d === 0 ? 'p' : d === 1 ? 'b' : 'd'; };
const tot = (a) => a.reduce((x, y) => x + y, 0);
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

// 036 §2.1: landscape (7 : 5), the whole scorecard on the front. Every size in cqw of the card face.
function nine(c, from) {
  const par = c.par.slice(from, from + 9), sc = c.strokes.slice(from, from + 9);
  return `<div class="x-n">${par.map((_, i) => `<span class="x-h">${from + i + 1}</span>`).join('')}<span class="x-h">${from ? 'In' : 'Out'}</span>
    ${sc.map((s, i) => `<span class="x-mk x-mk-${kind(s, par[i])}">${s}</span>`).join('')}<span class="x-t">${tot(sc)}</span></div>`;
}
/** Finish layers (§2.2): prismatic = oil slick + flash (the ink shifts in CSS); gold/silver/bronze = metal bands. */
const layers = (c) => (c.fin === 'prismatic' ? '<i class="x-slick"></i><i class="x-prism"></i>'
  : ['gold', 'silver', 'bronze'].includes(c.fin) ? '<i class="x-mslick"></i>' : '');

export function frontHtml(c) {
  const fin = c.fin === 'standard' ? '' : finName(c);
  return `<div class="lk-mat"><i class="lk-sheen"></i>${layers(c)}<div class="x-l1">
    <div class="x-top"><span class="lk-brand">${MARK}Golf Live Board</span><span class="x-fin">${esc(fin)}</span></div>
    <div class="x-hero"><div class="x-gross">${c.gross}</div><div class="x-meta"><div class="x-course">${esc(c.course)}</div>
      <div class="x-sub">${toParLabel(c.toPar)} · ${esc(longDay(c.day))}</div>
      <div class="x-stamps">${c.stamps.slice(0, 2).map((s) => `<span class="lk-st">${esc(s)}</span>`).join('')}</div></div></div>
    <div class="x-sc">${nine(c, 0)}${nine(c, 9)}</div>
    <div class="x-bot"><b>${esc(c.name)}</b><span>${c.crew ? 'With the crew' : 'Solo'}</span><span>No. ${c.n}</span></div>
  </div></div>`;
}

// 036 §2.3: the back = who you played with (left) + the round in numbers (right).
const plRow = (p, rank) => `<div class="cb-pl${p.me ? ' me' : ''}${p.sameTeeTime ? ' tm' : ''}">${rank ? `<i>${p.rank}</i>` : ''}<span>${esc(p.name)}</span><b>${p.gross}</b></div>`;
function peopleHtml(c) {
  const g = c.group?.length ? c.group : [{ name: c.name, gross: c.gross, rank: 1, me: true }];
  if (g.length === 1) return '<div class="cb-col"><div class="cb-k">Solo round</div></div>';
  if (g.length <= 6) {
    const low = g.find((x) => x.me)?.rank === 1 && g.filter((x) => x.rank === 1).length === 1;
    return `<div class="cb-col"><div class="cb-k">Played with · ${esc(shortDay(c.day))}</div>${g.map((p) => plRow({ ...p, sameTeeTime: false })).join('')}
      ${low ? '<div class="cb-k cb-after">Low round of the group</div>' : ''}</div>`;
  }
  const { rows, more, tee } = backRows(g);
  const t = tee ? ' · ● your tee time' : '';
  const tail = more ? `<div class="cb-k cb-after">+ ${more} more played${t}</div>` : tee ? '<div class="cb-k cb-after">● your tee time</div>' : '';
  return `<div class="cb-col cb-sm"><div class="cb-k cb-before">${g.length} played · ${esc(shortDay(c.day))}</div>
    ${rows.map((p) => (p.gap ? '<div class="cb-dots">···</div>' : plRow(p, true))).join('')}${tail}</div>`;
}
export function backHtml(c) {
  const k = c.stats.count;
  const g = c.group || [];
  const me = g.find((x) => x.me);
  const line = g.length >= 7 && me ? `${ordinal(me.rank)} of ${g.length} on the day`
    : c.fin === 'rookie' ? `${c.line}. The app is still learning your game.` : c.line;
  const tile = (v, lbl) => `<div class="cb-tile"><b>${v}</b><span>${lbl}</span></div>`;
  const types = c.stats.byType.map((t) => `<span><i>Par ${t.par}s</i>${toParLabel(t.toPar)}</span>`).join('');
  return `<div class="lk-mat"><i class="lk-sheen"></i>${c.fin === 'prismatic' ? '<i class="x-slick"></i>' : ''}<div class="cb">
    ${peopleHtml(c)}
    <div class="cb-col sb"><div><div class="cb-k">${esc(finName(c))}${c.grade ? ` · ${c.grade}` : ''}</div>${line ? `<div class="cb-line">${esc(line)}</div>` : ''}</div>
      <div class="cb-tiles">${tile(k.eagles + k.birdies, 'Birdies+')}${tile(k.pars, 'Pars')}${tile(k.bogeys, 'Bogeys')}${tile(k.doubles, 'Doubles+')}</div>
      <div class="cb-types">${types}<span><i>Front · back</i>${c.stats.front} · ${c.stats.back}</span></div></div>
  </div></div>`;
}

const label = (c) => `${c.course}, ${shortDay(c.day)}, ${c.gross}. ${FINISHES[c.fin].name} card.`;

/** One card in its slot: tilt → flip → front / back. `extra` = more classes on the slot. */
export function slotHtml(c, { i = 0, flipped = false, extra = '', act = 'lk-card' } = {}) {
  return `<div class="lk-slot x-land lkf-${c.fin}${extra}" data-i="${i}" data-key="${esc(c.key)}"${act ? ` data-act="${act}"` : ''}>
    <div class="lk-tilt" role="button" tabindex="0" aria-label="${esc(label(c))} Tap to flip it.">
      <div class="lk-flip${flipped ? ' on' : ''}"><div class="lk-face lk-front">${frontHtml(c)}</div><div class="lk-face lk-back">${backHtml(c)}</div></div>
      <i class="pk-glare"></i><i class="pk-sweep"></i>
    </div></div>`;
}

const capFin = (c) => (c.fin === 'rookie' ? `Rookie card ${c.rookieN} of 3` : FINISHES[c.fin].name);
const capLine = (c) => (c.fin === 'rookie' ? 'The app is still learning your game' : c.line);
function captionHtml(c) {
  return `<div class="lk-capfin ts-row">${esc(capFin(c))}${c.grade ? `<span class="lk-gr">${c.grade}</span>` : ''}</div>
    <div class="ts-small lk-soft">${esc(capLine(c)) || '&nbsp;'}</div>`;
}

// ───────────────────────────────────────────── the pack (§6)

let packCtx = null; // { personId, key, replay }

function openPack(app, card, { replay = false } = {}) {
  const L = lockerOf(app, card.personId);
  if (!L) return;
  const left = replay ? 0 : packsOf(L.cards).filter((x) => x.key !== card.key).length;
  // What lands under the card (036 §3.3), worked out as if this pack were already open.
  const lands = landsFor(card, L.cards.map((c) => (c.key === card.key ? { ...c, opened: true } : c)).filter((c) => c.opened));
  packCtx = { personId: card.personId, key: card.key, replay, page: lands.some((h) => h.includes('class="cs ')) ? 'courses' : lands.length ? 'milestones' : 'you' };
  fx.showPack({
    fin: card.fin, reduced: reducedMotion(), replay, left, lands,
    cardHtml: slotHtml(card, { act: null }),
    kicker: `${replay ? 'Rip again' : 'Final'} · ${shortDay(card.day)}`,
    hint: `${card.course} · ${shortDay(card.day)} · you shot ${card.gross}`,
    title: capFin(card), grade: card.grade, shot: card.gross,
    tilt: () => (gy.on ? { x: gy.x, y: gy.y } : null),
    onTear: () => { if (!replay) openNow(L, card); },
  });
}

// ───────────────────────────────────────────── carousel (one at a time)

const car = { track: null, slots: [], centers: [], half: 0, step: 1, active: 0, raf: 0, touching: false, until: 0, missed: false, settle: 0 };
const ptr = { on: false, x: 0, y: 0 };
const gy = { on: false, x: 0, y: 0, b0: null, g0: null, listening: false };
const sm = { x: 0, y: 0 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hasTilt = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  && !!window.matchMedia?.('(pointer: coarse)').matches && !reducedMotion();

function measure() {
  const t = car.track;
  if (!t?.isConnected) return;
  car.half = t.clientWidth / 2;
  car.centers = car.slots.map((s) => s.offsetLeft + s.offsetWidth / 2);
  car.step = car.slots.length > 1 ? car.centers[1] - car.centers[0] : (car.slots[0]?.offsetWidth || 1) + 12;
}
function scrollToIdx(i, smooth) {
  measure();
  if (car.centers[i] == null) return;
  car.track.scrollTo({ left: car.centers[i] - car.half, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}
/** 036 §2.2: --sx/--sy in −1…1 (the bands and prismatic ink follow them), --mv = how fast it moves (the flash). */
function put(el, rx, ry, sc) {
  const sx = clamp(ry / 12, -1, 1);
  const mv = reducedMotion() ? 0 : Math.max((el._mv || 0) * 0.93, Math.min(1, Math.abs(sx - (el._sx ?? sx)) * 130));
  el._sx = sx;
  el._mv = mv < 0.005 ? 0 : mv;
  const k = `${rx.toFixed(2)}|${ry.toFixed(2)}|${sc.toFixed(3)}|${el._mv.toFixed(2)}`;
  if (el._k === k) return;
  el._k = k;
  const st = el.style;
  st.setProperty('--rx', rx.toFixed(2));
  st.setProperty('--ry', ry.toFixed(2));
  st.setProperty('--sc', sc.toFixed(3));
  st.setProperty('--sx', sx.toFixed(3));
  st.setProperty('--sy', clamp(rx / 8, -1, 1).toFixed(3));
  st.setProperty('--mv', el._mv.toFixed(3));
}
function setActive(app, i) {
  const list = openedOf(lockerOf(app, shownId(app))?.cards);
  const c = list[i];
  if (!c || !car.track?.isConnected) return;
  car.active = i;
  app.ui.lk.key = c.key;
  car.slots.forEach((s, k) => { if (k !== i) s.querySelector('.lk-flip')?.classList.remove('on'); });
  if (app.ui.lk.flip !== c.key) app.ui.lk.flip = null;
  const root = car.track.closest('.lk');
  const cap = root?.querySelector('.lk-cap');
  if (cap) cap.innerHTML = captionHtml(c);
  const pos = root?.querySelector('.lk-pos');
  if (pos) pos.textContent = `${i + 1} of ${list.length}`;
}
function tick(ts) {
  car.raf = 0;
  if (!car.track?.isConnected || A?.route?.name !== 'locker') return; // the screen is gone: stop
  car.raf = requestAnimationFrame(tick);
  const rm = reducedMotion();
  const idle = !rm && !ptr.on && !gy.on ? Math.sin(ts / 1900) * 7 : 0;
  const tx = rm ? 0 : (ptr.on ? ptr.x * 13 : 0) + gy.y * 18 + idle;
  const ty = rm ? 0 : (ptr.on ? -ptr.y * 10 : 0) - gy.x * 14;
  sm.x += (tx - sm.x) * 0.12;
  sm.y += (ty - sm.y) * 0.12;
  const sl = car.track.scrollLeft;
  let best = 0, bd = 99;
  for (let i = 0; i < car.slots.length; i++) {
    const o = (car.centers[i] - sl - car.half) / car.step, a = Math.abs(o);
    if (a < bd) { bd = a; best = i; }
    if (a > 1.6) { put(car.slots[i], 0, o > 0 ? -24 : 24, 0.9); continue; }
    const act = a < 0.5;
    put(car.slots[i], act ? sm.y : 0, (rm ? 0 : -o * 18) + (act ? sm.x * (1 - a * 2) : 0), 1 - Math.min(1, a) * 0.1);
  }
  if (best !== car.active) setActive(A, best);
}

function onOri(e) {
  if (e.beta == null || e.gamma == null) return;
  if (gy.b0 == null) { gy.b0 = e.beta; gy.g0 = e.gamma; }
  gy.b0 += (e.beta - gy.b0) * 0.004; // slowly re-centre on how the phone is held
  gy.g0 += (e.gamma - gy.g0) * 0.004;
  gy.x = clamp((e.beta - gy.b0) / 22, -1, 1);
  gy.y = clamp((e.gamma - gy.g0) / 22, -1, 1);
  if (!gy.on) {
    gy.on = true;
    document.querySelectorAll('.lk-tiltbtn').forEach((b) => { b.hidden = true; });
    document.querySelectorAll('.lk-hint').forEach((b) => { b.hidden = false; b.textContent = 'Tilt your phone · tap to flip'; });
  }
}
function listenTilt() {
  if (gy.listening) return;
  gy.listening = true;
  window.addEventListener('deviceorientation', onOri);
}

let winOnce = false;
function windowOnce() {
  if (winOnce) return;
  winOnce = true;
  window.addEventListener('resize', () => { if (car.track?.isConnected) { measure(); scrollToIdx(car.active, false); } });
  const off = () => {
    if (!car.touching) return;
    car.touching = false;
    car.until = Date.now() + 250;
    settleLater();
  };
  window.addEventListener('touchend', off, { passive: true });
  window.addEventListener('touchcancel', off, { passive: true });
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') ptr.on = false; off(); });
  window.addEventListener('pointercancel', () => { ptr.on = false; off(); });
  // Phone tilt: Android sends it without asking; iPhone needs the button once (remembered in glb.lockerTilt).
  const D = window.DeviceOrientationEvent;
  if (hasTilt() && D && (typeof D.requestPermission !== 'function' || db.local.get('glb.lockerTilt'))) listenTilt();
}
/** A redraw held while the carousel moved runs once it has settled. */
function settleLater() {
  clearTimeout(car.settle);
  car.settle = setTimeout(() => {
    if (car.touching || Date.now() < car.until) return settleLater();
    if (car.missed && A?.route?.name === 'locker') { car.missed = false; A.render(); }
  }, 120);
}

function mountCarousel(content, app) {
  const track = content.querySelector('.lk-track');
  car.track = track;
  car.slots = track ? [...track.querySelectorAll('.lk-slot')] : [];
  if (!track || !car.slots.length) return;
  windowOnce();
  const list = openedOf(lockerOf(app, shownId(app))?.cards);
  let i = Math.max(0, list.findIndex((c) => c.key === app.ui.lk.key));
  car.active = i;
  scrollToIdx(i, false);
  setActive(app, i);
  track.addEventListener('scroll', () => { car.until = Date.now() + 160; settleLater(); }, { passive: true });
  track.addEventListener('touchstart', () => { car.touching = true; }, { passive: true });
  const onPtr = (e) => {
    const s = e.target.closest?.('.lk-slot');
    if (!s || Number(s.dataset.i) !== car.active) { ptr.on = false; return; }
    const r = s.getBoundingClientRect();
    ptr.on = true;
    ptr.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    ptr.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
  };
  track.addEventListener('pointermove', onPtr);
  track.addEventListener('pointerdown', onPtr);
  track.addEventListener('pointerleave', () => { ptr.on = false; });
  if (!car.raf) car.raf = requestAnimationFrame(tick);
}

// ───────────────────────────────────────────── views

function packsView(app, L, readOnly) {
  const packs = packsOf(L.cards);
  if (!packs.length) return '<p class="ts-small lk-soft">Every pack is open.</p>';
  return `<div class="lk-packs">${packs.map((c) => {
    const inner = `<span class="lk-ptile" aria-hidden="true">${chromePack()}</span>
      <span class="lk-plabel"><span class="ts-body">${esc(c.course)}</span><span class="ts-small lk-soft">${esc(shortDay(c.day))}</span></span>`;
    return readOnly
      ? `<div class="lk-pcell" aria-label="${esc(`${c.course}, ${shortDay(c.day)}, sealed`)}">${inner}</div>`
      : `<button class="lk-pcell" data-act="lk-open" data-v="${esc(c.key)}" aria-label="${esc(`Open the ${c.course} pack from ${shortDay(c.day)}`)}">${inner}</button>`;
  }).join('')}</div>`;
}

function oneView(app, opened, readOnly) {
  const lk = app.ui.lk;
  const land = lk.land && Date.now() - lk.landAt < 900 ? lk.land : null;
  const slots = opened.map((c, i) => slotHtml(c, { i, flipped: lk.flip === c.key, extra: land === c.key ? ' land' : '' })).join('');
  const tilt = hasTilt() && !gy.on && typeof window.DeviceOrientationEvent?.requestPermission === 'function';
  return `<div class="lk-one">
    <div class="lk-stage"><div class="lk-track">${slots}</div></div>
    <div class="lk-cap" aria-live="polite"></div>
    <div class="lk-foot"><span class="ts-label lk-pos"></span>
      <span class="lk-mid"><button class="pill lk-tiltbtn" data-act="lk-tilt"${tilt ? '' : ' hidden'}>Turn on tilt</button><span class="ts-small lk-soft lk-hint"${tilt ? ' hidden' : ''}>${gy.on ? 'Tilt your phone · tap to flip' : 'Tap the card to flip it'}</span></span>
      ${readOnly ? '<span></span>' : `<span class="lk-acts"><button class="icon-btn" data-act="lk-share" aria-label="Share this card">${icon('share', 20)}</button><button class="btn small" data-act="lk-rip">${icon('redo', 18)} Rip again</button></span>`}</div>
  </div>`;
}

function allView(opened) {
  return `<div class="lk-all">${opened.map((c, i) => `<button class="lk-mini lkf-${c.fin}" data-act="lk-pick" data-v="${esc(c.key)}" style="--sx:${((((i * 37) % 9) / 9) - 0.5).toFixed(2)}" aria-label="${esc(label(c))}"><span class="lk-face lk-front">${frontHtml(c)}</span></button>`).join('')}</div>`;
}

const isView = (app) => app.route.mode === 'view' && app.route.person !== ownerId();
const tabOf = (app) => app.ui.lk.tab || 'cards';

function lockerBody(app) {
  const id = shownId(app);
  const readOnly = isView(app);
  if (!id) {
    return `<div class="plain lk"><h1 class="ts-title">Locker</h1>
      <p class="ts-body lk-soft lk-gap">Open a round and pick your name once. Your scorecards show up here after that.</p>
      ${PREVIEW ? `<button class="btn block" data-act="lk-testas">Preview · test as ${esc('Andrew Duong')}</button>` : ''}</div>`;
  }
  const L = lockerOf(app, id);
  if (!L?.cards) {
    const err = L?.error && !L.loading;
    return `<div class="plain lk"><h1 class="ts-title">${readOnly ? 'Passport' : 'Locker'}</h1>
      ${err ? `<p class="ts-body lk-soft lk-gap">No signal. ${readOnly ? 'The passport' : 'Your scorecards'} need a connection.</p><button class="btn block" data-act="lk-retry">Try again</button>`
        : `<p class="meta lk-gap">Opening ${readOnly ? 'the passport' : 'your locker'}…</p>`}</div>`;
  }
  const cards = L.cards;
  const opened = openedOf(cards), packs = packsOf(cards);
  const lk = app.ui.lk;
  if (!cards.length) {
    return `<div class="plain lk"><h1 class="ts-title">${readOnly ? 'Passport' : 'Locker'}</h1>
      <p class="ts-body lk-soft lk-gap">${readOnly ? 'No finished rounds yet.' : 'Finish 18 holes and your scorecard arrives here as a pack.'}</p></div>`;
  }
  const tab = tabOf(app);
  const who = readOnly ? (cards[cards.length - 1]?.fullName || app.lockerAdmin?.people?.find((p) => p.person_id === id)?.name || cards[0]?.name || '') : '';
  const tabBtn = (v, lbl) => `<button data-act="lk-tab" data-v="${v}" aria-pressed="${tab === v}">${lbl}</button>`;
  const tabs = `<div class="seg lk-tabs" role="group" aria-label="Locker">${tabBtn('cards', 'Cards')}${tabBtn('passport', 'Passport')}</div>`;
  const head = `${who ? `<div class="ts-label lk-k">${esc(who)} · view only</div>` : ''}
    <div class="lk-head"><h1 class="ts-title">${readOnly ? esc(`${who.split(' ')[0] || 'Their'}’s locker`) : 'Locker'}</h1>
      ${packs.length && !readOnly ? `<button class="pill lk-ppill" data-act="lk-view" data-v="${lk.view === 'packs' && tab === 'cards' ? 'one' : 'packs'}" aria-pressed="${lk.view === 'packs' && tab === 'cards'}">${icon('pack', 18)} Packs · ${packs.length}</button>` : ''}</div>
    ${readOnly ? '' : practiceRow(app, L)}${tabs}`;
  if (tab === 'passport') {
    return `<div class="plain lk lk-t-passport">${head}${bookHtml(cards, app.ui.pp, { frontHtml, readOnly })}</div>`;
  }
  if (!opened.length && packs.length) lk.view = 'packs';
  if (lk.view === 'packs' && !packs.length) lk.view = 'one';
  const sub = opened.length ? `${plural(opened.length, 'scorecard')} since ${shortDay(opened[opened.length - 1].day)}` : `${plural(packs.length, 'pack')} ${readOnly ? 'sealed' : 'to open'}`;
  const segBtn = (v, ic, lbl) => `<button data-act="lk-view" data-v="${v}" aria-pressed="${lk.view === v}" aria-label="${lbl}">${icon(ic, 22)}</button>`;
  const view = lk.view === 'packs' ? packsView(app, L, readOnly) : lk.view === 'all' ? allView(opened) : oneView(app, opened, readOnly);
  return `<div class="plain lk lk-t-cards lk-v-${lk.view}">${head}
    <div class="lk-subrow"><span class="ts-small lk-soft">${esc(sub)}</span>
      ${readOnly && packs.length && opened.length ? `<button class="pill lk-ppill" data-act="lk-view" data-v="${lk.view === 'packs' ? 'one' : 'packs'}" aria-pressed="${lk.view === 'packs'}">${icon('pack', 18)} Sealed · ${packs.length}</button>` : ''}
      ${opened.length ? `<div class="seg lk-seg" role="group" aria-label="View">${segBtn('one', 'cardone', 'One card at a time')}${segBtn('all', 'grid', 'All cards')}</div>` : ''}</div>
    ${view}
  </div>`;
}

function adminBody(app) {
  if (!isAdmin(ownerId())) {
    return `<div class="plain lk"><h1 class="ts-title">Locker</h1><p class="ts-body lk-soft lk-gap">This list is for the organizer.</p>
      <button class="btn block" data-act="go" data-v="#/locker">Back to your locker</button></div>`;
  }
  const a = app.lockerAdmin;
  if (!a?.people) {
    return `<div class="plain lk"><div class="ts-label lk-k">Scorecard locker</div><h1 class="ts-title">Who’s opened what</h1>
      ${a?.error && !a.loading ? '<p class="ts-body lk-soft lk-gap">No signal.</p><button class="btn block" data-act="lk-admin-retry">Try again</button>' : '<p class="meta lk-gap">Adding it up…</p>'}</div>`;
  }
  const t = adminTotals(a.people);
  const last = (iso) => (iso ? shortDay(new Date(iso).toLocaleDateString('en-CA')) : '—');
  const rows = a.people.map((p) => {
    const wait = Math.max(0, Number(p.rounds) - Number(p.opened));
    return `<button class="lk-arow" data-act="go" data-v="#/locker/p/${encodeURIComponent(p.person_id)}">
      <span class="lk-aname ellipsis">${esc(p.name)}</span><span class="mono">${p.rounds}</span><span class="mono">${p.opened}</span>
      <span class="mono${wait ? ' lk-wait' : ''}">${wait}</span><span class="mono lk-soft">${esc(last(p.last_opened))}</span></button>`;
  }).join('');
  return `<div class="plain lk lk-admin"><div class="ts-label lk-k">Scorecard locker</div><h1 class="ts-title">Who’s opened what</h1>
    <p class="ts-small lk-soft lk-gap">${plural(t.people, 'person', 'people')} · ${plural(t.packs, 'pack')} · ${t.opened} opened</p>
    <div class="lk-ahead ts-label"><span>Player</span><span>Rds</span><span>Open</span><span>Wait</span><span>Last</span></div>
    <div class="lk-atable">${rows}</div></div>`;
}

async function loadAdmin(app) {
  app.lockerAdmin ||= { people: null, loading: false, error: null };
  const a = app.lockerAdmin;
  if (a.loading) return;
  a.loading = true;
  try {
    const res = await db.api.lockerAdmin();
    if (res?.ok) { a.people = res.people || []; a.error = null; } else a.error = res?.error || 'error';
  } catch { a.error = 'No signal'; }
  a.loading = false;
  app.render();
}

// ───────────────────────────────────────────── Home (§7.1): the packs card + the Locker row

/** Home's avatar name when this browser has no rounds of its own but knows its locker person (the preview in Safari). */
export function lockerName() {
  try {
    const cards = A?.lockers?.[lockerPerson()]?.cards;
    return cards?.length ? cards[cards.length - 1].fullName || cards[cards.length - 1].name : '';
  } catch { return ''; }
}

/** 036 §4.1: "5 scorecards · 3 courses · 4 milestones". */
function homeSub(opened) {
  const pp = passportOf([...opened].reverse());
  return [plural(opened.length, 'scorecard'), plural(pp.courses.length, 'course'), pp.milestones.length ? plural(pp.milestones.length, 'milestone') : '']
    .filter(Boolean).join(' · ');
}

/** { packs, row } HTML for Home; both '' unless this phone's person has a card or pack. Never throws. */
export function homeLocker(app) {
  try {
    const pid = lockerPerson();
    if (PREVIEW && !pid) {
      return { packs: `<button class="lk-ready" data-act="lk-testas"><span class="lk-rtext"><span class="ts-label lk-soft">Preview only</span>
        <span class="ts-row">Test the locker as Andrew Duong</span><span class="ts-small lk-soft">This browser doesn’t know who you are yet. Tap once; it’s remembered here.</span></span>
        <span class="hr-chev">${icon('fwd', 20)}</span></button>`, row: '' };
    }
    const L = pid ? app.lockers?.[pid] : null;
    if (!L?.cards?.length) return { packs: '', row: '' };
    const packs = packsOf(L.cards), opened = openedOf(L.cards);
    const newest = packs[packs.length - 1];
    const card = packs.length ? `<button class="lk-ready" data-act="lk-home-packs">
        <span class="lk-rpack" aria-hidden="true">${chromePack()}<b class="lk-pip">${packs.length}</b></span>
        <span class="lk-rtext"><span class="ts-label lk-soft">${plural(packs.length, 'pack')} ready</span><span class="ts-row">Open your scorecard${packs.length === 1 ? '' : 's'}</span>
          <span class="ts-small lk-soft ellipsis">${esc(newest.course)} · ${esc(shortDay(newest.day))}</span></span>
        <span class="hr-chev">${icon('fwd', 20)}</span></button>` : '';
    const fan = opened.length
      ? opened.slice(0, 3).reverse().map((c) => `<i class="lkf-${c.fin}"></i>`).join('')
      : '<i class="lk-fan-pack"></i>';
    const row = `<button class="home-row" data-act="go" data-v="#/locker">
        <span class="lk-fan" aria-hidden="true">${fan}</span>
        <span class="hr-main"><span class="hr-name">Locker</span><span class="hr-sub">${opened.length ? homeSub(opened) : `${plural(packs.length, 'pack')} to open`}</span></span>
        <span class="hr-chev">${icon('fwd', 20)}</span></button>`;
    return { packs: card, row };
  } catch {
    return { packs: '', row: '' };
  }
}

// ───────────────────────────────────────────── How cards work (sheet)

export const lockerSheets = {
  lockerHow(app, props, head) {
    const li = (f, name, sub) => `<li><span class="lk-sw lkf-${f}"></span><span class="lk-howt"><span class="ts-body">${name}</span><span class="ts-small lk-soft">${sub}</span></span></li>`;
    return `${head('How cards work', 'Every finished 18 earns a card')}
      <ul class="lk-how">
        ${li('prismatic', 'Prismatic · S', '5 or more better than your normal')}
        ${li('gold', 'Gold · A', '3 or 4 better than your normal')}
        ${li('silver', 'Silver · B', 'Your normal, or up to 2 better')}
        ${li('bronze', 'Bronze · C', '1 to 3 over your normal')}
        ${li('standard', 'Standard', 'Any other finished round')}
        ${li('rookie', 'Rookie', 'Your first 3 rounds, while the app learns your game')}
      </ul>
      <p class="ts-small lk-soft"><b>Launch cards.</b> Rounds played by Nov 21, 2026 are ranked against each other: your best is prismatic, then gold, silver and bronze.</p>
      <p class="ts-small lk-soft"><b>Your normal.</b> Your last 20 rounds, leaving out the worst fifth, averaged. A bad streak never makes prismatic easier.</p>
      <p class="ts-small lk-soft"><b>The card.</b> Your whole scorecard is on the front. Tap it to flip: who you played with and the round in numbers. Tilt your phone and the metal moves.</p>
      <p class="ts-small lk-soft"><b>Passport.</b> The first time you finish 18 at a course, its stamp goes in your passport. Milestones (first birdie, broke 90, a new lowest round) get a stamp too. Tap a friend’s name to see theirs.</p>
      <button class="btn block" data-act="sheet-close" style="margin-top:12px">Done</button>`;
  },
};

// ───────────────────────────────────────────── the screen

function ensureUi(app) {
  app.ui.lk ||= { view: 'one', key: null, flip: null, land: null, landAt: 0, person: null, tab: 'cards' };
  app.ui.pp ||= { pg: 0 };
  return app.ui.lk;
}

export default {
  get noscroll() {
    if (!A || A.route?.name !== 'locker' || A.route.mode === 'admin') return false;
    const L = lockerOf(A, shownId(A));
    return !!L?.cards && (A.ui.lk?.tab || 'cards') === 'cards' && A.ui.lk?.view === 'one' && openedOf(L.cards).length > 0;
  },
  enter(app) {
    A = app;
    const lk = ensureUi(app);
    const id = shownId(app);
    if (lk.person !== id) { lk.person = id; lk.key = null; lk.flip = null; app.ui.pp.pg = app.route.tab === 'passport' ? 1 : 0; if (app.route.mode === 'view') lk.view = 'one'; }
    if (app.route.tab) { lk.tab = app.route.tab; app.ui.pp.pg = 1; } // #/passport opens the book on the holder page
    if (/^#\/locker\/p\//.test(location.hash)) history.replaceState(null, '', `#/passport/${encodeURIComponent(id)}`); // 035 link → 036
    if (app.route.mode === 'admin') loadAdmin(app);
    else if (id) loadLocker(app, id);
    else startHomeLocker(app); // no owner yet: find who this phone played as, then load
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;
  },
  topBack(app) {
    if (app.route.mode === 'admin') return `<button class="back" data-act="go" data-v="#/locker">${icon('back', 22)}<span>Locker</span></button>`;
    if (isView(app)) return `<button class="back" data-act="lk-back">${icon('back', 22)}<span>Back</span></button>`;
    return '';
  },
  topRight(app) {
    if (app.route.mode === 'admin') return '';
    const adm = !isView(app) && isAdmin(ownerId())
      ? `<button class="icon-btn" data-act="go" data-v="#/locker/admin" aria-label="Who’s opened what">${icon('people')}</button>` : '';
    return `${adm}<button class="icon-btn" data-act="lk-how" aria-label="How cards work">${icon('info')}</button>`;
  },
  keepContent() {
    const held = !!car.track?.isConnected && (car.touching || Date.now() < car.until);
    if (held) car.missed = true;
    return held;
  },
  render(app) {
    A = app;
    ensureUi(app);
    return app.route.mode === 'admin' ? adminBody(app) : lockerBody(app);
  },
  mount(content, app) {
    car.track = null;
    if (app.route.mode === 'admin') return;
    if (tabOf(app) === 'passport') mountBook(content, app.ui.pp);
    else if (app.ui.lk?.view === 'one') mountCarousel(content, app);
  },
  actions: {
    'lk-tab': (el, ev, app) => {
      app.ui.lk.tab = el.dataset.v;
      app.ui.lk.flip = null;
      if (el.dataset.v === 'passport' && !app.ui.pp.pg) app.ui.pp.pg = 1;
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'lk-practice': (el, ev, app) => {
      const L = lockerOf(app, ownerId());
      if (!PREVIEW || !L?.cards) return;
      if (L.practice) { L.cards = L.real; L.real = null; L.practice = false; }
      else { L.real = L.cards; L.cards = L.cards.map((c) => ({ ...c, opened: false, openedAt: null })); L.practice = true; Object.assign(app.ui.lk, { tab: 'cards', view: 'packs' }); }
      app.render();
    },
    'lk-testas': (el, ev, app) => {
      if (!PREVIEW) return;
      db.local.set('glb.previewAs', LOCKER_ADMINS[0]); // remembered in this browser; only the preview reads it
      startHomeLocker(app);
      app.render();
    },
    'lk-back': (el, ev, app) => { if (history.length > 1) history.back(); else app.go('#/'); },
    'lk-view': (el, ev, app) => {
      app.ui.lk.tab = 'cards';
      app.ui.lk.view = el.dataset.v;
      app.ui.lk.flip = null;
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'lk-card': (el, ev, app) => {
      const i = Number(el.dataset.i);
      if (i !== car.active) { scrollToIdx(i, true); return; }
      const f = el.querySelector('.lk-flip');
      const on = !f.classList.contains('on');
      f.classList.toggle('on', on);
      app.ui.lk.flip = on ? el.dataset.key : null;
    },
    // the passport: a stamp or a showcase card opens the card it came from, in the Cards tab
    'pp-card': (el, ev, app) => {
      const L = lockerOf(app, shownId(app));
      if (!L?.cards?.some((c) => c.key === el.dataset.v && c.opened)) return;
      Object.assign(app.ui.lk, { tab: 'cards', view: 'one', key: el.dataset.v, flip: null });
      app.render();
    },
    'pp-share': (el, ev, app) => {
      const L = lockerOf(app, shownId(app));
      if (L?.cards) import('./share036.js').then((m) => m.sharePassport(L.cards)).catch((e) => console.warn('share', e));
    },
    'lk-share': (el, ev, app) => {
      const L = lockerOf(app, shownId(app));
      const card = openedOf(L?.cards)[car.active];
      if (card) import('./share036.js').then((m) => m.shareCard(card, L.cards)).catch((e) => console.warn('share', e));
    },
    'lk-pick': (el, ev, app) => {
      Object.assign(app.ui.lk, { view: 'one', key: el.dataset.v, flip: null });
      app.render();
    },
    'lk-open': (el, ev, app) => {
      if (isView(app)) return; // someone else's packs stay sealed
      const card = lockerOf(app, ownerId())?.cards?.find((c) => c.key === el.dataset.v && !c.opened);
      if (card) openPack(app, card);
    },
    'lk-rip': (el, ev, app) => {
      const card = openedOf(lockerOf(app, shownId(app))?.cards)[car.active];
      if (card) openPack(app, card, { replay: true });
    },
    'lk-tilt': (el) => {
      const D = window.DeviceOrientationEvent;
      const fail = () => { el.hidden = true; const h = document.querySelector('.lk-hint'); if (h) h.hidden = false; };
      if (typeof D?.requestPermission !== 'function') { listenTilt(); return; }
      D.requestPermission().then((r) => {
        if (r === 'granted') { db.local.set('glb.lockerTilt', true); listenTilt(); } else fail();
      }).catch(fail);
    },
    'lk-how': (el, ev, app) => app.openSheet('lockerHow', {}),
    'lk-retry': (el, ev, app) => { loadLocker(app, shownId(app), { force: true }); app.render(); },
    'lk-admin-retry': (el, ev, app) => { loadAdmin(app); app.render(); },
    'lk-home-packs': (el, ev, app) => { ensureUi(app).view = 'packs'; app.go('#/locker'); },
    // the pack overlay's buttons
    'lk-pack-close': (el, ev, app) => { fx.closePack(); packCtx = null; app.render(); },
    'lk-pack-flip': () => {
      const root = document.querySelector('#overlay .pk');
      if (root?.classList.contains('done')) root.querySelector('.lk-flip')?.classList.toggle('on');
    },
    'lk-pack-add': (el, ev, app) => {
      const ctx = packCtx;
      fx.closePack();
      packCtx = null;
      if (!ctx) return;
      Object.assign(ensureUi(app), { tab: 'cards', view: 'one', key: ctx.key, flip: null, land: ctx.replay ? null : ctx.key, landAt: Date.now() });
      if (app.route.name === 'locker' && app.route.mode === 'mine') app.render();
      else app.go('#/locker');
    },
    'lk-pack-share': () => {
      const ctx = packCtx;
      const L = ctx && lockerOf(A, ctx.personId);
      const card = L?.cards?.find((c) => c.key === ctx.key);
      if (card) import('./share036.js').then((m) => m.shareCard(card, L.cards)).catch((e) => console.warn('share', e));
    },
    'lk-pack-pp': (el, ev, app) => {
      const ctx = packCtx;
      fx.closePack();
      packCtx = null;
      const L = ctx && lockerOf(app, ctx.personId);
      ensureUi(app).tab = 'passport';
      app.ui.pp.pg = L?.cards ? pageOf(L.cards.filter((c) => c.opened), ctx.page, { frontHtml }) : 1;
      if (app.route.name === 'locker' && app.route.mode === 'mine') app.render();
      else app.go('#/locker');
    },
    'lk-pack-next': (el, ev, app) => {
      const L = lockerOf(app, ownerId());
      const next = packsOf(L?.cards)[0];
      if (next) openPack(app, next);
      else { fx.closePack(); app.render(); }
    },
  },
};
