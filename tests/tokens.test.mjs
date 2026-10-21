// The design system is the source of every token: css/tokens.css must carry the variable blocks of
// docs/design/design-system/tokens.css exactly (regenerate with `npm run tokens` after a design update),
// and the 6 type styles under our .ts- prefix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const blocks = (css) => [
  css.match(/:root\{[\s\S]*?\n\}/)?.[0],
  css.match(/html\.light, \[data-theme="light"\]\{[\s\S]*?\n\}/)?.[0],
];

test('css/tokens.css matches the design system’s tokens.css (dark + light)', () => {
  const [srcRoot, srcLight] = blocks(read('docs/design/design-system/tokens.css'));
  const [appRoot, appLight] = blocks(read('css/tokens.css'));
  assert.ok(srcRoot && srcLight, 'the design system file has both blocks');
  assert.equal(appRoot, srcRoot, 'dark / default tokens drifted: run npm run tokens');
  assert.equal(appLight, srcLight, 'light tokens drifted: run npm run tokens');
});

test('the 6 type styles, and only those, as .ts-*', () => {
  const css = read('css/tokens.css');
  const names = [...css.matchAll(/^\.ts-([a-z-]+)\{/gm)].map((m) => m[1]);
  assert.deepEqual(names, ['number-xl', 'title', 'row', 'body', 'small', 'label']);
  assert.ok(!/\.ts-/.test(read('css/styles.css').replace(/\/\*[\s\S]*?\*\//g, '').match(/^\.ts-[a-z-]+\s*\{/m)?.[0] || ''), 'styles.css defines no text styles of its own');
  assert.ok(read('index.html').indexOf('css/tokens.css') < read('index.html').indexOf('css/styles.css'), 'tokens load before styles');
});
