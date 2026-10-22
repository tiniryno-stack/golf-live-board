// home.js — Home (designspec §6b): your name, the round you're playing now as one green-outlined
// card ("Back to hole 11"), recent rounds as plain rows with how it went, then Join with code
// (secondary) + New round (primary) at the bottom. First time: the "No rounds yet" empty state with
// a code field. Season standings and Add to Home Screen stay as rows under the list. Run it back
// lives in a round's ⋯ menu. Everything here comes from this phone (glb.recent), no network.

import { esc, icon, prettyDate, initials, empty } from '../ui.js?v=2d64e16';
import { recent, normCode, STANDALONE, moveLink } from '../db.js?v=2d64e16';
import { fmtPts, fmtToPar, playerLeaderboard } from '../scoring.js?v=2d64e16';

/** iPhone or iPad in Safari (iPadOS says it's a Mac, but has touch). Tests set `__GLB_IOS`. */
const isIOS = () => {
  if (typeof globalThis.__GLB_IOS === 'boolean') return globalThis.__GLB_IOS;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const LIVE_FOR = 12 * 3600 * 1000; // a round last seen live more than 12 h ago isn't "playing now"
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

let draftCode = '';

/** The game's name, the way Home says it. */
function gameLabel(snap) {
  const st = snap.settings;
  if (st.pairs) return '2v2';
  if (snap.game?.type === 'splitPoint') return 'Match play';
  if (snap.game) return 'Partner “Rider” Cup';
  return 'Stroke play';
}

/**
 * What Home shows for a round, from this phone's point of view (kept in glb.recent by app.js):
 * { myName, game, done, live: { hole, line, points }, result: { line, value } }.
 */
export function roundSummary(app) {
  const snap = app.snapshot;
  if (!snap) return null;
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
function header(rounds) {
  const name = rounds.find((r) => r.myName)?.myName;
  if (!name) return '<div class="spacer"></div>';
  return `<div class="home-me"><span class="avatar">${esc(initials(name))}</span><span class="hm-name">${esc(name)}</span></div>`;
}

function liveCard(r) {
  const L = r.live;
  return `<div class="ts-label home-k">Playing now</div>
    <div class="live-card">
      <div class="lc-top"><span class="lc-dot"></span><span class="ts-label lc-live">Live${L.hole ? ` · hole ${L.hole}` : ''}</span><span class="ts-label lc-code">${esc(r.code)}</span></div>
      <div class="lc-mid"><span class="lc-text"><span class="lc-name">${esc([r.course, r.game].filter(Boolean).join(' · ') || r.name)}</span>
        ${L.line ? `<span class="lc-line">${esc(L.line)}</span>` : ''}</span>
        ${L.points ? `<span class="lc-pts">${esc(L.points)}</span>` : ''}</div>
      <button class="btn block" data-act="go" data-v="#/e/${esc(r.code)}">Back to ${L.hole ? `hole ${L.hole}` : 'the round'}</button>
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

export default {
  topLeft: () => header(recent.all()),

  render(app) {
    const rounds = recent.all();
    const crew = rounds.find((r) => r.crew_id)?.crew_id || null;
    const now = Date.now();
    const live = rounds.find((r) => r.live && !r.done && now - (r.seen || r.at || 0) < LIVE_FOR) || null;
    const rest = rounds.filter((r) => r !== live);
    const extras = `${!STANDALONE && isIOS() ? `<button class="home-row" data-act="home-add">
          <span class="hr-ico">${icon('phone', 22)}</span>
          <span class="hr-main"><span class="hr-name">Add to Home Screen</span><span class="hr-sub">Opens like an app, no Safari bars. Your rounds come with it.</span></span>
          <span class="hr-chev">${icon('fwd', 20)}</span></button>` : ''}
      ${crew ? `<button class="home-row" data-act="go" data-v="#/season/${esc(crew)}">
          <span class="hr-ico">${icon('trophy', 22)}</span>
          <span class="hr-main"><span class="hr-name">Season standings</span><span class="hr-sub">Player and pair records across your crew’s rounds</span></span>
          <span class="hr-chev">${icon('fwd', 20)}</span></button>` : ''}`;
    if (!rounds.length) {
      return `<div class="plain home">
        <h1 class="ts-title home-title">Golf Live Board</h1>
        ${empty({ icon: 'flag', headline: 'No rounds yet', help: 'Start one and text the code to your group, or join a round a friend started.' })}
        <div class="home-join">${codeField()}</div>
        <div class="home-list">${extras}</div>
        <div class="nr-foot home-foot"><button class="btn primary big block" data-act="go" data-v="#/setup">${icon('plus', 20)} New round</button></div>
      </div>`;
    }
    return `<div class="plain home">
      <h1 class="ts-title home-title">Golf Live Board</h1>
      ${live ? liveCard(live) : ''}
      ${rest.length ? `<div class="ts-label home-k">Recent rounds</div><div class="home-list">${rest.map(roundRow).join('')}</div>` : ''}
      <div class="home-list">${extras}</div>
      <div class="nr-foot home-foot"><div class="home-two">
        <button class="btn big" data-act="home-joinsheet">Join with code</button>
        <button class="btn primary big" data-act="go" data-v="#/setup">${icon('plus', 20)} New round</button>
      </div></div>
    </div>`;
  },
  actions: {
    'home-code': (el) => {
      draftCode = normCode(el.value).slice(0, 5);
      if (el.value !== draftCode) el.value = draftCode;
    },
    'home-add': (el, ev, app) => {
      // Put this phone's keys in the link iPhone saves with the icon (see db.moveLink).
      history.replaceState(null, '', `${location.pathname}${location.search}${moveLink()}`);
      app.openSheet('homescreen', {});
    },
    'home-joinsheet': (el, ev, app) => app.openSheet('join', {}),
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
