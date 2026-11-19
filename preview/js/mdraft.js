// mdraft.js — PURE: the matchup draft for a 16-player Team Ryder Cup (owner, Nov 7). After the team draft, the two
// captains build the 12 matches: on each pick one side offers a cart, the other side answers with a cart of theirs.
// 3 rotations (holes 1–6 / 7–12 / 13–18 in play order) × 4 matches; a cart plays once per rotation and never meets
// the same cart twice. The offering side snakes: A, B, B, A, A, B, B, A, A, B, B, A. Saved as
// settings.ryderMatchups = [[[side1Cart, side2Cart] × 4] × 3]; the engine (scoring.ryderPairsAt) reads it.
// No settings.ryderMatchups (or a broken one) = the standard rotation.

export const PICKS = 12;
const other = (s) => (s === '1' ? '2' : '1');

/** Which side offers on pick k (0-based), when `first` offers the first pick. */
export function offerSide(k, first = '1') {
  return [0, 3, 4, 7, 8, 11].includes(k) ? first : other(first);
}

const key = (a, b) => `${a}v${b}`;

/** Is there a duplicate-free way to finish from these picks ([s1, s2] in pick order)? */
export function canFinish(picks, carts1, carts2) {
  const used = new Set(picks.map(([a, b]) => key(a, b)));
  const n = carts1.length;
  const rot = (k) => Math.floor(k / n);
  // fill pick slots one at a time, rotation by rotation
  const go = (list) => {
    if (list.length >= n * 3) return true;
    const r = rot(list.length);
    const inRot = list.filter((_, i) => rot(i) === r);
    const a = carts1.find((c) => !inRot.some((p) => p[0] === c)); // next free side-1 cart (order doesn't matter)
    for (const b of carts2) {
      if (inRot.some((p) => p[1] === b) || used.has(key(a, b))) continue;
      used.add(key(a, b));
      const ok = go([...list, [a, b]]);
      used.delete(key(a, b));
      if (ok) return true;
    }
    return false;
  };
  return go(picks);
}

/**
 * Where the draft stands. picks = [[s1, s2], ...] in pick order; pending = the cart just offered (or null).
 * → { k, rotation, side (who acts), offering (true = choose a cart to offer), options: [cartId], done }
 */
export function draftState(picks, pending, carts1, carts2, first = '1') {
  const n = carts1.length;
  const k = picks.length;
  if (k >= n * 3) return { k, rotation: 3, done: true, options: [] };
  const rotation = Math.floor(k / n);
  const inRot = picks.slice(rotation * n);
  const offer = offerSide(k, first);
  const mine = (s) => (s === '1' ? carts1 : carts2);
  const free = (s) => mine(s).filter((c) => !inRot.some((p) => p[s === '1' ? 0 : 1] === c));
  const pairOf = (offered, ans) => (offer === '1' ? [offered, ans] : [ans, offered]);
  const okPair = (pair) => !picks.some((p) => p[0] === pair[0] && p[1] === pair[1]) && canFinish([...picks, pair], carts1, carts2);
  if (pending == null) {
    // offer: any free cart that still has a legal answer
    const options = free(offer).filter((c) => free(other(offer)).some((ans) => okPair(pairOf(c, ans))));
    return { k, rotation, side: offer, offering: true, options, done: false };
  }
  const options = free(other(offer)).filter((ans) => okPair(pairOf(pending, ans)));
  return { k, rotation, side: other(offer), offering: false, options, pending, done: false };
}

/** Picks (pick order) → settings.ryderMatchups. */
export function toMatchups(picks, n = 4) {
  return [0, 1, 2].map((r) => picks.slice(r * n, r * n + n).map((p) => [...p]));
}

/** The drafted matchups for rotation i, or null when absent / not a full valid set for these carts. */
export function draftedAt(settings, i, carts1, carts2) {
  const m = settings?.ryderMatchups;
  if (!Array.isArray(m) || m.length !== 3) return null;
  const r = m[i];
  const n = carts1.length;
  if (!Array.isArray(r) || r.length !== n) return null;
  const a = new Set(r.map((p) => p?.[0])), b = new Set(r.map((p) => p?.[1]));
  if (a.size !== n || b.size !== n || ![...a].every((x) => carts1.includes(x)) || ![...b].every((x) => carts2.includes(x))) return null;
  return r.map((p) => [p[0], p[1]]);
}
