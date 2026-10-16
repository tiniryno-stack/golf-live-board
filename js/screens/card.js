// card.js — Front | Back scorecard grouped by cart. Your cart and the cart you're
// playing now come first, expanded; the others collapse to one line (remembered
// per phone). Tap a cell from one of your matchups to fix it; long-press any
// cell to see who entered it. The organizer can edit every cell.

import { esc, icon, seg, scoreClass, clock } from '../ui.js';
import { fmtToPar, foursomeTeams } from '../scoring.js';
import { teamColor } from '../teams.js';
import { local } from '../db.js';

function openState(app) {
  return local.get(`glb.cardOpen.${app.code}`, {});
}

function carts(app) {
  const snap = app.snapshot;
  const teams = snap.roster.teams || [];
  if (teams.length) {
    const list = teams.map((t) => ({ key: t.id, label: t.name, players: snap.players.filter((p) => p.teamId === t.id), team: snap.teamById.get(t.id) }));
    const loose = snap.players.filter((p) => !p.teamId);
    if (loose.length) list.push({ key: 'none', label: 'No cart', players: loose });
    return list.filter((c) => c.players.length);
  }
  const groups = snap.roster.groups || [];
  return groups
    .map((g) => ({ key: g.id, label: g.name, players: snap.players.filter((p) => p.groupId === g.id) }))
    .filter((c) => c.players.length);
}

function cartToPar(cart) {
  if (cart.team) return { thru: cart.team.thru, toPar: cart.team.toPar };
  const thru = Math.min(...cart.players.map((p) => p.thru));
  return { thru, toPar: cart.players.reduce((a, p) => a + p.netToPar, 0) };
}

function table(app, cart, from) {
  const snap = app.snapshot;
  const holes = snap.holes.slice(from - 1, from + 8);
  const head = `<tr><th class="nm">Hole</th>${holes.map((h) => `<th>${h.n}</th>`).join('')}<th class="tot">Tot</th></tr>
    <tr class="par"><td class="nm">Par</td>${holes.map((h) => `<td>${h.par}</td>`).join('')}<td class="tot" style="font-weight:500">${holes.reduce((a, h) => a + h.par, 0)}</td></tr>`;
  const rows = cart.players
    .map((p) => {
      let total = 0;
      const cells = holes
        .map((h) => {
          const g = p.gross[h.n - 1];
          if (g != null) total += g;
          const editable = app.canEdit(p.id, h.n);
          return `<td class="cell"><button class="${editable ? 'editable' : ''}" ${editable ? `data-act="cell-edit"` : ''} data-hold="cell-who" data-pid="${esc(p.id)}" data-h="${h.n}" aria-label="${esc(p.name)} hole ${h.n}: ${g ?? 'no score'}">
            <span class="score ${scoreClass(g, h.par)}">${g ?? ''}</span></button></td>`;
        })
        .join('');
      return `<tr><td class="nm">${esc(p.name)}</td>${cells}<td class="tot">${total || ''}</td></tr>`;
    })
    .join('');
  return `<table class="sc">${head}${rows}</table>`;
}

export default {
  render(app) {
    const snap = app.snapshot;
    const next = app.me ? app.nextHole() : snap.officialHole || snap.order[0];
    const half = app.ui.cardHalf || (next > 9 ? 'back' : 'front');
    const from = half === 'back' ? 10 : 1;
    const list = carts(app);
    let first = [];
    if (app.me) {
      const near = foursomeTeams(snap.roster, snap.settings, app.me, app.nextHole());
      first = list.filter((c) => near.includes(c.key) || c.players.some((p) => p.id === app.me));
    }
    const ordered = [...first, ...list.filter((c) => !first.includes(c))];
    const saved = openState(app);
    const blocks = ordered
      .map((c) => {
        const open = saved[c.key] ?? (!app.me || first.includes(c));
        const s = cartToPar(c);
        const summary = `${esc(c.label)}`;
        return `<div class="cart-block${open ? '' : ' collapsed'}">
          <button class="cb-head" data-act="card-toggle" data-v="${esc(c.key)}" aria-expanded="${open}">
            ${c.team ? `<i class="jdot" style="--jersey:${teamColor(app.myTeam(), c.key)}"></i>` : ''}<span class="name ellipsis">${summary}</span>
            <span class="meta mono">thru ${s.thru} · ${s.thru ? fmtToPar(s.toPar) : '–'}</span>
            <span class="soft" style="transform:rotate(${open ? 90 : 0}deg);display:inline-flex">${icon('fwd', 16)}</span>
          </button>
          ${open ? table(app, c, from) : ''}
        </div>`;
      })
      .join('');
    return `<div class="plain">
      <h1 class="title">Scorecard</h1>
      <div class="segs">${seg('card-half', [['front', 'Front'], ['back', 'Back']], half)}</div>
      ${blocks}
      <p class="meta" style="margin-top:8px">${app.isOrganizer() ? 'Organizer: tap any cell to fix it.' : app.me ? 'Tap a shaded cell to fix a hole from one of your matchups.' : 'Pick your name to enter scores.'} Long-press a cell to see who entered it.</p>
    </div>`;
  },

  actions: {
    'card-half': (el, ev, app) => {
      app.ui.cardHalf = el.dataset.v;
      app.render();
    },
    'card-toggle': (el, ev, app) => {
      const key = `glb.cardOpen.${app.code}`;
      const s = local.get(key, {});
      const open = el.getAttribute('aria-expanded') === 'true';
      s[el.dataset.v] = !open;
      local.set(key, s);
      app.render();
    },
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
