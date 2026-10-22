// Writes version.json: a fresh version id plus every app file, so index.html's loader can fetch the
// exact current files instead of the copies a phone has cached (iPhone home screen apps hold old
// JS/CSS for minutes). Run before every push to main: npm run stamp  (the preview script runs it too).
// Usage: node tools/stamp.mjs [dir]   (dir = folder holding index.html, default: repo root)
import { readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dir = process.argv[2] || new URL('..', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = [...walk(join(dir, 'js')), ...walk(join(dir, 'css'))]
  .filter((f) => /\.(js|css)$/.test(f))
  .map((f) => relative(dir, f).split('\\').join('/'))
  .sort();
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
writeFileSync(join(dir, 'version.json'), `${JSON.stringify({ v, files }, null, 1)}\n`);
console.log(`version ${v} · ${files.length} files`);
