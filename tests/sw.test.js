// Guards offline support: every app file must be in the service worker's precache list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { APP_VERSION } from '../js/version.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const precache = [...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

test('service worker version matches the app version', () => {
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], APP_VERSION);
});

test('every precached file exists', () => {
  for (const f of precache.filter((p) => p !== './')) assert.ok(existsSync(join(root, f)), `missing: ${f}`);
});

test('every app file is precached (so the app works offline)', () => {
  const needed = ['index.html', 'manifest.webmanifest', ...walk('css'), ...walk('js'), ...walk('icons')];
  for (const f of needed) assert.ok(precache.includes(f), `not precached: ${f}`);
  assert.ok(precache.includes('./'));
});

test('no file loads anything from another site', () => {
  const files = ['index.html', 'sw.js', ...walk('css'), ...walk('js')];
  for (const f of files) {
    const text = readFileSync(join(root, f), 'utf8');
    assert.equal(/(src|href)=["']https?:|import\s[^;]*["']https?:|url\(["']?https?:/.test(text), false, `external reference in ${f}`);
  }
});

test('manifest is installable: name, standalone, relative scope, 192 and 512 icons', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Rebuild');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(existsSync(join(root, i.src)), `missing icon ${i.src}`);
});
