// enter.js — the default tab. Compact hero (hole + matchup), your cart big on top
// (~70%) and the cart you're playing below (~30%), greyed to one slim row of small
// scores until you tap it; then it's 50/50 with theirs open and yours greyed (tap
// yours to go back; any other hole opens on yours). An empty tile shows a
// faint bogey: tap it for bogey, or − / + to step from bogey (− = par, − − = birdie).
// Long-press clears. ◀ back through the current matchup + Undo, Next hole →
// (Switch it up, Lock in / Close it out). Holes follow play order (start on 1 or 10).
// Must fit an iPhone SE with no scrolling.

import { esc, icon, scoreClass } from '../ui.js';
import {
  maxHoleScore, maxLabel, rotationFor, rotationIndexFor, foursomeFor, matchFor, componentNames,
  fmtPts, fmtSigned, playOrder, posOf, holeAt, HOLES,
} from '../scoring.js';
import { matchupAlert } from '../headlines.js';
import { teamColor, isDefaultTeamName } from '../teams.js';
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

/** Furthest hole you can step forward to: the next one your foursome hasn't finished. */
function holeLimit(app) {
  return app.nextHole();
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

/** Which cart is open for entry on this hole: 'mine' (60/40, theirs greyed) or 'opp' (50/50, yours greyed). */
function focusSide(app, hole, carts) {
  if (app.ui.enterFocus != null && app.ui.enterFocus !== hole) app.ui.enterFocus = null; // left that hole: back to 60/40
  return carts.length > 1 && app.ui.enterFocus === hole ? 'opp' : 'mine';
}

function tile(app, p, hole, dim, mini) {
  const snap = app.snapshot;
  const par = snap.holes[hole - 1].par;
  const g = p.gross[hole - 1];
  const editable = !dim && app.canEdit(p.id, hole);
  if (mini) {
    // Their cart, greyed: name + a small score on one line.
    return `<div class="tile readonly mini${g == null ? ' empty' : ''}"><div class="face" data-pid="${esc(p.id)}">
      <span class="who"><span class="ellipsis">${esc(p.name)}</span></span><span class="score ${g == null ? '' : scoreClass(g, par)}">${g ?? '–'}</span></div></div>`;
  }
  const max = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
  const dots = p.dots[hole - 1] ? `<span class="dots" aria-label="${p.dots[hole - 1]} stroke">${'<i></i>'.repeat(p.dots[hole - 1])}</span>` : '';
  // Empty tile: a faint bogey shows where − / + will start from.
  const shown = g ?? Math.min(par + 1, max);
  const face = `<span class="who"><span class="ellipsis">${esc(p.name)}</span>${dots}</span>
    <span class="score ${g == null ? 'ghost' : scoreClass(g, par)}">${shown}</span>`;
  if (!editable) {
    return `<div class="tile readonly${g == null ? ' empty' : ''}"><div class="face" data-pid="${esc(p.id)}">${g == null ? face.replace(`>${shown}<`, '>–<') : face}</div></div>`;
  }
  return `<div class="tile${g == null ? ' empty' : ''}${p.id === app.me ? ' mine' : ''}">
    <button class="step" data-act="tile-step" data-pid="${esc(p.id)}" data-d="-1" ${g != null && g <= 1 ? 'disabled' : ''} aria-label="${esc(p.name)} one less">${icon('minus', 22)}</button>
    <button class="face" data-act="tile-tap" data-hold="tile-clear" data-pid="${esc(p.id)}" aria-label="${esc(p.name)}: ${g ?? 'no score yet'}">${face}</button>
    <button class="step" data-act="tile-step" data-pid="${esc(p.id)}" data-d="1" ${g != null && g >= max ? 'disabled' : ''} aria-label="${esc(p.name)} one more">${icon('plus', 22)}</button>
  </div>`;
}

function cartCard(app, cart, hole, mine, dim) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  const comps = team?.comps[hole - 1];
  const short = snap.settings.teamScore === 'bestBallAggregate' ? ['LB', 'LT'] : componentNames(snap.settings.teamScore);
  const lblt = team && comps ? short.map((n, i) => `${n} ${comps[i]}`).join(' · ') : team ? short.map((n) => `${n} –`).join(' · ') : '';
  const label = team ? team.name : cart.players.length > 2 ? 'Your group' : 'Your cart';
  const jersey = team ? teamColor(app.myTeam(), team.id) : '';
  const name = mine && team && !dim
    ? `<button class="name name-btn" data-act="team-picker" aria-label="Name your cart"><span class="ellipsis">${esc(label)}</span>${isDefaultTeamName(team) ? '<span class="pick">Name it</span>' : ''}</button>`
    : `<span class="name ellipsis">${esc(label)}</span>`;
  // A greyed cart is one big tap target: the first tap only switches which cart is open.
  const side = mine ? 'mine' : 'opp';
  const tap = dim
    ? ` data-act="cart-focus" data-enter="cart-focus" data-v="${side}" role="button" tabindex="0" aria-label="${mine ? 'Back to your cart' : `Enter scores for ${esc(label)}`}"`
    : '';
  const chip = dim ? `<span class="focus-chip">${mine ? 'Tap to go back' : 'Tap to enter'}</span>` : '';
  return `<section class="cart ${side}${dim ? ' dim' : ' focus'}" ${jersey ? `style="--jersey:${jersey}"` : ''}${tap}>
    <div class="cart-head">${name}<span class="lblt">${esc(lblt)}</span>${chip}</div>
    <div class="tiles">${cart.players.map((p) => tile(app, p, hole, dim, dim && !mine)).join('')}</div>
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
    const st = snap.settings;
    const h = currentHole(app);
    const pos = posOf(st, h);
    const hole = snap.holes[h - 1];
    const limitPos = posOf(st, holeLimit(app));
    const lastHole = playOrder(st)[HOLES - 1];
    const myTeam = app.myTeam();
    const rot = rotationFor(st, h);
    let matchLine = '';
    if (snap.game && myTeam) {
      const m = matchFor(snap, myTeam, h);
      const opp = m ? snap.teamById.get(m.teams[0] === myTeam ? m.teams[1] : m.teams[0]) : null;
      matchLine = m
        ? `<span class="teams">Rot ${m.rotation} · ${esc(snap.teamById.get(myTeam).name)} <span class="faint">vs</span> ${esc(opp.name)}</span><span class="status">${esc(matchStatus(snap, m, myTeam))}</span>`
        : '';
    } else if (rot) {
      matchLine = `<span class="teams">${esc(rot.label)}</span>`;
    }
    const carts = cartsFor(app, h);
    const focus = focusSide(app, h, carts);
    const everyone = carts.flatMap((c) => c.players);
    const allPosted = everyone.length > 0 && everyone.every((p) => p.gross[h - 1] != null);
    const dots = playOrder(st)
      .map((n) => {
        const ids = foursomeFor(snap.roster, st, app.me, n);
        const done = ids.length && ids.every((id) => snap.playerById.get(id).gross[n - 1] != null);
        return `<i class="${n === h ? 'here' : done ? 'done' : ''}"></i>`;
      })
      .join('');
    const nextLabel = h === lastHole ? 'Finish · see the Board →' : 'Next hole →';
    return `<div class="enter">
      <div class="hero">
        <div class="hole-row">
          <button class="arrow" data-act="hole-prev" aria-label="Previous hole">${icon('back')}</button>
          <div class="hole-head">
            <div class="hole-title">Hole ${h}</div>
            <div class="hole-meta">Par ${hole.par} · Hcp ${hole.si} · ${esc(maxLabel(snap.course, st, h))}</div>
          </div>
          <button class="arrow" data-act="hole-next" aria-label="Next hole" ${pos >= limitPos ? 'disabled' : ''}>${icon('fwd')}</button>
        </div>
        ${matchLine ? `<div class="matchup-line">${matchLine}</div>` : ''}
      </div>
      <div class="sheet${focus === 'opp' ? ' even' : ''}">
        ${carts.map((c, i) => cartCard(app, c, h, i === 0, carts.length > 1 && (i === 0) === (focus === 'opp'))).join('')}
        <div class="enter-foot"><div class="holedots" aria-hidden="true">${dots}</div><span class="sync" data-sync>Synced</span></div>
        <button class="btn primary block next-btn" data-act="next-hole" ${allPosted ? '' : 'disabled'}>${nextLabel}</button>
      </div>
    </div>`;
  },

  mount(root, app) {
    if (!app.myPlayer()) return;
    if (document.querySelector('.coach')) return; // one tip at a time
    const first = root.querySelector('.cart.focus .tile.empty .face');
    const mine = root.querySelector('.cart.mine.focus');
    const theirs = root.querySelector('.cart.opp.dim');
    // Once your cart is in and theirs isn't, point at the greyed cart.
    if (mine && theirs && !mine.querySelector('.tile.empty') && theirs.querySelector('.tile.empty')) {
      app.coach('oppcart2', theirs, 'You can enter scores for the other cart in your group too. Tap their card to open it, then tap yours to come back.');
    } else if (first) {
      app.coach('tile', first, 'Tap once for bogey. Or tap − for par, − again for birdie.');
    }
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
      const d = Number(el.dataset.d);
      const g = app.scoreOf(pid, h);
      // Empty tile: step from the bogey it's showing (− = par, + = double bogey).
      const from = g ?? bogey(app, pid, h);
      const v = Math.max(1, Math.min(maxFor(app, pid, h), from + d));
      if (g == null || v !== g) app.setScore(pid, h, v);
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
      const st = app.snapshot.settings;
      const h = app.ui.hole;
      const pos = posOf(st, h);
      const rot = rotationFor(st, h);
      const floor = app.snapshot.game && rot ? rot.from : 1;
      if (pos > floor) {
        app.ui.hole = holeAt(st, pos - 1);
        app.render();
      } else {
        app.toast({ title: 'Earlier holes are on the Card', action: 'Open Card', onAction: () => app.go(app.tabHash('card')) });
      }
    },
    'hole-next': (el, ev, app) => {
      if (!app.myPlayer()) return;
      const st = app.snapshot.settings;
      const pos = posOf(st, app.ui.hole);
      if (pos < posOf(st, holeLimit(app))) {
        app.ui.hole = holeAt(st, pos + 1);
        app.render();
      }
    },
    'next-hole': (el, ev, app) => nextHole(app),
    'cart-focus': (el, ev, app) => {
      // Remembered for this hole only: any other hole opens on your cart (60/40).
      app.ui.enterFocus = el.dataset.v === 'opp' ? app.ui.hole : null;
      app.render();
    },
    'team-picker': (el, ev, app) => app.openTeamPicker(),
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
    title: `Hole ${from} saved`, action: 'Undo', ms: 3000,
    onAction: () => {
      app.ui.hole = from;
      app.render();
    },
  });
}

function nextHole(app) {
  const snap = app.snapshot;
  const st = snap.settings;
  const h = app.ui.hole;
  const pos = posOf(st, h);
  if (pos >= HOLES) {
    app.go(app.tabHash('board'));
    return;
  }
  const nh = holeAt(st, pos + 1);
  const myTeam = app.myTeam();
  const crossing = snap.game && rotationIndexFor(st, h) !== rotationIndexFor(st, nh);
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
      sub = `${next.label} vs ${name(opp)} · ${players}`;
    }
    const swap = (st.rotationMode || 'swap') === 'swap';
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
