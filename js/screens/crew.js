// crew.js — crews, feature 006-crew-home-invite: Home's crew data (037 draws the block in home.js), Start or rename a crew, Join from an invite link (and the dead-link error), "Which one are
// you?", and the Crew settings sheet. Data: db.crews (this phone's crews), api.crewInfo / crewByInvite …
// A phone is in a crew by knowing its id; crew_claims says which person it is (one phone per person).

import * as db from '../db.js';
import { esc, icon, initials, copyText } from '../ui.js';
import { FLAGS } from '../flags.js';
import { buildSeasons, seasonRecordTable, placeLabel } from '../seasons.js';
import { countsAsPlayed } from '../lobby.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const today = () => new Date().toLocaleDateString('en-CA');
export const inviteUrl = (code) => `${location.origin}${location.pathname}#/crew/${code}`;
const shortInvite = (code) => `${location.host}${location.pathname.replace(/\/$/, '')}/#/crew/${code}`.replace(/^www\./, '');

// ───────────────────────────────────────────── crew data (cached per crew; Home + Standings + Setup use it)

/** Load a crew's card info and rounds (for the season line). Safe to call often: one fetch at a time. */
export async function loadCrew(app, id, { force = false } = {}) {
  if (!id) return null;
  app.crews ||= {};
  const c = (app.crews[id] ||= { id, loading: false });
  if (c.loading || (c.info && !force)) return c;
  c.loading = true;
  try {
    const [info, rounds] = await Promise.all([db.api.crewInfo(id), db.fetchCrewRounds(id).catch(() => [])]);
    if (info?.ok) {
      c.info = info.crew;
      db.crews.put({ id, name: info.crew.name || null, ...(info.crew.me ? { me: info.crew.me } : {}) });
    } else if (info?.error === 'not_found') c.missing = true;
    c.rounds = (rounds || []).filter((r) => String(r.event?.settings?.practice) !== 'true' && countsAsPlayed(r.event, r.scores)); // 025
    c.error = null;
  } catch (e) {
    c.error = 'No signal';
  }
  c.loading = false;
  app.render();
  return c;
}

/** The crew's seasons + this phone's person, ready for the card and Standings. */
export function crewSeasons(app, id) {
  const c = app.crews?.[id];
  if (!c?.rounds) return null;
  const seasons = buildSeasons(c.info?.seasons || [], c.rounds, today());
  return { seasons, current: seasons.find((s) => s.current) || seasons[0] };
}
const myPerson = (app, id) => app.crews?.[id]?.info?.me || db.crews.get(id)?.me || null;

// ───────────────────────────────────────────── Home: crew card

/**
 * 037 v2 §7: what Home's crew row needs (homeview.crewSlot draws the rules): this phone's crews, the selected one's
 * name, and its season line ("Fall · you’re 2nd") or round count. Starts loading the crew. Never throws.
 */
export function homeCrewData(app) {
  try {
    const list = db.crews.visible();
    if (!list.length) return { list: [] };
    const cur = db.crews.current() || list[0];
    const c = app.crews?.[cur.id];
    if (!c) loadCrew(app, cur.id);
    const info = c?.info;
    let seasonLine = '', rounds = null, standing = null;
    const ss = crewSeasons(app, cur.id);
    if (ss?.current) {
      rounds = ss.current.rounds?.length || 0;
      if (rounds) {
        const t = seasonRecordTable(ss.current, myPerson(app, cur.id));
        if (t.me?.ranked) seasonLine = `${ss.current.name} · you’re ${placeLabel(t.me)}`;
        // 037 v2: the crew row's place and rung 9's leader ("Sean leads." / "Sean is next." when you lead).
        const ranked = t.rows.filter((r) => r.ranked);
        const first = (r) => String(r?.name || '').split(' ')[0] || null;
        const iLead = !!(t.me?.ranked && t.me.rank === 1);
        standing = {
          place: t.me?.ranked ? placeLabel(t.me) : null, myRounds: t.me ? t.me.rounds : 0, iLead,
          leader: first(ranked[0]), next: iLead ? first(ranked.find((r) => !r.me)) : null,
        };
      }
    } else if (info) rounds = info.rounds;
    return {
      list: list.map((x) => ({ id: x.id, name: app.crews?.[x.id]?.info?.name || x.name || null })),
      currentId: cur.id, name: info?.name ?? cur.name ?? null, seasonLine, rounds, standing,
    };
  } catch {
    return { list: [] };
  }
}

/** Crew names this phone knows, by id (Home's "crew on the card"). */
export function crewNames(app) {
  const out = {};
  try { for (const x of db.crews.all()) { const n = app.crews?.[x.id]?.info?.name || x.name; if (n) out[x.id] = n; } } catch { /* none */ }
  return out;
}

async function shareInvite(app, id) {
  let c = app.crews?.[id];
  if (!c?.info?.code) c = await loadCrew(app, id, { force: true });
  const info = c?.info;
  if (!info?.code) { app.toast({ title: 'Couldn’t get the invite link', sub: 'Check your signal and try again.', error: true }); return; }
  const url = inviteUrl(info.code);
  const text = `Join ${info.name || 'our crew'} on Golf Live Board`;
  try {
    if (navigator.share) { await navigator.share({ title: info.name || 'Our crew', text, url }); return; }
  } catch { return; /* share sheet dismissed */ }
  const copied = await copyText(url);
  app.toast({ title: copied ? 'Invite link copied' : 'Invite link', sub: copied ? 'Paste it in the group text.' : url });
}

// ───────────────────────────────────────────── screens

function startView(app) {
  const r = app.route;
  const rename = r.mode === 'rename';
  const c = rename ? app.crews?.[r.id] : null;
  const st = (app.crewForm ||= { name: rename ? c?.info?.name || db.crews.get(r.id)?.name || '' : '', busy: false });
  const sugg = ['Saturday Crew', 'Sunday Scramble', 'The Regulars', 'Dawn Patrol'];
  return `<div class="plain crew-screen">
      <h1 class="ts-title crew-h">${rename ? 'Rename crew' : 'Name your crew'}</h1>
      <p class="crew-help">${rename ? 'Everyone in the crew sees the new name.' : 'The name your group sees on the invite and on Home.'}</p>
      <div class="field crew-field"><label for="crew-name">Crew name</label>
        <input class="input crew-input" id="crew-name" maxlength="24" autocomplete="off" autocapitalize="words" value="${esc(st.name)}" data-input="crew-name" data-enter="crew-save" placeholder="e.g. Saturday Crew">
        <span class="crew-count mono">${st.name.length}/24</span></div>
      ${rename ? '' : `<div class="chips crew-chips">${sugg.map((s) => `<button class="pill" data-act="crew-sugg" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}
      <div class="nr-foot"><button class="btn primary nr-cta" data-act="crew-save" ${st.name.trim() ? '' : 'disabled'} ${st.busy ? 'aria-busy="true"' : ''}>${rename ? 'Save' : 'Create and invite'}</button></div>
    </div>`;
}

function joinView(app) {
  const j = app.crewJoin;
  if (!j || j.loading) return '<div class="plain crew-screen"><p class="meta">Opening the invite…</p></div>';
  if (j.dead) {
    return `<div class="plain crew-screen crew-dead">
        <span class="crew-dead-ico">${icon('unlink', 28)}</span>
        <h1 class="ts-title crew-h">This invite link doesn’t work anymore</h1>
        <p class="crew-help">Someone in the crew made a new link, or this one was mistyped. Ask them to send the new one.</p>
        <div class="nr-foot crew-foot">
          <button class="btn primary nr-cta" data-act="go" data-v="#/">Go to Home</button>
          <button class="btn text block" data-act="crew-joincode">Join a round with a code</button>
        </div>
      </div>`;
  }
  if (j.error) return `<div class="plain crew-screen"><p class="soft">${esc(j.error)}</p><button class="btn block" data-act="crew-join-retry">Try again</button></div>`;
  const c = j.crew;
  const name = c.name || 'the crew';
  const since = c.since ? ` since ${MONTHS[Number(c.since.slice(5, 7)) - 1]}` : '';
  const ppl = c.people || [];
  const stack = ppl.slice(0, 6).map((p) => `<span class="av">${esc(initials(`${p.first} ${p.last || ''}`))}</span>`).join('');
  const more = ppl.length > 6 ? `<span class="av-more mono">+${ppl.length - 6}</span>` : '';
  const recent = (c.recent || []).map((r) => `<div class="cj-round"><div class="cj-rn ellipsis">${esc(r.course || r.name)}</div><div class="cj-rs">${esc(prettyDay(r.playedOn))}</div></div>`).join('');
  return `<div class="plain crew-screen">
      ${c.owner ? `<div class="ts-label crew-k">Invite from ${esc(c.owner)}</div>` : ''}
      <h1 class="ts-title crew-h">Join ${esc(name)}?</h1>
      <p class="crew-help">${c.players} player${c.players === 1 ? '' : 's'}${c.recent?.length ? ` · playing${since}` : ''}</p>
      ${stack ? `<div class="av-stack">${stack}${more}</div>` : ''}
      ${recent ? `<div class="ts-label home-k">Recent rounds</div><div class="cj-list">${recent}</div>` : ''}
      <div class="nr-foot crew-foot">
        <button class="btn primary nr-cta" data-act="crew-join" ${j.busy ? 'aria-busy="true"' : ''}>Join ${esc(name)}</button>
        <button class="btn text block" data-act="go" data-v="#/">Not now</button>
      </div>
    </div>`;
}

function prettyDay(d) {
  if (!d) return '';
  const dt = new Date(`${d}T12:00:00`);
  return dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function whichView(app) {
  const id = app.route.id;
  const c = app.crews?.[id];
  const w = (app.crewWhich ||= { pick: null, people: null, busy: false });
  if (!w.people) {
    if (!w.loading) {
      w.loading = true;
      Promise.all([db.api.crewPeople(id), loadCrew(app, id, { force: true })]).then(([r]) => {
        w.people = r?.ok ? r.people : [];
        w.loading = false;
        app.render();
      }, () => { w.people = []; w.loading = false; app.render(); });
    }
    return '<div class="plain crew-screen"><p class="meta">Loading the crew…</p></div>';
  }
  const claimed = new Set(c?.info?.claimed || []);
  const hcp = FLAGS.crewHandicaps ? lastHandicaps(c) : {};
  const rows = w.people.map((p) => {
    const full = [p.firstName, p.lastName].filter(Boolean).join(' ');
    const taken = claimed.has(p.id);
    const on = w.pick === p.id;
    return `<button class="claim-row${on ? ' on' : ''}${taken ? ' taken' : ''}" data-act="crew-which-pick" data-v="${esc(p.id)}" ${taken ? 'disabled aria-disabled="true"' : ''} aria-pressed="${on}">
        <span class="av${on ? ' me' : ''}">${esc(initials(full))}</span>
        <span class="cr-name ellipsis">${esc(shortName(p))}</span>
        ${taken ? '<span class="ts-label cr-tag">On another phone</span>' : hcp[p.id] != null ? `<span class="cr-hcp mono">${esc(hcp[p.id])}</span>` : ''}
        ${on ? `<span class="cr-check">${icon('check', 20)}</span>` : ''}
      </button>`;
  }).join('');
  const picked = w.people.find((p) => p.id === w.pick);
  return `<div class="plain crew-screen crew-which">
      <div class="ts-label crew-k">${esc(c?.info?.name || 'Your crew')}</div>
      <h1 class="ts-title crew-h">Which one are you?</h1>
      <p class="crew-help">Pick your name so your past rounds count for you.</p>
      <div class="claim-list">${rows || '<p class="meta">Nobody in the crew yet.</p>'}</div>
      <div class="nr-foot crew-foot">
        <button class="btn primary nr-cta" data-act="crew-which-ok" ${picked ? '' : 'disabled'} ${w.busy ? 'aria-busy="true"' : ''}>${picked ? `I’m ${esc(shortName(picked))}` : 'Pick your name'}</button>
        <div class="crew-two"><button class="btn" data-act="crew-which-new">I’m new</button><button class="btn text" data-act="crew-which-skip">Skip</button></div>
      </div>
    </div>`;
}

const shortName = (p) => (p.lastName ? `${p.firstName} ${p.lastName[0]}.` : p.firstName);

/** Last whole-stroke handicap per person from the crew's rounds (only shown when FLAGS.crewHandicaps). */
export function lastHandicaps(c) {
  const out = {};
  for (const { event } of c?.rounds || []) {
    for (const p of event.roster?.players || []) if (p.personId && p.strokes != null && p.strokes !== '') out[p.personId] = Number(p.strokes);
  }
  return out;
}

// ───────────────────────────────────────────── sheets (registered in sheets.js)

export const crewSheets = {
  crewSettings(app, { id }, head) {
    const c = app.crews?.[id];
    const info = c?.info;
    if (!info) { loadCrew(app, id); return `${head('Crew settings')}<p class="meta">Loading…</p>`; }
    const owner = info.isOwner;
    const sub = [`${info.players} player${info.players === 1 ? '' : 's'}`, info.owner ? `started by ${info.owner}` : ''].filter(Boolean).join(' · ');
    const lock = owner ? '' : ' disabled aria-disabled="true"';
    return `${head('Crew settings', sub)}
      <div class="cs-list">
        <div class="cs-row"><div class="cs-main"><div class="ts-label">Name</div><div class="cs-v ellipsis">${esc(info.name || 'Not named yet')}</div></div>
          <button class="btn" data-act="crew-rename" data-v="${esc(id)}"${lock}>Rename</button></div>
        <div class="cs-row"><div class="cs-main"><div class="ts-label">Invite link</div><div class="cs-v mono ellipsis">${esc(shortInvite(info.code || ''))}</div><div class="cs-d">Anyone with this link can join.</div></div>
          <button class="btn" data-act="crew-copy" data-v="${esc(id)}">Copy</button></div>
        <div class="cs-row"><div class="cs-main"><div class="ts-label">Reset link</div><div class="cs-v">Make a new link</div><div class="cs-d">The old one stops working right away.</div></div>
          <button class="btn" data-act="crew-reset" data-v="${esc(id)}"${lock}>Reset</button></div>
        <div class="cs-row"><div class="cs-main"><div class="ts-label">Players</div><div class="cs-v">Remove from crew</div><div class="cs-d">Their past rounds stay.</div></div>
          <button class="btn" data-act="crew-remove-open" data-v="${esc(id)}"${lock}>Manage</button></div>
        <div class="cs-row"><div class="cs-main"><div class="ts-label">Leave</div><div class="cs-v ellipsis">Leave ${esc(info.name || 'this crew')}</div><div class="cs-d">Your past rounds stay with the crew.</div></div>
          <button class="btn ghost" data-act="crew-leave" data-v="${esc(id)}">Leave</button></div>
      </div>
      ${owner ? '' : `<p class="meta cs-note">Rename, reset and removing players are for ${esc(info.owner || 'whoever started the crew')}.</p>`}`;
  },

  crewRemove(app, { id, people }, head) {
    const c = app.crews?.[id];
    const me = c?.info?.me;
    const rows = (people || []).filter((p) => p.id !== me).map((p) => `<div class="cs-row"><div class="cs-main"><div class="cs-v ellipsis">${esc([p.firstName, p.lastName].filter(Boolean).join(' '))}</div>
        <div class="cs-d">${p.rounds} round${p.rounds === 1 ? '' : 's'}</div></div>
        <button class="btn" data-act="crew-remove" data-v="${esc(p.id)}" data-crew="${esc(id)}">Remove</button></div>`).join('');
    return `${head('Remove from crew', 'They drop off the crew list. Their past rounds stay.')}
      <div class="cs-list">${people ? rows || '<p class="meta">Nobody else in the crew yet.</p>' : '<p class="meta">Loading…</p>'}</div>`;
  },

  crewNew(app, { id, first = '', last = '', nickname = '', askNick = false, busy = false }, head) {
    return `${head('You’re new', 'Your name, the way the crew should see it.')}
      <div class="field"><label for="cn-first">First name</label><input class="input" id="cn-first" maxlength="24" autocapitalize="words" autocomplete="given-name" value="${esc(first)}"></div>
      <div class="field"><label for="cn-last">Last name</label><input class="input" id="cn-last" maxlength="30" autocapitalize="words" autocomplete="family-name" value="${esc(last)}"></div>
      ${askNick ? `<p class="meta" style="margin:0 0 8px">Someone with that name already plays. Add a nickname so you’re your own player.</p>
        <div class="field"><label for="cn-nick">Nickname</label><input class="input" id="cn-nick" maxlength="24" placeholder="e.g. Tini Ryno" value="${esc(nickname)}"></div>` : ''}
      <button class="btn primary big block" data-act="crew-new-save" data-v="${esc(id)}" ${busy ? 'aria-busy="true"' : ''}>Join as me</button>`;
  },
};

// ───────────────────────────────────────────── screen object

export default {
  enter(app) {
    const r = app.route;
    app.crewForm = null;
    if (r.mode === 'join') {
      app.crewJoin = { loading: true, code: r.code };
      db.api.crewByInvite(r.code).then((res) => {
        if (app.crewJoin?.code !== r.code) return;
        app.crewJoin = res?.ok ? { code: r.code, crew: res.crew } : res?.error === 'not_found' ? { code: r.code, dead: true } : { code: r.code, error: 'No signal. Check your connection.' };
        app.render();
      }, () => { app.crewJoin = { code: r.code, error: 'No signal. Check your connection.' }; app.render(); });
    }
    if (r.mode === 'which') app.crewWhich = null;
    if (r.mode === 'rename' && !app.crews?.[r.id]?.info) loadCrew(app, r.id).then(() => { app.crewForm = null; app.render(); });
  },
  topBack(app) {
    const m = app.route.mode;
    if (m === 'which' || m === 'join') return '<div class="spacer"></div>';
    // Name your crew on Standings (or Rename in its ⋯ sheet) comes back to Standings.
    const st = m === 'rename' && String(app.prevHash?.() || '').startsWith('#/season/');
    return `<button class="back" data-act="crew-up">${icon('back', 22)}<span>${st ? 'Standings' : 'Home'}</span></button>`;
  },
  render(app) {
    const m = app.route.mode;
    if (m === 'join') return joinView(app);
    if (m === 'which') return whichView(app);
    return startView(app);
  },
  actions: {
    'crew-up': (el, ev, app) => {
      const prev = app.prevHash?.();
      app.up(app.route.mode === 'rename' && String(prev || '').startsWith('#/season/') ? prev : '#/');
    },
    'crew-pick': (el, ev, app) => {
      db.crews.select(el.dataset.v);
      loadCrew(app, el.dataset.v);
      // 037 v2 §7: the switcher lives on Standings now; picking a crew there opens that crew's standings.
      // Standings fixes (Nov 26): in place, so Back leaves Standings instead of walking through every crew you looked at.
      if (app.route?.name === 'season') { app.replace(`#/season/${el.dataset.v}`); return; }
      app.render();
    },
    'crew-invite': (el, ev, app) => shareInvite(app, el.dataset.v),
    'crew-settings': (el, ev, app) => {
      loadCrew(app, el.dataset.v, { force: true });
      app.openSheet('crewSettings', { id: el.dataset.v });
    },
    'crew-name': (el, ev, app) => {
      app.crewForm ||= { name: '' };
      app.crewForm.name = el.value.slice(0, 24);
      const btn = document.querySelector('[data-act="crew-save"]');
      if (btn) btn.disabled = !app.crewForm.name.trim();
      const n = document.querySelector('.crew-count');
      if (n) n.textContent = `${app.crewForm.name.length}/24`;
    },
    'crew-sugg': (el, ev, app) => {
      app.crewForm = { ...(app.crewForm || {}), name: el.dataset.v };
      app.render({ force: true });
    },
    'crew-save': async (el, ev, app) => {
      const f = app.crewForm;
      const name = (f?.name || document.getElementById('crew-name')?.value || '').trim();
      if (!name || f?.busy) return;
      f.busy = true;
      app.render({ force: true });
      const r = app.route;
      try {
        if (r.mode === 'rename') {
          const res = await db.api.renameCrew(r.id, name);
          if (!res?.ok) throw new Error(res?.error === 'not_owner' ? 'Only whoever started the crew can rename it' : 'Couldn’t save the name');
          (app.crews[r.id] ||= { id: r.id }).info = res.crew;
          db.crews.put({ id: r.id, name: res.crew.name });
          app.toast({ title: 'Crew renamed' });
          const prev = app.prevHash?.();
          app.up(String(prev || '').startsWith('#/season/') ? prev : '#/'); // back where Rename was opened
        } else {
          // The phone's person from its most recent crew, so the new crew knows who started it.
          const me = db.crews.visible().find((c) => c.me)?.me || null;
          const res = await db.api.createCrew(name, me);
          if (!res?.ok) throw new Error('Couldn’t create the crew');
          (app.crews ||= {})[res.crew.id] = { id: res.crew.id, info: res.crew, rounds: [] };
          db.crews.put({ id: res.crew.id, name: res.crew.name, me: res.crew.me || null });
          db.crews.select(res.crew.id);
          app.go('#/');
          shareInvite(app, res.crew.id);
        }
      } catch (e) {
        f.busy = false;
        app.toast({ title: e.message || 'Something went wrong', sub: 'Check your signal and try again.', error: true });
        app.render({ force: true });
      }
    },
    'crew-join': async (el, ev, app) => {
      const j = app.crewJoin;
      if (!j?.crew || j.busy) return;
      j.busy = true;
      app.render();
      const id = j.crew.id;
      db.crews.put({ id, name: j.crew.name });
      db.crews.select(id);
      app.go(`#/crew/which/${id}`);
    },
    'crew-join-retry': () => location.reload(),
    'crew-joincode': (el, ev, app) => {
      app.go('#/');
      app.openSheet('join', {});
    },
    'crew-which-pick': (el, ev, app) => {
      app.crewWhich.pick = el.dataset.v;
      app.render();
    },
    'crew-which-ok': async (el, ev, app) => {
      const w = app.crewWhich;
      const id = app.route.id;
      if (!w?.pick || w.busy) return;
      w.busy = true;
      app.render();
      const res = await db.api.claimCrewPerson(id, w.pick).catch(() => null);
      if (!res?.ok) {
        w.busy = false;
        app.toast({ title: res?.error === 'claimed' ? 'That name is on another phone' : 'Couldn’t save that', sub: res?.error === 'claimed' ? 'Pick yours, or tap I’m new.' : 'Check your signal and try again.', error: true });
        loadCrew(app, id, { force: true });
        return;
      }
      (app.crews[id] ||= { id }).info = res.crew;
      db.crews.put({ id, me: w.pick });
      if (!db.owner.get()) db.owner.set(w.pick); // 024: a phone with no owner is this person's now (name fills in from a round)
      app.toast({ title: `You’re in ${res.crew.name || 'the crew'}` });
      app.go('#/');
    },
    'crew-which-new': (el, ev, app) => app.openSheet('crewNew', { id: app.route.id }),
    'crew-which-skip': (el, ev, app) => app.go('#/'),
    'crew-new-save': async (el, ev, app) => {
      const id = el.dataset.v;
      const val = (k) => (document.getElementById(k)?.value || '').trim();
      const props = { ...app.sheet.props, first: val('cn-first'), last: val('cn-last'), nickname: val('cn-nick') };
      if (!props.first || !props.last) { app.toast({ title: 'Add your first and last name', error: true }); return; }
      app.openSheet('crewNew', { ...props, busy: true });
      const res = await db.api.crewNewPerson(id, { first: props.first, last: props.last, nickname: props.nickname || null }).catch(() => null);
      if (res?.error === 'name_taken') { app.openSheet('crewNew', { ...props, askNick: true, busy: false }); return; }
      if (!res?.ok) { app.openSheet('crewNew', { ...props, busy: false }); app.toast({ title: 'Couldn’t add you', sub: 'Check your signal and try again.', error: true }); return; }
      (app.crews[id] ||= { id }).info = res.crew;
      db.crews.put({ id, me: res.personId });
      app.closeSheet();
      app.toast({ title: `You’re in ${res.crew.name || 'the crew'}` });
      app.go('#/');
    },
    'crew-rename': (el, ev, app) => {
      app.closeSheet();
      app.go(`#/crew/rename/${el.dataset.v}`);
    },
    'crew-copy': async (el, ev, app) => {
      const info = app.crews?.[el.dataset.v]?.info;
      if (!info?.code) return;
      const url = inviteUrl(info.code);
      const ok = await copyText(url);
      app.toast({ title: ok ? 'Invite link copied' : 'Invite link', sub: ok ? 'Paste it in the group text.' : url });
    },
    'crew-reset': (el, ev, app) => {
      const id = el.dataset.v;
      app.openSheet('confirm', {
        title: 'Make a new invite link?', body: 'The old link stops working right away. Anyone who hasn’t joined yet needs the new one.', ok: 'Reset link',
        onOk: async () => {
          const res = await db.api.resetInvite(id).catch(() => null);
          if (!res?.ok) { app.toast({ title: res?.error === 'not_owner' ? 'Only whoever started the crew can reset it' : 'Couldn’t reset the link', error: true }); return; }
          app.crews[id].info = res.crew;
          app.toast({ title: 'New invite link ready', sub: 'The old one no longer works.' });
          app.openSheet('crewSettings', { id });
        },
      });
    },
    'crew-remove-open': async (el, ev, app) => {
      const id = el.dataset.v;
      app.openSheet('crewRemove', { id, people: null });
      const res = await db.api.crewPeople(id).catch(() => null);
      if (app.sheet?.type === 'crewRemove') app.openSheet('crewRemove', { id, people: res?.ok ? res.people : [] });
    },
    'crew-remove': (el, ev, app) => {
      const id = el.dataset.crew;
      const pid = el.dataset.v;
      const people = app.sheet.props.people || [];
      const p = people.find((x) => x.id === pid);
      app.openSheet('confirm', {
        title: `Remove ${p?.firstName || 'them'} from the crew?`, body: 'They drop off the crew list and Setup. Their past rounds and standings stay.', ok: 'Remove', danger: true,
        onOk: async () => {
          const res = await db.api.removeCrewPerson(id, pid).catch(() => null);
          if (!res?.ok) { app.toast({ title: 'Couldn’t remove them', error: true }); return; }
          app.crews[id].info = res.crew;
          app.toast({ title: `${p?.firstName || 'They'} removed` });
          app.openSheet('crewRemove', { id, people: people.filter((x) => x.id !== pid) });
        },
      });
    },
    'crew-leave': (el, ev, app) => {
      const id = el.dataset.v;
      const name = app.crews?.[id]?.info?.name || 'this crew';
      app.openSheet('confirm', {
        title: `Leave ${name}?`, body: 'It comes off this phone. Your past rounds stay with the crew, and an invite link brings you back.', ok: 'Leave',
        onOk: () => {
          db.crews.leave(id);
          app.toast({ title: `You left ${name}` });
          // On that crew's Standings: show the next crew's (or Home), never the one you just left.
          if (app.route?.name === 'season' && app.season?.crew === id) {
            const next = db.crews.current();
            app.season = null;
            app.replace(next ? `#/season/${next.id}` : '#/');
            return;
          }
          app.render();
        },
      });
    },
  },
};
