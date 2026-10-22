// card.js — the classic scorecard (designspec §5). Front 9 / Back 9, rows Hole · Par · Hcp, then
// players grouped under team headers, OUT / IN totals. Score marks on every score; the current
// hole's column is tinted and a missing score there is a dashed circle. Your group is on top; any
// other group expands IN PLACE (yours collapses to a pinned green bar), never a separate screen.
// Tap a cell from your matchup to fix it (organizer: any cell); long-press = who entered it.
// Tap a name for the player card.

import { esc, icon, seg, mark, clock, foldIn } from '../ui.js?v=2d64e16';
import { foursomeFor, nextHoleFor, playOrder, HOLES } from '../scoring.js?v=2d64e16';
import { teamColor, shortTeam } from '../teams.js?v=2d64e16';

/** Foursomes on a hole, yours first (cart order inside: your cart, then the other). */
function groupsAt(app, hole) {
  const snap = app.snapshot;
  const seen = new Set();
  const out = [];
  const order = app.me ? [app.me, ...snap.players.map((p) => p.id).filter((id) => id !== app.me)] : snap.players.map((p) => p.id);
  for (const pid of order) {
    if (seen.has(pid)) continue;
    const ids = foursomeFor(snap.roster, snap.settings, pid, hole);
    const list = (ids.length ? ids : [pid]).filter((id) => !seen.has(id));
    list.forEach((id) => seen.add(id));
    out.push({ key: list.join('-'), players: list.map((id) => snap.playerById.get(id)) });
  }
  return out;
}

/** The hole a group is on (first one not everybody has posted), or null when they're done. */
function groupHole(app, g) {
  return nextHoleFor(app.snapshot, g.players[0].id);
}

function hasCarts(app) {
  return (app.event?.roster?.teams || []).length > 0;
}

function groupLabel(app, g) {
  const snap = app.snapshot;
  if (hasCarts(app)) {
    const teams = [...new Set(g.players.map((p) => p.teamId))].map((t) => snap.teamById.get(t));
    return teams.map((t, i) => `<span style="color:${teamColor(app.myTeam(), t.id)}">${esc(i ? t.name : shortTeam(t.name))}</span>`).join(' <span class="soft">+</span> ');
  }
  return esc(g.players.map((p) => p.name).join(' · '));
}

/** One nine of the grid for a group. */
function grid(app, g, from, mode, cur, tint, curColor) {
  const snap = app.snapshot;
  const holes = snap.holes.slice(from - 1, from + 8);
  const ci = cur && cur >= from && cur < from + 9 ? cur - from : -1;
  const col = (i) => (i === ci ? ' cur' : '');
  const head = `<div class="cg-row cg-hole"><span class="cg-l">Hole</span>${holes.map((h, i) => `<span class="cg-c${col(i)}"><b${i === ci ? ` style="color:${curColor}"` : ''}>${h.n}</b></span>`).join('')}<span class="cg-t">${from === 1 ? 'OUT' : 'IN'}</span></div>
    <div class="cg-row cg-par"><span class="cg-l">Par</span>${holes.map((h, i) => `<span class="cg-c${col(i)}">${h.par}</span>`).join('')}<span class="cg-t">${holes.reduce((a, h) => a + h.par, 0)}</span></div>
    <div class="cg-row cg-hcp"><span class="cg-l">Hcp</span>${holes.map((h, i) => `<span class="cg-c${col(i)}">${h.si}</span>`).join('')}<span class="cg-t"></span></div>`;
  const row = (p) => {
    let sum = 0, n = 0;
    const cells = holes.map((h, i) => {
      const v = mode === 'net' ? p.net[h.n - 1] : p.gross[h.n - 1];
      if (v != null) { sum += v; n++; }
      const pending = i === ci && v == null;
      const editable = app.canEdit(p.id, h.n);
      const inner = pending ? `<span class="mk cg-pend" style="--mk:26px;border-color:${curColor};color:${curColor}">·</span>` : mark(v, h.par, 26);
      return `<button class="cg-c cell${col(i)}${editable ? ' editable' : ''}" ${editable ? 'data-act="cell-edit"' : ''} data-hold="cell-who" data-pid="${esc(p.id)}" data-h="${h.n}" aria-label="${esc(p.name)} hole ${h.n}: ${v ?? 'no score'}">${inner}</button>`;
    }).join('');
    return `<div class="cg-row cg-p"><button class="cg-l cg-name ellipsis" data-act="card-player" data-v="${esc(p.id)}">${esc(p.name)}</button>${cells}<span class="cg-t mono">${n ? sum : '–'}</span></div>`;
  };
  let body = '';
  if (hasCarts(app)) {
    const teams = [...new Set(g.players.map((p) => p.teamId))];
    for (const t of teams) {
      const team = snap.teamById.get(t);
      const c = teamColor(app.myTeam(), t);
      body += `<div class="cg-team"><i class="jdot" style="--jersey:${c}"></i><span class="name" style="color:${t === app.myTeam() ? 'var(--cart-you-text)' : c}">${esc(team.name)}</span><span class="cg-right mono">${t === app.myTeam() ? 'you' : ''}</span></div>`;
      body += g.players.filter((p) => p.teamId === t).map(row).join('');
    }
  } else {
    body = `<div class="cg-team cg-rule"></div>${g.players.map(row).join('')}`;
  }
  return `<div class="cgrid" style="--ctint:${tint}">${head}${body}</div>`;
}

export default {
  render(app) {
    const snap = app.snapshot;
    const next = app.me ? app.nextHole() || playOrder(snap.settings)[HOLES - 1] : snap.officialHole || snap.order[0];
    const half = app.ui.cardHalf || (next > 9 ? 'back' : 'front');
    const from = half === 'back' ? 10 : 1;
    const mode = snap.hasStrokes ? app.ui.cardMode || 'gross' : 'gross';
    const groups = groupsAt(app, next);
    const [first, ...rest] = groups;
    const openKey = rest.some((g) => g.key === app.ui.cardOther) ? app.ui.cardOther : null;
    const tee = snap.course.tee?.name ? ` · ${snap.course.tee.name} tees` : '';
    const firstHole = groupHole(app, first);
    const mineBar = `<button class="mine-bar${foldIn(app.ui)}" style="--fold-h:80px" data-act="card-mine">
        <span style="flex:1;min-width:0"><span class="mb-k">${app.me ? 'YOUR GROUP' : 'GROUP 1'} · ${firstHole ? `ON ${firstHole}` : 'DONE'}</span>
        <span class="mb-t ellipsis" style="font-size:15px;font-weight:600">${esc(first.players.map((p) => p.name).join(' · '))}</span></span>
        ${icon('fwd', 18).replace('<svg', '<svg style="transform:rotate(90deg)"')}</button>`;
    const others = rest.map((g) => {
      const open = g.key === openKey;
      const gh = groupHole(app, g);
      return `<div class="watch-box${open ? ' open' : ''}" data-group="${esc(g.key)}">
        <button class="watch-head" data-act="card-other" data-v="${esc(g.key)}" aria-expanded="${open}">
          <span class="wk">${open ? 'WATCHING' : 'OTHER GROUP'}</span>
          <span class="ellipsis" style="flex:1;font-weight:700">${groupLabel(app, g)}</span>
          <span class="mono meta">${gh ? `on ${gh}` : 'done'}</span>
          <span class="chev">${icon('fwd', 18).replace('<svg', '<svg style="transform:rotate(90deg)"')}</span>
        </button>
        ${open ? `<div class="wb-grid${foldIn(app.ui)}" style="--fold-h:520px">${grid(app, g, from, mode, gh, 'var(--tint-n)', 'var(--ink-soft)')}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="plain card-nr">
      <div class="card-head">
        <div style="min-width:0"><div class="lbl ellipsis">${esc(snap.course.shortName || snap.course.name)}${esc(tee)}</div><h1 class="title">Scorecard</h1></div>
        ${snap.hasStrokes ? seg('card-mode', [['gross', 'Gross'], ['net', 'Net']], mode) : ''}
      </div>
      <div class="segs">${seg('card-half', [['front', 'Front 9'], ['back', 'Back 9']], half)}</div>
      ${openKey ? mineBar : grid(app, first, from, mode, firstHole, app.me ? 'var(--tint-you)' : 'var(--tint-n)', app.me ? 'var(--cart-you-text)' : 'var(--ink-soft)')}
      ${others}
      <div class="mk-legend" style="margin-top:12px"><span>${mark(2, 4, 12)}Eagle</span><span>${mark(3, 4, 12)}Birdie</span><span>${mark(5, 4, 12)}Bogey</span><span>${mark(6, 4, 12)}Double+</span></div>
      <p class="meta" style="margin-top:10px;text-align:center">${app.isOrganizer() ? 'Organizer: tap any cell to fix it.' : app.me ? 'Tap a score from your matchup to fix it.' : 'Pick your name to enter scores.'} Long-press a score to see who entered it. Tap a name for their card.</p>
    </div>`;
  },

  actions: {
    'card-half': (el, ev, app) => {
      app.ui.cardHalf = el.dataset.v;
      app.render();
    },
    'card-mode': (el, ev, app) => {
      app.ui.cardMode = el.dataset.v;
      app.render();
    },
    'card-other': (el, ev, app) => {
      app.ui.cardOther = app.ui.cardOther === el.dataset.v ? null : el.dataset.v;
      app.ui.foldAt = Date.now();
      app.render();
    },
    'card-mine': (el, ev, app) => {
      app.ui.cardOther = null;
      app.ui.foldAt = Date.now();
      app.render();
    },
    'card-player': (el, ev, app) => app.openSheet('player', { pid: el.dataset.v }),
    'cell-edit': (el, ev, app) => {
      const pid = el.dataset.pid;
      const hole = Number(el.dataset.h);
      if (!app.canEdit(pid, hole)) return;
      app.openSheet('edit', { pid, hole });
    },
    'cell-who': (el, ev, app) => {
      const p = app.snapshot.playerById.get(el.dataset.pid);
      const h = Number(el.dataset.h);
      const meta = p?.meta[h - 1];
      app.toast({
        title: `Hole ${h} · ${p?.name || ''}${p?.gross[h - 1] != null ? ` · ${p.gross[h - 1]}` : ''}`,
        sub: meta?.by ? `Entered by ${meta.by} at ${clock(meta.at)}` : 'No score yet',
      });
    },
  },
};
