// race.js — pure math + headline copy for "The race" (individual split point, 2–6 players).
// Design handoff golf-race-tabbar/02 SPEC.md. No DOM, no app state: give it holes, get the race.
//
//   points:   1 a hole; the low score takes it, k tied for low get 1/k each. A hole counts only
//             once every player has a score on it.
//   left:     holes not yet complete (of `total`, 18).
//   lock:     the chaser's points + left = the most 2nd place can still reach.
//   locked:   the leader's points > lock (a lead exactly equal to `left` is NOT locked: the chaser
//             can still tie, and then the tiebreak decides).
//   out:      points + left < the leader's points (can't catch up even winning every hole left).
//   reach:    [points, min(points + left, total)] for players still alive and not leading.
//   tiebreak: level on points after the last hole → most outright wins; still level = shared.

import { fmtPts } from './scoring.js';

const EPS = 1e-9;
const eq = (a, b) => Math.abs(a - b) < EPS;

/** Points and outright wins from complete holes. holes: [{ scores: { id: n } }] (null = not entered). */
export function racePoints(holes, ids) {
  const points = Object.fromEntries(ids.map((id) => [id, 0]));
  const won = Object.fromEntries(ids.map((id) => [id, 0]));
  let done = 0;
  for (const h of holes) {
    if (!ids.every((id) => h.scores[id] != null)) continue;
    done += 1;
    const low = Math.min(...ids.map((id) => h.scores[id]));
    const winners = ids.filter((id) => h.scores[id] === low);
    for (const id of winners) points[id] += 1 / winners.length;
    if (winners.length === 1) won[winners[0]] += 1;
  }
  return { points, won, done };
}

/**
 * The race at this moment.
 * @param {object} o
 * @param {Array<{id:string,name:string}>} o.players
 * @param {Array<{hole:number, scores:Object}>} o.holes  in play order
 * @param {string|null} o.me          the person holding the phone ("You")
 * @param {number} [o.total=18]
 * @param {number} [o.lastHole]       real number of the last hole in play order ("18 decides it")
 */
export function raceState({ players, holes, me = null, total = 18, lastHole = 18 }) {
  const ids = players.map((p) => p.id);
  const name = (id) => players.find((p) => p.id === id)?.name || id;
  const { points, won, done } = racePoints(holes, ids);
  const left = Math.max(0, total - done);
  const finished = left === 0;

  // Rank by points; ties stay ties until the round is over, then most outright wins breaks them.
  const cmp = (a, b) => {
    const d = points[b] - points[a];
    if (!eq(d, 0)) return d;
    return finished ? won[b] - won[a] : 0;
  };
  const order = [...ids].sort((a, b) => cmp(a, b) || ids.indexOf(a) - ids.indexOf(b));
  const rank = {};
  order.forEach((id, i) => { rank[id] = i > 0 && cmp(order[i - 1], id) === 0 ? rank[order[i - 1]] : i + 1; });

  const leader = order[0];
  const chaser = order[1] ?? null;
  const lead = chaser ? points[leader] - points[chaser] : 0;
  const lock = chaser ? points[chaser] + left : points[leader];
  const locked = !finished && !!chaser && points[leader] > lock + EPS;
  const isOut = (id) => points[id] + left < points[leader] - EPS;

  const rows = order.map((id) => {
    const out = isOut(id);
    const tied = order.filter((o) => rank[o] === rank[id]).length > 1;
    const leading = rank[id] === 1;
    return {
      id, name: name(id), me: id === me, points: points[id], won: won[id], rank: rank[id], out,
      rankLabel: out ? 'OUT' : `${tied ? 'T' : ''}${ordinal(rank[id])}`,
      reach: !out && !leading && left ? [points[id], Math.min(points[id] + left, total)] : null,
    };
  });

  // Who went OUT on the latest hole (so the subline calls each elimination once).
  let newlyOut = [];
  if (done > 0) {
    const complete = holes.filter((h) => ids.every((id) => h.scores[id] != null));
    const before = racePoints(complete.slice(0, -1), ids);
    const leftBefore = total - before.done;
    const topBefore = Math.max(...ids.map((id) => before.points[id]));
    newlyOut = rows.filter((r) => r.out && !(before.points[r.id] + leftBefore < topBefore - EPS)).map((r) => r.id);
  }

  const state = { left, done, total, finished, locked, lock, lead, leader, chaser, points, won, rows, newlyOut, me };
  return { ...state, ...copy(state, name, lastHole) };
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

function list(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Headline + subline: the one thing that matters right now. */
export function copy(s, name, lastHole = 18) {
  const you = (id) => id === s.me;
  const who = (id) => (you(id) ? 'You' : name(id));
  const top = s.rows.filter((r) => r.rank === 1);
  const left = `${s.left} left.`;
  const outLine = () => {
    const gone = s.newlyOut.filter((id) => id !== s.leader);
    if (!gone.length || s.finished) return '';
    const names = gone.map((id) => (you(id) ? 'You' : name(id)));
    const target = you(s.leader) ? 'you' : name(s.leader);
    if (names.length === 1 && names[0] === 'You') return ` You can’t catch ${target} anymore.`;
    return ` ${list(names)} can’t catch ${target} anymore.`;
  };

  if (!s.done) return { headline: 'Nobody’s on the board yet', subline: `${s.total} holes, 1 point each. Low score takes it.` };

  if (s.finished) {
    if (top.length > 1) {
      const names = top.map((r) => r.id);
      return {
        headline: names.some(you) ? `You share the win with ${list(names.filter((id) => !you(id)).map(name))}` : `Shared win: ${list(names.map(name))}`,
        subline: `Level on points (${fmtPts(s.points[s.leader])}) and outright wins (${s.won[s.leader]}).`,
      };
    }
    const tiedOnPoints = s.chaser && eq(s.points[s.leader], s.points[s.chaser]);
    const head = you(s.leader) ? 'You win' : `${name(s.leader)} wins`;
    if (tiedOnPoints) return { headline: `${head} on outright wins (${s.won[s.leader]} to ${s.won[s.chaser]})`, subline: `Level on ${fmtPts(s.points[s.leader])} points after ${s.total}.` };
    return { headline: head, subline: `${fmtPts(s.points[s.leader])} points, ${fmtPts(s.lead)} clear after ${s.total}.` };
  }

  if (s.locked) {
    return {
      headline: you(s.leader) ? 'You’ve locked it' : `${name(s.leader)}’s locked it`,
      subline: `Up by ${fmtPts(s.lead)} with ${s.left} left.${outLine()}`,
    };
  }

  // Tied for the lead.
  if (top.length > 1) {
    const ids = top.map((r) => r.id);
    const headline = ids.some(you) ? `All square with ${list(ids.filter((id) => !you(id)).map(name))}` : `${list(ids.map(name))} are all square`;
    const subline = s.left === 1 ? `Low score on ${lastHole} takes it.` : `${left}${outLine()}`;
    return { headline: s.left === 1 ? `${lastHole} decides it` : headline, subline: s.left === 1 ? `${headline}. ${subline}` : subline };
  }

  const leadLine = `${who(s.leader)} lead${you(s.leader) ? '' : 's'} by ${fmtPts(s.lead)}`;
  if (s.left === 1) {
    const c = who(s.chaser);
    const has = you(s.chaser) ? 'have' : 'has';
    let need = `${c} ${has} to win ${lastHole} outright.`;
    if (eq(s.lead, 1)) {
      const theirs = s.won[s.chaser] + 1, ours = s.won[s.leader];
      need = theirs > ours ? `${c} ${has} to win ${lastHole} outright, then wins on outright wins.`
        : theirs === ours ? `${c} ${has} to win ${lastHole} outright to share it.`
          : `Even if ${c.toLowerCase() === 'you' ? 'you win' : `${c} wins`} ${lastHole}, outright wins go to ${you(s.leader) ? 'you' : name(s.leader)}.`;
    }
    return { headline: `${lastHole} decides it`, subline: `${leadLine}. ${need}` };
  }
  return { headline: leadLine, subline: `${left}${outLine()}` };
}

// ───────────────────────────────────────────── bottom card (handoff golf-race-bottom)

/** Each player's share of every hole in play order: 1 / ½ / ⅓ / ¼ / 0, or null while not complete. */
export function holeShares(holes, ids, total = 18) {
  const out = Object.fromEntries(ids.map((id) => [id, Array(total).fill(null)]));
  holes.slice(0, total).forEach((h, i) => {
    if (!ids.every((id) => h.scores[id] != null)) return;
    const low = Math.min(...ids.map((id) => h.scores[id]));
    const winners = ids.filter((id) => h.scores[id] === low);
    for (const id of ids) out[id][i] = winners.includes(id) ? 1 / winners.length : 0;
  });
  return out;
}

/** A complete hole where `winners` share the low score. */
const fakeHole = (ids, winners) => ({ scores: Object.fromEntries(ids.map((id) => [id, winners.includes(id) ? 3 : 4])) });

/**
 * What the hole being played does: up to 4 outcome rows, each worded from one side ("you", or the
 * leader when you're OUT or just watching). Each row: { label, result, good, winners }.
 */
export function holeOutcomes({ players, holes, me = null, total = 18, lastHole = 18 }) {
  const ids = players.map((p) => p.id);
  const name = (id) => players.find((p) => p.id === id)?.name || id;
  const complete = holes.filter((h) => ids.every((id) => h.scores[id] != null));
  const now = raceState({ players, holes: complete, me, total, lastHole });
  if (now.finished || ids.length < 2) return [];
  const meOut = !me || !ids.includes(me) || now.rows.find((r) => r.id === me)?.out;
  const side = meOut ? now.leader : me; // whose side the results are worded from
  const isYou = side === me;
  const rival = side === now.leader ? now.chaser : now.leader;
  const SIDE = isYou ? '' : `${name(side).toUpperCase()} `;
  const margin = (st) => st.points[side] - Math.max(...ids.filter((id) => id !== side).map((id) => st.points[id]));
  const m0 = margin(now);

  const result = (winners) => {
    const st = raceState({ players, holes: [...complete, fakeHole(ids, winners)], me, total, lastHole });
    const m = margin(st);
    if (st.finished) {
      const top = st.rows.filter((r) => r.rank === 1);
      if (top.length > 1) return { text: 'SHARED WIN', good: false };
      const w = st.leader;
      const tie = st.chaser && eq(st.points[w], st.points[st.chaser]);
      const who = w === me ? 'YOU WIN' : `${name(w).toUpperCase()} WINS`;
      return { text: tie ? `${who} ON OUTRIGHT WINS` : `${who} ${fmtPts(st.points[w])} TO ${fmtPts(st.points[st.chaser])}`, good: w === side && isYou };
    }
    if (st.locked) return { text: st.leader === side ? (isYou ? 'LOCKED' : `${name(side).toUpperCase()} LOCKS IT`) : `${name(st.leader).toUpperCase()} LOCKS IT`, good: isYou && st.leader === side };
    const text = eq(m, 0) ? 'ALL SQUARE' : m < 0 ? `${SIDE}DOWN ${fmtPts(-m)}` : m > m0 + EPS || m0 <= EPS ? `${SIDE}UP ${fmtPts(m)}` : `${SIDE}STILL UP ${fmtPts(m)}`;
    return { text, good: isYou && m > m0 + EPS, lock: st.lock };
  };

  const you = (s) => (isYou ? `You ${s}` : `${name(side)} ${s.replace(/^win /, 'wins ')}`);
  const rows = [];
  rows.push({ label: you('win it alone'), winners: [side], ...result([side]) });
  if (rival) rows.push({ label: isYou ? `You split it with ${name(rival)}` : `${name(side)} and ${name(rival)} split it`, winners: [side, rival], ...result([side, rival]) });
  // Everyone else, each winning alone; outcomes that end the same way share one row.
  const others = ids.filter((id) => id !== side && id !== rival);
  const groups = [];
  for (const id of others) {
    const r = result([id]);
    const key = r.text + (r.lock ?? '');
    const g = groups.find((x) => x.key === key);
    if (g) g.ids.push(id); else groups.push({ key, ids: [id], r });
  }
  for (const g of groups.slice(0, 1)) { // keep it to 4 rows: the first group (usually all of them)
    const names = g.ids.map(name);
    const lockTxt = g.r.lock != null && !eq(g.r.lock, now.lock) && !/LOCK|WIN/.test(g.r.text) ? ` · LOCK ${fmtPts(g.r.lock)}` : '';
    rows.push({ label: names.length === 1 ? `${names[0]} wins it` : `${names.join(' or ')} win it`, winners: g.ids, ...g.r, text: g.r.text + lockTxt });
  }
  if (rival) rows.push({ label: `${name(rival)} wins it alone`, winners: [rival], ...result([rival]) });
  return rows.map(({ label, text, good, winners }) => ({ label, result: text, good: !!good, winners }));
}

/** Show "What this hole does": hole 16 on, hole 13 on with the top two within 1, or this hole could lock it. */
export function showStakes({ players, holes, me = null, total = 18, lastHole = 18 }) {
  const ids = players.map((p) => p.id);
  const complete = holes.filter((h) => ids.every((id) => h.scores[id] != null));
  const st = raceState({ players, holes: complete, me, total, lastHole });
  if (st.finished || !st.chaser) return false;
  const pos = st.done + 1; // the hole being played, in play order
  if (pos >= 16) return true;
  if (pos >= 13 && st.lead <= 1 + EPS) return true;
  return ids.some((id) => raceState({ players, holes: [...complete, fakeHole(ids, [id])], me, total, lastHole }).locked);
}
