// play031.js — brief 031 §2: the Board and Matches for each way of playing ("who are you playing for").
// Which view a round gets is decided in pure js/playfor.js (playFor); this file only draws. Display only:
// every number comes from the engine (scoring.compute) through riderview.matchState / race.js.
//   partners  Board 03 (players by stretches won + your matches), Matches 04 (one tab per partner)
//   cart      Board 05 / 07 (carts ranked + the live matches), Matches 06 (one tab per stretch / opponent)
//   oneMatch  Board 08 (the match card + players), Matches 09 (the hole calendar)
//   alone     Board 11 (leaderboard), Matches 12–16 (the race)
//   stroke    Board 17 (to par), Matches 18 (your group's last three holes)
// Team Ryder Cup and old shapes keep their screens. Waiting-for-first-scores and the final card are today's.

import { esc, seg, seg2, mark } from '../ui.js';
import { fmtPts, fmtToPar, fmtSigned, playerLeaderboard, projectedGross, playOrder, HOLES, teeTimeName, groupIndex, teeClock } from '../scoring.js';
import { matchState, holeLines } from '../riderview.js';
import { raceState, raceCard, dec } from '../race.js';
import { placeLine, stretchesWon } from '../playfor.js';
import { flag } from './ryder.js';

const first = (p) => p?.firstName || String(p?.name || '').split(' ')[0];
const pair = (c) => c.names.join(' + ');
const holesOf = (label) => String(label || '').replace(/^Holes /, '');

// ───────────────────────────────────────────── shared pieces

/** The headline: kicker, then the place big and the detail small beside it ("3rd  6 back of Mike + Tyler"). */
function placeHead(kicker, right, pl) {
  return `<div class="p31-k ts-label"><span>${esc(kicker)}</span>${right ? `<span>${esc(right)}</span>` : ''}</div>
    ${pl.place ? `<div class="p31-place"><span class="ts-title${/^(1st|T1)$/.test(pl.place) ? ' you' : ''}">${esc(pl.place)}</span><span>${esc(pl.detail)}</span></div>` : ''}`;
}

/** A table card: cols = [{ label, cls }] after Pos + Player; rows = [{ pos, name, cells: [html], me, lit, out, pid }]. */
function table(cols, rows, { cls = '', cut = -1, cutLabel = 'Out of reach' } = {}) {
  const head = `<div class="p31-tr p31-th ts-label"><span></span><span>Player</span>${cols.map((c) => `<span>${esc(c)}</span>`).join('')}</div>`;
  const body = rows.map((r, i) => `${i === cut ? `<div class="p31-cut ts-label">${esc(cutLabel)}</div>` : ''}<button class="p31-tr${r.me ? ' me' : ''}${r.lit ? ' lit' : ''}${r.out ? ' out' : ''}"${r.pid ? ` data-act="board-player" data-v="${esc(r.pid)}"` : ' tabindex="-1"'}>
      <span class="p31-pos mono">${esc(r.pos)}</span><b class="ellipsis">${esc(r.name)}</b>${r.cells.join('')}</button>`).join('');
  return `<div class="p31-tab ${cls}" style="--cols:${cols.length}">${head}${body}</div>`;
}
const cell = (v, strong = false) => `<span class="mono${strong ? ' v' : ''}">${v}</span>`;

/** The Players table (thru · gross · proj · net) for boards whose top is a match card. */
function playersTable(app) {
  const snap = app.snapshot;
  const ranked = playerLeaderboard(snap, 'net');
  const ranks = rankLabels(ranked, (p) => p.netToPar);
  return table(['Thru', 'Gross', 'Proj', 'Net'], ranked.map((p) => ({
    pos: ranks.get(p.id), name: p.name, me: p.id === app.me, pid: p.id,
    cells: [cell(p.thru || '–'), cell(p.thru ? fmtToPar(p.grossToPar) : '–', true), cell(p.thru ? projectedGross(snap, p) ?? '–' : '–'), cell(p.thru ? fmtToPar(p.netToPar) : '–', true)],
  })), { cls: 'p31-four' });
}

/** "1", "2", "T3", "T3" for players sorted best first (players without a score get no place). */
function rankLabels(sorted, val) {
  const out = new Map();
  const played = sorted.filter((p) => p.thru);
  played.forEach((p, i) => {
    const rank = played.findIndex((q) => val(q) === val(p)) + 1;
    const tied = played.filter((q) => val(q) === val(p)).length > 1;
    out.set(p.id, `${tied ? 'T' : ''}${rank}`);
  });
  for (const p of sorted) if (!out.has(p.id)) out.set(p.id, '');
  return out;
}

/** The match card (031 §2.1): two totals, one bar filling from each end, the middle line = what wins. */
function matchCard(app, m, { kicker, lit = false, holesLeft = false } = {}) {
  const ncomp = app.snapshot.game?.ncomp || 1;
  const [u, t] = m.holePts;
  const max = m.maxPts || m.total * ncomp;
  const mine = m.us.you;
  const k = kicker ?? (m.status === 'done' ? 'Final' : m.status === 'notStarted' ? 'Up next' : `Thru ${m.thru} of ${m.total}`);
  const left = m.status === 'done' ? 'Match over' : holesLeft || ncomp === 1 ? `${m.total - m.thru} hole${m.total - m.thru === 1 ? '' : 's'} left` : `${fmtPts((m.total - m.thru) * ncomp)} pts left`;
  return `<section class="p31-card${lit ? ' lit' : ''}">
      <span class="ts-label p31-ck${lit ? ' you' : ''}">${esc(k)}</span>
      <div class="p31-two">
        <div><b class="ellipsis${mine ? ' you' : ''}">${esc(pair(m.us))}</b><span class="ts-number-xl mono${mine ? ' you' : ''}">${esc(fmtPts(u))}</span></div>
        <div class="them"><b class="ellipsis">${esc(pair(m.them))}</b><span class="ts-number-xl mono">${esc(fmtPts(t))}</span></div>
      </div>
      <div class="p31-bar"><i class="l${mine ? '' : ' plain'}" style="width:${Math.min(100, (u / max) * 100)}%"></i><i class="r" style="width:${Math.min(100, (t / max) * 100)}%"></i><i class="mid"></i></div>
      <div class="p31-ft"><span>${esc(left)}</span><b>${esc(fmtPts(m.clinchAt))} to win</b><span></span></div>
    </section>`;
}

/** One match row on the Board: both pairs, the flag hanging toward whoever holds it (015's flag). */
function matchRow(m) {
  const side = m.flag.side;
  const nm = (c, cls) => `<span class="ry-nm ${cls}">${c.names.map((n) => `<span class="ellipsis">${esc(n)}</span>`).join('')}</span>`;
  const usCls = m.us.you ? 'you' : m.result === 'lost' ? 'muted' : '';
  const themCls = m.them.you ? 'you' : m.result === 'won' ? 'muted' : '';
  return `<button class="ry-row" data-act="ry-match" data-v="${esc(m.id)}">
      <span class="ry-cell l${side === 'us' ? ' hold' : ''}">${nm(m.us, usCls)}</span>
      <span class="ry-line">${flag(m)}</span>
      <span class="ry-cell r${side === 'them' ? ' hold' : ''}">${nm(m.them, themCls)}</span></button>`;
}

/** The stretches on the Board: live first, then the finished ones; what's next peeks at the end. */
function stretches(app, st, view) {
  const partnerOf = (m) => m.us.names.filter((n, i) => m.us.playerIds[i] !== app.me).join(' + ');
  const mineOnly = view === 'partners';
  return st.order.map((r) => {
    const ms = mineOnly ? r.matches.filter((m) => st.mine.has(m.us.id)) : r.matches;
    if (!ms.length) return '';
    const holes = holesOf(r.label);
    const left = mineOnly ? `Holes ${holes} · with ${partnerOf(ms[0])}` : `Holes ${holes}${r.status === 'live' ? ' · live' : ''}`;
    const right = r.status === 'done' ? 'done' : r.status === 'future' ? (mineOnly ? 'up next' : ms.some((m) => m.us.you) ? `vs ${pair(ms.find((m) => m.us.you).them)}` : 'up next')
      : ms.length > 2 ? `${ms.length} matches` : `thru ${Math.max(0, ...ms.map((m) => m.thru))}`;
    const you = r.status === 'live' && ms.some((m) => m.us.you);
    const head = `<div class="p31-rot"><span class="ts-label${you ? ' you' : ''}">${esc(left)}</span><span class="ts-label">${esc(right)}</span></div>`;
    if (r.status === 'future') return `<div class="p31-stretch peek">${head}</div>`;
    return `<div class="p31-stretch">${head}<div class="p31-rows">${ms.map(matchRow).join('')}</div></div>`;
  }).join('');
}

const segs = (app, first) => {
  const v = app.ui.boardView === 'players' ? 'players' : 'teams';
  return { v, html: `<div class="segs board-segs">${seg('board-view', [['teams', first], ['players', 'Players']], v)}</div>` };
};

// ───────────────────────────────────────────── Board

export function board031(app, view, { final = '' } = {}) {
  const snap = app.snapshot;
  const g = snap.game;
  const left = HOLES - snap.officialThrough;
  const leftTxt = snap.roundComplete ? '' : `${left} left`;
  const official = snap.roundComplete ? 'final' : snap.officialThrough ? `official thru ${snap.officialHole}` : 'nothing official yet';

  if (view === 'cart') {
    const isPM = g.type === 'rotationPlusMinus';
    const rows = (snap.roundComplete ? g.standings : g.liveStandings).map((s) => {
      const team = snap.teamById.get(s.teamId);
      return { id: s.teamId, name: team.name, rank: s.rank, value: isPM ? s.pm : s.points, thru: Math.min(...team.playerIds.map((id) => snap.playerById.get(id).thru)) };
    });
    const me = app.myTeam();
    const pl = placeLine(rows, me, { fmt: isPM ? (n) => fmtSigned(n, '0') : fmtPts });
    const st = matchState(snap, app.me);
    const { v, html } = segs(app, 'Matches');
    const rowsHtml = rows.map((r) => `<div class="p31-br${r.id === me ? ' me lit' : ''}"><span class="p31-pos mono">${rows.filter((x) => x.rank === r.rank).length > 1 ? 'T' : ''}${r.rank}</span><b class="ellipsis">${esc(r.name)}</b><span class="mono v">${esc(isPM ? fmtSigned(r.value, 'E') : fmtPts(r.value))}</span><span class="mono">${r.thru}</span></div>`).join('');
    return `<div class="plain p31">${final}
      <section class="p31-bug">${placeHead(`Leaderboard · ${official}`, leftTxt, pl)}
        <div class="p31-br p31-bh ts-label"><span>Pos</span><span>Cart</span><span>${isPM ? '+/−' : 'Pts'}</span><span>Thru</span></div>${rowsHtml}</section>
      ${html}${v === 'players' ? playersTable(app) : stretches(app, st, view)}</div>`;
  }

  if (view === 'partners') {
    const won = stretchesWon(snap);
    const byStretch = snap.settings.dayBy === 'stretches'; // 031 step 3: new partner rounds rank by stretches won
    const rows = g.people.map((r) => ({ id: r.playerId, name: snap.playerById.get(r.playerId).name, rank: r.rank, value: byStretch ? r.won : r.points }));
    let pl = placeLine(rows, app.me, byStretch ? { fmt: (n) => `${fmtPts(n)} set${n === 1 ? '' : 's'}` } : {});
    const st = matchState(snap, app.me);
    const live = st?.matches.find((m) => st.mine.has(m.us.id) && m.status === 'live');
    if (live && app.me) {
      const partner = live.us.names.filter((n, i) => live.us.playerIds[i] !== app.me).join(' + ');
      pl = { ...pl, detail: `${live.leader === 'us' ? `${live.margin} up` : live.leader === 'them' ? `${live.margin} down` : 'all square'} with ${partner} right now` };
    }
    const { v, html } = segs(app, 'Your matches');
    const rowsHtml = rows.map((r) => `<div class="p31-br${r.id === app.me ? ' me lit' : ''}"><span class="p31-pos mono">${rows.filter((x) => x.rank === r.rank).length > 1 ? 'T' : ''}${r.rank}</span><b class="ellipsis">${esc(r.name)}</b><span class="mono v">${esc(fmtPts(won[r.id] || 0))}</span><span class="mono">${esc(fmtPts(g.people.find((x) => x.playerId === r.id).points))}</span></div>`).join('');
    return `<div class="plain p31">${final}
      <section class="p31-bug">${placeHead('Leaderboard · sets won', leftTxt, pl)}
        <div class="p31-br p31-bh ts-label"><span>Pos</span><span>Player</span><span>Won</span><span>Pts</span></div>${rowsHtml}</section>
      ${html}${v === 'players' ? playersTable(app) : stretches(app, st, view)}</div>`;
  }

  if (view === 'oneMatch') {
    const st = matchState(snap, app.me);
    const ms = [...st.matches].sort((a, b) => (b.us.you ? 1 : 0) - (a.us.you ? 1 : 0));
    const many = ms.length > 1;
    const tee = (m) => teeClock(snap.settings, m.us.tee) || '';
    const cards = ms.map((m) => {
      const thru = m.status === 'done' ? 'final' : m.status === 'notStarted' ? 'up next' : `thru ${m.thru}`;
      const k = many ? [m.us.you ? 'Your match' : '', tee(m), thru].filter(Boolean).join(' · ') : thru;
      return matchCard(app, m, { kicker: k, lit: many && m.us.you && m.status === 'live', holesLeft: true });
    }).join('');
    return `<div class="plain p31">${final}${cards}${playersTable(app)}</div>`;
  }

  if (view === 'alone') {
    const st = snap.roundComplete ? g.standings : g.liveStandings;
    const me = app.myTeam();
    const pid = (s) => snap.teamById.get(s.teamId).playerIds[0];
    const rows = st.map((s) => ({ id: s.teamId, name: snap.teamById.get(s.teamId).name, rank: s.rank, value: s.points }));
    const pl = placeLine(rows, me, { fmt: dec });
    const whole = st.every((s) => Number.isInteger(Math.round(s.points * 1e6) / 1e6));
    const pts = (n) => (whole ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1));
    const cols = snap.hasStrokes ? ['Pts', 'Won', 'Thru', 'Gross', 'Net'] : ['Pts', 'Won', 'Thru', 'Gross'];
    const trows = st.map((s) => {
      const p = snap.playerById.get(pid(s));
      const tied = st.filter((x) => x.rank === s.rank).length > 1;
      const cells = [cell(pts(s.points), true), cell(s.won || 0), cell(p.thru || '–'), cell(p.thru ? fmtToPar(p.grossToPar) : '–', true)];
      if (snap.hasStrokes) cells.push(cell(p.thru ? fmtToPar(p.netToPar) : '–', true));
      return { pos: `${tied ? 'T' : ''}${s.rank}`, name: p.name, me: s.teamId === me, lit: s.teamId === me, pid: p.id, cells };
    });
    return `<div class="plain p31">${final}${placeHead(`Leaderboard · ${official}${leftTxt ? ` · ${leftTxt}` : ''}`, '', pl)}
      ${table(cols, trows, { cls: snap.hasStrokes ? 'p31-five' : 'p31-four' })}
      <p class="p31-note">Won = holes won alone. Tap a name for their round.</p></div>`;
  }

  if (view === 'stroke') {
    const sorted = playerLeaderboard(snap, 'gross');
    const ranks = rankLabels(sorted, (p) => p.grossToPar);
    const played = sorted.filter((p) => p.thru);
    const rows = played.map((p) => ({ id: p.id, name: p.name, rank: Number(ranks.get(p.id).replace('T', '')), value: p.grossToPar }));
    const pl = placeLine(rows, app.me, { fmt: (n) => String(n), ahead: (a, b) => b.value - a.value });
    const cols = snap.hasStrokes ? ['To par', 'Thru', 'Gross', 'Net'] : ['To par', 'Thru', 'Gross'];
    const trows = sorted.map((p) => {
      const cells = [cell(p.thru ? fmtToPar(p.grossToPar) : '–', true), cell(p.thru || '–'), cell(p.thru ? p.grossTotal : '–')];
      if (snap.hasStrokes) cells.push(cell(p.thru ? fmtToPar(p.netToPar) : '–', true));
      return { pos: ranks.get(p.id), name: p.name, me: p.id === app.me, lit: p.id === app.me, pid: p.id, cells };
    });
    return `<div class="plain p31">${final}${placeHead('Leaderboard · strokes to par', '', pl)}
      ${table(cols, trows, { cls: snap.hasStrokes ? 'p31-four' : 'p31-three' })}</div>`;
  }
  return null;
}

// ───────────────────────────────────────────── Matches

/** What the selected hole did, in one line: { text, pts, good } (low ball / low total, or best ball). */
function holeLine(app, m, h, ncomp) {
  if (!h.points) {
    const text = h.whoIsIn === 'us' ? `Waiting on ${pair(m.them)}` : h.whoIsIn === 'them' ? (m.us.you ? 'Waiting on your scores' : `Waiting on ${pair(m.us)}`) : 'No scores yet';
    return { text, pts: '', good: false };
  }
  const snap = app.snapshot;
  const u = h.points.us, t = h.points.them;
  const pts = u > 0 ? `+${fmtPts(u)}` : '0';
  if (ncomp === 1) {
    const side = h.lowBall;
    if (side === 'halved') return { text: `Halved, ${Math.min(...h.net.us)} each`, pts: '½ each', good: false };
    const c = side === 'us' ? m.us : m.them, nets = h.net[side];
    const low = Math.min(...nets);
    const who = c.playerIds.filter((pid, i) => nets[i] === low);
    const names = who.map((pid) => c.names[c.playerIds.indexOf(pid)]).join(' + ');
    const gross = snap.playerById.get(who[0])?.gross[h.hole - 1];
    const word = gross !== low ? `net ${low}` : String(low);
    return { text: `${names}’s ${word} wins it`, pts, good: side === 'us' };
  }
  const to = (w) => (w === 'us' ? (m.us.you ? 'to you' : `to ${pair(m.us)}`) : w === 'them' ? `to ${pair(m.them)}` : 'halved');
  let text;
  if (h.lowBall === h.lowTotal) text = h.lowBall === 'us' && m.us.you ? 'Low ball and low total' : h.lowBall === 'halved' ? 'Halved, low ball and low total' : `Low ball and low total ${to(h.lowBall)}`;
  else text = `Low ball ${to(h.lowBall)}, low total ${to(h.lowTotal)}`;
  return { text, pts: h.lowBall === 'halved' && h.lowTotal === 'halved' ? `${fmtPts(u)} each` : pts, good: u > t };
}

/** Hole tiles, six to a row: finished solid with the result, the live hole lit, the rest dashed. */
function holeTiles(m, selHole, ncomp, { lightLive = true } = {}) {
  const live = m.status === 'done' || m.status === 'notStarted' && !m.holes.some((h) => h.whoIsIn !== 'none') ? null : m.holes.find((h) => !h.points)?.hole;
  const liveIdx = live == null ? m.holes.length : m.holes.findIndex((h) => h.hole === live);
  return `<div class="p31-hg">${m.holes.map((h, i) => {
    let v = '';
    if (h.points) {
      const { us, them } = h.points;
      v = ncomp === 1 ? (us > them ? '<em class="w">W</em>' : us < them ? '<em>L</em>' : '<em>½</em>') : `<em class="${us > them ? 'w' : ''}">${us > 0 ? `+${fmtPts(us)}` : '0'}</em>`;
    } else v = h.whoIsIn !== 'none' ? '<em>–</em>' : '<em></em>';
    const cls = h.hole === live && lightLive ? 'lit' : h.hole === selHole ? 'sel' : i > liveIdx && h.whoIsIn === 'none' ? 'fut' : '';
    return `<button class="p31-ht ${cls}" data-act="ry-hole" data-m="${esc(m.id)}" data-v="${h.hole}" aria-pressed="${h.hole === selHole}"><span class="mono">${h.hole}</span>${v}</button>`;
  }).join('')}</div>`;
}

/** The selected hole: four scores (dimmed where they didn't count) and one line saying what it did. */
function holeDetail(app, m, h, ncomp) {
  const snap = app.snapshot;
  const strokes = [...m.us.playerIds, ...m.them.playerIds].map((pid) => (snap.playerById.get(pid)?.dots[h.hole - 1] || 0) > 0);
  const hl = holeLines(h, m.us.names, m.them.names, strokes, { mine: m.us.you });
  const col = (name, pid, i, you) => {
    const gr = snap.playerById.get(pid)?.gross[h.hole - 1] ?? null;
    return `<div><b class="ellipsis${you ? ' you' : ''}">${esc(name)}</b>${gr == null ? '<span class="p31-dash">–</span>' : mark(gr, h.par, 34, { cls: hl.counts[i] ? '' : 'rm-dim' })}</div>`;
  };
  const line = holeLine(app, m, h, ncomp);
  return `<div class="p31-hs">${[col(m.us.names[0], m.us.playerIds[0], 0, m.us.you), col(m.us.names[1], m.us.playerIds[1], 1, m.us.you),
    col(m.them.names[0], m.them.playerIds[0], 2, false), col(m.them.names[1], m.them.playerIds[1], 3, false)].join('')}</div>
    <div class="p31-lowl"><span>Hole ${h.hole}</span><b class="${line.good ? 'you' : ''}">${esc(line.text)}</b><span class="mono${line.good ? ' you' : ''}">${esc(line.pts)}</span></div>`;
}

function matchesMatch(app, view) {
  const snap = app.snapshot;
  const st = matchState(snap, app.me);
  const mine = st ? st.matches.filter((m) => st.mine.has(m.us.id)) : [];
  if (!mine.length) {
    return `<div class="plain p31"><h1 class="ts-title p31-mt">You’re watching</h1>
      <p class="p31-sub">Matches shows your own match. The Board has every match: tap one to see it.</p></div>`;
  }
  const ncomp = snap.game.ncomp || 1;
  const current = mine.find((x) => x.status === 'live') || mine.find((x) => x.status === 'notStarted') || mine[mine.length - 1];
  const m = mine.find((x) => x.id === app.ui.ryMatch) || current;
  const partner = m.us.names.filter((n, i) => m.us.playerIds[i] !== app.me).join(' + ');
  const method = snap.game.type === 'rotationPlusMinus' ? 'plus / minus' : snap.settings.teamScore === 'bestBallAggregate' ? 'low ball + low total' : snap.settings.teamScore === 'aggregate' ? 'team total' : 'best ball';
  const title = view === 'partners' ? `With ${partner}` : `vs ${pair(m.them)}`;
  const sub = view === 'partners' ? `vs ${pair(m.them)} · holes ${holesOf(m.label)}` : `${m.label} · ${method}`;
  const sameHoles = new Set(mine.map((x) => x.label)).size < mine.length; // three carts: both your matches are 1–18
  const status = (x) => (x.status === 'live' ? 'live' : x.status === 'notStarted' ? (view === 'partners' ? '' : pair(x.them))
    : `${x.result === 'won' ? 'won' : x.result === 'lost' ? 'lost' : 'halved'} ${fmtPts(x.holePts[0])}–${fmtPts(x.holePts[1])}`);
  const picker = mine.length < 2 ? '' : seg2('ry-rot', mine.map((x) => sameHoles
    ? [x.id, `vs ${pair(x.them)}`, status(x) === pair(x.them) ? 'up next' : status(x), { live: x.status === 'live' }]
    : [x.id, holesOf(x.label), view === 'partners' ? `with ${x.us.names.filter((n, i) => x.us.playerIds[i] !== app.me).join(' + ')}` : status(x), { live: x.status === 'live' }]), m.id);
  const anyIn = m.holes.filter((x) => x.whoIsIn !== 'none');
  const selHole = Number(app.ui.ryHole?.[m.id]) || (anyIn[anyIn.length - 1] || m.holes[0]).hole;
  const h = m.holes.find((x) => x.hole === selHole) || m.holes[0];
  return `<div class="plain p31 p31-m">
      <h1 class="ts-title p31-mt ellipsis">${esc(title)}</h1><p class="p31-sub">${esc(sub)}</p>
      ${picker ? `<div class="p31-pick">${picker}</div>` : ''}
      ${view === 'oneMatch' ? '' : matchCard(app, m)}
      ${holeTiles(m, selHole, ncomp)}
      ${holeDetail(app, m, h, ncomp)}
    </div>`;
}

/** The race (031 §2.2): kicker, place, a card only when a hole decides something, Pos / Player / Pts / Back. */
function matchesRace(app) {
  const snap = app.snapshot;
  const g = snap.game;
  const order = playOrder(snap.settings);
  const players = snap.teams.map((t) => ({ id: t.id, name: t.name }));
  const me = app.myTeam();
  const holes = order.map((h) => ({ hole: h, scores: g.holes[h - 1].complete ? g.holes[h - 1].net : {} }));
  const args = { players, holes, me, lastHole: order[HOLES - 1] };
  const r = raceState({ ...args, holes: holes.filter((h) => Object.keys(h.scores).length) });
  const card = raceCard(args);
  const rows = r.rows.map((x) => ({ id: x.id, name: x.name, rank: x.rank, value: x.points }));
  let pl = placeLine(rows, me, { fmt: dec });
  if (r.locked && me && me !== r.leader) pl = { ...pl, detail: `${players.find((p) => p.id === r.leader)?.name} has it` };
  const whole = r.rows.every((x) => Number.isInteger(Math.round(x.points * 1e6) / 1e6));
  const pts = (n) => (whole ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1));
  const top = r.points[r.leader];
  const cut = r.rows.findIndex((x) => x.out);
  const trows = r.rows.map((x) => {
    const tied = r.rows.filter((y) => y.rank === x.rank).length > 1;
    const pid = snap.teamById.get(x.id)?.playerIds[0];
    return { pos: `${tied ? 'T' : ''}${x.rank}`, name: x.name, me: x.me, lit: x.me, out: x.out, pid, cells: [cell(pts(x.points), true), cell(x.rank === 1 ? '–' : dec(top - x.points))] };
  });
  const cardHtml = card ? `<section class="p31-clinch${card.stake ? ' stake' : ''}"><span class="ts-label">${esc(card.kicker)}</span><b class="ts-row">${esc(card.title)}</b><span class="ts-small">${esc(card.sub)}</span></section>` : '';
  const kick = `The race · ${r.finished ? 'final' : `thru ${r.done} · ${r.left} hole${r.left === 1 ? '' : 's'} left`}`;
  const below = card?.kind === 'how';
  return `<div class="plain p31">${placeHead(kick, '', pl)}
      ${card && !below ? cardHtml : ''}
      ${table(['Pts', 'Back'], trows, { cls: 'p31-two-col', cut: cut > 0 ? cut : -1 })}
      ${below ? cardHtml : !card && cut < 0 && r.done && !r.finished ? '<p class="p31-note">Everyone’s still in it.</p>' : ''}</div>`;
}

/** Stroke play: your group's last three holes (screen 18). */
function matchesGroup(app) {
  const snap = app.snapshot;
  const me = app.myPlayer();
  const gid = me?.groupId || snap.players[0]?.groupId;
  const ps = snap.players.filter((p) => p.groupId === gid);
  const ranks = rankLabels(playerLeaderboard(snap, 'gross'), (p) => p.grossToPar);
  const sorted = [...ps].sort((a, b) => (!a.thru !== !b.thru ? (a.thru ? -1 : 1) : a.grossToPar - b.grossToPar || a.name.localeCompare(b.name)));
  const order = playOrder(snap.settings);
  const reached = Math.max(0, ...ps.map((p) => order.findLastIndex((h) => p.gross[h - 1] != null) + 1));
  const from = Math.max(0, Math.min(reached, HOLES) - 3);
  const cols = order.slice(from, from + 3);
  const gi = groupIndex(gid);
  const thru = Math.max(0, ...ps.map((p) => p.thru));
  const trows = sorted.map((p) => ({
    pos: ranks.get(p.id), name: p.name, me: p.id === app.me, pid: p.id,
    cells: [cell(p.thru ? fmtToPar(p.grossToPar) : '–', true), ...cols.map((h) => `<span class="p31-mk">${p.gross[h - 1] == null ? '' : mark(p.gross[h - 1], snap.holes[h - 1].par, 28)}</span>`)],
  }));
  const title = me ? 'Your group' : teeTimeName(snap.settings, gi).replace(/^\w/, (c) => c.toUpperCase());
  return `<div class="plain p31 p31-m">
      <h1 class="ts-title p31-mt">${esc(title)}</h1><p class="p31-sub">${esc(me ? `${teeTimeName(snap.settings, gi)} · thru ${thru}` : `thru ${thru}`)}</p>
      ${table(['To par', ...cols.map(String)], trows, { cls: 'p31-four' })}
      <div class="p31-foot"><span>Last three holes</span><button class="p31-link" data-act="tab" data-v="board">Everyone on the Board ›</button></div></div>`;
}

export function matches031(app, view) {
  if (view === 'alone') return matchesRace(app);
  if (view === 'stroke') return matchesGroup(app);
  if (view === 'partners' || view === 'oneMatch' || (view === 'cart' && app.snapshot.game.type !== 'rotationPlusMinus')) return matchesMatch(app, view);
  return null;
}

