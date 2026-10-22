// sim.js — sim.html: 8 test phones in one browser. Each iframe loads the app with
// `?sim=N`, which gives it its own storage space (db.js), so it has its own device ID and
// joins as its own player. "Make a practice round" creates a real round (new crew, so it
// never touches your group's Season standings), signs phone N in as player N, and makes
// phone 1 the organizer. "Play a hole" enters a realistic score on each phone, the way a
// player would on their own phone, then taps Next hole.

import { api, sb, uuid, fetchEvent, normCode } from './db.js?v=2d64e16';
import { COURSES } from './courses.js?v=2d64e16';
import { DEFAULT_SETTINGS, DEFAULT_ROTATION } from './scoring.js?v=2d64e16';
import { TEAM_NAME_PICKS } from './teams.js?v=2d64e16';

const PHONES = 8;
const NAMES = ['Andrew', 'Sean', 'Mike', 'Tyler', 'Sam', 'Jake', 'Chris', 'Matt'];
const CARTS = 'AABBCCDD';
const LAST_KEY = 'glb.sim.last';
const $ = (id) => document.getElementById(id);

let current = null; // { code, pin, names[] }
let busy = false;
let shown = 1; // phone layout: which test phone is on screen

// ───────────────────────────────────────────── per-phone storage (same keys the app uses)

const phoneKey = (i, key) => `sim${i}.${key}`;
function phoneSet(i, key, value) {
  localStorage.setItem(phoneKey(i, key), JSON.stringify(value));
}
function phoneGet(i, key) {
  try {
    return JSON.parse(localStorage.getItem(phoneKey(i, key)));
  } catch {
    return null;
  }
}
function phoneDevice(i) {
  let id = phoneGet(i, 'glb.device');
  if (typeof id !== 'string' || id.length !== 36) {
    id = uuid();
    phoneSet(i, 'glb.device', id);
  }
  return id;
}

function status(text, err = false) {
  $('status').innerHTML = text;
  $('status').classList.toggle('err', err);
}

// ───────────────────────────────────────────── make / open a round

async function makeRound() {
  const c = COURSES[0];
  const tee = c.tees.find((t) => t.name === 'Blue') || c.tees[0];
  const when = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const round = {
    name: `Practice · ${when}`,
    course: {
      id: c.id, ogaId: c.ogaId, source: 'builtin', name: c.name, shortName: c.shortName, location: c.location,
      tee, tees: c.tees, par: [...c.par], strokeIndex: [...c.strokeIndex],
    },
    roster: {
      groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }],
      teams: ['A', 'B', 'C', 'D'].map((id, k) => ({ id, name: TEAM_NAME_PICKS[k] })),
      players: NAMES.map((name, k) => ({
        id: `p${k + 1}`, personId: uuid(), name, teamId: CARTS[k], groupId: k < 4 ? 'g1' : 'g2', strokes: null,
      })),
    },
    settings: { ...DEFAULT_SETTINGS, practice: true, rotation: JSON.parse(JSON.stringify(DEFAULT_ROTATION)) }, // practice: never added to crews / people
    playedOn: new Date().toISOString().slice(0, 10),
    crewId: null, // its own crew: practice never shows up in your group's Season standings
  };
  const res = await api.createEvent(round);
  if (!res.ok) throw new Error(res.error || 'could not create the round');
  return { code: res.code, pin: res.admin_pin };
}

/** Sign phone i in as player pid (skips the join cards and tips so the phones open on Enter). */
async function signIn(i, code, pid) {
  const device = phoneDevice(i);
  const who = await sb().rpc('whoami', { p_code: code, p_device_id: device });
  let mine = who.data?.player_id || null;
  if (!mine && pid) {
    const r = await sb().rpc('claim_player', { p_code: code, p_player_id: pid, p_device_id: device });
    if (r.data?.ok) mine = pid;
  }
  if (mine) phoneSet(i, `glb.me.${code}`, mine);
  for (const k of ['who', 'brief']) phoneSet(i, `glb.${k}.${code}`, true);
  phoneSet(i, `glb.seen.${code}`, { last: Date.now(), ids: [] });
  for (const k of ['tile5', 'oppcart3', 'prov2']) phoneSet(i, `glb.coach.${k}`, true);
  return mine;
}

async function openRound(code, pin) {
  status('Opening…');
  const ev = await fetchEvent(code);
  if (!ev) throw new Error(`No round ${code}`);
  const players = ev.roster.players || [];
  const names = [];
  for (let i = 1; i <= PHONES; i++) {
    const pid = await signIn(i, code, players[i - 1]?.id || null);
    names.push(players.find((p) => p.id === pid)?.name || null);
  }
  if (pin) phoneSet(1, `glb.admin.${code}`, pin);
  current = { code, pin: pin || phoneGet(1, `glb.admin.${code}`) || null, names, carts: players.map((p) => p.teamId) };
  showPhones();
  const n = names.filter(Boolean).length;
  status(`Round <b>${code}</b>${current.pin ? ` · PIN <b>${current.pin}</b>` : ''} · ${n} of ${PHONES} phones signed in${n < PHONES ? ' (the rest are watching: those names are taken)' : ''}`);
}

function showPhones() {
  const grid = $('grid');
  grid.innerHTML = '';
  for (let i = 1; i <= PHONES; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'phone';
    const who = current.names[i - 1];
    wrap.innerHTML = `<div class="phone-label">Phone ${i} · <b>${who ? escapeHtml(who) : 'watching'}</b>${who && current.carts?.[i - 1] ? ` · cart ${current.carts[i - 1]}` : ''}${i === 1 && current.pin ? ' · organizer' : ''}</div>
      <div class="frame"><iframe title="Test phone ${i}" width="375" height="667" allow="geolocation" src="index.html?sim=${i}#/e/${current.code}"></iframe></div>`;
    grid.appendChild(wrap);
  }
  sizePhones();
  $('controls').hidden = false;
  $('reset').hidden = $('delete').hidden = !current.pin;
  document.body.classList.add('has-round');
  document.body.classList.remove('more-open');
  renderSwitcher();
  showPhone(shown);
}

/** Phone layout: buttons 1–8 (with names) to pick the phone on screen. */
function renderSwitcher() {
  $('switcher').innerHTML = current
    ? current.names.map((n, k) => `<button data-phone="${k + 1}" aria-pressed="${shown === k + 1}">${k + 1}<small>${escapeHtml(n || 'watching')}</small></button>`).join('')
    : '';
}
function showPhone(i) {
  shown = i;
  document.querySelectorAll('.phone').forEach((p, k) => p.classList.toggle('on', k + 1 === i));
  document.querySelectorAll('#switcher button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.phone) === i)));
}

// Laptop: all 8 side by side. Narrow screens: one full-size phone + the 1–8 switcher.
const narrow = window.matchMedia('(max-width: 700px)');
function applyLayout() {
  document.body.classList.toggle('narrow', narrow.matches);
}
narrow.addEventListener?.('change', applyLayout);
applyLayout();
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--head', `${document.querySelector('header').offsetHeight}px`);
}).observe(document.querySelector('header'));

function sizePhones() {
  const s = Number($('zoom').value) / 100;
  for (const f of document.querySelectorAll('.frame')) {
    f.style.width = `${Math.round(375 * s) + 4}px`;
    f.style.height = `${Math.round(667 * s) + 4}px`;
    f.querySelector('iframe').style.transform = `scale(${s})`;
    f.closest('.phone').style.width = `${Math.round(375 * s) + 4}px`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ───────────────────────────────────────────── play a hole

const frames = () => [...document.querySelectorAll('.frame iframe')];
const appIn = (f) => {
  try {
    return f.contentWindow.__glb || null;
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A realistic score for a friend group: mostly pars and bogeys, the odd birdie or blow-up. */
function randomScore(par) {
  const r = Math.random();
  const d = r < 0.07 ? -1 : r < 0.37 ? 0 : r < 0.72 ? 1 : r < 0.92 ? 2 : 3;
  return Math.max(1, Math.min(par * 2, par + d));
}

async function playHole(which) {
  if (busy) return;
  busy = true;
  setPlaying(true);
  try {
    const apps = frames().map((f, k) => ({ i: k + 1, f, g: appIn(f) })).filter((p) => p.g?.snapshot && p.g.me && !p.g.isFinal?.() && !p.g.foursomeDone());
    if (!apps.length) {
      status('Nothing to play: the round is over (or the phones are still loading).');
      return;
    }
    const ref = apps.find((p) => p.i === 1)?.g || apps[0].g;
    const refHole = ref.nextHole();
    const inRefGroup = (p) => ref.inMyFoursome(p.g.me, refHole);
    const playing = apps.filter((p) => which === 'all' || (which === 'mine' ? inRefGroup(p) : !inRefGroup(p)));
    if (!playing.length) {
      status(which === 'other' ? 'Phone 1’s group is the only one left to play.' : 'No phones in that group can play.');
      return;
    }
    const holes = new Set();
    for (const p of playing) {
      const h = p.g.nextHole();
      holes.add(h);
      p.g.setScore(p.g.me, h, randomScore(p.g.snapshot.holes[h - 1].par));
    }
    status(`Entered hole ${[...holes].join(', ')} on ${playing.length} phone${playing.length > 1 ? 's' : ''}… syncing`);
    await sleep(1800);
    await Promise.all(apps.map((p) => p.g.refetch?.().catch(() => {})));
    await sleep(400);
    if ($('advance').checked) {
      for (const p of playing) tapNext(p.f);
      await sleep(900);
      for (const p of playing) tapContinue(p.f);
    }
    status(`Played hole ${[...holes].join(', ')} on ${playing.length} phone${playing.length > 1 ? 's' : ''}. Round <b>${current.code}</b>${current.pin ? ` · PIN <b>${current.pin}</b>` : ''}`);
  } catch (e) {
    status(`Couldn’t play the hole: ${escapeHtml(e.message || e)}`, true);
  } finally {
    busy = false;
    setPlaying(false);
  }
}

function tapNext(f) {
  try {
    const doc = f.contentDocument;
    if (f.contentWindow.__glb?.route?.tab !== 'enter') return; // only phones sitting on Enter
    const btn = doc.querySelector('.next-btn[data-act="next-hole"]:not(.waiting)');
    btn?.click();
  } catch { /* phone still loading */ }
}
function tapContinue(f) {
  try {
    f.contentDocument.querySelector('[data-act="card-continue"]')?.click();
  } catch { /* nothing to continue */ }
}

function setPlaying(on) {
  for (const id of ['play-all', 'play-mine', 'play-other']) $(id).disabled = on;
}

// ───────────────────────────────────────────── wiring

function remember() {
  localStorage.setItem(LAST_KEY, JSON.stringify({ code: current.code, pin: current.pin }));
  showReopen();
}
function showReopen() {
  let last = null;
  try {
    last = JSON.parse(localStorage.getItem(LAST_KEY));
  } catch { /* none */ }
  const btn = $('reopen');
  btn.hidden = !last?.code || last.code === current?.code;
  if (last?.code) btn.textContent = `Reopen last practice (${last.code})`;
  btn.onclick = () => run(() => openRound(last.code, last.pin));
}

async function run(fn) {
  if (busy) return;
  busy = true;
  for (const id of ['make', 'open']) $(id).disabled = true;
  try {
    await fn();
  } catch (e) {
    status(escapeHtml(e.message || 'No signal. Try again.'), true);
  } finally {
    busy = false;
    for (const id of ['make', 'open']) $(id).disabled = false;
  }
}

$('make').onclick = () => run(async () => {
  status('Making a practice round…');
  const { code, pin } = await makeRound();
  await openRound(code, pin);
  remember();
});
$('open').onclick = () => {
  const code = normCode($('code').value);
  if (code) run(() => openRound(code, null));
};
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('open').click(); });
$('play-all').onclick = () => playHole('all');
$('play-mine').onclick = () => playHole('mine');
$('play-other').onclick = () => playHole('other');
$('zoom').oninput = sizePhones;
$('switcher').addEventListener('click', (e) => {
  const b = e.target.closest('[data-phone]');
  if (b) showPhone(Number(b.dataset.phone));
});
$('more-btn').onclick = () => {
  const open = document.body.classList.toggle('more-open');
  $('more-btn').setAttribute('aria-expanded', String(open));
};
$('reset').onclick = () => run(async () => {
  if (!current?.pin) return;
  const res = await api.resetRound(current.code, current.pin);
  if (!res.ok) throw new Error(res.error);
  for (const f of frames()) f.contentWindow.location.reload();
  status(`Scores cleared on <b>${current.code}</b>. Same players and carts.`);
});
$('delete').onclick = () => run(async () => {
  if (!current?.pin || !window.confirm(`Delete practice round ${current.code} for good?`)) return;
  const res = await api.deleteRound(current.code, current.pin);
  if (!res.ok) throw new Error(res.error);
  for (let i = 1; i <= PHONES; i++) {
    for (const k of Object.keys(localStorage)) if (k.startsWith(`sim${i}.`) && k.includes(`.${current.code}`)) localStorage.removeItem(k);
  }
  localStorage.removeItem(LAST_KEY);
  status(`Deleted ${current.code}.`);
  current = null;
  $('grid').innerHTML = '';
  $('controls').hidden = true;
  document.body.classList.remove('has-round', 'more-open');
  renderSwitcher();
  showReopen();
});
showReopen();
