// board.js — today's leaderboard. Hero: the leader + official line. Headlines strip,
// Teams | Players, Gross | Net (only once someone has strokes).
// Teams: ranked by ALL points won so far (live standings), the big number included; the part
// won on holes the other foursome hasn't played yet is provisional: "2 prov." chip (already in the number),
// striped on the bar past a divider. Match Play bar = points ÷ the most points anyone could
// have won so far (same for every team, so the longest bar is always first). Plus/Minus bars
// grow left/right from even. Headlines still fire on the official line (confirmed moments).
// Players: one compact line each.

import { esc, icon, seg, clock } from '../ui.js';
import { fmtPts, fmtToPar, fmtSigned, playerLeaderboard, teamLeaderboard, holeAt, recordLabel } from '../scoring.js';
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
  // scale = the most points any team could have won so far (same for every team), so bar
  // length follows the points and the ranking. Solid = confirmed (holes all 8 have finished),
  // striped past the divider = provisional (holes only this foursome has played).
  const pct = (v) => `${(Math.max(0, Math.min(1, v / scale)) * 100).toFixed(1)}%`;
  const label = `${fmtPts(s.points)} of ${s.available} points${s.provisionalPoints ? `, ${fmtPts(s.provisionalPoints)} provisional` : ''}`;
  const prov = s.provisionalPoints
    ? `<span class="fill prov" style="width:${pct(s.points)}"></span><span class="cut" style="left:${pct(s.officialPoints)}"></span>`
    : '';
  return `<div class="tbar" role="img" aria-label="${label}">${prov}<span class="fill" style="width:${pct(s.officialPoints)}"></span></div>`;
}

function teamRowsGame(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const isPM = g.type === 'rotationPlusMinus';
  const mine = app.myTeam();
  const scale = isPM
    ? Math.max(1, ...g.liveStandings.map((s) => Math.max(Math.abs(s.officialPm), Math.abs(s.officialPm + s.provisionalPm))))
    : Math.max(1, ...g.liveStandings.map((s) => s.available));
  return g.liveStandings
    .map((s) => {
      const team = snap.teamById.get(s.teamId);
      const names = snap.settings.solo ? '' : team.playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
      const prov = isPM ? s.provisionalPm : s.provisionalPoints;
      const val = isPM ? fmtSigned(s.pm, 'E') : fmtPts(s.points);
      // "1½ prov." = how much of the number is provisional (already counted in it).
      const chip = prov ? `<span class="prov" data-prov aria-label="${isPM ? fmtSigned(prov, '') : fmtPts(prov)} of this is provisional">${isPM ? fmtSigned(prov, '') : fmtPts(prov)} prov.</span>` : '';
      const thru = Math.min(...team.playerIds.map((id) => snap.playerById.get(id).thru));
      return `<div class="row team-row tap" role="button" tabindex="0" data-act="board-team" data-enter="board-team" data-v="${esc(s.teamId)}" aria-label="${esc(team.name)}: breakdown" style="--jersey:${teamColor(mine, s.teamId)}">
        <span class="rank">${s.shared ? `T${s.rank}` : s.rank}</span>
        <div class="numcol"><div class="n" style="color:var(--jersey)">${esc(val)}</div><span class="micro">${isPM ? 'Margin' : 'Pts'}</span></div>
        <div class="body">
          <div class="spread"><span class="row-title ellipsis">${esc(team.name)}${s.teamId === mine ? '<span class="me-dot" aria-label="your team"></span>' : ''}</span>${chip}</div>
          ${teamBar(isPM, s, scale)}
          <div class="detail ellipsis">${names ? `${esc(names)} · ` : ''}${recordLabel(g, s)} · thru ${thru}</div>
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
    // Live standings: every point won so far counts (the provisional part is marked on the rows).
    const st = snap.roundComplete ? g.standings : g.liveStandings;
    const top = st.filter((s) => s.rank === 1);
    const started = st.some((s) => s.holesPlayed > 0);
    const val = (s) => (isPM ? fmtSigned(s.pm, 'E') : fmtPts(s.points));
    const lead = started
      ? top.length === 1 ? snap.teamById.get(top[0].teamId).name : `${top.map((s) => snap.teamById.get(s.teamId).name).join(' & ')}`
      : 'Nobody yet';
    const leadColor = started && top.length === 1 ? teamColor(app.myTeam(), top[0].teamId) : 'var(--hero-ink)';
    const mine = app.myTeam() ? st.find((s) => s.teamId === app.myTeam()) : null;
    const you = mine && started
      ? `You: ${mine.shared ? 'T-' : ''}${ordinal(mine.rank)} · ${val(mine)}${isPM ? '' : ' pts'}`
      : '';
    const anyProv = st.some((s) => (isPM ? s.provisionalPm : s.provisionalPoints));
    return `<div class="hero board-hero">
      <div class="micro">${snap.roundComplete ? 'Final' : snap.officialThrough ? `Leader · official thru ${snap.officialHole}${anyProv ? ' + provisional' : ''}` : 'Leader'}${top.length > 1 && started ? ' · tied' : ''}</div>
      <div class="spread" style="align-items:flex-end">
        <div class="leader-name ellipsis" style="flex:1;color:${leadColor}">${esc(lead)}</div>
        ${started ? `<div class="leader-pts">${esc(val(top[0]))}</div>` : ''}
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

/** The round is over: a big tappable card that opens the recap (keepsake images). */
function finalCard(app) {
  const snap = app.snapshot;
  const g = snap.game;
  let who, sub;
  if (g) {
    const isPM = g.type === 'rotationPlusMinus';
    const top = g.standings.filter((s) => s.rank === 1);
    who = top.map((s) => snap.teamById.get(s.teamId).name).join(' & ');
    const v = isPM ? fmtSigned(top[0].officialPm, 'E') : `${fmtPts(top[0].officialPoints)} pts`;
    const names = top.length === 1 && !snap.settings.solo ? snap.teamById.get(top[0].teamId).playerIds.map((id) => snap.playerById.get(id).name).join(' + ') : '';
    sub = [top.length > 1 ? 'share the day' : 'win the day', v, names].filter(Boolean).join(' · ');
  } else {
    const lead = playerLeaderboard(snap, snap.hasStrokes ? 'net' : 'gross')[0];
    who = lead?.name || 'Final';
    sub = lead ? `wins at ${fmtToPar(snap.hasStrokes ? lead.netToPar : lead.grossToPar)}` : '';
  }
  const locked = app.isFinal();
  // Organizer: finalize once everyone's checked their card. Everyone else: a note until then.
  const lock = locked
    ? ''
    : app.isOrganizer()
      ? `<button class="btn primary block" style="margin:0 0 14px" data-act="board-finalize">${icon('lock', 16)} Finalize round</button>`
      : '<p class="meta final-note">Scores can still be fixed until the organizer finalizes the round.</p>';
  return `<button class="final-card" data-act="recap-open">
      <span class="fc-k">${icon('trophy', 15)} Final${locked ? ` · ${icon('lock', 13)} locked` : ''}</span>
      <span class="fc-w">${esc(who)}</span>
      <span class="fc-s">${esc(sub)}</span>
      <span class="fc-cta">Round recap &amp; scorecards ${icon('fwd', 15)}</span>
    </button>
    ${lock}
    ${app.event.crew_id ? `<button class="btn ghost block" style="margin:0 0 14px" data-act="go" data-v="#/season/${esc(app.event.crew_id)}">See season standings</button>` : ''}`;
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
    const moment = view === 'teams' && !snap.roundComplete ? latestMoment(app.headlines) : []; // the final card says it once it's over
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
      const isPMfoot = g.type === 'rotationPlusMinus';
      foot = snap.roundComplete
        ? 'Final'
        : g.type === 'splitPoint'
          ? '1 point a hole · a tie for low splits it'
          : snap.officialThrough
          ? `Official through hole ${snap.officialHole}${prov.length ? ` · ${prov.length > 1 ? 'holes' : 'hole'} ${prov.join(', ')} provisional (${isPMfoot ? 'lighter bar' : 'striped, past the line'})` : ''}`
          : `Points count now and go official once both foursomes finish hole ${holeAt(snap.settings, 1)}`;
    }
    // Finalized before every score was in: still say it's locked.
    const final = snap.roundComplete
      ? finalCard(app)
      : app.isFinal() ? `<div class="final-note locked">${icon('lock', 14)} The organizer finalized the round · scores locked</div>` : '';
    return `${hero(app, mode)}
      <div class="sheet">
        ${final}${headlines}${segs}
        <div class="list">${rows}</div>
        ${foot ? `<div class="board-foot">${esc(foot)}</div>` : ''}
      </div>`;
  },

  mount(root, app) {
    const chip = root.querySelector('[data-prov]');
    if (chip) app.coach('prov2', chip, 'These points already count. They’re provisional until the other foursome plays these holes.');
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
    'recap-open': (el, ev, app) => app.openRecap(),
    'board-finalize': (el, ev, app) => app.confirmFinalize(true),
    'board-headlines': (el, ev, app) => app.openSheet('headlines', {}),
    'board-share': (el, ev, app) => app.copyLink(),
  },
};
