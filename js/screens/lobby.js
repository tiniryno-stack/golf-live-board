// lobby.js (screen) — handoff 025, the player side of a Team Ryder Cup round before scoring opens: the landing (1),
// Which one are you? (2), See you Saturday (3), the lobby by stage (4–8, 14), called off, spot given to a sub (10)
// and Scoring is open (13). The view comes from app.lobbyView() (pure js/lobby.js); this file only draws it.
// Words: players never see "lobby" or "tee time": Coming up, start time, Open.

import { esc, icon } from '../ui.js';
import * as db from '../db.js';
import { joinList, myLobby, dayName, shortDate, hostLine, clock12, wallClock } from '../lobby.js';
import { playOrder } from '../scoring.js';

const isIOS = () => {
  if (typeof globalThis.__GLB_IOS === 'boolean') return globalThis.__GLB_IOS;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};
const safariPhone = () => !db.STANDALONE && isIOS();
const first = (p) => p?.firstName || String(p?.name || '').split(' ')[0];

/** Players' counts ("3 haven't added Golf Board"): numbers only, refreshed at most once a minute. */
function counts(app) {
  const c = app.lobbyCounts;
  if (!c || c.code !== app.code || Date.now() - c.at > 60000) {
    if (!app.lobbyCountsLoading) {
      app.lobbyCountsLoading = true;
      app.lobbyCounts = { ...(c?.code === app.code ? c : {}), code: app.code, at: Date.now() };
      db.api.lobbyCounts(app.code).then((r) => {
        if (r?.ok) { app.lobbyCounts = { code: app.code, at: Date.now(), ...r }; app.render(); }
      }).catch(() => {}).finally(() => { app.lobbyCountsLoading = false; });
    }
  }
  return app.lobbyCounts?.code === app.code && app.lobbyCounts.total != null ? app.lobbyCounts : null;
}

function head(kicker, title, sub = '') {
  return `<div class="nr-head"><div class="nr-k"><span class="lbl">${kicker}</span></div><h1 class="nr-title">${title}</h1>${sub ? `<div class="nr-sub">${sub}</div>` : ''}</div>`;
}
const foot = (inner) => `<div class="nr-foot">${inner}</div>`;
const note = (t) => `<p class="meta lb-note">${t}</p>`;
const row = (title, detail = '', { act = '', v = '', cls = '', chev = false } = {}) => {
  const body = `<span class="body"><b class="lb-rt${cls ? ` ${cls}` : ''}">${title}</b>${detail ? `<span class="detail">${detail}</span>` : ''}</span>${chev ? `<span class="hr-chev">${icon('fwd', 20)}</span>` : ''}`;
  return act ? `<button class="row lb-row" data-act="${act}"${v ? ` data-v="${esc(v)}"` : ''}>${body}</button>` : `<div class="row lb-row">${body}</div>`;
};

/** The round card on the landing: date · course, the round, the game and the first start (never "tee"). */
function roundCard(app, st) {
  const ev = app.event;
  return `<div class="card lb-card"><span class="lbl">${esc(shortDate(st.date))} · ${esc(ev.course?.shortName || ev.course?.name || '')}</span>
    <b class="lb-name">${esc(ev.name)}</b>
    <span class="soft lb-line">Team Ryder Cup · ${(ev.roster?.players || []).length} players · first start around ${esc(st.startLabel)}</span></div>`;
}

/** The amber-dot card for a change (8): the dot is the only amber; the text stays the normal colour. */
const noticeCard = (st) => (st.notice ? `<div class="card lb-notice" role="status"><span class="lb-dot" aria-hidden="true"></span><span>${esc(st.notice.text)}</span></div>` : '');

const howLink = () => `<button class="link-btn lb-how" data-act="lb-how">How Team Ryder Cup works ›</button>`;

/** iPhone Safari: Add Golf Board to your home screen, on every lobby view until it's done (024 move link). */
const addRow = () => (safariPhone()
  ? `<button class="home-row lb-add" data-act="lb-add"><span class="hr-ico">${icon('phone', 22)}</span>
      <span class="hr-main"><span class="hr-name">Add Golf Board to your home screen</span><span class="hr-sub lb-wrap">On the day, just tap the icon. You stay you.</span></span>
      <span class="hr-chev">${icon('fwd', 20)}</span></button>` : '');

/** The organizer (PIN on this phone) or the co-host: a Host row on their own lobby (14). */
function hostRow(app, st) {
  const co = st.cohost && st.cohost === app.me;
  if (!app.adminPin && !co) return '';
  return `<div class="card lb-card lb-rows">${row('Host', app.adminPin ? 'draft, start times, players' : 'enter the organizer PIN', { act: 'lb-host', chev: true })}</div>`;
}

function whoPlaying(app, st) {
  const ps = joinList(app.event.roster, app.claimed, '', app.me);
  const meFirst = [...ps.filter((p) => p.id === app.me), ...ps.filter((p) => p.id !== app.me)];
  const c = counts(app);
  const missing = c ? Math.max(0, c.total - c.in_app) : null;
  const more = ps.length - 4;
  const rows = meFirst.slice(0, 4).map((p) => row(esc(p.name), p.id === app.me ? 'you' : '', { cls: p.id === app.me ? 'you' : '' })).join('');
  return `<div class="lbl lb-k">Who’s playing</div>
    <div class="card lb-card lb-rows">${rows}${more > 0 ? row(`${more} more${missing ? ` · ${missing} haven’t added Golf Board` : ''}`, '', { act: 'lb-all', chev: true, cls: 'muted' }) : ''}</div>`;
}

const comingUp = (st) => `<div class="lbl lb-k">Coming up</div>
  <div class="card lb-card lb-rows">${row('Teams', `After ${esc(st.hostName)}’s draft`)}${row('Your start time and matches', 'After the draft')}</div>`;

/** 1 · the lobby landing (replaces the join intro). */
function landing(app, st) {
  const ev = app.event;
  return `${head(`${esc(ev.name)} · ${esc(st.hostName)} invited you`, `You’re on the list for ${esc(dayName(st.date, app.now(), st.tz))}`, 'Join now. Teams and start times come later and show up on your phone.')}
    ${roundCard(app, st)}
    ${noticeCard(st)}
    ${safariPhone() ? note(`Already have Golf Board on your home screen? Open it, tap <b>Join with code</b> and type <b class="mono">${esc(app.code)}</b>.`) : ''}
    ${foot(`${note('No account. About a minute: pick your name, then add Golf Board to your home screen.')}
      <button class="btn primary nr-cta" data-act="lb-find">Find my name</button>
      <button class="btn ghost block lb-quiet" data-act="lb-follow">Not playing? Follow along</button>`)}`;
}

function whoRows(app, q) {
  const list = joinList(app.event.roster, app.claimed, q, app.me);
  if (!list.length) return `<p class="meta lb-empty">No one called “${esc(q)}” on the list.</p>`;
  return `<div class="card lb-card lb-rows">${list.map((p) => (p.taken
    ? `<button class="row lb-row taken" data-act="lb-pick" data-v="${esc(p.id)}"><span class="body"><b class="lb-rt muted">${esc(p.name)}</b></span><span class="detail">on another phone</span></button>`
    : `<button class="row lb-row" data-act="lb-pick" data-v="${esc(p.id)}"><span class="body"><b class="lb-rt">${esc(p.name)}</b></span></button>`)).join('')}</div>`;
}

/** 2 · Which one are you? A–Z with search (no start-time groups exist yet). */
function who(app) {
  const q = app.ui.lobbyQ || '';
  const n = (app.event.roster?.players || []).length;
  return `<button class="link-btn lb-back" data-act="lb-back">${icon('back', 20)} Back</button>
    ${head(`${esc(app.event.name)} · step 1 of 3`, 'Which one are you?')}
    <input class="input lb-search" type="search" placeholder="Search ${n} names" aria-label="Search names" value="${esc(q)}" autocomplete="off" data-input="lb-q">
    <div id="lb-who">${whoRows(app, q)}</div>
    ${foot('<button class="btn ghost block" data-act="lb-notlisted">I’m not on the list</button>')}`;
}

/** 3 · first open after joining. */
function welcome(app, st) {
  const day = dayName(st.date, app.now(), st.tz);
  return `${head(`${esc(app.event.name)} · you’re in`, `See you ${esc(day)}, ${esc(first(app.myPlayer()))}`, `${esc(st.hostName)} drafts the teams and sets start times before then. Open Golf Board any time to see them.`)}
    ${addRow()}
    ${foot(`${note(db.STANDALONE ? `On ${esc(day)}, just tap Golf Board on your home screen. No link needed.` : `On ${esc(day)}, open Golf Board from your home screen. No link needed.`)}
      <button class="btn primary nr-cta" data-act="lb-welcome">See who’s playing</button>`)}`;
}

/** 4 / 14 / watching · before the draft. */
function early(app, st, { watching = false } = {}) {
  const ev = app.event;
  const co = st.cohost && st.cohost === app.me;
  return `${head(`${esc(ev.name)}${co ? ' · you’re co-host' : ''}`, `${esc(dayName(st.date, app.now(), st.tz))} · ${esc(st.startLabel)} at ${esc(ev.course?.shortName || ev.course?.name || '')}`, `Team Ryder Cup · ${(ev.roster?.players || []).length} players`)}
    ${howLink()}
    ${noticeCard(st)}
    ${hostRow(app, st)}
    ${watching ? '' : comingUp(st)}
    ${whoPlaying(app, st)}
    ${watching ? `<div class="lb-gap"></div><button class="btn block" data-act="lb-find">Find my name</button>` : addRow()}`;
}

function teamCard(side, open, act) {
  if (!side) return '';
  const carts = side.carts.map((c) => row(esc(c.names), c.mine ? 'your cart' : '', { cls: c.mine ? 'you' : 'plain' })).join('');
  const mine = side.carts.some((c) => c.mine);
  return `<div class="card lb-card lb-rows">${row(esc(side.name), mine ? 'your team' : `${side.carts.length * 2} players`, act ? { act, chev: !open } : {})}${open ? carts : ''}</div>`;
}

/** 5 · teams are set. Only your cart is green; the other team folds into one row. */
function drafted(app, st) {
  const m = myLobby(app.event, app.me);
  if (!m) return early(app, st);
  const ev = app.event;
  const open = app.ui.lbOther === app.code;
  return `${head(`${esc(ev.name)} · teams are set`, `You’re on ${esc(m.side?.name || 'a team')}`, `${esc(dayName(st.date, app.now(), st.tz))} ${esc(st.startLabel)} · ${esc(ev.course?.shortName || ev.course?.name || '')}`)}
    ${noticeCard(st)}
    ${hostRow(app, st)}
    ${teamCard(m.side, true)}
    ${teamCard(m.other, open, 'lb-other')}
    ${howLink()}
    ${note('Start times next. Your group and matches show up here.')}
    ${addRow()}`;
}

/** 6 · start times are set: your time, cart-mate and three matches; scoring opens by itself. */
function ready(app, st) {
  const m = myLobby(app.event, app.me);
  if (!m) return early(app, st);
  const ev = app.event;
  const day = dayName(st.date, app.now(), st.tz);
  const mins = Math.ceil((st.msToOpen || 0) / 60000);
  const soon = st.day && mins > 0 && mins <= 60 ? ` Opens in ${mins} min.` : '';
  return `${head(`${esc(ev.name)} · ${esc(m.side?.name || '')}`, `${esc(day)} · ${esc(m.tee || st.startLabel)}${m.mate ? ` with ${esc(m.mate)}` : ''}`, `${esc(ev.course?.shortName || ev.course?.name || '')} · Team Ryder Cup`)}
    ${noticeCard(st)}
    ${hostRow(app, st)}
    <div class="card lb-card lb-rows">${m.matches.map((x) => row(`Holes ${esc(x.holes)}`, x.vs ? `vs ${esc(x.vs)}` : '')).join('')}</div>
    ${note(`Scoring opens by itself at ${esc(st.opensLabel)}${st.day ? '' : ` on ${esc(day)}`}. Just tap Golf Board.${soon}`)}
    ${howLink()}
    ${addRow()}`;
}

/** 7 · the day, start times not in yet (or the draft not done). */
function dayWait(app, st) {
  const m = myLobby(app.event, app.me);
  const who = hostLine(st);
  const now = clock12(wallClock(app.now(), st.tz));
  const drafting = st.stage === 'lobby';
  return `${head([esc(dayName(st.date, app.now(), st.tz)), esc(now), m?.side ? esc(m.side.name) : ''].filter(Boolean).join(' · '),
      drafting ? `${esc(who)} is drafting the teams` : `${esc(who)} is setting start times`,
      drafting ? 'Keep this open: your team, start time and matches show up here.' : 'Teams are set. Keep this open: scoring opens the moment start times are in.')}
    ${noticeCard(st)}
    ${hostRow(app, st)}
    ${addRow()}
    ${foot(`${note('Running late? Give them a nudge.')}<button class="btn block nr-cta" data-act="lb-text">Text ${esc(st.hostName)}</button>`)}`;
}

/** Called off (by link; Home has its own card). */
function off(app, st) {
  return `${head(`${esc(app.event.name)} · was ${esc(shortDate(st.date))}`, 'Called off', `${esc(st.hostName)} called this off. Rain check?`)}
    ${noticeCard(st)}
    ${hostRow(app, st)}
    ${foot(`<button class="btn block nr-cta" data-act="lb-text">Text ${esc(st.hostName)}</button>
      <button class="btn ghost block lb-quiet" data-act="go" data-v="#/">Go to Home</button>`)}`;
}

/** 10 · your spot went to a sub (by link; Home has its own card). */
function removed(app, st) {
  const sub = app.lobbyRemoved();
  return `${head(esc(app.event.name), `${esc(st.hostName)} gave your spot to ${esc(sub)}`, 'You’re not on the list for this round any more. Wrong? Ask him.')}
    ${foot(`<button class="btn block nr-cta" data-act="lb-text">Text ${esc(st.hostName)}</button>
      <button class="btn ghost block lb-quiet" data-act="go" data-v="#/">Go to Home</button>`)}`;
}

/** 13 · Scoring is open (once per round on this phone). */
function gameday(app) {
  const m = myLobby(app.event, app.me);
  const h = playOrder(app.event.settings || {})[0] || 1;
  const title = m ? [m.side?.name, [m.tee, m.mate ? `with ${m.mate}` : ''].filter(Boolean).join(' ')].filter(Boolean).map(esc).join(' · ') : '';
  return `${head(`${esc(app.event.name)} · scoring is open`, title || 'Scoring is open',
      m?.matches[0]?.vs ? `First up, holes ${esc(m.matches[0].holes)} against ${esc(m.matches[0].vs)}.` : '')}
    ${foot(`<button class="btn primary nr-cta" data-act="lb-go1">Go to hole ${h}</button>
      <button class="btn ghost block lb-quiet" data-act="lb-howday">How today’s game works</button>`)}`;
}

const VIEWS = { landing, who, welcome, early, watch: (a, s) => early(a, s, { watching: true }), drafted, ready, dayWait, off, removed, gameday };

/** "Hi Andrew — about Chuck's Bday: " in the share sheet (no phone numbers in the app; he picks the contact). */
async function textHost(app, st) {
  const text = `Hi ${st.hostName}, about ${app.event.name}: `;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch { /* cancelled: nothing to say */ }
    return;
  }
  app.toast({ title: `Text ${st.hostName} from your messages`, sub: 'There’s no number in Golf Board.' });
}

export default {
  render(app) {
    const st = app.lobby();
    const v = app.lobbyView();
    // Never a blank screen: if the round moved on between a check and this draw, say so and offer the round.
    if (!st || !v) return `<div class="plain"><h1 class="title">${esc(app.event?.name || '')}</h1><button class="btn primary block big" data-act="go" data-v="${esc(app.tabHash(app.homeTab()))}">Open the round</button></div>`;
    return `<div class="plain nr-setup lb">${(VIEWS[v] || early)(app, st)}</div>`;
  },
  actions: {
    'lb-find': (el, ev, app) => {
      app.ui.lobbyPick = app.code;
      app.ui.lobbyWatch = null;
      app.ui.lobbyQ = '';
      app.refreshClaimed();
      app.render();
    },
    'lb-follow': (el, ev, app) => { app.ui.lobbyWatch = app.code; app.ui.lobbyPick = null; app.render(); },
    'lb-back': (el, ev, app) => { app.ui.lobbyPick = null; app.render(); },
    'lb-q': (el, ev, app) => {
      app.ui.lobbyQ = el.value;
      const box = document.getElementById('lb-who');
      if (box) box.innerHTML = whoRows(app, el.value);
    },
    'lb-pick': (el, ev, app) => {
      const pid = el.dataset.v;
      if (app.claimed.has(pid) && pid !== app.me) { app.openSheet('taken', { pid, lobby: true }); return; }
      app.claim(pid); // → 024's "You're Baker?" confirm on a phone with no owner, then See you Saturday
    },
    'lb-notlisted': (el, ev, app) => textHost(app, app.lobby()),
    'lb-text': (el, ev, app) => textHost(app, app.lobby()),
    'lb-welcome': (el, ev, app) => { app.markLobbySeen('welcome'); app.render(); document.getElementById('content').scrollTop = 0; },
    'lb-all': (el, ev, app) => app.openSheet('lobby-all', {}),
    'lb-other': (el, ev, app) => { app.ui.lbOther = app.ui.lbOther === app.code ? null : app.code; app.render(); },
    'lb-host': (el, ev, app) => app.go(app.tabHash('host')),
    'lb-how': (el, ev, app) => {
      // Today's game pages need the carts; before the draft, a short rules sheet.
      if (app.snapshot?.game) app.openBrief();
      else app.openSheet('lobby-how', {});
    },
    'lb-howday': (el, ev, app) => app.openBrief(),
    'lb-go1': (el, ev, app) => {
      app.markLobbySeen('open');
      app.ui.hole = null;
      app.go(app.tabHash('enter'));
      app.render();
    },
    'lb-add': (el, ev, app) => {
      history.replaceState(null, '', `${location.pathname}${location.search}${db.moveLink(app.code)}`);
      db.local.set('glb.hasApp', true);
      app.openSheet('homescreen', { round: app.event?.name || app.code });
    },
  },
};
