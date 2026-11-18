// Mockup kit for handoffs 027–030 (reference only). Each screens.html registers screens and
// calls K.boot(SCREENS). Open a screen with  screens.html#{"s":"key"}  and add "light":true for the
// light theme, "t":120 to freeze a grow at 120 ms, "pins":true for review pins.
const ICON = {
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4h11l-3 4 3 4H6"/>', rings: '<circle cx="8.5" cy="12" r="4.5"/><circle cx="15.5" cy="12" r="4.5"/>',
  bars: '<path d="M5 7h14M5 12h10M5 17h7"/>', grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', share: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
export const i = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

// score mark: gross score vs par
export function mark(score, par, sm = false) {
  if (score == null) return sm ? '<span class="dash">–</span>' : `<span class="mk ghost">${par}</span>`;
  const d = score - par, k = d <= -2 ? 'cc' : d === -1 ? 'c' : d === 0 ? '' : d === 1 ? 's' : 'd';
  return `<span class="mk ${k} ${sm ? 'sm' : ''}">${score}</span>`;
}
export const tabbar = (on = 0, dot = false) => `<nav class="tabbar">${['flag', 'rings', 'bars', 'grid'].map((n, k) => `<span class="${k === on ? 'on' : ''} ${dot && k === 0 && on !== 0 ? 'dot' : ''}">${i(n)}</span>`).join('')}</nav>`;
export const enterHead = (hole, par) => `<div class="eh"><div class="hole"><b class="hn">Hole ${hole}</b><span class="hp">Par ${par}</span></div><div class="nav"><span>${i('left')}</span><span>${i('right')}</span><span>${i('dots')}</span></div></div>`;
export const green = (f, m, b) => `<div class="green"><svg viewBox="0 0 56 64"><path d="M28 3c13 0 24 9 24 25s-10 33-24 33S4 44 4 28 15 3 28 3z" fill="currentColor" opacity=".1"/><path d="M28 3c13 0 24 9 24 25" stroke="currentColor" fill="none" opacity=".25"/><path d="M28 3c13 0 24 9 24 25s-10 33-24 33S4 44 4 28 15 3 28 3z" fill="none" stroke="var(--text-muted)" stroke-width="1.5"/><path d="M6 22h44M6 40h44" stroke="var(--surface-1)" stroke-width="2"/><circle cx="28" cy="31" r="3" fill="var(--text)"/></svg><div class="g-num"><b>${f}</b><span>FRONT</span></div><div class="g-num mid"><b>${m}</b><span>MIDDLE</span></div><div class="g-num"><b>${b}</b><span>BACK</span></div></div>`;
export const mline = (us, st, stYou, vs, act = '') => `<div class="mline"><span class="us">${us}</span><span class="end">${st ? `<span class="st ${stYou ? 'you' : ''}">${st}</span>` : ''}${vs ? `<span>${vs}</span>` : ''}${act ? `<span class="act">${act}</span>` : ''}</span></div>`;
// one player's pad row: picked = score or null; extra = text after the name; src = right-side source text
export function prow(name, par, picked, extra = '', src = '') {
  const win = [par - 1, par, par + 1, par + 2];
  const inWin = picked == null || win.includes(picked);
  const pads = win.map((s) => `<span class="pad ${s === picked ? 'sel' : ''}">${mark(s, par)}</span>`).join('')
    + (inWin ? `<span class="pad">${i('dots')}</span>` : `<span class="pad sel">${mark(picked, par)}</span>`);
  return `<div class="prow"><div class="pnm"><b>${name}</b>${extra ? `<span>${extra}</span>` : ''}${src ? `<span class="src">${src}</span>` : ''}</div><div class="pads">${pads}</div></div>`;
}
// a compact row inside an open card (one-pad-at-a-time for 3+ players)
export const crow = (name, score, par, src = '') => `<div class="crow"><b>${name}</b>${src ? `<span class="src">${src}</span>` : ''}${mark(score, par, true)}</div>`;
// quiet row: ps = [[name, score]], go = 'Enter' | 'Edit'
export function qrow(ps, par, go = 'Enter', { grp = '', mine = false, first = false, cls = '', more = '' } = {}) {
  const who = ps.map(([n, s, miss]) => `<span class="p ${miss ? 'miss' : ''}">${n} ${mark(s, par, true)}</span>`).join('') + (more ? `<span class="p muted">${more}</span>` : '');
  return `<div class="qrow ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${cls}">${grp ? `<span class="grp">${grp}</span>` : ''}<span class="who">${who}</span>${go ? `<span class="go">${go}${i('right', 's20')}</span>` : ''}</div>`;
}
export const foot = (label, go = false, status = '', warn = false) => `<div class="foot">${status ? `<div class="status ${warn ? 'warn' : ''}">${status}</div>` : ''}<div class="next ${go ? 'go' : ''}">${label}</div></div>`;
export const tbar = (av, name, right, { watch = false, share = false } = {}) => `<div class="tbar"><span class="av ${watch ? 'watch' : ''}">${watch ? i('user', 's20') : av}</span><b>${name}</b><span class="tr">${right}</span>${share ? `<span class="ib">${i('share', 's20')}</span>` : ''}<span class="ib">${i('dots', 's20')}</span></div>`;
export const seg = (items, on = 0) => `<div class="seg">${items.map((t, k) => `<span class="${k === on ? 'on' : ''}">${t}</span>`).join('')}</div>`;
export const su = (back, step, of) => `<div class="su"><span class="back">${i('left', 's20')}${back}</span><span class="prog">${Array.from({ length: of }, (_, k) => `<i class="${k < step ? 'on' : ''}"></i>`).join('')}</span></div>`;
export const pin = (n, css) => `<span class="pin" style="${css}">${n}</span>`;

// ── freeze a grow at t ms (the same numbers as motion.css, applied by hand so a still frame is exact)
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => { let t = x; for (let k = 0; k < 8; k++) { const e = X(t) - x; if (Math.abs(e) < 1e-5) break; t -= e / (dX(t) || 1); } return Y(Math.min(1, Math.max(0, t))); };
}
const EASE = bez(0.2, 0.8, 0.2, 1);
// el: a .grow slot, holding .g-row and .g-card. dir 'open' (row → card) or 'close'. dur in ms.
export function freezeGrow(el, t, dir, dur = 300, reduced = false) {
  const row = el.querySelector(':scope > .g-row'), card = el.querySelector(':scope > .g-card');
  el.style.alignItems = 'start';
  for (const f of [row, card]) { f.style.visibility = 'visible'; f.style.height = 'auto'; }
  const hRow = row.offsetHeight, hCard = card.offsetHeight;
  const [from, to, hFrom, hTo] = dir === 'open' ? [row, card, hRow, hCard] : [card, row, hCard, hRow];
  const p = Math.min(1, t / dur);
  if (reduced) { // jump in size, cross-fade 150ms
    el.style.height = hTo + 'px'; from.style.visibility = 'hidden'; to.style.opacity = Math.min(1, t / 150); return;
  }
  el.style.height = (hFrom + (hTo - hFrom) * EASE(p)) + 'px';
  el.style.alignItems = 'start';
  // old face out over 0–40% (ease-in), new face in over 20–100% (ease-out): they overlap 60–120ms
  const pOut = Math.min(1, t / (dur * 0.4)), pIn = Math.min(1, Math.max(0, (t - dur * 0.2) / (dur * 0.8)));
  from.style.opacity = 1 - pOut * pOut; from.style.filter = `blur(${8 * pOut}px)`;
  to.style.opacity = EASE(pIn); to.style.filter = `blur(${8 * (1 - EASE(pIn))}px)`;
  if (pOut >= 1) from.style.visibility = 'hidden';
}

export function boot(SCREENS) {
  const st = (() => { try { return JSON.parse(decodeURIComponent(location.hash.slice(1)) || '{}'); } catch { return {}; } })();
  document.documentElement.classList.toggle('light', !!st.light);
  document.documentElement.classList.toggle('pins', !!st.pins);
  const key = st.s || Object.keys(SCREENS)[0];
  const def = SCREENS[key];
  if (!def) { document.body.innerHTML = `<p style="padding:16px">Screens: ${Object.keys(SCREENS).join(', ')}</p>`; return; }
  document.body.innerHTML = (typeof def === 'function' ? def : def.html)(st);
  if (def.after) def.after(st);
  document.fonts.ready.then(() => { if (def.frame) def.frame(st); document.body.dataset.ready = '1'; });
}
