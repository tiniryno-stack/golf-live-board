// home.js — 039 Home is the wallet (docs/design/features/039-home-deck/SPEC.md; PLAN.md §4 set A for the headline):
// the top bar, the nudge strip, one plain headline, then the wallet (the next round as the front card A3, then the
// newest sealed pack, then your cards newest first; zero cards = the paper member card) and its "N of M" line. No crew
// row, doors row or pinned buttons: the dock (Home · Rounds · Crew + the +) has them (app.js renderTabbar).
// What to draw comes from the pure js/homeview.js (every word in its COPY / WORDS); this file turns it into markup and
// runs the wallet's physics in mount (ported from prototype-v7: setupWallet, pose, bindWallet, animateTo, tapCard,
// dealIn). The wallet's position, flip and motion live in this module, so the render loop's redraws keep them.

import { gameName, playFor } from '../playfor.js';
import { esc, icon, prettyDate, initials, reducedMotion, copyText } from '../ui.js';
import { recent, normCode, STANDALONE, moveLink, syncMyRounds, pruneGoneRounds, local, refreshLobbies, owner, clock } from '../db.js';
import { lobbyState, homeCard, teeSheet } from '../lobby.js';
import { matchState } from '../riderview.js';
import { homeCrewData, crewNames } from './crew.js';
import { homeLockerData, homeLockerState, startHomeLocker, lockerName, frontHtml, backHtml, lockerPerson, MARK, EDGE as CARD_EDGE } from './locker.js';
import { chromePack } from './pack.js';
import { homeModel, topKey, walletFit, poseOne, rubber, settleTo, STEP, WORDS } from '../homeview.js';
import { shortDay } from '../locker.js';
import { whatsNew } from '../whatsnew.js';
import { fmtPts, fmtToPar, playerLeaderboard } from '../scoring.js';

/** iPhone or iPad in Safari (iPadOS says it's a Mac, but has touch). Tests set `__GLB_IOS`. */
/** Preview copy only (…/preview/): Home acts as the locker's preview person, so a browser with no rounds still fills in. */
const PREVIEW = typeof location !== 'undefined' && /\/preview\//.test(location.pathname);
const isIOS = () => {
  if (typeof globalThis.__GLB_IOS === 'boolean') return globalThis.__GLB_IOS;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

let draftCode = '';

/** The game's name, the way Home says it (031 §2.3 names; stored game ids don't change). */
const gameLabel = (snap) => gameName(snap);

/**
 * What Home shows for a round, from this phone's point of view (kept in glb.recent by app.js):
 * { myName, game, done, live: { hole, line, points }, result: { line, value } }.
 */
export function roundSummary(app) {
  const snap = app.snapshot;
  if (!snap) return null;
  // 025: a Team Ryder Cup lobby before scoring opens: Home's Coming up card, and which player this phone was
  // (lobbyPid stays when the spot goes to a sub, so Home can say so).
  const lst = app.event ? lobbyState(app.event, app.now ? app.now() : Date.now()) : null;
  if (lst && !lst.open) {
    const o = owner.get();
    const me = app.myPlayer();
    const card = homeCard(app.event, { pid: app.me || recent.all().find((r) => r.code === app.code)?.lobbyPid || null, personId: o?.personId || me?.personId || null }, app.now ? app.now() : Date.now());
    return { game: gameLabel(snap), myName: me ? me.firstName || me.name : null, done: false, ...(card ? { lobby: card } : {}), ...(app.me ? { lobbyPid: app.me } : {}) };
  }
  const me = app.myPlayer();
  const out = { game: gameLabel(snap), myName: me ? me.firstName || me.name : null, done: !!(snap.roundComplete || app.isFinal()) };
  if (!me) return out;
  const g = snap.game;
  if (!snap.anyPosted && !out.done) {
    // Nobody has a score yet: no places, no zeros.
    const t = g && !snap.settings.solo && !snap.settings.pairs ? snap.teamById.get(app.myTeam())?.name : '';
    out.live = { hole: app.nextHole(), line: t || '', points: '', card: liveCard(app, snap, me) };
    return out;
  }
  let rank = null, line = '', value = '', points = '';
  if (g && snap.settings.pairs && g.people) {
    const r = g.people.find((x) => x.playerId === me.id);
    if (r) { rank = r.rank; value = fmtPts(r.points); points = value; }
    line = rank ? `${ordinal(rank)}` : '';
  } else if (g && g.sides) {
    const s = g.sides.find((x) => x.teamIds.includes(app.myTeam())) || g.sides[0];
    const o = g.sides.find((x) => x !== s);
    rank = s.rank;
    points = `${fmtPts(s.points)}–${fmtPts(o.points)}`;
    value = points;
    line = `${s.name} · ${s.points > o.points ? 'up' : s.points < o.points ? 'down' : 'all square'}${s.points !== o.points ? ` ${fmtPts(Math.abs(s.points - o.points))}` : ''}`;
    if (out.done) {
      out.result = { line: s.points > o.points ? 'Won the cup' : s.points < o.points ? 'Lost the cup' : 'Shared the cup', value };
      return out;
    }
  } else if (g) {
    const mine = app.myTeam();
    const st = g.liveStandings;
    const s = st.find((x) => x.teamId === mine);
    if (s) {
      rank = s.rank;
      points = fmtPts(s.points);
      value = points;
      const lead = st[0].points;
      const next = st.find((x) => x.rank > s.rank)?.points;
      const gap = rank === 1 ? (next != null ? s.points - next : 0) : lead - s.points;
      line = `${snap.settings.solo ? '' : `${snap.teamById.get(mine)?.name || ''} · `}${ordinal(rank)}${gap ? ` · ${rank === 1 ? `up ${fmtPts(gap)}` : `${fmtPts(gap)} back`}` : ''}`;
    }
  } else {
    const mode = snap.hasStrokes ? 'net' : 'gross';
    const list = playerLeaderboard(snap, mode);
    const i = list.findIndex((p) => p.id === me.id);
    rank = i >= 0 ? i + 1 : null;
    value = me.thru ? fmtToPar(mode === 'net' ? me.netToPar : me.grossToPar) : '';
    line = rank ? `${ordinal(rank)}${value ? ` · ${value}` : ''}` : '';
  }
  if (out.done) {
    let res = rank ? `You ${ordinal(rank)}` : '';
    if (rank === 1 && g && !snap.settings.solo && !snap.settings.pairs) {
      const mate = snap.teamById.get(app.myTeam())?.playerIds.filter((id) => id !== me.id).map((id) => snap.playerById.get(id)?.name)[0];
      res = mate ? `Won with ${mate}` : 'Won';
    }
    if (!g && rank && me.thru) res += snap.hasStrokes ? ` · net ${me.netTotal}` : ` · ${me.grossTotal}`;
    out.result = { line: res, value };
  } else {
    out.live = { hole: app.nextHole(), line, points, card: liveCard(app, snap, me, rank) };
  }
  return out;
}


/** 039 §2 · the live next-round card's facts, from this phone's seat: { pk, thru, match, place, players, mate, sheet }. */
function liveCard(app, snap, me, rank = null) {
  const out = { pk: null, thru: me?.thru ?? null, match: null, place: rank ? ordinal(rank) : null, players: snap.players.length, mate: null, sheet: null };
  try { out.pk = playFor(snap); } catch { /* an old shape */ }
  const team = app.myTeam?.();
  const t = team ? snap.teamById.get(team) : null;
  const mateId = t?.playerIds?.find((id) => id !== me?.id);
  if (mateId) out.mate = snap.playerById.get(mateId)?.firstName || snap.playerById.get(mateId)?.name?.split(' ')[0] || null;
  const g = snap.game;
  try {
    if (g?.sides) {
      const s = g.sides.find((x) => x.teamIds.includes(team)) || g.sides[0];
      const o = g.sides.find((x) => x !== s);
      out.match = `${fmtPts(s.points)}–${fmtPts(o.points)}`;
    } else {
      const ms = matchState(snap, me?.id);
      const m = ms?.matches.find((x) => x.status === 'live' && ms.mine.has(x.us.id)) || ms?.matches.find((x) => ms.mine.has(x.us.id) && x.status !== 'done');
      if (m) out.match = m.status === 'notStarted' ? 'Not yet' : m.leader === 'us' ? `Up ${m.margin}` : m.leader === 'them' ? `Down ${m.margin}` : 'All square';
    }
  } catch { /* the match line is a nice-to-have */ }
  try { out.sheet = teeSheet(app.event, me?.id || null); } catch { out.sheet = null; }
  return out;
}

/** Home's top bar, left side: your name (Nov 24: a button → who this phone is, with a one-tap fix). The owner's name first. */
function header(rounds) {
  const name = owner.get()?.name || (owner.get() ? '' : rounds.find((r) => r.myName)?.myName) || lockerName();
  if (!name) {
    return rounds.length ? '<button class="home-me" data-act="home-me"><span class="hm-name">Who are you?</span></button>' : '<div class="spacer"></div>';
  }
  // 036 §4.3: the avatar opens your passport. Nov 24 (returning players): your name opens who this phone is, with a fix.
  return `<div class="home-me"><button class="avatar" data-act="go" data-v="#/passport" aria-label="Your passport">${esc(initials(name))}</button>
    <button class="hm-name" data-act="home-me" aria-label="You’re ${esc(name)}. Not you?">${esc(name)}</button></div>`;
}

/** 037 v2 §4.2 · the nudge strip: text (the whole strip taps) + ✕. */
function nudgeHtml(n) {
  if (!n) return '';
  const body = n.kind === 'add'
    ? `<button class="hm-ng" data-act="home-add"><span class="ellipsis">${esc(WORDS.addNudge)}</span></button>`
    : `<button class="hm-ng" data-act="home-news-open" data-v="${esc(n.id)}" aria-label="What’s new: ${esc(n.title)}"><span class="ellipsis"><b>New</b> · <span class="hm-ngt">${esc(n.title)}</span></span></button>`;
  return `<div class="hm-nudge" role="status">${body}
      <button class="icon-btn hm-ngx" data-act="home-nudge-x" data-v="${n.kind === 'add' ? 'add' : `news:${esc(n.id)}`}" aria-label="Dismiss">${icon('close', 20)}</button></div>`;
}

/** PLAN §4 set A · kicker + one plain sentence (all --text). */
function headlineHtml(h) {
  const tap = h.tap ? ` data-act="go" data-v="${esc(h.tap)}" role="button" tabindex="0"` : '';
  return `<div class="hm-hl${h.tap ? ' tap' : ''}"${tap}><span class="ts-label hm-k ellipsis">${esc(h.kicker)}</span>
      <h2 class="ts-title hm-h">${esc(h.text)}</h2></div>`;
}

// ───────────────────────────────────────────── the wallet's faces (SPEC §1–§2)

/** SPEC §2 · card A3 (prototype `tixHybrid`): mark + NEXT ROUND · stamp, the tee time huge, course, Game · Cart · With + Open / share. */
function nextFront(n) {
  const stamp = n.stamp ? `<span class="lk-st${n.live ? ' t-live' : ''}">${n.live ? '<i></i>' : ''}${esc(n.stamp)}</span>` : '';
  const btn = `<button class="t-b pri" data-act="${n.btn.act}" data-v="${esc(n.btn.v)}"${n.btn.act === 'home-text' ? ` data-r="${esc(n.aria)}"` : ''}>${esc(n.btn.label)}</button>`;
  const share = n.share ? `<button class="t-b ic" data-act="home-share" data-v="${esc(n.code)}" data-r="${esc(n.aria)}" aria-label="Share the round link">${icon('share', 16)}</button>` : '';
  return `<div class="lk-mat tk7 thy"><i class="lk-sheen"></i><div class="tc-in">
      <div class="x-top"><span class="lk-brand">${MARK}${esc(n.kicker)}</span>${stamp}</div>
      <div class="t-hero"><span class="t-big">${esc(n.big)}</span><span class="t-dd"><b>${esc(n.dd[0] || '')}</b><span>${esc(n.dd[1] || '')}</span></span></div>
      <div class="t-course">${esc(n.course)}</div>
      <div class="thy-bot"><div class="thy-f">${n.fields.map(([k, v]) => `<div><span class="tp-k">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="tc-b">${btn}${share}</div></div></div></div>`;
}

/** SPEC §2 · the back: the tee sheet (every tee time, its carts or names; your row bold), how the game works, Host · Players · Code. */
function nextBack(n) {
  const sh = n.sheet || { groups: [] };
  const groups = (sh.groups || []).map((g) => `<div class="t-g"><div class="cb-k">${esc([g.time, g.label].filter(Boolean).join(' · '))}</div>${g.rows
    .map((r) => `<div class="cb-pl${r.me ? ' me' : ''}">${r.id ? `<i>${esc(r.id)}</i>` : ''}<span>${esc(r.names)}${r.me && !r.id ? ' (you)' : ''}</span></div>`).join('')}</div>`).join('');
  const kv = [['Host', sh.host], ['Players', sh.players != null ? String(sh.players) : ''], ['Code', sh.code || n.code]].filter(([, v]) => v);
  return `<div class="lk-mat tk7 back"><i class="lk-sheen"></i><div class="cb">
      <div class="cb-col${sh.small ? ' cb-sm' : ''}"><div class="cb-k">Tee sheet${sh.date ? ` · ${esc(sh.date)}` : ''}</div>${groups || '<div class="cb-line">Tee times come from the host.</div>'}${sh.more ? `<div class="cb-k cb-after">+ ${sh.more} more</div>` : ''}</div>
      <div class="cb-col sb"><div><div class="cb-k">The game</div><div class="cb-line">${esc(sh.how || 'Your host sets the game.')}</div></div>
        <div class="t-kv">${kv.map(([k, v]) => `<div><span class="cb-k">${k}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
    </div></div>`;
}

/** The plain card face (036 grid, lkf-rookie paper): member / loading box / offline box. */
function plainHtml(it) {
  const face = (inner) => `<div class="lk-mini lkf-rookie wf hm-plain"${it.kind === 'loading' ? ' aria-hidden="true"' : ''}><span class="lk-face lk-front"><div class="lk-mat">${inner}</div></span></div>`;
  if (it.kind === 'loading') return face('');
  if (it.kind === 'offline') return face(`<div class="hm-pmsg ts-small">${esc(WORDS.offline)}</div>`);
  return face(`<div class="x-l1"><div class="x-top"><span class="lk-brand">${MARK}${esc(WORDS.member)}</span></div>
      <b class="ts-title hm-pname ellipsis">${esc(it.name)}</b>
      <div class="x-bot"><span class="ellipsis">${esc(it.crew || '')}</span><span>${esc(it.line)}</span></div></div>`);
}

const flipCls = (it) => (W.flipped && W.flipped === it.key ? ' on' : '');

/** The front face of one wallet item. */
function faceHtml(it) {
  if (it.kind === 'next') {
    return `<div class="lk-slot x-land wf tix tv-hybrid${it.n.live ? ' tix-live' : ''}${it.n.off ? ' tix-off' : ''}"><div class="lk-tilt" aria-label="${esc(it.n.aria)}. Tap to flip it for the tee sheet."><div class="lk-flip${flipCls(it)}">
        <div class="lk-face lk-front">${nextFront(it.n)}</div><div class="lk-face lk-back">${nextBack(it.n)}</div></div></div></div>`;
  }
  if (it.kind === 'card') {
    const c = it.card;
    return `<div class="lk-slot x-land lkf-${esc(c.fin)} wf"><div class="lk-tilt" aria-label="${esc(`${c.course}, ${shortDay(c.day)}, ${c.gross}`)}. Tap to flip it."><div class="lk-flip${flipCls(it)}">${CARD_EDGE}
        <div class="lk-face lk-front">${frontHtml(c, { crewLine: it.crewLine })}</div><div class="lk-face lk-back">${backHtml(c, { board: true })}</div></div></div></div>`;
  }
  if (it.kind === 'pack') {
    return `<div class="wpk" aria-label="Open your scorecard pack: ${esc(it.card.course)}, ${esc(prettyDate(it.card.day))}"><div class="lk-ptile">${chromePack()}${it.count > 1 ? `<b class="lk-pip">${it.count}</b>` : ''}</div></div>`;
  }
  return plainHtml(it);
}

const MS = ['prismatic', 'gold', 'silver', 'bronze'];
/** SPEC §1 · the flat finish plate a card behind the front shows: its finish over the whole card, course · date · score. */
function plateHtml(it) {
  const el = (a, b) => `<span class="el"><span class="ts-label">${esc(a)}</span><span class="ts-label fn">${esc(b)}</span></span>`;
  if (it.kind === 'card') {
    const c = it.card;
    return `<span class="wel lkf-${esc(c.fin)}" aria-hidden="true"><span class="lk-mat"><i class="lk-sheen"></i>${c.fin === 'prismatic' ? '<i class="x-slick"></i>' : MS.includes(c.fin) ? '<i class="x-mslick"></i>' : ''}</span>${el(c.course, `${shortDay(c.day)} · ${c.gross}`)}</span>`;
  }
  if (it.kind === 'pack') return `<span class="wel pk" aria-hidden="true">${el(`${it.count} ${it.count === 1 ? 'card' : 'cards'} to open`, 'Series 1')}</span>`;
  if (it.kind === 'next') {
    const n = it.n;
    return `<span class="wel tv-hybrid" aria-hidden="true"><span class="lk-mat"></span>${el(n.live ? `Live · ${n.stamp}` : `${n.dd[0]} ${n.big} · ${n.course}`.trim(), n.stamp || WORDS.nextRound)}</span>`;
  }
  return `<span class="wel lkf-rookie" aria-hidden="true"><span class="lk-mat"></span>${el(it.kind === 'member' ? WORDS.member : '', '')}</span>`;
}

function walletHtml(items) {
  if (!items.length) return '';
  return `<div class="hm-wallet wl" data-n="${items.length}" aria-label="Your wallet: the next round in front, your cards behind. Drag down to go back; tap a card to flip it.">${items
    .map((it, i) => `<div class="wc" data-i="${i}" data-key="${esc(it.key)}"><div class="wci">${faceHtml(it)}${plateHtml(it)}</div></div>`).join('')}</div>
    <div class="wct"><span class="ts-label n"></span></div>`;
}

function codeField() {
  return `<label class="tf-label" for="join-code">Got a code from a friend?</label>
    <div class="join-row">
      <input class="input code" id="join-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"
        placeholder="e.g. TC482" aria-label="Join code" value="${esc(draftCode)}" data-input="home-code" data-enter="home-join">
      <button class="btn" data-act="home-join">Join</button>
    </div>`;
}

// ───────────────────────────────────────────── the wallet's physics (prototype-v7, ported)

// One wallet on screen at a time. Its state outlives the DOM (the render loop redraws Home): the position `p`
// (0 = the front item), which item is in front (by key, so a new item at the front moves you with it), the flipped
// item, and the motion in flight. keepContent() holds redraws while a finger is down or the wallet is moving.
const W = { p: 0, frontKey: null, flipped: null, raf: 0, until: 0, held: false, keys: [], dealtKey: undefined, justDragged: 0, el: null };
let wapp = null;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function geo(wl) {
  const n = wl.querySelectorAll('.wc').length;
  const home = wl.closest('.home');
  wl.style.height = '';
  wl.classList.remove('sized');
  const Wc = wl.clientWidth, spare = wl.clientHeight;
  const f = walletFit(Wc, spare, n, { app: STANDALONE });
  // SPEC §1: the wallet is only as tall as it needs; spare height goes to the bottom, never above the cards.
  wl.classList.add('sized');
  wl.style.height = `${f.need}px`;
  home?.style.setProperty('--wl-h', `${f.need}px`);
  return { n, Wc, Hc: f.need, K: f.K, CW: f.CW, CH: f.CH, x0: (Wc - f.CW) / 2, yF: f.need - 16 - f.CH };
}

function pose() {
  const wl = W.el;
  if (!wl?.isConnected) return;
  const g = W.g;
  wl.querySelectorAll('.wc').forEach((el) => {
    const d = Number(el.dataset.i) - W.p;
    const q = poseOne(d, g);
    el.style.width = `${g.CW}px`; el.style.height = `${g.CH}px`;
    el.style.transform = `translate(${g.x0.toFixed(1)}px,${q.y.toFixed(1)}px) scale(${q.s.toFixed(3)})`;
    el.style.opacity = q.o; el.style.zIndex = q.z; el.style.visibility = q.o < 0.01 ? 'hidden' : '';
    el.classList.toggle('front', Math.abs(d) < 0.5);
    const lb = el.querySelector('.wel'); if (lb) lb.style.opacity = q.lab;
  });
  const fi = Math.max(0, Math.min(g.n - 1, Math.round(W.p)));
  W.frontKey = W.keys[fi] || null;
  const ct = wl.nextElementSibling?.querySelector('.n');
  if (ct) ct.textContent = WORDS.count(fi + 1, g.n);
}

/** A redraw arrived while the wallet was held or moving: run it once that's over. */
let missTimer = 0;
function missed() {
  if (missTimer) return;
  const tryAgain = () => {
    missTimer = 0;
    if (!W.el?.isConnected) return;
    if (W.held || Date.now() < W.until) { missTimer = setTimeout(tryAgain, 120); return; }
    wapp?.render?.();
  };
  missTimer = setTimeout(tryAgain, Math.max(60, W.until - Date.now() + 20));
}

function unflip() {
  W.flipped = null;
  W.el?.querySelectorAll('.lk-flip.on').forEach((x) => x.classList.remove('on'));
}

function animateTo(target, dur = 380) {
  cancelAnimationFrame(W.raf);
  if (reducedMotion()) { W.p = target; pose(); W.until = 0; return; }
  const p0 = W.p, t0 = now();
  W.until = Date.now() + dur + 60;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    W.p = p0 + (target - p0) * e; pose();
    if (k < 1) W.raf = requestAnimationFrame(step);
    else { W.raf = 0; W.until = 0; }
  };
  W.raf = requestAnimationFrame(step);
}

function tapCard(el, ev) {
  if (!el) return;
  const i = Number(el.dataset.i), d = i - W.p, key = el.dataset.key;
  const kind = String(key || '').split(':')[0];
  if (Math.abs(d) < 0.5) {
    if (kind === 'card' || kind === 'next') {
      const fl = el.querySelector('.lk-flip');
      const on = !fl.classList.contains('on');
      fl.classList.toggle('on', on);
      W.flipped = on ? key : null;
    } else if (kind === 'pack') wapp?.actions?.['lk-home-packs']?.(el, ev, wapp);
    return;
  }
  unflip();
  animateTo(i, 300 + 60 * Math.abs(d));
}

function bindWallet(wl) {
  let g = null;
  wl.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    cancelAnimationFrame(W.raf); W.raf = 0; W.until = 0;
    W.held = true;
    g = { x: e.clientX, y: e.clientY, p0: W.p, moved: false, hist: [[now(), e.clientY]], id: e.pointerId };
  });
  wl.addEventListener('pointermove', (e) => {
    if (!g) return;
    const dy = e.clientY - g.y, dx = e.clientX - g.x;
    if (!g.moved) { if (Math.hypot(dx, dy) < 6) return; g.moved = true; try { wl.setPointerCapture(g.id); } catch { /* fine */ } unflip(); }
    g.hist.push([now(), e.clientY]); if (g.hist.length > 6) g.hist.shift();
    W.p = rubber(g.p0 + dy / STEP, W.g.n);
    pose();
  });
  const end = (e) => {
    if (!g) return;
    const G = g; g = null; W.held = false;
    if (!G.moved) { if (e.type === 'pointerup' && !e.target.closest('[data-act]')) tapCard(e.target.closest('.wc'), e); return; }
    W.justDragged = Date.now();
    const h = G.hist, a = h[0], b = h[h.length - 1], dt = Math.max(16, b[0] - a[0]);
    const vy = reducedMotion() ? 0 : (b[1] - a[1]) / dt;
    animateTo(settleTo(W.p, vy, W.g.n), 420);
  };
  wl.addEventListener('pointerup', end);
  wl.addEventListener('pointercancel', end);
  // A drag that ends on a button must not press it.
  wl.addEventListener('click', (e) => { if (Date.now() - W.justDragged < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
}

/** First open (and a new front item): the cards drop in, back to front (prototype dealIn). */
function dealIn(wl) {
  if (reducedMotion() || typeof Element === 'undefined' || !Element.prototype.animate) return;
  const wcs = [...wl.querySelectorAll('.wc')].filter((el) => el.style.visibility !== 'hidden').sort((a, b) => Number(a.style.zIndex) - Number(b.style.zIndex));
  W.until = Date.now() + 460 + wcs.length * 90 + 60;
  wcs.forEach((el, k) => el.querySelector('.wci').animate([{ transform: 'translate(-40px,-340px) rotate(-14deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 460, delay: k * 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
}

function mountWallet(content, app) {
  wapp = app;
  const wl = content.querySelector('.hm-wallet');
  if (!wl) { W.el = null; return; }
  W.keys = [...wl.querySelectorAll('.wc')].map((el) => el.dataset.key);
  // Keep the same item in front across redraws (a new next round slides in ahead of it, and you stay where you were).
  const at = W.frontKey ? W.keys.indexOf(W.frontKey) : -1;
  if (!W.raf) W.p = at >= 0 ? at : 0;
  else if (at < 0) W.p = Math.min(W.p, W.keys.length - 1);
  if (W.flipped && !W.keys.includes(W.flipped)) W.flipped = null;
  W.el = wl;
  W.g = geo(wl);
  pose();
  bindWallet(wl);
  const front = W.keys[0] || null;
  if (W.dealtKey !== front) {
    const first = W.dealtKey === undefined;
    W.dealtKey = front;
    local.set('glb.seen.homeTop', topKey({ key: front }));
    if (first || W.p === 0) dealIn(wl);
  }
}

// Nov 24: Home looks for your rounds every time it shows up again (not once per page load): a home screen app resumed
// from the background now finds the round its owner was just added to. At most once a minute; a return resets it.
let syncedAt = 0;
export function homeReturn() { syncedAt = 0; }

export default {
  topLeft: () => header(recent.all()),
  noscroll: true,
  // Coming back to Home: the wallet opens on its front item, face up.
  enter() { cancelAnimationFrame(W.raf); Object.assign(W, { p: 0, frontKey: null, flipped: null, raf: 0, until: 0, held: false }); },
  keepContent() {
    const held = !!W.el?.isConnected && (W.held || Date.now() < W.until);
    if (held) missed(); // a redraw waits for the finger / the motion, then runs once (never lost)
    return held;
  },

  render(app) {
    // Once per open: pull in your rounds this phone has never seen (new phone / home screen app).
    if (Date.now() - syncedAt > 60000) {
      syncedAt = Date.now();
      app.checkVersion?.(); // and a newer version, now that nothing is at stake (app.js decides)
      syncMyRounds(PREVIEW ? [lockerPerson()] : []).then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ });
      pruneGoneRounds().then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ }); // deleted rounds leave Recent
      refreshLobbies(clock.now()).then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ }); // 025
    }
    startHomeLocker(app); // 035: this phone's locker, once per page load. Any failure = Home still complete.
    const m = model(app);
    return `<div class="plain home hm39${STANDALONE ? ' hm-app' : ''}">
      ${nudgeHtml(m.nudge)}
      ${headlineHtml(m.headline)}
      ${m.join ? `<div class="hm-join">${codeField()}</div>` : walletHtml(m.items)}
    </div>`;
  },
  mount(content, app) {
    try { mountWallet(content, app); } catch (e) { console.warn('wallet', e); }
  },
  actions: {
    'home-code': (el) => {
      draftCode = normCode(el.value).slice(0, 5);
      if (el.value !== draftCode) el.value = draftCode;
    },
    'home-add': (el, ev, app) => {
      // Put this phone's keys in the link iPhone saves with the icon (see db.moveLink).
      history.replaceState(null, '', `${location.pathname}${location.search}${moveLink()}`);
      local.set('glb.hasApp', true); // 024 §6: 025 says "open Golf Board from your home screen"
      app.openSheet('homescreen', {});
    },
    // §4.2: What's new opens a small sheet on tap (never by itself); Got it / ✕ marks the release seen.
    'home-news-open': (el, ev, app) => app.openSheet('home-news', { id: el.dataset.v }),
    'home-news': (el, ev, app) => { local.set('glb.seen.whatsnew', el.dataset.v); app.closeSheet?.(); app.render(); },
    'home-nudge-x': (el, ev, app) => {
      const v = el.dataset.v || '';
      if (v.startsWith('news:')) local.set('glb.seen.whatsnew', v.slice(5));
      else local.set(`glb.seen.homeNudge.${v}`, true); // after its ✕, Add to Home Screen is a row at the top of Rounds
      app.render();
    },
    // SPEC §2: share on the next-round card: the round's link, the one the host already texts (nothing else).
    'home-share': async (el, ev, app) => {
      ev?.stopPropagation?.();
      const url = `${location.origin}${location.pathname}#/e/${el.dataset.v}`;
      const name = el.dataset.r || 'Our round';
      try {
        if (navigator.share) { await navigator.share({ title: name, text: `${name} on Golf Board`, url }); return; }
      } catch { return; /* share sheet dismissed */ }
      const copied = await copyText(url);
      app.toast({ title: copied ? 'Round link copied' : 'Round link', sub: copied ? 'Paste it in the group text.' : url });
    },
    'home-me': (el, ev, app) => { app.ui.homePeople = null; app.openSheet('home-me', {}); },
    'home-text': async (el, ev, app) => {
      ev?.stopPropagation?.();
      const text = `Hi ${el.dataset.v}, about ${el.dataset.r}: `;
      if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } return; }
      app.toast({ title: `Text ${el.dataset.v} from your messages`, sub: 'There’s no number in Golf Board.' });
    },
    'home-join': (el, ev, app) => {
      const code = normCode(document.getElementById('join-code')?.value || draftCode);
      if (code.length < 4) {
        app.toast({ title: 'Enter the 5-letter code', sub: 'It’s in the group text, like TC482.', error: true });
        return;
      }
      draftCode = '';
      document.activeElement?.blur?.();
      if (app.sheet) app.closeSheet();
      app.go(`#/e/${code}`);
    },
  },
};

/** Home's model for this render (also read by app.js for the live strip on every hub tab). */
export function model(app) {
  const rounds = recent.all();
  const lk = homeLockerData(app);
  const state = homeLockerState(app);
  if (lk?.cards?.length) local.set('glb.seen.homeCards', true); // "had cards" (moves with the move link)
  const firstRound = rounds.map((r) => r.played_on).filter(Boolean).sort()[0] || null;
  const w = whatsNew({ seen: local.get('glb.seen.whatsnew'), hasRounds: rounds.length > 0, firstRound });
  if (w.markSeen) local.set('glb.seen.whatsnew', w.markSeen);
  const o = owner.get();
  return homeModel({
    rounds, now: Date.now(), personId: lk?.personId || lockerPerson() || null, locker: lk, lockerState: state,
    hadCards: !!local.get('glb.seen.homeCards'),
    crews: homeCrewData(app), crewNames: crewNames(app), meName: (o?.name || '').split(' ')[0], meFull: o?.name || lockerName(),
    ios: isIOS(), standalone: STANDALONE,
    seen: { add: !!local.get('glb.seen.homeNudge.add') || !!local.get('glb.hasApp') }, news: w.show,
  });
}

export { codeField };
