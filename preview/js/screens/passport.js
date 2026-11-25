// passport.js — 036 the Passport (docs/design/features/036-card-designs/SPEC.md §5, §6.3, §7): the stamp markup
// (course stamps cut from each club's logo, milestone rubber stamps), what lands under a card on the reveal, and the
// book (cover · holder · courses · milestones) that is also everyone's profile. The Locker screen draws it in its
// Passport tab; the rules are pure in js/stamps.js (tests/stamps036.test.mjs). Prototypes: reveal-back-book.html
// Part 3, passport-booklet.html, stamp-library.html.
//
// Stable under the render loop: the page you are on lives in app.ui.pp; a page turn changes classes in the DOM
// (never app.render()), and the book's pointer listeners are added once per mount.

import { esc } from '../ui.js';
import { PageFlip } from '../vendor/page-flip.js';
import { stampFor, courseStampSvg, stampDate, passportOf, goalsOf } from '../stamps.js';
import { openedOf, shortDay, longDay, FINISHES } from '../locker.js';

const hash = (s) => Math.abs([...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MARK = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="42" cy="58" r="30" fill="none" stroke="currentColor" stroke-width="13"/><circle cx="82" cy="20" r="11" fill="#3DDC84"/></svg>';

// ───────────────────────────────────────────── stamps

/** A course stamp (§7.1) for a passport course entry { course, courseObj, first, … }. Angle + press from the slug hash. */
export function courseStampHtml(entry, { r } = {}) {
  const st = stampFor(entry.courseObj || { name: entry.course });
  const h = hash(st.slug || entry.key || entry.course);
  const rot = r ?? (h % 14) - 6; // −6…7°
  const fa = 60 + (h % 90);
  const svg = courseStampSvg(st, stampDate(entry.first));
  return svg.replace('<svg ', `<svg class="cs cs-${st.stamp.shape}" style="--ink:var(--ink-${st.stamp.ink});--r:${rot}deg;--fa:${fa}deg" role="img" aria-label="${esc(`${st.short} stamp, ${stampDate(entry.first)}`)}" `);
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const INK = { 'first-birdie': 'var(--ink-green)', lowest: 'var(--ink-blue)', eagle: 'var(--ink-amber)' };
const inkOf = (kind) => INK[kind] || (/^broke-/.test(kind) ? 'var(--ink-red)' : 'var(--ink-violet)');
/** A milestone rubber stamp (§6.3): "20 NOV 2026 · TWIN CREEKS · 87". `act` makes it a button that opens its card. */
export function rubberHtml(m, { act = '' } = {}) {
  const rot = (hash(m.label + m.day) % 13) - 6;
  const line = [stampDate(m.day), m.course, m.hole ? `hole ${m.hole}` : m.kind === 'lowest' ? '' : m.gross].filter(Boolean).join(' · ');
  const sty = `--ink:${inkOf(m.kind)};--r:${rot}deg;${m.kind === 'first-birdie' ? '--rad:999px;' : ''}`;
  const inner = `<b>${esc(m.label)}</b><span>${esc(line)}</span>`;
  return act ? `<button class="pp-rs" data-act="${act}" data-v="${esc(m.cardKey)}" style="${sty}">${inner}</button>` : `<span class="pp-rs" style="${sty}">${inner}</span>`;
}
const ghostHtml = (g, i) => `<span class="pp-rs ghost" style="--r:${i % 2 ? 3 : -2}deg;${g === 'First birdie' || g === 'Eagle' ? '--rad:999px;' : ''}"><b>${esc(g)}</b></span>`;

/** What the reveal stamps under this card (§3.3): its milestones, plus the course stamp the first time you finish there. */
export function landsFor(card, cards) {
  const pp = passportOf(cards);
  const out = pp.milestones.filter((m) => m.cardKey === card.key).map((m) => rubberHtml(m));
  const course = pp.courses.find((c) => c.firstCardKey === card.key);
  if (course) out.push(courseStampHtml(course));
  return out;
}

// ───────────────────────────────────────────── the book (§5)

/** Who the book belongs to, from their cards: full name, initials, first day. */
function holderOf(cards) {
  const last = cards[cards.length - 1] || {};
  const full = last.fullName || last.name || '';
  const parts = full.split(/\s+/).filter(Boolean);
  return { full, first: parts[0] || '', last: parts.slice(1).join(' '), initials: parts.slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?' };
}

/** §5.2 Showcase (§13 Q3: chosen by the app): best grade (then lowest gross), newest, best round. */
const RANK = ['prismatic', 'gold', 'silver', 'bronze', 'standard', 'rookie'];
function showcaseOf(opened) {
  const by = (f) => [...opened].sort(f)[0];
  const picks = [
    by((a, b) => RANK.indexOf(a.fin) - RANK.indexOf(b.fin) || a.gross - b.gross),
    opened[0], // newest (openedOf is newest first)
    by((a, b) => a.gross - b.gross || String(b.day).localeCompare(String(a.day))),
  ];
  // When those are the same card, fill up with the next best by grade, then gross.
  picks.push(...[...opened].sort((a, b) => RANK.indexOf(a.fin) - RANK.indexOf(b.fin) || a.gross - b.gross));
  const seen = new Set();
  return picks.filter((c) => c && !seen.has(c.key) && seen.add(c.key)).slice(0, 3);
}

function mrz(h, cards, nCourses, all) {
  const first = all[0];
  const [y, m, d] = String(first?.day || '').split('-').map(Number);
  const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '<');
  const line = `GLB<<${clean(h.last || h.first)}<<${clean(h.last ? h.first : '')}<<<${cards.length}RDS<${nCourses}CRS<<ISSUED${m ? `${String(d).padStart(2, '0')}${MON[m - 1]}${y}` : ''}`;
  return esc(`${line}${'<'.repeat(Math.max(4, 44 - line.length))}`);
}

/** The pages, in order, as { name, html }. cards = everyone's cards for this person (oldest first). */
export function bookPages(cards, { frontHtml, readOnly = false } = {}) {
  const opened = openedOf(cards);
  // The passport counts opened cards only: a sealed pack's stamps are a surprise until you rip it.
  const shown = cards.filter((c) => c.opened);
  const pp = passportOf(shown);
  const h = holderOf(cards);
  const pages = [];
  pages.push({ name: 'Cover', html: `<div class="bk-cover">${MARK}<b>Golf Live Board</b><h3>Passport</h3><span>${esc(h.full)}</span></div>` });

  const best = [...shown].sort((a, b) => a.gross - b.gross)[0];
  const f = (k, v) => `<div class="id-f"><i>${k}</i><b>${v}</b></div>`;
  const tally = ['prismatic', 'gold', 'silver', 'bronze', 'standard'].map((fin) => {
    const n = opened.filter((c) => c.fin === fin).length;
    const lbl = { prismatic: 'Prism', standard: 'Std' }[fin] || FINISHES[fin].name;
    return `<span class="lkf-${fin}"><b>${n}</b>${lbl}</span>`;
  }).join('');
  const show = showcaseOf(opened);
  pages.push({
    name: readOnly ? (h.first || 'Holder') : 'You',
    html: `<div class="pp-page pp-holder"><div class="pp-k"><span>Holder</span>${readOnly ? '<span>Golf Live Board</span>' : '<button class="pp-sh" data-act="pp-share">Share</button>'}</div>
      <div class="id-top"><div class="id-ph">${MARK}<b>${esc(h.initials)}</b></div><div class="id-col">${f('Name', esc(h.full))}${f('Since', esc(longDay(cards[0]?.day)))}${f('Best round', best ? `${best.gross} · ${esc(best.course)}` : '—')}</div></div>
      <div class="id-grid">${f('Rounds', shown.length)}${f('Courses', pp.courses.length)}</div>
      ${show.length ? `<div class="pp-k"><span>Showcase</span><span>${show.length}</span></div>
        <div class="pp-show">${show.map((c) => `<button class="lk-mini lkf-${c.fin}" data-act="pp-card" data-v="${esc(c.key)}" aria-label="${esc(`${c.course}, ${shortDay(c.day)}, ${c.gross}`)}"><span class="lk-face lk-front">${frontHtml(c)}</span></button>`).join('')}</div>` : ''}
      <div class="pp-k"><span>Cards in the locker</span><span>${opened.length}</span></div><div class="id-tally">${tally}</div>
      <div class="pp-mrz">${mrz(h, shown, pp.courses.length, cards)}</div></div>`,
  });

  // Courses: 6 a page, scattered like a real passport (Andrew, Nov 25): six loose spots, each nudged and turned by
  // the course's own hash so a stamp never moves, slightly overlapping; then "Your next course" in the next spot.
  const spot = (i, key) => {
    const [l, t, w] = SPOTS[i % 6], h = hash(key || i);
    return `left:${l + (h % 5) - 2}%;top:${t + ((h >> 3) % 5) - 2}%;width:${w}%`;
  };
  const items = pp.courses.map((c) => ({ key: c.key, html: `<button class="pp-c" data-act="pp-card" data-v="${esc(c.firstCardKey)}" style="%SPOT%">
      ${courseStampHtml(c)}<span class="pp-cap"><b>${plural(c.visits, 'visit')}</b> · best ${c.best}</span></button>` }));
  items.push({ key: 'next', html: '<div class="pp-ghost" style="%SPOT%"><span>Your next course</span></div>' });
  for (let i = 0; i < items.length; i += 6) {
    const page = items.slice(i, i + 6).map((it, k) => it.html.replace('%SPOT%', spot(k, it.key))).join('');
    pages.push({ name: 'Courses', html: `<div class="pp-page"><div class="pp-k"><span>Courses</span><span>${pp.courses.length} played</span></div><div class="pp-courses">${page}</div></div>` });
  }
  // Milestones: earned (oldest first, newest at the bottom), then the goals still open as dashed outlines.
  const miles = pp.milestones.map((m) => rubberHtml(m, { act: 'pp-card' })).concat(goalsOf(pp, shown).map(ghostHtml));
  for (let i = 0; i < Math.max(1, miles.length); i += 6) {
    pages.push({ name: 'Milestones', html: `<div class="pp-page"><div class="pp-k"><span>Milestones</span><span>${pp.milestones.length} earned</span></div><div class="pp-miles">${miles.slice(i, i + 6).join('')}</div></div>` });
  }
  return pages;
}

/** Six loose spots on a courses page: [left %, top %, width %] of the stamp area. */
const SPOTS = [[0, 0, 50], [50, 6, 48], [5, 35, 46], [50, 39, 50], [1, 69, 48], [51, 71, 46]];

const caption = (pages, i) => (i === 0 ? 'Cover · tap to open' : `${pages[i].name} · page ${i} of ${pages.length - 1}`);

/** The book's place on the screen. The book itself is built once in mountBook and kept across redraws. */
export function bookHtml(cards, ui, opts) {
  const pages = bookPages(cards, opts);
  ui.pg = Math.max(0, Math.min(pages.length - 1, ui.pg || 0));
  return `<div class="pp"><div class="pp-host"></div>
    <div class="pp-cap-row ts-label" aria-live="polite">${esc(caption(pages, ui.pg))}</div></div>`;
}

/** The page of the book a passport entry is on: 'courses' / 'milestones' → the first such page. */
export function pageOf(cards, what, opts) {
  const pages = bookPages(cards, opts);
  const i = pages.findIndex((p) => p.name.toLowerCase() === what);
  return i < 0 ? 1 : i;
}

let walking = false;
/** The impact of a stamp: a short shake of `el` and a tap on phones that can buzz. */
export function thud(el) {
  if (!el || document.documentElement.classList.contains('rm')) return;
  el.classList.remove('thud');
  void el.offsetWidth;
  el.classList.add('thud');
  try { navigator.vibrate?.(18); } catch { /* no haptics */ }
}
/** True while the book is turning itself to a page: the Locker holds redraws until it's done. */
export const bookBusy = () => walking;

/**
 * The book (Andrew, Nov 25: "a physical page peeling", not a slide transition): StPageFlip (js/vendor/page-flip.js,
 * MIT) draws real page curls that follow the finger, one page at a time on a phone; the cover is a hard page. It's
 * built once per person + set of cards and the same element is put back after every redraw, so a turn in progress
 * survives the render loop. Tap the right side or swipe to turn; a stamp or a showcase card opens its card.
 */
let book = null; // { key, wrap, pf, names }
// A real booklet (Andrew, Nov 25): two-page spreads. Every content page has a plain back, so a turned page lands on the
// left as its blank back; there's a hard front and back cover. Content page c sits at book index 2c (0 = the cover).
const bookIndex = (c) => (c > 0 ? 2 * c : 0);
const contentIndex = (i) => (i + 1) >> 1;
export function mountBook(content, ui, cards, opts, key) {
  const host = content.querySelector('.pp-host');
  if (!host) return;
  const cap = content.querySelector('.pp-cap-row');
  const caps = () => { if (cap && book) cap.textContent = caption(book.names.map((name) => ({ name })), Math.min(ui.pg, book.names.length - 1)); };
  // Size: the right-hand page fills the screen less a strip on the left, where the page before it peeks in.
  const W = document.documentElement.clientWidth, H = window.innerHeight;
  const P = Math.round(Math.max(220, Math.min(W - 72, (H - 250) / 1.44, 460))), PH = Math.round(P * 1.44);
  const sized = `${P}x${PH}`;
  if (!(book && book.key === key && book.sized === sized)) {
    try { book?.pf.destroy(); } catch { /* gone */ }
    const pages = bookPages(cards, opts);
    const blank = '<div class="pg pg-back"><div class="pp-page pp-blank"></div></div>';
    const html = pages.map((p, i) => `<div class="pg"${i === 0 ? ' data-density="hard"' : ''}>${p.html}</div>${blank}`).join('')
      + '<div class="pg" data-density="hard"><div class="bk-cover bk-backcover"></div></div>';
    const wrap = document.createElement('div');
    wrap.className = 'pp-book';
    wrap.innerHTML = `<div class="pp-flip">${html}</div>`;
    host.appendChild(wrap);
    const reduce = document.documentElement.classList.contains('rm');
    const pf = new PageFlip(wrap.querySelector('.pp-flip'), {
      width: P, height: PH, size: 'fixed', usePortrait: false, showCover: true, autoSize: true,
      drawShadow: true, maxShadowOpacity: 0.55, flippingTime: reduce ? 150 : 900,
      mobileScrollSupport: false, swipeDistance: 30, startPage: bookIndex(ui.pg || 0), clickEventForward: true,
    });
    pf.loadFromHTML(wrap.querySelectorAll('.pp-flip > .pg'));
    book = { key, sized, wrap, pf, names: pages.map((p) => p.name) };
    pf.on('flip', (e) => { ui.pg = Math.min(book.names.length - 1, contentIndex(Number(e.data) || 0)); caps(); if (book.onFlip) book.onFlip(); });
  } else if (book.wrap.parentNode !== host) {
    host.appendChild(book.wrap);
  }
  // The spread is 2P wide; the page you're reading (the right one) is centred on the screen and the one before it
  // peeks in from the left edge (Andrew, Nov 25).
  host.style.width = `${2 * P}px`;
  host.style.marginLeft = `${Math.round((W - P) / 2 - P)}px`;
  caps();
  // Walk to a page (after "See in passport"): from the cover, one page turn at a time, then the new stamp thumps.
  if (ui.walkTo != null) {
    const to = Math.min(book.names.length - 1, ui.walkTo), hit = ui.hit, pf = book.pf;
    ui.walkTo = null; ui.hit = null;
    walking = true;
    // The new stamps (this card's) wait off the page, then get pounded on one by one once the book is open there,
    // with the same weight as on the reveal: a hard stamp and a shake (Andrew, Nov 25).
    const fresh = hit ? [...book.wrap.querySelectorAll(`[data-v="${CSS.escape(hit)}"]`)] : [];
    fresh.forEach((el) => { el.classList.remove('pp-hit'); el.classList.add('pp-wait'); });
    const done = () => {
      book.onFlip = null;
      const shake = content.querySelector('.pp');
      fresh.forEach((el, i) => setTimeout(() => {
        el.classList.remove('pp-wait');
        void el.offsetWidth;
        el.classList.add('pp-hit');
        setTimeout(() => thud(shake), 210);
      }, 350 + i * 520));
      setTimeout(() => { walking = false; }, 600 + fresh.length * 520);
    };
    const next = () => { if (ui.pg >= to) done(); else setTimeout(() => pf.flipNext('top'), 120); };
    book.onFlip = next;
    if ((ui.pg || 0) !== 0) pf.turnToPage(0);
    ui.pg = 0;
    caps();
    setTimeout(() => { if (to > 0) pf.flipNext('top'); else done(); }, 500);
  }
}

// ───────────────────────────────────────────── profile links (§4.3)

/** The person behind a round's player id (old rounds have none). */
export const personOf = (app, pid) => (app?.event?.roster?.players || []).find((x) => x?.id === pid)?.personId || null;
/** A name that opens that person's passport (read-only for a friend). Inside a row button it takes the tap for the
 *  name only; the rest of the row keeps its own action. Names without a personId stay plain text. */
export function ppName(personId, html) {
  return personId ? `<span class="pp-link" data-act="go" data-v="#/passport/${encodeURIComponent(personId)}">${html}</span>` : html;
}
