// identity.js — PURE. Who this phone is (handoff 024). Words, used in code and comments:
//   person  = the human (personId, name, crew), the same on every phone;
//   device  = one browser storage (glb.device): Safari, the home screen app and a private tab are three;
//   claim   = "this device is Andrew in round V4T3M" (claims table; one player per device per round);
//   owner   = the one person this device belongs to (glb.owner = { personId, name });
//   playing as = the player this device has claimed in this round (glb.me.CODE); usually the owner.

/**
 * What to do when a round opens on this device (024 §3, lane B of the flow map):
 *   'open' — this device already has a claim here: open as that player;
 *   'auto' — the owner is on the roster and their spot is free: claim it, no Who are you?;
 *   'ask'  — the owner is on the roster but their spot is taken: Who are you? → taken → Ask to join;
 *   'pick' — no owner, or the owner isn't on this roster: Who are you? (grouped).
 * A practice round never auto-joins: it's for playing as other people, and never sets the owner.
 * Returns { plan, pid } (pid = the player the plan is about, or null).
 */
export function joinPlan({ owner = null, roster = null, claims = [], deviceClaim = null, practice = false } = {}) {
  if (deviceClaim) return { plan: 'open', pid: deviceClaim };
  if (practice || !owner?.personId) return { plan: 'pick', pid: null };
  const p = (roster?.players || []).find((x) => x.personId && x.personId === owner.personId);
  if (!p) return { plan: 'pick', pid: null };
  const taken = claims instanceof Set ? claims.has(p.id) : claims.includes(p.id);
  return { plan: taken ? 'ask' : 'auto', pid: p.id };
}

/**
 * The owner for a device that had none before 024 (§2 migration): the first crew's `me`, else the
 * first person this device ever played as (glb.people keeps the oldest first), else nobody.
 * The crew `me` wins, so a phone that also played as a friend stays its owner's.
 */
export function migratedOwner({ crews = [], people = [] } = {}) {
  const c = crews.find((x) => x?.me);
  if (c) return c.me;
  return people.find(Boolean) || null;
}

/**
 * Who are you?, grouped (§5.1): one group per tee time (in tee order), each holding its carts.
 * Headers (teeTimeName) only when the organizer set tee times; otherwise the same order, no headers.
 * Cart games list carts inside each tee time; every other game is one plain list per tee time.
 * `teeLabel(groupId)` names a tee time (teeTimeName). Returns [{ label, carts: [{ teamId, label, players }] }].
 */
export function whoGroups({ roster, settings = {}, players }, teeLabel = (id) => String(id)) {
  const teams = roster?.teams || [];
  const isCart = teams.length > 0 && !settings.solo && !settings.pairs
    && teams.some((t) => players.filter((p) => p.teamId === t.id).length > 1);
  const headers = Array.isArray(settings.teeTimes) && settings.teeTimes.some(Boolean);
  const groupIds = (roster?.groups || []).map((g) => g.id);
  const tee = (p) => { const i = groupIds.indexOf(p.groupId); return i >= 0 ? i : groupIds.length; };
  const order = [...new Set(players.map(tee))].sort((a, b) => a - b);
  return order.map((i) => {
    const ps = players.filter((p) => tee(p) === i);
    let carts;
    if (isCart) {
      carts = [];
      for (const t of teams) {
        const cp = ps.filter((p) => p.teamId === t.id);
        if (cp.length) carts.push({ teamId: t.id, label: t.name, players: cp });
      }
      const loose = ps.filter((p) => !p.teamId);
      if (loose.length) carts.push({ teamId: null, label: 'No cart', players: loose });
    } else carts = [{ teamId: null, label: '', players: ps }];
    return { label: headers && i < groupIds.length ? teeLabel(groupIds[i]) : '', carts };
  });
}
