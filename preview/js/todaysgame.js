// todaysgame.js — PURE. Feature 032 "Today's game": the rules, played out in front of you.
//
// todaysGame(snap, meId) → { kicker, game, slides: [{ h, s, scene, args, ms }] } or null (old rounds: keep the
// text card). Chosen by playFor(snap), snap.teams.length (3 carts) and settings.teamScore. The scores on the hole
// are a scripted example (SPEC §2.3: keep the prototype's numbers so the rule always reads the same way); the
// names are the round's real display names, from the viewer's seat. Watching (no meId): the first player's seat,
// called by name instead of "you".
//
// Scenes (drawn by js/screens/todaysgame.js):
//   meet     { kind: pairs | carts3 | alone | list | ryder, groups: [{ label, you, names: [{ name, you }], val }], sub, perSide }
//   hole     { shape, par, label, players: [{ name, s, side }], mode: best | three | low | none, score, win }
//   tug      { total, us, them, lbl, win }                    the halfway bar
//   swap     { me, sets: [{ label, partner, them: [a, b] }] } partners switch
//   sets     { res: [{ r: 'W' | 'L' | 'H', with }], won }
//   carts    { mine, others: [{ name, color }], ranges }     a new cart every 6
//   bars     { rows: [{ name, v, you }], max, note }
//   race     { rows: [{ name, v, you }], left }
//   board    { steps: [[{ name, v, you }]] }
//   ryderRot { mine, opps, ranges }
//   matches  { seq: ['w' | 'l' | 'h'], lbl, win, total }

import { playFor } from './playfor.js';
import { holeAt, holesLabel, fmtPts, sideOf } from './scoring.js';

export const PACE = 0.9; // 032: everything 10% quicker than the first build

/** Slide lengths in ms (SPEC §2.4, pace included). */
export const MS = { meet: 3960, tug: 4320, tugRyder: 5040, swap: 4680, sets: 3780, carts: 3960, bars: 3240, race: 4140, board: 4140, ryderRot: 3780 };
export const holeMs = (players, score) => Math.round((500 + 560 * Math.max(...players.map((p) => p.s)) + 400 + 2600) * PACE) + (score === 'bbAgg' ? 1440 : 0);

const SCORE = { bestBall: 'bestBall', bestBallAggregate: 'bbAgg', aggregate: 'aggregate' };
const SCORE_NAME = { bbAgg: 'Low ball + total', aggregate: 'Aggregate' };
const r3 = (a, b) => (a < b ? 1 : a > b ? 0 : 0.5);
const list = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/**
 * The viewer's words: "You" / "your" when playing, the player's name when watching.
 * `me` = the seat's player id, `Me` = how the seat is named on chips and in copy.
 */
function seat(snap, meId) {
  const me = meId && snap.playerById.get(meId) ? meId : snap.players[0]?.id || null;
  const playing = !!(meId && snap.playerById.get(meId));
  const nm = snap.playerById.get(me)?.name || 'You';
  return {
    me, playing,
    You: playing ? 'You' : nm,
    your: playing ? 'your' : `${nm}’s`,
    Your: playing ? 'Your' : `${nm}’s`,
    name: (pid) => (pid === me ? (playing ? 'You' : nm) : snap.playerById.get(pid)?.name || '?'),
  };
}

const chip = (Y, pid) => ({ name: Y.name(pid), you: pid === Y.me });
const teamOf = (snap, tid) => snap.teamById.get(tid)?.playerIds || [];

/** The 2v2 hole slide follows the team score (SPEC §2.3): best ball keeps the game's own h / s. */
function teamHole(Y, ts, { h, s, ...o }) {
  const ys = o.players.filter((p) => p.side === 'y').map((p) => p.s), th = o.players.filter((p) => p.side === 't').map((p) => p.s);
  const bu = Math.min(...ys), bt = Math.min(...th), tu = ys[0] + ys[1], tt = th[0] + th[1];
  if (ts === 'bbAgg') {
    const n = r3(bu, bt) + r3(tu, tt);
    h = 'Two points every hole.';
    s = `One for the low ball: ${Y.your} best ${bu} v their ${bt}. One for the low total: ${Y.your} ${ys[0]} + ${ys[1]} = ${tu} v their ${tt}. ${n === 2 ? (Y.playing ? 'Both yours.' : `Both to ${Y.You}’s side.`) : `${fmtPts(n)} ${n === 1 ? 'point' : 'points'} to ${Y.playing ? 'you' : `${Y.You}’s side`}.`}`;
  }
  if (ts === 'aggregate') {
    const n = r3(tu, tt);
    h = 'Both scores count.';
    s = `Add ${Y.playing ? 'your' : 'their'} two scores. ${ys[0]} + ${ys[1]} = ${tu} v ${Y.playing ? 'their' : 'the other side’s'} ${tt}: ${n === 1 ? `one point to ${Y.playing ? 'you' : Y.You}` : n === 0.5 ? '½ point each' : 'their point'}.`;
  }
  const args = { mode: 'best', score: ts, ...o };
  return { h, s, scene: 'hole', args, ms: holeMs(o.players, ts) };
}

/** The halfway bar: first past half of what's out there wins (SPEC §2.4). */
function halfway(ncomp) {
  const total = 18 * ncomp, need = total / 2 + 0.5;
  return {
    h: `First to ${fmtPts(need)} wins.`,
    s: ncomp === 2 ? `${total} points out there, two a hole. Get past halfway and nobody can catch you.` : `${total} points out there. Get past halfway and nobody can catch you.`,
    scene: 'tug', args: { total, us: need, them: ncomp === 2 ? 12.5 : 6.5, lbl: `Halfway · ${total / 2}`, win: `${fmtPts(need)} · Clinched` }, ms: MS.tug,
  };
}

const meetPairs = (Y, us, them, labels, sub) => ({
  scene: 'meet', ms: MS.meet,
  args: { kind: 'pairs', sub, groups: [{ label: labels[0], you: true, names: us.map((p) => chip(Y, p)) }, { label: labels[1], names: them.map((p) => chip(Y, p)) }] },
});

/** Me first, then my partner(s). */
const meFirst = (Y, pids) => [...pids].sort((a, b) => (a === Y.me ? -1 : b === Y.me ? 1 : 0));

// ───────────────────────────────────────────── 2v2, same partners (4 players, or 8 with the same cart all day)

function oneMatch(snap, Y, ts, ncomp) {
  const st = snap.settings;
  const r0 = st.rotation[0];
  const m = r0.matches.find((x) => x.some((t) => teamOf(snap, t).includes(Y.me))) || r0.matches[0];
  const mine = m.find((t) => teamOf(snap, t).includes(Y.me)) || m[0];
  const us = meFirst(Y, teamOf(snap, mine)), them = teamOf(snap, m.find((t) => t !== mine));
  const [pa] = us.filter((p) => p !== Y.me).map(Y.name), [t0, t1] = them.map(Y.name);
  return [
    { h: `${Y.You} and ${pa} vs ${t0} and ${t1}.`, s: 'Same partners, all 18.', ...meetPairs(Y, us, them, ['Your side', 'Them']) },
    teamHole(Y, ts, {
      h: 'Best ball takes the hole.', s: `${Y.Your} 4 beats their 5. One point.`, shape: 'dogleg', par: 4, label: 'Hole 4 · Par 4',
      players: [{ name: Y.You, s: 4, side: 'y', you: true }, { name: pa, s: 6, side: 'y' }, { name: t0, s: 5, side: 't' }, { name: t1, s: 6, side: 't' }],
      win: `+1 to ${Y.playing ? 'you' : Y.You} and ${pa}`,
    }),
    halfway(ncomp),
  ];
}

// ───────────────────────────────────────────── 2v2, partners switch (every 6 = three sets, at the turn = two)

function partners(snap, Y, ts) {
  const st = snap.settings;
  const sets = st.rotation.map((r) => {
    const [a, b] = r.matches[0];
    const mine = teamOf(snap, a).includes(Y.me) ? a : b;
    const partner = teamOf(snap, mine).find((p) => p !== Y.me);
    return { from: r.holes[0], to: r.holes[1], label: holesLabel(st, r.holes[0], r.holes[1]), partner, them: teamOf(snap, mine === a ? b : a) };
  });
  const turn = sets.length === 2;
  const len = turn ? 9 : 6;
  const first = sets[0];
  const [pa] = [first.partner].map(Y.name), [t0, t1] = first.them.map(Y.name);
  const at = sets.slice(1).map((x) => holeAt(st, x.from));
  const range = (x) => x.label.replace(/^Holes /, '');
  const slides = [
    { h: `${Y.You} and ${pa} vs ${t0} and ${t1}.`, s: `For the first ${len} holes.`, ...meetPairs(Y, [Y.me, first.partner], first.them, ['Your side', 'Them'], first.label) },
    teamHole(Y, ts, {
      h: `${Y.Your} partner’s ball counts too.`, s: `${pa}’s 4 is ${Y.your} side’s best. One point to ${Y.playing ? 'you' : 'them'} both.`, shape: 'bend', par: 4,
      label: `Hole ${holeAt(st, 2)} · with ${pa}`,
      players: [{ name: Y.You, s: 6, side: 'y', you: true }, { name: pa, s: 4, side: 'y' }, { name: t0, s: 5, side: 't' }, { name: t1, s: 6, side: 't' }],
      win: `+1 to ${Y.playing ? 'you' : Y.You} and ${pa}`,
    }),
    {
      h: `Partners switch at ${list(at.map(String))}.`,
      s: turn ? 'Two sets of 9, each with a new partner.' : 'Every 6 holes is a new set, with a new partner. You play with everyone once.',
      scene: 'swap', ms: MS.swap,
      args: { me: Y.You, sets: sets.map((x, i) => ({ label: `Set ${i + 1} · holes ${range(x)}`, range: range(x), partner: Y.name(x.partner), them: x.them.map(Y.name) })) },
    },
  ];
  if (st.dayBy === 'stretches') {
    const res = turn ? ['W', 'L'] : ['W', 'L', 'W'];
    slides.push({
      h: 'Most sets won takes the day.', s: 'Each set is its own match. Level on sets? Most points wins.', scene: 'sets', ms: MS.sets,
      args: { res: sets.map((x, i) => ({ r: res[i], with: Y.name(x.partner) })), won: res.filter((r) => r === 'W').length },
    });
  } else {
    // Older partners rounds rank by points (no dayBy): the bars, one per player.
    const v = [12, 10.5, 7.5, 6];
    const ids = [Y.me, first.partner, ...first.them];
    slides.push({
      h: 'Most points takes the day.', s: 'Every point you win with any partner adds to your total.', scene: 'bars', ms: MS.bars,
      args: { max: 16, note: 'After 18', rows: ids.map((p, i) => ({ name: Y.name(p), v: v[i], you: p === Y.me })) },
    });
  }
  return slides;
}

// ───────────────────────────────────────────── 2v2 with 8: four carts, a new cart every 6 (or at the turn)

function fourCarts(snap, Y, ts) {
  const st = snap.settings;
  const mine = snap.playerById.get(Y.me)?.teamId;
  const opps = st.rotation.map((r) => {
    const m = r.matches.find((x) => x.includes(mine));
    return m ? m.find((t) => t !== mine) : null;
  }).filter(Boolean);
  const us = meFirst(Y, teamOf(snap, mine));
  const pa = Y.name(us.find((p) => p !== Y.me));
  const them = teamOf(snap, opps[0]);
  const [t0, t1] = them.map(Y.name);
  const cartName = (tid) => teamOf(snap, tid).map(Y.name).join(' + ');
  const ranges = st.rotation.map((r) => holesLabel(st, r.holes[0], r.holes[1]));
  const turn = st.rotation.length === 2;
  const myGroup = snap.playerById.get(Y.me)?.groupId;
  const away = opps.some((t) => teamOf(snap, t).some((p) => snap.playerById.get(p)?.groupId !== myGroup));
  const others = [...new Set([...opps, ...snap.teams.map((t) => t.id)])].filter((t) => t !== mine);
  const bars = [12, 10.5, 7.5, 6];
  const order = [...new Set([mine, opps[1], opps[0], ...others])].filter(Boolean).slice(0, 4);
  return [
    { h: `${Y.You} and ${pa} are a cart.`, s: `${WORD[snap.teams.length]} carts of two today.`, ...meetPairs(Y, us, them, ['Your cart', 'First up'], ranges[0]) },
    teamHole(Y, ts, {
      h: 'A tie splits it.', s: 'Both carts’ best is a 3. ½ point each.', shape: 'short', par: 3, label: 'Hole 3 · Par 3',
      players: [{ name: Y.You, s: 3, side: 'y', you: true }, { name: pa, s: 4, side: 'y' }, { name: t0, s: 3, side: 't' }, { name: t1, s: 5, side: 't' }],
    }),
    {
      h: turn ? 'A new cart at the turn.' : 'A new cart every 6 holes.',
      s: away ? 'Some of them are in the other tee time. Nobody moves; the app scores it.' : 'The app keeps score for every match.',
      scene: 'carts', ms: MS.carts,
      args: { mine: cartName(mine), ranges, others: opps.map((t) => ({ name: cartName(t), color: t.toLowerCase(), away: teamOf(snap, t).some((p) => snap.playerById.get(p)?.groupId !== myGroup) })) },
    },
    {
      h: 'Most points takes the day.', s: 'Every hole against every cart adds to your total.', scene: 'bars', ms: MS.bars,
      args: { max: 16, note: 'After 18', rows: order.map((t, i) => ({ name: cartName(t), v: bars[i], you: t === mine })) },
    },
  ];
}

// ───────────────────────────────────────────── 2v2 with 6: three carts, both others every hole

function threeCarts(snap, Y, ts) {
  const mine = snap.playerById.get(Y.me)?.teamId;
  const rest = snap.teams.map((t) => t.id).filter((t) => t !== mine);
  const us = meFirst(Y, teamOf(snap, mine));
  const pa = Y.name(us.find((p) => p !== Y.me));
  const [a, b] = rest.map((t) => teamOf(snap, t).map(Y.name));
  const two = ts === 'bbAgg'; // not drawn (SPEC §6): same slides, the copy says two points against each cart
  return [
    {
      h: 'Three carts of two.', s: `${Y.You} and ${pa} are a cart. Every cart plays both others.`, scene: 'meet', ms: MS.meet,
      args: { kind: 'carts3', groups: [{ label: 'Your cart', you: true, names: us.map((p) => chip(Y, p)) }, ...rest.map((t) => ({ label: 'Cart', names: teamOf(snap, t).map((p) => chip(Y, p)) }))] },
    },
    {
      h: 'Both carts, every hole.',
      s: two
        ? `Low ball and low total against each cart: up to 4 points a hole.`
        : `${Y.Your} 4 beats ${a[0]} and ${a[1]}’s 5 and ties ${b[0]} and ${b[1]}’s 4. 1½ points.`,
      scene: 'hole', ms: holeMs([{ s: 6 }], 'bestBall'),
      args: {
        shape: 'dogleg', par: 4, label: 'Hole 4 · Par 4', mode: 'three', score: 'bestBall',
        players: [{ name: Y.You, s: 4, side: 'y', you: true }, { name: pa, s: 5, side: 'y' }, { name: a[0], s: 5, side: 'a' }, { name: a[1], s: 6, side: 'a' }, { name: b[0], s: 4, side: 'b' }, { name: b[1], s: 6, side: 'b' }],
      },
    },
    {
      h: 'Most points takes the day.', s: two ? 'Four chances every hole: two against each cart.' : 'Two chances every hole: one against each cart.', scene: 'bars', ms: MS.bars,
      args: { max: 30, note: 'After 18', rows: [{ name: us.map(Y.name).join(' + '), v: 24, you: true }, { name: b.join(' + '), v: 19.5 }, { name: a.join(' + '), v: 16.5 }] },
    },
  ];
}

// ───────────────────────────────────────────── no partners: Everyone alone, Stroke play

/**
 * You plus your whole tee time, up to 6 (Andrew, Nov 20). A tee time smaller than four is topped up from the
 * other tee times, so the slides always show at least four when the round has them.
 */
function tableMates(snap, Y) {
  const g = snap.playerById.get(Y.me)?.groupId;
  const mates = snap.players.filter((p) => p.id !== Y.me && p.groupId === g).slice(0, 5);
  const more = snap.players.filter((p) => p.id !== Y.me && p.groupId !== g).slice(0, Math.max(0, 3 - mates.length));
  return [Y.me, ...mates, ...more].map((p) => (typeof p === 'string' ? p : p.id));
}

function alone(snap, Y) {
  const ids = tableMates(snap, Y);
  const n = ids.map(Y.name);
  const S = [3, 4, 5, 4, 5, 6];
  const R = [7, 4, 3, 2, 2, 1];
  return [
    { h: 'Everyone for themselves.', s: 'No partners today.', scene: 'meet', ms: MS.meet, args: { kind: 'alone', groups: ids.map((p) => ({ you: p === Y.me, names: [chip(Y, p)] })) } },
    {
      h: 'Low score takes the point.', s: `${Y.Your} 3 is the lowest. One point. A tie splits it.`, scene: 'hole',
      ms: holeMs(ids.map((_, i) => ({ s: S[i] })), 'bestBall'),
      args: { shape: 'bend', par: 4, label: 'Hole 7 · Par 4', mode: 'low', win: `+1 to ${Y.playing ? 'you' : Y.You}`, players: ids.map((p, i) => ({ name: n[i], s: S[i], side: p === Y.me ? 'y' : 't', you: p === Y.me })) },
    },
    {
      h: 'The race.', s: 'Most points wins. Once your lead is more than they can make up, it’s locked.', scene: 'race', ms: MS.race,
      args: { left: 2, rows: ids.map((p, i) => ({ name: n[i], v: R[i], you: p === Y.me })) },
    },
  ];
}

function stroke(snap, Y) {
  const ids = tableMates(snap, Y);
  const [y, o0, o1, o2, o3, o4] = ids;
  const S = [5, 6, 5, 7, 6, 8];
  const row = (pid, v) => (pid ? { name: Y.name(pid), v, you: pid === Y.me } : null);
  const steps = [
    [row(o1, '+1'), row(o0, '+2'), row(y, '+3'), row(o2, '+5'), row(o3, '+6'), row(o4, '+8')],
    [row(o1, '+1'), row(y, '+2'), row(o0, '+3'), row(o2, '+5'), row(o3, '+6'), row(o4, '+8')],
    [row(y, 'E'), row(o1, '+1'), row(o0, '+3'), row(o3, '+5'), row(o2, '+6'), row(o4, '+9')],
  ].map((st) => st.filter(Boolean));
  return [
    { h: 'Just your score.', s: 'Everyone plays their own ball.', scene: 'meet', ms: MS.meet, args: { kind: 'list', groups: ids.map((p) => ({ you: p === Y.me, names: [chip(Y, p)], val: 'E' })) } },
    {
      h: 'Every stroke counts.', s: `Five shots on a par 5. ${Y.Your} card stays level.`, scene: 'hole',
      ms: holeMs(ids.map((_, i) => ({ s: S[i] })), 'bestBall'),
      args: { shape: 'long', par: 5, label: 'Hole 5 · Par 5', mode: 'none', win: `5 on ${Y.your} card · E`, players: ids.map((p, i) => ({ name: Y.name(p), s: S[i], side: p === Y.me ? 'y' : 't', you: p === Y.me })) },
    },
    { h: 'Lowest total wins.', s: 'The Board shows where you stand, live.', scene: 'board', ms: MS.board, args: { steps } },
  ];
}

// ───────────────────────────────────────────── Team Ryder Cup

function ryder(snap, Y) {
  const st = snap.settings;
  const mine = sideOf(snap.playerById.get(Y.me)?.teamId) ? snap.playerById.get(Y.me).teamId : null;
  const perSide = Math.max(1, Math.floor(snap.players.length / 2)) || 8;
  const carts = Math.max(1, Math.round(perSide / 2));
  const nMatches = carts * 3;
  const toWin = nMatches / 2 + 0.5;
  const pa = mine ? teamOf(snap, mine).filter((p) => p !== Y.me).map(Y.name)[0] : null;
  const cartName = (tid) => teamOf(snap, tid).map(Y.name).join(' + ');
  const opps = mine ? st.rotation.map((r) => r.matches.find((m) => m.includes(mine))).filter(Boolean).map((m) => m.find((t) => t !== mine)) : [];
  const ranges = st.rotation.map((r) => holesLabel(st, r.holes[0], r.holes[1]));
  const oppNames = opps.length ? opps.map(cartName) : ['Their cart', 'Their cart', 'Their cart'];
  const them0 = opps[0] ? teamOf(snap, opps[0]).map(Y.name) : ['Them', 'Them'];
  const seq = ['w', 'l', 'w', 'w', 'h', 'l', 'w', 'w', 'l', 'w', 'h', 'l'].slice(0, nMatches);
  const cartsWord = WORD[carts] || String(carts);
  const hole = teamHole(Y, 'bbAgg', {
    shape: 'dogleg', par: 4, label: `Hole ${holeAt(st, 1)} · vs ${them0.join(' + ')}`,
    players: [{ name: Y.You, s: 4, side: 'y', you: true }, { name: pa || 'Partner', s: 5, side: 'y' }, { name: them0[0], s: 5, side: 't' }, { name: them0[1], s: 5, side: 't' }],
  });
  return [
    {
      h: `Two sides of ${perSide}.`,
      s: `${cartsWord} carts a side.${pa ? ` ${Y.You} and ${pa} are one of ${Y.playing ? 'yours' : 'theirs'}.` : ''}`,
      scene: 'meet', ms: MS.meet, args: { kind: 'ryder', perSide, sub: `${cartsWord} carts a side. ${Y.playing ? 'Yours' : 'Theirs'} is green.` },
    },
    {
      h: 'A new cart every 6 holes.', s: `${Y.Your} cart plays ${WORD[oppNames.length]?.toLowerCase() || oppNames.length} of theirs, one every 6 holes.`,
      scene: 'ryderRot', ms: MS.ryderRot, args: { mine: mine ? cartName(mine) : Y.You, opps: oppNames, ranges },
    },
    { ...hole, h: 'Cart against cart.', s: 'Two hole points every hole: low ball and low total. Most hole points over the 6 holes wins the match.' },
    {
      h: `${fmtPts(toWin)} wins the cup.`, s: `${nMatches} matches, a point each. Get past halfway and the cup is yours.`,
      scene: 'matches', ms: MS.tugRyder, args: { seq, total: nMatches, lbl: `Halfway · ${fmtPts(nMatches / 2)}`, win: `${fmtPts(toWin)} · Cup won` },
    },
  ];
}

// ───────────────────────────────────────────── the model

const SHORT = { ryder: 'Ryder Cup', alone: 'Alone', stroke: 'Stroke play' };

/** The slides for this round, or null when it has no 032 slides (old shapes, Plus/Minus): keep the text card. */
export function todaysGame(snap, meId) {
  if (!snap || !snap.players?.length) return null;
  const v = playFor(snap);
  if (v === 'legacy') return null;
  if (snap.game?.type === 'rotationPlusMinus') return null;
  const st = snap.settings || {};
  const Y = seat(snap, meId);
  const ts = SCORE[st.teamScore] || 'bestBall';
  const ncomp = ts === 'bbAgg' ? 2 : 1;
  const pairsGame = v === 'oneMatch' || v === 'partners' || v === 'cart';
  let slides;
  if (v === 'oneMatch') slides = oneMatch(snap, Y, ts, ncomp);
  else if (v === 'partners') slides = partners(snap, Y, ts);
  else if (v === 'cart') slides = snap.teams.length === 3 ? threeCarts(snap, Y, ts) : fourCarts(snap, Y, ts);
  else if (v === 'alone') slides = alone(snap, Y);
  else if (v === 'stroke') slides = stroke(snap, Y);
  else if (v === 'ryder') slides = ryder(snap, Y);
  if (!slides) return null;
  const kicker = pairsGame && ts !== 'bestBall' ? `2v2 · ${SCORE_NAME[ts]}` : `Today’s game · ${SHORT[v] || '2v2'}`;
  return { kicker, game: v, slides };
}
