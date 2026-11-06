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
import { DEFAULT_SETTINGS, DEFAULT_ROTATION, GAMES, gameFix, autoGroups, cartRotation, threeCartRotation, cartIdsFor, ryderSetup, teeTimeName } from '../scoring.js';
import { sideColor } from '../teams.js';
import * as db from '../db.js';
import * as names from '../names.js';
import { FLAGS } from '../flags.js';
import { loadGeo } from '../geoload.js';
import { TEAM_NAME_PICKS, isDefaultTeamName } from '../teams.js';
import { initials } from '../ui.js';
import { countsAsPlayed, draftedRoster, newLobby, toTeamsStage, withStartTimes, keepNames, rosterKey, allTimesSet, addMinutes, lobbyOf } from '../lobby.js';

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
function newPlayer({ personId, firstName, lastName = '', nickname = '', strokes = '' }) {
  return withName({ key: db.uuid(), personId: personId || db.uuid(), firstName, lastName, nickname, strokes, teamId: null, groupId: 'g1' });
}
/** Last round's handicap for a person (from the crew's rounds), or '' — it prefills. */
const lastHcpOf = (s, personId) => (personId && s.lastHcp && s.lastHcp[personId] != null ? String(s.lastHcp[personId]) : '');
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function blank(from = null) {
  const { rotation, ...settings } = DEFAULT_SETTINGS;
  return {
    screen: 'course', from, loadingFrom: !!from, courseId: null, tee: null, name: '',
    course: null, courseStatus: 'idle', mine: [], q: '', results: null, searching: false, searchError: '',
    near: null, nearStatus: 'idle', loc: null, which: null, whichName: '',
    players: [], teams: TEAM_IDS.map((id) => ({ id, name: '' })),
    game: 'scorecard', pairSwitch: 'never', schedule: 'six', opps: null, custom: false, swapSel: null, rulesOpen: false, sideNames: ['', ''],
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
  if (s.lobby) return; // 025: a lobby edit (draft / start times) lives in memory only, never in glb.setupDraft
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
    const lastHcp = {}; // person → strokes in the latest round they played (rounds come oldest first)
    const freq = {}; // person → rounds in the crew's last 12 (Quick players order, feature 007)
    const live = rounds.filter(({ event, scores }) => String(event.settings?.practice) !== 'true' && countsAsPlayed(event, scores)); // 025: not a lobby that never opened
    for (const { event } of live.slice(-12)) for (const p of event.roster?.players || []) if (p.personId) freq[p.personId] = (freq[p.personId] || 0) + 1;
    // Last groups: the crew's 4 most recent rounds, newest first ("All 8 from Friday", "Sat 2v2 · 4").
    const groups = live.slice(-4).reverse().map(({ event }) => ({
      day: event.played_on ? new Date(`${event.played_on}T12:00:00`).toLocaleDateString([], { weekday: 'long' }) : '',
      course: event.course?.shortName || event.course?.name || '',
      game: event.settings?.pairs ? '2v2' : (event.roster?.teams || []).length >= 3 ? 'Cart game' : event.settings?.solo ? 'Match' : '',
      people: (event.roster?.players || []).filter((p) => p.personId).map((p) => ({ personId: p.personId, firstName: p.firstName || String(p.name || '').split(' ')[0], lastName: p.lastName || '', nickname: p.nickname || '' })),
    })).filter((g) => g.people.length);
    // Usual cart names (feature 009): per pair (either order), the name they used most recently in the crew.
    const usual = {};
    for (const { event } of live) {
      for (const t of event.roster?.teams || []) {
        const ids = (event.roster.players || []).filter((p) => p.teamId === t.id && p.personId).map((p) => p.personId);
        if (ids.length !== 2 || !t.name || isDefaultTeamName(t)) continue;
        const k = ids.sort().join('|');
        const u = (usual[k] ||= { counts: {} });
        u.counts[t.name] = (u.counts[t.name] || 0) + 1;
        u.name = t.name;
        u.last = event.played_on || u.last;
      }
    }
    for (const u of Object.values(usual)) u.uses = u.counts[u.name];
    for (const { event } of rounds) {
      for (const p of event.roster?.players || []) {
        if (p.personId) people.set(p.personId, p.name);
        if (p.personId && p.strokes != null && p.strokes !== '') lastHcp[p.personId] = Number(p.strokes);
      }
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
      app.setup.lastHcp = lastHcp;
      app.setup.freq = freq;
      app.setup.usual = usual;
      app.setup.groups = groups;
      app.setup.pastPeople = [...people].map(([personId, name]) => ({ personId, name })); // incl. people off the crew list
      app.setup.pastLoaded = true;
      quickAddMe(app.setup);
      paintCourses(app);
      if (app.setup.screen === 'players') app.render();
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
    const ryder = !!ev.settings?.ryder;
    // Team Ryder Cup: players come back in side → cart order (the sides screen reads them that way).
    const src = ryder ? [...(ev.roster.players || [])].sort((a, b) => String(a.teamId).localeCompare(String(b.teamId))) : ev.roster.players || [];
    s.players = src.map((p, i) => ({
      key: `k${i}`, personId: p.personId || db.uuid(), name: p.name, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname,
      strokes: p.strokes ?? '', teamId: ryder ? null : p.teamId || null, groupId: p.groupId || 'g1',
    })).map(withName);
    s.teams = TEAM_IDS.map((id) => ({ id, name: (ev.roster.teams || []).find((t) => t.id === id)?.name || '' }));
    if (ryder) Object.assign(s, { rySkip: true, ryPicks: [], ryTee: null }); // run it back: same sides, same tee times
    s.sideNames = ryder ? ['1', '2'].map((id) => (ev.roster.sides || []).find((x) => x.id === id)?.name || '') : ['', ''];
    const { rotation, lineups, ryder: _r, lobby: _l, ...settings } = ev.settings || {}; // 025: never the lobby
    s.settings = { ...s.settings, ...settings };
    // The same game as last time (the course isn't copied).
    const nCarts = (ev.roster.teams || []).length;
    s.game = ryder ? 'ryder' : settings.pairs ? '2v2' : settings.solo ? 'match' : nCarts === 4 || nCarts === 3 ? 'carts' : 'scorecard';
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
    if (FLAGS.gps) loadGeo(s.course); // greens for the GPS card, in the background (usually ready by Save)
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
  if (game === 'ryder') return buildRyder(s, c, shown);
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

/** The course part of a round, shared by every game. */
function courseOf(s, c) {
  const { variants, variant, ...cleanCourse } = c;
  return {
    id: cleanCourse.id, ...(c.ogaId ? { ogaId: c.ogaId } : {}), source: c.source === 'yours' ? c.lastSource || 'yours' : c.source || 'builtin',
    name: c.name.trim(), shortName: c.shortName || cd.shortCourseName(c.name), location: c.location || '',
    ...(c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : {}),
    tee: s.tee, tees: (c.tees || []).map((t) => ({ name: t.name, yards: t.yards ?? null, rating: t.rating ?? null, slope: t.slope ?? null })),
    par: c.par.map(Number), strokeIndex: c.strokeIndex.map(Number),
  };
}

/** Team Ryder Cup: players in order = side 1 then side 2, pairs = carts, cart k of each side = tee time k. */
function buildRyder(s, c, shown) {
  const d = rySides(s), tee = ryTee(s);
  const order = [...d.A, ...tee].flatMap((k) => [2 * k, 2 * k + 1]);
  const players = order.map((k) => s.players[k]).map((p, i) => ({
    id: p.lobbyId || `p${i + 1}`, personId: p.personId || db.uuid(), name: shown[i],
    firstName: p.firstName, lastName: p.lastName || '', ...(p.nickname ? { nickname: p.nickname } : {}),
    strokes: p.strokes === '' || p.strokes == null || Number.isNaN(Number(p.strokes)) ? null : Math.max(0, Math.round(Number(p.strokes))),
  }));
  // 025: draftedRoster keeps a lobby round's player ids (claims point at them); new rounds get p1…p16 as before.
  const { roster, settings } = draftedRoster(players.map((p, i) => ({ ...p, name: shown[order[i]] })), ['', '']);
  return {
    name: s.name.trim() || `${c.shortName || cd.shortCourseName(c.name)} · ${prettyDate(todayISO())}`,
    course: courseOf(s, c),
    roster,
    settings: { ...s.settings, ...settings },
    playedOn: todayISO(),
    crewId: s.crewId,
  };
}

// ───────────────────────────────────────────── handicap sheet (designspec §6b)

/** Bottom sheet for one player's handicap: big stepper, last round's number, full / no strokes. */
export function handicapSheet(app, { i }) {
  const s = app.setup;
  const p = s?.players[i];
  if (!p) return '';
  const none = p.strokes === '' || p.strokes == null;
  const v = none ? 0 : Number(p.strokes);
  const last = lastHcpOf(s, p.personId);
  return `<div class="panel-head"><div class="ph-text"><h2 class="title">${esc(p.firstName || p.name)}’s handicap</h2>
      <div class="ph-sub">Strokes they get over 18 holes. Tap the number to type it.</div></div>
      <button class="icon-btn" data-act="sheet-close" aria-label="Close">${icon('close')}</button></div>
    <div class="hcp-stepper">
      <button class="hs-btn" data-act="hcp-step" data-i="${i}" data-d="-1" aria-label="One less" ${none || v === 0 ? 'disabled' : ''}>${icon('minus', 28)}</button>
      <span class="hs-mid"><input class="hs-num" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${none ? '' : esc(v)}" placeholder="0" aria-label="${esc(p.name)} handicap" data-input="hcp-type" data-i="${i}">
        <span class="hs-was">${last !== '' ? `was ${esc(last)} last round` : none ? 'plays even' : '&nbsp;'}</span></span>
      <button class="hs-btn" data-act="hcp-step" data-i="${i}" data-d="1" aria-label="One more">${icon('plus', 28)}</button>
    </div>
    ${seg('hcp-mode', [['full', 'Use full'], ['none', 'No strokes']], none ? 'none' : 'full', `data-i="${i}"`)}
    <button class="btn primary big block hs-done" data-act="hcp-done">Done</button>`;
}

// ───────────────────────────────────────────── screens (designspec §6)

/** Back target for each screen. */
const BACK = { which: 'course', players: 'course', check: 'players', game: 'players', teams: 'game', matchups: 'tee', draft: 'teams', tee: 'draft', invite: 'game', when: 'invite' };
// Partner “Rider” Cup (018): Carts → Tee times (no draft); matchups is an optional screen off Tee times.
// Team Ryder Cup (025): Game → Invite now? → (When | Carts → Draft → Tee times).
const backOf = (s) => (s.game === 'carts' && s.screen === 'tee' ? 'teams' : s.game === 'ryder' && s.screen === 'teams' ? 'invite' : BACK[s.screen]);
const BACK_LABEL = { course: 'Course', players: 'Players', game: 'Game', invite: 'Invite', when: 'When', teams: s => (s.game === 'carts' ? 'Carts' : s.game === 'ryder' ? 'Carts' : 'Partners'), draft: 'Draft', tee: 'Tee times' };

/** Progress bars: how far along the flow this screen is (2–4 bars depending on the game). */
function progress(s) {
  const flow = ['course', 'players', 'game', ...(s.game === 'ryder' ? ['invite', ...(s.screen === 'when' ? ['when'] : ['teams', 'draft', 'tee'])] : s.game === '2v2' ? ['teams'] : s.game === 'carts' ? ['teams', 'tee'] : [])];
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

// ───────────────────────────────────────────── ② Quick players (feature 007-quick-players)

const meOf = (s) => (s.crewId ? db.crews.get(s.crewId)?.me || null : null);
const fullOf = (p) => [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || '';
const shortOf = (p) => (p.lastName ? `${p.firstName} ${p.lastName[0]}.` : p.firstName || p.name || '');

/** You start ticked in a crew round (once per setup, never after you untick yourself). */
function quickAddMe(s) {
  const me = meOf(s);
  if (!me || s.meAdded || s.from) return;
  s.meAdded = true;
  if (s.players.some((x) => x.personId === me)) return;
  const p = s.past.find((x) => x.personId === me);
  if (p) s.players.unshift(newPlayer({ personId: p.personId, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname, strokes: lastHcpOf(s, p.personId) }));
}

/** Rows: you, then everyone picked who isn't a regular (guests), then regulars by how often they play. */
function quickRows(s) {
  const me = meOf(s);
  const picked = new Set(s.players.map((p) => p.personId));
  const freq = s.freq || {};
  const crew = [...s.past].sort((a, b) => (b.personId === me) - (a.personId === me) || (freq[b.personId] || 0) - (freq[a.personId] || 0) || shortOf(a).localeCompare(shortOf(b)));
  const inCrew = new Set(crew.map((p) => p.personId));
  const guests = s.players.filter((p) => !inCrew.has(p.personId)).map((p) => ({ ...p, guest: true }));
  return [...crew.filter((p) => p.personId === me), ...guests, ...crew.filter((p) => p.personId !== me)].map((p) => ({ ...p, on: picked.has(p.personId), me: p.personId === me }));
}

function pickRow(s, p) {
  const hcp = FLAGS.crewHandicaps ? lastHcpOf(s, p.personId) : '';
  const i = s.players.findIndex((x) => x.personId === p.personId);
  return `<button class="pick-row${p.on ? ' on' : ''}" data-act="qp-toggle" data-v="${esc(p.personId)}" aria-pressed="${p.on}">
      <span class="av${p.me ? ' me' : ''}">${esc(initials(fullOf(p)))}</span>
      <span class="pr-main"><span class="pr-name ellipsis">${esc(shortOf(p))}</span>${p.me ? '<span class="pr-sub you">You</span>' : p.guest ? '<span class="pr-sub">Guest · joins the crew after the round</span>' : ''}</span>
      ${FLAGS.crewHandicaps && hcp !== '' && i >= 0 ? `<span class="pr-hcp mono" data-act="setup-hcp" data-i="${i}">${esc(hcp)}</span>` : FLAGS.crewHandicaps && hcp !== '' ? `<span class="pr-hcp mono">${esc(hcp)}</span>` : ''}
      <span class="pr-box">${p.on ? icon('check', 18) : ''}</span>
    </button>${i >= 0 && !s.players[i].lastName ? `<div class="pr-last"><input class="input name-fill" maxlength="30" placeholder="${esc(s.players[i].firstName || 'Their')}’s last name" autocapitalize="words" autocomplete="off" aria-label="Last name for ${esc(s.players[i].firstName)}" data-input="setup-last" data-i="${i}"></div>` : ''}`;
}

/** Search results (repainted in place while typing, so the field keeps focus). */
function quickResults(s) {
  const q = String(s.newName || '').trim().toLowerCase();
  const rows = quickRows(s);
  const hits = q ? rows.filter((p) => fullOf(p).toLowerCase().includes(q) || String(p.nickname || '').toLowerCase().includes(q)) : rows;
  const inCrew = new Set(rows.map((p) => p.personId));
  const before = q ? (s.pastPeople || []).filter((p) => !inCrew.has(p.personId) && String(p.name).toLowerCase().includes(q)) : [];
  const picked = s.players.map(shortOf);
  return `${hits.length ? `<div class="pick-list">${hits.map((p) => pickRow(s, p)).join('')}</div>` : ''}
    ${before.length ? `<div class="ts-label qp-k">Played with the crew before</div><div class="pick-list">${before.map((p) => `<button class="pick-row" data-act="qp-before" data-v="${esc(p.personId)}"><span class="av">${esc(initials(p.name))}</span><span class="pr-main"><span class="pr-name ellipsis">${esc(p.name)}</span><span class="pr-sub">Not on the crew list</span></span><span class="pr-box"></span></button>`).join('')}</div>` : ''}
    ${q ? `<div class="ts-label qp-k">Not in the crew</div>
      <button class="qp-guest" data-act="setup-add"${s.nickAsk ? ' disabled' : ''}>${icon('plus', 18)}<span>Add “${esc(s.newName.trim())}” as a guest</span></button>` : ''}
    <p class="meta qp-picked">${picked.length} picked${picked.length ? ` · ${esc(picked.join(', '))}` : ''}</p>`;
}

function quickPlayersView(s, c, line, tee) {
  const crewName = (db.crews.get(s.crewId)?.name || 'Your crew').toUpperCase();
  const rows = quickRows(s);
  const searching = s.qpSearch;
  const onlyYou = s.pastLoaded && rows.filter((p) => !p.me && !p.guest).length === 0;
  const g = s.groups || [];
  const chips = g.length ? `<div class="ts-label qp-k">Last group · ${esc(g[0].day.slice(0, 3))} at ${esc(g[0].course)}</div>
    <div class="qp-chips">${g.map((x, i) => `<button class="group-chip${i === 0 ? ' primary' : ''}" data-act="qp-group" data-i="${i}">${i === 0 ? `${icon('plus', 18)} All ${x.people.length} from ${esc(x.day)}` : `${esc(x.day.slice(0, 3))}${x.game ? ` ${esc(x.game)}` : ''} · ${x.people.length}`}</button>`).join('')}</div>` : '';
  const list = searching
    ? `<div class="qp-searchbar"><label class="nr-search qp-search">${icon('search', 20)}<input id="new-player" type="search" maxlength="48" placeholder="Search the crew or type a name" value="${esc(s.newName || '')}" autocapitalize="words" autocomplete="off" data-input="qp-query" data-enter="setup-add"></label>
        <button class="btn small" data-act="qp-search-done">Done</button></div>
      <div id="qp-results">${quickResults(s)}</div>`
    : `<div class="qp-head"><span class="ts-label">${esc(crewName)} · ${onlyYou ? 'just you so far' : `${s.players.length} picked`}</span>
        <button class="link-btn qp-find" data-act="qp-search">${icon('search', 18)} Search</button></div>
      <div class="pick-list">${rows.map((p) => pickRow(s, p)).join('')}</div>
      ${onlyYou ? `<div class="crew-card crew-none qp-empty"><div class="cc-name">Your regulars show up here</div>
          <p class="cc-meta">Invite the crew, or add people by name. People you add join the crew list after the round.</p>
          <div class="cc-actions"><button class="btn cc-btn" data-act="crew-invite" data-v="${esc(s.crewId)}">${icon('share', 20)} Invite crew</button><button class="btn cc-btn" data-act="qp-search">Add by name</button></div></div>`
        : `<div class="qp-foot">${rows.length > 8 ? `<span class="meta">+${rows.length - 8} more in the crew · scroll</span>` : '<span></span>'}<button class="link-btn" data-act="qp-search">${icon('plus', 16)} Guest</button></div>`}`;
  return `${topBar(s)}${headline('Step 2 · Players', 'Who’s playing?', s.players.length === 16 && gameOf(s) === 'ryder' ? '16 in. That’s a Team Ryder Cup.' : '')}
    ${c ? `<div class="nr-course">
      <button class="nc-main" data-act="setup-go" data-v="${c.variants?.length > 1 && !c.variant ? 'which' : 'check'}">
        <b class="ellipsis">${esc(c.shortName || c.name || 'Your course')}${esc(tee)}</b>
        <span class="nc-line ${line.cls}">${line.cls === '' && s.courseStatus === 'loading' ? '<span class="spinner tiny" aria-hidden="true"></span>' : ''}${esc(line.text)}</span>
      </button>
      <button class="btn small" data-act="setup-unpick">Change</button></div>` : ''}
    ${searching ? '' : chips}
    ${list}
    ${s.nickAsk ? `<div class="card nick-ask">
      <p class="meta" style="margin:0 0 8px">Someone named ${esc(s.nickAsk.first)} ${esc(s.nickAsk.last)} already plays in another crew. Someone new? Add a nickname so they’re their own player.</p>
      <div class="join-row"><input class="input" id="new-nick" maxlength="24" placeholder="Nickname, e.g. Tini Ryno" autocapitalize="words" autocomplete="off" data-enter="setup-add">
        <button class="btn primary" data-act="setup-add">Add</button></div>
      <button class="link-btn" style="margin-top:8px" data-act="setup-nick-cancel">Cancel</button>
    </div>` : ''}
    ${bottom(`Next: pick a game · ${s.players.length}`, 'setup-go', { v: 'game', disabled: !s.players.length || !!s.nickAsk, arrow: false })}`;
}

/** ② Who's playing? */
function playersView(s) {
  if (s.crewId && db.crews.get(s.crewId)) {
    const c0 = course(s);
    return quickPlayersView(s, c0, c0 ? cardLine(s, c0) : null, s.tee ? ` · ${s.tee.name} tees` : '');
  }
  const c = course(s);
  const line = c ? cardLine(s, c) : null;
  const used = new Set(s.players.map((p) => p.personId));
  const recent = s.past.filter((p) => !used.has(p.personId)).slice(0, 8);
  const tee = s.tee ? ` · ${s.tee.name} tees` : '';
  return `${topBar(s)}${headline('Step 2 · Players', 'Who’s playing?', s.players.length === 16 && gameOf(s) === 'ryder' ? '16 in. That’s a Team Ryder Cup.' : '')}
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
        <button class="hcp-pill mono${p.strokes === '' || p.strokes == null ? ' empty' : ''}" data-act="setup-hcp" data-i="${i}" aria-label="${esc(p.name)} handicap: ${p.strokes === '' || p.strokes == null ? 'none' : esc(p.strokes)}">${p.strokes === '' || p.strokes == null ? 'Add' : esc(p.strokes)}</button>
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
  const next = pick === '2v2' || pick === 'carts' || pick === 'ryder';
  return `${topBar(s)}${headline(`Step 3 · Game · ${n} player${n === 1 ? '' : 's'}`, 'Pick a game', 'Games that don’t fit your player count are greyed out.')}
    <div class="game-list">${GAMES.map((g) => {
      const fix = gameFix(g.id, n);
      const on = g.id === pick;
      return `<button class="game-opt${on ? ' on' : ''}" data-act="setup-game" data-v="${g.id}" ${fix ? 'aria-disabled="true"' : ''} aria-pressed="${on}">
        <span class="radio"></span>
        <span style="flex:1;min-width:0"><span class="spread"><b class="ellipsis">${esc(g.name)}</b><span class="mono g-count">${g.count}</span></span>
        <span class="g-desc ellipsis">${esc(n === 6 && g.desc6 ? g.desc6 : g.desc)}</span>${fix ? `<span class="g-fix">${esc(fix)}</span>` : ''}</span>
      </button>`;
    }).join('')}</div>
    ${pick === 'match' ? '<p class="meta nr-hint">Match play: everyone plays their own ball. Each hole is worth 1 point; low net score takes it, a tie for low splits it.</p>' : ''}
    <div class="nr-foot">
      ${next ? '' : '<p class="meta" style="text-align:center;margin:0 0 8px">2v2, Partner “Rider” Cup and Team Ryder Cup go to one more screen to set teams.</p>'}
      <button class="btn primary nr-cta" data-act="${next ? 'setup-go' : 'setup-save'}" ${next ? `data-v="${pick === 'ryder' ? 'invite' : 'teams'}"` : ''} ${s.saving ? 'aria-busy="true"' : ''}>${s.saving ? 'Starting…' : next ? `Next: ${pick === '2v2' ? 'pick partners' : pick === 'ryder' ? 'carts' : 'carts'}` : `Start round · ${n} player${n === 1 ? '' : 's'}`}${next ? icon('fwd', 18) : ''}</button>
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
  if (st.game !== 'rotationPlusMinus' && s.game !== 'ryder' && Number(st.matchBonus ?? 1)) parts.push(`+${st.matchBonus ?? 1} win`);
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
      ${s.game === 'ryder' ? '' : `<div class="field"><span class="label">Matchup win bonus</span>${seg('setup-set', [['1', '+1 point'], ['0', 'None']], String(st.matchBonus ?? 1), 'data-k="matchBonus"')}</div>`}` : ''}
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

// ───────────────────────────────────────────── Team Ryder Cup setup (handoff 015 §4, RULES §7)
// ④ Carts (s.players in order, pairs = carts) → ⑤ Draft (s.ryPicks: cart indexes in pick order, or
// s.rySkip) → ⑥ Tee times (s.ryTee: their side's cart index per tee time). buildRyder reorders the
// players into side 1 carts by tee time, then side 2 the same way, which is what ryderSetup reads.
export const RY_SNAKE = ['J', 'A', 'A', 'J', 'J', 'A'];
const ryCartName = (s, k) => [s.players[2 * k], s.players[2 * k + 1]].map((p) => p?.firstName || p?.name || '').join(' + ');
/** The two sides as cart indexes: captains' carts (1 and 2) first, then picks; skip = carts 1–4 v 5–8. */
export function rySides(s) {
  if (s.rySkip) return { A: [0, 1, 2, 3], J: [4, 5, 6, 7], done: true };
  const A = [0], J = [1];
  const picks = (s.ryPicks || []).filter((k, i, all) => k >= 2 && k <= 7 && all.indexOf(k) === i);
  picks.forEach((k, i) => (RY_SNAKE[i] === 'A' ? A : J).push(k));
  return { A, J, done: picks.length === 6, turn: RY_SNAKE[picks.length] || null, picks };
}
/** Their side's cart per tee time (a permutation of side J), default in pick order. */
export function ryTee(s) {
  const { J } = rySides(s);
  const t = s.ryTee || [];
  return t.length === J.length && J.every((k) => t.includes(k)) ? t : [...J];
}
const ryCaptain = (s, side) => s.players[2 * rySides(s)[side][0]];
const ryTeamName = (s, side) => `Team ${ryCaptain(s, side)?.firstName || ryCaptain(s, side)?.name || ''}`;

/** ④ Who rides together? */
function ryCartsView(s) {
  if (gameFix('ryder', s.players.length)) return gameView(s);
  const rows = Array.from({ length: 8 }, (_, k) => `<div class="ry-cart"><span class="lbl">Cart ${k + 1}</span>
      <div class="ry-cart-pair">${swapBtn(s, 2 * k)}${swapBtn(s, 2 * k + 1)}</div></div>`).join('');
  return `${topBar(s)}${headline('Step 4 · Carts', 'Who rides together?')}
    <div class="nr-line"><span class="meta">${s.swapSel != null ? 'Now tap who to swap with.' : 'Tap two names to swap.'}</span><button class="btn small" data-act="setup-shuffle">Shuffle</button></div>
    ${rows}
    ${bottom('Next: pick sides', 'setup-go', { v: 'draft', arrow: true })}`;
}

/** ⑤ Draft: one phone, both captains looking. Snake J, A, A, J, J, A. */
function ryDraftView(s) {
  if (gameFix('ryder', s.players.length)) return gameView(s);
  const d = rySides(s);
  const capA = ryCaptain(s, 'A'), capJ = ryCaptain(s, 'J');
  const fn = (p) => p?.firstName || p?.name || '';
  const title = d.done ? 'Sides are set' : `${esc(fn(d.turn === 'A' ? capA : capJ))} picks`;
  const pool = s.rySkip ? [] : [2, 3, 4, 5, 6, 7].filter((k) => !d.picks.includes(k));
  const col = (side) => `<div class="ry-col"><div class="ry-col-h${side === 'A' ? ' you' : ''}"><span class="ellipsis">${esc(ryTeamName(s, side))}</span>${!d.done && d.turn === side ? '<span class="ry-tag mono">PICKING</span>' : ''}</div>
      ${d[side].map((k, i) => `<div class="ry-slot${i === 0 ? ' cap' : ''}${i === 0 && side === 'A' ? ' you' : ''}"><span class="ellipsis">${esc(ryCartName(s, k))}</span></div>`).join('')}</div>`;
  return `${topBar(s)}${headline('Step 5 · Draft', title, d.done ? 'Two sides of 4 carts. Tee times next.' : 'Tap a cart to take it.')}
    <div class="nr-line"><span class="meta">${d.done ? '' : `Snake order: ${RY_SNAKE.map((x) => esc(fn(x === 'A' ? capA : capJ))).join(', ')}`}</span><button class="btn small" data-act="setup-ry-reset">Start over</button></div>
    ${pool.length ? `<div class="lbl ry-pool-k">Still on the board</div><div class="ry-pool">${pool.map((k) => `<button class="ry-pick" data-act="setup-ry-pick" data-i="${k}"><span class="ellipsis">${esc(ryCartName(s, k))}</span></button>`).join('')}</div>` : ''}
    <div class="ry-cols">${col('A')}${col('J')}</div>
    ${d.done ? s.lobby ? bottom(s.saving ? 'Saving…' : 'Save the teams', 'setup-lobby-save', { busy: s.saving }) : bottom('Next: tee times', 'setup-go', { v: 'tee', arrow: true })
      : `<div class="nr-foot"><button class="btn nr-cta" data-act="setup-ry-skip">Skip the draft · split in cart order</button></div>`}`;
}

/** ⑥ Who tees off together? Your side's carts fixed, theirs tap-to-swap; then your three matches. */
function ryTeeView(s) {
  if (gameFix('ryder', s.players.length)) return gameView(s);
  const d = rySides(s);
  if (!d.done) return ryDraftView(s);
  const tee = ryTee(s);
  const times = s.settings.teeTimes || [];
  const rows = d.A.map((a, k) => `<div class="ry-tee">
      <div class="ry-tee-k"><span class="lbl">${['1st', '2nd', '3rd', '4th'][k]}</span>
        <input class="ry-time mono${times[k] ? ' set' : ''}" type="time" value="${esc(times[k] || '')}" aria-label="${['1st', '2nd', '3rd', '4th'][k]} tee time" data-input="setup-ry-time" data-i="${k}">${times[k] ? '' : '<span class="ry-time-ph">Add time</span>'}</div>
      <div class="ry-tee-pair"><div class="ry-slot you"><span class="ellipsis">${esc(ryCartName(s, a))}</span></div><span class="meta">v</span>
        <button class="ry-pick${s.rySel === k ? ' sel' : ''}" data-act="setup-ry-tee" data-i="${k}" aria-pressed="${s.rySel === k}"><span class="ellipsis">${esc(ryCartName(s, tee[k]))}</span></button></div></div>`).join('');
  const ord = ['same tee time', '2nd', '3rd', '4th'];
  const mine = [0, 1, 2].map((r) => `<div class="ry-my"><span class="mono">${['1–6', '7–12', '13–18'][r]}</span><span class="ellipsis">${esc(ryCartName(s, tee[r % 4]))}</span><span class="meta">${r === 0 ? ord[0] : ord[r]}</span></div>`).join('');
  return `${topBar(s)}${headline('Step 6 · Tee times', 'Who tees off together?', `Tap two ${esc(ryTeamName(s, 'J'))} carts to swap.`)}
    ${rows}
    <div class="lbl ry-pool-k">Your three matches · ${esc(ryCartName(s, d.A[0]))}</div>
    ${mine}
    ${s.lobby ? '' : rulesBlock(s)}
    ${s.lobby ? bottom(s.saving ? 'Saving…' : 'Save start times', 'setup-lobby-save', { busy: s.saving }) : bottom(s.saving ? 'Starting…' : 'Start round · 16 players', 'setup-save', { busy: s.saving })}`;
}

// ───────────────────────────────────────────── 025 · Invite now, draft later (Team Ryder Cup)

/** 15 · Invite them now? (Team Ryder Cup with 16): the lobby path or today's Carts → Draft → Tee times. */
function inviteView(s) {
  const n = s.players.length;
  return `${headline(`New round${s.name.trim() ? ` · ${esc(s.name.trim())}` : ''}`, `${n} players added. Invite them now?`, 'Everyone can join today. You draft and set start times later.')}
    <div class="nr-foot"><button class="btn primary nr-cta" data-act="setup-go" data-v="when">Invite now, draft later</button>
      <button class="btn block nr-second" data-act="setup-go" data-v="teams">Draft and start times first</button></div>`;
}

/** The phone's zone, said the way people say it ("Central Time"); the round's times are in it. */
function zoneName() {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName')?.value || '';
    return p.replace(/ (Standard|Daylight)/, '');
  } catch { return ''; }
}
/** Next Saturday (or today if it is one): the default date for a lobby round. */
function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** When (new pattern, flagged: TextField + native date / time inputs): the date and the first start time. */
function whenView(s) {
  const w = s.when || (s.when = { date: nextSaturday(), time: '08:00' });
  const zone = zoneName();
  return `${headline('Step 5 · When', 'When do you play?', 'Players see it as soon as they join.')}
    <div class="field"><label for="when-date">Date</label><input class="input" id="when-date" type="date" value="${esc(w.date)}" min="${esc(todayISO())}" data-input="setup-when" data-k="date"></div>
    <div class="field"><label for="when-time">First start time${zone ? ` · ${esc(zone)}` : ''}</label><input class="input" id="when-time" type="time" value="${esc(w.time)}" data-input="setup-when" data-k="time"></div>
    <div class="field"><label for="round-name">Round name (optional)</label>
      <input class="input" id="round-name" maxlength="60" value="${esc(s.name)}" placeholder="e.g. Chuck’s Bday" data-input="setup-name"></div>
    <p class="meta nr-hint">Scoring opens by itself 30 minutes before the first start time, once you’ve set start times.</p>
    ${bottom(s.saving ? 'Creating…' : 'Create and invite', 'setup-save', { busy: s.saving })}`;
}

/** The lobby round: 16 players p1…p16 with their people, no carts or sides yet, settings.lobby at 'lobby'. */
function buildLobby(s) {
  const c = course(s);
  const shown = names.displayNames(s.players);
  const w = s.when || { date: nextSaturday(), time: '08:00' };
  const players = s.players.map((p, i) => ({
    id: `p${i + 1}`, personId: p.personId || db.uuid(), name: shown[i],
    firstName: p.firstName, lastName: p.lastName || '', ...(p.nickname ? { nickname: p.nickname } : {}),
    teamId: null, groupId: null,
    strokes: p.strokes === '' || p.strokes == null || Number.isNaN(Number(p.strokes)) ? null : Math.max(0, Math.round(Number(p.strokes))),
  }));
  const o = db.owner.get();
  const me = o?.personId ? s.players.find((p) => p.personId === o.personId) : null;
  let tz = 'UTC';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* UTC */ }
  return {
    name: s.name.trim() || `${c.shortName || cd.shortCourseName(c.name)} · ${prettyDate(w.date)}`,
    course: courseOf(s, c),
    roster: { groups: [], teams: [], sides: [], players },
    settings: { ...s.settings, ...ryderSetup(players).settings, teeTimes: [], lobby: newLobby({ startTime: w.time, tz, hostName: me?.firstName || (o?.name ? String(o.name).split(' ')[0] : '') }) },
    playedOn: w.date,
    crewId: s.crewId,
  };
}

// ───────────────────────────────────────────── 025 · lobby edit mode: the draft / start times on an existing round
// Host's Start the draft / Set start times run these same steps on the event's players (ids kept), inside the round
// route (the round stays loaded). Nothing is written to glb.setupDraft (persist() skips s.lobby).

const RULE_KEYS = ['teamScore', 'maxHoleScore', 'halvedHolePoints', 'par3NoMax', 'handicapMode', 'allowancePct'];

export function startLobbyEdit(app, mode) {
  const ev = app.event;
  const r = ev.roster || {};
  const toSetup = (p) => withName({
    key: p.id, lobbyId: p.id, personId: p.personId, firstName: p.firstName || names.splitName(p.name || '').first,
    lastName: p.lastName || '', nickname: p.nickname || '', strokes: p.strokes ?? '', teamId: null, groupId: 'g1',
  });
  const s = { ...blank(null), lobby: { code: app.code, mode, key: rosterKey(r), roster: clone(r) }, game: 'ryder', course: clone(ev.course), courseId: ev.course?.id, courseStatus: 'ready', name: ev.name, settings: { ...s0settings(ev.settings) } };
  if (mode === 'tee') {
    // Side 1's carts by start time, then side 2's: what buildRyder reads with rySkip (the current pairing).
    const ordered = [];
    for (const sd of r.sides || []) {
      const carts = [...(sd.teamIds || [])].sort((a, b) => {
        const g = (tid) => Number(String((r.players || []).find((p) => p.teamId === tid)?.groupId || 'g9').slice(1));
        return g(a) - g(b);
      });
      for (const tid of carts) ordered.push(...(r.players || []).filter((p) => p.teamId === tid));
    }
    s.players = ordered.map(toSetup);
    Object.assign(s, { rySkip: true, ryPicks: [], ryTee: null, screen: 'tee' });
    const l = lobbyOf(ev.settings);
    const t = Array.isArray(ev.settings.teeTimes) ? [...ev.settings.teeTimes] : [];
    const start = l?.startTime || '08:00';
    s.settings.teeTimes = [0, 1, 2, 3].map((k) => t[k] || addMinutes(start, 10 * k)); // 8:00, 8:10, 8:20, 8:30
  } else {
    s.players = (r.players || []).map(toSetup);
    Object.assign(s, { rySkip: false, ryPicks: [], ryTee: null, screen: 'teams' });
  }
  app.setup = s;
  app.render();
  document.getElementById('content').scrollTop = 0;
}
function s0settings(st) { return clone(st || {}); }

/** Host draws the current lobby step with Setup's own views, plus a way back to Host. */
export function lobbyStepView(app) {
  const s = app.setup;
  relabel(s);
  curState = s;
  const first = s.lobby.mode === 'tee' ? 'tee' : 'teams';
  const back = s.screen === first
    ? '<button class="link-btn lb-back" data-act="setup-lobby-cancel">Back to Host</button>'
    : `<button class="link-btn lb-back" data-act="setup-go" data-v="${esc(backOf(s))}">${icon('back', 20)} Back</button>`;
  return `<div class="plain nr-setup">${back}${(VIEWS[s.screen] || ryCartsView)(s, app)}</div>`;
}

/** Save the lobby step: the draft (stage 'teams') or the start times (stage 'ready', opensAt set). */
async function saveLobbyStep(app) {
  const s = app.setup;
  if (!s?.lobby || s.saving) return;
  let fresh;
  try { fresh = await db.fetchEvent(s.lobby.code); } catch { fresh = null; }
  if (!fresh) { app.toast({ title: 'No signal', sub: 'Not saved. Try again.', error: true }); return; }
  if (rosterKey(fresh.roster) !== s.lobby.key) {
    // Someone (a co-host, a Replace) changed the players since this step opened: never overwrite them.
    app.setup = null;
    app.event = { ...app.event, ...fresh };
    app.render();
    app.toast({ title: 'The players changed meanwhile', sub: 'Nothing saved. Open the step again.', error: true });
    return;
  }
  const times = (s.settings.teeTimes || []).slice(0, 4);
  if (s.lobby.mode === 'tee' && !allTimesSet(times, 4)) { app.toast({ title: 'Add all four start times', error: true }); return; }
  let roster;
  try {
    ({ roster } = buildRyder(s, course(s), names.displayNames(s.players)));
  } catch (e) {
    app.toast({ title: 'Couldn’t save', sub: e?.message || 'Go back a step and try again.', error: true });
    return;
  }
  if (s.lobby.mode === 'tee') roster = keepNames(roster, fresh.roster);
  const rules = Object.fromEntries(RULE_KEYS.filter((k) => k in s.settings).map((k) => [k, s.settings[k]]));
  const base = { ...fresh.settings, ...rules };
  const settings = s.lobby.mode === 'tee' ? withStartTimes(base, fresh.played_on, times, app.now()) : { ...toTeamsStage(base), teeTimes: [] };
  s.saving = true;
  app.render();
  app.event = { ...app.event, ...fresh };
  const ok = await app.saveEvent({ course: fresh.course, roster, settings, name: fresh.name });
  s.saving = false;
  if (!ok) { app.render(); return; }
  if (s.lobby.mode !== 'tee') db.local.set(`glb.lobbyhost.${s.lobby.code}`, { ...(db.local.get(`glb.lobbyhost.${s.lobby.code}`) || {}), teamsShared: false });
  app.setup = null;
  app.render();
  document.getElementById('content').scrollTop = 0;
  app.toast(s.lobby.mode === 'tee'
    ? { title: 'Start times saved', sub: app.lobby()?.open ? 'Scoring is open.' : `Scoring opens by itself at ${app.lobby()?.opensLabel || ''}.` }
    : { title: 'Teams saved', sub: 'Every phone shows them next time it opens.' });
}

/** The share text for a Team Ryder Cup round (RULES §7). */
export function ryderShareText(round, link) {
  const r = round.roster, st = round.settings;
  const sideName = (id) => r.sides.find((x) => x.id === id)?.name || '';
  const cartName = (tid) => r.teams.find((t) => t.id === tid)?.name || tid;
  const t0 = (st.teeTimes || [])[0];
  const lines = [
    `${round.course.shortName || round.course.name}${t0 ? ` · first tee ${teeTimeName(st, 0).replace(' tee time', '')}` : ''}`,
    `Join: ${link}`, '',
    `${sideName('1')} v ${sideName('2')}`,
    ...r.sides[0].teamIds.map((tid, k) => `${teeTimeName(st, k)}: ${cartName(tid)} v ${cartName(r.sides[1].teamIds[k])}`), '',
    'New opponent every 6 holes. 12 matches, 6½ wins the cup.',
  ];
  return lines.join('\n');
}

/** ④ Partner “Rider” Cup: 8 players in 4 carts, or 6 in 3. */
// ───────────────────────────────────────────── team names per crew (feature 009-team-names-per-crew)

const pairKey = (s, id) => {
  const ids = s.players.filter((p) => p.teamId === id).map((p) => p.personId);
  return ids.length === 2 ? [...ids].sort().join('|') : null;
};
const usualOf = (s, id) => (pairKey(s, id) && s.usual?.[pairKey(s, id)]) || null;

/** Pairs that played together before get their usual name back (unless someone named the cart by hand). */
function applyUsual(s) {
  for (const t of s.teams) {
    if (!cartIds(s).includes(t.id)) continue;
    const key = pairKey(s, t.id);
    if (t.auto && t.autoKey !== key) { t.name = ''; t.auto = false; }
    if (t.name || !key) continue;
    const u = s.usual?.[key];
    if (u && !s.teams.some((x) => x.id !== t.id && same(x.name, u.name))) Object.assign(t, { name: u.name, auto: true, autoKey: key });
  }
}

function cartTag(s, id) {
  const u = usualOf(s, id);
  const t = s.teams.find((x) => x.id === id);
  const mine = s.players.some((p) => p.teamId === id && p.personId === meOf(s));
  if (!u) return 'New pair';
  if (t?.name && same(t.name, u.name)) return mine ? 'Your usual' : 'Their usual';
  return '';
}

export function teamNameSheet(app, { id, q = '' }, head) {
  const s = app.setup;
  const t = s?.teams.find((x) => x.id === id);
  if (!t) return head('Name cart');
  const pair = s.players.filter((p) => p.teamId === id).map((p) => p.firstName || p.name).join(' + ');
  const u = usualOf(s, id);
  const mine = s.players.some((p) => p.teamId === id && p.personId === meOf(s));
  const takenBy = (n) => s.teams.find((x) => x.id !== id && cartIds(s).includes(x.id) && same(x.name, n));
  const usedOn = u?.last ? new Date(`${u.last}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase() : '';
  const usual = u ? `<div class="ts-label tn-k">${mine ? 'Your usual' : 'Their usual'}</div>
    <div class="usual-card"><span class="uc-main"><span class="uc-name ellipsis">${esc(u.name)}</span><span class="ts-label uc-stats">Used ${u.uses} time${u.uses === 1 ? '' : 's'}${usedOn ? ` · last ${usedOn}` : ''}</span></span>
      ${same(t.name, u.name) ? '<span class="ts-label uc-tag">In use</span>' : takenBy(u.name) ? `<span class="ts-label uc-tag dim">Cart ${takenBy(u.name).id}</span>` : `<button class="btn" data-act="tn-pick" data-v="${esc(u.name)}">Use</button>`}</div>` : '';
  const ql = q.trim().toLowerCase();
  const list = TEAM_NAME_PICKS.filter((n) => !ql || n.toLowerCase().includes(ql));
  const custom = q.trim() && !TEAM_NAME_PICKS.some((n) => same(n, q.trim())) ? q.trim().slice(0, 20) : '';
  return `${head(`Name cart ${id}`, pair)}
    ${usual}
    <div class="tn-search"><label class="nr-search">${icon('search', 20)}<input id="tn-q" type="search" maxlength="20" placeholder="Search or type your own" value="${esc(q)}" autocomplete="off" autocapitalize="words" data-input="tn-q" data-enter="tn-custom"></label>
      <button class="btn" data-act="tn-shuffle">${icon('shuffle', 18)} Shuffle</button></div>
    <div id="tn-list">${tnList(s, id, list, custom, takenBy)}</div>`;
}

function tnList(s, id, list, custom, takenBy) {
  const t = s.teams.find((x) => x.id === id);
  return `${custom ? `<button class="tn-row custom" data-act="tn-pick" data-v="${esc(custom)}">${icon('plus', 18)}<span>Use “${esc(custom)}”</span></button>` : ''}
    <div class="ts-label tn-k">All names · ${list.length}</div>
    <div class="tn-list">${list.map((n) => {
      const other = takenBy(n);
      const on = same(t.name, n);
      return `<button class="tn-row${on ? ' on' : ''}" data-act="tn-pick" data-v="${esc(n)}" ${other ? 'disabled aria-disabled="true"' : ''}>
        <span class="ellipsis">${esc(n)}</span>${other ? `<span class="ts-label tn-tag">Cart ${other.id}</span>` : on ? '<span class="ts-label tn-tag on">In use</span>' : ''}</button>`;
    }).join('')}</div>`;
}

function cartsView(s) {
  applyUsual(s);
  const ids = cartIds(s);
  const idx = (id) => s.players.map((p, i) => [p, i]).filter(([p]) => p.teamId === id).map(([, i]) => i);
  const rows = ids.map((id) => {
    const t = s.teams.find((x) => x.id === id);
    return `<div class="ry-cart rider-cart" style="--jersey:${CART_TINT[id]}">
      <div class="rider-cart-k"><span class="lbl">Cart ${id}</span>
        <button class="tn-cart rider-tn" data-act="tn-open" data-v="${id}" aria-label="Name cart ${id}: ${esc(t.name || 'not named')}"><span class="ellipsis${t.name ? '' : ' empty'}">${esc(t.name || 'Pick a name')}</span>${cartTag(s, id) ? `<span class="ts-label tn-cart-tag">${esc(cartTag(s, id))}</span>` : ''}${icon('fwd', 14)}</button></div>
      <div class="ry-cart-pair">${idx(id).map((i) => swapBtn(s, i)).join('')}</div></div>`;
  }).join('');
  return `${topBar(s)}${headline('Step 4 · Carts', 'Who rides together?')}
    <div class="nr-line"><span class="meta">${s.swapSel != null ? 'Now tap who to swap with.' : s.pairedFromLast ? 'Paired like your last round · tap two names to swap.' : 'Tap two names to swap.'}</span><button class="btn small" data-act="setup-shuffle">Shuffle</button></div>
    ${rows}
    ${bottom('Next: tee times', 'setup-go', { v: 'tee', arrow: true })}`;
}

/** Partner “Rider” Cup tee times: who tees off together = the first matchups. */
function riderGroups(s) {
  const ids = cartIds(s);
  if (ids.length === 3) return [['A', 'B'], ['C']];
  return cartRotation(s.schedule, s.opps)[0].matches.map((m) => [...m]);
}

/** ⑤ Who tees off together? Tap two carts to swap them; your three matches; matchups optional. */
function riderTeeView(s) {
  ensureCarts(s);
  applyUsual(s);
  const ids = cartIds(s);
  const name = (id) => s.teams.find((x) => x.id === id)?.name || `Cart ${id}`;
  const times = s.settings.teeTimes || [];
  const ord = ['1st', '2nd', '3rd', '4th'];
  const chip = (id) => `<button class="ry-pick rider-pick${s.rySel === id ? ' sel' : ''}" style="--jersey:${CART_TINT[id]}" data-act="setup-rider-swap" data-v="${id}" aria-pressed="${s.rySel === id}"><span class="ellipsis">${esc(name(id))}</span></button>`;
  const rows = riderGroups(s).map((g, k) => `<div class="ry-tee">
      <div class="ry-tee-k"><span class="lbl">${ord[k]}</span>
        <input class="ry-time mono${times[k] ? ' set' : ''}" type="time" value="${esc(times[k] || '')}" aria-label="${ord[k]} tee time" data-input="setup-ry-time" data-i="${k}">${times[k] ? '' : '<span class="ry-time-ph">Add time</span>'}</div>
      <div class="ry-tee-pair">${chip(g[0])}<span class="meta">${g[1] ? 'v' : ''}</span>${g[1] ? chip(g[1]) : '<span></span>'}</div></div>`).join('');
  const rot = ids.length === 3 ? threeCartRotation() : cartRotation(s.schedule, s.opps);
  const mine = rot.flatMap((r) => r.matches.filter((m) => m.includes('A')).map((m) => [r.holes, m[0] === 'A' ? m[1] : m[0]]));
  const groupOf = (id) => riderGroups(s).findIndex((g) => g.includes(id));
  const my = mine.map(([holes, o]) => `<div class="ry-my"><span class="mono">${holes[0]}–${holes[1]}</span><span class="ellipsis" style="color:${CART_TINT[o]}">${esc(name(o))}</span><span class="meta">${groupOf(o) === groupOf('A') ? 'same tee time' : ord[groupOf(o)]}</span></div>`).join('');
  const sched = ids.length === 3 ? 'everyone plays everyone' : s.schedule === 'turn' ? 'switch at the turn' : 'switch every 6';
  return `${topBar(s)}${headline('Step 5 · Tee times', 'Who tees off together?', s.rySel ? 'Now tap the cart to swap with.' : 'Tap two carts to swap them.')}
    ${rows}
    <div class="lbl ry-pool-k">Your matches · ${esc(name('A'))}</div>
    ${my}
    <button class="nr-row" data-act="setup-go" data-v="matchups"><span style="flex:1;min-width:0"><b class="rt">Game &amp; matchups</b><span class="rs ellipsis">${esc(`${rulesSummary(s).split(' · ').slice(0, 2).join(' · ')} · ${sched}`)}</span></span><span class="meta">Optional</span>${icon('fwd', 18)}</button>
    ${bottom(s.saving ? 'Starting…' : `Start round · ${s.players.length} players`, 'setup-save', { busy: s.saving })}`;
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
  const ry = gameOf(s) === 'ryder';
  return `<div class="live-top"><div class="live-check">${icon('check', 28)}</div>
      <h1 class="nr-title">Round is live</h1>
      <div class="nr-sub">${esc([c?.shortName || c?.name, prettyDate(todayISO()), s.tee ? `${s.tee.name} tees` : '', `${n} player${n === 1 ? '' : 's'}`].filter(Boolean).join(' · '))}</div></div>
    <div class="saved-box">
      <div class="lbl">Join code</div><div class="big-code mono">${esc(v.code)}</div>
      <div class="mono meta live-link">${esc(roundLink(v.code).replace(/^https?:\/\//, ''))}</div>
      ${ry ? `<div class="nr-two"><button class="btn" data-act="setup-copy" data-v="link">Copy link</button><button class="btn" data-act="setup-copy" data-v="text">Copy the text</button></div>`
        : `<div class="nr-two"><button class="btn primary" data-act="setup-copy" data-v="share">${icon('share', 18)} Text the group</button><button class="btn" data-act="setup-copy" data-v="link">Copy link</button></div>`}
    </div>
    ${ry ? `<pre class="ry-share">${esc(ryderShareText(buildRound(s), roundLink(v.code)))}</pre>` : ''}
    <div class="saved-box secret">
      <div class="sec-k">${icon('lock', 16)} Organizer only · screenshot this, keep it private</div>
      <div class="sec-grid"><span class="soft">Admin PIN</span><span class="mono sec-pin">${esc(v.admin_pin)}</span>
        <span class="soft">Host link</span><span class="sec-link"><span class="mono ellipsis">${esc(roundLink(v.code, '/host').replace(/^https?:\/\//, ''))}</span><button class="btn small" data-act="setup-copy" data-v="host">Copy</button></span></div>
      <div class="meta">Lets you fix scores and the scorecard from any phone if this one dies.</div>
    </div>
    ${ry ? `<div class="nr-foot"><button class="btn primary nr-cta" data-act="setup-copy" data-v="share">${icon('share', 18)} Text the group</button><button class="link-btn" style="margin-top:8px" data-act="setup-open">Open the round</button></div>` : bottom('Open the round', 'setup-open')}`;
}

const VIEWS = { course: courseView, which: whichView, players: playersView, check: checkView, game: gameView, invite: inviteView, when: whenView, teams: (s) => (s.game === 'carts' ? cartsView(s) : s.game === 'ryder' ? ryCartsView(s) : pairsView(s)), matchups: matchupsView, draft: ryDraftView, tee: (s) => (s.game === 'carts' ? riderTeeView(s) : ryTeeView(s)) };


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
  if (FLAGS.gps && status === 'ready') loadGeo(c); // a course we already have the card for: get its greens now
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
    if (app.setup?.lobby) app.setup = null; // 025: a lobby edit belongs to its round, never to New round
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
      // The crew Home shows (feature 006), else the newest crew from your rounds.
      const crew = app.setup.crewId || db.crews.current()?.id || db.recent.all().find((r) => r.crew_id)?.crew_id;
      if (crew && !app.setup.crewId && !app.setup.players.length) app.setup.crewId = crew;
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
    const back = s && !s.saved ? backOf(s) : null;
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
      s.players.push(newPlayer({ personId: pick?.personId, firstName: first, lastName: last, nickname: nick, strokes: lastHcpOf(s, pick?.personId) }));
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
      s.players.push(newPlayer({ personId: p.personId, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname, strokes: lastHcpOf(s, p.personId) }));
      persist(s);
      app.render();
    },
    // Handicap sheet (designspec §6b): tap an HCP pill → stepper, "was 17 last round", full / no strokes.
    'setup-hcp': (el, ev, app) => app.openSheet('hcp', { i: Number(el.dataset.i) }),
    'hcp-step': (el, ev, app) => {
      const p = app.setup?.players[Number(el.dataset.i)];
      if (!p) return;
      const d = Number(el.dataset.d);
      if (p.strokes === '' || p.strokes == null) {
        if (d < 0) return;
        p.strokes = lastHcpOf(app.setup, p.personId) || '1'; // from "no strokes": start at last round's number
      } else {
        p.strokes = String(Math.max(0, Math.min(54, Number(p.strokes) + d)));
      }
      persist(app.setup);
      app.openSheet('hcp', { i: Number(el.dataset.i) });
      app.render();
    },
    'hcp-type': (el, ev, app) => {
      const p = app.setup?.players[Number(el.dataset.i)];
      if (!p) return;
      const v = el.value.replace(/[^0-9]/g, '').slice(0, 2);
      if (v !== el.value) el.value = v;
      p.strokes = v === '' ? '' : String(Math.min(54, Number(v)));
      persist(app.setup);
    },
    'hcp-mode': (el, ev, app) => {
      const s = app.setup;
      const p = s?.players[Number(el.dataset.i)];
      if (!p) return;
      if (el.dataset.v === 'none') { if (p.strokes !== '') p.prevStrokes = p.strokes; p.strokes = ''; }
      else p.strokes = p.prevStrokes || lastHcpOf(s, p.personId) || p.strokes || '0';
      persist(s);
      app.openSheet('hcp', { i: Number(el.dataset.i) });
      app.render();
    },
    'hcp-done': (el, ev, app) => {
      app.closeSheet();
      app.render();
    },
    'tn-open': (el, ev, app) => app.openSheet('teamName', { id: el.dataset.v, q: '' }),
    'tn-q': (el, ev, app) => {
      const s = app.setup;
      const id = app.sheet.props.id;
      app.sheet.props.q = el.value;
      const ql = el.value.trim().toLowerCase();
      const list = TEAM_NAME_PICKS.filter((n) => !ql || n.toLowerCase().includes(ql));
      const custom = el.value.trim() && !TEAM_NAME_PICKS.some((n) => same(n, el.value.trim())) ? el.value.trim().slice(0, 20) : '';
      const takenBy = (n) => s.teams.find((x) => x.id !== id && cartIds(s).includes(x.id) && same(x.name, n));
      const box = document.getElementById('tn-list');
      if (box) box.innerHTML = tnList(s, id, list, custom, takenBy);
    },
    'tn-pick': (el, ev, app) => {
      const s = app.setup;
      const t = s.teams.find((x) => x.id === app.sheet.props.id);
      if (s.teams.some((x) => x !== t && cartIds(s).includes(x.id) && same(x.name, el.dataset.v))) return;
      Object.assign(t, { name: el.dataset.v.slice(0, 20), auto: false });
      persist(s);
      app.closeSheet();
      app.render();
    },
    'tn-custom': (el, ev, app) => {
      const v = el.value.trim().slice(0, 20);
      if (!v) return;
      el.dataset.v = v;
      app.actions['tn-pick'](el, ev, app);
    },
    'tn-shuffle': (el, ev, app) => {
      const s = app.setup;
      const id = app.sheet.props.id;
      const free = TEAM_NAME_PICKS.filter((n) => !s.teams.some((x) => cartIds(s).includes(x.id) && same(x.name, n)));
      const n = free[Math.floor(Math.random() * free.length)];
      if (!n) return;
      Object.assign(s.teams.find((x) => x.id === id), { name: n, auto: false });
      persist(s);
      app.closeSheet();
      app.render();
    },
    'setup-ry-pick': (el, ev, app) => {
      const s = app.setup;
      const d = rySides(s);
      if (d.done) return;
      s.ryPicks = [...d.picks, Number(el.dataset.i)];
      s.ryTee = null;
      persist(s);
      app.render();
    },
    'setup-rider-swap': (el, ev, app) => {
      const s = app.setup;
      const id = el.dataset.v;
      if (s.rySel == null) s.rySel = id;
      else if (s.rySel === id) s.rySel = null;
      else {
        const a = s.rySel, b = id;
        s.players.forEach((p) => { if (p.teamId === a) p.teamId = b; else if (p.teamId === b) p.teamId = a; });
        const ta = s.teams.find((t) => t.id === a), tb = s.teams.find((t) => t.id === b);
        if (ta && tb) { const keep = ['name', 'auto', 'autoKey']; for (const k of keep) [ta[k], tb[k]] = [tb[k], ta[k]]; }
        s.rySel = null;
        persist(s);
      }
      app.render();
    },
    'setup-ry-reset': (el, ev, app) => {
      Object.assign(app.setup, { ryPicks: [], rySkip: false, ryTee: null, rySel: null });
      persist(app.setup);
      app.render();
    },
    'setup-ry-skip': (el, ev, app) => {
      const s = app.setup;
      Object.assign(s, { ryPicks: [], rySkip: true, ryTee: null, rySel: null, screen: s.lobby ? 'draft' : 'tee' });
      persist(s);
      app.render();
    },
    'setup-ry-tee': (el, ev, app) => {
      const s = app.setup;
      const k = Number(el.dataset.i);
      if (s.rySel == null) s.rySel = k;
      else if (s.rySel === k) s.rySel = null;
      else {
        const t = [...ryTee(s)];
        [t[k], t[s.rySel]] = [t[s.rySel], t[k]];
        s.ryTee = t;
        s.rySel = null;
        persist(s);
      }
      app.render();
    },
    'setup-ry-time': (el, ev, app) => {
      const s = app.setup;
      const t = [...(s.settings.teeTimes || [])];
      while (t.length < 4) t.push('');
      t[Number(el.dataset.i)] = /^\d{1,2}:\d{2}$/.test(el.value) ? el.value : '';
      s.settings.teeTimes = t;
      persist(s);
      app.render();
    },
    'setup-lobby-save': (el, ev, app) => saveLobbyStep(app),
    'setup-lobby-cancel': (el, ev, app) => { app.setup = null; app.render(); },
    'setup-when': (el, ev, app) => {
      const s = app.setup;
      s.when = { ...(s.when || { date: nextSaturday(), time: '08:00' }), [el.dataset.k]: el.value };
      persist(s);
    },
    'setup-sidename': (el, ev, app) => {
      const s = app.setup;
      s.sideNames = Array.isArray(s.sideNames) ? [...s.sideNames] : ['', ''];
      s.sideNames[Number(el.dataset.i)] = el.value.slice(0, 20);
      persist(s);
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
      let res, round;
      const lobby = s.screen === 'when' && gameOf(s) === 'ryder'; // 025: Invite now, draft later
      try {
        if (lobby && !(/^\d{4}-\d{2}-\d{2}$/.test(s.when?.date || '') && /^\d{1,2}:\d{2}$/.test(s.when?.time || ''))) throw new Error('Pick a date and a start time.');
        round = lobby ? buildLobby(s) : buildRound(s);
      } catch (e) {
        // A bug building the round is not a signal problem: say so instead of "No signal" (Nov 4).
        s.saving = false;
        app.render();
        app.toast({ title: 'Couldn’t start the round', sub: e?.message || 'Something in Setup is off. Go back a step and try again.', error: true });
        return;
      }
      try {
        res = await db.api.createEvent(round);
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
      if (lobby) {
        // Straight to Host's lobby view with the invite share sheet open (the organizer joins as himself there).
        db.admin.set(res.code, res.admin_pin);
        db.local.del(DRAFT_KEY);
        db.recent.remember({ code: res.code, name: round.name, played_on: round.playedOn, crew_id: res.crew_id, course: round.course, settings: round.settings });
        app.setup = null;
        app.ui.lobbyShare = res.code;
        app.go(`#/e/${res.code}/host`);
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
      const ry = gameOf(app.setup) === 'ryder' ? ryderShareText(buildRound(app.setup), link) : null;
      if (el.dataset.v === 'text' && ry) {
        const ok = await copyText(ry);
        app.toast({ title: ok ? 'Copied' : 'Couldn’t copy' });
        return;
      }
      if (el.dataset.v === 'share' && navigator.share) {
        try {
          await navigator.share(ry ? { title: 'Team Ryder Cup', text: ry } : { title: 'Golf Live Board', text: `Join code ${v.code}`, url: link });
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
        if (g !== s.game || (g !== '2v2' && g !== 'carts' && g !== 'ryder')) return;
        if (g === 'carts') ensureCarts(s);
      }
      if (to === 'matchups' || to === 'tee') { if (gameOf(s) === 'carts') ensureCarts(s); }
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
    // Quick players (feature 007)
    'qp-toggle': (el, ev, app) => {
      if (ev?.target?.closest?.('[data-act="setup-hcp"]')) return;
      const s = app.setup;
      const pid = el.dataset.v;
      const i = s.players.findIndex((x) => x.personId === pid);
      if (i >= 0) s.players.splice(i, 1);
      else {
        const p = s.past.find((x) => x.personId === pid);
        if (!p) return;
        s.players.push(newPlayer({ personId: p.personId, firstName: p.firstName, lastName: p.lastName, nickname: p.nickname, strokes: lastHcpOf(s, p.personId) }));
      }
      persist(s);
      const box = document.getElementById('qp-results');
      if (box) box.innerHTML = quickResults(s);
      else app.render();
    },
    'qp-group': (el, ev, app) => {
      const s = app.setup;
      const g = s.groups?.[Number(el.dataset.i)];
      if (!g) return;
      for (const p of g.people) {
        if (s.players.some((x) => x.personId === p.personId)) continue;
        const known = s.past.find((x) => x.personId === p.personId) || p;
        s.players.push(newPlayer({ personId: p.personId, firstName: known.firstName, lastName: known.lastName, nickname: known.nickname, strokes: lastHcpOf(s, p.personId) }));
      }
      persist(s);
      app.render();
    },
    'qp-before': (el, ev, app) => {
      const s = app.setup;
      const p = (s.pastPeople || []).find((x) => x.personId === el.dataset.v);
      if (!p || s.players.some((x) => x.personId === p.personId)) return;
      const nm = names.splitName(p.name);
      s.players.push(newPlayer({ personId: p.personId, firstName: nm.first, lastName: nm.last }));
      persist(s);
      const box = document.getElementById('qp-results');
      if (box) box.innerHTML = quickResults(s);
    },
    'qp-search': (el, ev, app) => {
      app.setup.qpSearch = true;
      app.render({ force: true });
      document.getElementById('new-player')?.focus();
    },
    'qp-search-done': (el, ev, app) => {
      app.setup.qpSearch = false;
      app.setup.newName = '';
      app.setup.nickAsk = null;
      app.render({ force: true });
    },
    'qp-query': (el, ev, app) => {
      const s = app.setup;
      s.newName = el.value;
      if (s.nickAsk) { s.nickAsk = null; app.render({ force: true }); document.getElementById('new-player')?.focus(); return; }
      const box = document.getElementById('qp-results');
      if (box) box.innerHTML = quickResults(s);
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
