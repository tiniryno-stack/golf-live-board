// lobby.js — PURE. The Team Ryder Cup lobby (handoff 025): a round made with "Invite now, draft later" lives in
// settings.lobby until scoring opens. Every screen, Home, the router and the queue read lobbyState(); nothing
// else reads settings.lobby. Old rounds have no settings.lobby (or null): lobbyState() returns null and nothing
// in this file changes how they behave.
//
//   stage 'lobby'  names are set; no carts or sides yet
//         'carts'  carts are paired (temporary ids C1…C8, no sides): everyone sees who they ride with
//         'teams'  the draft is saved (roster.teams / sides filled)
//         'ready'  start times are saved and opensAt is set (first start − 30 min, on played_on, in tz)
//         'off'    called off (prevStage = what Bring it back restores)
//   open = stage 'ready' and (openedEarly or now ≥ opensAt). The server's gate (_lobby_gate) decides the same.

import { normalizeSettings, groupIndex, ryderMatchupsAt, holeAt, holesLabel, ryderSetup } from './scoring.js';

export const STAGES = ['lobby', 'carts', 'teams', 'ready', 'off'];
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
  // Only Team Ryder Cup has a lobby (the server's gate checks the same).
  if (!l || typeof l !== 'object' || Array.isArray(l) || String(settings.ryder) !== 'true') return null;
  const n = l.notice && typeof l.notice === 'object' && l.notice.text ? { text: String(l.notice.text), at: l.notice.at || null, until: l.notice.until || null } : null;
  return {
    stage: STAGES.includes(l.stage) ? l.stage : 'lobby',
    startTime: HHMM.test(String(l.startTime || '')) ? String(l.startTime) : '08:00',
    tz: validTz(l.tz) ? l.tz : 'UTC',
    opensAt: l.opensAt || null,
    openedEarly: l.openedEarly === true || l.openedEarly === 'true', // same as the server's _lobby_gate
    notice: n,
    cohost: l.cohost || null,
    hostName: String(l.hostName || '').trim() || 'The organizer',
    hostId: l.hostId ? String(l.hostId) : null,
    prevStage: STAGES.includes(l.prevStage) && l.prevStage !== 'off' ? l.prevStage : null,
  };
}

const hasCarts = (roster) => (roster?.teams || []).length > 0 && (roster?.sides || []).length === 2;
const TEMP_CART = /^C[1-8]$/;
/** Carts paired before the draft: exactly C1…C8 with two players each, every player in one, no sides yet. */
export const isPaired = (roster) => {
  const teams = roster?.teams || [], players = roster?.players || [];
  if (teams.length !== RYDER_PLAYERS / 2 || (roster?.sides || []).length || players.length !== RYDER_PLAYERS) return false;
  if (!teams.every((t) => TEMP_CART.test(String(t.id))) || new Set(teams.map((t) => t.id)).size !== teams.length) return false;
  return teams.every((t) => players.filter((p) => p.teamId === t.id).length === 2);
};

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
  // A stage the roster doesn't support falls back to the highest one it does, never above the saved stage.
  if ((stage === 'teams' || stage === 'ready') && !carts) stage = isPaired(roster) ? 'carts' : 'lobby';
  if (stage === 'carts' && !isPaired(roster)) stage = 'lobby';
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
    notice, tz: l.tz, hasTeams: carts, paired: stage === 'carts', prevStage: l.prevStage,
    hostName: l.hostName, hostId: l.hostId, cohost: cohostP ? cohostP.id : null, cohostName: cohostP ? firstName(cohostP) : null,
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
 * back lives in Round options); lobby → Pair the carts (needs 16); carts → Enter the draft; teams → Share the teams once
 * (not on the day), then Set start times; ready before it opens → wait (Open scoring now only on the day).
 */
export function nextHostStep(state, { teamsShared = false, told = null, count = RYDER_PLAYERS } = {}) {
  if (!state) return null;
  if (state.open) return 'open';
  if (state.notice?.at && state.notice.at !== told) return 'tell';
  if (state.stage === 'off') return 'off';
  if (state.stage === 'lobby') return count === RYDER_PLAYERS ? 'pair' : 'need16';
  if (state.stage === 'carts') return count === RYDER_PLAYERS ? 'draft' : 'need16';
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
 * ctx: { me, watching, picking, guide, invite, standalone, revealing, seenHcp, hasHcp, hcpFlow, seenOpen, removed }.
 *   not joined: who (picking, or the home screen app) · watch · guide (Add to Home Screen steps) · invite (the
 *   handicap invite, only when the round has handicaps) · landing.
 *   joined: reveal (once per phone, only with a handicap) · ready · dayWait · drafted · early (lobby and carts).
 */
export function lobbyView(state, ctx = {}) {
  if (!state) return null;
  if (state.open) return ctx.me && !ctx.seenOpen ? 'gameday' : null;
  if (ctx.removed) return 'removed';
  if (state.stage === 'off') return 'off';
  if (!ctx.me) {
    if (ctx.picking) return 'who';
    if (ctx.watching) return 'watch';
    if (ctx.standalone) return 'who';
    if (ctx.guide) return 'guide';
    return ctx.invite && ctx.hcpFlow ? 'invite' : 'landing';
  }
  if (ctx.guide && ctx.safariPhone) return 'guide'; // Add Golf Board to your home screen (the lobby row)
  if (ctx.revealing) return 'reveal';
  if (ctx.hasHcp && !ctx.seenHcp) {
    // The handicap opens in the app (SPEC §6): on iPhone Safari a joined player (024 auto-join included) gets the
    // Add to Home Screen steps first, unless they chose "Can't add it? Reveal it here".
    if (ctx.safariPhone && !ctx.revealHere) return 'guide';
    return 'reveal';
  }
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
  const cart = me && st.stage === 'carts' ? myCart(event, me.id) : null;
  if (!me) line = `Team Ryder Cup · ${players.length} players`;
  else if (cart?.mate) line = `Riding with ${cart.mate} · teams after ${st.hostName}’s draft`;
  else if (st.stage === 'lobby' || st.stage === 'carts') line = `Teams after ${st.hostName}’s draft`;
  else if (st.stage === 'teams' || !mine?.tee) line = `You’re on ${mine?.side?.name || 'a team'} · start times not set yet`;
  else line = `${mine.side?.name || ''} · ${mine.tee}${mine.mate ? ` with ${mine.mate}` : ''}`;
  return { ...base, kind: 'coming', line };
}

// ───────────────────────────────────────────── writers (return new settings; never mutate)

const withLobby = (settings, patch) => ({ ...settings, lobby: { ...(settings?.lobby || {}), ...patch } });

/** The lobby a new "Invite now, draft later" round starts with. */
export function newLobby({ startTime, tz, hostName, hostId = null }) {
  return { stage: 'lobby', startTime, tz, opensAt: null, openedEarly: false, notice: null, cohost: null, hostName: hostName || '', hostId: hostId || null, prevStage: null };
}

/** Carts are paired (stage 'carts'): no sides, no start times yet. */
export const toCartsStage = (settings) => ({ ...withLobby(settings, { stage: 'carts', opensAt: null, openedEarly: false }), teeTimes: [] });

/** Back to names only (Remove and redraft): no carts, no start times. A called-off round stays off (it comes back
 *  to names only). */
export function toLobbyStage(settings) {
  const off = lobbyOf(settings)?.stage === 'off';
  return { ...withLobby(settings, off ? { prevStage: 'lobby', opensAt: null, openedEarly: false } : { stage: 'lobby', opensAt: null, openedEarly: false }), teeTimes: [] };
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

/**
 * Set start times keeps the names everyone has already seen: side names by side id, and each cart's name by the
 * pair riding in it (ryderSetup would rename side 2 after whichever cart now tees off first).
 */
export function keepNames(roster, before) {
  if (!before) return roster;
  const pairKey = (r, tid) => (r.players || []).filter((p) => p.teamId === tid).map((p) => p.personId || p.id).sort().join('|');
  const oldCart = new Map((before.teams || []).map((t) => [pairKey(before, t.id), t.name]));
  return {
    ...roster,
    sides: (roster.sides || []).map((sd) => ({ ...sd, name: (before.sides || []).find((o) => o.id === sd.id)?.name || sd.name })),
    teams: (roster.teams || []).map((t) => ({ ...t, name: oldCart.get(pairKey(roster, t.id)) || t.name })),
  };
}

/**
 * May a lobby step (the draft or the start times) save onto the round as it is now? Only while it hasn't opened and
 * is still at that step's stages: a call-off or an opened round is never silently undone by a step opened earlier.
 */
export function maySaveStep(mode, state) {
  if (!state || state.open) return false;
  if (mode === 'tee') return state.stage === 'teams' || state.stage === 'ready';
  if (mode === 'carts') return state.stage === 'lobby' || state.stage === 'carts';
  return mode === 'draft' && (state.stage === 'carts' || state.stage === 'teams'); // teams = Redo the draft
}

/**
 * A lobby step (draft / start times) decides only who rides where: teams, sides, groups and each player's teamId /
 * groupId. Everything else about a player (name, handicap, nickname) comes from the round as it is now, so a co-host's
 * Handicap edit made while the step was open isn't undone. Players keep the step's order (ryderSetup reads it).
 */
export function mergeStep(built, fresh) {
  const now = new Map((fresh?.players || []).map((p) => [p.id, p]));
  return { ...built, players: (built.players || []).map((p) => (now.has(p.id) ? { ...now.get(p.id), teamId: p.teamId, groupId: p.groupId } : p)) };
}

/** Same players (ids and people) as when a step opened? Otherwise someone else changed the roster meanwhile. */
export const rosterKey = (roster) => (roster?.players || []).map((p) => `${p.id}:${p.personId || ''}:${p.teamId || ''}`).sort().join(',');

/** Every start time is set (one per group)? Stage 'ready' needs them all. */
export const allTimesSet = (times, groups) => groups > 0 && Array.from({ length: groups }, (_, i) => times?.[i]).every((t) => HHMM.test(String(t || '')));

/** A new player id that can't collide: the highest p-number + 1. */
export function nextPlayerId(roster) {
  const n = Math.max(0, ...(roster?.players || []).map((p) => Number(String(p.id).replace(/^p/, '')) || 0));
  return `p${n + 1}`;
}

/** Run it back copies settings: never the lobby (a new round starts fresh). */
export function withoutLobby(settings) {
  const { lobby, ...rest } = settings || {};
  return rest;
}

/** Season, crew and Setup's last groups count a lobby round only once it opened and has scores. */
export function countsAsPlayed(event, scores = null) {
  const l = lobbyOf(event?.settings);
  if (!l) return true;
  if (l.stage !== 'ready') return false;
  return scores == null ? true : scores.some((s) => s.strokes != null);
}

// ───────────────────────────────────────────── carts before the draft (stage 'carts')

/**
 * Pair the carts: `order` = the 16 player ids, two by two = C1…C8. Players keep their ids (claims point at them);
 * no sides or groups until the draft, which gives each cart its real id (1A…2D). null unless `order` is exactly the
 * roster's 16 players, each once.
 */
export function pairedRoster(roster, order) {
  const players = roster?.players || [];
  const ids = new Set(players.map((p) => p.id));
  if (players.length !== RYDER_PLAYERS || (order || []).length !== RYDER_PLAYERS || new Set(order).size !== RYDER_PLAYERS || !order.every((id) => ids.has(id))) return null;
  const at = new Map(order.map((id, i) => [id, i]));
  const byId = new Map(players.map((p) => [p.id, p]));
  const teams = Array.from({ length: RYDER_PLAYERS / 2 }, (_, k) => ({
    id: `C${k + 1}`, name: [order[2 * k], order[2 * k + 1]].map((id) => firstName(byId.get(id))).join(' + ').slice(0, 20),
  }));
  return {
    ...roster, groups: [], sides: [], teams,
    players: players.map((p) => ({ ...p, teamId: `C${Math.floor(at.get(p.id) / 2) + 1}`, groupId: null })),
  };
}

/**
 * The drafted carts as C1…C8 with the same pairs, in cartOrder (carts 1 and 2 = 1A and 2A). Redo the draft starts from
 * this order; the pure version is what the tests pin. Ids, people and handicaps are kept.
 */
export function undraft(roster) {
  return pairedRoster(roster, cartOrder(roster));
}

/** C-cart names always come from who's in them (a Replace changes a name; the cart follows). */
export function renameCarts(roster) {
  if (!isPaired(roster)) return roster;
  const byCart = (tid) => (roster.players || []).filter((p) => p.teamId === tid).map(firstName).join(' + ').slice(0, 20);
  return { ...roster, teams: roster.teams.map((t) => ({ ...t, name: byCart(t.id) })) };
}

/**
 * Player ids in cart order: C1's pair, C2's, …; real carts side by side (1A, 2A, 1B, 2B, …: carts 1 and 2 = one cart
 * from each side, what the draft starts from); else roster order.
 */
export function cartOrder(roster) {
  const players = roster?.players || [];
  let teams = roster?.teams || [];
  if (!teams.length) return players.map((p) => p.id);
  const real = /^[12][A-D]$/;
  if (teams.every((t) => real.test(String(t.id)))) teams = [...teams].sort((a, b) => a.id[1].localeCompare(b.id[1]) || a.id[0].localeCompare(b.id[0]));
  const out = teams.flatMap((t) => players.filter((p) => p.teamId === t.id).map((p) => p.id));
  for (const p of players) if (!out.includes(p.id)) out.push(p.id); // never lose anyone
  return out;
}

/** This player's cart at any stage with carts: { id, names: 'Baker + Mitch' (you first), mate }. */
export function myCart(event, pid) {
  const players = event?.roster?.players || [];
  const p = players.find((x) => x.id === pid);
  if (!p?.teamId || !(event.roster.teams || []).some((t) => t.id === p.teamId)) return null;
  const mate = players.find((x) => x.teamId === p.teamId && x.id !== p.id) || null;
  return { id: p.teamId, names: [firstName(p), mate ? firstName(mate) : ''].filter(Boolean).join(' + '), mate: mate ? firstName(mate) : null };
}

// ───────────────────────────────────────────── handicaps (roster `strokes`, set by the organizer)

// Handicaps are whole strokes ≥ 0 (Setup and Host clamp them; so does this).
const strokesOf = (p) => (p?.strokes === '' || p?.strokes == null || !Number.isFinite(Number(p.strokes)) ? null : Math.max(0, Math.round(Number(p.strokes))));

/**
 * The reveal's two inputs for lobbyView: hasHcp (this player has a handicap and isn't the organizer, who set them) and
 * seenHcp (the reveal was shown to THIS player on this phone: the seen key holds a player id, so after "I'm not
 * Baker" the right person still gets theirs).
 */
export function revealCtx(state, roster, { me = null, seenPid = null } = {}) {
  return { hasHcp: !!me && me !== state?.hostId && !!hcpOf(roster, me), seenHcp: !!me && seenPid === me };
}

/** Every player has a handicap? Only then does the invite say "Andrew set your handicap" (no promise left unkept). */
export const hasHandicaps = (roster) => (roster?.players || []).length > 0 && (roster.players || []).every((p) => strokesOf(p) != null);
/** How many players have one (Host: "14 of 16 have a handicap"). */
export const handicapCount = (roster) => (roster?.players || []).filter((p) => strokesOf(p) != null).length;

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(n) {
  const k = Math.abs(Math.round(n)), t = k % 100;
  return `${k}${t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][k % 10] || 'th'}`;
}

/**
 * A player's handicap among the field: rank = 1 + how many are strictly lower (ties share a rank), out of the players
 * with a handicap; min / max = the field's range. null when this player has none.
 */
export function hcpOf(roster, pid) {
  const players = roster?.players || [];
  const me = strokesOf(players.find((p) => p.id === pid));
  if (me == null) return null;
  const all = players.map(strokesOf).filter((v) => v != null);
  return { strokes: me, rank: 1 + all.filter((v) => v < me).length, tied: all.filter((v) => v === me).length > 1, of: all.length, min: Math.min(...all), max: Math.max(...all) };
}

/** "7th lowest of 16 · the field runs 4 to 20." (null with nobody else to compare with). */
export function rankLine(h) {
  if (!h || h.of < 2) return null;
  const place = h.rank === 1 ? `${h.tied ? 'Tied lowest' : 'Lowest'}` : `${h.tied ? 'Tied ' : ''}${ordinal(h.rank)} lowest`;
  return `${place} of ${h.of} · the field runs ${h.min} to ${h.max}.`;
}

export const REVEAL_MS = 1200, REVEAL_FADE = 200;
const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * One frame of the reveal (SPEC §6.4), from the ms since it started. 0–1200 ms: the number rolls through a few values
 * to the real one (the last 300 ms settled on it), blur 6 px → 0 and muted → full, eased out. Then the kicker, the rank
 * line, the note and the button fade in, 200 ms each. Reduced motion = the final frame at once.
 * → { value, blur, settled, done, fade: [kicker, rank, note, button] } (opacities 0…1).
 */
export function revealFrame(strokes, elapsed, reduced = false) {
  const real = Math.max(0, Math.round(Number(strokes) || 0));
  const e = reduced ? Infinity : Math.max(0, Number.isFinite(Number(elapsed)) ? Number(elapsed) : 0);
  const roll = [real + 6, real + 4, real + 2, real + 1].map((v) => Math.min(54, v));
  const settleAt = REVEAL_MS - 300;
  const p = Math.min(1, e / REVEAL_MS), k = easeOut(p);
  const value = e >= settleAt ? real : roll[Math.min(roll.length - 1, Math.floor((easeOut(e / settleAt) * roll.length)))];
  const fade = [0, 1, 2, 3].map((i) => Math.max(0, Math.min(1, (e - REVEAL_MS - i * REVEAL_FADE) / REVEAL_FADE)));
  return { value, blur: Math.round((1 - k) * 6 * 10) / 10, settled: e >= settleAt, done: e >= REVEAL_MS + 4 * REVEAL_FADE, fade };
}

/** Host's invite line (SPEC §6): the reveal wording when the round has handicaps, else Part 1's. */
export function inviteText(name, day, withHcp, who = '') {
  const lead = who ? `${who}, you’re on the list` : 'You’re on the list';
  return withHcp ? `${lead} for ${name} on ${day}. Tap this to reveal your handicap.` : `${lead} for ${name} on ${day}. Tap to join.`;
}

/** The guide's steps are Safari's: is this iPhone browser something else (an app's own web view such as Partiful's,
 *  which leaves "Safari/" out of its user agent, or Chrome / Firefox / Facebook / Instagram)? */
export const notSafari = (ua) => !/Safari\//.test(String(ua || '')) || /CriOS|FxiOS|FBAN|FBAV|Instagram/.test(String(ua || ''));

/** Who's playing, lowest handicap first (owner, Nov 6); no handicap last; ties A–Z. */
export function byHandicap(roster, list) {
  const h = (id) => hcpOf(roster, id)?.strokes;
  return [...list].sort((a, b) => {
    const x = h(a.id), y = h(b.id);
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    return x - y;
  });
}

/** The guide's "Can't add it?" escape shows only after this long on the steps (owner: the home screen is the way in). */
export const GUIDE_ESCAPE_MS = 3 * 60000;
export const guideEscape = (shownAt, nowMs) => Number.isFinite(shownAt) && nowMs - shownAt >= GUIDE_ESCAPE_MS;
