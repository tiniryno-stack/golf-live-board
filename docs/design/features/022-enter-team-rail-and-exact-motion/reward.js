// 022 · Pure helpers behind the approved prototype (reference — move them into js/ui.js and unit-test them).
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
  return {
    word: isNet ? `Net ${w.toLowerCase()}` : w,
    tone: d >= 2 ? 'dbl' : d <= -2 ? 'big' : d >= 0 ? 'quiet' : '',   // CSS: .word.dbl / .big / .quiet
    stamp: d >= 2,                                                     // only a NET double or worse stamps
    ripples: d <= -2 ? 2 : 0,                                          // eagle or better
    holdMs: d <= -2 ? 3000 : 1600,
  };
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
  return diff > 0 ? `${diff} UP` : diff < 0 ? `${-diff} DN` : 'AS';
}
