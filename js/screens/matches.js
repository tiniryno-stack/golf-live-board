// matches.js — the showpiece. Rot 1 | Rot 2 | Rot 3; your matchup is the hero
// (big counters + 12-point tug-of-war bar); hole strip with Low Ball / Low Total
// pips; the other matchup collapsed below.

import { esc, seg, reducedMotion } from '../ui.js';
import { fmtPts, fmtSigned, rotationIndexFor, holeAt, HOLES } from '../scoring.js';
import { teamColor } from '../teams.js';

const lastFill = new Map(); // matchId → { l, r } previous points, for the slide-in

function pickRotation(app) {
  const snap = app.snapshot;
  if (app.ui.matchesRot != null) return app.ui.matchesRot;
  const hole = app.me ? app.nextHole() : holeAt(snap.settings, Math.min(HOLES, snap.officialThrough + 1));
  return Math.max(0, rotationIndexFor(snap.settings, hole));
}

function sides(app, m) {
  const mine = app.myTeam();
  return m.teams.includes(mine) ? [mine, m.teams.find((t) => t !== mine)] : [m.teams[0], m.teams[1]];
}

/** CSS vars for the two jerseys: left = your cart (green) when it's yours. */
function jerseys(app, left, right) {
  const mine = app.myTeam();
  return `--lc:${teamColor(mine, left)};--rc:${teamColor(mine, right)}`;
}

function tug(app, m, L, R, big) {
  const g = app.snapshot.game;
  const n = m.total * g.ncomp;
  const prev = lastFill.get(m.id) || { l: L, r: R };
  const animate = big && !reducedMotion();
  const cells = Array.from({ length: n }, (_, i) => {
    const lf = Math.max(0, Math.min(1, L - i));
    const rf = Math.max(0, Math.min(1, R - (n - 1 - i)));
    const plf = animate ? Math.max(0, Math.min(1, prev.l - i)) : lf;
    const prf = animate ? Math.max(0, Math.min(1, prev.r - (n - 1 - i))) : rf;
    return `<div class="seg-cell"><div class="fill l" style="width:${plf * 100}%" data-w="${lf * 100}"></div><div class="fill r" style="width:${prf * 100}%" data-w="${rf * 100}"></div></div>`;
  }).join('');
  if (big) lastFill.set(m.id, { l: L, r: R });
  return big
    ? `<div class="tug" style="grid-template-columns:repeat(${n},1fr)">${cells}<div class="mid"></div></div>`
    : `<div class="mini-bar" style="grid-template-columns:repeat(${n},1fr)">${cells}</div>`;
}

function statusLine(app, m, left, right) {
  const snap = app.snapshot;
  const g = snap.game;
  const name = (t) => snap.teamById.get(t).name;
  if (g.type === 'rotationPlusMinus') {
    const v = m.margin[left];
    if (m.final) return v === 0 ? 'Matchup halved' : `${name(v > 0 ? left : right)} won by ${Math.abs(v)}`;
    return m.played ? `${name(left)} ${fmtSigned(v, 'even')} thru ${m.played}` : 'Not started';
  }
  const a = m.points[left], b = m.points[right];
  if (m.final) return a === b ? `Matchup halved ${fmtPts(a)}–${fmtPts(b)}` : `${name(a > b ? left : right)} won ${fmtPts(Math.max(a, b))}–${fmtPts(Math.min(a, b))}`;
  if (m.clinchedBy) return `${name(m.clinchedBy)} clinched the matchup`;
  const n = m.total * g.ncomp;
  const unit = g.halves > 0 ? 0.5 : 1;
  const target = n / 2 + unit;
  const mine = app.myTeam() === left;
  const need = Math.max(0, target - a);
  return `${fmtPts(m.left)} point${m.left === 1 ? '' : 's'} left${mine && m.played ? ` · you need ${fmtPts(need)} more to clinch` : ''}`;
}

function pips(app, m, left, hh) {
  const g = app.snapshot.game;
  if (!hh.complete) return Array.from({ length: g.ncomp }, () => '<span class="pip p"></span>').join('');
  const cl = hh.comps[left], cr = hh.comps[m.teams.find((t) => t !== left)];
  return Array.from({ length: g.ncomp }, (_, k) => {
    const cls = cl[k] < cr[k] ? 'l' : cr[k] < cl[k] ? 'r' : 'h';
    return `<span class="pip ${cls}"></span>`;
  }).join('');
}

function holeStrip(app, m, left) {
  return `<div class="hole-strip">${m.holes
    .map((hh) => `<button class="hs-hole" data-act="match-hole" data-m="${m.id}" data-h="${hh.hole}" aria-label="Hole ${hh.hole}">
      <span class="n">${hh.hole}</span><span class="pips">${pips(app, m, left, hh)}</span></button>`)
    .join('')}</div>`;
}

function counters(app, m, left) {
  const g = app.snapshot.game;
  const right = m.teams.find((t) => t !== left);
  if (g.type === 'rotationPlusMinus') return [fmtSigned(m.margin[left], 'E'), fmtSigned(m.margin[right], 'E')];
  return [fmtPts(m.points[left]), fmtPts(m.points[right])];
}

function teamSide(app, t, align) {
  const snap = app.snapshot;
  const team = snap.teamById.get(t);
  const names = team.playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
  return `<div class="mh-side ${align}"><div class="mh-name ellipsis" style="color:${teamColor(app.myTeam(), t)}">${esc(team.name)}</div><div class="mh-players ellipsis">${esc(names)}</div>`;
}

export default {
  hero: true,

  render(app) {
    const snap = app.snapshot;
    const g = snap.game;
    if (!g) {
      return `<div class="plain"><h1 class="title">Matches</h1>
        <p class="soft">No team game this round${snap.roster.teams?.length === 4 ? '' : ' (it needs 4 carts of 2)'}. The live leaderboard is on the Board.</p>
        <button class="btn primary block" data-act="tab" data-v="board">See the Board</button></div>`;
    }
    const ri = pickRotation(app);
    const rot = g.rotations[ri];
    const mine = app.myTeam();
    const hero = rot.matches.find((m) => m.teams.includes(mine)) || rot.matches[0];
    const other = rot.matches.filter((m) => m !== hero);
    const [left, right] = sides(app, hero);
    const [cl, cr] = counters(app, hero, left);
    const isPM = g.type === 'rotationPlusMinus';
    const n = hero.total * g.ncomp;
    const unit = g.halves > 0 ? 0.5 : 1;

    const otherHtml = other
      .map((m) => {
        const [l, r] = sides(app, m);
        const [a, b] = counters(app, m, l);
        const open = app.ui.expandedMatch;
        return `<div class="card" style="margin:0 0 12px;${jerseys(app, l, r)}">
          <button class="mini-match" data-act="match-expand">
            <div class="spread"><span class="row-title ellipsis">${esc(snap.teamById.get(l).name)} <span class="vs">vs</span> ${esc(snap.teamById.get(r).name)}</span>
            <span class="mono" style="font-weight:700;white-space:nowrap">${esc(a)} – ${esc(b)}</span></div>
            <div class="meta" style="margin-top:2px">${esc(statusLine(app, m, l, r))}</div>
            ${isPM ? '' : tug(app, m, m.points[l], m.points[r], false)}
          </button>
          ${open ? `<div style="margin-top:12px">${holeStrip(app, m, l)}</div>` : ''}
        </div>`;
      })
      .join('');

    return `<div class="hero match-hero" style="${jerseys(app, left, right)}">
        ${seg('matches-rot', g.rotations.map((r, i) => [String(i), `Rot ${i + 1}`]), String(ri))}
        <div class="meta" style="text-align:center;margin:10px 0 4px">${esc(rot.label)}${hero.final ? ' · final' : ''}</div>
        <div class="mh-teams">
          ${teamSide(app, left, 'left')}<div class="mh-count num" style="color:var(--lc)">${esc(cl)}</div></div>
          <div class="mh-mid">vs</div>
          ${teamSide(app, right, 'right')}<div class="mh-count num" style="color:var(--rc)">${esc(cr)}</div></div>
        </div>
        ${isPM ? '' : tug(app, hero, hero.points[left], hero.points[right], true)}
        <div class="mh-status">${esc(statusLine(app, hero, left, right))}${isPM || hero.final || hero.clinchedBy ? '' : ` <span class="clinch">· ${fmtPts(n / 2 + unit)} clinches</span>`}</div>
      </div>
      <div class="sheet">
        <div class="micro" style="margin:0 0 8px">${g.ncomp > 1 ? 'Low Ball · Low Total by hole' : 'By hole'} · tap a hole</div>
        <div style="${jerseys(app, left, right)}">${holeStrip(app, hero, left)}</div>
        ${other.length ? `<div class="micro" style="margin:4px 0 8px">The other matchup</div>${otherHtml}` : ''}
      </div>`;
  },

  mount(root) {
    const fills = root.querySelectorAll('.tug .fill');
    if (!fills.length) return;
    requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((f) => (f.style.width = `${f.dataset.w}%`))));
  },

  actions: {
    'matches-rot': (el, ev, app) => {
      app.ui.matchesRot = Number(el.dataset.v);
      app.render();
    },
    'match-expand': (el, ev, app) => {
      app.ui.expandedMatch = !app.ui.expandedMatch;
      app.render();
    },
    'match-hole': (el, ev, app) => app.openSheet('hole', { matchId: el.dataset.m, hole: Number(el.dataset.h) }),
  },
};
