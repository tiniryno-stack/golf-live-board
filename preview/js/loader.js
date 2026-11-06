// loader.js — the one loading screen (feature 020). It replaces the old splash flag, the in-page
// "Opening…" spinner and the No signal page. The markup and its styles live in index.html, so the
// screen is drawn from the first paint and the ball already circles (CSS) before any JS has run.
//
// Launch: mark + name, the ball circles the ring's lip (one lap per second). Opening a round adds
// "Opening CODE…" after 1.5 s and "Still connecting…" after 8 s; app.loadError (the 12 s timeout or a
// failed fetch) = No signal: the ball stops, Try again (data-act="retry-load") restarts it.
// When the app is ready: the ball finishes its lap, drops into the ring, then the screen fades out.
// Reduced motion: the ball holds at the top-right and "ready" just fades.

export const LAP_MS = 1000;
export const DROP_MS = 460;
export const GAP_MS = 60;
export const FADE_MS = 280;
export const OPENING_AT = 1500;
export const SLOW_AT = 8000;

/** How long until the ball is back at the top-right, `elapsed` ms after the orbit started (spec: 1000 − elapsed mod 1000). */
export function lapWait(elapsed) {
  return LAP_MS - (Math.max(0, elapsed) % LAP_MS);
}

/** What the text area shows `ms` after the screen appeared: 'boot' | 'opening' | 'slow' | 'nosignal'. */
export function loaderState(ms, { loading = false, error = false } = {}) {
  if (error) return 'nosignal';
  if (!loading) return 'boot';
  if (ms >= SLOW_AT) return 'slow';
  if (ms >= OPENING_AT) return 'opening';
  return 'boot';
}

const SAVED = 'Scores you enter are saved on this phone and sync when you’re back.';
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function loaderText(state, code) {
  if (state === 'opening') return `<p class="ld-sub">Opening ${escape(code || 'the round')}…</p>`;
  if (state === 'slow') return `<p class="ld-sub">Still connecting…</p><p class="ld-small">${SAVED}</p>`;
  if (state === 'nosignal') {
    return `<p class="ld-head">No signal</p><p class="ld-sub">Couldn’t reach the scoreboard. ${SAVED}</p>
      <button class="ld-btn" data-act="retry-load">Try again</button>`;
  }
  return '';
}

// ───────────────────────────────────────────── the screen (browser only)

let info = () => ({});
let t0 = 0; // performance.now() when the screen appeared (0 = first paint at launch)
let phase = 'up'; // up → landing → gone
let shown = null;
let timers = [];

const root = () => document.getElementById('loader');
const part = (sel) => root()?.querySelector(sel);
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const clear = () => { timers.forEach(clearTimeout); timers = []; };
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

/** Start: `get` returns { loading, error, code } from the app's state. */
export function initLoader(get) {
  info = get;
  if (!root()) phase = 'gone';
  schedule();
}

export const loaderUp = () => phase !== 'gone';

function schedule() {
  clear();
  if (phase !== 'up') return;
  const now = performance.now() - t0;
  for (const at of [OPENING_AT, SLOW_AT]) if (now < at) later(update, at - now + 5);
  update();
}

/** Redraw the text for the current state (call after app.loading / app.loadError change). */
export function updateLoader() { update(); }
function update() {
  const el = root();
  if (!el || phase !== 'up') return;
  const { loading, error, code } = info();
  const st = loaderState(performance.now() - t0, { loading, error });
  el.classList.toggle('stopped', st === 'nosignal'); // the ball stops on the lip where it is
  if (st === shown) return;
  shown = st;
  el.querySelector('.ld-text').innerHTML = loaderText(st, code);
}

/** A round starts opening: put the screen up (again). Try again from No signal restarts at state 1. */
export function showLoader() {
  const el = root();
  if (!el) return;
  if (phase === 'up') {
    if (shown === 'nosignal') { t0 = performance.now(); shown = null; el.classList.remove('stopped'); }
    schedule();
    return;
  }
  clear();
  phase = 'up';
  shown = null;
  t0 = performance.now();
  el.hidden = false;
  el.classList.remove('gone', 'stopped');
  const ball = part('.ld-ball');
  part('.ld-ring')?.classList.remove('dip');
  ball?.classList.remove('drop', 'orbit');
  void ball?.getBoundingClientRect(); // restart the orbit from the top-right
  ball?.classList.add('orbit');
  el.querySelector('.ld-text').innerHTML = '';
  schedule();
}

/** The first real screen is ready: finish the lap, drop in, fade out. */
export function loaderReady() {
  const el = root();
  if (!el || phase !== 'up') return;
  clear();
  phase = 'landing';
  el.classList.remove('stopped');
  const ball = part('.ld-ball');
  if (reduced() || !ball) { fade(); return; }
  let done = false;
  const drop = () => {
    if (done || phase !== 'landing') return;
    done = true;
    ball.removeEventListener('animationiteration', drop);
    ball.classList.replace('orbit', 'drop');
    part('.ld-ring')?.classList.add('dip');
    later(fade, DROP_MS + GAP_MS);
  };
  // The lap ends exactly on animationiteration; the timer covers a page that isn't painting.
  ball.addEventListener('animationiteration', drop);
  const anim = ball.getAnimations?.().find((a) => a.animationName === 'ld-orbit');
  const elapsed = typeof anim?.currentTime === 'number' ? anim.currentTime : performance.now() - t0;
  later(drop, lapWait(elapsed));
}

function fade() {
  const el = root();
  if (!el) return;
  el.classList.add('gone');
  later(() => { phase = 'gone'; el.hidden = true; }, FADE_MS);
}

/** Something broke: get out of the way now (the crash screen must be visible). */
export function hideLoaderNow() {
  const el = root();
  clear();
  phase = 'gone';
  if (el) { el.classList.add('gone'); el.hidden = true; }
}
