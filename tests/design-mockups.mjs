// Renders every Claude Design mockup (docs/design/screens/*.html) at 393×852 with the real Geist
// fonts, so the app can be compared side by side. Output: tests/screenshots/design/mock-*.png
import { readdirSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './mock-supabase.mjs';

const OUT = new URL('./screenshots/design/', import.meta.url).pathname;
// MOCK_THEME=light renders each mockup with ?mode=light → mock-<name>-light.png.
const LIGHT = process.env.MOCK_THEME === 'light';
mkdirSync(OUT, { recursive: true });
const srv = await serve();
const fontCss = `
@font-face { font-family: "Geist"; src: url("${srv.origin}/__fonts/Geist-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }
@font-face { font-family: "Geist Mono"; src: url("${srv.origin}/__fonts/GeistMono-Variable.woff2") format("woff2"); font-weight: 100 900; font-display: block; }`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: fontCss }));
await ctx.route('**/support.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(new URL('./design/dc-runtime.js', import.meta.url)) }));
const only = process.argv[2];
for (const f of readdirSync(new URL('../docs/design/screens/', import.meta.url))) {
  if (!f.endsWith('.html') || (only && !f.includes(only))) continue;
  const page = await ctx.newPage();
  await page.goto(`${srv.origin}/docs/design/screens/${f}${LIGHT ? '?mode=light' : ''}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}mock-${f.replace('.html', '')}${LIGHT ? '-light' : ''}.png`, clip: { x: 0, y: 0, width: 393, height: 852 } });
  await page.close();
}
await browser.close();
srv.close?.();
process.exit(0);
