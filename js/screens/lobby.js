// lobby.js (screen) — handoff 025, the player side of a Team Ryder Cup round before scoring opens: the handicap
// invite, the Add to Home Screen steps (guide), the landing (1), Which one are you? (2 / 2b), the reveal, the lobby by
// stage (4–8, 14), called off, spot given to a sub (10) and Scoring is open (13). The view comes from app.lobbyView() (pure js/lobby.js); this file only draws it.
// Words: players never see "lobby" or "tee time": Coming up, start time, Open.

import { esc, icon } from '../ui.js';
import * as db from '../db.js';
import { notSafari, byHandicap, guideEscape, GUIDE_ESCAPE_MS, joinList, myLobby, myCart, dayName, shortDate, hostLine, clock12, wallClock, hasHandicaps, hcpOf, rankLine, revealFrame } from '../lobby.js';
import { playOrder } from '../scoring.js';

const safariPhone = () => !db.STANDALONE && db.isIOS();
const inAppBrowser = () => { try { return notSafari(navigator.userAgent); } catch { return false; } };
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
const row = (title, detail = '', { act = '', v = '', cls = '', chev = false, right = '' } = {}) => {
  const body = `<span class="body"><b class="lb-rt${cls ? ` ${cls}` : ''}">${title}</b>${detail ? `<span class="detail">${detail}</span>` : ''}</span>${right ? `<span class="detail lb-d${right.mono ? ' mono' : ''}">${esc(right.text)}</span>` : ''}${chev ? `<span class="hr-chev">${icon('fwd', 20)}</span>` : ''}`;
  return act ? `<button class="row lb-row" data-act="${act}"${v ? ` data-v="${esc(v)}"` : ''}>${body}</button>` : `<div class="row lb-row">${body}</div>`;
};

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
  // Lowest handicap first (owner, Nov 6); joinList is A–Z, so ties stay A–Z.
  const meFirst = byHandicap(app.event.roster, joinList(app.event.roster, app.claimed, '', app.me));
  const ps = meFirst;
  const c = counts(app);
  const missing = c ? Math.max(0, c.total - c.in_app) : null;
  const more = ps.length - 4;
  const hcp = hasHandicaps(app.event.roster) || (app.event.roster?.players || []).some((p) => hcpOf(app.event.roster, p.id));
  const right = (id) => { const h = hcpOf(app.event.roster, id); return h ? { text: h.strokes, mono: true } : ''; };
  const tag = (id) => (id === app.me ? 'you' : id === st.hostId ? 'organizer' : '');
  const rows = meFirst.slice(0, 4).map((p) => row(esc(p.name), tag(p.id), { cls: p.id === app.me ? 'you' : '', right: right(p.id) })).join('');
  return `<div class="lbl lb-k">Who’s playing${hcp ? ' · handicap' : ''}</div>
    <div class="card lb-card lb-rows">${rows}${more > 0 ? row(`${more} more${missing ? ` · ${missing} haven’t added Golf Board` : ''}`, '', { act: 'lb-all', chev: true, cls: 'muted' }) : ''}</div>`;
}

const comingUp = (st) => `<div class="lbl lb-k">Coming up</div>
  <div class="card lb-card lb-rows">${row('Teams', `After ${esc(st.hostName)}’s draft`)}${row('Your start time and matches', 'After the draft')}</div>`;

/**
 * Who invited you, said once (owner: the pre-join screens repeated the course and date four times). A round with no
 * name of its own is named "Course · date" by Setup, so it adds nothing: then only the organizer is named.
 */
function invitedBy(app, st) {
  const ev = app.event;
  const course = ev.course?.shortName || ev.course?.name || '';
  const own = ev.name && !(course && String(ev.name).startsWith(course)) ? ev.name : '';
  const host = st.hostName && st.hostName !== 'The organizer' ? `${st.hostName} invited you` : 'You’re invited';
  return [own, host].filter(Boolean).map(esc).join(' · ');
}
/** The one line about the round: game, players, where, first start (never "tee"). */
const roundLine = (app, st) => `Team Ryder Cup · ${(app.event.roster?.players || []).length} players · ${esc(app.event.course?.shortName || app.event.course?.name || '')} · first start ${esc(st.startLabel)}`;

/** 1 · the lobby landing for a plain link: one headline, one round line, one primary (owner, Nov 6: less to read). */
function landing(app, st) {
  const ios = safariPhone();
  return `${head(invitedBy(app, st), `You’re on the list for ${esc(dayName(st.date, app.now(), st.tz))}`, roundLine(app, st))}
    ${noticeCard(st)}
    ${foot(`${note(ios ? 'Add Golf Board to your home screen to see your team, start time and handicap.' : 'Pick your name to see your team, start time and handicap.')}
      ${ios ? '<button class="btn primary nr-cta" data-act="lb-guide">Add Golf Board to my home screen</button>' : '<button class="btn primary nr-cta" data-act="lb-find">Find my name</button>'}
      ${ios ? '<button class="lb-tiny" data-act="lb-find">or join in Safari</button>' : '<button class="lb-tiny" data-act="lb-follow">Not playing? Follow along</button>'}`)}`;
}

/** The handicap invite (#/e/CODE/hcp, every player has a handicap): one line, one primary. */
function invite(app, st) {
  const ev = app.event;
  const n = (ev.roster?.players || []).length;
  const who = st.hostName && st.hostName !== 'The organizer' ? st.hostName : 'Your organizer';
  return `${head(invitedBy(app, st), `${esc(who)} set your handicap`, `${n} players. Two teams. One cup. ${esc(dayName(st.date, app.now(), st.tz))}.`)}
    ${noticeCard(st)}
    ${foot(`<button class="btn primary nr-cta" data-act="${safariPhone() ? 'lb-guide' : 'lb-find'}">Reveal my handicap</button>
      <button class="lb-tiny" data-act="lb-follow">Not playing? Follow along</button>`)}`;
}

/** Add to Home Screen, step 1 of 2 (iPhone Safari). The move link (with the round) is in the address bar while this
 *  shows, so the icon opens straight into this round as this phone. No primary: Safari's ⋯ is the action. */
function guide(app, st) {
  const hcp = hasHandicaps(app.event.roster);
  const g = app.ui.guideAt?.code === app.code ? app.ui.guideAt : (app.ui.guideAt = { code: app.code, at: Date.now() });
  const late = guideEscape(g.at, Date.now()); // the home screen is the way in; the escape only after 3 minutes
  // Opened by a tap (invite / landing / the lobby's Add row): Back. Held there (joined in Safari, reveal unseen): no Back.
  const tapped = app.ui.lobbyGuide === app.code;
  const back = tapped ? `<button class="link-btn lb-back" data-act="lb-back">${icon('back', 20)} Back</button>` : '';
  const escape = late && !(app.me && tapped); // from the lobby's Add row, Back is the way out
  return `${back}${head(hcp ? 'Step 1 of 2 · reveal your handicap' : `${esc(app.event.name)} · add Golf Board`, hcp ? 'Your handicap opens in the app' : 'Golf Board opens from your home screen', 'Put Golf Board on your home screen. 30 seconds.')}
    <ol class="hs-steps lb-steps">
      <li><span class="hs-n">1</span><span>Tap <b>•••</b> below</span></li>
      <li><span class="hs-n">2</span><span>Tap <b>Share</b></span></li>
      <li><span class="hs-n">3</span><span>Tap <b>Add to Home Screen</b>, then <b>Add</b></span></li>
      <li><span class="hs-n">4</span><span>Tap the new <b>Golf Board</b> icon</span></li>
    </ol>
    <p class="meta lb-note">${inAppBrowser() ? 'Not in Safari (Partiful, another app)? Tap <b>•••</b> → <b>Open in Safari</b> first. ' : ''}Already have Golf Board? Open it and tap <b>Join with code</b> · <b class="mono">${esc(app.code)}</b>.</p>
    <p class="meta lb-note">This link signs in as you: use Add to Home Screen only, don’t send it.</p>
    ${escape ? foot(`<button class="lb-tiny lb-left" data-act="lb-here">Can’t add it? ${hcp ? 'Reveal it here' : app.me ? 'Carry on here' : 'Join here'}</button>`) : ''}
    <div class="lb-point" aria-hidden="true"><span class="lb-badge">Tap ••• here</span>${icon('fwd', 26)}</div>`;
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
  // "Step 2 of 2" only for someone who came the handicap way (the app from the steps, the invite, Can't add it).
  const stepped = hasHandicaps(app.event.roster) && (db.STANDALONE || app.ui.lobbyInvite === app.code || app.ui.revealHere === app.code);
  const kicker = stepped ? 'Step 2 of 2 · reveal your handicap' : db.STANDALONE ? `${esc(app.event.name)} · in Golf Board` : esc(app.event.name);
  // The home screen app opens straight on this list: no Back to loop to (2b).
  const back = db.STANDALONE && app.ui.lobbyPick !== app.code ? '' : `<button class="link-btn lb-back" data-act="lb-back">${icon('back', 20)} Back</button>`;
  return `${back}
    ${head(kicker, 'Which one are you?')}
    <input class="input lb-search" type="search" placeholder="Search ${n} names" aria-label="Search names" value="${esc(q)}" autocomplete="off" data-input="lb-q">
    <div id="lb-who">${whoRows(app, q)}</div>
    ${foot(`<button class="btn ghost block" data-act="lb-notlisted">I’m not on the list</button><button class="btn ghost block lb-quiet" data-act="lb-follow">Not playing? Follow along</button>`)}`;
}

/** The reveal (once per phone per round): blurred, rolling, then the number; the rest fades in. Drawn from
 *  revealFrame(now − t0) on every render, so a redraw never restarts it; mount() runs the frames in between. */
function reveal(app, st) {
  const h = hcpOf(app.event.roster, app.me);
  if (!h) return early(app, st);
  const r = app.ui.reveal?.code === app.code && app.ui.reveal.pid === app.me ? app.ui.reveal : null;
  const f = revealFrame(h.strokes, r ? Date.now() - r.t0 : 0, reduced());
  const rank = rankLine(h);
  const fade = (i) => `style="opacity:${f.fade[i]}"`;
  return `<div class="lb-reveal">
    <div class="nr-head"><div class="nr-k"><span class="lbl${f.fade[0] >= 1 ? ' you' : ''}" id="lbr-k">${esc(app.event.name)} · ${esc(first(app.myPlayer()))}</span></div>
      <h1 class="nr-title">${esc(st.hostName)} has you at</h1></div>
    <div class="lb-hcp mono${f.settled ? '' : ' rolling'}" id="lbr-n" style="filter:blur(${f.blur}px)">${esc(f.value)}</div>
    ${rank ? `<p class="nr-sub lb-fade" id="lbr-1" ${fade(1)}>${esc(rank)}</p>` : ''}
    <p class="meta lb-fade" id="lbr-2" ${fade(2)}>Think it’s off? Text ${esc(st.hostName)}.</p>
    ${foot(`<button class="btn primary nr-cta lb-fade" id="lbr-3" data-act="lb-revealed" ${fade(3)}>See who you’re up against</button>`)}
  </div>`;
}
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** Your handicap (4): text only, no button (owner, Nov 6). */
function hcpCard(app, st) {
  const h = hcpOf(app.event.roster, app.me);
  if (!h) return '';
  return `<div class="card lb-card"><b class="lb-rt">Your handicap · <span class="mono">${esc(h.strokes)}</span></b>
    <span class="detail lb-wrap">${esc(st.hostName)} sets these. Think it’s off? Text ${esc(st.hostName)}.</span></div>`;
}

/** Your cart (stage carts): your cart in green, the team after the draft. */
function cartCard(app) {
  const c = myCart(app.event, app.me);
  if (!c) return '';
  return `<div class="lbl lb-k">Your cart</div>
    <div class="card lb-card lb-rows">${row(esc(c.names), '', { cls: 'you', right: { text: 'team after the draft' } })}</div>`;
}

/** 4 / 14 / watching · before the draft. */
function early(app, st, { watching = false } = {}) {
  const ev = app.event;
  const co = st.cohost && st.cohost === app.me;
  return `${head(`${esc(ev.name)}${co ? ' · you’re co-host' : ''}`, `${esc(dayName(st.date, app.now(), st.tz))} · ${esc(st.startLabel)} at ${esc(ev.course?.shortName || ev.course?.name || '')}`, `Team Ryder Cup · ${(ev.roster?.players || []).length} players`)}
    ${howLink()}
    ${noticeCard(st)}
    ${hostRow(app, st)}
    ${watching ? '' : hcpCard(app, st)}
    ${watching ? '' : st.paired && myCart(app.event, app.me) ? cartCard(app) : comingUp(st)}
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
  const drafting = st.stage === 'lobby' || st.stage === 'carts';
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

const VIEWS = { landing, invite, guide, reveal, who, early, watch: (a, s) => early(a, s, { watching: true }), drafted, ready, dayWait, off, removed, gameday };

/** "Hi Andrew — about Chuck's Bday: " in the share sheet (no phone numbers in the app; he picks the contact). */
async function textHost(app, st) {
  const text = `Hi ${st.hostName}, about ${app.event.name}: `;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch { /* cancelled: nothing to say */ }
    return;
  }
  app.toast({ title: `Text ${st.hostName} from your messages`, sub: 'There’s no number in Golf Board.' });
}

/** Leave the guide: the address bar goes back to the round (the move link was only for Add to Home Screen). */
function restoreHash(app) {
  if (/^#move=/.test(location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#/e/${app.code}`);
}

/** Reveal frames between renders: only the number, the kicker and the fades change (no full redraws). */
let revealRaf = 0;
let guideTimer = null;
function runReveal(app) {
  cancelAnimationFrame(revealRaf);
  const h = hcpOf(app.event.roster, app.me);
  const r = app.ui.reveal;
  if (!h || !r) return;
  const tick = () => {
    const n = document.getElementById('lbr-n');
    if (!n || app.ui.reveal !== r) return; // the screen moved on: stop
    const f = revealFrame(h.strokes, Date.now() - r.t0, reduced());
    n.textContent = String(f.value);
    n.style.filter = `blur(${f.blur}px)`;
    n.classList.toggle('rolling', !f.settled);
    document.getElementById('lbr-k')?.classList.toggle('you', f.fade[0] >= 1);
    [1, 2, 3].forEach((i) => { const el = document.getElementById(`lbr-${i}`); if (el) el.style.opacity = String(f.fade[i]); });
    if (!f.done) revealRaf = requestAnimationFrame(tick);
  };
  revealRaf = requestAnimationFrame(tick);
}

export default {
  // Before you've joined (invite, landing, steps, the name list) the round's top bar only repeats what the screen says
  // ("Watching · Bridlewood · Sat Nov 7"): hide it. Once you're in, the name pill and ⋯ come back.
  hideTop(app) { return ['invite', 'landing', 'guide', 'who'].includes(app.lobbyView()); },
  mount(root, app) {
    const v = app.lobbyView();
    if (v === 'guide') {
      const g = app.ui.guideAt;
      clearTimeout(guideTimer);
      if (g?.code === app.code && !guideEscape(g.at, Date.now())) guideTimer = setTimeout(() => app.render(), g.at + GUIDE_ESCAPE_MS - Date.now() + 50);
    }
    if (v === 'guide' && !/^#move=/.test(location.hash)) {
      // The steps work from the move link with the round in it (024): the icon opens straight into this round.
      history.replaceState(null, '', `${location.pathname}${location.search}${db.moveLink(app.code)}`);
    }
    if (v !== 'reveal') { cancelAnimationFrame(revealRaf); return; }
    if (app.ui.reveal?.code === app.code && app.ui.reveal.pid === app.me) { runReveal(app); return; }
    // Wait for the "You're Baker?" confirm (or any sheet): the number is never spent behind it. The confirm opens
    // right after this draw (app.claim), so look again on the next tick; closing the sheet redraws and lands here.
    setTimeout(() => {
      if (app.sheet || app.lobbyView() !== 'reveal' || app.ui.reveal?.code === app.code) return;
      app.ui.reveal = { code: app.code, pid: app.me, t0: Date.now() };
      app.markHcpSeen(); // once per phone: a reload goes to the lobby
      runReveal(app);
    }, 0);
  },
  render(app) {
    const st = app.lobby();
    const v = app.lobbyView();
    // Never a blank screen: if the round moved on between a check and this draw, say so and offer the round.
    if (!st || !v) return `<div class="plain"><h1 class="title">${esc(app.event?.name || '')}</h1><button class="btn primary block big" data-act="go" data-v="${esc(app.tabHash(app.homeTab()))}">Open the round</button></div>`;
    return `<div class="plain nr-setup lb">${(VIEWS[v] || early)(app, st)}</div>`;
  },
  actions: {
    'lb-find': (el, ev, app) => {
      app.ui.revealHere = app.code; // chose Safari (Join in Safari for now): after the pick, the reveal, not the steps
      app.markLobbySeen('here'); // and after a reload too
      app.ui.lobbyPick = app.code;
      app.ui.lobbyWatch = null;
      app.ui.lobbyQ = '';
      app.refreshClaimed();
      app.render();
    },
    'lb-follow': (el, ev, app) => { app.ui.lobbyWatch = app.code; app.ui.lobbyPick = null; app.render(); },
    'lb-back': (el, ev, app) => { app.ui.lobbyPick = null; app.ui.lobbyGuide = null; restoreHash(app); app.render(); },
    'lb-guide': (el, ev, app) => { app.ui.lobbyGuide = app.code; app.render(); document.getElementById('content').scrollTop = 0; },
    'lb-here': (el, ev, app) => {
      // Can't add it: carry on in Safari (the name list, or the reveal for a player who's already in).
      restoreHash(app);
      app.ui.lobbyGuide = null;
      app.ui.revealHere = app.code; // this phone stays in Safari: after the name pick, the reveal (not the steps again)
      app.markLobbySeen('here'); // a reload keeps the choice
      if (!app.me) { app.ui.lobbyPick = app.code; app.ui.lobbyQ = ''; app.refreshClaimed(); }
      app.render();
    },
    'lb-revealed': (el, ev, app) => { app.ui.reveal = null; app.markHcpSeen(); app.render(); document.getElementById('content').scrollTop = 0; },
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
      // The same Add to Home Screen steps as the invite (full screen, the ••• badge), not a different sheet.
      app.ui.lobbyGuide = app.code;
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
  },
};
