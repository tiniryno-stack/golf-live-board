// toasts.js — 3-second toasts, sticky banners (headlines + "let them in"),
// full-screen cards (Switch it up, Lock in / Close it out), the "While you were
// away" card, and coach marks.

import { esc, icon } from '../ui.js';
import { local } from '../db.js';

const $ = (id) => document.getElementById(id);

// ───────────────────────────────────────────── toasts (one at a time, newest replaces)

let current = null;
let toastTimer = null;

export function toast(opts, app) {
  const root = $('toasts');
  clearTimeout(toastTimer);
  current = { ...opts, app };
  const act = opts.action ? `<button class="t-act" data-act="toast-act">${esc(opts.action)}</button>` : '';
  root.innerHTML = `<div class="toast${opts.error ? ' error' : ''}" data-act="toast-tap" role="status">
    <div class="t-body"><div class="t-title ellipsis">${esc(opts.title)}</div>${opts.sub ? `<div class="t-sub">${esc(opts.sub)}</div>` : ''}</div>${act}</div>`;
  const el = root.firstElementChild;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  toastTimer = setTimeout(hideToast, opts.ms ?? 3000);
}

export function hideToast() {
  clearTimeout(toastTimer);
  const el = $('toasts').firstElementChild;
  current = null;
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => {
    if (!current && el.parentNode) el.remove();
  }, 300);
}

// ───────────────────────────────────────────── banners

let headline = null; // { h, extra, markSeen }

export function showHeadline(h, extra, app, markSeen) {
  headline = { h, extra, markSeen };
  renderBanners(app);
}

export function clearBanners() {
  headline = null;
  const root = $('banners');
  if (root) root.innerHTML = '';
}

export function renderBanners(app) {
  const root = $('banners');
  if (!root) return;
  if (!app.event || !app.route.round) {
    root.innerHTML = '';
    return;
  }
  const asks = app.relevantRequests();
  let html = asks
    .map((r) => {
      const p = app.snapshot?.playerById.get(r.player_id);
      const name = p?.name || 'someone';
      const q = r.player_id === app.me ? `Another phone wants to be you (${esc(name)})` : `Someone wants to join as ${esc(name)}`;
      return `<div class="banner ask" role="alert"><div class="q">${q}</div>
        <button class="btn small" data-act="join-deny" data-v="${esc(r.id)}">Not them</button>
        <button class="btn small primary" data-act="join-approve" data-v="${esc(r.id)}">Let them in</button></div>`;
    })
    .join('');
  if (headline) {
    const more = headline.extra > 0 ? `<span class="more">+${headline.extra}</span>` : '';
    html += `<button class="banner headline-b" data-act="headline-dismiss" data-swipe="headline">
      <span class="spark">${icon('spark', 18)}</span><span style="flex:1">${esc(headline.h.text)}</span>${more}</button>`;
  }
  root.innerHTML = html;
}

function dismissHeadline(app) {
  if (!headline) return;
  headline.markSeen?.();
  headline = null;
  renderBanners(app);
}

// swipe a headline banner away
let sw = null;
document.addEventListener('touchstart', (e) => {
  const b = e.target.closest?.('[data-swipe="headline"]');
  if (b) sw = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!sw) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
  sw = null;
  if ((Math.abs(dx) > 50 || dy < -30) && headline) dismissHeadline(window.__glb);
}, { passive: true });

// ───────────────────────────────────────────── overlays

let overlay = null; // { onContinue, onDismiss }

export function showCard(opts, app) {
  const root = $('overlay');
  overlay = { onContinue: opts.onContinue, app };
  root.innerHTML = `<div class="fullcard${opts.sunny ? ' sunny' : ''}" role="dialog" aria-modal="true">
    ${opts.kicker ? `<div class="kicker">${esc(opts.kicker)}</div>` : ''}
    <div class="fc-title">${esc(opts.big)}</div>
    ${opts.result ? `<div class="result">${esc(opts.result)}</div>` : ''}
    ${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ''}
    ${opts.sub2 ? `<div class="sub">${esc(opts.sub2)}</div>` : ''}
    <button class="btn primary big block" data-act="card-continue">${esc(opts.button || 'Continue')}</button>
  </div>`;
  root.classList.add('open');
}

export function showAway(list, app, markSeen) {
  const root = $('overlay');
  if (!list.length) return;
  overlay = { onDismiss: markSeen, app, away: true };
  root.innerHTML = `<div class="away" data-act="away-dismiss" role="dialog">
    <div class="kicker">While you were away</div>
    <ol>${list.map((h) => `<li>${esc(h.text)}</li>`).join('')}</ol>
    <div class="actions"><button data-act="away-all">See all</button><button data-act="away-dismiss">Got it</button></div>
  </div>`;
  root.classList.add('open');
  root.onclick = (e) => {
    if (e.target === root) closeAway();
  };
}

function closeAway() {
  const o = overlay;
  closeOverlay();
  o?.onDismiss?.();
}

export function closeOverlay() {
  const root = $('overlay');
  if (!root) return;
  if (overlay?.away) overlay.onDismiss?.();
  overlay = null;
  root.classList.remove('open');
  root.innerHTML = '';
  root.onclick = null;
}

// ───────────────────────────────────────────── coach marks (once per phone)

export function coach(key, target, text) {
  const k = `glb.coach.${key}`;
  if (local.get(k)) return;
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  local.set(k, true);
  const r = el.getBoundingClientRect();
  const scrim = document.createElement('div');
  scrim.className = 'coach-scrim';
  const bubble = document.createElement('div');
  bubble.className = 'coach';
  bubble.textContent = text;
  const below = r.bottom + 90 < window.innerHeight;
  bubble.style.left = `${Math.max(12, Math.min(window.innerWidth - 252, r.left))}px`;
  bubble.style.top = below ? `${r.bottom + 8}px` : `${Math.max(12, r.top - 70)}px`;
  const done = () => {
    scrim.remove();
    bubble.remove();
  };
  scrim.addEventListener('click', done);
  bubble.addEventListener('click', done);
  document.body.append(scrim, bubble);
}

// ───────────────────────────────────────────── actions

export const actions = {
  'toast-tap': (el, ev, app) => {
    const c = current;
    hideToast();
    if (c?.tab && app.code) app.go(app.tabHash(c.tab));
  },
  'toast-act': (el, ev, app) => {
    const c = current;
    hideToast();
    c?.onAction?.();
  },
  'headline-dismiss': (el, ev, app) => dismissHeadline(app),
  'join-approve': (el, ev, app) => app.answerJoin(el.dataset.v, true),
  'join-deny': (el, ev, app) => app.answerJoin(el.dataset.v, false),
  'card-continue': () => {
    const fn = overlay?.onContinue;
    closeOverlay();
    fn?.();
  },
  'away-dismiss': () => closeAway(),
  'away-all': (el, ev, app) => {
    closeAway();
    if (app.code) app.go(app.tabHash('board'));
  },
};
