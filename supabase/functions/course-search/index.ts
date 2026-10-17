// course-search — backup route to OpenGolfAPI for phones that can't call it directly
// (CORS or a network that filters it). Forwards only two read-only lookups of public course
// data: GET ?q= / ?lat=&lng=&radius_mi= (search) and GET ?id=<uuid> (one course + scorecard).
// No secrets. Only answers browsers on our own site (or a local dev server).
// Deployed with verify_jwt = false: the app's publishable key isn't a JWT, and this function
// gates itself (allowed origins, allowed paths, GET only).
// Data: © OpenStreetMap contributors (ODbL 1.0) via OpenGolfAPI.

const BASE = 'https://api.opengolfapi.org/api/v1/courses';
const ALLOWED = [/^https:\/\/tiniryno-stack\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'accept, content-type, apikey, authorization, x-client-info',
    Vary: 'Origin',
  };
}

function reply(body: unknown, status: number, origin: string | null, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin), ...extra },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const okOrigin = !!origin && ALLOWED.some((re) => re.test(origin));
  if (!okOrigin) return reply({ error: 'origin_not_allowed' }, 403, null);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'GET') return reply({ error: 'get_only' }, 405, origin);

  const u = new URL(req.url);
  const id = u.searchParams.get('id');
  let target: string;
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: 'bad_id' }, 400, origin);
    target = `${BASE}/${id}`;
  } else {
    const p = new URLSearchParams();
    for (const k of ['q', 'lat', 'lng', 'radius_mi', 'limit', 'state']) {
      const v = u.searchParams.get(k);
      if (v) p.set(k, v.slice(0, 60));
    }
    if (!p.get('q') && !(p.get('lat') && p.get('lng'))) return reply({ error: 'need_q_or_location' }, 400, origin);
    target = `${BASE}/search?${p}`;
  }

  try {
    const r = await fetch(target, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', ...cors(origin) },
    });
  } catch {
    return reply({ error: 'upstream_unreachable' }, 502, origin);
  }
});
