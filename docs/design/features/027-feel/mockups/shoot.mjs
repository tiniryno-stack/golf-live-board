// Renders mockup states to PNG (393 × 659 = the iPhone 15/16 usable area, at 2×), dark and light.
//   node docs/design/features/027-feel/mockups/shoot.mjs <folder> key1 key2 …
// e.g. node docs/design/features/027-feel/mockups/shoot.mjs 028-game-slots enter-ryder enter-rider
// Serves the repo root on a local port (ES modules don't load from file://). Writes
// <folder>/screenshots/NN-key.png (dark) and NN-key-light.png. Add "key@402" for 402 × 681.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const [folder, ...keys] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const out = path.join(root, 'docs/design/features', folder, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
let n = 0;
for (const raw of keys) {
  n++;
  const [key, w] = raw.split('@');
  const size = w === '402' ? { width: 402, height: 681 } : { width: 393, height: 659 };
  for (const light of [false, true]) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
    const hash = encodeURIComponent(JSON.stringify({ s: key, light }));
    await page.goto(`http://localhost:${port}/docs/design/features/${folder}/mockups/screens.html#${hash}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 5000 });
    // fit check: nothing may sit below the screen edge (Enter never scrolls)
    const over = await page.evaluate(() => document.querySelector('.scr').scrollHeight - innerHeight);
    if (over > 0) console.warn(`  ! ${key}: content runs ${over}px past the screen`);
    const name = `${String(n).padStart(2, '0')}-${key}${w ? '-' + w : ''}${light ? '-light' : ''}.png`;
    await page.screenshot({ path: path.join(out, name) });
    await page.close();
  }
  console.log(`${String(n).padStart(2, '0')} ${raw}`);
}
await browser.close();
server.close();
