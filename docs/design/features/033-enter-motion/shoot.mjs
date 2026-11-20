// Renders 033's screenshots from prototype.html at 393 × 659 (the iPhone 15/16 usable area) at 2×.
//   npm install   (once: Playwright + the Geist fonts)
//   node docs/design/features/033-enter-motion/shoot.mjs            all shots
//   node docs/design/features/033-enter-motion/shoot.mjs 20 13      only shots whose name starts with these
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

// ── scenes ──────────────────────────────────────────────────────────────────────────────────
const sc = (h) => ({ [`${h}:A`]: 4, [`${h}:S`]: 5, [`${h}:M`]: 4 });                 // hole 4 / par 4, Jake still to go
const all = (h, ids = ['A', 'S', 'M', 'J']) => Object.fromEntries(ids.map((id, i) => [`${h}:${id}`, [4, 5, 4, 3][i]]));
const BASE = { game: 'carts', gps: 'regular', turn: 'flip', motion: 'normal', final: false, cur: 4, view: 4 };
const STATES = [
  ['01-team-cart', { ...BASE, scores: sc(4) }],
  ['02-team-cart-no-yardage', { ...BASE, gps: 'off', scores: sc(4) }],
  ['03-team-cart-compact', { ...BASE, gps: 'compact', scores: sc(4) }],
  ['04-2v2', { ...BASE, game: '2v2', scores: sc(4) }],
  ['05-six-sitting-out', { ...BASE, game: 'six', scores: { '4:A': 4 } }],
  ['06-scorecard', { ...BASE, game: 'solo', scores: { '4:A': 5, '4:S': 4 } }],
  ['07-scorecard-no-yardage', { ...BASE, game: 'solo', gps: 'off', scores: { '4:A': 5, '4:S': 4 } }],
  ['08-up-next', { ...BASE, view: 5, scores: sc(4) }],
];
for (const [name, scene] of STATES) for (const th of ['dark', 'light']) if (want(name)) save(`${name}${th === 'light' ? '-light' : ''}`, await frame(th, scene, {}, 0));

// Part 1 · picks: Andrew's row, stacked frames. Hole 5 = par 4 (no stroke for Andrew).
const PICK = { ...BASE, cur: 5, view: 5, scores: { ...all(4), '5:S': 5 } };
const PT = [0, 80, 160, 260, 400, 560, 1000];
const picks = [
  ['10-pick-eagle', 2, 'Eagle (2 on a par 4): bump, two ripples, the burst, “Eagle” 17px lifts in and holds 3s'],
  ['11-pick-birdie', 3, 'Birdie: bump, one ripple, “Birdie” 17px lifts in and holds 2.2s'],
  ['12-pick-par', 4, 'Par: a bigger pop, one soft pulse, “Par” in full text color'],
  ['13-pick-bogey', 5, 'Bogey: bump, then the wince (this one pad, a decaying shake + twist)'],
  ['14-pick-double', 6, 'Double: the mark stamps in, the pad thuds, then the hard wince; the word tilts, red'],
];
for (const [name, v, title] of picks) for (const th of ['dark', 'light']) {
  if (!want(name)) continue;
  const frames = [];
  for (const t of PT) frames.push({ buf: await frame(th, PICK, { do: 'pick', id: 'A', v }, t, '.ce-card .ce-row'), label: `${t} ms` });
  await strip(`${name}${th === 'light' ? '-light' : ''}`, th, frames, { col: true, title });
}
if (want('15')) { // Sean gets a stroke on 5: a gross bogey (square mark) that is a NET par (pop + pulse, "Net par")
  const frames = [];
  for (const t of PT) frames.push({ buf: await frame('dark', { ...PICK, scores: { ...all(4), '5:A': 4 } }, { do: 'pick', id: 'S', v: 5 }, t, '.ce-card .ce-row:nth-child(2)'), label: `${t} ms` });
  await strip('15-pick-net-par', 'dark', frames, { col: true, title: 'Sean, 1 stroke: 5 on a par 4 = gross bogey (square mark) but net par → par motion, “Net par”' });
}
for (const th of ['dark', 'light']) if (want('16')) { // the wince vs the "missing score" nudge
  const frames = [];
  for (const t of [0, 120, 240, 360, 520]) frames.push({ buf: await frame(th, PICK, { do: 'pick', id: 'A', v: 5 }, t, '.ce-card .ce-row'), label: `wince ${t}` });
  for (const t of [0, 110, 220, 340, 560]) frames.push({ buf: await frame(th, { ...PICK, scores: { ...all(4) } }, { do: 'nudge' }, t, '.ce-card'), label: `nudge ${t}` });
  await strip(`16-wince-vs-nudge${th === 'light' ? '-light' : ''}`, th, frames, { col: true, title: 'Bogey wince (one picked pill, decaying, with a twist) vs the missing-score nudge (every empty pad in the row, even ±4px, twice)' });
}

// Part 2 · the turn, full screens at 0 / 90 / 150 / 300 ms. Forward = Next hole on 4 (all in) → 5. Back = ◀ on 5 → 4.
const FWD = { ...BASE, scores: all(4) };
const BACK = { ...BASE, cur: 5, view: 5, scores: { ...all(4), '5:A': 4 } };
const T4 = [0, 90, 150, 300];
let n = 20;
for (const [opt, dirs] of [['flip', 'Flip'], ['page', 'Page turn']]) {
  for (const dir of ['fwd', 'back']) {
    const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: opt }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
    const base = `${opt === 'flip' ? 'a-flip' : 'b-page'}-${dir === 'fwd' ? 'forward' : 'back'}`;
    for (const t of T4) {
      const name = `${n++}-${base}-${String(t).padStart(3, '0')}`;
      for (const th of ['dark', 'light']) if (want(name)) save(`${name}${th === 'light' ? '-light' : ''}`, await frame(th, scene, action, t));
    }
  }
}
const stripsP2 = [['36-a-flip-forward-strip', 'flip', 'fwd'], ['37-a-flip-back-strip', 'flip', 'back'], ['38-b-page-forward-strip', 'page', 'fwd'], ['39-b-page-back-strip', 'page', 'back']];
for (const [name, opt, dir] of stripsP2) {
  if (!want(name)) continue;
  const scene = { ...(dir === 'fwd' ? FWD : BACK), turn: opt }, action = { do: dir === 'fwd' ? 'next' : 'prev' };
  const frames = [];
  for (const t of [0, 90, 150, 300, 450, 600]) frames.push({ buf: await frame('dark', scene, action, t), label: `${t} ms` });
  await strip(name, 'dark', frames, { title: `${opt === 'flip' ? '(a) Scoreboard flip' : '(b) Page turn'} · ${dir === 'fwd' ? 'Next hole 4 → 5' : '◀ 5 → 4'} · pads land 240–584 ms` });
}

// each state, mid-turn (150 ms) with option (a), and the cases that change the layout
const MID = [
  ['40-turn-2v2-new-partner', { ...BASE, game: '2v2', cur: 6, view: 6, scores: all(6), seenSwitch: { '2v27': true } }, { do: 'next' }, '2v2, 6 → 7: new partner, so the match line blur-swaps'],
  ['41-turn-six-back-in', { ...BASE, game: 'six', cur: 6, view: 6, scores: all(6, ['A', 'S']), seenSwitch: { six7: true } }, { do: 'next' }, '6 players, 6 → 7: sitting out ends'],
  ['42-turn-scorecard', { ...BASE, game: 'solo', scores: all(4) }, { do: 'next' }, 'Scorecard only, 4 → 5'],
  ['43-turn-to-up-next', { ...BASE, scores: sc(4) }, { do: 'fwd' }, '▶ to “Up next”: the yardage card leaves, everything below moves up'],
  ['44-turn-grid-jump-back', { ...BASE, cur: 11, view: 11, scores: sc(11) }, { do: 'jump', to: 3 }, 'Grid jump 11 → 3: one turn, back, the number rolls straight to 3'],
  ['45-turn-no-yardage', { ...BASE, gps: 'off', scores: all(4) }, { do: 'next' }, 'No yardage card'],
  ['46-turn-compact', { ...BASE, gps: 'compact', scores: all(4) }, { do: 'next' }, 'Compact yardage card'],
];
for (const [name, scene, action, title] of MID) {
  if (!want(name)) continue;
  const frames = [];
  for (const t of [0, 90, 150, 300, 600]) frames.push({ buf: await frame('dark', scene, action, t), label: `${t} ms` });
  await strip(name, 'dark', frames, { title });
}

// yardage card close-ups: the frame stays, the green swaps, only changed digits roll. 9 → 10 changes every digit.
for (const [name, gps] of [['47-yardage-regular-strip', 'regular'], ['48-yardage-compact-strip', 'compact']]) {
  for (const th of ['dark', 'light']) {
    if (!want(name)) continue;
    const frames = [];
    for (const t of [0, 60, 120, 180, 240, 300, 420]) frames.push({ buf: await frame(th, { ...BASE, gps, cur: 9, view: 9, scores: all(9) }, { do: 'next' }, t, '.ce-head...green-card'), label: `${t} ms` });
    await strip(`${name}${th === 'light' ? '-light' : ''}`, th, frames, { col: true, title: `Yardage card, ${gps === 'regular' ? 'Regular 92px' : 'Compact 68px'} · hole 9 → 10` });
  }
}

// reduced motion: the turn is a 150ms cross-fade; a pick has no movement, only the word fades
for (const th of ['dark', 'light']) if (want('50')) save(`50-reduced-turn-075${th === 'light' ? '-light' : ''}`, await frame(th, { ...FWD, motion: 'reduced' }, { do: 'next' }, 75));
if (want('51')) {
  const frames = [];
  for (const t of [0, 80, 160, 400]) frames.push({ buf: await frame('dark', { ...PICK, motion: 'reduced' }, { do: 'pick', id: 'A', v: 6 }, t, '.ce-card .ce-row'), label: `${t} ms` });
  await strip('51-reduced-pick-double', 'dark', frames, { col: true, title: 'Reduced motion, double: no stamp, thud or shake; the mark is there, the word fades in' });
}
// Switch it up: the turn waits under the card and plays when it closes
if (want('52')) save('52-switch-it-up-then-turn', await frame('dark', { ...BASE, cur: 6, view: 6, scores: all(6) }, { do: 'next' }, 400));

await browser.close();
