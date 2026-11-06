// riderview.js — PURE. Partner “Rider” Cup (game `carts`) on the Team Ryder Cup screens (handoff 018).
// No engine change: this reads snapshot.game.matches (computeGame) and reshapes each match into the
// same fields scoring.ryderState gives the 015 screens, plus cart names and colors.
// Differences from Team Ryder Cup, on purpose: hole points keep adding up after a match is decided
// (they are the cart's standings points), a match is "done" only when all its holes are in, and the
// matchup win bonus (when on) is shown as one line.

import { fmtPts, holeAt, groupIndex, teeClock, HOLES } from './scoring.js';
import { teamColor } from './teams.js';

const ORD = ['1st', '2nd', '3rd', '4th'];

/** True for a Partner “Rider” Cup round (4 carts of 2, or 3 carts for 6). */
export function isRider(snap) {
  const st = snap?.settings;
  if (!snap?.game || !st || st.ryder || st.pairs || st.solo || snap.game.type === 'splitPoint') return false;
  const n = (snap.roster?.teams || []).length;
  return n === 3 || n === 4;
}

function cartInfo(snap, tid, myTeam) {
  const ps = snap.players.filter((p) => p.teamId === tid);
  const first = (p) => p.firstName || String(p.name || '').split(' ')[0];
  let pos = null;
  for (let q = 1; q <= HOLES; q++) {
    const h = holeAt(snap.settings, q);
    if (ps.some((p) => p.gross[h - 1] == null)) { pos = q; break; }
  }
  return {
    id: tid, name: snap.teamById.get(tid)?.name || tid, names: ps.map(first), playerIds: ps.map((p) => p.id),
    tee: groupIndex(ps[0]?.groupId), pos, hole: pos ? holeAt(snap.settings, pos) : null, started: ps.some((p) => p.thru > 0),
    color: teamColor(myTeam, tid), you: tid === myTeam,
  };
}

const cmp = (a, b) => (a < b ? 'us' : b < a ? 'them' : 'halved');

function riderMatch(snap, m, myTeam, carts, g) {
  const [x, y] = m.teams;
  const usId = m.teams.includes(myTeam) ? myTeam : x, themId = usId === x ? y : x;
  const us = carts.get(usId), them = carts.get(themId);
  const net = (pid, h) => snap.playerById.get(pid).net[h - 1];
  const holes = m.holes.map((hh) => {
    const h = hh.hole;
    const u = us.playerIds.map((id) => net(id, h)), t = them.playerIds.map((id) => net(id, h));
    const uIn = u.every((v) => v != null), tIn = t.every((v) => v != null);
    const whoIsIn = uIn && tIn ? 'both' : uIn ? 'us' : tIn ? 'them' : 'none';
    const out = { hole: h, pos: hh.pos, par: snap.course.par[h - 1], whoIsIn, lowBall: 'pending', lowTotal: 'pending', net: { us: u, them: t }, points: null, counts: !!hh.complete };
    if (hh.complete) {
      const cu = hh.comps[usId], ct = hh.comps[themId];
      out.lowBall = cmp(cu[0], ct[0]);
      out.lowTotal = g.ncomp > 1 ? cmp(cu[1], ct[1]) : out.lowBall; // one-number team scores: both dots say the same
      out.points = { us: hh.points[usId], them: hh.points[themId] };
    }
    return out;
  });
  const holePts = [m.points[usId], m.points[themId]];
  const diff = holePts[0] - holePts[1];
  const pm = g.type === 'rotationPlusMinus';
  const lead = pm ? m.margin[usId] : diff; // Plus/Minus: strokes
  const leader = Math.abs(lead) < 1e-9 ? null : lead > 0 ? 'us' : 'them';
  const status = m.final ? 'done' : m.played > 0 ? 'live' : 'notStarted';
  const result = !m.final ? null : m.result === usId ? 'won' : m.result === themId ? 'lost' : 'halved';
  const margin = fmtPts(Math.abs(lead));
  const maxPts = m.total * g.ncomp;
  const halves = Number(snap.settings.halvedHolePoints) || 0;
  const clinchAt = halves ? maxPts / 2 + 0.5 : Math.floor(maxPts / 2) + 1;
  const hi = Math.max(...holePts), lo = Math.min(...holePts);
  const score = (a, b) => (pm ? `${a > 0 ? '+' : ''}${a}` : `${fmtPts(a)}–${fmtPts(b)}`);
  const trailing = [us, them].filter((c) => c.pos != null).sort((a, b) => a.pos - b.pos)[0] || null;
  let flag;
  if (status === 'notStarted') {
    flag = { look: 'tee', side: 'line', text: trailing && trailing.started ? `on ${trailing.hole}` : teeClock(snap.settings, us.tee) || ORD[us.tee] || `${us.tee + 1}th` };
  } else if (status === 'live') {
    flag = leader ? { look: 'up', side: leader, text: `${margin} UP` } : { look: 'tied', side: 'line', text: pm ? 'E' : score(holePts[0], holePts[1]) };
  } else {
    flag = result === 'halved' ? { look: 'halved', side: 'line', text: pm ? 'E' : score(hi, lo) } : { look: 'won', side: leader || 'line', text: pm ? `${margin} UP` : score(hi, lo) };
  }
  const kicker = status === 'notStarted' ? 'NOTHING COUNTS YET'
    : status === 'live' ? `THRU ${m.played} · ${leader === 'us' ? `YOU'RE UP ${margin}` : leader === 'them' ? `YOU'RE DOWN ${margin}` : 'ALL SQUARE'}`
    : `FINAL · ${result === 'won' ? `YOU WON ${score(hi, lo)}` : result === 'lost' ? `THEY WON ${score(hi, lo)}` : 'HALVED'}`;
  const left = (m.total - m.played) * g.ncomp;
  const barLine = pm ? null : status === 'done' ? null
    : m.clinchedBy === usId ? `Yours · ${fmtPts(left)} pts left`
    : leader === 'us' && clinchAt - holePts[0] > 0 ? `${fmtPts(clinchAt - holePts[0])} more and it's yours`
    : `${fmtPts(left)} pts left`;
  return {
    id: m.id, rotation: m.rotation - 1, label: m.label, from: m.from, to: m.to,
    us, them, status, thru: m.played, total: m.total, holePts, leader, tied: status !== 'notStarted' && !leader,
    margin: leader ? margin : null, result, decidedEarly: 0, flag, kicker, barLine, holes, pm,
    maxPts, clinchAt, bonus: g.bonus ? `+${fmtPts(g.bonus)} to the winner` : null,
    where: { us: us.hole, them: them.hole, trailing: trailing ? trailing.hole : null },
  };
}

/**
 * 023 §2: the dimming rule + every word for one hole's detail on Matches, read from the engine's hole
 * entry (never re-scored). A score counts, once all four are in, only if it wins or ties low ball or
 * low total on **net**; everything else is dimmed, and nothing is dimmed until all four are in.
 * `strokes` (optional) = [us0, us1, them0, them1] "gets a stroke on this hole" flags, so the not-counted
 * line can read "a net 4". Returns { counts:[bool×4], lowBall, lowTotal, need }, each of lowBall/lowTotal
 * being { who:'us'|'them'|'tie', text, pts } once counted (null before), and need being
 * { lead, rest } or null.
 */
export function holeLines(hole, usNames, themNames, strokes = null) {
  const u = hole.net.us, t = hole.net.them;
  const allIn = hole.whoIsIn === 'both';
  // Which of the four scores count (lit); the rest dim. Judged on net.
  const counts = [true, true, true, true];
  if (allIn) {
    counts.fill(false);
    const lu = Math.min(u[0], u[1]), lt = Math.min(t[0], t[1]);
    if (lu <= lt) { if (u[0] === lu) counts[0] = true; if (u[1] === lu) counts[1] = true; }
    if (lt <= lu) { if (t[0] === lt) counts[2] = true; if (t[1] === lt) counts[3] = true; }
    const su = u[0] + u[1], st = t[0] + t[1];
    if (su <= st) counts[0] = counts[1] = true;
    if (st <= su) counts[2] = counts[3] = true;
  }
  // Low-ball winner names = the player(s) who made the counting low; low-total names = the pair.
  const lowNames = (side) => {
    const arr = side === 'us' ? u : t, nm = side === 'us' ? usNames : themNames;
    const lo = Math.min(arr[0], arr[1]);
    return nm.filter((_, i) => arr[i] === lo).join(' + ');
  };
  const win = (res, names) => res === 'halved'
    ? { who: 'tie', text: 'Tied', pts: '½ each', mine: false }
    : { who: res, text: names, pts: '+1', mine: res === 'us' };
  const lowBall = allIn ? win(hole.lowBall, lowNames(hole.lowBall)) : null;
  const lowTotal = allIn ? win(hole.lowTotal, (hole.lowTotal === 'us' ? usNames : themNames).join(' + ')) : null;
  // The "not counted yet" line (one or the other side in, never both).
  let need = null;
  if (hole.whoIsIn === 'us') {
    need = { lead: 'Your scores are in.', rest: `${themNames.join(' + ')} haven’t posted yet.` };
  } else if (hole.whoIsIn === 'them') {
    const net = (i) => `${strokes && strokes[2 + i] ? 'a net ' : ''}${t[i]}`;
    need = { lead: `${themNames[0]} made ${net(0)}, ${themNames[1]} ${net(1)}.`, rest: `A ${Math.min(t[0], t[1])} halves low ball. ${t[0] + t[1] - 1} or better between you takes low total.` };
  }
  return { counts, lowBall, lowTotal, need };
}

/** The Team Ryder Cup screens' state for a Partner “Rider” Cup round, from the viewer's cart. */
export function riderState(snap, myTeam = null) {
  if (!isRider(snap)) return null;
  const g = snap.game;
  const carts = new Map((snap.roster.teams || []).map((t) => [t.id, cartInfo(snap, t.id, myTeam)]));
  const matches = g.matches.map((m) => riderMatch(snap, m, myTeam, carts, g));
  const ri = [...new Set(matches.map((m) => m.rotation))].sort((a, b) => a - b);
  const rotations = ri.map((r) => {
    const ms = matches.filter((m) => m.rotation === r);
    const anyScore = ms.some((m) => m.holes.some((h) => h.whoIsIn !== 'none'));
    const status = ms.every((m) => m.status === 'done') ? 'done' : ms.some((m) => m.status === 'live') || anyScore ? 'live' : 'future';
    const mine = myTeam ? ms.find((m) => m.us.id === myTeam) : null;
    // The strip's middle: thru n while live, "done", or who you play next.
    const center = status === 'live' ? `thru ${Math.max(0, ...ms.map((m) => m.thru))}` : status === 'done' ? 'done' : mine ? `vs ${mine.them.name}` : '';
    return { index: r, label: ms[0].label, holes: ms[0].label.replace(/^Holes /, ''), status, center, matches: ms };
  });
  const rank = { live: 0, done: 1, future: 2 };
  const order = [...rotations].sort((a, b) => rank[a.status] - rank[b.status] || (a.status === 'live' ? b.index - a.index : a.index - b.index));
  return { rider: true, matches, rotations, order, carts };
}
