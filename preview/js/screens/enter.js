// enter.js — the default tab (designspec §2). Team game: your cart's two players as full-width
// stacked rows (big − / +, the score in its score mark, a live BIRDIE / PAR label, a dashed ghost
// of par until the first tap), the team line (Low Ball / Low Total), and the other cart in your
// foursome as one slim row + Edit (tap it to enter theirs; yours collapses to the slim row).
// The first tap on an empty box (−, the number or +) is par; after that − / + step. Next hole
// waits until every box in your group has a score ("Next hole · Sean left"); tapping it then
// points at who's missing. Nothing is ever saved as par without a tap. Long-press clears.
// Holes two or more back open locked. Holes follow play order (start on 1 or 10).
// Must fit an iPhone SE with no scrolling (rows and buttons shrink to the space).

import { esc, icon, mark, scoreName, foldIn } from '../ui.js?v=dd940bc';
import {
  maxHoleScore, maxLabel, rotationFor, rotationIndexFor, foursomeFor, matchFor, matchesFor, componentNames,
  fmtPts, fmtSigned, playOrder, posOf, holeAt, HOLES, sideOn,
} from '../scoring.js?v=dd940bc';
import { matchupAlert } from '../headlines.js?v=dd940bc';
import { teamColor, isDefaultTeamName, shortTeam } from '../teams.js?v=dd940bc';
import { local } from '../db.js?v=dd940bc';

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

/** Furthest hole you can step forward to: the next one your foursome hasn't finished. */
function holeLimit(app) {
  return app.nextHole();
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
  const mine = side(app.me);
  const order = [...ids.filter((id) => side(id) === mine), ...ids.filter((id) => side(id) !== mine)];
  const carts = [];
  for (const id of order) {
    const p = { ...snap.playerById.get(id), teamId: side(id) };
    let c = carts.find((x) => x.teamId === p.teamId);
    if (!c) carts.push((c = { teamId: p.teamId, players: [] }));
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
  const name = mine && team && !locked && !snap.settings.pairs
    ? `<button class="name name-btn" data-act="team-picker" aria-label="Name your cart"><i class="jd"></i><span class="ellipsis">${esc(label)}</span>${isDefaultTeamName(team) ? '<span class="pick">Name it</span>' : ''}</button>`
    : `<span class="name"><i class="jd"></i><span class="ellipsis">${esc(label)}</span></span>`;
  // A locked (finished) hole: the whole card is the tap target that unlocks it for editing.
  const tap = locked ? ` data-act="hole-unlock" data-enter="hole-unlock" role="button" tabindex="0" aria-label="Edit hole ${hole}"` : '';
  const chip = locked ? `<span class="focus-chip lock-chip">${icon('lock', 12)} Tap to edit</span>` : `<span class="lblt">${esc(teamLine(app, cart, hole))}</span>`;
  return `<section class="cart ${mine ? 'mine' : 'opp'} focus${locked ? ' locked' : ''}" style="--jersey:${jersey}"${tap}>
    <div class="cart-head">${name}${chip}</div>
    <div class="tiles">${cart.players.map((p) => tile(app, p, hole, locked)).join('')}</div>
  </section>`;
}

/** The other cart, collapsed to one slim row: name, their scores with marks, Edit / Back. */
function slimCart(app, cart, hole, mine) {
  const snap = app.snapshot;
  const team = cart.teamId ? snap.teamById.get(cart.teamId) : null;
  const label = cartLabel(app, cart);
  const jersey = team ? sideColor(app, team.id) : 'var(--line-strong)';
  const par = snap.holes[hole - 1].par;
  const scores = cart.players.map((p) => `<span class="face" data-pid="${esc(p.id)}"><span class="ellipsis">${esc(p.name)}</span>${mark(p.gross[hole - 1], par, 28, { ghost: '–' })}</span>`).join('');
  return `<section class="cart ${mine ? 'mine' : 'opp'} dim" style="--jersey:${jersey}" data-act="cart-focus" data-enter="cart-focus" data-v="${mine ? 'mine' : 'opp'}" role="button" tabindex="0" aria-label="${mine ? 'Back to your cart' : `Enter scores for ${esc(label)}`}">
    <i class="jd"></i><span class="name ellipsis">${esc(label)}</span>
    <span class="slim-scores mono">${scores}</span>
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
  const locked = isLocked(app, h);
  const ids = foursomeFor(snap.roster, st, app.me, h).filter((id) => id !== app.me);
  const others = ids.map((id) => snap.playerById.get(id));
  const blanks = others.filter((p) => p.gross[h - 1] == null && app.canEdit(p.id, h));
  const youTile = tile(app, me, h, locked).replace('<div class="tile', '<div class="tile you').replace('<span class="who">', '<span class="who"><span class="you-badge mono">YOU</span>');
  // Match play: the others' points, leader first ("Josh 3½ · Sean 2"); else the format.
  const kind = snap.game && st.solo
    ? snap.game.liveStandings.filter((x) => x.teamId !== me.teamId).map((x) => `${esc(snap.teamById.get(x.teamId).name)} <span class="status">${fmtPts(x.points)}</span>`).join(' <span class="faint">·</span> ') || 'Match play'
    : snap.hasStrokes ? 'Stroke play · net' : 'Stroke play';
  const pos = myPosition(app);
  const tap = locked ? ` data-act="hole-unlock" data-enter="hole-unlock" role="button" tabindex="0" aria-label="Edit hole ${h}"` : '';
  const strip = app.isFinal()
    ? `<span class="teams">${icon('lock', 13)} Fixing a finalized round</span><button class="link-btn relock" data-act="final-relock">Done</button>`
    : `<span class="teams">${kind}</span>${pos ? `<span class="status">${esc(pos)}</span>` : ''}`;
  return `<div class="enter nr solo-enter${others.some((p) => app.ui.pad?.hole === h && app.ui.pad?.pid === p.id) ? ' pad-open' : ''}">
      <div class="hero">${parts.holeRow}<div class="matchup-line">${strip}</div></div>
      <div class="sheet">
        <section class="cart mine focus you-card${locked ? ' locked' : ''}" style="--jersey:var(--cart-you)"${tap}>
          ${locked ? `<div class="cart-head"><span class="name">Your score</span><span class="focus-chip lock-chip">${icon('lock', 12)} Tap to edit</span></div>` : ''}
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

export default {
  hero: true,
  noscroll: true,

  render(app) {
    const snap = app.snapshot;
    if (app.isFinal() && !app.finalUnlocked()) return finalView(app);
    if (!app.myPlayer()) return watchView(app);
    const st = snap.settings;
    const h = currentHole(app);
    const pos = posOf(st, h);
    const hole = snap.holes[h - 1];
    const limitPos = posOf(st, holeLimit(app));
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
    if (app.isFinal()) matchLine = `<span class="teams">${icon('lock', 13)} Fixing a finalized round</span><button class="link-btn relock" data-act="final-relock">Done</button>`;
    const carts = cartsFor(app, h);
    const focus = focusSide(app, h, carts);
    const locked = isLocked(app, h);
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
    const footBtn = pos >= frontierPos(app) - 1
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
            <span class="hole-meta">Par ${hole.par} · Hcp ${hole.si} · ${esc(maxLabel(snap.course, st, h))}</span>
          </button>
          <button class="arrow" data-act="hole-next" aria-label="Next hole" ${pos >= limitPos ? 'disabled' : ''}>${icon('fwd')}</button>
          ${app.isOrganizer() ? `<button class="hole-more" data-act="fixhole-open" data-v="${h}" aria-label="Hole menu: fix hole ${h}">${icon('more', 20)}</button>` : ''}
        </div>`;
    if (individual(app)) return individualView(app, h, { holeRow, dots, footBtn });
    return `<div class="enter nr">
      <div class="hero">
        ${holeRow}
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
        app.ui.hole = holeAt(st, pos - 1);
        app.render();
      }
    },
    'hole-grid': (el, ev, app) => app.openSheet('holes', {}),
    'hole-unlock': (el, ev, app) => {
      app.ui.unlocked = app.ui.hole;
      app.render();
    },
    'hole-current': (el, ev, app) => {
      app.ui.hole = app.nextHole();
      app.render();
    },
    'hole-next': (el, ev, app) => {
      if (!app.myPlayer()) return;
      const st = app.snapshot.settings;
      const pos = posOf(st, app.ui.hole);
      if (pos < posOf(st, holeLimit(app))) {
        app.ui.hole = holeAt(st, pos + 1);
        app.render();
      }
    },
    'next-hole': (el, ev, app) => nextHole(app),
    'cart-focus': (el, ev, app) => {
      // Remembered for this hole only: any other hole opens on your cart (70/30).
      app.ui.enterFocus = el.dataset.v === 'opp' ? app.ui.hole : null;
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
  const carts = cartsFor(app, h);
  const open = focusSide(app, h, carts) === 'opp' ? carts[1] : carts[0];
  const blankIds = new Set(blanks.map((p) => p.id));
  const openHasBlank = open.players.some((p) => blankIds.has(p.id));
  // All the missing scores are in the greyed cart: open it so they can be entered.
  if (!openHasBlank && carts.length > 1) {
    app.ui.enterFocus = open === carts[0] ? h : null;
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
  app.ui.hole = to;
  app.render();
  app.toast({
    title: `Hole ${from} saved`, action: 'Undo',
    onAction: () => {
      app.ui.hole = from;
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
    const swap = (st.rotationMode || 'swap') === 'swap';
    app.showCard({
      kicker: 'Switch it up',
      big: done?.final ? `Rotation ${done.rotation} is in` : `On to rotation ${(done?.rotation || 0) + 1}`,
      result,
      sub,
      sub2: swap ? 'One cart waits, one moves up.' : 'Same foursome — this matchup compares scores with the other group.',
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
