// playfor.js — PURE. Brief 031 §2.1: what the Board and Matches show follows who you play for.
// Reads only what rounds already store (game ids and settings never change; only what the screens call them).
//
//   ryder     Team Ryder Cup (16 players)                         unchanged screens
//   partners  2v2, partners switch (pairSwitch six / turn)         Yourself
//   cart      Partner “Rider” Cup: 4 carts of 2, or 3 carts for 6  Your cart
//   oneMatch  2v2, partners and opponents the same all day         Your cart, one match
//   alone     split point (settings.solo, 2–6)                     Yourself, no partner (the race)
//   stroke    no game (scorecard only, any number)                 Nobody, just your score
//   legacy    anything else (old shapes): today's screens

import { isRider } from './riderview.js';
import { fmtPts } from './scoring.js';

export function playFor(snap) {
  const st = snap?.settings || {};
  const g = snap?.game;
  if (st.ryder || g?.sides) return 'ryder';
  if (!g) return 'stroke';
  if (g.type === 'splitPoint') return 'alone';
  if (st.pairs) return st.pairSwitch === 'six' || st.pairSwitch === 'turn' ? 'partners' : 'oneMatch';
  if (isRider(snap)) return 'cart';
  return 'legacy';
}

/** What the Game step and the top bar call a round (031 §2.3). */
export function gameName(snap) {
  const v = playFor(snap);
  return v === 'ryder' ? 'Team Ryder Cup' : v === 'alone' ? 'Everyone alone' : v === 'stroke' ? 'Stroke play' : '2v2';
}

export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const list = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * The short place headline (031 §2.1): { place: '3rd' | 'T3', detail: '6 back of Mike + Tyler' }.
 * rows: best first, each { id, name, rank, value } (rank shared on ties). `ahead(a, b)` = how far a is ahead of b
 * (positive); `fmt` formats it. No `meId` on the list (watching): the leader's name and how far clear.
 */
export function placeLine(rows, meId, { fmt = fmtPts, ahead = (a, b) => a.value - b.value } = {}) {
  if (!rows.length) return { place: '', detail: '' };
  const leaders = rows.filter((r) => r.rank === rows[0].rank);
  const next = rows.find((r) => r.rank > rows[0].rank);
  const me = rows.find((r) => r.id === meId);
  if (!me) {
    if (leaders.length > 1) return { place: 'Tied', detail: list(leaders.map((r) => r.name)) };
    return { place: leaders[0].name, detail: next ? `leads by ${fmt(ahead(leaders[0], next))}` : 'leads' };
  }
  const tied = rows.filter((r) => r.rank === me.rank).length > 1;
  const place = tied ? `T${me.rank}` : ordinal(me.rank);
  if (me.rank === rows[0].rank) {
    if (tied) return { place, detail: `level with ${list(leaders.filter((r) => r !== me).map((r) => r.name))}` };
    return { place, detail: next ? `${fmt(ahead(me, next))} ahead of ${next.name}` : '' };
  }
  return { place, detail: `${fmt(ahead(leaders[0], me))} back of ${list(leaders.map((r) => r.name))}` };
}

/** Partners switch: stretches (matches) each player has won, ½ for a halved one. { pid: n } */
export function stretchesWon(snap) {
  const out = Object.fromEntries(snap.players.map((p) => [p.id, 0]));
  for (const m of snap.game?.matches || []) {
    if (!m.final) continue;
    for (const t of m.teams) {
      const v = m.result === 'halved' ? 0.5 : m.result === t ? 1 : 0;
      for (const pid of snap.teamById.get(t)?.playerIds || []) out[pid] += v;
    }
  }
  return out;
}
