// locker.js — 035 Scorecard locker: the pure rules (SPEC §3). No DOM, no network: tests/locker035.test.mjs.
// 036: each card also carries courseObj (the round's course, for its stamp) and group (who finished 18 that day,
// ranked, for the card back); backRows() fits that list into the back's column (tests/stamps036.test.mjs).
// Cards are derived from events + scores; only "this pack was opened" is stored (card_opens).
//
//   buildLocker(rows, personId, { today, opens, pending }) → cards, in round order (oldest first)
//   rows   = [{ event, scores }]  (scores may be the whole round's or just this player's rows)
//   opens  = card_opens rows for this person ({ event_id, opened_at })
//   pending = round codes opened on this phone while offline (glb.lockerPending), counted as opened

import { sameFoursome } from './scoring.js';

export const LAUNCH_DATE = '2026-11-21';
/** Who sees the admin list (§8). The check is in the app only: nothing here is secret. */
export const LOCKER_ADMINS = ['eeae7a48-33fa-4052-ad0c-fc7623173fe6']; // Andrew

export const FINISHES = {
  prismatic: { name: 'Prismatic', grade: 'S' },
  gold: { name: 'Gold', grade: 'A' },
  silver: { name: 'Silver', grade: 'B' },
  bronze: { name: 'Bronze', grade: 'C' },
  standard: { name: 'Standard', grade: null },
  rookie: { name: 'Rookie', grade: null },
};
/** Launch ladder by how many launch rounds a person has (best round first); 5+ = this, then standard. */
const LADDER = { 1: ['silver'], 2: ['gold', 'silver'], 3: ['gold', 'silver', 'bronze'], 4: ['prismatic', 'gold', 'silver', 'bronze'] };
const LADDER5 = ['prismatic', 'gold', 'silver', 'bronze'];

const sum = (a) => a.reduce((x, y) => x + y, 0);
const ordinalWord = (n) => (n === 1 ? 'best' : `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]} best`);
export const isAdmin = (personId) => !!personId && LOCKER_ADMINS.includes(personId);

/** Your normal (§3.3): rounds before this one, up to the last 20, worst fifth left out, averaged, rounded. */
export function normalOf(prevGross) {
  const win = prevGross.slice(-20);
  if (!win.length) return null;
  const cut = Math.floor(win.length / 5);
  const keep = [...win].sort((a, b) => a - b).slice(0, win.length - cut);
  return Math.round(sum(keep) / keep.length);
}

/** diff = normal − gross → finish (§3.3). */
export function finishForDiff(diff) {
  if (diff >= 5) return 'prismatic';
  if (diff >= 3) return 'gold';
  if (diff >= 0) return 'silver';
  if (diff >= -3) return 'bronze';
  return 'standard';
}

export function normalLine(diff, normal) {
  if (diff > 0) return `${diff} better than your normal of ${normal}`;
  if (diff === 0) return `Right on your normal of ${normal}`;
  return `${-diff} over your normal of ${normal}`;
}

/** The back of the card (§3.5): counts, by hole type, best run, nines. */
export function cardStats(strokes, par) {
  const d = strokes.map((s, i) => s - par[i]);
  const count = {
    eagles: d.filter((x) => x <= -2).length, birdies: d.filter((x) => x === -1).length, pars: d.filter((x) => x === 0).length,
    bogeys: d.filter((x) => x === 1).length, doubles: d.filter((x) => x >= 2).length,
  };
  const byType = [3, 4, 5].map((p) => ({ par: p, holes: par.filter((x) => x === p).length, toPar: sum(d.filter((_, i) => par[i] === p)) }))
    .filter((t) => t.holes);
  let bestRun = 0, run = 0;
  for (const x of d) { run = x <= 0 ? run + 1 : 0; bestRun = Math.max(bestRun, run); }
  return { count, byType, bestRun, front: sum(strokes.slice(0, 9)), back: sum(strokes.slice(9)), parFront: sum(par.slice(0, 9)), parBack: sum(par.slice(9)) };
}

const dayOf = (e) => e.played_on || String(e.created_at || '').slice(0, 10) || null;

/** §3.1: the rounds that count for a person, in round order (played_on, then created_at). */
export function personRounds(rows, personId, today) {
  const out = [];
  for (const r of rows || []) {
    const e = r?.event;
    if (!e || String(e.settings?.practice) === 'true') continue;
    const p = (e.roster?.players || []).find((x) => x && x.personId === personId);
    if (!p) continue;
    const day = dayOf(e);
    if (!(e.finalized_at || (day && today && day < today))) continue;
    const par = (e.course?.par || []).slice(0, 18).map(Number);
    if (par.length !== 18 || par.some((x) => !(x >= 3))) continue;
    const strokes = Array(18).fill(null);
    for (const s of r.scores || []) {
      if (s.player_id === p.id && s.hole >= 1 && s.hole <= 18 && s.strokes != null) strokes[s.hole - 1] = Number(s.strokes);
    }
    if (strokes.some((x) => !(x >= 1))) continue;
    out.push({ event: e, player: p, strokes, par, day, scores: r.scores || [] });
  }
  return out.sort((a, b) => String(a.day).localeCompare(String(b.day)) || String(a.event.created_at || '').localeCompare(String(b.event.created_at || '')));
}

const courseKey = (e) => e.course?.id || e.course?.shortName || e.course?.name || '';
export const courseLabel = (e) => e.course?.shortName || e.course?.name || 'Golf';

/** 036 §6.1: every roster player with 18 strokes in this round, by gross; ties share a rank. */
export function groupOf(event, scores, meId) {
  const st = new Map();
  for (const s of scores || []) {
    if (s.strokes == null || !(s.hole >= 1 && s.hole <= 18)) continue;
    const a = st.get(s.player_id) || Array(18).fill(null);
    a[s.hole - 1] = Number(s.strokes);
    st.set(s.player_id, a);
  }
  const out = [];
  for (const p of event.roster?.players || []) {
    const a = p && st.get(p.id);
    if (!a || a.some((x) => !(x >= 1))) continue;
    let same = false;
    try { same = p.id !== meId && sameFoursome(event.roster, event.settings, meId, p.id, 1); } catch { /* old shapes */ }
    out.push({ playerId: p.id, personId: p.personId || null, name: p.firstName || String(p.name || '').split(' ')[0] || '', gross: sum(a), me: p.id === meId, sameTeeTime: same });
  }
  out.sort((a, b) => a.gross - b.gross || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  out.forEach((x) => { x.rank = out.findIndex((y) => y.gross === x.gross) + 1; });
  return out;
}

/** 036 §2.3: the big-group list on the card back. Rank ≤ cap: the first `cap` rows. Lower: the first cap − 4 rows,
 *  a gap, the player above you, you, the player below. → { rows: [player | { gap: true }], more, tee } */
export function backRows(group, cap = 11) {
  const g = group || [];
  const idx = g.findIndex((x) => x.me);
  const tee = g.some((x) => x.sameTeeTime);
  if (idx < cap) return { rows: g.slice(0, cap), more: Math.max(0, g.length - cap), tee };
  const a = Math.max(cap - 4, 0), lo = Math.max(idx - 1, a), hi = Math.min(idx + 1, g.length - 1);
  return { rows: [...g.slice(0, a), { gap: true }, ...g.slice(lo, hi + 1)], more: g.length - 1 - hi, tee };
}

/** Every card for a person (§3), oldest first. */
export function buildLocker(rows, personId, { today = null, opens = [], pending = [] } = {}) {
  const rounds = personRounds(rows, personId, today);
  const openAt = new Map((opens || []).map((o) => [o.event_id, o.opened_at || true]));
  const pend = new Set(pending || []);
  const launch = rounds.filter((r) => r.day <= LAUNCH_DATE);
  // Launch ladder: best gross first, a tie goes to the earlier round.
  const ranked = launch.map((r, i) => ({ r, i, g: sum(r.strokes) })).sort((a, b) => a.g - b.g || a.i - b.i);
  const ladder = LADDER[launch.length] || LADDER5;
  const launchFin = new Map(ranked.map((x, k) => [x.r, { fin: ladder[k] || 'standard', rank: k + 1 }]));
  const cards = [];
  const broke = new Set();
  let birdied = false;
  rounds.forEach((r, i) => {
    const e = r.event;
    const gross = sum(r.strokes);
    const prev = cards.map((c) => c.gross);
    const stats = cardStats(r.strokes, r.par);
    const c = {
      key: e.id, eventId: e.id, code: e.code, playerId: r.player.id, personId, n: i + 1,
      day: r.day, course: courseLabel(e), courseKey: courseKey(e), courseObj: e.course || null, par: r.par, strokes: r.strokes,
      group: groupOf(e, r.scores, r.player.id),
      gross, toPar: gross - sum(r.par), stats,
      name: r.player.firstName || String(r.player.name || '').split(' ')[0] || '',
      fullName: [r.player.firstName, r.player.lastName].filter(Boolean).join(' ') || String(r.player.name || ''),
      crew: (e.roster?.players || []).length > 1,
      opened: openAt.has(e.id) || pend.has(e.code), openedAt: typeof openAt.get(e.id) === 'string' ? openAt.get(e.id) : null,
      kind: null, fin: null, grade: null, line: '', normal: null, diff: null,
    };
    if (launchFin.has(r)) {
      const { fin, rank } = launchFin.get(r);
      c.kind = 'launch';
      c.fin = fin;
      c.launchRank = rank;
      c.line = launch.length === 1 ? 'Launch card'
        : fin === 'standard' ? 'Launch card' : `Launch card · your ${ordinalWord(rank)} of your first ${launch.length} rounds`;
    } else if (i < 3) {
      c.kind = 'rookie';
      c.fin = 'rookie';
      c.rookieN = i + 1;
      c.line = `Rookie card ${i + 1} of 3`;
    } else {
      c.kind = 'graded';
      c.normal = normalOf(prev);
      c.diff = c.normal - gross;
      c.fin = finishForDiff(c.diff);
      c.line = c.fin === 'standard' ? '' : normalLine(c.diff, c.normal);
    }
    c.grade = FINISHES[c.fin].grade;
    // Stamps (§3.4), permanent, in round order.
    const st = [];
    for (const n of [100, 90, 80]) {
      if (gross < n && !broke.has(n)) {
        broke.add(n);
        if (prev.length && prev.every((g) => g >= n)) st.push(`Broke ${n}`);
      }
    }
    if (prev.length && gross < Math.min(...prev)) st.push('Lowest round yet');
    if (stats.count.eagles) st.push('Eagle');
    if (!birdied && (stats.count.birdies || stats.count.eagles)) { birdied = true; st.push('First birdie'); }
    const here = cards.filter((x) => x.courseKey === c.courseKey).map((x) => x.gross);
    if (here.length && gross < Math.min(...here)) st.push(`Best at ${c.course}`);
    c.stamps = st;
    cards.push(c);
  });
  return cards;
}

/** Sealed packs, oldest first (the "Open next pack" order). */
export const packsOf = (cards) => (cards || []).filter((c) => !c.opened);
/** Opened cards, newest first (the Locker's order). */
export const openedOf = (cards) => (cards || []).filter((c) => c.opened).slice().reverse();

/** Short date, "Nov 20"; long, "Nov 20, 2026". */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDay = (d) => { const [, m, dd] = String(d || '').split('-').map(Number); return m ? `${MON[m - 1]} ${dd}` : ''; };
export const longDay = (d) => { const [y, m, dd] = String(d || '').split('-').map(Number); return m ? `${MON[m - 1]} ${dd}, ${y}` : ''; };
export const toParLabel = (n) => (n > 0 ? `+${n}` : n === 0 ? 'E' : String(n));
export const finName = (c) => (c.fin === 'rookie' ? `Rookie ${c.rookieN}/3` : FINISHES[c.fin].name);

/** Admin totals (§8) from locker_admin rows: "17 people · 36 packs · 6 opened". */
export function adminTotals(people) {
  const list = people || [];
  return { people: list.length, packs: sum(list.map((p) => Number(p.rounds) || 0)), opened: sum(list.map((p) => Number(p.opened) || 0)) };
}
