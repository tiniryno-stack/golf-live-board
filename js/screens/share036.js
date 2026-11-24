// share036.js — 036 share images (SPEC §3.3, §8), drawn on a canvas like recap.js so they look the same on every
// phone and stay exportable (the stamp emblems are same-origin PNGs, inlined as data URLs before drawing).
//   shareCard(card, cards)  → framed: name + date, the card, the stamps it earned, "Golf Live Board · Scorecard No. 5"
//   sharePassport(cards)    → the holder page and the courses page side by side
// Loaded on demand (import()) from the Locker and the pack overlay.

import { loadFonts, saveImage } from './recap.js';
import { passportOf, stampFor, courseStampSvg, stampDate } from '../stamps.js';
import { longDay, toParLabel, finName, openedOf, FINISHES } from '../locker.js';

const SANS = 'Geist, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';
const BG = '#0a0b0d', INK = '#f4f5f7', SOFT = '#a7acb4', LINE = '#2b2f36', PAGE = '#15171b', GREEN = '#3DDC84';
const INKS = { blue: '#8fa8ff', red: '#ff8a80', green: '#6fd3a6', violet: '#c3a6ff', amber: '#f6c56a', teal: '#6fd0e0' };
const MILE = { 'first-birdie': INKS.green, lowest: INKS.blue, eagle: INKS.amber };
/** The finishes at rest (the prismatic hue as it sits mid-sway). [body a, body b, ink, inv] */
const FIN = {
  prismatic: ['#1a1b24', '#33344a', 'hsl(282 95% 82%)', '#1a1b24'], gold: ['#4a3806', '#b0871a', '#fff0b4', '#4a3806'],
  silver: ['#2a3546', '#687a92', '#f5f9ff', '#2a3546'], bronze: ['#3a200f', '#804923', '#ffc79a', '#3a200f'],
  standard: ['#141518', '#26282d', '#b4b9c1', '#141518'], rookie: ['#edefea', '#e1e4de', '#14171b', '#edefea'],
};

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function txt(ctx, s, x, y, size, { weight = 600, color = INK, align = 'left', mono = false, spacing = 0, max = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  let t = String(s ?? '');
  if (max) while (t.length > 1 && ctx.measureText(t).width > max) t = t.slice(0, -1);
  ctx.fillText(t, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return ctx.measureText(t).width;
}
function mark(ctx, x, y, s, color = INK) {
  ctx.save();
  ctx.lineWidth = s * 0.15;
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(x, y, s * 0.36, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.beginPath(); ctx.arc(x + s * 0.4, y - s * 0.38, s * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
const alpha = (c, a) => (c.startsWith('#') ? `${c}${Math.round(a * 255).toString(16).padStart(2, '0')}` : c.replace(')', ` / ${a})`));

/** The landscape card (§2.1), w wide, at x, y. */
function drawCard(ctx, c, x, y, w) {
  const h = (w * 5) / 7, u = w / 100; // 1 u = 1cqw
  const [a, b, ink, inv] = FIN[c.fin] || FIN.standard;
  const soft = alpha(ink, 0.64), rule = alpha(ink, 0.24);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 5 * u; ctx.shadowOffsetY = 3 * u;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a);
  rrect(ctx, x, y, w, h, 4 * u); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(ctx, x, y, w, h, 4 * u); ctx.clip();
  if (c.fin === 'prismatic') { // a still frame of the oil slick
    const s = ctx.createLinearGradient(x, y, x + w, y + h * 0.4);
    ['hsl(320 90% 60% / .28)', 'hsl(40 95% 60% / .2)', 'hsl(160 80% 55% / .22)', 'hsl(200 95% 60% / .28)', 'hsl(270 90% 65% / .24)'].forEach((col, i) => s.addColorStop(i / 4, col));
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = s; ctx.fillRect(x, y, w, h); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.strokeStyle = alpha(ink, 0.3); ctx.lineWidth = 0.4 * u; rrect(ctx, x + 0.2 * u, y + 0.2 * u, w - 0.4 * u, h - 0.4 * u, 4 * u); ctx.stroke();
  const L = x + 4.6 * u, R = x + w - 4.6 * u;
  mark(ctx, L + 1.9 * u, y + 5.8 * u, 3.8 * u, soft);
  txt(ctx, 'GOLF LIVE BOARD', L + 5.2 * u, y + 6.6 * u, 2.4 * u, { mono: true, color: soft, spacing: 0.24 * u });
  if (c.fin !== 'standard') txt(ctx, finName(c).toUpperCase(), R, y + 6.6 * u, 2.4 * u, { mono: true, weight: 700, color: ink, align: 'right', spacing: 0.24 * u });
  const gy = y + 31 * u;
  const gw = txt(ctx, String(c.gross), L - u, gy, 25 * u, { mono: true, weight: 700, color: ink, spacing: -1.8 * u });
  const mx = L - u + gw + 4 * u;
  txt(ctx, c.course, mx, y + 17 * u, 4.8 * u, { weight: 700, color: ink, max: R - mx });
  txt(ctx, `${toParLabel(c.toPar)} · ${longDay(c.day)}`, mx, y + 22.5 * u, 2.8 * u, { mono: true, color: soft, spacing: 0.16 * u });
  let px = mx;
  for (const st of c.stamps.slice(0, 2)) {
    ctx.font = `700 ${2.2 * u}px ${MONO}`;
    const tw = ctx.measureText(st.toUpperCase()).width + st.length * 0.18 * u + 3.2 * u;
    ctx.strokeStyle = ink; ctx.lineWidth = 0.3 * u; rrect(ctx, px, y + 25.4 * u, tw, 4.6 * u, 2.3 * u); ctx.stroke();
    txt(ctx, st.toUpperCase(), px + 1.6 * u, y + 28.5 * u, 2.2 * u, { mono: true, weight: 700, color: ink, spacing: 0.18 * u });
    px += tw + 1.2 * u;
  }
  // the scorecard: two nines, marks as on the card
  ctx.fillStyle = rule; ctx.fillRect(L, y + 36 * u, R - L, 0.25 * u);
  const colW = (R - L - 9 * u) / 9;
  [0, 9].forEach((from, r) => {
    const top = y + 40.5 * u + r * 12.2 * u;
    for (let i = 0; i < 10; i++) {
      const cx = i < 9 ? L + colW * (i + 0.5) : R - 4.5 * u;
      txt(ctx, i < 9 ? from + i + 1 : from ? 'IN' : 'OUT', cx, top, 1.9 * u, { mono: true, color: soft, align: 'center' });
      if (i === 9) { txt(ctx, String(c.strokes.slice(from, from + 9).reduce((p, q) => p + q, 0)), cx, top + 6.6 * u, 4.2 * u, { mono: true, weight: 700, color: ink, align: 'center' }); continue; }
      const s = c.strokes[from + i], d = s - c.par[from + i], cy = top + 5.2 * u, m = 2.8 * u;
      ctx.lineWidth = 0.35 * u; ctx.strokeStyle = ink;
      if (d <= -1) { ctx.beginPath(); ctx.arc(cx, cy, m, 0, Math.PI * 2); ctx.stroke(); if (d <= -2) { ctx.beginPath(); ctx.arc(cx, cy, m - 0.7 * u, 0, Math.PI * 2); ctx.stroke(); } }
      if (d === 1) { ctx.strokeStyle = soft; ctx.lineWidth = 0.3 * u; rrect(ctx, cx - m, cy - m, 2 * m, 2 * m, 0.8 * u); ctx.stroke(); }
      if (d >= 2) { ctx.fillStyle = ink; rrect(ctx, cx - m, cy - m, 2 * m, 2 * m, 0.8 * u); ctx.fill(); }
      txt(ctx, String(s), cx, cy + 1.25 * u, 3.5 * u, { mono: true, weight: 700, color: d >= 2 ? inv : ink, align: 'center' });
    }
  });
  txt(ctx, c.name.toUpperCase(), L, y + h - 4.4 * u, 3.4 * u, { mono: true, weight: 700, color: ink, spacing: 0.36 * u });
  txt(ctx, c.crew ? 'WITH THE CREW' : 'SOLO', x + w / 2, y + h - 4.4 * u, 2.4 * u, { mono: true, color: soft, align: 'center', spacing: 0.24 * u });
  txt(ctx, `NO. ${c.n}`, R, y + h - 4.4 * u, 2.4 * u, { mono: true, color: soft, align: 'right', spacing: 0.24 * u });
  ctx.restore();
  return h;
}

/** A milestone rubber stamp (§6.3) centred at cx, cy. */
function drawRubber(ctx, m, cx, cy, size) {
  const ink = MILE[m.kind] || (/^broke-/.test(m.kind) ? INKS.red : INKS.violet);
  const line = [stampDate(m.day), m.course, m.hole ? `hole ${m.hole}` : m.kind === 'lowest' ? '' : m.gross].filter(Boolean).join(' · ').toUpperCase();
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate((((m.label.length * 7) % 11) - 5) * Math.PI / 180);
  ctx.font = `700 ${size}px ${MONO}`;
  const w1 = ctx.measureText(m.label.toUpperCase()).width + m.label.length * size * 0.13;
  ctx.font = `600 ${size * 0.5}px ${MONO}`;
  const w = Math.max(w1, ctx.measureText(line).width + line.length * size * 0.06) + size * 1.6, h = size * 2.5;
  const r = m.kind === 'first-birdie' ? h / 2 : size * 0.35;
  ctx.strokeStyle = ink; ctx.lineWidth = size * 0.14; rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.stroke();
  ctx.lineWidth = size * 0.05; rrect(ctx, -w / 2 - size * 0.3, -h / 2 - size * 0.3, w + size * 0.6, h + size * 0.6, r + size * 0.3); ctx.stroke();
  txt(ctx, m.label.toUpperCase(), 0, size * 0.1, size, { mono: true, weight: 700, color: ink, align: 'center', spacing: size * 0.13 });
  txt(ctx, line, 0, size * 0.85, size * 0.5, { mono: true, color: ink, align: 'center', spacing: size * 0.06 });
  ctx.restore();
  return w;
}

/** A course stamp (§7) as an image: the SVG with its emblem inlined, the rough filter and the inks resolved. */
const dataUrls = new Map();
async function inline(src) {
  if (!src) return null;
  if (!dataUrls.has(src)) {
    dataUrls.set(src, fetch(src).then((r) => r.blob()).then((b) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); })).catch(() => null));
  }
  return dataUrls.get(src);
}
async function stampImage(entry) {
  const st = stampFor(entry.courseObj || { name: entry.course });
  const em = await inline(st.emblem);
  let svg = courseStampSvg(em ? { ...st, emblem: em } : { ...st, emblem: null }, stampDate(entry.first));
  const ink = INKS[st.stamp.ink] || INKS.blue;
  const style = `<style>text{fill:${ink};font-family:${MONO.replace(/"/g, "'")};font-weight:700;text-anchor:middle;text-transform:uppercase}.dt{fill:${INKS.red}}.mono{font-family:Georgia,serif;text-transform:none}.ln{fill:none;stroke:${ink};stroke-linejoin:round}</style>`
    + '<filter id="r" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3 2.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
  svg = svg.replace(/currentColor/g, ink).replace(/(<svg [^>]*>)/, `$1${style}<g filter="url(#r)">`).replace(/<\/svg>\s*$/, '</g></svg>');
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  svg = svg.replace('<svg ', `<svg width="${vb[1] * 3}" height="${vb[2] * 3}" `);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode().catch(() => {});
  return { img, ratio: vb[1] / vb[2], rot: ((entry.key || '').length % 9) - 4 };
}
function drawImg(ctx, s, cx, cy, w) {
  if (!s?.img?.naturalWidth) return;
  const h = w / s.ratio;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.rot * Math.PI / 180); ctx.drawImage(s.img, -w / 2, -h / 2, w, h); ctx.restore();
}

function footer(ctx, W, y, right) {
  mark(ctx, 64 + 14, y - 12, 34, SOFT);
  txt(ctx, 'GOLF LIVE BOARD', 64 + 44, y, 26, { mono: true, weight: 700, color: SOFT, spacing: 3 });
  txt(ctx, right.toUpperCase(), W - 64, y, 26, { mono: true, weight: 600, color: SOFT, align: 'right', spacing: 3 });
}

/** §3.3 Share: the card and what it earned, framed. */
export async function shareCard(card, cards) {
  await loadFonts();
  const pp = passportOf(cards.filter((c) => c.opened || c.key === card.key));
  const miles = pp.milestones.filter((m) => m.cardKey === card.key);
  const course = pp.courses.find((c) => c.firstCardKey === card.key);
  const W = 1080, cw = W - 128, chh = (cw * 5) / 7;
  const stampsH = miles.length || course ? 330 : 0;
  const H = 64 + 70 + 40 + chh + stampsH + 150;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE; ctx.lineWidth = 3; rrect(ctx, 24, 24, W - 48, H - 48, 36); ctx.stroke();
  txt(ctx, card.fullName || card.name, 64, 126, 52, { weight: 700, max: 620 });
  txt(ctx, longDay(card.day), W - 64, 126, 30, { mono: true, color: SOFT, align: 'right' });
  drawCard(ctx, card, 64, 174, cw);
  let y = 174 + chh + 40;
  if (stampsH) {
    const items = [...miles.map((m) => ({ m })), ...(course ? [{ c: course }] : [])];
    const slot = (W - 128) / items.length;
    for (let i = 0; i < items.length; i++) {
      const cx = 64 + slot * (i + 0.5), cy = y + stampsH / 2 - 20;
      if (items[i].m) {
        const m = items[i].m, chars = Math.max(m.label.length, (stampDate(m.day).length + m.course.length + 10) * 0.55);
        drawRubber(ctx, m, cx, cy, Math.min(40, (slot - 70) / (chars * 0.78 + 1.8)));
      }
      else drawImg(ctx, await stampImage(items[i].c), cx, cy, Math.min(300, slot - 30));
    }
    y += stampsH;
  }
  footer(ctx, W, H - 76, `Scorecard No. ${card.n}`);
  return saveImage(cv, `scorecard-${card.n}`);
}

/** §8 Passport share: the holder page and the courses page side by side. */
export async function sharePassport(cards) {
  await loadFonts();
  const shown = cards.filter((c) => c.opened), opened = openedOf(cards);
  const pp = passportOf(shown);
  const last = cards[cards.length - 1] || {};
  const full = last.fullName || last.name || '';
  const W = 1080, pw = 468, ph = 680, top = 64, H = top + ph + 150;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const page = (x, kicker, right) => {
    rrect(ctx, x, top, pw, ph, 22); ctx.fillStyle = PAGE; ctx.fill();
    txt(ctx, kicker, x + 28, top + 52, 20, { mono: true, color: SOFT, spacing: 3 });
    txt(ctx, right, x + pw - 28, top + 52, 20, { mono: true, color: SOFT, align: 'right', spacing: 3 });
    ctx.fillStyle = LINE; ctx.fillRect(x + 28, top + 66, pw - 56, 2);
  };
  // holder
  const hx = 64;
  page(hx, 'HOLDER', 'GOLF LIVE BOARD');
  ctx.strokeStyle = 'rgba(244,245,247,.36)'; ctx.lineWidth = 3; rrect(ctx, hx + 28, top + 92, 140, 172, 14); ctx.stroke();
  mark(ctx, hx + 98, top + 160, 64, INK);
  txt(ctx, full.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(), hx + 98, top + 236, 34, { mono: true, weight: 700, align: 'center', spacing: 3 });
  const best = [...shown].sort((a, b) => a.gross - b.gross)[0];
  const field = (k, v, x, y) => { txt(ctx, k, x, y, 16, { mono: true, color: SOFT, spacing: 2 }); txt(ctx, v, x, y + 34, 28, { weight: 600, max: pw - (x - hx) - 28 }); };
  field('NAME', full, hx + 196, top + 112);
  field('SINCE', longDay(cards[0]?.day), hx + 196, top + 180);
  field('BEST ROUND', best ? `${best.gross} · ${best.course}` : '—', hx + 196, top + 248);
  field('ROUNDS', String(shown.length), hx + 28, top + 330);
  field('COURSES', String(pp.courses.length), hx + 248, top + 330);
  txt(ctx, 'CARDS IN THE LOCKER', hx + 28, top + 430, 16, { mono: true, color: SOFT, spacing: 2 });
  const fins = ['prismatic', 'gold', 'silver', 'bronze', 'standard'], tw = (pw - 56 - 4 * 10) / 5;
  fins.forEach((f, i) => {
    const x = hx + 28 + i * (tw + 10), ink = FIN[f][2];
    ctx.strokeStyle = ink; ctx.lineWidth = 3; rrect(ctx, x, top + 448, tw, 92, 14); ctx.stroke();
    txt(ctx, String(opened.filter((c) => c.fin === f).length), x + tw / 2, top + 492, 34, { mono: true, weight: 700, color: ink, align: 'center' });
    txt(ctx, ({ prismatic: 'PRISM', standard: 'STD' }[f] || FINISHES[f].name.toUpperCase()), x + tw / 2, top + 524, 15, { mono: true, color: ink, align: 'center', spacing: 1 });
  });
  // courses
  const cx0 = W - 64 - pw;
  page(cx0, 'COURSES', `${pp.courses.length} PLAYED`);
  const list = pp.courses.slice(0, 4);
  for (let i = 0; i < list.length; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = cx0 + pw / 4 + col * (pw / 2), y = top + 220 + row * 280;
    const s = await stampImage(list[i]);
    drawImg(ctx, s, x, y, s.ratio > 1.2 ? 192 : 184);
    txt(ctx, `${list[i].visits} VISIT${list[i].visits === 1 ? '' : 'S'} · BEST ${list[i].best}`, x, y + 132, 17, { mono: true, color: SOFT, align: 'center', spacing: 1.5 });
  }
  footer(ctx, W, H - 60, 'Passport');
  return saveImage(cv, 'passport');
}

export { drawCard };
