// Renders 032's target screenshots from prototype.html: 393 × 659 at 2×, dark.
//   node docs/design/features/032-todays-game/shoot.mjs        (npm install first: Playwright + the Geist fonts)
// Each shot jumps to one slide with window.__032 and waits until just before that slide would move on,
// so the picture is the slide's resting end state. "motion-*" shots are taken part-way through on purpose.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const font = (p) => pathToFileURL(path.join(root, 'node_modules/geist/dist/fonts', p)).href;
const fonts = `@font-face{font-family:Geist;src:url(${font('geist-sans/Geist-Variable.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:"Geist Mono";src:url(${font('geist-mono/GeistMono-Variable.woff2')}) format('woff2');font-weight:100 900}`;
// [file, game, team score, slide, ms into the slide (null = its end state)]
const SHOTS = [
  ['01-2v2-who', 'oneMatch', 'bestBall', 0], ['02-2v2-hole-best-ball', 'oneMatch', 'bestBall', 1], ['03-2v2-first-to-9-and-a-half', 'oneMatch', 'bestBall', 2],
  ['04-2v2-hole-low-ball-and-total', 'oneMatch', 'bbAgg', 1], ['05-2v2-hole-aggregate', 'oneMatch', 'aggregate', 1], ['06-2v2-first-to-18-and-a-half', 'oneMatch', 'bbAgg', 2],
  ['07-partners-who', 'partners', 'bestBall', 0], ['08-partners-hole', 'partners', 'bestBall', 1], ['09-partners-switch', 'partners', 'bestBall', 2], ['10-partners-sets-won', 'partners', 'bestBall', 3],
  ['11-carts-who', 'cart', 'bestBall', 0], ['12-carts-hole-tie', 'cart', 'bestBall', 1], ['13-carts-new-cart', 'cart', 'bestBall', 2], ['14-carts-most-points', 'cart', 'bestBall', 3],
  ['15-three-carts-who', 'threeCarts', 'bestBall', 0], ['16-three-carts-hole', 'threeCarts', 'bestBall', 1], ['17-three-carts-most-points', 'threeCarts', 'bestBall', 2],
  ['18-alone-who', 'alone', 'bestBall', 0], ['19-alone-hole', 'alone', 'bestBall', 1], ['20-alone-race', 'alone', 'bestBall', 2],
  ['21-stroke-who', 'stroke', 'bestBall', 0], ['22-stroke-hole', 'stroke', 'bestBall', 1], ['23-stroke-board', 'stroke', 'bestBall', 2],
  ['24-ryder-sides', 'ryder', 'bestBall', 0], ['25-ryder-new-cart', 'ryder', 'bestBall', 1], ['26-ryder-hole', 'ryder', 'bestBall', 2], ['27-ryder-cup', 'ryder', 'bestBall', 3],
  ['28-motion-names-arrive', 'oneMatch', 'bestBall', 0, 700], ['29-motion-ball-in-flight', 'oneMatch', 'bestBall', 1, 1300],
  ['30-motion-bar-holds-at-halfway', 'oneMatch', 'bestBall', 2, 1500], ['31-motion-partners-swapping', 'partners', 'bestBall', 2, 1700],
];
const out = path.join(here, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
await Promise.all([0, 1, 2, 3].map(async (lane) => {
  const page = await browser.newPage({ viewport: { width: 393, height: 659 }, deviceScaleFactor: 2, colorScheme: 'dark' });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(pathToFileURL(path.join(here, 'prototype.html')).href);
  await page.addStyleTag({ content: fonts });
  for (const [file, game, ts, k, at] of SHOTS.filter((_, i) => i % 4 === lane)) {
    await page.evaluate(([g, t]) => window.__032.set(g, t), [game, ts]);
    await page.waitForTimeout(80);
    if (k) await page.evaluate((x) => window.__032.go(x), k);
    const hold = await page.evaluate((x) => window.__032.hold(x) * window.__032.pace, k);
    await page.waitForTimeout(at ?? hold - 260);
    await page.screenshot({ path: path.join(out, file + '.png') });
  }
  await page.close();
}));
await browser.close();
console.log(`${SHOTS.length} screenshots in ${path.relative(root, out)}`);
