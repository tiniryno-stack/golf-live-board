// ryder.js — Team Ryder Cup screens (handoff 015): Board (cup card, cup bar, rotations, flags),
// the read-only match sheet, and Matches (rotation picker, score card, hole strip, hole detail).
// All numbers and copy come from scoring.ryderState (pure); this file only draws.

import { esc, icon, seg, seg2, mark } from '../ui.js';
import { fmtPts, fmtToPar, playerLeaderboard, projectedGross, ryderState, ryderMyMatch, ryderNeedLine, ryderHoleLine, teeTimeName } from '../scoring.js';

export const ryState = (app) => ryderState(app.snapshot, app.myTeam());

// ───────────────────────────────────────────── shared pieces

/** Two first names stacked (015 §1). */
const names = (cart, cls = '') => `<span class="ry-nm ${cls}">${cart.names.map((n) => `<span class="ellipsis">${esc(n)}</span>`).join('')}</span>`;

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
  const [u, t] = m.holePts;
  return `<div class="ry-mbar${green ? '' : ' plain'}"><div class="ry-mtrack"><b class="us" style="width:${(u / 12) * 100}%"></b><b class="them" style="width:${(t / 12) * 100}%"></b><i class="ry-mline"></i></div></div>`;
}

/** The dot: solid = counted, hatched = one cart in, dashed = nobody yet. Drawn SVG, no gradients. */
export function dot(state, who, { green = true } = {}) {
  const us = green ? 'var(--cart-you)' : 'var(--text)', them = 'var(--text-muted)';
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
function holeStrip(m, sel, act, o = {}) {
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
    return `<div class="ry-mk"><span class="ry-mk-n ellipsis${you ? ' you' : ''}">${esc(cart.names[i])}</span>${mark(g, par, 32, { ghost: g == null ? par : null })}</div>`;
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
      <span class="ry-tally mono"><b class="you">${fmtPts(r.tally.us)}</b> – ${fmtPts(r.tally.them)}</span>${tag}`;
  return `<section class="ry-rot ${r.status}">
      ${r.status === 'future' ? `<button class="ry-strip-h" data-act="ry-fold" data-v="${r.index}" aria-expanded="${open}">${head}</button>` : `<div class="ry-strip-h">${head}</div>`}
      ${open ? `<div class="ry-rows">${r.matches.map((m) => row(app, m, myCart)).join('')}</div>` : ''}</section>`;
}

/** Board → Cup view for a Team Ryder Cup. */
export function ryderBoard(app, { segs = '', players = '' } = {}) {
  const st = ryState(app);
  if (!st) return '';
  const myCart = app.myTeam();
  const anyLiveOrDone = st.rotations.some((r) => r.status !== 'future');
  const opened = app.ui.ryFold || {};
  const isOpen = (r) => r.status !== 'future' || (opened[r.index] ?? (!anyLiveOrDone && r.index === 0));
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
      ${view === 'players' ? players : st.order.map((r) => rotation(app, r, isOpen(r), myCart)).join('')}</div>`;
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

export function ryderMatchSheet(app, { id, hole }) {
  const st = ryState(app);
  const m = st?.matches.find((x) => x.id === id);
  if (!m) return '';
  const h = m.holes.find((x) => x.hole === Number(hole)) || m.holes.find((x) => x.hole === defaultHole(m));
  const status = m.status === 'done' ? 'FINAL' : m.status === 'live' ? 'LIVE' : 'UP NEXT';
  const [u, t] = m.holePts;
  const side = (cart, n, loser, cls) => `<div class="ry-ms-s ${cls}"><div class="ry-sn ellipsis">${esc(cart.names.join(' + '))}</div>
      <div class="ry-ms-n"><span class="ry-num mono${loser ? ' muted' : ''}">${fmtPts(n)}</span><i class="ry-sdot ${cls}"></i></div></div>`;
  const val = (k, side) => {
    const v = h.net[side];
    if (v.some((x) => x == null)) return '–';
    return k === 'lowBall' ? Math.min(...v) : v[0] + v[1];
  };
  const detail = `<div class="ry-hls">${['lowBall', 'lowTotal'].map((k) => `<div class="ry-hl">${dotFor(h, k, { green: false })}<span>${k === 'lowBall' ? 'Low ball' : 'Low total'} · <span class="mono">${val(k, 'us')} v ${val(k, 'them')}</span></span></div>`).join('')}</div>`;
  return `<div class="ry-sheet">
      <div class="lbl">HOLES ${esc(m.label.replace(/^Holes /, ''))} · ${status}</div>
      <div class="ry-ms-top">${side(m.us, u, m.result === 'lost', 'l')}${side(m.them, t, m.result === 'won', 'r')}</div>
      ${matchBar(m, { green: false })}
      <div class="ry-bl"><span class="meta">${esc(m.barLine || '')}</span><span class="lbl">6½ CLINCHES</span></div>
      ${holeStrip(m, h.hole, 'ry-sheet-hole', { green: false })}
      <div class="ry-hd"><div class="ry-hd-h"><b>Hole ${h.hole}</b><span class="meta"> · par ${h.par}</span></div>
        <div class="ry-marks">${marks(app, m.us, h.hole, h.par)}${marks(app, m.them, h.hole, h.par)}</div>
        ${detail}</div>
    </div>`;
}

// ───────────────────────────────────────────── Matches (my match)

export function ryderMatches(app) {
  const st = ryState(app);
  const myCart = app.myTeam();
  if (!st) return '';
  if (!myCart) {
    return `<div class="plain ry-matches"><div class="lbl">MATCHES</div><h1 class="title">You’re watching</h1>
      <p class="meta">Matches shows your own cart’s match. The Board has every match: tap one to see it.</p></div>`;
  }
  const mine = [0, 1, 2].map((r) => ryderMyMatch(st, myCart, r)).filter(Boolean);
  const pick = app.ui.ryRot != null ? Number(app.ui.ryRot) : (ryderMyMatch(st, myCart)?.rotation ?? 0);
  const m = mine.find((x) => x.rotation === pick) || mine[0];
  if (!m) return '';
  const sub = (x) => (x.status === 'live' ? 'live' : x.status === 'notStarted' ? 'up next'
    : `${x.result === 'won' ? 'won' : x.result === 'lost' ? 'lost' : 'halved'} ${fmtPts(Math.max(...x.holePts))}–${fmtPts(Math.min(...x.holePts))}`);
  const picker = seg2('ry-rot', mine.map((x) => [String(x.rotation), x.label.replace(/^Holes /, ''), sub(x), { live: x.status === 'live' }]), String(m.rotation));
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
  const lines = `<div class="ry-hls">${['lowBall', 'lowTotal'].map((k) => `<div class="ry-hl">${dotFor(h, k)}<span>${esc(ryderHoleLine(k, h[k]) || `${k === 'lowBall' ? 'Low ball' : 'Low total'} · –`)}</span></div>`).join('')}</div>
        ${!h.points && need ? `<div class="ry-hl meta">${esc(need)}</div>` : ''}`;
  return `<div class="plain ry-matches">
      <div class="lbl">HOLES ${esc(m.label.replace(/^Holes /, ''))} · ${kick}</div>
      <h1 class="title ry-vs ellipsis">vs ${esc(m.them.names.join(' + '))}</h1>
      <div class="meta">${esc(where)}</div>
      <div class="ry-picker">${picker}</div>
      <div class="ry-card">
        <div class="lbl${m.status === 'notStarted' ? '' : ' you'}">${esc(m.kicker)}</div>
        <div class="ry-ms-top">
          <div class="ry-ms-s l"><div class="ry-sn you ellipsis">${esc(m.us.names.join(' + '))}</div><div class="ry-num you mono">${fmtPts(u)}</div></div>
          <div class="ry-ms-s r"><div class="ry-sn ellipsis">${esc(m.them.names.join(' + '))}</div><div class="ry-num muted mono">${fmtPts(t)}</div></div>
        </div>
        ${matchBar(m)}
        <div class="ry-bl"><span class="meta">${esc(m.barLine || '')}</span><span class="lbl">6½ CLINCHES</span></div>
      </div>
      ${holeStrip(m, h.hole, 'ry-hole')}
      <div class="ry-legend small">${dot('solid', 'us')} counted ${dot('hatched')} one cart in ${dot('dashed')} nobody yet</div>
      <div class="ry-hd"><div class="ry-hd-h"><b>Hole ${h.hole}</b><span class="meta"> · par ${h.par}</span>${ptsLine}</div>
        <div class="ry-marks">${marks(app, m.us, h.hole, h.par, { you: true })}${marks(app, m.them, h.hole, h.par)}</div>
        ${lines}</div>
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
  'ry-rot': (el, ev, app) => { app.ui.ryRot = Number(el.dataset.v); app.render(); },
  'ry-hole': (el, ev, app) => { app.ui.ryHole = { ...(app.ui.ryHole || {}), [el.dataset.m]: Number(el.dataset.v) }; app.render(); },
};
