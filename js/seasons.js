// seasons.js — pure: split a crew's rounds into seasons (feature 008-seasons).
//
// A crew's first season is implicit: it starts with the crew's first round and is named for that date
// ("Fall 2026"). Every season someone starts after that is a row { name, startsOn, createdAt }: it runs
// from startsOn (or, when startsOn is null = "Next round", from the first crew round created after it)
// until the next season starts. Seasons never overlap or leave gaps. A round belongs to the season that
// was active on the day it was played. Standings inside a season use scoring.seasonStandings (cart game
// points, labeled as such until the cross-game standings rework).

import { seasonStandings } from './scoring.js';

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
    list.push({ key: s.id || s.name, name: s.name, start, pending: !start });
  }
  // A season that hasn't started yet sits at the end; started ones keep their order by start date.
  const started = list.filter((s) => s.start).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const upcoming = list.filter((s) => !s.start);
  started.forEach((s, i) => {
    s.end = started[i + 1]?.start || null; // exclusive
    s.rounds = sorted.filter((r) => {
      const d = dayOf(r.event);
      return d >= s.start && (!s.end || d < s.end);
    });
  });
  // Rounds before the first season's start (it starts at the first round, so none) stay in the first one.
  if (started[0]) started[0].rounds = sorted.filter((r) => !started[1] || dayOf(r.event) < started[1].start);
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
