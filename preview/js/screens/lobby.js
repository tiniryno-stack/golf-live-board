// lobby.js (screen) — handoff 025, the player side of a Team Ryder Cup round before scoring opens: the handicap
// invite, the Add to Home Screen steps (guide), the landing (1), Which one are you? (2 / 2b), the reveal, the lobby by
// stage (4–8, 14), called off, spot given to a sub (10) and Scoring is open (13). The view comes from app.lobbyView() (pure js/lobby.js); this file only draws it.
// Words: players never see "lobby" or "tee time": Coming up, start time, Open.

import { esc, icon, syncMotion } from '../ui.js';
import * as db from '../db.js';
import { notSafari, byHandicap, guideEscape, GUIDE_ESCAPE_MS, joinList, myLobby, myCart, dayName, shortDate, hostLine, clock12, wallClock, hasHandicaps, hcpOf, holdStep, revealPhase, landsAt, finalFades, strokesLine, rankLabel, fieldTicks, inviteFaces, inviteDate, ownRoundName, HOLD_MS, TAP_MS, FREEZE_MS, LAND_MS } from '../lobby.js';
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

/** The captains' matchup draft, while it's running: one row to watch the board fill in (owner, Nov 7). */
function mdCard(app) {
  const md = app.event.settings?.matchupDraft;
  if (!md || md.done) return '';
  return `<div class="card lb-card lb-rows">${row('Matchup draft · live', `${(md.picks || []).length} of 12 matches picked`, { act: 'lb-md', chev: true, cls: 'you' })}</div>`;
}

function whoPlaying(app, st, { all = false } = {}) {
  // Lowest handicap first (owner, Nov 6); joinList is A–Z, so ties stay A–Z.
  const meFirst = byHandicap(app.event.roster, joinList(app.event.roster, app.claimed, '', app.me));
  const ps = meFirst;
  const c = counts(app);
  const missing = c ? Math.max(0, c.total - c.in_app) : null;
  const shown = all ? ps.length : 4; // the day-of "drafting" screen lists everyone (owner, Nov 7)
  const more = ps.length - shown;
  const hcp = hasHandicaps(app.event.roster) || (app.event.roster?.players || []).some((p) => hcpOf(app.event.roster, p.id));
  const right = (id) => { const h = hcpOf(app.event.roster, id); return h ? { text: h.strokes, mono: true } : ''; };
  const tag = (id) => (id === app.me ? 'you' : id === st.hostId ? 'organizer' : '');
  const rows = meFirst.slice(0, shown).map((p) => row(esc(p.name), tag(p.id), { cls: p.id === app.me ? 'you' : '', right: right(p.id) })).join('');
  return `<div class="lbl lb-k">Who’s playing${hcp ? ' · handicap' : ''}</div>
    <div class="card lb-card lb-rows">${rows}${more > 0 ? row(`${more} more${missing ? ` · ${missing} haven’t added Golf Board` : ''}`, '', { act: 'lb-all', chev: true, cls: 'muted' }) : ''}</div>`;
}

const comingUp = (st) => `<div class="lbl lb-k">Coming up</div>
  <div class="card lb-card lb-rows">${row('Teams', `After ${esc(st.hostName)}’s draft`)}${row('Your start time and matches', 'After the draft')}</div>`;

/**
 * 026 · the invitation (SPEC 026 §1): who invited you, the round's name big, what and where, the real date and start,
 * who's in (faces from claimed_players: no names, no green), then one line, the primary and a quiet way out. A round
 * with no name of its own (Setup's "Course · date") shows the course big instead and doesn't say it twice (owner).
 * The plain landing uses the same layout with its own primary.
 */
function invitation(app, st, { lineText, primary, quiet }) {
  const ev = app.event;
  const host = st.hostName && st.hostName !== 'The organizer' ? st.hostName : '';
  const course = ev.course?.shortName || ev.course?.name || '';
  const own = ownRoundName(ev);
  const big = own || course || 'Team Ryder Cup';
  const what = ['Team Ryder Cup', own ? course : ''].filter(Boolean).join(' · ');
  const when = st.date ? [inviteDate(st.date), st.startLabel ? `${st.startLabel} start` : ''].filter(Boolean).join(' · ') : '';
  const f = inviteFaces(ev.roster, app.claimed);
  return `<div class="lb-inv">
    <div class="lb-inv-who">${host ? `<span class="lb-av" aria-hidden="true">${esc(host.charAt(0).toUpperCase())}</span><span><b>${esc(host)}</b> invited you</span>` : '<span>You’re invited</span>'}</div>
    <h1 class="lb-inv-name">${esc(big)}</h1>
    <div class="lbl lb-inv-what">${esc(what)}</div>
    ${when ? `<div class="mono lb-inv-when">${esc(when)}</div>` : ''}
    <div class="lbl lb-inv-k">${f.in} of ${f.total} are in</div>
    <div class="lb-faces" role="img" aria-label="${f.in} of ${f.total} players have joined">${f.faces.map((x) => `<span class="lb-face${x.in ? '' : ' out'}">${esc(x.initial)}</span>`).join('')}</div>
    ${noticeCard(st)}
  </div>
  ${foot(`${lineText ? note(lineText) : ''}${primary}${quiet}`)}`;
}

/** 1 · the lobby landing for a plain link (no handicaps yet): the invitation, Add Golf Board first on iPhone. */
function landing(app, st) {
  const ios = safariPhone();
  return invitation(app, st, {
    lineText: ios ? 'Your team and start time open in Golf Board on your home screen. About a minute.' : '',
    primary: ios ? '<button class="btn primary nr-cta" data-act="lb-guide">Add Golf Board to my home screen</button>' : '<button class="btn primary nr-cta" data-act="lb-find">Find my name</button>',
    quiet: ios ? '<button class="lb-tiny" data-act="lb-find">or join in Safari</button>' : '<button class="lb-just block" data-act="lb-follow">Not playing? Follow along</button>',
  });
}

/** The handicap invite (#/e/CODE/hcp, every player has a handicap). */
function invite(app, st) {
  const ios = safariPhone();
  return invitation(app, st, {
    lineText: ios ? 'Your handicap opens in Golf Board on your home screen. About a minute.' : '',
    primary: `<button class="btn primary nr-cta" data-act="${ios ? 'lb-guide' : 'lb-find'}">Reveal my handicap</button>`,
    quiet: '<button class="lb-just block" data-act="lb-follow">Not playing? Follow along</button>',
  });
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

/**
 * 026 · the reveal: press and hold (SPEC 026 §2). State lives in app.ui.reveal ({ code, pid, v, holding, downAt,
 * doneAt, fast, shownAt, replay }); every draw is made from it and the clock (revealPhase), and mount() runs the frames
 * in between, so a redraw never restarts or drops a hold (the content isn't even redrawn while a finger is down).
 */
const RING = 741; // 2π × 118
function revealState(app) {
  const r = app.ui.reveal;
  return r?.code === app.code && r.pid === app.me ? r : null;
}
function reveal(app, st) {
  const h = hcpOf(app.event.roster, app.me);
  if (!h) return early(app, st); // (lobbyView already leaves the reveal when there's no handicap)
  const r = revealState(app) || { v: 0, holding: false, shownAt: Date.now() };
  const rm = reduced();
  const phase = revealPhase(r, Date.now(), rm);
  const host = st.hostName && st.hostName !== 'The organizer' ? st.hostName : 'Your organizer';
  const kicker = `${esc(ownRoundName(app.event) || app.event.course?.shortName || app.event.name)} · ${esc(first(app.myPlayer()))}`;
  const done = phase === 'burst' || phase === 'final';
  if (!done) {
    const v = phase === 'freeze' ? 1 : r.v || 0;
    const disc = rm
      ? `<div class="lb-disc still"><span class="lb-q small">Tap to reveal</span></div><button class="btn block lb-rv-btn" data-act="lb-rv-now">Reveal</button>`
      : `<button class="lb-disc${!r.holding && phase === 'idle' && !(r.v > 0) ? ' breathe' : ''}${r.holding && v > 0.35 ? ' shake' : ''}" id="lbr-disc" data-t0="${r.shownAt || Date.now()}" aria-label="Reveal your handicap">
          <svg viewBox="0 0 240 240" aria-hidden="true"><circle id="lbr-ring" cx="120" cy="120" r="118" fill="none" stroke="var(--cart-you)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${RING}" stroke-dashoffset="${RING * (1 - v)}" transform="rotate(-90 120 120)" style="opacity:${v > 0.01 ? 1 : 0}"/></svg>
          <span class="lb-q" aria-hidden="true">?</span></button>
        <p class="lb-hold${phase === 'idle' && !r.holding && !r.touched ? ' cue' : ''}" id="lbr-l" data-t0="${r.shownAt || Date.now()}" style="${phase === 'freeze' ? 'opacity:0' : ''}">${r.holding || r.nudged ? 'Keep holding' : 'Press and hold'}</p>
        <button class="lb-just" data-act="lb-rv-now" id="lbr-j" style="${r.holding || phase === 'freeze' ? 'opacity:0;pointer-events:none' : ''}">Just show me</button>`;
    return `<div class="lb-rv">
      <div class="nr-head"><div class="nr-k"><span class="lbl">${kicker}</span></div>
        <h1 class="nr-title" id="lbr-t" style="opacity:${r.holding ? 1 - v * 0.6 : 1}">${esc(host)} set your handicap</h1></div>
      <div class="lb-stage">${disc}</div></div>`;
  }
  const t = fieldTicks(app.event.roster, app.me);
  const fades = phase === 'final' ? finalFades(Date.now() - landsAt(r) - LAND_MS, rm) : [0, 0, 0, 0];
  const op = (i) => `style="opacity:${fades[i]}"`;
  const line = strokesLine(h.strokes);
  const lands = landsAt(r);
  return `<div class="lb-rv">
    <div class="nr-head"><div class="nr-k"><span class="lbl you">${kicker}</span></div><h1 class="nr-title" tabindex="-1" aria-describedby="lbr-num">${esc(host)} has you at</h1></div>
    <div class="lb-stage">
      <div class="lb-disc done">${rm ? '' : `<svg viewBox="0 0 240 240" aria-hidden="true"><circle class="lb-ringout" data-t0="${lands}" cx="120" cy="120" r="118" fill="none" stroke="var(--cart-you)" stroke-width="4"/></svg>`}<span class="lb-num mono${rm ? '' : ' land'}" id="lbr-num" data-t0="${lands}">${esc(h.strokes)}</span>${rm ? '' : `<span class="lb-burst" data-t0="${lands}" aria-hidden="true"></span>`}</div>
      ${line ? `<p class="lb-strokes" id="lbr-f0" ${op(0)}>${esc(line)}</p>` : ''}
    </div>
    ${t.ticks.length > 1 ? `<div class="lb-field" id="lbr-f1" ${op(1)} role="img" aria-label="${esc(rankLabel(h))}, the field runs ${t.min} to ${t.max}">
      <span class="lb-field-me mono" style="${t.mine < 20 ? 'left:0;transform:none' : t.mine > 80 ? 'left:auto;right:0;transform:none' : `left:${t.mine}%`}">${esc(rankLabel(h))}</span>
      <div class="lb-rail"></div>${t.ticks.map((x) => `<i class="${x.me ? 'me' : ''}" style="left:${x.pct}%"></i>`).join('')}
      <div class="lb-ends mono"><span>${t.min}</span><span>${t.max}</span></div></div>` : ''}
    <p class="meta lb-off" id="lbr-f2" ${op(2)}>Think it’s off? Text ${esc(host)}.</p>
    ${foot(`<button class="btn primary nr-cta" data-act="lb-revealed" id="lbr-f3" ${op(3)}>See who you’re up against</button>`)}
  </div>`;
}
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/** Your handicap (4): text only, no button (owner, Nov 6). */
function hcpCard(app, st) {
  const h = hcpOf(app.event.roster, app.me);
  if (!h) return '';
  const again = app.me !== st.hostId; // never on the organizer's own phone: he set it
  return `<div class="card lb-card"><b class="lb-rt">Your handicap · <span class="mono">${esc(h.strokes)}</span></b>
    <span class="detail lb-wrap">${esc(st.hostName)} sets these. Think it’s off? Text ${esc(st.hostName)}.</span>
    ${again ? '<button class="link-btn lb-again" data-act="lb-rv-again">See it again ›</button>' : ''}</div>`;
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
    ${mdCard(app)}
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
    ${mdCard(app)}
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
    ${mdCard(app)}
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
    ${mdCard(app)}
    ${hcpCard(app, st)}
    ${st.paired && myCart(app.event, app.me) ? cartCard(app) : ''}
    ${drafting ? whoPlaying(app, st, { all: true }) : ''}
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

/** The frames between draws: the ring, shake, title and label while held; then the phase changes (a draw each) and the
 *  final fades. Real elapsed time (rAF timestamps), so a slow frame never changes the 1.4 s. */
let revealRaf = 0, revealLast = 0, revealGen = 0;
let guideTimer = null;
function revealLoop(app) {
  cancelAnimationFrame(revealRaf);
  revealLast = 0;
  const gen = ++revealGen; // one loop at a time: an older one stops at its next frame
  let lastPhase = revealPhase(app.ui.reveal, Date.now(), reduced());
  const tick = (ts) => {
    const r = revealState(app);
    if (gen !== revealGen || !r || app.lobbyView() !== 'reveal') return; // superseded, or the screen moved on
    // Real elapsed time, but never more than 250 ms in one frame: a phone that slept mid-hold doesn't fill the ring.
    const dt = revealLast ? Math.min(250, ts - revealLast) : 16;
    revealLast = ts;
    const now = Date.now();
    if (!Number.isFinite(r.doneAt)) {
      r.v = holdStep(r.v, dt, r.holding);
      if (r.v >= 1) { r.v = 1; r.holding = false; r.doneAt = now; }
      const ring = document.getElementById('lbr-ring'), disc = document.getElementById('lbr-disc');
      if (ring) { ring.setAttribute('stroke-dashoffset', String(RING * (1 - r.v))); ring.style.opacity = r.v > 0.01 ? '1' : '0'; }
      disc?.classList.toggle('shake', r.holding && r.v > 0.35);
      disc?.classList.toggle('breathe', !r.holding && r.v === 0);
      if (r.holding) document.getElementById('lbr-l')?.classList.remove('cue');
      const t = document.getElementById('lbr-t'); if (t) t.style.opacity = String(r.holding ? 1 - r.v * 0.6 : 1);
      const j = document.getElementById('lbr-j'); if (j) { j.style.opacity = r.holding ? '0' : '1'; j.style.pointerEvents = r.holding ? 'none' : ''; }
      const l = document.getElementById('lbr-l'); if (l) l.textContent = r.holding || r.nudged ? 'Keep holding' : 'Press and hold';
    }
    const phase = revealPhase(r, now, reduced());
    if (phase !== lastPhase) { app.render({ force: true }); return; } // the redraw's mount starts the next loop
    if (phase === 'final') {
      const f = finalFades(now - landsAt(r) - LAND_MS, reduced());
      f.forEach((o, i) => { const el = document.getElementById(`lbr-f${i}`); if (el) el.style.opacity = String(o); });
      if (f[3] >= 1) return; // all in: nothing left to move
    }
    if (!Number.isFinite(r.doneAt) && !r.holding && r.v === 0) return; // drained back to idle
    revealRaf = requestAnimationFrame(tick);
  };
  revealRaf = requestAnimationFrame(tick);
}

/** Let go (pointer up, cancel or leaving the disc): drain; a quick tap nudges sideways (SPEC 026 §2, 03). */
function letGo(app, e) {
  const r = revealState(app);
  if (!r?.holding || (e?.pointerId != null && r.pointerId != null && e.pointerId !== r.pointerId)) return;
  r.holding = false;
  r.nudged = Date.now() - r.downAt < TAP_MS; // a quick tap says "Keep holding"; a longer early let-go, "Press and hold"
  app.render(); // anything held back while the finger was down (first, so the nudge runs on the disc that stays)
  if (r.nudged) setTimeout(() => app.render(), 650); // the redraw held back while the nudge played
  if (r.nudged) document.getElementById('lbr-disc')?.animate?.([{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 350, easing: 'ease' });
  revealLoop(app);
}
let letGoBound = null;

/** One live region for the whole app, outside #content, so a redraw never replaces it before VoiceOver reads it. */
function liveRegion() {
  let n = document.getElementById('lb-live');
  if (!n) { n = document.createElement('div'); n.id = 'lb-live'; n.className = 'lb-sr'; n.setAttribute('aria-live', 'polite'); document.body.appendChild(n); }
  return n;
}
function announce(text) {
  const n = liveRegion();
  n.textContent = '';
  setTimeout(() => { n.textContent = text; }, 50);
}

/** Just show me / Enter / Space / Reveal (reduced motion): straight to the burst, no freeze. */
function revealNow(app) {
  const r = revealState(app);
  if (!r || Number.isFinite(r.doneAt)) return;
  Object.assign(r, { v: 1, holding: false, doneAt: Date.now(), fast: true });
  app.render({ force: true });
}

export default {
  // Before you've joined (invite, landing, steps, the name list) the round's top bar only repeats what the screen says
  // ("Watching · Bridlewood · Sat Nov 7"): hide it. Once you're in, the name pill and ⋯ come back.
  hideTop(app) { return ['invite', 'landing', 'guide', 'who'].includes(app.lobbyView()); },
  // While a finger is on the disc, background redraws wait (the disc under the finger is never replaced).
  keepContent(app) { const r = revealState(app); return !!r?.holding || (!!r?.nudged && Date.now() - r.downAt < 600); }, // and while the nudge plays
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
    // Idle costs nothing (seen is written only when the number lands), so the disc can wait under a sheet.
    if (!revealState(app)) app.ui.reveal = { code: app.code, pid: app.me, v: 0, holding: false, shownAt: Date.now() };
    const r = app.ui.reveal;
    liveRegion(); // empty, before the number lands: iOS reads a region's first change only if it already existed
    syncMotion(root); // the burst, the landing and the cue keep their place through a redraw
    const phase = revealPhase(r, Date.now(), reduced());
    if ((phase === 'burst' || phase === 'final') && !r.announced) {
      r.announced = true;
      const h = hcpOf(app.event.roster, app.me), st = app.lobby();
      // Just show me / Enter: focus moves to the title, which reads the number with it (aria-describedby), so no second
      // announcement. A hold: the live region says it.
      if (r.fast) root.querySelector('.lb-rv .nr-title')?.focus({ preventScroll: true });
      else announce(`${st?.hostName && st.hostName !== 'The organizer' ? st.hostName : 'Your organizer'} has you at ${h?.strokes ?? ''}`);
    }
    // The final frame's redraw replaces the focused title: put focus back on the new one.
    if (r.fast && (phase === 'burst' || phase === 'final') && (!document.activeElement || document.activeElement === document.body)) root.querySelector('.lb-rv .nr-title')?.focus({ preventScroll: true });
    if ((phase === 'burst' || phase === 'final') && !r.replay && !r.marked) { r.marked = true; app.markHcpSeen(); }
    if (Number.isFinite(r.doneAt) && phase !== 'final') revealLoop(app);
    else if (phase === 'final' && finalFades(Date.now() - landsAt(r) - LAND_MS, reduced())[3] < 1) revealLoop(app);
    if (!letGoBound) {
      letGoBound = (e) => letGo(app, e);
      window.addEventListener('pointerup', letGoBound);
      window.addEventListener('pointercancel', letGoBound);
      window.addEventListener('blur', letGoBound);
      document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(app); });
    }
    const disc = root.querySelector('#lbr-disc');
    if (!disc) return;
    disc.addEventListener('contextmenu', (e) => e.preventDefault());
    disc.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const s2 = revealState(app);
      if (!s2 || Number.isFinite(s2.doneAt) || s2.holding || e.isPrimary === false) return; // a second finger changes nothing
      Object.assign(s2, { holding: true, touched: true, downAt: Date.now(), pointerId: e.pointerId }); // touched: no more cue
      revealLoop(app);
    });
    disc.addEventListener('pointerleave', (e) => letGo(app, e));
    disc.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      revealNow(app);
    });
    disc.addEventListener('click', (e) => {
      e.preventDefault(); // a finger's tap is a press, never a reveal…
      if (e.detail === 0) revealNow(app); // …but VoiceOver's double-tap (a click with no touch behind it) reveals
    });
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
    'lb-rv-now': (el, ev, app) => revealNow(app),
    'lb-rv-again': (el, ev, app) => {
      // Replays the whole screen from idle; seen doesn't change.
      app.ui.reveal = { code: app.code, pid: app.me, v: 0, holding: false, shownAt: Date.now(), replay: true };
      app.render();
      document.getElementById('content').scrollTop = 0;
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
    'lb-md': (el, ev, app) => app.openSheet('lobby-md', {}),
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
