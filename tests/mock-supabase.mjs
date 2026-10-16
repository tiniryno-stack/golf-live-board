// In-memory stand-in for the Supabase project, used by the headless-browser checks
// (fit-the-screen + smoke). It mirrors supabase/schema.sql: same tables, same
// write-function names, arguments and { ok, error } answers, and the same
// foursome rule (via scoring.js's sameFoursome, which mirrors _same_foursome).
//
// Realtime isn't mocked: the websocket is refused, so the app falls back to
// refetching (on return-to-page and polling), which is what the checks drive.

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sameFoursome } from '../js/scoring.js';
import { COURSES } from '../js/courses.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE = 'https://yxreupqzwgjzhfosnjbj.supabase.co';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function createBackend() {
  const t = { events: [], secrets: new Map(), claims: [], joins: [], jdev: new Map(), audit: [], scores: [] };
  let auditId = 1;
  const now = () => new Date().toISOString();
  const ev = (code) => t.events.find((e) => e.code === String(code || '').trim().toUpperCase()) || null;
  const player = (e, pid) => (e.roster.players || []).find((p) => p.id === pid) || null;
  const pname = (e, pid) => player(e, pid)?.name ?? pid;
  const log = (e, actor, action) => t.audit.push({ id: auditId++, event_id: e.id, at: now(), actor, action });
  const adminOk = (e, pin) => pin != null && t.secrets.get(e.id) === String(pin).trim();
  const claimOf = (e, dev) => t.claims.find((c) => c.event_id === e.id && c.device_id === dev) || null;
  const lastHole = (e, pid) =>
    Math.max(0, ...t.scores.filter((s) => s.event_id === e.id && s.player_id === pid && s.strokes != null).map((s) => s.hole));
  const no = (error, extra = {}) => ({ ok: false, error, ...extra });

  function approver(e, pid, dev, pin) {
    if (pin != null && adminOk(e, pin)) return 'Organizer';
    const c = claimOf(e, dev);
    if (!c) return null;
    const posted = new Set(t.scores.filter((s) => s.event_id === e.id && s.player_id === pid && s.strokes != null).map((s) => s.hole));
    let gap = 18;
    for (let h = 1; h <= 18; h++) if (!posted.has(h)) { gap = h; break; }
    for (const h of [gap, Math.max(gap - 1, 1)]) {
      if (sameFoursome(e.roster, e.settings, c.player_id, pid, h)) return pname(e, c.player_id);
    }
    return null;
  }

  function writeScore(e, pid, hole, strokes, by) {
    if (!(hole >= 1 && hole <= 18)) return no('bad_hole');
    if (strokes != null && (strokes < 1 || strokes > 15)) return no('bad_strokes');
    if (!player(e, pid)) return no('unknown_player');
    const row = t.scores.find((s) => s.event_id === e.id && s.player_id === pid && s.hole === hole);
    if (row && row.strokes === strokes) return { ok: true, unchanged: true };
    if (!row && strokes == null) return { ok: true, unchanged: true };
    const at = now();
    const old = row?.strokes ?? null;
    if (row) Object.assign(row, { strokes, updated_by: by, updated_at: at });
    else t.scores.push({ event_id: e.id, player_id: pid, hole, strokes, updated_by: by, updated_at: at });
    log(e, by, `Hole ${hole} · ${pname(e, pid)} ${strokes == null ? `cleared (was ${old})` : old == null ? strokes : `${old} → ${strokes}`}`);
    return { ok: true, updated_at: at, updated_by: by };
  }

  const rpc = {
    create_event({ p_name, p_course, p_roster, p_settings, p_played_on, p_crew_id }) {
      if (!String(p_name || '').trim()) return no('name_required');
      let code;
      do code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
      while (ev(code));
      const id = randomUUID();
      const pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const crew = p_crew_id || randomUUID();
      const e = {
        id, code, name: String(p_name).trim().slice(0, 60), played_on: p_played_on || now().slice(0, 10), crew_id: crew,
        course: p_course, roster: p_roster, settings: p_settings, created_at: now(), updated_at: now(),
      };
      t.events.push(e);
      t.secrets.set(id, pin);
      log(e, 'System', `Round created at ${p_course?.name || 'a course'}`);
      return { ok: true, id, code, admin_pin: pin, crew_id: crew };
    },
    verify_admin({ p_code, p_admin_pin }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      return adminOk(e, p_admin_pin) ? { ok: true } : no('bad_pin');
    },
    claimed_players({ p_code }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      return { ok: true, players: t.claims.filter((c) => c.event_id === e.id).map((c) => c.player_id).sort() };
    },
    whoami({ p_code, p_device_id }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      return { ok: true, player_id: claimOf(e, p_device_id)?.player_id ?? null };
    },
    claim_player({ p_code, p_player_id, p_device_id }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      const p = player(e, p_player_id);
      if (!p) return no('unknown_player');
      const mine = claimOf(e, p_device_id);
      if (mine?.player_id === p_player_id) return { ok: true, player_id: p_player_id };
      if (mine) return no('already_playing', { player_id: mine.player_id });
      if (t.claims.some((c) => c.event_id === e.id && c.player_id === p_player_id)) return no('taken');
      t.claims.push({ event_id: e.id, player_id: p_player_id, device_id: p_device_id });
      log(e, p.name, `Joined as ${p.name}`);
      return { ok: true, player_id: p_player_id };
    },
    leave_round({ p_code, p_device_id }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      const c = claimOf(e, p_device_id);
      if (!c) return { ok: true, player_id: null };
      t.claims = t.claims.filter((x) => x !== c);
      log(e, pname(e, c.player_id), `${pname(e, c.player_id)}'s phone left the round`);
      return { ok: true, player_id: c.player_id };
    },
    request_join({ p_code, p_player_id, p_device_id }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      if (!player(e, p_player_id)) return no('unknown_player');
      const mine = claimOf(e, p_device_id);
      if (mine?.player_id === p_player_id) return { ok: true, claimed: true, player_id: p_player_id };
      if (mine) return no('already_playing', { player_id: mine.player_id });
      if (!t.claims.some((c) => c.event_id === e.id && c.player_id === p_player_id)) {
        return { ...rpc.claim_player({ p_code, p_player_id, p_device_id }), claimed: true };
      }
      for (const j of t.joins) {
        if (j.event_id === e.id && j.status === 'pending' && t.jdev.get(j.id) === p_device_id) j.status = 'expired';
      }
      const id = randomUUID();
      t.joins.push({ id, event_id: e.id, player_id: p_player_id, status: 'pending', approved_by: null, created_at: now() });
      t.jdev.set(id, p_device_id);
      log(e, 'System', `A new phone asked to join as ${pname(e, p_player_id)}`);
      return { ok: true, request_id: id };
    },
    approve_join({ p_code, p_approver_device_id, p_request_id, p_admin_pin }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      const r = t.joins.find((j) => j.id === p_request_id && j.event_id === e.id);
      if (!r) return no('no_request');
      if (r.status !== 'pending') return no(`already_${r.status}`);
      const actor = approver(e, r.player_id, p_approver_device_id, p_admin_pin);
      if (!actor) return no('not_your_foursome');
      const dev = t.jdev.get(r.id);
      t.claims = t.claims.filter((c) => !(c.event_id === e.id && (c.player_id === r.player_id || c.device_id === dev)));
      t.claims.push({ event_id: e.id, player_id: r.player_id, device_id: dev });
      r.status = 'approved';
      r.approved_by = actor;
      log(e, actor, `Let in ${pname(e, r.player_id)}'s new phone`);
      return { ok: true, player_id: r.player_id };
    },
    deny_join({ p_code, p_approver_device_id, p_request_id, p_admin_pin }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      const r = t.joins.find((j) => j.id === p_request_id && j.event_id === e.id);
      if (!r) return no('no_request');
      if (r.status !== 'pending') return no(`already_${r.status}`);
      const actor = approver(e, r.player_id, p_approver_device_id, p_admin_pin);
      if (!actor) return no('not_your_foursome');
      r.status = 'denied';
      r.approved_by = actor;
      return { ok: true };
    },
    upsert_score({ p_code, p_device_id, p_player_id, p_hole, p_strokes }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      const c = claimOf(e, p_device_id);
      if (!c) return no('not_claimed');
      if (!sameFoursome(e.roster, e.settings, c.player_id, p_player_id, p_hole)) return no('not_your_foursome');
      return writeScore(e, p_player_id, p_hole, p_strokes, pname(e, c.player_id));
    },
    admin_upsert_score({ p_code, p_admin_pin, p_player_id, p_hole, p_strokes }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      if (!adminOk(e, p_admin_pin)) return no('bad_pin');
      return writeScore(e, p_player_id, p_hole, p_strokes, 'Organizer');
    },
    update_event({ p_code, p_admin_pin, p_course, p_roster, p_settings, p_name }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      if (!adminOk(e, p_admin_pin)) return no('bad_pin');
      Object.assign(e, { course: p_course, roster: p_roster, settings: p_settings, name: p_name || e.name, updated_at: now() });
      log(e, 'Organizer', 'Settings saved');
      return { ok: true, changes: 1 };
    },
    release_player({ p_code, p_admin_pin, p_player_id }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      if (!adminOk(e, p_admin_pin)) return no('bad_pin');
      const before = t.claims.length;
      t.claims = t.claims.filter((c) => !(c.event_id === e.id && c.player_id === p_player_id));
      if (before !== t.claims.length) log(e, 'Organizer', `Freed up ${pname(e, p_player_id)}'s spot`);
      return { ok: true, released: before !== t.claims.length };
    },
    get_audit_log({ p_code, p_admin_pin }) {
      const e = ev(p_code);
      if (!e) return no('not_found');
      if (!adminOk(e, p_admin_pin)) return no('bad_pin');
      return { ok: true, rows: t.audit.filter((a) => a.event_id === e.id).sort((a, b) => b.id - a.id).map(({ at, actor, action }) => ({ at, actor, action })) };
    },
  };

  // PostgREST-style reads: ?col=eq.x, in.(a,b), gte.x, order=col
  function select(table, params) {
    const rows = { events: t.events, scores: t.scores, join_requests: t.joins }[table];
    if (!rows) return { status: 404, body: { message: 'no table' } };
    let out = rows.slice();
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      const [op, ...rest] = v.split('.');
      const val = rest.join('.');
      if (op === 'eq') out = out.filter((r) => String(r[k]) === val);
      else if (op === 'gte') out = out.filter((r) => String(r[k]) >= val);
      else if (op === 'in') {
        const set = new Set(val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')));
        out = out.filter((r) => set.has(String(r[k])));
      }
    }
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      out.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (dir === 'desc' ? -1 : 1));
    }
    return { status: 200, body: out.map((r) => ({ ...r })) };
  }

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'content-type': 'application/json',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (backend.offline) return route.abort('internetdisconnected');
    const m = url.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_]+)$/);
    if (!m) return route.fulfill({ status: 404, headers: cors, body: '{}' });
    if (m[1]) {
      const fn = rpc[m[2]];
      if (!fn) return route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ message: 'no function' }) });
      const args = req.postData() ? JSON.parse(req.postData()) : {};
      backend.calls.push([m[2], args]);
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(fn(args)) });
    }
    const res = select(m[2], url.searchParams);
    return route.fulfill({ status: res.status, headers: cors, body: JSON.stringify(res.body) });
  }

  const backend = { tables: t, rpc, handle, calls: [], offline: false };
  return backend;
}

const fontCss = `
@font-face { font-family: "Geist"; src: url("/__fonts/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Geist Mono"; src: url("/__fonts/GeistMono-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }`;

/** Wire a browser context to the mock: Supabase API, the CDN script, Google Fonts (served from npm), no realtime. */
export async function attach(context, backend, origin) {
  await context.route(`${SUPABASE}/rest/v1/**`, (route) => backend.handle(route));
  await context.route(`${SUPABASE}/realtime/**`, (route) => route.abort());
  await context.routeWebSocket(/supabase\.co\/realtime/, (ws) => ws.close());
  await context.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@*/dist/umd/supabase.js', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/javascript',
      body: readFileSync(path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js')),
    })
  );
  await context.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: fontCss.replaceAll('/__fonts', `${origin}/__fonts`) }));
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
}

/** Tiny static server for the repo root (+ the Geist font files). */
export async function serve() {
  const http = await import('node:http');
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    if (p.startsWith('/__fonts/')) {
      const name = path.basename(p);
      file = path.join(ROOT, 'node_modules/geist/dist/fonts', name.startsWith('GeistMono') ? 'geist-mono' : 'geist-sans', name);
    } else {
      if (p === '/') p = '/index.html';
      file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end();
        return;
      }
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, close: () => server.close() };
}

/** Seed a Friday-style round: 8 players, 4 named carts, rotating 2v2 match play. */
export function seedRound(backend, { holesPlayed = 0, extra = {} } = {}) {
  const course = { ...COURSES[0], tee: COURSES[0].tees[1] };
  const names = [['Andrew', 'A'], ['Sean', 'A'], ['Mike', 'B'], ['Tyler', 'B'], ['Sam', 'C'], ['Jake', 'C'], ['Chris', 'D'], ['Matt', 'D']];
  const roster = {
    groups: [{ id: 'g1', name: 'Group 1' }, { id: 'g2', name: 'Group 2' }],
    teams: [
      { id: 'A', name: 'Hogan’s Heroes' }, { id: 'B', name: 'Shank Redemption' },
      { id: 'C', name: 'Fore Play' }, { id: 'D', name: 'Bogey Boys' },
    ],
    players: names.map(([name, teamId], i) => ({
      id: `p${i + 1}`, personId: `person-${name.toLowerCase()}`, name, teamId,
      groupId: teamId === 'A' || teamId === 'B' ? 'g1' : 'g2', strokes: name === 'Mike' ? 15 : null,
    })),
  };
  const settings = {
    handicapMode: 'full', allowancePct: 100, game: 'rotationMatch', teamScore: 'bestBallAggregate',
    halvedHolePoints: 0.5, plusMinusCap: null, maxHoleScore: 'doublePar', par3NoMax: false, rotationMode: 'swap',
    rotation: [
      { holes: [1, 6], matches: [['A', 'B'], ['C', 'D']] },
      { holes: [7, 12], matches: [['A', 'C'], ['B', 'D']] },
      { holes: [13, 18], matches: [['A', 'D'], ['B', 'C']] },
    ],
    ...extra,
  };
  const r = backend.rpc.create_event({ p_name: 'Twin Creeks · Fri Oct 16', p_course: course, p_roster: roster, p_settings: settings });
  const e = backend.tables.events.find((x) => x.code === r.code);
  const spread = [0, 1, 0, -1, 1, 2, 0, 1];
  for (let h = 1; h <= holesPlayed; h++) {
    roster.players.forEach((p, i) => {
      backend.tables.scores.push({
        event_id: e.id, player_id: p.id, hole: h, strokes: course.par[h - 1] + spread[(i + h) % spread.length],
        updated_by: p.name, updated_at: new Date(Date.now() - (holesPlayed - h + 1) * 600000 + i * 1000).toISOString(),
      });
    });
  }
  return { ...r, event: e };
}
