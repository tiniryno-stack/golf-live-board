// nav.js — pure: this tab's in-app history, mirrored from hash changes, so a screen's "up" button can step back
// instead of pushing yet another entry (Standings ‹ Home, Seasons ‹ Standings, Rename ‹ Standings).
// The stack only knows what this page load saw; after a reload it starts again from the current hash.

const MAX = 40;

/** The stack after the address bar moved to `hash`. `replaced` = the move was a location.replace (no new entry). */
export function track(stack, hash, replaced = false) {
  const s = stack || [];
  if (!s.length) return [hash];
  if (s[s.length - 1] === hash) return s;
  if (replaced) return [...s.slice(0, -1), hash];
  if (s.length >= 2 && s[s.length - 2] === hash) return s.slice(0, -1); // a Back (or our own history.back())
  return [...s, hash].slice(-MAX);
}

/** How to go "up" to `target`: 'back' when it's the entry just behind this one, else 'replace' (no new entry). */
export const upPlan = (stack, target) => ((stack || []).length >= 2 && stack[stack.length - 2] === target ? 'back' : 'replace');

/** The entry just behind this one, or null. */
export const previous = (stack) => ((stack || []).length >= 2 ? stack[stack.length - 2] : null);
