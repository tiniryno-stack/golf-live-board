// pack.js — 035 Scorecard locker: the pack overlay (SPEC §6). Markup + the player; toasts.showPack puts it in
// #overlay (like Today's game), so the render loop never redraws it, and closeOverlay → stop() ends its timers.
//
//   1 sealed (breathes) → 2 hold 1.3 s (shake grows, tear line) → 3 tear 0.45 s (onTear: open_card is sent)
//   → 4 the wait (card half out, white-hot; light pulses from the opening, each quicker; the last one is the
//   finish's color) → 5 reveal (celebration by finish) → 6 result (Add to locker / Open next pack).
// Reduced motion (html.rm): a tap opens it, and everything is a 150 ms fade. No sound, no haptics.

import { esc, icon } from '../ui.js';

/** Per finish: the wait (ms), pulses in it, stillness after them, how long the reveal plays, rings, sparks. */
const PLAN = {
  standard: { wait: 1400, pulses: 2, still: 0, reveal: 900, rings: 1, sparks: 0 },
  bronze: { wait: 1400, pulses: 2, still: 0, reveal: 900, rings: 1, sparks: 0 },
  rookie: { wait: 1400, pulses: 2, still: 0, reveal: 900, rings: 1, sparks: 0 },
  silver: { wait: 1600, pulses: 2, still: 0, reveal: 1200, rings: 1, sparks: 0 },
  gold: { wait: 2000, pulses: 3, still: 0, reveal: 2000, rings: 2, sparks: 16 },
  prismatic: { wait: 2600, pulses: 4, still: 300, reveal: 3000, rings: 3, sparks: 28 },
};
const HOLD_MS = 1300, SETTLE_MS = 350, TEAR_MS = 450;

const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>';

/**
 * The overlay's markup. o = { fin, cardHtml (a .lk-slot), kicker, packLine, hint, title, grade, line, stamps[],
 * left (packs still sealed after this one), replay }.
 */
export function packHtml(o) {
  const p = PLAN[o.fin] || PLAN.standard;
  const sparks = Array.from({ length: p.sparks }, (_, i) => {
    const half = p.sparks > 16 ? 14 : p.sparks;
    const k = i % half;
    return `<i style="--a:${Math.round((k * 360) / half + (i >= half ? 180 / half : 0))}deg${i >= half ? ';--sd:350ms' : ''}"></i>`;
  }).join('');
  const rings = Array.from({ length: p.rings }, (_, i) => `<i class="pk-ring" style="--rd:${i * 180}ms"></i>`).join('');
  const title = o.fin === 'prismatic' && o.title
    ? [...o.title].map((ch, i) => `<span style="--ld:${i * 70}ms">${esc(ch)}</span>`).join('')
    : esc(o.title);
  const stamps = (o.stamps || []).map((s, i) => `<span class="lk-chip" style="--cd:${300 + i * 220}ms">${esc(s)}</span>`).join('');
  const add = o.replay ? 'Back to locker' : 'Add to locker';
  return `<div class="pk lkf-${esc(o.fin)}" data-fin="${esc(o.fin)}" role="dialog" aria-modal="true" aria-label="Open your pack">
    <i class="pk-screen" aria-hidden="true"></i>
    <div class="pk-top">
      <button class="icon-btn pk-x" data-act="lk-pack-close" aria-label="Close">${icon('close')}</button>
      <span class="ts-label pk-k">${esc(o.kicker)}</span>
    </div>
    <div class="pk-stage">
      <i class="pk-rays" aria-hidden="true"></i>
      <div class="pk-fx" aria-hidden="true"><i class="pk-flash"></i>${rings}<span class="pk-spark">${sparks}</span></div>
      <div class="pk-pulses" aria-hidden="true"></div>
      <div class="pk-card" data-act="lk-pack-flip">${o.cardHtml}</div>
      <div class="pk-pack" role="button" tabindex="0" aria-label="Press and hold to open your pack">
        <div class="pk-breathe"><div class="pk-shake">
          <div class="pk-ptop lk-foil"></div>
          <div class="pk-body lk-foil">${MARK}<span class="pk-l1">Scorecard</span><span class="pk-l2">${esc(o.packLine)}</span><span class="pk-l2">1 card</span></div>
          <i class="pk-tear"></i>
        </div></div>
      </div>
    </div>
    <div class="pk-foot${o.left ? ' two' : ''}">
      <div class="pk-hint"><div class="ts-row">${o.replay ? 'Press and hold to rip it again' : 'Press and hold to open'}</div><div class="ts-small pk-soft">${esc(o.hint)}</div></div>
      <div class="pk-res">
        <div class="pk-fin ts-title"><span class="pk-name">${title}</span>${o.grade ? `<span class="lk-gr">${esc(o.grade)}</span>` : ''}</div>
        ${o.line ? `<div class="ts-body pk-soft">${esc(o.line)}</div>` : ''}
        ${stamps ? `<div class="pk-stamps">${stamps}</div>` : ''}
        <button class="btn primary big block" data-act="lk-pack-add">${add}</button>
        ${o.left ? `<button class="btn big block" data-act="lk-pack-next">Open next pack · ${o.left} left</button>` : ''}
      </div>
    </div>
  </div>`;
}

/** Pulse start times (ms into the wait): each gap shorter than the last; the last pulse ends at `span`. */
export function pulseTimes(n, span) {
  const r = 0.62, gaps = Array.from({ length: n }, (_, k) => r ** k);
  const total = gaps.reduce((a, b) => a + b, 0);
  let t = 80;
  return gaps.map((g) => { const at = t; t += ((span - 160) * g) / total; return { at: Math.round(at), dur: Math.round(Math.max(260, ((span - 160) * g) / total * 1.25)) }; });
}

/**
 * Start the pack inside `root` (the .pk element). opts = { fin, reduced, onTear }. Returns { stop }.
 * Everything it schedules is cleared by stop(), which toasts.closeOverlay calls on any route change.
 */
export function startPack(root, { fin = 'standard', reduced = false, onTear = () => {} } = {}) {
  const plan = PLAN[fin] || PLAN.standard;
  const pack = root.querySelector('.pk-pack');
  const shake = root.querySelector('.pk-shake');
  const pulses = root.querySelector('.pk-pulses');
  const timers = [];
  let stopped = false, stage = 'idle', raf = 0, last = 0, holdOn = false, p = 0, tremble = 0;
  const later = (ms, fn) => timers.push(setTimeout(() => { if (!stopped) fn(); }, ms));
  const set = (k, v) => shake.style.setProperty(k, v);

  const frame = (ts) => {
    raf = 0;
    if (stopped) return;
    const dt = Math.min(50, ts - (last || ts));
    last = ts;
    if (stage === 'idle') {
      p = Math.max(0, Math.min(1, p + (holdOn ? dt / HOLD_MS : -dt / SETTLE_MS)));
      pack.style.setProperty('--p', p.toFixed(3));
    }
    const amp = stage === 'idle' ? p * p * 4 : tremble;
    const rnd = () => Math.random() * 2 - 1;
    set('--jx', `${(rnd() * amp).toFixed(1)}px`);
    set('--jy', `${(rnd() * amp).toFixed(1)}px`);
    set('--jr', `${(rnd() * (stage === 'idle' ? p * 1.2 : amp * 0.3)).toFixed(2)}deg`);
    if (stage === 'idle' && p >= 1) { tear(); return; }
    if ((stage === 'idle' && (holdOn || p > 0)) || (stage === 'wait' && tremble > 0)) raf = requestAnimationFrame(frame);
    else ['--jx', '--jy', '--jr'].forEach((k) => shake.style.removeProperty(k));
  };
  const loop = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

  function tear() {
    if (stage !== 'idle') return;
    holdOn = false;
    if (reduced) {
      stage = 'done';
      root.classList.add('torn', 'rv', 'done');
      onTear();
      return;
    }
    stage = 'tear';
    root.classList.add('torn');
    onTear();
    later(TEAR_MS, wait);
  }
  function wait() {
    stage = 'wait';
    root.classList.add('waiting');
    tremble = 1.6;
    loop();
    const span = plan.wait - plan.still;
    pulseTimes(plan.pulses, span).forEach(({ at, dur }, k) => later(at, () => {
      const el = document.createElement('i');
      el.className = `pk-pulse${k === plan.pulses - 1 ? ' last' : ''}`;
      el.style.setProperty('--pd', `${dur}ms`);
      pulses.appendChild(el);
      tremble = 1.6 + k * 0.9;
    }));
    if (plan.still) later(span, () => { tremble = 0; root.classList.add('dark'); });
    later(plan.wait, reveal);
  }
  function reveal() {
    stage = 'reveal';
    tremble = 0;
    root.classList.remove('dark');
    root.classList.add('rv');
    later(plan.reveal, () => { stage = 'done'; root.classList.add('done'); });
  }

  const down = (e) => {
    if (stage !== 'idle') return;
    e.preventDefault();
    if (reduced) { tear(); return; }
    try { pack.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    holdOn = true;
    loop();
  };
  const up = () => { holdOn = false; };
  const key = (e) => { if ((e.key === 'Enter' || e.key === ' ') && stage === 'idle') { e.preventDefault(); tear(); } };
  const menu = (e) => e.preventDefault();
  pack.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pack.addEventListener(ev, up));
  pack.addEventListener('keydown', key);
  pack.addEventListener('contextmenu', menu);

  return {
    get stage() { return stage; },
    stop() {
      stopped = true;
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
