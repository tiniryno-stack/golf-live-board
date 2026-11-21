// Renders 034's screenshots from prototype.html at 393 × 659 (the iPhone 15/16 usable area) at 2×.
//   npm install   (once: Playwright + the Geist fonts)
//   node docs/design/features/034-enter-turn-sideways/shoot.mjs            all shots
//   node docs/design/features/034-enter-turn-sideways/shoot.mjs 20 13      only shots whose name starts with these
// Every frame is exact: the script sets a scene with window.__033, triggers the motion, then pauses every running
// animation at the stated millisecond (document.getAnimations → pause → currentTime = t). Strips put several
// frames of one motion side by side (or stacked) with their times.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const font = (p) => pathToFileURL(path.join(root, 'node_modules/geist/dist/fonts', p)).href;
const FONTS = `@font-face{font-family:Geist;src:url(${font('geist-sans/Geist-Variable.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:"Geist Mono";src:url(${font('geist-mono/GeistMono-Variable.woff2')}) format('woff2');font-weight:100 900}`;
// the strip page is about:blank, which can't load file:// fonts: embed them
const b64 = (p) => fs.readFileSync(path.join(root, 'node_modules/geist/dist/fonts', p)).toString('base64');
const FONTS64 = `@font-face{font-family:Geist;src:url(data:font/woff2;base64,${b64('geist-sans/Geist-Variable.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:"Geist Mono";src:url(data:font/woff2;base64,${b64('geist-mono/GeistMono-Variable.woff2')}) format('woff2');font-weight:100 900}`;
const out = path.join(here, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const want = (name) => !only.length || only.some((p) => name.startsWith(p));

const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
async function phone(theme = 'dark') {
  const page = await browser.newPage({ viewport: { width: 393, height: 659 }, deviceScaleFactor: 2, colorScheme: theme });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(pathToFileURL(path.join(here, 'prototype.html')).href);
  await page.addStyleTag({ content: FONTS });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const pages = { dark: await phone('dark'), light: await phone('light') };

// a scene: base state + an action, frozen at t ms. Returns a PNG buffer (whole screen, or a clip).
async function frame(theme, scene, action, t, clip = null) {
  const page = pages[theme];
  await page.evaluate(({ scene, theme }) => window.__033.set({ ...scene, theme }), { scene, theme });
  await page.evaluate(({ action, t }) => {
    const A = window.__033, $ = (s) => document.querySelector(s);
    const act = {
      none: () => {},
      next: () => A.next(),
      prev: () => $('[data-act="prev"]').click(),
      fwd: () => $('[data-act="next1"]').click(),
      jump: () => A.go(action.to),
      pick: () => A.pick(action.id, action.v),
      nudge: () => A.next(),
      open: () => A.open(true),
      close: () => A.open(false),
    }[action.do || 'none'];
    act();
    A.freeze(t);
  }, { action, t });
  const page2 = page;
  let box = null;
  if (clip) box = await page2.evaluate((sel) => {
    const [a, b] = sel.split('..'); const r1 = document.querySelector(a).getBoundingClientRect(), r2 = document.querySelector(b || a).getBoundingClientRect();
    return { x: 0, y: Math.max(0, r1.top - 6), width: 393, height: Math.min(659, r2.bottom + 6) - Math.max(0, r1.top - 6) };
  }, clip);
  return page.screenshot(box ? { clip: box } : {});
}
const save = (name, buf) => { fs.writeFileSync(path.join(out, `${name}.png`), buf); console.log(name); };

// put frames in a row (full screens) or a column (clips), each with its time
const sheet = await browser.newPage({ deviceScaleFactor: 2 });
async function strip(name, theme, frames, { col = false, title = '' } = {}) {
  const bg = theme === 'light' ? '#dfe2e6' : '#050607', fg = theme === 'light' ? '#4f555e' : '#a7acb4', tx = theme === 'light' ? '#0b0d10' : '#f4f5f7';
  const imgs = frames.map(({ buf, label }) => `<figure><img src="data:image/png;base64,${buf.toString('base64')}"><figcaption>${label}</figcaption></figure>`).join('');
  await sheet.setContent(`<style>${FONTS64} body{margin:0;background:${bg};font:600 12px/16px "Geist Mono";letter-spacing:1px;color:${fg}}
    .w{display:inline-flex;flex-direction:column;gap:12px;padding:20px} .f{display:flex;flex-direction:${col ? 'column' : 'row'};gap:${col ? 10 : 16}px}
    h1{font:600 15px/20px Geist;letter-spacing:0;color:${tx};margin:0;max-width:${col ? 460 : 1600}px}
    figure{margin:0;display:flex;flex-direction:${col ? 'row' : 'column'};gap:8px;align-items:${col ? 'center' : 'flex-start'}} figcaption{${col ? 'width:64px;text-align:right' : ''}}
    img{display:block;zoom:.5;border-radius:${col ? 0 : 48}px}</style><div class="w">${title ? `<h1>${title}</h1>` : ''}<div class="f">${imgs}</div></div>`);
  await sheet.evaluate(() => document.fonts.ready);
  await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const el = await sheet.$('.w');
  save(name, await el.screenshot());
}

// ── scenes (033's) ──────────────────────────────────────────────────────────────────────────
const sc = (h) => ({ [`${h}:A`]: 4, [`${h}:S`]: 5, [`${h}:M`]: 4 });
const all = (h, ids = ['A', 'S', 'M', 'J']) => Object.fromEntries(ids.map((id, i) => [`${h}:${id}`, [4, 5, 4, 3][i]]));
const BASE = { game: 'carts', gps: 'regular', turn: 'hole', motion: 'normal', final: false, cur: 4, view: 4 };
const FWD = { ...BASE, scores: all(4) };
const BACK = { ...BASE, cur: 5, view: 5, scores: { ...all(4), '5:A': 4 } };
const OPT = { slide: ['c-slide', '(c) Slide'], book: ['d-book', '(d) Book page'] };

// full screens at 0 / 90 / 150 / 300 ms, forward and back, dark + light
let n = 1;
for (const opt of ['slide', 'book']) for (const dir of ['fwd', 'back']) for (const t of [0, 90, 150, 300]) {
  const name = `${String(n++).padStart(2, '0')}-${OPT[opt][0]}-${dir === 'fwd' ? 'forward' : 'back'}-${String(t).padStart(3, '0')}`;
  const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: opt }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
  for (const th of ['dark', 'light']) if (want(name)) save(`${name}${th === 'light' ? '-light' : ''}`, await frame(th, scene, action, t));
}
// strips: the two new ones and 033's two, same frames, for comparing
n = 20;
for (const opt of ['slide', 'book', 'flip', 'page']) for (const dir of ['fwd', 'back']) {
  const label = { ...OPT, flip: ['a-flip', '(a) Flip (033)'], page: ['b-page', '(b) Page turn (033)'] }[opt];
  const name = `${n++}-${label[0]}-${dir === 'fwd' ? 'forward' : 'back'}-strip`;
  if (!want(name)) continue;
  const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: opt }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
  const frames = [];
  for (const t of [0, 60, 120, 180, 240, 300, 600]) frames.push({ buf: await frame('dark', scene, action, t), label: `${t} ms` });
  await strip(name, 'dark', frames, { title: `${label[1]} · ${dir === 'fwd' ? 'Next hole 4 → 5' : '◀ 5 → 4'}` });
}
// the cases that matter for (c) and (d): into "Up next" (yardage card leaves), a partner switch, the yardage card close up
const MID = [
  ['30-c-slide-to-up-next', { ...BASE, scores: sc(4) }, { do: 'fwd' }, '(c) ▶ to “Up next”: the card slides, the yardage card slides out of its place, the rows move up'],
  ['31-c-slide-2v2-new-partner', { ...BASE, game: '2v2', cur: 6, view: 6, scores: all(6), seenSwitch: { '2v27': true } }, { do: 'next' }, '(c) 2v2, 6 → 7: new partner, the match line slides too'],
  ['32-d-book-to-up-next', { ...BASE, turn: 'book', scores: sc(4) }, { do: 'fwd' }, '(d) ▶ to “Up next”'],
];
for (const [name, scene, action, title] of MID) {
  if (!want(name)) continue;
  const frames = [];
  for (const t of [0, 60, 120, 180, 300, 600]) frames.push({ buf: await frame('dark', scene, action, t), label: `${t} ms` });
  await strip(name, 'dark', frames, { title });
}
for (const th of ['dark', 'light']) {
  const name = '33-c-slide-yardage-strip';
  if (!want(name)) continue;
  const frames = [];
  for (const t of [0, 60, 120, 180, 240, 300, 420]) frames.push({ buf: await frame(th, { ...BASE, cur: 9, view: 9, scores: all(9) }, { do: 'next' }, t, '.ce-head...green-card'), label: `${t} ms` });
  await strip(`${name}${th === 'light' ? '-light' : ''}`, th, frames, { col: true, title: '(c) and (d): the yardage card, hole 9 → 10 · frame stays, picture and digits slide left' });
}
// ── round 2: (e) whole hole and (f) wave ───────────────────────────────────────────────────
const R2 = { hole: ['e-whole-hole', '(e) Whole hole'], wave: ['f-wave', '(f) Whole hole, wave'] };
n = 40;
for (const opt of ['hole', 'wave']) for (const dir of ['fwd', 'back']) for (const t of [0, 90, 150, 300]) {
  const name = `${n++}-${R2[opt][0]}-${dir === 'fwd' ? 'forward' : 'back'}-${String(t).padStart(3, '0')}`;
  const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: opt }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
  for (const th of ['dark', 'light']) if (want(name)) save(`${name}${th === 'light' ? '-light' : ''}`, await frame(th, scene, action, t));
}
n = 60;
for (const opt of ['hole', 'wave']) for (const dir of ['fwd', 'back']) {
  const name = `${n++}-${R2[opt][0]}-${dir === 'fwd' ? 'forward' : 'back'}-strip`;
  if (!want(name)) continue;
  const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: opt }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
  const frames = [];
  for (const t of [0, 40, 80, 120, 180, 240, 400]) frames.push({ buf: await frame('dark', scene, action, t), label: `${t} ms` });
  await strip(name, 'dark', frames, { title: `${R2[opt][1]} · ${dir === 'fwd' ? 'Next hole 4 → 5' : '◀ 5 → 4'}` });
}
const MID2 = [
  ['64-e-whole-hole-to-up-next', { ...BASE, scores: sc(4) }, { do: 'fwd' }, '(e) ▶ to “Up next”: that page has no yardage card, so it just isn’t there'],
  ['65-e-whole-hole-2v2-new-partner', { ...BASE, game: '2v2', cur: 6, view: 6, scores: all(6), seenSwitch: { '2v27': true } }, { do: 'next' }, '(e) 2v2, 6 → 7: new partner'],
  ['66-e-whole-hole-no-yardage', { ...BASE, gps: 'off', scores: all(4) }, { do: 'next' }, '(e) No yardage card'],
  ['67-f-wave-to-up-next', { ...BASE, turn: 'wave', scores: sc(4) }, { do: 'fwd' }, '(f) ▶ to “Up next”'],
];
for (const [name, scene, action, title] of MID2) {
  if (!want(name)) continue;
  const frames = [];
  for (const t of [0, 40, 80, 120, 180, 240, 400]) frames.push({ buf: await frame('dark', scene, action, t), label: `${t} ms` });
  await strip(name, 'dark', frames, { title });
}
// ── round 3: (g) just the cards ───────────────────────────────────────────────────────────
n = 70;
for (const dir of ['fwd', 'back']) for (const tm of [0, 90, 150, 300]) {
  const name = `${n++}-g-cards-${dir === 'fwd' ? 'forward' : 'back'}-${String(tm).padStart(3, '0')}`;
  const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: 'cards' }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
  for (const th of ['dark', 'light']) if (want(name)) save(`${name}${th === 'light' ? '-light' : ''}`, await frame(th, scene, action, tm));
}
const R3 = [
  ['80-g-cards-forward-strip', FWD, { do: 'next' }, '(g) Just the cards · Next hole 4 → 5'],
  ['81-g-cards-back-strip', BACK, { do: 'prev' }, '(g) Just the cards · ◀ 5 → 4'],
  ['82-g-cards-to-up-next', { ...BASE, scores: sc(4) }, { do: 'fwd' }, '(g) ▶ to “Up next”: the yardage card leaves with the card; the rest crossfades into its new place'],
  ['83-g-cards-2v2-new-partner', { ...BASE, game: '2v2', cur: 6, view: 6, scores: all(6), seenSwitch: { '2v27': true } }, { do: 'next' }, '(g) 2v2, 6 → 7: new partner, the match line crossfades'],
  ['84-g-cards-no-yardage', { ...BASE, gps: 'off', scores: all(4) }, { do: 'next' }, '(g) No yardage card'],
];
for (const [name, scene, action, title] of R3) {
  if (!want(name)) continue;
  const frames = [];
  for (const tm of [0, 60, 120, 180, 240, 320, 420]) frames.push({ buf: await frame('dark', { ...scene, turn: 'cards' }, action, tm), label: `${tm} ms` });
  await strip(name, 'dark', frames, { title });
}
// ── round 4: the latest layout (names outside, match line above the yardage) + entering for the rest of your tee time ──
const L = { ...BASE, turn: 'cards', rows: 'outside', mline: 'top', openAnim: 'morph' };
for (const th of ['dark', 'light']) {
  if (want('90')) save(`90-layout-rest${th === 'light' ? '-light' : ''}`, await frame(th, { ...L, cur: 5, view: 5, scores: { '5:A': 4 } }, {}, 0));
  if (want('91')) save(`91-layout-birdie-word${th === 'light' ? '-light' : ''}`, await frame(th, { ...L, cur: 5, view: 5, scores: {} }, { do: 'pick', id: 'S', v: 3 }, 400));
  if (want('92')) save(`92-their-cards-open${th === 'light' ? '-light' : ''}`, await frame(th, { ...L, cur: 5, view: 5, open: 5, scores: { '5:A': 4, '5:S': 5, '5:M': 4 } }, {}, 0));
}
const OPEN = [
  ['93-open-improved-strip', { ...L, cur: 5, view: 5, scores: { '5:A': 4, '5:S': 5, '5:M': 4 } }, { do: 'open' }, 'Improved · tap “Sam 4 Jake – Enter”: the names travel, their cards grow out of the row, yours fold into one line'],
  ['94-close-improved-strip', { ...L, cur: 5, view: 5, open: 5, scores: { '5:A': 4, '5:S': 5, '5:M': 4, '5:J': 5 } }, { do: 'close' }, 'Improved · tap “‹ Back”: the same, backwards (never by itself)'],
  ['95-open-today-strip', { ...L, openAnim: 'today', cur: 5, view: 5, scores: { '5:A': 4, '5:S': 5, '5:M': 4 } }, { do: 'open' }, 'As today (027) · the blur swap in place'],
];
for (const [name, scene, action, title] of OPEN) {
  if (!want(name)) continue;
  const frames = [];
  for (const tm of [0, 80, 160, 240, 320, 400, 600]) frames.push({ buf: await frame('dark', scene, action, tm), label: `${tm} ms` });
  await strip(name, 'dark', frames, { title });
}
// ── score picks v2: louder par → ace (your cart's card, the approved layout) ──
const PK = { ...BASE, turn: 'cards', rows: 'outside', mline: 'top', cur: 5, view: 5, scores: { '5:S': 5 } };
const PICKS2 = [
  ['96-pick-v2-par', PK, 4, 'Par v2: bouncier pop, stronger pulse, a soft card flash, “Par” 17px lifts in, holds 2s'],
  ['97-pick-v2-birdie', PK, 3, 'Birdie v2: bigger bounce, 2 rings, 8 sparks, the card flashes, “Birdie” in green, holds 2.6s'],
  ['98-pick-v2-eagle', PK, 2, 'Eagle v2: biggest bounce, 3 rings, 12 sparks reaching further, the card flashes twice, holds 3.5s'],
  ['99-pick-v2-ace', { ...PK, cur: 3, view: 3, scores: { '3:S': 3 } }, 1, 'Ace (par 3): the eagle tier plus a second burst'],
];
for (const [name, scene, v, title] of PICKS2) for (const th of ['dark', 'light']) {
  if (!want(name)) continue;
  const frames = [];
  for (const tm of [0, 100, 200, 320, 480, 700, 1100]) frames.push({ buf: await frame(th, scene, { do: 'pick', id: 'A', v }, tm, '.ce-body .pgrp'), label: `${tm} ms` });
  await strip(`${name}${th === 'light' ? '-light' : ''}`, th, frames, { col: true, title });
}
await browser.close();
