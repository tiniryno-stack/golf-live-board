// reward.js — PURE (handoffs 021 + 022, pick rules from 033 Part 1 + 034 "Score picks v2"): the rules behind the
// approved Enter prototypes. `standing` writes halves as ½ ("1½ UP"), like everywhere else in the app.
// Tested in tests/enter021.test.mjs.
// No DOM, no app state: give them numbers, get back what to draw.

/** What a pick earns: the word (judged on NET), its style, and whether the mark stamps in.
 *  strokes = gross score, par = hole par, strokesHere = handicap strokes this player gets on this hole. */
export function reward(strokes, par, strokesHere = 0) {
  const net = strokes - strokesHere;
  const d = net - par;
  const w = d <= -3 ? (strokes === 1 ? 'Ace' : 'Albatross')
    : d === -2 ? (strokes === 1 ? 'Ace' : 'Eagle')
    : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey'
    : d === 2 ? 'Double' : d === 3 ? 'Triple' : d === 4 ? 'Quad' : `+${d}`;
  const isNet = strokesHere > 0 && net !== strokes;
  // 033 §1.3 + 034 "Score picks v2": rarer = bigger. Bogey and double keep 033's quiet motion.
  const kind = d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
  return {
    word: isNet ? `Net ${w.toLowerCase()}` : w,
    kind,                                            // CSS: .k-<kind> on the picked pad, the word and the card flash
    tone: { eagle: 'big', birdie: 'lift', par: 'par', bogey: 'quiet', double: 'dbl' }[kind],   // .ce-word.<tone>
    stamp: d >= 2,                                   // only a NET double or worse stamps
    ripples: d <= -2 ? 3 : d === -1 ? 2 : 0,         // rings off the pad
    burst: d <= -1,                                  // sparks: birdie and better
    sparks: d <= -2 ? 12 : 8,
    burst2: d <= -3 || strokes === 1,                // albatross or an ace: a second burst
    pulse: d === 0,                                  // par: one ring in the pill's own shape
    flash: d <= 0,                                   // the player's card flashes: par and better
    holdMs: d <= -2 ? 3500 : d === -1 ? 2600 : d === 0 ? 2000 : 1600,   // how long the pick's motion owns the row (the word itself stays)
  };
}

/** 034: which way the cards slide when Enter goes from one hole to another. Play order decides, so a round that
 *  starts on 10 turns forward from 18 to 1. fwd = the old cards leave to the left. */
export function turnPlan(fromHole, toHole, startHole = 1) {
  const start = Number(startHole) === 10 ? 10 : 1;
  const pos = (h) => ((h - start + 18) % 18) + 1;
  return { dir: pos(toHole) >= pos(fromHole) ? 'fwd' : 'back' };
}

/** The mark is GROSS (scorecard rule): 'cc' eagle+, 'c' birdie, '' par, 's' bogey, 'd' double+. */
export function markKind(strokes, par) {
  const d = strokes - par;
  return d <= -2 ? 'cc' : d === -1 ? 'c' : d === 0 ? '' : d === 1 ? 's' : 'd';
}

/** SVG outline paths for a mark in a size × size box, with their lengths (for stroke-dasharray / --len).
 *  Circle(s) for birdie/eagle, rounded square(s) for bogey/double; par has none. Second outline is 4.5px inside. */
export function markPaths(strokes, par, size = 40) {
  const k = markKind(strokes, par), h = size / 2;
  const circ = (r) => ({ d: `M ${h} ${h - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`, len: 2 * Math.PI * r });
  const sq = (i) => { const a = i, b = size - i; return { d: `M ${a + 4} ${a} H ${b - 4} Q ${b} ${a} ${b} ${a + 4} V ${b - 4} Q ${b} ${b} ${b - 4} ${b} H ${a + 4} Q ${a} ${b} ${a} ${b - 4} V ${a + 4} Q ${a} ${a} ${a + 4} ${a}`, len: 4 * (b - a) }; };
  if (k === 'c') return [circ(h - 1)];
  if (k === 'cc') return [circ(h - 1), circ(h - 5.5)];
  if (k === 's') return [sq(1)];
  if (k === 'd') return [sq(1), sq(5.5)];
  return [];
}

/** The hole's points line. pts = your cart's points on this hole from the engine
 *  (riderState hole entry points.us: low ball 1 + low total 1, a tie = ½ each). */
export function pointsLine(pts) {
  const whole = Math.floor(pts), half = pts - whole > 0;
  const n = (whole ? String(whole) : '') + (half ? '½' : '');
  if (pts === 0) return { text: 'No points', tone: 'muted' };
  return { text: `+${n} ${pts <= 1 ? 'point' : 'points'}`, tone: pts >= 1.5 ? 'text' : 'muted' };
}

/** "2 UP" / "AS" / "1 DN" for the standing (same text the engine's flag uses). */
export function standing(diff) {
  const f = (x) => { const w = Math.floor(x + 1e-9), h = x - w > 1e-9; return (w ? String(w) : '') + (h ? '½' : ''); };
  return diff > 1e-9 ? `${f(diff)} UP` : diff < -1e-9 ? `${f(-diff)} DN` : 'AS';
}
