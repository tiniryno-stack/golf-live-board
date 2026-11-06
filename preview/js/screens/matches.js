// matches.js — the showpiece (designspec §3). "MATCH 2 OF 3 · LIVE / vs Fore Play" header, one
// segment per match (opponent + color dot, holes, short result "1–6 · L"), the big score, a
// points bar with the clinch line, and a Hole · Low Ball · Low Total · Pts table. The other match
// in the round expands IN PLACE: yours collapses to a pinned green bar ("YOUR MATCH · Hogan's 5–3
// Fore Play"), theirs opens below in an outlined "WATCHING" box in its own colors only. Never a
// separate screen (people confuse it with their own score). Split point keeps its own view.

import { esc, seg, seg2, icon, foldIn, mark, syncMotion } from '../ui.js';
import { local } from '../db.js';
import { ryderMatches, ryderActions } from './ryder.js';
import { isRider } from '../riderview.js';
import { raceState, holeShares, holeOutcomes, showStakes } from '../race.js';
import { fmtPts, fmtSigned, rotationIndexFor, holeAt, HOLES, playOrder, sideOn, sideOf, matchSidePoints } from '../scoring.js';
import { teamColor, shortTeam, sideColor } from '../teams.js';

/** The matches to switch between: yours (one per rotation, or two at once with 3 carts), or each
 *  rotation's first match when you're watching. [{ ri, m, my }] */
function matchList(app) {
  const g = app.snapshot.game;
  const out = [];
  g.rotations.forEach((r, ri) => {
    const my = mineIn(app, ri);
    const mine = my ? r.matches.filter((m) => m.teams.includes(my)) : [];
    if (mine.length) mine.forEach((m) => out.push({ ri, m, my }));
    else out.push({ ri, m: r.matches[0], my: null });
  });
  return out;
}

/** Index into matchList: the one tapped, else the first match of the rotation being played now. */
function pickMatch(app, list) {
  const snap = app.snapshot;
  if (app.ui.matchesRot != null && app.ui.matchesRot < list.length) return app.ui.matchesRot;
  const hole = app.me ? app.nextHole() || holeAt(snap.settings, HOLES) : holeAt(snap.settings, Math.min(HOLES, snap.officialThrough + 1));
  const ri = Math.max(0, rotationIndexFor(snap.settings, hole));
  return Math.max(0, list.findIndex((e) => e.ri === ri));
}

/** Your side in a rotation (2v2: your pairing changes with the rotation). */
function mineIn(app, ri) {
  const snap = app.snapshot;
  if (!app.me) return null;
  if (snap.settings.pairs) return sideOn(snap, app.me, holeAt(snap.settings, snap.game.rotations[ri].from));
  return app.myTeam();
}

function colorFor(app, mine, t) {
  const snap = app.snapshot;
  if (snap.settings.pairs) return t === mine ? 'var(--cart-you)' : mine ? 'var(--t-B)' : teamColor(null, t);
  return teamColor(mine, t);
}

function sides(m, mine) {
  return m.teams.includes(mine) ? [mine, m.teams.find((t) => t !== mine)] : [m.teams[0], m.teams[1]];
}

function counters(g, m, left) {
  const right = m.teams.find((t) => t !== left);
  if (g.type === 'rotationPlusMinus') return [fmtSigned(m.margin[left], 'E'), fmtSigned(m.margin[right], 'E')];
  return [fmtPts(m.points[left]), fmtPts(m.points[right])];
}

/** "1–6 · W" / "7–12 · LIVE" / "13–18" from your side. */
function segSub(app, g, m, left) {
  const range = `${m.firstHole}–${m.lastHole}`;
  if (m.final) return [`${range} · ${m.result === 'halved' ? 'H' : m.result === left ? 'W' : 'L'}`, false];
  if (m.played) return [`${range} · LIVE`, true];
  return [range, false];
}

/** Points bar: your points fill from the left in your color, theirs from the right; clinch line in the middle. */
function pointsBar(app, g, m, left, lc, rc, h) {
  const right = m.teams.find((t) => t !== left);
  const n = m.total * g.ncomp;
  const L = g.type === 'rotationPlusMinus' ? 0 : m.points[left], R = g.type === 'rotationPlusMinus' ? 0 : m.points[right];
  const cells = Array.from({ length: n }, (_, i) => {
    const lf = Math.max(0, Math.min(1, L - i));
    const rf = Math.max(0, Math.min(1, R - (n - 1 - i)));
    return `<i class="pb-cell"><b class="l" style="width:${lf * 100}%;background:${lc}"></b><b class="r" style="width:${rf * 100}%;background:${rc}"></b></i>`;
  }).join('');
  return `<div class="pbar" style="--h:${h}px">${cells}<span class="pb-mid"></span></div>`;
}

function statusPair(app, g, m, left, yours = false) {
  const snap = app.snapshot;
  const right = m.teams.find((t) => t !== left);
  const name = (t) => shortTeam(snap.teamById.get(t).name);
  if (g.type === 'rotationPlusMinus') {
    const v = m.margin[left];
    if (m.final) return [v === 0 ? 'Halved' : `${name(v > 0 ? left : right)} won by ${Math.abs(v)}`, ''];
    return [m.played ? `${fmtSigned(v, 'even')} thru ${m.played}` : 'Not started', `${m.total - m.played} holes left`];
  }
  const a = m.points[left], b = m.points[right];
  const plus = g.bonus ? ` · +${fmtPts(g.bonus)} ${a === b ? 'split' : 'win'}` : '';
  if (m.final) return [a === b ? `Halved ${fmtPts(a)}–${fmtPts(b)}` : `${name(a > b ? left : right)} won ${fmtPts(Math.max(a, b))}–${fmtPts(Math.min(a, b))}`, plus.replace(/^ · /, '')];
  if (m.clinchedBy) return [`${fmtPts(m.left)} pts left`, `${name(m.clinchedBy)} clinched it`];
  const n = m.total * g.ncomp;
  const unit = g.halves > 0 ? 0.5 : 1;
  const target = n / 2 + unit;
  const lead = a >= b ? left : right;
  const need = Math.max(0, target - Math.max(a, b));
  const who = yours && lead === left ? '' : `${name(lead)} needs `;
  return [`${fmtPts(m.left)} pt${m.left === 1 ? '' : 's'} left`, m.played ? `${who}${fmtPts(need)} more ${who ? 'to clinch' : 'clinches it'}` : `${fmtPts(target)} clinches it`];
}

/** 012: the score card's kicker — "THRU 4 · YOU'RE UP 2" / "YOU'RE DOWN 1" / "ALL SQUARE" (a team's
 *  name instead of "you're" when watching another match). Plus/Minus counts strokes the same way. */
function standingLine(app, g, m, left, yours) {
  const snap = app.snapshot;
  const right = m.teams.find((t) => t !== left);
  const name = (t) => shortTeam(snap.teamById.get(t).name).toUpperCase();
  const thru = m.final ? 'FINAL' : m.played ? `THRU ${m.played}` : 'UP NEXT';
  const diff = g.type === 'rotationPlusMinus' ? m.margin[left] : m.points[left] - m.points[right];
  if (diff === 0) return `${thru} · ALL SQUARE`;
  const who = yours ? 'YOU’RE' : name(diff > 0 ? left : right);
  const by = g.type === 'rotationPlusMinus' ? Math.abs(diff) : fmtPts(Math.abs(diff));
  return `${thru} · ${who} ${yours ? (diff > 0 ? 'UP' : 'DOWN') : 'UP'} ${by}`;
}

/** Hole · Low Ball · Low Total · Pts, one row per hole of the matchup. */
function table(app, g, m, left, lc, rc, liveHole) {
  const snap = app.snapshot;
  const right = m.teams.find((t) => t !== left);
  const names = g.ncomp === 2 ? ['Low ball', 'Low total'] : [snap.settings.teamScore === 'aggregate' ? 'Total' : 'Best ball'];
  const cell = (hh, k) => {
    if (!hh.complete) {
      const live = hh.hole === liveHole;
      return `<span class="tc"><i class="td ${live ? 'live' : 'none'}"></i><span class="soft">${live ? 'Live' : '–'}</span></span>`;
    }
    const cl = hh.comps[left][k], cr = hh.comps[right][k];
    if (cl === cr) return '<span class="tc"><i class="td push"></i><span class="soft">Push</span></span>';
    const w = cl < cr ? left : right;
    return `<span class="tc"><i class="td" style="background:${w === left ? lc : rc}"></i><span style="color:${w === left ? lc : rc}">${esc(shortTeam(snap.teamById.get(w).name))}</span></span>`;
  };
  const pts = (hh) => {
    if (!hh.complete) return hh.hole === liveHole ? 'now' : '–';
    if (g.type === 'rotationPlusMinus') return fmtSigned(hh.margin[left], 'E');
    return `${fmtPts(hh.points[left])}–${fmtPts(hh.points[right])}`;
  };
  const cols = `grid-template-columns:44px repeat(${g.ncomp},minmax(0,1fr)) 64px`;
  return `<div class="mtable">
    <div class="mt-row mt-head mono" style="${cols}"><span>HOLE</span>${names.map((n) => `<span>${n.toUpperCase()}</span>`).join('')}<span class="r">${g.type === 'rotationPlusMinus' ? '+/−' : 'PTS'}</span></div>
    ${m.holes.map((hh) => `<button class="mt-row" style="${cols}" data-act="match-hole" data-m="${m.id}" data-h="${hh.hole}" aria-label="Hole ${hh.hole}">
      <span><b class="mono">${hh.hole}</b><small> p${snap.holes[hh.hole - 1].par}</small></span>
      ${Array.from({ length: g.ncomp }, (_, k) => cell(hh, k)).join('')}
      <span class="r mono pts">${pts(hh)}</span></button>`).join('')}
  </div>`;
}

function playersOf(app, t) {
  const snap = app.snapshot;
  return snap.teamById.get(t).playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
}

/** The hole being played in a matchup right now (first one not complete), for the "Live" mark. */
function liveHoleOf(m) {
  if (m.final) return null;
  return m.holes.find((hh) => !hh.complete)?.hole ?? null;
}

/** Before anyone has a score: the matchups and "Waiting for the first scores", not 0–0 (designspec §6b). */
function waitingView(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const list = matchList(app);
  const mineAny = list.some((e) => e.my);
  const items = (mineAny ? list : g.rotations.flatMap((r, ri) => r.matches.map((m) => ({ ri, m, my: null }))))
    .map(({ m, my }) => {
      const name = (t) => `<span style="color:${colorFor(app, my, t)}">${esc(shortTeam(snap.teamById.get(t).name))}</span>`;
      const opp = my ? m.teams.find((t) => t !== my) : null;
      const who = opp ? `vs ${name(opp)}<small>${esc(playersOf(app, opp))}</small>` : `${name(m.teams[0])} <span class="soft">vs</span> ${name(m.teams[1])}`;
      return `<div class="mu-item"><span class="mi-h">${m.firstHole}–${m.lastHole}</span><span class="mi-v">${who}</span></div>`;
    }).join('');
  return `<div class="plain wait">
      <div class="ts-label wait-k">Before the first tee</div>
      <h1 class="ts-title wait-t">Waiting for the first scores</h1>
      <p class="wait-p">Matchups fill in as soon as anyone enters hole 1.</p>
      <div class="ts-label wait-k">${mineAny ? 'Your matchups' : 'Matchups'}</div>
      <div class="mu-list">${items}</div>
    </div>`;
}

export function teamGameView(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const list = matchList(app);
  const sel = pickMatch(app, list);
  const { ri, m: hero, my: mine } = list[sel];
  const rot = g.rotations[ri];
  // ALSO / WATCHING: the matches in this rotation you're not in (yours are segments).
  const others = rot.matches.filter((m) => m !== hero && !(mine && m.teams.includes(mine)));
  const [left, right] = sides(hero, mine);
  const lc = colorFor(app, mine, left), rc = colorFor(app, mine, right);
  const [cl, cr] = counters(g, hero, left);
  const watching = !!app.ui.watchOther && others.length > 0;
  const name = (t) => snap.teamById.get(t).name;

  // One segment per match: yours (or each rotation's first match when watching).
  const segs = list.map(({ ri: i, m, my }, k) => {
    const [l, rr] = sides(m, my);
    const [sub, live] = segSub(app, g, m, l);
    const label = my ? shortTeam(name(rr)) : `Rot ${i + 1}`;
    return [String(k), label, sub, { dot: my ? colorFor(app, my, rr) : '', live }];
  });
  const state = hero.final ? 'FINAL' : hero.played ? 'LIVE' : 'UP NEXT';
  const [st1, st2] = statusPair(app, g, hero, left, !!mine);
  const head = mine
    ? `<div class="m-kicker mono">MATCHES · MATCH ${sel + 1} OF ${list.length} · ${state}</div>
       <div class="m-title">vs <span style="color:${rc}">${esc(name(right))}</span></div>
       <div class="m-sub">${esc(playersOf(app, right))} · holes ${hero.firstHole} → ${hero.lastHole}</div>`
    : `<div class="m-kicker mono">MATCHES · ROTATION ${ri + 1} OF ${g.rotations.length} · ${state}</div>
       <div class="m-title"><span style="color:${lc}">${esc(shortTeam(name(left)))}</span> <span class="soft">vs</span> <span style="color:${rc}">${esc(shortTeam(name(right)))}</span></div>
       <div class="m-sub">holes ${hero.firstHole} → ${hero.lastHole}</div>`;
  const heroFull = `<div class="m-hero">${head}
      ${segs.length > 1 ? seg2('matches-rot', segs, String(sel)) : ''}
      <div class="m-card">
        <div class="m-kicker mono">${esc(standingLine(app, g, hero, left, !!mine))}</div>
        <div class="m-score">
          <div class="ms-side r"><div style="color:${lc}">${esc(shortTeam(name(left)))}</div><small>${mine ? 'you' : esc(playersOf(app, left))}</small></div>
          <div class="ms-num mono"><span style="color:${lc}">${esc(cl)}</span><span class="dash">–</span><span style="color:${rc}">${esc(cr)}</span></div>
          <div class="ms-side"><div style="color:${rc}">${esc(shortTeam(name(right)))}</div><small>${mine ? 'them' : esc(playersOf(app, right))}</small></div>
        </div>
        ${g.type === 'rotationPlusMinus' ? '' : pointsBar(app, g, hero, left, lc, rc, 18)}
        <div class="m-line"><b>${esc(st1)}</b><span class="soft">${esc(st2)}</span></div>
      </div>
      ${table(app, g, hero, left, lc, rc, liveHoleOf(hero))}
    </div>`;
  const mineBar = `<button class="mine-bar${foldIn(app.ui)}" style="--fold-h:80px" data-act="match-mine">
      <span style="flex:1;min-width:0"><span class="mb-k">${mine ? 'YOUR MATCH' : `ROTATION ${ri + 1}`} · ${hero.final ? 'FINAL' : `THRU ${hero.played}`}</span>
      <span class="mb-t ellipsis"><span style="color:${lc}">${esc(shortTeam(name(left)))}</span> <span class="mono">${esc(cl)}–${esc(cr)}</span> <span style="color:${rc}">${esc(shortTeam(name(right)))}</span></span></span>
      ${icon('fwd', 18).replace('<svg', '<svg style="transform:rotate(90deg)"')}</button>`;

  const otherBoxes = others.map((m) => {
    const [l, r] = sides(m, null);
    const oc = colorFor(app, null, l), od = colorFor(app, null, r);
    const [a, b] = counters(g, m, l);
    const [o1, o2] = statusPair(app, g, m, l);
    const body = watching
      ? `<div class="wb-body${foldIn(app.ui)}" style="--fold-h:700px">
          <div class="spread meta"><span class="ellipsis">${esc(playersOf(app, l))} vs ${esc(playersOf(app, r))}</span><span class="mono">${m.final ? 'final' : `thru ${m.played}`}</span></div>
          <div class="m-score small">
            <div class="ms-side r" style="color:${oc}">${esc(shortTeam(name(l)))}</div>
            <div class="ms-num mono"><span style="color:${oc}">${esc(a)}</span><span class="dash">–</span><span style="color:${od}">${esc(b)}</span></div>
            <div class="ms-side" style="color:${od}">${esc(shortTeam(name(r)))}</div>
          </div>
          ${g.type === 'rotationPlusMinus' ? '' : pointsBar(app, g, m, l, oc, od, 12)}
          <div class="m-line small"><b>${esc(o1)}</b><span class="soft">${esc(o2)}</span></div>
          <div class="wb-table">${table(app, g, m, l, oc, od, liveHoleOf(m))}</div>
        </div>`
      : '';
    return `<div class="watch-box${watching ? ' open' : ''}">
      <button class="watch-head" data-act="match-expand" aria-expanded="${watching}">
        <span class="wk">${watching ? 'WATCHING' : 'ALSO'}</span>
        <b style="color:${oc}">${esc(shortTeam(name(l)))}</b><b class="mono">${esc(a)}–${esc(b)}</b>
        <b class="ellipsis" style="color:${od};flex:1">${esc(name(r))}</b>
        <span class="chev">${icon('fwd', 18).replace('<svg', '<svg style="transform:rotate(90deg)"')}</span>
      </button>${body}</div>`;
  }).join('');

  return `<div class="plain matches-nr">
      ${watching ? mineBar : heroFull}
      ${otherBoxes}
    </div>`;
}

// ───────────────────────────────────────────── Team Ryder Cup (sides, 1 point a match)

/** "Team Andrew 5½ · Team Josh 4½" as a score card, with the matches-left line. Board + Matches share it. */
export function ryderScoreCard(app, { big = true } = {}) {
  const snap = app.snapshot;
  const g = snap.game;
  const [a, b] = ['1', '2'].map((id) => g.sides.find((s) => s.sideId === id));
  const mine = sideOf(app.myTeam());
  const ac = sideColor('1'), bc = sideColor('2');
  const n = a.total;
  const cells = Array.from({ length: n }, (_, i) => {
    const lf = Math.max(0, Math.min(1, a.points - i));
    const rf = Math.max(0, Math.min(1, b.points - (n - 1 - i)));
    return `<i class="pb-cell"><b class="l" style="width:${lf * 100}%;background:${ac}"></b><b class="r" style="width:${rf * 100}%;background:${bc}"></b></i>`;
  }).join('');
  const prov = a.provisionalPoints || b.provisionalPoints;
  const line = snap.roundComplete
    ? a.points === b.points ? 'Shared · 6–6 is a tie' : `${(a.points > b.points ? a : b).name} win the cup`
    : a.clinched || b.clinched
      ? `${(a.clinched ? a : b).name} have clinched it`
      : `${a.left} match${a.left === 1 ? '' : 'es'} left`;
  const sub = snap.roundComplete ? '' : `${fmtPts(a.toWin)} wins the cup${prov ? ' · provisional points counted' : ''}`;
  const kicker = `${snap.roundComplete ? 'FINAL' : snap.officialThrough ? `OFFICIAL THRU ${snap.officialHole}` : 'NOT STARTED'} · ${n} MATCHES`;
  return `<div class="m-card ryder-card">
      <div class="m-kicker mono">${esc(kicker)}</div>
      <div class="m-score${big ? '' : ' small'}">
        <div class="ms-side r"><div style="color:${ac}">${esc(a.name)}</div><small>${mine === '1' ? 'your side' : `${a.matchesWon}-${a.matchesLost}-${a.matchesHalved}`}</small></div>
        <div class="ms-num mono"><span style="color:${ac}">${fmtPts(a.points)}</span><span class="dash">–</span><span style="color:${bc}">${fmtPts(b.points)}</span></div>
        <div class="ms-side"><div style="color:${bc}">${esc(b.name)}</div><small>${mine === '2' ? 'your side' : `${b.matchesWon}-${b.matchesLost}-${b.matchesHalved}`}</small></div>
      </div>
      <div class="pbar" style="--h:${big ? 18 : 12}px">${cells}<span class="pb-mid"></span></div>
      <div class="m-line"><b>${esc(line)}</b><span class="soft">${esc(sub)}</span></div>
    </div>`;
}

/** One match as a row: carts (side colors), the score, who it went to; open = the hole table underneath. */
function ryderMatchRow(app, m, open) {
  const snap = app.snapshot;
  const g = snap.game;
  const mine = app.myTeam();
  const [x, y] = m.teams;
  const name = (t) => snap.teamById.get(t)?.name || t;
  const xc = teamColor(mine, x), yc = teamColor(mine, y);
  const sp = matchSidePoints(m);
  const winner = sp ? Object.keys(sp).find((k) => sp[k] === 1) : null;
  const lead = m.points[x] - m.points[y];
  let status;
  if (m.final) status = lead === 0 ? 'Halved' : `${shortTeam(name(lead > 0 ? x : y))} won ${fmtPts(Math.max(m.points[x], m.points[y]))}–${fmtPts(Math.min(m.points[x], m.points[y]))}`;
  else if (m.clinchedBy) status = `${shortTeam(name(m.clinchedBy))} clinched · thru ${m.played}`;
  else if (!m.played) status = 'Up next';
  else status = lead === 0 ? `All square thru ${m.played}` : `${shortTeam(name(lead > 0 ? x : y))} ${fmtPts(Math.abs(lead))} up thru ${m.played}`;
  const went = sp
    ? `<span class="ry-side" style="color:${winner ? sideColor(winner) : 'var(--ink-soft)'}"><i class="jdot" style="--jersey:${winner ? sideColor(winner) : 'var(--ink-soft)'}"></i>${winner ? esc(g.sides.find((s) => s.sideId === winner)?.name || '') : '½ each'}${m.final ? '' : ' · prov.'}</span>`
    : '';
  const me = m.teams.includes(mine);
  const body = open
    ? `<div class="wb-body${foldIn(app.ui)}" style="--fold-h:700px"><div class="wb-table">${table(app, g, m, me ? mine : x, me ? teamColor(mine, mine) : xc, me ? teamColor(mine, m.teams.find((t) => t !== mine)) : yc, liveHoleOf(m))}</div></div>`
    : '';
  return `<div class="watch-box ry-match${open ? ' open' : ''}${me ? ' me' : ''}">
    <button class="watch-head" data-act="ryder-match" data-v="${esc(m.id)}" aria-expanded="${open}">
      <span class="ry-main">
        <span class="ry-names"><b style="color:${xc}">${esc(name(x))}</b><b class="mono ry-score">${fmtPts(m.points[x])}–${fmtPts(m.points[y])}</b><b style="color:${yc}">${esc(name(y))}</b></span>
        <span class="ry-sub"><span>${esc(status)}${me ? ' · <b class="good-ink">YOU</b>' : ''}</span>${went}</span>
      </span>
      <span class="chev">${icon('fwd', 18).replace('<svg', '<svg style="transform:rotate(90deg)"')}</span>
    </button>${body}</div>`;
}

/** Matches tab: side score, then the matches by rotation; your cart's match first in each. */
export function ryderMatchesView(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const mine = app.myTeam();
  const open = app.ui.ryderOpen;
  const groups = g.rotations.map((r) => {
    const ms = [...r.matches].sort((p, q) => (q.teams.includes(mine) ? 1 : 0) - (p.teams.includes(mine) ? 1 : 0));
    return `<div class="lbl nr-lbl">${esc(r.label)}${r.matches.some((m) => !m.final && m.played) ? ' · LIVE' : r.matches.every((m) => m.final) ? ' · FINAL' : ''}</div>
      <div class="ry-list">${ms.map((m) => ryderMatchRow(app, m, open === m.id)).join('')}</div>`;
  }).join('');
  return `<div class="plain matches-nr ryder">
      <div class="m-hero"><div class="m-kicker mono">MATCHES · TEAM RYDER CUP</div>${ryderScoreCard(app)}</div>
      ${groups}
    </div>`;
}

/** Split point (2–6 players, each their own): totals up top, then a hole-by-hole table of who
 *  took the point and how it split. Kept simple on purpose. */
/** "The race" (feature 002-matches-race): individual split point, 2–6 players. Math + copy in race.js. */
let lastLock = null;
function splitView(app) {
  const snap = app.snapshot;
  const st = snap.settings;
  const g = snap.game;
  const order = playOrder(st);
  const ids = snap.teams.map((t) => t.id);
  const name = (t) => snap.teamById.get(t)?.name || t;
  const me = app.myTeam();
  const raceHoles = order.map((h) => ({ hole: h, scores: g.holes[h - 1].complete ? g.holes[h - 1].net : {} }));
  const r = raceState({
    players: ids.map((id) => ({ id, name: name(id) })),
    holes: raceHoles,
    me, lastHole: order[HOLES - 1],
  });
  // Inset track (feature 004): 0 and 18 sit 20px in from each end, so pucks and the lock line never touch the edge.
  const frac = (v) => Math.max(0, Math.min(HOLES, v)) / HOLES;
  const pos = (v) => `calc(20px + (100% - 40px) * ${frac(v)})`;
  const span = (v) => `calc((100% - 40px) * ${frac(v)})`;
  const anchor = (v) => (frac(v) > 0.78 ? ' right' : frac(v) < 0.22 ? ' left' : '');
  // Lock line slides from where it was to where it is now (the screen redraws, so animate by hand).
  const lockTo = r.done && !r.finished ? Math.min(HOLES, r.lock) : null;
  const lockFrom = lastLock != null && lockTo != null && lastLock !== lockTo ? lastLock : lockTo;
  if (lockFrom !== lockTo) requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector('.rc-lock');
    if (el) el.style.setProperty('--at', String(lockTo / HOLES));
  }));
  lastLock = lockTo;
  const lanes = r.rows.map((row) => {
    const puck = `<span class="rc-puck mono${row.me ? ' me' : ''}" style="left:${pos(row.points)}">${fmtPts(row.points)}</span>`;
    const tail = row.reach ? `<i class="rc-tail" style="left:${pos(row.reach[0])};width:${span(row.reach[1] - row.reach[0])}"></i>` : '';
    return `<div class="rc-lane${row.out ? ' out' : ''}">
      <div class="rc-who"><div class="rc-name ellipsis${row.me ? ' me' : ''}">${esc(row.name)}</div><div class="rc-rank mono">${row.rankLabel}</div></div>
      <div class="rc-track"><i class="rc-rail"></i><i class="rc-fill${row.me ? ' me' : ''}" style="width:${span(row.points)}"></i>${tail}${puck}</div>
    </div>`;
  }).join('');
  const chaser = r.chaser ? (r.chaser === me ? 'you' : name(r.chaser)) : '';
  const lock = lockTo != null
    ? `<div class="rc-lock" style="--at:${lockFrom / HOLES}"><span class="rc-lock-l mono${anchor(lockTo)}">LOCK ${fmtPts(r.lock)}</span></div>` : '';
  const explain = r.done < 6 && !r.finished && r.chaser
    ? `<p class="rc-explain">The <b>lock line</b> is the most ${esc(chaser)} can still reach. Get past it and the match is yours. Dashes show how far each player can still climb.</p>` : '';
  // Bottom card (feature 003-race-bottom): Points by hole, or What this hole does when it matters.
  const args = { players: ids.map((id) => ({ id, name: name(id) })), holes: raceHoles, me, lastHole: order[HOLES - 1] };
  let bottom;
  if (showStakes(args)) {
    const h = order[r.done];
    const rows = holeOutcomes(args).map((o) => `<div class="hs-row"><span class="hs-l">${esc(o.label)}</span><span class="hs-r mono${o.good ? ' good' : ''}">${esc(o.result)}</span></div>`).join('');
    bottom = `<div class="race-card race-bottom"><div class="rb-head mono"><span>WHAT HOLE ${h} DOES</span><span>PAR ${snap.holes[h - 1].par} · 1 PT</span></div>${rows}</div>`;
  } else {
    const shares = holeShares(raceHoles, ids);
    const rows = r.rows.map((row) => `<div class="pb-row">
      <span class="pb-n ellipsis${row.me ? ' me' : ''}">${esc(row.name)}</span>
      <span class="pb-cells">${shares[row.id].map((v) => (v == null ? '<i class="pb-c open"></i>' : `<i class="pb-c"><b class="${row.me ? 'me' : ''}" style="height:${Math.round(v * 100)}%"></b></i>`)).join('')}</span>
      <span class="pb-t mono${row.me ? ' me' : ''}">${fmtPts(row.points)}</span></div>`).join('');
    bottom = `<div class="race-card race-bottom"><div class="rb-head mono"><span>POINTS BY HOLE</span><span>${r.done} OF ${HOLES} PLAYED</span></div>
      ${rows}<div class="pb-axis mono"><span>1</span><span>9</span><span>18</span></div>
      <p class="pb-legend">Full = won alone · Half = split 2 ways · Quarter = 4 ways</p></div>`;
  }
  return `<div class="plain race">
      <div class="race-top">
        <div class="race-kick"><span class="ts-label mono">MATCHES · SPLIT POINT · ${r.finished ? 'FINAL' : `THRU ${r.done}`}</span></div>
        <h1 class="race-h">${esc(r.headline)}</h1><p class="race-sub">${esc(r.subline)}</p>
      </div>
      <div class="race-card">
        <div class="rc-lanes">${lock}${lanes}</div>
        <div class="rc-axis mono"><span>0</span><span>9</span><span>18</span></div>
        ${explain}
      </div>
      ${bottom}
    </div>`;
}

export default {
  hero: true,

  // 023 §4: keep the "new since you last looked" motion in sync across redraws, and record which holes
  // have now been shown (2s after they appear, or at once on the first visit) so they stop ringing.
  mount(root, app) {
    syncMotion(root);
    const rm = app.ui.rm;
    if (!rm || !root.querySelector('.rm-strip')) return;
    const key = `glb.seen.${app.code}.mx`;
    const commit = () => { const s = local.get(key) || {}; s[rm.matchId] = rm.counted; local.set(key, s); };
    const prev = (local.get(key) || {})[rm.matchId];
    const changed = prev === undefined || rm.counted.some((h) => !prev.includes(h)) || prev.some((h) => !rm.counted.includes(h));
    if (!changed) return;
    if (!rm.newHoles.length) { commit(); return; } // first visit / nothing new: record the baseline now
    if (app.ui.rmCommitAt !== rm.t0) {
      app.ui.rmCommitAt = rm.t0;
      setTimeout(() => { commit(); app.render(); }, 2200); // after the rings have shown and faded
    }
  },

  render(app) {
    const snap = app.snapshot;
    const g = snap.game;
    if (!g) {
      const n = snap.players.length;
      const casual = !(snap.roster.teams || []).length && n >= 2 && n <= 6;
      const why = casual
        ? ` The organizer can turn on Match play under ${app.isOrganizer() ? '<b>Host</b> → Rules' : 'Host → Rules'}: 1 point a hole, a tie for low splits it. It counts back from hole 1.`
        : [3, 4].includes(snap.roster.teams?.length) ? '' : ' (Partner “Rider” Cup needs carts of 2)';
      return `<div class="plain"><h1 class="title">Matches</h1>
        <p class="soft">No game on this round.${why} The live leaderboard is on the Board.</p>
        ${casual && app.isOrganizer() ? '<button class="btn block" style="margin:0 0 10px" data-act="tab" data-v="host">Turn on Match play</button>' : ''}
        <button class="btn primary block" data-act="tab" data-v="board">See the Board</button></div>`;
    }
    if (g.type === 'splitPoint') return splitView(app);
    if (g.sides || isRider(snap)) return ryderMatches(app); // Team Ryder Cup (015 §3) and Partner “Rider” Cup (018 §4)
    if (!snap.anyPosted && !app.isFinal()) return waitingView(app);
    return teamGameView(app);
  },

  actions: {
    ...ryderActions,
    'ryder-match': (el, ev, app) => {
      app.ui.ryderOpen = app.ui.ryderOpen === el.dataset.v ? null : el.dataset.v;
      app.ui.foldAt = Date.now();
      app.render();
    },
    'matches-rot': (el, ev, app) => {
      app.ui.matchesRot = Number(el.dataset.v);
      app.ui.watchOther = false;
      app.ui.foldAt = Date.now();
      app.render();
    },
    'match-expand': (el, ev, app) => {
      app.ui.watchOther = !app.ui.watchOther;
      app.ui.foldAt = Date.now();
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'match-mine': (el, ev, app) => {
      app.ui.watchOther = false;
      app.render();
    },
    'match-hole': (el, ev, app) => app.openSheet('hole', { matchId: el.dataset.m, hole: Number(el.dataset.h) }),
  },
};
