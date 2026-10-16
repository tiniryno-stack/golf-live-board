// recap.js — end-of-round keepsakes drawn straight onto a canvas (no libraries, so they
// look the same on every phone): the final leaderboard, your scorecard, your cart, and
// a full report of everyone. Each comes back as { key, title, canvas }.
//
// Always the dark Sundown look, so a saved image reads the same in anyone's camera roll.
// Jerseys follow the app: your cart green, everyone else their away color.

import { fmtPts, fmtSigned, fmtToPar, HOLES } from '../scoring.js';
import { prettyDate } from '../ui.js';

const W = 1080;
const PAD = 64;
const C = {
  bg: '#0B0C0E', card: '#16181C', card2: '#20232A', line: 'rgba(255,255,255,.10)',
  ink: '#ECEEF1', soft: 'rgba(236,238,241,.62)', faint: 'rgba(236,238,241,.36)',
  sun: '#F4C95D', good: '#34C281', bad: '#F0564B',
  A: '#F2994A', B: '#4C9AFF', C: '#F06AB0', D: '#A78BFA',
};
const SANS = 'Geist, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace';

/** Make sure the web fonts are ready before drawing (canvas won't wait for them). */
export async function loadFonts() {
  if (!document.fonts?.load) return;
  const want = ['500 30px Geist', '600 30px Geist', '700 30px Geist', '800 30px Geist', '500 30px "Geist Mono"', '700 30px "Geist Mono"'];
  try {
    await Promise.race([Promise.all(want.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))]);
  } catch { /* draw with fallbacks */ }
}

// ───────────────────────────────────────────── drawing helpers

function canvasOf(h) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = Math.ceil(h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, cv.height);
  return { cv, ctx };
}

function fitText(ctx, s, max) {
  s = String(s ?? '');
  if (!max || ctx.measureText(s).width <= max) return s;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function text(ctx, s, x, y, { size = 30, weight = 600, color = C.ink, align = 'left', mono = false, max = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const t = fitText(ctx, s, max);
  ctx.fillText(t, x, y);
  return ctx.measureText(t).width;
}

function rrect(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function fillRect(ctx, x, y, w, h, r, color) {
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** A score with the app's marks: circle under par (two for eagle), square bogey, double square double+. */
function scoreMark(ctx, g, par, cx, cy, size) {
  if (g == null) {
    text(ctx, '·', cx, cy + size * 0.35, { size, weight: 500, color: C.faint, align: 'center', mono: true });
    return;
  }
  const d = g - par;
  const color = d < 0 ? C.good : d >= 2 ? C.bad : C.ink;
  text(ctx, String(g), cx, cy + size * 0.36, { size, weight: 700, color, align: 'center', mono: true });
  const r = size * 0.72;
  ctx.lineWidth = Math.max(1.5, size / 16);
  if (d < 0) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (d <= -2) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + size * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (d >= 1) {
    ctx.strokeStyle = d === 1 ? C.soft : color;
    rrect(ctx, cx - r, cy - r, r * 2, r * 2, size * 0.1);
    ctx.stroke();
    if (d >= 2) {
      const o = size * 0.18;
      rrect(ctx, cx - r - o, cy - r - o, (r + o) * 2, (r + o) * 2, size * 0.14);
      ctx.stroke();
    }
  }
}

/** Draw on a tall canvas, then trim to the content (y) and add the footer: no dead space at the bottom. */
function finish(cv, y, app) {
  const h = Math.ceil(y + 150);
  const { cv: out, ctx } = canvasOf(h);
  ctx.drawImage(cv, 0, 0, W, Math.min(h, cv.height), 0, 0, W, Math.min(h, cv.height));
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, h - 120, W, 120);
  footer(ctx, h, app);
  return out;
}

function header(ctx, kicker, title, titleColor = C.ink) {
  text(ctx, kicker.toUpperCase(), PAD, 104, { size: 24, weight: 700, color: C.soft, max: W - PAD * 2 });
  text(ctx, title, PAD, 178, { size: 64, weight: 800, color: titleColor, max: W - PAD * 2 });
}

function footer(ctx, h, app) {
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, h - 92, W - PAD * 2, 2);
  text(ctx, 'Golf Live Board', PAD, h - 44, { size: 24, weight: 700, color: C.faint });
  text(ctx, app.code || '', W - PAD, h - 44, { size: 24, weight: 700, color: C.faint, align: 'right', mono: true });
}

function ctxInfo(app) {
  const snap = app.snapshot;
  const ev = app.event;
  const course = ev.course?.shortName || ev.course?.name || '';
  const date = prettyDate(ev.played_on);
  const tee = ev.course?.tee?.name ? `${ev.course.tee.name} tees` : '';
  const mine = app.myTeam();
  const jersey = (t) => (t && t === mine ? C.good : C[t] || C.soft);
  const tname = (t) => snap.teamById.get(t)?.name || t;
  const pnames = (t) => (snap.teamById.get(t)?.playerIds || []).map((id) => snap.playerById.get(id)?.name).join(' + ');
  return { snap, ev, course, date, tee, mine, jersey, tname, pnames };
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

// ───────────────────────────────────────────── 1. final leaderboard

function leaderboard(app) {
  const I = ctxInfo(app);
  const { snap } = I;
  const g = snap.game;
  if (!g) return playersBoard(app);
  const isPM = g.type === 'rotationPlusMinus';
  const st = g.standings;
  const val = (s) => (isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints));
  const rowsH = st.length * 124;
  const matchesH = 70 + g.matches.length * 50;
  const H = 230 + 200 + 40 + rowsH + 40 + matchesH + 120;
  const { cv, ctx } = canvasOf(H);
  header(ctx, `Final · ${[I.course, I.date].filter(Boolean).join(' · ')}`, I.ev.name || 'Round');

  // Winner
  let y = 228;
  const top = st.filter((s) => s.rank === 1);
  fillRect(ctx, PAD, y, W - PAD * 2, 190, 28, C.card);
  ctx.fillStyle = C.sun;
  rrect(ctx, PAD, y, 10, 190, 5);
  ctx.fill();
  text(ctx, top.length > 1 ? 'SHARE THE DAY' : 'WIN THE DAY', PAD + 40, y + 52, { size: 24, weight: 800, color: C.sun });
  const winName = top.map((s) => I.tname(s.teamId)).join(' & ');
  text(ctx, winName, PAD + 40, y + 122, { size: 64, weight: 800, color: top.length === 1 ? I.jersey(top[0].teamId) : C.ink, max: W - PAD * 2 - 320 });
  text(ctx, top.length === 1 ? I.pnames(top[0].teamId) : '', PAD + 40, y + 164, { size: 28, weight: 500, color: C.soft, max: W - PAD * 2 - 320 });
  text(ctx, val(top[0]), W - PAD - 36, y + 128, { size: 96, weight: 700, color: C.sun, align: 'right', mono: true });
  text(ctx, isPM ? 'margin' : 'points', W - PAD - 36, y + 164, { size: 24, weight: 600, color: C.soft, align: 'right' });

  // Standings with bars
  y += 190 + 40;
  const scale = Math.max(1, ...st.map((s) => Math.abs(isPM ? s.officialPm : s.officialPoints)));
  for (const s of st) {
    const col = I.jersey(s.teamId);
    text(ctx, s.shared ? `T${s.rank}` : String(s.rank), PAD + 8, y + 58, { size: 32, weight: 700, color: C.faint, mono: true });
    fillRect(ctx, PAD + 64, y + 14, 8, 84, 4, col);
    text(ctx, I.tname(s.teamId), PAD + 96, y + 50, { size: 40, weight: 750, color: C.ink, max: 560 });
    const r = s.record;
    text(ctx, `${I.pnames(s.teamId)} · ${r.w}-${r.l}-${r.h}`, PAD + 96, y + 88, { size: 26, weight: 500, color: C.soft, max: 560 });
    const v = isPM ? s.officialPm : s.officialPoints;
    fillRect(ctx, PAD + 96, y + 104, 600, 10, 5, C.card2);
    if (v) fillRect(ctx, PAD + 96, y + 104, Math.max(10, (Math.abs(v) / scale) * 600), 10, 5, col);
    text(ctx, val(s), W - PAD, y + 72, { size: 56, weight: 700, color: col, align: 'right', mono: true });
    y += 124;
  }

  // Matchups
  y += 40;
  text(ctx, 'MATCHUPS', PAD, y + 24, { size: 24, weight: 800, color: C.soft });
  y += 70;
  for (const m of g.matches) {
    const [a, b] = m.teams;
    const res = m.result;
    text(ctx, m.label.replace('Holes ', ''), PAD, y, { size: 26, weight: 700, color: C.faint, mono: true });
    const score = isPM ? `${fmtSigned(m.margin[a], 'E')}` : `${fmtPts(m.points[a])}–${fmtPts(m.points[b])}`;
    let x = PAD + 150;
    x += text(ctx, I.tname(a), x, y, { size: 28, weight: res === a ? 800 : 500, color: res === a ? I.jersey(a) : C.ink, max: 300 }) + 16;
    x += text(ctx, score, x, y, { size: 28, weight: 700, color: C.ink, mono: true }) + 16;
    text(ctx, I.tname(b), x, y, { size: 28, weight: res === b ? 800 : 500, color: res === b ? I.jersey(b) : C.ink, max: W - PAD - 90 - x });
    const bonus = res && res !== 'halved' ? m.bonus?.[res] : res === 'halved' ? m.bonus?.[a] : 0;
    if (bonus) text(ctx, `+${fmtPts(bonus)}${res === 'halved' ? ' ea' : ''}`, W - PAD, y, { size: 26, weight: 800, color: C.sun, align: 'right', mono: true });
    y += 50;
  }
  return finish(cv, y, app);
}

/** No cart game: a player leaderboard (gross, or net when anyone gets strokes). */
function playersBoard(app) {
  const I = ctxInfo(app);
  const { snap } = I;
  const net = snap.hasStrokes;
  const list = [...snap.players].sort((a, b) => (net ? a.netToPar - b.netToPar : a.grossToPar - b.grossToPar) || a.name.localeCompare(b.name));
  const H = 260 + list.length * 96 + 140;
  const { cv, ctx } = canvasOf(H);
  header(ctx, `Final · ${[I.course, I.date].filter(Boolean).join(' · ')}`, I.ev.name || 'Round');
  let y = 250;
  list.forEach((p, i) => {
    text(ctx, String(i + 1), PAD + 8, y + 52, { size: 32, weight: 700, color: C.faint, mono: true });
    text(ctx, p.name, PAD + 80, y + 52, { size: 40, weight: 700, color: i === 0 ? C.sun : C.ink, max: 600 });
    text(ctx, `${p.grossTotal || '–'}`, W - PAD - 190, y + 52, { size: 40, weight: 700, color: C.soft, align: 'right', mono: true });
    text(ctx, fmtToPar(net ? p.netToPar : p.grossToPar), W - PAD, y + 52, { size: 44, weight: 700, color: C.ink, align: 'right', mono: true });
    y += 96;
  });
  return finish(cv, y, app);
}

// ───────────────────────────────────────────── 2. your scorecard

function nineTable(ctx, snap, rows, from, x, y, { cellW = 78, labelW = 150, totW = 100, sizes = {} } = {}) {
  // rows: [{ label, kind: 'hole'|'par'|'score'|'text', values: [...9], total, color, par: [...] }]
  const holes = snap.holes.slice(from, from + 9);
  let yy = y;
  for (const r of rows) {
    const h = r.h || (r.kind === 'score' ? 78 : 52);
    if (r.kind === 'score') fillRect(ctx, x - 12, yy, labelW + cellW * 9 + totW + 24, h, 18, C.card);
    text(ctx, r.label, x, yy + h / 2 + 10, { size: r.kind === 'score' ? 28 : 24, weight: r.kind === 'score' ? 700 : 600, color: r.color || (r.kind === 'score' ? C.ink : C.soft), max: labelW - 12 });
    holes.forEach((hh, i) => {
      const cx = x + labelW + cellW * i + cellW / 2;
      const v = r.values[i];
      if (r.kind === 'score') scoreMark(ctx, v, hh.par, cx, yy + h / 2, sizes.score || 32);
      else text(ctx, v == null ? '·' : String(v), cx, yy + h / 2 + 9, { size: r.kind === 'hole' ? 26 : 24, weight: r.kind === 'hole' ? 700 : 500, color: r.kind === 'hole' ? C.ink : C.soft, align: 'center', mono: true });
    });
    if (r.total != null) {
      text(ctx, String(r.total), x + labelW + cellW * 9 + totW / 2, yy + h / 2 + 10, { size: r.kind === 'score' ? 32 : 24, weight: 700, color: r.kind === 'score' ? C.ink : C.soft, align: 'center', mono: true });
    }
    yy += h;
  }
  return yy;
}

function scorecard(app) {
  const I = ctxInfo(app);
  const { snap } = I;
  const p = app.myPlayer();
  const net = p.strokes > 0; // net only matters if you get strokes
  const H = 1600;
  const { cv, ctx } = canvasOf(H);
  header(ctx, `Scorecard · ${[I.course, I.tee, I.date].filter(Boolean).join(' · ')}`, p.name);
  if (p.teamId) {
    const partner = (snap.teamById.get(p.teamId)?.playerIds || []).filter((id) => id !== p.id).map((id) => snap.playerById.get(id)?.name).join(' + ');
    let x = PAD;
    x += text(ctx, I.tname(p.teamId), x, 226, { size: 30, weight: 700, color: I.jersey(p.teamId) }) + 12;
    if (partner) text(ctx, `with ${partner}`, x, 226, { size: 30, weight: 500, color: C.soft });
  }

  // Big numbers
  const stats = [
    [String(p.grossTotal || '–'), 'Gross'],
    [fmtToPar(p.grossToPar), 'To par'],
    ...(net ? [[String(p.netTotal || '–'), 'Net'], [fmtToPar(p.netToPar), 'Net to par']] : []),
  ];
  const bw = (W - PAD * 2 - (stats.length - 1) * 16) / stats.length;
  stats.forEach(([v, l], i) => {
    const x = PAD + i * (bw + 16);
    fillRect(ctx, x, 262, bw, 150, 24, C.card);
    text(ctx, v, x + bw / 2, 352, { size: 72, weight: 700, color: i === 0 ? C.sun : C.ink, align: 'center', mono: true });
    text(ctx, l.toUpperCase(), x + bw / 2, 392, { size: 22, weight: 700, color: C.soft, align: 'center' });
  });

  // Front / back
  let y = 450;
  for (const [from, label, sum] of [[0, 'Out', p.grossFront], [9, 'In', p.grossBack]]) {
    const holes = snap.holes.slice(from, from + 9);
    const rows = [
      { label: 'Hole', kind: 'hole', values: holes.map((h) => h.n), total: label },
      { label: 'Par', kind: 'par', values: holes.map((h) => h.par), total: holes.reduce((a, h) => a + h.par, 0) },
      { label: 'Score', kind: 'score', values: p.gross.slice(from, from + 9), total: sum || '–' },
    ];
    if (net) rows.push({ label: 'Net', kind: 'par', values: p.net.slice(from, from + 9), total: (from ? p.netBack : p.netFront) || '–' });
    y = nineTable(ctx, snap, rows, from, PAD + 12, y) + 34;
  }

  // How the day went
  const counts = { Eagle: 0, Birdie: 0, Par: 0, Bogey: 0, 'Double+': 0 };
  p.gross.forEach((g, i) => {
    if (g == null) return;
    const d = g - snap.holes[i].par;
    counts[d <= -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : 'Double+']++;
  });
  const keys = Object.keys(counts).filter((k) => k !== 'Eagle' || counts.Eagle);
  const cw = (W - PAD * 2 - (keys.length - 1) * 14) / keys.length;
  keys.forEach((k, i) => {
    const x = PAD + i * (cw + 14);
    fillRect(ctx, x, y, cw, 130, 22, C.card);
    const col = k === 'Birdie' || k === 'Eagle' ? C.good : k === 'Double+' ? C.bad : C.ink;
    text(ctx, String(counts[k]), x + cw / 2, y + 74, { size: 56, weight: 700, color: col, align: 'center', mono: true });
    const label = { Eagle: 'Eagles', Birdie: 'Birdies', Par: 'Pars', Bogey: 'Bogeys', 'Double+': 'Double+' }[k];
    text(ctx, label.toUpperCase(), x + cw / 2, y + 110, { size: 20, weight: 700, color: C.soft, align: 'center' });
  });
  return finish(cv, y + 130, app);
}

// ───────────────────────────────────────────── 3. your cart

function cartCard(app) {
  const I = ctxInfo(app);
  const { snap } = I;
  const g = snap.game;
  const tid = app.myTeam();
  const team = snap.teamById.get(tid);
  const players = team.playerIds.map((id) => snap.playerById.get(id));
  const both = snap.settings.teamScore === 'bestBallAggregate';
  const compNames = both ? ['Low Ball', 'Low Total'] : [snap.settings.teamScore === 'aggregate' ? 'Total' : 'Best ball'];
  const matches = g ? g.matches.filter((m) => m.teams.includes(tid)) : [];
  const perNine = 52 * 2 + 78 * players.length + 56 * compNames.length;
  const H = 300 + (perNine + 34) * 2 + 70 + matches.length * 56 + 140;
  const { cv, ctx } = canvasOf(H);
  header(ctx, `Cart · ${[I.course, I.date].filter(Boolean).join(' · ')}`, team.name, I.jersey(tid));
  const s = g?.standings.find((x) => x.teamId === tid);
  const sub = [players.map((p) => p.name).join(' + '), s ? `${s.shared ? 'T-' : ''}${ordinal(s.rank)}` : '', s ? (g.type === 'rotationPlusMinus' ? fmtSigned(s.officialPm, 'E') : `${fmtPts(s.officialPoints)} pts`) : '', s ? `${s.record.w}-${s.record.l}-${s.record.h}` : '']
    .filter(Boolean).join(' · ');
  text(ctx, sub, PAD, 226, { size: 30, weight: 500, color: C.soft, max: W - PAD * 2 });

  let y = 270;
  for (const from of [0, 9]) {
    const holes = snap.holes.slice(from, from + 9);
    const rows = [
      { label: 'Hole', kind: 'hole', values: holes.map((h) => h.n), total: from ? 'In' : 'Out' },
      { label: 'Par', kind: 'par', values: holes.map((h) => h.par), total: holes.reduce((a, h) => a + h.par, 0) },
      ...players.map((p) => ({ label: p.name, kind: 'score', values: p.gross.slice(from, from + 9), total: (from ? p.grossBack : p.grossFront) || '–' })),
      ...compNames.map((n, k) => {
        const vals = holes.map((h) => team.comps[h.n - 1]?.[k] ?? null);
        const tot = vals.every((v) => v != null) ? vals.reduce((a, v) => a + v, 0) : null;
        return { label: n, kind: 'par', h: 56, values: vals, total: tot ?? '–' };
      }),
    ];
    y = nineTable(ctx, snap, rows, from, PAD + 12, y) + 34;
  }

  if (matches.length) {
    text(ctx, 'MATCHUPS', PAD, y + 24, { size: 24, weight: 800, color: C.soft });
    y += 70;
    for (const m of matches) {
      const opp = m.teams[0] === tid ? m.teams[1] : m.teams[0];
      const isPM = g.type === 'rotationPlusMinus';
      const res = !m.final ? `${m.played} of ${m.total}` : m.result === 'halved' ? 'Halved' : m.result === tid ? 'Won' : 'Lost';
      const sc = isPM ? fmtSigned(m.margin[tid], 'E') : `${fmtPts(m.points[tid])}–${fmtPts(m.points[opp])}`;
      text(ctx, m.label.replace('Holes ', ''), PAD, y, { size: 26, weight: 700, color: C.faint, mono: true });
      let x = PAD + 200;
      x += text(ctx, 'vs ', x, y, { size: 28, weight: 500, color: C.soft });
      x += text(ctx, I.tname(opp), x, y, { size: 28, weight: 700, color: I.jersey(opp), max: 300 }) + 18;
      x += text(ctx, sc, x, y, { size: 28, weight: 700, color: C.ink, mono: true }) + 18;
      text(ctx, res, x, y, { size: 28, weight: 700, color: res === 'Won' ? C.good : C.soft });
      const b = m.bonus?.[tid];
      if (b) text(ctx, `+${fmtPts(b)}`, W - PAD, y, { size: 26, weight: 800, color: C.sun, align: 'right', mono: true });
      y += 56;
    }
  }
  return finish(cv, y, app);
}

// ───────────────────────────────────────────── 4. full report

function fullReport(app) {
  const I = ctxInfo(app);
  const { snap } = I;
  const g = snap.game;
  const net = snap.hasStrokes;
  const labelW = 150;
  const totCols = net ? 2 : 1;
  const totW = 70;
  const cellW = (W - PAD * 2 - labelW - totW * totCols) / HOLES;
  const order = Array.from({ length: HOLES }, (_, i) => i + 1); // card order: 1–18
  const groups = (snap.roster.teams || []).length
    ? (g ? g.standings.map((s) => s.teamId) : snap.teams.map((t) => t.id)).map((t) => ({ id: t, players: snap.players.filter((p) => p.teamId === t) }))
    : [{ id: null, players: snap.players }];
  const standH = g ? 60 + g.standings.length * 64 + 30 : 0;
  const tableH = 52 * 2 + groups.reduce((a, gr) => a + (gr.id ? 56 : 0) + gr.players.length * 60, 0);
  const H = 250 + standH + tableH + 60 + 140;
  const { cv, ctx } = canvasOf(H);
  header(ctx, `Full report · ${[I.course, I.tee, I.date].filter(Boolean).join(' · ')}`, I.ev.name || 'Round');

  let y = 236;
  if (g) {
    const isPM = g.type === 'rotationPlusMinus';
    for (const s of g.standings) {
      const col = I.jersey(s.teamId);
      fillRect(ctx, PAD, y + 12, 8, 40, 4, col);
      text(ctx, `${s.shared ? 'T' : ''}${s.rank}`, PAD + 26, y + 44, { size: 28, weight: 700, color: C.faint, mono: true });
      text(ctx, I.tname(s.teamId), PAD + 90, y + 44, { size: 32, weight: 750, color: C.ink, max: 420 });
      text(ctx, `${s.record.w}-${s.record.l}-${s.record.h}`, W - PAD - 190, y + 44, { size: 28, weight: 600, color: C.soft, align: 'right', mono: true });
      text(ctx, isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints), W - PAD, y + 44, { size: 40, weight: 700, color: col, align: 'right', mono: true });
      y += 64;
    }
    y += 40;
  }

  // One 18-hole table: Hole / Par, then each cart and its players
  const colX = (i) => PAD + labelW + cellW * i + cellW / 2;
  const totX = (k) => PAD + labelW + cellW * HOLES + totW * k + totW / 2;
  text(ctx, 'Hole', PAD, y + 36, { size: 22, weight: 600, color: C.soft });
  order.forEach((h, i) => text(ctx, String(h), colX(i), y + 36, { size: 22, weight: 700, color: C.ink, align: 'center', mono: true }));
  text(ctx, 'Tot', totX(0), y + 36, { size: 22, weight: 700, color: C.soft, align: 'center' });
  if (net) text(ctx, 'Net', totX(1), y + 36, { size: 22, weight: 700, color: C.soft, align: 'center' });
  y += 52;
  text(ctx, 'Par', PAD, y + 34, { size: 22, weight: 600, color: C.soft });
  order.forEach((h, i) => text(ctx, String(snap.holes[h - 1].par), colX(i), y + 34, { size: 22, weight: 500, color: C.soft, align: 'center', mono: true }));
  text(ctx, String(snap.parTotal), totX(0), y + 34, { size: 22, weight: 600, color: C.soft, align: 'center', mono: true });
  y += 52;
  for (const gr of groups) {
    if (gr.id) {
      const col = I.jersey(gr.id);
      ctx.fillStyle = C.line;
      ctx.fillRect(PAD, y + 4, W - PAD * 2, 2);
      text(ctx, I.tname(gr.id), PAD, y + 42, { size: 26, weight: 800, color: col, max: W - PAD * 2 });
      y += 56;
    }
    for (const p of gr.players) {
      fillRect(ctx, PAD - 10, y + 2, W - PAD * 2 + 20, 54, 14, C.card);
      text(ctx, p.name, PAD, y + 38, { size: 24, weight: 700, color: C.ink, max: labelW - 10 });
      order.forEach((h, i) => scoreMark(ctx, p.gross[h - 1], snap.holes[h - 1].par, colX(i), y + 29, Math.min(20, cellW * 0.52)));
      text(ctx, String(p.grossTotal || '–'), totX(0), y + 38, { size: 24, weight: 700, color: C.ink, align: 'center', mono: true });
      if (net) text(ctx, String(p.netTotal || '–'), totX(1), y + 38, { size: 24, weight: 600, color: C.soft, align: 'center', mono: true });
      y += 60;
    }
  }
  return finish(cv, y, app);
}

// ───────────────────────────────────────────── the set

/** The recap images for this phone: leaderboard, then (if you played) your card and your cart, then everyone. */
export async function recapImages(app) {
  await loadFonts();
  const out = [{ key: 'board', title: app.snapshot.game ? 'Final leaderboard' : 'Leaderboard', canvas: leaderboard(app) }];
  if (app.myPlayer()) out.push({ key: 'me', title: 'Your scorecard', canvas: scorecard(app) });
  if (app.myTeam() && app.snapshot.teamById.get(app.myTeam())) out.push({ key: 'cart', title: 'Your cart', canvas: cartCard(app) });
  out.push({ key: 'all', title: 'Full report', canvas: fullReport(app) });
  return out;
}

/** Save / share a canvas as a PNG: the share sheet where it exists (Save Image on iPhone), else a download. */
export async function saveImage(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

