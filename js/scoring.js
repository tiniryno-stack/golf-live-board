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
  plusMinusCap: null,
  maxHoleScore: 'doublePar',
  par3NoMax: false,
  rotationMode: 'swap',
  rotation: DEFAULT_ROTATION,
};

export function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s || {}) };
  if (!Array.isArray(out.rotation) || !out.rotation.length) out.rotation = DEFAULT_ROTATION;
  return out;
}

// ───────────────────────────────────────────── formatting

/** 4.5 → "4½", 0.5 → "½", -1.5 → "−1½" */
export function fmtPts(n) {
  if (n == null || Number.isNaN(n)) return '–';
  const neg = n < 0;
  const a = Math.abs(n);
  const whole = Math.floor(a + 1e-9);
  const half = a - whole >= 0.25;
  const body = half ? (whole ? `${whole}½` : '½') : `${whole}`;
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
  return st.rotation.findIndex((r) => hole >= r.holes[0] && hole <= r.holes[1]);
}

export function rotationFor(settings, hole) {
  const st = normalizeSettings(settings);
  const i = rotationIndexFor(st, hole);
  if (i < 0) return null;
  const r = st.rotation[i];
  return { index: i + 1, from: r.holes[0], to: r.holes[1], matches: r.matches };
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
  if (teams.length !== 4) return false;
  if (!teams.every((t) => players.filter((p) => p.teamId === t.id).length === 2)) return false;
  const ids = new Set(teams.map((t) => t.id));
  return settings.rotation.every(
    (r) => Array.isArray(r.holes) && Array.isArray(r.matches) && r.matches.every((m) => m.length === 2 && m.every((t) => ids.has(t)))
  );
}

/**
 * The snapshot every screen renders from.
 * event: { course, roster, settings }   scores: [{ player_id, hole, strokes, updated_by, updated_at }]
 */
export function compute(event, scores) {
  const course = event.course;
  const roster = event.roster || { players: [], teams: [], groups: [] };
  const settings = normalizeSettings(event.settings);
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
      id: p.id, personId: p.personId || null, name: p.name, teamId: p.teamId || null, groupId: p.groupId || null,
      teamName: p.teamId ? teamName.get(p.teamId) || p.teamId : null,
      strokes: s, dots, gross, net, meta: rows.map((r) => (r ? { by: r.updated_by || null, at: r.updated_at || null } : null)),
      thru, lastHole, grossToPar, netToPar, grossTotal, netTotal, ...half,
    };
  });
  const playerById = new Map(players.map((p) => [p.id, p]));
  const hasStrokes = players.some((p) => p.strokes > 0);

  const method = settings.teamScore;
  const teams = (roster.teams || []).map((t) => {
    const ps = players.filter((p) => p.teamId === t.id);
    const comps = holes.map((h, i) =>
      ps.length === 2 ? componentsFor(method, ps[0].net[i], ps[1].net[i]) : null
    );
    let thru = 0, toPar = 0, grossToPar = 0;
    comps.forEach((c, i) => {
      if (!c) return;
      thru++;
      const k = method === 'bestBall' ? 0 : c.length - 1; // Low Total for bestBallAggregate
      const parMult = method === 'bestBall' ? 1 : 2;
      toPar += c[k] - parMult * par[i];
      const g = componentsFor(method, ps[0].gross[i], ps[1].gross[i]);
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
    game = computeGame(settings, teams, teamById, holes);
    holeComplete = game.holeComplete;
  }
  let officialThrough = 0;
  while (officialThrough < HOLES && holeComplete[officialThrough]) officialThrough++;
  if (game) finishGame(game, settings, teams, officialThrough);

  const anyPosted = players.some((p) => p.thru > 0);
  const roundComplete = game ? game.matches.every((m) => m.final) : players.length > 0 && allPosted.every(Boolean);

  return {
    course, roster, settings, holes, parTotal: parFront + parBack, parFront, parBack,
    players, playerById, hasStrokes, teams, teamById, game,
    holeComplete, officialThrough, anyPosted, roundComplete,
  };
}

function computeGame(settings, teams, teamById, holes) {
  const ncomp = componentCount(settings.teamScore);
  const halves = Number(settings.halvedHolePoints) || 0;
  const type = settings.game; // rotationMatch | rotationPlusMinus
  const cap = settings.plusMinusCap == null || settings.plusMinusCap === '' ? null : Number(settings.plusMinusCap);
  const rotations = settings.rotation.map((r, ri) => {
    const from = r.holes[0], to = r.holes[1];
    const matches = r.matches.map(([x, y], mi) => {
      const tx = teamById.get(x), ty = teamById.get(y);
      const hs = [];
      const points = { [x]: 0, [y]: 0 };
      let raw = 0; // strokes margin from x's view (y total − x total)
      let played = 0;
      for (let h = from; h <= to; h++) {
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
          hs.push({ hole: h, complete: true, comps: { [x]: cx, [y]: cy }, points: p, margin: { [x]: m, [y]: -m } });
        } else {
          hs.push({ hole: h, complete: false, comps: { [x]: cx, [y]: cy }, points: null, margin: null });
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
      return {
        id: `r${ri + 1}m${mi + 1}`, rotation: ri + 1, from, to, teams: [x, y], holes: hs,
        points, margin: { [x]: capped, [y]: -capped }, rawMargin: { [x]: raw, [y]: -raw },
        played, total, left, final, clinchedBy, result,
      };
    });
    return { index: ri + 1, from, to, matches };
  });
  const matches = rotations.flatMap((r) => r.matches);

  const holeComplete = holes.map((h) => {
    const r = rotations.find((rr) => h.n >= rr.from && h.n <= rr.to);
    if (!r) return false;
    return r.matches.every((m) => m.holes[h.n - m.from].complete);
  });

  // Per-hole points / margins, by team, for complete matchup holes.
  const pointsByHole = holes.map(() => null);
  for (const m of matches) {
    for (const hh of m.holes) {
      if (!hh.complete) continue;
      const slot = (pointsByHole[hh.hole - 1] ||= { points: {}, margin: {}, total: {} });
      for (const t of m.teams) {
        slot.points[t] = hh.points[t];
        slot.margin[t] = hh.margin[t];
        slot.total[t] = hh.comps[t].reduce((a, b) => a + b, 0);
      }
    }
  }
  return { type, ncomp, halves, cap, rotations, matches, holeComplete, pointsByHole, teamIds: teams.map((t) => t.id) };
}

/** Plus/Minus total for a team over holes ≤ through (each rotation capped). */
function pmThrough(game, teamId, through) {
  let total = 0;
  for (const m of game.matches) {
    if (!m.teams.includes(teamId)) continue;
    let raw = 0;
    for (const hh of m.holes) if (hh.complete && hh.hole <= through) raw += hh.margin[teamId];
    total += game.cap != null ? Math.max(-game.cap, Math.min(game.cap, raw)) : raw;
  }
  return total;
}

function pointsThrough(game, teamId, through) {
  let total = 0;
  for (const m of game.matches) {
    if (!m.teams.includes(teamId)) continue;
    for (const hh of m.holes) if (hh.complete && hh.hole <= through) total += hh.points[teamId];
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
      pm, officialPm, provisionalPm: pm - officialPm,
      record: recordOf(game, t.id), officialRecord: recordOf(game, t.id, officialThrough),
      holesPlayed, currentMatchId: current ? current.id : null,
    };
  });
  game.standings = rankStandings(game, rows, true);
  game.liveStandings = rankStandings(game, rows.map((r) => ({ ...r })), false);
  game.provisionalHoles = [];
  for (let h = officialThrough + 1; h <= HOLES; h++) {
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

/** Final-standings tiebreakers: value → match record → head-to-head → secondary margin → shared. */
export function rankStandings(game, rows, official) {
  const isPM = game.type === 'rotationPlusMinus';
  const val = (r) => (isPM ? (official ? r.officialPm : r.pm) : official ? r.officialPoints : r.points);
  const sec = (r) => (isPM ? (official ? r.officialPoints : r.points) : official ? r.officialPm : r.pm);
  const rec = (r) => (official ? r.officialRecord : r.record);
  game._through = official ? game.officialThrough ?? HOLES : HOLES;
  const cmp = (a, b) => {
    const d = val(b) - val(a);
    if (Math.abs(d) > 1e-9) return d;
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

/** The first hole this player's foursome hasn't fully posted (19 = done). */
export function nextHoleFor(snapshot, pid) {
  for (let h = 1; h <= HOLES; h++) {
    const ids = foursomeFor(snapshot.roster, snapshot.settings, pid, h);
    if (!ids.length) return 1;
    if (ids.some((id) => snapshot.playerById.get(id)?.gross[h - 1] == null)) return h;
  }
  return HOLES + 1;
}

/** The match a team is in on a hole. */
export function matchFor(snapshot, teamId, hole) {
  if (!snapshot.game || !teamId) return null;
  return snapshot.game.matches.find((m) => m.teams.includes(teamId) && hole >= m.from && hole <= m.to) || null;
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
      row.rounds.add(event.id || event.code);
      people.set(k, row);
    }
    if (!snap.game) continue;
    counted++;
    const pts = (m, t) => (snap.game.type === 'rotationPlusMinus' ? m.margin[t] : m.points[t]);
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
