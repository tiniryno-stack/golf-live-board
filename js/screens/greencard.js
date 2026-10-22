// greencard.js — the green card + GPS badge on Enter (features 011 + 013). One component, two sizes
// (regular 92px / compact 68px): Enter picks the size from the room it has (enter.js measures).
// States (011): finding → "–" numbers; weak (worse than ±15 yd) → muted numbers; denied → one row
// with Turn on; no green data, GPS off for the round, or > ~600 yd away → nothing at all.
import { esc, icon } from '../ui.js';
import { FLAGS } from '../flags.js';
import { yardages, greenFor, greenSvg, yards } from '../geo.js';
import { gps } from '../gps.js';

const FAR_YD = 600;

/** Is the card on for this round + hole? (flag, round setting, green data) */
export function cardOn(app, hole) {
  const snap = app.snapshot;
  if (!FLAGS.gps || !snap || snap.settings.gps === false) return false;
  return !!greenFor(snap.course, hole);
}

/** What the card would show right now, or null when it should be hidden. */
export function cardState(app, hole) {
  if (!cardOn(app, hole)) return null;
  const g = greenFor(app.snapshot.course, hole);
  const s = gps.state();
  if (s.status === 'denied') return { kind: 'denied', g };
  if (!s.pos) return { kind: 'finding', g };
  const y = yardages(s.pos, g.green);
  if (y.middle > FAR_YD) return null;
  return { kind: s.status === 'weak' ? 'weak' : 'ok', g, y: { ...y, front: Math.max(0, y.front) }, acc: Math.round(yards(s.acc)) };
}

/** "◢ GPS · ±4 YD" / "GPS · FINDING YOU" / "GPS · WEAK" for the hole subtitle; '' when the card is off. */
export function gpsBadge(state) {
  if (!state) return '';
  const txt = state.kind === 'ok' ? `GPS · ±${state.acc} YD` : state.kind === 'weak' ? 'GPS · WEAK' : state.kind === 'denied' ? 'GPS · OFF' : 'GPS · FINDING YOU';
  return `<span class="gps-badge mono${state.kind === 'weak' || state.kind === 'denied' ? ' dim' : ''}">${icon('gps', 11)} ${txt}</span>`;
}

/** The card. `size` = 'regular' | 'compact'. */
export function greenCard(state, size = 'regular') {
  if (!state) return '';
  if (state.kind === 'denied') {
    return `<div class="green-card denied" role="group" aria-label="Location is off">
      <span class="ellipsis">Turn on location for yardages</span>
      <button class="btn ghost" data-act="gps-on">Turn on</button>
    </div>`;
  }
  const compact = size === 'compact';
  const [w, h] = compact ? [44, 46] : [62, 64];
  const n = (v) => (state.kind === 'finding' ? '–' : String(v));
  const y = state.y || {};
  const label = state.kind === 'finding' ? 'Green: finding your location' : `Green: front ${y.front}, middle ${y.middle}, back ${y.back}`;
  const from = gps.state().pos || state.g.tee;
  return `<div class="green-card${compact ? ' compact' : ''}${state.kind === 'weak' ? ' weak' : ''}${state.kind === 'finding' ? ' finding' : ''}" role="group" aria-label="${esc(label)}">
    <div class="green-pic">${greenSvg(from, state.g.green, w, h)}</div>
    <div class="green-nums mono">
      <div class="gn"><b>${n(y.front)}</b><span class="label">FRONT</span></div>
      <div class="gn mid"><b>${n(y.middle)}</b><span class="label">MIDDLE</span></div>
      <div class="gn"><b>${n(y.back)}</b><span class="label">BACK</span></div>
    </div>
  </div>`;
}
