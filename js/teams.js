// teams.js — cart "jerseys" and the quick team names.
//
// Home jersey: your own cart is always green (--good) on your phone.
// Away jerseys: every other cart has a fixed color that looks the same to everyone.
// (Red is avoided on purpose: red already means double bogey and errors.)

export const TEAM_NAME_PICKS = ['Bulbasaur', 'Charmander', 'Squirtle', 'Chikorita', 'Cyndaquil', 'Totodile'];

const AWAY = { A: '--t-A', B: '--t-B', C: '--t-C', D: '--t-D' };

/** CSS color for a cart as seen from this phone. */
export function teamColor(myTeamId, teamId) {
  if (teamId && teamId === myTeamId) return 'var(--good)';
  return AWAY[teamId] ? `var(${AWAY[teamId]})` : 'var(--ink-soft)';
}

/** A team still has its placeholder name ("Cart A"…) and can pick one. */
export function isDefaultTeamName(team) {
  return !team?.name || /^Cart [A-D]$/i.test(String(team.name).trim());
}
