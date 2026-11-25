// pack.js — 036 pack overlay (docs/design/features/036-card-designs/SPEC.md §3; replaces 035's portrait pack art).
// Markup + the player; toasts.showPack puts it in #overlay (like Today's game), so the render loop never redraws it,
// and closeOverlay → stop() ends its timers. Prototype: chrome-packs-2.html.
//
//   sealed ──swipe on the strip──▶ cutting (one strip, hinged at the far end) ──p > .94──▶ sep (onTear: open_card is
//   sent; the strip flies off, the pack drops) ──500 ms──▶ waiting (035's wait: the card rises white-hot, pulses
//   quicken; PLAN per finish) ──▶ reveal (the finish's rings / wash / pop) ──900 ms──▶ stamps land one every 420 ms
//   ──▶ done. Hold on the body 1.3 s = the fallback. Classes on the .pk root: tearing · sep · waiting · dark · reveal · done. Reduced motion (html.rm): a tap opens it and
// every step is a 150 ms fade. No sound, no haptics.

import { esc, icon } from '../ui.js';

/** Which chrome refractor pattern every pack uses (§3.1, §13 Q2). One of: fine bold brushed wave shimmer speckle atomic sapphire. */
export const PACK_PATTERN = 'fine';
const LAYERS = {
  fine: '<i class="pat p-fine"></i>', bold: '<i class="pat p-bold"></i>', brushed: '<i class="pat p-brushed"></i><i class="p-brushed2"></i>',
  wave: '<i class="pat p-wave"></i>', shimmer: '<i class="pat p-shimmer"></i>', speckle: '<i class="pat p-speckle"></i>',
  atomic: '<i class="pat p-atomic"></i>', sapphire: '<i class="pat p-pin"></i>',
};
/** Per finish (Andrew, Nov 24, reveal-options page): the wait (035's pulses, better cards wait longer; prismatic
 *  ends on a dark beat) and the reveal ladder: prismatic = two pearl rings + a pearl wash + a pop; gold = two gold
 *  rings + a gold haze + a pop; silver = one ring + a faint haze + a glint; bronze = one faint ring; standard and
 *  rookie just land. --mc / --mc2 = that finish's metal for the rings, haze and last pulse. */
const PLAN = {
  prismatic: { span: 2300, pulses: 4, dark: true, rings: 2, wash: 1, pop: true },
  gold: { span: 1900, pulses: 3, rings: 2, wash: 1, pop: true, mc: 'hsl(46 90% 72%)', mc2: 'hsl(36 85% 55%)' },
  silver: { span: 1500, pulses: 2, rings: 1, wash: 0.5, glint: true, mc: 'hsl(212 35% 90%)', mc2: 'hsl(214 22% 68%)' },
  bronze: { span: 1300, pulses: 2, rings: 1, faint: true, mc: 'hsl(26 80% 72%)', mc2: 'hsl(20 60% 48%)' },
  standard: { span: 1300, pulses: 2, mc: 'hsl(216 8% 80%)', mc2: 'hsl(216 8% 60%)' },
  rookie: { span: 1300, pulses: 2, mc: 'hsl(80 8% 92%)', mc2: 'hsl(80 6% 80%)' },
};
const HOLD_MS = 1300;
/** After the strip comes off: the card shows (white-hot) at `wait`, the stamps land `lands` after the reveal. */
const T = { wait: 500, lands: 900, step: 420, done: 150 };
/** Pulse start times (ms into the wait): each gap shorter than the last; the last pulse ends at `span`. */
export function pulseTimes(n, span) {
  const r = 0.62, gaps = Array.from({ length: n }, (_, k) => r ** k);
  const total = gaps.reduce((a, b) => a + b, 0);
  let t = 80;
  return gaps.map((g) => { const at = t; t += ((span - 160) * g) / total; return { at: Math.round(at), dur: Math.round(Math.max(260, ((span - 160) * g) / total * 1.25)) }; });
}
const GLB = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="r" cx="42" cy="58" r="30" fill="none" stroke-width="13"/><circle class="b" cx="82" cy="20" r="11"/></svg>';
/** The rough-edge ink filter the stamps use (url(#glb-rough)); one per page that shows stamps. */
export const ROUGH = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="glb-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter></svg>';

/** The sealed chrome foil pack (§3.1). No course, no date: those go under it as a label. */
export function chromePack(pattern = PACK_PATTERN, { cue = false } = {}) {
  const lay = (LAYERS[pattern] || LAYERS.fine) + '<i class="refract"></i>';
  const top = `${lay}<i class="sheen"></i>`;
  return `<div class="bp chrome${pattern === 'sapphire' ? ' sapphire' : ''}"><div class="topw"><div class="top">${top}</div></div>
    <div class="bp-body">${lay}<div class="bp-face"><div class="k">Scorecards · Series 1</div><span class="bp-mk">${GLB}</span><div class="wm">Golf Live<br>Board<small>2026 Edition</small></div><span class="bp-pill">1 Card</span></div><i class="sheen"></i></div>
    ${cue ? '<i class="slit"></i><i class="cue"></i><span class="cue-chip">Swipe to open</span>' : ''}</div>`;
}

/**
 * The overlay's markup. o = { fin, cardHtml (a .lk-slot), kicker, hint, title, grade, shot, lands (stamp HTML, one
 * element each), left (packs still sealed after this one), replay }.
 */
export function packHtml(o) {
  const p = PLAN[o.fin] || PLAN.standard;
  const rings = Array.from({ length: p.rings || 0 }, (_, i) => `<i class="pk-ring${p.faint ? ' faint' : ''}" style="--rd:${i * 380}ms"></i>`).join('');
  const vars = p.mc ? ` style="--mc:${p.mc};--mc2:${p.mc2}${p.wash ? `;--wp:${p.wash}` : ''}"` : '';
  const lands = (o.lands || []).join('');
  return `<div class="pk lkf-${esc(o.fin)}${p.pop ? ' pop' : ''}${p.glint ? ' glint' : ''}" data-fin="${esc(o.fin)}"${vars} role="dialog" aria-modal="true" aria-label="Open your pack">${ROUGH}
    <i class="pk-screen" aria-hidden="true"></i>
    <div class="pk-top">
      <button class="icon-btn pk-x" data-act="lk-pack-close" aria-label="Close">${icon('close')}</button>
      <span class="ts-label pk-k">${esc(o.kicker)}</span>
    </div>
    <div class="pk-stage">
      ${p.wash ? '<i class="pk-wash" aria-hidden="true"></i>' : ''}
      <div class="pk-fx" aria-hidden="true">${rings}</div>
      <div class="pk-pulses" aria-hidden="true"></div>
      <div class="pk-card" data-act="lk-pack-flip">${o.cardHtml}<i class="pk-glint" aria-hidden="true"></i></div>
      <div class="pk-lands${(o.lands || []).length > 2 ? ' many' : ''}">${lands}</div>
      <i class="pk-white" aria-hidden="true"></i>
      <div class="pk-pack" role="button" tabindex="0" aria-label="Swipe across the top to open your pack">
        <div class="pk-breathe"><div class="pk-shake">${chromePack(PACK_PATTERN, { cue: true })}</div></div>
      </div>
    </div>
    <div class="pk-foot${o.left ? ' two' : ''}">
      <div class="pk-hint"><div class="ts-row">${o.replay ? 'Swipe across the top to rip it again' : 'Swipe across the top'}</div><div class="ts-small pk-soft">${esc(o.hint)}</div></div>
      <div class="pk-res">
        <div class="pk-line"><b>${esc(o.title)}${o.grade ? ` · ${esc(o.grade)}` : ''}</b> · You shot ${esc(o.shot)}</div>
        <div class="pk-saved ts-small">${o.replay ? 'Already in your locker' : (o.lands || []).length ? `Saved to your locker · ${(o.lands || []).length === 1 ? 'a new stamp' : `${(o.lands || []).length} new stamps`} in your passport` : 'Saved to your locker'}</div>
        ${o.left ? `<button class="btn primary big block" data-act="lk-pack-next">Open next pack · ${o.left} left</button>`
          : `<button class="btn primary big block" data-act="lk-pack-add">Done</button>`}
        <div class="pk-two"><button class="btn big" data-act="lk-pack-share">${icon('share', 18)} Share</button><button class="btn big" data-act="lk-pack-pp">See in passport</button></div>
      </div>
    </div>
  </div>`;
}

/**
 * Start the pack inside `root` (the .pk element). opts = { reduced, onTear, tilt () → {x, y} | null }. Returns { stop }.
 * Everything it schedules is cleared by stop(), which toasts.closeOverlay calls on any route change.
 */
export function startPack(root, { reduced = false, onTear = () => {}, tilt = () => null } = {}) {
  const pk = root.querySelector('.pk-pack');
  const shk = root.querySelector('.pk-shake');
  const bp = root.querySelector('.bp');
  const plan = PLAN[root.dataset.fin] || PLAN.standard;
  const pulses = root.querySelector('.pk-pulses');
  const slot = root.querySelector('.pk-card .lk-slot');
  const timers = [];
  let stopped = false, p = 0, dir = 0, mode = null, held = false, done = false, holdRaf = 0, last = 0, swayRaf = 0;
  const later = (ms, fn) => timers.push(setTimeout(() => { if (!stopped) fn(); }, ms));
  const topw = bp.querySelector('.topw'), slit = bp.querySelector('.slit'), cue = bp.querySelector('.cue');
  let goal = 0, scrub = 0, back = 0;

  // p = how far the cut has run. The strip stays one piece, hinged at its far (uncut) end; the end you started from
  // lifts with your finger. It scrubs both ways (Andrew, Nov 25, "like the Pokémon TCG app"): slide back and it uncuts,
  // let go early and it settles shut. Only the strip, the slit and the cue are touched, so a frame stays cheap.
  const paint = () => {
    const sgn = dir < 0 ? -1 : 1;
    topw.style.transformOrigin = `${dir < 0 ? '0%' : '100%'} 100%`;
    topw.style.transform = p > 0.001 ? `translateY(${(-p * 12).toFixed(2)}%) rotate(${(sgn * p * 9).toFixed(2)}deg)` : '';
    if (slit) { slit.style.left = dir < 0 ? `${(1 - p) * 100}%` : '0%'; slit.style.width = `${p * 100}%`; }
    if (cue) { cue.style.left = `${dir < 0 ? 3 : Math.max(3, p * 100)}%`; cue.style.right = `${dir < 0 ? Math.max(3, p * 100) : 3}%`; }
    const j = mode === 'hold' ? p * p * 4 : 0;
    shk.style.transform = j ? `translate(${((Math.random() - 0.5) * j).toFixed(2)}px, ${((Math.random() - 0.5) * j).toFixed(2)}px)` : '';
  };
  const finish = () => {
    if (done) return;
    done = true;
    p = 1;
    cancelAnimationFrame(scrub); cancelAnimationFrame(back);
    bp.style.setProperty('--fx', dir < 0 ? -1 : 1);
    topw.style.transform = ''; // the fly-off (.pk.sep) takes it from here
    shk.style.transform = '';
    if (reduced) {
      root.classList.add('sep', 'waiting', 'reveal', 'done');
      root.querySelectorAll('.pk-lands > *').forEach((el) => el.classList.add('in'));
      onTear();
      return;
    }
    root.classList.add('sep');
    onTear();
    // 035's wait: the card rises white-hot out of the opening while light pulses, quicker each time; the last
    // pulse is the finish's colour; prismatic holds a dark beat; then the reveal and the stamps.
    later(T.wait, () => {
      root.classList.add('waiting');
      pulseTimes(plan.pulses, plan.span).forEach(({ at, dur }, k) => later(at, () => {
        const el = document.createElement('i');
        el.className = `pk-pulse${k === plan.pulses - 1 ? ' last' : ''}`;
        el.style.setProperty('--pd', `${dur}ms`);
        pulses.appendChild(el);
      }));
      if (plan.dark) later(plan.span, () => root.classList.add('dark'));
      const at = plan.span + (plan.dark ? 300 : 0);
      later(at, () => { root.classList.remove('dark'); root.classList.add('reveal'); });
      const lands = [...root.querySelectorAll('.pk-lands > *')];
      lands.forEach((el, i) => later(at + T.lands + i * T.step, () => el.classList.add('in')));
      later(at + T.lands + lands.length * T.step + T.done, () => root.classList.add('done'));
    });
  };
  // The strip follows the finger with a little easing, so it glides instead of jumping between touch events.
  const follow = () => {
    scrub = 0;
    if (stopped || done) return;
    p += (goal - p) * 0.5;
    if (Math.abs(goal - p) < 0.002) p = goal;
    paint();
    if (goal > 0.94 && p > 0.9) { finish(); return; }
    if (p !== goal) scrub = requestAnimationFrame(follow);
  };
  // Let go before the end: it settles shut, and the next swipe can start from either side.
  const settle = () => {
    back = 0;
    if (stopped || done || held) return;
    p *= 0.8;
    if (p < 0.004) { p = 0; dir = 0; root.classList.remove('tearing'); }
    paint();
    if (p > 0) back = requestAnimationFrame(settle);
  };

  const holdTick = (ts) => {
    holdRaf = 0;
    if (stopped || done) return;
    const dt = Math.min(50, ts - (last || ts));
    last = ts;
    if (held) { p = Math.min(1, p + dt / HOLD_MS); paint(); }
    if (p >= 1) { finish(); return; }
    if (held) holdRaf = requestAnimationFrame(holdTick); else shk.style.transform = '';
  };
  const down = (e) => {
    if (done) return;
    e.preventDefault();
    if (reduced) { dir = 1; finish(); return; }
    try { pk.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    cancelAnimationFrame(back);
    const r = pk.getBoundingClientRect(), fy = (e.clientY - r.top) / r.height, fx = (e.clientX - r.left) / r.width;
    mode = fy < 0.45 ? 'swipe' : 'hold';
    held = true;
    root.classList.add('tearing');
    if (!dir || p < 0.01) dir = mode === 'swipe' && fx > 0.5 ? -1 : 1;
    if (mode === 'hold' && !holdRaf) { last = 0; holdRaf = requestAnimationFrame(holdTick); }
  };
  const move = (e) => {
    if (!held || mode !== 'swipe' || done) return;
    const r = pk.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    goal = Math.max(0, Math.min(1, dir < 0 ? 1 - fx : fx));
    if (!scrub) scrub = requestAnimationFrame(follow);
  };
  const up = () => {
    held = false;
    if (done) return;
    if (mode === 'swipe') { goal = 0; cancelAnimationFrame(scrub); scrub = 0; if (!back) back = requestAnimationFrame(settle); }
  };
  const key = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !done) { e.preventDefault(); dir = dir || 1; finish(); } };
  const menu = (e) => e.preventDefault();
  pk.addEventListener('pointerdown', down);
  pk.addEventListener('pointermove', move);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pk.addEventListener(ev, up));
  pk.addEventListener('keydown', key);
  pk.addEventListener('contextmenu', menu);

  // Sway: the pack and (after the reveal) the card follow the phone's tilt, else a slow idle sway. --mv = speed.
  let cx = 0, cy = 0, mv = 0;
  const sway = (ts) => {
    swayRaf = 0;
    if (stopped || !root.isConnected) return;
    const g = tilt();
    // Inverse tilt (Andrew, Nov 25): the card leans against the phone's tilt so it keeps facing you; 20% stronger.
    const tx = reduced ? 0 : g ? -g.y * 1.2 : Math.sin(ts / 1900) * 0.85, ty = reduced ? 0 : g ? -g.x * 1.2 : Math.cos(ts / 2600) * 0.5;
    if (held && !done) { swayRaf = requestAnimationFrame(sway); return; }
    const nx = cx + (tx - cx) * 0.16;
    cy += (ty - cy) * 0.16;
    mv = reduced ? 0 : Math.max(mv * 0.93, Math.min(1, Math.abs(nx - cx) * 130));
    cx = nx;
    const el = root.classList.contains('reveal') ? slot : bp;
    if (el) {
      el.style.setProperty('--sx', cx.toFixed(3)); el.style.setProperty('--sy', cy.toFixed(3)); el.style.setProperty('--mv', mv.toFixed(3));
      el.style.setProperty('--ry', (cx * 6).toFixed(2)); el.style.setProperty('--rx', (-cy * 3).toFixed(2));
    }
    swayRaf = requestAnimationFrame(sway);
  };
  if (!reduced) swayRaf = requestAnimationFrame(sway);

  return {
    get stage() { return done ? 'open' : 'sealed'; },
    stop() {
      stopped = true;
      timers.forEach(clearTimeout);
      if (holdRaf) cancelAnimationFrame(holdRaf);
      if (swayRaf) cancelAnimationFrame(swayRaf);
      cancelAnimationFrame(scrub); cancelAnimationFrame(back);
    },
  };
}
