// hostlobby.js — handoff 025, the organizer's side of a Team Ryder Cup lobby. Host shows this instead of its tabs
// while the round isn't open: the counts and the not-yet rows (16 / 19 / 24 / 26), Players → Replace / Remove /
// Free up / Add, Co-host, Round (date and start time, call it off, bring it back), and one primary that is always
// the next step (lobby.nextHostStep). Start the draft and Set start times run Setup's own steps on this event
// (setup.js lobby edit mode), inside the round. Every write fetches the event first and changes only its own part.

import { esc, icon, copyText, roundLink } from '../ui.js';
import * as db from '../db.js';
import * as names from '../names.js';
import * as L from '../lobby.js';
import { startLobbyEdit, lobbyStepView } from './setup.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const hostKey = (app) => `glb.lobbyhost.${app.code}`;
const hostFlags = (app) => db.local.get(hostKey(app)) || {};
const setFlag = (app, patch) => db.local.set(hostKey(app), { ...hostFlags(app), ...patch });
const first = (p) => p?.firstName || String(p?.name || '').split(' ')[0];
const course = (ev) => ev.course?.shortName || ev.course?.name || '';

// ───────────────────────────────────────────── data

/** lobby_status (organizer only): who claimed and who's in the home screen app. Refreshed every 30 s at most. */
function status(app) {
  const s = app.hostLobby;
  if ((!s || s.code !== app.code || Date.now() - s.at > 30000) && !app.hostLobbyLoading) {
    app.hostLobbyLoading = true;
    app.hostLobby = { ...(s?.code === app.code ? s : { rows: null }), code: app.code, at: Date.now() };
    db.api.lobbyStatus(app.code, app.adminPin).then((r) => {
      if (r?.ok) { app.hostLobby = { code: app.code, at: Date.now(), rows: r.players }; app.render(); }
      else if (r?.error === 'bad_pin') app.setAdmin(null);
    }).catch(() => {}).finally(() => { app.hostLobbyLoading = false; });
  }
  return app.hostLobby?.code === app.code ? app.hostLobby.rows : null;
}

/**
 * Change the lobby round: fetch the event, let `fn` change its own part of a fresh copy, save it with update_event.
 * Two organizers saving at once never undo each other's unrelated changes.
 */
async function saveLobby(app, fn) {
  let fresh;
  try { fresh = await db.fetchEvent(app.code); } catch { fresh = null; }
  if (!fresh) { app.toast({ title: 'No signal', sub: 'Nothing changed. Try again.', error: true }); return false; }
  const next = fn({ roster: clone(fresh.roster), settings: clone(fresh.settings), event: fresh });
  if (!next) return false;
  app.event = { ...app.event, ...fresh };
  return app.saveEvent({ course: fresh.course, roster: next.roster || fresh.roster, settings: next.settings || fresh.settings, name: fresh.name });
}
export { saveLobby };

// ───────────────────────────────────────────── share messages

function share(app, kind, extra = {}) {
  const ev = app.event, st = app.lobby();
  const day = L.dayName(st.date, app.now(), st.tz);
  // 025 rev: joiners get the invite link (#/e/CODE/hcp → "Andrew set your handicap" when the round has handicaps).
  const hcp = L.hasHandicaps(ev.roster);
  const invite = ['invite', 'person', 'sub'].includes(kind);
  const link = roundLink(app.code, invite ? '/hcp' : '');
  const T = {
    invite: { title: 'Invite the group', kicker: `${ev.name} · created`, text: L.inviteText(ev.name, day, hcp), mark: null },
    teams: { title: 'Share the teams', kicker: `${ev.name} · teams are set`, text: `Teams are set for ${ev.name}. Open Golf Board to see yours.`, mark: 'teamsShared' },
    tell: { title: 'Tell the group', kicker: ev.name, text: st.notice ? `${st.notice.text} ${ev.name}.` : `${ev.name}: an update.`, mark: 'told' },
    person: { title: `Send ${extra.name} the link`, kicker: ev.name, text: L.inviteText(ev.name, day, hcp, extra.name), mark: null },
    sub: { title: `Send ${extra.name} the link`, kicker: `${ev.name} · ${extra.name} added`, text: hcp ? `${extra.name}, you’re in for ${ev.name} on ${day}. Tap this to reveal your handicap.` : `${extra.name}, you’re in for ${ev.name} on ${day}. Tap to join.`, mark: null, undo: extra.undo },
    cohost: { title: `Send ${extra.name} the PIN`, kicker: `${ev.name} · co-host`, text: `You’re co-host for ${ev.name}. Host PIN: ${app.adminPin} (Golf Board → ⋯ → Host settings).`, mark: null },
  }[kind];
  // Andrew sees when the invite falls back to the plain wording (somebody's handicap is blank).
  const missing = (ev.roster?.players || []).length - L.handicapCount(ev.roster);
  const noHcp = invite && !hcp && missing > 0 && missing < (ev.roster?.players || []).length
    ? `${missing} ${missing === 1 ? 'player has' : 'players have'} no handicap, so this invite won’t show the reveal. Set them in Players.` : '';
  app.openSheet('lobby-share', { ...T, link, kind, noHcp, at: st.notice?.at || null });
}

// ───────────────────────────────────────────── the view

const row = (title, detail, act, v = '') => `<button class="row lb-row" data-act="${act}"${v ? ` data-v="${esc(v)}"` : ''}><span class="body"><b class="lb-rt">${title}</b></span><span class="detail lb-d">${detail}</span><span class="hr-chev">${icon('fwd', 20)}</span></button>`;
const check = (title, sub, done) => `<div class="row lb-row"><span class="body"><b class="lb-rt">${title}</b><span class="detail">${sub}</span></span>${done ? `<span class="lb-check" aria-label="done">${icon('check', 18)}</span>` : ''}</div>`;

function checklist(app, st, c) {
  const sides = app.event.roster?.sides || [];
  const times = (app.snapshot?.settings?.teeTimes || []).filter(Boolean).map(L.clock12).join(' · ');
  return `<div class="card lb-card lb-rows">
    ${check('Invite', c ? (c.inApp === c.total ? 'Everyone’s in' : `${c.inApp} of ${c.total} have Golf Board`) : '…', c && c.inApp === c.total)}
    ${check('Carts', st.hasTeams || st.paired ? '8 carts of 2' : 'Next', st.hasTeams || st.paired)}
    ${check('Draft', st.hasTeams ? sides.map((s) => s.name).join(' vs ') : 'Next', st.hasTeams)}
    ${check('Start times', st.stage === 'ready' ? times : st.hasTeams ? 'Next' : 'After the draft', st.stage === 'ready')}
  </div>`;
}

/**
 * Everyone's handicap (owner, Nov 6): set before the invite goes out. Right after Who rides together? (fromSetup:
 * required, all 16), and from Host → Handicaps any time before scoring opens. Typed values live in app.ui.hcpStep.vals
 * until Save (the render loop never wipes a field being typed in).
 */
function hcpStepView(app) {
  const step = app.ui.hcpStep;
  const roster = app.event.roster;
  const ps = L.joinList(roster, [], '');
  const val = (p) => (p.id in step.vals ? step.vals[p.id] : (p.strokes == null || p.strokes === '' ? '' : String(p.strokes)));
  const left = ps.filter((p) => !/^\d{1,2}$/.test(val(p))).length;
  return `<div class="plain nr-setup lb">
    ${step.fromSetup ? '' : '<button class="link-btn lb-back" data-act="lh-hstep-cancel">Back to Host</button>'}
    <div class="nr-head"><div class="nr-k"><span class="lbl">${step.fromSetup ? 'New round · ' : ''}${esc(app.event.name)} · handicaps</span></div>
      <h1 class="nr-title">Everyone’s handicap</h1>
      <div class="nr-sub">Strokes over 18 holes. Each player sees theirs when they join, so set them before you send the invite.</div></div>
    <div class="card lb-card lb-rows">${ps.map((p) => `<label class="row lb-row" for="hs-${esc(p.id)}"><span class="body"><b class="lb-rt">${esc(p.name)}</b></span>
      <input class="input num" id="hs-${esc(p.id)}" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" value="${esc(val(p))}" aria-label="${esc(p.name)} handicap" data-input="lh-hstep-in" data-v="${esc(p.id)}"></label>`).join('')}</div>
    <div class="nr-foot">${step.fromSetup ? '<p class="meta lb-note">Not sure of one? Put your best guess: you can fix it in Host → Handicaps before the day.</p>' : ''}<p class="meta lb-note" id="hs-left">${left ? `${left} still to set` : 'All set'}</p>
      <button class="btn primary nr-cta" data-act="lh-hstep-save" id="hs-save"${step.fromSetup && left ? ' disabled' : ''}>${step.fromSetup ? 'Open the lobby' : 'Save handicaps'}</button></div>
  </div>`;
}

/**
 * Order and carts (owner, Nov 7): after the draft, until the first score. Tap two names to swap players (any two, even
 * across teams); tap two carts of the same team to swap their places; ↑ ↓ moves a whole group. Each start time stays
 * with its place in the order. Edits stay on a copy (app.ui.orderStep) until Save.
 */
export function orderStepView(app) {
  const o = app.ui.orderStep;
  const roster = o.roster;
  const groups = L.startGroups(roster);
  const sideName = (sd) => (roster.sides || []).find((x) => x.id === sd)?.name || `Team ${sd}`;
  const ord = ['1st', '2nd', '3rd', '4th'];
  const sel = (kind, id) => (o.sel?.kind === kind && o.sel.id === id ? ' sel' : '');
  const cart = (c) => `<div class="lb-oc"><button class="lbl lb-oc-k${sel('c', c.id)}" data-act="lh-o-cart" data-v="${esc(c.id)}" aria-pressed="${!!sel('c', c.id)}">${esc(sideName(c.side))}</button>
    ${c.players.map((p) => `<button class="swap-name${sel('p', p.id)}" data-act="lh-o-p" data-v="${esc(p.id)}" aria-pressed="${!!sel('p', p.id)}"><span class="ellipsis">${esc(first(p))}</span></button>`).join('')}</div>`;
  const hint = o.sel?.kind === 'p' ? 'Now tap who to swap with.' : o.sel?.kind === 'c' ? 'Now tap the other cart on that team.' : 'Tap two names to swap players. Tap two team labels to swap carts.';
  return `<div class="plain nr-setup lb">
    <button class="link-btn lb-back" data-act="lh-o-cancel">Back to Host</button>
    <div class="nr-head"><div class="nr-k"><span class="lbl">${esc(app.event.name)} · start order</span></div>
      <h1 class="nr-title">Order and carts</h1>
      <div class="nr-sub">${o.open ? 'Scoring is open, but nobody has entered a score yet. Change it now: after the first score it’s locked.' : 'Change it any time until the first score. Phones show the new groups when they update.'}</div></div>
    <p class="meta lb-note">${hint}</p>
    ${groups.map((g, i) => `<div class="card lb-card lb-og">
      <div class="lb-og-h"><span class="lbl">${ord[i] || `${i + 1}th`}</span>
        <input class="ry-time mono${o.times[i] ? ' set' : ''}" type="time" value="${esc(o.times[i] || '')}" aria-label="${ord[i]} start time" data-input="lh-o-time" data-i="${i}">
        <span class="lb-og-mv"><button class="btn small" data-act="lh-o-mv" data-v="${i}" data-d="-1" aria-label="Move the ${ord[i]} group earlier"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="btn small" data-act="lh-o-mv" data-v="${i}" data-d="1" aria-label="Move the ${ord[i]} group later"${i === groups.length - 1 ? ' disabled' : ''}>↓</button></span></div>
      <div class="lb-og-carts">${g.carts.map(cart).join('<span class="meta lb-og-v">v</span>')}</div></div>`).join('')}
    <div class="nr-foot"><p class="meta lb-note">Your first match is the other cart in your group, so moving carts changes who plays whom.</p>
      <button class="btn primary nr-cta" data-act="lh-o-save"${o.saving ? ' aria-busy="true"' : ''}>${o.saving ? 'Saving…' : 'Save the order'}</button></div>
  </div>`;
}

/** Scores entered on this round yet? (the order locks at the first one) */
const anyScores = (app) => [...(app.scores?.values?.() || [])].some((x) => x?.strokes != null);

/** Host after scoring opens, before the first score: one row into Order and carts (27). */
export function orderRow(app) {
  const st = app.lobby();
  if (!st || !st.open || !L.mayReorder(st, anyScores(app))) return '';
  return `<div class="card lb-card lb-rows" style="margin:0 0 14px">${row('Order and carts', 'until the first score', 'lh-order')}</div>`;
}

export function hostLobbyView(app) {
  if (app.ui.orderStep?.code === app.code) return orderStepView(app);
  if (app.setup?.lobby?.code === app.code) return lobbyStepView(app); // Start the draft / Set start times
  if (app.ui.hcpStep?.code === app.code) return hcpStepView(app);
  const ev = app.event, st = app.lobby();
  const rows = status(app);
  const c = rows ? L.lobbyCounts(ev.roster, rows) : null;
  const n = (ev.roster?.players || []).length;
  const flags = hostFlags(app);
  const step = L.nextHostStep(st, { teamsShared: !!flags.teamsShared, told: flags.told || null, count: n });
  const day = L.dayName(st.date, app.now(), st.tz);
  const where = `${day} ${st.startLabel} · ${course(ev)} · Team Ryder Cup`;
  const inApp = c ? `${c.inApp} of ${c.total} have Golf Board` : `${n} players`;
  let title, sub, body = '', footNote = '', primary = '', secondary = '';
  if (step === 'tell') {
    title = st.stage === 'off' ? 'Called off' : 'Tell the group';
    sub = `${esc(st.notice.text)} Phones show it next time they open Golf Board, with a note until ${esc(day)}.`;
    footNote = `Ready to send: “${esc(st.notice.text)}”`;
    primary = '<button class="btn primary nr-cta" data-act="lh-tell">Tell the group</button>';
  } else if (step === 'off') {
    title = 'Called off';
    sub = 'Every phone shows it’s off and scores can’t be entered. Bring it back from Round.';
  } else if (step === 'pair' || step === 'draft' || step === 'need16') {
    title = esc(inApp);
    sub = esc(where);
    if (step === 'need16') footNote = `Team Ryder Cup needs 16 players. You have ${n}: add one in Players.`;
    else if (step === 'draft') footNote = 'Drafting in person? Tap each pick in after, then set start times.';
    primary = step === 'draft'
      ? '<button class="btn primary nr-cta" data-act="lh-draft">Enter the draft</button>'
      : `<button class="btn primary nr-cta" data-act="lh-carts"${step === 'need16' ? ' disabled' : ''}>Pair the carts</button>`;
  } else if (step === 'shareTeams' || (step === 'setTimes' && !st.day)) {
    title = 'Teams are set';
    sub = `${esc((ev.roster.sides || []).map((s) => s.name).join(' vs '))} · ${esc(inApp)}`;
    body = checklist(app, st, c);
    if (step === 'shareTeams') {
      footNote = 'Phones show the teams when they open Golf Board. Tell the group now.';
      primary = '<button class="btn primary nr-cta" data-act="lh-share-teams">Share the teams</button>';
      secondary = '<button class="btn block lb-second" data-act="lh-times">Set start times</button>';
    } else primary = '<button class="btn primary nr-cta" data-act="lh-times">Set start times</button>';
  } else if (step === 'setTimes') {
    title = 'Scoring is waiting on start times';
    sub = `Teams are set. ${esc(inApp)}. Scoring opens the moment you save start times.`;
    primary = '<button class="btn primary nr-cta" data-act="lh-times">Set start times</button>';
  } else {
    title = `Scoring opens at ${esc(st.opensLabel)}`;
    sub = `By itself, 30 minutes before the ${esc(st.startLabel)} start time.`;
    body = checklist(app, st, c);
    if (st.day) secondary = '<button class="btn block nr-cta" data-act="lh-open-now">Open scoring now</button>';
    else footNote = 'Open scoring now shows up here on the day.';
  }
  const notYet = c && st.stage !== 'off' ? c.notYet : [];
  const asks = app.relevantRequests();
  const cohost = st.cohostName || 'none';
  return `<div class="plain nr-setup lb">
    <div class="nr-head"><div class="nr-k"><span class="lbl">${esc(ev.name)} · host</span></div><h1 class="nr-title">${title}</h1><div class="nr-sub">${sub}</div></div>
    ${body}
    ${asks.length ? `<div class="lbl lb-k">Waiting to be let in</div><div class="card lb-card lb-rows">${asks.map((q) => `<div class="row lb-row"><span class="body"><b class="lb-rt">${esc(app.snapshot.playerById.get(q.player_id)?.name || q.player_id)}</b></span>
        <button class="btn small" data-act="join-deny" data-v="${esc(q.id)}">Not them</button><button class="btn small primary" data-act="join-approve" data-v="${esc(q.id)}">Let in</button></div>`).join('')}</div>` : ''}
    ${notYet.length && step !== 'tell' ? `<div class="lbl lb-k">Not in the app yet · ${notYet.length} ${notYet.length === 1 ? 'person' : 'people'}</div>
      <div class="card lb-card lb-rows">${notYet.map((p) => `<div class="row lb-row"><span class="body"><b class="lb-rt">${esc(p.name)}</b><span class="detail">${p.why === 'safari' ? 'picked a name in Safari' : 'not yet'}</span></span>
        <button class="btn small" data-act="lh-share-person" data-v="${esc(p.id)}">Share</button></div>`).join('')}</div>` : ''}
    <div class="card lb-card lb-rows">
      ${st.stage === 'lobby' || st.stage === 'carts' ? row('Carts', st.paired ? '8 paired' : 'not paired yet', 'lh-carts') : ''}
      ${st.stage === 'teams' ? row('Teams', 'redo the draft', 'lh-draft') : ''}
      ${L.mayReorder(st) ? row('Order and carts', 'swap players, move groups', 'lh-order') : ''}
      ${row('Players', st.stage === 'off' ? `${n} players` : 'replace a player', 'lh-players')}
      ${st.stage === 'off' ? '' : row('Handicaps', L.handicapCount(ev.roster) < n ? `${L.handicapCount(ev.roster)} of ${n} set · invite needs all ${n}` : `all ${n} set`, 'lh-hstep')}
      ${row('Co-host', esc(cohost), 'lh-cohost')}
      ${row('Round', st.stage === 'off' ? 'bring it back, date' : 'date, course, call it off', 'lh-options')}
    </div>
    <p class="meta lb-note">Organizer PIN <b class="mono">${esc(app.adminPin)}</b>. Screenshot it: it opens Host on any phone if this one is lost.</p>
    <div class="nr-foot">${footNote ? `<p class="meta lb-note">${footNote}</p>` : ''}${primary}${secondary}
      <button class="btn ghost block lb-quiet" data-act="lh-mylobby">See what players see</button></div>
  </div>`;
}

/** After a round opens: one line on top of the normal Host (27). */
export function openedLine(app) {
  const st = app.lobby();
  if (!st || !st.open) return '';
  return `<div class="card lb-card lb-rows" style="margin:0 0 14px">${check('Scoring is open', st.openedEarly ? 'Opened early by the organizer' : `Opened by itself at ${esc(st.opensLabel)} · first start ${esc(st.startLabel)}`, true)}</div>`;
}

// ───────────────────────────────────────────── sheets

const head = (title, sub = '') => `<div class="panel-head"><div class="ph-text"><h2 class="title">${esc(title)}</h2>${sub ? `<div class="ph-sub">${esc(sub)}</div>` : ''}</div>
  <button class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('close')}</button></div>`;

function statusOf(app, pid) {
  const r = (app.hostLobby?.rows || []).find((x) => x.player_id === pid);
  if (!r) return app.claimed.has(pid) ? 'joined' : 'not yet';
  return r.claimed ? (r.in_app ? 'has Golf Board' : 'picked a name in Safari') : 'not yet';
}

export const lobbySheets = {
  'lobby-share'(app, p) {
    return `<div class="ts-label lb-sk">${esc(p.kicker || '')}</div>${head(p.title)}
      <p class="soft lb-sp">Ready to send: “${esc(p.text)}”</p>
      ${p.noHcp ? `<p class="meta lb-note">${esc(p.noHcp)}</p>` : ''}
      <div class="stack"><button class="btn primary big block" data-act="lh-send">${icon('share', 18)} ${esc(p.kind === 'sub' || p.kind === 'person' ? `Share with ${p.title.replace(/^Send (.+) the (link|PIN)$/, '$1')}` : 'Share')}</button>
      ${p.undo ? '<button class="btn block" data-act="lh-undo">Undo</button>' : '<button class="btn ghost block" data-act="lh-copy">Copy link</button>'}</div>`;
  },
  'lobby-players'(app) {
    const st = app.lobby();
    const ps = L.joinList(app.event.roster, [], '');
    return `${head('Players', `${ps.length} on the list`)}
      <div class="card lb-card lb-rows">${ps.map((p) => row(esc(p.name), esc(statusOf(app, p.id)), 'lh-player', p.id)).join('')}</div>
      ${ps.length < L.RYDER_PLAYERS && st.stage !== 'off' ? '<button class="btn block" data-act="lh-add" style="margin-top:12px">Add a player</button>' : ''}`;
  },
  'lobby-player'(app, { pid }) {
    const p = (app.event.roster?.players || []).find((x) => x.id === pid);
    if (!p) return head('Players');
    const claimed = app.claimed.has(pid);
    return `${head(p.name, statusOf(app, pid))}
      <div class="stack">
        <button class="btn primary big block" data-act="lh-replace" data-v="${esc(pid)}">Replace ${esc(first(p))}</button>
        <button class="btn block" data-act="lh-hcp" data-v="${esc(pid)}">Handicap · ${p.strokes == null || p.strokes === '' ? 'not set' : esc(p.strokes)}</button>
        ${claimed ? `<button class="btn block" data-act="lh-free" data-v="${esc(pid)}">Free up ${esc(first(p))}’s name</button>` : ''}
        <button class="btn danger block" data-act="lh-remove" data-v="${esc(pid)}">Remove ${esc(first(p))}</button>
      </div>
      <p class="meta lb-note">Free up = the phone using this name lets go (a wrong pick, or his new phone can’t get in). Replace = a sub takes the spot.</p>`;
  },
  'lobby-replace'(app, { pid = null, q = '', nick = false }) {
    const st = app.lobby();
    const p = pid ? (app.event.roster?.players || []).find((x) => x.id === pid) : null;
    const fn = first(p);
    const blurb = !p ? 'They join the list. Send them the link next.' : st.hasTeams
      ? `The sub takes ${esc(fn)}’s spot, with his team and cart. ${esc(fn)}’s phone is told.`
      : st.paired ? `The sub takes ${esc(fn)}’s spot, with his cart. ${esc(fn)}’s phone is told.`
      : `The sub takes ${esc(fn)}’s spot. ${esc(fn)}’s phone is told.`;
    const picks = crewPicks(app, q);
    const typed = names.splitName(q);
    return `${head(p ? `Replace ${fn}` : 'Add a player')}
      <p class="soft lb-sp">${blurb}</p>
      <div class="field"><label for="lr-name">${p ? 'Sub’s first and last name' : 'First and last name'}</label>
        <input class="input" id="lr-name" maxlength="40" autocapitalize="words" autocomplete="off" value="${esc(q)}" data-input="lh-rq" data-enter="lh-rgo"></div>
      ${nick ? `<div class="field"><label for="lr-nick">Nickname (someone else is called ${esc(q)})</label><input class="input" id="lr-nick" maxlength="24" placeholder="e.g. Tini Ryno" autocomplete="off" data-enter="lh-rgo"></div>` : ''}
      <div class="field"><label for="lr-hcp">Handicap (blank = not set)</label><input class="input mono" id="lr-hcp" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" data-enter="lh-rgo">
        ${L.hasHandicaps(app.event.roster) ? '<p class="meta nr-hint">Leave it blank and the invite stops showing the reveal.</p>' : ''}</div>
      <div id="lr-picks">${picks}</div>
      <div class="stack" style="margin-top:14px"><button class="btn primary big block" data-act="lh-rgo">${typed.first ? `${p ? 'Replace' : 'Add'} with ${esc(typed.first)}` : p ? 'Replace' : 'Add'}</button>
      <button class="btn ghost block" data-act="sheet-close">Cancel</button></div>`;
  },
  'lobby-hcp'(app, { pid }) {
    const p = (app.event.roster?.players || []).find((x) => x.id === pid);
    if (!p) return head('Handicap');
    const v = p.strokes == null || p.strokes === '' ? '' : Number(p.strokes);
    return `${head(`${first(p)}’s handicap`, 'Strokes over 18 holes. Players see their own in the lobby.')}
      <div class="field"><label for="lh-hcp-n">Handicap (blank = not set)</label>
        <input class="input mono" id="lh-hcp-n" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(v)}" autocomplete="off" data-enter="lh-hcp-save" data-v="${esc(pid)}"></div>
      <div class="stack"><button class="btn primary big block" data-act="lh-hcp-save" data-v="${esc(pid)}">Save</button>
      <button class="btn ghost block" data-act="sheet-close">Cancel</button></div>`;
  },
  'lobby-cohost'(app) {
    const st = app.lobby();
    const ps = L.joinList(app.event.roster, [], '');
    return `${head('Co-host', 'Shares the organizer PIN: draft, start times, players')}
      <div class="card lb-card lb-rows">${ps.map((p) => `<button class="row lb-row" data-act="lh-cohost-pick" data-v="${esc(p.id)}"><span class="body"><b class="lb-rt${st.cohost === p.id ? ' you' : ''}">${esc(p.name)}</b></span>${st.cohost === p.id ? '<span class="detail">co-host</span>' : ''}</button>`).join('')}</div>
      ${st.cohost ? '<button class="btn ghost block" data-act="lh-cohost-pick" data-v="" style="margin-top:12px">No co-host</button>' : ''}`;
  },
  'lobby-options'(app) {
    const st = app.lobby();
    const back = st.stage === 'off' && L.canBringBack(st);
    return `${head('Round')}
      <div class="card lb-card lb-rows">
        ${row('Date and start time', `${esc(L.shortDate(st.date).split(' ')[0])} ${esc(st.startLabel)}`, 'lh-when')}
        <div class="row lb-row"><span class="body"><b class="lb-rt">Course</b><span class="detail">Set when the round was made</span></span><span class="detail lb-d">${esc(course(app.event))}</span></div>
        ${row('Co-host', esc(st.cohostName || 'none'), 'lh-cohost')}
      </div>
      ${st.stage === 'off'
        ? back ? `<button class="btn primary big block" data-act="${st.past ? 'lh-when' : 'lh-back'}" data-v="back" style="margin-top:14px">Bring it back</button>` : ''
        : '<button class="btn danger block" data-act="lh-calloff" style="margin-top:14px">Call it off</button>'}`;
  },
  'lobby-when'(app, { back = false } = {}) {
    const st = app.lobby();
    return `${head(back ? 'Bring it back' : 'Date and start time', back ? 'Pick the new date' : 'Phones show a note until the round')}
      <div class="field"><label for="lw-date">Date</label><input class="input" id="lw-date" type="date" value="${esc(st.date || '')}"></div>
      <div class="field"><label for="lw-time">${st.stage === 'ready' ? 'First start time (every start time moves with it)' : 'First start time'}</label><input class="input" id="lw-time" type="time" value="${esc(st.startTime)}"></div>
      <div class="stack"><button class="btn primary big block" data-act="lh-when-save" data-v="${back ? 'back' : ''}">${back ? 'Bring it back' : 'Save'}</button>
      <button class="btn ghost block" data-act="sheet-close">Cancel</button></div>`;
  },
  'lobby-all'(app) {
    const ps = L.byHandicap(app.event.roster, L.joinList(app.event.roster, app.claimed, '', app.me));
    const c = app.lobbyCounts?.code === app.code ? app.lobbyCounts : null;
    const st = app.lobby();
    const roster = app.event.roster;
    const hcp = (pid) => L.hcpOf(roster, pid)?.strokes;
    const tag = (pid) => (pid === app.me ? 'you' : st?.hostId === pid ? 'organizer' : '');
    return `${head('Who’s playing', c?.total != null ? `${c.claimed} of ${c.total} joined · ${c.in_app} have Golf Board` : `${ps.length} players`)}
      <div class="card lb-card lb-rows">${ps.map((p) => `<div class="row lb-row"><span class="body"><b class="lb-rt${p.id === app.me ? ' you' : ''}">${esc(p.name)}</b>${tag(p.id) ? `<span class="detail">${tag(p.id)}</span>` : ''}</span>${hcp(p.id) != null ? `<span class="detail lb-d mono">${esc(hcp(p.id))}</span>` : ''}</div>`).join('')}</div>`;
  },
  'lobby-how'() {
    return `${head('How Team Ryder Cup works')}
      <div class="rl-list">
        <div class="rl-row"><div class="ts-label rl-k">Teams</div><div class="rl-v">Two sides of 8, 4 carts each</div><div class="rl-d">The organizer drafts them before the round.</div></div>
        <div class="rl-row"><div class="ts-label rl-k">Matches</div><div class="rl-v">Cart vs cart, a new cart every 6 holes</div><div class="rl-d">Each hole: low ball 1 point, low total 1 point. Most points after 6 holes wins the match.</div></div>
        <div class="rl-row"><div class="ts-label rl-k">Winner</div><div class="rl-v">1 point a match · 6½ wins the cup</div><div class="rl-d">12 matches, ½ each when halved. 6–6 shares the cup.</div></div>
      </div>`;
  },
};

/** Crew suggestions for Replace / Add ("Kyle Test · played Oct 16"), people not already on the roster. */
function crewPicks(app, q) {
  const cp = app.crewPeople;
  if (!cp || cp.crew !== app.event.crew_id) {
    if (app.event.crew_id && !app.crewPeopleLoading) {
      app.crewPeopleLoading = true;
      db.api.crewPeople(app.event.crew_id).then((r) => {
        app.crewPeople = { crew: app.event.crew_id, list: r?.ok ? r.people : [] };
        const box = document.getElementById('lr-picks');
        if (box) box.innerHTML = crewPicks(app, document.getElementById('lr-name')?.value || '');
      }).catch(() => {}).finally(() => { app.crewPeopleLoading = false; });
    }
    return '';
  }
  const on = new Set((app.event.roster?.players || []).map((p) => p.personId));
  const ql = String(q || '').trim().toLowerCase();
  const list = cp.list.filter((p) => !on.has(p.id) && (!ql || `${p.firstName} ${p.lastName || ''}`.toLowerCase().includes(ql))).slice(0, 4);
  if (!list.length) return '';
  return `<div class="card lb-card lb-rows">${list.map((p) => `<button class="row lb-row" data-act="lh-rpick" data-v="${esc(p.id)}"><span class="body"><b class="lb-rt">${esc([p.firstName, p.lastName].filter(Boolean).join(' '))}</b></span>${p.lastPlayed ? `<span class="detail">played ${esc(L.shortDate(p.lastPlayed).replace(/^\w+ /, ''))}</span>` : ''}</button>`).join('')}</div>`;
}

/** The roster's display names after a change (first names; "Andrew D." on a clash). */
function relabel(roster) {
  const shown = names.displayNames(roster.players);
  roster.players.forEach((p, i) => { p.name = shown[i]; });
  return L.renameCarts(roster); // C-cart names follow who's in them
}

/** Replace (or Add): the slot keeps its id, team, cart and start time; the name and the person change. */
async function doReplace(app, pid, person) {
  const old = pid ? clone((app.event.roster.players || []).find((x) => x.id === pid) || null) : null;
  if (pid && !old) return;
  let newId = pid;
  const ok = await saveLobby(app, ({ roster }) => {
    const slot = pid ? roster.players.find((x) => x.id === pid) : null;
    if (pid && !slot) return null;
    // The sub's own handicap (or none): never the old player's number, or his reveal would show it (025 rev).
    const fields = { personId: person.personId, firstName: person.first, lastName: person.last, strokes: person.strokes ?? null, ...(person.nickname ? { nickname: person.nickname } : {}) };
    if (slot) { delete slot.nickname; Object.assign(slot, fields, { name: names.fullName({ firstName: person.first, lastName: person.last }) }); }
    else {
      if (roster.players.length >= L.RYDER_PLAYERS) return null;
      newId = L.nextPlayerId(roster);
      roster.players.push({ id: newId, ...fields, name: person.first, teamId: null, groupId: null });
    }
    return { roster: relabel(roster) };
  });
  if (!ok) return;
  // The roster first, then free the old phone: once the slot is Kyle's, the old phone can't auto-join it back
  // (its owner isn't on the roster any more). Scoring isn't open, so the moment in between can't write scores.
  if (pid) await releaseSlot(app, pid);
  share(app, pid ? 'sub' : 'person', { name: person.first, undo: pid ? { pid, prev: old } : null });
}

/** The handicap typed in the Replace / Add sheet (blank = not set). */
function typedHcp() {
  const raw = (document.getElementById('lr-hcp')?.value || '').trim();
  return /^\d{1,2}$/.test(raw) ? Math.min(54, Number(raw)) : null;
}

/** release_player, tried twice; says so if it still didn't work (Free up in Players fixes it). */
async function releaseSlot(app, pid) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await db.api.releasePlayer(app.code, app.adminPin, pid);
      if (r?.ok) { app.claimed.delete(pid); return true; }
    } catch { /* retry once */ }
  }
  app.toast({ title: 'The old phone still holds that spot', sub: 'Host → Players → Free up, when you have signal.', error: true });
  return false;
}

async function undoReplace(app, { pid, prev }) {
  const ok = await saveLobby(app, ({ roster }) => {
    const i = roster.players.findIndex((x) => x.id === pid);
    if (i < 0) return null;
    // Only who the slot is: its cart and start time stay what they are now (a redraft may have happened since).
    const { personId, firstName, lastName, nickname, name, strokes } = prev;
    roster.players[i] = { ...roster.players[i], personId, firstName, lastName, name, strokes: strokes ?? null };
    if (nickname) roster.players[i].nickname = nickname; else delete roster.players[i].nickname;
    return { roster: relabel(roster) };
  });
  if (ok) await releaseSlot(app, pid); // the sub's phone lets go after the slot is his again
  app.closeSheet();
  if (ok) app.toast({ title: `${first(prev)} is back on the list`, sub: 'His phone joins him again next time it opens.' });
}

async function removePlayer(app, pid) {
  const p = (app.event.roster.players || []).find((x) => x.id === pid);
  try { await db.api.releasePlayer(app.code, app.adminPin, pid); } catch { /* keep going: the roster change is what matters */ }
  app.claimed.delete(pid);
  const ok = await saveLobby(app, ({ roster, settings }) => {
    if (!roster.players.some((x) => x.id === pid)) return null;
    roster.players = roster.players.filter((x) => x.id !== pid);
    // Decided on the fresh roster (a co-host may have drafted meanwhile): once there are carts, removing someone
    // clears the teams and the draft starts over (no carts, sides or start times). A called-off round stays off.
    // Carts paired (stage 'carts') or drafted: removing someone clears them and the round goes back to names only.
    if (!(roster.teams || []).length) return { roster: relabel(roster) };
    roster.players.forEach((x) => { x.teamId = null; x.groupId = null; });
    Object.assign(roster, { teams: [], sides: [], groups: [] });
    return { roster: relabel(roster), settings: L.toLobbyStage(settings) };
  });
  app.closeSheet();
  if (ok) app.toast({ title: `${first(p)} is off the list`, sub: 'Team Ryder Cup needs 16: add someone in Players, then pair the carts again.' });
}

export const lobbyActions = {
  'lh-invite': (el, ev, app) => share(app, 'invite'),
  'lh-draft': (el, ev, app) => startLobbyEdit(app, 'draft'),
  'lh-carts': (el, ev, app) => startLobbyEdit(app, 'carts'),
  'lh-times': (el, ev, app) => startLobbyEdit(app, 'tee'),
  'lh-share-teams': (el, ev, app) => share(app, 'teams'),
  'lh-tell': (el, ev, app) => share(app, 'tell'),
  'lh-share-person': (el, ev, app) => {
    const p = (app.event.roster.players || []).find((x) => x.id === el.dataset.v);
    if (p) share(app, 'person', { name: first(p) });
  },
  'lh-mylobby': (el, ev, app) => app.go(app.tabHash('enter')),
  'lh-send': async (el, ev, app) => {
    const p = app.sheet?.props || {};
    let sent = false;
    if (navigator.share) {
      try { await navigator.share({ text: p.text, url: p.link }); sent = true; } catch { /* cancelled */ }
    }
    if (!sent) {
      const ok = await copyText(`${p.text} ${p.link}`);
      app.toast({ title: ok ? 'Message copied' : p.link, sub: ok ? 'Paste it in the group text.' : '' });
      sent = ok;
    }
    if (sent && p.kind === 'teams') setFlag(app, { teamsShared: true });
    if (sent && p.kind === 'tell') setFlag(app, { told: p.at });
    if (!p.undo) app.closeSheet();
    app.render();
  },
  'lh-copy': async (el, ev, app) => {
    const p = app.sheet?.props || {};
    const ok = await copyText(`${p.text} ${p.link}`);
    if (ok && p.kind === 'teams') setFlag(app, { teamsShared: true });
    if (ok && p.kind === 'tell') setFlag(app, { told: p.at });
    app.toast({ title: ok ? 'Message copied' : p.link });
    app.closeSheet();
    app.render();
  },
  'lh-undo': (el, ev, app) => undoReplace(app, app.sheet?.props?.undo || {}),
  'lh-players': (el, ev, app) => { app.hostLobby = null; app.refreshClaimed(); app.openSheet('lobby-players', {}); },
  'lh-player': (el, ev, app) => app.openSheet('lobby-player', { pid: el.dataset.v }),
  'lh-add': (el, ev, app) => app.openSheet('lobby-replace', { pid: null, q: '' }),
  'lh-replace': (el, ev, app) => app.openSheet('lobby-replace', { pid: el.dataset.v, q: '' }),
  'lh-rq': (el, ev, app) => {
    app.sheet.props.q = el.value;
    app.sheet.props.nick = false;
    const box = document.getElementById('lr-picks');
    if (box) box.innerHTML = crewPicks(app, el.value);
    const btn = document.querySelector('[data-act="lh-rgo"]');
    const f = names.splitName(el.value).first;
    if (btn) btn.textContent = f ? `${app.sheet.props.pid ? 'Replace' : 'Add'} with ${f}` : app.sheet.props.pid ? 'Replace' : 'Add';
  },
  'lh-rpick': (el, ev, app) => {
    const c = (app.crewPeople?.list || []).find((x) => x.id === el.dataset.v);
    if (!c) return;
    doReplace(app, app.sheet.props.pid, { personId: c.id, first: c.firstName, last: c.lastName || '', nickname: c.nickname || '', strokes: typedHcp() });
  },
  'lh-rgo': async (el, ev, app) => {
    const props = app.sheet?.props || {};
    const raw = document.getElementById('lr-name')?.value || props.q || '';
    const { first: f, last } = names.splitName(raw);
    if (!f || !last) { app.toast({ title: 'First and last name', sub: `e.g. ${f || 'Kyle'} Smith. Only first names show during the round.`, error: true }); return; }
    const nick = props.nick ? (document.getElementById('lr-nick')?.value || '').trim().slice(0, 24) : '';
    if (props.nick && !nick) { app.toast({ title: 'Add a nickname', sub: `Someone else is already called ${f} ${last}.`, error: true }); return; }
    if ((app.event.roster.players || []).some((p) => names.nameKey({ firstName: f, lastName: last, nickname: nick }) === names.nameKey(p))) {
      app.toast({ title: `${f} ${last} is already on the list`, error: true });
      return;
    }
    let personId = db.uuid();
    try {
      const r = await db.api.personNameCheck({ first: f, last, nickname: nick || null, crewId: app.event.crew_id || null });
      if (r?.ok && r.taken) {
        if (r.crewMate && r.id) personId = r.id;
        else { app.openSheet('lobby-replace', { ...props, q: raw, nick: true }); return; }
      }
    } catch { /* offline: the server keeps names unique when it syncs the crew */ }
    doReplace(app, props.pid, { personId, first: f, last, nickname: nick, strokes: typedHcp() });
  },
  'lh-hcp': (el, ev, app) => app.openSheet('lobby-hcp', { pid: el.dataset.v }),
  'lh-order': (el, ev, app) => {
    const ev0 = app.event, st = app.lobby();
    const times = [0, 1, 2, 3].map((i) => (ev0.settings?.teeTimes || [])[i] || '');
    app.ui.orderStep = { code: app.code, key: L.rosterKey(ev0.roster), roster: clone(ev0.roster), before: clone(ev0.roster), times, sel: null, open: !!st?.open };
    app.render();
    document.getElementById('content').scrollTop = 0;
  },
  'lh-o-cancel': (el, ev, app) => { app.ui.orderStep = null; app.render(); },
  'lh-o-p': (el, ev, app) => {
    const o = app.ui.orderStep; if (!o) return;
    const id = el.dataset.v;
    if (o.sel?.kind === 'p' && o.sel.id !== id) { o.roster = L.swapPlayers(o.roster, o.sel.id, id); o.sel = null; }
    else o.sel = o.sel?.kind === 'p' && o.sel.id === id ? null : { kind: 'p', id };
    app.render();
  },
  'lh-o-cart': (el, ev, app) => {
    const o = app.ui.orderStep; if (!o) return;
    const id = el.dataset.v;
    if (o.sel?.kind === 'c' && o.sel.id !== id && o.sel.id[0] === id[0]) { o.roster = L.swapCarts(o.roster, o.sel.id, id); o.sel = null; }
    else o.sel = o.sel?.kind === 'c' && o.sel.id === id ? null : { kind: 'c', id };
    app.render();
  },
  'lh-o-mv': (el, ev, app) => {
    const o = app.ui.orderStep; if (!o) return;
    const i = Number(el.dataset.v), j = i + Number(el.dataset.d);
    o.roster = L.swapGroups(o.roster, i, j);
    o.sel = null;
    app.render();
  },
  'lh-o-time': (el, ev, app) => { const o = app.ui.orderStep; if (o) o.times[Number(el.dataset.i)] = el.value; },
  'lh-o-save': async (el, ev, app) => {
    const o = app.ui.orderStep;
    if (!o || o.saving) return;
    let fresh;
    try { fresh = await db.fetchEvent(app.code); } catch { fresh = null; }
    if (!fresh) { app.toast({ title: 'No signal', sub: 'Not saved. Try again.', error: true }); return; }
    const st = L.lobbyState(fresh, app.now());
    if (L.rosterKey(fresh.roster) !== o.key || !L.mayReorder(st, anyScores(app))) {
      app.ui.orderStep = null;
      app.event = { ...app.event, ...fresh };
      app.render();
      app.toast({ title: 'The round changed meanwhile', sub: anyScores(app) ? 'A score is in: the order is locked now.' : 'Nothing saved. Open Order and carts again.', error: true });
      return;
    }
    const roster = L.renameRyderCarts(L.mergeStep(o.roster, fresh.roster), fresh.roster); // names / handicaps as they are now
    const times = o.times.map((t) => (/^\d{1,2}:\d{2}$/.test(t || '') ? t : ''));
    const settings = !st.open && L.allTimesSet(times, 4) ? L.withStartTimes(fresh.settings, fresh.played_on, times, app.now()) : { ...fresh.settings, teeTimes: times };
    o.saving = true;
    app.render();
    app.event = { ...app.event, ...fresh };
    const ok = await app.saveEvent({ course: fresh.course, roster, settings, name: fresh.name });
    o.saving = false;
    if (!ok) { app.render(); return; }
    app.ui.orderStep = null;
    app.render();
    document.getElementById('content').scrollTop = 0;
    app.toast({ title: 'Order saved', sub: 'Every phone shows the new groups when it updates.' });
  },
  'lh-hstep': (el, ev, app) => { app.ui.hcpStep = { code: app.code, fromSetup: false, vals: {} }; app.render(); document.getElementById('content').scrollTop = 0; },
  'lh-hstep-cancel': (el, ev, app) => { app.ui.hcpStep = null; app.render(); },
  // Typing in the list: keep the value, update the count and the button in place (no redraw while typing).
  'lh-hstep-in': (el, ev, app) => {
    const step = app.ui.hcpStep;
    if (!step) return;
    step.vals[el.dataset.v] = el.value.replace(/\D/g, '').slice(0, 2);
    if (el.value !== step.vals[el.dataset.v]) el.value = step.vals[el.dataset.v];
    const ps = app.event.roster.players || [];
    const left = ps.filter((p) => !/^\d{1,2}$/.test(p.id in step.vals ? step.vals[p.id] : String(p.strokes ?? ''))).length;
    const t = document.getElementById('hs-left'); if (t) t.textContent = left ? `${left} still to set` : 'All set';
    const b = document.getElementById('hs-save'); if (b && step.fromSetup) b.disabled = left > 0;
  },
  'lh-hstep-save': async (el, ev, app) => {
    const step = app.ui.hcpStep;
    if (!step) return;
    const vals = { ...step.vals };
    const ok = await saveLobby(app, ({ roster }) => {
      for (const p of roster.players) if (p.id in vals) p.strokes = /^\d{1,2}$/.test(vals[p.id]) ? Math.min(54, Number(vals[p.id])) : null;
      if (step.fromSetup && L.handicapCount(roster) < roster.players.length) return null; // all 16 before the invite
      return { roster };
    });
    if (!ok) { if (step.fromSetup) app.toast({ title: 'Set every handicap first', sub: 'The invite shows each player theirs.', error: true }); return; }
    app.ui.hcpStep = null;
    app.render(); // fromSetup: Host's mount opens the invite share sheet next
    document.getElementById('content').scrollTop = 0;
  },
  'lh-hcp-save': async (el, ev, app) => {
    const pid = el.dataset.v;
    const raw = (document.getElementById('lh-hcp-n')?.value || '').trim();
    if (raw && !/^\d{1,2}$/.test(raw)) { app.toast({ title: 'A whole number, 0 to 54', error: true }); return; }
    const v = raw === '' ? null : Math.min(54, Number(raw));
    const ok = await saveLobby(app, ({ roster }) => {
      const p = roster.players.find((x) => x.id === pid);
      if (!p) return null;
      p.strokes = v;
      return { roster };
    });
    if (ok) app.closeSheet();
  },
  'lh-free': (el, ev, app) => {
    const p = (app.event.roster.players || []).find((x) => x.id === el.dataset.v);
    app.openSheet('confirm', {
      title: `Free up ${first(p)}’s name?`, body: 'The phone using it lets go, and he (or his new phone) can pick it again.',
      ok: 'Free it up', onOk: async () => { await app.release(el.dataset.v); app.hostLobby = null; app.render(); },
    });
  },
  'lh-remove': (el, ev, app) => {
    const pid = el.dataset.v;
    const p = (app.event.roster.players || []).find((x) => x.id === pid);
    const st = app.lobby();
    if (st.paired) {
      app.openSheet('confirm', {
        title: `Remove ${first(p)}?`, body: 'Removing him unpairs the carts: you pair them again after adding someone. Replacing him keeps his cart.',
        ok: `Replace ${first(p)} instead`, onOk: () => app.openSheet('lobby-replace', { pid, q: '' }),
        alt: 'Remove and unpair', onAlt: () => removePlayer(app, pid), danger: false,
      });
    } else if (st.hasTeams) {
      app.openSheet('confirm', {
        title: `Remove ${first(p)}?`, body: 'After the draft, removing a player clears the teams and the draft starts over. Replacing him keeps the teams.',
        ok: `Replace ${first(p)} instead`, onOk: () => app.openSheet('lobby-replace', { pid, q: '' }),
        alt: 'Remove and redraft', onAlt: () => removePlayer(app, pid), danger: false,
      });
    } else {
      app.openSheet('confirm', {
        title: `Remove ${first(p)}?`, body: 'He comes off the list. Team Ryder Cup needs 16 to draft, so add someone after.',
        ok: `Remove ${first(p)}`, danger: true, onOk: () => removePlayer(app, pid),
      });
    }
  },
  'lh-cohost': (el, ev, app) => app.openSheet('lobby-cohost', {}),
  'lh-cohost-pick': async (el, ev, app) => {
    const pid = el.dataset.v || null;
    const ok = await saveLobby(app, ({ settings }) => ({ settings: L.withCohost(settings, pid) }));
    if (!ok) return;
    const p = pid ? (app.event.roster.players || []).find((x) => x.id === pid) : null;
    if (p) share(app, 'cohost', { name: first(p) });
    else app.closeSheet();
  },
  'lh-options': (el, ev, app) => app.openSheet('lobby-options', {}),
  'lh-when': (el, ev, app) => app.openSheet('lobby-when', { back: el.dataset.v === 'back' }),
  'lh-when-save': async (el, ev, app) => {
    const back = el.dataset.v === 'back';
    const date = document.getElementById('lw-date')?.value || '';
    const time = document.getElementById('lw-time')?.value || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) { app.toast({ title: 'Pick a date and a start time', error: true }); return; }
    const st = app.lobby();
    if (date < st.today) { app.toast({ title: 'That date has passed', sub: 'Pick today or later.', error: true }); return; }
    const host = st.hostName;
    let fresh;
    try { fresh = await db.fetchEvent(app.code); } catch { fresh = null; }
    if (!fresh) { app.toast({ title: 'No signal', sub: 'Nothing changed. Try again.', error: true }); return; }
    let { settings: next, moved } = L.withWhen(fresh.settings, date, time);
    if (back) next = L.bringBack(next);
    const wasDate = fresh.played_on;
    const parts = [];
    if (date !== wasDate) parts.push(L.notices.redated(host, date, wasDate));
    if (moved) parts.push(L.notices.moved(host, time, L.addMinutes(time, -moved)));
    const notice = back ? `${L.notices.back(host)}${parts.length ? ` ${parts.join(' ')}` : ''}` : parts.join(' ');
    if (!notice) { app.closeSheet(); app.toast({ title: 'Nothing changed' }); return; }
    next = L.withNotice(next, notice, app.now(), [date, wasDate].sort().pop());
    // The date (with its opensAt, in one statement) goes first: if it fails, nothing else has changed.
    if (date !== wasDate) {
      try {
        const r = await db.api.setRoundDate(app.code, app.adminPin, date, next.lobby.opensAt);
        if (!r?.ok) throw new Error(r?.error);
      } catch (e) {
        app.toast({ title: 'The date didn’t save', sub: e?.message === 'bad_date' ? 'Pick a date within the next year.' : 'Nothing changed. Try again.', error: true });
        return;
      }
    }
    app.event = { ...app.event, ...fresh, played_on: date };
    const ok = await app.saveEvent({ course: fresh.course, roster: fresh.roster, settings: next, name: fresh.name });
    if (!ok) return;
    app.closeSheet();
    app.refetch();
    app.render();
  },
  'lh-back': async (el, ev, app) => {
    const host = app.lobby().hostName;
    const ok = await saveLobby(app, ({ settings }) => ({ settings: L.withNotice(L.bringBack(settings), L.notices.back(host), app.now(), app.event.played_on) }));
    if (ok) app.closeSheet();
  },
  'lh-calloff': (el, ev, app) => {
    app.openSheet('confirm', {
      title: `Call off ${app.event.name}?`, body: 'Every phone shows it’s off. Scores can’t be entered. You’ll tell the group next.',
      ok: 'Call it off', cancel: 'Keep the round', danger: true,
      onOk: async () => {
        const host = app.lobby().hostName;
        await saveLobby(app, ({ settings }) => ({ settings: L.withNotice(L.callOff(settings), L.notices.off(host), app.now(), app.event.played_on) }));
      },
    });
  },
  'lh-open-now': (el, ev, app) => {
    const st = app.lobby();
    if (!st.day) { app.toast({ title: 'Only on the day of the round', error: true }); return; }
    const mins = Math.max(1, Math.round((st.msToOpen || 0) / 60000));
    app.openSheet('confirm', {
      title: 'Open scoring now?', body: `Every phone can enter scores from now on, ${mins} minute${mins === 1 ? '' : 's'} early. Only on the day of the round.`,
      ok: 'Open scoring',
      onOk: async () => { await saveLobby(app, ({ settings }) => ({ settings: L.openNow(settings, app.now()) })); },
    });
  },
};
