// host.js — organizer only (round button beside the tab bar, or the private
// organizer link + admin PIN). Rules | Players | Activity: change game rules
// mid-round, rename teams, strokes, swap players, fix par / hole handicap,
// approve "let them in", free up a spot, and read the audit log.

import { esc, icon, seg, clock, copyText, roundLink } from '../ui.js';
import * as db from '../db.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const TEAM_IDS = ['A', 'B', 'C', 'D'];

function draft(app) {
  const e = app.event;
  const d = app.hostDraft;
  if (!d || d.code !== app.code || (!d.dirty && d.base !== e.updated_at)) {
    app.hostDraft = {
      code: app.code, base: e.updated_at, dirty: false,
      name: e.name, course: clone(e.course), roster: clone(e.roster), settings: clone(e.settings),
    };
  }
  return app.hostDraft;
}

function touch(app) {
  app.hostDraft.dirty = true;
  const btn = document.querySelector('[data-act="host-save"]');
  if (btn) btn.disabled = false;
}

function pinForm() {
  return `<div class="plain">
    <h1 class="title">Organizer</h1>
    <p class="soft">Enter the admin PIN from when the round was saved.</p>
    <div class="field"><label for="pin">Admin PIN</label>
      <input class="input pin-input" id="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" data-enter="host-pin"></div>
    <button class="btn primary big block" data-act="host-pin">Unlock Host</button>
    <p class="meta" style="margin-top:12px">Players never need this. It’s only for changing rules, fixing any score, and freeing up a name.</p>
  </div>`;
}

function rules(app, d) {
  const st = d.settings;
  const pm = st.game === 'rotationPlusMinus';
  const par = d.course.par, si = d.course.strokeIndex;
  // A round without carts (2–4 players): Scorecard only, or split point (1 point a hole, ties
  // split it). Switching recounts from hole 1; scores never change.
  const noCarts = !(d.roster.teams || []).length;
  const n = (d.roster.players || []).length;
  const gameField = st.pairs
    ? `<div class="field"><span class="label">Game</span><p class="soft" style="margin:0">2v2 · partners ${({ never: 'stay the same all 18', six: 'switch every 6 holes', turn: 'switch at the turn' })[st.pairSwitch] || 'stay the same all 18'}. Set when the round was made.</p></div>`
    : noCarts
    ? n >= 2 && n <= 6
      ? `<div class="field"><span class="label">Game</span>${seg('host-solo', [['off', 'Scorecard only'], ['on', 'Match play']], st.solo && st.game !== 'none' ? 'on' : 'off')}</div>
        <p class="help">Match play: everyone plays their own ball. Each hole is worth 1 point: low score takes it, a tie for low splits it (½, ⅓, ¼ …). Recounts from hole 1.</p>`
      : ''
    : `<div class="field"><span class="label">Game</span>${seg('host-set', [['none', 'None'], ['rotationMatch', 'Match Play'], ['rotationPlusMinus', 'Plus/Minus']], st.game, 'data-k="game"')}</div>`;
  if (noCarts) {
    return `${gameField}
      <div class="field"><span class="label">Max hole score</span>${seg('host-set', [['doublePar', 'Double par'], ['netDoubleBogey', 'Net dbl bogey'], ['none', 'None']], st.maxHoleScore, 'data-k="maxHoleScore"')}</div>
      ${courseAndFinish(app, d)}`;
  }
  return `${gameField}
    <div class="field"><span class="label">First tee</span>${seg('host-set', [['1', 'Hole 1'], ['10', 'Hole 10']], String(st.startHole || 1), 'data-k="startHole"')}</div>
    <div class="field"><span class="label">Team score</span>${seg('host-set', [['bestBallAggregate', 'Low Ball/Total'], ['bestBall', 'Best ball'], ['aggregate', 'Aggregate']], st.teamScore, 'data-k="teamScore"')}</div>
    <div class="field"><span class="label">Max hole score</span>${seg('host-set', [['doublePar', 'Double par'], ['netDoubleBogey', 'Net dbl bogey'], ['none', 'None']], st.maxHoleScore, 'data-k="maxHoleScore"')}</div>
    <div class="chips" style="margin:0 0 16px">
      <button class="pill" data-act="host-toggle" data-k="par3NoMax" aria-pressed="${!!st.par3NoMax}"><span class="dot"></span>No max on par 3s</button>
      <button class="pill" data-act="host-swap" aria-pressed="${(st.rotationMode || 'swap') === 'swap'}"><span class="dot"></span>Carts swap every 6</button>
    </div>
    ${st.game === 'rotationMatch' ? `<div class="field"><span class="label">Halved points</span>${seg('host-set', [['0.5', '½ each'], ['0', 'Nothing']], String(st.halvedHolePoints), 'data-k="halvedHolePoints"')}</div>` : ''}
    ${st.game === 'rotationMatch' ? `<div class="field"><span class="label">Matchup win bonus</span>${seg('host-set', [['1', '+1 point'], ['0', 'None']], String(st.matchBonus ?? 1), 'data-k="matchBonus"')}</div>` : ''}
    ${pm ? `<div class="field"><span class="label">Max swing per rotation</span>${seg('host-set', [['', 'Uncapped'], ['3', '3'], ['5', '5']], st.plusMinusCap == null ? '' : String(st.plusMinusCap), 'data-k="plusMinusCap"')}</div>` : ''}
    <details class="fold"${st.handicapMode !== 'full' ? ' open' : ''}><summary>Advanced handicaps</summary>
      <div class="chips" style="margin:4px 0 12px"><button class="pill" data-act="host-lowman" aria-pressed="${st.handicapMode === 'offLow'}"><span class="dot"></span>Play off the low man</button></div>
      <div class="field"><label for="h-allow">Allowance %</label><input class="input num" id="h-allow" inputmode="numeric" maxlength="3" value="${esc(st.allowancePct ?? 100)}" data-input="host-allow" style="width:96px"></div>
    </details>
    ${courseAndFinish(app, d)}`;
}

/** Course fixes + Finish the round + cleanup (shared by every round type). */
function courseAndFinish(app, d) {
  const par = d.course.par, si = d.course.strokeIndex;
  return `<details class="fold"><summary>Course: par + hole handicap</summary>
      <p class="help" style="margin:0 0 10px">Fix a hole if the card at the course disagrees. Every score recomputes.</p>
      <div class="par-grid"><span class="micro">Hole</span><span class="micro">Par</span><span class="micro">Hcp</span>
      ${par.map((p, i) => `<span class="h">${i + 1}</span>
        <input class="input" inputmode="numeric" maxlength="1" value="${p}" aria-label="Par hole ${i + 1}" data-input="host-par" data-i="${i}">
        <input class="input" inputmode="numeric" maxlength="2" value="${si[i]}" aria-label="Handicap hole ${i + 1}" data-input="host-si" data-i="${i}">`).join('')}
      </div>
    </details>
    <div class="divider"></div>
    <div class="micro" style="margin:0 0 6px">Finish the round</div>
    ${app.isFinal()
      ? `<p class="help" style="margin:0 0 12px"><b>Finalized</b> \u2014 scores are locked for everyone, this phone too. To change one, Enter \u2192 Fix a score unlocks this phone. Reopen to let players change them again.</p>
      <div class="stack" style="gap:8px;margin:0 0 8px"><button class="btn ghost block" data-act="host-reopen">Reopen round</button></div>`
      : `<p class="help" style="margin:0 0 12px"><b>Finalize</b> locks every score so nobody can change them, and finished rounds open on the Board. Do it once everyone\u2019s checked their card. You can still fix one from Enter \u2192 Fix a score.</p>
      <div class="stack" style="gap:8px;margin:0 0 8px"><button class="btn primary block" data-act="host-finalize">${icon('lock', 16)} Finalize round</button></div>`}
    <div class="divider"></div>
    <div class="micro" style="margin:0 0 6px">Practice rounds &amp; cleanup</div>
    <p class="help" style="margin:0 0 12px"><b>Reset</b> clears every score (and reopens a finalized round) but keeps players, carts, settings and everyone\u2019s phones joined, so you can replay from hole 1. <b>Delete</b> removes the round for everyone.</p>
    <div class="stack" style="gap:8px;margin:0 0 8px">
      <button class="btn ghost block" data-act="host-reset">Reset scores</button>
      <button class="btn danger block" data-act="host-delete">Delete round</button>
    </div>`;
}

function players(app, d) {
  const r = d.roster;
  const asks = app.relevantRequests();
  return `${asks.length ? `<div class="card" style="margin:0 0 14px"><div class="micro" style="margin:0 0 8px">Waiting to be let in</div>
      ${asks.map((q) => `<div class="spread" style="margin:6px 0"><span class="row-title">${esc(app.snapshot.playerById.get(q.player_id)?.name || q.player_id)}</span>
        <span><button class="btn small" data-act="join-deny" data-v="${esc(q.id)}">Not them</button> <button class="btn small primary" data-act="join-approve" data-v="${esc(q.id)}">Let them in</button></span></div>`).join('')}</div>` : ''}
    <div class="field"><label for="h-name">Round name</label><input class="input" id="h-name" maxlength="60" value="${esc(d.name)}" data-input="host-name"></div>
    ${(r.teams || []).length ? `<div class="micro" style="margin:4px 0 8px">Team names</div>
      ${r.teams.map((t) => `<div class="field" style="margin:0 0 8px"><input class="input" maxlength="20" value="${esc(t.name)}" placeholder="Cart ${esc(t.id)}" aria-label="Team ${esc(t.id)} name" data-input="host-team" data-v="${esc(t.id)}"></div>`).join('')}` : ''}
    <div class="micro" style="margin:14px 0 4px">Players · name · strokes${(r.teams || []).length ? ' · cart' : ''}</div>
    ${r.players.map((p, i) => `<div class="player-row" style="flex-wrap:wrap">
        <input class="input" style="flex:1;min-width:120px" maxlength="24" value="${esc(p.name)}" aria-label="Player name" data-input="host-pname" data-i="${i}">
        <input class="input num" inputmode="numeric" maxlength="2" placeholder="even" value="${esc(p.strokes ?? '')}" aria-label="Strokes for ${esc(p.name)}" data-input="host-strokes" data-i="${i}">
        ${(r.teams || []).length ? `<div class="team-picks">${TEAM_IDS.filter((id) => r.teams.some((t) => t.id === id)).map((id) => `<button data-act="host-pteam" data-i="${i}" data-v="${id}" aria-pressed="${p.teamId === id}">${id}</button>`).join('')}</div>` : ''}
        ${app.claimed.has(p.id) ? `<button class="btn small ghost" data-act="host-release" data-v="${esc(p.id)}">Free up</button>` : '<span class="meta" style="min-width:64px;text-align:center">open</span>'}
      </div>`).join('')}
    <p class="help" style="margin-top:10px">“Free up” releases a name if that phone is gone and nobody in the foursome can let the new phone in. To fix any foursome’s score, tap the cell on the Card.</p>
    <button class="btn ghost block" data-act="host-copy">${icon('copy', 16)} Copy organizer link</button>`;
}

function activity(app) {
  const log = app.hostLog;
  if (!log || log.code !== app.code) {
    loadLog(app);
    return '<p class="meta">Loading activity…</p>';
  }
  if (log.error) return `<p class="soft">Couldn’t load the log (${esc(log.error)}).</p><button class="btn block" data-act="host-log">Try again</button>`;
  return `<div class="spread" style="margin:0 0 6px"><span class="meta">${log.rows.length} ${log.rows.length === 1 ? 'entry' : 'entries'} · newest first</span><button class="btn small" data-act="host-log">Refresh</button></div>
    ${log.rows.map((x) => `<div class="log-row"><span class="t">${esc(clock(x.at))}</span><span class="who">${esc(x.actor)}</span><span>${esc(x.action)}</span></div>`).join('') || '<p class="meta">Nothing yet.</p>'}
    <p class="meta" style="margin-top:10px">Also in Supabase → Table Editor → audit_log.</p>`;
}

async function loadLog(app) {
  if (app.hostLogLoading) return;
  app.hostLogLoading = true;
  try {
    const res = await db.api.auditLog(app.code, app.adminPin);
    app.hostLog = res.ok ? { code: app.code, rows: res.rows } : { code: app.code, rows: [], error: res.error };
    if (res.error === 'bad_pin') app.setAdmin(null);
  } catch {
    app.hostLog = { code: app.code, rows: [], error: 'no signal' };
  }
  app.hostLogLoading = false;
  app.render();
}

function validate(d) {
  const names = d.roster.players.map((p) => p.name.trim().toLowerCase());
  if (names.some((n) => !n)) return 'Every player needs a name.';
  if (new Set(names).size !== names.length) return 'Two players have the same name.';
  if (d.course.par.some((p) => !(p >= 3 && p <= 6))) return 'Par must be 3–6 on every hole.';
  const si = d.course.strokeIndex;
  if (si.some((x) => !(x >= 1 && x <= 18)) || new Set(si).size !== 18) return 'Hole handicaps must be 1–18, each used once.';
  const st = d.settings;
  const teams = d.roster.teams || [];
  if (st.pairs) {
    if (d.roster.players.length !== 4) return '2v2 needs exactly 4 players.';
  } else if (st.solo && st.game !== 'none') {
    const n = d.roster.players.length;
    if (teams.length || n < 2 || n > 6) return 'Match play (split point) is for 2–6 players with no carts.';
  } else if (st.game !== 'none' && !(teams.length === 4 && teams.every((t) => d.roster.players.filter((p) => p.teamId === t.id).length === 2))) {
    return 'The rotating game needs 4 carts of 2.';
  }
  return null;
}

export default {
  render(app) {
    if (!app.adminPin) return pinForm();
    const d = draft(app);
    const tab = app.ui.hostTab;
    const body = tab === 'players' ? players(app, d) : tab === 'activity' ? activity(app) : rules(app, d);
    const save = tab === 'activity' ? '' : `<div class="setup-foot"><button class="btn primary" data-act="host-save" ${d.dirty ? '' : 'disabled'}>Save changes</button>
      ${d.dirty ? '<button class="btn" data-act="host-discard">Discard</button>' : ''}</div>`;
    return `<div class="plain" style="padding-bottom:0">
      <h1 class="title">Host</h1>
      <div class="segs">${seg('host-tab', [['rules', 'Rules'], ['players', 'Players'], ['activity', 'Activity']], tab)}</div>
      ${body}${save}
    </div>`;
  },

  actions: {
    'host-pin': async (el, ev, app) => {
      const input = document.getElementById('pin');
      const pin = (input?.value || '').replace(/\D/g, '');
      if (!pin) return;
      const ok = await app.verifyAdmin(pin);
      if (!ok) app.toast({ title: 'That PIN didn’t work', error: true });
      else app.toast({ title: 'Host unlocked on this phone' });
    },
    'host-tab': (el, ev, app) => {
      app.ui.hostTab = el.dataset.v;
      if (el.dataset.v === 'activity') app.hostLog = null;
      app.render();
    },
    'host-solo': (el, ev, app) => {
      const st = draft(app).settings;
      const on = el.dataset.v === 'on';
      st.solo = on;
      st.game = on ? 'rotationMatch' : 'none';
      touch(app);
      app.render();
    },
    'host-set': (el, ev, app) => {
      const st = draft(app).settings;
      const k = el.dataset.k;
      let v = el.dataset.v;
      if (k === 'halvedHolePoints' || k === 'matchBonus') v = Number(v);
      if (k === 'plusMinusCap') v = v === '' ? null : Number(v);
      if (k === 'startHole') v = Number(v);
      st[k] = v;
      touch(app);
      app.render();
    },
    'host-toggle': (el, ev, app) => {
      const st = draft(app).settings;
      st[el.dataset.k] = !st[el.dataset.k];
      touch(app);
      app.render();
    },
    'host-swap': (el, ev, app) => {
      const st = draft(app).settings;
      st.rotationMode = (st.rotationMode || 'swap') === 'swap' ? 'fixed' : 'swap';
      touch(app);
      app.render();
    },
    'host-lowman': (el, ev, app) => {
      const st = draft(app).settings;
      st.handicapMode = st.handicapMode === 'offLow' ? 'full' : 'offLow';
      touch(app);
      app.render();
    },
    'host-allow': (el, ev, app) => {
      const v = el.value.replace(/\D/g, '').slice(0, 3);
      draft(app).settings.allowancePct = v === '' ? 100 : Math.min(100, Number(v));
      touch(app);
    },
    'host-par': (el, ev, app) => {
      draft(app).course.par[Number(el.dataset.i)] = Number(el.value.replace(/\D/g, '')) || 0;
      touch(app);
    },
    'host-si': (el, ev, app) => {
      draft(app).course.strokeIndex[Number(el.dataset.i)] = Number(el.value.replace(/\D/g, '')) || 0;
      touch(app);
    },
    'host-name': (el, ev, app) => {
      draft(app).name = el.value;
      touch(app);
    },
    'host-team': (el, ev, app) => {
      const t = draft(app).roster.teams.find((x) => x.id === el.dataset.v);
      t.name = el.value.slice(0, 20);
      touch(app);
    },
    'host-pname': (el, ev, app) => {
      draft(app).roster.players[Number(el.dataset.i)].name = el.value.slice(0, 24);
      touch(app);
    },
    'host-strokes': (el, ev, app) => {
      const v = el.value.replace(/\D/g, '').slice(0, 2);
      if (v !== el.value) el.value = v;
      draft(app).roster.players[Number(el.dataset.i)].strokes = v === '' ? null : Number(v);
      touch(app);
    },
    'host-pteam': (el, ev, app) => {
      const d = draft(app);
      d.roster.players[Number(el.dataset.i)].teamId = el.dataset.v;
      touch(app);
      app.render();
    },
    'host-release': (el, ev, app) => {
      const p = app.snapshot.playerById.get(el.dataset.v);
      app.openSheet('confirm', {
        title: `Free up ${p?.name || 'this name'}?`,
        body: 'The phone using this name drops to watch-only, and anyone can pick the name again.',
        ok: 'Free it up', danger: true, onOk: () => app.release(el.dataset.v),
      });
    },
    'host-copy': async (el, ev, app) => {
      const ok = await copyText(roundLink(app.code, '/host'));
      app.toast({ title: ok ? 'Organizer link copied' : roundLink(app.code, '/host'), sub: 'Keep it private. It still needs the PIN.' });
    },
    'host-finalize': (el, ev, app) => app.confirmFinalize(true),
    'host-reopen': (el, ev, app) => app.confirmFinalize(false),
    'host-reset': (el, ev, app) => {
      app.openSheet('confirm', {
        title: 'Reset all scores?',
        body: `Clears every score in ${app.event.name} for everyone. Players, carts, settings and joined phones stay. The activity log keeps a line.`,
        ok: 'Reset scores', danger: true, onOk: () => app.resetRound(),
      });
    },
    'host-delete': (el, ev, app) => {
      app.openSheet('confirm', {
        title: 'Delete this round?',
        body: `Deletes ${app.event.name} (${app.code}) with its scores and activity log, for everyone. This can\u2019t be undone.`,
        ok: 'Delete round', danger: true, onOk: () => app.deleteRound(),
      });
    },
    'host-discard': (el, ev, app) => {
      app.hostDraft = null;
      app.render();
    },
    'host-save': async (el, ev, app) => {
      const d = draft(app);
      const problem = validate(d);
      if (problem) {
        app.toast({ title: 'Not saved', sub: problem, error: true });
        return;
      }
      for (const t of d.roster.teams || []) t.name = t.name.trim() || `Cart ${t.id}`;
      for (const p of d.roster.players) p.name = p.name.trim();
      const ok = await app.saveEvent({ course: d.course, roster: d.roster, settings: d.settings, name: d.name.trim() });
      if (ok) {
        app.hostDraft = null;
        app.hostLog = null;
        app.render();
      }
    },
    'host-log': (el, ev, app) => {
      app.hostLog = null;
      app.render();
    },
  },
};
