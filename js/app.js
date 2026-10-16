// app.js — routing (hash-based), state, rendering, and wiring the data layer to the screens.
//
// Render flow: Supabase ─realtime─► app state ─► scoring.compute() ─► snapshot ─► active screen render

import * as db from './db.js';
import { compute, nextHoleFor, sameFoursome, matchFor, HOLES } from './scoring.js';
import { replayHeadlines } from './headlines.js';
import { esc, icon, initials, roundLink, copyText } from './ui.js';
import * as fx from './screens/toasts.js';
import * as sheets from './screens/sheets.js';
import home from './screens/home.js';
import setup from './screens/setup.js';
import season from './screens/season.js';
import enter from './screens/enter.js';
import matches from './screens/matches.js';
import board from './screens/board.js';
import card from './screens/card.js';
import host from './screens/host.js';

const SCREENS = { home, setup, season, enter, matches, board, card, host };
const TABS = [
  ['enter', 'Enter', 'enter'],
  ['matches', 'Matches', 'matches'],
  ['board', 'Board', 'board'],
  ['card', 'Card', 'card'],
];
const JOIN_TTL = 5 * 60 * 1000;

const $ = (id) => document.getElementById(id);

// ───────────────────────────────────────────── state

export const app = {
  route: { name: 'home' },
  code: null,
  event: null,
  scores: new Map(), // `${pid}:${hole}` → server row
  joinRequests: new Map(), // id → row
  claimed: new Set(),
  me: null,
  adminPin: null,
  snapshot: null,
  headlines: [],
  live: 'off',
  unsynced: 0,
  loading: false,
  loadError: null,
  notFound: false,
  waiting: null, // { requestId, playerId, at, status }
  sheet: null, // { type, props }
  ui: {
    hole: null, boardView: 'teams', boardMode: 'net', matchesRot: null, cardHalf: null,
    hostTab: 'rules', expandedMatch: false, expanded: {},
  },
  setup: null,
  season: null,
  actions: {},
};

// ───────────────────────────────────────────── helpers screens use

app.go = (hash) => {
  if (location.hash === hash) route();
  else location.hash = hash;
};
app.tabHash = (tab) => `#/e/${app.code}/${tab}`;
app.myPlayer = () => (app.me && app.snapshot ? app.snapshot.playerById.get(app.me) || null : null);
app.myName = () => app.myPlayer()?.name || null;
app.myTeam = () => app.myPlayer()?.teamId || null;
app.isOrganizer = () => !!app.adminPin;
app.nextHole = () => (app.me && app.snapshot ? nextHoleFor(app.snapshot, app.me) : 1);

/** May this phone write this player's score on this hole? (mirrors the server) */
app.canEdit = (pid, hole) => {
  if (app.adminPin) return true;
  if (!app.me || !app.event) return false;
  return sameFoursome(app.event.roster, app.event.settings, app.me, pid, hole);
};

app.render = () => render();

app.toast = (opts) => fx.toast(opts, app);
app.showCard = (opts) => fx.showCard(opts, app);
app.coach = (key, target, text) => fx.coach(key, target, text);

app.openSheet = (type, props = {}) => {
  app.sheet = { type, props };
  renderSheet();
};
app.closeSheet = () => {
  app.sheet = null;
  renderSheet();
};

// ───────────────────────────────────────────── scores

function mergedRows() {
  const rows = new Map(app.scores);
  if (app.code) {
    for (const q of db.queue.items(app.code)) {
      const key = `${q.playerId}:${q.hole}`;
      const prev = rows.get(key);
      rows.set(key, {
        player_id: q.playerId, hole: q.hole, strokes: q.strokes,
        updated_by: q.admin ? 'Organizer' : app.myName() || prev?.updated_by || null,
        updated_at: prev && q.strokes === prev.strokes ? prev.updated_at : new Date(q.ts).toISOString(),
      });
    }
  }
  return [...rows.values()];
}

let headlineTimer = null;
function recompute({ headlines = 'soon' } = {}) {
  if (!app.event) {
    app.snapshot = null;
    return;
  }
  const rows = mergedRows();
  app.snapshot = compute(app.event, rows);
  if (headlines === 'now') {
    clearTimeout(headlineTimer);
    app.headlines = replayHeadlines(app.event, rows);
  } else if (headlines === 'soon') {
    clearTimeout(headlineTimer);
    headlineTimer = setTimeout(() => {
      if (!app.event) return;
      app.headlines = replayHeadlines(app.event, mergedRows());
      processHeadlines('live');
      if (app.route.tab === 'board') render();
    }, 300);
  }
}

/** Optimistic score write: screen updates now, server in the background. */
app.setScore = (pid, hole, strokes) => {
  if (!app.canEdit(pid, hole)) {
    app.toast({ title: 'Not your matchup', sub: 'You can enter your cart and the cart you’re playing.', error: true });
    return false;
  }
  const asAdmin = !!app.adminPin && !(app.me && sameFoursome(app.event.roster, app.event.settings, app.me, pid, hole));
  db.writeScore(app.code, { playerId: pid, hole, strokes: strokes ?? null, asAdmin });
  app.unsynced = db.queue.count(app.code);
  recompute();
  render();
  return true;
};

app.scoreOf = (pid, hole) => app.snapshot?.playerById.get(pid)?.gross[hole - 1] ?? null;

const REJECT_TEXT = {
  not_your_foursome: 'not in your matchup on that hole',
  not_claimed: 'this phone isn’t playing as anyone',
  bad_pin: 'the organizer PIN didn’t work',
  unknown_player: 'that player isn’t in the round anymore',
};

function onQueueReject(item, error) {
  const name = app.snapshot?.playerById.get(item.playerId)?.name || 'score';
  app.toast({ title: `Couldn’t save ${name} on ${item.hole}`, sub: REJECT_TEXT[error] || error, error: true });
  if (error === 'not_claimed') setMe(null);
  if (error === 'bad_pin') setAdmin(null);
  refetchAll();
}

function onQueueSaved(item, res) {
  if (res.unchanged) return;
  const key = `${item.playerId}:${item.hole}`;
  if (db.queue.has(app.code, item.playerId, item.hole)) return; // newer tap pending
  app.scores.set(key, {
    player_id: item.playerId, hole: item.hole, strokes: item.strokes,
    updated_by: res.updated_by || app.myName(), updated_at: res.updated_at || new Date().toISOString(),
  });
}

// ───────────────────────────────────────────── identity

function setMe(pid) {
  app.me = pid || null;
  db.me.set(app.code, app.me);
  render();
}
function setAdmin(pin) {
  app.adminPin = pin || null;
  db.admin.set(app.code, app.adminPin);
  render();
}
app.setAdmin = setAdmin;

async function refreshClaimed() {
  if (!app.code) return;
  try {
    const res = await db.api.claimedPlayers(app.code);
    if (res.ok) app.claimed = new Set(res.players);
    renderSheet();
  } catch { /* offline */ }
}
app.refreshClaimed = refreshClaimed;

async function verifyMe() {
  if (!app.code) return;
  try {
    const res = await db.api.whoami(app.code);
    if (!res.ok) return;
    const server = res.player_id || null;
    if (server !== app.me) {
      const had = app.me;
      setMe(server);
      if (had && !server) {
        app.toast({ title: 'You’re watching now', sub: 'Your name moved to another phone. Tap your name chip to pick again.' });
      }
    }
  } catch { /* offline: keep what we have */ }
}

app.claim = async (pid) => {
  let res;
  try {
    res = await db.api.claimPlayer(app.code, pid);
  } catch {
    app.toast({ title: 'No signal', sub: 'Try again in a moment.', error: true });
    return;
  }
  if (res.ok) {
    setMe(pid);
    app.claimed.add(pid);
    app.closeSheet();
    channel?.send({ kind: 'join', playerId: pid });
    app.toast({ title: `You’re in as ${app.myName()}` });
    if (app.route.tab !== 'enter') app.go(app.tabHash('enter'));
    else {
      app.ui.hole = null;
      render();
    }
    return;
  }
  if (res.error === 'taken') {
    app.claimed.add(pid);
    app.openSheet('taken', { pid });
  } else if (res.error === 'already_playing') {
    setMe(res.player_id);
    app.closeSheet();
    app.toast({ title: `This phone is already ${app.myName() || 'playing'}`, sub: 'Tap your name chip → Leave round first.' });
  } else {
    app.toast({ title: 'Couldn’t join', sub: res.error, error: true });
  }
};

app.requestJoin = async (pid) => {
  let res;
  try {
    res = await db.api.requestJoin(app.code, pid);
  } catch {
    app.toast({ title: 'No signal', sub: 'Try again in a moment.', error: true });
    return;
  }
  if (res.ok && res.claimed) {
    setMe(pid);
    app.closeSheet();
    channel?.send({ kind: 'join', playerId: pid });
    app.toast({ title: `You’re in as ${app.myName()}` });
    return;
  }
  if (res.ok) {
    app.waiting = { requestId: res.request_id, playerId: pid, at: Date.now(), status: 'pending' };
    app.openSheet('waiting', {});
    clearTimeout(app.waitTimer);
    app.waitTimer = setTimeout(() => {
      if (app.waiting?.requestId === res.request_id && app.waiting.status === 'pending') {
        app.waiting.status = 'expired';
        renderSheet();
      }
    }, JOIN_TTL);
    return;
  }
  app.toast({ title: 'Couldn’t ask', sub: res.error, error: true });
};

app.leave = async () => {
  try {
    const res = await db.api.leaveRound(app.code);
    if (!res.ok) throw new Error(res.error);
    const was = app.me;
    setMe(null);
    app.claimed.delete(was);
    channel?.send({ kind: 'leave', playerId: was });
    app.closeSheet();
    app.toast({ title: 'You left the round', sub: 'You’re watching. Pick your name any time.' });
  } catch {
    app.toast({ title: 'No signal', sub: 'Couldn’t leave yet. Try again.', error: true });
  }
};

app.answerJoin = async (requestId, approve) => {
  const req = app.joinRequests.get(requestId);
  let res;
  try {
    res = approve
      ? await db.api.approveJoin(app.code, requestId, app.adminPin)
      : await db.api.denyJoin(app.code, requestId, app.adminPin);
  } catch {
    app.toast({ title: 'No signal', sub: 'Try again in a moment.', error: true });
    return;
  }
  app.joinRequests.delete(requestId);
  if (res.ok) {
    const name = app.snapshot?.playerById.get(req?.player_id)?.name || 'them';
    app.toast({ title: approve ? `Let ${name} in` : 'Turned them away' });
    if (approve && req?.player_id === app.me) setMe(null);
    refreshClaimed();
  } else {
    app.toast({ title: 'Already handled', sub: res.error.replace(/_/g, ' ') });
  }
  fx.renderBanners(app);
};

/** Pending "let them in" asks this phone may answer. */
app.relevantRequests = () => {
  if (!app.snapshot) return [];
  const now = Date.now();
  return [...app.joinRequests.values()].filter((r) => {
    if (r.status !== 'pending' || now - Date.parse(r.created_at) > JOIN_TTL) return false;
    if (app.waiting?.requestId === r.id) return false;
    if (app.adminPin) return true;
    if (!app.me) return false;
    const p = app.snapshot.playerById.get(r.player_id);
    if (!p) return false;
    const last = Math.max(1, p.lastHole);
    const next = Math.min(HOLES, p.lastHole + 1);
    return (
      sameFoursome(app.event.roster, app.event.settings, app.me, r.player_id, last) ||
      sameFoursome(app.event.roster, app.event.settings, app.me, r.player_id, next)
    );
  });
};

// ───────────────────────────────────────────── organizer

app.saveEvent = async ({ course, roster, settings, name }) => {
  app.savingEvent = Date.now();
  let res;
  try {
    res = await db.api.updateEvent(app.code, app.adminPin, {
      course: course ?? app.event.course, roster: roster ?? app.event.roster, settings: settings ?? app.event.settings, name,
    });
  } catch {
    app.toast({ title: 'No signal', sub: 'Settings not saved. Try again.', error: true });
    return false;
  }
  if (!res.ok) {
    app.toast({ title: 'Not saved', sub: res.error === 'bad_pin' ? 'Organizer PIN didn’t work.' : res.error, error: true });
    if (res.error === 'bad_pin') setAdmin(null);
    return false;
  }
  app.event = { ...app.event, course: course ?? app.event.course, roster: roster ?? app.event.roster, settings: settings ?? app.event.settings, name: name || app.event.name };
  recompute();
  render();
  app.toast({ title: 'Saved', sub: res.changes ? `${res.changes} change${res.changes === 1 ? '' : 's'} logged` : 'No changes' });
  return true;
};

app.release = async (pid) => {
  try {
    const res = await db.api.releasePlayer(app.code, app.adminPin, pid);
    if (!res.ok) throw new Error(res.error);
    app.claimed.delete(pid);
    channel?.send({ kind: 'release', playerId: pid });
    app.toast({ title: res.released ? 'Spot freed up' : 'That name wasn’t in use' });
    render();
  } catch (e) {
    app.toast({ title: 'Couldn’t free that spot', sub: e.message, error: true });
  }
};

app.verifyAdmin = async (pin) => {
  try {
    const res = await db.api.verifyAdmin(app.code, pin);
    if (res.ok) {
      setAdmin(pin);
      return true;
    }
    return false;
  } catch {
    app.toast({ title: 'No signal', sub: 'Try again in a moment.', error: true });
    return false;
  }
};

app.copyLink = async (suffix = '') => {
  const link = roundLink(app.code, suffix);
  if (navigator.share && !suffix) {
    try {
      await navigator.share({ title: app.event?.name || 'Golf Live Board', url: link });
      return;
    } catch { /* cancelled → copy instead */ }
  }
  const ok = await copyText(link);
  app.toast({ title: ok ? 'Link copied' : link });
};

// ───────────────────────────────────────────── loading + live sync

let channel = null;
let loadSeq = 0;

async function loadRound(code) {
  const seq = ++loadSeq;
  closeRound();
  app.code = code;
  app.loading = true;
  app.loadError = null;
  app.notFound = false;
  app.ui.hole = null;
  app.ui.matchesRot = null;
  app.ui.cardHalf = null;
  app.me = db.me.get(code);
  app.adminPin = db.admin.get(code);
  app.unsynced = db.queue.count(code);
  render();
  let res;
  try {
    res = await db.fetchRound(code);
  } catch (e) {
    if (seq !== loadSeq) return;
    app.loading = false;
    app.loadError = e.message || 'No connection';
    hideSplash();
    render();
    return;
  }
  if (seq !== loadSeq) return;
  app.loading = false;
  hideSplash();
  if (!res) {
    app.notFound = true;
    render();
    return;
  }
  app.event = res.event;
  app.scores = new Map(res.scores.map((r) => [`${r.player_id}:${r.hole}`, r]));
  app.joinRequests = new Map(res.joinRequests.map((r) => [r.id, r]));
  db.recent.remember(app.event);
  recompute({ headlines: 'now' });
  render();
  processHeadlines('away');
  fx.renderBanners(app);

  channel = db.subscribe(app.event.id, {
    onScore: onRemoteScore,
    onEvent: onRemoteEvent,
    onJoinRequest: onRemoteJoinRequest,
    onNote: onRemoteNote,
    onStatus: (s) => {
      app.live = s;
      renderSyncChip();
    },
    onResync: () => refetchAll(),
  });
  db.startQueue(code, {
    onSaved: onQueueSaved,
    onReject: onQueueReject,
    onChange: (n) => {
      app.unsynced = n;
      renderSyncChip();
    },
    adminPin: () => app.adminPin,
  });
  await Promise.all([verifyMe(), refreshClaimed()]);
  if (seq !== loadSeq) return;
  maybeAskWho();
}

function closeRound() {
  channel?.close();
  channel = null;
  db.stopQueue();
  clearTimeout(headlineTimer);
  app.event = null;
  app.snapshot = null;
  app.headlines = [];
  app.scores = new Map();
  app.joinRequests = new Map();
  app.claimed = new Set();
  app.waiting = null;
  app.code = null;
  app.live = 'off';
  fx.clearBanners();
}

let refetching = null;
async function refetchAll() {
  if (!app.event) return;
  if (refetching) return refetching;
  const id = app.event.id;
  refetching = (async () => {
    try {
      const [event, scores, joins] = await Promise.all([
        db.fetchEvent(app.code), db.fetchScores(id), db.fetchJoinRequests(id),
      ]);
      if (!app.event || app.event.id !== id) return;
      if (event) app.event = event;
      app.scores = new Map(scores.map((r) => [`${r.player_id}:${r.hole}`, r]));
      app.joinRequests = new Map(joins.map((r) => [r.id, r]));
      recompute({ headlines: 'now' });
      render();
      fx.renderBanners(app);
      verifyMe();
    } catch { /* still offline */ }
  })();
  try {
    await refetching;
  } finally {
    refetching = null;
  }
}
app.refetch = refetchAll;

function onRemoteScore(row) {
  const key = `${row.player_id}:${row.hole}`;
  const prev = app.scores.get(key);
  if (prev && prev.updated_at && row.updated_at && Date.parse(prev.updated_at) > Date.parse(row.updated_at)) return;
  app.scores.set(key, row);
  recompute();
  render();
  const mine = row.updated_by && (row.updated_by === app.myName() || (row.updated_by === 'Organizer' && app.adminPin));
  if (!mine && row.strokes != null) noteIncoming(row);
}

function onRemoteEvent(row) {
  const recentlySaved = app.savingEvent && Date.now() - app.savingEvent < 4000;
  app.event = { ...app.event, ...row };
  recompute({ headlines: 'now' });
  render();
  if (!recentlySaved && !app.adminPin) app.toast({ title: 'The organizer updated the round', sub: 'Scores and standings are recomputed.' });
}

function onRemoteJoinRequest(row) {
  if (row.status === 'pending') app.joinRequests.set(row.id, row);
  else app.joinRequests.delete(row.id);
  if (app.waiting && app.waiting.requestId === row.id && row.status !== 'pending') {
    app.waiting.status = row.status;
    if (row.status === 'approved') {
      setMe(app.waiting.playerId);
      app.waiting = null;
      app.closeSheet();
      app.toast({ title: `You’re in as ${app.myName()}`, sub: row.approved_by ? `${row.approved_by} let you in` : '' });
      app.go(app.tabHash('enter'));
    } else renderSheet();
  }
  if (row.status === 'approved' && row.player_id === app.me && !app.waiting) verifyMe();
  refreshClaimed();
  fx.renderBanners(app);
}

function onRemoteNote(note) {
  if (!note || !app.snapshot) return;
  refreshClaimed();
  if (note.kind === 'release' && note.playerId === app.me) {
    verifyMe();
    return;
  }
  const p = app.snapshot.playerById.get(note.playerId);
  if (!p || !app.me || note.playerId === app.me) return;
  const h = Math.min(HOLES, p.lastHole + 1);
  if (!sameFoursome(app.event.roster, app.event.settings, app.me, note.playerId, h)) return;
  if (note.kind === 'join') app.toast({ title: `${p.name} joined` });
  if (note.kind === 'leave') app.toast({ title: `${p.name}’s phone left the round` });
}

// Incoming-score toasts, batched per foursome + hole (~4s)
const batches = new Map();
function foursomeLabel(pid, hole) {
  const snap = app.snapshot;
  const p = snap.playerById.get(pid);
  if (snap.game && p?.teamId && (snap.settings.rotationMode || 'swap') === 'swap') {
    const m = matchFor(snap, p.teamId, hole);
    if (m) return m.teams.map((t) => snap.teamById.get(t)?.name || t).join(' v ');
  }
  const g = (app.event.roster.groups || []).find((x) => x.id === p?.groupId);
  return g?.name || 'Hole';
}
function noteIncoming(row) {
  const label = foursomeLabel(row.player_id, row.hole);
  const key = `${label}|${row.hole}`;
  const b = batches.get(key) || { hole: row.hole, label, pids: new Set(), first: Date.now(), timer: null };
  b.pids.add(row.player_id);
  clearTimeout(b.timer);
  const wait = Math.max(200, Math.min(1500, 4000 - (Date.now() - b.first)));
  b.timer = setTimeout(() => flushBatch(key), wait);
  batches.set(key, b);
}
function flushBatch(key) {
  const b = batches.get(key);
  batches.delete(key);
  const snap = app.snapshot;
  if (!b || !snap) return;
  const par = snap.holes[b.hole - 1].par;
  const parts = [];
  const highlights = [];
  for (const pid of b.pids) {
    const p = snap.playerById.get(pid);
    const g = p?.gross[b.hole - 1];
    if (g == null) continue;
    parts.push(`${p.name} ${g}`);
    if (g <= par - 2) highlights.push(`${p.name} ${g === 1 ? 'made an ace on' : 'eagled'} ${b.hole}`);
    else if (g === par - 1) highlights.push(`${p.name} birdied ${b.hole}`);
  }
  if (!parts.length) return;
  if (snap.game && snap.game.ncomp > 1) {
    const slot = snap.game.pointsByHole[b.hole - 1];
    if (slot) {
      for (const pid of b.pids) {
        const t = snap.playerById.get(pid)?.teamId;
        if (t && slot.points[t] >= snap.game.ncomp && !highlights.some((x) => x.includes(snap.teamById.get(t).name))) {
          highlights.push(`${snap.teamById.get(t).name} took both points on ${b.hole}`);
        }
      }
    }
  }
  const line = `Hole ${b.hole} — ${parts.join(', ')}`;
  app.toast({
    title: highlights.length ? highlights.join(' · ') : `${b.label} · Hole ${b.hole}`,
    sub: highlights.length ? `${b.label} · ${line}` : parts.join(', '),
    tab: highlights.length ? 'matches' : 'card',
  });
}

// Headlines: sticky banners while looking; "While you were away" on return.
function seenKey() {
  return `glb.seen.${app.code}`;
}
function processHeadlines(mode) {
  if (!app.code) return;
  const primary = app.headlines.filter((h) => h.primary);
  let seen = db.local.get(seenKey());
  if (!seen) {
    db.local.set(seenKey(), { last: Date.now(), ids: primary.map((h) => h.id) });
    return;
  }
  const ids = new Set(seen.ids);
  const fresh = primary.filter((h) => !ids.has(h.id));
  if (!fresh.length) return;
  const markSeen = () => {
    const s = db.local.get(seenKey(), { last: 0, ids: [] });
    const all = new Set([...s.ids, ...fresh.map((h) => h.id)]);
    db.local.set(seenKey(), { last: Date.now(), ids: [...all].slice(-400) });
  };
  if (mode === 'away') fx.showAway(fresh.slice().reverse().slice(0, 3), app, markSeen);
  else fx.showHeadline(fresh[fresh.length - 1], fresh.length - 1, app, markSeen);
}

function maybeAskWho() {
  if (!app.event || app.me || app.route.tab === 'host') return;
  const skipKey = `glb.who.${app.code}`;
  if (db.local.get(skipKey)) return;
  db.local.set(skipKey, true);
  app.openSheet('who', {});
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (app.code) {
      const s = db.local.get(seenKey());
      if (s) db.local.set(seenKey(), { ...s, last: Date.now() });
    }
    return;
  }
  onReturn();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) onReturn();
});
async function onReturn() {
  if (!app.event) return;
  db.flush();
  if (channel && !channel.isLive()) channel.reconnect();
  await refetchAll();
  processHeadlines('away');
}

// ───────────────────────────────────────────── routing

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'setup') return { name: 'setup', from: parts[1] ? db.normCode(parts[1]) : null };
  if (parts[0] === 'season') return { name: 'season', crew: parts[1] || null };
  if (parts[0] === 'e' && parts[1]) {
    const tab = ['enter', 'matches', 'board', 'card', 'host'].includes(parts[2]) ? parts[2] : 'enter';
    return { name: tab, code: db.normCode(parts[1]), tab, round: true };
  }
  return { name: 'home' };
}

function route() {
  const prev = app.route;
  app.route = parseHash();
  fx.closeOverlay();
  if (app.sheet && !app.sheet.props?.keep) app.closeSheet();
  if (app.route.round) {
    if (app.route.code !== app.code) {
      loadRound(app.route.code);
    } else {
      render();
      if (app.route.tab === 'enter') maybeAskWho();
    }
  } else {
    if (app.code) closeRound();
    hideSplash();
    const s = SCREENS[app.route.name];
    s.enter?.(app);
    render();
  }
  if (prev.name !== app.route.name) $('content').scrollTop = 0;
}

window.addEventListener('hashchange', route);

// ───────────────────────────────────────────── rendering

let pendingContent = false;

function render() {
  const r = app.route;
  const screen = SCREENS[r.name] || home;
  const appEl = $('app');
  const content = $('content');
  const inRound = !!r.round;
  const ready = !inRound || (!!app.snapshot && !app.loading);
  const hasHero = ready && !!screen.hero && inRound;
  appEl.classList.toggle('has-hero', hasHero);
  content.classList.toggle('noscroll', ready && !!screen.noscroll);

  $('topbar').innerHTML = renderTopbar(screen, inRound);
  $('tabbar').innerHTML = inRound && ready ? renderTabbar() : '';

  const active = document.activeElement;
  if (active && content.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
    pendingContent = true; // don't wipe what someone is typing
  } else {
    pendingContent = false;
    const top = content.scrollTop;
    content.innerHTML = ready ? screen.render(app) : renderRoundState();
    content.scrollTop = top;
    if (ready) screen.mount?.(content, app);
  }
  renderSyncChip();
  renderSheet();
  fx.renderBanners(app);
}

document.addEventListener('focusout', () => {
  if (pendingContent) setTimeout(() => {
    const a = document.activeElement;
    if (!(a && $('content').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render();
  }, 0);
});

function renderRoundState() {
  if (app.loading) return '';
  if (app.loadError) {
    return `<div class="plain"><h1 class="title">No signal</h1>
      <p class="soft">Couldn’t reach the scoreboard. Scores you enter are saved on this phone and sync when you’re back.</p>
      <button class="btn primary block big" data-act="retry-load">Try again</button></div>`;
  }
  if (app.notFound) {
    return `<div class="plain"><h1 class="title">No round ${esc(app.code)}</h1>
      <p class="soft">Check the code or the link you were sent.</p>
      <button class="btn primary block big" data-act="go" data-v="#/">Home</button></div>`;
  }
  return '';
}

function renderTopbar(screen, inRound) {
  const theme = document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun';
  const themeBtn = `<button class="icon-btn" data-act="theme" aria-label="Light or dark">${icon(theme)}</button>`;
  if (!inRound) {
    const back = app.route.name === 'home'
      ? '<div class="spacer"></div>'
      : `<button class="back" data-act="go" data-v="#/">${icon('back', 22)}<span>Home</span></button>`;
    return `${back}${themeBtn}`;
  }
  const name = app.event?.name || app.code || '';
  const p = app.myPlayer();
  const chip = app.event
    ? p
      ? `<button class="name-chip" data-act="name-chip" aria-label="You are ${esc(p.name)}"><span class="avatar">${esc(initials(p.name))}</span><span class="ellipsis">${esc(p.name)}</span></button>`
      : `<button class="name-chip watching" data-act="name-chip"><span class="avatar">${icon('user', 16)}</span><span>Watching</span></button>`
    : '';
  return `<button class="back" data-act="go" data-v="#/" aria-label="Home">${icon('back', 22)}<span class="ellipsis">${esc(name)}</span></button>${chip}${themeBtn}`;
}

function renderTabbar() {
  const tab = app.route.tab;
  const tabs = TABS.map(
    ([id, label, ic]) =>
      `<button class="tab" data-act="tab" data-v="${id}" ${tab === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`
  ).join('');
  const hostBtn = app.adminPin
    ? `<button class="host-btn" data-act="tab" data-v="host" aria-label="Host" ${tab === 'host' ? 'aria-current="page"' : ''}>${icon('host')}</button>`
    : '';
  return `<div class="tabs">${tabs}</div>${hostBtn}`;
}

function renderSyncChip() {
  const el = document.querySelector('[data-sync]');
  if (!el) return;
  const n = app.unsynced;
  el.className = `sync${n ? ' pending' : app.live === 'live' ? '' : ' off'}`;
  el.textContent = n ? `${n} unsynced` : app.live === 'live' ? 'Synced' : app.live === 'reconnecting' ? 'Reconnecting' : 'Synced';
}
app.renderSyncChip = renderSyncChip;

function renderSheet() {
  sheets.render($('sheet'), app);
}

let splashGone = false;
function hideSplash() {
  if (splashGone) return;
  splashGone = true;
  const s = $('splash');
  s.classList.add('gone');
  setTimeout(() => s.remove(), 300);
}

// ───────────────────────────────────────────── input: taps, long-press, typing

const actions = app.actions;
Object.assign(actions, {
  go: (el) => app.go(el.dataset.v),
  tab: (el) => app.go(app.tabHash(el.dataset.v)),
  theme: () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    db.local.set('glb.theme', next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#0B0C0E' : '#000000');
    render();
  },
  'name-chip': () => {
    if (app.me) app.openSheet('leave', {});
    else {
      refreshClaimed();
      app.openSheet('who', {});
    }
  },
  'retry-load': () => loadRound(app.route.code),
});
for (const s of [...Object.values(SCREENS), sheets, fx]) Object.assign(actions, s.actions || {});

let suppressClick = false;
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (suppressClick) {
    suppressClick = false;
    ev.preventDefault();
    return;
  }
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = actions[el.dataset.act];
  if (fn) {
    ev.preventDefault();
    fn(el, ev, app);
  }
});

// Long-press (clear a tile, see who entered a cell)
let hold = null;
document.addEventListener('pointerdown', (ev) => {
  const el = ev.target.closest('[data-hold]');
  if (!el) return;
  const x = ev.clientX, y = ev.clientY;
  hold = {
    el, x, y,
    timer: setTimeout(() => {
      const fn = actions[el.dataset.hold];
      if (fn) {
        suppressClick = true;
        setTimeout(() => (suppressClick = false), 700);
        fn(el, ev, app);
      }
      hold = null;
    }, 550),
  };
});
const cancelHold = () => {
  if (hold) clearTimeout(hold.timer);
  hold = null;
};
document.addEventListener('pointerup', cancelHold);
document.addEventListener('pointercancel', cancelHold);
document.addEventListener('pointermove', (ev) => {
  if (hold && Math.hypot(ev.clientX - hold.x, ev.clientY - hold.y) > 10) cancelHold();
});
document.addEventListener('contextmenu', (ev) => {
  if (ev.target.closest('[data-hold]')) ev.preventDefault();
});

// Typing in forms: screens keep drafts without re-rendering on every key.
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  if (!el) return;
  const fn = actions[el.dataset.input];
  if (fn) fn(el, ev, app);
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (!el) return;
  const fn = actions[el.dataset.change];
  if (fn) fn(el, ev, app);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  const el = ev.target.closest('[data-enter]');
  if (!el) return;
  const fn = actions[el.dataset.enter];
  if (fn) {
    ev.preventDefault();
    fn(el, ev, app);
  }
});

// Swipe left/right on Enter changes holes.
let swipe = null;
$('content').addEventListener('touchstart', (ev) => {
  if (app.route.tab !== 'enter' || ev.touches.length !== 1) return;
  swipe = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, t: Date.now() };
}, { passive: true });
$('content').addEventListener('touchend', (ev) => {
  if (!swipe || app.route.tab !== 'enter') return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  const quick = Date.now() - swipe.t < 600;
  swipe = null;
  if (quick && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    actions[dx < 0 ? 'hole-next' : 'hole-prev']?.(null, ev, app);
  }
}, { passive: true });

// ───────────────────────────────────────────── boot

window.__glb = app; // handy for debugging from the console
route();
setTimeout(hideSplash, 4000); // never strand anyone on the launch screen
