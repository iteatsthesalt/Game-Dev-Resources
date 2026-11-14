import test from 'node:test'; import assert from 'node:assert/strict';
import { DATA_FILES, EMPTY_DATA, dataUrlFor, loadAppData } from '../../src/core/data.js';
import { openStore, memoryBackend } from '../../src/core/store/db.js';

test('loadAppData reads the four files, falls back to empty shapes and registers pages', async () => {
  const base = 'http://localhost:4321/Game-Dev-Resources/byways/'; const urls = [], registered = [];
  const fetchFn = async url => {
    urls.push(url);
    if (url.endsWith('/data/tags.json')) return Response.json({ v: 1, groups: [{ id: 'g', label: 'G', tags: [] }] });
    if (url.endsWith('/data/library.json')) return new Response('nope', { status: 404 });
    if (url.endsWith('/data/vault-starter.json')) throw new TypeError('offline');
    return new Response('{not json');
  };
  const http = { register: (id, opts) => registered.push([id, opts]) };
  const data = await loadAppData({ fetchFn, base, dataUrl: f => dataUrlFor('pwa', f), http, store: await openStore(memoryBackend()) });
  assert.equal(data.tags.groups[0].id, 'g');
  assert.deepEqual([data.library, data.vaultStarter, data.geocities], [EMPTY_DATA.library, EMPTY_DATA.vaultStarter, EMPTY_DATA.geocities]);
  assert.notEqual(data.library, EMPTY_DATA.library);
  assert.deepEqual(urls.sort(), Object.values(DATA_FILES).map(f => base + 'data/' + f).sort());
  assert.deepEqual(registered, [['pages', { perMinute: 30, concurrent: 2 }]]);
});
test('DATA_FILES and EMPTY_DATA hold the four src/data files', () => {
  assert.deepEqual(DATA_FILES, { tags: 'tags.json', library: 'library.json', vaultStarter: 'vault-starter.json', geocities: 'geocities-seeds.json' });
  assert.deepEqual([EMPTY_DATA.tags, EMPTY_DATA.library, EMPTY_DATA.vaultStarter, EMPTY_DATA.geocities],
    [{ v: 1, groups: [] }, { v: 1, entries: [] }, { v: 1, entries: [] }, { v: 1, urls: [] }]);
});
test('dataUrlFor is relative in the PWA and the Pages URL elsewhere', () => {
  assert.equal(dataUrlFor('pwa', 'daily.json'), 'data/daily.json');
  for (const p of ['extension', 'android'])
    assert.equal(dataUrlFor(p, 'itch.json'), 'https://iteatsthesalt.github.io/Game-Dev-Resources/byways/data/itch.json');
});
test('boot.js re-exports the data loader', async () => {
  const boot = await import('../../src/ui/boot.js');
  for (const [name, value] of Object.entries({ DATA_FILES, EMPTY_DATA, dataUrlFor, loadAppData })) assert.equal(boot[name], value, name);
});
