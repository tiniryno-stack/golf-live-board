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
import { esc, icon, reducedMotion } from '../ui.js';
import {
  buildLocker, packsOf, openedOf, FINISHES, isAdmin, shortDay, longDay, toParLabel, finName, adminTotals,
} from '../locker.js';

const STALE = 2 * 60 * 1000;
const today = () => new Date().toLocaleDateString('en-CA');
const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

let A = null; // the app, for the noscroll getter (read before render)

// ───────────────────────────────────────────── data

/** Fill app.lockers[personId] (and app.locker for this phone's owner) and redraw. Never throws. */
export async function loadLocker(app, personId, { force = false } = {}) {
  if (!personId) return null;
  app.lockers ||= {};
  const L = (app.lockers[personId] ||= { personId, cards: null, loading: false, error: null, at: 0, local: new Set() });
  const mine = personId === db.owner.get()?.personId;
  if (mine) app.locker = L;
  if (L.loading) return L;
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
  card.opened = true;
  card.openedAt = new Date().toISOString();
  L.local.add(card.code);
  db.api.openCard(card.code, L.personId)
    .then((res) => { if (!res?.ok) console.warn('open_card', res?.error); })
    .catch(() => db.lockerPending.add(card.code, L.personId));
}

const ownerId = () => db.owner.get()?.personId || null;
/** The locker this screen shows: yours, or (admin) the person in the route. */
const shownId = (app) => (app.route.mode === 'view' ? app.route.person : ownerId());
const lockerOf = (app, id) => (id ? app.lockers?.[id] : null) || null;

// ───────────────────────────────────────────── the card (§5): every size in cqw

const STRIP = { e: 'e', u: 'u', p: 'p', b: 'b', d: 'd' };
const kind = (s, p) => { const d = s - p; return d <= -2 ? 'e' : d === -1 ? 'u' : d === 0 ? 'p' : d === 1 ? 'b' : 'd'; };

export function frontHtml(c) {
  const strip = c.strokes.map((s, h) => `${h === 9 ? '<i class="lk-turn"></i>' : ''}<i class="lk-g-${STRIP[kind(s, c.par[h])]}"></i>`).join('');
  const fin = c.fin === 'standard' ? '' : finName(c);
  return `<div class="lk-mat"><i class="lk-holo"></i><i class="lk-facet"></i><i class="lk-sheen"></i><div class="lk-fc">
    <div class="lk-ftop"><span class="lk-brand">${MARK}Golf Live Board</span><span class="lk-ffin">${esc(fin)}</span></div>
    <div class="lk-fmid"><div class="lk-fcourse">${esc(c.course)}</div><div class="lk-fgross">${c.gross}</div><div class="lk-fsub">${toParLabel(c.toPar)} · ${esc(longDay(c.day))}</div></div>
    <div class="lk-strip" aria-hidden="true">${strip}</div>
    <div class="lk-fstamps">${c.stamps.slice(0, 2).map((s) => `<span class="lk-st">${esc(s)}</span>`).join('')}</div>
    <div class="lk-fbot"><span class="lk-fname">${esc(c.name)}</span><span>${c.crew ? 'With the crew' : 'Solo'}</span><span>No. ${c.n}</span></div>
  </div></div>`;
}

function nine(c, from) {
  const par = c.par.slice(from, from + 9), sc = c.strokes.slice(from, from + 9);
  const tot = (a) => a.reduce((x, y) => x + y, 0);
  return `<div class="lk-nine"><span class="lk-nl">Hole</span>${par.map((_, i) => `<span class="lk-nh">${from + i + 1}</span>`).join('')}<span class="lk-nh">${from ? 'In' : 'Out'}</span>
    <span class="lk-nl">Par</span>${par.map((p) => `<span class="lk-np">${p}</span>`).join('')}<span class="lk-np">${tot(par)}</span>
    <span class="lk-nl">${esc(c.name ? c.name.slice(0, 6) : 'You')}</span>${sc.map((s, i) => `<span class="lk-mk lk-mk-${kind(s, par[i])}">${s}</span>`).join('')}<span class="lk-nt">${tot(sc)}</span></div>`;
}

export function backHtml(c) {
  const k = c.stats.count;
  const tile = (v, label) => `<div class="lk-tile"><b>${v}</b><span>${label}</span></div>`;
  const why = c.fin === 'rookie' ? `${c.line}. The app is still learning your game.` : c.line;
  const types = c.stats.byType.map((t) => `<span><i>Par ${t.par}s</i>${toParLabel(t.toPar)}</span>`).join('');
  return `<div class="lk-mat"><div class="lk-bk">
    <div class="lk-bh"><div class="lk-bh-l"><div class="lk-bh-c">${esc(c.course)}</div><div class="lk-bh-d">${esc(longDay(c.day))} · ${c.crew ? 'with the crew' : 'solo'}</div></div>
      <div class="lk-bh-t">${c.gross}<span>${toParLabel(c.toPar)}</span></div></div>
    ${nine(c, 0)}${nine(c, 9)}
    ${why ? `<div class="lk-bw">${c.grade ? `<span class="lk-bg">${c.grade}</span>` : ''}<span>${esc(why)}</span></div>` : ''}
    <div class="lk-tiles">${tile(k.eagles + k.birdies, 'Birdies+')}${tile(k.pars, 'Pars')}${tile(k.bogeys, 'Bogeys')}${tile(k.doubles, 'Doubles+')}</div>
    <div class="lk-types">${types}${c.stats.bestRun >= 2 ? `<span><i>Best run</i>${c.stats.bestRun}</span>` : ''}</div>
    <div class="lk-bs">${c.stamps.map((s) => `<span class="lk-st">${esc(s)}</span>`).join('')}</div>
  </div></div>`;
}

const label = (c) => `${c.course}, ${shortDay(c.day)}, ${c.gross}. ${FINISHES[c.fin].name} card.`;

/** One card in its slot: tilt → flip → front / back. `extra` = more classes on the slot. */
export function slotHtml(c, { i = 0, flipped = false, extra = '', act = 'lk-card' } = {}) {
  return `<div class="lk-slot lkf-${c.fin}${extra}" data-i="${i}" data-key="${esc(c.key)}"${act ? ` data-act="${act}"` : ''}>
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
  packCtx = { personId: card.personId, key: card.key, replay };
  fx.showPack({
    fin: card.fin, reduced: reducedMotion(), replay, left,
    cardHtml: slotHtml(card, { act: null }),
    kicker: `${replay ? 'Rip again' : 'Final'} · ${shortDay(card.day)}`,
    packLine: `${card.course} · ${shortDay(card.day)}`,
    hint: `${card.course} · ${shortDay(card.day)} · you shot ${card.gross}`,
    title: capFin(card), grade: card.grade, line: capLine(card), stamps: card.stamps,
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
function put(el, rx, ry, sc) {
  const k = `${rx.toFixed(2)}|${ry.toFixed(2)}|${sc.toFixed(3)}`;
  if (el._k === k) return;
  el._k = k;
  const st = el.style;
  st.setProperty('--rx', rx.toFixed(2));
  st.setProperty('--ry', ry.toFixed(2));
  st.setProperty('--sc', sc.toFixed(3));
  st.setProperty('--sx', clamp(ry / 22, -1.3, 1.3).toFixed(3));
  st.setProperty('--sy', clamp(rx / 12, -1, 1).toFixed(3));
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
  const idle = !rm && !ptr.on && !gy.on ? Math.sin(ts / 1700) * 6 : 0;
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
    const inner = `<span class="lk-ptile lk-foil" aria-hidden="true">${MARK}<b>Scorecard</b></span>
      <span class="lk-plabel"><span class="ts-body">${esc(c.course)}</span><span class="ts-small lk-soft">${esc(shortDay(c.day))}</span></span>`;
    return readOnly
      ? `<div class="lk-pcell" aria-label="${esc(`${c.course}, ${shortDay(c.day)}, sealed`)}">${inner}</div>`
      : `<button class="lk-pcell" data-act="lk-open" data-v="${esc(c.key)}" aria-label="${esc(`Open the ${c.course} pack from ${shortDay(c.day)}`)}">${inner}</button>`;
  }).join('')}</div>`;
}

function oneView(app, opened) {
  const lk = app.ui.lk;
  const land = lk.land && Date.now() - lk.landAt < 900 ? lk.land : null;
  const slots = opened.map((c, i) => slotHtml(c, { i, flipped: lk.flip === c.key, extra: land === c.key ? ' land' : '' })).join('');
  const tilt = hasTilt() && !gy.on && typeof window.DeviceOrientationEvent?.requestPermission === 'function';
  return `<div class="lk-one">
    <div class="lk-stage"><div class="lk-track">${slots}</div></div>
    <div class="lk-cap" aria-live="polite"></div>
    <div class="lk-foot"><span class="ts-label lk-pos"></span>
      <span class="lk-mid"><button class="pill lk-tiltbtn" data-act="lk-tilt"${tilt ? '' : ' hidden'}>Turn on tilt</button><span class="ts-small lk-soft lk-hint"${tilt ? ' hidden' : ''}>${gy.on ? 'Tilt your phone · tap to flip' : 'Tap the card to flip it'}</span></span>
      <button class="btn small" data-act="lk-rip">${icon('redo', 18)} Rip again</button></div>
  </div>`;
}

function allView(opened) {
  return `<div class="lk-all">${opened.map((c, i) => `<button class="lk-mini lkf-${c.fin}" data-act="lk-pick" data-v="${esc(c.key)}" style="--sx:${((((i * 37) % 9) / 9) - 0.5).toFixed(2)}" aria-label="${esc(label(c))}"><span class="lk-face lk-front">${frontHtml(c)}</span></button>`).join('')}</div>`;
}

function lockerBody(app) {
  const id = shownId(app);
  const readOnly = app.route.mode === 'view';
  if (!id) {
    return `<div class="plain lk"><h1 class="ts-title">Locker</h1>
      <p class="ts-body lk-soft lk-gap">Open a round and pick your name once. Your scorecards show up here after that.</p></div>`;
  }
  const L = lockerOf(app, id);
  if (!L?.cards) {
    const err = L?.error && !L.loading;
    return `<div class="plain lk"><h1 class="ts-title">Locker</h1>
      ${err ? `<p class="ts-body lk-soft lk-gap">No signal. Your scorecards are safe, they just need a connection.</p><button class="btn block" data-act="lk-retry">Try again</button>`
        : '<p class="meta lk-gap">Opening your locker…</p>'}</div>`;
  }
  const cards = L.cards;
  const opened = openedOf(cards), packs = packsOf(cards);
  const lk = app.ui.lk;
  if (!opened.length && packs.length) lk.view = 'packs';
  if (lk.view === 'packs' && !packs.length) lk.view = 'one';
  if (!cards.length) {
    return `<div class="plain lk"><h1 class="ts-title">Locker</h1>
      <p class="ts-body lk-soft lk-gap">${readOnly ? 'No finished rounds yet.' : 'Finish 18 holes and your scorecard arrives here as a pack.'}</p></div>`;
  }
  const who = readOnly ? (app.lockerAdmin?.people?.find((p) => p.person_id === id)?.name || cards[0]?.name || '') : '';
  const sub = opened.length ? `${plural(opened.length, 'scorecard')} since ${shortDay(opened[opened.length - 1].day)}` : plural(packs.length, 'pack') + ' to open';
  const segBtn = (v, ic, lbl) => `<button data-act="lk-view" data-v="${v}" aria-pressed="${lk.view === v}" aria-label="${lbl}">${icon(ic, 22)}</button>`;
  const view = lk.view === 'packs' ? packsView(app, L, readOnly) : lk.view === 'all' ? allView(opened) : oneView(app, opened);
  return `<div class="plain lk lk-v-${lk.view}">
    ${who ? `<div class="ts-label lk-k">${esc(who)} · view only</div>` : ''}
    <div class="lk-head"><h1 class="ts-title">Locker</h1>
      ${opened.length ? `<div class="seg lk-seg" role="group" aria-label="View">${segBtn('one', 'cardone', 'One card at a time')}${segBtn('all', 'grid', 'All cards')}</div>` : ''}</div>
    <div class="lk-subrow"><span class="ts-small lk-soft">${esc(sub)}</span>
      ${packs.length && opened.length ? `<button class="pill lk-ppill" data-act="lk-view" data-v="${lk.view === 'packs' ? 'one' : 'packs'}" aria-pressed="${lk.view === 'packs'}">${icon('pack', 18)} Packs · ${packs.length}</button>` : ''}</div>
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

/** { packs, row } HTML for Home; both '' unless this phone's owner has a card or pack. Never throws. */
export function homeLocker(app) {
  try {
    const o = db.owner.get();
    const L = o ? app.lockers?.[o.personId] : null;
    if (!L?.cards?.length) return { packs: '', row: '' };
    const packs = packsOf(L.cards), opened = openedOf(L.cards);
    const newest = packs[packs.length - 1];
    const card = packs.length ? `<button class="lk-ready" data-act="lk-home-packs">
        <span class="lk-rpack lk-foil" aria-hidden="true"><b class="lk-pip">${packs.length}</b></span>
        <span class="lk-rtext"><span class="ts-label lk-soft">${plural(packs.length, 'pack')} ready</span><span class="ts-row">Open your scorecard${packs.length === 1 ? '' : 's'}</span>
          <span class="ts-small lk-soft ellipsis">${esc(newest.course)} · ${esc(shortDay(newest.day))}</span></span>
        <span class="hr-chev">${icon('fwd', 20)}</span></button>` : '';
    const fan = opened.length
      ? opened.slice(0, 3).reverse().map((c) => `<i class="lkf-${c.fin}"></i>`).join('')
      : '<i class="lk-foil lk-fan-pack"></i>';
    const row = `<button class="home-row" data-act="go" data-v="#/locker">
        <span class="lk-fan" aria-hidden="true">${fan}</span>
        <span class="hr-main"><span class="hr-name">Locker</span><span class="hr-sub">${opened.length ? plural(opened.length, 'scorecard') : `${plural(packs.length, 'pack')} to open`}</span></span>
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
      <button class="btn block" data-act="sheet-close" style="margin-top:12px">Done</button>`;
  },
};

// ───────────────────────────────────────────── the screen

function ensureUi(app) {
  app.ui.lk ||= { view: 'one', key: null, flip: null, land: null, landAt: 0, person: null };
  return app.ui.lk;
}

export default {
  get noscroll() {
    if (!A || A.route?.name !== 'locker' || A.route.mode === 'admin') return false;
    const L = lockerOf(A, shownId(A));
    return !!L?.cards && A.ui.lk?.view === 'one' && openedOf(L.cards).length > 0;
  },
  enter(app) {
    A = app;
    const lk = ensureUi(app);
    const id = shownId(app);
    if (lk.person !== id) { lk.person = id; lk.key = null; lk.flip = null; if (app.route.mode === 'view') lk.view = 'one'; }
    if (app.route.mode === 'admin') loadAdmin(app);
    else if (id) loadLocker(app, id);
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;
  },
  topBack(app) {
    if (app.route.mode === 'admin') return `<button class="back" data-act="go" data-v="#/locker">${icon('back', 22)}<span>Locker</span></button>`;
    if (app.route.mode === 'view') return `<button class="back" data-act="go" data-v="#/locker/admin">${icon('back', 22)}<span>Everyone</span></button>`;
    return '';
  },
  topRight(app) {
    if (app.route.mode === 'admin') return '';
    const adm = app.route.mode !== 'view' && isAdmin(ownerId())
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
    if (app.route.mode !== 'admin' && app.ui.lk?.view === 'one') mountCarousel(content, app);
  },
  actions: {
    'lk-view': (el, ev, app) => {
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
    'lk-pick': (el, ev, app) => {
      Object.assign(app.ui.lk, { view: 'one', key: el.dataset.v, flip: null });
      app.render();
    },
    'lk-open': (el, ev, app) => {
      if (app.route.mode === 'view') return; // someone else's packs stay sealed
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
      Object.assign(ensureUi(app), { view: 'one', key: ctx.key, flip: null, land: ctx.replay ? null : ctx.key, landAt: Date.now() });
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
