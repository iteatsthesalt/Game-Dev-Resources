import test from 'node:test';
import assert from 'node:assert/strict';
import { createPwaPlatform, registerServiceWorker } from '../../src/platform/pwa.js';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { fakeDocument } from './helpers/fake-dom.js';

const makeWin = (navigator = {}) => {
  const opened = [], assigned = [], fetched = []; const { document, created } = fakeDocument();
  const win = { navigator, document, location: { assign: u => assigned.push(u) }, open: (...a) => { opened.push(a); },
    fetch: async (url, init) => { fetched.push({ url, init }); return new Response('ok'); },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, setTimeout: fn => fn() };
  return { win, opened, assigned, fetched, created };
};
const platform = async nav => createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win: makeWin(nav).win });
test('name, caps, requestOrigins and secrets in the keys store', async () => {
  const store = await openStore(memoryBackend()); const p = createPwaPlatform({ secretsStore: store, win: makeWin().win });
  assert.equal(p.name, 'pwa'); assert.equal(p.attach, undefined);
  assert.deepEqual(p.caps, { privilegedFetch: false, localNetworkHttp: false, inAppSiteView: false, labHref: 'lab/', framesArchive: true });
  assert.equal(await p.requestOrigins(['http://192.168.1.5:11434']), true);
  await p.secrets.set('ai:anthropic', 'k1'); assert.equal(await store.get('keys', 'ai:anthropic'), 'k1');
  assert.deepEqual(await p.secrets.list(), ['ai:anthropic']); await p.secrets.delete('ai:anthropic');
  assert.equal(await p.secrets.get('ai:anthropic'), null);
});
test('transport drops privileged and omits credentials', async () => {
  const { win, fetched } = makeWin(); const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  await p.transport.fetch('https://a.test/', { privileged: true, headers: { a: 'b' } });
  assert.equal('privileged' in fetched[0].init, false); assert.equal(fetched[0].init.credentials, 'omit'); assert.deepEqual(fetched[0].init.headers, { a: 'b' });
});
test('share uses navigator.share, then the clipboard', async () => {
  const copied = []; const clipboard = { writeText: async t => { copied.push(t); } }; const data = { title: 'T', url: 'https://x.org/' };
  assert.equal(await (await platform({ share: async () => {} })).share(data), 'shared');
  assert.equal(await (await platform({ share: async () => { throw new DOMException('no', 'AbortError'); } })).share(data), 'cancelled');
  assert.equal(await (await platform({ share: async () => { throw new DOMException('no', 'NotAllowedError'); }, clipboard })).share(data), 'copied');
  assert.equal(await (await platform({ clipboard })).share(data), 'copied'); assert.deepEqual(copied, ['https://x.org/', 'https://x.org/']);
  assert.equal(await (await platform({ clipboard: { writeText: async () => { throw new Error('denied'); } } })).share(data), 'cancelled');
});
test('openFind opens only http(s) links, in a new tab with noopener', async () => {
  const { win, opened, assigned } = makeWin(); const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  await p.openFind({ url: 'https://x.org/' }); assert.deepEqual(opened, [['https://x.org/', '_blank', 'noopener']]);
  await p.openFind({ url: 'https://y.org/' }, 'current'); assert.deepEqual(assigned, ['https://y.org/']);
  await assert.rejects(p.openFind({ url: 'javascript:alert(1)' }), /not an http\(s\) link/); assert.equal(opened.length, 1);
});
test('files.save clicks a download link; files.pick returns chosen files', async () => {
  const { win, created } = makeWin(); const p = createPwaPlatform({ secretsStore: await openStore(memoryBackend()), win });
  await p.files.save('byways.json', new Blob(['{}']));
  const a = created.find(e => e.tagName === 'A');
  assert.deepEqual([a.download, a.href, a.clicked, a.removed], ['byways.json', 'blob:x', true, true]);
  const picking = p.files.pick('.json'); const input = created.find(e => e.tagName === 'INPUT');
  input.files = ['f']; input.dispatchEvent({ type: 'change' });
  assert.deepEqual(await picking, ['f']); assert.deepEqual([input.type, input.accept, input.multiple], ['file', '.json', false]);
});
test('persistStorage reports the grant and never throws', async () => {
  assert.equal(await (await platform({ storage: { persist: async () => true } })).persistStorage(), true);
  assert.equal(await (await platform({})).persistStorage(), false);
  assert.equal(await (await platform({ storage: { persist: async () => { throw new Error('x'); } } })).persistStorage(), false);
});
test('registerServiceWorker skips the Android shell', async () => {
  let calls = 0; const { win } = makeWin({ serviceWorker: { register: async () => { calls++; return {}; } } }); win.BywaysNative = {};
  assert.equal(await registerServiceWorker(win, () => {}), null); assert.equal(calls, 0);
});
test('registerServiceWorker returns null when register rejects or resolves to nothing', async () => {
  for (const register of [async () => { throw new Error('no'); }, async () => undefined])
    assert.equal(await registerServiceWorker(makeWin({ serviceWorker: { register } }).win, () => {}), null);
  assert.equal(await registerServiceWorker(makeWin({}).win, () => {}), null);
});
test('registerServiceWorker reports a waiting worker and a newly installed one', async () => {
  const updates = []; let args; const reg = { waiting: {}, addEventListener(t, f) { this[t] = f; } };
  const { win } = makeWin({ serviceWorker: { controller: {}, register: async (...a) => { args = a; return reg; } } });
  assert.equal(await registerServiceWorker(win, r => updates.push(r)), reg);
  assert.deepEqual(args, ['./sw.js']); assert.deepEqual(updates, [reg]);
  reg.installing = { state: 'installing', addEventListener(t, f) { this[t] = f; } };
  reg.updatefound(); reg.installing.state = 'installed'; reg.installing.statechange(); assert.deepEqual(updates, [reg, reg]);
});
