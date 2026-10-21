// db.js — everything that talks to Supabase: load a round, device ID + name
// claim, leave, let-them-in, RPC writes, realtime, the offline queue, and the
// organizer's audit log. No DOM here; app.js decides what to show.

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// ───────────────────────────────────────────── local storage (never throws)

// Test phones (sim.html): `?sim=3` gives this page its own storage space ("sim3.glb.…"), so
// 8 copies of the app in one browser act like 8 phones (own device ID, own name, own PIN).
export const SIM = (() => {
  try {
    const m = /[?&]sim=([1-9]|1[0-6])(&|$)/.exec(location.search);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
})();
const PREFIX = SIM ? `sim${SIM}.` : '';

export const local = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* private mode / full: in-memory only */ }
  },
  del(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch { /* ignore */ }
  },
  /** This phone's keys (without the test-phone prefix). */
  keys() {
    try {
      const all = Object.keys(localStorage);
      return PREFIX ? all.filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)) : all.filter((k) => !/^sim\d+\./.test(k));
    } catch {
      return [];
    }
  },
};

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Random per-phone ID, generated once and kept in localStorage. Never sent back to other phones. */
export const deviceId = (() => {
  let id = local.get('glb.device');
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    id = uuid();
    local.set('glb.device', id);
  }
  return id;
})();

export const normCode = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

// Per-round memory on this phone
export const me = {
  get: (code) => local.get(`glb.me.${code}`),
  set: (code, pid) => (pid ? local.set(`glb.me.${code}`, pid) : local.del(`glb.me.${code}`)),
};
export const admin = {
  get: (code) => local.get(`glb.admin.${code}`),
  set: (code, pin) => (pin ? local.set(`glb.admin.${code}`, pin) : local.del(`glb.admin.${code}`)),
};

/** Recent rounds opened on this phone (Home + "Run it back"). */
export const recent = {
  all: () => local.get('glb.recent', []),
  remove(code) {
    local.set('glb.recent', recent.all().filter((r) => r.code !== code));
  },
  remember(ev) {
    if (!ev?.code) return;
    const list = recent.all().filter((r) => r.code !== ev.code);
    list.unshift({
      code: ev.code, name: ev.name, played_on: ev.played_on || null, crew_id: ev.crew_id || null,
      course: ev.course?.shortName || ev.course?.name || '', at: Date.now(),
    });
    local.set('glb.recent', list.slice(0, 12));
  },
};

/** Forget everything this phone kept about a round (after it's deleted). */
export function forgetRound(code) {
  if (!code) return;
  recent.remove(code);
  try {
    const re = new RegExp(`^glb\\.[A-Za-z]+\\.${code}(\\.|$)`);
    for (const k of local.keys()) if (re.test(k)) local.del(k);
  } catch { /* storage unavailable */ }
}

// ───────────────────────────────────────────── client

let client = null;
export function sb() {
  if (!client) {
    if (!globalThis.supabase?.createClient) throw new Error('Supabase library did not load');
    client = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }
  return client;
}

/** Thrown when the request never got an answer (no signal, server down). */
export class NetworkError extends Error {
  constructor(message, code) {
    super(message || 'No connection');
    this.network = true;
    this.code = code || null; // e.g. PGRST202 = function not in the database yet
  }
}

async function rpc(name, args) {
  let res;
  try {
    res = await sb().rpc(name, args);
  } catch (e) {
    throw new NetworkError(e?.message);
  }
  if (res.error) throw new NetworkError(res.error.message, res.error.code);
  return res.data || { ok: false, error: 'empty_response' };
}

async function select(query) {
  let res;
  try {
    res = await query;
  } catch (e) {
    throw new NetworkError(e?.message);
  }
  if (res.error) throw new NetworkError(res.error.message);
  return res.data;
}

// ───────────────────────────────────────────── reads

const SCORE_COLS = 'player_id,hole,strokes,updated_by,updated_at';

export async function fetchEvent(code) {
  return select(sb().from('events').select('*').eq('code', normCode(code)).maybeSingle());
}

export async function fetchScores(eventId) {
  return (await select(sb().from('scores').select(SCORE_COLS).eq('event_id', eventId))) || [];
}

export async function fetchJoinRequests(eventId) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return (await select(
    sb().from('join_requests').select('*').eq('event_id', eventId).eq('status', 'pending').gte('created_at', since)
  )) || [];
}

/** Round + its scores + pending "let them in" asks. Null if the code doesn't exist. */
export async function fetchRound(code) {
  const event = await fetchEvent(code);
  if (!event) return null;
  const [scores, joinRequests] = await Promise.all([fetchScores(event.id), fetchJoinRequests(event.id)]);
  return { event, scores, joinRequests };
}

/** Every round in a crew, with scores — for Season standings and past names in Setup. */
export async function fetchCrewRounds(crewId) {
  if (!crewId) return [];
  const events = (await select(sb().from('events').select('*').eq('crew_id', crewId).order('played_on'))) || [];
  if (!events.length) return [];
  const ids = events.map((e) => e.id);
  const scores = (await select(sb().from('scores').select(`event_id,${SCORE_COLS}`).in('event_id', ids))) || [];
  return events.map((event) => ({ event, scores: scores.filter((s) => s.event_id === event.id) }));
}

// ───────────────────────────────────────────── write functions (all return { ok, error?, ... })

export const api = {
  createEvent: ({ name, course, roster, settings, playedOn, crewId }) =>
    rpc('create_event', {
      p_name: name, p_course: course, p_roster: roster, p_settings: settings,
      p_played_on: playedOn || null, p_crew_id: crewId || null,
    }),
  verifyAdmin: (code, pin) => rpc('verify_admin', { p_code: code, p_admin_pin: pin }),
  claimedPlayers: (code) => rpc('claimed_players', { p_code: code }),
  whoami: (code) => rpc('whoami', { p_code: code, p_device_id: deviceId }),
  claimPlayer: (code, playerId) => rpc('claim_player', { p_code: code, p_player_id: playerId, p_device_id: deviceId }),
  leaveRound: (code) => rpc('leave_round', { p_code: code, p_device_id: deviceId }),
  requestJoin: (code, playerId) => rpc('request_join', { p_code: code, p_player_id: playerId, p_device_id: deviceId }),
  approveJoin: (code, requestId, adminPin = null) =>
    rpc('approve_join', { p_code: code, p_approver_device_id: deviceId, p_request_id: requestId, p_admin_pin: adminPin }),
  denyJoin: (code, requestId, adminPin = null) =>
    rpc('deny_join', { p_code: code, p_approver_device_id: deviceId, p_request_id: requestId, p_admin_pin: adminPin }),
  updateEvent: (code, pin, { course, roster, settings, name }) =>
    rpc('update_event', { p_code: code, p_admin_pin: pin, p_course: course, p_roster: roster, p_settings: settings, p_name: name ?? null }),
  releasePlayer: (code, pin, playerId) => rpc('release_player', { p_code: code, p_admin_pin: pin, p_player_id: playerId }),
  auditLog: (code, pin) => rpc('get_audit_log', { p_code: code, p_admin_pin: pin }),
  resetRound: (code, pin) => rpc('reset_round', { p_code: code, p_admin_pin: pin }),
  finalizeRound: (code, pin, final = true) => rpc('finalize_round', { p_code: code, p_admin_pin: pin, p_final: final }),
  pickTeamName: (code, name) => rpc('pick_team_name', { p_code: code, p_device_id: deviceId, p_name: name }),
  deleteRound: (code, pin) => rpc('delete_round', { p_code: code, p_admin_pin: pin }),
  // Crews + people (Oct 21): who's in a crew, and whether a full name is free.
  crewPeople: (crewId) => rpc('crew_people', { p_crew_id: crewId }),
  personNameCheck: ({ first, last, nickname = null, crewId = null, personId = null }) =>
    rpc('person_name_check', { p_first: first, p_last: last, p_nickname: nickname, p_crew_id: crewId, p_person_id: personId }),
  upsertScore: (code, playerId, hole, strokes) =>
    rpc('upsert_score', { p_code: code, p_device_id: deviceId, p_player_id: playerId, p_hole: hole, p_strokes: strokes }),
  fillScore: (code, playerId, hole, strokes) =>
    rpc('fill_score', { p_code: code, p_device_id: deviceId, p_player_id: playerId, p_hole: hole, p_strokes: strokes }),
  adminUpsertScore: (code, pin, playerId, hole, strokes) =>
    rpc('admin_upsert_score', { p_code: code, p_admin_pin: pin, p_player_id: playerId, p_hole: hole, p_strokes: strokes }),
};

// ───────────────────────────────────────────── offline queue
// Score writes go into a localStorage queue keyed by (player, hole) — latest value
// wins — then flush in the background. Retry on `online`, on returning to the
// page, and every 15s. A write the server rejects is dropped, not retried.

const qKey = (code) => `glb.queue.${code}`;

export const queue = {
  items: (code) => local.get(qKey(code), []),
  count: (code) => queue.items(code).length,
  has: (code, playerId, hole) => queue.items(code).some((i) => i.playerId === playerId && i.hole === hole),
  value: (code, playerId, hole) => queue.items(code).find((i) => i.playerId === playerId && i.hole === hole),
  put(code, item) {
    const list = queue.items(code).filter((i) => !(i.playerId === item.playerId && i.hole === item.hole));
    list.push({ ...item, ts: Date.now() });
    local.set(qKey(code), list);
  },
  clear: (code) => local.del(qKey(code)),
  /** Remove only if nobody queued a newer value for the same cell meanwhile. */
  settle(code, item) {
    const list = queue.items(code).filter(
      (i) => !(i.playerId === item.playerId && i.hole === item.hole && i.strokes === item.strokes && i.admin === item.admin)
    );
    local.set(qKey(code), list);
  },
};

const sync = { code: null, timer: null, interval: null, flushing: false, again: false, handlers: {}, pin: () => null };

/**
 * Start the queue for a round.
 * handlers: { onSaved(item, res), onReject(item, error), onChange(count), adminPin: () => pin }
 */
export function startQueue(code, handlers) {
  stopQueue();
  sync.code = code;
  sync.handlers = handlers || {};
  sync.interval = setInterval(() => flush(), 15000);
  window.addEventListener('online', onOnline);
  flush();
}

export function stopQueue() {
  clearInterval(sync.interval);
  clearTimeout(sync.timer);
  window.removeEventListener('online', onOnline);
  sync.code = null;
}

function onOnline() {
  flush();
}

/** Optimistic write: queued immediately, sent shortly after the last tap. */
/** fill: only if the cell is still empty on the server (Next hole with a tile left at par). */
export function writeScore(code, { playerId, hole, strokes, asAdmin = false, fill = false }) {
  queue.put(code, { playerId, hole, strokes: strokes ?? null, admin: !!asAdmin, ...(fill ? { fill: true } : {}) });
  sync.handlers.onChange?.(queue.count(code));
  clearTimeout(sync.timer);
  sync.timer = setTimeout(() => flush(), 600);
}

export async function flush() {
  const code = sync.code;
  if (!code) return;
  if (sync.flushing) {
    sync.again = true;
    return;
  }
  sync.flushing = true;
  try {
    for (const item of queue.items(code)) {
      let res;
      try {
        if (item.admin) {
          const pin = sync.handlers.adminPin?.();
          res = pin ? await api.adminUpsertScore(code, pin, item.playerId, item.hole, item.strokes) : { ok: false, error: 'bad_pin' };
        } else if (item.fill) {
          res = await api.fillScore(code, item.playerId, item.hole, item.strokes);
        } else {
          res = await api.upsertScore(code, item.playerId, item.hole, item.strokes);
        }
      } catch (e) {
        break; // no signal — keep everything, try again later
      }
      queue.settle(code, item);
      if (res.ok) sync.handlers.onSaved?.(item, res);
      else sync.handlers.onReject?.(item, res.error);
    }
  } finally {
    sync.flushing = false;
    sync.handlers.onChange?.(queue.count(code));
    if (sync.again) {
      sync.again = false;
      setTimeout(() => flush(), 50);
    }
  }
}

// ───────────────────────────────────────────── realtime
// One channel per round: scores, events (setting changes), join_requests, plus
// a small broadcast for "joined" / "left" notes. On error: reconnect with
// backoff and refetch; if it keeps failing, poll every 20s instead.

/**
 * handlers: { onScore(row), onEvent(row), onJoinRequest(row), onNote(payload), onStatus(status), onResync() }
 * Returns { send(payload), reconnect(), close(), status() }
 */
export function subscribe(eventId, handlers) {
  const h = handlers || {};
  let channel = null;
  let gen = 0;
  let failures = 0;
  let pollTimer = null;
  let retryTimer = null;
  let closed = false;
  let state = 'connecting';

  const setState = (s) => {
    state = s;
    h.onStatus?.(s);
  };
  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => h.onResync?.(), 20000);
  };
  const stopPolling = () => {
    clearInterval(pollTimer);
    pollTimer = null;
  };

  function open() {
    if (closed) return;
    const my = ++gen;
    let ch;
    try {
      ch = sb().channel(`round:${eventId}`, { config: { broadcast: { self: false } } });
    } catch {
      failures++;
      startPolling();
      return;
    }
    channel = ch;
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `event_id=eq.${eventId}` }, (p) => {
      if (my === gen && p.new && p.new.player_id) h.onScore?.(p.new);
    })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, (p) => {
        if (my === gen && p.new) h.onEvent?.(p.new);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'join_requests', filter: `event_id=eq.${eventId}` }, (p) => {
        if (my === gen && p.new) h.onJoinRequest?.(p.new);
      })
      .on('broadcast', { event: 'note' }, (msg) => {
        if (my === gen) h.onNote?.(msg.payload);
      })
      .subscribe((status) => {
        if (my !== gen || closed) return;
        if (status === 'SUBSCRIBED') {
          const wasDown = failures > 0;
          failures = 0;
          stopPolling();
          setState('live');
          if (wasDown) h.onResync?.();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          failures++;
          setState('reconnecting');
          if (failures >= 3) startPolling();
          clearTimeout(retryTimer);
          retryTimer = setTimeout(reconnect, Math.min(30000, 1500 * failures));
        }
      });
  }

  function reconnect() {
    if (closed) return;
    const old = channel;
    channel = null;
    gen++;
    if (old) {
      try {
        sb().removeChannel(old);
      } catch { /* ignore */ }
    }
    h.onResync?.();
    open();
  }

  open();
  return {
    status: () => state,
    isLive: () => state === 'live',
    reconnect,
    async send(payload) {
      try {
        await channel?.send({ type: 'broadcast', event: 'note', payload });
      } catch { /* notes are best-effort */ }
    },
    close() {
      closed = true;
      gen++;
      stopPolling();
      clearTimeout(retryTimer);
      if (channel) {
        try {
          sb().removeChannel(channel);
        } catch { /* ignore */ }
      }
      channel = null;
    },
  };
}
