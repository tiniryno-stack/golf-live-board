// flags.js — features that are built and shipped but switched off until Andrew turns them on.
// Flip a value to true and push (npm run stamp first) to turn it on for everyone.
export const FLAGS = {
  // Handicap numbers on the crew screens (Which one are you?, Quick players rows). Off for now (Oct 22).
  crewHandicaps: false,
  // GPS yardages: the green card on Enter (features 011 + 013). Built; ON since Oct 22 for Andrew to test at Twin Creeks.
  gps: true,
  // App-only (handoff 024 §6): a phone in Safari with no claim in a round is sent to Add to Home Screen
  // (app.mustUseApp). Logic only until 025 brings the real screens; anyone already playing in Safari keeps playing.
  appOnly: false,
  // Cart colors (orange, blue, pink, violet) for carts that aren't yours. Off since Nov 19: you're green,
  // everyone else is neutral. Turning it back on restores the jerseys everywhere (css --t-A…F).
  cartColors: false,
  // Cart names ("Hogan's Heroes", the Pokémon picks). Off since Nov 19: carts are shown by their players'
  // first names ("Andrew + Sean") and nobody is asked to name a cart. Names already saved stay in the round.
  cartNames: false,
};
// Tests flip flags per page with `window.__GLB_FLAGS = { gps: true }` before the app loads.
if (typeof globalThis.__GLB_FLAGS === 'object') Object.assign(FLAGS, globalThis.__GLB_FLAGS);
