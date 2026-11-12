import test from 'node:test'; import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { build, OUTPUTS, findStale } from '../../tools/build.js';
import { runChecks } from '../../tools/check.js';

test('pwa target copies src and the shell and stamps the build', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); const dir = join(out, 'dist/pwa');
  await build({ target: 'pwa', outRoot: out, id: 'abc123', now: new Date('2026-11-11T00:00:00Z') });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'build.json', 'core/util/hash.js', 'core/version.js', 'ui/boot.js', 'platform/pwa.js', 'data/tags.json', 'ui/styles/app.css'])
    assert.ok(existsSync(join(dir, f)), f);
  const icons = JSON.parse(readFileSync(join(dir, 'manifest.webmanifest'), 'utf8')).icons;
  assert.deepEqual(icons.map(i => [i.src, i.sizes, i.purpose]), [['assets/icons/icon.svg', 'any', 'any'], ['assets/icons/icon-192.png', '192x192', 'any'],
    ['assets/icons/icon-512.png', '512x512', 'any'], ['assets/icons/maskable-512.png', '512x512', 'maskable']]);
  for (const i of icons) assert.ok(existsSync(join(dir, i.src)), i.src);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'build.json'), 'utf8')), { id: 'abc123', builtAt: '2026-11-11T00:00:00.000Z' });
  const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
  assert.match(sw, /const BUILD_ID = "abc123";/);
  const list = JSON.parse(sw.match(/const PRECACHE = (\[[^\]]*\]);/)[1]);
  for (const f of ['./', './index.html', './manifest.webmanifest', './ui/boot.js', './data/tags.json']) assert.ok(list.includes(f), f);
  for (const f of ['./sw.js', './build.json']) assert.ok(!list.includes(f), f);
  assert.equal(existsSync(join(dir, 'landing')), false);
});
test('extension and android targets write only build.json until Plans 07 and 08', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); await build({ target: 'all', outRoot: out, id: 'dev' });
  for (const d of [...OUTPUTS.extension, ...OUTPUTS.android]) assert.deepEqual(readdirSync(join(out, d)), ['build.json'], d);
});
test('a rebuild removes files that left src', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); const dir = join(out, 'dist/pwa');
  await build({ target: 'pwa', outRoot: out, id: 'dev' }); writeFileSync(join(dir, 'stale.txt'), 'x');
  await build({ target: 'pwa', outRoot: out, id: 'dev' }); assert.equal(existsSync(join(dir, 'stale.txt')), false);
});
test('findStale reports changed, added and removed files and ignores build ids and missing outputs', async () => {
  const a = await mkdtemp(join(tmpdir(), 'bw-')); const b = await mkdtemp(join(tmpdir(), 'bw-'));
  await build({ target: 'pwa', outRoot: a, id: 'one' }); await build({ target: 'pwa', outRoot: b, id: 'two' });
  assert.deepEqual(findStale(a, b, ['dist/pwa', 'dist/chrome']), []);
  writeFileSync(join(b, 'dist/pwa/index.html'), 'changed'); writeFileSync(join(b, 'dist/pwa/extra.txt'), 'x'); rmSync(join(b, 'dist/pwa/ui/boot.js'));
  assert.deepEqual(findStale(a, b, ['dist/pwa', 'dist/chrome']), ['dist/pwa/extra.txt', 'dist/pwa/index.html', 'dist/pwa/ui/boot.js'].map(f => `${f}: stale; run npm run build`));
  assert.deepEqual(findStale(a, join(b, 'none'), ['dist/pwa']), []);
});
test('the real tree passes every check', async () => {
  const out = await mkdtemp(join(tmpdir(), 'bw-')); await build({ target: 'all', outRoot: out, id: 'dev' });
  const outputs = Object.values(OUTPUTS).flat().map(d => join(out, d));
  assert.deepEqual(await runChecks({ srcDir: 'src', outputs, extraHtml: ['shells/pwa/landing/index.html'] }), []);
});
test('the committed PNG icons have the sizes the manifest gives', () => {
  for (const [f, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512]]) {
    const png = readFileSync(new URL(`../../src/assets/icons/${f}`, import.meta.url));
    assert.equal(png.toString('latin1', 1, 4), 'PNG', f);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], f);
  }
});
