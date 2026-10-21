// home.js — join by code, new round, run it back, recent rounds on this phone, season standings.

import { esc, icon, prettyDate } from '../ui.js';
import { recent, normCode, STANDALONE, moveLink } from '../db.js';

/** iPhone or iPad in Safari (iPadOS says it's a Mac, but has touch). Tests set `__GLB_IOS`. */
const isIOS = () => {
  if (typeof globalThis.__GLB_IOS === 'boolean') return globalThis.__GLB_IOS;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

let draftCode = '';

export default {
  render(app) {
    const rounds = recent.all();
    const crew = rounds.find((r) => r.crew_id)?.crew_id || null;
    const list = rounds.length
      ? `<div class="stack" style="gap:10px">${rounds
        .map(
          (r) => `<div class="round-card">
            <button class="round-open" data-act="go" data-v="#/e/${esc(r.code)}" aria-label="Open ${esc(r.name)}">
              <span class="body">
                <span class="row-title ellipsis" style="display:block">${esc(r.name)}</span>
                <span class="detail" style="display:block">${esc([r.course, prettyDate(r.played_on), r.code].filter(Boolean).join(' · '))}</span>
              </span>
              <span class="rejoin">Open ${icon('fwd', 16)}</span>
            </button>
            <button class="runback" data-act="go" data-v="#/setup/${esc(r.code)}">${icon('shuffle', 13)} Run it back as a new round</button>
          </div>`
        )
        .join('')}</div>`
      : '<p class="meta">Rounds you open on this phone show up here.</p>';
    return `<div class="plain">
      <h1 class="title">Golf Live Board</h1>
      <div class="card" style="margin:0 0 12px">
        <div class="micro" style="margin:0 0 8px">Join a round</div>
        <div class="join-row">
          <input class="input code" id="join-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"
            placeholder="CODE" aria-label="Join code" value="${esc(draftCode)}" data-input="home-code" data-enter="home-join">
          <button class="btn primary" data-act="home-join">Join</button>
        </div>
      </div>
      <button class="btn primary big block" data-act="go" data-v="#/setup">${icon('plus', 18)} New round</button>
      <p class="meta" style="margin:8px 2px 22px">Whoever starts a round is its organizer.</p>
      ${!STANDALONE && isIOS() ? `<button class="row hs-row" data-act="home-add" style="margin:0 0 18px">
          <span class="numcol">${icon('phone', 26)}</span>
          <span class="body"><span class="row-title">Add to Home Screen</span><span class="detail" style="display:block">Opens like an app, no Safari bars. Your rounds come with it.</span></span>
          ${icon('fwd', 18)}</button>` : ''}
      ${crew ? `<button class="row" data-act="go" data-v="#/season/${esc(crew)}" style="margin:0 0 18px">
          <span class="numcol">${icon('trophy', 26)}</span>
          <span class="body"><span class="row-title">Season standings</span><span class="detail" style="display:block">Player and pair records across your crew’s rounds</span></span>
          ${icon('fwd', 18)}</button>` : ''}
      <h2 class="section-title" style="margin:0 0 4px">Recent rounds</h2>
      ${list}
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
    'home-join': (el, ev, app) => {
      const code = normCode(document.getElementById('join-code')?.value || draftCode);
      if (code.length < 4) {
        app.toast({ title: 'Enter the 5-letter code', error: true });
        return;
      }
      draftCode = '';
      document.activeElement?.blur?.();
      app.go(`#/e/${code}`);
    },
  },
};
