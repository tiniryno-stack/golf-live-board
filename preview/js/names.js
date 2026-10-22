// names.js — pure helpers for people's names (no DOM, no network).
// Every player has a first and last name (plus an optional nickname when the full name is
// already taken by someone else). On screen a round shows first names; if two players in the
// same round share a first name it becomes "Andrew R." / "Andrew S." (and the nickname if even
// that collides). Season standings show full names.

const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

/** "andrew  duong" → { first: 'Andrew', last: 'Duong' }; one word → last ''. */
export function splitName(raw) {
  const words = clean(raw).split(' ').filter(Boolean);
  const cap = (w) => (w && w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w);
  return { first: cap(words[0] || '').slice(0, 24), last: words.slice(1).map(cap).join(' ').slice(0, 30) };
}

/** First name for a player (older rounds only have `name`). */
export function firstOf(p) {
  return clean(p.firstName) || clean(p.name).split(' ')[0] || '';
}

/** "Andrew Duong", "Andrew Duong (Drew)", or just the first name when there's no last name yet. */
export function fullName(p, { withNick = false } = {}) {
  const base = [firstOf(p), clean(p.lastName)].filter(Boolean).join(' ');
  return withNick && clean(p.nickname) ? `${base} (${clean(p.nickname)})` : base;
}

/** Same person-name key the database's uniqueness rule uses. */
export function nameKey(p) {
  return [firstOf(p), clean(p.lastName), clean(p.nickname)].map((s) => s.toLowerCase()).join('|');
}

/**
 * Display names for everyone in one round, in order: first names; "First L." when two share a
 * first name; nickname (or full name) when even that collides.
 */
export function displayNames(players) {
  const firsts = players.map((p) => firstOf(p));
  const count = (arr, v) => arr.filter((x) => x.toLowerCase() === v.toLowerCase()).length;
  const step1 = players.map((p, i) => {
    if (count(firsts, firsts[i]) < 2) return firsts[i];
    const last = clean(p.lastName);
    return last ? `${firsts[i]} ${last[0].toUpperCase()}.` : firsts[i];
  });
  return players.map((p, i) => {
    if (count(step1, step1[i]) < 2) return step1[i];
    if (clean(p.nickname)) return clean(p.nickname);
    return fullName(p) || step1[i];
  });
}
