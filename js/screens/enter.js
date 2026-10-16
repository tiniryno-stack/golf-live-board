// enter.js — the default tab. Compact hero (hole + matchup), two cart cards
// (your cart on top), first tap = bogey, − / + to adjust, long-press clears,
// ◀ back through the current matchup + Undo, Next hole → (Switch it up,
// Lock in / Close it out). Must fit an iPhone SE with no scrolling.

import { esc, icon, scoreClass } from '../ui.js';
import {
  maxHoleScore, maxLabel, rotationFor, rotationIndexFor, foursomeFor, matchFor, componentNames,
  fmtPts, fmtSigned, HOLES,
} from '../scoring.js';
import { matchupAlert } from '../headlines.js';
import { local } from '../db.js';

/** "+2 thru 4" / "All square" from this team's side of its current matchup. */
export function matchStatus(snap, m, teamId) {
  if (!m) return '';
  const opp = m.teams[0] === teamId ? m.teams[1] : m.teams[0];
  if (!m.played) return 'not started';
  const v = snap.game.type === 'rotationPlusMinus' ? m.margin[teamId] : m.points[teamId] - m.points[opp];
  const s = v === 0 ? 'All square' : fmtSigned(v);
  return m.final ? `${s} · final` : `${s} thru ${m.played}`;
}

function holeLimit(app) {
  return Math.min(HOLES, app.nextHole());
}

function currentHole(app) {
  if (app.ui.hole == null) app.ui.hole = holeLimit(app);
  return app.ui.hole;
}

function cartsFor(app, hole) {
  const snap = app.snapshot;
  const ids = foursomeFor(snap.roster, snap.settings, app.me, hole);
  const carts = [];
  for (const id of ids) {
    const p = snap.playerById.get(id);
    let c = carts.find((x) => x.teamId === p.teamId);
    if (!c) carts.push((c = { teamId: p.teamId, players: [] }));
    c.players.push(p);
  }
  return carts;
}

function tile(app, p, hole) {
  const snap = app.snapshot;
  const par = snap.holes[hole - 1].par;
  const g = p.gross[hole - 1];
  const editable = app.canEdit(p.id, hole);
  const max = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
  const dots = p.dots[hole - 1] ? `<span class="dots" aria-label="${p.dots[hole - 1]} stroke">${'<i></i>'.repeat(p.dots[hole - 1])}</span>` : '';
  const face = `<span class="who"><span class="ellipsis">${esc(p.name)}</span>${dots}</span>
    <span class="score ${scoreClass(g, par)}">${g ?? 'Tap'}</span>`;
  if (!editable) {
    return `<div class="tile readonly${g == null ? ' empty' : ''}"><div class="face">${face}</div></div>`;
  }
  return `<div class="tile${g == null ? ' empty' : ''}${p.id === app.me ? ' mine' : ''}">
    <button class="step" data-act="tile-step" data-pid="${esc(p.id)}" data-d="-1" ${g != null && g <= 1 ? 'disabled' : ''} aria-label="${esc(p.name)} one less">${icon('minus', 22)}</button>
    <button class="face" data-act="tile-tap" data-hold="tile-clear" data-pid="${esc(p.id)}" aria-label="${esc(p.name)}: ${g ?? 'no score'}">${face}</button>
    <button class="step" data-act="tile-step" data-pid="${esc(p.id)}" data-d="1" ${g != null && g >= max ? 'disabled' : ''} aria-label="${esc(p.name)} one more">${icon('plus', 22)}</button>
  </div>`;
}

function cartCard(app, cart, hole, first) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  const comps = team?.comps[hole - 1];
  const short = snap.settings.teamScore === 'bestBallAggregate' ? ['LB', 'LT'] : componentNames(snap.settings.teamScore);
  const lblt = team && comps ? short.map((n, i) => `${n} ${comps[i]}`).join(' · ') : team ? short.map((n) => `${n} –`).join(' · ') : '';
  const label = team ? team.name : cart.players.length > 2 ? 'Your group' : 'Your cart';
  return `<section class="cart${first ? ' mine' : ''}">
    <div class="cart-head"><span class="name ellipsis">${esc(label)}</span><span class="lblt">${esc(lblt)}</span></div>
    <div class="tiles">${cart.players.map((p) => tile(app, p, hole)).join('')}</div>
  </section>`;
}

function watchView(app) {
  const org = app.isOrganizer();
  return `<div class="enter">
    <div class="hero"><div class="hole-head" style="padding:6px 0 0"><div class="hole-title">Watching</div>
      <div class="hole-meta">${esc(app.event.name)}</div></div></div>
    <div class="sheet"><div class="watch-card">
      <p class="soft" style="margin:0">Pick your name to enter scores for your matchup. Everyone can watch everything.${org ? ' As organizer you can also fix any score from the Card.' : ''}</p>
      <button class="btn primary big block" data-act="name-chip">Pick my name</button>
      <button class="btn ghost block" data-act="tab" data-v="board">See the Board</button>
    </div></div></div>`;
}

export default {
  hero: true,
  noscroll: true,

  render(app) {
    const snap = app.snapshot;
    if (!app.myPlayer()) return watchView(app);
    const h = currentHole(app);
    const hole = snap.holes[h - 1];
    const limit = holeLimit(app);
    const myTeam = app.myTeam();
    const rot = rotationFor(snap.settings, h);
    let matchLine = '';
    if (snap.game && myTeam) {
      const m = matchFor(snap, myTeam, h);
      const opp = m ? snap.teamById.get(m.teams[0] === myTeam ? m.teams[1] : m.teams[0]) : null;
      matchLine = m
        ? `<span class="teams">Rot ${m.rotation} · ${esc(snap.teamById.get(myTeam).name)} <span class="faint">vs</span> ${esc(opp.name)}</span><span class="status">${esc(matchStatus(snap, m, myTeam))}</span>`
        : '';
    } else if (rot) {
      matchLine = `<span class="teams">Holes ${rot.from}–${rot.to}</span>`;
    }
    const carts = cartsFor(app, h);
    const everyone = carts.flatMap((c) => c.players);
    const allPosted = everyone.length > 0 && everyone.every((p) => p.gross[h - 1] != null);
    const dots = snap.holes
      .map((x) => {
        const ids = foursomeFor(snap.roster, snap.settings, app.me, x.n);
        const done = ids.length && ids.every((id) => snap.playerById.get(id).gross[x.n - 1] != null);
        return `<i class="${x.n === h ? 'here' : done ? 'done' : ''}"></i>`;
      })
      .join('');
    const nextLabel = h >= HOLES ? 'Finish · see the Board →' : 'Next hole →';
    return `<div class="enter">
      <div class="hero">
        <div class="hole-row">
          <button class="arrow" data-act="hole-prev" aria-label="Previous hole">${icon('back')}</button>
          <div class="hole-head">
            <div class="hole-title">Hole ${h}</div>
            <div class="hole-meta">Par ${hole.par} · Hcp ${hole.si} · ${esc(maxLabel(snap.course, snap.settings, h))}</div>
          </div>
          <button class="arrow" data-act="hole-next" aria-label="Next hole" ${h >= limit ? 'disabled' : ''}>${icon('fwd')}</button>
        </div>
        ${matchLine ? `<div class="matchup-line">${matchLine}</div>` : ''}
      </div>
      <div class="sheet">
        ${carts.map((c, i) => cartCard(app, c, h, i === 0)).join('')}
        <div class="enter-foot"><div class="holedots" aria-hidden="true">${dots}</div><span class="sync" data-sync>Synced</span></div>
        <button class="btn primary block next-btn" data-act="next-hole" ${allPosted ? '' : 'disabled'}>${nextLabel}</button>
      </div>
    </div>`;
  },

  mount(root, app) {
    if (!app.myPlayer()) return;
    const first = root.querySelector('.tile.empty .face');
    if (first) app.coach('tile', first, 'Tap once for bogey. Tap − for par, again for birdie.');
  },

  actions: {
    'tile-tap': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      if (app.scoreOf(pid, h) != null) return;
      app.setScore(pid, h, bogey(app, pid, h));
    },
    'tile-step': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      const g = app.scoreOf(pid, h);
      if (g == null) {
        app.setScore(pid, h, bogey(app, pid, h));
        return;
      }
      const v = Math.max(1, Math.min(maxFor(app, pid, h), g + Number(el.dataset.d)));
      if (v !== g) app.setScore(pid, h, v);
    },
    'tile-clear': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      if (app.scoreOf(pid, h) == null) return;
      app.setScore(pid, h, null);
      app.toast({ title: `Cleared ${app.snapshot.playerById.get(pid)?.name || ''} on ${h}` });
    },
    'hole-prev': (el, ev, app) => {
      if (!app.myPlayer()) return;
      const h = app.ui.hole;
      const rot = rotationFor(app.snapshot.settings, h);
      const floor = app.snapshot.game && rot ? rot.from : 1;
      if (h > floor) {
        app.ui.hole = h - 1;
        app.render();
      } else {
        app.toast({ title: 'Earlier holes are on the Card', action: 'Open Card', onAction: () => app.go(app.tabHash('card')) });
      }
    },
    'hole-next': (el, ev, app) => {
      if (!app.myPlayer()) return;
      const h = app.ui.hole;
      if (h < holeLimit(app)) {
        app.ui.hole = h + 1;
        app.render();
      }
    },
    'next-hole': (el, ev, app) => nextHole(app),
  },
};

function maxFor(app, pid, h) {
  const snap = app.snapshot;
  return maxHoleScore(snap.course, snap.settings, h, snap.playerById.get(pid).dots[h - 1]);
}
function bogey(app, pid, h) {
  return Math.min(app.snapshot.holes[h - 1].par + 1, maxFor(app, pid, h));
}

function goHole(app, to, from) {
  app.ui.hole = to;
  app.render();
  app.toast({
    title: `Hole ${from} saved`, action: 'Undo', ms: 5000,
    onAction: () => {
      app.ui.hole = from;
      app.render();
    },
  });
}

function nextHole(app) {
  const snap = app.snapshot;
  const h = app.ui.hole;
  if (h >= HOLES) {
    app.go(app.tabHash('board'));
    return;
  }
  const nh = h + 1;
  const myTeam = app.myTeam();
  const crossing = snap.game && rotationIndexFor(snap.settings, h) !== rotationIndexFor(snap.settings, nh);
  if (crossing && myTeam) {
    const done = matchFor(snap, myTeam, h);
    const next = matchFor(snap, myTeam, nh);
    const name = (t) => snap.teamById.get(t)?.name || t;
    let result = '';
    if (done) {
      const opp = done.teams[0] === myTeam ? done.teams[1] : done.teams[0];
      result = snap.game.type === 'rotationPlusMinus'
        ? `${name(myTeam)} ${fmtSigned(done.margin[myTeam], 'E')} · ${name(opp)} ${fmtSigned(done.margin[opp], 'E')}`
        : `${name(myTeam)} ${fmtPts(done.points[myTeam])} – ${name(opp)} ${fmtPts(done.points[opp])}`;
    }
    let sub = '';
    if (next) {
      const opp = next.teams[0] === myTeam ? next.teams[1] : next.teams[0];
      const players = snap.teamById.get(opp).playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
      sub = `Holes ${next.from}–${next.to} vs ${name(opp)} · ${players}`;
    }
    const swap = (snap.settings.rotationMode || 'swap') === 'swap';
    app.showCard({
      kicker: 'Switch it up',
      big: done?.final ? `Rotation ${done.rotation} is in` : `On to rotation ${(done?.rotation || 0) + 1}`,
      result,
      sub,
      sub2: swap ? 'One cart waits, one moves up.' : 'Same foursome — this matchup compares scores with the other group.',
      button: `Continue to hole ${nh}`,
      onContinue: () => goHole(app, nh, h),
    });
    return;
  }
  const alert = myTeam ? matchupAlert(snap, myTeam, nh) : null;
  const key = `glb.alert.${app.code}.${nh}`;
  if (alert && !local.get(key)) {
    local.set(key, true);
    const [kicker, ...rest] = alert.text.split(' — ');
    const m = matchFor(snap, myTeam, nh);
    app.showCard({
      sunny: true,
      kicker,
      big: rest.join(' — ').replace(/^./, (c) => c.toUpperCase()),
      sub: m ? `${snap.teamById.get(myTeam).name}: ${matchStatus(snap, m, myTeam)}` : '',
      button: 'Let’s go',
      onContinue: () => goHole(app, nh, h),
    });
    return;
  }
  goHole(app, nh, h);
}
