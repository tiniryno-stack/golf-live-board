// stamps.js — 036 course + milestone stamps. Pure apart from the SVG strings: no DOM, no network.
// From docs/design/features/036-card-designs/components/stamps.js. Test: tests/stamps036.test.mjs.
import { STAMP_COURSES } from './stamps-data.js';

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(the|golf|club|course|courses|country|cc|gc|links|park|at|of)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** The library entry for a round's course, or null. Tries course id, then names (exact alias, then normalized name). */
export function matchCourse(course) {
  if (!course) return null;
  const keys = [course.id, course.name, course.shortName].filter(Boolean);
  for (const k of keys) { const c = STAMP_COURSES.find((x) => x.slug === k || x.aliases.includes(k)); if (c) return c; }
  const n = keys.map(norm).filter(Boolean);
  return STAMP_COURSES.find((x) => n.includes(norm(x.name)) || n.includes(norm(x.short))) || null;
}

const INKS = ['blue', 'red', 'green', 'violet', 'amber', 'teal'];
const hash = (s) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
/** A stamp for any course: the library's, else a plain one built from the course's own name (flag-less monogram). */
export function stampFor(course) {
  const hit = matchCourse(course);
  if (hit) return hit;
  const name = course?.shortName || course?.name || 'Golf';
  const words = name.replace(/\b(the|golf|club|course|at|of)\b/gi, ' ').trim().split(/\s+/);
  const h = Math.abs(hash(course?.id || name));
  return { slug: null, name, short: name.length > 18 ? words.slice(0, 2).join(' ') : name, city: (course?.location || '').split(',')[0] || '',
    state: (course?.location || '').split(',')[1]?.trim() || '', emblem: null, emblemRatio: 1, monogram: words.slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    stamp: { shape: ['ring', 'oval'][h % 2], ink: INKS[h % 6] } };
}

const fit = (s, base, room) => Math.min(base, room / Math.max(String(s).length, 1));
let uid = 0;
function emblem(c, cx, cy, w, h) {
  if (!c.emblem) { const m = c.monogram || c.short.slice(0, 2); return `<text class="mono" x="${cx}" y="${cy + h * .3}" style="font-size:${Math.min(h * .95, w * 1.5 / m.length)}px">${m}</text>`; }
  let ew = w, eh = w / c.emblemRatio; if (eh > h) { eh = h; ew = h * c.emblemRatio; }
  const id = 'sm' + (++uid);
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${cx - ew / 2}" y="${cy - eh / 2}" width="${ew}" height="${eh}"><image href="${c.emblem}" x="${cx - ew / 2}" y="${cy - eh / 2}" width="${ew}" height="${eh}" preserveAspectRatio="xMidYMid meet"/></mask><rect x="${cx - ew / 2}" y="${cy - eh / 2}" width="${ew}" height="${eh}" fill="currentColor" mask="url(#${id})"/>`;
}
/** The course stamp as an SVG string. date = 'DD MON YYYY' (first round finished there). Colour comes from CSS: color: var(--ink-<ink>). */
export function courseStampSvg(c, date) {
  const city = [c.city.split(' (')[0].split(' /')[0], c.state].filter(Boolean).join(' · '), id = 'st' + (++uid);
  if (c.stamp.shape === 'box') return `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
    <rect class="ln" x="4" y="4" width="232" height="152" rx="10" stroke-width="3"/><rect class="ln" x="10" y="10" width="220" height="140" rx="6" stroke-width="1"/>
    ${emblem(c, 120, 58, 168, 72)}<path class="ln" stroke-width="1" d="M26 102H214"/>
    <text x="120" y="120" style="font-size:${fit(c.short, 15, 300)}px;letter-spacing:2px">${c.short}</text>
    <text x="70" y="140" class="dt" style="font-size:11px;letter-spacing:1px">${date}</text><text x="172" y="140" style="font-size:${fit(city, 8.5, 150)}px;letter-spacing:1.2px">${city}</text></svg>`;
  if (c.stamp.shape === 'oval') return `<svg viewBox="0 0 230 176" xmlns="http://www.w3.org/2000/svg">
    <ellipse class="ln" cx="115" cy="88" rx="110" ry="83" stroke-width="3"/><ellipse class="ln" cx="115" cy="88" rx="103" ry="76" stroke-width="1"/>
    <defs><path id="${id}a" d="M28 88A87 62 0 0 1 202 88"/><path id="${id}b" d="M20 88A95 70 0 0 0 210 88"/></defs>
    <text style="font-size:${fit(c.short, 12, 210)}px;letter-spacing:2.4px"><textPath href="#${id}a" startOffset="50%">${c.short}</textPath></text>
    <text style="font-size:${fit(city, 9, 230)}px;letter-spacing:2.4px"><textPath href="#${id}b" startOffset="50%">${city}</textPath></text>
    ${emblem(c, 115, 80, 92, 66)}<text x="115" y="132" class="dt" style="font-size:13px;letter-spacing:1px">${date}</text></svg>`;
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle class="ln" cx="100" cy="100" r="96" stroke-width="3"/><circle class="ln" cx="100" cy="100" r="90" stroke-width="1"/><circle class="ln" cx="100" cy="100" r="66" stroke-width="1.6"/>
    <defs><path id="${id}a" d="M26 100a74 74 0 0 1 148 0"/><path id="${id}b" d="M17 100a83 83 0 0 0 166 0"/></defs>
    <text style="font-size:${fit(c.short, 12, 205)}px;letter-spacing:2.2px"><textPath href="#${id}a" startOffset="50%">${c.short}</textPath></text>
    <text class="dt" style="font-size:12px;letter-spacing:2.4px"><textPath href="#${id}b" startOffset="50%">${date}</textPath></text>
    ${emblem(c, 100, 95, 84, 76)}<text x="100" y="149" style="font-size:${fit(city, 7.5, 150)}px;letter-spacing:1.2px">${city}</text>
    <circle cx="11" cy="100" r="2.4" fill="currentColor"/><circle cx="189" cy="100" r="2.4" fill="currentColor"/></svg>`;
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** '2026-11-20' → '20 NOV 2026' */
export const stampDate = (d) => { const [y, m, dd] = String(d || '').split('-').map(Number); return m ? `${String(dd).padStart(2, '0')} ${MON[m - 1]} ${y}` : ''; };

/** Passport pages from a person's cards (js/locker.js buildLocker output, oldest first; each card needs
 *  `courseObj` = the round's event.course, a one-line addition to buildLocker).
 *  courses: one per course, dated by the first finished round there; visits; best gross.
 *  milestones: once-ever card stamps (First birdie, Broke 100/90/80, the first Eagle) plus every
 *  "Lowest round yet" (your personal-best history). "Best at <course>" is not a milestone: the
 *  course stamp already shows your best there. */
export function passportOf(cards) {
  const courses = new Map(), miles = [], once = new Set();
  for (const c of cards || []) {
    const key = c.courseKey || c.course;
    const k = courses.get(key) || { key, course: c.course, courseObj: c.courseObj, first: c.day, visits: 0, best: Infinity, firstCardKey: c.key };
    k.visits += 1; k.best = Math.min(k.best, c.gross); courses.set(key, k);
    for (const s of c.stamps || []) {
      if (s.startsWith('Best at ')) continue;
      if (s === 'Lowest round yet') { miles.push({ label: `Lowest round · ${c.gross}`, kind: 'lowest', day: c.day, course: c.course, gross: c.gross, cardKey: c.key }); continue; }
      if (once.has(s)) continue; once.add(s);
      const m = { label: s, kind: s.toLowerCase().replace(/\s+/g, '-'), day: c.day, course: c.course, gross: c.gross, cardKey: c.key };
      // 036 app: the hole of a first birdie / eagle ("31 OCT 2026 · TWIN CREEKS · HOLE 6")
      if ((s === 'First birdie' || s === 'Eagle') && c.strokes && c.par) {
        const h = c.strokes.findIndex((x, i) => x - c.par[i] <= (s === 'Eagle' ? -2 : -1));
        if (h >= 0) m.hole = h + 1;
      }
      miles.push(m);
    }
  }
  return { courses: [...courses.values()], milestones: miles };
}
/** Milestones shown as dashed outlines until earned. */
export const MILESTONE_GOALS = ['First birdie', 'Broke 100', 'Broke 90', 'Broke 80', 'Eagle'];
/** The goals still open for this person: MILESTONE_GOALS minus the earned ones, and minus "Broke N" once any round
 *  was already under N (Andrew's first round was 97, so Broke 100 can never fire for him). */
export function goalsOf(pp, cards) {
  const earned = new Set((pp?.milestones || []).map((m) => m.label));
  const best = Math.min(...(cards || []).map((c) => c.gross), Infinity);
  return MILESTONE_GOALS.filter((g) => !earned.has(g) && !(/^Broke (\d+)$/.test(g) && best < Number(g.slice(6))));
}
