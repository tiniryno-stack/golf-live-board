// homeview.js — PURE. 037 Home (docs/design/features/037-home/SPEC.md): what Home draws, block by block, from what
// this phone knows. home.js renders it; nothing here touches the DOM, storage or the network.
//
// homeModel(input) → { brandNew, top, caption, coming, result, crew, endRows, bar }
//   top     §3.1: { kind: 'pack', card, count } | { kind: 'card', card } | { kind: 'empty' } | null (locker not ready)
//   caption §3.2: { sub } | null
//   result  §3.3: { label, rows: [{ pos, name, value, me } | { gap: true }], code } | null
//   crew    §3.4: { kind: 'none' } | { kind: 'crew', id, kicker, name, named, switcher, sub }
//   endRows §2.8: { allRounds: { count, since } | null, addHome, newRound, join }
//   bar     §3.5: { kind: 'buttons' } | { kind: 'live', code, hole, line } | { kind: 'new' }

import { compute, fmtPts } from './scoring.js';
import { roundFinish } from './seasons.js';

export const LIVE_FOR = 12 * 3600 * 1000; // a round last seen live more than 12 h ago isn't "playing now"
const DAY = 86400000;
const FINISH_CACHE = new WeakMap(); // { event, scores } row → { personId, fu }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (d) => { const [, m, dd] = String(d || '').split('-').map(Number); return m ? `${MON[m - 1]} ${dd}` : ''; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const dayOf = (r) => String(r?.played_on || (r?.at ? new Date(r.at).toISOString() : '')).slice(0, 10);

/** §3.1, first match wins. `cards` = buildLocker's list (round order) or null when the locker isn't ready. */
export function topOf({ personId, cards, hasRounds }) {
  if (!personId || !Array.isArray(cards)) return null;
  const packs = cards.filter((c) => !c.opened);
  if (packs.length) return { kind: 'pack', card: packs[packs.length - 1], count: packs.length };
  const opened = cards.filter((c) => c.opened);
  if (opened.length) {
    const latest = opened.reduce((a, b) => (String(b.day) >= String(a.day) ? b : a));
    return { kind: 'card', card: latest };
  }
  return hasRounds ? { kind: 'empty' } : null;
}

/** The key Home remembers in glb.seen.homeTop ("pack:CODE" / "card:CODE"), so a new top deals in (§6). */
export const topKey = (top) => (top && top.card ? `${top.kind}:${top.card.code}` : null);

/** Signed plus/minus margin ("+3", "−2", "0"). */
const pm = (n) => (n > 0 ? `+${fmtPts(n)}` : n < 0 ? `−${fmtPts(-n)}` : '0');

/**
 * §3.3: one finished round's order as units (carts / sides / pairs = one row), with what the game counts.
 * → { units: [{ unit, rank, name, value, me }], players } or null when the round doesn't count yet.
 */
export function finishUnits(event, scores, personId) {
  const fin = roundFinish(event, scores);
  if (!fin || !fin.length) return null;
  const snap = compute(event, scores || []);
  const g = snap.game;
  const values = new Map(); // unit → value
  if (g?.sides) {
    for (const sd of g.sides) values.set(`side:${sd.sideId}`, { value: fmtPts(sd.points), name: sd.name });
  } else if (g?.people && snap.settings.pairSwitch && snap.settings.pairSwitch !== 'never') {
    for (const r of g.people) values.set(`p:${r.playerId}`, { value: fmtPts(r.points) });
  } else if (g?.standings) {
    const isPM = g.type === 'rotationPlusMinus';
    for (const r of g.standings) values.set(`t:${r.teamId}`, { value: isPM ? pm(r.pm) : fmtPts(r.points) });
  } else {
    // Stroke play: the total it ranks by (net when the round has handicaps, else gross).
    for (const p of snap.players) if (p.thru > 0) values.set(`p:${p.id}`, { value: String(snap.hasStrokes ? p.netTotal : p.grossTotal) });
  }
  const units = [];
  for (const f of fin) {
    let u = units.find((x) => x.unit === f.unit);
    if (!u) { u = { unit: f.unit, rank: f.rank, names: [], me: false, ...(values.get(f.unit) || {}) }; units.push(u); }
    u.names.push(f.name);
    if (personId && f.key === personId) u.me = true;
  }
  units.sort((a, b) => a.rank - b.rank);
  return {
    units: units.map(({ names, ...u }) => ({ ...u, name: u.name || names.join(' + '), value: u.value || '' })),
    players: snap.players.length,
  };
}

/** §3.3 rows: the top three (ties → "T3"), then you after a break if you're not in them. */
export function finishRows(units) {
  if (!units?.length) return [];
  const count = (r) => units.filter((u) => u.rank === r).length;
  const row = (u) => ({ pos: `${count(u.rank) > 1 ? 'T' : ''}${u.rank}`, name: u.name, value: u.value, me: !!u.me });
  const top = units.filter((u) => u.rank <= 3).slice(0, 4);
  const out = top.map(row);
  const me = units.find((u) => u.me);
  if (me && !top.includes(me)) out.push({ gap: true }, row(me));
  return out;
}

/** §3.4: the crew block. `crews` = { list: [{ id, name }], currentId, name, seasonLine, rounds }. */
export function crewModel(crews) {
  const list = crews?.list || [];
  if (!list.length) return { kind: 'none' };
  const id = crews.currentId || list[0].id;
  const name = crews.name || null;
  const sub = crews.seasonLine || (crews.rounds != null ? `${plural(crews.rounds, 'round')} this season` : '');
  return {
    kind: 'crew', id, name, named: !!name,
    kicker: list.length > 1 ? `Your crews · ${list.length}` : name || 'Your crew',
    switcher: list.length > 1 ? list.map((c) => ({ id: c.id, name: c.name || 'Your crew', on: c.id === id })) : null,
    sub,
  };
}

/** Which recent rounds are coming up (lobby, not past yesterday) and which one is live now. */
export function roundGroups(rounds, now) {
  const yesterday = new Date(now - DAY).toISOString().slice(0, 10);
  const coming = rounds.filter((r) => r.lobby && (!r.played_on || r.played_on >= yesterday));
  const live = rounds.find((r) => !r.lobby && r.live && !r.done && now - (r.seen || r.at || 0) < LIVE_FOR) || null;
  return { coming, live };
}

/** §5: what the All rounds screen lists (Home's old Recent rounds: everything but the round cards above it). */
export function allRounds(rounds, now) {
  const { coming } = roundGroups(rounds, now);
  return rounds.filter((r) => !coming.includes(r));
}

/**
 * input = {
 *   rounds: glb.recent entries, now,
 *   personId, locker: { cards, rows, sub } | null (rows = [{ event, scores }] from db.fetchPersonRounds),
 *   crews: see crewModel, crewNames: { crewId: name }, meName,
 *   ios, standalone,
 * }
 */
export function homeModel({ rounds = [], now = Date.now(), personId = null, locker = null, crews = null, crewNames = {}, meName = '', ios = false, standalone = false } = {}) {
  // A phone with no rounds stored but a known person with cards (new browser, sync still running) is not brand new.
  const brandNew = !rounds.length && !(personId && locker?.cards?.length);
  const { coming, live } = roundGroups(rounds, now);
  const crew = crewModel(crews);
  const addHome = !!ios && !standalone;

  const top = brandNew ? null : topOf({ personId, cards: locker?.cards ?? null, hasRounds: true });
  // Crew on the card: "FOUNDERS CREW · ANDREW" (no crew → just the name).
  if (top?.card) {
    const row = (locker.rows || []).find((x) => x.event?.id === top.card.eventId);
    const crewName = row?.event?.crew_id ? crewNames[row.event.crew_id] || '' : '';
    top.crewLine = [crewName, top.card.name || meName].filter(Boolean).join(' · ');
  }

  let caption = null;
  if (top?.kind === 'pack') {
    const opened = (locker.cards || []).filter((c) => c.opened).length;
    caption = { sub: [`${plural(top.count, 'pack')} to open`, opened ? plural(opened, 'scorecard') : ''].filter(Boolean).join(' · ') };
  } else if (top?.kind === 'card') {
    caption = { sub: locker.sub || '' };
  }

  let result = null;
  if (top?.card) {
    const row = (locker.rows || []).find((x) => x.event?.id === top.card.eventId);
    let fu = null;
    if (row) {
      // The render loop redraws often: one engine run per round object (locker rows are kept until the next load).
      const hit = FINISH_CACHE.get(row);
      if (hit && hit.personId === personId) fu = hit.fu;
      else {
        try { fu = finishUnits(row.event, row.scores, personId); } catch { fu = null; } // an odd old round: skip the block
        FINISH_CACHE.set(row, { personId, fu });
      }
    }
    if (fu && fu.units.length > 1) {
      const base = coming.length || live ? `Last time out · ${shortDay(top.card.day)}` : 'How it finished';
      result = { label: `${base}${fu.players >= 7 ? ` · ${fu.players} players` : ''}`, rows: finishRows(fu.units), code: row.event.code };
    }
  }

  const list = allRounds(rounds, now);
  const days = list.map(dayOf).filter(Boolean).sort();
  const endRows = {
    allRounds: list.length ? { count: list.length, since: shortDay(days[0]) } : null,
    addHome,
    newRound: !!live,
    join: !!live,
  };

  const bar = brandNew ? { kind: 'new' }
    : live ? { kind: 'live', code: live.code, hole: live.live?.hole || null, line: live.live?.line || '' }
      : { kind: 'buttons' };

  return { brandNew, top, caption, coming, live, result, crew, endRows, bar };
}
