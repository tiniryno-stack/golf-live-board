// sheets.js — slide-up overlays: who are you?, name in use, waiting to be let in,
// leave round, player detail, edit a past score, hole detail, headline feed, confirm,
// organizer PIN (unlock a finalized round).

import { esc, icon, scoreClass, clock, mark } from '../ui.js';
import { fmtToPar, fmtPts, fmtSigned, maxHoleScore, componentNames, posOf, holeAt, holesLabel, matchFor, playOrder } from '../scoring.js';
import { teamColor, headlineColor } from '../teams.js';

let lastHtml = '';
let closeTimer = null;

export function render(root, app) {
  const s = app.sheet;
  if (!s) {
    if (!root.classList.contains('open')) return;
    root.classList.remove('open');
    lastHtml = '';
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!app.sheet) root.innerHTML = '';
    }, 280);
    return;
  }
  clearTimeout(closeTimer);
  const body = (BODIES[s.type] || (() => ''))(app, s.props || {});
  const html = `<div class="scrim" data-act="sheet-close"></div>
    <div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${body}</div>`;
  if (html === lastHtml && root.classList.contains('open')) return;
  const wasOpen = root.classList.contains('open');
  const panelScroll = root.querySelector('.panel')?.scrollTop || 0;
  root.innerHTML = html;
  lastHtml = html;
  if (wasOpen) {
    root.querySelector('.panel').scrollTop = panelScroll;
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('open')));
  }
}

const head = (title) =>
  `<div class="panel-head"><h2 class="title">${esc(title)}</h2>
   <button class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('close')}</button></div>`;

function playersByCart(app) {
  const snap = app.snapshot;
  const groups = [];
  const teams = snap.roster.teams || [];
  if (teams.length) {
    for (const t of teams) {
      const ps = snap.players.filter((p) => p.teamId === t.id);
      if (ps.length) groups.push({ label: t.name, players: ps, teamId: t.id });
    }
    const loose = snap.players.filter((p) => !p.teamId);
    if (loose.length) groups.push({ label: 'No cart', players: loose });
  } else {
    for (const g of snap.roster.groups || []) {
      const ps = snap.players.filter((p) => p.groupId === g.id);
      if (ps.length) groups.push({ label: g.name, players: ps });
    }
    const loose = snap.players.filter((p) => !snap.roster.groups?.some((g) => g.id === p.groupId));
    if (loose.length) groups.push({ label: 'Players', players: loose });
  }
  return groups;
}

const BODIES = {
  who(app) {
    if (!app.snapshot) return head('Who are you?');
    const groups = playersByCart(app)
      .map(
        (g) => `<div class="who-group"><span class="micro">${g.teamId ? `<i class="jdot" style="--jersey:${teamColor(null, g.teamId)};margin-right:6px"></i>` : ''}${esc(g.label)}</span><div class="who-grid">${g.players
          .map((p) => {
            const taken = app.claimed.has(p.id) && p.id !== app.me;
            return `<button class="who-btn${taken ? ' taken' : ''}" data-act="who-pick" data-v="${esc(p.id)}">
              <span class="ellipsis">${esc(p.name)}</span>${taken ? '<span class="tag">in use</span>' : ''}</button>`;
          })
          .join('')}</div></div>`
      )
      .join('');
    return `${head('Who are you?')}
      <p class="meta" style="margin:-4px 0 14px">Tap your name to enter scores for your matchup. Everyone can watch everything.</p>
      ${groups}
      <button class="btn ghost block" data-act="sheet-close">Just watching</button>`;
  },

  taken(app, { pid }) {
    const name = app.snapshot?.playerById.get(pid)?.name || 'That name';
    return `${head(`${name} is in use`)}
      <p class="soft" style="margin:0 0 16px">Another phone is playing as ${esc(name)}. If that’s you on a new phone (or you cleared your browser), your foursome can let you in with one tap.</p>
      <div class="stack">
        <button class="btn primary big block" data-act="who-ask" data-v="${esc(pid)}">That’s me — ask my foursome</button>
        <button class="btn ghost block" data-act="who-back">Pick a different name</button>
      </div>`;
  },

  waiting(app) {
    const w = app.waiting;
    const name = app.snapshot?.playerById.get(w?.playerId)?.name || '';
    if (!w) return head('Waiting');
    if (w.status === 'denied') {
      return `${head('Not let in')}
        <p class="soft" style="margin:0 0 16px">Your foursome tapped “Not them” for ${esc(name)}. Pick your own name, or ask again.</p>
        <div class="stack"><button class="btn primary block" data-act="who-ask" data-v="${esc(w.playerId)}">Ask again</button>
        <button class="btn ghost block" data-act="who-back">Pick a different name</button></div>`;
    }
    if (w.status === 'expired') {
      return `${head('Nobody answered')}
        <p class="soft" style="margin:0 0 16px">The request expired after 5 minutes. Ask again, or have the organizer free up ${esc(name)}’s spot from Host.</p>
        <div class="stack"><button class="btn primary block" data-act="who-ask" data-v="${esc(w.playerId)}">Ask again</button>
        <button class="btn ghost block" data-act="sheet-close">Just watch for now</button></div>`;
    }
    return `${head('Waiting…')}
      <p class="soft" style="margin:0 0 16px">Waiting for your foursome to let you in as <b>${esc(name)}</b>. Anyone playing with you sees a “Let them in” banner. The organizer can approve too.</p>
      <button class="btn ghost block" data-act="sheet-close">Watch while I wait</button>`;
  },

  menu(app) {
    const p = app.myPlayer();
    const meta = [app.code, app.event?.course?.shortName || app.event?.course?.name].filter(Boolean).join(' · ');
    return `${head(app.event?.name || 'Round')}
      <p class="meta" style="margin:-4px 0 16px">${esc(meta)} · ${p ? `you\u2019re <b>${esc(p.name)}</b> on this phone` : 'watching on this phone'}</p>
      <div class="stack">
        ${p ? '' : '<button class="btn primary big block" data-act="menu-pick">Pick my name</button>'}
        ${app.snapshot?.roundComplete ? `<button class="btn primary block" data-act="menu-recap">${icon('trophy', 18)} Round recap &amp; scorecards</button>` : ''}
        ${app.snapshot?.game ? `<button class="btn block" data-act="menu-brief">${icon('spark', 18)} How today’s game works</button>` : ''}
        <button class="btn block" data-act="menu-share">${icon('share', 18)} Share round link</button>
        <button class="btn ghost block" data-act="menu-home">${icon('home', 18)} Go to Home</button>
        ${p ? '<button class="btn danger block" data-act="menu-leave">Switch to watching</button>' : ''}
      </div>
      <p class="meta" style="margin-top:12px">${p
        ? `Go to Home keeps you as ${esc(p.name)}; open the round again from Recent rounds. Switch to watching frees your name so the right person can pick it.`
        : 'Go to Home any time; the round stays in Recent rounds.'}</p>`;
  },

  leave(app) {
    const name = app.myName() || '';
    return `${head('Switch to watching?')}
      <p class="soft" style="margin:0 0 16px">${esc(name)} becomes open again and this phone watches. Picked the wrong name? This is how you fix it: switch to watching, then pick the right one.</p>
      <div class="stack">
        <button class="btn danger big block" data-act="leave-confirm">Switch to watching</button>
        <button class="btn ghost block" data-act="round-menu">Cancel</button>
      </div>`;
  },

  player(app, { pid }) {
    // Player card (designspec §5): total + to-par, net, both nines with score marks and "par 4"
    // under each hole, stat tiles, one highlight line.
    const snap = app.snapshot;
    const p = snap?.playerById.get(pid);
    if (!p) return head('Player');
    const cur = app.me === pid ? app.nextHole() : null;
    const nine = (from) => {
      const hs = snap.holes.slice(from - 1, from + 8);
      const got = hs.filter((h) => p.gross[h.n - 1] != null);
      const sum = got.reduce((a, h) => a + p.gross[h.n - 1], 0);
      const toPar = got.reduce((a, h) => a + p.gross[h.n - 1] - h.par, 0);
      const tp = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : `−${-toPar}`;
      const label = !got.length ? '–' : got.length === 9 ? `${sum} · ${tp}` : `${sum} thru ${got.length} · ${tp}`;
      return `<div class="pc-nine">
        <div class="spread"><b>${from === 1 ? 'Front 9' : 'Back 9'}</b><span class="mono meta">${label}</span></div>
        <div class="pc-holes">${hs.map((h) => `<div class="pc-h${h.n === cur ? ' cur' : ''}"><span class="mono">${h.n}</span>${mark(p.gross[h.n - 1], h.par, 28, { ghost: '–' })}<small>par ${h.par}</small></div>`).join('')}</div>
      </div>`;
    };
    const d = (h) => p.gross[h.n - 1] - h.par;
    const played = snap.holes.filter((h) => p.gross[h.n - 1] != null);
    const count = (f) => played.filter((h) => f(d(h))).length;
    const stats = [[count((x) => x < 0), 'Birdies', 'var(--sun)'], [count((x) => x === 0), 'Pars', 'var(--ink-soft)'], [count((x) => x === 1), 'Bogeys', 'color-mix(in srgb, var(--ink-soft) 50%, transparent)'], [count((x) => x >= 2), 'Double+', 'var(--bad)']];
    // One highlight: a birdie run, else the swing between nines, else the birdies.
    const order = playOrder(snap.settings);
    let line = '';
    let run = [];
    for (const n of order) {
      const g = p.gross[n - 1];
      if (g != null && g < snap.holes[n - 1].par) run.push(n);
      else { if (run.length >= 2) break; run = []; }
    }
    const nineTo = (from) => snap.holes.slice(from - 1, from + 8).filter((h) => p.gross[h.n - 1] != null).reduce((a, h) => a + d(h), 0);
    const fmt = (v) => (v === 0 ? 'even' : v > 0 ? `+${v}` : `−${-v}`);
    if (run.length >= 2) line = run.length === 2 ? `Back-to-back birdies on ${run[0]} and ${run[1]}.` : `${run.length} birdies in a row (holes ${run[0]}–${run[run.length - 1]}).`;
    if (p.thruFront && p.thruBack) line += `${line ? ' ' : ''}That’s ${fmt(nineTo(10))} on the back after ${fmt(nineTo(1))} on the front.`;
    if (!line && stats[0][0]) line = `${stats[0][0]} birdie${stats[0][0] === 1 ? '' : 's'} so far.`;
    const team = p.teamId && (app.event?.roster?.teams || []).length ? snap.teamById.get(p.teamId) : null;
    const tc = team ? teamColor(app.myTeam(), team.id) : '';
    const gtp = p.grossToPar === 0 ? 'E' : p.grossToPar > 0 ? `+${p.grossToPar}` : `−${-p.grossToPar}`;
    const ntp = p.netToPar === 0 ? 'E' : p.netToPar > 0 ? `+${p.netToPar}` : `−${-p.netToPar}`;
    return `${head(p.name)}
      <div class="pc-top">
        <div style="min-width:0">
          ${team ? `<div class="pc-team" style="color:${team.id === app.myTeam() ? 'var(--good-ink)' : tc}"><i class="jdot" style="--jersey:${tc}"></i>${esc(team.name)}</div>` : ''}
          <div class="meta">${p.strokes ? `Hcp ${p.strokes} · ` : ''}thru ${p.thru}${snap.hasStrokes && p.thru ? ` · net ${p.netTotal} (${ntp})` : ''}</div>
        </div>
        <div class="pc-total"><div class="mono">${p.grossTotal || '–'}</div><small class="mono">${p.thru ? `${gtp} gross` : ''}</small></div>
      </div>
      ${nine(1)}${nine(10)}
      <div class="pc-stats">${stats.map(([n, l, c]) => `<div class="pc-stat"><b class="mono">${n}</b><span>${l}</span><i style="background:${c};width:${Math.max(18, n * 25)}%"></i></div>`).join('')}</div>
      ${line ? `<div class="pc-hl"><span>${icon('spark', 18)}</span><span>${esc(line)}</span></div>` : ''}`;
  },

  holes(app) {
    const snap = app.snapshot;
    if (!snap) return head('Holes');
    const st = snap.settings;
    const cur = app.nextHole();
    const done = app.foursomeDone();
    const curPos = posOf(st, cur);
    const here = app.ui.hole;
    const me = app.myPlayer();
    const mine = app.myTeam();
    const groups = snap.game
      ? snap.game.rotations.map((r) => ({ from: r.from, to: r.to }))
      : [{ from: 1, to: 6 }, { from: 7, to: 12 }, { from: 13, to: 18 }];
    const rows = groups
      .map(({ from, to }) => {
        const m = mine ? matchFor(snap, mine, holeAt(st, from)) : null;
        const opp = m ? (m.teams[0] === mine ? m.teams[1] : m.teams[0]) : null;
        const vs = opp ? ` · vs <span style="color:${teamColor(mine, opp)}">${esc(snap.teamById.get(opp)?.name || opp)}</span>` : '';
        const cells = [];
        for (let pos = from; pos <= to; pos++) {
          const h = holeAt(st, pos);
          const par = snap.holes[h - 1].par;
          const g = me?.gross[h - 1];
          const ahead = !done && pos > curPos;
          const now = !done && pos === curPos;
          const cls = [h === here ? 'here' : '', now ? 'now' : '', g != null ? 'done' : ''].filter(Boolean).join(' ');
          const sub = g != null ? `<span class="score ${scoreClass(g, par)}">${g}</span>` : now ? 'Now' : `Par ${par}`;
          cells.push(`<button class="hg-cell ${cls}" data-act="hole-go" data-v="${h}" ${ahead ? 'disabled' : ''} aria-label="Hole ${h}${g != null ? `, you ${g}` : ''}">
            <span class="hg-n">${h}</span><span class="hg-s">${sub}</span></button>`);
        }
        return `<div class="hg-group"><div class="hg-label">${esc(holesLabel(st, from, to))}${vs}</div><div class="hg-row">${cells.join('')}</div></div>`;
      })
      .join('');
    return `${head('Holes')}
      <p class="meta" style="margin:-4px 0 14px">Tap a hole to look at it. Finished holes open locked: tap the box to edit.</p>
      ${rows}`;
  },

  team(app, { teamId }) {
    const snap = app.snapshot;
    const g = snap?.game;
    const team = snap?.teamById.get(teamId);
    if (!team || !g) return head('Team');
    const isPM = g.type === 'rotationPlusMinus';
    const s = g.standings.find((x) => x.teamId === teamId);
    const mine = app.myTeam();
    const color = teamColor(mine, teamId);
    if (g.type === 'splitPoint') return splitBreakdown(app, team, s, color);
    const names = team.playerIds.map((id) => snap.playerById.get(id)?.name).join(' + ');
    const rec = s.record;
    const rows = g.matches
      .filter((m) => m.teams.includes(teamId))
      .map((m) => {
        const opp = m.teams[0] === teamId ? m.teams[1] : m.teams[0];
        const status = !m.played ? 'Not started'
          : !m.final ? `${m.played} of ${m.total} played`
            : m.result === 'halved' ? 'Halved' : m.result === teamId ? 'Won' : 'Lost';
        const bonus = m.bonus?.[teamId] || 0;
        const detail = isPM
          ? `${status}${m.played ? ` · ${fmtSigned(m.margin[teamId], 'even')}` : ''}`
          : `${m.played ? `${fmtPts(m.points[teamId])}–${fmtPts(m.points[opp])} · ` : ''}${status}${bonus ? ` · <b>+${fmtPts(bonus)}</b> for the ${m.result === 'halved' ? 'halve' : 'win'}` : ''}`;
        const value = isPM ? (m.played ? fmtSigned(m.margin[teamId], 'E') : '–') : m.played ? fmtPts(m.points[teamId] + bonus) : '–';
        return `<div class="row bd-row">
          <div class="body"><div class="row-title ellipsis">${esc(m.label)} <span class="faint">vs</span> <span style="color:${teamColor(mine, opp)}">${esc(snap.teamById.get(opp)?.name || opp)}</span></div>
          <div class="detail">${detail}</div></div>
          <div class="bd-n">${value}</div></div>`;
      })
      .join('');
    const prov = isPM ? s.provisionalPm : s.provisionalPoints;
    const total = isPM ? fmtSigned(s.pm, 'E') : fmtPts(s.points);
    const split = prov
      ? `<p class="meta" style="margin:6px 0 0">${isPM ? fmtSigned(s.officialPm, 'E') : fmtPts(s.officialPoints)} official + ${isPM ? fmtSigned(prov, '') : fmtPts(prov)} provisional (the other foursome hasn’t finished those holes yet).</p>`
      : '';
    const how = isPM
      ? 'Each hole: the strokes you beat them by (Low Ball + Low Total), capped per matchup if set.'
      : `Each hole: ${g.ncomp === 2 ? 'Low Ball 1 + Low Total 1' : '1 point'}, a push ${g.halves ? `${fmtPts(g.halves)} each` : 'nothing'}.${g.bonus ? ` Win a matchup: <b>+${fmtPts(g.bonus)}</b>${g.halves ? ` (halved: ${fmtPts(g.bonus * g.halves)} each)` : ''}.` : ''}`;
    return `${head(team.name)}
      <p class="meta" style="margin:-4px 0 14px">${esc(names)} · ${s.shared ? 'T' : ''}${s.rank}${['th', 'st', 'nd', 'rd'][(s.rank % 100 >= 11 && s.rank % 100 <= 13) || s.rank % 10 > 3 ? 0 : s.rank % 10]} · ${rec.w}-${rec.l}-${rec.h}</p>
      <div class="list bd">${rows}
        <div class="row bd-row bd-total"><div class="body"><div class="row-title">Total</div></div><div class="bd-n" style="color:${color}">${total}</div></div>
      </div>
      ${split}
      <p class="meta" style="margin:10px 0 0">${how}</p>`;
  },

  edit(app, { pid, hole }) {
    const snap = app.snapshot;
    const p = snap?.playerById.get(pid);
    if (!p) return head('Edit');
    const par = snap.holes[hole - 1].par;
    const g = p.gross[hole - 1];
    const max = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
    const meta = p.meta[hole - 1];
    return `${head(`Hole ${hole} · ${p.name}`)}
      <p class="meta" style="margin:-4px 0 4px">Par ${par} · Hcp ${snap.holes[hole - 1].si}${p.dots[hole - 1] ? ` · ${'•'.repeat(p.dots[hole - 1])} stroke` : ''}${meta?.by ? ` · last by ${esc(meta.by)} ${clock(meta.at)}` : ''}</p>
      <div class="edit-tile">
        <button class="step" data-act="edit-step" data-d="-1" ${g != null && g <= 1 ? 'disabled' : ''} aria-label="One less">${icon('minus', 26)}</button>
        <button class="score ${scoreClass(g, par)}" data-act="edit-tap">${g ?? 'Tap'}</button>
        <button class="step" data-act="edit-step" data-d="1" ${g != null && g >= max ? 'disabled' : ''} aria-label="One more">${icon('plus', 26)}</button>
      </div>
      <div class="spread"><button class="btn ghost" data-act="edit-clear" ${g == null ? 'disabled' : ''}>Clear</button>
      <button class="btn primary" style="flex:1" data-act="sheet-close">Done</button></div>`;
  },

  hole(app, { matchId, hole }) {
    const snap = app.snapshot;
    const m = snap?.game?.matches.find((x) => x.id === matchId);
    if (!m) return head(`Hole ${hole}`);
    const hh = m.holes.find((x) => x.hole === hole);
    const par = snap.holes[hole - 1].par;
    const names = componentNames(snap.settings.teamScore);
    const rows = m.teams
      .map((t) => {
        const team = snap.teamById.get(t);
        const ps = team.playerIds.map((id) => snap.playerById.get(id));
        return `<div class="row"><div class="body"><div class="row-title">${esc(team.name)}</div>
          <div class="detail">${ps.map((p) => `${esc(p.name)} ${p.gross[hole - 1] ?? '–'}${p.dots[hole - 1] ? ` (net ${p.net[hole - 1] ?? '–'})` : ''}`).join(' · ')}</div>
          <div class="detail">${hh.comps[t] ? names.map((n, i) => `${n} ${hh.comps[t][i]}`).join(' · ') : 'pending'}</div></div>
          <div class="numcol" style="text-align:right"><div class="n">${hh.points ? fmtPts(hh.points[t]) : '–'}</div><span class="micro">pts</span></div></div>`;
      })
      .join('');
    return `${head(`Hole ${hole}`)}<p class="meta" style="margin:-4px 0 8px">Par ${par} · Hcp ${snap.holes[hole - 1].si}</p><div class="list">${rows}</div>`;
  },

  headlines(app) {
    const list = app.headlines.slice().reverse();
    return `${head('Headlines')}
      ${list.length ? `<div class="headlines">${list
        .map((h) => `<div class="headline" style="--jersey:${headlineColor(app.myTeam(), h)}"><span class="spark">${icon('spark', 16)}</span><span style="flex:1">${esc(h.text)}</span><span class="meta">${clock(h.at)}</span></div>`)
        .join('')}</div>` : '<p class="empty-state">No big moments yet. They show up once both foursomes have played a hole.</p>'}`;
  },

  pin(app) {
    return `${head('Fix a score')}
      <p class="soft" style="margin:0 0 14px">The round is final, so scores are locked. The organizer PIN unlocks them on this phone.</p>
      <div class="field"><label for="pin-unlock">Organizer PIN</label>
        <input class="input pin-input" id="pin-unlock" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" data-enter="pin-unlock"></div>
      <div class="stack"><button class="btn primary big block" data-act="pin-unlock">Unlock</button>
      <button class="btn ghost block" data-act="sheet-close">Cancel</button></div>`;
  },

  confirm(app, p) {
    return `${head(p.title)}
      <p class="soft" style="margin:0 0 16px">${esc(p.body || '')}</p>
      <div class="stack"><button class="btn ${p.danger ? 'danger' : 'primary'} big block" data-act="confirm-ok">${esc(p.ok || 'OK')}</button>
      <button class="btn ghost block" data-act="sheet-close">Cancel</button></div>`;
  },
};


/** Split point: one player's holes, each with the points they took and who they split with. */
function splitBreakdown(app, team, s, color) {
  const snap = app.snapshot;
  const g = snap.game;
  const t = team.id;
  const p = snap.playerById.get(team.playerIds[0]);
  const rows = playOrder(snap.settings)
    .map((h) => g.holes[h - 1])
    .filter((hh) => hh.complete)
    .map((hh) => {
      const pts = hh.points[t];
      const others = hh.winners.filter((x) => x !== t).map((x) => snap.teamById.get(x)?.name || x);
      const v = snap.hasStrokes ? `net ${hh.net[t]}` : `${hh.net[t]}`;
      const what = !pts ? 'no point' : others.length ? `split with ${others.join(' & ')}` : 'won it';
      return `<div class="row bd-row"><div class="body"><div class="row-title">Hole ${hh.hole} <span class="faint">· par ${snap.holes[hh.hole - 1].par}</span></div>
        <div class="detail">${esc(v)} · ${esc(what)}</div></div>
        <div class="bd-n"${pts ? '' : ' style="opacity:.4"'}>${pts ? fmtPts(pts) : '0'}</div></div>`;
    })
    .join('');
  const rank = `${s.shared ? 'T' : ''}${s.rank}${['th', 'st', 'nd', 'rd'][(s.rank % 100 >= 11 && s.rank % 100 <= 13) || s.rank % 10 > 3 ? 0 : s.rank % 10]}`;
  return `${head(team.name)}
    <p class="meta" style="margin:-4px 0 14px">${rank} · ${s.won} won · ${s.split} split${p ? ` · thru ${p.thru}` : ''}</p>
    <div class="list bd">${rows || '<p class="empty-state">No holes finished yet.</p>'}
      <div class="row bd-row bd-total"><div class="body"><div class="row-title">Total</div></div><div class="bd-n" style="color:${color}">${fmtPts(s.points)}</div></div>
    </div>
    <p class="meta" style="margin:10px 0 0">Each hole: 1 point to the low ${snap.hasStrokes ? 'net ' : ''}score. A tie for low splits it (½, ⅓ or ¼ each).</p>`;
}

function editValue(app, d) {
  const { pid, hole } = app.sheet.props;
  const snap = app.snapshot;
  const p = snap.playerById.get(pid);
  const par = snap.holes[hole - 1].par;
  const max = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
  const g = p.gross[hole - 1];
  if (g == null) return Math.min(par + 1, max);
  return Math.max(1, Math.min(max, g + d));
}

export const actions = {
  'sheet-close': (el, ev, app) => app.closeSheet(),
  'who-pick': (el, ev, app) => {
    const pid = el.dataset.v;
    if (app.claimed.has(pid) && pid !== app.me) app.openSheet('taken', { pid });
    else app.claim(pid);
  },
  'who-ask': (el, ev, app) => app.requestJoin(el.dataset.v),
  'who-back': (el, ev, app) => {
    app.waiting = null;
    app.refreshClaimed();
    app.openSheet('who', {});
  },
  'leave-confirm': (el, ev, app) => app.leave(),
  'menu-leave': (el, ev, app) => app.openSheet('leave', {}),
  'menu-home': (el, ev, app) => {
    app.closeSheet();
    app.go('#/');
  },
  'hole-go': (el, ev, app) => {
    app.ui.hole = Number(el.dataset.v);
    app.ui.unlocked = null;
    app.closeSheet();
    if (app.route.tab !== 'enter') app.go(app.tabHash('enter'));
    else app.render();
  },
  'menu-recap': (el, ev, app) => {
    app.closeSheet();
    app.openRecap();
  },
  'menu-brief': (el, ev, app) => {
    app.closeSheet();
    app.openBrief();
  },
  'menu-share': (el, ev, app) => {
    app.closeSheet();
    app.copyLink();
  },
  'menu-pick': (el, ev, app) => {
    app.refreshClaimed();
    app.openSheet('who', {});
  },
  'edit-step': (el, ev, app) => {
    const { pid, hole } = app.sheet.props;
    app.setScore(pid, hole, editValue(app, Number(el.dataset.d)));
  },
  'edit-tap': (el, ev, app) => {
    const { pid, hole } = app.sheet.props;
    if (app.scoreOf(pid, hole) == null) app.setScore(pid, hole, editValue(app, 0));
  },
  'edit-clear': (el, ev, app) => {
    const { pid, hole } = app.sheet.props;
    app.setScore(pid, hole, null);
  },
  'pin-unlock': async (el, ev, app) => {
    const pin = (document.getElementById('pin-unlock')?.value || '').replace(/\D/g, '');
    if (!pin) return;
    const ok = await app.verifyAdmin(pin);
    if (!ok) {
      app.toast({ title: 'That PIN didn\u2019t work', error: true });
      return;
    }
    app.unlockFinal(); // PIN saved: unlock this phone for edits
  },
  'confirm-ok': (el, ev, app) => {
    const fn = app.sheet?.props?.onOk;
    app.closeSheet();
    fn?.();
  },
};
