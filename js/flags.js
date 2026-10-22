// flags.js — features that are built and shipped but switched off until Andrew turns them on.
// Flip a value to true and push (npm run stamp first) to turn it on for everyone.
export const FLAGS = {
  // Handicap numbers on the crew screens (Which one are you?, Quick players rows). Off for now (Oct 22).
  crewHandicaps: false,
  // GPS yardages: the green card on Enter (features 011 + 013). Built; off until the numbers are trusted.
  gps: false,
};
// Tests flip flags per page with `window.__GLB_FLAGS = { gps: true }` before the app loads.
if (typeof globalThis.__GLB_FLAGS === 'object') Object.assign(FLAGS, globalThis.__GLB_FLAGS);
