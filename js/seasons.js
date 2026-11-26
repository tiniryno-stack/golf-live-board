// seasons.js — pure: split a crew's rounds into seasons (feature 008-seasons).
//
// A crew's first season is implicit: it starts with the crew's first round and is named for that date
// ("Fall 2026"). Every season someone starts after that is a row { name, startsOn, createdAt }: it runs
// from startsOn (or, when startsOn is null = "Next round", from the first crew round created after it)
// until the next season starts. Seasons never overlap or leave gaps. A round belongs to the season that
// was active on the day it was played. Standings inside a season use scoring.seasonStandings (cart game
// points, labeled as such until the cross-game standings rework).

import { seasonStandings, compute } from './scoring.js';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fall 2026" for a YYYY-MM-DD date (Dec belongs to the next year's Winter). */
export function seasonLabel(date) {
  const [y, m] = String(date || '').split('-').map(Number);
  if (!y || !m) return 'Season 1';
  if (m === 12) return `Winter ${y + 1}`;
  if (m <= 2) return `Winter ${y}`;
  if (m <= 5) return `Spring ${y}`;
  if (m <= 8) return `Summer ${y}`;
  return `Fall ${y}`;
}

/** The name the "Start a new season" sheet suggests after `current` (Fall 2026 → Winter 2027 …). */
export function nextSeasonLabel(current, today) {
  const order = ['Winter', 'Spring', 'Summer', 'Fall'];
  const m = /^(Winter|Spring|Summer|Fall) (\d{4})$/.exec(String(current || ''));
  if (!m) return seasonLabel(today);
  const i = order.indexOf(m[1]);
  const y = Number(m[2]);
  return i === 3 ? `Winter ${y + 1}` : `${order[i + 1]} ${y}`;
}

/** Is this round on or after the season's start? Same day as a "Today" start: only rounds created after it. */
const after = (r, season) => {
  const d = dayOf(r.event);
  if (d > season.start) return true;
  if (d < season.start) return false;
  return !season.at || String(r.event.created_at || '') >= season.at;
};

const dayOf = (e) => e.played_on || String(e.created_at || '').slice(0, 10) || null;

/** "SEP 6" from YYYY-MM-DD. */
export const shortDate = (d) => {
  const [, m, day] = String(d || '').split('-').map(Number);
  return m ? `${MONTH[m - 1].toUpperCase()} ${day}` : '';
};

/**
 * @param {Array<{name,startsOn,createdAt}>} stored  seasons someone started (crew_info.seasons)
 * @param {Array<{event, scores}>} rounds  the crew's rounds (practice already left out)
 * @param {string} today  YYYY-MM-DD
 * @returns {Array<{key, name, start, end, current, upcoming, rounds}>}  oldest first
 */
export function buildSeasons(stored, rounds, today) {
  const sorted = [...rounds].sort((a, b) => String(dayOf(a.event)).localeCompare(String(dayOf(b.event)))
    || String(a.event.created_at || '').localeCompare(String(b.event.created_at || '')));
  const first = sorted.length ? dayOf(sorted[0].event) : today;
  const list = [{ key: 'first', name: seasonLabel(first), start: first }];
  for (const s of [...(stored || [])].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
    // "Next round": starts on the day of the first crew round created after the season was started.
    const nextRound = sorted.find((r) => String(r.event.created_at || '') >= String(s.createdAt || ''));
    const start = s.startsOn || (nextRound ? dayOf(nextRound.event) : null);
    // Started "Today": rounds already started today stay in the season before (in-progress rounds count there).
    const at = s.startsOn && s.startsOn === String(s.createdAt || '').slice(0, 10) ? String(s.createdAt) : null;
    list.push({ key: s.id || s.name, name: s.name, start, at, pending: !start });
  }
  // A season that hasn't started yet sits at the end; started ones keep their order by start date.
  const started = list.filter((s) => s.start).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const upcoming = list.filter((s) => !s.start);
  started.forEach((s, i) => {
    s.end = started[i + 1]?.start || null; // exclusive
    const next = started[i + 1];
    s.rounds = sorted.filter((r) => after(r, s) && (!next || !after(r, next)));
  });
  // Rounds before the first season's start (it starts at the first round, so none) stay in the first one.
  if (started[0]) started[0].rounds = sorted.filter((r) => !started[1] || !after(r, started[1]));
  const live = started.filter((s) => s.start <= today);
  const cur = live[live.length - 1] || started[0];
  for (const s of started) { s.current = s === cur; s.upcoming = s.start > today; }
  for (const s of upcoming) Object.assign(s, { end: null, rounds: [], current: false, upcoming: true });
  return [...started, ...upcoming];
}

/** Standings for one season: players ranked (cart game points), with rank + your place. */
export function seasonTable(season, mePersonId = null) {
  const data = seasonStandings(season.rounds || []);
  const rows = data.players
    .map((p) => ({ ...p, personId: p.key.startsWith('name:') ? null : p.key }))
    .sort((a, b) => b.points - a.points || b.roundsWon - a.roundsWon || b.w - a.w || String(a.fullName || a.name).localeCompare(String(b.fullName || b.name)));
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1;
    r.me = !!mePersonId && r.personId === mePersonId;
  });
  rows.forEach((r) => { r.tied = rows.filter((x) => x.rank === r.rank).length > 1; });
  return { rows, gameRounds: data.rounds, me: rows.find((r) => r.me) || null };
}

/** "1st", "T3" */
export const placeLabel = (r) => (r ? `${r.tied ? 'T' : ''}${r.rank}${r.tied ? '' : ['th', 'st', 'nd', 'rd'][(r.rank % 100 >= 11 && r.rank % 100 <= 13) || r.rank % 10 > 3 ? 0 : r.rank % 10]}` : '');


// ── Season record (Nov 19): one standings for every game ─────────────────────────────────────────────
// Every finished round, whatever the game, is turned into a finishing order. Each player then goes
// "people finished ahead of – people finished behind" for the day; a tie is ½ each and you never count
// your own partner or side. Rounds add up as they are, so a big round counts for more (decided Nov 19).
// Ranked by win rate; under MIN_ROUNDS you're listed below the line, not ranked.

export const MIN_ROUNDS = 3;
const personKeyOf = (p) => p.personId || `name:${String(p.name || '').trim().toLowerCase()}`;
const dayOfEvent = (e) => String(e.played_on || e.created_at || '').slice(0, 10);

/** One round's finishing order: [{ key, name, rank, unit, label }] or null when it doesn't count yet.
 *  unit groups teammates (same cart, same side), who are never counted against each other. */
export function roundFinish(event, scores) {
  const snap = compute(event, scores || []);
  if (!(snap.roundComplete || event.finalized_at)) return null;
  const st = snap.settings || {};
  const g = snap.game;
  const out = [];
  const n = snap.players.length;
  const game = st.ryder ? 'Team Ryder Cup' : g?.type === 'splitPoint' ? 'Everyone alone' : g ? '2v2' : 'Stroke play';
  const add = (p, rank, unit, label) => out.push({ key: personKeyOf(p), name: p.name, rank, unit, label, game, players: n,
    gross: p.thru === 18 ? p.grossTotal : null });
  if (g?.sides) { // Team Ryder Cup: your side's result
    for (const sd of g.sides) for (const tid of sd.teamIds) for (const pid of snap.teamById.get(tid)?.playerIds || [])
      add(snap.playerById.get(pid), sd.rank, `side:${sd.sideId}`, sd.rank === 1 ? 'won the cup' : 'lost the cup');
  } else if (g?.people && st.pairSwitch && st.pairSwitch !== 'never') { // partners switch: you play for yourself
    for (const r of g.people) add(snap.playerById.get(r.playerId), r.rank, `p:${r.playerId}`, null);
  } else if (g?.standings) { // carts, one match, everyone alone: the game's own standings
    for (const r of g.standings) for (const pid of snap.teamById.get(r.teamId)?.playerIds || [])
      add(snap.playerById.get(pid), r.rank, `t:${r.teamId}`, null);
  } else { // stroke play: low total (net when the round has handicaps), finishers only
    const net = snap.hasStrokes;
    const ps = snap.players.filter((p) => p.thru > 0).map((p) => ({ p, v: net ? p.netTotal : p.grossTotal }))
      .sort((a, b) => a.v - b.v);
    ps.forEach((x, i) => add(x.p, i > 0 && ps[i - 1].v === x.v ? out[i - 1].rank : i + 1, `p:${x.p.id}`, null));
  }
  const fin = out.filter((r) => r.key);
  for (const f of fin) f.mates = fin.filter((x) => x !== f && x.unit === f.unit && !String(f.unit).startsWith('side:')).map((x) => x.name);
  return fin;
}

/** The record for one round: { key: { w, l } } (halves as .5). */
export function roundRecord(finish) {
  const rec = new Map();
  for (const a of finish) {
    const r = rec.get(a.key) || { w: 0, l: 0 };
    for (const b of finish) {
      if (b === a || b.unit === a.unit) continue;
      if (a.rank < b.rank) r.w += 1; else if (a.rank > b.rank) r.l += 1; else { r.w += 0.5; r.l += 0.5; }
    }
    rec.set(a.key, r);
  }
  return rec;
}

/** Standings for a season as a record: rows ranked by win rate, unranked (under MIN_ROUNDS) last.
 *  Each row: { key, name, rounds, w, l, pct, rank, tied, ranked, me, days: [{ code, date, game, place, of, w, l, after }] } */
export function seasonRecordTable(season, mePersonId = null) {
  const rows = new Map();
  const sorted = [...(season.rounds || [])].sort((a, b) => dayOfEvent(a.event).localeCompare(dayOfEvent(b.event)));
  for (const { event, scores } of sorted) {
    const fin = roundFinish(event, scores);
    if (!fin || fin.length < 2) continue;
    const rec = roundRecord(fin);
    const units = new Set(fin.map((f) => f.unit)).size;
    for (const f of fin) {
      const row = rows.get(f.key) || { key: f.key, name: f.name, rounds: 0, w: 0, l: 0, days: [] };
      const r = rec.get(f.key);
      row.name = f.name; row.rounds += 1; row.w += r.w; row.l += r.l;
      row.days.push({ code: event.code, date: dayOfEvent(event), place: f.rank, of: units, w: r.w, l: r.l,
        after: row.w + row.l ? row.w / (row.w + row.l) : 0, game: f.game, players: f.players, mates: f.mates, gross: f.gross,
        cart: f.mates.length > 0 });
      rows.set(f.key, row);
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, pct: r.w + r.l ? r.w / (r.w + r.l) : 0,
    ranked: r.rounds >= MIN_ROUNDS, personId: r.key.startsWith('name:') ? null : r.key }));
  list.sort((a, b) => (b.ranked - a.ranked) || b.pct - a.pct || b.w - a.w || String(a.name).localeCompare(String(b.name)));
  let prev = null;
  list.forEach((r, i) => {
    if (!r.ranked) { r.rank = null; return; }
    r.rank = prev && Math.abs(prev.pct - r.pct) < 1e-9 ? prev.rank : i + 1;
    prev = r;
  });
  list.forEach((r) => {
    r.tied = r.ranked && list.filter((x) => x.ranked && x.rank === r.rank).length > 1;
    r.me = !!mePersonId && r.personId === mePersonId;
  });
  return { rows: list, me: list.find((r) => r.me) || null };
}

/** ".643" (league style); "1.000" when perfect. */
export const pctLabel = (p) => (p >= 1 ? '1.000' : p.toFixed(3).replace(/^0/, ''));
/** "13½–7½" */
export const recordLabel = (w, l) => `${halfLabel(w)}–${halfLabel(l)}`;
const halfLabel = (n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ''}½`);

/** The four "bests" on your season card: best day, best game, best partner, low round (any can be null). */
export function seasonBests(row) {
  const days = row?.days || [];
  const net = (d) => d.w - d.l;
  const bestDay = days.length ? days.reduce((a, d) => (net(d) > net(a) ? d : a)) : null;
  const groupBest = (keyOf) => {
    const m = new Map();
    for (const d of days) { const k = keyOf(d); if (!k) continue; const x = m.get(k) || { key: k, w: 0, l: 0, rounds: 0 }; x.w += d.w; x.l += d.l; x.rounds++; m.set(k, x); }
    return [...m.values()].sort((a, b) => b.w / (b.w + b.l || 1) - a.w / (a.w + a.l || 1) || b.rounds - a.rounds)[0] || null;
  };
  const low = days.filter((d) => d.gross != null).sort((a, b) => a.gross - b.gross)[0] || null;
  return { bestDay, bestGame: groupBest((d) => d.game), bestPartner: groupBest((d) => d.mates.join(' + ')), lowRound: low };
}

/** "1st", "3rd" */
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

/**
 * 037 v2 §7 · Standings' header, now that the crew's controls live there (pure): the crew switcher when this phone is
 * in two or more crews (the current one pressed), Invite, and Name your crew while it has no name.
 * list = [{ id, name }] (this phone's crews), id = the crew on screen, name = its name (null = unnamed).
 */
export function standingsHeader({ list = [], id = null, name = null } = {}) {
  return {
    switcher: list.length > 1 ? list.map((c) => ({ id: c.id, name: c.name || 'Your crew', on: c.id === id })) : null,
    invite: !!id,
    nameCrew: !!id && !name,
  };
}
