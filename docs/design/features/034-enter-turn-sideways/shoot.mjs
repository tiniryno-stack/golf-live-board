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
const BASE = { game: 'carts', gps: 'regular', turn: 'slide', motion: 'normal', final: false, cur: 4, view: 4 };
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
await browser.close();
