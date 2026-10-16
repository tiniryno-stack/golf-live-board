// home.js — join by code, new round, run it back, recent rounds on this phone, season standings.

import { esc, icon, prettyDate } from '../ui.js';
import { recent, normCode } from '../db.js';

let draftCode = '';

export default {
  render(app) {
    const rounds = recent.all();
    const crew = rounds.find((r) => r.crew_id)?.crew_id || null;
    const list = rounds.length
      ? `<div class="list">${rounds
        .map(
          (r) => `<div class="row">
            <button class="body" style="text-align:left;min-height:48px" data-act="go" data-v="#/e/${esc(r.code)}">
              <div class="row-title ellipsis">${esc(r.name)}</div>
              <div class="detail">${esc([r.course, prettyDate(r.played_on), r.code].filter(Boolean).join(' · '))}</div>
            </button>
            <button class="btn small" data-act="go" data-v="#/setup/${esc(r.code)}">Run it back</button>
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
