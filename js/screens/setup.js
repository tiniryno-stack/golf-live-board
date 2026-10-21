// setup.js — New round (designspec §6). ① Course → ② Players → ③ Pick a game →
//   Scorecard only / Match play → Start;  2v2 → ④ partners → Start;  Cart game → ④ carts →
//   (④b matchups & rules, optional) → Start;  then ⑤ Round is live (join code + organizer PIN).
// ① → ①a "Which course?" for a club listed with 2–3 courses mixed together; ② card line →
// Scorecard check (Par / Hcp for 18 holes, tees, first tee, round name).
// Course search: nearby courses load on open ("Looks like you're at" on top), your group's courses
// (the copy from your last round there), search by name, or enter the card yourself.
// Players: first + last name (nickname only when that full name is taken), Hcp = strokes.
// Games by player count (scoring.GAMES): the game is always picked on its own step; team screens
// never re-ask it. Nothing is required that has a sensible default.
// "Run it back" (#/setup/CODE) copies players, team names, carts and settings (not the course).

import { esc, icon, seg, todayISO, prettyDate, copyText, roundLink, empty } from '../ui.js';
import { COURSES } from '../courses.js';
import * as cd from '../coursedata.js';
import { DEFAULT_SETTINGS, DEFAULT_ROTATION, GAMES, gameFix, autoGroups, cartRotation, threeCartRotation, cartIdsFor } from '../scoring.js';
import * as db from '../db.js';
import * as names from '../names.js';

const TEAM_IDS = ['A', 'B', 'C', 'D'];
const DRAFT_KEY = 'glb.setupDraft';

const clone = (x) => JSON.parse(JSON.stringify(x));

// People have a first + last name (and a nickname when that full name is already taken).
// In Setup a player shows by full name; the round itself shows first names (js/names.js).
function withName(p) {
  if (!p.firstName) {
    const { first, last } = names.splitName(p.name || '');
    p.firstName = first;
    p.lastName = p.lastName ?? last;
  }
  p.lastName = p.lastName || '';
  p.nickname = p.nickname || '';
  p.name = names.fullName(p);
  return p;
}
/** Setup labels: full names; the nickname only shows when two players share the full name. */
function relabel(s) {
  const full = s.players.map((p) => names.fullName(p).toLowerCase());
  s.players.forEach((p, i) => {
    const twin = full.some((f, j) => j !== i && f === full[i]);
    p.name = names.fullName(p, { withNick: twin });
  });
}
function newPlayer({ personId, firstName, lastName = '', nickname = '' }) {
  return withName({ key: db.uuid(), personId: personId || db.uuid(), firstName, lastName, nickname, strokes: '', teamId: null, groupId: 'g1' });
}
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function blank(from = null) {
  const { rotation, ...settings } = DEFAULT_SETTINGS;
  return {
    screen: 'course', from, loadingFrom: !!from, courseId: null, tee: null, name: '',
    course: null, courseStatus: 'idle', mine: [], q: '', results: null, searching: false, searchError: '',
    near: null, nearStatus: 'idle', loc: null, which: null, whichName: '',
    players: [], teams: TEAM_IDS.map((id) => ({ id, name: '' })),
    game: 'scorecard', pairSwitch: 'never', schedule: 'six', opps: null, custom: false, swapSel: null, rulesOpen: false,
    settings: { ...settings, rotationMode: 'fixed' }, // keep tee times by default (designspec §6 ④b)
    crewId: null, crewFromSource: false, past: [], newName: '', nickAsk: null, pairedFromLast: false,
    saving: false, saved: null,
  };
}

/** The picked game, or Scorecard only if it no longer fits the player count. */
function gameOf(s) {
  return gameFix(s.game, s.players.length) ? 'scorecard' : s.game;
}

/** Carts in play: 3 for 6 players, 4 for 8 (Partner “Rider” Cup). */
const cartIds = (s) => cartIdsFor(s.players.length);

/** Partner “Rider” Cup: every player in a cart, 2 per cart (fills in order when they aren't). */
function ensureCarts(s) {
  const ids = cartIds(s);
  const ok = ids.every((id) => s.players.filter((p) => p.teamId === id).length === 2);
  if (!ok) s.players.forEach((p, i) => { p.teamId = ids[Math.floor(i / 2)] || null; });
}

function persist(s) {
  // Search results and the phone's location stay in memory only.
  if (!s.saved) {
    db.local.set(DRAFT_KEY, {
      ...s, saving: false, loadingFrom: false, results: null, searching: false, searchError: '',
      near: null, nearStatus: 'idle', loc: null, mine: [],
    });
  }
}

async function loadPast(app, crewId) {
  if (!crewId) return;
  try {
    const rounds = await db.fetchCrewRounds(crewId);
    const people = new Map();
    const courses = new Map(); // course id → the copy from the group's latest round there (with any fixes)
    const plays = new Map(); // course id → rounds your group played there
    for (const { event } of rounds) {
      for (const p of event.roster?.players || []) if (p.personId) people.set(p.personId, p.name);
      if (event.course?.id) {
        courses.set(event.course.id, event.course);
        plays.set(event.course.id, (plays.get(event.course.id) || 0) + 1);
      }
    }
    let crew = null;
    try {
      const r = await db.api.crewPeople(crewId);
      if (r?.ok) crew = r.people;
    } catch { /* database without crews yet: names from past rounds */ }
    if (app.setup) {
      app.setup.past = crew
        ? crew.map((p) => withName({ personId: p.id, firstName: p.firstName, lastName: p.lastName || '', nickname: p.nickname || '', crewId }))
        : [...people].map(([personId, name]) => withName({ personId, name, crewId }));
      app.setup.mine = yourCourses([...courses.values()].reverse().map((c) => ({ ...c, plays: plays.get(c.id) || 0 })));
      paintCourses(app);
    }
  } catch { /* offline: typing names still works */ }
}

async function loadFrom(app, code) {
  try {
    const ev = await db.fetchEvent(code);
    const s = app.setup;
    if (!s || s.from !== code) return;
    s.loadingFrom = false;
    if (!ev) {
      app.toast({ title: `No round ${code}`, sub: 'Starting a fresh one.', error: true });
      app.render();
      return;
    }
    s.players = (ev.roster.players || []).map((p, i) => ({
      key: `k${i}`, personId: p.personId || db.uuid(), name: p.name, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname,
      strokes: p.strokes ?? '', teamId: p.teamId || null, groupId: p.groupId || 'g1',
    })).map(withName);
    s.teams = TEAM_IDS.map((id) => ({ id, name: (ev.roster.teams || []).find((t) => t.id === id)?.name || '' }));
    const { rotation, ...settings } = ev.settings || {};
    s.settings = { ...s.settings, ...settings };
    // The same game as last time (the course isn't copied).
    const nCarts = (ev.roster.teams || []).length;
    s.game = settings.pairs ? '2v2' : settings.solo ? 'match' : nCarts === 4 || nCarts === 3 ? 'carts' : 'scorecard';
    s.pairSwitch = settings.pairSwitch || 'never';
    if (Array.isArray(rotation) && rotation.length === 2) s.schedule = 'turn';
    if (Array.isArray(rotation) && rotation.length) s.opps = rotation.map((r) => r.matches?.[0]?.[1]).filter(Boolean);
    s.pairedFromLast = s.game === 'carts';
    s.crewId = ev.crew_id || null;
    s.crewFromSource = true;
    persist(s);
    app.render();
    loadPast(app, s.crewId);
  } catch {
    if (app.setup) app.setup.loadingFrom = false;
    app.toast({ title: 'No signal', sub: 'Couldn’t copy that round. Type names instead.', error: true });
    app.render();
  }
}

function course(s) {
  return s.course || COURSES.find((c) => c.id === s.courseId) || null;
}

/** Your courses: the built-in ones plus any your group has played, newest first, using the
 *  copy from your last round there (so a par or handicap you fixed sticks). */
function yourCourses(played) {
  const out = [];
  for (const c of played) {
    const built = COURSES.find((b) => b.id === c.id);
    out.push({
      ...(built || {}), ...c,
      tees: c.tees?.length ? c.tees : built?.tees || (c.tee ? [c.tee] : []),
      source: built ? 'builtin' : 'yours',
      lastSource: c.source || null,
    });
  }
  for (const b of COURSES) if (!out.some((c) => c.id === b.id)) out.push({ ...clone(b), source: 'builtin' });
  return out;
}

const SOURCE_LABEL = {
  builtin: 'checked against the card',
  yours: 'from your last round there',
  opengolfapi: 'from OpenGolfAPI',
  manual: 'entered by you',
};

/** Start fetching a course's scorecard in the background. */
async function loadCourse(app, ogaId) {
  const s = app.setup;
  try {
    const full = await cd.fetchCourse(ogaId);
    if (app.setup !== s || s.course?.ogaId !== ogaId) return;
    s.course = { ...full, name: s.course.name || full.name, shortName: s.course.shortName || full.shortName };
    s.courseStatus = 'ready';
  } catch {
    if (app.setup !== s || s.course?.ogaId !== ogaId) return;
    s.courseStatus = 'error';
  }
  persist(s);
  app.render();
}

/** Update just the course list (so typing in the search box isn't interrupted). */
function paintCourses(app) {
  const el = document.getElementById('course-results');
  if (el && app.setup) el.innerHTML = courseList(app.setup);
  else app.render();
}

function courseRow(c, act, val, extra = '') {
  const nine = c.par != null && !Array.isArray(c.par) && c.par < 50;
  const bits = [c.location || [c.city, c.state].filter(Boolean).join(', '), cd.fmtMiles(c.distance), nine ? '9 holes · not yet' : extra].filter(Boolean);
  return `<button class="course-opt" data-act="${act}" data-v="${esc(val)}" ${nine ? 'disabled' : ''}>
    <div class="row-title">${esc(c.name)}</div><div class="detail">${esc(bits.join(' · '))}</div></button>`;
}

function mineRows(list, here) {
  return cd.sortByDistance(list.map((c) => ({ ...c, distance: null })), null)
    .map((c) => courseRow({ ...c, distance: here && c.lat != null ? cd.distanceMi(here, c) : null }, 'setup-mine', c.id, c.source === 'builtin' ? 'checked' : 'played before'))
    .join('');
}

/** Course search found nothing (designspec §6b): say what didn't match, offer near misses, and the way out. */
function noResults(s, q, mine) {
  const dym = cd.didYouMean(q, [...mine, ...(s.near || [])]);
  const sub = (c) => {
    const n = c.plays || 0;
    const holes = Array.isArray(c.par) ? `${c.par.length} holes` : '';
    return [n ? `Played ${n} time${n === 1 ? '' : 's'}` : c.location || '', cd.fmtMiles(c.distance), holes].filter(Boolean).join(' · ');
  };
  const rows = dym.map((c) => `<div class="dym-row"><span class="dr-main"><span class="dr-name">${esc(c.name)}</span><span class="dr-sub">${esc(sub(c))}</span></span>
      <button class="btn" data-act="${c.ogaId && !c.plays && c.source !== 'builtin' ? 'setup-pick' : 'setup-mine'}" data-v="${esc(c.ogaId && !c.plays && c.source !== 'builtin' ? c.ogaId : c.id)}">Pick</button></div>`).join('');
  return `<!--none-->${empty({ icon: 'search', headline: `No courses match \u201c${q}\u201d`, help: 'Check the spelling, or add the course yourself. It takes about a minute.' })}
    ${rows ? `<div class="ts-label dym-k">Did you mean</div><div class="dym-list">${rows}</div>` : ''}
    <div class="dym-foot"><button class="btn big block" data-act="setup-manual">Enter the scorecard yourself</button></div>
    <p class="meta attrib">Course data ${esc(cd.ATTRIBUTION)}</p>`;
}

/** The list under the search box: results while searching, else your courses + near you. */
function courseList(s) {
  const q = (s.q || '').trim();
  const mine = s.mine.length ? s.mine : yourCourses([]);
  const mineIds = new Set(mine.map((c) => c.ogaId).filter(Boolean));
  if (q.length >= 2) {
    const ql = q.toLowerCase();
    const myHits = mine.filter((c) => `${c.name} ${c.shortName || ''}`.toLowerCase().includes(ql));
    const api = (s.results || []).filter((r) => !mineIds.has(r.ogaId));
    const body = s.searching && !s.results
      ? '<p class="meta">Searching…</p>'
      : s.searchError
        ? `<p class="meta">${esc(s.searchError)}</p><button class="btn small" data-act="setup-search-retry">Try again</button>`
        : !myHits.length && !api.length
          ? noResults(s, q, mine)
          : '';
    if (body.startsWith('<!--none-->')) return body; // no results: its own layout (empty state, did you mean, the way out)
    return `<div class="stack">${mineRows(myHits, s.loc)}${api.map((r) => courseRow(r, 'setup-pick', r.ogaId)).join('')}</div>${body}${listFoot(s)}`;
  }
  // At the course (or right next to it): it goes on top, ready to tap.
  const here = hereCourses(s, mine);
  const hereIds = new Set(here.map((c) => c.ogaId || c.id));
  let near;
  switch (s.nearStatus) {
    case 'locating': near = '<p class="meta">Finding where you are…</p>'; break;
    case 'loading': near = '<p class="meta">Looking for courses near you…</p>'; break;
    case 'denied': near = `<div class="loc-help"><p class="meta" style="margin:0 0 6px">Your phone is blocking location for this site. Search by name above, or turn it on:</p>
      <ol class="meta">${/iPhone|iPad|iPod/.test(navigator.userAgent)
        ? '<li>Settings \u2192 Privacy &amp; Security \u2192 Location Services \u2192 <b>Safari Websites</b> \u2192 While Using the App</li><li>In Safari, tap <b>aA</b> in the address bar \u2192 Website Settings \u2192 Location \u2192 Allow</li>'
        : '<li>Turn on location for your browser in your phone\u2019s settings</li><li>Allow location for this site (the icon by the address)</li>'}</ol>
      <button class="btn small" data-act="setup-near">Try again</button></div>`; break;
    case 'noloc': near = '<p class="meta">Couldn\u2019t get your location (weak GPS indoors, maybe).</p><button class="btn small" data-act="setup-near">Try again</button>'; break;
    case 'unavailable': near = '<p class="meta">This phone can\u2019t share its location here. Search by name instead.</p>'; break;
    case 'error': near = '<p class="meta">Couldn\u2019t reach course search. Check your signal.</p><button class="btn small" data-act="setup-near">Try again</button>'; break;
    case 'ok': {
      const rows = (s.near || []).filter((r) => !mineIds.has(r.ogaId) && !hereIds.has(r.ogaId));
      near = rows.length ? `<div class="stack">${rows.map((r) => courseRow(r, 'setup-pick', r.ogaId)).join('')}</div>` : '<p class="meta">No courses within 25 miles. Search by name instead.</p>';
      break;
    }
    default: near = '<button class="btn block" data-act="setup-near">Find courses near me</button>';
  }
  const mineLeft = mine.filter((c) => !hereIds.has(c.ogaId || c.id));
  const top = here.length
    ? `<div class="micro" style="margin:0 0 8px">${here.length > 1 ? 'Looks like you\u2019re at one of these' : 'Looks like you\u2019re at'}</div>
      <div class="stack here-list">${here.map((c) => (c.mine
        ? courseRow(c, 'setup-mine', c.id, c.source === 'builtin' ? 'checked' : 'played before')
        : courseRow(c, 'setup-pick', c.ogaId))).join('')}</div>`
    : '';
  const yours = mineLeft.length
    ? `<div class="micro" style="margin:${top ? 18 : 0}px 0 8px">Your courses</div><div class="stack">${mineRows(mineLeft, s.loc)}</div>`
    : '';
  return `${top}${yours}
    <div class="micro" style="margin:18px 0 8px">Near you</div>${near}${listFoot(s)}`;
}

const HERE_MI = 1; // course coordinates are usually the clubhouse; a mile covers being out on the course

/** Courses you're standing at (≤ HERE_MI away), nearest first, at most 3; your copy wins. */
export function hereCourses(s, mine) {
  if (!s.loc) return [];
  const out = new Map();
  for (const c of mine) {
    const d = c.lat != null ? cd.distanceMi(s.loc, c) : null;
    if (d != null && d <= HERE_MI) out.set(c.ogaId || c.id, { ...c, distance: d, mine: true });
  }
  if (s.nearStatus === 'ok') {
    for (const r of s.near || []) {
      if (r.distance == null || r.distance > HERE_MI || out.has(r.ogaId)) continue;
      const yours = mine.find((c) => c.ogaId && c.ogaId === r.ogaId); // your checked copy beats the API's
      out.set(r.ogaId, yours ? { ...yours, distance: r.distance, mine: true } : r);
    }
  }
  return [...out.values()].sort((a, b) => a.distance - b.distance).slice(0, 3);
}

function listFoot() {
  return `<p class="meta attrib">Course data ${esc(cd.ATTRIBUTION)}</p>
    <div class="nr-manual-wrap"><button class="nr-manual" data-act="setup-manual">Can\u2019t find it? <span>Enter the scorecard yourself</span></button></div>`;
}

function teamName(s, id) {
  const t = s.teams.find((x) => x.id === id);
  return (t?.name || '').trim() || `Cart ${id}`;
}
function teamsUsed(s) {
  return cartIds(s).filter((id) => s.players.some((p) => p.teamId === id));
}
function hasFullTeams(s) {
  return cartIds(s).every((id) => s.players.filter((p) => p.teamId === id).length === 2) && s.players.every((p) => p.teamId);
}

function problems(s) {
  const out = [];
  const c = course(s);
  if (!c) out.push('Pick a course.');
  else if (s.courseStatus === 'loading') out.push('Still getting the scorecard\u2026');
  else {
    if (c.variants?.length > 1 && !c.variant) out.push(`This club has ${c.variants.length} courses: pick which one.`);
    if (c.source === 'manual' && !(c.name || '').trim()) out.push('Name the course (Scorecard check).');
    out.push(...cd.scorecardProblems(c));
  }
  if (!s.players.length) out.push('Add the players.');
  const keys = s.players.map((p) => names.nameKey(p));
  if (new Set(keys).size !== keys.length) out.push('Two players have the same name.');
  const noLast = s.players.filter((p) => !p.lastName);
  if (noLast.length) out.push(`Add a last name for ${noLast.map((p) => p.firstName).join(', ')} (on Players).`);
  for (const p of s.players.filter((x) => x.needsNick && !x.nickname)) {
    out.push(`Someone else is already called ${names.fullName(p)}. Add a nickname for them (on Players).`);
  }
  if (s.game !== 'scorecard' && gameFix(s.game, s.players.length)) out.push(`${GAMES.find((g) => g.id === s.game).name}: ${gameFix(s.game, s.players.length)}`);
  if (gameOf(s) === 'carts' && !hasFullTeams(s)) out.push('Put 2 players in each cart.');
  return out;
}

/** Problems that live on the scorecard (send them to the Scorecard check). */
function cardProblem(s) {
  const c = course(s);
  return !!c && (c.variants?.length > 1 && !c.variant ? 'which' : cd.scorecardProblems(c).length || (c.source === 'manual' && !(c.name || '').trim()) ? 'check' : null);
}

function buildRound(s) {
  const c = course(s);
  const game = gameOf(s);
  const shown = names.displayNames(s.players);
  const three = game === 'carts' && s.players.length === 6; // 3 carts: everyone plays everyone, all 18
  const rotation = three ? threeCartRotation() : game === 'carts' ? cartRotation(s.schedule, s.opps) : clone(DEFAULT_ROTATION);
  const groupOfTeam = three ? { A: 'g1', B: 'g1', C: 'g2' } : {};
  if (!three) rotation[0].matches.forEach((m, i) => m.forEach((t) => (groupOfTeam[t] = `g${i + 1}`)));
  const auto = autoGroups(s.players.length);
  const players = s.players.map((p, i) => ({
    id: `p${i + 1}`, personId: p.personId || db.uuid(), name: shown[i],
    firstName: p.firstName, lastName: p.lastName || '', ...(p.nickname ? { nickname: p.nickname } : {}),
    teamId: game === 'carts' ? p.teamId : null,
    groupId: game === 'carts' ? groupOfTeam[p.teamId] : game === '2v2' ? 'g1' : `g${auto[i] + 1}`,
    strokes: p.strokes === '' || p.strokes == null || Number.isNaN(Number(p.strokes)) ? null : Math.max(0, Math.round(Number(p.strokes))),
  }));
  const nGroups = Math.max(...players.map((p) => Number(p.groupId.slice(1))));
  const teams = game === 'carts' ? cartIds(s).map((id) => ({ id, name: teamName(s, id).slice(0, 20) })) : [];
  const base = { ...s.settings };
  const settings = game === 'carts'
    ? { ...base, solo: false, pairs: false, rotation, ...(three ? { rotationMode: 'fixed' } : {}) }
    : game === '2v2'
      ? { ...base, game: 'rotationMatch', solo: false, pairs: true, pairSwitch: s.pairSwitch, rotationMode: 'fixed', rotation }
      : game === 'match'
        ? { ...base, game: 'rotationMatch', solo: true, pairs: false, rotationMode: 'fixed', rotation }
        : { ...base, game: 'none', solo: false, pairs: false, rotationMode: 'fixed', rotation };
  const { variants, variant, ...cleanCourse } = c;
  return {
    name: s.name.trim() || `${c.shortName || cd.shortCourseName(c.name)} · ${prettyDate(todayISO())}`,
    course: {
      id: cleanCourse.id, ...(c.ogaId ? { ogaId: c.ogaId } : {}), source: c.source === 'yours' ? c.lastSource || 'yours' : c.source || 'builtin',
      name: c.name.trim(), shortName: c.shortName || cd.shortCourseName(c.name), location: c.location || '',
      ...(c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : {}),
      tee: s.tee, tees: (c.tees || []).map((t) => ({ name: t.name, yards: t.yards ?? null, rating: t.rating ?? null, slope: t.slope ?? null })),
      par: c.par.map(Number), strokeIndex: c.strokeIndex.map(Number),
    },
    roster: { groups: Array.from({ length: nGroups }, (_, i) => ({ id: `g${i + 1}`, name: `Group ${i + 1}` })), teams, players },
    settings,
    playedOn: todayISO(),
    crewId: s.crewId,
  };
}

// ───────────────────────────────────────────── screens (designspec §6)

/** Back target for each screen. */
const BACK = { which: 'course', players: 'course', check: 'players', game: 'players', teams: 'game', matchups: 'teams' };
const BACK_LABEL = { course: 'Course', players: 'Players', game: 'Game', teams: s => (s.game === 'carts' ? 'Carts' : 'Partners') };

/** Progress bars: how far along the flow this screen is (2–4 bars depending on the game). */
function progress(s) {
  const flow = ['course', 'players', 'game', ...(s.game === '2v2' ? ['teams'] : s.game === 'carts' ? ['teams', 'matchups'] : [])];
  const at = Math.max(0, flow.indexOf(s.screen === 'which' ? 'course' : s.screen === 'check' ? 'players' : s.screen));
  return `<div class="nr-bars">${flow.map((_, i) => `<i class="${i <= at ? 'on' : ''}"></i>`).join('')}</div>`;
}

function topBar() {
  return ''; // the step's back button lives in the app's top bar (topBack below)
}

let curState = null; // the setup being drawn (for the progress bars in each headline)
function headline(kicker, title, sub = '') {
  return `<div class="nr-head"><div class="nr-k"><span class="lbl">${kicker}</span></div><h1 class="nr-title">${title}</h1>${sub ? `<div class="nr-sub">${sub}</div>` : ''}</div>`;
}

/** The screen's one primary button. busy = loading state (spinner before the label, still the same width). */
function bottom(label, act, { disabled = false, busy = false, v = '', arrow = false } = {}) {
  return `<div class="nr-foot"><button class="btn primary nr-cta" data-act="${act}"${v ? ` data-v="${esc(v)}"` : ''} ${disabled ? 'disabled' : ''}${busy ? ' aria-busy="true"' : ''}>${esc(label)}${arrow ? icon('fwd', 18) : ''}</button></div>`;
}

/** One line for the picked course's card: "✓ Card ready · par 72 · tap to check". */
function cardLine(s, c) {
  if (s.courseStatus === 'loading') return { cls: '', text: 'Getting the scorecard…' };
  if (s.courseStatus === 'error') return { cls: 'warn', text: 'Couldn’t get the scorecard · tap to fill it in' };
  if (c.variants?.length > 1 && !c.variant) return { cls: 'warn', text: `This club has ${c.variants.length} courses · tap to pick one` };
  if (c.source === 'manual' && !(c.par || []).some(Boolean)) return { cls: 'warn', text: 'Enter the scorecard · tap to start' };
  const issues = cd.scorecardProblems(c);
  if (issues.length) return { cls: 'warn', text: `${issues.length} thing${issues.length === 1 ? '' : 's'} to fix on the card · tap to check` };
  return { cls: 'good', text: `✓ Card ready · par ${c.par.reduce((a, b) => a + b, 0)} · tap to check` };
}

function courseView(s) {
  return `${topBar(s)}${headline('Step 1 · Course', s.from ? 'Run it back: where to?' : 'Where are you playing?')}
    <label class="nr-search">${icon('search', 20)}<input class="course-q" id="course-q" type="search" placeholder="Search courses by name" value="${esc(s.q)}" autocomplete="off" autocapitalize="words" enterkeyhint="search" aria-label="Search courses by name" data-input="setup-q"></label>
    <div id="course-results" class="nr-fill">${courseList(s)}</div>`;
}

/** ①a This club has 2 courses. Which one are you playing? */
function whichView(s) {
  const c = course(s);
  const vs = c?.variants || [];
  return `${topBar(s)}
    <div class="nr-head"><div class="lbl">${esc(c?.name || '')}${c?.location ? ` · ${esc(c.location)}` : ''}</div>
      <h1 class="nr-title which">This club has ${vs.length} courses. Which one are you playing?</h1>
      <div class="nr-sub">Not sure? Match holes 1 and 18 to the paper card.</div></div>
    ${vs.map((v) => {
      const on = s.which === v.n;
      return `<div class="which-opt${on ? ' on' : ''}">
        <button class="which-pick" data-act="setup-which" data-v="${v.n}" aria-pressed="${on}">
          <span class="radio"></span>
          <span style="flex:1;min-width:0"><span class="spread"><b>${esc(v.label)}</b><span class="mono soft">par ${v.parTotal}</span></span>
          <span class="mono soft wsub">Hole 1 par ${v.par[0]} · Hole 18 par ${v.par[17]}</span>${v.named ? '<span class="meta">Named on the course listing</span>' : ''}</span>
        </button>
        ${on && !v.named ? `<div class="which-name"><label for="which-name">This one has no name yet. What’s it called?</label>
          <input class="input" id="which-name" maxlength="20" placeholder="e.g. East" value="${esc(s.whichName || '')}" autocapitalize="words" data-input="setup-whichname">
          <div class="meta">Optional. Next time your group sees it by this name.</div></div>` : ''}
      </div>`;
    }).join('')}
    <div class="nr-note">${icon('redo', 16)}<span>We’ll remember this. Next time the club shows as separate picks: ${vs.map((v) => `<b>${esc(c.shortName || c.name)} · ${esc(v.label)}</b>`).join(' and ')}.</span></div>
    ${bottom(s.which ? 'Next: players' : 'Pick one to continue', 'setup-which-done', { disabled: !s.which, arrow: true })}`;
}

/** ② Who's playing? */
function playersView(s) {
  const c = course(s);
  const line = c ? cardLine(s, c) : null;
  const used = new Set(s.players.map((p) => p.personId));
  const recent = s.past.filter((p) => !used.has(p.personId)).slice(0, 8);
  const tee = s.tee ? ` · ${s.tee.name} tees` : '';
  return `${topBar(s)}${headline('Step 2 · Players', 'Who’s playing?')}
    ${c ? `<div class="nr-course">
      <button class="nc-main" data-act="setup-go" data-v="${c.variants?.length > 1 && !c.variant ? 'which' : 'check'}">
        <b class="ellipsis">${esc(c.shortName || c.name || 'Your course')}${esc(tee)}</b>
        <span class="nc-line ${line.cls}">${line.cls === '' && s.courseStatus === 'loading' ? '<span class="spinner tiny" aria-hidden="true"></span>' : ''}${esc(line.text)}</span>
      </button>
      <button class="btn small" data-act="setup-unpick">Change</button></div>` : ''}
    <div class="pl-head"><span class="lbl">Players · ${s.players.length}</span><span class="lbl pl-hcp">Hcp</span><span class="pl-x"></span></div>
    <div class="pl-list">
      ${s.players.map((p, i) => `<div class="player-row">
        <span class="pname">${p.lastName && !p.needsNick
          ? `<span class="ellipsis" style="display:block">${esc(p.name)}</span>`
          : `<span class="ellipsis" style="display:block">${esc(p.name)}</span>${p.lastName
            ? `<input class="input name-fill" maxlength="24" placeholder="Nickname, e.g. Tini Ryno" value="${esc(p.nickname)}" aria-label="Nickname for ${esc(p.name)}" data-input="setup-nick" data-i="${i}">`
            : `<input class="input name-fill" maxlength="30" placeholder="Last name" autocapitalize="words" autocomplete="off" aria-label="Last name for ${esc(p.firstName)}" data-input="setup-last" data-i="${i}">`}`}
        </span>
        <input class="hcp-pill mono${p.strokes === '' || p.strokes == null ? ' empty' : ''}" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="Add" aria-label="${esc(p.name)} handicap (strokes)" value="${esc(p.strokes ?? '')}" data-input="setup-strokes" data-i="${i}">
        <button class="x" data-act="setup-remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">${icon('close', 18)}</button>
      </div>`).join('')}
      <div class="pl-add join-row">
        <input class="input" id="new-player" maxlength="48" placeholder="Add a name (first and last)" value="${esc(s.newName)}" autocapitalize="words" autocomplete="off" data-input="setup-newname" data-enter="setup-add">
        <button class="btn primary" data-act="setup-add"${s.nickAsk ? ' disabled' : ''}>Add</button>
      </div>
    </div>
    ${s.nickAsk ? `<div class="card nick-ask">
      <p class="meta" style="margin:0 0 8px">Someone named ${esc(s.nickAsk.first)} ${esc(s.nickAsk.last)} already plays in another crew. Someone new? Add a nickname so they’re their own player.</p>
      <div class="join-row"><input class="input" id="new-nick" maxlength="24" placeholder="Nickname, e.g. Tini Ryno" autocapitalize="words" autocomplete="off" data-enter="setup-add">
        <button class="btn primary" data-act="setup-add">Add</button></div>
      <button class="link-btn" style="margin-top:8px" data-act="setup-nick-cancel">Cancel</button>
    </div>` : ''}
    ${recent.length ? `<div class="pl-recent"><span class="lbl">Recent</span>${recent.map((p) => `<button class="chip-o" data-act="setup-past" data-v="${esc(p.personId)}">+ ${esc(p.firstName || p.name)}</button>`).join('')}</div>` : ''}
    <p class="meta pl-help">Only first names show during the round. Hcp = strokes they get (blank = plays even).</p>
    ${bottom('Next: pick a game', 'setup-go', { v: 'game', disabled: !s.players.length || !!s.nickAsk, arrow: true })}`;
}

/** ③ Pick a game (availability by player count). */
function gameView(s) {
  const n = s.players.length;
  const pick = gameOf(s);
  const maxLbl = { doublePar: 'Double par', netDoubleBogey: 'Net double bogey', none: 'None' }[s.settings.maxHoleScore] || 'Double par';
  const next = pick === '2v2' || pick === 'carts';
  return `${topBar(s)}${headline(`Step 3 · Game · ${n} player${n === 1 ? '' : 's'}`, 'Pick a game', 'Games that don’t fit your player count are greyed out.')}
    <div class="game-list">${GAMES.map((g) => {
      const fix = gameFix(g.id, n);
      const on = g.id === pick;
      return `<button class="game-opt${on ? ' on' : ''}" data-act="setup-game" data-v="${g.id}" ${fix ? 'aria-disabled="true"' : ''} aria-pressed="${on}">
        <span class="radio"></span>
        <span style="flex:1;min-width:0"><span class="spread"><b>${esc(g.name)}</b><span class="mono g-count">${g.count}</span></span>
        <span class="g-desc">${esc(n === 6 && g.desc6 ? g.desc6 : g.desc)}</span>${fix ? `<span class="g-fix">${esc(fix)}</span>` : ''}</span>
      </button>`;
    }).join('')}</div>
    <button class="nr-row" data-act="setup-max"><span style="flex:1">Max score per hole</span><b>${maxLbl}</b>${icon('fwd', 16)}</button>
    ${pick === 'match' ? '<p class="meta nr-hint">Match play: everyone plays their own ball. Each hole is worth 1 point; low net score takes it, a tie for low splits it.</p>' : ''}
    <div class="nr-foot">
      ${next ? '' : '<p class="meta" style="text-align:center;margin:0 0 8px">2v2 and Partner “Rider” Cup go to one more screen to set teams.</p>'}
      <button class="btn primary nr-cta" data-act="${next ? 'setup-go' : 'setup-save'}" ${next ? 'data-v="teams"' : ''} ${s.saving ? 'aria-busy="true"' : ''}>${s.saving ? 'Starting…' : next ? `Next: ${pick === '2v2' ? 'pick partners' : 'carts'}` : `Start round · ${n} player${n === 1 ? '' : 's'}`}${next ? icon('fwd', 18) : ''}</button>
    </div>`;
}

const SWITCH_TIP = {
  never: 'Same partner all 18. Pick <b>every 6</b> and everyone partners with everyone once.',
  six: 'New partner every 6 holes: everyone partners with everyone once. Nobody changes groups.',
  turn: 'New partner at the turn. Nobody changes groups.',
};

function rulesSummary(s) {
  const st = s.settings;
  const parts = [];
  if (s.game === 'carts') parts.push(st.game === 'rotationPlusMinus' ? 'Plus/Minus' : st.game === 'none' ? 'No game' : 'Match play');
  parts.push({ bestBallAggregate: 'Low ball + total', bestBall: 'Best ball', aggregate: 'Aggregate' }[st.teamScore] || 'Low ball + total');
  parts.push({ doublePar: 'double par max', netDoubleBogey: 'net double bogey max', none: 'no max' }[st.maxHoleScore] || 'double par max');
  if (st.game !== 'rotationPlusMinus') parts.push(Number(st.halvedHolePoints) ? '½ ties' : 'no points for ties');
  if (st.game !== 'rotationPlusMinus' && Number(st.matchBonus ?? 1)) parts.push(`+${st.matchBonus ?? 1} win`);
  return parts.join(' · ');
}

function rulesBlock(s) {
  const st = s.settings;
  const pm = st.game === 'rotationPlusMinus';
  return `<div class="nr-rules${s.rulesOpen ? ' open' : ''}">
    <button class="nr-row" data-act="setup-rules" aria-expanded="${!!s.rulesOpen}"><span style="flex:1;min-width:0"><b class="rt">Rules</b><span class="rs ellipsis">${esc(rulesSummary(s))}</span></span>${icon('fwd', 18)}</button>
    ${s.rulesOpen ? `<div class="rules-body">
      ${s.game === 'carts' ? `<div class="field"><span class="label">Game</span>${seg('setup-set', [['rotationMatch', 'Match play'], ['rotationPlusMinus', 'Plus/Minus'], ['none', 'None']], st.game, 'data-k="game"')}</div>` : ''}
      ${st.game !== 'none' ? `<div class="field"><span class="label">Team score</span>${seg('setup-set', [['bestBallAggregate', 'Low ball + total'], ['bestBall', 'Best ball'], ['aggregate', 'Aggregate']], st.teamScore, 'data-k="teamScore"')}</div>` : ''}
      <div class="field"><span class="label">Max hole score</span>${seg('setup-set', [['doublePar', 'Double par'], ['netDoubleBogey', 'Net dbl bogey'], ['none', 'None']], st.maxHoleScore, 'data-k="maxHoleScore"')}</div>
      ${!pm && st.game !== 'none' ? `<div class="field"><span class="label">Ties</span>${seg('setup-set', [['0.5', '½ each'], ['0', 'Nothing']], String(st.halvedHolePoints), 'data-k="halvedHolePoints"')}</div>
      <div class="field"><span class="label">Matchup win bonus</span>${seg('setup-set', [['1', '+1 point'], ['0', 'None']], String(st.matchBonus ?? 1), 'data-k="matchBonus"')}</div>` : ''}
      ${pm ? `<div class="field"><span class="label">Max swing per rotation</span>${seg('setup-set', [['', 'Uncapped'], ['3', '3'], ['5', '5']], st.plusMinusCap == null ? '' : String(st.plusMinusCap), 'data-k="plusMinusCap"')}</div>` : ''}
      <div class="chips"><button class="pill" data-act="setup-toggle" data-k="par3NoMax" aria-pressed="${!!st.par3NoMax}"><span class="dot"></span>No max on par 3s</button>
      <button class="pill" data-act="setup-lowman" aria-pressed="${st.handicapMode === 'offLow'}"><span class="dot"></span>Play off the low man</button></div>
    </div>` : ''}
  </div>`;
}

/** Name button for swapping: tap one, then another, to trade places. */
function swapBtn(s, i, extra = '') {
  const p = s.players[i];
  return `<button class="swap-name${s.swapSel === i ? ' sel' : ''}" data-act="setup-swapsel" data-i="${i}" aria-pressed="${s.swapSel === i}"><span class="ellipsis">${esc(p.name)}</span>${extra}</button>`;
}

/** ④ 2v2: pick partners + when they switch. */
function pairsView(s) {
  const c = course(s);
  return `${topBar(s)}${headline('Step 4 · 2v2 setup', 'Pick partners', `2v2 · 4 players${c ? ` · ${esc(c.shortName || c.name)}` : ''}`)}
    <div class="pair-grid">
      <div class="pair-card me"><div class="pc-k mono">${s.pairSwitch === 'never' ? 'TEAM 1' : 'START · TEAM 1'}</div>${swapBtn(s, 0)}${swapBtn(s, 1)}</div>
      <div class="pair-card them"><div class="pc-k mono">${s.pairSwitch === 'never' ? 'TEAM 2' : 'START · TEAM 2'}</div>${swapBtn(s, 2)}${swapBtn(s, 3)}</div>
    </div>
    <div class="nr-line"><span class="meta">${s.swapSel != null ? 'Now tap who to swap with.' : 'Tap two names to swap partners.'}</span><button class="btn small" data-act="setup-shuffle">Shuffle</button></div>
    <div class="lbl nr-lbl">Switch partners</div>
    ${seg('setup-pairswitch', [['never', 'Never'], ['six', 'Every 6'], ['turn', 'At the turn']], s.pairSwitch)}
    <div class="nr-tip">${icon('bulb', 16)}<span>${SWITCH_TIP[s.pairSwitch]}</span></div>
    ${rulesBlock(s)}
    ${bottom(s.saving ? 'Starting…' : 'Start round · 2v2', 'setup-save', { busy: s.saving })}`;
}

const CART_TINT = { A: 'var(--cart-you)', B: 'var(--t-B)', C: 'var(--t-C)', D: 'var(--t-D)' };

/** ④ Partner “Rider” Cup: 8 players in 4 carts, or 6 in 3. */
function cartsView(s) {
  const c = course(s);
  const n = s.players.length;
  const ids = cartIds(s);
  const idx = (id) => s.players.map((p, i) => [p, i]).filter(([p]) => p.teamId === id).map(([, i]) => i);
  const sched = ids.length === 3 ? 'everyone plays everyone' : s.schedule === 'turn' ? '2 rotations' : '3 rotations';
  return `${topBar(s)}${headline('Step 4 · Partner “Rider” Cup', `${n} players, ${ids.length} carts`)}
    <div class="nr-course small"><div class="ellipsis" style="flex:1"><b>Partner “Rider” Cup</b> <span class="soft">· ${n} players${c ? ` · ${esc(c.shortName || c.name)}` : ''}</span></div><button class="btn small" data-act="setup-go" data-v="game">Change</button></div>
    <p class="meta nr-hint">${s.pairedFromLast ? 'Paired like your last round · ' : ''}Tap two names to swap.</p>
    <div class="cart-grid">${ids.map((id) => {
      const t = s.teams.find((x) => x.id === id);
      return `<div class="cart-card" style="--jersey:${CART_TINT[id]}">
        <div class="cc-k mono">CART ${id}</div>
        <input class="cc-name" maxlength="20" placeholder="Names itself on join" value="${esc(t.name)}" aria-label="Team name for cart ${id}" data-input="setup-teamname" data-v="${id}">
        ${idx(id).map((i) => swapBtn(s, i, s.players[i].strokes !== '' && s.players[i].strokes != null ? `<span class="mono soft">${esc(s.players[i].strokes)}</span>` : '')).join('')}
      </div>`;
    }).join('')}</div>
    <div class="nr-two"><button class="btn ghost" data-act="setup-shuffle">Shuffle carts</button><button class="btn ghost" data-act="setup-go" data-v="players">Edit players</button></div>
    <button class="nr-row" data-act="setup-go" data-v="matchups"><span style="flex:1;min-width:0"><b class="rt">Game &amp; matchups</b><span class="rs ellipsis">${esc(`${rulesSummary(s).split(' · ').slice(0, 2).join(' · ')} · ${sched}`)}</span></span><span class="meta">Optional</span>${icon('fwd', 18)}</button>
    ${bottom(s.saving ? 'Starting…' : `Start round · ${n} players`, 'setup-save', { busy: s.saving })}`;
}

/** ④b with 3 carts: nothing to switch; every matchup runs all 18. Rules only. */
function threeCartView(s) {
  const name = (id) => (id === 'A' ? 'A · You' : id);
  const chip = (id) => `<span class="mu-chip" style="--jersey:${CART_TINT[id]}">${name(id)}</span>`;
  const rows = threeCartRotation()[0].matches
    .map(([a, b]) => `<div class="mu-row"><span class="mono soft mu-h">1–18</span><span class="mu-m">${chip(a)}<small>vs</small>${chip(b)}</span></div>`).join('');
  return `${topBar(s)}${headline('Step 5 · Optional · Defaults are set', 'Game &amp; matchups')}
    <div class="nr-tip">${icon('bulb', 16)}<span>With 3 carts, every cart plays both other carts on every hole. Low ball and low total against each one, so a cart can win up to 4 points a hole.</span></div>
    <div class="lbl nr-lbl">Matchups</div>
    <div class="mu-card">${rows}<div class="mu-groups meta">1st tee time: A + B · 2nd: C, all 18. Nobody moves.</div></div>
    ${rulesBlock(s)}
    ${bottom(s.saving ? 'Starting…' : `Start round · ${s.players.length} players`, 'setup-save', { busy: s.saving })}`;
}

/** ④b Game & matchups (optional; defaults set). */
function matchupsView(s) {
  if (cartIds(s).length === 3) return threeCartView(s);
  const rot = cartRotation(s.schedule, s.opps);
  const opps = rot.map((r) => r.matches[0][1]);
  const uniq = new Set(opps).size;
  const tip = uniq === 3 ? `You face all 3 other carts: ${opps.join(', then ')}.` : `You face ${uniq} of the 3 other carts${uniq < opps.length ? ' (a repeat is fine)' : ''}.`;
  const when = s.schedule === 'turn' ? 'at the turn' : 'at holes 7 and 13';
  const fixed = s.settings.rotationMode !== 'swap';
  const name = (id) => (id === 'A' ? 'A · You' : id);
  const chip = (id) => `<span class="mu-chip" style="--jersey:${CART_TINT[id]}">${name(id)}</span>`;
  const rows = rot.map((r, i) => {
    const h = `${r.holes[0]}–${r.holes[1]}`;
    if (s.custom) {
      return `<div class="mu-row"><span class="mono soft mu-h">${h}</span><b class="good-ink">You vs</b>
        <span class="mu-picks">${['B', 'C', 'D'].map((k) => `<button class="mu-pick${k === opps[i] ? ' on' : ''}" style="--jersey:${CART_TINT[k]}" data-act="setup-opp" data-i="${i}" data-v="${k}" aria-pressed="${k === opps[i]}" aria-label="Holes ${h}: play cart ${k}">${k}</button>`).join('')}</span>
        <span class="mono soft mu-rest">${r.matches[1].join(' vs ')}</span></div>`;
    }
    return `<div class="mu-row"><span class="mono soft mu-h">${h}</span><span class="mu-m">${chip(r.matches[0][0])}<small>vs</small>${chip(r.matches[0][1])}</span><span class="mu-m">${chip(r.matches[1][0])}<small>vs</small>${chip(r.matches[1][1])}</span></div>`;
  }).join('');
  const g1 = rot[0].matches[0].join(' + '), g2 = rot[0].matches[1].join(' + ');
  const groupLine = fixed ? `1st tee time: ${g1} · 2nd: ${g2}, all 18. Nobody moves.` : `Each matchup plays as a foursome. Groups re-form ${when}.`;
  return `${topBar(s)}${headline('Step 5 · Optional · Defaults are set', 'Game &amp; matchups')}
    <div class="lbl nr-lbl">Switch opponents</div>
    ${seg('setup-schedule', [['six', 'Every 6 holes'], ['turn', 'At the turn']], s.schedule)}
    <div class="nr-hint meta">${esc(tip)}</div>
    <div class="lbl nr-lbl">On the course</div>
    ${seg('setup-move', [['fixed', 'Keep tee times'], ['swap', 'Play together']], fixed ? 'fixed' : 'swap')}
    <div class="nr-tip">${icon('bulb', 16)}<span>${fixed ? 'Groups never change. The app keeps score against your opponent in the other group. Best for pace of play.' : `Carts swap foursomes ${when} so you play next to your opponent. Both groups need to meet up.`}</span></div>
    <div class="nr-line"><span class="lbl" style="flex:1">Matchups</span><button class="btn small" data-act="setup-shuffle-mu">Shuffle</button><button class="btn small${s.custom ? ' primary' : ''}" data-act="setup-custom">${s.custom ? 'Done' : 'Custom'}</button></div>
    <div class="mu-card">${rows}<div class="mu-groups meta">${esc(groupLine)}</div></div>
    ${rulesBlock(s)}
    ${bottom(s.saving ? 'Starting…' : 'Start round · 8 players', 'setup-save', { busy: s.saving })}`;
}

/** Scorecard check: good / fix / entered by hand. Also tees, first tee and the round name. */
function checkView(s) {
  const c = course(s);
  if (!c) return courseView(s);
  if (s.courseStatus === 'loading') return `${topBar(s)}${headline(esc(c.name), 'Scorecard check')}<p class="meta"><span class="spinner tiny"></span> Getting the scorecard…</p>`;
  const manual = c.source === 'manual';
  const filled = (c.par || []).filter((p, i) => p != null && c.strokeIndex?.[i] != null).length;
  const issues = manual && filled < 18 ? [] : cd.scorecardProblems(c);
  const tone = manual && filled < 18 ? 'hand' : issues.length ? 'warn' : 'good';
  const par = (c.par || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const head = tone === 'good' ? `✓ All good · par ${par} · hole handicaps 1–18` : tone === 'warn' ? `${issues.length} thing${issues.length === 1 ? '' : 's'} to fix before you start` : `${filled} of 18 holes filled in`;
  const src = { builtin: 'Checked against the card', yours: 'From your group’s last round', opengolfapi: 'From course data', manual: 'Entered by you' }[c.source] || '';
  const used = s.mine.find((m) => m.id === c.id)?.rounds;
  const tags = [src, used ? `Used in ${used} round${used === 1 ? '' : 's'}` : '', c.source === 'opengolfapi' ? 'Not checked yet' : ''].filter(Boolean);
  const bad = new Set();
  if (issues.length) {
    (c.par || []).forEach((p, i) => { if (!(Number.isInteger(p) && p >= 3 && p <= 6)) bad.add(`p${i}`); });
    const si = c.strokeIndex || [];
    const seen = new Map();
    si.forEach((v, i) => { if (!(Number.isInteger(v) && v >= 1 && v <= 18)) bad.add(`h${i}`); else seen.set(v, [...(seen.get(v) || []), i]); });
    for (const [, list] of seen) if (list.length > 1) list.forEach((i) => bad.add(`h${i}`));
  }
  const cell = (key, i, v, lo, hi, label) => `<input class="sck mono${bad.has(`${key === 'par' ? 'p' : 'h'}${i}`) ? ' bad' : v == null || v === '' ? ' empty' : ''}" inputmode="numeric" pattern="[0-9]*" maxlength="${String(hi).length}" value="${esc(v ?? '')}" placeholder="–" aria-label="Hole ${i + 1} ${label}" data-input="setup-sc${key === 'par' ? 'par' : 'si'}" data-i="${i}">`;
  const nine = (from) => {
    const idx = Array.from({ length: 9 }, (_, k) => from + k);
    const sum = idx.every((i) => c.par?.[i] != null) ? idx.reduce((a, i) => a + Number(c.par[i]), 0) : '–';
    return `<div class="sc-nine">
      <div class="sc-r"><span class="sc-l">Hole</span>${idx.map((i) => `<span class="sc-h mono">${i + 1}</span>`).join('')}<span class="sc-t">${from ? 'IN' : 'OUT'}</span></div>
      <div class="sc-r"><span class="sc-l b">Par</span>${idx.map((i) => cell('par', i, c.par?.[i], 3, 6, 'par')).join('')}<span class="sc-t mono b">${sum}</span></div>
      <div class="sc-r"><span class="sc-l b">Hcp</span>${idx.map((i) => cell('si', i, c.strokeIndex?.[i], 1, 18, 'handicap')).join('')}<span class="sc-t"></span></div>
    </div>`;
  };
  const ok = tone === 'good';
  return `${topBar(s)}${headline(`${esc(c.shortName || c.name)}${s.tee ? ` · ${esc(s.tee.name)} tees` : ''}${manual ? ' · entered by hand' : ''}`, 'Scorecard check')}
    ${manual ? `<input class="input" id="course-name" maxlength="60" placeholder="Course name" value="${esc(c.name)}" aria-label="Course name" data-input="setup-cname" style="margin:0 0 10px">` : ''}
    <div class="sc-status ${tone}">
      <div class="sc-head">${esc(head)}</div>
      ${issues.map((x) => `<div class="sc-issue"><b>•</b><span>${esc(x)}</span></div>`).join('')}
      <div class="sc-tags">${tags.map((t) => `<span class="mono">${esc(t)}</span>`).join('')}</div>
    </div>
    ${nine(0)}${nine(9)}
    <p class="meta nr-hint">${ok ? 'Tap any number to change it. The organizer can also fix a hole mid-round from Host.' : 'Copy from the paper card. Hcp is the “Handicap” row: 1 is the hardest hole, 18 the easiest, each used once.'}</p>
    ${c.source === 'opengolfapi' || c.lastSource === 'opengolfapi' ? `<p class="meta attrib">Course data ${esc(cd.ATTRIBUTION)}</p>` : ''}
    ${c.tees?.length ? `<div class="lbl nr-lbl">Tees</div><div class="chips">${c.tees.map((t) => `<button class="chip" data-act="setup-tee" data-v="${esc(t.name)}" aria-pressed="${s.tee?.name === t.name}">${esc(t.name)}${t.yards ? ` <span class="soft mono" style="font-size:13px">${t.yards}</span>` : ''}</button>`).join('')}</div>` : ''}
    <div class="lbl nr-lbl">First tee</div>${seg('setup-set', [['1', 'Hole 1'], ['10', 'Hole 10']], String(s.settings.startHole || 1), 'data-k="startHole"')}
    <div class="field" style="margin-top:14px"><label for="round-name">Round name (optional)</label>
      <input class="input" id="round-name" maxlength="60" value="${esc(s.name)}" placeholder="${esc(`${c.shortName || cd.shortCourseName(c.name || '') || 'Round'} · ${prettyDate(todayISO())}`)}" data-input="setup-name"></div>
    ${bottom(ok ? 'Looks right' : tone === 'hand' ? `Save card · ${18 - filled} hole${18 - filled === 1 ? '' : 's'} left` : `Fix ${issues.length} thing${issues.length === 1 ? '' : 's'} to continue`, 'setup-go', { v: 'players', disabled: !ok })}`;
}

/** ⑤ Round is live. */
function savedView(s) {
  const v = s.saved;
  const c = course(s);
  const n = s.players.length;
  return `<div class="live-top"><div class="live-check">${icon('check', 28)}</div>
      <h1 class="nr-title">Round is live</h1>
      <div class="nr-sub">${esc([c?.shortName || c?.name, prettyDate(todayISO()), s.tee ? `${s.tee.name} tees` : '', `${n} player${n === 1 ? '' : 's'}`].filter(Boolean).join(' · '))}</div></div>
    <div class="saved-box">
      <div class="lbl">Join code</div><div class="big-code mono">${esc(v.code)}</div>
      <div class="mono meta live-link">${esc(roundLink(v.code).replace(/^https?:\/\//, ''))}</div>
      <div class="nr-two"><button class="btn primary" data-act="setup-copy" data-v="share">${icon('share', 18)} Text the group</button><button class="btn" data-act="setup-copy" data-v="link">Copy link</button></div>
    </div>
    <div class="saved-box secret">
      <div class="sec-k">${icon('lock', 16)} Organizer only · screenshot this, keep it private</div>
      <div class="sec-grid"><span class="soft">Admin PIN</span><span class="mono sec-pin">${esc(v.admin_pin)}</span>
        <span class="soft">Host link</span><span class="sec-link"><span class="mono ellipsis">${esc(roundLink(v.code, '/host').replace(/^https?:\/\//, ''))}</span><button class="btn small" data-act="setup-copy" data-v="host">Copy</button></span></div>
      <div class="meta">Lets you fix scores and the scorecard from any phone if this one dies.</div>
    </div>
    ${bottom('Open the round', 'setup-open')}`;
}

const VIEWS = { course: courseView, which: whichView, players: playersView, check: checkView, game: gameView, teams: (s) => (s.game === 'carts' ? cartsView(s) : pairsView(s)), matchups: matchupsView };


// ───────────────────────────────────────────── course search actions

let searchTimer = null;

async function runSearch(app) {
  const s = app.setup;
  const q = (s?.q || '').trim();
  if (!s || q.length < 2) return;
  s.searching = true;
  s.searchError = '';
  paintCourses(app);
  try {
    const rows = await cd.searchCourses(q, s.loc);
    if (app.setup !== s || s.q.trim() !== q) return;
    s.results = rows;
  } catch {
    if (app.setup !== s || s.q.trim() !== q) return;
    s.searchError = 'Couldn\u2019t reach course search. Check your signal.';
  }
  s.searching = false;
  paintCourses(app);
}

function findNear(app) {
  const s = app.setup;
  if (!navigator.geolocation) {
    s.nearStatus = 'unavailable';
    paintCourses(app);
    return;
  }
  s.nearStatus = 'locating';
  paintCourses(app);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      if (app.setup !== s) return;
      s.loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      s.nearStatus = 'loading';
      paintCourses(app);
      try {
        s.near = await cd.nearbyCourses(s.loc.lat, s.loc.lng);
        s.nearStatus = 'ok';
      } catch {
        s.nearStatus = 'error';
      }
      if (app.setup === s) paintCourses(app);
    },
    (err) => {
      if (app.setup !== s) return;
      s.nearStatus = err?.code === 1 ? 'denied' : 'noloc'; // 2 = position unavailable, 3 = timeout

      paintCourses(app);
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
  );
}

function pickCourse(app, c, status) {
  const s = app.setup;
  s.course = c;
  s.courseId = c.id;
  s.courseStatus = status;
  s.tee = c.tee && (c.tees || []).some((t) => t.name === c.tee.name) ? c.tee : null; // the tee your group played last time
  s.which = null;
  s.whichName = '';
  s.screen = c.variants?.length > 1 ? 'which' : c.source === 'manual' ? 'check' : 'players';
  persist(s);
  app.render();
  document.getElementById('content').scrollTop = 0;
}

/** Typing in the scorecard check on Save. */
function scoreCell(app, el, key, lo, hi) {
  const s = app.setup;
  const c = course(s);
  if (!c) return;
  const v = el.value.replace(/[^0-9]/g, '').slice(0, String(hi).length);
  if (v !== el.value) el.value = v;
  const n = v === '' ? null : Number(v);
  if (!s.course) s.course = clone(c);
  s.course[key][Number(el.dataset.i)] = n != null && n >= lo && n <= hi ? n : null;
  persist(s);
  app.render(); // shows after the box loses focus (typing isn't interrupted)
}

// ───────────────────────────────────────────── screen

export default {
  enter(app) {
    const from = app.route.from || null;
    if (app.setup && app.setup.from === from && !app.setup.saved) return;
    const draft = db.local.get(DRAFT_KEY);
    if (!from && draft && !draft.saved && (draft.players?.length || draft.courseId)) {
      const screen = VIEWS[draft.screen] ? draft.screen : draft.step ? 'players' : 'course';
      app.setup = { ...blank(null), ...draft, screen, saving: false, swapSel: null };
      const s = app.setup;
      s.players = (s.players || []).map(withName);
      s.nickAsk = null;
      if (!s.course && s.courseId) s.course = clone(COURSES.find((c) => c.id === s.courseId) || null);
      if (!s.course) { s.courseId = null; s.screen = 'course'; }
      if (s.courseStatus === 'loading' && s.course?.ogaId) loadCourse(app, s.course.ogaId);
    } else {
      app.setup = blank(from);
    }
    if (!app.setup.mine.length) app.setup.mine = yourCourses([]);
    if (from) loadFrom(app, from);
    else {
      const crew = db.recent.all().find((r) => r.crew_id)?.crew_id;
      loadPast(app, crew);
    }
  },

  mount(root, app) {
    const s = app.setup;
    if (!s || s.saved || s.screen !== 'course' || s.nearStatus !== 'idle' || s.autoNearTried) return;
    s.autoNearTried = true;
    // Look for nearby courses straight away (the course you're standing at goes on top). If the
    // site doesn't have location yet the phone asks once; blocked → the turn-it-on steps show.
    findNear(app);
  },

  topRight(app) {
    const s = app.setup;
    return s && !s.saved && s.screen !== 'check' && s.screen !== 'which' ? progress(s) : '';
  },

  topBack(app) {
    const s = app.setup;
    const back = s && !s.saved ? BACK[s.screen] : null;
    if (!back) return null;
    const label = typeof BACK_LABEL[back] === 'function' ? BACK_LABEL[back](s) : BACK_LABEL[back];
    return `<button class="back" data-act="setup-go" data-v="${back}">${icon('back', 22)}<span>${esc(label)}</span></button>`;
  },

  render(app) {
    const s = app.setup;
    if (!s) return '';
    relabel(s);
    curState = s;
    const body = s.saved ? savedView(s) : s.loadingFrom ? '<p class="meta" style="margin-top:20px">Copying the last round…</p>' : (VIEWS[s.screen] || courseView)(s, app);
    return `<div class="plain nr-setup">${body}</div>`;
  },

  actions: {
    'setup-q': (el, ev, app) => {
      const s = app.setup;
      s.q = el.value;
      clearTimeout(searchTimer);
      if (s.q.trim().length < 2) {
        s.results = null;
        s.searchError = '';
        paintCourses(app);
        return;
      }
      paintCourses(app); // your matching courses show right away
      searchTimer = setTimeout(() => runSearch(app), 350);
    },
    'setup-search-retry': (el, ev, app) => runSearch(app),
    'setup-near': (el, ev, app) => findNear(app),
    'setup-pick': (el, ev, app) => {
      const s = app.setup;
      const id = el.dataset.v;
      const row = [...(s.results || []), ...(s.near || [])].find((r) => r.ogaId === id);
      const built = cd.builtInFor(id);
      if (built) {
        pickCourse(app, { ...clone(built), source: 'builtin' }, 'ready');
        return;
      }
      if (!row) return;
      pickCourse(app, {
        id: `oga:${id}`, ogaId: id, name: row.name, shortName: cd.shortCourseName(row.name),
        location: [row.city, row.state].filter(Boolean).join(', '), lat: row.lat, lng: row.lng, tees: [],
        par: Array(18).fill(null), strokeIndex: Array(18).fill(null), holes: 18, source: 'opengolfapi',
      }, 'loading');
      loadCourse(app, id);
    },
    'setup-mine': (el, ev, app) => {
      const s = app.setup;
      const m = (s.mine.length ? s.mine : yourCourses([])).find((c) => c.id === el.dataset.v);
      if (!m) return;
      pickCourse(app, clone(m), 'ready');
    },
    'setup-manual': (el, ev, app) => {
      const s = app.setup;
      pickCourse(app, {
        id: `manual:${db.uuid()}`, name: (s.q || '').trim().slice(0, 60), shortName: '', location: '', tees: [],
        par: Array(18).fill(null), strokeIndex: Array(18).fill(null), holes: 18, source: 'manual',
      }, 'ready');
      setTimeout(() => document.getElementById('course-name')?.focus(), 50);
    },
    'setup-course-retry': (el, ev, app) => {
      const s = app.setup;
      if (!s.course?.ogaId) return;
      s.courseStatus = 'loading';
      app.render();
      loadCourse(app, s.course.ogaId);
    },
    'setup-cname': (el, ev, app) => {
      const s = app.setup;
      if (!s.course) return;
      s.course.name = el.value.slice(0, 60);
      s.course.shortName = cd.shortCourseName(s.course.name);
      persist(s);

    },
    'setup-scpar': (el, ev, app) => scoreCell(app, el, 'par', 3, 6),
    'setup-scsi': (el, ev, app) => scoreCell(app, el, 'strokeIndex', 1, 18),
    'setup-tee': (el, ev, app) => {
      const s = app.setup;
      const t = course(s)?.tees.find((x) => x.name === el.dataset.v) || null;
      s.tee = s.tee?.name === t?.name ? null : t;
      persist(s);
      app.render();
    },
    'setup-name': (el, ev, app) => {
      app.setup.name = el.value;
      persist(app.setup);
    },
    'setup-newname': (el, ev, app) => {
      const s = app.setup;
      s.newName = el.value;
      if (s.nickAsk) { // typed a different name: forget the nickname question
        const { first, last } = names.splitName(el.value);
        if (!same(first, s.nickAsk.first) || !same(last, s.nickAsk.last)) {
          s.nickAsk = null;
          app.render();
          const box = document.getElementById('new-player');
          if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        }
      }
    },
    'setup-add': async (el, ev, app) => {
      const s = app.setup;
      if (s.adding) return;
      const raw = document.getElementById('new-player')?.value ?? s.newName ?? '';
      const { first, last } = names.splitName(raw);
      if (!first) return;
      if (!last) {
        app.toast({ title: 'Add their last name too', sub: `e.g. ${first} Smith. Only first names show during the round.`, error: true });
        return;
      }
      const nick = s.nickAsk ? (document.getElementById('new-nick')?.value || '').trim().replace(/\s+/g, ' ').slice(0, 24) : '';
      if (s.nickAsk && !nick) {
        app.toast({ title: 'Add a nickname', sub: `Someone else is already called ${first} ${last}.`, error: true });
        return;
      }
      const inRound = s.players.find((p) => same(p.firstName, first) && same(p.lastName, last) && same(p.nickname, nick));
      if (inRound) {
        app.toast({ title: `${inRound.name} is already in`, error: true });
        return;
      }
      const free = (p) => !s.players.some((x) => x.personId === p.personId);
      // Someone from your crew: the same person (full name), or a crew-mate from before last names.
      let pick = s.past.find((p) => free(p) && same(p.firstName, first) && same(p.lastName, last) && same(p.nickname, nick)) || null;
      if (!pick && !nick) {
        const legacy = s.past.filter((p) => free(p) && same(p.firstName, first) && !p.lastName);
        if (legacy.length === 1) pick = legacy[0];
      }
      if (!pick) {
        s.adding = true;
        try {
          const r = await db.api.personNameCheck({ first, last, nickname: nick || null, crewId: s.crewId });
          if (r?.ok && r.taken) {
            if (r.crewMate && r.id) pick = { personId: r.id };
            else {
              s.adding = false;
              s.nickAsk = { first, last };
              s.newName = raw;
              app.render({ force: true }); // after the lookup, so it isn't a tap any more
              document.getElementById('new-nick')?.focus();
              return;
            }
          }
        } catch { /* offline: checked again on Save */ }
        s.adding = false;
      }
      if (pick?.crewId) s.crewId = s.crewId || pick.crewId;
      s.players.push(newPlayer({ personId: pick?.personId, firstName: first, lastName: last, nickname: nick }));
      s.newName = '';
      s.nickAsk = null;
      persist(s);
      app.render({ force: true });
      document.getElementById('new-player')?.focus();
    },
    'setup-nick-cancel': (el, ev, app) => {
      app.setup.nickAsk = null;
      app.render();
    },
    'setup-last': (el, ev, app) => {
      const p = app.setup.players[Number(el.dataset.i)];
      if (!p) return;
      p.lastName = names.splitName(`x ${el.value}`).last;
      p.needsNick = false;
      withName(p);
      persist(app.setup);
    },
    'setup-nick': (el, ev, app) => {
      const p = app.setup.players[Number(el.dataset.i)];
      if (!p) return;
      p.nickname = el.value.trim().replace(/\s+/g, ' ').slice(0, 24);
      withName(p);
      persist(app.setup);
    },
    'setup-past': (el, ev, app) => {
      const s = app.setup;
      const p = s.past.find((x) => x.personId === el.dataset.v);
      if (!p || s.players.some((x) => x.personId === p.personId)) return;
      s.crewId = s.crewId || p.crewId;
      s.players.push(newPlayer({ personId: p.personId, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname }));
      persist(s);
      app.render();
    },
    'setup-strokes': (el, ev, app) => {
      const v = el.value.replace(/[^0-9]/g, '').slice(0, 2);
      if (v !== el.value) el.value = v;
      app.setup.players[Number(el.dataset.i)].strokes = v;
      persist(app.setup);
    },
    'setup-teamname': (el, ev, app) => {
      app.setup.teams.find((t) => t.id === el.dataset.v).name = el.value.slice(0, 20);
      persist(app.setup);
    },
    'setup-set': (el, ev, app) => {
      const st = app.setup.settings;
      const k = el.dataset.k;
      let v = el.dataset.v;
      if (k === 'halvedHolePoints' || k === 'matchBonus') v = Number(v);
      if (k === 'plusMinusCap') v = v === '' ? null : Number(v);
      if (k === 'startHole') v = Number(v);
      st[k] = v;
      persist(app.setup);
      app.render();
    },
    'setup-toggle': (el, ev, app) => {
      const st = app.setup.settings;
      st[el.dataset.k] = !st[el.dataset.k];
      persist(app.setup);
      app.render();
    },
    'setup-lowman': (el, ev, app) => {
      const st = app.setup.settings;
      st.handicapMode = st.handicapMode === 'offLow' ? 'full' : 'offLow';
      persist(app.setup);
      app.render();
    },
    'setup-save': async (el, ev, app) => {
      const s = app.setup;
      if (s.saving) return;
      const issues = problems(s);
      if (issues.length) {
        const where = cardProblem(s);
        if (where) s.screen = where;
        else if (issues.some((x) => /name|player/i.test(x))) s.screen = 'players';
        app.render();
        app.toast({ title: 'Not ready yet', sub: issues[0], error: true });
        return;
      }
      s.saving = true;
      app.render();
      // Full names are one per person app-wide: a clash with a crew-mate is that person;
      // anyone else needs a nickname. (Offline / older database: skip, the server stays safe.)
      try {
        const checks = await Promise.all(s.players.map((p) => db.api.personNameCheck({
          first: p.firstName, last: p.lastName, nickname: p.nickname || null, crewId: s.crewId, personId: p.personId,
        }).catch(() => null)));
        let blocked = false;
        checks.forEach((r, i) => {
          const p = s.players[i];
          if (!r?.ok || !r.taken) return;
          if (r.crewMate && r.id && !s.players.some((x) => x.personId === r.id)) p.personId = r.id;
          else { p.needsNick = true; p.nickname = ''; withName(p); blocked = true; }
        });
        if (blocked) {
          s.saving = false;
          s.screen = 'players';
          persist(s);
          app.render();
          app.toast({ title: 'That name\u2019s taken', sub: 'Add a nickname on Players so they\u2019re their own player.', error: true });
          return;
        }
      } catch { /* keep going */ }
      let res;
      try {
        res = await db.api.createEvent(buildRound(s));
      } catch {
        s.saving = false;
        app.render();
        app.toast({ title: 'No signal', sub: 'The round isn’t saved yet. Try again.', error: true });
        return;
      }
      s.saving = false;
      if (!res.ok) {
        app.render();
        app.toast({ title: 'Couldn’t save', sub: res.error, error: true });
        return;
      }
      s.saved = res;
      db.admin.set(res.code, res.admin_pin);
      db.local.del(DRAFT_KEY);
      db.recent.remember({ code: res.code, name: buildRound(s).name, played_on: todayISO(), crew_id: res.crew_id, course: buildRound(s).course });
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'setup-copy': async (el, ev, app) => {
      const v = app.setup.saved;
      const link = el.dataset.v === 'host' ? roundLink(v.code, '/host') : roundLink(v.code);
      if (el.dataset.v === 'share' && navigator.share) {
        try {
          await navigator.share({ title: 'Golf Live Board', text: `Join code ${v.code}`, url: link });
          return;
        } catch { /* fall through to copy */ }
      }
      const ok = await copyText(link);
      app.toast({ title: ok ? 'Copied' : link });
    },
    'setup-open': (el, ev, app) => {
      const code = app.setup.saved.code;
      app.setup = null;
      app.go(`#/e/${code}/enter`);
    },
    'setup-go': (el, ev, app) => {
      const s = app.setup;
      const to = el.dataset.v;
      if (to === 'game' && !s.players.length) return;
      if (to === 'teams') {
        const g = gameOf(s);
        if (g !== s.game || (g !== '2v2' && g !== 'carts')) return;
        if (g === 'carts') ensureCarts(s);
      }
      if (to === 'matchups') ensureCarts(s);
      s.screen = to;
      s.swapSel = null;
      persist(s);
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'setup-unpick': (el, ev, app) => {
      const s = app.setup;
      s.course = null;
      s.courseId = null;
      s.courseStatus = 'idle';
      s.tee = null;
      s.screen = 'course';
      persist(s);
      app.render();
    },
    'setup-which': (el, ev, app) => {
      app.setup.which = Number(el.dataset.v);
      app.render();
    },
    'setup-whichname': (el, ev, app) => {
      app.setup.whichName = el.value.trim().slice(0, 20);
    },
    'setup-which-done': (el, ev, app) => {
      // The picked course of a multi-course club becomes its own course ("Bear Creek · East"),
      // saved with the round, so your group sees it as its own pick next time.
      const s = app.setup;
      const c = course(s);
      const v = c?.variants?.find((x) => x.n === s.which);
      if (!v) return;
      const label = (s.whichName || '').trim() || v.label;
      const club = c.shortName || cd.shortCourseName(c.name);
      s.course = {
        ...c, id: `${c.id.split('#')[0]}#${v.n}`, name: `${c.name} · ${label}`, shortName: `${club} · ${label}`,
        par: [...v.par], strokeIndex: [...v.strokeIndex], variant: v.n,
      };
      delete s.course.variants;
      s.courseId = s.course.id;
      s.screen = 'players';
      persist(s);
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'setup-remove': (el, ev, app) => {
      app.setup.players.splice(Number(el.dataset.i), 1);
      persist(app.setup);
      app.render();
    },
    'setup-game': (el, ev, app) => {
      const s = app.setup;
      const fix = gameFix(el.dataset.v, s.players.length);
      if (fix) {
        app.toast({ title: GAMES.find((g) => g.id === el.dataset.v).name, sub: fix });
        return;
      }
      s.game = el.dataset.v;
      persist(s);
      app.render();
    },
    'setup-max': (el, ev, app) => {
      const st = app.setup.settings;
      const order = ['doublePar', 'netDoubleBogey', 'none'];
      st.maxHoleScore = order[(order.indexOf(st.maxHoleScore) + 1) % order.length];
      persist(app.setup);
      app.render();
    },
    'setup-rules': (el, ev, app) => {
      app.setup.rulesOpen = !app.setup.rulesOpen;
      app.render();
    },
    'setup-pairswitch': (el, ev, app) => {
      app.setup.pairSwitch = el.dataset.v;
      persist(app.setup);
      app.render();
    },
    'setup-schedule': (el, ev, app) => {
      app.setup.schedule = el.dataset.v === 'turn' ? 'turn' : 'six';
      persist(app.setup);
      app.render();
    },
    'setup-move': (el, ev, app) => {
      app.setup.settings.rotationMode = el.dataset.v === 'swap' ? 'swap' : 'fixed';
      persist(app.setup);
      app.render();
    },
    'setup-custom': (el, ev, app) => {
      const s = app.setup;
      s.custom = !s.custom;
      if (!s.opps) s.opps = cartRotation(s.schedule).map((r) => r.matches[0][1]);
      app.render();
    },
    'setup-opp': (el, ev, app) => {
      const s = app.setup;
      s.opps = s.opps ? [...s.opps] : cartRotation(s.schedule).map((r) => r.matches[0][1]);
      while (s.opps.length < 3) s.opps.push(['B', 'C', 'D'][s.opps.length]);
      s.opps[Number(el.dataset.i)] = el.dataset.v;
      persist(s);
      app.render();
    },
    'setup-shuffle-mu': (el, ev, app) => {
      const s = app.setup;
      const a = ['B', 'C', 'D'];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      s.opps = a;
      persist(s);
      app.render();
    },
    'setup-swapsel': (el, ev, app) => {
      // Tap a name, then another: they trade places (2v2: partners; cart game: carts).
      const s = app.setup;
      const i = Number(el.dataset.i);
      if (s.swapSel == null) s.swapSel = i;
      else if (s.swapSel === i) s.swapSel = null;
      else {
        const j = s.swapSel;
        if (gameOf(s) === 'carts') [s.players[i].teamId, s.players[j].teamId] = [s.players[j].teamId, s.players[i].teamId];
        else [s.players[i], s.players[j]] = [s.players[j], s.players[i]];
        s.swapSel = null;
        persist(s);
      }
      app.render();
    },
    'setup-shuffle': (el, ev, app) => {
      const s = app.setup;
      const order = s.players.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      if (gameOf(s) === 'carts') order.forEach((pi, k) => { s.players[pi].teamId = cartIds(s)[Math.floor(k / 2)]; });
      else s.players = order.map((k) => s.players[k]);
      s.swapSel = null;
      s.pairedFromLast = false;
      persist(s);
      app.render();
    },
  },
};
