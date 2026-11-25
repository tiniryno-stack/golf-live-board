// home.js — Home (037, docs/design/features/037-home/SPEC.md): your latest card on top (or the pack to open, or an
// empty outline), the locker caption, Coming up, how that round finished, one crew block, end rows, and the pinned
// bar (Join with code / New round, or the live round). What to draw comes from the pure js/homeview.js; this file
// only turns it into markup and plays the opening (deal / quick fade, data-t0 + ui.syncMotion). #/rounds = All
// rounds (Home's old Recent rounds list). Everything but the locker and crew comes from this phone (glb.recent).

import { gameName } from '../playfor.js';
import { esc, icon, prettyDate, initials, empty, foldIn, syncMotion, reducedMotion } from '../ui.js';
import { recent, normCode, STANDALONE, moveLink, syncMyRounds, pruneGoneRounds, local, refreshLobbies, owner, clock } from '../db.js';
import { lobbyState, homeCard } from '../lobby.js';
import { homeCrewData, crewNames } from './crew.js';
import { homeLockerData, startHomeLocker, lockerName, frontHtml } from './locker.js';
import { chromePack } from './pack.js';
import { homeModel, allRounds, topKey } from '../homeview.js';
import { whatsNew } from '../whatsnew.js';
import { fmtPts, fmtToPar, playerLeaderboard } from '../scoring.js';

/** iPhone or iPad in Safari (iPadOS says it's a Mac, but has touch). Tests set `__GLB_IOS`. */
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
    return { game: 'Team Ryder Cup', myName: me ? me.firstName || me.name : null, done: false, ...(card ? { lobby: card } : {}), ...(app.me ? { lobbyPid: app.me } : {}) };
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

/** Home's top bar, left side: your name from the newest round you joined (nothing on a new phone). */
/** Your name at the top (Nov 24: a button → who this phone is, with a one-tap fix). The owner's name first. */
function header(rounds) {
  const name = owner.get()?.name || (owner.get() ? '' : rounds.find((r) => r.myName)?.myName) || lockerName();
  if (!name) {
    return rounds.length ? '<button class="home-me" data-act="home-me"><span class="hm-name">Who are you?</span></button>' : '<div class="spacer"></div>';
  }
  // 036 §4.3: the avatar opens your passport. Nov 24 (returning players): your name opens who this phone is, with a fix.
  return `<div class="home-me"><button class="avatar" data-act="go" data-v="#/passport" aria-label="Your passport">${esc(initials(name))}</button>
    <button class="hm-name" data-act="home-me" aria-label="You’re ${esc(name)}. Not you?">${esc(name)}</button></div>`;
}

const chev = () => `<span class="hr-chev">${icon('fwd', 20)}</span>`;
const row = (act, v, name, sub) => `<button class="home-row" data-act="${act}"${v ? ` data-v="${esc(v)}"` : ''}>
      <span class="hr-main"><span class="hr-name">${esc(name)}</span>${sub ? `<span class="hr-sub">${esc(sub)}</span>` : ''}</span>${chev()}</button>`;

/** 037 §3.6 · What's new: one slim line under the top bar; a tap opens it in place (lines + Got it). */
function newsLine(app, hasRounds) {
  const w = whatsNew({ seen: local.get('glb.seen.whatsnew'), hasRounds });
  if (w.markSeen) local.set('glb.seen.whatsnew', w.markSeen);
  if (!w.show) return '';
  const open = app.ui.homeNews === w.show.id;
  return `<div class="hm-news${open ? ' open' : ''}" role="status">
      <button class="hm-nl" data-act="home-news-open" data-v="${esc(w.show.id)}" aria-expanded="${open}" aria-label="What’s new: ${esc(w.show.title)}">
        <span class="ts-label hm-nk">New</span><b class="hm-nt ellipsis">${esc(w.show.title)}</b><span class="hr-chev hm-nc">${icon('fwd', 20)}</span></button>
      ${open ? `<div class="hm-nb${foldIn(app.ui)}" style="--fold-h:220px">${w.show.lines.map((l) => `<span class="soft lb-line">${esc(l)}</span>`).join('')}
        <button class="btn block lb-cbtn" data-act="home-news" data-v="${esc(w.show.id)}">Got it</button></div>` : ''}
    </div>`;
}

/** 037 §3.1 · the top: the pack, your latest card (crew on it), or the empty outline. */
function topHtml(top) {
  if (top.kind === 'pack') {
    const c = top.card;
    return `<button class="hm-top hm-pack" data-act="lk-home-packs" aria-label="Open your scorecard pack: ${esc(c.course)}, ${esc(prettyDate(c.day))}">
        <span class="hm-packart" aria-hidden="true">${chromePack()}${top.count > 1 ? `<b class="lk-pip">${top.count}</b>` : ''}</span></button>`;
  }
  if (top.kind === 'card') {
    const c = top.card;
    return `<button class="lk-mini lkf-${esc(c.fin)} hm-top hm-card" data-act="go" data-v="#/locker" aria-label="Your latest card: ${esc(c.course)}, ${esc(prettyDate(c.day))}, ${c.gross}. Open your locker.">
        <span class="lk-face lk-front">${frontHtml(c, { crewLine: top.crewLine })}</span></button>`;
  }
  return emptyOutline('Your first card goes here', 'Finish 18 holes and it shows up as a pack.');
}
const emptyOutline = (headline, help) => `<div class="hm-top hm-empty">${empty({ icon: 'flag', headline, help })}</div>`;

/** 037 §3.3 · How it finished: top three, you after a break, Full board. */
function resultHtml(r) {
  const rows = r.rows.map((x) => (x.gap ? '<div class="hm-gap" aria-hidden="true"></div>'
    : `<div class="hm-fr${x.me ? ' me' : ''}"><span class="ts-label hm-pos">${esc(x.pos)}</span><span class="hm-fn ellipsis">${esc(x.name)}</span>${x.value ? `<span class="hr-v">${esc(x.value)}</span>` : ''}</div>`)).join('');
  return `<div class="ts-label home-k">${esc(r.label)}</div>
    <div class="hm-fin">${rows}
      <button class="home-row hm-more" data-act="go" data-v="#/e/${esc(r.code)}"><span class="hr-main"><span class="hr-sub">Full board</span></span>${chev()}</button></div>`;
}

/** 037 §3.4 · the crew block: kicker + Invite + ⋯, the switcher (2+ crews), Standings or Name your crew. */
function crewHtml(c, extra = '') {
  if (c.kind === 'none') {
    return `<div class="home-list hm-crew">${row('go', '#/crew/start', 'Start a crew', 'One link for the group, standings in one place')}${extra}</div>`;
  }
  const switcher = c.switcher
    ? `<div class="crew-switch${c.switcher.length >= 4 ? ' scroll' : ''}"><div class="seg" role="group">${c.switcher
      .map((x) => `<button data-act="crew-pick" data-v="${esc(x.id)}" aria-pressed="${x.on}"><span class="ellipsis">${esc(x.name)}</span></button>`).join('')}</div></div>`
    : '';
  const first = c.named ? row('go', `#/season/${c.id}`, 'Standings', c.sub) : row('go', `#/crew/rename/${c.id}`, 'Name your crew', 'The name your group sees on the invite');
  return `<div class="hm-kk"><span class="ts-label ellipsis">${esc(c.kicker)}</span>
      <span class="hm-kact"><button class="pill hm-invite" data-act="crew-invite" data-v="${esc(c.id)}">Invite</button>
        <button class="icon-btn" data-act="crew-settings" data-v="${esc(c.id)}" aria-label="Crew settings">${icon('more')}</button></span></div>
    ${switcher}<div class="home-list hm-crew">${first}${extra}</div>`;
}

const addHomeRow = () => `<button class="home-row" data-act="home-add">
      <span class="hr-main"><span class="hr-name">Add to Home Screen</span><span class="hr-sub">Opens like an app, no Safari bars. Your rounds come with it.</span></span>${chev()}</button>`;

/** 037 §3.5 · the pinned bar: Join with code + New round, or the live round (the only thing on Home that glows). */
function barHtml(bar, rounds) {
  if (bar.kind === 'new') return `<button class="btn primary big block" data-act="go" data-v="#/setup">${icon('plus', 20)} New round</button>`;
  if (bar.kind === 'live') {
    const r = rounds.find((x) => x.code === bar.code);
    const line = bar.line || [r?.course, r?.game].filter(Boolean).join(' · ') || r?.name || '';
    return `<div class="hm-live">
        <span class="lc-dot" aria-hidden="true"></span>
        <span class="hm-lm"><span class="ts-label hm-lk">Live${bar.hole ? ` · hole ${bar.hole}` : ''}</span><b class="hm-ll ellipsis">${esc(line)}</b></span>
        <button class="btn primary small hm-lbtn" data-act="go" data-v="#/e/${esc(bar.code)}">Back to ${bar.hole ? `hole ${bar.hole}` : 'the round'}</button>
      </div>`;
  }
  return `<div class="home-two">
        <button class="btn big" data-act="home-joinsheet">Join with code</button>
        <button class="btn primary big" data-act="go" data-v="#/setup">${icon('plus', 20)} New round</button>
      </div>`;
}

/** 025 · Coming up (9 / 10 / 11): a lobby round before scoring opens. A plain card (never the green live card);
 *  its button is secondary (New round stays Home's primary). */
function comingCard(r) {
  const c = r.lobby;
  const off = c.kind === 'off';
  return `<div class="card lb-card lb-home">
      <span class="lbl${off ? ' lb-offk' : ''}">${off ? '<span class="lb-dot" aria-hidden="true"></span>Called off · was ' : ''}${esc(c.when)}${off ? '' : ` · ${esc(r.course || '')}`}</span>
      <b class="lb-name">${esc(r.name)}</b>
      <span class="soft lb-line">${esc(c.line)}</span>
      ${c.kind === 'coming'
        ? `<button class="btn block lb-cbtn" data-act="go" data-v="#/e/${esc(r.code)}">Open</button>`
        : `<button class="btn block lb-cbtn" data-act="home-text" data-v="${esc(c.host)}" data-r="${esc(r.name)}">Text ${esc(c.host)}</button>`}
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

// The Home header: the mark (feature 020, L2 lockup: ring centered on the capitals, 10px gap). Brand-new phone only (§4.7).
const TITLE = `<h1 class="ts-title home-title"><span class="home-mark" aria-hidden="true"><img class="mk-dark" src="img/mark-dark.svg" alt="" width="30" height="30"><img class="mk-light" src="img/mark-light.svg" alt="" width="30" height="30"></span>Golf Live Board</h1>`;
// Nov 24: Home looks for your rounds every time it shows up again (not once per page load): a home screen app resumed
// from the background now finds the round its owner was just added to. At most once a minute; a return resets it.
let syncedAt = 0;

// 037 §6 · the opening, kept steady under the render loop with data-t0 + ui.syncMotion (mount). `visits` counts Home
// arrivals since the page loaded: the first deals, every later one (and the app resuming on Home) fades. The top deals
// on its own when it first shows up on this page load (the locker arrives) or differs from glb.seen.homeTop.
const DEAL_MS = 1300, FADE_MS = 400;
let visits = 0, opening = null, topShown, topAt = 0;
export function homeReturn() {
  syncedAt = 0;
  if (visits) opening = { kind: 'fade', t0: Date.now() };
}
function arrive() {
  visits += 1;
  opening = { kind: visits === 1 ? 'deal' : 'fade', t0: Date.now() };
}
/** This render's motion: { page, top, rise(i) } attribute snippets, all '' once it's over or under reduced motion. */
function motion(key) {
  const now = Date.now();
  if (key !== topShown) {
    if (key && (!topShown || key !== local.get('glb.seen.homeTop'))) topAt = now;
    topShown = key;
    if (key) local.set('glb.seen.homeTop', key);
  }
  if (reducedMotion()) return { page: '', top: '', rise: () => '' };
  const o = opening && now - opening.t0 < (opening.kind === 'deal' ? DEAL_MS : FADE_MS) ? opening : null;
  const deal = o?.kind === 'deal';
  return {
    page: o?.kind === 'fade' ? ` hm-fade" data-t0="${o.t0}` : '',
    top: topAt && now - topAt < DEAL_MS ? ` hm-deal" data-t0="${topAt}` : '',
    rise: (i) => (deal ? ` hm-rise" style="--hm-d:${i * 70}ms" data-t0="${o.t0}` : ''),
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

export default {
  topLeft: () => header(recent.all()),
  enter() { arrive(); },

  render(app) {
    // Once per open: pull in your rounds this phone has never seen (new phone / home screen app).
    if (Date.now() - syncedAt > 60000) {
      syncedAt = Date.now();
      app.checkVersion?.(); // and a newer version, now that nothing is at stake (app.js decides)
      syncMyRounds().then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ });
      pruneGoneRounds().then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ }); // deleted rounds leave Recent
      refreshLobbies(clock.now()).then((n) => { if (n) app.render(); }).catch(() => { /* offline: next open */ }); // 025
    }
    if (!visits) arrive();
    startHomeLocker(app); // 035: this phone's locker, once per page load. Any failure = no top (037 §3.1 row 4).
    const rounds = recent.all();
    const lk = homeLockerData(app);
    const m = homeModel({
      rounds, now: Date.now(), personId: lk?.personId || null, locker: lk,
      crews: homeCrewData(app), crewNames: crewNames(app), meName: (owner.get()?.name || '').split(' ')[0],
      ios: isIOS(), standalone: STANDALONE,
    });
    const mo = motion(topKey(m.top));
    let i = 0;
    const block = (html) => (html ? `<div class="hm-b${mo.rise(i++)}">${html}</div>` : '');
    const foot = () => `<div class="nr-foot home-foot${mo.rise(i + 1)}">${barHtml(m.bar, rounds)}</div>`;

    if (m.brandNew) {
      newsLine(app, false); // a brand-new phone: nothing is news, mark it seen
      const none = m.crew.kind === 'none';
      return `<div class="plain home${mo.page}">
        ${block(`${TITLE}${emptyOutline('No rounds yet', 'Start one and text the code to your group, or join a round a friend started.')}`)}
        ${block(`<div class="home-join">${codeField()}</div>`)}
        ${block(crewHtml(m.crew, none && m.endRows.addHome ? addHomeRow() : ''))}
        ${!none && m.endRows.addHome ? block(`<div class="home-list hm-ends">${addHomeRow()}</div>`) : ''}
        ${foot()}
      </div>`;
    }
    const e = m.endRows;
    const ends = [
      e.allRounds ? row('go', '#/rounds', 'All rounds', `${e.allRounds.count} since ${e.allRounds.since}`) : '',
      e.newRound ? row('go', '#/setup', 'New round', 'Start another round') : '',
      e.join ? row('home-joinsheet', '', 'Join with code', 'Got a code from a friend?') : '',
      e.addHome ? addHomeRow() : '',
    ].join('');
    return `<div class="plain home${mo.page}">
      ${block(newsLine(app, true))}
      ${m.top ? `<div class="hm-hero${mo.top}">${topHtml(m.top)}</div>` : ''}
      ${block(m.caption ? `<button class="home-row hm-cap" data-act="go" data-v="#/locker">
          <span class="hr-main"><span class="hr-name">Your locker</span><span class="hr-sub">${esc(m.caption.sub)}</span></span>${chev()}</button>` : '')}
      ${block(m.coming.length ? `<div class="ts-label home-k">Coming up</div>${m.coming.map(comingCard).join('')}` : '')}
      ${block(m.result ? resultHtml(m.result) : '')}
      ${block(crewHtml(m.crew))}
      ${block(ends ? `<div class="home-list hm-ends">${ends}</div>` : '')}
      ${foot()}
    </div>`;
  },
  mount(content) { syncMotion(content); },
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
    'home-news': (el, ev, app) => { local.set('glb.seen.whatsnew', el.dataset.v); app.ui.homeNews = null; app.render(); },
    'home-news-open': (el, ev, app) => {
      app.ui.homeNews = app.ui.homeNews === el.dataset.v ? null : el.dataset.v;
      app.ui.foldAt = Date.now();
      app.render();
    },
    'home-me': (el, ev, app) => { app.ui.homePeople = null; app.openSheet('home-me', {}); },
    'home-text': async (el, ev, app) => {
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
