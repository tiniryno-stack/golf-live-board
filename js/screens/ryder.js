// ryder.js — Team Ryder Cup screens (handoff 015): Board (cup card, cup bar, rotations, flags),
// the read-only match sheet, and Matches (rotation picker, score card, hole strip, hole detail).
// All numbers and copy come from scoring.ryderState (pure); this file only draws.
// 018: Partner “Rider” Cup uses the same screens through riderview.riderState (same shapes, plus
// cart names and colors: names, bars and dots wear the cart colors; Team Ryder Cup stays grey).

import { esc, icon, seg, seg2, mark, copyText } from '../ui.js';
import { fmtPts, fmtToPar, playerLeaderboard, projectedGross, ryderState, ryderNeedLine, ryderHoleLine, teeTimeName, holeAt } from '../scoring.js';
import { riderState, holeLines } from '../riderview.js';
import { local } from '../db.js';

export const ryState = (app) => ryderState(app.snapshot, app.myTeam()) || riderState(app.snapshot, app.myTeam());
const tint = (cart) => (cart.color ? ` style="color:${cart.color}"` : '');
const cartTitle = (cart) => (cart.color ? cart.name : cart.names.join(' + ')); // Rider: the cart's name; Ryder: the two first names
const clinchLbl = (m) => `${fmtPts(m.clinchAt || 6.5)} CLINCHES`;

// ───────────────────────────────────────────── shared pieces

/** Two first names stacked (015 §1). */
const names = (cart, cls = '') => `<span class="ry-nm ${cart.color ? '' : cls}"${tint(cart)}>${cart.names.map((n) => `<span class="ellipsis">${esc(n)}</span>`).join('')}</span>`;

/** The flag: one 72 × 26 shape per match, hanging toward whoever holds the point. */
function flag(m) {
  const f = m.flag;
  const check = f.look === 'won' || f.look === 'halved' ? icon('check', 12) : '';
  return `<span class="ry-flag ${f.look} at-${f.side}">${check}${esc(f.text)}</span>`;
}

/** 12 segments in two groups of six; ours from the left, theirs from the right, halves fill half. */
function cupBar(st) {
  const u = st.sides.us.total, t = st.sides.them.total, n = st.matches.length;
  const segs = Array.from({ length: n }, (_, i) => {
    const us = Math.max(0, Math.min(1, u - i)), them = Math.max(0, Math.min(1, t - (n - 1 - i)));
    return `<i class="ry-seg">${us ? `<b class="us" style="width:${us * 100}%"></b>` : ''}${them ? `<b class="them" style="width:${them * 100}%"></b>` : ''}</i>`;
  });
  const half = n / 2;
  return `<div class="ry-cupbar" role="img" aria-label="${fmtPts(u)} to ${fmtPts(t)}"><span class="ry-grp">${segs.slice(0, half).join('')}</span><span class="ry-mid"></span><span class="ry-grp">${segs.slice(half).join('')}</span></div>`;
}

/** One smooth bar of hole points with the 6½ line. */
function matchBar(m, { green = true } = {}) {
  if (m.pm) return ''; // Plus/Minus: strokes, no points bar
  const [u, t] = m.holePts;
  const max = m.maxPts || 12;
  const uc = m.us.color ? `;background:${m.us.color}` : '', tc = m.them.color ? `;background:${m.them.color}` : '';
  return `<div class="ry-mbar${green ? '' : ' plain'}"><div class="ry-mtrack"><b class="us" style="width:${Math.min(100, (u / max) * 100)}%${uc}"></b><b class="them" style="width:${Math.min(100, (t / max) * 100)}%${tc}"></b><i class="ry-mline"></i></div></div>`;
}
/** "4 pts left · 6½ CLINCHES", and the Rider win bonus as one line under it. */
const barFoot = (m) => (m.pm ? '' : `<div class="ry-bl"><span class="meta">${esc(m.barLine || '')}</span><span class="lbl">${clinchLbl(m)}</span></div>${m.bonus ? `<div class="meta ry-bonus">${esc(m.bonus)}</div>` : ''}`);

/** The dot: solid = counted, hatched = one cart in, dashed = nobody yet. Drawn SVG, no gradients. */
export function dot(state, who, { green = true, usColor = null, themColor = null } = {}) {
  const us = usColor || (green ? 'var(--cart-you)' : 'var(--text)'), them = themColor || 'var(--text-muted)';
  const c = 5.5;
  if (state === 'solid') {
    if (who === 'halved') return `<svg class="ry-dot" viewBox="0 0 11 11" aria-hidden="true"><path d="M5.5 0A5.5 5.5 0 0 0 5.5 11Z" fill="${us}"/><path d="M5.5 0A5.5 5.5 0 0 1 5.5 11Z" fill="${them}"/></svg>`;
    return `<svg class="ry-dot" viewBox="0 0 11 11" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${c}" fill="${who === 'us' ? us : them}"/></svg>`;
  }
  if (state === 'hatched') {
    // Three 45° stripes, cut to the inside of the ring (chords, so no clip path is needed).
    const r = 4, lines = [-2.6, 0, 2.6].map((d) => {
      const h = Math.sqrt(r * r - d * d), k = Math.SQRT1_2;
      const cx = c + d * k, cy = c - d * k;
      return `<line x1="${(cx - h * k).toFixed(2)}" y1="${(cy - h * k).toFixed(2)}" x2="${(cx + h * k).toFixed(2)}" y2="${(cy + h * k).toFixed(2)}"/>`;
    }).join('');
    return `<svg class="ry-dot" viewBox="0 0 11 11" aria-hidden="true" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><circle cx="${c}" cy="${c}" r="4.75"/>${lines}</svg>`;
  }
  return `<svg class="ry-dot" viewBox="0 0 11 11" aria-hidden="true" fill="none" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="2 1.7"><circle cx="${c}" cy="${c}" r="4.75"/></svg>`;
}
const dotFor = (h, key, o) => (h.points ? dot('solid', h[key], o) : h.whoIsIn === 'us' || h.whoIsIn === 'them' ? dot('hatched', null, o) : dot('dashed', null, o));

/** Six tiles: hole number + low ball dot over low total dot. */
const colorsOf = (m, o = {}) => (m.us.color ? { ...o, usColor: m.us.color, themColor: m.them.color } : o); // Rider: cart colors everywhere, the sheet too
function holeStrip(m, sel, act, o = {}) {
  o = colorsOf(m, o);
  return `<div class="ry-strip">${m.holes.map((h) => `<button class="ry-tile${h.hole === sel ? ' on' : ''}" data-act="${act}" data-v="${h.hole}" data-m="${esc(m.id)}" aria-pressed="${h.hole === sel}">
      <span class="mono">${h.hole}</span><span class="ry-dots">${dotFor(h, 'lowBall', o)}${dotFor(h, 'lowTotal', o)}</span></button>`).join('')}</div>`;
}

/** Default hole: the latest one with any score, else the first. */
function defaultHole(m) {
  const any = m.holes.filter((h) => h.whoIsIn !== 'none');
  return (any[any.length - 1] || m.holes[0]).hole;
}

const grossOf = (app, pid, h) => app.snapshot.playerById.get(pid)?.gross[h - 1] ?? null;

function marks(app, cart, h, par, { you = false } = {}) {
  return cart.playerIds.map((pid, i) => {
    const g = grossOf(app, pid, h);
    return `<div class="ry-mk"><span class="ry-mk-n ellipsis${you && !cart.color ? ' you' : ''}"${tint(cart)}>${esc(cart.names[i])}</span>${mark(g, par, 32, { ghost: g == null ? par : null })}</div>`;
  }).join('');
}

// ───────────────────────────────────────────── Board

function row(app, m, myCart) {
  const holder = m.flag.side; // 'us' | 'them' | 'line'
  const lost = m.result === 'lost', won = m.result === 'won';
  const usCls = m.us.id === myCart ? 'you' : lost ? 'muted' : '';
  const themCls = won || m.result === 'halved' || !m.result ? 'muted' : '';
  return `<button class="ry-row" data-act="ry-match" data-v="${esc(m.id)}">
      <span class="ry-cell l${holder === 'us' ? ' hold' : ''}">${names(m.us, usCls)}</span>
      <span class="ry-line">${flag(m)}</span>
      <span class="ry-cell r${holder === 'them' ? ' hold' : ''}">${names(m.them, themCls)}</span></button>`;
}

function rotation(app, r, open, myCart) {
  const tag = r.status === 'live' ? '<span class="ry-st live">LIVE</span>' : r.status === 'done' ? '<span class="ry-st">DONE</span>' : `<span class="ry-chev${open ? ' open' : ''}">${icon('fwd', 16)}</span>`;
  const head = `<span class="lbl${r.status === 'live' ? ' on' : ''}">HOLES ${esc(r.holes)}</span>
      ${r.tally ? `<span class="ry-tally mono"><b class="you">${fmtPts(r.tally.us)}</b> – ${fmtPts(r.tally.them)}</span>` : `<span class="ry-tally mono">${esc(r.center || '')}</span>`}${tag}`;
  return `<section class="ry-rot ${r.status}">
      ${r.status === 'future' ? `<button class="ry-strip-h" data-act="ry-fold" data-v="${r.index}" aria-expanded="${open}">${head}</button>` : `<div class="ry-strip-h">${head}</div>`}
      ${open ? `<div class="ry-rows">${r.matches.map((m) => row(app, m, myCart)).join('')}</div>` : ''}</section>`;
}

/** The rotation strips with their match rows (015 §2.3; Rider Board too, 018 §5). */
export function rotationStrips(app, st) {
  const myCart = app.myTeam();
  const anyLiveOrDone = st.rotations.some((r) => r.status !== 'future');
  const opened = app.ui.ryFold || {};
  const isOpen = (r) => r.status !== 'future' || (opened[r.index] ?? (!anyLiveOrDone && r.index === 0));
  return st.order.map((r) => rotation(app, r, isOpen(r), myCart)).join('');
}

// ───────────────────────────────────────────── the final card (handoff 019)

/** The hole the winning side reached the cup on (play order), or null (shared / not decided). */
function clinchHole(app, st, winner) {
  if (!winner || winner === 'shared') return null;
  const donePos = (m) => m.to - (m.decidedEarly || 0);
  for (let pos = 1; pos <= 18; pos++) {
    const pts = st.matches.filter((m) => m.sidePts && donePos(m) <= pos).reduce((a, m) => a + m.sidePts[winner], 0);
    if (pts >= st.toWin - 1e-9) return holeAt(app.snapshot.settings, pos);
  }
  return null;
}

/** Each cart's record and match points, by side: sorted by points, then wins. */
function cartRecords(st, side) {
  const carts = new Map();
  for (const m of st.matches) {
    for (const [k, c] of [['us', m.us], ['them', m.them]]) {
      if ((k === 'us') !== (side === 'us')) continue;
      const r = carts.get(c.id) || { cart: c, w: 0, l: 0, h: 0, pts: 0 };
      if (m.sidePts) {
        const v = m.sidePts[k];
        r.pts += v;
        if (v === 1) r.w++; else if (v === 0.5) r.h++; else r.l++;
      }
      carts.set(c.id, r);
    }
  }
  return [...carts.values()].sort((a, b) => b.pts - a.pts || b.w - a.w || a.cart.id.localeCompare(b.cart.id));
}

function recordList(st, side) {
  const s = st.sides[side];
  const rows = cartRecords(st, side).map((r) => `<div class="ry-rec">
      <span class="ellipsis${side === 'us' ? ' you' : ''}">${esc(r.cart.names.join(' + '))}</span>
      <span class="mono small ry-rec-r">${r.w}–${r.l}${r.h ? `–${r.h}` : ''}</span><span class="mono ry-rec-p">${fmtPts(r.pts)}</span></div>`).join('');
  return `<div class="ry-recs"><div class="lbl${side === 'us' ? ' you' : ''}">${esc(s.name.toUpperCase())} · ${fmtPts(s.total)}</div>${rows}</div>`;
}

/** One line for the share sheet: "Team Andrew win the cup 7–5 · Twin Creeks". */
function resultLine(app, st) {
  const u = fmtPts(st.sides.us.total), t = fmtPts(st.sides.them.total);
  const c = app.snapshot.course?.shortName || app.snapshot.course?.name || '';
  const w = st.sides.us.total > st.sides.them.total ? `${st.sides.us.name} win the cup ${u}–${t}` : st.sides.them.total > st.sides.us.total ? `${st.sides.them.name} win the cup ${t}–${u}` : `Cup shared ${u}–${t}`;
  return `${w}${c ? ` · ${c}` : ''}`;
}

function finalCard(app, st) {
  const u = st.sides.us.total, t = st.sides.them.total;
  const winner = u > t ? 'us' : t > u ? 'them' : 'shared';
  const won = winner === 'us';
  const hole = clinchHole(app, st, winner);
  const mvp = st.mvp ? `MVP cart <b>${esc(st.mvp.cart.names.join(' + '))}</b> ${fmtPts(st.mvp.matchPts)}–${fmtPts(st.mvp.record.length - st.mvp.matchPts)}` : '';
  const line = [hole ? `Clinched on hole ${hole}` : '', mvp].filter(Boolean).join(' · ');
  const finalize = app.isOrganizer() && !app.isFinal() ? `<button class="btn primary block ry-finalize" data-act="board-finalize">${icon('lock', 16)} Finalize round</button>` : '';
  return `<div class="ry-endcard${won ? ' won' : ''}">
      <div class="ry-end-wash">
        <div class="lbl">${app.isFinal() ? 'FINAL · LOCKED' : `FINAL · ${st.matches.length} MATCHES`}</div>
        <span class="ry-trophy">${icon('trophy', 44)}</span>
        <div class="ry-end-who${won ? ' you' : ''}">${winner === 'shared' ? 'Cup shared' : esc(st.sides[winner].name)}</div>
        ${winner === 'shared' ? '' : '<div class="ry-end-sub">wins the cup</div>'}
      </div>
      <div class="ry-end-score mono"><span class="you">${fmtPts(u)}</span><span class="ry-end-dash">–</span><span class="muted">${fmtPts(t)}</span></div>
      ${cupBar(st)}
      ${line ? `<div class="small ry-end-line">${line}</div>` : ''}
      <button class="btn primary big block ry-end-btn" data-act="recap-open">Round recap</button>
      <button class="btn ghost block" data-act="ry-share">Share the result</button>
    </div>${finalize}`;
}

/** Board → Cup view for a Team Ryder Cup. */
export function ryderBoard(app, { segs = '', players = '' } = {}) {
  const st = ryderState(app.snapshot, app.myTeam());
  if (!st) return '';
  const view0 = app.ui.boardView === 'players' ? 'players' : 'teams';
  if (st.final || app.isFinal()) {
    // 019: the round is over → the result card, then both sides' cart records (every match still below).
    return `<div class="plain ry-board ry-done">${finalCard(app, st)}${segs}
      ${view0 === 'players' ? players : `${recordList(st, 'us')}${recordList(st, 'them')}${rotationStrips(app, st)}`}</div>`;
  }
  const mvp = st.final && st.mvp
    ? `<div class="ry-final">${icon('trophy', 20)}<span class="ellipsis">${esc(st.mvp.cart.names.join(' + '))} ${fmtPts(st.mvp.matchPts)}–${fmtPts(st.mvp.record.length - st.mvp.matchPts)} · MVP cart</span><button class="btn small" data-act="recap-open">Recap</button></div>`
    : '';
  const card = `<div class="ry-cup">
      <div class="lbl ry-cup-k${st.final ? ' you' : ''}">${esc(st.cupLine)}</div>
      <div class="ry-cup-top">
        <div class="ry-side"><div class="ry-sn you">${esc(st.sides.us.name)}</div><div class="ry-tot you mono">${fmtPts(st.sides.us.total)}</div></div>
        <div class="ry-side r"><div class="ry-sn">${esc(st.sides.them.name)}</div><div class="ry-tot mono">${fmtPts(st.sides.them.total)}</div></div>
      </div>
      ${cupBar(st)}${mvp}</div>`;
  const view = app.ui.boardView === 'players' ? 'players' : 'teams';
  return `<div class="plain ry-board">${card}${segs}
      ${view === 'players' ? players : rotationStrips(app, st)}</div>`;
}

/** Board → Players: just the players (no carts), net leaderboard; gross and net side by side, to par over the strokes so far. */
export function ryderPlayers(app) {
  const snap = app.snapshot;
  const rows = playerLeaderboard(snap, 'net').map((p, i) => `<button class="ry-prow" data-act="board-player" data-v="${esc(p.id)}">
      <span class="mono meta">${p.thru ? i + 1 : ''}</span>
      <span class="ellipsis${p.id === app.me ? ' you' : ''}">${esc(p.name)}</span>
      <span class="mono r">${p.thru || '–'}</span>
      <span class="mono r ry-pc">${p.thru ? `${fmtToPar(p.grossToPar)}<small>${p.grossTotal}</small>` : '–'}</span>
      <span class="mono r">${projectedGross(snap, p) ?? '–'}</span>
      <span class="mono r b">${p.thru ? fmtToPar(p.netToPar) : '–'}</span></button>`).join('');
  return `<div class="ry-prow head lbl"><span></span><span>Player</span><span class="r">Thru</span><span class="r">Gross</span><span class="r">Proj</span><span class="r">Net</span></div>${rows}`;
}

// ───────────────────────────────────────────── match sheet (read-only, no X)

/** Board → tap a match: the same pieces as Matches (023), read-only. Green only when it's your cart's match. */
export function ryderMatchSheet(app, { id, hole }) {
  const st = ryState(app);
  const m = st?.matches.find((x) => x.id === id);
  if (!m) return '';
  if (m.pm) return ryderMatchSheetLegacy(app, m, hole); // Plus/Minus: as on Matches, out of 023's scope
  const mine = !!app.myTeam() && m.us.id === app.myTeam();
  const h = m.holes.find((x) => x.hole === Number(hole)) || m.holes.find((x) => x.hole === defaultHole(m));
  const status = m.status === 'done' ? 'final' : m.status === 'live' ? 'live' : 'up next';
  const title = mine ? `vs ${esc(cartTitle(m.them))}` : `${esc(cartTitle(m.us))} <span class="m">vs</span> ${esc(cartTitle(m.them))}`;
  return `<div class="ry-sheet rm${mine ? '' : ' plain'}">
      <div class="rm-head"><h2 class="rm-vs ellipsis">${title}</h2><div class="rm-sub">${esc(m.label)} · ${status}</div></div>
      ${rmCard(m, app.snapshot, { mine })}
      ${rmStrip(m, h.hole, 'ry-sheet-hole')}
      ${rmDetail(app, m, h, { mine })}
    </div>`;
}

function ryderMatchSheetLegacy(app, m, hole) {
  const h = m.holes.find((x) => x.hole === Number(hole)) || m.holes.find((x) => x.hole === defaultHole(m));
  const status = m.status === 'done' ? 'FINAL' : m.status === 'live' ? 'LIVE' : 'UP NEXT';
  const [u, t] = m.holePts;
  const side = (cart, n, loser, cls) => `<div class="ry-ms-s ${cls}"><div class="ry-sn ellipsis"${tint(cart)}>${esc(cartTitle(cart))}</div>
      <div class="ry-ms-n"><span class="ry-num mono${loser ? ' muted' : ''}">${fmtPts(n)}</span><i class="ry-sdot ${cls}"></i></div></div>`;
  const val = (k, side) => {
    const v = h.net[side];
    if (v.some((x) => x == null)) return '–';
    return k === 'lowBall' ? Math.min(...v) : v[0] + v[1];
  };
  const detail = `<div class="ry-hls">${['lowBall', 'lowTotal'].map((k) => `<div class="ry-hl">${dotFor(h, k, colorsOf(m, { green: false }))}<span>${k === 'lowBall' ? 'Low ball' : 'Low total'} · <span class="mono">${val(k, 'us')} v ${val(k, 'them')}</span></span></div>`).join('')}</div>`;
  return `<div class="ry-sheet">
      <div class="lbl">HOLES ${esc(m.label.replace(/^Holes /, ''))} · ${status}</div>
      <div class="ry-ms-top">${side(m.us, u, m.result === 'lost', 'l')}${side(m.them, t, m.result === 'won', 'r')}</div>
      ${matchBar(m, { green: false })}
      ${barFoot(m)}
      ${holeStrip(m, h.hole, 'ry-sheet-hole', { green: false })}
      <div class="ry-hd"><div class="ry-hd-h"><b>Hole ${h.hole}</b><span class="meta"> · par ${h.par}</span></div>
        <div class="ry-marks">${marks(app, m.us, h.hole, h.par)}${marks(app, m.them, h.hole, h.par)}</div>
        ${detail}</div>
    </div>`;
}

// ───────────────────────────────────────────── Matches (my match)

// Pre-023 Matches, kept for Plus/Minus (handoff 023 §1.5 leaves it out of scope: "keep today's detail").
function ryderMatchesLegacy(app) {
  const st = ryState(app);
  const myCart = app.myTeam();
  if (!st) return '';
  if (!myCart) {
    return `<div class="plain ry-matches"><div class="lbl">MATCHES</div><h1 class="title">You’re watching</h1>
      <p class="meta">Matches shows your own cart’s match. The Board has every match: tap one to see it.</p></div>`;
  }
  // Your matches in order (3 for most rounds; 2 at once for a 3-cart Rider round). Picked by match id.
  const mine = st.matches.filter((x) => x.us.id === myCart);
  const current = mine.find((x) => x.status === 'live') || mine.find((x) => x.status === 'notStarted') || mine[mine.length - 1];
  const m = mine.find((x) => x.id === app.ui.ryMatch) || (app.ui.ryRot != null ? mine.find((x) => x.rotation === Number(app.ui.ryRot)) : null) || current;
  if (!m) return '';
  const sameHoles = new Set(mine.map((x) => x.label)).size < mine.length; // 3 carts: both matches are holes 1–18
  const sub = (x) => (x.status === 'live' ? 'live' : x.status === 'notStarted' ? 'up next'
    : `${x.result === 'won' ? 'won' : x.result === 'lost' ? 'lost' : 'halved'} ${fmtPts(Math.max(...x.holePts))}–${fmtPts(Math.min(...x.holePts))}`);
  const picker = seg2('ry-rot', mine.map((x) => [x.id, sameHoles ? `vs ${x.them.name}` : x.label.replace(/^Holes /, ''), sub(x), { live: x.status === 'live' }]), m.id);
  const waiting = m.status === 'notStarted' && m.holes.some((h) => h.whoIsIn === 'us');
  const kick = m.status === 'live' ? '<span class="you">LIVE</span>' : m.status === 'done' ? 'FINAL' : waiting ? 'WAITING ON THEM' : 'UP NEXT';
  const snap = app.snapshot;
  const where = m.rotation === 0 ? `${teeTimeName(snap.settings, m.us.tee)} · your group`
    : `${teeTimeName(snap.settings, m.them.tee)} · ${m.where.them ? `they’re on ${m.where.them}` : 'they’re done'}, ${m.where.us ? `you’re on ${m.where.us}` : 'you’re done'}`;
  const selHole = Number(app.ui.ryHole?.[m.id]) || defaultHole(m);
  const h = m.holes.find((x) => x.hole === selHole) || m.holes[0];
  const [u, t] = m.holePts;
  const ptsLine = h.points ? `<span class="mono meta">${fmtPts(h.points.us)}–${fmtPts(h.points.them)}</span>` : '';
  const need = ryderNeedLine(m, h);
  const lines = `<div class="ry-hls">${['lowBall', 'lowTotal'].map((k) => `<div class="ry-hl">${dotFor(h, k, colorsOf(m))}<span>${esc(ryderHoleLine(k, h[k]) || `${k === 'lowBall' ? 'Low ball' : 'Low total'} · –`)}</span></div>`).join('')}</div>
        ${!h.points && need ? `<div class="ry-hl meta">${esc(need)}</div>` : ''}`;
  return `<div class="plain ry-matches">
      <div class="lbl">HOLES ${esc(m.label.replace(/^Holes /, ''))} · ${kick}</div>
      <h1 class="title ry-vs ellipsis">vs <span${tint(m.them)}>${esc(cartTitle(m.them))}</span></h1>
      <div class="meta">${esc(where)}</div>
      <div class="ry-picker">${picker}</div>
      <div class="ry-card">
        <div class="lbl${m.status === 'notStarted' ? '' : ' you'}">${esc(m.kicker)}</div>
        <div class="ry-ms-top">
          <div class="ry-ms-s l"><div class="ry-sn you ellipsis">${esc(cartTitle(m.us))}</div><div class="ry-num you mono">${m.pm ? esc(m.flag.text) : fmtPts(u)}</div></div>
          <div class="ry-ms-s r"><div class="ry-sn ellipsis"${tint(m.them)}>${esc(cartTitle(m.them))}</div><div class="ry-num${m.them.color ? '' : ' muted'} mono">${m.pm ? '' : fmtPts(t)}</div></div>
        </div>
        ${matchBar(m)}
        ${barFoot(m)}
      </div>
      ${holeStrip(m, h.hole, 'ry-hole')}
      <div class="ry-legend small">${dot('solid', 'us', colorsOf(m))} counted ${dot('hatched')} one cart in ${dot('dashed')} nobody yet</div>
      <div class="ry-hd"><div class="ry-hd-h"><b>Hole ${h.hole}</b><span class="meta"> · par ${h.par}</span>${ptsLine}</div>
        <div class="ry-marks">${marks(app, m.us, h.hole, h.par, { you: true })}${marks(app, m.them, h.hole, h.par)}</div>
        ${lines}</div>
    </div>`;
}

// ───────────────────────────────────────────── Matches (handoff 023 §1)

const ptClass = (who) => (who === 'us' ? 'me' : who === 'them' ? 'them' : 'tie');

/** One segment of the rotation picker: holes label + W / L / ½ / LIVE (023 §1.2). */
function rmSeg(m, selId, liveId) {
  const on = m.id === selId;
  const holes = m.label.replace(/^Holes /, '');
  let tag = '';
  if (m.status === 'done') tag = m.result === 'won' ? '<i class="w">W</i>' : m.result === 'lost' ? '<i class="l">L</i>' : '<i class="h">½</i>';
  else if (m.id === liveId && !on) tag = '<i class="lv">LIVE</i>';
  return `<button class="rm-sgm${on ? ' on' : ''}" data-act="ry-rot" data-v="${esc(m.id)}" aria-pressed="${on}">${esc(holes)} ${tag}</button>`;
}

/** The value a hole tile shows: your points (green > 0, muted 0), "–" scores-in-not-counted, blank. */
function rmTileVal(h) {
  if (h.points) { const p = h.points.us; return `<i class="${p > 0 ? 'win' : 'lose'}">${p > 0 ? `+${fmtPts(p)}` : '0'}</i>`; }
  return h.whoIsIn === 'none' ? '<i></i>' : '<i class="lose">–</i>';
}

/** One Low ball / Low total result row. */
function rmRes(label, line) {
  return `<div class="rm-r"><span class="rm-rk">${label}</span><b class="rm-rw ${line.who === 'us' ? 'me' : 'them'}">${esc(line.text)}</b><span class="rm-rp ${ptClass(line.who)}">${esc(line.pts)}</span></div>`;
}

/** The score card (023 §1.3); shared with the Board's match sheet. */
function rmCard(m, snap, { mine = true } = {}) {
  const ncomp = snap.game?.ncomp || 2;
  const [u, t] = m.holePts;
  const max = m.maxPts || m.total * ncomp;
  const halves = Number(snap.settings.halvedHolePoints) || 0;
  const clinch = m.clinchAt ?? (halves ? max / 2 + 0.5 : Math.floor(max / 2) + 1);
  const tickPct = (clinch / max) * 100;
  const leftPts = (m.total - m.thru) * ncomp;
  const up = (m.status === 'live' && m.leader === 'us') || m.result === 'won';
  const margin = fmtPts(Math.abs(u - t));
  // A match you're not in (the Board's sheet) names the leader / winner instead of "you".
  const who = (side) => cartTitle(side === 'us' ? m.us : m.them).toUpperCase();
  const score = `${fmtPts(Math.max(u, t))}–${fmtPts(Math.min(u, t))}`;
  const kicker = m.status === 'notStarted' ? 'NOTHING COUNTS YET'
    : m.status === 'done'
      ? (m.result === 'halved' ? 'FINAL · HALVED' : mine ? `FINAL · ${m.result === 'won' ? 'YOU WON' : 'LOST'} ${fmtPts(u)}–${fmtPts(t)}` : `FINAL · ${who(m.result === 'won' ? 'us' : 'them')} WON ${score}`)
      : m.leader !== 'us' && m.leader !== 'them' ? `THRU ${m.thru} · ALL SQUARE`
        : mine ? `THRU ${m.thru} · ${margin} ${m.leader === 'us' ? 'UP' : 'DN'}` : `THRU ${m.thru} · ${who(m.leader)} ${margin} UP`;
  return `<section class="rm-card">
      <div class="rm-k lbl${up ? ' up' : ''}">${esc(kicker)}</div>
      <div class="rm-sides">
        <div class="rm-side us"><span class="rm-cn ellipsis">${esc(cartTitle(m.us))}</span><span class="rm-pts mono">${fmtPts(u)}</span></div>
        <div class="rm-side them"><span class="rm-cn ellipsis">${esc(cartTitle(m.them))}</span><span class="rm-pts mono">${fmtPts(t)}</span></div>
      </div>
      <div class="rm-bar"><span class="rm-u" style="width:${Math.min(100, (u / max) * 100)}%"></span><span class="rm-t" style="width:${Math.min(100, (t / max) * 100)}%"></span><span class="rm-tick" style="left:${tickPct}%"></span></div>
      <div class="rm-foot"><span>${m.status === 'done' ? 'Match over' : `${fmtPts(leftPts)} pts left`}</span><span class="rm-cl" style="left:${tickPct}%">${fmtPts(clinch)} wins</span></div>
    </section>`;

}

/** Six hole tiles with your points (023 §1.4). `motion` = the new-since rings + pop (Matches only). */
function rmStrip(m, selHole, act, motion = null) {
  const { newHoles = [], popHoles = [], t0 = 0 } = motion || {};
  return `<div class="rm-strip">${m.holes.map((h) => {
    const isNew = newHoles.includes(h.hole);
    const pop = popHoles.indexOf(h.hole);
    return `<button class="rm-tile${h.hole === selHole ? ' on' : ''}${isNew ? ' rm-new' : ''}"${isNew ? ` data-t0="${t0}"` : ''} data-act="${act}" data-m="${esc(m.id)}" data-v="${h.hole}" aria-pressed="${h.hole === selHole}"><b>${h.hole}</b><span class="rm-tv${pop >= 0 ? ' rm-pop' : ''}"${pop >= 0 ? ` style="--d:${pop * 120}ms"` : ''}>${rmTileVal(h)}</span></button>`;
  }).join('')}</div>`;

}

/** The selected hole: four scores (dimmed where they didn't count) + Low ball / Low total or the need line (023 §1.5). */
function rmDetail(app, m, h, { mine = true } = {}) {
  const snap = app.snapshot, ncomp = snap.game?.ncomp || 2;
  const par = h.par;
  const usNames = m.us.names, themNames = m.them.names;
  const strokes = [...m.us.playerIds, ...m.them.playerIds].map((pid) => (snap.playerById.get(pid)?.dots[h.hole - 1] || 0) > 0);
  const hl = holeLines(h, usNames, themNames, strokes, { mine });
  const col = (name, pid, i, mineSide) => {
    const g = grossOf(app, pid, h.hole);
    const dim = !hl.counts[i];
    return `<div class="rm-col"><span class="rm-cnm ellipsis${mineSide ? ' me' : ''}">${esc(name)}</span>
      <span class="rm-cm">${g == null ? '<span class="rm-dash">–</span>' : mark(g, par, 34, { cls: dim ? 'rm-dim' : '' })}</span></div>`;
  };
  const cols = [
    col(usNames[0], m.us.playerIds[0], 0, true), col(usNames[1], m.us.playerIds[1], 1, true),
    col(themNames[0], m.them.playerIds[0], 2, false), col(themNames[1], m.them.playerIds[1], 3, false),
  ].join('');
  let lines = '';
  if (hl.lowBall) {
    lines = `<div class="rm-res">${rmRes('Low ball', hl.lowBall)}${ncomp > 1 && hl.lowTotal ? rmRes('Low total', hl.lowTotal) : ''}</div>`;
  } else if (hl.need) {
    lines = `<div class="rm-need">${esc(hl.need.lead)} <span class="m">${esc(hl.need.rest)}</span></div>`;
  }

  return `<div class="rm-detail"><div class="rm-four">${cols}</div>${lines}</div>`;
}

export function ryderMatches(app) {
  const st = ryState(app);
  const myCart = app.myTeam();
  if (!st) return '';
  if (!myCart) {
    return `<div class="plain ry-matches rm"><h1 class="rm-vs">You’re watching</h1>
      <p class="rm-sub">Matches shows your own cart’s match. The Board has every match: tap one to see it.</p></div>`;
  }
  const snap = app.snapshot;
  const mine = st.matches.filter((x) => x.us.id === myCart);
  const current = mine.find((x) => x.status === 'live') || mine.find((x) => x.status === 'notStarted') || mine[mine.length - 1];
  const m = mine.find((x) => x.id === app.ui.ryMatch) || (app.ui.ryRot != null ? mine.find((x) => x.rotation === Number(app.ui.ryRot)) : null) || current;
  if (!m) return '';
  if (m.pm) return ryderMatchesLegacy(app); // Plus/Minus: out of 023's scope, keep today's screen.

  const ncomp = snap.game?.ncomp || 2;
  const live = mine.find((x) => x.status === 'live');
  const sameHoles = new Set(mine.map((x) => x.label)).size < mine.length; // 3-cart Rider: both matches are holes 1–18

  // Head: title + subline (where the groups are / final + Back to live).
  const wu = m.where.us, wt = m.where.them;
  let sub;
  if (m.status === 'done') {
    sub = `${esc(m.label)} · final`;
    if (live) sub += ` · <button class="rm-back" data-act="ry-rot" data-v="${esc(live.id)}">Back to live ›</button>`;
  } else if (m.status === 'live' && wu && wt && wu !== wt) {
    sub = `they’re on ${wt} · you’re on ${wu}`;
  } else sub = esc(m.label);

  // Rotation picker: one-line holes segments (023 §1.2), or today's "vs X" picker for a 3-cart Rider round.
  const picker = sameHoles
    ? seg2('ry-rot', mine.map((x) => [x.id, `vs ${x.them.name}`, x.status === 'live' ? 'live' : x.status === 'notStarted' ? 'up next' : `${x.result === 'won' ? 'won' : x.result === 'lost' ? 'lost' : 'halved'} ${fmtPts(Math.max(...x.holePts))}–${fmtPts(Math.min(...x.holePts))}`, { live: x.status === 'live' }]), m.id)
    : `<div class="rm-seg" role="group">${mine.map((x) => rmSeg(x, m.id, live?.id)).join('')}</div>`;

  const card = rmCard(m, snap);

  // Hole strip, with 023 §4 "new since you last looked": holes counted here since your last visit get
  // a dashed ring and a staggered pop; the seen set is recorded (in mount) once they've been shown.
  const now = Date.now();
  const selHole = Number(app.ui.ryHole?.[m.id]) || defaultHole(m);
  const seenMx = local.get(`glb.seen.${app.code}.mx`) || {};
  const countedNow = m.holes.filter((x) => x.counts).map((x) => x.hole);
  const prevSeen = seenMx[m.id];
  const newHoles = prevSeen === undefined ? [] : countedNow.filter((x) => !prevSeen.includes(x)); // first visit: no rings
  const popHoles = newHoles.slice(-4); // at most 4 animate; older new tiles just show the ring
  const motionKey = `${m.id}:${countedNow.join(',')}`;
  if (app.ui.rmKey !== motionKey) { app.ui.rmKey = motionKey; app.ui.rmT0 = now; }
  const t0 = app.ui.rmT0;
  app.ui.rm = { matchId: m.id, counted: countedNow, newHoles, t0 }; // mount reads this to record the seen set
  const strip = rmStrip(m, selHole, 'ry-hole', { newHoles, popHoles, t0 });

  const h = m.holes.find((x) => x.hole === selHole) || m.holes[0];
  const detail = rmDetail(app, m, h);

  return `<div class="plain ry-matches rm">
      <div class="rm-head">
        <h1 class="rm-vs ellipsis">vs <span${tint(m.them)}>${esc(cartTitle(m.them))}</span></h1>
        <div class="rm-sub">${sub}</div>
      </div>
      ${picker}
      ${card}
      ${strip}
      ${detail}
    </div>`;
}

export const ryderActions = {
  'ry-match': (el, ev, app) => app.openSheet('ryder-match', { id: el.dataset.v }),
  'ry-sheet-hole': (el, ev, app) => app.openSheet('ryder-match', { id: el.dataset.m, hole: el.dataset.v }),
  'ry-fold': (el, ev, app) => {
    const st = ryState(app);
    const r = st.rotations[Number(el.dataset.v)];
    const anyLiveOrDone = st.rotations.some((x) => x.status !== 'future');
    const now = (app.ui.ryFold || {})[r.index] ?? (!anyLiveOrDone && r.index === 0);
    app.ui.ryFold = { ...(app.ui.ryFold || {}), [r.index]: !now };
    app.render();
  },
  'ry-share': async (el, ev, app) => {
    // 019: the result line + the recap's leaderboard image through the share sheet; else copy the line.
    const st = ryderState(app.snapshot, app.myTeam());
    const text = resultLine(app, st);
    try {
      const { recapImages } = await import('./recap.js');
      const [img] = await recapImages(app);
      const blob = await new Promise((r) => img.canvas.toBlob(r, 'image/png'));
      const file = blob ? new File([blob], 'team-ryder-cup.png', { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file], text })) { await navigator.share({ files: [file], text }); return; }
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const ok = await copyText(text);
    app.toast({ title: ok ? 'Result copied' : text });
  },
  'ry-rot': (el, ev, app) => { app.ui.ryMatch = el.dataset.v; app.ui.ryRot = null; app.render(); },
  'ry-hole': (el, ev, app) => { app.ui.ryHole = { ...(app.ui.ryHole || {}), [el.dataset.m]: Number(el.dataset.v) }; app.render(); },
};
