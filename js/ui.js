// ui.js — small shared helpers for screens: escaping, icons, controls, formatting.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const P = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  fwd: '<path d="M9 18l6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  enter: '<path d="M6 21V4"/><path d="M7 4.5l11 4-11 4.5z"/>',
  matches: '<circle cx="7.5" cy="12" r="4.5"/><circle cx="16.5" cy="12" r="4.5"/>',
  board: '<path d="M4 6h10M4 12h16M4 18h7"/>',
  card: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
  host: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  spark: '<path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  redo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
};

export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/** Segmented control. options: [[value, label], ...] */
export function seg(act, options, value, extra = '') {
  return `<div class="seg" role="group">${options
    .map(([v, label]) => `<button data-act="${act}" data-v="${esc(v)}" aria-pressed="${String(v) === String(value)}" ${extra}>${esc(label)}</button>`)
    .join('')}</div>`;
}

export const initials = (name) =>
  String(name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

export function clock(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
}

export function prettyDate(d) {
  if (!d) return '';
  const dt = new Date(`${String(d).slice(0, 10)}T12:00:00`);
  return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Score decoration class: e = eagle or better (double circle), u = birdie (circle),
 *  b = bogey (square), d = double bogey or worse (double square, red tint). */
export function scoreClass(strokes, par) {
  if (strokes == null) return 'blank';
  const d = strokes - par;
  if (d <= -2) return 'u e';
  if (d < 0) return 'u';
  if (d === 1) return 'b';
  if (d >= 2) return 'd';
  return '';
}

/** "BIRDIE" / "PAR" / "+4" for a score on a hole. */
export function scoreName(strokes, par) {
  if (strokes == null) return '';
  const d = strokes - par;
  if (strokes === 1) return 'ACE';
  return { '-3': 'ALBATROSS', '-2': 'EAGLE', '-1': 'BIRDIE', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE', 3: 'TRIPLE' }[d] || (d > 0 ? `+${d}` : `${d}`);
}

/**
 * Score mark (designspec §1): eagle− double circle, birdie circle, par plain, bogey square,
 * double+ double square with a light red fill. size = the mark's box in px. A missing score
 * shows `ghost` (e.g. par) in a dashed circle, or nothing.
 */
export function mark(strokes, par, size = 28, { ghost = null, cls = '' } = {}) {
  const k = strokes == null ? (ghost != null ? 'mk-ghost' : 'mk-none') : `mk-${{ u: 'u', 'u e': 'e', b: 'b', d: 'd', '': 'p' }[scoreClass(strokes, par)]}`;
  const v = strokes ?? ghost ?? '';
  return `<span class="mk ${k}${cls ? ` ${cls}` : ''}" style="--mk:${size}px">${esc(v)}</span>`;
}

/** ' fold-in' only right after the tap that opened something (background redraws don't replay it). */
export const foldIn = (ui) => (Date.now() - (ui.foldAt || 0) < 600 ? ' fold-in' : '');

/** Segmented control with a second line per segment: [[value, label, sub, { dot, live }], …]. */
export function seg2(act, options, value) {
  return `<div class="seg seg2" role="group">${options
    .map(([v, label, sub, o = {}]) => `<button data-act="${act}" data-v="${esc(v)}" aria-pressed="${String(v) === String(value)}">
      <span class="s-top">${o.dot ? `<i class="s-dot" style="background:${o.dot}"></i>` : ''}<span class="ellipsis">${esc(label)}</span></span>
      ${sub ? `<span class="s-sub mono${o.live ? ' live' : ''}">${esc(sub)}</span>` : ''}</button>`)
    .join('')}</div>`;
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function roundLink(code, suffix = '') {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/e/${code}${suffix}`;
}
