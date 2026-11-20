// screens/todaysgame.js — feature 032 "Today's game": the full-screen player and its scenes.
//
// The content comes from the pure model (js/todaysgame.js). This file draws it: a top bar (kicker, Replay, one
// progress segment per slide), one scene per slide in a fixed-height stage, one headline + one sentence (027's blur
// swap), and Let's play pinned to the bottom. Slides play on their own; tapping the scene skips ahead; after the
// last one Replay turns `text` and Let's play bumps once. Reduced motion: every scene shows its end state, the
// headline swap is a plain fade, slides still advance at the same lengths.
//
// The player lives in the overlay root as a full-screen card (toasts.js `showBrief`), so 024's rule holds: no
// coach tip over it. Timers are owned here and cleared on every slide change and on close.

import { esc, reducedMotion } from '../ui.js';
import { PACE } from '../todaysgame.js';

// ───────────────────────────────────────────── timing helpers (one set of timers per player)

function clock() {
  let timers = [];
  const RM = !!reducedMotion();
  const c = {
    RM,
    /** Real time: how long a slide stays (paced). */
    wait: (ms, f) => { timers.push(setTimeout(f, ms * PACE)); },
    /** Inside a scene: instant with reduced motion. */
    later: (ms, f) => c.wait(RM ? Math.min(ms, 1) : ms, f),
    clear: () => { timers.forEach(clearTimeout); timers = []; },
  };
  return c;
}

/** 022's bump, replayed. */
export const bumpEl = (n) => { if (!n) return; n.classList.remove('tg-bmp'); void n.offsetWidth; n.classList.add('tg-bmp'); };

/** 027's blur swap: the old child blurs out, the new one blurs in (a plain swap with reduced motion). */
export function swapIn(box, html, k) {
  const old = box.firstElementChild;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const el = tmp.firstElementChild;
  if (old && !k.RM) { old.classList.add('tg-out'); setTimeout(() => old.remove(), 120 * PACE); } else if (old) old.remove();
  if (!k.RM) el.classList.add('tg-in');
  box.appendChild(el);
}

// ───────────────────────────────────────────── scenes: (args, k) → { html, play?(el, k) }
// Filled in by steps 3 (everything but the hole) and 4 (the hole). Until a scene exists, a quiet placeholder.

export const SCENES = {};

function drawScene(slide, k) {
  const fn = SCENES[slide.scene];
  if (fn) return fn(slide.args || {}, k);
  return { html: `<div class="tg-sc"><div class="tg-ph lbl">${esc(slide.scene)}</div></div>` };
}

// ───────────────────────────────────────────── the player

/** HTML for the full-screen card. */
export function playerHtml(tg) {
  return `<div class="fullcard tg" role="dialog" aria-modal="true" aria-label="Today’s game">
    <div class="tg-top">
      <div class="tg-row"><span class="lbl">${esc(tg.kicker)}</span><button type="button" class="tg-replay" data-act="tg-replay">Replay</button></div>
      <div class="tg-segs" aria-hidden="true">${tg.slides.map(() => '<i><b></b></i>').join('')}</div>
    </div>
    <div class="tg-mid">
      <div class="tg-stage" data-act="tg-next" aria-hidden="true"></div>
      <div class="tg-copy" aria-live="polite"></div>
    </div>
    <div class="tg-foot"><button class="btn primary big block" data-act="brief-done">Let’s play</button></div>
  </div>`;
}

/**
 * Start the slides inside `root` (the .fullcard.tg element). Returns { next, replay, stop }.
 */
export function startPlayer(root, tg) {
  const k = clock();
  const stage = root.querySelector('.tg-stage');
  const copy = root.querySelector('.tg-copy');
  const segs = [...root.querySelectorAll('.tg-segs b')];
  const replayBtn = root.querySelector('.tg-replay');
  const play = root.querySelector('.tg-foot .btn');
  let cur = -1;

  const setCopy = (s, first) => {
    const html = `<div><p class="tg-h">${esc(s.h)}</p><p class="tg-s">${esc(s.s)}</p></div>`;
    if (first || !copy.firstElementChild) copy.innerHTML = html;
    else swapIn(copy, html, k);
  };
  const segTo = (i, dur) => // dur = real ms
     segs.forEach((b, j) => {
    b.style.transition = 'none';
    b.style.transform = j < i ? 'scaleX(1)' : 'scaleX(0)';
    if (j === i) { b.getBoundingClientRect(); b.style.transition = `transform ${dur}ms linear`; b.style.transform = 'scaleX(1)'; }
  });
  const show = (s) => {
    const sc = drawScene(s, k);
    stage.innerHTML = sc.html;
    const el = stage.firstElementChild;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.classList.add('go');
      sc.play?.(el, k);
    }));
  };
  const end = () => {
    replayBtn.classList.add('done');
    bumpEl(play);
  };
  const go = (i, first = false) => {
    if (i >= tg.slides.length) return end();
    k.clear();
    cur = i;
    const s = tg.slides[i];
    const old = stage.firstElementChild;
    setCopy(s, first);
    const run = () => {
      show(s);
      segTo(i, s.ms); // the model's lengths already include the pace
      k.wait(s.ms / PACE, () => go(i + 1));
    };
    if (first || k.RM || !old) run();
    else { old.classList.add('tg-out'); k.wait(120, run); }
  };
  const replay = () => {
    k.clear();
    replayBtn.classList.remove('done');
    stage.innerHTML = '';
    copy.innerHTML = '';
    go(0, true);
  };
  go(0, true);
  return {
    next: () => { if (cur < tg.slides.length - 1) go(cur + 1); },
    replay,
    stop: () => k.clear(),
  };
}
