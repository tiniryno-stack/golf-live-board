// board.js — today's leaderboard. Hero: the leader + official line. Headlines
// strip, Teams | Players, Gross | Net (only once someone has strokes). Teams rank
// by OFFICIAL points with a provisional chip beyond the official line.

import { esc, icon, seg, clock } from '../ui.js';
import { fmtPts, fmtToPar, fmtSigned, playerLeaderboard, teamLeaderboard } from '../scoring.js';

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

function teamRowsGame(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const isPM = g.type === 'rotationPlusMinus';
  const mine = app.myTeam();
  return g.standings
    .map((s) => {
      const team = snap.teamById.get(s.teamId);
      const names = team.playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
      const prov = isPM ? s.provisionalPm : s.provisionalPoints;
      const val = isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints);
      const chip = prov ? `<span class="prov" data-prov>${isPM ? fmtSigned(prov, '') : `+${fmtPts(prov)}`} prov.</span>` : '';
      const rec = s.officialRecord;
      return `<div class="row">
        <span class="rank">${s.shared ? `T${s.rank}` : s.rank}</span>
        <div class="numcol"><div class="n">${esc(val)}</div><span class="micro">${isPM ? 'Margin' : 'Pts'}</span></div>
        <div class="body">
          <div class="meta ellipsis">${esc(names)} · thru ${Math.min(...team.playerIds.map((id) => snap.playerById.get(id).thru))}</div>
          <div class="row-title ellipsis">${esc(team.name)}${s.teamId === mine ? '<span class="me-dot" aria-label="your team"></span>' : ''}${chip}</div>
          <div class="detail">${rec.w}-${rec.l}-${rec.h} matchups · ${fmtToPar(team.toPar)} ${snap.hasStrokes ? 'net' : ''}</div>
        </div></div>`;
    })
    .join('');
}

function teamRowsStroke(app, mode) {
  const snap = app.snapshot;
  const mine = app.myTeam();
  return teamLeaderboard(snap, mode)
    .map((t, i) => {
      const names = t.playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
      const v = mode === 'gross' ? t.grossToPar : t.toPar;
      return `<div class="row"><span class="rank">${i + 1}</span>
        <div class="numcol"><div class="n">${t.thru ? fmtToPar(v) : '–'}</div><span class="micro">${mode === 'gross' ? 'Gross' : 'Net'}</span></div>
        <div class="body"><div class="meta ellipsis">${esc(names)} · thru ${t.thru}</div>
        <div class="row-title ellipsis">${esc(t.name)}${t.id === mine ? '<span class="me-dot"></span>' : ''}</div></div></div>`;
    })
    .join('');
}

function playerRows(app, mode) {
  const snap = app.snapshot;
  return playerLeaderboard(snap, mode)
    .map((p, i) => {
      const v = mode === 'gross' ? p.grossToPar : p.netToPar;
      return `<button class="row" data-act="board-player" data-v="${esc(p.id)}">
        <span class="rank">${p.thru ? i + 1 : ''}</span>
        <div class="numcol"><div class="n">${p.thru ? fmtToPar(v) : '–'}</div><span class="micro">${mode === 'gross' ? 'Gross' : 'Net'}</span></div>
        <div class="body"><div class="meta ellipsis">${esc(p.teamName || '')}${p.teamName ? ' · ' : ''}thru ${p.thru}</div>
        <div class="row-title ellipsis">${esc(p.name)}${p.id === app.me ? '<span class="me-dot"></span>' : ''}</div>
        <div class="detail">${p.thru ? `${p.grossTotal} strokes` : 'not started'}${p.strokes ? ` · gets ${p.strokes}` : ''}</div></div>
      </button>`;
    })
    .join('');
}

function hero(app, mode) {
  const snap = app.snapshot;
  const g = snap.game;
  const share = `<button class="icon-btn" data-act="board-share" aria-label="Share the round" style="background:rgba(255,255,255,.1);color:var(--hero-ink)">${icon('share')}</button>`;
  if (g) {
    const isPM = g.type === 'rotationPlusMinus';
    const top = g.standings.filter((s) => s.rank === 1);
    const val = (s) => (isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints));
    const lead = snap.officialThrough
      ? top.length === 1 ? snap.teamById.get(top[0].teamId).name : `${top.map((s) => snap.teamById.get(s.teamId).name).join(' & ')}`
      : 'Nobody yet';
    const mine = app.myTeam() ? g.standings.find((s) => s.teamId === app.myTeam()) : null;
    const you = mine && snap.officialThrough
      ? `You: ${mine.shared ? 'T-' : ''}${ordinal(mine.rank)} · ${val(mine)}${isPM ? '' : ' pts'}`
      : '';
    return `<div class="hero board-hero">
      <div class="spread"><span class="micro">${snap.roundComplete ? 'Final' : snap.officialThrough ? `Leader · official thru ${snap.officialThrough}` : 'Leader'}${top.length > 1 && snap.officialThrough ? ' · tied' : ''}</span>${share}</div>
      <div class="spread" style="align-items:flex-end">
        <div class="leader-name ellipsis" style="flex:1">${esc(lead)}</div>
        ${snap.officialThrough ? `<div class="leader-pts">${esc(val(top[0]))}</div>` : ''}
      </div>
      ${you ? `<div class="you">${esc(you)}</div>` : ''}
    </div>`;
  }
  const board = playerLeaderboard(snap, mode);
  const lead = board[0];
  return `<div class="hero board-hero">
    <div class="spread"><span class="micro">Leader${lead?.thru ? ` · thru ${lead.thru}` : ''}</span>${share}</div>
    <div class="spread" style="align-items:flex-end"><div class="leader-name ellipsis" style="flex:1">${lead?.thru ? esc(lead.name) : 'Nobody yet'}</div>
    ${lead?.thru ? `<div class="leader-pts">${fmtToPar(mode === 'gross' ? lead.grossToPar : lead.netToPar)}</div>` : ''}</div>
    ${app.myPlayer()?.thru ? `<div class="you">You: ${fmtToPar(mode === 'gross' ? app.myPlayer().grossToPar : app.myPlayer().netToPar)} thru ${app.myPlayer().thru}</div>` : ''}
  </div>`;
}

export default {
  hero: true,

  render(app) {
    const snap = app.snapshot;
    const g = snap.game;
    const hasTeams = (snap.roster.teams || []).length > 0;
    const view = hasTeams ? app.ui.boardView : 'players';
    const mode = snap.hasStrokes ? app.ui.boardMode : 'gross';
    const recent = app.headlines.slice(-2).reverse();
    const headlines = recent.length
      ? `<div class="headlines">${recent.map((h) => `<button class="headline" data-act="board-headlines"><span class="spark">${icon('spark', 16)}</span><span style="flex:1">${esc(h.text)}</span><span class="meta">${clock(h.at)}</span></button>`).join('')}</div>`
      : '';
    const segs = `<div class="segs">
      ${hasTeams ? seg('board-view', [['teams', 'Teams'], ['players', 'Players']], view) : ''}
      ${snap.hasStrokes ? seg('board-mode', [['gross', 'Gross'], ['net', 'Net']], mode) : ''}</div>`;
    const rows = view === 'teams' ? (g ? teamRowsGame(app) : teamRowsStroke(app, mode)) : playerRows(app, mode);
    let foot = '';
    if (g && view === 'teams') {
      const prov = g.provisionalHoles;
      foot = snap.roundComplete
        ? 'Final'
        : `Official through ${snap.officialThrough}${prov.length ? ` · hole${prov.length > 1 ? 's' : ''} ${prov.join(', ')} provisional` : ''}`;
    }
    const final = snap.roundComplete && g
      ? `<div class="final-banner">${esc(app.headlines.find((h) => h.type === 'roundFinal')?.text || 'Final')}</div>
         ${app.event.crew_id ? `<button class="btn ghost block" style="margin:0 0 14px" data-act="go" data-v="#/season/${esc(app.event.crew_id)}">See season standings</button>` : ''}`
      : '';
    return `${hero(app, mode)}
      <div class="sheet">
        ${final}${headlines}${segs}
        <div class="list">${rows}</div>
        ${foot ? `<div class="board-foot">${esc(foot)}</div>` : ''}
      </div>`;
  },

  mount(root, app) {
    const chip = root.querySelector('[data-prov]');
    if (chip) app.coach('prov', chip, 'These points aren’t official until the other foursome plays these holes.');
  },

  actions: {
    'board-view': (el, ev, app) => {
      app.ui.boardView = el.dataset.v;
      app.render();
    },
    'board-mode': (el, ev, app) => {
      app.ui.boardMode = el.dataset.v;
      app.render();
    },
    'board-player': (el, ev, app) => app.openSheet('player', { pid: el.dataset.v }),
    'board-headlines': (el, ev, app) => app.openSheet('headlines', {}),
    'board-share': (el, ev, app) => app.copyLink(),
  },
};
