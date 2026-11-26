// homeview.js — PURE. 037 Home, second pass "the wallet" (docs/design/features/037-home/PLAN-v2.md, §0 wins):
// what Home draws from what this phone knows. home.js renders it and measures the fit; nothing here touches the DOM,
// storage or the network.
//
// homeModel(input) → {
//   brandNew,
//   nudge   §4.2: { kind: 'add' } | { kind: 'news', id, title, lines } | null
//   headline §5: { rung, kicker, app: [form], safari: [form], tap } — form = { b: bright, g: grey }; home.js shows the
//           first app form that fits (two lines in the app, one in Safari), then the Safari forms, the last one always.
//   front   §6: { kind: 'card', card, crewLine } | { kind: 'pack', card, count } | { kind: 'pass', pass }
//               | { kind: 'member', name, line } | { kind: 'blank' } | { kind: 'loading' } | { kind: 'offline' }
//   edges   §6.1: [{ kind: 'pass', pass } | { kind: 'pack', card, count } | { kind: 'card', card }], nearest first
//   edgeMax §0.1: how many edges this size may show (the measured fit in home.js can drop more)
//   slot    §7 / §6.4: { kind: 'crew', id, name, place, sub } | { kind: 'start' } | { kind: 'join' } | null
//   doors   §8: { allRounds: bool, addHome: bool }
//   foot    §8: { kind: 'buttons' } | { kind: 'new' } | { kind: 'live', code, hole, line }
// }
//
// Every sentence Home says is in COPY below (Andrew wants to try other wordings: change them there, not in layout).

import { compute, fmtPts } from './scoring.js';
import { roundFinish } from './seasons.js';

export const LIVE_FOR = 12 * 3600 * 1000; // a round last seen live more than 12 h ago isn't "playing now"
export const SOON = 48 * 3600 * 1000; // §6: a pass due within 48 h goes in front of a pack
export const EDGES = { app: 3, safari: 1 }; // §0 fix 1
const DAY = 86400000;
const FINISH_CACHE = new WeakMap(); // { event, scores } row → { personId, fu }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDay = (d) => { const [, m, dd] = String(d || '').split('-').map(Number); return m ? `${MON[m - 1]} ${dd}` : ''; };
const dayOf = (r) => String(r?.played_on || (r?.at ? new Date(r.at).toISOString() : '')).slice(0, 10);
const dayNum = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null; };
const weekday = (iso) => { const n = dayNum(iso); return n == null ? '' : WD[new Date(n * DAY).getUTCDay()]; };
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;
const andList = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
/** "YYYY-MM-DD" of `now` on this phone (the caller's clock); tests pass `today`. */
export const localDay = (now) => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ───────────────────────────────────────────── §5 · the copy table (every word Home's headline says)

const F = (b, g = '') => ({ b, g });
/** A finished round's result as headline forms (rungs 6, 8, 10). Never strokes. */
function resultForms(r) {
  if (!r) return null;
  switch (r.kind) {
    case 'won': return { app: [F('Won', r.mates ? ` with ${r.mates}.` : ` of ${r.of}.`)], safari: [F('Won.')] };
    case 'low': return { app: [F('Low round', ` of ${r.of}.`)], safari: [F('Low round.')] };
    case 'place': return { app: [F(`${r.place} of ${r.of}.`)], safari: [F(`${r.place} of ${r.of}.`)] };
    case 'cup': return r.shared ? { app: [F('Cup shared', ` ${r.score}.`)], safari: [F('Cup shared.')] }
      : { app: [F(`${r.side} won`, ` ${r.score}.`)], safari: [F(`${r.side} won.`)] };
    default: return { app: [F(`${r.line}.`)], safari: [F(`${r.line}.`)] };
  }
}
export const COPY = {
  live: { kicker: () => 'On the course', app: (f) => [f.course ? F(f.game, ` at ${f.course}.`) : F(`${f.game}.`)], safari: (f) => [F(`${f.game}.`)] },
  removed: { kicker: (f) => `Needs you · ${f.dow}`, app: (f) => [F(f.sub ? `${f.sub} has your spot.` : 'Your spot is gone.')], safari: (f) => [F(f.sub ? `${f.sub} has your spot.` : 'Your spot is gone.')] },
  off: { kicker: (f) => f.weekday || 'Called off', app: (f) => [F(`${f.host || 'The host'} called it off.`)], safari: (f) => [F(`${f.host || 'Host'} cancelled.`)] },
  soon: {
    kicker: () => 'Next round',
    // §0 fix 4: a long first name in Safari falls to the roster form ("8 players in."), never two lines.
    app: (f) => [...(f.mate ? [F(`Riding with ${f.mate}.`)] : []), F(f.players ? `${f.players} players in.` : 'You’re in.')],
    safari: (f) => [...(f.mate ? [F(`Riding with ${f.mate}.`)] : []), F(f.players ? `${f.players} players in.` : 'You’re in.')],
  },
  pack: { kicker: () => 'New pack', app: (f) => resultForms(f.result).app, safari: (f) => resultForms(f.result).safari },
  coming: {
    kicker: () => 'Next round',
    app: (f) => [F(f.onRoster || !f.players ? (f.days <= 1 ? (f.days ? 'Tomorrow.' : 'Today.') : `${f.days} days out.`) : `${f.players} players in.`)],
    safari: (f) => COPY.coming.app(f),
  },
  recent: { kicker: () => 'Last out', app: (f) => resultForms(f.result).app, safari: (f) => resultForms(f.result).safari },
  crew: { kicker: (f) => f.crew, app: (f) => [F(f.iLead ? `${f.next} is next.` : `${f.leader} leads.`)], safari: (f) => COPY.crew.app(f) },
  older: { kicker: (f) => `Last out · ${f.ago}`, app: (f) => resultForms(f.result).app, safari: (f) => resultForms(f.result).safari },
  unfinished: { kicker: () => 'Golf Board', app: () => [F('No rounds finished.')], safari: () => [F('No rounds finished.')] },
  empty: { kicker: () => 'Golf Board', app: () => [F('Live scores', ' for your group.')], safari: () => [F('Live scores.')] },
};
/** Home's other words (nudges, plain card, boxes, rows). */
export const WORDS = {
  addNudge: 'Add Golf Board to your Home Screen',
  newsNudge: (title) => `New · ${title}`,
  blank: 'Your card prints after your first round.',
  offline: 'Your cards load with signal.',
  member: 'Member',
  memberSince: (day) => { const [y, m] = String(day).split('-').map(Number); return `First round ${MON[m - 1]} ${y}`; },
  noRoundsYet: 'No rounds yet',
  standings: 'Standings',
  startCrew: 'Start a crew',
  noCrew: 'No crew yet',
  unranked: (n, min) => `${n} of ${min} rounds`,
};
const ago = (days) => (days < 14 ? '1 week ago' : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`);

// ───────────────────────────────────────────── finished rounds (the first build's engine path, kept)

/**
 * One finished round's order as units (carts / sides / pairs = one row), with what the game counts.
 * → { kind: 'stroke'|'ryder'|'team'|'alone', units: [{ unit, rank, name, names, value, me }], players } or null.
 */
export function finishUnits(event, scores, personId) {
  const fin = roundFinish(event, scores);
  if (!fin || !fin.length) return null;
  const snap = compute(event, scores || []);
  const g = snap.game;
  const values = new Map(); // unit → value
  let kind = 'alone';
  if (g?.sides) {
    kind = 'ryder';
    for (const sd of g.sides) values.set(`side:${sd.sideId}`, { value: fmtPts(sd.points), name: sd.name });
  } else if (g?.people && snap.settings.pairSwitch && snap.settings.pairSwitch !== 'never') {
    for (const r of g.people) values.set(`p:${r.playerId}`, { value: fmtPts(r.points) });
  } else if (g?.standings) {
    for (const r of g.standings) values.set(`t:${r.teamId}`, { value: fmtPts(r.points) });
  } else {
    kind = 'stroke';
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
  if (kind === 'alone' && units.some((u) => u.names.length > 1)) kind = 'team';
  return {
    kind,
    units: units.map((u) => ({ ...u, name: u.name || u.names.join(' + '), value: u.value || '' })),
    players: snap.players.length,
  };
}

/** §5 rungs 6/8/10: the game result of a finished round, from your seat. Never a stroke total. */
export function resultOf(fu, meName = '') {
  if (!fu || fu.units.length < 2) return null;
  const me = fu.units.find((u) => u.me);
  if (fu.kind === 'ryder') {
    const [a, b] = fu.units;
    const score = `${a.value}–${b.value}`;
    return a.rank === b.rank ? { kind: 'cup', shared: true, score } : { kind: 'cup', side: a.name, score };
  }
  if (!me) return null;
  const tied = fu.units.filter((u) => u.rank === me.rank).length > 1;
  const of = fu.units.length;
  if (me.rank === 1 && !tied) {
    if (fu.kind === 'stroke') return { kind: 'low', of };
    const mates = me.names.filter((n) => first(n) !== first(meName)).map(first);
    return { kind: 'won', mates: me.names.length > 1 ? andList(mates.length ? mates : me.names.slice(1).map(first)) : '', of };
  }
  return { kind: 'place', place: tied ? `T${me.rank}` : ordinal(me.rank), of };
}

/** Old rounds without a locker row: the stored result line, any score stripped ("You 1st · 87" → "You 1st"). */
export function lineResult(line) {
  const s = String(line || '').replace(/\s*·\s*(net\s*)?[+−-]?\d+\s*$/i, '').replace(/\s*(net\s*)?\d{2,3}\s*$/i, '').trim();
  return s ? { kind: 'line', line: s } : null;
}

// ───────────────────────────────────────────── rounds, passes, crew

/** Which recent rounds are coming up (lobby, not past yesterday) and which one is live now. */
export function roundGroups(rounds, now) {
  const yesterday = new Date(now - DAY).toISOString().slice(0, 10);
  const coming = rounds.filter((r) => r.lobby && (!r.played_on || r.played_on >= yesterday));
  const live = rounds.find((r) => !r.lobby && r.live && !r.done && now - (r.seen || r.at || 0) < LIVE_FOR) || null;
  return { coming, live };
}

/** #/rounds (All rounds): everything but the coming passes. */
export function allRounds(rounds, now) {
  const { coming } = roundGroups(rounds, now);
  return rounds.filter((r) => !coming.includes(r));
}

/** §6.2 · one coming round as a pass. Old recent.lobby entries miss the new fields: recent.course / played_on. */
export function passOf(r, { now, today }) {
  const c = r.lobby || {};
  const date = c.date || r.played_on || '';
  const startsAt = Number.isFinite(c.startsAt) ? c.startsAt : (date ? Date.parse(`${date}T12:00:00Z`) : null);
  const dn = dayNum(date), tn = dayNum(today);
  const days = dn != null && tn != null ? dn - tn : null;
  const due = startsAt != null && startsAt - now <= SOON && days != null && days >= 0;
  const wd = weekday(date).slice(0, 3).toUpperCase();
  const time = c.startTime || '';
  return {
    code: r.code, name: r.name || '', kind: c.kind || 'coming', date, days, due, startsAt,
    day: time ? `${wd} ${time}`.trim() : `${wd} ${shortDay(date).toUpperCase()}`.trim(),
    weekday: weekday(date), dow: wd,
    badge: c.kind === 'off' ? 'Called off' : c.kind === 'removed' ? 'Spot given' : due && days === 0 ? 'Today' : due && days === 1 ? 'Tomorrow' : null,
    course: c.course || r.course || '', game: c.game || r.game || '', time, host: first(c.host),
    players: Number.isFinite(c.players) ? c.players : null, onRoster: c.onRoster ?? true, mate: c.mate || null, sub: c.sub || null,
  };
}

/** §7 · the crew row. `crews` = homeCrewData: { list, currentId, name, rounds, standing }. */
export function crewSlot(crews, min = 3) {
  const list = crews?.list || [];
  if (!list.length) return { kind: 'start' };
  if (crews.rounds === 0) return null; // a crew with no rounds yet: nothing to stand in
  const s = crews.standing;
  return {
    kind: 'crew', id: crews.currentId || list[0].id, name: crews.name || 'Your crew',
    place: s?.place || null,
    sub: s && !s.place && s.myRounds != null ? WORDS.unranked(s.myRounds, min) : null,
  };
}

// ───────────────────────────────────────────── the model

/**
 * input = {
 *   rounds: glb.recent entries, now, today ('YYYY-MM-DD' on this phone),
 *   personId, locker: { cards, rows, sub } | null, lockerState: 'none' | 'loading' | 'failed' | 'ready', hadCards,
 *   crews (homeCrewData), crewNames: { crewId: name }, meName (first), meFull,
 *   ios, standalone, seen: { add: bool }, news: release | null,
 * }
 */
export function homeModel({
  rounds = [], now = Date.now(), today = null, personId = null, locker = null, lockerState = null, hadCards = false,
  crews = null, crewNames = {}, meName = '', meFull = '', ios = false, standalone = false, seen = {}, news = null,
} = {}) {
  today ||= localDay(now);
  const state = lockerState || (locker ? 'ready' : personId ? 'loading' : 'none');
  const cards = state === 'ready' && Array.isArray(locker?.cards) ? locker.cards : null;
  const brandNew = !rounds.length && !(cards && cards.length);
  const { coming, live } = roundGroups(rounds, now);
  const app = !!standalone;

  // §4.2 the nudge: never while a round is live; Add to Home Screen first.
  let nudge = null;
  if (!live) {
    if (ios && !standalone && !seen.add) nudge = { kind: 'add' };
    else if (news) nudge = { kind: 'news', id: news.id, title: news.title, lines: news.lines };
  }

  // §6 passes (soonest first), packs and cards.
  const passes = coming.map((r) => passOf(r, { now, today })).sort((a, b) => (a.startsAt ?? Infinity) - (b.startsAt ?? Infinity));
  const packs = cards ? cards.filter((c) => !c.opened) : [];
  const opened = cards ? cards.filter((c) => c.opened).sort((a, b) => String(b.day).localeCompare(String(a.day))) : [];
  const newestPack = packs.length ? packs[packs.length - 1] : null;
  const noCards = cards ? !cards.length : state === 'none' || (state === 'failed' && !hadCards);
  const rowOf = (card) => (locker?.rows || []).find((x) => x.event?.id === card.eventId) || null;
  const crewLine = (card) => {
    const row = rowOf(card);
    const crewName = row?.event?.crew_id ? crewNames[row.event.crew_id] || '' : '';
    return [crewName, card.name || meName].filter(Boolean).join(' · ');
  };

  // Front, first match: a pass due within 48 h → a pack → a later pass → your latest scorecard → the plain card.
  const soon = passes.find((p) => p.due) || null;
  let front;
  if (soon) front = { kind: 'pass', pass: soon };
  else if (state === 'loading' && personId) front = { kind: 'loading' };
  else if (newestPack) front = { kind: 'pack', card: newestPack, count: packs.length };
  else if (passes.length) front = { kind: 'pass', pass: passes[0] };
  else if (opened.length) front = { kind: 'card', card: opened[0], crewLine: crewLine(opened[0]) };
  else if (state === 'failed' && hadCards) front = { kind: 'offline' };
  else if (personId && (meFull || meName)) {
    const days = (locker?.rows || []).filter((x) => (x.event?.roster?.players || []).some((p) => p.personId === personId))
      .map((x) => dayOf(x.event)).filter(Boolean).sort();
    const crewName = crews?.list?.length ? crews.name || '' : '';
    front = { kind: 'member', name: meFull || meName, crew: crewName, line: days.length ? WORDS.memberSince(days[0]) : WORDS.noRoundsYet };
  } else front = { kind: 'blank' };

  // §6.1 edges, nearest first: another pass → the pack → opened scorecards, newest first. Never the plain card.
  const edges = [
    ...passes.filter((p) => front.pass !== p).map((pass) => ({ kind: 'pass', pass })),
    ...(newestPack && front.kind !== 'pack' ? [{ kind: 'pack', card: newestPack, count: packs.length }] : []),
    ...opened.filter((c) => front.card !== c).map((card) => ({ kind: 'card', card })),
  ];
  const edgeMax = app ? EDGES.app : (front.kind === 'pack' || nudge || live ? 0 : EDGES.safari);

  // §7 / §6.4 the crew slot.
  const crewRounds = crews?.list?.length && crews.rounds > 0;
  let slot;
  if (live) slot = null;
  else if (noCards && !crewRounds) slot = { kind: 'join' };
  else slot = crewSlot(crews);

  // §8 doors (hidden while the nudge shows) and foot.
  const list = allRounds(rounds, now);
  const doors = nudge ? { allRounds: false, addHome: false } : { allRounds: list.length > 0, addHome: !!ios && !standalone && !!seen.add };
  const foot = live ? { kind: 'live', code: live.code, hole: live.live?.hole || null, line: live.live?.line || '' }
    : slot?.kind === 'join' ? { kind: 'new' } : { kind: 'buttons' };

  const headline = ladder({ live, front, passes, newestPack, opened, rounds, crews, today, locker, rowOf, personId, meName });

  return { brandNew, nudge, headline, front, edges, edgeMax, slot, doors, foot, live };
}

/** The result of the round behind a card (locker row through the engine), else its stored result line. */
function cardResult(card, { rowOf, personId, meName, rounds }) {
  const row = rowOf(card);
  let fu = null;
  if (row) {
    // The render loop redraws often: one engine run per round object (locker rows are kept until the next load).
    const hit = FINISH_CACHE.get(row);
    if (hit && hit.personId === personId) fu = hit.fu;
    else {
      try { fu = finishUnits(row.event, row.scores, personId); } catch { fu = null; } // an odd old round: skip it
      FINISH_CACHE.set(row, { personId, fu });
    }
  }
  return resultOf(fu, meName) || lineResult(rounds.find((r) => r.code === card.code)?.result?.line);
}

/** §5 · the headline ladder: first match wins. → { rung, kicker, app, safari, tap } */
export function ladder({ live, front, passes, newestPack, opened, rounds, crews, today, locker, rowOf, personId, meName }) {
  const out = (rung, f, tap = null) => ({ rung, kicker: COPY[rung].kicker(f), app: COPY[rung].app(f), safari: COPY[rung].safari(f), tap });
  if (live) return out('live', { game: live.game || 'Your round', course: live.course || '' });
  const fp = front.kind === 'pass' ? front.pass : null;
  if (fp?.kind === 'removed') return out('removed', fp, `#/e/${fp.code}`);
  if (fp?.kind === 'off') return out('off', fp);
  if (fp?.due) return out('soon', fp);
  const ctx = { rowOf, personId, meName, rounds };
  if (newestPack) {
    const result = cardResult(newestPack, ctx);
    if (result) return out('pack', { result });
  }
  const next = passes.find((p) => p.kind === 'coming' && p.days != null && p.days <= 14);
  if (next) return out('coming', next);
  // Your last finished round: the latest opened card, else (no locker) the newest round this phone saw finish.
  let last = null;
  if (opened.length) last = { day: opened[0].day, result: cardResult(opened[0], ctx) };
  else if (!locker) {
    const done = rounds.filter((r) => r.done && r.result?.line && !r.lobby).sort((a, b) => dayOf(b).localeCompare(dayOf(a)))[0];
    if (done) last = { day: dayOf(done), result: lineResult(done.result.line) };
  }
  const since = last ? (dayNum(today) ?? 0) - (dayNum(last.day) ?? 0) : null;
  if (last?.result && since <= 7) return out('recent', { result: last.result });
  const s = crews?.standing;
  if (crews?.list?.length && s?.place && s.leader && (!s.iLead || s.next)) {
    return out('crew', { crew: crews.name || 'Your crew', leader: s.leader, next: s.next, iLead: !!s.iLead }, `#/season/${crews.currentId}`);
  }
  if (last?.result) return out('older', { result: last.result, ago: ago(since) });
  if (rounds.length) return out('unfinished', {});
  return out('empty', {});
}

/** The key Home remembers in glb.seen.homeTop, so a new front deals in (§11): card / pack / pass / member / blank. */
export function topKey(front) {
  if (!front) return null;
  if (front.kind === 'card' || front.kind === 'pack') return `${front.kind}:${front.card.code}`;
  if (front.kind === 'pass') return `pass:${front.pass.code}`;
  if (front.kind === 'member' || front.kind === 'blank') return front.kind;
  return null;
}

/** §4.1 · the measured fit (pure part): the front's width for `leftover` px of height, never under `min`. */
export function fitWidth(contentW, leftover, { min = 300, ratio = 7 / 5 } = {}) {
  return Math.max(min, Math.min(contentW, Math.floor(leftover * ratio)));
}
