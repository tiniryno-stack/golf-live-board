// board.js — today's leaderboard. Hero: the leader + official line. Headlines strip,
// Teams | Players, Gross | Net (only once someone has strokes).
// Teams: ranked by OFFICIAL points, each with a bar in its jersey color — solid =
// official, lighter = provisional (holes the other foursome hasn't played yet).
// Plus/Minus bars grow left/right from even. Players: one compact line each.

import { esc, icon, seg, clock } from '../ui.js';
import { fmtPts, fmtToPar, fmtSigned, playerLeaderboard, teamLeaderboard, holeAt } from '../scoring.js';
import { teamColor, headlineColor } from '../teams.js';
import { latestMoment } from '../headlines.js';

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

function teamBar(isPM, s, scale) {
  if (isPM) {
    const off = s.officialPm, prov = s.provisionalPm;
    const w = (v) => `${Math.min(50, (Math.abs(v) / scale) * 50)}%`;
    const side = (v) => (v >= 0 ? 'left:50%' : 'right:50%');
    return `<div class="tbar pm"><span class="mid"></span>
      ${off ? `<span class="fill" style="${side(off)};width:${w(off)}"></span>` : ''}
      ${prov ? `<span class="fill prov" style="${side(off + prov)};width:${w(off + prov)}"></span>` : ''}</div>`;
  }
  const pct = (v) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;
  return `<div class="tbar"><span class="fill prov" style="width:${pct(s.officialPoints + s.provisionalPoints)}"></span><span class="fill" style="width:${pct(s.officialPoints)}"></span></div>`;
}

function teamRowsGame(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const isPM = g.type === 'rotationPlusMinus';
  const mine = app.myTeam();
  const scale = isPM
    ? Math.max(1, ...g.standings.map((s) => Math.max(Math.abs(s.officialPm), Math.abs(s.officialPm + s.provisionalPm))))
    : Math.max(1, ...g.standings.map((s) => s.officialPoints + s.provisionalPoints));
  return g.standings
    .map((s) => {
      const team = snap.teamById.get(s.teamId);
      const names = team.playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
      const prov = isPM ? s.provisionalPm : s.provisionalPoints;
      const val = isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints);
      const chip = prov ? `<span class="prov" data-prov>${isPM ? fmtSigned(prov, '') : `+${fmtPts(prov)}`} prov.</span>` : '';
      const rec = s.officialRecord;
      const thru = Math.min(...team.playerIds.map((id) => snap.playerById.get(id).thru));
      return `<div class="row team-row tap" role="button" tabindex="0" data-act="board-team" data-enter="board-team" data-v="${esc(s.teamId)}" aria-label="${esc(team.name)}: breakdown" style="--jersey:${teamColor(mine, s.teamId)}">
        <span class="rank">${s.shared ? `T${s.rank}` : s.rank}</span>
        <div class="numcol"><div class="n" style="color:var(--jersey)">${esc(val)}</div><span class="micro">${isPM ? 'Margin' : 'Pts'}</span></div>
        <div class="body">
          <div class="spread"><span class="row-title ellipsis">${esc(team.name)}${s.teamId === mine ? '<span class="me-dot" aria-label="your team"></span>' : ''}</span>${chip}</div>
          ${teamBar(isPM, s, scale)}
          <div class="detail ellipsis">${esc(names)} · ${rec.w}-${rec.l}-${rec.h} · thru ${thru}</div>
        </div><span class="chev" aria-hidden="true">${icon('fwd', 16)}</span></div>`;
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
      return `<div class="row team-row" style="--jersey:${teamColor(mine, t.id)}"><span class="rank">${i + 1}</span>
        <div class="numcol"><div class="n">${t.thru ? fmtToPar(v) : '–'}</div><span class="micro">${mode === 'gross' ? 'Gross' : 'Net'}</span></div>
        <div class="body"><div class="meta ellipsis">${esc(names)} · thru ${t.thru}</div>
        <div class="row-title ellipsis">${esc(t.name)}${t.id === mine ? '<span class="me-dot"></span>' : ''}</div></div></div>`;
    })
    .join('');
}

function playerRows(app, mode) {
  const snap = app.snapshot;
  const mine = app.myTeam();
  const rows = playerLeaderboard(snap, mode)
    .map((p, i) => {
      const v = mode === 'gross' ? p.grossToPar : p.netToPar;
      const jersey = p.teamId ? `style="--jersey:${teamColor(mine, p.teamId)}"` : '';
      return `<button class="prow" data-act="board-player" data-v="${esc(p.id)}" ${jersey}>
        <span class="rank">${p.thru ? i + 1 : ''}</span>
        <span class="ptp${p.thru && v < 0 ? ' good' : ''}">${p.thru ? fmtToPar(v) : '–'}</span>
        <span class="pwho">${p.teamId ? '<i class="jdot"></i>' : ''}<span class="pname">${esc(p.name)}</span>${p.id === app.me ? '<span class="me-dot"></span>' : ''}<span class="pteam">${esc(p.teamName || '')}${p.strokes ? ` · gets ${p.strokes}` : ''}</span></span>
        <span class="pnum r">${p.thru || '–'}</span>
        <span class="pnum r">${p.thru ? p.grossTotal : '–'}</span>
      </button>`;
    })
    .join('');
  return `<div class="prow-head"><span></span><span>${mode === 'gross' ? 'Gross' : 'Net'}</span><span>Player</span><span class="r">Thru</span><span class="r">Tot</span></div>${rows}`;
}

function hero(app, mode) {
  const snap = app.snapshot;
  const g = snap.game;
  if (g) {
    const isPM = g.type === 'rotationPlusMinus';
    const top = g.standings.filter((s) => s.rank === 1);
    const val = (s) => (isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints));
    const lead = snap.officialThrough
      ? top.length === 1 ? snap.teamById.get(top[0].teamId).name : `${top.map((s) => snap.teamById.get(s.teamId).name).join(' & ')}`
      : 'Nobody yet';
    const leadColor = snap.officialThrough && top.length === 1 ? teamColor(app.myTeam(), top[0].teamId) : 'var(--hero-ink)';
    const mine = app.myTeam() ? g.standings.find((s) => s.teamId === app.myTeam()) : null;
    const you = mine && snap.officialThrough
      ? `You: ${mine.shared ? 'T-' : ''}${ordinal(mine.rank)} · ${val(mine)}${isPM ? '' : ' pts'}`
      : '';
    return `<div class="hero board-hero">
      <div class="micro">${snap.roundComplete ? 'Final' : snap.officialThrough ? `Leader · official thru ${snap.officialHole}` : 'Leader'}${top.length > 1 && snap.officialThrough ? ' · tied' : ''}</div>
      <div class="spread" style="align-items:flex-end">
        <div class="leader-name ellipsis" style="flex:1;color:${leadColor}">${esc(lead)}</div>
        ${snap.officialThrough ? `<div class="leader-pts">${esc(val(top[0]))}</div>` : ''}
      </div>
      ${you ? `<div class="you">${esc(you)}</div>` : ''}
    </div>`;
  }
  const board = playerLeaderboard(snap, mode);
  const lead = board[0];
  return `<div class="hero board-hero">
    <div class="micro">Leader${lead?.thru ? ` · thru ${lead.thru}` : ''}</div>
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
    // Headlines are about the team race: they live on the Teams view so Players fits all 8 rows.
    // One at a time: the newest moment's headline. Two that landed on the same score
    // show together for a few seconds (app.ui.headlinePair), then it's back to one.
    const moment = view === 'teams' ? latestMoment(app.headlines) : [];
    const pair = app.ui.headlinePair;
    const two = pair && pair.until > Date.now() && moment.length > 1 && pair.id === moment[0].id;
    const recent = moment.slice(0, two ? 2 : 1);
    const headlines = recent.length
      ? `<div class="headlines compact">${recent.map((h) => `<button class="headline" data-act="board-headlines" style="--jersey:${headlineColor(app.myTeam(), h)}"><span class="spark">${icon('spark', 14)}</span><span style="flex:1;min-width:0">${esc(h.text)}</span><span class="meta">${clock(h.at)}</span></button>`).join('')}</div>`
      : '';
    const segs = `<div class="segs board-segs">
      ${hasTeams ? seg('board-view', [['teams', 'Teams'], ['players', 'Players']], view) : ''}
      ${snap.hasStrokes ? seg('board-mode', [['gross', 'Gross'], ['net', 'Net']], mode) : ''}
      <button class="icon-btn" data-act="board-share" aria-label="Share the round" style="width:46px;height:46px;border-radius:14px">${icon('share')}</button></div>`;
    const rows = view === 'teams' ? (g ? teamRowsGame(app) : teamRowsStroke(app, mode)) : playerRows(app, mode);
    let foot = '';
    if (g && view === 'teams') {
      const prov = g.provisionalHoles;
      foot = snap.roundComplete
        ? 'Final'
        : snap.officialThrough
          ? `Official through hole ${snap.officialHole}${prov.length ? ` · ${prov.length > 1 ? 'holes' : 'hole'} ${prov.join(', ')} provisional (lighter bar)` : ''}`
          : `Points go official once both foursomes finish hole ${holeAt(snap.settings, 1)}`;
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
    'board-team': (el, ev, app) => app.openSheet('team', { teamId: el.dataset.v }),
    'board-headlines': (el, ev, app) => app.openSheet('headlines', {}),
    'board-share': (el, ev, app) => app.copyLink(),
  },
};
