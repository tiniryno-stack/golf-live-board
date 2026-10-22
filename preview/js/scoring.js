// scoring.js — PURE functions only. No DOM, no network.
//
// compute(event, scores) takes the round (course, roster, settings) plus the raw
// strokes and returns one snapshot with every derived number the screens need.
// Raw strokes are the only stored truth; everything here is recomputed.

export const HOLES = 18;

export const DEFAULT_ROTATION = [
  { holes: [1, 6], matches: [['A', 'B'], ['C', 'D']] },
  { holes: [7, 12], matches: [['A', 'C'], ['B', 'D']] },
  { holes: [13, 18], matches: [['A', 'D'], ['B', 'C']] },
];

export const DEFAULT_SETTINGS = {
  handicapMode: 'full',
  allowancePct: 100,
  game: 'rotationMatch',
  teamScore: 'bestBallAggregate',
  halvedHolePoints: 0.5,
  matchBonus: 1, // Match Play: bonus points for winning a matchup (halved = split like a pushed hole)
  plusMinusCap: null,
  maxHoleScore: 'doublePar',
  par3NoMax: false,
  rotationMode: 'swap',
  startHole: 1, // 1 = front nine first; 10 = start on the back nine
  teeTimes: [], // optional clock time per tee time (group order), "HH:MM"; '' = not set
  rotation: DEFAULT_ROTATION,
};

// ───────────────────────────────────────────── game plans (setup → stored settings)

/** Which games fit a player count (designspec §6 ③). */
export const GAMES = [
  { id: 'scorecard', name: 'Scorecard only', count: 'ANY NUMBER', min: 1, max: 99, desc: 'Own ball, one leaderboard.' },
  { id: 'match', name: 'Match play', count: '2–6 PLAYERS', min: 2, max: 6, desc: 'Low net wins each hole. Ties split.' },
  { id: '2v2', name: '2v2', count: 'EXACTLY 4', min: 4, max: 4, desc: 'Two teams of two in one foursome.' },
  {
    id: 'carts', name: 'Partner “Rider” Cup', count: '6 OR 8 PLAYERS', min: 6, max: 8, sizes: [6, 8],
    desc: '4 carts of 2. Opponents rotate.',
    desc6: '3 carts of 2. Everyone plays everyone.',
  },
];

/** Carts in a Partner “Rider” Cup for this many players: 3 for 6, else 4. */
export function cartIdsFor(n) {
  return n === 6 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
}

/** null when the game fits, else the fix spelled out ("Add 3 more players to play this."). */
export function gameFix(gameId, n) {
  const g = GAMES.find((x) => x.id === gameId);
  if (!g) return 'Unknown game.';
  const pl = (k) => (k === 1 ? 'player' : 'players');
  if (n < g.min) return `Add ${g.min - n} more ${pl(g.min - n)} to play this.`;
  if (n > g.max) return `Remove ${n - g.max} ${pl(n - g.max)} to play this.`;
  if (g.sizes && !g.sizes.includes(n)) {
    const up = g.sizes.find((k) => k > n), down = [...g.sizes].reverse().find((k) => k < n);
    return `Add ${up - n} more ${pl(up - n)} (${up}) or remove ${n - down} (${down}) to play this.`;
  }
  return null;
}

/** Foursomes for any number of players, as even as possible: 5 → 3+2, 6 → 3+3, 9 → 3+3+3. */
export function autoGroups(n) {
  const k = Math.max(1, Math.ceil(n / 4));
  const base = Math.floor(n / k), extra = n % k;
  const out = [];
  for (let g = 0; g < k; g++) for (let i = 0; i < base + (g < extra ? 1 : 0); i++) out.push(g);
  return out; // group index per player, in roster order
}

/**
 * Cart-game rotations. schedule 'six' = 3 rotations of 6 holes (you face all 3 other carts),
 * 'turn' = 2 rotations of 9 (you face 2 of the 3). opps = cart `me` faces in each rotation
 * (custom matchups; repeats allowed); the other matchup is the remaining two carts.
 */
export function cartRotation(schedule = 'six', opps = null, me = 'A') {
  const carts = ['A', 'B', 'C', 'D'];
  const others = carts.filter((c) => c !== me);
  const ranges = schedule === 'turn' ? [[1, 9], [10, 18]] : [[1, 6], [7, 12], [13, 18]];
  return ranges.map((holes, i) => {
    const o = opps?.[i] && others.includes(opps[i]) ? opps[i] : others[i % others.length];
    const rest = others.filter((c) => c !== o);
    return { holes, matches: [[me, o], rest] };
  });
}

/** Partner “Rider” Cup with 6 players: 3 carts, every cart plays both others on every hole, all 18. */
export function threeCartRotation() {
  return [{ holes: [1, HOLES], matches: [['A', 'B'], ['A', 'C'], ['B', 'C']] }];
}

/** 2v2 pairings for 4 players (indexes into the roster): never / every 6 / at the turn. */
export function pairRotation(pairSwitch = 'never') {
  const P = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
  const ranges = pairSwitch === 'six' ? [[1, 6], [7, 12], [13, 18]] : pairSwitch === 'turn' ? [[1, 9], [10, 18]] : [[1, 18]];
  return ranges.map((holes, i) => ({ holes, pairs: P[i] }));
}

export function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s || {}) };
  if (!Array.isArray(out.rotation) || !out.rotation.length) out.rotation = DEFAULT_ROTATION;
  out.startHole = Number(out.startHole) === 10 ? 10 : 1;
  out.teeTimes = Array.isArray(out.teeTimes) ? out.teeTimes.map((t) => (/^\d{1,2}:\d{2}$/.test(String(t || '')) ? String(t) : '')) : [];
  return out;
}

// ───────────────────────────────────────────── tee times

const ORD = ['1st', '2nd', '3rd'];
const ordinal = (n) => ORD[n - 1] || `${n}th`;

/** Index of a group ("g2" → 1) in tee-time order. */
export function groupIndex(groupId) {
  const n = Number(String(groupId || '').replace(/^g/, ''));
  return Number.isInteger(n) && n > 0 ? n - 1 : 0;
}

/** "8:40" for a group's tee time ("14:05" → "2:05", like the app's clocks), or null when not set. */
export function teeClock(settings, i) {
  const t = normalizeSettings(settings).teeTimes[i];
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
}

/** "8:40 tee time" when the organizer set one, else "1st tee time", "2nd tee time"… */
export function teeTimeName(settings, i) {
  const c = teeClock(settings, i);
  return c ? `${c} tee time` : `${ordinal(i + 1)} tee time`;
}

// ───────────────────────────────────────────── play order
// Rotations are written in PLAY ORDER positions (1–6 = the first six holes played).
// Starting on 10: positions 1–9 are holes 10–18, positions 10–18 are holes 1–9.
// Screens always show real hole numbers.

/** Holes in the order they're played. */
export function playOrder(settings) {
  const start = normalizeSettings(settings).startHole;
  return Array.from({ length: HOLES }, (_, i) => ((start - 1 + i) % HOLES) + 1);
}

/** 1-based position of a hole in play order. */
export function posOf(settings, hole) {
  const start = normalizeSettings(settings).startHole;
  return ((hole - start + HOLES) % HOLES) + 1;
}

/** Hole number at a 1-based play-order position. */
export function holeAt(settings, pos) {
  const start = normalizeSettings(settings).startHole;
  return ((start - 1 + pos - 1) % HOLES) + 1;
}

/** "Holes 10–15" or "Holes 16–18, 1–3" for a run of play-order positions. */
export function holesLabel(settings, fromPos, toPos) {
  const holes = [];
  for (let p = fromPos; p <= toPos; p++) holes.push(holeAt(settings, p));
  const runs = [];
  for (const h of holes) {
    const last = runs[runs.length - 1];
    if (last && h === last[1] + 1) last[1] = h;
    else runs.push([h, h]);
  }
  return `Holes ${runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ')}`;
}

// ───────────────────────────────────────────── formatting

/** 4.5 → "4½", 0.5 → "½", -1.5 → "−1½" */
export function fmtPts(n) {
  if (n == null || Number.isNaN(n)) return '–';
  const neg = n < -1e-9;
  const a = Math.abs(n);
  const whole = Math.floor(a + 1e-9);
  const f = a - whole;
  // Halves from pushes; thirds and quarters from split-point ties (3 or 4 players tied).
  const glyph = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']].find(([v]) => Math.abs(f - v) < 1e-6);
  const body = glyph
    ? glyph[1] ? (whole ? `${whole}${glyph[1]}` : glyph[1]) : `${whole}`
    : String(Math.round(a * 100) / 100); // e.g. 1/3 + 1/4 → 0.58
  return (neg ? '−' : '') + body;
}

/** 0 → "E", 3 → "+3", -2 → "−2" */
export function fmtToPar(n) {
  if (n == null || Number.isNaN(n)) return '–';
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Signed margin for status lines: 2 → "+2", -1 → "−1", 0 → "AS" */
export function fmtSigned(n, zero = 'AS') {
  if (!n) return zero;
  return n > 0 ? `+${fmtPts(n)}` : fmtPts(n);
}

// ───────────────────────────────────────────── strokes

/** Strokes a player gets on a hole: floor(s/18) + (si <= s % 18 ? 1 : 0). Negatives = 0. */
export function strokesOnHole(strokes, strokeIndex) {
  const s = Math.max(0, Math.floor(Number(strokes) || 0));
  return Math.floor(s / 18) + (strokeIndex <= s % 18 ? 1 : 0);
}

/** Effective round strokes per player id, after "off the low man" and allowance. */
export function playerStrokes(roster, settings) {
  const st = normalizeSettings(settings);
  const players = roster?.players || [];
  const base = players.map((p) => Math.max(0, Number(p.strokes) || 0));
  const low = st.handicapMode === 'offLow' && base.length ? Math.min(...base) : 0;
  const pct = Number.isFinite(Number(st.allowancePct)) ? Number(st.allowancePct) : 100;
  const out = new Map();
  players.forEach((p, i) => out.set(p.id, Math.max(0, Math.round(((base[i] - low) * pct) / 100))));
  return out;
}

/** Max hole score (pick-up rule), enforced at entry. 15 = no cap. */
export function maxHoleScore(course, settings, hole, strokesHere = 0) {
  const st = normalizeSettings(settings);
  const par = course.par[hole - 1];
  if (st.par3NoMax && par === 3) return 15;
  if (st.maxHoleScore === 'none') return 15;
  if (st.maxHoleScore === 'netDoubleBogey') return Math.min(15, par + 2 + strokesHere);
  return Math.min(15, par * 2);
}

/** Label for the Enter header: "Max 8" or "Max: none". */
export function maxLabel(course, settings, hole) {
  const st = normalizeSettings(settings);
  const par = course.par[hole - 1];
  if ((st.par3NoMax && par === 3) || st.maxHoleScore === 'none') return 'Max: none';
  if (st.maxHoleScore === 'netDoubleBogey') return 'Max: net dbl bogey';
  return `Max ${par * 2}`;
}

// ───────────────────────────────────────────── team score

export function componentCount(method) {
  return method === 'bestBallAggregate' ? 2 : 1;
}

export function componentNames(method) {
  if (method === 'bestBallAggregate') return ['Low Ball', 'Low Total'];
  if (method === 'aggregate') return ['Total'];
  return ['Best ball'];
}

/** Components for one team on one hole, or null while a partner hasn't posted. */
export function componentsFor(method, a, b) {
  if (a == null || b == null) return null;
  if (method === 'aggregate') return [a + b];
  if (method === 'bestBallAggregate') return [Math.min(a, b), a + b];
  return [Math.min(a, b)];
}

// ───────────────────────────────────────────── rotation + foursomes

export function rotationIndexFor(settings, hole) {
  const st = normalizeSettings(settings);
  const p = posOf(st, hole);
  return st.rotation.findIndex((r) => p >= r.holes[0] && p <= r.holes[1]);
}

/** The rotation a hole belongs to. from/to are play-order positions; label uses real holes. */
export function rotationFor(settings, hole) {
  const st = normalizeSettings(settings);
  const i = rotationIndexFor(st, hole);
  if (i < 0) return null;
  const r = st.rotation[i];
  return {
    index: i + 1, from: r.holes[0], to: r.holes[1], matches: r.matches,
    firstHole: holeAt(st, r.holes[0]), lastHole: holeAt(st, r.holes[1]), label: holesLabel(st, r.holes[0], r.holes[1]),
  };
}

/** The team this team plays on a hole, from the rotation. */
export function opponentTeam(settings, teamId, hole) {
  const r = rotationFor(settings, hole);
  if (!r || !teamId) return null;
  const m = r.matches.find((pair) => pair.includes(teamId));
  if (!m) return null;
  return m[0] === teamId ? m[1] : m[0];
}

function playerOf(roster, pid) {
  return (roster?.players || []).find((p) => p.id === pid) || null;
}

/** Mirrors public._same_foursome in schema.sql. */
export function sameFoursome(roster, settings, aPid, bPid, hole) {
  if (aPid === bPid) return true;
  const a = playerOf(roster, aPid);
  const b = playerOf(roster, bPid);
  if (!a || !b) return false;
  const st = normalizeSettings(settings);
  if ((st.rotationMode || 'swap') === 'swap' && a.teamId && b.teamId && Array.isArray(st.rotation)) {
    if (a.teamId === b.teamId) return true;
    const r = rotationFor(st, hole);
    if (!r) return false;
    return r.matches.some((m) => m.includes(a.teamId) && m.includes(b.teamId));
  }
  return !!a.groupId && a.groupId === b.groupId;
}

/** Everyone in this player's foursome on a hole: own cart first, then the other cart. */
export function foursomeFor(roster, settings, pid, hole) {
  const me = playerOf(roster, pid);
  if (!me) return [];
  const all = (roster.players || []).filter((p) => sameFoursome(roster, settings, pid, p.id, hole));
  const mine = all.filter((p) => (me.teamId ? p.teamId === me.teamId : p.id === pid));
  const rest = all.filter((p) => !mine.includes(p));
  return [...mine, ...rest].map((p) => p.id);
}

/** Carts (teams) in this player's foursome on a hole, own cart first. */
export function foursomeTeams(roster, settings, pid, hole) {
  const ids = foursomeFor(roster, settings, pid, hole);
  const teams = [];
  for (const id of ids) {
    const t = playerOf(roster, id)?.teamId || null;
    if (!teams.includes(t)) teams.push(t);
  }
  return teams;
}

// ───────────────────────────────────────────── compute

function gameIsValid(roster, settings) {
  if (settings.game === 'none') return false;
  const teams = roster?.teams || [];
  const players = roster?.players || [];
  if (settings.pairs) {
    if (players.length !== 4 || !teams.length || !teams.every((t) => t.members?.length === 2)) return false;
  } else {
    const size = settings.solo ? 1 : 2;
    if (settings.solo ? teams.length < 2 || teams.length > 6 : teams.length !== 4 && teams.length !== 3) return false;
    if (!teams.every((t) => players.filter((p) => p.teamId === t.id).length === size)) return false;
  }
  const ids = new Set(teams.map((t) => t.id));
  return settings.rotation.every(
    (r) => Array.isArray(r.holes) && Array.isArray(r.matches) && r.matches.every((m) => m.length === 2 && m.every((t) => ids.has(t)))
  );
}

/**
 * The snapshot every screen renders from.
 * event: { course, roster, settings }   scores: [{ player_id, hole, strokes, updated_by, updated_at }]
 */
/** Every pairing of the given ids, in order: [[A,B],[A,C],[B,C]…]. */
function roundRobin(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i], ids[j]]);
  return out;
}

/**
 * Split point (settings.solo, 2–6 players; 5–6 play as two groups): each player is their own "team" (ids A–D
 * in roster order, so jersey colors work). Every hole is worth 1 point: the low net score takes it
 * outright; players tied for low split it (½, ⅓ or ¼ each). The stored roster has no teams;
 * they're made here, so a casual round can switch it on mid-round and recount from hole 1.
 */
export function soloView(roster, settings) {
  const ids = 'ABCDEF';
  const players = (roster?.players || []).slice(0, 6);
  const r = {
    ...roster,
    teams: players.map((p, i) => ({ id: ids[i], name: p.name })),
    players: (roster?.players || []).map((p, i) => ({ ...p, teamId: i < 6 ? ids[i] : null })),
  };
  const st = {
    ...settings,
    game: 'splitPoint',
    teamScore: 'bestBall',
    rotationMode: 'fixed',
    rotation: [{ holes: [1, HOLES], matches: roundRobin(r.teams.map((t) => t.id)) }],
  };
  return { roster: r, settings: st };
}

/**
 * 2v2 (settings.pairs, exactly 4 players in one group): the stored roster has no carts. Each
 * pairing is its own "team" (id like 'AB', with explicit members), and the rotation pairs them up:
 * never = AB v CD all 18; every 6 = AB v CD, AC v BD, AD v BC; at the turn = the first two.
 * Match play scoring (Low Ball / Low Total per hole). Players add up the points of every pairing
 * they were in (game.people).
 */
export function pairView(roster, settings) {
  const L = 'ABCD';
  const players = (roster?.players || []).slice(0, 4);
  const plan = pairRotation(settings.pairSwitch);
  const teams = [];
  const idOf = (pair) => pair.map((i) => L[i]).join('');
  for (const r of plan) {
    for (const pair of r.pairs) {
      const id = idOf(pair);
      if (players.length === 4 && !teams.some((t) => t.id === id)) {
        teams.push({ id, name: pair.map((i) => players[i].name).join(' + '), members: pair.map((i) => players[i].id) });
      }
    }
  }
  const st = {
    ...settings,
    game: 'rotationMatch',
    rotationMode: 'fixed',
    rotation: plan.map((r) => ({ holes: r.holes, matches: [r.pairs.map(idOf)] })),
  };
  return { roster: { ...roster, teams, players: (roster?.players || []).map((p) => ({ ...p, teamId: null })) }, settings: st };
}

/** The 2v2 pairing (team) this player is in on a hole, or their cart in any other game. */
export function sideOn(snapshot, pid, hole) {
  if (!snapshot.settings.pairs) return snapshot.playerById.get(pid)?.teamId || null;
  const r = rotationFor(snapshot.settings, hole);
  if (!r) return null;
  const ids = r.matches.flat();
  return ids.find((t) => snapshot.teamById.get(t)?.playerIds.includes(pid)) || null;
}

export function compute(event, scores) {
  const course = event.course;
  let roster = event.roster || { players: [], teams: [], groups: [] };
  let settings = normalizeSettings(event.settings);
  if (settings.pairs) ({ roster, settings } = pairView(roster, settings));
  else if (settings.solo) ({ roster, settings } = soloView(roster, settings));
  const par = course.par;
  const si = course.strokeIndex;
  const holes = Array.from({ length: HOLES }, (_, i) => ({ n: i + 1, par: par[i], si: si[i] }));
  const parFront = par.slice(0, 9).reduce((a, b) => a + b, 0);
  const parBack = par.slice(9).reduce((a, b) => a + b, 0);

  const eff = playerStrokes(roster, settings);
  const grid = new Map();
  for (const p of roster.players || []) grid.set(p.id, Array(HOLES).fill(null));
  for (const row of scores || []) {
    if (row == null || row.strokes == null) continue;
    const g = grid.get(row.player_id);
    const h = Number(row.hole);
    if (!g || !(h >= 1 && h <= HOLES)) continue;
    g[h - 1] = row;
  }

  const teamName = new Map((roster.teams || []).map((t) => [t.id, t.name]));
  const players = (roster.players || []).map((p) => {
    const s = eff.get(p.id) || 0;
    const rows = grid.get(p.id);
    const dots = holes.map((h) => strokesOnHole(s, h.si));
    const gross = rows.map((r) => (r ? Number(r.strokes) : null));
    const net = gross.map((g, i) => (g == null ? null : g - dots[i]));
    let thru = 0, grossToPar = 0, netToPar = 0, grossTotal = 0, netTotal = 0, lastHole = 0;
    const half = { grossFront: 0, grossBack: 0, netFront: 0, netBack: 0, thruFront: 0, thruBack: 0 };
    gross.forEach((g, i) => {
      if (g == null) return;
      thru++; lastHole = i + 1;
      grossTotal += g; netTotal += net[i];
      grossToPar += g - par[i]; netToPar += net[i] - par[i];
      if (i < 9) { half.grossFront += g; half.netFront += net[i]; half.thruFront++; }
      else { half.grossBack += g; half.netBack += net[i]; half.thruBack++; }
    });
    return {
      id: p.id, personId: p.personId || null, name: p.name, firstName: p.firstName || null, lastName: p.lastName || null, nickname: p.nickname || null,
      teamId: p.teamId || null, groupId: p.groupId || null,
      teamName: p.teamId ? teamName.get(p.teamId) || p.teamId : null,
      strokes: s, dots, gross, net, meta: rows.map((r) => (r ? { by: r.updated_by || null, at: r.updated_at || null } : null)),
      thru, lastHole, grossToPar, netToPar, grossTotal, netTotal, ...half,
    };
  });
  const playerById = new Map(players.map((p) => [p.id, p]));
  const hasStrokes = players.some((p) => p.strokes > 0);

  const method = settings.teamScore;
  const teams = (roster.teams || []).map((t) => {
    const ps = t.members ? t.members.map((id) => playerById.get(id)).filter(Boolean) : players.filter((p) => p.teamId === t.id);
    const comps = holes.map((h, i) =>
      ps.length === 2 ? componentsFor(method, ps[0].net[i], ps[1].net[i])
        : ps.length === 1 && settings.solo && ps[0].net[i] != null ? [ps[0].net[i]] : null
    );
    let thru = 0, toPar = 0, grossToPar = 0;
    comps.forEach((c, i) => {
      if (!c) return;
      thru++;
      const k = method === 'bestBall' ? 0 : c.length - 1; // Low Total for bestBallAggregate
      const parMult = method === 'bestBall' ? 1 : 2;
      toPar += c[k] - parMult * par[i];
      const g = ps.length === 1 ? [ps[0].gross[i]] : componentsFor(method, ps[0].gross[i], ps[1].gross[i]);
      grossToPar += g[k] - parMult * par[i];
    });
    return { id: t.id, name: t.name || t.id, playerIds: ps.map((p) => p.id), comps, thru, toPar, grossToPar };
  });
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // Holes every player has posted (used for the official line when there is no game).
  const allPosted = holes.map((h, i) => players.length > 0 && players.every((p) => p.gross[i] != null));

  let game = null;
  let holeComplete = allPosted;
  if (gameIsValid(roster, settings)) {
    game = settings.game === 'splitPoint' ? computeSplit(settings, teams, holes) : computeGame(settings, teams, teamById, holes);
    holeComplete = game.holeComplete;
  }
  // Official line: how many holes, in play order, every foursome has finished.
  let officialThrough = 0;
  while (officialThrough < HOLES && holeComplete[holeAt(settings, officialThrough + 1) - 1]) officialThrough++;
  const officialHole = officialThrough ? holeAt(settings, officialThrough) : 0;
  if (game) finishGame(game, settings, teams, officialThrough);

  const anyPosted = players.some((p) => p.thru > 0);
  const roundComplete = game
    ? game.type === 'splitPoint' ? game.holeComplete.every(Boolean) : game.matches.every((m) => m.final)
    : players.length > 0 && allPosted.every(Boolean);

  return {
    course, roster, settings, holes, parTotal: parFront + parBack, parFront, parBack,
    players, playerById, hasStrokes, teams, teamById, game,
    holeComplete, officialThrough, officialHole, anyPosted, roundComplete,
    order: playOrder(settings),
  };
}

function computeGame(settings, teams, teamById, holes) {
  const ncomp = componentCount(settings.teamScore);
  const halves = Number(settings.halvedHolePoints) || 0;
  const type = settings.game; // rotationMatch | rotationPlusMinus
  const cap = settings.plusMinusCap == null || settings.plusMinusCap === '' ? null : Number(settings.plusMinusCap);
  const bonus = type === 'rotationMatch' ? Math.max(0, Number(settings.matchBonus) || 0) : 0;
  const rotations = settings.rotation.map((r, ri) => {
    const from = r.holes[0], to = r.holes[1]; // play-order positions
    const matches = r.matches.map(([x, y], mi) => {
      const tx = teamById.get(x), ty = teamById.get(y);
      const hs = [];
      const points = { [x]: 0, [y]: 0 };
      let raw = 0; // strokes margin from x's view (y total − x total)
      let played = 0;
      for (let pos = from; pos <= to; pos++) {
        const h = holeAt(settings, pos);
        const cx = tx.comps[h - 1], cy = ty.comps[h - 1];
        if (cx && cy) {
          const p = { [x]: 0, [y]: 0 };
          let m = 0;
          for (let k = 0; k < ncomp; k++) {
            if (cx[k] < cy[k]) p[x] += 1;
            else if (cy[k] < cx[k]) p[y] += 1;
            else { p[x] += halves; p[y] += halves; }
            m += cy[k] - cx[k];
          }
          points[x] += p[x]; points[y] += p[y];
          raw += m; played++;
          hs.push({ hole: h, pos, complete: true, comps: { [x]: cx, [y]: cy }, points: p, margin: { [x]: m, [y]: -m } });
        } else {
          hs.push({ hole: h, pos, complete: false, comps: { [x]: cx, [y]: cy }, points: null, margin: null });
        }
      }
      const total = to - from + 1;
      const capped = cap != null && Number.isFinite(cap) ? Math.max(-cap, Math.min(cap, raw)) : raw;
      const left = (total - played) * ncomp;
      const lead = points[x] - points[y];
      const final = played === total;
      let clinchedBy = null;
      if (type === 'rotationMatch' && Math.abs(lead) > left) clinchedBy = lead > 0 ? x : y;
      let result = null;
      if (final) {
        const v = type === 'rotationPlusMinus' ? capped : lead;
        result = v > 0 ? x : v < 0 ? y : 'halved';
      }
      // Matchup win bonus (Match Play): the winner gets it once all its holes are in.
      const won = { [x]: 0, [y]: 0 };
      if (final && bonus) {
        if (result === 'halved') won[x] = won[y] = bonus * halves;
        else won[result] = bonus;
      }
      return {
        id: `r${ri + 1}m${mi + 1}`, rotation: ri + 1, from, to, teams: [x, y], holes: hs,
        firstHole: holeAt(settings, from), lastHole: holeAt(settings, to), label: holesLabel(settings, from, to),
        points, bonus: won, margin: { [x]: capped, [y]: -capped }, rawMargin: { [x]: raw, [y]: -raw },
        played, total, left, final, clinchedBy, result,
      };
    });
    return { index: ri + 1, from, to, matches, label: holesLabel(settings, from, to) };
  });
  const matches = rotations.flatMap((r) => r.matches);

  const holeComplete = holes.map((h) => {
    const pos = posOf(settings, h.n);
    const r = rotations.find((rr) => pos >= rr.from && pos <= rr.to);
    if (!r) return false;
    return r.matches.every((m) => m.holes[pos - m.from].complete);
  });

  // Per-hole points / margins, by team, for complete matchup holes.
  const pointsByHole = holes.map(() => null);
  for (const m of matches) {
    for (const hh of m.holes) {
      if (!hh.complete) continue;
      const slot = (pointsByHole[hh.hole - 1] ||= { points: {}, margin: {}, total: {} });
      for (const t of m.teams) {
        // Solo: a player has several matches per hole, so points and margins add up.
        slot.points[t] = (slot.points[t] || 0) + hh.points[t];
        slot.margin[t] = (slot.margin[t] || 0) + hh.margin[t];
        slot.total[t] = hh.comps[t].reduce((a, b) => a + b, 0);
      }
    }
  }
  return { type, ncomp, halves, cap, bonus, rotations, matches, holeComplete, pointsByHole, teamIds: teams.map((t) => t.id) };
}

/**
 * Split point: once every player has a score on a hole, the low net score takes its 1 point;
 * k players tied for low get 1/k each. No matchups, so `matches` and `rotations` are empty.
 */
function computeSplit(settings, teams, holes) {
  const ids = teams.map((t) => t.id);
  const byHole = holes.map((h) => {
    const pos = posOf(settings, h.n);
    const net = {};
    for (const t of teams) net[t.id] = t.comps[h.n - 1] ? t.comps[h.n - 1][0] : null;
    const complete = ids.every((t) => net[t] != null);
    if (!complete) return { hole: h.n, pos, complete: false, net, points: null, winners: [] };
    const low = Math.min(...ids.map((t) => net[t]));
    const winners = ids.filter((t) => net[t] === low);
    const points = Object.fromEntries(ids.map((t) => [t, winners.includes(t) ? 1 / winners.length : 0]));
    return { hole: h.n, pos, complete: true, net, points, winners };
  });
  const pointsByHole = byHole.map((hh) =>
    hh.complete ? { points: hh.points, margin: Object.fromEntries(ids.map((t) => [t, 0])), total: { ...hh.net } } : null
  );
  return {
    type: 'splitPoint', ncomp: 1, halves: 0, cap: null, bonus: 0, rotations: [], matches: [],
    holes: byHole, holeComplete: byHole.map((hh) => hh.complete), pointsByHole, teamIds: ids,
  };
}

/** Split point: points / holes on offer / holes won outright / holes shared, through play-order position `through`. */
function splitThrough(game, teamId, through) {
  const r = { points: 0, available: 0, won: 0, split: 0 };
  for (const hh of game.holes) {
    if (!hh.complete || hh.pos > through) continue;
    r.points += hh.points[teamId];
    r.available += 1;
    if (hh.winners.includes(teamId)) hh.winners.length === 1 ? r.won++ : r.split++;
  }
  return r;
}

/** "2-1-0" (matchups won-lost-halved), or for split point "3 won · 2 split" (holes). */
export function recordLabel(game, s) {
  if (game?.type === 'splitPoint') return `${s.won} won · ${s.split} split`;
  return `${s.record.w}-${s.record.l}-${s.record.h}`;
}

/** Plus/Minus total for a team over holes ≤ through (each rotation capped). */
function pmThrough(game, teamId, through) {
  let total = 0;
  for (const m of game.matches) {
    if (!m.teams.includes(teamId)) continue;
    let raw = 0;
    for (const hh of m.holes) if (hh.complete && hh.pos <= through) raw += hh.margin[teamId];
    total += game.cap != null ? Math.max(-game.cap, Math.min(game.cap, raw)) : raw;
  }
  return total;
}

function pointsThrough(game, teamId, through) {
  let total = 0;
  for (const m of game.matches) {
    if (!m.teams.includes(teamId)) continue;
    for (const hh of m.holes) if (hh.complete && hh.pos <= through) total += hh.points[teamId];
    if (m.final && m.to <= through) total += m.bonus?.[teamId] || 0; // matchup win bonus
  }
  return total;
}

/** Points a team could have won on holes ≤ through (each matchup hole + each finished matchup's
 *  win bonus). On the official line it's the same for every team, so share = points / available
 *  always ranks in the same order as the points. */
function availableThrough(game, teamId, through) {
  let total = 0;
  for (const m of game.matches) {
    if (!m.teams.includes(teamId)) continue;
    for (const hh of m.holes) if (hh.complete && hh.pos <= through) total += game.ncomp;
    if (m.final && m.to <= through) total += game.bonus;
  }
  return total;
}

function recordOf(game, teamId, through = HOLES) {
  const r = { w: 0, l: 0, h: 0 };
  for (const m of game.matches) {
    if (!m.final || !m.teams.includes(teamId) || m.to > through) continue;
    if (m.result === 'halved') r.h++;
    else if (m.result === teamId) r.w++;
    else r.l++;
  }
  return r;
}

function finishGame(game, settings, teams, officialThrough) {
  game.officialThrough = officialThrough;
  const rows = teams.map((t) => {
    if (game.type === 'splitPoint') {
      const all = splitThrough(game, t.id, HOLES), off = splitThrough(game, t.id, officialThrough);
      return {
        teamId: t.id, name: t.name, playerIds: t.playerIds,
        points: all.points, officialPoints: off.points, provisionalPoints: Math.round((all.points - off.points) * 1e9) / 1e9,
        available: all.available, officialAvailable: off.available,
        pm: 0, officialPm: 0, provisionalPm: 0,
        record: { w: 0, l: 0, h: 0 }, officialRecord: { w: 0, l: 0, h: 0 },
        won: all.won, split: all.split, holesPlayed: all.available, currentMatchId: null,
      };
    }
    const points = pointsThrough(game, t.id, HOLES);
    const officialPoints = pointsThrough(game, t.id, officialThrough);
    const pm = pmThrough(game, t.id, HOLES);
    const officialPm = pmThrough(game, t.id, officialThrough);
    let holesPlayed = 0;
    for (const m of game.matches) if (m.teams.includes(t.id)) holesPlayed += m.played;
    const current = game.matches.find((m) => m.teams.includes(t.id) && !m.final) || null;
    return {
      teamId: t.id, name: t.name, playerIds: t.playerIds,
      points, officialPoints, provisionalPoints: points - officialPoints,
      available: availableThrough(game, t.id, HOLES), officialAvailable: availableThrough(game, t.id, officialThrough),
      pm, officialPm, provisionalPm: pm - officialPm,
      record: recordOf(game, t.id), officialRecord: recordOf(game, t.id, officialThrough),
      holesPlayed, currentMatchId: current ? current.id : null,
    };
  });
  game.standings = rankStandings(game, rows, true);
  game.liveStandings = rankStandings(game, rows.map((r) => ({ ...r })), false);
  if (settings.pairs) {
    // 2v2: each player adds up the points of every pairing they were in.
    const sum = (pid, key) => rows.filter((r) => r.playerIds.includes(pid)).reduce((a, r) => a + r[key], 0);
    const pids = [...new Set(rows.flatMap((r) => r.playerIds))];
    const people = pids.map((pid) => ({
      playerId: pid, points: sum(pid, 'points'), officialPoints: sum(pid, 'officialPoints'),
      available: sum(pid, 'available'),
    }));
    people.forEach((r) => { r.provisionalPoints = Math.round((r.points - r.officialPoints) * 1e9) / 1e9; });
    people.sort((a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId));
    people.forEach((r, i) => {
      r.rank = i > 0 && Math.abs(people[i - 1].points - r.points) < 1e-9 ? people[i - 1].rank : i + 1;
    });
    game.people = people;
  }
  game.provisionalHoles = []; // real hole numbers past the official line that already have points
  for (let pos = officialThrough + 1; pos <= HOLES; pos++) {
    const h = holeAt(settings, pos);
    if (game.pointsByHole[h - 1]) game.provisionalHoles.push(h);
  }
}

/** Head-to-head result between two teams across the day: 1 if a won, -1 if b won, 0 otherwise. */
function headToHead(game, a, b, official) {
  const m = game.matches.find((mm) => mm.teams.includes(a) && mm.teams.includes(b));
  if (!m || !m.final || (official && m.to > game._through)) return 0;
  if (m.result === a) return 1;
  if (m.result === b) return -1;
  return 0;
}

/** Final-standings tiebreakers (split point: points → outright wins once all holes are in): value → match record → head-to-head → secondary margin → shared. */
export function rankStandings(game, rows, official) {
  const isPM = game.type === 'rotationPlusMinus';
  const val = (r) => (isPM ? (official ? r.officialPm : r.pm) : official ? r.officialPoints : r.points);
  const sec = (r) => (isPM ? (official ? r.officialPoints : r.points) : official ? r.officialPm : r.pm);
  const rec = (r) => (official ? r.officialRecord : r.record);
  game._through = official ? game.officialThrough ?? HOLES : HOLES;
  const cmp = (a, b) => {
    const d = val(b) - val(a);
    if (Math.abs(d) > 1e-9) return d;
    // Split point: level after the last hole → most outright wins (holes won alone), else shared.
    if (game.type === 'splitPoint') return game.holeComplete.every(Boolean) ? (b.won || 0) - (a.won || 0) : 0;
    const ra = rec(a), rb = rec(b);
    if (rb.w - rb.l !== ra.w - ra.l) return rb.w - rb.l - (ra.w - ra.l);
    if (rb.w !== ra.w) return rb.w - ra.w;
    const h2h = headToHead(game, a.teamId, b.teamId, official);
    if (h2h) return -h2h;
    const s = sec(b) - sec(a);
    if (Math.abs(s) > 1e-9) return s;
    return 0;
  };
  const sorted = [...rows].sort((a, b) => cmp(a, b) || a.teamId.localeCompare(b.teamId));
  sorted.forEach((r, i) => {
    r.rank = i > 0 && cmp(sorted[i - 1], r) === 0 ? sorted[i - 1].rank : i + 1;
  });
  sorted.forEach((r) => {
    r.shared = sorted.filter((o) => o.rank === r.rank).length > 1;
  });
  return sorted;
}

// ───────────────────────────────────────────── leaderboards

/** Players sorted for the Board: to par ascending, then holes played descending. */
export function playerLeaderboard(snapshot, mode = 'net') {
  const key = mode === 'gross' ? 'grossToPar' : 'netToPar';
  return [...snapshot.players].sort((a, b) => {
    if (!a.thru !== !b.thru) return a.thru ? -1 : 1;
    return a[key] - b[key] || b.thru - a.thru || a.name.localeCompare(b.name);
  });
}

/** Teams by stroke total (used when there is no game). */
export function teamLeaderboard(snapshot, mode = 'net') {
  const key = mode === 'gross' ? 'grossToPar' : 'toPar';
  return [...snapshot.teams].sort((a, b) => {
    if (!a.thru !== !b.thru) return a.thru ? -1 : 1;
    return a[key] - b[key] || b.thru - a.thru || a.name.localeCompare(b.name);
  });
}

/** The first hole (play order) this player's foursome hasn't fully posted; null when they're done. */
export function nextHoleFor(snapshot, pid) {
  for (const h of playOrder(snapshot.settings)) {
    const ids = foursomeFor(snapshot.roster, snapshot.settings, pid, h);
    if (!ids.length) return holeAt(snapshot.settings, 1);
    if (ids.some((id) => snapshot.playerById.get(id)?.gross[h - 1] == null)) return h;
  }
  return null;
}

/** The first hole (play order) this player hasn't posted, else their last hole. */
export function currentHoleOf(snapshot, pid) {
  const p = snapshot.playerById.get(pid);
  const order = playOrder(snapshot.settings);
  if (!p) return order[0];
  return order.find((h) => p.gross[h - 1] == null) ?? order[HOLES - 1];
}

/** The match a team is in on a hole (the first one, when it has several: 3-cart rounds). */
export function matchFor(snapshot, teamId, hole) {
  return matchesFor(snapshot, teamId, hole)[0] || null;
}

/** Every match a team is in on a hole: one in most games, two in a 3-cart Partner “Rider” Cup. */
export function matchesFor(snapshot, teamId, hole) {
  if (!snapshot.game || !teamId) return [];
  const pos = posOf(snapshot.settings, hole);
  return snapshot.game.matches.filter((m) => m.teams.includes(teamId) && pos >= m.from && pos <= m.to);
}

// ───────────────────────────────────────────── season (V1-lite)

/**
 * rounds: [{ event, scores }]. Each round is recomputed with compute() and added
 * up by personId. Only finished 6-hole matchups count.
 */
export function seasonStandings(rounds) {
  const people = new Map();
  const pairs = new Map();
  const sorted = [...rounds].sort((a, b) =>
    String(a.event.played_on || '').localeCompare(String(b.event.played_on || '')) ||
    String(a.event.created_at || '').localeCompare(String(b.event.created_at || ''))
  );
  const personKey = (p) => p.personId || `name:${String(p.name || '').trim().toLowerCase()}`;
  let counted = 0;
  for (const { event, scores } of sorted) {
    const snap = compute(event, scores);
    for (const p of snap.players) {
      const k = personKey(p);
      const row = people.get(k) || { key: k, name: p.name, rounds: new Set(), w: 0, l: 0, h: 0, points: 0, roundsWon: 0 };
      row.name = p.name;
      if (p.lastName) row.fullName = [p.firstName || String(p.name).split(' ')[0], p.lastName].join(' '); // season shows full names
      if (p.nickname) row.nickname = p.nickname;
      row.rounds.add(event.id || event.code);
      people.set(k, row);
    }
    if (!snap.game || snap.game.type === 'splitPoint') continue; // season = the cart game
    counted++;
    const pts = (m, t) => (snap.game.type === 'rotationPlusMinus' ? m.margin[t] : m.points[t] + (m.bonus?.[t] || 0));
    for (const m of snap.game.matches) {
      if (!m.final) continue;
      for (const t of m.teams) {
        const res = m.result === 'halved' ? 'h' : m.result === t ? 'w' : 'l';
        const team = snap.teamById.get(t);
        const members = team.playerIds.map((id) => snap.playerById.get(id));
        for (const p of members) {
          const row = people.get(personKey(p));
          row[res]++;
          row.points += pts(m, t);
        }
        const keys = members.map(personKey).sort();
        const pk = keys.join('|');
        const pr = pairs.get(pk) || { key: pk, names: [], teamName: '', rounds: new Set(), w: 0, l: 0, h: 0, points: 0, roundsWon: 0 };
        pr.names = members.map((p) => p.name);
        pr.teamName = team.name;
        pr.rounds.add(event.id || event.code);
        pr[res]++;
        pr.points += pts(m, t);
        pairs.set(pk, pr);
      }
    }
    if (snap.roundComplete) {
      for (const s of snap.game.standings) {
        if (s.rank !== 1) continue;
        const team = snap.teamById.get(s.teamId);
        const members = team.playerIds.map((id) => snap.playerById.get(id));
        for (const p of members) people.get(personKey(p)).roundsWon++;
        const pk = members.map(personKey).sort().join('|');
        if (pairs.has(pk)) pairs.get(pk).roundsWon++;
      }
    }
  }
  const pct = (r) => {
    const g = r.w + r.l + r.h;
    return g ? (r.w + r.h / 2) / g : -1;
  };
  const order = (a, b) => pct(b) - pct(a) || b.points - a.points || (a.name || a.teamName || '').localeCompare(b.name || b.teamName || '');
  const fin = (r) => ({ ...r, rounds: r.rounds.size, games: r.w + r.l + r.h, pct: pct(r) });
  return {
    rounds: counted,
    players: [...people.values()].map(fin).sort(order),
    pairs: [...pairs.values()].map(fin).filter((p) => p.games > 0).sort(order),
  };
}
