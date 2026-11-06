// lobby.js — PURE. The Team Ryder Cup lobby (handoff 025): a round made with "Invite now, draft later" lives in
// settings.lobby until scoring opens. Every screen, Home, the router and the queue read lobbyState(); nothing
// else reads settings.lobby. Old rounds have no settings.lobby (or null): lobbyState() returns null and nothing
// in this file changes how they behave.
//
//   stage 'lobby'  names are set; no carts or sides yet
//         'teams'  the draft is saved (roster.teams / sides filled)
//         'ready'  start times are saved and opensAt is set (first start − 30 min, on played_on, in tz)
//         'off'    called off (prevStage = what Bring it back restores)
//   open = stage 'ready' and (openedEarly or now ≥ opensAt). The server's gate (_lobby_gate) decides the same.

import { normalizeSettings, groupIndex, ryderMatchupsAt, holeAt, holesLabel, ryderSetup } from './scoring.js';

export const STAGES = ['lobby', 'teams', 'ready', 'off'];
export const OPEN_BEFORE_MIN = 30;
export const RYDER_PLAYERS = 16;
const DAY = 86400000;
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// ───────────────────────────────────────────── time

/** "14:05" → "2:05" (the app's clocks have no am/pm). */
export function clock12(t) {
  const m = HHMM.exec(String(t || ''));
  if (!m) return '';
  return `${((Number(m[1]) + 11) % 12) + 1}:${m[2]}`;
}

function parts(ms, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
}

/** The zone's offset from UTC at an instant, in ms (Chicago in winter = −6 h). */
function offsetAt(ms, tz) {
  const p = parts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

const validTz = (tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return !!tz; } catch { return false; }
};

/**
 * The instant (ms) of a wall-clock time on a date in an IANA zone. Two passes, so it's right on the days the clocks
 * change. A time that doesn't exist (2:30 on spring-forward) resolves one hour later; a time that happens twice
 * (1:30 on fall-back) is the first one. A bad zone falls back to UTC.
 */
export function startAtFor(dateISO, hhmm, tz) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateISO || ''));
  const tm = HHMM.exec(String(hhmm || ''));
  if (!dm || !tm) return null;
  const zone = validTz(tz) ? tz : 'UTC';
  const wall = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  const t1 = wall - offsetAt(wall, zone);
  const t2 = wall - offsetAt(t1, zone);
  const p = parts(t2, zone);
  const same = p.h === Number(tm[1]) && p.mi === Number(tm[2]);
  return same ? t2 : Math.max(t1, t2);
}

/** When scoring opens: the first start time − 30 minutes, as an ISO UTC string (or null). */
export function opensAtFor(dateISO, hhmm, tz) {
  const t = startAtFor(dateISO, hhmm, tz);
  return t == null ? null : new Date(t - OPEN_BEFORE_MIN * 60000).toISOString();
}

/** 'YYYY-MM-DD' of an instant in a zone. */
export function wallDate(ms, tz) {
  const p = parts(ms, validTz(tz) ? tz : 'UTC');
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

const dayNum = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY : null;
};

/** "Sat Nov 9" for a 'YYYY-MM-DD' (no zone shift: the date is the date). */
export function shortDate(iso) {
  const n = dayNum(iso);
  if (n == null) return '';
  return new Date(n * DAY).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
}

/** "Saturday" when the date is today or within the next 6 days, else "Sat Nov 9". */
export function dayName(iso, nowMs, tz) {
  const n = dayNum(iso), today = dayNum(wallDate(nowMs, tz));
  if (n == null) return '';
  if (today != null && n >= today && n - today <= 6) return new Date(n * DAY).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
  return shortDate(iso);
}

/** Add minutes to "HH:MM" (wraps at midnight). */
export function addMinutes(hhmm, mins) {
  const m = HHMM.exec(String(hhmm || ''));
  if (!m) return hhmm;
  const t = (((Number(m[1]) * 60 + Number(m[2]) + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
const minutesOf = (hhmm) => { const m = HHMM.exec(String(hhmm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// ───────────────────────────────────────────── state

/** settings.lobby, cleaned up, or null (old rounds, other games). */
export function lobbyOf(settings) {
  const l = settings?.lobby;
  if (!l || typeof l !== 'object' || Array.isArray(l)) return null;
  const n = l.notice && typeof l.notice === 'object' && l.notice.text ? { text: String(l.notice.text), at: l.notice.at || null, until: l.notice.until || null } : null;
  return {
    stage: STAGES.includes(l.stage) ? l.stage : 'lobby',
    startTime: HHMM.test(String(l.startTime || '')) ? String(l.startTime) : '08:00',
    tz: validTz(l.tz) ? l.tz : 'UTC',
    opensAt: l.opensAt || null,
    openedEarly: l.openedEarly === true,
    notice: n,
    cohost: l.cohost || null,
    hostName: String(l.hostName || '').trim() || 'The organizer',
    prevStage: STAGES.includes(l.prevStage) && l.prevStage !== 'off' ? l.prevStage : null,
  };
}

const hasCarts = (roster) => (roster?.teams || []).length > 0 && (roster?.sides || []).length === 2;

/**
 * Where a lobby round stands at `nowMs`, or null when the round has no lobby. The stage is checked against the
 * roster so a screen can never be in a state the data doesn't support: teams/ready without carts → 'lobby';
 * ready without a valid opensAt → 'teams'.
 */
export function lobbyState(event, nowMs = Date.now()) {
  const l = lobbyOf(event?.settings);
  if (!l) return null;
  const roster = event.roster || {};
  let stage = l.stage;
  const carts = hasCarts(roster);
  const opensMs = Date.parse(l.opensAt || '');
  if ((stage === 'teams' || stage === 'ready') && !carts) stage = 'lobby';
  if (stage === 'ready' && !Number.isFinite(opensMs)) stage = 'teams';
  const open = stage === 'ready' && (l.openedEarly || nowMs >= opensMs);
  const date = event.played_on || null;
  const today = wallDate(nowMs, l.tz);
  const teeTimes = normalizeSettings(event.settings).teeTimes;
  const first = stage === 'ready' && teeTimes[0] ? teeTimes[0] : l.startTime;
  const notice = l.notice && (!l.notice.until || today <= l.notice.until) ? l.notice : null;
  const cohostP = l.cohost ? (roster.players || []).find((p) => p.id === l.cohost) : null;
  return {
    stage, open, date, today,
    opensAt: stage === 'ready' ? new Date(opensMs).toISOString() : null,
    msToOpen: stage === 'ready' && !open ? opensMs - nowMs : stage === 'ready' ? 0 : null,
    opensLabel: stage === 'ready' ? clock12(wallClock(opensMs, l.tz)) : '',
    startTime: first, startLabel: clock12(first), openedEarly: l.openedEarly,
    day: !!date && date === today, past: !!date && date < today,
    notice, tz: l.tz, hasTeams: carts, prevStage: l.prevStage,
    hostName: l.hostName, cohost: cohostP ? cohostP.id : null, cohostName: cohostP ? firstName(cohostP) : null,
  };
}

/** "HH:MM" of an instant in a zone. */
export function wallClock(ms, tz) {
  if (!Number.isFinite(ms)) return '';
  const p = parts(ms, validTz(tz) ? tz : 'UTC');
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

/** "Andrew" or "Andrew or Josh" — who players can text about the round. */
export const hostLine = (st) => (st?.cohostName && st.cohostName !== st.hostName ? `${st.hostName} or ${st.cohostName}` : st?.hostName || 'The organizer');

/**
 * The organizer's one primary, in order: open → the normal Host; a notice not told yet → Tell the group; off → (Bring it
 * back lives in Round options); lobby → Start the draft (needs 16); teams → Share the teams once (not on the day), then
 * Set start times; ready before it opens → wait (Open scoring now only on the day).
 */
export function nextHostStep(state, { teamsShared = false, told = null, count = RYDER_PLAYERS } = {}) {
  if (!state) return null;
  if (state.open) return 'open';
  if (state.notice?.at && state.notice.at !== told) return 'tell';
  if (state.stage === 'off') return 'off';
  if (state.stage === 'lobby') return count === RYDER_PLAYERS ? 'draft' : 'need16';
  if (state.stage === 'teams') return teamsShared || state.day ? 'setTimes' : 'shareTeams';
  return 'waitOpen';
}

/**
 * Host's headline numbers: who has Golf Board (claims with in_app) and who doesn't yet (picked a name in Safari, or
 * not yet). `status` = lobby_status rows [{ player_id, claimed, in_app }]; missing rows count as "not yet", so
 * inApp + notYet.length is always the roster size.
 */
export function lobbyCounts(roster, status) {
  const by = new Map((status || []).map((r) => [r.player_id, r]));
  const players = roster?.players || [];
  let inApp = 0;
  const notYet = [];
  for (const p of players) {
    const r = by.get(p.id);
    if (r?.claimed && r.in_app) inApp++;
    else notYet.push({ id: p.id, name: p.name, why: r?.claimed ? 'safari' : 'none' });
  }
  return { total: players.length, inApp, notYet };
}

const firstName = (p) => p?.firstName || String(p?.name || '').split(' ')[0];
const sortKey = (p) => `${firstName(p)} ${p.lastName || ''}`.toLowerCase();

/** Which one are you? (2): A–Z by name, filtered by the search box (first or last name), taken = on another phone. */
export function joinList(roster, claimed = [], q = '', me = null) {
  const has = (id) => (claimed instanceof Set ? claimed.has(id) : claimed.includes(id));
  const needle = String(q || '').trim().toLowerCase();
  return (roster?.players || [])
    .filter((p) => !needle || [p.name, p.firstName, p.lastName, p.nickname].some((x) => String(x || '').toLowerCase().split(/\s+/).some((w) => w.startsWith(needle)) || String(x || '').toLowerCase().startsWith(needle)))
    .map((p) => ({ id: p.id, name: p.name, taken: has(p.id) && p.id !== me }))
    .sort((a, b) => sortKey((roster.players || []).find((p) => p.id === a.id)).localeCompare(sortKey((roster.players || []).find((p) => p.id === b.id))));
}

/**
 * This player's lobby: side, cart, cart-mate, start time and the three matches (holes 1–6 / 7–12 / 13–18 in play
 * order) — straight from the roster, no scores needed. null before the draft or for someone not on the roster.
 */
export function myLobby(event, pid) {
  const roster = event?.roster || {};
  const players = roster.players || [];
  const p = players.find((x) => x.id === pid);
  if (!p?.teamId || !hasCarts(roster)) return null;
  const settings = normalizeSettings(event.settings);
  const side = roster.sides.find((s) => (s.teamIds || []).includes(p.teamId)) || null;
  const other = roster.sides.find((s) => s !== side) || null;
  const names = (tid) => players.filter((x) => x.teamId === tid).map(firstName).join(' + ');
  const mate = players.find((x) => x.teamId === p.teamId && x.id !== p.id) || null;
  const i = groupIndex(p.groupId);
  const t = settings.teeTimes[i] || '';
  const matches = [1, 7, 13].map((pos) => {
    const pairs = ryderMatchupsAt(roster, settings, holeAt(settings, pos));
    const pair = pairs.find((f) => f.includes(p.teamId));
    const vs = pair ? pair.find((x) => x !== p.teamId) : null;
    return { holes: holesLabel(settings, pos, pos + 5).replace(/^Holes /, ''), vs: vs ? names(vs) : '' };
  });
  const cartsOf = (s) => (s?.teamIds || []).map((tid) => ({ id: tid, names: names(tid), mine: tid === p.teamId }));
  return {
    side: side ? { id: side.id, name: side.name, carts: cartsOf(side) } : null,
    other: other ? { id: other.id, name: other.name, carts: cartsOf(other) } : null,
    teamId: p.teamId, cart: names(p.teamId), mate: mate ? firstName(mate) : null,
    tee: t ? clock12(t) : null, teeIndex: i, matches,
  };
}

/**
 * Which lobby view a phone shows instead of the tabs, or null = the normal round.
 * ctx: { me, watching, picking, seenWelcome, seenOpen, removed }.
 */
export function lobbyView(state, ctx = {}) {
  if (!state) return null;
  if (state.open) return ctx.me && !ctx.seenOpen ? 'gameday' : null;
  if (ctx.removed) return 'removed';
  if (state.stage === 'off') return 'off';
  if (!ctx.me) return ctx.picking ? 'who' : ctx.watching ? 'watch' : 'landing';
  if (!ctx.seenWelcome) return 'welcome';
  if (state.stage === 'ready') return 'ready';
  if (state.day) return 'dayWait';
  return state.stage === 'teams' ? 'drafted' : 'early';
}

/** Was this phone's spot given to someone else? (its last player slot now holds a different person) */
export function spotGiven(event, { pid, personId }) {
  if (!pid || !personId) return null;
  const players = event?.roster?.players || [];
  if (players.some((p) => p.personId === personId)) return null;
  const slot = players.find((p) => p.id === pid);
  return slot && slot.personId && slot.personId !== personId ? firstName(slot) : null;
}

/**
 * Home's "Coming up" card for a lobby round (null = not a lobby round, open, or its date has passed).
 * kind 'coming' (Open) · 'removed' (Andrew gave your spot to Kyle) · 'off' (Called off · was Sat Nov 9).
 */
export function homeCard(event, { pid = null, personId = null } = {}, nowMs = Date.now()) {
  const st = lobbyState(event, nowMs);
  if (!st || st.open || st.past) return null;
  const base = { date: st.date, when: shortDate(st.date), host: st.hostName, hostLine: hostLine(st) };
  const sub = spotGiven(event, { pid, personId });
  if (sub) return { ...base, kind: 'removed', line: `${st.hostName} gave your spot to ${sub}.` };
  if (st.stage === 'off') return { ...base, kind: 'off', line: `${st.hostName} called this off. Rain check?` };
  const players = event.roster?.players || [];
  const me = players.find((p) => (personId && p.personId === personId) || p.id === pid) || null;
  const mine = me ? myLobby(event, me.id) : null;
  let line;
  if (!me) line = `Team Ryder Cup · ${players.length} players`;
  else if (st.stage === 'lobby') line = `Teams after ${st.hostName}’s draft`;
  else if (st.stage === 'teams' || !mine?.tee) line = `You’re on ${mine?.side?.name || 'a team'} · start times not set yet`;
  else line = `${mine.side?.name || ''} · ${mine.tee}${mine.mate ? ` with ${mine.mate}` : ''}`;
  return { ...base, kind: 'coming', line };
}

// ───────────────────────────────────────────── writers (return new settings; never mutate)

const withLobby = (settings, patch) => ({ ...settings, lobby: { ...(settings?.lobby || {}), ...patch } });

/** The lobby a new "Invite now, draft later" round starts with. */
export function newLobby({ startTime, tz, hostName }) {
  return { stage: 'lobby', startTime, tz, opensAt: null, openedEarly: false, notice: null, cohost: null, hostName: hostName || '', prevStage: null };
}

/** Back to names only (Remove and redraft): no carts, no start times. */
export function toLobbyStage(settings) {
  return { ...withLobby(settings, { stage: 'lobby', opensAt: null, openedEarly: false }), teeTimes: [] };
}

/** The draft is saved. */
export const toTeamsStage = (settings) => withLobby(settings, { stage: 'teams', opensAt: null, openedEarly: false });

/**
 * Start times are saved: stage ready, opensAt = first start − 30 min on the round's date in its zone. Saved late on
 * the day itself (26: "opens the moment you save start times"), opensAt is now, never a few minutes from now.
 */
export function withStartTimes(settings, dateISO, teeTimes, nowMs = null) {
  const l = lobbyOf(settings) || {};
  const times = (teeTimes || []).map((t) => (HHMM.test(String(t || '')) ? String(t) : ''));
  const first = times[0] || l.startTime;
  let opensAt = opensAtFor(dateISO, first, l.tz);
  if (nowMs != null && opensAt && wallDate(nowMs, l.tz) === dateISO && Date.parse(opensAt) > nowMs) opensAt = new Date(nowMs).toISOString();
  return { ...withLobby(settings, { stage: 'ready', startTime: first, opensAt, openedEarly: false }), teeTimes: times };
}

/**
 * New date and/or start time. At 'ready' every start time moves by the same amount and opensAt is recomputed.
 * Returns { settings, moved: minutes the start moved }.
 */
export function withWhen(settings, dateISO, startTime) {
  const l = lobbyOf(settings);
  if (!l) return { settings, moved: 0 };
  const st = normalizeSettings(settings);
  const was = l.stage === 'ready' && st.teeTimes[0] ? st.teeTimes[0] : l.startTime;
  const moved = (minutesOf(startTime) ?? minutesOf(was)) - minutesOf(was);
  let next = withLobby(settings, { startTime: HHMM.test(startTime || '') ? startTime : l.startTime });
  if (l.stage === 'ready' || (l.stage === 'off' && l.prevStage === 'ready')) {
    const times = st.teeTimes.map((t) => (t ? addMinutes(t, moved) : ''));
    next = { ...next, teeTimes: times };
    next.lobby = { ...next.lobby, opensAt: opensAtFor(dateISO, times[0] || next.lobby.startTime, l.tz), openedEarly: false };
  }
  return { settings: next, moved };
}

export const withNotice = (settings, text, nowMs, until) => withLobby(settings, { notice: { text, at: new Date(nowMs).toISOString(), until: until || null } });
export const withCohost = (settings, pid) => withLobby(settings, { cohost: pid || null });

/** Open scoring now (25): on the day only (the caller checks state.day). */
export const openNow = (settings, nowMs) => withLobby(settings, { openedEarly: true, opensAt: new Date(nowMs).toISOString() });

export function callOff(settings) {
  const l = lobbyOf(settings);
  if (!l || l.stage === 'off') return settings;
  return withLobby(settings, { stage: 'off', prevStage: l.stage });
}
/** Bring it back: from Round options until 30 days after the date (a rain-out moves to a new date first). */
export function canBringBack(state) {
  if (!state || state.stage !== 'off') return false;
  const n = dayNum(state.date), today = dayNum(state.today);
  return n == null || today == null || today - n <= 30;
}
export function bringBack(settings) {
  const l = lobbyOf(settings);
  if (!l || l.stage !== 'off') return settings;
  return withLobby(settings, { stage: l.prevStage || 'lobby', prevStage: null });
}

// ───────────────────────────────────────────── words (players never see "lobby" or "tee time")

export const notices = {
  moved: (host, to, from) => `${host} moved the start to ${clock12(to)} (was ${clock12(from)}).`,
  redated: (host, to, from) => `${host} moved the round to ${shortDate(to)} (was ${shortDate(from)}).`,
  off: (host) => `${host} called this off.`,
  back: (host) => `${host} brought the round back.`,
};

/** "8:20 start time" (players' word for a tee time). */
export const startTimeName = (hhmm) => (clock12(hhmm) ? `${clock12(hhmm)} start time` : 'start time');

// ───────────────────────────────────────────── the draft keeps player ids

/**
 * The Team Ryder Cup roster from players in buildRyder's order (side 1 carts by start time, then side 2). A lobby
 * round's players keep their ids (claims point at them); a new round's players are p1…p16 in that order, as before.
 */
export function draftedRoster(players, sideNames = ['', '']) {
  return ryderSetup(players.map((p, i) => ({ ...p, id: p.id || `p${i + 1}` })), sideNames);
}

// ───────────────────────────────────────────── the offline queue

/**
 * Should a refused score stay queued? Only a not_open refusal for a round that is about to open (stage 'ready',
 * opens within 2 hours of the server's clock): the phone's clock ran a little ahead, so send it again when the round
 * opens. Every other refusal is final (dropped, as before), so the queue never fills up with not_open writes.
 */
export function keepQueued(res) {
  if (!res || res.ok || res.error !== 'not_open' || res.stage !== 'ready') return false;
  const at = parseTime(res.opens_at), now = parseTime(res.now);
  return Number.isFinite(at) && Number.isFinite(now) && at - now <= 2 * 3600000;
}

/** ms from a server timestamp: ISO with Z, Postgres's "+00:00", "+00", or a space instead of the T. */
export function parseTime(v) {
  if (v == null || v === '') return NaN;
  const s = String(v).trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00').replace(/\.(\d{3})\d+/, '.$1');
  return Date.parse(s);
}
