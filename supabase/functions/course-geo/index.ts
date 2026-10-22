// course-geo — builds (once per course) the green outlines the GPS yardage card needs, and stores
// them in public.course_geo. Spec: docs/design/yardages/NOTES.md §7.
//
//   POST { course_key, name, lat, lng, holes: [{ hole, par }] }  →  the course_geo row
//
// 1. Return the row if it's ready (or partial, finished, and younger than 7 days). Otherwise mark it
//    `building` (one build at a time per key; a `building` row older than 2 min is retried).
// 2. OpenStreetMap via Overpass (golf=green / hole / tee around the course point). Flaky at peak →
//    treated as "no OSM", never as an error.
// 3. Match OSM hole lines to our scorecard (pars, +9 shift when the nines are swapped).
// 4. Holes OSM lacks: Mapbox satellite (secret MAPBOX_TOKEN) + Claude vision (ANTHROPIC_API_KEY)
//    trace every green and tee box and number the holes from our pars (a beam search over tee → green
//    lengths fills gaps); then one zoomed-in image per traced hole refines its outline until the time
//    budget is up. What's left is saved `partial` with error 'pending…' and the next request (the
//    round load) continues it. The symlinked geobuild.js / geo.js / geodata.js are the app's own files.
// 5. Save the row (ready / partial / failed) and return it.
//
// Deployed with verify_jwt = false (the app's publishable key isn't a JWT); gated by origin like
// course-search. Writes with the service role (SUPABASE_SERVICE_ROLE_KEY, set automatically).
// Data: greens © OpenStreetMap contributors (ODbL) · imagery © Mapbox.
import { parseOverpass, matchOsm, numberHoles, fromTrace, finish, PAR_LENGTH } from './geobuild.js';
import { center, metersBetween, yards } from './geo.js';

const ALLOWED = [/^https:\/\/tiniryno-stack\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const BUDGET_MS = 48000; // Edge Function wall clock is 60 s: leave room to save
const STALE_BUILDING_MS = 2 * 60 * 1000;
const PARTIAL_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_RETRY_MS = 60 * 60 * 1000; // a failed build is tried again after an hour, not on every round load
const MODEL = 'claude-sonnet-4-5';
const OVERVIEW = { w: 1024, h: 1024, zoom: 16, scale: 1 }; // ≈2 m/px → ~2 km across
const DETAIL = { w: 768, h: 768, zoom: 18, scale: 1 };     // ≈0.5 m/px → ~380 m across, a green ≈ 60 px

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAPBOX = Deno.env.get('MAPBOX_TOKEN') ?? '';
const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

type LL = [number, number];
type CardHole = { hole: number; par: number };
type Built = { hole: number; par: number | null; tee: LL; green: LL[]; source: string; confidence: number; refined?: boolean };
type Green = { pts: LL[]; center: LL; source: string; confidence: number };
type Row = {
  course_key: string; name: string; lat: number | null; lng: number | null; holes: Built[];
  source: string; status: string; built_at: string | null; updated_at: string; error: string | null;
};

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'accept, content-type, apikey, authorization, x-client-info',
    Vary: 'Origin',
  };
}
function reply(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
}

// ───────────────────────────────────────────── database (PostgREST with the service role)
const dbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
async function getRow(key: string): Promise<Row | null> {
  const r = await fetch(`${SB_URL}/rest/v1/course_geo?course_key=eq.${encodeURIComponent(key)}&select=*`, { headers: dbHeaders });
  if (!r.ok) throw new Error(`db read ${r.status}`);
  const rows = await r.json();
  return rows[0] ?? null;
}
async function upsertRow(row: Partial<Row> & { course_key: string }): Promise<Row> {
  const r = await fetch(`${SB_URL}/rest/v1/course_geo?on_conflict=course_key`, {
    method: 'POST', headers: { ...dbHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`db write ${r.status} ${await r.text()}`);
  return (await r.json())[0];
}

// ───────────────────────────────────────────── OpenStreetMap
const OSM_HEADERS = {
  'User-Agent': 'golf-live-board/1.0 (course-geo; https://github.com/tiniryno-stack/golf-live-board)',
  Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
};
const osmQuery = (lat: number, lng: number) =>
  `[out:json][timeout:25];(way["golf"="green"](around:1500,${lat},${lng});way["golf"="hole"](around:1500,${lat},${lng});way["golf"="tee"](around:1500,${lat},${lng}););out geom;`;
async function overpassRaw(q: string, log?: string[]) {
  for (const url of OVERPASS) {
    try {
      let r = await fetch(url, { method: 'POST', body: `data=${encodeURIComponent(q)}`, signal: AbortSignal.timeout(15000), headers: OSM_HEADERS });
      if (r.status === 406 || r.status === 405) r = await fetch(`${url}?data=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(15000), headers: OSM_HEADERS }); // some mirrors dislike the POST form
      if (!r.ok) { log?.push(`${url}: ${r.status}`); continue; }
      return await r.json();
    } catch (e) { log?.push(`${url}: ${String(e).slice(0, 60)}`); }
  }
  return null;
}
async function overpass(lat: number, lng: number, log?: string[]) {
  const j = await overpassRaw(osmQuery(lat, lng), log);
  return j ? parseOverpass(j) : null; // "no OSM", not an error
}

// ───────────────────────────────────────────── Mapbox + Claude
async function satellite(lat: number, lng: number, img: typeof OVERVIEW): Promise<string> {
  const u = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng.toFixed(6)},${lat.toFixed(6)},${img.zoom},0/${img.w}x${img.h}${img.scale === 2 ? '@2x' : ''}?access_token=${MAPBOX}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`mapbox ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function trace(b64: string, prompt: string, maxTokens: number): Promise<Record<string, unknown> | null> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens,
      system: 'You trace golf course features from satellite imagery and answer with JSON only: no prose, no code fences.',
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        { type: 'text', text: prompt },
      ] }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text = (j.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const overviewPrompt = (w: number, h: number, card: CardHole[], missing: number[]) =>
  `This is a ${w}×${h} pixel satellite image of a golf course (about 2 m per pixel). The scorecard, hole: par — ${card.map((c) => `${c.hole}: ${c.par}`).join(', ')}. Expected lengths: par 3 ≈ 120–220 yd (60–110 px), par 4 ≈ 300–450 yd (140–210 px), par 5 ≈ 450–600 yd (210–280 px).
Return JSON:
{"holes":[{"hole":1,"tee":[x,y],"green":{"points":[[x,y],…],"confidence":0..1}},…], "greens":[{"points":[[x,y],…],"confidence":0..1}], "tees":[[x,y],…], "clubhouse":[x,y]|null}
- "holes": number the holes you can work out${missing.length < 18 ? ` (we only need ${missing.join(', ')})` : ''}: follow the routing — hole 1 starts near the clubhouse, each tee is close to the previous green, holes 9 and 18 finish near the clubhouse, par 3s are short. A hole's "tee" is a point on its tee box and "green" its putting green as a closed polygon of 8–20 pixel points around the edge (the smooth, uniformly mowed, roughly round or kidney-shaped surface at the end of the fairway; not the fringe, bunkers, tee boxes or the practice green). "confidence" = how sure you are of that hole's number and green.
- "greens": any other putting greens you see that you could not number.
- "tees": tee boxes you could not assign.
- "clubhouse": the clubhouse / parking / first-tee area, or null.
Pixel coordinates, origin top-left, x right, y down. If the course does not fit in the image, do what you can. JSON only.`;

const detailPrompt = (w: number, h: number) =>
  `This is a ${w}×${h} pixel satellite image centered on one golf green (about 0.5 m per pixel). Return JSON:
{"green":{"points":[[x,y],…],"confidence":0..1}}
Trace the putting green closest to the image center as a closed polygon of 12–24 pixel points following its edge precisely (the putting surface only, not the fringe, bunkers or fairway). Pixel coordinates, origin top-left. JSON only.`;

// ───────────────────────────────────────────── the build
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const okOrigin = !!origin && ALLOWED.some((re) => re.test(origin));
  if (!okOrigin) return reply({ error: 'origin_not_allowed' }, 403, null);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return reply({ error: 'post_only' }, 405, origin);
  if (!SB_URL || !SB_KEY) return reply({ error: 'no_database' }, 500, origin);
  // ?diag=1 → which pieces are wired up (never the values) and whether Overpass answers; for checking a deploy.
  if (new URL(req.url).searchParams.get('diag')) {
    const env = Deno.env.toObject();
    const have = (k: string) => !!(env[k] && env[k].length > 8);
    const log: string[] = [];
    const osm = await overpass(33.0504, -97.0985, log); // Bridlewood
    return reply({ mapbox: have('MAPBOX_TOKEN'), anthropic: have('ANTHROPIC_API_KEY'), secretNames: Object.keys(env).filter((k) => /MAPBOX|ANTHROPIC|CLAUDE/i.test(k)), osm: osm ? { greens: osm.greens.length, holes: osm.holes.length, tees: osm.tees.length } : null, log }, 200, origin);
  }

  let body: { course_key?: string; name?: string; lat?: number; lng?: number; holes?: CardHole[] };
  try { body = await req.json(); } catch { return reply({ error: 'bad_json' }, 400, origin); }
  const key = String(body.course_key || '').trim().slice(0, 80);
  const name = String(body.name || '').trim().slice(0, 80);
  const lat = Number(body.lat), lng = Number(body.lng);
  const card: CardHole[] = Array.isArray(body.holes)
    ? body.holes.map((h) => ({ hole: Number(h?.hole), par: Number(h?.par) })).filter((h) => h.hole >= 1 && h.hole <= 18)
    : [];
  if (!key || !name) return reply({ error: 'need_key_and_name' }, 400, origin);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return reply({ error: 'need_location' }, 400, origin);
  if (card.length !== 18) return reply({ error: 'need_18_holes' }, 400, origin);
  card.sort((a, b) => a.hole - b.hole);

  const t0 = Date.now();
  const left = () => BUDGET_MS - (Date.now() - t0);

  // 1. existing row
  let row: Row | null;
  try { row = await getRow(key); } catch (e) { return reply({ error: 'db_unreachable', detail: String(e) }, 502, origin); }
  if (row) {
    const age = Date.now() - Date.parse(row.updated_at);
    const pending = row.status === 'partial' && /^pending/.test(row.error || '');
    if (row.status === 'ready') return reply(row, 200, origin);
    if (row.status === 'partial' && !pending && age < PARTIAL_FRESH_MS) return reply(row, 200, origin);
    if (row.status === 'building' && age < STALE_BUILDING_MS) return reply(row, 202, origin);
    if (row.status === 'failed' && age < FAILED_RETRY_MS) return reply(row, 200, origin);
  }
  const fixed = new Map<number, Built>();
  if (row && row.status !== 'failed') for (const h of row.holes || []) if (h.source === 'fixed') fixed.set(h.hole, h);
  const keep: Built[] = row?.status === 'partial' ? (row.holes || []).filter((h) => h.source !== 'fixed') : [];
  try {
    row = await upsertRow({ course_key: key, name, lat, lng, status: 'building', error: null, holes: row?.holes || [], source: row?.source || 'none' });
  } catch (e) { return reply({ error: 'db_write_failed', detail: String(e) }, 502, origin); }

  const notes: string[] = [];
  let holes = new Map<number, Built>(fixed);
  for (const h of keep) if (!holes.has(h.hole)) holes.set(h.hole, h);

  try {
    // 2 + 3. OpenStreetMap, unless this is a continuation that already has OSM holes
    let unnumbered: Green[] = [], tees: LL[] = [];
    if (holes.size < 18) {
      const osm = await overpass(lat, lng, notes);
      if (osm) {
        const m = matchOsm(card, osm);
        for (const [h, b] of m.holes) if (!holes.has(h)) holes.set(h, b);
        unnumbered = osm.greens.filter((_, i) => !m.usedGreens.has(i));
        tees = osm.tees;
        notes.push(`osm ${m.holes.size} holes${m.shift ? ' (+9 shift)' : ''}`);
      } else notes.push('osm unreachable');
    }

    // 4. AI tracing for what's missing
    const missing = () => card.filter((h) => !holes.has(h.hole)).map((h) => h.hole);
    if (missing().length && MAPBOX && ANTHROPIC && left() > 20000) {
      const img = OVERVIEW;
      const b64 = await satellite(lat, lng, img);
      const tr = await trace(b64, overviewPrompt(img.w, img.h, card, missing()), 6000);
      const frame = { ...img, lat, lng };
      // numbered holes the model is sure of, when the tee → green length fits the par
      const pool: Green[] = [];
      let taken = 0;
      for (const ah of (Array.isArray(tr?.holes) ? tr!.holes : []) as { hole?: number; tee?: number[]; green?: { points?: number[][]; confidence?: number } }[]) {
        const n = Number(ah?.hole);
        const g = fromTrace({ greens: ah?.green ? [ah.green] : [] }, frame).greens[0];
        if (!g) continue;
        const tee = fromTrace({ tees: ah?.tee ? [ah.tee] : [] }, frame).tees[0];
        const par = card.find((c) => c.hole === n)?.par;
        const [lo, hi] = PAR_LENGTH[par as 3 | 4 | 5] || [100, 650];
        const len = tee ? yards(metersBetween(tee, g.center)) : null;
        const known = [...holes.values()].some((h) => yards(metersBetween(center(h.green), g.center)) < 25);
        if (known) continue;
        if (n >= 1 && n <= 18 && !holes.has(n) && tee && len !== null && len >= lo - 40 && len <= hi + 60) {
          holes.set(n, { hole: n, par: par ?? null, tee, green: g.pts, source: 'ai', confidence: g.confidence });
          taken++;
        } else pool.push(g);
      }
      const found = fromTrace(tr, frame);
      notes.push(`ai numbered ${taken}, saw ${found.greens.length + pool.length} other greens, ${found.tees.length} tees`);
      // greens already placed are not new
      const known = [...holes.values()].map((h) => center(h.green));
      const fresh = [...pool, ...found.greens].filter((g) => !known.some((c) => yards(metersBetween(c, g.center)) < 25));
      const start = found.clubhouse || [lat, lng];
      holes = numberHoles(card, holes, [...unnumbered, ...fresh], [...tees, ...found.tees], start);
      // zoom in on each AI-traced hole to trace its outline precisely, while time allows
      const rough = [...holes.values()].filter((h) => h.source === 'ai' && !h.refined).sort((a, b) => a.hole - b.hole);
      for (const h of rough) {
        if (left() < 12000) { notes.push(`pending: refine ${rough.filter((x) => !x.refined).map((x) => x.hole).join(', ')}`); break; }
        try {
          const c = center(h.green);
          const d = await satellite(c[0], c[1], DETAIL);
          const tr2 = await trace(d, detailPrompt(DETAIL.w, DETAIL.h), 1500);
          const g = tr2?.green as { points?: number[][]; confidence?: number } | undefined;
          const got = fromTrace({ greens: g ? [g] : [] }, { ...DETAIL, lat: c[0], lng: c[1] }).greens[0];
          if (got && yards(metersBetween(got.center, c)) < 60) { h.green = got.pts; h.confidence = 0.5 + got.confidence / 2; }
          h.refined = true;
        } catch (e) { notes.push(`hole ${h.hole}: ${String(e).slice(0, 60)}`); }
      }
    } else if (missing().length) {
      if (!MAPBOX || !ANTHROPIC) notes.push('no AI keys');
    }
  } catch (e) {
    notes.push(`build error: ${String(e).slice(0, 120)}`);
  }

  // 5. save
  const done = finish(holes);
  const pending = notes.find((n) => n.startsWith('pending'));
  // Unrefined AI holes keep the row `partial` + 'pending…' so the next request picks up where this stopped.
  let status = done.status, error = done.error;
  if (pending && done.holes.length) { status = 'partial'; error = [pending, error].filter(Boolean).join(' · '); }
  const note = notes.filter((n) => !n.startsWith('pending')).join(' · ');
  try {
    row = await upsertRow({
      course_key: key, name, lat, lng, holes: done.holes, source: done.source, status,
      built_at: new Date().toISOString(), error: error ? `${error}${note ? ' [' + note + ']' : ''}` : note ? `[${note}]` : null,
    });
  } catch (e) { return reply({ error: 'db_write_failed', detail: String(e) }, 502, origin); }
  return reply(row, 200, origin);
});
