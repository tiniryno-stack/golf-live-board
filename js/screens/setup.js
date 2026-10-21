// setup.js — organizer flow: Course → Players → Teams → Matchups → Game → Save.
// Course: search by name, or courses near you (looked up as soon as Setup opens; the one you're
// standing at goes on top as "Looks like you're at"). OpenGolfAPI, js/coursedata.js; your group's
// courses come first (built-in ones, and the copy from your last round there, with any fixes).
// Picking a course fetches its scorecard in the background while you set up the rest; Save
// has a scorecard check (fix pars / hole handicaps) and won't save a card with gaps.
// Can't find it: enter the scorecard yourself. Nothing is preselected.
// "Run it back" (#/setup/CODE) copies players, team names, carts and settings from a past
// round (not the course).

import { esc, icon, seg, todayISO, prettyDate, copyText, roundLink } from '../ui.js';
import { COURSES } from '../courses.js';
import * as cd from '../coursedata.js';
import { DEFAULT_SETTINGS, DEFAULT_ROTATION, holesLabel } from '../scoring.js';
import { TEAM_NAME_PICKS } from '../teams.js';
import * as db from '../db.js';
import * as names from '../names.js';

const STEPS = ['Course', 'Players', 'Teams', 'Matchups', 'Game', 'Save'];
const TEAM_IDS = ['A', 'B', 'C', 'D'];
const MATCHINGS = [
  [['A', 'B'], ['C', 'D']],
  [['A', 'C'], ['B', 'D']],
  [['A', 'D'], ['B', 'C']],
];
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
  p.name = names.fullName(p, { withNick: true });
  return p;
}
function newPlayer({ personId, firstName, lastName = '', nickname = '' }) {
  return withName({ key: db.uuid(), personId: personId || db.uuid(), firstName, lastName, nickname, strokes: '', teamId: null, groupId: 'g1' });
}
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function blank(from = null) {
  const { rotation, ...settings } = DEFAULT_SETTINGS;
  return {
    step: 0, from, loadingFrom: !!from, courseId: null, tee: null, name: '',
    course: null, courseStatus: 'idle', mine: [], q: '', results: null, searching: false, searchError: '',
    near: null, nearStatus: 'idle', loc: null, editCard: false,
    players: [], teams: TEAM_IDS.map((id) => ({ id, name: '' })),
    rotation: clone(DEFAULT_ROTATION), settings: { ...settings, rotationMode: 'swap' },
    crewId: null, crewFromSource: false, past: [], newName: '', nickAsk: null,
    saving: false, saved: null,
  };
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
    for (const { event } of rounds) {
      for (const p of event.roster?.players || []) if (p.personId) people.set(p.personId, p.name);
      if (event.course?.id) courses.set(event.course.id, event.course);
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
      app.setup.mine = yourCourses([...courses.values()].reverse());
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
    if (Array.isArray(rotation) && rotation.length === 3) s.rotation = clone(rotation);
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
          ? `<p class="meta">No courses match \u201c${esc(q)}\u201d. Try part of the name, or enter the scorecard yourself.</p>`
          : '';
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
  return `<p class="meta" style="margin:14px 0 4px">Can\u2019t find it? <button class="link-btn inline" data-act="setup-manual">Enter the scorecard yourself</button></p>
    <p class="meta attrib">Course data ${esc(cd.ATTRIBUTION)}</p>`;
}

/** Status of the picked course's scorecard, one line. */
function cardStatus(s, c) {
  if (s.courseStatus === 'loading') return '<div class="sc-line"><span class="spinner tiny" aria-hidden="true"></span><span>Getting the scorecard…</span></div>';
  if (s.courseStatus === 'error') return '<div class="sc-line warn"><span>Couldn\u2019t get the scorecard. <button class="link-btn inline" data-act="setup-course-retry">Try again</button>, or fill it in on the last step.</span></div>';
  if (c.source === 'manual') return '<div class="sc-line"><span>You\u2019ll fill in the scorecard on the last step.</span></div>';
  const issues = cd.scorecardProblems(c);
  if (issues.length) return `<div class="sc-line warn"><span>${esc(issues[0])} You\u2019ll fix it on the last step.</span></div>`;
  const par = c.par.reduce((a, b) => a + b, 0);
  return `<div class="sc-line good">${icon('check', 16)}<span>Scorecard ready · par ${par} · ${esc(SOURCE_LABEL[c.source] || 'ready')}</span></div>`;
}

/** Save step: the scorecard to check (and fix) before the round is created. */
function scorecardCard(s) {
  const c = course(s);
  if (!c) return '';
  if (s.courseStatus === 'loading') return `<div class="card sc-card"><div class="micro">Scorecard</div>${cardStatus(s, c)}</div>`;
  const issues = c.source === 'manual' && !c.par.some(Boolean) ? ['Fill in the par and hole handicap for each hole.'] : cd.scorecardProblems(c);
  const open = s.editCard || issues.length;
  const par = (c.par || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const half = (from) => `<div class="par-grid sc-grid"><span class="micro">Hole</span><span class="micro">Par</span><span class="micro">Hcp</span>
    ${Array.from({ length: 9 }, (_, k) => {
      const i = from + k;
      return `<span class="h">${i + 1}</span>
      <input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="1" value="${esc(c.par?.[i] ?? '')}" aria-label="Par hole ${i + 1}" data-input="setup-scpar" data-i="${i}">
      <input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="2" value="${esc(c.strokeIndex?.[i] ?? '')}" aria-label="Handicap hole ${i + 1}" data-input="setup-scsi" data-i="${i}">`;
    }).join('')}</div>`;
  const grid = `<div class="sc-halves">${half(0)}${half(9)}</div>
  <p class="help" style="margin:10px 0 0">Copy these from the card. Hcp is the hole handicap: 1 is the hardest hole, 18 the easiest, each number once.</p>`;
  return `<div class="card sc-card${issues.length ? ' needs' : ''}">
    <div class="spread"><span class="micro">Scorecard</span><span class="meta">${esc(SOURCE_LABEL[c.source] || '')}</span></div>
    ${issues.length
      ? `<div class="sc-line warn" style="margin:4px 0 10px"><span>${esc(issues[0])}</span></div>`
      : `<div class="sc-line good" style="margin:4px 0 ${open ? '10px' : '0'}">${icon('check', 16)}<span>Par ${par} · hole handicaps 1\u201318</span></div>`}
    ${open ? grid : '<button class="btn small" style="margin-top:10px" data-act="setup-card-edit">Check it against the card</button>'}
    ${c.source === 'opengolfapi' ? `<p class="meta attrib" style="margin:10px 0 0">${esc(cd.ATTRIBUTION)}</p>` : ''}
  </div>`;
}
function teamName(s, id) {
  const t = s.teams.find((x) => x.id === id);
  return (t?.name || '').trim() || `Cart ${id}`;
}
function teamsUsed(s) {
  return TEAM_IDS.filter((id) => s.players.some((p) => p.teamId === id));
}
function hasFullTeams(s) {
  return TEAM_IDS.every((id) => s.players.filter((p) => p.teamId === id).length === 2) && s.players.every((p) => p.teamId);
}

function problems(s) {
  const out = [];
  const c = course(s);
  if (!c) out.push('Pick a course.');
  else if (s.courseStatus === 'loading') out.push('Still getting the scorecard\u2026');
  else {
    if (c.source === 'manual' && !(c.name || '').trim()) out.push('Name the course (on the Course step).');
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
  // Not 4 full carts of 2 (any other number of players): it saves as a plain scorecard +
  // leaderboard round (see buildRound), so nothing to block here.
  return out;
}

/** Fewer or more than 8 players, or carts not filled: scorecard + leaderboard, no cart game.
 *  Up to 4 players all play in one group. */
function casualRound(s) {
  return !hasFullTeams(s);
}
/** Solo match play: 2–4 players, no carts, and the organizer picked Match play. */
function soloOn(s) {
  return casualRound(s) && s.players.length >= 2 && s.players.length <= 4 && !!s.settings.solo;
}

function buildRound(s) {
  const c = course(s);
  const full = hasFullTeams(s);
  const casual = casualRound(s);
  const groupOfTeam = {};
  s.rotation[0].matches.forEach((m, i) => m.forEach((t) => (groupOfTeam[t] = `g${i + 1}`)));
  const shown = names.displayNames(s.players);
  const players = s.players.map((p, i) => ({
    id: `p${i + 1}`, personId: p.personId || db.uuid(), name: shown[i],
    firstName: p.firstName, lastName: p.lastName || '', ...(p.nickname ? { nickname: p.nickname } : {}),
    teamId: casual ? null : p.teamId || null,
    groupId: casual && s.players.length <= 4 ? 'g1' : full && p.teamId ? groupOfTeam[p.teamId] : p.groupId || 'g1',
    strokes: p.strokes === '' || p.strokes == null || Number.isNaN(Number(p.strokes)) ? null : Math.max(0, Math.round(Number(p.strokes))),
  }));
  const teams = casual ? [] : teamsUsed(s).map((id) => ({ id, name: teamName(s, id).slice(0, 20) }));
  return {
    name: s.name.trim() || `${c.shortName || cd.shortCourseName(c.name)} · ${prettyDate(todayISO())}`,
    course: {
      id: c.id, ...(c.ogaId ? { ogaId: c.ogaId } : {}), source: c.source === 'yours' ? c.lastSource || 'yours' : c.source || 'builtin',
      name: c.name.trim(), shortName: c.shortName || cd.shortCourseName(c.name), location: c.location || '',
      ...(c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : {}),
      tee: s.tee, tees: (c.tees || []).map((t) => ({ name: t.name, yards: t.yards ?? null, rating: t.rating ?? null, slope: t.slope ?? null })),
      par: c.par.map(Number), strokeIndex: c.strokeIndex.map(Number),
    },
    roster: { groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }], teams, players },
    settings: casual
      ? { ...s.settings, ...(soloOn(s) ? { game: 'rotationMatch', solo: true } : { game: 'none', solo: false }), rotationMode: 'fixed', rotation: clone(s.rotation) }
      : { ...s.settings, solo: false, rotation: clone(s.rotation) },
    playedOn: todayISO(),
    crewId: s.crewId,
  };
}

// ───────────────────────────────────────────── step views

const VIEWS = {
  Course(s) {
    const c = course(s);
    if (!c) {
      return `<input class="input course-q" id="course-q" type="search" placeholder="Search courses by name" value="${esc(s.q)}" autocomplete="off" autocapitalize="words" enterkeyhint="search" aria-label="Search courses by name" data-input="setup-q">
        <div id="course-results" style="margin-top:14px">${courseList(s)}</div>`;
    }
    const title = c.source === 'manual'
      ? `<input class="input" id="course-name" maxlength="60" placeholder="Course name" value="${esc(c.name)}" aria-label="Course name" data-input="setup-cname">`
      : `<div class="row-title">${esc(c.name)}</div><div class="detail">${esc(c.location || '')}</div>`;
    return `<div class="card course-picked">
      <div class="spread" style="align-items:flex-start;gap:10px"><div style="flex:1;min-width:0">${title}</div>
        <button class="btn small" data-act="setup-unpick">Change</button></div>
      <div style="margin-top:8px">${cardStatus(s, c)}</div>
    </div>
    ${c.tees?.length ? `<div class="micro" style="margin:18px 0 8px">Tees</div>
      <div class="chips">${c.tees.map((t) => `<button class="chip" data-act="setup-tee" data-v="${esc(t.name)}" aria-pressed="${s.tee?.name === t.name}">${esc(t.name)}${t.yards ? ` <span class="soft mono" style="font-size:12px">${t.yards}</span>` : ''}</button>`).join('')}</div>` : ''}
    <div class="field" style="margin-top:18px"><span class="label">First tee</span>${seg('setup-set', [['1', 'Hole 1'], ['10', 'Hole 10']], String(s.settings.startHole || 1), 'data-k="startHole"')}</div>
    <p class="help">Starting on 10? Everything follows the order you play: 10 → 18, then 1 → 9.</p>
    <div class="field"><label for="round-name">Round name</label>
      <input class="input" id="round-name" maxlength="60" value="${esc(s.name)}" placeholder="${esc(c ? `${c.shortName} · ${prettyDate(todayISO())}` : 'e.g. Twin Creeks · Fri')}" data-input="setup-name"></div>
    <p class="meta">You\u2019ll check the scorecard on the last step. The organizer can still fix any hole mid-round from Host.</p>`;
  },

  Players(s) {
    const used = new Set(s.players.map((p) => p.personId));
    const past = s.past.filter((p) => !used.has(p.personId));
    return `${past.length ? `<div class="micro" style="margin:0 0 8px">From past rounds</div>
      <div class="chips" style="margin:0 0 16px">${past.map((p) => `<button class="chip" data-act="setup-past" data-v="${esc(p.personId)}">${icon('plus', 14)} ${esc(p.name)}</button>`).join('')}</div>` : ''}
      <div class="join-row" style="margin:0 0 8px">
        <input class="input" id="new-player" maxlength="48" placeholder="First and last name" value="${esc(s.newName)}" autocapitalize="words" autocomplete="off" data-input="setup-newname" data-enter="setup-add">
        <button class="btn primary" data-act="setup-add"${s.nickAsk ? ' disabled' : ''}>Add</button>
      </div>
      ${s.nickAsk ? `<div class="card nick-ask">
        <p class="meta" style="margin:0 0 8px">Someone named ${esc(s.nickAsk.first)} ${esc(s.nickAsk.last)} already plays in another crew. Someone new? Add a nickname so they\u2019re their own player.</p>
        <div class="join-row"><input class="input" id="new-nick" maxlength="24" placeholder="Nickname, e.g. Big ${esc(s.nickAsk.first)}" autocapitalize="words" autocomplete="off" data-enter="setup-add">
          <button class="btn primary" data-act="setup-add">Add</button></div>
        <button class="link-btn" style="margin-top:8px" data-act="setup-nick-cancel">Cancel</button>
      </div>` : ''}
      <p class="help" style="margin:4px 0 0">Only first names show during the round. Last names keep two Andrews apart in the season standings.</p>
      <p class="help" style="margin:4px 0 10px">Strokes are optional. Blank = plays even. Giving a newer player 15 strokes = 1 stroke on the 15 hardest holes.</p>
      <div>${s.players.map((p, i) => `<div class="player-row">
          ${p.lastName && !p.needsNick
            ? `<span class="pname ellipsis">${esc(p.name)}</span>`
            : `<span class="pname"><span class="ellipsis" style="display:block">${esc(p.name)}</span>${p.lastName
              ? `<input class="input name-fill" maxlength="24" placeholder="Nickname (name\u2019s taken)" value="${esc(p.nickname)}" aria-label="Nickname for ${esc(p.name)}" data-input="setup-nick" data-i="${i}">`
              : `<input class="input name-fill" maxlength="30" placeholder="Last name" autocapitalize="words" autocomplete="off" aria-label="Last name for ${esc(p.firstName)}" data-input="setup-last" data-i="${i}">`}</span>`}
          <input class="input num" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="even" aria-label="Strokes for ${esc(p.name)}" value="${esc(p.strokes ?? '')}" data-input="setup-strokes" data-i="${i}">
          <button class="x" data-act="setup-remove" data-i="${i}" aria-label="Remove ${esc(p.name)}">${icon('close', 18)}</button>
        </div>`).join('') || '<p class="meta">No players yet.</p>'}</div>
      <p class="meta" style="margin-top:10px">${s.players.length} player${s.players.length === 1 ? '' : 's'}${s.players.length && s.players.length !== 8 ? ' · the rotating game is built for 8 (4 carts of 2)' : ''}</p>`;
  },

  Teams(s) {
    const counts = Object.fromEntries(TEAM_IDS.map((id) => [id, s.players.filter((p) => p.teamId === id).length]));
    return `<div class="micro" style="margin:0 0 8px">Team names</div>
      <div class="name-grid">${TEAM_IDS.map((id) => `<label class="team-name-cell" style="--jersey:var(--t-${id})">
          <span class="spread"><span class="cart-tag"><i class="jdot"></i>Cart ${id}</span><span class="mono ${counts[id] === 2 ? 'good' : 'soft'}" style="font-size:12px">${counts[id]}/2</span></span>
          <input class="input" maxlength="20" placeholder="Cart ${id}" value="${esc(s.teams.find((t) => t.id === id).name)}" aria-label="Team name for cart ${id}" data-input="setup-teamname" data-v="${id}">
          <span class="meta ellipsis">${esc(s.players.filter((p) => p.teamId === id).map((p) => p.name).join(' + ') || 'empty')}</span>
        </label>`).join('')}</div>
      <p class="help" style="margin:8px 0 18px">Optional. Leave a name blank and that cart picks its own when they join (${esc(TEAM_NAME_PICKS.slice(0, 3).join(', '))}…).</p>
      <div class="micro" style="margin:0 0 4px">Who\u2019s in each cart</div>
      <div style="margin:0 0 8px">${s.players.map((p, i) => `<div class="player-row">
          <span class="pname ellipsis">${esc(p.name)}</span>
          <div class="team-picks">${TEAM_IDS.map((id) => `<button data-act="setup-team" data-i="${i}" data-v="${id}" aria-pressed="${p.teamId === id}" aria-label="${esc(p.name)} to cart ${id}">${id}</button>`).join('')}</div>
        </div>`).join('') || '<p class="meta">Add players first.</p>'}</div>`;
  },

  Matchups(s) {
    if (casualRound(s) && s.players.length <= 4) {
      return `<p class="soft" style="margin:0 0 8px">${s.players.length || 'No'} player${s.players.length === 1 ? '' : 's'}: everyone plays in one group and enters scores together. Pick Match play or a straight scorecard on the next step.</p>
        <p class="meta">The rotating cart game needs 8 players in 4 carts of 2.</p>`;
    }
    const swap = s.settings.rotationMode === 'swap';
    const full = hasFullTeams(s);
    const rot = s.rotation
      .map((r, i) => `<div class="rot-card">
        <div class="micro" style="margin:0 0 4px">Rotation ${i + 1} · ${esc(holesLabel(s.settings, r.holes[0], r.holes[1]).toLowerCase())}</div>
        ${r.matches.map((m) => `<div class="row-title" style="font-size:16px">${esc(teamName(s, m[0]))} <span class="vs">vs</span> ${esc(teamName(s, m[1]))}</div>`).join('')}
      </div>`)
      .join('');
    const groups = full
      ? `<p class="meta">${swap ? `${holesLabel(s.settings, 1, 6)} foursomes` : 'Fixed foursomes'}: Group 1 = ${esc(s.rotation[0].matches[0].map((t) => teamName(s, t)).join(' + '))} · Group 2 = ${esc(s.rotation[0].matches[1].map((t) => teamName(s, t)).join(' + '))}</p>`
      : `<div class="micro" style="margin:12px 0 8px">Foursomes</div>${s.players.map((p, i) => `<div class="player-row"><span class="pname">${esc(p.name)}</span>
          <div class="team-picks" style="grid-template-columns:repeat(2,52px)">${['g1', 'g2'].map((g, gi) => `<button data-act="setup-group" data-i="${i}" data-v="${g}" aria-pressed="${(p.groupId || 'g1') === g}">G${gi + 1}</button>`).join('')}</div></div>`).join('')}`;
    return `<div class="stack" style="gap:10px;margin:0 0 14px">
        <button class="pill" data-act="setup-swap" aria-pressed="${swap}"><span class="dot"></span>Carts swap foursomes every 6 holes</button>
        <p class="meta" style="margin:0">${swap ? 'At holes 7 and 13 one cart waits and one moves up, so every matchup is played face to face.' : 'Group 1 and Group 2 stay together all day; rotations 2–3 compare scores across groups.'}</p>
      </div>
      ${full ? `${rot}<button class="btn ghost block" data-act="setup-shuffle">${icon('shuffle', 18)} Shuffle matchups</button>` : '<p class="meta">Fill 4 carts of 2 on Teams to see the matchups.</p>'}
      <div style="margin-top:14px">${groups}</div>`;
  },

  Game(s) {
    const st = s.settings;
    const pm = st.game === 'rotationPlusMinus';
    if (casualRound(s)) {
      const canSolo = s.players.length >= 2 && s.players.length <= 4;
      const solo = canSolo && !!st.solo;
      return `${canSolo ? `<div class="field"><span class="label">Game</span>${seg('setup-solo', [['off', 'Scorecard only'], ['on', 'Match play']], solo ? 'on' : 'off')}</div>
        <p class="help">${solo
          ? 'Everyone plays their own ball. Each hole is worth 1 point: low score takes it, a tie for low splits it (½, ⅓ or ¼ each). Most points after 18 wins.'
          : 'Straight scorecard and leaderboard (gross and net).'}</p>`
        : `<p class="soft" style="margin:0 0 8px">With ${s.players.length} player${s.players.length === 1 ? '' : 's'} it\u2019s a straight scorecard and leaderboard (gross and net). The cart game needs 8 players in 4 carts of 2.</p>`}
        <div class="field"><span class="label">Max hole score (pick-up)</span>${seg('setup-set', [['doublePar', 'Double par'], ['netDoubleBogey', 'Net dbl bogey'], ['none', 'None']], st.maxHoleScore, 'data-k="maxHoleScore"')}</div>`;
    }
    return `<div class="field"><span class="label">Game</span>${seg('setup-set', [['none', 'None'], ['rotationMatch', 'Match Play'], ['rotationPlusMinus', 'Plus/Minus']], st.game, 'data-k="game"')}</div>
      <p class="help">${st.game === 'rotationMatch' ? 'Points bank every hole; most points after 18 wins the day.' : pm ? 'Zero-sum: each rotation starts even, margins carry all day.' : 'Just the live scorecard and leaderboard.'}</p>
      ${st.game !== 'none' ? `<div class="field"><span class="label">Team score</span>${seg('setup-set', [['bestBallAggregate', 'Low Ball/Total'], ['bestBall', 'Best ball'], ['aggregate', 'Aggregate']], st.teamScore, 'data-k="teamScore"')}</div>` : ''}
      <div class="field"><span class="label">Max hole score (pick-up)</span>${seg('setup-set', [['doublePar', 'Double par'], ['netDoubleBogey', 'Net dbl bogey'], ['none', 'None']], st.maxHoleScore, 'data-k="maxHoleScore"')}</div>
      <div class="chips" style="margin:0 0 16px"><button class="pill" data-act="setup-toggle" data-k="par3NoMax" aria-pressed="${!!st.par3NoMax}"><span class="dot"></span>No max on par 3s</button></div>
      ${st.game === 'rotationMatch' ? `<div class="field"><span class="label">Halved points</span>${seg('setup-set', [['0.5', '½ each'], ['0', 'Nothing']], String(st.halvedHolePoints), 'data-k="halvedHolePoints"')}</div>` : ''}
      ${st.game === 'rotationMatch' ? `<div class="field"><span class="label">Matchup win bonus</span>${seg('setup-set', [['1', '+1 point'], ['0', 'None']], String(st.matchBonus ?? 1), 'data-k="matchBonus"')}</div>` : ''}
      ${pm ? `<div class="field"><span class="label">Max swing per rotation</span>${seg('setup-set', [['', 'Uncapped'], ['3', '3'], ['5', '5']], st.plusMinusCap == null ? '' : String(st.plusMinusCap), 'data-k="plusMinusCap"')}</div>` : ''}
      <details class="fold"${st.handicapMode !== 'full' || Number(st.allowancePct) !== 100 ? ' open' : ''}><summary>Advanced</summary>
        <div class="chips" style="margin:4px 0 12px"><button class="pill" data-act="setup-lowman" aria-pressed="${st.handicapMode === 'offLow'}"><span class="dot"></span>Play off the low man</button></div>
        <div class="field"><label for="allow">Allowance %</label><input class="input num" id="allow" inputmode="numeric" maxlength="3" value="${esc(st.allowancePct)}" data-input="setup-allow" style="width:96px"></div>
        <p class="help">Only if everyone enters a real handicap instead of tee-box strokes.</p>
      </details>`;
  },

  Save(s, app) {
    if (s.saved) return savedView(s);
    const issues = problems(s);
    const c = course(s);
    const r = !issues.length ? buildRound(s) : null;
    return `${issues.length ? `<div class="card" style="margin:0 0 14px;border:1px solid var(--warn)">${issues.map((x) => `<div style="margin:2px 0">${esc(x)}</div>`).join('')}</div>` : ''}
      ${scorecardCard(s)}
      <div class="card" style="margin:0 0 14px">
        <div class="micro">Course</div><div class="row-title" style="margin:2px 0 10px">${c ? esc(c.name) : '—'}${s.tee ? ` · ${esc(s.tee.name)}` : ''}</div>
        <div class="micro">Round</div><div style="margin:2px 0 10px">${esc(r?.name || s.name || '—')}</div>
        <div class="micro">Players</div><div style="margin:2px 0 10px">${s.players.length ? s.players.map((p) => `${esc(p.name)}${p.strokes !== '' && p.strokes != null ? ` <span class="soft">(${esc(p.strokes)})</span>` : ''}`).join(', ') : '—'}</div>
        <div class="micro">First tee</div><div style="margin:2px 0 10px">Hole ${s.settings.startHole === 10 ? '10 (back nine first)' : '1'}</div>
        <div class="micro">Game</div><div style="margin:2px 0 0">${casualRound(s)
          ? soloOn(s)
            ? 'Match play · split point (1 point a hole, ties split) · one group'
            : `Scorecard + leaderboard${s.players.length <= 4 ? ' · one group' : ''}<div class="meta" style="margin-top:2px">The cart game needs 8 players in 4 carts of 2.</div>`
          : `${{ none: 'Scorecard only', rotationMatch: 'Rotation Match Play', rotationPlusMinus: 'Rotation Plus/Minus' }[s.settings.game]}${s.settings.rotationMode === 'swap' ? ' · carts swap' : ' · fixed foursomes'}`}</div>
      </div>
      <button class="btn primary big block" data-act="setup-save" ${issues.length || s.saving ? 'disabled' : ''}>${s.saving ? 'Saving…' : 'Save round'}</button>
      <p class="meta" style="margin-top:10px">Saving makes this phone the organizer.</p>`;
  },
};

function savedView(s) {
  const v = s.saved;
  return `<div class="saved-box">
      <div class="micro">Join code</div><div class="big-code">${esc(v.code)}</div>
      <div class="micro" style="margin-top:12px">Share link · safe for the group chat</div>
      <div class="copy-line"><code>${esc(roundLink(v.code))}</code><button class="btn small" data-act="setup-copy" data-v="share">${icon('copy', 16)} Copy</button></div>
    </div>
    <div class="saved-box secret">
      <div class="micro" style="color:var(--warn)">Organizer only · screenshot this, keep it private</div>
      <div class="spread" style="margin-top:6px"><span>Admin PIN</span><span class="big-code" style="font-size:32px">${esc(v.admin_pin)}</span></div>
      <div class="copy-line"><code>${esc(roundLink(v.code, '/host'))}</code><button class="btn small" data-act="setup-copy" data-v="host">${icon('copy', 16)} Copy</button></div>
    </div>
    <button class="btn primary big block" data-act="setup-open">Open the round</button>`;
}

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
  s.tee = null;
  s.editCard = false;
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
  s.editCard = true;
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
      app.setup = { ...blank(null), ...draft, step: Math.min(draft.step || 0, 4), saving: false };
      const s = app.setup;
      s.players = (s.players || []).map(withName);
      s.nickAsk = null;
      if (!s.course && s.courseId) s.course = clone(COURSES.find((c) => c.id === s.courseId) || null);
      if (!s.course) s.courseId = null;
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
    if (!s || s.saved || s.step !== 0 || course(s) || s.nearStatus !== 'idle' || s.autoNearTried) return;
    s.autoNearTried = true;
    // Look for nearby courses straight away (the course you're standing at goes on top). If the
    // site doesn't have location yet the phone asks once; blocked → the turn-it-on steps show.
    findNear(app);
  },

  render(app) {
    const s = app.setup;
    if (!s) return '';
    const name = STEPS[s.step];
    const dots = STEPS.map((_, i) => `<i class="${i <= s.step ? 'on' : ''}"></i>`).join('');
    const c0 = course(s);
    const canNext = s.step === 0 ? !!c0 && (c0.source !== 'manual' || !!(c0.name || '').trim()) : true;
    const foot = s.saved
      ? ''
      : `<div class="setup-foot">
          ${s.step > 0 ? '<button class="btn" data-act="setup-back">Back</button>' : ''}
          ${s.step < STEPS.length - 1 ? `<button class="btn primary" data-act="setup-next" ${canNext ? '' : 'disabled'}>Next: ${STEPS[s.step + 1]}</button>` : ''}
        </div>`;
    return `<div class="plain" style="padding-bottom:0">
      <div class="steps">${dots}</div>
      <div class="micro">${s.saved ? 'Round saved' : `Step ${s.step + 1} of ${STEPS.length} · ${name}`}</div>
      <h1 class="title" style="margin:2px 0 16px">${s.saved ? 'You’re set' : s.from ? 'Run it back' : 'New round'}</h1>
      ${s.loadingFrom ? '<p class="meta">Copying the last round…</p>' : VIEWS[name](s, app)}
      ${foot}
    </div>`;
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
      s.editCard = true;
      setTimeout(() => document.getElementById('course-name')?.focus(), 50);
    },
    'setup-unpick': (el, ev, app) => {
      const s = app.setup;
      s.course = null;
      s.courseId = null;
      s.courseStatus = 'idle';
      s.tee = null;
      s.editCard = false;
      persist(s);
      app.render();
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
      const next = document.querySelector('[data-act="setup-next"]');
      if (next) next.disabled = !s.course.name.trim();
    },
    'setup-card-edit': (el, ev, app) => {
      app.setup.editCard = true;
      app.render();
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
    'setup-remove': (el, ev, app) => {
      app.setup.players.splice(Number(el.dataset.i), 1);
      persist(app.setup);
      app.render();
    },
    'setup-strokes': (el, ev, app) => {
      const v = el.value.replace(/[^0-9]/g, '').slice(0, 2);
      if (v !== el.value) el.value = v;
      app.setup.players[Number(el.dataset.i)].strokes = v;
      persist(app.setup);
    },
    'setup-team': (el, ev, app) => {
      const s = app.setup;
      const p = s.players[Number(el.dataset.i)];
      const id = el.dataset.v;
      if (p.teamId === id) p.teamId = null;
      else {
        if (s.players.filter((x) => x.teamId === id).length >= 2) {
          app.toast({ title: `Cart ${id} is full`, sub: 'Two players per cart.', error: true });
          return;
        }
        p.teamId = id;
      }
      persist(s);
      app.render();
    },
    'setup-teamname': (el, ev, app) => {
      app.setup.teams.find((t) => t.id === el.dataset.v).name = el.value.slice(0, 20);
      persist(app.setup);
    },
    'setup-swap': (el, ev, app) => {
      const st = app.setup.settings;
      st.rotationMode = st.rotationMode === 'swap' ? 'fixed' : 'swap';
      persist(app.setup);
      app.render();
    },
    'setup-shuffle': (el, ev, app) => {
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      app.setup.rotation = app.setup.rotation.map((r, i) => ({
        holes: r.holes,
        matches: clone(MATCHINGS[order[i]]).sort(() => Math.random() - 0.5),
      }));
      persist(app.setup);
      app.render();
    },
    'setup-group': (el, ev, app) => {
      app.setup.players[Number(el.dataset.i)].groupId = el.dataset.v;
      persist(app.setup);
      app.render();
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
    'setup-solo': (el, ev, app) => {
      app.setup.settings.solo = el.dataset.v === 'on';
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
    'setup-allow': (el, ev, app) => {
      const v = el.value.replace(/[^0-9]/g, '').slice(0, 3);
      if (v !== el.value) el.value = v;
      app.setup.settings.allowancePct = v === '' ? 100 : Math.min(100, Number(v));
      persist(app.setup);
    },
    'setup-next': (el, ev, app) => {
      const s = app.setup;
      const c = course(s);
      if (s.step === 0 && (!c || (c.source === 'manual' && !(c.name || '').trim()))) return;
      s.step = Math.min(STEPS.length - 1, s.step + 1);
      persist(s);
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'setup-back': (el, ev, app) => {
      const s = app.setup;
      s.step = Math.max(0, s.step - 1);
      persist(s);
      app.render();
      document.getElementById('content').scrollTop = 0;
    },
    'setup-save': async (el, ev, app) => {
      const s = app.setup;
      if (problems(s).length || s.saving) return;
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
  },
};
