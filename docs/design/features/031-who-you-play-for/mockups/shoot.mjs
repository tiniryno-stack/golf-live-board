// Renders the 031 mockups (the Claude Design canvas's .dc.html files, kept in mockups/) to PNG:
// 393 × 659 at 2×, dark and light.   node docs/design/features/031-who-you-play-for/mockups/shoot.mjs <folder> [@1]
// Reads each mockups/*.dc.html, takes the markup inside <x-dc>, and draws it with kit.css and the
// repo's Geist fonts. Writes <folder>/screenshots/NN-name.png and NN-name-light.png in ORDER.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const [folder, flag] = process.argv.slice(2);
const dir = path.join(root, 'docs/design/features', folder);
const order = JSON.parse(fs.readFileSync(path.join(dir, 'mockups/order.json'), 'utf8'));
const font = (p) => pathToFileURL(path.join(root, 'node_modules/geist/dist/fonts', p)).href;
const css = `@font-face{font-family:Geist;src:url(${font('geist-sans/Geist-Variable.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:"Geist Mono";src:url(${font('geist-mono/GeistMono-Variable.woff2')}) format('woff2');font-weight:100 900}
body{margin:0}` + fs.readFileSync(path.join(here, 'kit.css'), 'utf8');
const out = path.join(dir, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
let n = 0;
for (const [file, name] of order) {
  n++;
  const src = fs.readFileSync(path.join(dir, 'mockups', file), 'utf8');
  const body = src.split('</helmet>')[1].split('</x-dc>')[0];
  for (const theme of flag === 'light' || process.argv.includes('light') ? ['dark', 'light'] : ['dark']) {
    const page = await browser.newPage({ viewport: { width: 393, height: 659 }, deviceScaleFactor: flag === '@1' ? 1 : 2 });
    const tmp = path.join(out, '.tmp.html');
    fs.writeFileSync(tmp, `<!doctype html><meta charset="utf-8"><style>${css}</style>${body.replaceAll('{{theme}}', theme)}`);
    await page.goto(pathToFileURL(tmp).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(out, `${String(n).padStart(2, '0')}-${name}${theme === 'light' ? '-light' : ''}.png`) });
    await page.close();
    fs.unlinkSync(tmp);
  }
  console.log(String(n).padStart(2, '0'), name);
}
await browser.close();
