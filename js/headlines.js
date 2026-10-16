// headlines.js — PURE. Replays the round's scores in the order they were entered
// (updated_at) and reports the big moments (ARCHITECTURE.md 7.10). Every phone
// replays the same rows, so every phone gets the same headlines — nothing is stored.
//
// All headlines come from the OFFICIAL standings (holes every foursome has finished).

import { compute, fmtPts, fmtToPar, posOf, HOLES } from './scoring.js';

/** Thresholds — tune after Friday. */
export const HEADLINE_CONFIG = {
  match: { comebackCut: 3, comebackWindow: 4, comebackMaxGap: 2, matchupDeficit: 3, streakAt: [3, 5, 6] },
  plusMinus: { comebackCut: 4, comebackWindow: 4, comebackMaxGap: 2, matchupDeficit: 4, streakAt: [3, 5, 6] },
};

/** Lower = more important. If several fire for one team on one hole, only the top one is a banner. */
export const PRIORITY = {
  roundFinal: 0, leadChange: 1, comeback: 2, matchupComeback: 3, matchupClinched: 4, streak: 5, matchupFinal: 6,
};

const time = (r) => Date.parse(r.updated_at) || 0;

/**
 * Returns headlines oldest → newest:
 * { id, type, priority, teams, hole, text, at, primary }
 */
export function replayHeadlines(event, scores) {
  if (!compute(event, []).game) return [];
  const rows = (scores || [])
    .filter((r) => r && r.strokes != null)
    .slice()
    .sort((a, b) => time(a) - time(b) || String(a.player_id).localeCompare(String(b.player_id)) || a.hole - b.hole);
  const state = { lastOfficial: 0, lastLeader: null, comebackAt: new Map() };
  const out = [];
  const seen = new Set();
  const applied = [];
  for (const row of rows) {
    applied.push(row);
    const snap = compute(event, applied);
    const produced = step(snap, state, row.updated_at || null).filter((h) => !seen.has(h.id));
    markPrimary(produced);
    for (const h of produced) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      out.push(h);
    }
  }
  return out;
}

function step(snap, st, at) {
  const g = snap.game;
  const cur = snap.officialThrough;
  const produced = [];
  if (cur > st.lastOfficial) {
    for (let h = st.lastOfficial + 1; h <= cur; h++) produced.push(...atHole(snap, st, h, at));
    st.lastOfficial = cur;
  } else if (cur < st.lastOfficial) {
    st.lastOfficial = cur; // a score was cleared; holes get re-checked when the line moves again
  } else if (cur > 0) {
    // A correction inside the official range can still change who leads.
    const lc = leadChange(snap, st, valuesAt(g, cur), cur, at);
    if (lc) produced.push(lc);
  }
  return produced;
}

function cfgFor(g) {
  return g.type === 'rotationPlusMinus' ? HEADLINE_CONFIG.plusMinus : HEADLINE_CONFIG.match;
}

/** Each team's standing value through play-order position h (points, or capped Plus/Minus). */
function valuesAt(g, h) {
  const v = {};
  for (const t of g.teamIds) v[t] = 0;
  for (const m of g.matches) {
    for (const t of m.teams) {
      let pts = 0, raw = 0;
      for (const hh of m.holes) {
        if (!hh.complete || hh.pos > h) continue;
        pts += hh.points[t];
        raw += hh.margin[t];
      }
      if (g.type === 'rotationPlusMinus') v[t] += g.cap != null ? Math.max(-g.cap, Math.min(g.cap, raw)) : raw;
      else v[t] += pts;
    }
  }
  return v;
}

function ranked(vals) {
  return Object.keys(vals).sort((a, b) => vals[b] - vals[a] || a.localeCompare(b));
}

const name = (snap, t) => snap.teamById.get(t)?.name || t;
const fmtVal = (g, n) => (g.type === 'rotationPlusMinus' ? fmtToPar(n) : fmtPts(n));

function mk(type, teams, hole, text, at) {
  return { id: `${type}:${teams.join('-')}:${hole}`, type, priority: PRIORITY[type], teams, hole, text, at, primary: false };
}

function leadChange(snap, st, vals, h, at) {
  const order = ranked(vals);
  const leader = order.length > 1 && vals[order[0]] > vals[order[1]] ? order[0] : null;
  let out = null;
  if (leader && st.lastLeader && leader !== st.lastLeader) {
    out = mk('leadChange', [leader], h, `${name(snap, leader)} takes the lead`, at);
  }
  if (leader) st.lastLeader = leader;
  return out;
}

function atHole(snap, st, h, at) {
  const g = snap.game;
  const cfg = cfgFor(g);
  const isPM = g.type === 'rotationPlusMinus';
  const produced = [];
  const vals = valuesAt(g, h);

  // Lead change
  const lc = leadChange(snap, st, vals, h, at);
  if (lc) produced.push(lc);

  // Comeback: cut the gap to the team directly ahead by N+ within the window, gap now ≤ maxGap.
  const order = ranked(vals);
  for (let i = 1; i < order.length; i++) {
    const t = order[i], u = order[i - 1];
    const gapNow = vals[u] - vals[t];
    if (gapNow > cfg.comebackMaxGap) continue;
    let gapMax = -Infinity;
    for (let j = Math.max(0, h - cfg.comebackWindow); j < h; j++) {
      const pv = valuesAt(g, j);
      gapMax = Math.max(gapMax, pv[u] - pv[t]);
    }
    if (gapMax - gapNow < cfg.comebackCut) continue;
    const key = `${t}>${u}`;
    if (st.comebackAt.has(key) && h - st.comebackAt.get(key) < cfg.comebackWindow) continue;
    st.comebackAt.set(key, h);
    const unit = isPM ? ' strokes' : '';
    const leadOrGap = order[0] === u ? 'the lead' : `the gap to ${name(snap, u)}`;
    const text =
      gapNow <= 0
        ? `${name(snap, t)} is coming back — erased a ${fmtPts(gapMax)}${isPM ? '-stroke' : '-point'} deficit`
        : `${name(snap, t)} is coming back — cut ${leadOrGap} from ${fmtPts(gapMax)} to ${fmtPts(gapNow)}${unit}`;
    produced.push(mk('comeback', [t, u], h, text, at));
  }

  // Matchup-level headlines for the matchups being played on this hole.
  for (const m of g.matches) {
    if (h < m.from || h > m.to) continue;
    const [x, y] = m.teams;
    const diffAt = (j) => {
      // x's lead in the matchup after hole j (points, or raw strokes for Plus/Minus)
      let d = 0;
      for (const hh of m.holes) if (hh.complete && hh.pos <= j) d += isPM ? hh.margin[x] : hh.points[x] - hh.points[y];
      return d;
    };
    const dNow = diffAt(h), dPrev = diffAt(h - 1);

    // Matchup comeback: was down by the threshold, now level or ahead.
    for (const [t, sign] of [[x, 1], [y, -1]]) {
      const now = sign * dNow, prev = sign * dPrev;
      if (now < 0 || prev >= 0) continue;
      let worst = 0;
      for (let j = m.from - 1; j < h; j++) worst = Math.min(worst, sign * diffAt(j));
      if (-worst >= cfg.matchupDeficit) {
        const other = t === x ? y : x;
        produced.push(
          mk('matchupComeback', [t, other], m.id, `${name(snap, t)} erased a ${fmtPts(-worst)}-${isPM ? 'stroke' : 'point'} hole vs ${name(snap, other)}`, at)
        );
      }
    }

    // Matchup clinched (Match Play): lead bigger than the points left, with holes still to play.
    if (!isPM) {
      const left = (m.to - h) * g.ncomp;
      if (left > 0 && Math.abs(dNow) > left) {
        const t = dNow > 0 ? x : y, o = t === x ? y : x;
        const n = m.to - h;
        produced.push(
          mk('matchupClinched', [t, o], m.id, `${name(snap, t)} clinched vs ${name(snap, o)} with ${n} hole${n === 1 ? '' : 's'} to play`, at)
        );
      }
    }

    // Matchup final
    if (h === m.to) {
      let text;
      if (isPM) {
        const cm = g.cap != null ? Math.max(-g.cap, Math.min(g.cap, dNow)) : dNow;
        text = cm === 0
          ? `${name(snap, x)} and ${name(snap, y)} halved`
          : `${name(snap, cm > 0 ? x : y)} beat ${name(snap, cm > 0 ? y : x)} by ${Math.abs(cm)}`;
      } else {
        const px = m.holes.reduce((a, hh) => a + (hh.complete ? hh.points[x] : 0), 0);
        const py = m.holes.reduce((a, hh) => a + (hh.complete ? hh.points[y] : 0), 0);
        text = px === py
          ? `${name(snap, x)} and ${name(snap, y)} halved ${fmtPts(px)}–${fmtPts(py)}`
          : px > py
            ? `${name(snap, x)} beat ${name(snap, y)} ${fmtPts(px)}–${fmtPts(py)}`
            : `${name(snap, y)} beat ${name(snap, x)} ${fmtPts(py)}–${fmtPts(px)}`;
      }
      produced.push(mk('matchupFinal', [x, y], m.id, text, at));
    }
  }

  // Streak: swept every point (Match Play) / lowest team score (Plus/Minus), N holes running.
  const swept = (t, j) => {
    const slot = g.pointsByHole[snap.order[j - 1] - 1]; // j is a play-order position
    if (!slot || slot.points[t] == null) return false;
    if (isPM) return g.teamIds.every((o) => o === t || (slot.total[o] != null && slot.total[t] < slot.total[o]));
    return slot.points[t] >= g.ncomp - 1e-9;
  };
  for (const t of g.teamIds) {
    let len = 0;
    for (let j = h; j >= 1 && swept(t, j); j--) len++;
    if (!cfg.streakAt.includes(len)) continue;
    const verb = isPM ? 'posted the low team score' : g.ncomp > 1 ? 'swept' : 'won';
    const perfect = len === 6 && snap.settings.rotation.some((r) => r.holes[0] === h - 5 && r.holes[1] === h);
    produced.push(mk('streak', [t], `${h - len + 1}+${len}`, `${name(snap, t)} ${verb} ${len} straight${perfect ? ' — a perfect rotation' : ''}`, at));
  }

  // Round final
  if (h === HOLES && snap.roundComplete) {
    const top = g.standings.filter((s) => s.rank === 1);
    const v = (s) => (isPM ? fmtToPar(s.officialPm) : fmtPts(s.officialPoints));
    const text =
      top.length === 1
        ? `Final: ${name(snap, top[0].teamId)} win the day ${isPM ? 'at' : 'with'} ${v(top[0])}`
        : `Final: ${top.map((s) => name(snap, s.teamId)).join(' and ')} share the day ${isPM ? 'at' : 'with'} ${v(top[0])}`;
    produced.push(mk('roundFinal', top.map((s) => s.teamId), h, text, at));
  }
  return produced;
}

/** At most one banner per team per hole; the rest go to the feed only. */
function markPrimary(list) {
  list.sort((a, b) => a.priority - b.priority);
  const used = new Set();
  for (const h of list) {
    if (h.type === 'roundFinal' || !h.teams.some((t) => used.has(t))) {
      h.primary = true;
      h.teams.forEach((t) => used.add(t));
    }
  }
}

/**
 * Matchup alerts for the two carts in a matchup, shown right after "Next hole →"
 * (Match Play only). Returns { kind: 'lockIn' | 'closeItOut', text } or null.
 */
export function matchupAlert(snap, teamId, nextHole) {
  const g = snap.game;
  if (!g || g.type !== 'rotationMatch' || !teamId) return null;
  const pos = posOf(snap.settings, nextHole);
  const m = g.matches.find((mm) => mm.teams.includes(teamId) && pos >= mm.from && pos <= mm.to);
  if (!m || m.final || m.clinchedBy) return null;
  const opp = m.teams[0] === teamId ? m.teams[1] : m.teams[0];
  const d = m.points[opp] - m.points[teamId]; // > 0 means we're behind
  const L = m.left;
  const H = g.ncomp;
  const unit = g.halves > 0 ? 0.5 : 1;
  const isMultiple = (x) => Math.abs(x / unit - Math.round(x / unit)) < 1e-9;
  const smallestAbove = (v) => {
    let x = Math.floor(v / unit + 1e-9) * unit;
    while (x <= v + 1e-9) x += unit;
    return x;
  };
  const f = fmtPts;
  if (d > 0) {
    if (!(d <= L && L <= d + 1)) return null;
    const halveX = (d + L) / 2;
    const canHalve = isMultiple(halveX) && halveX <= L;
    const winX = smallestAbove(halveX);
    const canWin = winX <= L + 1e-9;
    let text = null;
    if (canHalve && canWin) {
      text = Math.abs(winX - L) < 1e-9
        ? `Lock in — you need ${f(halveX)} of the last ${f(L)} points to halve, all ${f(L)} to win`
        : `Lock in — you need ${f(winX)} of the last ${f(L)} points to win this matchup`;
    } else if (canHalve) {
      text = `Lock in — win out to halve: you need all ${f(L)} points left`;
    } else if (canWin) {
      text = Math.abs(winX - L) < 1e-9
        ? `Lock in — win out: you need all ${f(L)} points left to win this matchup`
        : `Lock in — you need ${f(winX)} of the last ${f(L)} points to win this matchup`;
    }
    return text ? { kind: 'lockIn', text, matchId: m.id, hole: nextHole } : null;
  }
  if (d < 0) {
    const lead = -d;
    const x = Math.max(unit, smallestAbove((L - lead) / 2));
    if (x > H + 1e-9) return null;
    let text;
    if (Math.abs(x - H) < 1e-9) text = H === 1 ? 'Close it out — win this hole to clinch' : 'Close it out — sweep this hole to clinch';
    else if (Math.abs(x * 2 - H) < 1e-9) text = 'Close it out — halve this hole to clinch';
    else text = `Close it out — take ${f(x)} on this hole to clinch`;
    return { kind: 'closeItOut', text, matchId: m.id, hole: nextHole };
  }
  return null;
}
