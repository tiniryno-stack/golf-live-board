// enter.js — the default tab (designspec §2). Team game: your cart's two players as full-width
// stacked rows (big − / +, the score in its score mark, a live BIRDIE / PAR label, a dashed ghost
// of par until the first tap), the team line (Low Ball / Low Total), and the other cart in your
// foursome as one slim row + Edit (tap it to enter theirs; yours collapses to the slim row).
// The first tap on an empty box (−, the number or +) is par; after that − / + step. Next hole
// waits until every box in your group has a score ("Next hole · Sean left"); tapping it then
// points at who's missing. Nothing is ever saved as par without a tap. Long-press clears.
// Holes two or more back open locked. Holes follow play order (start on 1 or 10).
// Must fit an iPhone SE with no scrolling (rows and buttons shrink to the space).

import { esc, icon, mark, scoreName, foldIn, padWindow, markSvg, smallMark, syncMotion, reward, markKind, pointsLine, standing, turnPlan, reducedMotion } from '../ui.js';
import {
  maxHoleScore, maxLabel, rotationFor, rotationIndexFor, foursomeFor, matchFor, matchesFor, componentNames,
  fmtPts, fmtSigned, ryderState, teeTimeName, playOrder, posOf, holeAt, HOLES, sideOn,
} from '../scoring.js';
import { matchupAlert } from '../headlines.js';
import { teamColor, isDefaultTeamName, shortTeam } from '../teams.js';
import { local } from '../db.js';
import { riderState, isRider, matchState } from '../riderview.js';
import { enterLine } from '../playfor.js';
import { cardOn, cardState, gpsBadge, greenCard } from './greencard.js';
import { shortCourseName } from '../coursedata.js';
import { gps } from '../gps.js';
import { FLAGS } from '../flags.js';

/** "+2 thru 4" / "All square" from this team's side of its current matchup. */
export function matchStatus(snap, m, teamId) {
  if (!m) return '';
  const opp = m.teams[0] === teamId ? m.teams[1] : m.teams[0];
  if (!m.played) return 'not started';
  const v = snap.game.type === 'rotationPlusMinus' ? m.margin[teamId] : m.points[teamId] - m.points[opp];
  const s = v === 0 ? 'All square' : fmtSigned(v);
  return m.final ? `${s} · final` : `${s} thru ${m.played}`;
}

/** "UP 2 · 5–3 · thru 4" / "AS · 2–2 · thru 2" / "+3 · thru 4" (Plus/Minus), your side first. */
export function matchStatusShort(snap, m, teamId) {
  if (!m) return '';
  const opp = m.teams[0] === teamId ? m.teams[1] : m.teams[0];
  if (!m.played) return 'NOT STARTED';
  const tail = m.final ? 'FINAL' : `thru ${m.played}`;
  if (snap.game.type === 'rotationPlusMinus') return `${fmtSigned(m.margin[teamId], 'E')} · ${tail}`;
  const lead = m.points[teamId] - m.points[opp];
  const word = lead > 0 ? `UP ${fmtPts(lead)}` : lead < 0 ? `DN ${fmtPts(-lead)}` : 'AS';
  return `${word} · ${fmtPts(m.points[teamId])}–${fmtPts(m.points[opp])} · ${tail}`;
}

/** Your side's color, and the other side's (2v2: always green vs blue). */
function sideColor(app, teamId) {
  const snap = app.snapshot;
  if (snap.settings.pairs) return teamId === app.myTeam(app.ui.hole) ? 'var(--cart-you)' : 'var(--t-B)';
  return teamColor(app.myTeam(), teamId);
}

/** The next hole your foursome hasn't finished (where "Next hole" lands). ◀ ▶ can browse past it:
 *  holes ahead open as a read-only preview (`isAhead`), so you can see what's coming. */
function holeLimit(app) {
  return app.nextHole();
}

/** A hole your group hasn't reached yet: look, don't touch. */
function isAhead(app, h) {
  return posOf(app.snapshot.settings, h) > frontierPos(app);
}

function currentHole(app) {
  if (app.ui.hole == null) app.ui.hole = holeLimit(app);
  return app.ui.hole;
}

function cartsFor(app, hole) {
  const snap = app.snapshot;
  const ids = foursomeFor(snap.roster, snap.settings, app.me, hole);
  // Solo match play: everyone is in one group card (each player is their own "team").
  if (snap.settings.solo) return [{ teamId: null, players: ids.map((id) => snap.playerById.get(id)) }];
  // 2v2: you + your partner on this hole, then the other pair.
  const side = (pid) => (snap.settings.pairs ? sideOn(snap, pid, hole) : snap.playerById.get(pid).teamId);
  // Team Ryder Cup: the two players of a side in your tee time ride together, even when the drafted partners play
  // in different tee times (owner, Nov 7). The cart keeps the teamId of its first player (yours first).
  const ryd = snap.settings.ryder;
  const ride = (pid) => (ryd ? String(side(pid) || '')[0] : side(pid));
  const mine = ride(app.me);
  const order = [...ids.filter((id) => ride(id) === mine), ...ids.filter((id) => ride(id) !== mine)];
  const carts = [];
  for (const id of order) {
    const p = { ...snap.playerById.get(id), teamId: side(id) };
    let c = carts.find((x) => x.ride === ride(id));
    if (!c) carts.push((c = { teamId: p.teamId, ride: ride(id), players: [] }));
    c.players.push(p);
  }
  return carts;
}

/** Which cart is open for entry on this hole: 'mine' (70/30, theirs greyed) or 'opp' (50/50, yours greyed). */
function focusSide(app, hole, carts) {
  if (app.ui.enterFocus != null && app.ui.enterFocus !== hole) app.ui.enterFocus = null; // left that hole: back to 70/30
  return carts.length > 1 && app.ui.enterFocus === hole ? 'opp' : 'mine';
}

/** Play-order position of the first hole your group hasn't finished (19 once you're done). */
function frontierPos(app) {
  return app.foursomeDone() ? HOLES + 1 : posOf(app.snapshot.settings, app.nextHole());
}

/** Holes two or more back open locked (view only) until you tap the box: no fat-fingered edits.
 *  The hole you're on and the one you just finished stay editable. */
function isLocked(app, h) {
  if (app.ui.unlocked != null && app.ui.unlocked !== h) app.ui.unlocked = null; // left that hole: locked again
  if (app.ui.unlocked === h) return false;
  return posOf(app.snapshot.settings, h) < frontierPos(app) - 1;
}

function strokeDots(n) {
  return n ? `<span class="dots" aria-label="gets ${n === 1 ? 'a stroke' : `${n} strokes`}">${'<i></i>'.repeat(n)}</span>` : '';
}

/** One player as a stacked row: name + live label, then − · score mark · +. */
function tile(app, p, hole, locked) {
  const snap = app.snapshot;
  const par = snap.holes[hole - 1].par;
  const g = p.gross[hole - 1];
  const editable = !locked && app.canEdit(p.id, hole);
  const max = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
  const ghost = Math.min(par, max); // what the first tap records
  const d = g == null ? null : g - par;
  const label = g == null ? (editable ? 'TAP − / + · PAR' : 'NO SCORE YET') : scoreName(g, par);
  const tone = g == null ? '' : d < 0 ? ' under' : d >= 2 ? ' dbl' : '';
  const top = `<div class="t-top"><span class="who"><span class="ellipsis">${esc(p.name)}</span>${strokeDots(p.dots[hole - 1])}</span><span class="t-lbl mono${tone}">${label}</span></div>`;
  const face = mark(g, par, 112, { ghost: editable ? ghost : '–' });
  if (!editable) {
    return `<div class="tile readonly${g == null ? ' empty' : ''}">${top}
      <div class="t-row"><div class="face" data-pid="${esc(p.id)}">${face}</div></div></div>`;
  }
  // Just tapped Next with this box empty: shake it (survives a redraw for a moment).
  const nudge = g == null && app.ui.nudge?.hole === hole && Date.now() < app.ui.nudge.until ? ' nudge' : '';
  return `<div class="tile${g == null ? ' empty' : ''}${nudge}${p.id === app.me ? ' mine' : ''}">${top}
    <div class="t-row">
      <button class="step" data-act="tile-step" data-pid="${esc(p.id)}" data-d="-1" ${g != null && g <= 1 ? 'disabled' : ''} aria-label="${esc(p.name)} minus one">−</button>
      <button class="face" data-act="tile-tap" data-hold="tile-clear" data-pid="${esc(p.id)}" aria-label="${esc(p.name)}: ${g ?? 'no score yet'}">${face}</button>
      <button class="step" data-act="tile-step" data-pid="${esc(p.id)}" data-d="1" ${g != null && g >= max ? 'disabled' : ''} aria-label="${esc(p.name)} plus one">+</button>
    </div></div>`;
}

function teamLine(app, cart, hole) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  if (!team) return '';
  const comps = team.comps[hole - 1];
  const short = snap.settings.teamScore === 'bestBallAggregate' ? ['LB', 'LT'] : componentNames(snap.settings.teamScore);
  return `${short.map((n, i) => `${n} ${comps ? comps[i] : '–'}`).join(' · ')}${snap.hasStrokes ? ' net' : ''}`;
}

function cartLabel(app, cart) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  return team ? team.name : cart.players.length > 2 ? 'Your group' : 'Your cart';
}

/** The open cart: stacked rows in a card outlined in its color. */
function cartCard(app, cart, hole, mine, locked) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  const label = cartLabel(app, cart);
  const jersey = team ? sideColor(app, team.id) : 'var(--cart-you)';
  const name = FLAGS.cartNames && mine && team && !locked && !snap.settings.pairs
    ? `<button class="name name-btn" data-act="team-picker" aria-label="Name your cart"><i class="jd"></i><span class="ellipsis">${esc(label)}</span>${isDefaultTeamName(team) ? '<span class="pick">Name it</span>' : ''}</button>`
    : `<span class="name"><i class="jd"></i><span class="ellipsis">${esc(label)}</span></span>`;
  // A locked (finished) hole: the whole card is the tap target that unlocks it for editing.
  const ahead = isAhead(app, hole);
  const tap = locked && !ahead ? ` data-act="hole-unlock" data-enter="hole-unlock" role="button" tabindex="0" aria-label="Edit hole ${hole}"` : '';
  const chip = ahead ? '<span class="focus-chip lock-chip">Up next</span>' : locked ? `<span class="focus-chip lock-chip">${icon('lock', 12)} Tap to edit</span>` : `<span class="lblt">${esc(teamLine(app, cart, hole))}</span>`;
  return `<section class="cart ${mine ? 'mine' : 'opp'} focus${locked ? ' locked' : ''}" style="--jersey:${jersey}"${tap}>
    <div class="cart-head">${name}${chip}</div>
    <div class="tiles">${cart.players.map((p) => tile(app, p, hole, locked)).join('')}</div>
  </section>`;
}

/** The other cart, collapsed to one slim row: name, their scores with marks, Edit / Back.
 *  Team Ryder Cup: no cart name (the names already say who), each player gets half the row. */
function slimCart(app, cart, hole, mine) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  const label = cartLabel(app, cart);
  const jersey = team ? sideColor(app, team.id) : 'var(--line-strong)';
  const par = snap.holes[hole - 1].par;
  const scores = cart.players.map((p) => `<span class="face" data-pid="${esc(p.id)}"><span class="ellipsis">${esc(p.name)}</span>${mark(p.gross[hole - 1], par, 28, { ghost: '–' })}</span>`).join('');
  return `<section class="cart ${mine ? 'mine' : 'opp'} dim" style="--jersey:${jersey}" data-act="cart-focus" data-enter="cart-focus" data-v="${mine ? 'mine' : 'opp'}" role="button" tabindex="0" aria-label="${mine ? 'Back to your cart' : `Enter scores for ${esc(label)}`}">
    <i class="jd"></i>${snap.settings.ryder ? '' : `<span class="name ellipsis">${esc(label)}</span>`}
    <span class="slim-scores mono${snap.settings.ryder ? ' names-only' : ''}">${scores}</span>
    <span class="edit-btn">${mine ? 'Back' : 'Edit'}</span>
  </section>`;
}

// ───────────────────────────────────────────── individual rounds ("you first", designspec §2)

/** No carts and not 2v2: your score is the hero card, everyone else a compact row. */
function individual(app) {
  const snap = app.snapshot;
  return !(app.event?.roster?.teams || []).length && !snap.settings.pairs;
}

/** Where a score came from: "✓ From Sam's phone", "Entered by you · Sam can still edit", "Waiting on Sam". */
function sourceLine(app, p, hole) {
  const g = p.gross[hole - 1];
  const first = p.firstName || p.name;
  if (g == null) return { text: `Waiting on ${first} · tap to enter`, cls: '' };
  const by = p.meta[hole - 1]?.by || '';
  if (by && by === p.name) return { text: `✓ From ${first}’s phone`, cls: ' good' };
  if (by && by === app.myName()) return { text: `Entered by you · ${first} can still edit`, cls: '' };
  if (by === 'Organizer') return { text: 'Entered by the organizer', cls: '' };
  return { text: by ? `Entered by ${by}` : 'Entered', cls: '' };
}

/** One-tap score pad: birdie … triple (eagle on a par 5) + the max, par outlined. */
function padChips(app, p, hole) {
  // Every number from birdie (eagle on a par 5) up to the cap, no gaps: at least double bogey,
  // at most double par (or the round's max, if lower).
  const snap = app.snapshot;
  const par = snap.holes[hole - 1].par;
  const max = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
  const names = { '-2': 'Eagle', '-1': 'Birdie', 0: 'Par', 1: 'Bogey', 2: 'Double', 3: 'Triple' };
  const from = par >= 5 ? par - 2 : par - 1;
  const top = Math.min(max, Math.max(par + 2, Math.min(max, par * 2)));
  const vals = [];
  for (let v = from; v <= top; v++) vals.push([v, v === max && v - par > 3 ? 'Max' : names[v - par] || `+${v - par}`]);
  const g = p.gross[hole - 1];
  return vals.map(([v, label]) => `<button class="pad-chip${v === par ? ' par' : ''}${v === g ? ' on' : ''}" data-act="pad-pick" data-pid="${esc(p.id)}" data-v="${v}" aria-label="${esc(p.name)}: ${v}, ${label}">
      ${mark(v, par, 30, { cls: 'pad-mk' })}<span>${label}</span></button>`).join('');
}

/** The open pad pushes the page up (the Enter page scrolls), never scrolls inside the group box. */
function padIntoView() {
  requestAnimationFrame(() => document.querySelector('.grow.open')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function groupRow(app, p, hole, locked) {
  const snap = app.snapshot;
  const par = snap.holes[hole - 1].par;
  const g = p.gross[hole - 1];
  const editable = !locked && app.canEdit(p.id, hole);
  const open = editable && app.ui.pad?.hole === hole && app.ui.pad?.pid === p.id;
  const src = sourceLine(app, p, hole);
  const color = snap.game && snap.settings.solo ? teamColor(app.myTeam(), p.teamId) : 'var(--ink-soft)';
  const right = g == null ? (open ? '' : `<span class="enter-chip">${editable ? 'Enter' : '–'}</span>`) : mark(g, par, 40);
  const nudge = g == null && app.ui.nudge?.hole === hole && Date.now() < app.ui.nudge.until ? ' nudge' : '';
  return `<div class="grow${open ? ' open' : ''}${g == null ? ' empty' : ''}${nudge}">
    <button class="grow-head" ${editable ? `data-act="pad-toggle" data-pid="${esc(p.id)}"` : 'disabled'} aria-expanded="${open}">
      <i class="gdot" style="background:${color}"></i>
      <span class="gname"><span class="ellipsis">${esc(p.name)}${strokeDots(p.dots[hole - 1])}</span><span class="gsub ellipsis${src.cls}">${esc(src.text)}</span></span>
      ${right}
    </button>
    ${open ? `<div class="pad${foldIn(app.ui)}" style="--fold-h:124px">${padChips(app, p, hole)}</div>` : ''}
  </div>`;
}

/** Your position, for the strip: "YOU 2ND · +3" (net to par) or split-point points. */
function myPosition(app) {
  const snap = app.snapshot;
  const me = app.myPlayer();
  if (!me) return '';
  if (snap.game && snap.settings.solo) {
    const s = snap.game.liveStandings.find((x) => x.teamId === me.teamId);
    return s ? `YOU ${s.shared ? 'T' : ''}${ordinal(s.rank)} · ${fmtPts(s.points)} ${s.points === 1 ? 'PT' : 'PTS'}` : '';
  }
  if (!me.thru) return '';
  const key = snap.hasStrokes ? 'netToPar' : 'grossToPar';
  const better = snap.players.filter((p) => p.thru && p[key] < me[key]).length;
  const tied = snap.players.filter((p) => p !== me && p.thru && p[key] === me[key]).length;
  const v = me[key];
  return `YOU ${tied ? 'T' : ''}${ordinal(better + 1)} · ${v === 0 ? 'E' : v > 0 ? `+${v}` : v}`;
}

const ordinal = (n) => `${n}${['TH', 'ST', 'ND', 'RD'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}`;

function individualView(app, h, parts) {
  const snap = app.snapshot;
  const st = snap.settings;
  const me = app.myPlayer();
  const ahead = isAhead(app, h);
  const locked = isLocked(app, h) || ahead;
  const ids = foursomeFor(snap.roster, st, app.me, h).filter((id) => id !== app.me);
  const others = ids.map((id) => snap.playerById.get(id));
  const blanks = others.filter((p) => p.gross[h - 1] == null && app.canEdit(p.id, h));
  const youTile = tile(app, me, h, locked).replace('<div class="tile', '<div class="tile you').replace('<span class="who">', '<span class="who"><span class="you-badge mono">YOU</span>');
  // Match play: the others' points, leader first ("Josh 3½ · Sean 2"); else the format.
  const kind = snap.game && st.solo
    ? snap.game.liveStandings.filter((x) => x.teamId !== me.teamId).map((x) => `${esc(snap.teamById.get(x.teamId).name)} <span class="status">${fmtPts(x.points)}</span>`).join(' <span class="faint">·</span> ') || 'Match play'
    : snap.hasStrokes ? 'Stroke play · net' : 'Stroke play';
  const pos = myPosition(app);
  const tap = locked && !ahead ? ` data-act="hole-unlock" data-enter="hole-unlock" role="button" tabindex="0" aria-label="Edit hole ${h}"` : '';
  const strip = app.isFinal()
    ? `<span class="teams">${icon('lock', 13)} Fixing a finalized round</span><button class="link-btn relock" data-act="final-relock">Done</button>`
    : `<span class="teams">${kind}</span>${pos ? `<span class="status">${esc(pos)}</span>` : ''}`;
  return `<div class="enter nr solo-enter${others.some((p) => app.ui.pad?.hole === h && app.ui.pad?.pid === p.id) ? ' pad-open' : ''}${parts.gcard ? ` gps-card ${app.ui.gpsSize || 'regular'}` : ''}">
      <div class="hero">${parts.holeRow}${parts.gcard || ''}<div class="matchup-line">${strip}</div></div>
      <div class="sheet">
        <section class="cart mine focus you-card${locked ? ' locked' : ''}" style="--jersey:var(--cart-you)"${tap}>
          ${ahead ? '<div class="cart-head"><span class="name">Your score</span><span class="focus-chip lock-chip">Up next</span></div>' : locked ? `<div class="cart-head"><span class="name">Your score</span><span class="focus-chip lock-chip">${icon('lock', 12)} Tap to edit</span></div>` : ''}
          <div class="tiles">${youTile}</div>
        </section>
        ${others.length ? `<div class="group-head"><span class="lbl">Your group</span><span class="meta">${blanks.length ? `${blanks.length} still to go · tap to enter for them` : 'All in'}</span></div>
        <div class="group-list">${others.map((p) => groupRow(app, p, h, locked)).join('')}</div>` : ''}
        <div class="enter-foot"><div class="holedots" aria-hidden="true">${parts.dots}</div><span class="sync" data-sync>Synced</span></div>
        ${parts.footBtn}
      </div>
    </div>`;
}

function watchView(app) {
  const org = app.isOrganizer();
  return `<div class="enter">
    <div class="hero"><div class="hole-head" style="padding:6px 0 0"><div class="hole-title">Watching</div>
      <div class="hole-meta">${esc(app.event.name)}</div></div></div>
    <div class="sheet"><div class="watch-card">
      <p class="soft" style="margin:0">Pick your name to enter scores for your matchup. Everyone can watch everything.${org ? ' As organizer you can also fix any score from the Card.' : ''}</p>
      <button class="btn primary big block" data-act="name-chip">Pick my name</button>
      <button class="btn ghost block" data-act="tab" data-v="board">See the Board</button>
      ${app.isFinal() ? `<button class="btn ghost block" data-act="final-relock">${icon('lock', 16)} Done fixing \u2014 lock again</button>` : ''}
    </div></div></div>`;
}

/** The organizer finalized the round: scores are locked; the PIN unlocks them on this phone. */
function finalView(app) {
  return `<div class="enter">
    <div class="hero"><div class="hole-head" style="padding:6px 0 0"><div class="hole-title">${icon('lock', 22)} Final</div>
      <div class="hole-meta">${esc(app.event.name)}</div></div></div>
    <div class="sheet"><div class="watch-card final-lock">
      <p class="soft" style="margin:0">The organizer finalized the round, so scores are locked.</p>
      <button class="btn primary big block" data-act="tab" data-v="board">See the final Board</button>
      ${app.snapshot.roundComplete ? `<button class="btn block" data-act="recap-open">${icon('trophy', 18)} Round recap &amp; scorecards</button>` : ''}
      <button class="btn ghost block" data-act="pin-open">${icon('lock', 16)} Fix a score${app.adminPin ? '' : ' (organizer PIN)'}</button>
    </div></div></div>`;
}

// ───────────────────────────────────────────── Team Enter: the calm screen (handoffs 021 + 022)
// Partner “Rider” Cup + Team Ryder Cup. Under the app's own hole header: the yardage card (your group's
// current hole only), one match line ("Andrew + Sean · 2 UP vs Mike + Justin"), your cart's rows (green
// rail, 4 bare pads par−1 … par+2 + ⋯ More), the other cart as one quiet row that opens its own sheet,
// free space, then the status line + Next pinned above the tab bar. No jersey colors on Enter.
// Rewards (021 §7, 022 §3–4, values from 022/motion.css): every pick bumps the pad and draws its mark;
// a word (judged on net) fades in and out after the name; when the deciding score lands the standing
// rolls and the hole's points (engine: match hole entry `points.us`) swap in for "vs …" for ~2.4 s.
// Each animated node carries data-t0 and mount() runs ui.syncMotion, so redraws never restart or cut it.

const SHEET_CLOSE_MS = 280; // the bottom sheet slides away; a pick in More plays after it
const PTS_MS = 3200; // the points moment: vs fades back by 0.45 s + 2.6 s
const DOTS = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';

/** Your match on hole h, from the 015 / 018 match state (3 carts: the one against the other cart in your group, else the first). */
function ceMatch(app, h, carts) {
  const snap = app.snapshot;
  const myTeam = app.myTeam();
  const pairs = !!snap.settings.pairs; // 028: 2v2 on the calm Enter; matchState reads each stretch from your side
  const rs = snap.settings.ryder ? ryderState(snap, myTeam) : pairs ? matchState(snap, app.me) : riderState(snap, myTeam);
  const pos = posOf(snap.settings, h);
  const here = (rs?.matches || []).filter((x) => (pairs ? x.us.playerIds.includes(app.me) : x.us.id === myTeam) && pos >= x.from && pos <= x.to);
  return here.find((x) => carts.some((c) => c.teamId === x.them.id)) || here[0] || null;
}

/**
 * 2v2 with 6 (three carts, one at a time): your cart has no match on this hole → "Sitting out · back on 13 vs Tyler +
 * Sam" (or "Sitting out · done" after your last match). null when your cart plays this hole or the game has no carts.
 */
export function sitOut(app, h) {
  const snap = app.snapshot, myTeam = app.myTeam();
  const g = snap?.game;
  if (!g?.matches?.length || !myTeam || snap.settings.pairs || snap.settings.ryder) return null;
  const pos = posOf(snap.settings, h);
  const mine = g.matches.filter((m) => m.teams.includes(myTeam));
  if (!mine.length || mine.some((m) => pos >= m.from && pos <= m.to)) return null;
  const next = mine.filter((m) => m.from > pos).sort((a, b) => a.from - b.from)[0];
  if (!next) return 'Sitting out · your matches are done';
  const opp = next.teams.find((t) => t !== myTeam);
  const names = (snap.teamById.get(opp)?.playerIds || []).map((id) => snap.playerById.get(id)?.name).filter(Boolean).join(' + ');
  return `Sitting out · back on ${next.firstHole} vs ${names}`;
}

/** The standing from your side ("2 UP" / "AS" / "1 DN"), optionally only through play-order position `upto`. */
function ceStanding(m, upto = null) {
  if (!m) return { text: 'AS', you: false, d: 0 };
  if (m.pm) { // Plus/Minus: strokes
    const d = m.leader === 'us' ? Number(m.margin) : m.leader === 'them' ? -Number(m.margin) : 0;
    return { text: d > 0 ? `+${m.margin}` : d < 0 ? `−${m.margin}` : 'E', you: d > 0, d };
  }
  const d = upto == null ? m.holePts[0] - m.holePts[1]
    : m.holes.filter((e) => e.counts && e.points && e.pos <= upto).reduce((s, e) => s + e.points.us - e.points.them, 0);
  return { text: standing(d), you: d > 1e-9, d };
}

const ptsKey = (app) => `glb.seen.${app.code}.pts`;
function markPtsSeen(app, hole) {
  const s = new Set(local.get(ptsKey(app)) || []);
  s.add(hole);
  local.set(ptsKey(app), [...s]);
}

/** The hole's points moment (021 §7.5 / 022 §3): starts once per hole, when its points first exist.
 *  Right after your own pick it plays at once; a deciding score from another phone plays ~300 ms after
 *  Enter draws (naming the hole when you've already moved on). */
function checkPts(app, h, m) {
  if (!m || m.pm || app.sheet) return;
  const now = Date.now();
  let seen = local.get(ptsKey(app));
  if (!Array.isArray(seen)) { // first look at this round on this phone: what's already in is old news
    seen = m.holes.filter((e) => e.counts && e.points).map((e) => e.hole);
    local.set(ptsKey(app), seen);
    return;
  }
  if (app.ui.cePts && now < app.ui.cePts.at + PTS_MS) return;
  const pos = posOf(app.snapshot.settings, h);
  const e = [pos, pos - 1].map((q) => m.holes.find((x) => x.pos === q)).find((x) => x?.counts && x.points && !seen.includes(x.hole));
  if (!e) return;
  const tap = app.ui.ceTap?.hole === e.hole && now - app.ui.ceTap.at < 4000;
  let at = tap ? Math.max(app.ui.ceTap.at, now) : now + 300;
  if (now - (app.ui.ceSheetAt || 0) < 400) at = Math.max(at, app.ui.ceSheetAt + SHEET_CLOSE_MS);
  const after = ceStanding(m);
  const before = ceStanding({ ...m, holePts: [m.holePts[0] - e.points.us, m.holePts[1] - e.points.them] });
  app.ui.cePts = {
    hole: e.hole, matchId: m.id, at, tap, named: e.hole !== h,
    from: before.text, to: after.text, dir: after.d > before.d + 1e-9 ? 'up' : after.d < before.d - 1e-9 ? 'dn' : null,
    line: pointsLine(e.points.us),
  };
  markPtsSeen(app, e.hole);
}

/** The reward on a player's row right now (the last pick, while its motion plays). */
function rewardFor(app, p, h) {
  const r = app.ui.ceReward;
  if (!r || r.pid !== p.id || r.hole !== h || p.gross[h - 1] !== r.v || Date.now() > r.end) return null;
  return { ...reward(r.v, app.snapshot.holes[h - 1].par, p.dots[h - 1] || 0), at: r.at };
}

/** One bare score pad (64px, no fill): the mark's outline + number; picked = white pill. Right after a pick it
 *  carries the result's motion (033 Part 1 + 034 Score picks v2): .k-<kind>, rings, sparks, par's pulse. */
function cePad(p, v, par, { on, rw, editable, act = 'ce-pick' }) {
  const dbl = markKind(v, par) === 'd';
  const cls = `ce-pad${on ? ' sel' : ''}${rw ? ` anim k-${rw.kind}` : ''}${dbl ? ' dbl' : ''}${rw?.stamp ? ' stamp' : ''}`;
  const tap = editable ? ` data-act="${act}" data-pid="${esc(p.id)}" data-v="${v}"` : ' aria-disabled="true"';
  const burst = (n, x) => `<span class="ce-burst anim${x}">${Array.from({ length: n }, (_, i) => `<i style="--a:${(360 / n) * i}deg"></i>`).join('')}</span>`;
  const fx = !rw ? '' : Array.from({ length: rw.ripples }, (_, i) => `<span class="ce-ripple anim${i ? ` r${i + 1}` : ''}"></span>`).join('')
    + (rw.burst ? burst(rw.sparks, rw.sparks > 8 ? ' big' : '') + (rw.burst2 ? burst(8, ' b2') : '') : '')
    + (rw.pulse ? '<span class="ce-pulse anim"></span>' : '');
  return `<button class="${cls}"${tap}${rw ? ` data-t0="${rw.at}"` : ''} aria-label="${esc(p.name)} ${v}" aria-pressed="${on}">${markSvg(v, par, 40)}<span class="ce-n">${v}</span>${fx}</button>`;
}

/** "1 stroke" / "2 strokes" + " · net 3" once a score is in (read-only rows). */
function ceStrokes(p, h, { net = true } = {}) {
  const k = p.dots[h - 1] || 0;
  if (!k) return '';
  const g = p.gross[h - 1];
  return `<span class="ce-stk">${k} stroke${k > 1 ? 's' : ''}${net && g != null ? ` · net ${g - k}` : ''}</span>`;
}

/** 034: the result word after a name, on screen for as long as the score stands ("Birdie", "Net bogey"). Right
 *  after the pick it arrives with motion (.anim + data-t0); every later render draws it still. */
function ceWord(app, p, h, rw, yours) {
  const g = p.gross[h - 1];
  if (g == null) return '';
  const r = rw || reward(g, app.snapshot.holes[h - 1].par, p.dots[h - 1] || 0);
  const you = yours && (r.kind === 'birdie' || r.kind === 'eagle') ? ' you' : '';
  return `<span class="ce-word stay ${r.tone} k-${r.kind}${you}${rw ? ' anim' : ''}"${rw ? ` data-t0="${rw.at}"` : ''}>${esc(r.word)}</span>`;
}

/** 034: a player's label above their card: NAME (WITH PARTNER) · 1 STROKE, then the word. */
function ceLabel(app, p, h, { partner = '', rw = null, yours = false } = {}) {
  const k = p.dots[h - 1] || 0;
  return `<div class="pgrp-l" data-k="l-${esc(p.id)}"><span class="pgrp-n"><span class="pgrp-who" data-k="n-${esc(p.id)}">${esc(p.name)}</span>${partner ? ` <span class="pgrp-w">(with ${esc(partner)})</span>` : ''}${k ? ` · ${k} stroke${k > 1 ? 's' : ''}` : ''}</span>${ceWord(app, p, h, rw, yours)}</div>`;
}

/** 034 "name outside": one card per player holding only the pads (4 + ⋯), the name as a label above it.
 *  Your cart's cards carry the green rail. */
function ceGroup(app, p, h, { editable, yours, partner = '' }) {
  const snap = app.snapshot;
  const par = snap.holes[h - 1].par;
  const g = p.gross[h - 1];
  const cap = maxHoleScore(snap.course, snap.settings, h, p.dots[h - 1]);
  const rw = rewardFor(app, p, h);
  const w = padWindow(par, cap).pads;
  const out = g != null && !w.includes(g); // picked from More: it takes the ⋯ slot
  const pads = w.map((v) => cePad(p, v, par, { on: g === v, rw: g === v ? rw : null, editable })).join('')
    + (out ? cePad(p, g, par, { on: true, rw, editable, act: 'ce-more' })
      : `<button class="ce-pad ce-dots"${editable ? ` data-act="ce-more" data-pid="${esc(p.id)}"` : ' aria-disabled="true"'} aria-label="Other scores for ${esc(p.name)}">${DOTS}</button>`);
  const nudge = g == null && app.ui.nudge?.hole === h && Date.now() < app.ui.nudge.until ? ' nudge' : '';
  const flash = rw?.flash ? `<span class="ce-flash anim k-${rw.kind}" data-t0="${rw.at}" aria-hidden="true"></span>` : '';
  return `<div class="pgrp">${ceLabel(app, p, h, { partner, rw, yours })}<div class="pcard${yours ? ' rail' : ''}" data-k="c-${esc(p.id)}">${flash}<div class="ce-row${nudge}"><div class="ce-pads">${pads}</div></div></div></div>`;
}

/** Preview / locked holes: a read-only row (name, strokes, the score's mark at the right). */
function ceReadRow(app, p, h, mine, ahead) {
  const par = app.snapshot.holes[h - 1].par;
  const g = p.gross[h - 1];
  return `<div class="ce-ro${mine ? '' : ' them'}"><span class="ce-ro-n"><b class="ellipsis">${esc(p.name)}</b>${ceStrokes(p, h, { net: !ahead })}</span>${g != null ? smallMark(g, par, 40) : ''}</div>`;
}

/** Was this score entered on that player's own phone? (then nobody else can change it: own-entry rule) */
function ownEntry(p, h) {
  const by = p.meta?.[h - 1]?.by;
  return p.gross[h - 1] != null && !!by && by === p.name;
}

const names = (ps) => ps.map((p) => p.name).join(' + ');
const listNames = (ps) => (ps.length <= 1 ? names(ps) : `${ps.slice(0, -1).map((p) => p.name).join(', ')} + ${ps[ps.length - 1].name}`);

/** 028 §2: who's on the calm Enter, in order: you, your partner if you have one, then the rest of your tee time.
 *  Games without carts (Everyone alone, Stroke play): you alone in your card, everyone else one quiet row.
 *  034: in 2v2 your card is your cart (the pair you ride with, i.e. your first set's pair) all round; your partner on
 *  the hole shows in your label instead. */
function ceCarts(app, h) {
  const snap = app.snapshot;
  let carts = cartsFor(app, h).map((c) => ({ ...c, players: [...c.players] }));
  if (!carts.length) return carts;
  if (individual(app)) {
    const all = carts.flatMap((c) => c.players);
    const me = all.find((p) => p.id === app.me);
    const rest = all.filter((p) => p.id !== app.me);
    return me ? [{ teamId: null, players: [me] }, ...(rest.length ? [{ teamId: 'rest', players: rest }] : [])] : carts;
  }
  if (snap.settings.pairs) {
    const h1 = holeAt(snap.settings, 1);
    const ride = (id) => sideOn(snap, id, h1) || '';
    const all = carts.flatMap((c) => c.players);
    const mine = ride(app.me);
    const out = [];
    for (const p of [...all.filter((x) => ride(x.id) === mine), ...all.filter((x) => ride(x.id) !== mine)]) {
      let c = out.find((x) => x.teamId === ride(p.id));
      if (!c) out.push((c = { teamId: ride(p.id), players: [] }));
      c.players.push(p);
    }
    carts = out;
  }
  carts[0].players.sort((a, b) => (b.id === app.me) - (a.id === app.me));
  return carts;
}

/** A quiet row (021 §4, 028 §2.3): names with their marks, Enter › while any is missing, Edit › once all are in.
 *  Four or more: missing players first, two names, then +N. `fold` = your own cart folded while you enter for the rest
 *  of your tee time (034): green rail, the whole row is the button back, ‹ Back on the right. */
function ceQuiet(app, c, h, { m = null, fold = false } = {}) {
  const par = app.snapshot.holes[h - 1].par;
  const allIn = c.players.every((p) => p.gross[h - 1] != null);
  const grp = !fold && m && c.teamId && c.teamId !== 'rest' && c.teamId !== m.them.id && !app.snapshot.settings.pairs ? '<span class="ce-grp">Your group</span>' : '';
  let who;
  if (c.players.length >= 4) {
    const order = [...c.players.filter((p) => p.gross[h - 1] == null), ...c.players.filter((p) => p.gross[h - 1] != null)];
    who = `<span class="ce-who-p"><span class="ellipsis">${esc(order.slice(0, 2).map((p) => p.name).join(', '))}</span><span class="ce-plus">+${order.length - 2}</span></span>`;
  } else who = c.players.map((p) => `<span class="ce-who-p"><span class="ellipsis" data-k="n-${esc(p.id)}">${esc(p.name)}</span>${smallMark(p.gross[h - 1], par, 30)}</span>`).join('');
  const key = fold ? 'q-mine' : `q-${esc(c.teamId || 'rest')}`;
  const pids = esc(c.players.map((p) => p.id).join(' '));
  return `<button class="ce-line ${fold ? 'ce-fold' : 'ce-q'}" data-act="${fold ? 'ce-close' : 'ce-theirs'}" data-t="${esc(c.teamId || '')}" data-k="${key}" data-pids="${pids}" aria-label="${fold ? 'Back to your scores' : `Enter scores for ${esc(c.players.map((p) => p.name).join(' and '))}`}">
      <span class="ce-who">${grp}${who}</span>${fold ? `<span class="ce-go">${icon('back', 18)}Back</span>` : `<span class="ce-go">${allIn ? 'Edit' : 'Enter'}${icon('fwd', 18)}</span>`}</button>`;
}

/** Their cards, open (034): up to two players each get a card of pads; three or more get one card of pads (the first
 *  still missing, or the one you tapped) and one card of compact rows. A score from their own phone is read-only. */
function ceTheirCards(app, c, h) {
  const par = app.snapshot.holes[h - 1].par;
  const nudged = app.ui.nudge?.hole === h && Date.now() < app.ui.nudge.until;
  const src = (p) => {
    if (ownEntry(p, h)) return 'from their phone';
    const by = p.meta?.[h - 1]?.by;
    if (p.gross[h - 1] == null) return nudged ? 'missing · tap a score' : 'tap to enter';
    return by === app.myName() ? 'entered by you' : by ? `entered by ${by}` : '';
  };
  const own = (p) => `<div class="pgrp">${ceLabel(app, p, h)}<div class="pcard" data-k="c-${esc(p.id)}"><div class="ce-own">${smallMark(p.gross[h - 1], par, 30)}<span class="ce-own-src">From their phone</span></div></div></div>`;
  const ps = c.players;
  if (ps.length <= 2) return ps.map((p) => (ownEntry(p, h) ? own(p) : ceGroup(app, p, h, { editable: app.canEdit(p.id, h), yours: false }))).join('');
  const editable = ps.filter((p) => !ownEntry(p, h) && app.canEdit(p.id, h));
  const want = app.ui.cePad?.hole === h ? editable.find((p) => p.id === app.ui.cePad.pid) : null;
  const sel = want || editable.find((p) => p.gross[h - 1] == null) || null;
  const row = (p) => {
    const inner = `<b class="ellipsis"><span data-k="n-${esc(p.id)}">${esc(p.name)}</span></b>${smallMark(p.gross[h - 1], par, 30)}<span class="ce-own-src">${esc(src(p))}</span>`;
    return ownEntry(p, h) || !app.canEdit(p.id, h) ? `<div class="ce-own">${inner}</div>` : `<button class="ce-own ce-cmp" data-act="ce-padto" data-pid="${esc(p.id)}">${inner}</button>`;
  };
  return `${sel ? ceGroup(app, sel, h, { editable: true, yours: false }) : ''}<div class="pgrp"><div class="pcard ce-others" data-k="c-list">${ps.filter((p) => p !== sel).map(row).join('')}</div></div>`;
}

function ryderEnterView(app, h, { gcard, carts, locked, ahead, pos, limitPos, lastHole, done, cur }) {
  const snap = app.snapshot;
  const par = snap.holes[h - 1].par;
  const now = Date.now();
  const live = !locked && !ahead;
  const mine = carts[0];
  const others = carts.slice(1);

  // 023 §3: left-aligned header "Hole 11  Par 3", then ◀ ▶ ⋯ (round menu; organizer's first menu item
  // is Fix hole N). The team header drops Hcp and the course name; strokes show per player.
  // 039: with the GPS card up the top bar hides, so ‹ Home sits at the left of the hole header instead.
  const topHidden = !!app.myPlayer() && (!app.isFinal() || app.finalUnlocked()) && !!cardState(app, currentHole(app));
  const head = `<div class="ce-head">${topHidden ? `<button class="ce-home" data-act="go" data-v="#/" aria-label="Home">${icon('back', 20)}<span>Home</span></button>` : ''}
      <button class="ce-hole" data-act="hole-grid" aria-label="Hole ${h}: all holes"><span class="ce-hn">Hole ${h}</span><span class="ce-hp">Par ${par}</span></button>
      <div class="ce-nav">
        <button class="ce-ib" data-act="hole-prev" aria-label="Previous hole"${pos <= 1 ? ' disabled' : ''}>${icon('back')}</button>
        <button class="ce-ib" data-act="hole-next" aria-label="Next hole"${pos >= limitPos ? ' disabled' : ''}>${icon('fwd')}</button>
        <button class="ce-ib" data-act="round-menu" aria-label="Round menu">${icon('more', 20)}</button>
      </div>
    </div>`;
  const m = ceMatch(app, h, carts);
  if (app.ui.ceReward && now > app.ui.ceReward.end) app.ui.ceReward = null;
  if (app.ui.cePts && now > app.ui.cePts.at + PTS_MS) app.ui.cePts = null;
  if (live) checkPts(app, h, m);
  const pt = app.ui.cePts && m && app.ui.cePts.matchId === m.id ? app.ui.cePts : null;

  // 027 / 028 §2.4 / 034: the rest of your tee time opens in place (no sheet), only on a tap. app.ui.ceOpen = { hole, t }.
  const open = live && app.ui.ceOpen?.hole === h ? others.find((c) => (c.teamId || '') === (app.ui.ceOpen.t || '')) || null : null;
  // 034: the match line sits under the hole title, above the yardage card: "4 UP  vs Sam + Jake" (your names are on
  // the labels below). Preview "Up next" · locked "Played · locked · 1 UP after 6   Edit". It stays while you enter for
  // the rest of your tee time.
  let matchLine;
  if (ahead) matchLine = '<div class="ce-match"><span>Up next</span></div>';
  else if (locked) {
    const s = m ? ceStanding(m, pos) : null;
    matchLine = `<div class="ce-match"><span class="ellipsis">Played · locked${s ? ` · <b class="ce-st${s.you ? ' you' : ''}">${esc(s.text)}</b> after ${h}` : ''}</span><button class="ce-edit" data-act="hole-unlock">Edit</button></div>`;
  } else {
    let line = '';
    if (m) {
      const s = ceStanding(m);
      const roll = pt?.dir ? `<span class="ce-roll${pt.dir === 'dn' ? ' dn' : ''}">${pt.dir === 'dn' ? `<span>${esc(pt.to)}</span><span>${esc(pt.from)}</span>` : `<span>${esc(pt.from)}</span><span>${esc(pt.to)}</span>`}</span>`
        : `<span class="ce-roll"><span>${esc(s.text)}</span></span>`;
      const up = `<span class="ce-up${s.you ? '' : ' muted'}${pt?.dir ? ' anim' : ''}"${pt?.dir ? ` data-t0="${pt.at}"` : ''}>${roll}</span>`;
      const them = m.them.playerIds.map((id) => snap.playerById.get(id)?.name || '').filter(Boolean).join(' + ');
      const won = pt ? `<span class="ce-won anim${pt.line.tone === 'text' ? '' : ' muted'}" data-t0="${pt.at}">${esc(pt.line.text)}${pt.named ? ` on ${pt.hole}` : ''}</span>` : '';
      line = `<span class="ce-end">${up}<span class="ce-swap"><span class="ce-vs${pt ? ' anim' : ''}"${pt ? ` data-t0="${pt.at}"` : ''}>vs ${esc(them)}</span>${won}</span></span>`;
    } else if (individual(app)) {
      const l = enterLine(snap, app.me); // Everyone alone / Stroke play: "3½ PTS · 2ND  Chris +1"
      if (l) line = `<span class="ce-end"><span class="ce-up${l.you ? '' : ' muted'}"><span class="ce-roll"><span>${esc(l.standing)}</span></span></span><span class="ce-swap"><span class="ce-vs">${esc(l.context)}</span></span></span>`;
    } else { // 6 players (Nov 20): your cart sits out a set
      const out = sitOut(app, h);
      if (out) line = `<span class="ce-us ellipsis">${esc(out)}</span>`;
    }
    matchLine = `<div class="ce-match">${line}</div>`;
  }

  // Rows (034): your cart = one card per player, the name above it; the rest of your tee time = one quiet row each.
  // Open: your cart folds into one line at the top (‹ Back) and theirs get the same cards (no rail). Read-only on
  // preview / locked holes. .ce-cards is what slides on the turn; the quiet rows stay and crossfade.
  const partner = m ? names(m.us.playerIds.filter((id) => id !== app.me).map((id) => snap.playerById.get(id)).filter(Boolean)) : '';
  let rows;
  if (!live) rows = `<div class="ce-cards read"><div class="ce-mine">${carts.map((c, i) => c.players.map((p) => ceReadRow(app, p, h, i === 0, ahead)).join('')).join('')}</div></div>`;
  else if (open) {
    rows = `<div class="ce-cards open">${ceQuiet(app, mine, h, { fold: true })}${ceTheirCards(app, open, h)}</div>${others.filter((c) => c !== open).map((c) => ceQuiet(app, c, h, { m })).join('')}`;
  } else {
    rows = `<div class="ce-cards mine">${mine.players.map((p) => ceGroup(app, p, h, { editable: app.canEdit(p.id, h), yours: true, partner: p.id === app.me ? partner : '' })).join('')}</div>${others.map((c) => ceQuiet(app, c, h, { m })).join('')}`;
  }

  // Status (only when something's wrong) + Next (021 §6, 022 §6).
  const blanks = blankPlayers(app, h);
  const mineIds = new Set(mine.players.map((p) => p.id));
  const theirBlanks = blanks.filter((p) => !mineIds.has(p.id));
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  let status = '';
  if (app.isFinal()) status = `<div class="ce-status muted">${icon('lock', 13)} Fixing a finalized round<button class="link-btn relock" data-act="final-relock">Done</button></div>`;
  else if (live && theirBlanks.length && theirBlanks.length === blanks.length && app.ui.nudge?.hole === h && now < app.ui.nudge.until + 4000) {
    status = `<div class="ce-status muted">${esc(listNames(theirBlanks))} ${theirBlanks.length === 1 ? 'hasn’t' : 'haven’t'} got a score on ${h} yet.</div>`;
  } else if (offline && live) {
    const n = app.unsynced;
    status = `<div class="ce-status warn">Offline · ${n ? `your ${n} score${n === 1 ? '' : 's'} will send` : 'scores will send'} when you’re back</div>`;
  }
  let next;
  if (pos >= frontierPos(app) - 1 && !ahead) {
    const go = !blanks.length;
    const label = go ? (h === lastHole ? 'Round done' : 'Next hole')
      : blanks.length === theirBlanks.length ? (offline ? `Can’t see ${names(theirBlanks)} yet` : `Waiting on ${names(theirBlanks)}`)
      : `Next hole · ${blanks.length} to go`;
    const bump = go && pt?.tap && pt.hole === h;
    next = `<button class="ce-next${go ? ' go' : ''}${bump ? ' anim' : ''}"${bump ? ` data-t0="${pt.at}"` : ''} data-act="next-hole">${esc(label)}</button>`;
  } else if (done) next = '<button class="ce-next go" data-act="tab" data-v="board">See the Board</button>';
  else next = `<button class="ce-next go" data-act="hole-current">Back to hole ${cur}</button>`;

  const card = live && !(open && open.players.length >= 4) ? gcard : ''; // 028 §2.4: a 5–6 tee time folds the yardage card while open. 021 §1: your hole only (current, or the one you just finished): never on preview / locked holes
  return `<div class="enter nr ry-enter ce${card ? ` gps-card ${app.ui.gpsSize || 'regular'}` : ''}">
      <div class="hero">${head}<div class="ce-sub">${matchLine}</div>${card}</div>
      ${rows}
      <div class="ce-flex"></div>
      <div class="ce-foot">${status}${next}</div>
    </div>`;
}

/** A pick on the calm Enter (a card, More, or their cards). The reward is set before the write so the render the
 *  write triggers already shows it; `delay` holds the motion until a closing sheet is gone. A tap during a turn or
 *  the morph jumps it to its end first. */
function cePick(app, pid, h, v, delay = 0, inOpen = false) {
  const snap = app.snapshot;
  const p = snap.playerById.get(pid);
  if (!p) return;
  app.ui.ceTurn = null;
  app.ui.ceMorph = null;
  const at = Date.now() + delay;
  const rw = reward(v, snap.holes[h - 1].par, p.dots[h - 1] || 0);
  app.ui.ceReward = { pid, hole: h, v, at, end: at + rw.holdMs + 100 };
  app.ui.ceTap = { hole: h, at };
  app.ui.cePts = null; // a tap during the points moment jumps it to its end
  if (p.gross[h - 1] === v) app.render(); // same score again: no write, just the motion
  else if (!app.setScore(pid, h, v)) { app.ui.ceReward = null; app.render(); return; }
  if (inOpen) app.ui.cePad = null; // the pad card moves to the next player still missing (ceTheirCards)
  // 034: no auto-close. Their cards stay open until you tap ‹ Back, or change hole.
}

// ───────────────────────────────────────────── 034: the turn (holes move sideways) and the names-travel morph
// Both follow the reward pattern: state in app.ui with a start time, drawn again after every redraw (mount →
// decorate), so the constant redraws can't cut them. What leaves is a copy captured at tap time (its HTML and its
// place, measured with offsets so a running transform can't skew it) on .ce-turn-layer; what arrives gets a class +
// data-t0, and ui.syncMotion puts every animation back where it was. Only transform and opacity animate.
const TURN_MS = 460; // the cards slide 420ms; the words that stay finish fading in at 340ms
const MORPH_MS = 600; // the names travel 380ms; their pads land by 564ms
const FADE_MS = 200; // reduced motion: a 150ms crossfade
const rmOn = () => (typeof document !== 'undefined' && document.documentElement.classList.contains('rm')) || !!reducedMotion();

/** An element's box relative to the .ce root, from offsets (transforms don't count). */
function relBox(el, root) {
  let top = 0, left = 0, n = el;
  while (n && n !== root) { top += n.offsetTop; left += n.offsetLeft; n = n.offsetParent; }
  return { top, left, width: el.offsetWidth, height: el.offsetHeight };
}
const inLayer = (el) => !!el.closest('.ce-turn-layer');
const one = (ce, sel) => [...ce.querySelectorAll(sel)].find((el) => !inLayer(el)) || null;
const all = (ce, sel) => [...ce.querySelectorAll(sel)].filter((el) => !inLayer(el));
const MOTION_CLS = ['anim', 't-in', 't-out', 't-page', 't-fade', 'm-name-in', 'm-name-out', 'm-grow', 'm-shrink', 'm-fade-in', 'm-fade-out'];
/** A still, inert copy of what's on screen now (no actions, no running motion). */
function copyOf(el) {
  const c = el.cloneNode(true);
  for (const x of [c, ...c.querySelectorAll('*')]) {
    x.removeAttribute('data-act'); x.removeAttribute('data-t0'); x.removeAttribute('id');
    if (x.classList) x.classList.remove(...MOTION_CLS);
    for (const v of ['--m-dx', '--m-dy', '--m-s', '--m-i', '--m-j']) x.style?.removeProperty(v);
  }
  return c.outerHTML;
}

/**
 * Change the hole on Enter. Next hole / ◀ ▶ / Back to hole N / the grid / Undo all come through here: it sets the
 * hole, returns to your cart (034: changing hole closes the rest of your tee time) and, on the calm Enter, starts the
 * turn: the yardage card and the score cards slide one screen-width (forward = left, in play order), the title,
 * match line and quiet rows crossfade in place. No turn on a finalized round. The caller renders.
 */
export function beginTurn(app, to) {
  const from = app.ui.hole;
  app.ui.hole = to;
  app.ui.ceOpen = null;
  app.ui.cePad = null;
  app.ui.ceReward = null;
  app.ui.ceMorph = null;
  app.ui.ceTurn = null;
  const ce = typeof document !== 'undefined' ? document.querySelector('#content .ce') : null;
  if (!ce || from == null || from === to || !app.snapshot || app.isFinal()) return;
  const parts = [];
  const add = (el, kind) => { if (el) parts.push({ kind, box: relBox(el, ce), html: copyOf(el) }); };
  add(one(ce, '.hero > .green-card'), 'page');
  add(one(ce, '.ce-cards'), 'page');
  add(one(ce, '.ce-hole'), 'fade');
  for (const q of all(ce, '.ce-line.ce-q')) add(q, 'fade');
  const sub = one(ce, '.ce-sub');
  app.ui.ceTurn = {
    at: Date.now(), dir: turnPlan(from, to, app.snapshot.settings.startHole).dir, fade: rmOn(),
    w: Math.max(ce.offsetWidth, ce.parentElement?.clientWidth || 0), parts,
    sub: sub ? { kind: 'fade', box: relBox(sub, ce), html: copyOf(sub), text: sub.textContent.replace(/\s+/g, ' ').trim() } : null,
  };
}

/** Before opening / closing the rest of your tee time: remember every keyed part (names, labels, cards, rows). */
function beginMorph(app) {
  app.ui.ceMorph = null;
  app.ui.ceTurn = null;
  const ce = typeof document !== 'undefined' ? document.querySelector('#content .ce') : null;
  if (!ce) return;
  const old = {};
  for (const el of all(ce, '[data-k]')) {
    const o = { box: relBox(el, ce), html: copyOf(el), pids: el.dataset.pids || '' };
    if (el.dataset.k.startsWith('n-')) { // a travelling name's outgoing copy keeps its computed font
      const cs = getComputedStyle(el);
      o.font = { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, letterSpacing: cs.letterSpacing, textTransform: cs.textTransform, color: cs.color, lineHeight: cs.lineHeight, whiteSpace: 'nowrap' };
    }
    old[el.dataset.k] = o;
  }
  app.ui.ceMorph = { at: Date.now(), fade: rmOn(), old, fresh: null };
}

function layerOf(ce) {
  let l = ce.querySelector(':scope > .ce-turn-layer');
  if (!l) {
    l = document.createElement('div');
    l.className = 'ce-turn-layer';
    l.setAttribute('aria-hidden', 'true');
    l.inert = true;
    ce.appendChild(l);
  }
  return l;
}
function place(layer, part, cls, at, vars = {}) {
  const tpl = document.createElement('template');
  tpl.innerHTML = part.html.trim();
  const el = tpl.content.firstElementChild;
  if (!el) return null;
  Object.assign(el.style, { top: `${part.box.top}px`, left: `${part.box.left}px`, width: `${part.box.width}px`, height: `${part.box.height}px` }, part.font || {});
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  el.classList.add(...cls);
  el.dataset.t0 = at;
  layer.appendChild(el);
  return el;
}

function playTurn(ce, t) {
  ce.dataset.turn = t.fade ? 'fade' : 'cards';
  ce.dataset.dir = t.dir;
  ce.style.setProperty('--t-w', `${t.w}px`);
  const tag = (el, kind) => { if (el) { el.classList.add(`t-${kind}`, 't-in'); el.dataset.t0 = t.at; } };
  const sub = one(ce, '.ce-sub');
  const subChanged = !!(t.sub && sub && sub.textContent.replace(/\s+/g, ' ').trim() !== t.sub.text);
  tag(one(ce, '.hero > .green-card'), 'page');
  tag(one(ce, '.ce-cards'), 'page');
  tag(one(ce, '.ce-hole'), 'fade');
  for (const q of all(ce, '.ce-line.ce-q')) tag(q, 'fade');
  if (subChanged) tag(sub, 'fade'); // the match line moves only when it says something new
  const layer = layerOf(ce);
  for (const p of [...t.parts, ...(subChanged ? [t.sub] : [])]) place(layer, p, [`t-${p.kind}`, 't-out'], t.at);
}

function playMorph(ce, mo) {
  const els = all(ce, '[data-k]');
  if (!mo.fresh) mo.fresh = Object.fromEntries(els.map((el) => [el.dataset.k, { box: relBox(el, ce), pids: el.dataset.pids || '' }]));
  const { old, fresh, at } = mo;
  ce.dataset.morph = mo.fade ? 'fade' : 'on';
  const layer = layerOf(ce);
  const top = (k) => /^[qlc]-/.test(k);
  const rowOf = (set, pid) => Object.entries(set).find(([k, v]) => k.startsWith('q-') && v.pids.split(' ').includes(pid))?.[1] || null;
  const mark = (el, cls, vars = {}) => { el.classList.add(cls); for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v); el.dataset.t0 = at; };
  const hideNames = (el) => el?.querySelectorAll('[data-k^="n-"]').forEach((x) => { x.style.visibility = 'hidden'; });
  if (mo.fade) { // reduced motion: a 150ms crossfade, nothing moves
    for (const el of els) if (top(el.dataset.k) && !old[el.dataset.k]) mark(el, 'm-fade-in');
    for (const [k, o] of Object.entries(old)) if (top(k) && !fresh[k]) place(layer, o, ['m-fade-out'], at);
    return;
  }
  let ci = 0, co = 0;
  for (const el of els) {
    const k = el.dataset.k, f = fresh[k], o = old[k];
    if (!f) continue;
    if (k.startsWith('n-')) { // a name flies from where it was to where it's going, its old style crossfading into the new
      if (!o) { mark(el, 'm-fade-in'); continue; }
      const dx = o.box.left - f.box.left, dy = o.box.top - f.box.top, s = f.box.height ? o.box.height / f.box.height : 1;
      mark(el, 'm-name-in', { '--m-dx': `${dx}px`, '--m-dy': `${dy}px`, '--m-s': String(s) });
      place(layer, o, ['m-name-out'], at, { '--m-dx': `${-dx}px`, '--m-dy': `${-dy}px`, '--m-s': String(s ? 1 / s : 1) });
    } else if (k.startsWith('c-')) { // a card grows up out of the row it came from, then its pads land
      if (o) continue;
      const q = rowOf(old, k.slice(2)) || Object.entries(old).find(([x]) => x.startsWith('q-') && x !== 'q-mine')?.[1];
      mark(el, 'm-grow', { '--m-dy': `${q ? q.box.top - f.box.top : 24}px`, '--m-i': String(ci++) });
      el.querySelectorAll('.ce-pad').forEach((pd, j) => pd.style.setProperty('--m-j', String(j)));
    } else if (!o) mark(el, 'm-fade-in'); // a label / one-line row arriving: fades in around its travelling names
  }
  for (const [k, o] of Object.entries(old)) {
    if (fresh[k] || k.startsWith('n-')) continue;
    if (k.startsWith('c-')) { // a card leaving squashes into the row it becomes
      const q = rowOf(fresh, k.slice(2)) || fresh['q-mine'];
      hideNames(place(layer, o, ['m-shrink'], at, { '--m-dy': `${q ? q.box.top - o.box.top : -24}px`, '--m-i': String(co++) }));
    } else hideNames(place(layer, o, ['m-fade-out'], at));
  }
}

/** mount: put the turn / the morph back on this redraw while they run (expired ones are dropped). */
function decorate(ce, app) {
  const now = Date.now();
  const t = app.ui.ceTurn, mo = app.ui.ceMorph;
  if (t && now > t.at + (t.fade ? FADE_MS : TURN_MS)) app.ui.ceTurn = null;
  if (mo && now > mo.at + (mo.fade ? FADE_MS : MORPH_MS)) app.ui.ceMorph = null;
  if (app.ui.ceTurn) playTurn(ce, app.ui.ceTurn);
  else if (app.ui.ceMorph) playMorph(ce, app.ui.ceMorph);
}

function theirsCart(app, hole, teamId) {
  const carts = cartsFor(app, hole);
  return carts.find((c, i) => i > 0 && c.teamId === teamId) || carts[1] || null;
}

const sheetHead = (title, done = false) => `<div class="ce-sh-head"><h2 class="ce-sh-title ellipsis">${esc(title)}</h2>${done ? '<button class="ce-done" data-act="sheet-close">Done</button>' : ''}</div>`;

/** Bottom sheets for the calm Enter (registered in sheets.js). */
export const enterSheets = {
  /** ⋯ More (021 §3): every score 1 … max on the pad row's columns, Picked up (= max), Clear score. */
  'ce-more': (app, { pid, hole }) => {
    const snap = app.snapshot;
    const p = snap.playerById.get(pid);
    if (!p) return '';
    const par = snap.holes[hole - 1].par;
    const cap = maxHoleScore(snap.course, snap.settings, hole, p.dots[hole - 1]);
    const g = p.gross[hole - 1];
    const pads = Array.from({ length: cap }, (_, i) => cePad(p, i + 1, par, { on: g === i + 1, rw: null, editable: true, act: 'ce-more-pick' })).join('');
    return `<div class="ce-sheet">${sheetHead(`${p.name} · Hole ${hole}`)}
      <div class="ce-pads ce-grid">${pads}</div>
      <button class="ce-sh-row" data-act="ce-more-pick" data-pid="${esc(pid)}" data-v="${cap}"><b>Picked up</b><span class="muted">&nbsp;· counts as ${cap}</span></button>
      <button class="ce-sh-row muted" data-act="ce-more-clear" data-pid="${esc(pid)}"${g == null ? ' disabled' : ''}>Clear score</button></div>`;
  },
  /** The other cart (021 §4): same pads; a score from that player's own phone is a read-only line. */
  'ce-theirs': (app, { hole, teamId }) => {
    const c = theirsCart(app, hole, teamId);
    if (!c) return '';
    const par = app.snapshot.holes[hole - 1].par;
    const rows = c.players.map((p) => (ownEntry(p, hole)
      ? `<div class="ce-own"><b class="ellipsis">${esc(p.name)}</b>${smallMark(p.gross[hole - 1], par, 30)}<span class="ce-own-src">From their phone</span></div>`
      : ceGroup(app, p, hole, { editable: app.canEdit(p.id, hole), yours: false }))).join('');
    return `<div class="ce-sheet">${sheetHead(`${names(c.players)} · Hole ${hole}`, true)}${rows}</div>`;
  },
};

/** Redraw once a word or the points moment ends, so the rest state (e.g. "· net 3") comes back. */
let ceRedraw = null;
function armRedraw(app) {
  clearTimeout(ceRedraw);
  const now = Date.now();
  const ends = [app.ui.ceReward?.end, app.ui.cePts ? app.ui.cePts.at + PTS_MS : null,
    app.ui.ceTurn ? app.ui.ceTurn.at + (app.ui.ceTurn.fade ? FADE_MS : TURN_MS) : null,
    app.ui.ceMorph ? app.ui.ceMorph.at + (app.ui.ceMorph.fade ? FADE_MS : MORPH_MS) : null].filter((t) => t && t > now);
  if (ends.length) ceRedraw = setTimeout(() => app.render(), Math.min(...ends) - now + 30);
}

export default {
  hero: true,
  noscroll: true,
  /** 011/013: the name row goes while the green card shows (the hole header is the top of the screen). */
  hideTop(app) { return !!app.myPlayer() && (!app.isFinal() || app.finalUnlocked()) && !!cardState(app, currentHole(app)); },

  render(app) {
    const snap = app.snapshot;
    if (app.isFinal() && !app.finalUnlocked()) return finalView(app);
    if (!app.myPlayer()) return watchView(app);
    const st = snap.settings;
    const h = currentHole(app);
    const pos = posOf(st, h);
    const hole = snap.holes[h - 1];
    const limitPos = HOLES; // browse every hole; scores lock themselves (isLocked / isAhead)
    const lastHole = playOrder(st)[HOLES - 1];
    const myTeam = app.myTeam(h);
    const rot = rotationFor(st, h);
    let matchLine = '';
    if (snap.game && st.solo) {
      // Split point: everyone's points so far, leader first ("Josh 3 · You 2⅓ · Sean ⅔").
      matchLine = `<span class="teams">${snap.game.liveStandings.map((s) => {
        const who = s.teamId === app.myTeam() ? 'You' : esc(snap.teamById.get(s.teamId).name);
        return `${who} <span class="status">${fmtPts(s.points)}</span>`;
      }).join(' <span class="faint">·</span> ')}</span>`;
    } else if (snap.game && myTeam) {
      const ms = matchesFor(snap, myTeam, h);
      const oppOf = (m) => snap.teamById.get(m.teams[0] === myTeam ? m.teams[1] : m.teams[0]);
      if (ms.length > 1) {
        // 3 carts: you play both other carts at once ("vs Shank UP 1 · vs Fore AS").
        const lead = (m) => { const o = oppOf(m).id; const d = m.points[myTeam] - m.points[o]; return !m.played ? '–' : d > 0 ? `UP ${fmtPts(d)}` : d < 0 ? `DN ${fmtPts(-d)}` : 'AS'; };
        matchLine = `<span class="teams">${ms.map((m) => `vs <b style="color:${sideColor(app, oppOf(m).id)}">${esc(shortTeam(oppOf(m).name))}</b> <span class="status">${esc(lead(m))}</span>`).join(' <span class="faint">·</span> ')}</span>`;
      } else {
        const m = ms[0] || null;
        const opp = m ? oppOf(m) : null;
        matchLine = m
          ? `<span class="teams">Rot ${m.rotation} · vs <b style="color:${sideColor(app, opp.id)}">${esc(opp.name)}</b></span><span class="status">${esc(matchStatusShort(snap, m, myTeam))}</span>`
          : '';
      }
    } else if (rot) {
      matchLine = `<span class="teams">${esc(rot.label)}</span>`;
    } else {
      matchLine = `<span class="teams">${snap.hasStrokes ? 'Stroke play · net' : 'Stroke play'}</span>`;
    }
    // Fixing a finalized round: say so, with Done to lock this phone again.
    // 013: no rotation strip on team Enter (match status lives on Matches). Only the fixing line stays —
    // except the Team Ryder Cup, where the header says your match and the cup score ("vs Josh + Brandon · UP 1 thru 3").
    if (app.isFinal()) matchLine = `<span class="teams">${icon('lock', 13)} Fixing a finalized round</span><button class="link-btn relock" data-act="final-relock">Done</button>`;
    else if (snap.game?.sides && myTeam) {
      // 014 §5 / 015: "● vs Joseph + Jay" left; "UP 2 · CUP 5½–3½" right (green only for UP; never red).
      const rs = ryderState(snap, myTeam);
      const pos = posOf(st, h);
      const m = rs?.matches.find((x) => x.us.id === myTeam && pos >= x.from && pos <= x.to);
      if (m) {
        const lead = m.status === 'notStarted' ? ['UP NEXT', false]
          : m.status === 'done' ? [m.result === 'won' ? `WON ${m.flag.text}` : m.result === 'lost' ? `LOST ${m.flag.text}` : 'HALVED', m.result === 'won']
          : m.leader === 'us' ? [`UP ${m.margin}`, true] : m.leader === 'them' ? [`DOWN ${m.margin}`, false] : ['AS', false];
        matchLine = `<span class="teams ellipsis"><i class="ry-hdot"></i>vs ${esc(m.them.names.join(' + '))}</span><span class="status mono"><span class="${lead[1] ? 'you' : 'faint'}">${esc(lead[0])}</span><span class="faint"> · CUP ${fmtPts(rs.sides.us.total)}–${fmtPts(rs.sides.them.total)}</span></span>`;
      }
    } else matchLine = '';
    const gstate = cardState(app, h);
    const gcard = greenCard(gstate, app.ui.gpsSize || 'regular');
    // 013 (team): the course name replaces the max label while the card shows; the GPS badge only when
    // something's off (finding / weak / denied). 011 (individual): the badge always (see individualView).
    const solo = individual(app);
    const subtitle = gstate
      ? `Par ${hole.par} · Hcp ${hole.si} · ${solo || gstate.kind !== 'ok' ? gpsBadge(gstate) : esc(shortCourseName(snap.course?.name || ''))}`
      : `Par ${hole.par} · Hcp ${hole.si} · ${esc(maxLabel(snap.course, st, h))}`;
    const carts = cartsFor(app, h);
    const focus = focusSide(app, h, carts);
    const ahead = isAhead(app, h);
    const locked = isLocked(app, h) || ahead;
    const cur = app.nextHole();
    const done = app.foursomeDone();
    // 18-hole progress strip; a gap where the opponents switch (or at the turn).
    const breaks = new Set(snap.game?.rotations?.length > 1 ? snap.game.rotations.slice(1).map((r) => r.from) : [10]);
    const dots = playOrder(st)
      .map((n, i) => {
        const ids = foursomeFor(snap.roster, st, app.me, n);
        const fin = ids.length && ids.every((id) => snap.playerById.get(id).gross[n - 1] != null);
        return `<i class="${n === h ? 'here' : fin ? 'done' : ''}${breaks.has(i + 1) ? ' brk' : ''}"></i>`;
      })
      .join('');
    // Every box needs a score before you move on; the button says who's left.
    const blanks = blankPlayers(app, h);
    const left = blanks.length
      ? ` · ${blanks.length === 1 ? `${blanks[0].name} left` : blanks.length === 2 ? `${blanks[0].name}, ${blanks[1].name} left` : `${blanks.length} scores left`}`
      : ' →';
    const nextLabel = `${h === lastHole ? 'Finish' : 'Next hole'}${left}`;
    // Looking back at a finished hole: the button takes you back to where you are.
    const footBtn = pos >= frontierPos(app) - 1 && !ahead
      ? `<button class="btn primary block next-btn${blanks.length ? ' waiting' : ''}" data-act="next-hole">${esc(nextLabel)}</button>`
      : done
        ? '<button class="btn primary block next-btn" data-act="tab" data-v="board">See the Board →</button>'
        : `<button class="btn primary block next-btn" data-act="hole-current">Back to hole ${cur} →</button>`;
    const open = focus === 'opp' ? carts[1] : carts[0];
    const shut = carts.filter((c) => c !== open);
    const holeRow = `<div class="hole-row">
          <button class="arrow" data-act="hole-prev" aria-label="Previous hole" ${pos <= 1 ? 'disabled' : ''}>${icon('back')}</button>
          <button class="hole-head" data-act="hole-grid" aria-label="Hole ${h}: all holes">
            <span class="hole-title">Hole ${h}</span>
            <span class="hole-meta">${subtitle}</span>
          </button>
          <button class="arrow" data-act="hole-next" aria-label="Next hole" ${pos >= limitPos ? 'disabled' : ''}>${icon('fwd')}</button>
          ${app.isOrganizer() ? `<button class="hole-more" data-act="fixhole-open" data-v="${h}" aria-label="Hole menu: fix hole ${h}">${icon('more', 20)}</button>` : ''}
        </div>`;
    // 028 §2: the same Enter for every game (the calm Enter, 021/022). The old Enter stays only as a fallback.
    const cec = ceCarts(app, h);
    if (cec.length && (individual(app) || app.myTeam())) return ryderEnterView(app, h, { gcard, carts: cec, focus, locked, ahead, pos, limitPos, lastHole, done, cur });
    if (individual(app)) return individualView(app, h, { holeRow, dots, footBtn, gcard, gstate });
    return `<div class="enter nr${gcard ? ` gps-card ${app.ui.gpsSize || 'regular'}` : ''}">
      <div class="hero">
        ${holeRow}
        ${gcard}
        ${matchLine ? `<div class="matchup-line">${matchLine}</div>` : ''}
      </div>
      <div class="sheet${focus === 'opp' ? ' even' : ''}">
        ${cartCard(app, open, h, open === carts[0], locked)}
        ${shut.map((c) => slimCart(app, c, h, c === carts[0])).join('')}
        <div class="enter-foot"><div class="holedots" aria-hidden="true">${dots}</div><span class="sync" data-sync>Synced</span></div>
        ${footBtn}
      </div>
    </div>`;
  },

  mount(root, app) {
    if (!app.myPlayer()) return;
    // 011: location only while Enter is open and the card is on for this hole.
    const h = currentHole(app);
    if (cardOn(app, h) && !app.isFinal()) {
      if (!gps.isOn() && gps.state().status !== 'denied') gps.start(() => app.render());
      // 013: Regular when the score pads fit at full size, else Compact (measured, per screen height).
      const key = `${innerWidth}x${innerHeight}`;
      if (app.ui.gpsSizeKey !== key) { app.ui.gpsSizeKey = key; app.ui.gpsSize = 'regular'; }
      const ry = root.querySelector('.ry-enter.gps-card');
      if (ry && app.ui.gpsSize === 'regular') {
        const c = document.getElementById('content');
        if (c && c.scrollHeight > c.clientHeight + 1) { app.ui.gpsSize = 'compact'; requestAnimationFrame(() => app.render()); return; }
      }
      const step = root.querySelector('.enter.gps-card .cart.focus .tile .step');
      if (step && app.ui.gpsSize === 'regular' && step.getBoundingClientRect().width < 87) { app.ui.gpsSize = 'compact'; requestAnimationFrame(() => app.render()); return; }
    } else if (gps.isOn()) gps.stop();
    const ryCard = root.querySelector('.ry-enter.gps-card');
    if (ryCard && (app.ui.gpsSize || 'regular') === 'regular') {
      const c = document.getElementById('content');
      if (c && c.scrollHeight > c.clientHeight + 1) { app.ui.gpsSize = 'compact'; requestAnimationFrame(() => app.render()); return; }
    }
    const ce = root.querySelector('.ce');
    if (ce) {
      // 021/022/034: put the turn, the morph and any reward motion back where they were before this redraw, and redraw
      // when they end.
      decorate(ce, app);
      syncMotion(ce);
      armRedraw(app);
      if (document.querySelector('.coach')) return; // one tip at a time
      const mineRows = ce.querySelector('.ce-cards.mine'), theirs = ce.querySelector('.ce-line.ce-q');
      if (mineRows && !mineRows.querySelector('.ce-pad.sel') && mineRows.querySelector('.ce-pads')) {
        app.coach('pad3', mineRows.querySelector('.ce-pads'), 'Tap the score you made. ⋯ has every other score.'); // 031 §2.5
      } else if (mineRows && theirs && !theirs.querySelector('.ce-sm') && mineRows.querySelectorAll('.ce-pad.sel').length >= 2) {
        app.coach('quiet1', theirs, 'Tap here to enter scores for the rest of your group.'); // 031 §2.5
      }
      return;
    }
    if (document.querySelector('.coach')) return; // one tip at a time
    const first = root.querySelector('.cart.focus .tile.empty .face');
    const mine = root.querySelector('.cart.mine.focus');
    const theirs = root.querySelector('.cart.opp.dim');
    // Once your cart is in and theirs isn't, point at the greyed cart.
    if (mine && theirs && !mine.querySelector('.tile.empty') && theirs.querySelector('.mk-ghost')) {
      app.coach('oppcart3', theirs, 'You can enter scores for the other cart in your group too. Tap their row to open it, then Back to come back.');
    } else if (first) {
      app.coach('tile5', first, 'The dashed number is par. Your first tap makes it par, then + for bogey or − for birdie. Every box needs a score before Next hole.');
    }
  },

  actions: {
    'gps-on': (el, ev, app) => { gps.stop(true); gps.start(() => app.render()); },
    'tile-tap': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      if (app.scoreOf(pid, h) != null) return;
      app.setScore(pid, h, parFor(app, pid, h));
    },
    'tile-step': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      const d = Number(el.dataset.d);
      const g = app.scoreOf(pid, h);
      // First tap on an empty box is always par, whichever button: no accidental bogeys.
      if (g == null) {
        app.setScore(pid, h, parFor(app, pid, h));
        return;
      }
      const v = Math.max(1, Math.min(maxFor(app, pid, h), g + d));
      if (v !== g) app.setScore(pid, h, v);
    },
    'tile-clear': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      if (app.scoreOf(pid, h) == null) return;
      app.setScore(pid, h, null);
      app.toast({ title: `Cleared ${app.snapshot.playerById.get(pid)?.name || ''} on ${h}` });
    },
    'hole-prev': (el, ev, app) => {
      if (!app.myPlayer()) return;
      const st = app.snapshot.settings;
      const pos = posOf(st, app.ui.hole);
      if (pos > 1) {
        beginTurn(app, holeAt(st, pos - 1));
        app.render();
      }
    },
    'hole-grid': (el, ev, app) => app.openSheet('holes', {}),
    'hole-unlock': (el, ev, app) => {
      app.ui.unlocked = app.ui.hole;
      app.render();
    },
    'hole-current': (el, ev, app) => {
      beginTurn(app, app.nextHole());
      app.render();
    },
    'hole-next': (el, ev, app) => {
      if (!app.myPlayer()) return;
      const st = app.snapshot.settings;
      const pos = posOf(st, app.ui.hole);
      if (pos < HOLES) {
        beginTurn(app, holeAt(st, pos + 1));
        app.render();
      }
    },
    'next-hole': (el, ev, app) => nextHole(app),
    // 021/022 calm team Enter
    'ce-pick': (el, ev, app) => cePick(app, el.dataset.pid, app.ui.hole, Number(el.dataset.v), 0, !!el.closest('.ce-their')),
    'ce-more': (el, ev, app) => app.openSheet('ce-more', { pid: el.dataset.pid, hole: app.ui.hole }),
    'ce-more-pick': (el, ev, app) => {
      const hole = app.sheet?.props?.hole ?? app.ui.hole;
      app.closeSheet();
      cePick(app, el.dataset.pid, hole, Number(el.dataset.v), SHEET_CLOSE_MS);
    },
    'ce-more-clear': (el, ev, app) => {
      const hole = app.sheet?.props?.hole ?? app.ui.hole;
      app.closeSheet();
      app.ui.ceReward = null;
      app.setScore(el.dataset.pid, hole, null);
    },
    'ce-theirs': (el, ev, app) => { beginMorph(app); app.ui.ceOpen = { hole: app.ui.hole, t: el.dataset.t || '' }; app.ui.cePad = null; app.ui.ceReward = null; app.render(); },
    'ce-close': (el, ev, app) => { beginMorph(app); app.ui.ceOpen = null; app.ui.ceReward = null; app.render(); },
    'ce-padto': (el, ev, app) => { app.ui.cePad = { pid: el.dataset.pid, hole: app.ui.hole }; app.render(); },
    'cart-focus': (el, ev, app) => {
      // Remembered for this hole only: any other hole opens on your cart (70/30).
      app.ui.enterFocus = el.dataset.v === 'opp' ? app.ui.hole : null;
      app.ui.enterCart = el.dataset.v === 'opp' ? el.dataset.t || null : null;
      app.render();
    },
    'team-picker': (el, ev, app) => app.openTeamPicker(),
    'pad-toggle': (el, ev, app) => {
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      app.ui.pad = app.ui.pad?.pid === pid && app.ui.pad?.hole === h ? null : { pid, hole: h };
      app.ui.foldAt = Date.now();
      app.render();
      padIntoView();
    },
    'pad-pick': (el, ev, app) => {
      // Car-ride mode: pick a score and the pad jumps to the next player still waiting.
      const pid = el.dataset.pid;
      const h = app.ui.hole;
      app.setScore(pid, h, Number(el.dataset.v));
      const snap = app.snapshot;
      const ids = foursomeFor(snap.roster, snap.settings, app.me, h).filter((id) => id !== app.me);
      const next = ids.find((id) => id !== pid && snap.playerById.get(id).gross[h - 1] == null && app.canEdit(id, h));
      app.ui.pad = next ? { pid: next, hole: h } : null;
      app.render();
      padIntoView();
    },
    'pin-open': (el, ev, app) => app.unlockFinal(),
    'final-relock': (el, ev, app) => {
      app.ui.finalUnlock = null;
      app.render();
      app.toast({ title: 'Locked again' });
    },
  },
};

function maxFor(app, pid, h) {
  const snap = app.snapshot;
  return maxHoleScore(snap.course, snap.settings, h, snap.playerById.get(pid).dots[h - 1]);
}
function parFor(app, pid, h) {
  return Math.min(app.snapshot.holes[h - 1].par, maxFor(app, pid, h));
}

/** Players in your group with no score yet on this hole. */
function blankPlayers(app, h) {
  return cartsFor(app, h).flatMap((c) => c.players).filter((p) => p.gross[h - 1] == null && app.inMyFoursome(p.id, h));
}

/** Next hole tapped with boxes still empty: point at them instead of moving on. */
function nudgeBlanks(app, h, blanks) {
  const carts = document.querySelector('#content .ce') ? ceCarts(app, h) : cartsFor(app, h);
  const calm = !!document.querySelector('#content .ce'); // 028: the rest of your tee time grows open in place
  const open = !calm && focusSide(app, h, carts) === 'opp' ? carts[1] : carts[0];
  const blankIds = new Set(blanks.map((p) => p.id));
  const openHasBlank = open.players.some((p) => blankIds.has(p.id));
  // All the missing scores are in the other cart: open it so they can be entered.
  if (!openHasBlank && carts.length > 1) {
    if (calm) {
      beginMorph(app); // the tap on Next opens their cards: the same morph as tapping their row
      const cc = ceCarts(app, h);
      const c = cc.find((x, i) => i > 0 && x.players.some((p) => blankIds.has(p.id))) || cc[1];
      app.ui.ceOpen = { hole: h, t: c?.teamId || '' };
      app.ui.cePad = null;
    } else app.ui.enterFocus = open === carts[0] ? h : null;
  }
  app.ui.nudge = { hole: h, until: Date.now() + 1200 };
  // "You first" rounds: open the score pad on the first player still waiting.
  const firstOther = blanks.find((p) => p.id !== app.me && app.canEdit(p.id, h));
  if (individual(app) && firstOther && !blanks.some((p) => p.id === app.me)) app.ui.pad = { pid: firstOther.id, hole: h };
  app.render();
  const names = blanks.map((p) => p.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} + ${names[names.length - 1]}` : names[0];
  app.toast({
    title: `Still need ${list}`,
    sub: openHasBlank ? 'Tap each box: first tap is par, then − / +' : 'Enter theirs here, or wait for their phone',
    ms: 3500,
  });
  // Their phone may have entered them already: pull the latest so the button can flip.
  app.refetch?.();
}

function goHole(app, to, from) {
  beginTurn(app, to); // 034: after Switch it up, this runs when the card closes, so the turn plays then
  app.render();
  app.toast({
    title: `Hole ${from} saved`, action: 'Undo',
    onAction: () => {
      beginTurn(app, from);
      app.render();
    },
  });
}

function nextHole(app) {
  const h = app.ui.hole;
  // Every box needs a real tap first: nothing is saved as par on its own.
  const blanks = blankPlayers(app, h);
  if (blanks.length) {
    nudgeBlanks(app, h, blanks);
    return;
  }
  const snap = app.snapshot;
  const st = snap.settings;
  const pos = posOf(st, h);
  if (pos >= HOLES) {
    app.go(app.tabHash('board'));
    return;
  }
  const nh = holeAt(st, pos + 1);
  const myTeam = app.myTeam();
  const crossing = snap.game && rotationIndexFor(st, h) !== rotationIndexFor(st, nh);
  const switchKey = `glb.switch.${app.code}.${nh}`; // once per swap, even if you step back and come forward again
  if (crossing && myTeam && !local.get(switchKey)) {
    local.set(switchKey, true);
    const done = matchFor(snap, myTeam, h);
    const next = matchFor(snap, myTeam, nh);
    const name = (t) => snap.teamById.get(t)?.name || t;
    let result = '';
    if (done) {
      const opp = done.teams[0] === myTeam ? done.teams[1] : done.teams[0];
      result = snap.game.type === 'rotationPlusMinus'
        ? `${name(myTeam)} ${fmtSigned(done.margin[myTeam], 'E')} · ${name(opp)} ${fmtSigned(done.margin[opp], 'E')}`
        : `${name(myTeam)} ${fmtPts(done.points[myTeam])} – ${name(opp)} ${fmtPts(done.points[opp])}`;
    }
    let sub = '';
    if (next) {
      const opp = next.teams[0] === myTeam ? next.teams[1] : next.teams[0];
      const players = snap.teamById.get(opp).playerIds.map((id) => snap.playerById.get(id).name).join(' + ');
      sub = `${next.label} vs ${name(opp)} · ${players}`;
    }
    if (st.ryder) {
      // Team Ryder Cup: the finished match from the 015 engine (hole points frozen at a clinch), then who's next.
      const rs = ryderState(snap, myTeam);
      const pos2 = posOf(st, nh);
      const prev = rs.matches.find((x) => x.us.id === myTeam && pos >= x.from && pos <= x.to);
      const up = rs.matches.find((x) => x.us.id === myTeam && pos2 >= x.from && pos2 <= x.to);
      app.showCard({
        kicker: 'New opponent',
        big: up ? up.label : 'Next match',
        result: !prev ? '' : prev.status === 'done' ? `Last match: ${prev.result === 'won' ? 'you won' : prev.result === 'lost' ? 'they won' : 'halved'} ${prev.flag.text}` : `Last match: ${prev.kicker.toLowerCase()}`,
        sub: up ? `vs ${up.them.names.join(' + ')} · ${teeTimeName(st, up.them.tee)}` : '',
        sub2: 'Nobody moves. The app compares your scores hole by hole.',
        button: `Continue to hole ${nh}`,
        onContinue: () => goHole(app, nh, h),
      });
      return;
    }
    // 031 §2.5: once per switch, who you're with and who you're playing now. 2v2 switching partners: your pairing
    // changes with the stretch, so "you" before and after are different teams.
    const swap = (st.rotationMode || 'swap') === 'swap';
    const meBefore = st.pairs ? sideOn(snap, app.me, h) : myTeam, meAfter = st.pairs ? sideOn(snap, app.me, nh) : myTeam;
    const was = st.pairs ? matchFor(snap, meBefore, h) : done, now = st.pairs ? matchFor(snap, meAfter, nh) : next;
    const firsts = (t, skipMe = false) => (snap.teamById.get(t)?.playerIds || []).filter((id) => !skipMe || id !== app.me)
      .map((id) => { const p = snap.playerById.get(id); return p?.firstName || String(p?.name || '').split(' ')[0]; }).join(' + ');
    const other = (m, t) => (m ? m.teams.find((x) => x !== t) : null);
    let last = '';
    if (was) {
      const u = was.points[meBefore], t = was.points[other(was, meBefore)];
      last = snap.game.type === 'rotationPlusMinus' ? `Last set: ${fmtSigned(was.margin[meBefore], 'E')}`
        : `Last set: ${!was.final ? `${fmtPts(u)}–${fmtPts(t)} so far` : u > t ? `you won ${fmtPts(u)}–${fmtPts(t)}` : u < t ? `lost ${fmtPts(u)}–${fmtPts(t)}` : `halved ${fmtPts(u)}–${fmtPts(t)}`}`;
    }
    const out = !now && !st.pairs ? sitOut(app, nh) : null; // 6 players: this set your cart sits out
    app.showCard({
      kicker: 'Switch it up',
      big: now ? (st.pairs ? `With ${firsts(meAfter, true)}` : `vs ${firsts(other(now, meAfter))}`) : out ? 'You sit this one out' : `On to rotation ${(done?.rotation || 0) + 1}`,
      result: last,
      sub: now ? (st.pairs ? `vs ${firsts(other(now, meAfter))} · ${now.label.toLowerCase()}` : `${now.label} · with ${firsts(meAfter, true)}`) : out ? `${out.replace(/^Sitting out · /, '').replace(/^./, (c) => c.toUpperCase())}. Keep entering your scores.` : sub,
      sub2: st.pairs ? 'Same foursome, new partner. Each set is its own match.' : swap ? 'One cart waits, one moves up.' : 'Nobody moves. The app compares your scores with the other group.',
      button: `Continue to hole ${nh}`,
      onContinue: () => goHole(app, nh, h),
    });
    return;
  }
  const alert = myTeam ? matchupAlert(snap, myTeam, nh) : null;
  const key = `glb.alert.${app.code}.${nh}`;
  if (alert && !local.get(key)) {
    local.set(key, true);
    const [kicker, ...rest] = alert.text.split(' — ');
    const m = matchFor(snap, myTeam, nh);
    app.showCard({
      sunny: true,
      kicker,
      big: rest.join(' — ').replace(/^./, (c) => c.toUpperCase()),
      sub: m ? `${snap.teamById.get(myTeam).name}: ${matchStatus(snap, m, myTeam)}` : '',
      button: 'Let’s go',
      onContinue: () => goHole(app, nh, h),
    });
    return;
  }
  goHole(app, nh, h);
}
