// hub.js — PURE. 039 (docs/design/features/039-home-deck/SPEC.md §1 "The dock"): which screens are the hub's tab
// roots (Home · Rounds · Crew, the labelled dock with the + beside it) and which dock a route shows. A round keeps its
// own icons-only four-tab bar; every other screen (Setup, a pushed crew screen, a passport you're viewing) has none.

/** The hub's three tabs: [id, label, icon, hash]. */
export const HUB_TABS = [
  ['home', 'Home', 'home', '#/'],
  ['rounds', 'Rounds', 'cardone', '#/locker'],
  ['crew', 'Crew', 'people', '#/season'],
];

/** The hub tab a route is the root of, or null. Rounds = your own locker (both tabs); Crew = Standings' root. */
export function hubTab(route) {
  const r = route || {};
  if (r.round) return null;
  if (r.name === 'home') return 'home';
  if (r.name === 'locker') return r.mode === 'mine' ? 'rounds' : null; // admin / someone's passport: pushed screens
  if (r.name === 'season') return r.view ? null : 'crew'; // past seasons / a season = a pushed screen
  return null;
}

export const isHub = (route) => hubTab(route) != null;

/** Which dock the screen shows: 'hub' on a tab root, 'round' in a round that's ready (not its lobby), else null. */
export function dockSet(route, { ready = true, inLobby = false } = {}) {
  if (route?.round) return ready && !inLobby ? 'round' : null;
  return isHub(route) ? 'hub' : null;
}

/** The dock's markup is built once per set and updated in place (the highlight slides); a new set = a rebuild. */
export const needsRebuild = (builtSet, set) => (builtSet || null) !== (set || null);
