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
  // 031: 8 players, same opponents all 18 (one 18-hole stretch, a match in each foursome) = one match each.
  if (isRider(snap)) return g.rotations.length === 1 && snap.teams.length === 4 ? 'oneMatch' : 'cart';
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

// ───────────────────────────────────────────── 031 §2.3 + 030: Setup's Game and Tee times steps (pure)

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/**
 * "Pick a game" for a player count: the shape line and only the games that fit (nothing dimmed). `id` is the
 * stored game id Setup already saves ('2v2' = 4 players, 'carts' = 2v2 with 6 or 8, 'match' = Everyone alone,
 * 'scorecard' = Stroke play, 'ryder'), so old rounds and the engine are untouched.
 */
export function gameChoices(n) {
  const tees = Math.max(1, Math.ceil(n / 4));
  const shape = { 1: 'Just you.', 2: 'A twosome.', 3: 'A threesome.', 4: 'A foursome.', 5: 'Five in one group.', 6: 'Three carts.', 8: 'Two foursomes.', 16: 'Four foursomes.' }[n]
    || `${WORDS[tees] || tees} tee times.`;
  const games = [];
  if (n === 4) games.push({ id: '2v2', name: '2v2', desc: 'You and a partner against the other two.' });
  if (n === 6) games.push({ id: 'carts', name: '2v2', tag: 'three carts', desc: 'Three carts of two. Every cart plays both others.' });
  if (n === 8) games.push({ id: 'carts', name: '2v2', desc: 'Carts of two. Each cart plays a cart.' });
  if (n === 16) games.push({ id: 'ryder', name: 'Team Ryder Cup', desc: 'Two sides. Cart vs cart, 1 point a match.' });
  if (n >= 2 && n <= 6) games.push({ id: 'match', name: 'Everyone alone', desc: 'A point a hole to the low net score.' });
  if (n >= 1) games.push({ id: 'scorecard', name: 'Stroke play', desc: 'Just the scorecard.' });
  return { shape, games };
}

/** The Game step's button: where it goes next and what it says (031 §2.3). */
export function gameNext(id) {
  if (id === '2v2') return { to: 'teams', label: 'Next: partners' };
  if (id === 'carts') return { to: 'teams', label: 'Next: carts' };
  if (id === 'ryder') return { to: 'invite', label: 'Next: carts' };
  return { to: 'tee', label: 'Next: tee times' };
}

/**
 * Who tees off together by default (030 §3), as groups of player indexes: up to 4 = one group; Everyone alone
 * with 5–6 = one group (allowed for that game); 2v2 = one group; otherwise as even as possible, 4 at most
 * (8 → 4 + 4, 5 → 3 + 2). Cart games and Team Ryder Cup group carts, not players: null.
 */
export function teeGroups(n, game) {
  if (game === 'carts' || game === 'ryder') return null;
  const all = Array.from({ length: n }, (_, i) => i);
  if (n <= 4 || game === '2v2' || (game === 'match' && n <= 6)) return [all];
  const k = Math.ceil(n / 4), base = Math.floor(n / k), extra = n % k;
  const out = [];
  let at = 0;
  for (let g = 0; g < k; g++) { const size = base + (g < extra ? 1 : 0); out.push(all.slice(at, at + size)); at += size; }
  return out;
}

/** Groups someone would play alone in (030 §3, "Sam is alone at 9:00"): indexes of groups of exactly one. */
export const aloneIn = (groups) => groups.map((g, i) => (g.length === 1 ? i : -1)).filter((i) => i >= 0);

/** A saved grouping still fits n players: every index once, nothing else (empty groups allowed). */
export function groupsFit(groups, n) {
  if (!Array.isArray(groups)) return false;
  const flat = groups.flat();
  return flat.length === n && new Set(flat).size === n && flat.every((i) => Number.isInteger(i) && i >= 0 && i < n);
}
