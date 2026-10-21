// season.js — Season standings (V1-lite), reached from Home and the final board only.
// Recomputes every round in the crew with scoring.compute() and adds them up by person.

import { esc, seg } from '../ui.js';
import { fmtPts, seasonStandings } from '../scoring.js';
import * as db from '../db.js';

async function load(app, crew) {
  try {
    const rounds = await db.fetchCrewRounds(crew);
    if (app.season?.crew !== crew) return;
    app.season = { crew, loading: false, data: seasonStandings(rounds), count: rounds.length };
  } catch {
    if (app.season?.crew !== crew) return;
    app.season = { crew, loading: false, error: 'No signal' };
  }
  app.render();
}

const record = (r) => `${r.w}-${r.l}-${r.h}`;

export default {
  enter(app) {
    const crew = app.route.crew || db.recent.all().find((r) => r.crew_id)?.crew_id || null;
    app.season = { crew, loading: !!crew };
    if (crew) load(app, crew);
  },

  render(app) {
    const s = app.season;
    const view = app.ui.seasonView || 'players';
    let body;
    if (!s?.crew) body = '<p class="soft">Play a round first. Standings follow the people in your rounds.</p>';
    else if (s.loading) body = '<p class="meta">Adding up your rounds…</p>';
    else if (s.error) body = `<p class="soft">${esc(s.error)}. </p><button class="btn block" data-act="season-retry">Try again</button>`;
    else {
      const d = s.data;
      const rows = (view === 'pairs' ? d.pairs : d.players.filter((p) => p.games > 0))
        .map((r, i) => `<div class="row">
          <span class="rank">${i + 1}</span>
          <div class="numcol" style="width:84px"><div class="n" style="font-size:22px">${record(r)}</div><span class="micro">W-L-H</span></div>
          <div class="body">
            ${view === 'pairs' ? `<div class="meta ellipsis">${esc(r.names.join(' + '))}</div><div class="row-title ellipsis">${esc(r.teamName)}</div>` : `<div class="row-title ellipsis">${esc(r.fullName || r.name)}</div>`}
            <div class="detail">${r.rounds} round${r.rounds === 1 ? '' : 's'} · ${fmtPts(r.points)} pts${r.roundsWon ? ` · won ${r.roundsWon}` : ''}</div>
          </div></div>`)
        .join('');
      body = `<p class="meta" style="margin:-8px 0 14px">${d.rounds} round${d.rounds === 1 ? '' : 's'} with a team game · finished 6-hole matchups only</p>
        <div class="segs">${seg('season-view', [['players', 'Players'], ['pairs', 'Pairs']], view)}</div>
        <div class="list">${rows || '<p class="meta">No finished matchups yet.</p>'}</div>`;
    }
    return `<div class="plain"><h1 class="title">Season</h1>${body}</div>`;
  },

  actions: {
    'season-view': (el, ev, app) => {
      app.ui.seasonView = el.dataset.v;
      app.render();
    },
    'season-retry': (el, ev, app) => {
      app.season.loading = true;
      app.render();
      load(app, app.season.crew);
    },
  },
};
