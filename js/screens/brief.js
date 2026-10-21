// brief.js — "Today's game": two swipeable cards built from the round's settings, shown
// once per phone right after you pick your name (and name your cart), and any time from
// the ⋯ menu. Only the high-yield stuff: what a hole is worth, pushes, your matchups,
// what's up for grabs, how the day is won.

import { esc } from '../ui.js';
import { componentNames, foursomeTeams, fmtPts, holesLabel } from '../scoring.js';
import { teamColor } from '../teams.js';

const half = (n) => fmtPts(n); // 0.5 → "½"

/** HTML for each page, or [] when the round has no cart game (scorecard only). */
export function briefPages(app) {
  const snap = app.snapshot;
  const g = snap?.game;
  if (!g) return [];
  if (g.type === 'splitPoint') return [splitPage(snap)];
  return [scoringPage(snap, g, !!app.myTeam()), dayPage(app, snap, g)];
}

function rotationLength(st) {
  const lens = [...new Set(st.rotation.map((r) => r.holes[1] - r.holes[0] + 1))];
  return lens.length === 1 ? lens[0] : null;
}

// ───────────────────────────────────────────── page 1: what a hole is worth

function scoringPage(snap, g, playing) {
  const st = snap.settings;
  const pm = g.type === 'rotationPlusMinus';
  const len = rotationLength(st);
  const names = componentNames(st.teamScore);
  const both = st.teamScore === 'bestBallAggregate';
  const what = {
    'Low Ball': 'Best score in each cart',
    'Best ball': 'Best score in each cart',
    'Low Total': 'Both partners added',
    Total: 'Both partners added',
  };
  const three = !st.pairs && snap.teams.length === 3; // Partner “Rider” Cup for 6: both other carts at once
  const title = st.pairs ? (pm ? 'Rotation Plus/Minus' : 'Rotation Match Play') : `Partner “Rider” Cup${pm ? ' · Plus/Minus' : ''}`;
  const sub = three
    ? `${playing ? 'Your cart plays' : 'Each cart plays'} both other carts on every hole, all 18.`
    : `${playing ? 'Your cart vs' : 'Each cart plays'} one other cart${len ? `, ${len} holes at a time` : ', one matchup per rotation'}.`;
  const net = snap.hasStrokes ? '<p class="brief-note">Net scores: each dot by a name is a stroke off.</p>' : '';
  const defs = (rows) => `<dl class="brief-defs">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;

  if (pm) {
    const rows = names.map((n) => [n, what[n]]);
    rows.push(['Push', 'A tie is worth nothing']);
    if (g.cap != null) rows.push(['Cap', `A matchup swings <b>±${g.cap}</b> at most`]);
    const ex = both
      ? exampleBox('You 4 + 5 · Them 5 + 6', ['Low Ball 4 v 5 → <b>+1</b>', 'Low Total 9 v 11 → <b>+2</b>'], 'Hole: you +3, them −3')
      : names[0] === 'Total'
        ? exampleBox('You 4 + 5 · Them 5 + 6', ['Total 9 v 11 → <b>+2</b>'], 'Hole: you +2, them −2')
        : exampleBox('You 4 + 5 · Them 5 + 6', ['Best ball 4 v 5 → <b>+1</b>'], 'Hole: you +1, them −1');
    return `<div class="fc-title">${title}</div>
      <div class="sub">${sub}</div>
      <div class="brief-big"><span class="n">±</span><span>Every stroke counts<small>Beat theirs and the difference is yours</small></span></div>
      ${defs(rows)}${ex}${net}`;
  }

  const rows = names.map((n) => [n, what[n]]);
  rows.push(['Push', g.halves > 0 ? `A tie: <b>${half(g.halves)} point each</b>` : 'A tie: <b>nobody scores</b>']);
  let ex;
  if (both) {
    const lb = g.halves > 0 ? `push, ${half(g.halves)} each` : 'push, no point';
    const res = g.halves > 0 ? `Hole: you ${fmtPts(1 + g.halves)} – ${fmtPts(g.halves)}` : 'Hole: you 1 – 0';
    ex = exampleBox('You 4 + 5 · Them 4 + 6', [`Low Ball 4 v 4 → ${lb}`, 'Low Total 9 v 10 → <b>yours, 1</b>'], res);
  } else if (names[0] === 'Total') {
    ex = exampleBox('You 4 + 5 · Them 4 + 6', ['Total 9 v 10 → <b>yours, 1</b>'], 'Hole: you 1 – 0');
  } else {
    ex = exampleBox('You 4 + 5 · Them 5 + 6', ['Best ball 4 v 5 → <b>yours, 1</b>'], 'Hole: you 1 – 0');
  }
  return `<div class="fc-title">${title}</div>
    <div class="sub">${sub}</div>
    ${three
      ? `<div class="brief-big"><span class="n">${g.ncomp * 2}</span><span>points every hole<small>${g.ncomp} against each of the other 2 carts</small></span></div>`
      : `<div class="brief-big"><span class="n">${g.ncomp}</span><span>point${g.ncomp === 1 ? '' : 's'} every hole<small>Lower score wins ${g.ncomp === 1 ? 'it' : 'each one'}</small></span></div>`}
    ${defs(rows)}${ex}${net}`;
}

// Split point (2–4 players, no carts): one card.
function splitPage(snap) {
  const st = snap.settings;
  const n = snap.teams.length;
  const net = snap.hasStrokes ? '<p class="brief-note">Net scores: each dot by a name is a stroke off.</p>' : '';
  const rows = [['Win it', 'Low score alone: <b>1 point</b>'], ['2 tied', '<b>½ point</b> each']];
  if (n >= 3) rows.push(['3 tied', '<b>⅓ point</b> each']);
  if (n >= 4) rows.push(['4 tied', '<b>¼ point</b> each']);
  const defs = `<dl class="brief-defs">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  const ex = n >= 3
    ? exampleBox('Scores 4 · 4 · 5', ['Two tied for low at 4'], 'Hole: ½ · ½ · 0')
    : exampleBox('Scores 4 · 5', ['Low score 4'], 'Hole: 1 · 0');
  const max = st.maxHoleScore === 'none' ? '' : `<li>Pick up at <b>${st.maxHoleScore === 'netDoubleBogey' ? 'net double bogey' : 'double par'}</b>${st.par3NoMax ? ' (not on par 3s)' : ''}.</li>`;
  return `<div class="fc-title">Split point</div>
    <div class="sub">Everyone plays their own ball.</div>
    <div class="brief-big"><span class="n">1</span><span>point every hole<small>Low score takes it, ties split it</small></span></div>
    ${defs}${ex}${net}
    <ul class="brief-rules"><li><b>Most points after 18</b> wins the day.</li>${max}</ul>`;
}

function exampleBox(line, steps, result) {
  return `<div class="brief-ex">
    <div class="ex-k">Example · par 4</div>
    <div class="ex-line">${esc(line)}</div>
    ${steps.map((s) => `<div>${s}</div>`).join('')}
    <div class="ex-res">${esc(result)}</div>
  </div>`;
}

// ───────────────────────────────────────────── page 2: your day

function dayPage(app, snap, g) {
  const st = snap.settings;
  const pm = g.type === 'rotationPlusMinus';
  const mine = app.myTeam();
  const team = mine ? snap.teamById.get(mine) : null;
  const tname = (id) => esc(snap.teamById.get(id)?.name || id);
  const players = (id) => esc((snap.teamById.get(id)?.playerIds || []).map((p) => snap.playerById.get(p)?.name).join(' + '));
  const swap = (st.rotationMode || 'swap') === 'swap';

  const rows = g.rotations
    .map((r) => {
      const label = holesLabel(st, r.from, r.to);
      if (team) {
        const ms = r.matches.filter((x) => x.teams.includes(mine));
        if (!ms.length) return `<li><span class="rh">${esc(label)}</span><span class="rv">Sitting out</span></li>`;
        return ms.map((m) => {
          const opp = m.teams[0] === mine ? m.teams[1] : m.teams[0];
          const away = app.me && !foursomeTeams(snap.roster, st, app.me, m.firstHole).includes(opp);
          return `<li><span class="rh">${esc(label)}</span><span class="rv">vs <b style="color:${teamColor(mine, opp)}">${tname(opp)}</b><small>${players(opp)}${away ? ' · other group' : ''}</small></span></li>`;
        }).join('');
      }
      const ms = r.matches.map((m) => `<b style="color:${teamColor(null, m.teams[0])}">${tname(m.teams[0])}</b> v <b style="color:${teamColor(null, m.teams[1])}">${tname(m.teams[1])}</b>`);
      return `<li><span class="rh">${esc(label)}</span><span class="rv">${ms.join('<br>')}</span></li>`;
    })
    .join('');

  const perMatch = (m) => (m.to - m.from + 1) * g.ncomp;
  // Your matchups (or one per rotation when watching): a 3-cart round has two at once.
  const myMatches = team ? g.matches.filter((m) => m.teams.includes(mine)) : g.rotations.map((r) => r.matches[0]);
  const each = [...new Set(myMatches.map(perMatch))];
  const day = myMatches.reduce((a, m) => a + perMatch(m), 0);
  const stakes = pm
    ? '<li>Your <b>+/−</b> adds up across matchups. <b>Highest after 18</b> wins.</li>'
    : g.bonus
      ? `<li><b>${each.length === 1 ? each[0] : 'Up to ' + Math.max(...each)} points</b> per matchup, <b>+${fmtPts(g.bonus)}</b> for winning it.</li>`
      : `<li><b>${each.length === 1 ? each[0] : 'Up to ' + Math.max(...each)} points</b> per matchup, <b>${day}</b> on the day.</li>
       <li><b>Most points after 18</b> wins the day.</li>`;
  const len = rotationLength(st);
  const flow = swap
    ? `<li>Carts swap${len ? ` every ${len}` : ''}: one waits, one moves up.</li>`
    : '<li>Same foursome all day; some matchups are with the other group.</li>';
  const max = st.maxHoleScore === 'none' ? '' : `<li>Pick up at <b>${st.maxHoleScore === 'netDoubleBogey' ? 'net double bogey' : 'double par'}</b>${st.par3NoMax ? ' (not on par 3s)' : ''}.</li>`;
  const start = st.startHole === 10 ? '<li>Tee off on <b>10</b>, finish on <b>9</b>.</li>' : '';

  const head = team
    ? `<div class="fc-title" style="color:var(--good)">${esc(team.name)}</div><div class="sub">${players(mine)}</div>`
    : '<div class="fc-title">The matchups</div>';
  const cls = team ? 'brief-rots' : 'brief-rots all';
  return `${head}
    <ol class="${cls}">${rows}</ol>
    <ul class="brief-rules">${stakes}${start}${flow}${max}</ul>`;
}
