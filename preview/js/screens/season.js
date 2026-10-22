// season.js — crew Standings split into seasons (feature 008-seasons), opened from the crew card.
// #/season/<crew> = the current season · #/season/<crew>/past = seasons list · #/season/<crew>/<key> = one season.
// Points are the cart game's (Partner "Rider" Cup) until the cross-game standings rework; the note says so.
// Math lives in seasons.js (pure, tested); crew data comes from crew.js's loadCrew.

import * as db from '../db.js';
import { esc, icon } from '../ui.js';
import { fmtPts } from '../scoring.js';
import { shortDate, seasonTable, nextSeasonLabel, placeLabel } from '../seasons.js';
import { loadCrew, crewSeasons } from './crew.js';

const today = () => new Date().toLocaleDateString('en-CA');
const shortName = (r) => {
  const full = r.fullName || r.name || '';
  const [first, ...rest] = full.split(' ');
  return rest.length ? `${first} ${rest.join(' ')[0]}.` : first;
};
const crewOf = (app) => app.route.crew || db.crews.current()?.id || db.recent.all().find((r) => r.crew_id)?.crew_id || null;

function datesLine(s) {
  const end = s.end ? (() => { const d = new Date(`${s.end}T12:00:00`); d.setDate(d.getDate() - 1); return d.toLocaleDateString('en-CA'); })() : null;
  const range = s.upcoming && !s.start ? 'STARTS NEXT ROUND' : `${shortDate(s.start)} – ${s.current && !s.end ? 'NOW' : shortDate(end || today())}`;
  return `${range} · ${s.rounds.length} ROUND${s.rounds.length === 1 ? '' : 'S'}`;
}

function standingsView(app, id, data, season) {
  const me = app.crews?.[id]?.info?.me || db.crews.get(id)?.me || null;
  const t = seasonTable(season, me);
  const rows = t.rows.filter((r) => r.games > 0);
  const table = rows.length
    ? `<div class="st-head ts-label"><span>#</span><span>Player</span><span class="st-n">Rds</span><span class="st-n">Pts</span></div>
      <div class="st-table">${rows.map((r) => `<div class="st-row${r.me ? ' me' : ''}"><span class="st-rank mono">${r.tied ? 'T' : ''}${r.rank}</span>
        <span class="st-name ellipsis">${esc(shortName(r))}</span><span class="st-n mono">${r.rounds}</span><span class="st-n st-pts mono">${fmtPts(r.points)}</span></div>`).join('')}</div>`
    : '<p class="meta st-empty">No finished Partner “Rider” Cup matchups this season yet.</p>';
  const owner = app.crews?.[id]?.info?.isOwner;
  return `<button class="season-card" data-act="go" data-v="#/season/${esc(id)}/past">
      <span class="sc-main"><span class="sc-name">${esc(season.name)}</span><span class="ts-label sc-dates">${esc(datesLine(season))}</span></span>
      ${season.current ? '<span class="ts-label sc-tag">Current</span>' : ''}<span class="sc-chev">${icon('fwd', 18).replace('<svg', '<svg style="transform:rotate(90deg)"')}</span>
    </button>
    ${table}
    <p class="meta st-note">Partner “Rider” Cup points from every crew round this season. Standings for every game are coming.</p>
    ${season.current && owner ? `<div class="nr-foot"><button class="btn nr-cta" data-act="season-new" data-v="${esc(id)}">${icon('plus', 20)} Start a new season</button></div>` : ''}`;
}

function pastView(app, id, data) {
  const me = app.crews?.[id]?.info?.me || db.crews.get(id)?.me || null;
  const rows = [...data.seasons].reverse().map((s) => {
    const t = seasonTable(s, me);
    const top = t.rows.find((r) => r.games > 0);
    const line = !top ? 'No matchups yet' : top.me ? 'Won by you' : `${s.current ? 'Led' : 'Won'} by ${shortName(top)}${t.me && t.me.games ? ` · you ${placeLabel(t.me)}` : ''}`;
    return `<button class="season-card past" data-act="go" data-v="#/season/${esc(id)}/${esc(s.key)}">
        <span class="sc-main"><span class="sc-name">${esc(s.name)}</span><span class="ts-label sc-dates">${esc(datesLine(s))}</span><span class="sc-line">${esc(line)}</span></span>
        ${s.current ? '<span class="ts-label sc-tag">Current</span>' : s.upcoming ? '<span class="ts-label sc-tag soon">Next</span>' : ''}<span class="sc-chev">${icon('fwd', 18)}</span>
      </button>`;
  }).join('');
  return `<div class="season-list">${rows}</div>`;
}

export const seasonSheets = {
  seasonNew(app, { id, name, starts = 'today', date = '' }, head) {
    const data = crewSeasons(app, id);
    const cur = data?.current;
    const t = cur ? seasonTable(cur) : null;
    const leader = t?.rows.find((r) => r.games > 0);
    const nm = name ?? nextSeasonLabel(cur?.name, today());
    const when = starts === 'today' ? 'today' : starts === 'next' ? 'when the next round starts' : date ? `on ${shortDate(date).toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}` : 'on the date you pick';
    return `${head('Start a new season')}
      <div class="field"><label for="sn-name">Name</label><input class="input crew-input" id="sn-name" maxlength="24" value="${esc(nm)}" data-input="season-name"></div>
      <div class="field"><span class="label">Starts</span><div class="chips">
        <button class="pill" data-act="season-starts" data-v="today" aria-pressed="${starts === 'today'}">Today</button>
        <button class="pill" data-act="season-starts" data-v="next" aria-pressed="${starts === 'next'}">Next round</button>
        <label class="pill sn-date" aria-pressed="${starts === 'date'}">${icon('clock', 18)} ${date && starts === 'date' ? esc(shortDate(date)) : 'Pick date'}<input type="date" min="${today()}" value="${esc(date)}" data-change="season-date" aria-label="Pick a start date"></label>
      </div></div>
      <div class="explain"><div class="ts-label">What happens to ${esc(cur?.name || 'this season')}</div>
        <p>It ends ${esc(when)}${leader ? ` with <b>${esc(shortName(leader))}</b> in 1st` : ''}. The final standings are saved under Past seasons, and nothing gets deleted.</p>
        <p class="soft">${esc(nm || 'The new season')} starts everyone at 0. Rounds in progress count toward ${esc(cur?.name || 'the old season')}.</p></div>
      <button class="btn primary big block" data-act="season-start" data-v="${esc(id)}" ${starts === 'date' && !date ? 'disabled' : ''}>End ${esc(cur?.name || 'this season')} and start ${esc(nm || 'the new one')}</button>`;
  },
};

export default {
  enter(app) {
    const id = crewOf(app);
    app.season = { crew: id };
    if (id) loadCrew(app, id, { force: true });
  },
  topBack(app) {
    const id = app.season?.crew;
    const sub = app.route.view;
    const back = sub ? `#/season/${esc(id)}` : '#/';
    return `<button class="back" data-act="go" data-v="${back}">${icon('back', 22)}<span>${sub === 'past' ? 'Standings' : sub ? 'Seasons' : 'Home'}</span></button>`;
  },
  topRight(app) {
    const id = app.season?.crew;
    return id ? `<button class="icon-btn" data-act="crew-settings" data-v="${esc(id)}" aria-label="Crew settings">${icon('more')}</button>` : '';
  },
  render(app) {
    const id = app.season?.crew;
    const c = id ? app.crews?.[id] : null;
    const name = c?.info?.name || db.crews.get(id)?.name || 'Your crew';
    let body;
    if (!id) body = '<p class="soft">Join or start a crew first. Standings follow the people in your crew’s rounds.</p>';
    else if (c?.error && !c.rounds) body = `<p class="soft">${esc(c.error)}.</p><button class="btn block" data-act="season-retry">Try again</button>`;
    else {
      const data = crewSeasons(app, id);
      if (!data) body = '<p class="meta">Adding up your rounds…</p>';
      else if (app.route.view === 'past') body = pastView(app, id, data);
      else {
        const s = app.route.view ? data.seasons.find((x) => x.key === app.route.view) || data.current : data.current;
        body = standingsView(app, id, data, s);
      }
    }
    return `<div class="plain season-screen">
      <div class="ts-label crew-k">${esc(name)}</div>
      <h1 class="ts-title crew-h">${app.route.view === 'past' ? 'Seasons' : 'Standings'}</h1>
      ${body}</div>`;
  },
  actions: {
    'season-retry': (el, ev, app) => {
      loadCrew(app, app.season.crew, { force: true });
      app.render();
    },
    'season-new': (el, ev, app) => app.openSheet('seasonNew', { id: el.dataset.v }),
    'season-name': (el, ev, app) => { app.sheet.props.name = el.value; },
    'season-starts': (el, ev, app) => app.openSheet('seasonNew', { ...app.sheet.props, name: document.getElementById('sn-name')?.value, starts: el.dataset.v }),
    'season-date': (el, ev, app) => app.openSheet('seasonNew', { ...app.sheet.props, name: document.getElementById('sn-name')?.value, starts: 'date', date: el.value }),
    'season-start': async (el, ev, app) => {
      const p = app.sheet.props;
      const name = (document.getElementById('sn-name')?.value || p.name || '').trim();
      if (!name) { app.toast({ title: 'Give the season a name', error: true }); return; }
      const startsOn = p.starts === 'today' ? today() : p.starts === 'date' ? p.date : null;
      el.setAttribute('aria-busy', 'true');
      const res = await db.api.startSeason(p.id, name, startsOn).catch(() => null);
      if (!res?.ok) {
        el.removeAttribute('aria-busy');
        app.toast({ title: res?.error === 'not_owner' ? 'Only whoever started the crew can do this' : 'Couldn’t start the season', error: true });
        return;
      }
      app.crews[p.id].info = res.crew;
      app.closeSheet();
      app.toast({ title: `${name} ${p.starts === 'next' ? 'starts with the next round' : 'has started'}` });
      app.render();
    },
  },
};
