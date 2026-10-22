// matches.js — the showpiece (designspec §3). "MATCH 2 OF 3 · LIVE / vs Fore Play" header, one
// segment per match (opponent + color dot, holes, short result "1–6 · L"), the big score, a
// points bar with the clinch line, and a Hole · Low Ball · Low Total · Pts table. The other match
// in the round expands IN PLACE: yours collapses to a pinned green bar ("YOUR MATCH · Hogan's 5–3
// Fore Play"), theirs opens below in an outlined "WATCHING" box in its own colors only. Never a
// separate screen (people confuse it with their own score). Split point keeps its own view.

import { esc, seg, seg2, icon, foldIn, mark } from '../ui.js';
import { raceState } from '../race.js';
import { fmtPts, fmtSigned, rotationIndexFor, holeAt, HOLES, playOrder, sideOn } from '../scoring.js';
import { teamColor, shortTeam } from '../teams.js';

/** The matches to switch between: yours (one per rotation, or two at once with 3 carts), or each
 *  rotation's first match when you're watching. [{ ri, m, my }] */
/** Matches → Rules, on every game type: a filled secondary button, top right, easy to spot. */
const RULES_BTN = '<div class="m-rules"><button class="btn small" data-act="rules-open" aria-label="Rules of today’s game">Rules</button></div>';

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
      ${RULES_BTN}
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
    ? `<div class="m-kicker mono">MATCH ${sel + 1} OF ${list.length} · ${state}</div>
       <div class="m-title">vs <span style="color:${rc}">${esc(name(right))}</span></div>
       <div class="m-sub">${esc(playersOf(app, right))} · holes ${hero.firstHole} → ${hero.lastHole}</div>`
    : `<div class="m-kicker mono">ROTATION ${ri + 1} OF ${g.rotations.length} · ${state}</div>
       <div class="m-title"><span style="color:${lc}">${esc(shortTeam(name(left)))}</span> <span class="soft">vs</span> <span style="color:${rc}">${esc(shortTeam(name(right)))}</span></div>
       <div class="m-sub">holes ${hero.firstHole} → ${hero.lastHole}</div>`;
  const heroFull = `<div class="m-hero">${head}
      ${segs.length > 1 ? seg2('matches-rot', segs, String(sel)) : ''}
      <div class="m-score">
        <div class="ms-side r"><div style="color:${lc}">${esc(shortTeam(name(left)))}</div><small>${mine ? 'you' : esc(playersOf(app, left))}</small></div>
        <div class="ms-num mono"><span style="color:${lc}">${esc(cl)}</span><span class="dash">–</span><span style="color:${rc}">${esc(cr)}</span></div>
        <div class="ms-side"><div style="color:${rc}">${esc(shortTeam(name(right)))}</div><small>${mine ? 'them' : esc(playersOf(app, right))}</small></div>
      </div>
      ${g.type === 'rotationPlusMinus' ? '' : pointsBar(app, g, hero, left, lc, rc, 18)}
      <div class="m-line"><b>${esc(st1)}</b><span class="soft">${esc(st2)}</span></div>
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
      ${RULES_BTN}
      ${watching ? mineBar : heroFull}
      ${otherBoxes}
    </div>`;
}

/** Split point (2–6 players, each their own): totals up top, then a hole-by-hole table of who
 *  took the point and how it split. Kept simple on purpose. */
/** "The race" (handoff golf-race-tabbar/02): individual split point, 2–6 players. Math + copy in race.js. */
let lastLock = null;
function splitView(app) {
  const snap = app.snapshot;
  const st = snap.settings;
  const g = snap.game;
  const order = playOrder(st);
  const ids = snap.teams.map((t) => t.id);
  const name = (t) => snap.teamById.get(t)?.name || t;
  const me = app.myTeam();
  const r = raceState({
    players: ids.map((id) => ({ id, name: name(id) })),
    holes: order.map((h) => ({ hole: h, scores: g.holes[h - 1].complete ? g.holes[h - 1].net : {} })),
    me, lastHole: order[HOLES - 1],
  });
  const pct = (v) => `${(Math.max(0, Math.min(HOLES, v)) / HOLES) * 100}%`;
  // Lock line slides from where it was to where it is now (the screen redraws, so animate by hand).
  const lockTo = r.done && !r.finished ? Math.min(HOLES, r.lock) : null;
  const lockFrom = lastLock != null && lockTo != null && lastLock !== lockTo ? lastLock : lockTo;
  if (lockFrom !== lockTo) requestAnimationFrame(() => requestAnimationFrame(() => {
    const el = document.querySelector('.rc-lock');
    if (el) el.style.setProperty('--at', String(lockTo / HOLES));
  }));
  lastLock = lockTo;
  const lanes = r.rows.map((row) => {
    const puck = `<span class="rc-puck mono${row.me ? ' me' : ''}" style="left:${pct(row.points)}">${fmtPts(row.points)}</span>`;
    const tail = row.reach ? `<i class="rc-tail" style="left:${pct(row.reach[0])};width:calc(${pct(row.reach[1] - row.reach[0])})"></i>` : '';
    return `<div class="rc-lane${row.out ? ' out' : ''}">
      <div class="rc-who"><div class="rc-name ellipsis${row.me ? ' me' : ''}">${esc(row.name)}</div><div class="rc-rank mono">${row.rankLabel}</div></div>
      <div class="rc-track"><i class="rc-rail"></i><i class="rc-fill${row.me ? ' me' : ''}" style="width:${pct(row.points)}"></i>${tail}${puck}</div>
    </div>`;
  }).join('');
  const chaser = r.chaser ? (r.chaser === me ? 'you' : name(r.chaser)) : '';
  const lock = lockTo != null
    ? `<div class="rc-lock" style="--at:${lockFrom / HOLES}"><span class="rc-lock-l mono">LOCK ${fmtPts(r.lock)}</span></div>` : '';
  const explain = r.done < 6 && !r.finished && r.chaser
    ? `<p class="rc-explain">The <b>lock line</b> is the most ${esc(chaser)} can still reach. Get past it and the match is yours. Dashes show how far each player can still climb.</p>` : '';
  // Now: your group's hole, everyone's score so far (dashed circle = not in yet). Tap → Enter.
  let now = '';
  if (!r.finished && app.me) {
    const h = app.nextHole();
    const par = snap.holes[h - 1].par;
    const cells = r.rows.map((row) => {
      const p = snap.playerById.get(snap.teamById.get(row.id)?.playerIds?.[0]);
      const v = p?.gross[h - 1];
      return `<div class="nw-p"><div class="nw-n ellipsis${row.me ? ' me' : ''}">${esc(row.name)}</div>${v != null ? mark(v, par, 30) : '<span class="nw-empty"></span>'}</div>`;
    }).join('');
    now = `<button class="race-now" data-act="tab" data-v="enter" aria-label="Hole ${h}: go to Enter">
      <span class="nw-head mono"><span>NOW · HOLE ${h} · PAR ${par}</span><b>1 PT UP FOR GRABS</b></span>
      <span class="nw-grid" style="grid-template-columns:repeat(${r.rows.length},minmax(0,1fr))">${cells}</span></button>`;
  }
  return `<div class="plain race">
      <div class="race-top">
        <div class="race-title"><div class="ts-label mono">SPLIT POINT · ${r.finished ? 'FINAL' : `THRU ${r.done}`}</div>
          <h1 class="race-h">${esc(r.headline)}</h1><p class="race-sub">${esc(r.subline)}</p></div>
        <button class="btn ghost race-rules" data-act="rules-open" aria-label="Rules of today’s game">${icon('info', 18)} Rules</button>
      </div>
      <div class="race-card">
        <div class="rc-lanes">${lock}${lanes}</div>
        <div class="rc-axis mono"><span>0</span><span>9</span><span>18</span></div>
        ${explain}
      </div>
      ${now}
    </div>`;
}

export default {
  hero: true,

  render(app) {
    const snap = app.snapshot;
    const g = snap.game;
    if (!g) {
      const n = snap.players.length;
      const casual = !(snap.roster.teams || []).length && n >= 2 && n <= 6;
      const why = casual
        ? ` The organizer can turn on Match play under ${app.isOrganizer() ? '<b>Host</b> → Rules' : 'Host → Rules'}: 1 point a hole, a tie for low splits it. It counts back from hole 1.`
        : [3, 4].includes(snap.roster.teams?.length) ? '' : ' (Partner “Rider” Cup needs carts of 2)';
      return `<div class="plain">${RULES_BTN}<h1 class="title">Matches</h1>
        <p class="soft">No game on this round.${why} The live leaderboard is on the Board.</p>
        ${casual && app.isOrganizer() ? '<button class="btn block" style="margin:0 0 10px" data-act="tab" data-v="host">Turn on Match play</button>' : ''}
        <button class="btn primary block" data-act="tab" data-v="board">See the Board</button></div>`;
    }
    if (g.type === 'splitPoint') return splitView(app);
    if (!snap.anyPosted && !app.isFinal()) return waitingView(app);
    return teamGameView(app);
  },

  actions: {
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
