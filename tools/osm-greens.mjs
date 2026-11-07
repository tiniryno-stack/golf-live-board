// tools/osm-greens.mjs — build a course's GPS greens from OpenStreetMap, checked against our scorecard.
// The way that worked for Firewheel Lakes (Nov 7, 2026); docs/design/yardages/NOTES.md §9 has the whole story.
//
//   node tools/osm-greens.mjs <course id in js/courses.js> [bbox: minLng,minLat,maxLng,maxLat] [--name "Short name"]
//   (cloud session: NODE_USE_ENV_PROXY=1 node tools/osm-greens.mjs …, so Node's fetch goes through the proxy)
//
// 1. Reads everything mapped in the box from the MAIN OpenStreetMap API (api.openstreetmap.org, map call). The
//    Overpass mirrors the course-geo function uses are often down; this server isn't. Box: ±0.012° around the
//    course's lat/lng unless given (the API allows up to 0.25 square degrees; one course is ~0.0005).
// 2. Takes golf=green and golf=tee ways that carry a hole number (ref 1–18).
// 3. Checks every hole against the card: the green exists, its depth looks like a green (12–50 yd), and the
//    tee boxes' straight-line lengths fit the card's per-tee yardages (straight lines run short on doglegs, so a
//    hole may be up to ~20% under, never much over). Prints a table and a verdict.
// 4. Prints the block to paste into js/geodata.js (`const NAME = {…}` + the GEO key line). Built-in greens beat the
//    course_geo table and need no network on the course.
// No ref tags (the mapper didn't number them)? Run the numbering instead: geobuild.numberHoles with the greens +
// tees — and check it by hand, it got holes 5–18 wrong at Firewheel. Nothing mapped at all? NOTES.md §9, step 4.
import { COURSES } from '../js/courses.js';
import { center, metersBetween, yards, yardages } from '../js/geo.js';

const args = process.argv.slice(2);
const id = args[0];
const nameAt = args.indexOf('--name');
const short = nameAt > 0 ? args[nameAt + 1] : null;
const course = COURSES.find((c) => c.id === id);
if (!course) { console.error(`No course "${id}" in js/courses.js (add the checked scorecard first).`); process.exit(1); }
const box = args[1] && !args[1].startsWith('--') ? args[1] : [course.lng - 0.012, course.lat - 0.012, course.lng + 0.012, course.lat + 0.012].map((v) => v.toFixed(4)).join(',');

const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${box}`, { headers: { 'User-Agent': 'golf-live-board/1.0 (https://github.com/tiniryno-stack/golf-live-board)' } });
if (!res.ok) { console.error(`OpenStreetMap answered ${res.status}. (In a cloud session, api.openstreetmap.org has to be in the environment's allowed hosts.)`); process.exit(1); }
const d = await res.json();
const nodes = new Map(d.elements.filter((e) => e.type === 'node').map((e) => [e.id, [e.lat, e.lon]]));
const ways = d.elements.filter((e) => e.type === 'way');
const ptsOf = (w) => w.nodes.map((n) => nodes.get(n)).filter(Boolean);
const yd = (a, b) => Math.round(yards(metersBetween(a, b)));
const r5 = (v) => Math.round(v * 1e5) / 1e5;

const G = {}, T = {};
let unnumbered = 0;
for (const w of ways) {
  const t = w.tags || {};
  if (t.golf !== 'green' && t.golf !== 'tee') continue;
  const ref = parseInt(t.ref, 10);
  if (!(ref >= 1 && ref <= 18)) { unnumbered++; continue; }
  let p = ptsOf(w);
  if (t.golf === 'green') { if (p.length > 2 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p = p.slice(0, -1); G[ref] = p; }
  else (T[ref] ||= []).push(center(p));
}
const courses = [...new Set(d.elements.filter((e) => e.tags?.leisure === 'golf_course').map((e) => e.tags.name || '(no name)'))];
console.log(`OSM: ${Object.keys(G).length} numbered greens, ${Object.values(T).flat().length} numbered tees, ${unnumbered} unnumbered greens/tees · courses in the box: ${courses.join(', ') || 'none'}`);

let bad = 0;
const holes = [];
for (let h = 1; h <= 18; h++) {
  const card = Object.values(course.yards?.[h - 1] || {}).map(Number).sort((a, b) => b - a);
  if (!G[h]) { console.log(`hole ${h}: NO GREEN`); bad++; continue; }
  const g = center(G[h]);
  const tees = (T[h] || []).sort((a, b) => metersBetween(b, g) - metersBetween(a, g));
  const lens = tees.map((t) => yd(t, g));
  const depth = tees.length ? (({ front, back }) => back - front)(yardages(tees[0], G[h])) : null;
  const longest = lens[0] ?? null, cardMax = card[0] ?? null;
  const ratio = longest && cardMax ? longest / cardMax : null;
  const flags = [];
  if (!tees.length) flags.push('no tees');
  if (depth != null && (depth < 12 || depth > 50)) flags.push(`depth ${depth} yd?`);
  if (ratio != null && (ratio < 0.8 || ratio > 1.06)) flags.push(`length ${longest} vs card ${cardMax}`);
  if (flags.length) bad++;
  console.log(`hole ${String(h).padStart(2)} par ${course.par[h - 1]} · card ${card.join('/') || '—'} · OSM tees→green ${lens.join('/') || '—'} · depth ${depth ?? '—'}${flags.length ? '  ← ' + flags.join(', ') : ''}`);
  if (tees.length) holes.push({ hole: h, tee: tees[0].map(r5), green: G[h].map((p) => p.map(r5)) });
}
console.log(bad ? `\n${bad} hole(s) need a look before this ships (NOTES.md §9).` : '\nAll 18 holes check out against the card.');

const NAME = (short || course.shortName || id).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
console.log(`\n// ---- paste into js/geodata.js (above \`export const GEO\`), then add:  "${id}": ${NAME},`);
console.log(`const ${NAME} = {\n  name: ${JSON.stringify(short || course.shortName || id)},\n  source: "osm",\n  holes: [\n${holes.map((x) => `    { hole: ${x.hole}, tee: ${JSON.stringify(x.tee)}, green: ${JSON.stringify(x.green)} },`).join('\n')}\n  ],\n};`);
