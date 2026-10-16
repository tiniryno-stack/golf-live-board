// setup.js — organizer flow: Course → Players → Teams → Matchups → Game → Save.
// Nothing is preselected on Course. "Run it back" (#/setup/CODE) copies players,
// team names, carts and settings from a past round (not the course).

import { esc, icon, seg, todayISO, prettyDate, copyText, roundLink } from '../ui.js';
import { COURSES } from '../courses.js';
import { DEFAULT_SETTINGS, DEFAULT_ROTATION, holesLabel } from '../scoring.js';
import { TEAM_NAME_PICKS } from '../teams.js';
import * as db from '../db.js';

const STEPS = ['Course', 'Players', 'Teams', 'Matchups', 'Game', 'Save'];
const TEAM_IDS = ['A', 'B', 'C', 'D'];
const MATCHINGS = [
  [['A', 'B'], ['C', 'D']],
  [['A', 'C'], ['B', 'D']],
  [['A', 'D'], ['B', 'C']],
];
const DRAFT_KEY = 'glb.setupDraft';

const clone = (x) => JSON.parse(JSON.stringify(x));

function blank(from = null) {
  const { rotation, ...settings } = DEFAULT_SETTINGS;
  return {
    step: 0, from, loadingFrom: !!from, courseId: null, tee: null, name: '',
    players: [], teams: TEAM_IDS.map((id) => ({ id, name: '' })),
    rotation: clone(DEFAULT_ROTATION), settings: { ...settings, rotationMode: 'swap' },
    crewId: null, crewFromSource: false, past: [], newName: '',
    saving: false, saved: null,
  };
}

function persist(s) {
  if (!s.saved) db.local.set(DRAFT_KEY, { ...s, saving: false, loadingFrom: false });
}

async function loadPast(app, crewId) {
  if (!crewId) return;
  try {
    const rounds = await db.fetchCrewRounds(crewId);
    const people = new Map();
    for (const { event } of rounds) for (const p of event.roster?.players || []) if (p.personId) people.set(p.personId, p.name);
    if (app.setup) {
      app.setup.past = [...people].map(([personId, name]) => ({ personId, name, crewId }));
      app.render();
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
      key: `k${i}`, personId: p.personId || db.uuid(), name: p.name, strokes: p.strokes ?? '', teamId: p.teamId || null, groupId: p.groupId || 'g1',
    }));
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
  return COURSES.find((c) => c.id === s.courseId) || null;
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
  if (!s.courseId) out.push('Pick a course.');
  const names = s.players.map((p) => p.name.trim().toLowerCase()).filter(Boolean);
  if (!names.length) out.push('Add the players.');
  if (new Set(names).size !== names.length) out.push('Two players have the same name.');
  const needsTeams = s.settings.game !== 'none' || s.settings.rotationMode === 'swap';
  if (needsTeams && !hasFullTeams(s)) {
    out.push(s.settings.game !== 'none'
      ? 'The rotating game needs 4 carts of 2. Put every player in a cart on Teams.'
      : 'Carts swapping foursomes needs 4 carts of 2. Fill the carts, or turn swapping off on Matchups.');
  }
  return out;
}

function buildRound(s) {
  const c = course(s);
  const full = hasFullTeams(s);
  const groupOfTeam = {};
  s.rotation[0].matches.forEach((m, i) => m.forEach((t) => (groupOfTeam[t] = `g${i + 1}`)));
  const players = s.players.map((p, i) => ({
    id: `p${i + 1}`, personId: p.personId || db.uuid(), name: p.name.trim(),
    teamId: p.teamId || null,
    groupId: full && p.teamId ? groupOfTeam[p.teamId] : p.groupId || 'g1',
    strokes: p.strokes === '' || p.strokes == null || Number.isNaN(Number(p.strokes)) ? null : Math.max(0, Math.round(Number(p.strokes))),
  }));
  const teams = teamsUsed(s).map((id) => ({ id, name: teamName(s, id).slice(0, 20) }));
  return {
    name: s.name.trim() || `${c.shortName} · ${prettyDate(todayISO())}`,
    course: { id: c.id, name: c.name, shortName: c.shortName, location: c.location, tee: s.tee, par: [...c.par], strokeIndex: [...c.strokeIndex] },
    roster: { groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }], teams, players },
    settings: { ...s.settings, rotation: clone(s.rotation) },
    playedOn: todayISO(),
    crewId: s.crewId,
  };
}

// ───────────────────────────────────────────── step views

const VIEWS = {
  Course(s) {
    const c = course(s);
    return `<div class="stack">
      ${COURSES.map((x) => `<button class="course-opt" data-act="setup-course" data-v="${esc(x.id)}" aria-pressed="${s.courseId === x.id}">
        <div class="row-title">${esc(x.name)}</div><div class="detail">${esc(x.location)} · Par ${x.par.reduce((a, b) => a + b, 0)}</div></button>`).join('')}
    </div>
    ${c ? `<div class="micro" style="margin:18px 0 8px">Tees</div>
      <div class="chips">${c.tees.map((t) => `<button class="chip" data-act="setup-tee" data-v="${esc(t.name)}" aria-pressed="${s.tee?.name === t.name}">${esc(t.name)} <span class="soft mono" style="font-size:12px">${t.yards}</span></button>`).join('')}</div>` : ''}
    <div class="field" style="margin-top:18px"><span class="label">First tee</span>${seg('setup-set', [['1', 'Hole 1'], ['10', 'Hole 10']], String(s.settings.startHole || 1), 'data-k="startHole"')}</div>
    <p class="help">Starting on 10? Everything follows the order you play: 10 → 18, then 1 → 9.</p>
    <div class="field"><label for="round-name">Round name</label>
      <input class="input" id="round-name" maxlength="60" value="${esc(s.name)}" placeholder="${esc(c ? `${c.shortName} · ${prettyDate(todayISO())}` : 'e.g. Twin Creeks · Fri')}" data-input="setup-name"></div>
    <p class="meta">Nothing is preselected, so nobody plays the wrong card. Check pars against the card on the first tee; the organizer can fix any hole mid-round.</p>`;
  },

  Players(s) {
    const used = new Set(s.players.map((p) => p.personId));
    const past = s.past.filter((p) => !used.has(p.personId));
    return `${past.length ? `<div class="micro" style="margin:0 0 8px">From past rounds</div>
      <div class="chips" style="margin:0 0 16px">${past.map((p) => `<button class="chip" data-act="setup-past" data-v="${esc(p.personId)}">${icon('plus', 14)} ${esc(p.name)}</button>`).join('')}</div>` : ''}
      <div class="join-row" style="margin:0 0 8px">
        <input class="input" id="new-player" maxlength="24" placeholder="Type a name" value="${esc(s.newName)}" autocapitalize="words" data-input="setup-newname" data-enter="setup-add">
        <button class="btn primary" data-act="setup-add">Add</button>
      </div>
      <p class="help" style="margin:4px 0 10px">Strokes are optional. Blank = plays even. Giving a newer player 15 strokes = 1 stroke on the 15 hardest holes.</p>
      <div>${s.players.map((p, i) => `<div class="player-row">
          <span class="pname ellipsis">${esc(p.name)}</span>
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
    return `<div class="field"><span class="label">Game</span>${seg('setup-set', [['none', 'None'], ['rotationMatch', 'Match Play'], ['rotationPlusMinus', 'Plus/Minus']], st.game, 'data-k="game"')}</div>
      <p class="help">${st.game === 'rotationMatch' ? 'Points bank every hole; most points after 18 wins the day.' : pm ? 'Zero-sum: each rotation starts even, margins carry all day.' : 'Just the live scorecard and leaderboard.'}</p>
      ${st.game !== 'none' ? `<div class="field"><span class="label">Team score</span>${seg('setup-set', [['bestBallAggregate', 'Low Ball/Total'], ['bestBall', 'Best ball'], ['aggregate', 'Aggregate']], st.teamScore, 'data-k="teamScore"')}</div>` : ''}
      <div class="field"><span class="label">Max hole score (pick-up)</span>${seg('setup-set', [['doublePar', 'Double par'], ['netDoubleBogey', 'Net dbl bogey'], ['none', 'None']], st.maxHoleScore, 'data-k="maxHoleScore"')}</div>
      <div class="chips" style="margin:0 0 16px"><button class="pill" data-act="setup-toggle" data-k="par3NoMax" aria-pressed="${!!st.par3NoMax}"><span class="dot"></span>No max on par 3s</button></div>
      ${st.game === 'rotationMatch' ? `<div class="field"><span class="label">Halved points</span>${seg('setup-set', [['0.5', '½ each'], ['0', 'Nothing']], String(st.halvedHolePoints), 'data-k="halvedHolePoints"')}</div>` : ''}
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
      <div class="card" style="margin:0 0 14px">
        <div class="micro">Course</div><div class="row-title" style="margin:2px 0 10px">${c ? esc(c.name) : '—'}${s.tee ? ` · ${esc(s.tee.name)}` : ''}</div>
        <div class="micro">Round</div><div style="margin:2px 0 10px">${esc(r?.name || s.name || '—')}</div>
        <div class="micro">Players</div><div style="margin:2px 0 10px">${s.players.length ? s.players.map((p) => `${esc(p.name)}${p.strokes !== '' && p.strokes != null ? ` <span class="soft">(${esc(p.strokes)})</span>` : ''}`).join(', ') : '—'}</div>
        <div class="micro">First tee</div><div style="margin:2px 0 10px">Hole ${s.settings.startHole === 10 ? '10 (back nine first)' : '1'}</div>
        <div class="micro">Game</div><div style="margin:2px 0 0">${{ none: 'Scorecard only', rotationMatch: 'Rotation Match Play', rotationPlusMinus: 'Rotation Plus/Minus' }[s.settings.game]}${s.settings.rotationMode === 'swap' ? ' · carts swap' : ' · fixed foursomes'}</div>
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

// ───────────────────────────────────────────── screen

export default {
  enter(app) {
    const from = app.route.from || null;
    if (app.setup && app.setup.from === from && !app.setup.saved) return;
    const draft = db.local.get(DRAFT_KEY);
    if (!from && draft && !draft.saved && (draft.players?.length || draft.courseId)) {
      app.setup = { ...blank(null), ...draft, step: Math.min(draft.step || 0, 4), saving: false };
    } else {
      app.setup = blank(from);
    }
    if (from) loadFrom(app, from);
    else {
      const crew = db.recent.all().find((r) => r.crew_id)?.crew_id;
      loadPast(app, crew);
    }
  },

  render(app) {
    const s = app.setup;
    if (!s) return '';
    const name = STEPS[s.step];
    const dots = STEPS.map((_, i) => `<i class="${i <= s.step ? 'on' : ''}"></i>`).join('');
    const canNext = s.step === 0 ? !!s.courseId : true;
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
    'setup-course': (el, ev, app) => {
      const s = app.setup;
      if (s.courseId !== el.dataset.v) s.tee = null;
      s.courseId = el.dataset.v;
      persist(s);
      app.render();
    },
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
      app.setup.newName = el.value;
    },
    'setup-add': (el, ev, app) => {
      const s = app.setup;
      const input = document.getElementById('new-player');
      const name = (input?.value || s.newName || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      if (!name) return;
      if (s.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        app.toast({ title: `${name} is already in`, error: true });
        return;
      }
      const past = s.past.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (past) s.crewId = s.crewId || past.crewId;
      s.players.push({ key: db.uuid(), personId: past?.personId || db.uuid(), name, strokes: '', teamId: null, groupId: 'g1' });
      s.newName = '';
      persist(s);
      app.render();
      document.getElementById('new-player')?.focus();
    },
    'setup-past': (el, ev, app) => {
      const s = app.setup;
      const p = s.past.find((x) => x.personId === el.dataset.v);
      if (!p || s.players.some((x) => x.personId === p.personId)) return;
      s.crewId = s.crewId || p.crewId;
      s.players.push({ key: db.uuid(), personId: p.personId, name: p.name, strokes: '', teamId: null, groupId: 'g1' });
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
      if (k === 'halvedHolePoints') v = Number(v);
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
    'setup-allow': (el, ev, app) => {
      const v = el.value.replace(/[^0-9]/g, '').slice(0, 3);
      if (v !== el.value) el.value = v;
      app.setup.settings.allowancePct = v === '' ? 100 : Math.min(100, Number(v));
      persist(app.setup);
    },
    'setup-next': (el, ev, app) => {
      const s = app.setup;
      if (s.step === 0 && !s.courseId) return;
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
      db.recent.remember({ code: res.code, name: buildRound(s).name, played_on: todayISO(), crew_id: res.crew_id, course: course(s) });
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
