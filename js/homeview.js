// homeview.js — PURE. 039 Home is the wallet (docs/design/features/039-home-deck/SPEC.md; PLAN.md §4 set A for the
// headline): what Home draws from what this phone knows. home.js renders it and runs the wallet's physics; nothing
// here touches the DOM, storage or the network.
//
// homeModel(input) → {
//   brandNew,
//   nudge    { kind: 'add' } | { kind: 'news', id, title, lines } | null   (037 v2 §4.2, unchanged)
//   headline { rung, kicker, text, tap }   one plain full sentence (PLAN §4 set A), every word in COPY below
//   items    the wallet, front to back: the next-round card → the newest sealed pack → your cards, newest first;
//            zero cards + a person = the paper member card. Each { kind, key, … } (see walletItems).
//   join     true = no wallet: the join field sits in its place (no person, nothing to show)
//   live     the live round for the strip above the dock: { code, hole, line } | null
// }
//
// Every sentence Home says is in COPY / WORDS below (Andrew wants to try other wordings: change them there).

import { compute, fmtPts } from './scoring.js';
import { roundFinish } from './seasons.js';

export const LIVE_FOR = 12 * 3600 * 1000; // a round last seen live more than 12 h ago isn't "playing now"
export const SOON = 48 * 3600 * 1000; // a round due within 48 h says TODAY / TOMORROW and gets the "soon" headline
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

// ───────────────────────────────────────────── the copy table (every word Home says)

/** PLAN §4: game words in sentences, keyed on playFor (never a gameName label in a sentence). */
export const GAME_PHRASE = {
  ryder: 'the Team Ryder Cup', alone: 'for points, everyone on their own', stroke: 'stroke play', partners: 'a 2v2 match',
  oneMatch: 'a match', cart: 'the Rider Cup', legacy: 'the match',
};
/** SPEC §2: the short form on the next-round card's Game field. */
export const GAME_SHORT = {
  ryder: 'Ryder Cup', alone: 'Points', stroke: 'Stroke', partners: '2v2', oneMatch: '2v2', cart: 'Rider Cup', legacy: 'Match',
};
/** SPEC §2: the tee sheet's one line on how the game works. */
export const GAME_HOW = {
  ryder: 'Team Ryder Cup. Carts play carts; every match won is a point for your side.',
  cart: 'Partner “Rider” Cup. Low ball and low total win a point each hole.',
  partners: '2v2. Partners switch during the round; the points you win are your own.',
  oneMatch: '2v2. You and your partner against one cart: low ball and low total.',
  alone: 'Everyone on their own: the low net score wins each hole’s point.',
  stroke: 'Stroke play. Every shot counts; the low total wins.',
  legacy: 'Match play between carts.',
};
/** Games where you have a partner (Cart · With on the card; "On the tee" until partners are drawn). */
export const PARTNER_GAMES = new Set(['ryder', 'cart', 'partners', 'oneMatch', 'legacy']);

/** A finished round's result as one sentence (PLAN §4 set A: a subject, a verb, and out of what). Never strokes. */
export function resultSentence(r) {
  if (!r) return '';
  switch (r.kind) {
    case 'won': return r.mates ? `You and ${r.mates} won.` : `You finished 1st of ${r.of} ${r.unit}.`;
    case 'low': return 'You had the low round of the group.';
    case 'place': {
      const tied = String(r.place).startsWith('T');
      const pl = tied ? ordinal(Number(String(r.place).slice(1))) : r.place;
      const who = r.mates ? `You and ${r.mates}` : 'You';
      return `${who} ${tied ? 'tied for' : 'finished'} ${pl} of ${r.of} ${r.unit}.`;
    }
    case 'cup': return r.shared ? `The cup was shared, ${r.score}.` : r.mine === false ? `Your side lost the cup, ${r.score}.` : `Your side won the cup, ${r.score}.`;
    default: return `${r.line}.`;
  }
}
const up = (s) => String(s || '').toUpperCase();
const kick = (...parts) => parts.filter(Boolean).map(up).join(' · ');
export const COPY = {
  live: { kicker: (f) => kick('Live', f.course), text: (f) => (f.phrase ? `You’re playing ${f.phrase}.` : 'You’re on the course.') },
  removed: { kicker: (f) => kick(f.weekday, f.course), text: (f) => (f.sub ? `${f.host || 'The host'} gave your spot to ${f.sub}.` : 'Your spot in the next round is gone.') },
  off: { kicker: (f) => kick(f.weekday, f.course), text: (f) => `${f.host || 'The host'} called off ${f.weekday ? `${f.weekday}’s` : 'the'} round.` },
  soon: { kicker: (f) => kick('Next round', f.course), text: (f) => (f.mate ? `You’re riding with ${f.mate}.` : f.players ? `${f.players} players are in.` : 'You’re in.') },
  pack: { kicker: (f) => kick('New card', f.course), text: (f) => `Your card from ${f.weekday || 'your last round'} is ready to open.` },
  coming: { kicker: (f) => kick('Next round', f.course), text: (f) => (f.days === 0 ? 'You play today.' : f.days === 1 ? 'You play tomorrow.' : `You play in ${f.days} days.`) },
  recent: { kicker: (f) => kick('Last round', f.course, f.date), text: (f) => resultSentence(f.result) },
  crew: { kicker: (f) => up(f.crew), text: (f) => `You’re ${f.place} in the standings.` },
  older: { kicker: (f) => kick('Last round', f.ago), text: (f) => resultSentence(f.result) },
  unfinished: { kicker: () => 'GOLF BOARD', text: () => 'No finished rounds yet.' },
  empty: { kicker: () => 'GOLF BOARD', text: () => 'Live scores for your group’s round.' },
};
/** Home's other words (nudges, the plain card, the next-round card, the count line). */
export const WORDS = {
  addNudge: 'Add Golf Board to your Home Screen',
  blank: 'Your card prints after your first round.',
  offline: 'Your cards load with signal.',
  member: 'Member',
  memberSince: (day) => { const [y, m] = String(day).split('-').map(Number); return `First round ${MON[m - 1]} ${y}`; },
  noRoundsYet: 'No rounds yet',
  nextRound: 'Next round',
  liveNow: 'Live now',
  onTheTee: 'On the tee',
  count: (i, n) => (n > 1 ? `${i} of ${n}` : ''),
};
const ago = (days) => (days < 14 ? '1 week ago' : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`);
const dateKick = (iso) => { const wd = weekday(iso).slice(0, 3); return wd ? `${wd} ${shortDay(iso)}` : ''; };

// ───────────────────────────────────────────── finished rounds (037's engine path, kept)

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

/** PLAN §4: the game result of a finished round, from your seat. Never a stroke total. */
export function resultOf(fu, meName = '') {
  if (!fu || fu.units.length < 2) return null;
  const me = fu.units.find((u) => u.me);
  if (fu.kind === 'ryder') {
    const [a, b] = fu.units;
    if (a.rank === b.rank) return { kind: 'cup', shared: true, score: `${a.value}–${b.value}` };
    const mine = me ? me === a : null; // your side's score first
    return { kind: 'cup', side: a.name, mine, score: mine === false ? `${b.value}–${a.value}` : `${a.value}–${b.value}` };
  }
  if (!me) return null;
  const tied = fu.units.filter((u) => u.rank === me.rank).length > 1;
  const of = fu.units.length;
  const unit = fu.kind === 'team' ? 'carts' : 'players';
  const mates = me.names.length > 1 ? andList(me.names.filter((n) => first(n) !== first(meName)).map(first)) : '';
  if (me.rank === 1 && !tied) {
    if (fu.kind === 'stroke') return { kind: 'low', of, unit };
    return { kind: 'won', mates: me.names.length > 1 ? (mates || andList(me.names.slice(1).map(first))) : '', of, unit };
  }
  return { kind: 'place', place: tied ? `T${me.rank}` : ordinal(me.rank), of, unit, mates };
}

/** Old rounds without a locker row: the stored result line, any score stripped ("You 1st · 87" → "You 1st"). */
export function lineResult(line) {
  const s = String(line || '').replace(/\s*·\s*(net\s*)?[+−-]?\d+\s*$/i, '').replace(/\s*(net\s*)?\d{2,3}\s*$/i, '').trim();
  return s ? { kind: 'line', line: s } : null;
}

// ───────────────────────────────────────────── rounds, the next-round card

/** Which recent rounds are coming up (lobby, not past yesterday) and which one is live now. */
export function roundGroups(rounds, now) {
  const yesterday = new Date(now - DAY).toISOString().slice(0, 10);
  const coming = rounds.filter((r) => r.lobby && (!r.played_on || r.played_on >= yesterday));
  const live = rounds.find((r) => !r.lobby && r.live && !r.done && now - (r.seen || r.at || 0) < LIVE_FOR) || null;
  return { coming, live };
}

/** Rounds' list (039; 037's All rounds): everything but the coming rounds (those are the "Now" rows). */
export function allRounds(rounds, now) {
  const { coming } = roundGroups(rounds, now);
  return rounds.filter((r) => !coming.includes(r));
}

/** One coming round (lobby.homeCard, kept in glb.recent). Old entries miss the newer fields: recent.course / played_on. */
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
    weekday: weekday(date), dow: wd, mon: shortDay(date).toUpperCase(),
    badge: c.kind === 'off' ? 'Called off' : c.kind === 'removed' ? 'Spot given' : due && days === 0 ? 'Today' : due && days === 1 ? 'Tomorrow' : null,
    course: c.course || r.course || '', game: c.game || r.game || '', time, host: first(c.host),
    players: Number.isFinite(c.players) ? c.players : null, onRoster: c.onRoster ?? true, mate: c.mate || null, sub: c.sub || null,
    pk: c.pk || null, cart: c.cart || null, sheet: c.sheet || null, with: c.with || null,
  };
}

/**
 * SPEC §2 · what the next-round card (A3) prints. `n` = { live: recent row with .live } or { pass: passOf(...) }.
 * → { code, live, off, kicker, stamp, big, dd: [b, small], course, fields: [[label, value]] ×3, btn: { label, act, v },
 *     share, sheet: { date, groups, how, host, players, code }, aria }
 */
export function nextFields(n) {
  if (n.live) {
    const r = n.live, L = r.live || {}, c = L.card || {};
    const pk = c.pk || null;
    const partner = !!(c.mate && (!pk || PARTNER_GAMES.has(pk)));
    const hole = L.hole || null;
    return {
      code: r.code, live: true, off: false, kicker: WORDS.liveNow, stamp: hole ? `Hole ${hole}` : 'Live',
      big: hole ? String(hole) : '—', dd: ['Hole', 'of 18'], course: r.course || r.name || '',
      fields: partner ? [['Thru', c.thru != null ? String(c.thru) : '—'], ['Match', c.match || '—'], ['With', c.mate]]
        : [['Thru', c.thru != null ? String(c.thru) : '—'], ['Place', c.place || '—'], ['Players', c.players ? String(c.players) : '—']],
      btn: { label: hole ? `Hole ${hole} ›` : 'Back in ›', act: 'go', v: `#/e/${r.code}` }, share: false,
      sheet: c.sheet ? { ...c.sheet, how: GAME_HOW[pk] || '', code: r.code } : null,
      aria: `Live now: ${r.course || r.name || 'your round'}${hole ? `, hole ${hole}` : ''}`,
    };
  }
  const p = n.pass;
  const off = p.kind === 'off' || p.kind === 'removed';
  const pk = p.pk || null;
  const game = (pk && GAME_SHORT[pk]) || p.game || 'Round';
  const players = p.players != null ? String(p.players) : '—';
  let fields;
  if (pk && !PARTNER_GAMES.has(pk)) fields = [['Game', game], ['Players', players], ['With', p.with || p.host || '—']];
  else if (p.mate && p.onRoster) fields = [['Game', game], ['Cart', p.cart || '—'], ['With', p.mate]];
  else fields = [['Game', game], ['Players', players], ['Partner', WORDS.onTheTee]];
  const [h] = String(p.time || '').split(' ');
  return {
    code: p.code, live: false, off, kicker: WORDS.nextRound, stamp: p.badge || null,
    big: h || (p.date ? String(Number(p.date.slice(8, 10))) : '—'),
    dd: h ? [p.dow ? p.dow.charAt(0) + p.dow.slice(1).toLowerCase() : '', p.mon] : [p.dow ? p.dow.charAt(0) + p.dow.slice(1).toLowerCase() : '', p.mon.split(' ')[0] || ''],
    course: p.course || p.name || '', fields,
    btn: off ? { label: `Text ${p.host || 'the host'}`, act: 'home-text', v: p.host || 'the host' } : { label: 'Open', act: 'go', v: `#/e/${p.code}` },
    share: !off,
    sheet: { date: [p.dow, p.mon].filter(Boolean).join(' '), groups: p.sheet?.groups || [], how: GAME_HOW[pk] || '', host: p.host || '', players: p.players, code: p.code },
    aria: [p.name, p.day, p.course].filter(Boolean).join(', '),
  };
}

/**
 * SPEC §1 · the wallet, front to back: the next round (live, else the soonest coming) → the newest sealed pack → your
 * opened cards newest first. Zero cards and a person: the paper member card. While the locker loads / fails: a plain
 * box ("loading" / "offline") behind the next round.
 */
export function walletItems({ next = null, packs = [], opened = [], member = null, state = 'ready', hadCards = false, crewLine = () => '' } = {}) {
  const out = [];
  if (next) out.push({ kind: 'next', key: `next:${next.code}`, n: next });
  if (state === 'loading') { out.push({ kind: 'loading', key: 'loading' }); return out; }
  if (state === 'failed' && hadCards) { out.push({ kind: 'offline', key: 'offline' }); return out; }
  const newestPack = packs.length ? packs[packs.length - 1] : null;
  if (newestPack) out.push({ kind: 'pack', key: `pack:${newestPack.code}`, card: newestPack, count: packs.length });
  for (const card of opened) out.push({ kind: 'card', key: `card:${card.code}`, card, crewLine: crewLine(card) });
  if (!newestPack && !opened.length && member) out.push({ kind: 'member', key: 'member', ...member });
  return out;
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

  // 037 v2 §4.2 the nudge: never while a round is live; Add to Home Screen first.
  let nudge = null;
  if (!live) {
    if (ios && !standalone && !seen.add) nudge = { kind: 'add' };
    else if (news) nudge = { kind: 'news', id: news.id, title: news.title, lines: news.lines };
  }

  const passes = coming.map((r) => passOf(r, { now, today })).sort((a, b) => (a.startsAt ?? Infinity) - (b.startsAt ?? Infinity));
  const packs = cards ? cards.filter((c) => !c.opened) : [];
  const opened = cards ? cards.filter((c) => c.opened).sort((a, b) => String(b.day).localeCompare(String(a.day))) : [];
  const rowOf = (card) => (locker?.rows || []).find((x) => x.event?.id === card.eventId) || null;
  const crewLine = (card) => {
    const row = rowOf(card);
    const crewName = row?.event?.crew_id ? crewNames[row.event.crew_id] || '' : '';
    return [crewName, card.name || meName].filter(Boolean).join(' · ');
  };
  const nextSrc = live ? { live } : passes.length ? { pass: passes[0] } : null;
  const next = nextSrc ? nextFields(nextSrc) : null;

  let member = null;
  if (personId && (meFull || meName)) {
    const days = (locker?.rows || []).filter((x) => (x.event?.roster?.players || []).some((p) => p.personId === personId))
      .map((x) => dayOf(x.event)).filter(Boolean).sort();
    member = { name: meFull || meName, crew: crews?.list?.length ? crews.name || '' : '', line: days.length ? WORDS.memberSince(days[0]) : WORDS.noRoundsYet };
  }
  const items = personId
    ? walletItems({ next, packs, opened, member, state: state === 'none' ? 'ready' : state, hadCards, crewLine })
    : (next ? [{ kind: 'next', key: `next:${next.code}`, n: next }] : []);

  const headline = ladder({ live, passes, newestPack: packs.length ? packs[packs.length - 1] : null, opened, rounds, crews, today, locker, rowOf, personId, meName });
  const liveStrip = live ? { code: live.code, hole: live.live?.hole || null, line: live.live?.line || [live.course, live.game].filter(Boolean).join(' · ') } : null;
  return { brandNew, nudge, headline, items, join: !items.length, live: liveStrip };
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

/** PLAN §4 · the headline ladder (set A): first match wins. → { rung, kicker, text, tap } */
export function ladder({ live, passes = [], newestPack = null, opened = [], rounds = [], crews = null, today, locker = null, rowOf = () => null, personId = null, meName = '' }) {
  const out = (rung, f, tap = null) => ({ rung, kicker: COPY[rung].kicker(f), text: COPY[rung].text(f), tap });
  if (live) return out('live', { phrase: GAME_PHRASE[live.live?.card?.pk] || '', course: live.course || '' });
  const fp = passes[0] || null;
  if (fp?.kind === 'removed') return out('removed', fp, `#/e/${fp.code}`);
  if (fp?.kind === 'off') return out('off', fp);
  if (fp?.due) return out('soon', { ...fp, mate: fp.onRoster ? fp.mate : null });
  if (newestPack) return out('pack', { course: newestPack.course, weekday: weekday(newestPack.day) });
  const nextUp = passes.find((p) => p.kind === 'coming' && p.days != null && p.days >= 0 && p.days <= 14);
  if (nextUp) return out('coming', nextUp);
  const ctx = { rowOf, personId, meName, rounds };
  // Your last finished round: the latest opened card, else (no locker) the newest round this phone saw finish.
  let last = null;
  if (opened.length) last = { day: opened[0].day, course: opened[0].course, result: cardResult(opened[0], ctx) };
  else if (!locker) {
    const done = rounds.filter((r) => r.done && r.result?.line && !r.lobby).sort((a, b) => dayOf(b).localeCompare(dayOf(a)))[0];
    if (done) last = { day: dayOf(done), course: done.course || '', result: lineResult(done.result.line) };
  }
  const since = last ? (dayNum(today) ?? 0) - (dayNum(last.day) ?? 0) : null;
  if (last?.result && since <= 7) return out('recent', { result: last.result, course: last.course, date: dateKick(last.day) });
  const s = crews?.standing;
  if (crews?.list?.length && s?.place) return out('crew', { crew: crews.name || 'Your crew', place: s.place }, '#/season');
  if (last?.result) return out('older', { result: last.result, ago: ago(since) });
  if (rounds.length) return out('unfinished', {});
  return out('empty', {});
}

/** The key Home remembers in glb.seen.homeTop (the wallet's front item), so a new front deals in again. */
export function topKey(item) {
  return item?.key || null;
}

// ───────────────────────────────────────────── the wallet's geometry (pure part of the physics, SPEC §1)

export const EDGE = 48; // px of each card behind the front that peeks above it
export const EDGES = { app: 2, safari: 1 };
export const STEP = 170; // px of drag = one card back in time

/**
 * The wallet's fit for a box `Wc` wide with `Hc` px to spare: the front card's size and how many edges show.
 * Front = full width at 7:5, shrinking to fit; edges drop (app 2 → 0, Safari 1 → 0) before it goes under 200 tall.
 * → { K, CW, CH, need } (need = the wallet's own height: it's only as tall as it needs).
 */
export function walletFit(Wc, Hc, n, { app = false } = {}) {
  let K = Math.max(0, Math.min(n - 1, app ? EDGES.app : EDGES.safari));
  const full = Math.round(Wc / 1.4);
  let CH;
  for (;;) { CH = Math.min(full, Hc - 24 - K * EDGE); if (CH >= 200 || K === 0) break; K--; }
  CH = Math.max(120, CH);
  const CW = Math.min(Wc, Math.round(CH * 1.4));
  return { K, CW, CH: Math.round(CW / 1.4), need: 24 + Math.round(CW / 1.4) + K * EDGE };
}

/** One card's pose at depth d (0 = front, >0 behind, <0 pulled into the pocket below). Ported from prototype-v7. */
export function poseOne(d, { K, CH, yF }) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let y = yF, s = 1, o = 1, z = 50, lab = 0;
  if (d >= 0) {
    const dd = Math.min(d, K);
    y = yF - dd * EDGE - Math.max(0, d - K) * 10;
    o = d <= K ? 1 : clamp(1 - (d - K) * 2.5, 0, 1);
    z = 50 - Math.round(d * 10); lab = clamp((d - 0.2) * 3, 0, 1);
  } else {
    const t = -d; z = 60;
    y = yF + t * (CH + 16); s = 1 - t * 0.04;
  }
  return { y, s, o, z, lab };
}

/** Rubber band past either end; the settle target after a fling (≈ 200 ms projection). */
export const rubber = (p, n) => (p < 0 ? p * 0.3 : p > n - 1 ? n - 1 + (p - (n - 1)) * 0.3 : p);
export const settleTo = (p, vy, n) => Math.max(0, Math.min(n - 1, Math.round(p + (vy * 200) / STEP)));
