// home.js — Home, 037 second pass "the wallet" (docs/design/features/037-home/PLAN-v2.md; its §0 wins): a nudge strip,
// the headline (kicker + one two-tone sentence), the stack (one front object — a pass, a pack, your latest card or the
// plain card — with edge strips behind it), the crew row (or Start a crew / the join field), the doors row, and the
// pinned foot (Join with code + New round, or the live bar). What to draw comes from the pure js/homeview.js (every
// word in its COPY / WORDS); this file turns it into markup, measures the fit in mount (headline form, edges, front
// width, doors) and plays the one deal (data-t0 + ui.syncMotion). #/rounds = All rounds.

import { gameName } from '../playfor.js';
import { esc, icon, prettyDate, initials, empty, syncMotion, reducedMotion, copyText } from '../ui.js';
import { recent, normCode, STANDALONE, moveLink, syncMyRounds, pruneGoneRounds, local, refreshLobbies, owner, clock } from '../db.js';
import { lobbyState, homeCard } from '../lobby.js';
import { homeCrewData, crewNames } from './crew.js';
import { homeLockerData, homeLockerState, startHomeLocker, lockerName, frontHtml, lockerPerson, MARK } from './locker.js';
import { chromePack } from './pack.js';
import { homeModel, allRounds, topKey, fitWidth, WORDS } from '../homeview.js';
import { finName } from '../locker.js';
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
    out.live = { hole: app.nextHole(), line: t || '', points: '' };
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
    out.live = { hole: app.nextHole(), line, points };
  }
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

const chev = (n = 20) => `<span class="hr-chev">${icon('fwd', n)}</span>`;

// ───────────────────────────────────────────── 037 v2 blocks (PLAN-v2 §4–§8; every word comes from homeview's COPY / WORDS)

/** §4.2 · the nudge strip: text (the whole strip taps) + ✕. */
function nudgeHtml(n) {
  if (!n) return '';
  const body = n.kind === 'add'
    ? `<button class="hm-ng" data-act="home-add"><span class="ellipsis">${esc(WORDS.addNudge)}</span></button>`
    : `<button class="hm-ng" data-act="home-news-open" data-v="${esc(n.id)}" aria-label="What’s new: ${esc(n.title)}"><span class="ellipsis"><b>New</b> · <span class="hm-ngt">${esc(n.title)}</span></span></button>`;
  return `<div class="hm-nudge" role="status">${body}
      <button class="icon-btn hm-ngx" data-act="home-nudge-x" data-v="${n.kind === 'add' ? 'add' : `news:${esc(n.id)}`}" aria-label="Dismiss">${icon('close', 20)}</button></div>`;
}

/** One headline form: the bright half (the fact) + the grey half (only qualifies it). */
const formHtml = (f) => `${esc(f.b)}${f.g ? `<span class="hm-g">${esc(f.g)}</span>` : ''}`;
/** §5 · kicker + sentence. mount() picks the first form that fits (two lines in the app, one in Safari). */
function headlineHtml(h) {
  const forms = [...h.app, ...h.safari];
  const tap = h.tap ? ` data-act="go" data-v="${esc(h.tap)}" role="button" tabindex="0"` : '';
  return `<div class="hm-hl${h.tap ? ' tap' : ''}"${tap}><span class="ts-label hm-k ellipsis">${esc(h.kicker)}</span>
      <h2 class="ts-title hm-h" data-forms="${esc(JSON.stringify(forms))}">${formHtml(forms[0])}</h2></div>`;
}

/** The plain card face (036 grid, lkf-rookie paper): member / blank / loading box / offline box. */
function plainHtml(f) {
  const face = (inner) => `<div class="lk-mini lkf-rookie hm-front hm-plain" aria-hidden="${f.kind === 'loading'}"><span class="lk-face lk-front"><div class="lk-mat">${inner}</div></span></div>`;
  if (f.kind === 'loading') return face('');
  if (f.kind === 'offline') return face(`<div class="hm-pmsg ts-small">${esc(WORDS.offline)}</div>`);
  if (f.kind === 'member') {
    return face(`<div class="x-l1"><div class="x-top"><span class="lk-brand">${MARK}${esc(WORDS.member)}</span></div>
      <b class="ts-title hm-pname ellipsis">${esc(f.name)}</b>
      <div class="x-bot"><span class="ellipsis">${esc(f.crew || '')}</span><span>${esc(f.line)}</span></div></div>`);
  }
  return face(`<div class="x-l1"><div class="x-top"><span class="lk-brand">${MARK}Golf Board</span></div>
      <b class="ts-row hm-pblank">${esc(WORDS.blank)}</b><div class="x-bot"></div></div>`);
}

/** §6.2 · the pass: day + badge, Game on its own row, then Course · Tee time · Host, the tear, the buttons. */
function passHtml(p) {
  const off = p.kind === 'off' || p.kind === 'removed';
  const cell = (k, v, cls = '') => (v ? `<div class="hp-c${cls}"><span class="ts-small">${k}</span><b class="ellipsis">${esc(v)}</b></div>` : '');
  const badge = p.badge ? `<span class="ts-label hp-bdg${p.kind === 'coming' ? ' inv' : ''}">${esc(p.badge)}</span>` : '';
  const btns = off
    ? `<div class="hp-btns one"><button class="btn" data-act="home-text" data-v="${esc(p.host || 'the host')}" data-r="${esc(p.name)}">Text ${esc(p.host || 'the host')}</button></div>`
    : `<div class="hp-btns"><button class="btn primary" data-act="go" data-v="#/e/${esc(p.code)}">Open</button>
        <button class="btn" data-act="home-share" data-v="${esc(p.code)}" data-r="${esc(p.name)}">Share link</button></div>`;
  return `<div class="hm-pass hm-front${p.kind === 'off' ? ' off' : ''}" data-act="go" data-v="#/e/${esc(p.code)}" role="button" tabindex="0"
      aria-label="${esc([p.name, p.day, p.course].filter(Boolean).join(', '))}">
      <div class="hp-top"><b class="hp-day">${esc(p.day)}</b>${badge}</div>
      <div class="hp-info">${cell('Game', p.game, ' hp-game')}<div class="hp-row">${cell('Course', p.course)}${cell('Tee time', p.time || 'Times soon')}${cell('Host', p.host)}</div></div>
      <i class="hp-tear" aria-hidden="true"></i>${btns}</div>`;
}

/** §6 · the front object. */
function frontHtml2(f) {
  if (f.kind === 'card') {
    const c = f.card;
    return `<button class="lk-mini lkf-${esc(c.fin)} hm-front hm-card" data-act="home-card" data-v="${esc(c.key)}" aria-label="Your latest card: ${esc(c.course)}, ${esc(prettyDate(c.day))}, ${c.gross}. Open it in your locker.">
        <span class="lk-face lk-front">${frontHtml(c, { crewLine: f.crewLine })}</span></button>`;
  }
  if (f.kind === 'pack') {
    const c = f.card;
    return `<button class="hm-front hm-pack" data-act="lk-home-packs" aria-label="Open your scorecard pack: ${esc(c.course)}, ${esc(prettyDate(c.day))}">
        <span class="hm-packart" aria-hidden="true">${chromePack()}${f.count > 1 ? `<b class="lk-pip">${f.count}</b>` : ''}</span></button>`;
  }
  if (f.kind === 'pass') return passHtml(f.pass);
  return plainHtml(f);
}

/** §6.1 · an edge: a 32 px strip of the object behind (its own art + label row), tap area 48. Never a score. */
function edgeHtml(e) {
  if (e.kind === 'card') {
    const c = e.card;
    return `<button class="hm-edge lkf-${esc(c.fin)}" data-act="home-card" data-v="${esc(c.key)}" aria-label="${esc(c.course)}, ${esc(prettyDate(c.day))}">
        <span class="lk-mat" aria-hidden="true"><i class="lk-sheen"></i></span><span class="hm-el"><span class="ts-label ellipsis">${esc(c.course)}</span><span class="ts-label hm-ef">${esc(finName(c))}</span></span></button>`;
  }
  if (e.kind === 'pack') {
    return `<button class="hm-edge hm-epack chrome" data-act="lk-home-packs" aria-label="${e.count} ${e.count === 1 ? 'pack' : 'packs'} to open">
        <span class="hm-epk" aria-hidden="true">${chromePack()}</span><span class="hm-el"><span class="ts-label">${e.count} ${e.count === 1 ? 'pack' : 'packs'} to open</span><span class="ts-label hm-ef">Series 1</span></span></button>`;
  }
  const p = e.pass;
  return `<button class="hm-edge hm-epass${p.kind === 'off' ? ' off' : ''}" data-act="go" data-v="#/e/${esc(p.code)}" aria-label="${esc([p.name, p.day].filter(Boolean).join(', '))}">
      <span class="hm-el"><b class="hp-eday">${esc(p.day)}</b><span class="ts-label ellipsis">${esc(p.course)}</span></span></button>`;
}

/** §7 · the crew row, Start a crew, or §6.4's join field. */
function slotHtml2(s) {
  if (!s) return '';
  if (s.kind === 'join') return `<div class="hm-join">${codeField()}</div>`;
  if (s.kind === 'start') {
    return `<button class="hm-crew" data-act="go" data-v="#/crew/start"><span class="hc-m"><span class="ts-label ellipsis">${esc(WORDS.noCrew)}</span><b class="ts-row">${esc(WORDS.startCrew)}</b></span>${chev()}</button>`;
  }
  const place = s.place ? `<b class="hc-pl">${esc(s.place)}</b>` : s.sub ? `<span class="ts-small hc-sub">${esc(s.sub)}</span>` : '';
  return `<button class="hm-crew" data-act="go" data-v="#/season/${esc(s.id)}" aria-label="${esc(s.name)} standings${s.place ? `, you’re ${esc(s.place)}` : ''}">
      <span class="hc-m"><span class="ts-label ellipsis">${esc(s.name)}</span><b class="ts-row">${esc(WORDS.standings)}</b></span>${place}${chev()}</button>`;
}

/** §8 · the doors row: All rounds, Add to Home Screen (after its nudge was dismissed). */
function doorsHtml(d) {
  const b = [d.allRounds ? `<button class="hm-door" data-act="go" data-v="#/rounds">All rounds${icon('fwd', 18)}</button>` : '',
    d.addHome ? `<button class="hm-door" data-act="home-add">Add to Home Screen${icon('fwd', 18)}</button>` : ''].filter(Boolean);
  return b.length ? `<div class="hm-doors">${b.join('')}</div>` : '';
}

/** §8 · the pinned foot: Join with code + New round; New round only; or the live bar (the only glow on Home). */
function footHtml(f, rounds) {
  const plus = icon('plus', 20);
  if (f.kind === 'new') return `<button class="btn primary big block" data-act="go" data-v="#/setup">${plus} New round</button>`;
  if (f.kind === 'live') {
    const r = rounds.find((x) => x.code === f.code);
    const line = f.line || [r?.course, r?.game].filter(Boolean).join(' · ') || r?.name || '';
    return `<div class="hm-live">
        <span class="hm-lm"><span class="ts-label hm-lk"><span class="lc-dot" aria-hidden="true"></span>Live${f.hole ? ` · hole ${f.hole}` : ''}</span><b class="hm-ll ellipsis">${esc(line)}</b></span>
        <button class="btn primary small hm-lbtn" data-act="go" data-v="#/e/${esc(f.code)}">Back to ${f.hole ? `hole ${f.hole}` : 'the round'}</button>
      </div>
      <div class="home-two hm-two">
        <button class="btn" data-act="home-joinsheet">Join with code</button>
        <button class="btn primary" data-act="go" data-v="#/setup">${plus} New round</button>
      </div>`;
  }
  return `<div class="home-two">
        <button class="btn big" data-act="home-joinsheet">Join with code</button>
        <button class="btn primary big" data-act="go" data-v="#/setup">${plus} New round</button>
      </div>`;
}

function roundRow(r) {
  const sub = [prettyDate(r.played_on), r.game, r.result?.line].filter(Boolean).join(' · ');
  return `<button class="home-row" data-act="go" data-v="#/e/${esc(r.code)}" aria-label="Open ${esc(r.name)}">
      <span class="hr-main"><span class="hr-name">${esc(r.course || r.name)}</span><span class="hr-sub">${esc(sub || r.code)}</span></span>
      ${r.result?.value ? `<span class="hr-v">${esc(r.result.value)}</span>` : ''}
      <span class="hr-chev">${icon('fwd', 20)}</span></button>`;
}

function codeField() {
  return `<label class="tf-label" for="join-code">Got a code from a friend?</label>
    <div class="join-row">
      <input class="input code" id="join-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"
        placeholder="e.g. TC482" aria-label="Join code" value="${esc(draftCode)}" data-input="home-code" data-enter="home-join">
      <button class="btn" data-act="home-join">Join</button>
    </div>`;
}

// Nov 24: Home looks for your rounds every time it shows up again (not once per page load): a home screen app resumed
// from the background now finds the round its owner was just added to. At most once a minute; a return resets it.
let syncedAt = 0;

// §11 · the opening, kept steady under the render loop with data-t0 + ui.syncMotion (mount). One deal per page load
// (0.7 s), which waits for the locker or 1.5 s, whichever is first; a late locker cross-fades into the same box; a
// return to Home fades. Reduced motion: none of it.
const DEAL_MS = 1100, FADE_MS = 400, WAIT_MS = 1500;
let visits = 0, opening = null, dealAt = 0, topShown, xfadeAt = 0, waitTimer = 0;
export function homeReturn() {
  syncedAt = 0;
  if (visits) opening = { kind: 'fade', t0: Date.now() };
}
function arrive() {
  visits += 1;
  opening = { kind: visits === 1 ? 'deal' : 'fade', t0: Date.now() };
}
/** This render's motion: { page, stack, front } attribute snippets, '' once over or under reduced motion. */
function motion(key, loading) {
  const now = Date.now();
  if (!dealAt && opening?.kind === 'deal' && (!loading || now - opening.t0 > WAIT_MS)) dealAt = now;
  if (key !== topShown) {
    if (topShown !== undefined && dealAt && now !== dealAt) xfadeAt = now; // the locker arrived late, or the front changed
    topShown = key;
    if (key) local.set('glb.seen.homeTop', key);
  }
  if (reducedMotion()) return { page: '', stack: '', front: '' };
  const fade = opening?.kind === 'fade' && now - opening.t0 < FADE_MS;
  return {
    page: fade ? ` hm-fade" data-t0="${opening.t0}` : '',
    stack: dealAt && now - dealAt < DEAL_MS ? ` hm-deal" data-t0="${dealAt}` : loading && !dealAt ? ' hm-wait' : '',
    front: xfadeAt && now - xfadeAt < FADE_MS ? ` hm-xfade" data-t0="${xfadeAt}` : '',
  };
}

/** #/rounds · All rounds (037 §5): what Home's Recent rounds list used to show, on its own screen. */
export const roundsScreen = {
  render() {
    const list = allRounds(recent.all(), Date.now());
    return `<div class="plain home-rounds">
        <h1 class="ts-title hm-rh">Rounds</h1>
        ${list.length ? `<div class="home-list">${list.map(roundRow).join('')}</div>`
          : empty({ icon: 'flag', headline: 'No rounds yet', help: 'Start one and text the code to your group, or join a round a friend started.' })}
      </div>`;
  },
};

// §4.1 · the measured fit, done in mount the way enter.mount measures the pads: the headline's form, then edges
// yield, then the front shrinks (never under 300 wide, a pass 336), then the doors row hides.
function fitHome(content) {
  const home = content.querySelector('.home');
  if (!home) return;
  const app = STANDALONE;
  const h = home.querySelector('.hm-h');
  if (h?.dataset.forms) {
    let forms = [];
    try { forms = JSON.parse(h.dataset.forms); } catch { /* keep what's drawn */ }
    const max = app ? 2 : 1;
    for (let i = 0; i < forms.length; i++) {
      h.innerHTML = formHtml(forms[i]);
      if (i === forms.length - 1 || Math.round(h.offsetHeight / 36) <= max) break;
    }
  }
  const avail = content.clientHeight;
  if (!avail) return;
  const need = () => { home.style.minHeight = '0px'; const n = home.offsetHeight; home.style.minHeight = ''; return n; };
  let over = need() - avail;
  const edges = [...home.querySelectorAll('.hm-edge')]; // farthest first
  while (over > 0 && edges.length) { edges.shift().style.display = 'none'; over = need() - avail; }
  const stack = home.querySelector('.hm-stack');
  const fr = home.querySelector('.hm-front');
  if (over > 0 && stack && fr) {
    const w = fr.offsetWidth, ht = fr.offsetHeight;
    if (w && ht) {
      const nw = fitWidth(stack.parentElement.clientWidth, ht - over, { min: fr.classList.contains('hm-pass') ? 336 : 300, ratio: w / ht });
      stack.style.setProperty('--hm-w', `${nw}px`);
      over = need() - avail;
    }
  }
  if (over > 0) { const d = home.querySelector('.hm-doors'); if (d) d.style.display = 'none'; }
}

export default {
  topLeft: () => header(recent.all()),
  enter() { arrive(); },

  render(app) {
    // Once per open: pull in your rounds this phone has never seen (new phone / home screen app).
    if (Date.now() - syncedAt > 60000) {
      syncedAt = Date.now();
      app.checkVersion?.(); // and a newer version, now that nothing is at stake (app.js decides)
      syncMyRounds(PREVIEW ? [lockerPerson()] : []).then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ });
      pruneGoneRounds().then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ }); // deleted rounds leave Recent
      refreshLobbies(clock.now()).then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ }); // 025
    }
    if (!visits) arrive();
    startHomeLocker(app); // 035: this phone's locker, once per page load. Any failure = Home still complete.
    const rounds = recent.all();
    const lk = homeLockerData(app);
    const state = homeLockerState(app);
    if (lk?.cards?.length) local.set('glb.seen.homeCards', true); // §11: "had cards" (moves with the move link)
    const firstRound = rounds.map((r) => r.played_on).filter(Boolean).sort()[0] || null;
    const w = whatsNew({ seen: local.get('glb.seen.whatsnew'), hasRounds: rounds.length > 0, firstRound });
    if (w.markSeen) local.set('glb.seen.whatsnew', w.markSeen);
    const o = owner.get();
    const m = homeModel({
      rounds, now: Date.now(), personId: lk?.personId || lockerPerson() || null, locker: lk, lockerState: state,
      hadCards: !!local.get('glb.seen.homeCards'),
      crews: homeCrewData(app), crewNames: crewNames(app), meName: (o?.name || '').split(' ')[0], meFull: o?.name || lockerName(),
      ios: isIOS(), standalone: STANDALONE,
      seen: { add: !!local.get('glb.seen.homeNudge.add') || !!local.get('glb.hasApp') }, news: w.show,
    });
    const mo = motion(topKey(m.front), m.front.kind === 'loading');
    // The deal waits for the locker at most 1.5 s: make sure a render comes then, even with nothing else happening.
    if (mo.stack === ' hm-wait' && !waitTimer) waitTimer = setTimeout(() => { waitTimer = 0; app.render(); }, WAIT_MS + 50);
    const edges = m.edges.slice(0, m.edgeMax).reverse(); // farthest first: the nearest edge sits right behind the front
    return `<div class="plain home hm2${STANDALONE ? ' hm-app' : ''}${mo.page}">
      ${nudgeHtml(m.nudge)}
      ${headlineHtml(m.headline)}
      <div class="hm-stack${mo.stack}">${edges.map((e, i) => `<div class="hm-ei" style="--i:${i}">${edgeHtml(e)}</div>`).join('')}
        <div class="hm-fi${mo.front}" style="--i:${edges.length}">${frontHtml2(m.front)}</div></div>
      <div class="hm-fill"></div>
      ${slotHtml2(m.slot)}
      ${doorsHtml(m.doors)}
      <div class="nr-foot home-foot${m.foot.kind === 'live' ? ' hm-livefoot' : ''}">${footHtml(m.foot, rounds)}</div>
    </div>`;
  },
  mount(content) {
    try { fitHome(content); } catch { /* Home as drawn */ }
    syncMotion(content);
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
    'home-joinsheet': (el, ev, app) => app.openSheet('join', {}),
    // §4.2: What's new opens a small sheet on tap (never by itself); Got it / ✕ marks the release seen.
    'home-news-open': (el, ev, app) => app.openSheet('home-news', { id: el.dataset.v }),
    'home-news': (el, ev, app) => { local.set('glb.seen.whatsnew', el.dataset.v); app.closeSheet?.(); app.render(); },
    'home-nudge-x': (el, ev, app) => {
      const v = el.dataset.v || '';
      if (v.startsWith('news:')) local.set('glb.seen.whatsnew', v.slice(5));
      else local.set(`glb.seen.homeNudge.${v}`, true); // after its ✕, Add to Home Screen is a door (§8)
      app.render();
    },
    // §6.1: a scorecard (front or edge) opens that card in the Locker.
    'home-card': (el, ev, app) => {
      app.ui.lk ||= { view: 'one', key: null, flip: null, land: null, landAt: 0, person: null, tab: 'cards' };
      Object.assign(app.ui.lk, { view: 'one', key: el.dataset.v, flip: null, tab: 'cards', person: lockerPerson() });
      app.go('#/locker');
    },
    // §6.2: Share link on every coming pass: the round's link, the one the host already texts (nothing else).
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
      if (app.sheet?.type === 'join') app.closeSheet();
      app.go(`#/e/${code}`);
    },
  },
};

export { codeField };
