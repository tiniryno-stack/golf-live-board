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

/** "9½", "½", "0". */
const half = (n) => { const w = Math.floor(n + 1e-9), h = n - w > 1e-9; return (w || !h ? String(w) : '') + (h ? '½' : ''); };

/** A number counting up (ease-out) — its final value straight away with reduced motion. */
function countUp(n, to, delay, dur, k, whole = false) {
  if (k.RM) { n.textContent = half(to); return; }
  k.later(delay, () => {
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / (dur * PACE)), v = to * (1 - (1 - p) ** 3);
      n.textContent = whole || Number.isInteger(to) ? String(Math.round(v)) : (p < 1 ? String(Math.floor(v)) : half(to));
      if (p < 1 && n.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** fn(p) for p 0 → 1 over dur (paced); straight to 1 with reduced motion. */
export function tween(el, dur, k, fn, done) {
  if (k.RM) { fn(1); done?.(); return; }
  const t0 = performance.now();
  const f = (t) => {
    if (!el.isConnected) return;
    const p = Math.min(1, (t - t0) / (dur * PACE));
    fn(p);
    if (p < 1) requestAnimationFrame(f); else done?.();
  };
  requestAnimationFrame(f);
}

const initial = (n) => esc(String(n || '?').trim()[0] || '?');
const tr = (n, x, y) => { n.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; };
/** Absolutely placed parts of a scene, added to `box`. */
const adder = (box) => (cls, html, css) => {
  const d = document.createElement('div');
  d.className = cls;
  if (html) d.innerHTML = html;
  Object.assign(d.style, css || {});
  box.appendChild(d);
  return d;
};
const px = (n) => `${Math.round(n)}px`;

// ───────────────────────────────────────────── scenes: (args, k) → { html, play?(el, k) }
// The hole is added in step 4. Until a scene exists, a quiet placeholder.

export const SCENES = {
  // Slide 1: everyone pops in as one centered row, then sorts into their places (FLIP-style).
  // kind: pairs (2 cards + vs) · carts3 (3 rows) · alone (2×2 tiles) · list (rows with a value) · ryder (dots → two sides)
  meet: ({ kind, groups = [], sub, perSide = 8 }) => ({
    html: '<div class="tg-sc"><div class="tg-mt"></div></div>',
    play(el, k) {
      const box = el.querySelector('.tg-mt'), W = box.clientWidth, add = adder(box);
      const cards = [], extras = [];
      if (kind === 'ryder') {
        const n = perSide * 2, cols = 4, rows = Math.ceil(perSide / cols), D = 22, G = 10, S = D + G;
        const g0 = cols * D + (cols - 1) * G, x0 = (W - g0) / 2, cw = (W - 10) / 2, ch = 46 + rows * S + 30;
        const mix = Array.from({ length: n }, (_, i) => i).sort((a, b) => ((a * 7 + 5) % n) - ((b * 7 + 5) % n));
        const dots = mix.map((_, i) => add(`tg-md${i < perSide ? ' y' : ''}${i === 0 ? ' me' : ''}`));
        dots.forEach((d, i) => {
          const at = mix[i], side = i < perSide ? 0 : 1, j = i % perSide;
          d._a = [x0 + (at % cols) * S, 40 + Math.floor(at / cols) * S];
          d._b = [side * (cw + 10) + (cw - g0) / 2 + (j % cols) * S, 92 + Math.floor(j / cols) * S];
          tr(d, ...d._a);
        });
        cards.push(add('tg-mcard you', '<span class="ts-label">Your side</span>', { left: '0px', top: '40px', width: px(cw), height: px(ch) }));
        cards.push(add('tg-mcard', '<span class="ts-label">Them</span>', { left: px(cw + 10), top: '40px', width: px(cw), height: px(ch) }));
        if (sub) extras.push(add('tg-msub', esc(sub), { top: px(40 + ch + 16) }));
        dots.forEach((d, i) => k.later(150 + i * 45, () => d.classList.add('in')));
        k.later(1300, () => cards.forEach((c) => c.classList.add('on')));
        dots.forEach((d, i) => k.later(1200 + (i % perSide) * 40, () => tr(d, ...d._b)));
        k.later(1900, () => extras.forEach((e) => e.classList.add('on')));
        return;
      }
      const all = groups.flatMap((g, gi) => g.names.map((c, ni) => ({ ...c, gi, ni })));
      all.forEach((c) => { c.el = add(`tg-mc${c.you ? ' y' : ''}`, `<i>${initial(c.name)}</i><span>${esc(c.name)}</span>`); });
      const maxW = kind === 'alone' ? (W - 12) / 2 - 16 : (W - 36) / 2;
      all.forEach((c) => { c.el.style.maxWidth = px(maxW); c.w = c.el.offsetWidth; });
      // the row they arrive in (two rows past four names)
      const rows = all.length > 4 ? 2 : 1, per = Math.ceil(all.length / rows), CG = 8;
      for (let r = 0; r < rows; r++) {
        const inRow = all.slice(r * per, (r + 1) * per), rw = inRow.reduce((a, c) => a + c.w, 0) + (inRow.length - 1) * CG;
        let x = Math.max(0, (W - rw) / 2);
        for (const c of inRow) { c.a = [x, rows === 1 ? 104 : 82 + r * 44]; x += c.w + CG; tr(c.el, ...c.a); }
      }
      const card = (x, y, w, h, g, cls = '') => cards.push(add(`tg-mcard${cls}${g.you ? ' you' : ''}`,
        `${g.label ? `<span class="ts-label">${esc(g.label)}</span>` : ''}${g.val ? `<span class="val">${esc(g.val)}</span>` : ''}`,
        { left: px(x), top: px(y), width: px(w), height: px(h) }));
      const slots = (gi, x0, y) => { let x = x0; all.filter((c) => c.gi === gi).forEach((c) => { c.b = [x, y]; x += c.w + CG; }); };
      if (kind === 'pairs') {
        const H = 84, Y = [8, 8 + H + 40];
        groups.forEach((g, gi) => { card(0, Y[gi], W, H, g); slots(gi, 14, Y[gi] + 38); });
        extras.push(add('tg-mvs ts-label', 'vs', { top: px(Y[0] + H + 12) }));
      }
      if (kind === 'carts3') {
        const H = 60;
        groups.forEach((g, gi) => { const y = 4 + gi * (H + 10); card(0, y, W, H, g, ' rl'); slots(gi, 12, y + 12); });
      }
      if (kind === 'alone') {
        const w = (W - 12) / 2, H = 76;
        groups.forEach((g, gi) => {
          const x = (gi % 2) * (w + 12), y = 24 + Math.floor(gi / 2) * (H + 12);
          card(x, y, w, H, g);
          const c = all.find((cc) => cc.gi === gi);
          c.b = [x + (w - c.w) / 2, y + (H - 36) / 2];
        });
      }
      if (kind === 'list') {
        const H = 46;
        groups.forEach((g, gi) => { const y = 12 + gi * (H + 8); card(0, y, W, H, g); slots(gi, 6, y + 5); });
      }
      if (sub) extras.push(add('tg-msub', esc(sub), { top: px(kind === 'pairs' ? 230 : kind === 'list' ? 232 : 220) }));
      all.forEach((c, i) => k.later(150 + i * 120, () => { c.el.classList.add('in'); bumpEl(c.el.firstChild); }));
      const t1 = 300 + all.length * 120 + 500;
      k.later(t1, () => cards.forEach((c, i) => k.later(i * 90, () => c.classList.add('on'))));
      all.forEach((c) => k.later(t1 + 60 + c.gi * 90 + c.ni * 50, () => tr(c.el, ...c.b)));
      k.later(t1 + 700, () => extras.forEach((e) => e.classList.add('on')));
    },
  }),

  // The halfway bar: yours fills to the line in the middle, holds, then pushes past it.
  tug: ({ total, us, them, lbl, win, usLbl = 'You' }) => ({
    html: `<div class="tg-sc tg-g14">
      <div class="tg-e tg-ends" style="--d:0ms">
        <div><span class="ts-label tg-youtxt">${esc(usLbl)}</span><div class="ts-number-xl tg-youtxt" data-u>0</div></div>
        <div class="r"><span class="ts-label">Them</span><div class="tg-ttl-mono tg-muted" data-t>0</div></div></div>
      ${tugBar(lbl)}
      <div class="tg-chipline tg-e" style="--d:160ms"><span class="tg-flag" data-c>${esc(`${total} points out there`)}</span></div></div>`,
    play(el, k) {
      const y = el.querySelector('.tg-tug .y'), t = el.querySelector('.tg-tug .t'), nu = el.querySelector('[data-u]'), nt = el.querySelector('[data-t]');
      const set = (a, b) => { y.style.width = `${(a / total) * 100}%`; t.style.width = `${(b / total) * 100}%`; };
      const count = (n, from, to, dur) => {
        if (k.RM) { n.textContent = half(to); return; }
        const t0 = performance.now();
        const f = (tt) => { const p = Math.min(1, (tt - t0) / (dur * PACE)), v = from + (to - from) * (1 - (1 - p) ** 3); n.textContent = p < 1 ? String(Math.floor(v)) : half(to); if (p < 1 && n.isConnected) requestAnimationFrame(f); };
        requestAnimationFrame(f);
      };
      if (k.RM) { set(us, them); nu.textContent = half(us); nt.textContent = half(them); return clinch(el, win, k); }
      k.later(300, () => { set(total / 2, them); count(nu, 0, total / 2, 1100); count(nt, 0, them, 1100); });
      k.later(2000, () => { el.querySelector('.tg-tug').classList.add('slow'); set(us, them); count(nu, total / 2, us, 500); });
      k.later(2600, () => clinch(el, win, k));
    },
  }),

  // Partners switch: you stay put; your partner slides down and the next one slides up beside you.
  swap: ({ me = 'You', sets = [] }) => ({
    html: '<div class="tg-sc"><div class="tg-mt tg-mt-swap"></div></div>',
    play(el, k) {
      const box = el.querySelector('.tg-mt'), W = box.clientWidth, add = adder(box), H = 84, Y = [0, H + 34], CG = 8;
      const top = add('tg-mcard you on', `<span class="ts-label" data-sl>${esc(sets[0]?.label || '')}</span>`, { left: '0px', top: px(Y[0]), width: px(W), height: px(H) });
      add('tg-mcard on', '<span class="ts-label">Them</span>', { left: '0px', top: px(Y[1]), width: px(W), height: px(H) });
      add('tg-mvs ts-label on', 'vs', { top: px(Y[0] + H + 9) });
      const chip = (n, you) => { const c = add(`tg-mc in${you ? ' y' : ''}`, `<i>${initial(n)}</i><span>${esc(n)}</span>`); c.style.maxWidth = px((W - 36) / 2); return c; };
      const meC = chip(me, true), names = [...new Set(sets.flatMap((s) => [s.partner, ...s.them]))], c = Object.fromEntries(names.map((n) => [n, chip(n)]));
      const wOf = (n) => n.offsetWidth;
      const xMe = 14, xP = 14 + wOf(meC) + CG;
      const place = (s) => {
        tr(c[s.partner], xP, Y[0] + 38);
        let x = 14;
        s.them.forEach((n) => { tr(c[n], x, Y[1] + 38); x += wOf(c[n]) + CG; });
      };
      tr(meC, xMe, Y[0] + 38);
      if (sets[0]) place(sets[0]);
      const len = 18 / Math.max(1, sets.length);
      const strip = add('tg-strip', Array.from({ length: 18 }, () => '<i></i>').join(''), { position: 'absolute', left: '0px', right: '0px', top: px(Y[1] + H + 26) });
      const lbls = add('tg-strip-lbls ts-label', sets.map((s) => `<span>${esc(s.range)}</span>`).join(''), { position: 'absolute', left: '0px', right: '0px', top: px(Y[1] + H + 54), gridTemplateColumns: `repeat(${sets.length}, 1fr)` });
      const cells = [...strip.children], L = [...lbls.children], sl = top.querySelector('[data-sl]');
      const step = (i) => {
        cells.forEach((x, j) => { x.className = Math.floor(j / len) === i ? 'on' : Math.floor(j / len) < i ? 'past' : ''; });
        L.forEach((x, j) => x.classList.toggle('on', j === i));
        if (i) { place(sets[i]); bumpEl(top); sl.textContent = sets[i].label; }
      };
      if (k.RM) return step(Math.max(0, sets.length - 1));
      k.later(200, () => step(0));
      sets.slice(1).forEach((_, i) => k.later(1700 + i * 1600, () => step(i + 1)));
    },
  }),

  // Most sets won: the tiles land one by one, then the count.
  sets: ({ res = [], won = 0 }) => ({
    html: `<div class="tg-sc">
      <div class="tg-grid" style="grid-template-columns:repeat(${res.length},1fr)">${res.map((x, i) => `<div class="tg-tile mid${x.r === 'W' ? ' you' : ''} tg-e" style="--d:${i * 380}ms">
        <span class="ts-label">Set ${i + 1}</span><span class="ts-row${x.r === 'W' ? ' tg-youtxt' : ''}">${x.r === 'W' ? 'Won' : x.r === 'H' ? 'Halved' : 'Lost'}</span><span class="ts-small tg-muted">with ${esc(x.with)}</span></div>`).join('')}</div>
      <div class="tg-e tg-won" style="--d:1400ms"><span class="ts-number-xl tg-youtxt">${won}</span><span class="ts-row">${won === 1 ? 'set won' : 'sets won'}</span></div></div>`,
  }),

  // A new cart every 6: the opponent lights in its away color, one per set.
  carts: ({ mine, others = [], ranges = [] }) => ({
    html: `<div class="tg-sc">
      <div class="ts-label tg-center" data-r>${esc(ranges[0] || '')}</div>
      <div class="tg-grid">
        <div class="tg-tile you tg-e" style="--d:0ms"><span class="ts-label tg-youtxt">Your cart</span><span class="ts-row">${esc(mine)}</span></div>
        ${others.map((o, i) => `<div class="tg-tile cart dim tg-e" data-c="${esc(o.color)}" style="--d:${120 + i * 90}ms"><span class="ts-label">Cart</span><span class="ts-row">${esc(o.name)}</span></div>`).join('')}
      </div>
      <div class="ts-small tg-muted tg-center tg-e" style="--d:500ms" data-vs>&nbsp;</div></div>`,
    play(el, k) {
      const cs = [...el.querySelectorAll('[data-c]')], r = el.querySelector('[data-r]'), vs = el.querySelector('[data-vs]');
      const step = (i) => {
        cs.forEach((c, j) => { c.classList.toggle(c.dataset.c, j === i); c.classList.toggle('dim', j !== i); });
        r.textContent = ranges[i] || '';
        vs.textContent = `vs ${others[i].name}${others[i].away ? ' · other tee time' : ''}`;
      };
      if (k.RM) return step(others.length - 1);
      others.forEach((_, i) => k.later(600 + i * 1000, () => step(i)));
    },
  }),

  // Most points: bars grow while the numbers count up.
  bars: ({ rows = [], max = 16, note }) => ({
    html: `<div class="tg-sc">${hbars(rows, max)}${note ? `<div class="ts-small tg-muted tg-center tg-e" style="--d:600ms">${esc(note)}</div>` : ''}</div>`,
    play(el, k) { growBars(el, k, 250); },
  }),

  // The race: the lock line slides from 2nd's score to 2nd + holes left; then it's locked.
  race: ({ rows = [], left = 2 }) => {
    const max = 10, second = rows[1]?.v ?? 0, best = second + left;
    return {
      html: `<div class="tg-sc tg-g14">
        <div class="ts-label tg-e tg-ends" style="--d:0ms"><span>After ${18 - left}</span><span>${left} holes left</span></div>
        ${hbars(rows, max, 70, 200, (i) => (i === 1 ? `<span class="tg-lock" style="left:${(second / max) * 100}%"></span>` : ''))}
        ${rows[1] ? `<div class="ts-small tg-muted tg-center tg-e" style="--d:1300ms">Best ${esc(rows[1].name)} can do: ${second} + ${left} = ${best}</div>` : ''}
        <div class="tg-chipline tg-e" style="--d:1300ms"><span class="tg-flag" data-lk>Still open</span></div></div>`,
      play(el, k) {
        growBars(el, k, 200, 70, 1100, true);
        const lock = () => { const l = el.querySelector('.tg-lock'); if (l) l.style.left = `${(best / max) * 100}%`; };
        const locked = () => { const c = el.querySelector('[data-lk]'); c.textContent = `Locked · ${rows[0]?.v} beats ${best}`; c.classList.add('lit'); };
        if (k.RM) { lock(); return locked(); }
        k.later(1500, lock);
        k.later(2600, locked);
      },
    };
  },

  // Stroke play: the Board's rows slide to their new places as the numbers change.
  board: ({ steps = [[]] }) => ({
    html: `<div class="tg-sc"><div class="ts-label tg-e" style="--d:0ms">The Board · live</div>
      <div class="tg-lb tg-e" style="--d:60ms;height:${steps[0].length * 52}px">${steps[0].map((r) => `<div class="tg-lbr${r.you ? ' you' : ''}" data-n="${esc(r.name)}"><span class="pos"></span><span class="nm">${esc(r.name)}</span><span class="v">${esc(r.v)}</span></div>`).join('')}</div></div>`,
    play(el, k) {
      const rowsEl = [...el.querySelectorAll('.tg-lbr')];
      const place = (st) => st.forEach((r, i) => {
        const n = rowsEl.find((x) => x.dataset.n === r.name);
        if (!n) return;
        n.style.transform = `translateY(${i * 52}px)`;
        n.querySelector('.v').textContent = r.v;
        n.querySelector('.pos').textContent = i + 1;
      });
      place(steps[0]);
      if (k.RM) return place(steps[steps.length - 1]);
      steps.slice(1).forEach((st, i) => k.later(1100 + i * 1100, () => place(st)));
    },
  }),

  // Team Ryder Cup: your cart stays; their cart swaps each 6 holes.
  ryderRot: ({ mine, opps = [], ranges = [] }) => ({
    html: `<div class="tg-sc">
      <div class="ts-label tg-center" data-r>${esc(ranges[0] || 'Holes 1–6')}</div>
      <div class="tg-tile you tg-e" style="--d:0ms"><span class="ts-label tg-youtxt">Your cart</span><span class="ts-row">${esc(mine)}</span></div>
      <div class="tg-vs ts-label tg-e" style="--d:150ms">vs</div>
      <div class="tg-swapbox tg-e" style="--d:250ms" data-o>${theirCart(opps[0])}</div></div>`,
    play(el, k) {
      const r = el.querySelector('[data-r]'), o = el.querySelector('[data-o]');
      const step = (i) => { r.textContent = ranges[i] || ''; swapIn(o, theirCart(opps[i]), k); };
      if (k.RM) return step(opps.length - 1);
      opps.slice(1).forEach((_, i) => k.later((i + 1) * 1100, () => step(i + 1)));
    },
  }),

  // 6½ wins the cup: match dots fill W / L / ½ and the bar clinches past halfway.
  matches: ({ seq = [], lbl, win, total = seq.length }) => ({
    html: `<div class="tg-sc tg-g14">
      <div class="tg-dots tg-e" style="--d:0ms">${seq.map(() => '<i></i>').join('')}</div>
      <div class="tg-e tg-ends" style="--d:80ms">
        <div><span class="ts-label tg-youtxt">Your side</span><div class="tg-ttl-mono tg-youtxt" data-u>0</div></div>
        <div class="r"><span class="ts-label">Them</span><div class="tg-ttl-mono tg-muted" data-t>0</div></div></div>
      ${tugBar(lbl)}
      <div class="tg-chipline tg-e" style="--d:160ms"><span class="tg-flag" data-c>${total} matches · 1 point each</span></div></div>`,
    play(el, k) {
      const ds = [...el.querySelectorAll('.tg-dots i')];
      let us = 0, th = 0, won = false;
      const step = (r, i) => {
        ds[i].className = r;
        if (r === 'w') us += 1; else if (r === 'l') th += 1; else { us += 0.5; th += 0.5; }
        el.querySelector('[data-u]').textContent = half(us);
        el.querySelector('[data-t]').textContent = half(th);
        el.querySelector('.tg-tug .y').style.width = `${(us / total) * 100}%`;
        el.querySelector('.tg-tug .t').style.width = `${(th / total) * 100}%`;
        if (us > total / 2 && !won) { won = true; clinch(el, win, k); }
      };
      if (k.RM) return seq.forEach(step);
      seq.forEach((r, i) => k.later(300 + i * 140, () => step(r, i)));
    },
  }),
};

function tugBar(lbl) {
  return `<div class="tg-tug tg-e" style="--d:80ms"><span class="y"></span><span class="t"></span><span class="tick"></span></div>
    <div class="tg-tickl ts-label tg-e" style="--d:120ms"><span data-tl>${esc(lbl)}</span></div>`;
}
function clinch(el, win, k) {
  el.querySelector('.tg-tug').classList.add('past');
  el.querySelector('[data-tl]').classList.add('lit');
  const c = el.querySelector('[data-c]');
  c.textContent = win;
  c.classList.add('lit');
  if (!k.RM) bumpEl(c);
}
function hbars(rows, max, step = 80, d0 = 250, extra = () => '') {
  return `<div class="tg-hbars">${rows.map((r, i) => `<div class="tg-hb${r.you ? ' you' : ''} tg-e" style="--d:${i * step}ms"><span class="nm">${esc(r.name)}</span><span class="trk"><span class="fill" data-w="${(r.v / max) * 100}" style="--d:${d0 + i * step}ms"></span>${extra(i)}</span><span class="v" data-count="${r.v}">0</span></div>`).join('')}</div>`;
}
function growBars(el, k, d0, step = 80, dur = 1200, whole = false) {
  const fill = () => el.querySelectorAll('.fill').forEach((f) => { f.style.width = `${f.dataset.w}%`; });
  if (k.RM) fill(); else k.later(40, fill);
  el.querySelectorAll('[data-count]').forEach((n, i) => countUp(n, Number(n.dataset.count), d0 + i * step, dur, k, whole));
}
const theirCart = (name) => `<div class="tg-tile"><span class="ts-label">Their cart</span><span class="ts-row">${esc(name || '')}</span></div>`;

function drawScene(slide, k) {
  const fn = SCENES[slide.scene];
  if (fn) return fn(slide.args || {}, k);
  return { html: `<div class="tg-sc"><div class="tg-ph ts-label">${esc(slide.scene)}</div></div>` };
}

// ───────────────────────────────────────────── the player

/** HTML for the full-screen card. */
export function playerHtml(tg) {
  return `<div class="fullcard tg" role="dialog" aria-modal="true" aria-label="Today’s game">
    <div class="tg-top">
      <div class="tg-row"><span class="ts-label">${esc(tg.kicker)}</span><button type="button" class="tg-replay" data-act="tg-replay">Replay</button></div>
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
    const html = `<div><p class="tg-h ts-title">${esc(s.h)}</p><p class="tg-s ts-body">${esc(s.s)}</p></div>`;
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

// ───────────────────────────────────────────── the hole (SPEC §2.3): a small 3D tile, one shape per game

const SHOT = 560, FLY = 420; // a shot every 0.56 s, 0.42 s in the air (before the pace)
const SHAPES = {
  dogleg: { T: [64, 118], P1: [134, 139], P2: [205, 119], C: [284, 58] },
  bend: { T: [68, 126], P1: [126, 36], P2: [222, 26], C: [288, 98] },
  short: { T: [84, 128], P1: [142, 112], P2: [212, 82], C: [276, 64] },
  long: { T: [60, 128], P1: [180, 160], P2: [166, 8], C: [290, 62] },
};
const cub = (sh, f) => [0, 1].map((a) => (1 - f) ** 3 * sh.T[a] + 3 * (1 - f) ** 2 * f * sh.P1[a] + 3 * (1 - f) * f * f * sh.P2[a] + f ** 3 * sh.C[a]);

// Fit every hole onto the tile: measure the rough (31 each side, +3 for its raised edge) and the green, then
// squeeze / slide the hole so all of it sits inside the tile with a margin.
(function fitShapes() {
  const box = { x: [22, 331], y: [20, 148] };
  for (const sh of Object.values(SHAPES)) {
    const pts = Array.from({ length: 61 }, (_, i) => cub(sh, i / 60)), C = sh.C;
    const lo = [Math.min(...pts.map((p) => p[0] - 31), C[0] - 34), Math.min(...pts.map((p) => p[1] - 31), C[1] - 34)];
    const hi = [Math.max(...pts.map((p) => p[0] + 31), C[0] + 34), Math.max(...pts.map((p) => p[1] + 34), C[1] + 37)];
    const map = [0, 1].map((a) => {
      const [b0, b1] = a ? box.y : box.x, kk = Math.min(1, (b1 - b0) / (hi[a] - lo[a])), n0 = Math.max(b0, Math.min(lo[a], b1 - (hi[a] - lo[a]) * kk));
      return (v) => n0 + (v - lo[a]) * kk;
    });
    for (const key of ['T', 'P1', 'P2', 'C']) sh[key] = [map[0](sh[key][0]), map[1](sh[key][1])];
  }
})();

function courseSvg(sh) {
  const R = `M${sh.T} C ${sh.P1} ${sh.P2} ${sh.C}`, samp = Array.from({ length: 41 }, (_, i) => cub(sh, i / 40));
  const dist = (x, y) => Math.min(...samp.map(([a, b]) => Math.hypot(a - x, b - y)));
  const nrm = (f) => { const a = cub(sh, f - 0.02), b = cub(sh, f + 0.02), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
  const at = (f, side, off) => { const p = cub(sh, f), n = nrm(f); return [p[0] + n[0] * off * side, p[1] + n[1] * off * side]; };
  const b1 = at(0.5, 1, 20), b2 = at(0.86, -1, 22);
  let trees = '';
  for (let i = 0; i < 66; i++) {
    const x = 24 + (i % 11) * 30 + (Math.floor(i / 11) % 2) * 15, y = 26 + Math.floor(i / 11) * 24, r = 8 + ((i * 7) % 5);
    // the whole tree stays on the tile (canopy, raised side, shadow) and clear of the hole
    if (x - r < 20 || x + r + 6 > 333 || y - r < 20 || y + r + 8 > 150 || (i * 5) % 3 === 0) continue;
    if (dist(x, y) < 32 + r || Math.hypot(x - sh.C[0], y - sh.C[1]) < 36 + r || Math.hypot(x - b1[0], y - b1[1]) < 18 + r || Math.hypot(x - b2[0], y - b2[1]) < 18 + r) continue;
    const bl = [[-0.38 * r, 0.12 * r, 0.66 * r], [0.36 * r, 0.16 * r, 0.62 * r], [0, -0.32 * r, 0.68 * r]]; // three circles: one reads as a golf ball
    trees += `<g class="tree" transform="translate(${x} ${y})"><ellipse cx="5" cy="${(r * 0.6).toFixed(1)}" rx="${(r * 1.1).toFixed(1)}" ry="${(r * 0.5).toFixed(1)}" class="tsh"/><g class="tsd">${bl.map(([a, b, c]) => `<circle cx="${a.toFixed(1)}" cy="${(b + 3).toFixed(1)}" r="${c.toFixed(1)}"/>`).join('')}</g><g class="tcn">${bl.map(([a, b, c]) => `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${c.toFixed(1)}"/>`).join('')}</g></g>`;
  }
  const [cx, cy] = sh.C, [tx, ty] = sh.T;
  return `<defs><filter id="tg-gl" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect class="slab-side" x="6" y="18" width="341" height="150" rx="30"/><rect class="slab" x="6" y="8" width="341" height="150" rx="30"/>
    <path d="${R}" class="rough-edge" stroke-width="62" transform="translate(0 3)"/>
    <path d="${R}" class="rough" stroke-width="58"/>
    <path d="${R}" class="fair" stroke-width="36"/>
    <path d="${R}" class="mow" stroke-width="36" stroke-dasharray="9 9"/>
    <ellipse class="bk" cx="${b1[0].toFixed(1)}" cy="${b1[1].toFixed(1)}" rx="14" ry="7"/><ellipse class="bk" cx="${b2[0].toFixed(1)}" cy="${b2[1].toFixed(1)}" rx="12" ry="7"/>
    <circle class="edge" cx="${cx}" cy="${cy + 3}" r="30"/><circle class="green" cx="${cx}" cy="${cy}" r="30"/>
    <rect class="edge" x="${tx - 14}" y="${ty - 7}" width="28" height="20" rx="6"/><rect class="green" x="${tx - 14}" y="${ty - 10}" width="28" height="20" rx="6"/>
    <circle class="cup" cx="${cx}" cy="${cy}" r="4.5"/><ellipse class="cup" cx="${cx + 8}" cy="${cy + 2}" rx="9" ry="2.5" opacity=".6"/>
    <path class="pole" d="M${cx} ${cy} V${cy - 34}"/><path class="flag" d="M${cx} ${cy - 34} l15 5 l-15 5z"/>
    ${trees}<g class="trl"></g><g class="bls"></g>`;
}

SCENES.hole = ({ shape = 'dogleg', par = 4, label, players = [], mode = 'best', score = 'bestBall', win }) => ({
  html: `<div class="tg-sc tg-hsc">
    <div class="ts-label tg-muted tg-e tg-hlbl" style="--d:0ms">${esc(label || `Hole 4 · Par ${par}`)}</div>
    <div class="tg-e tg-crsw" style="--d:60ms"><svg class="tg-crs" viewBox="0 0 353 172" aria-hidden="true">${courseSvg(SHAPES[shape] || SHAPES.dogleg)}</svg></div>
    <div class="tg-lgs tg-e" style="--d:120ms;grid-template-columns:repeat(${players.length},1fr)">${players.map((p, i) => `<div class="tg-lg ${p.side}" data-p="${i}"><span class="nm">${esc(p.name)}</span><span class="cn">0</span></div>`).join('')}</div>
    <div class="tg-ptline"></div></div>`,
  play(el, k) {
    const NS = 'http://www.w3.org/2000/svg', trl = el.querySelector('.trl'), bls = el.querySelector('.bls'), pl = el.querySelector('.tg-ptline'), sh = SHAPES[shape] || SHAPES.dogleg;
    const lgs = el.querySelector('.tg-lgs');
    // Low ball + total: the two point slots are on screen from the start of the hole.
    if (mode === 'best' && score === 'bbAgg') { pl.classList.add('two'); pl.innerHTML = '<span class="tg-flag" data-pc="1">Point 1 · Low ball</span><span class="tg-flag" data-pc="2">Point 2 · Low total</span>'; }
    const P = players.map((pp, pi) => {
      const s = pp.s, wild = s >= par + 2 ? 2 : 1, pts = [[sh.T[0] + (pi - 1.5) * 6, sh.T[1] - 2 + (pi % 2 ? 4 : -4)]];
      for (let i = 1; i <= s; i++) {
        const f = 1 - (1 - i / s) ** 2, [x, y] = cub(sh, f), j = ((((pi * 37 + i * 53) % 21) - 10) * (1.1 - f) * 1.3 * wild);
        pts.push(i === s ? sh.C : [x + j * 0.6, y + j * 0.8]);
      }
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', `ball${pp.side === 'y' ? ' y' : ''}`);
      g.innerHTML = `<circle r="9"/><text y="4" text-anchor="middle">${initial(pp.name)}</text>`;
      g.setAttribute('transform', `translate(${pts[0][0]} ${pts[0][1]})`);
      bls.appendChild(g);
      const tile = el.querySelector(`[data-p="${pi}"]`);
      return { s, side: pp.side, pts, g, tile, cnt: tile.querySelector('.cn') };
    });
    const max = Math.max(...P.map((p) => p.s));
    const pill = (cls, text) => `<span class="tg-pt ${cls}">${esc(text)}</span>`;
    const finish = () => {
      const best = (side) => Math.min(...P.filter((p) => p.side === side).map((p) => p.s));
      const light = (side, v) => P.find((p) => p.side === side && p.s === v)?.tile.classList.add('best');
      if (mode === 'best' && score !== 'bestBall') {
        // Low ball + total (two points a hole) and Aggregate (both scores added, one point)
        const sum = (side) => P.filter((p) => p.side === side).reduce((a, p) => a + p.s, 0), tu = sum('y'), tt = sum('t'), bu = best('y'), bt = best('t');
        const r = (a, b) => (a < b ? 1 : a > b ? 0 : 0.5);
        const totals = () => {
          P.forEach((p) => p.tile.classList.remove('best'));
          const w = r(tu, tt);
          P.forEach((p) => { if (w === 0.5 || (w === 1 && p.side === 'y') || (w === 0 && p.side === 't')) p.tile.classList.add('best', 'tot'); });
        };
        if (score === 'aggregate') {
          totals();
          const w = r(tu, tt);
          pl.innerHTML = pill(w === 1 ? 'y' : 't', `${w === 1 ? win || '+1 point' : w === 0.5 ? '½ point each' : '+1 to them'} · ${tu} v ${tt}`);
          return;
        }
        // the two slots fill in one at a time
        const a1 = r(bu, bt), a2 = r(tu, tt), word = (n) => (n === 1 ? '+1 you' : n === 0.5 ? '½ each' : 'theirs');
        const fill = (i, txt, n) => { const c = el.querySelector(`[data-pc="${i}"]`); c.textContent = txt; c.classList.toggle('lit', n > 0); if (!k.RM) bumpEl(c); };
        light('y', bu); light('t', bt);
        k.later(250, () => fill(1, `Low ball ${bu} v ${bt} · ${word(a1)}`, a1));
        k.later(1500, () => { totals(); fill(2, `Total ${tu} v ${tt} · ${word(a2)}`, a2); });
        return;
      }
      let html;
      if (mode === 'best') {
        const bu = best('y'), bt = best('t');
        light('y', bu); light('t', bt);
        html = bu < bt ? pill('y', win || '+1 point') : bu === bt ? pill('t', '½ point each') : pill('t', '+1 to them');
      } else if (mode === 'three') {
        const bu = best('y'), ba = best('a'), bb = best('b');
        light('y', bu); light('a', ba); light('b', bb);
        const pts = (bu < ba ? 1 : bu === ba ? 0.5 : 0) + (bu < bb ? 1 : bu === bb ? 0.5 : 0);
        html = pill('y', win || `+${half(pts)} points`);
      } else if (mode === 'low') {
        const low = Math.min(...P.map((p) => p.s));
        P.filter((p) => p.s === low).forEach((p) => p.tile.classList.add('best'));
        html = pill('y', win || '+1 point');
      } else {
        P[0].tile.classList.add('best');
        html = pill('y', win || `${P[0].s} on your card`);
      }
      pl.innerHTML = html;
    };
    if (k.RM) { P.forEach((p) => { p.cnt.textContent = p.s; p.g.style.opacity = 0; }); finish(); lgs.classList.add('judged'); return; }
    // Shots fly in 3D: the ball rises on an arc while its shadow runs along the ground; a dotted tracer follows it.
    P.forEach((p, pi) => {
      const sd = document.createElementNS(NS, 'ellipse');
      sd.setAttribute('class', 'bsh'); sd.setAttribute('rx', 7); sd.setAttribute('ry', 3);
      trl.appendChild(sd);
      const place = (x, y, lift, s) => {
        p.g.setAttribute('transform', `translate(${x.toFixed(1)} ${(y - lift).toFixed(1)}) scale(${s.toFixed(3)})`);
        sd.setAttribute('cx', x.toFixed(1)); sd.setAttribute('cy', (y + 5).toFixed(1)); sd.setAttribute('rx', (7 - lift * 0.08).toFixed(1));
        sd.style.opacity = (0.55 - lift * 0.008).toFixed(2);
      };
      place(p.pts[0][0], p.pts[0][1], 0, 1);
      for (let r = 0; r < p.s; r++) {
        k.later(500 + r * SHOT + pi * 140, () => {
          const a = p.pts[r], b = p.pts[r + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]), last = r === p.s - 1;
          const H = d > 30 ? Math.max(0, Math.min(46, d * 0.42, Math.min(a[1], b[1]) - 22)) : 0; // putts roll
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('class', `trc${p.side === 'y' ? ' y' : ''}`);
          trl.appendChild(path);
          const at = (u) => { const g = H ? u : 1 - (1 - u) ** 2; return [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g, 4 * H * u * (1 - u)]; };
          tween(el, FLY, k, (t) => {
            const [x, y, lift] = at(t);
            place(x, y, lift, (1 + (lift / 46) * 0.55) * (last && t > 0.8 ? 1 - (t - 0.8) * 2.5 : 1));
            let dd = `M${a[0]} ${a[1]}`;
            for (let q = 1; q <= 14; q++) { const [qx, qy, ql] = at((t * q) / 14); dd += ` L${qx.toFixed(1)} ${(qy - ql).toFixed(1)}`; }
            path.setAttribute('d', dd);
          }, () => {
            p.cnt.textContent = r + 1;
            bumpEl(p.cnt);
            if (last) { p.g.style.opacity = 0; sd.style.opacity = 0; }
          });
        });
      }
    });
    k.later(500 + max * SHOT + 400, () => { finish(); lgs.classList.add('judged'); });
  },
});
