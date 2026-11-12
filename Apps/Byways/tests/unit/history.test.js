import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { createHistory } from '../../src/core/history.js';
import { makeFind } from '../../src/core/model/find.js';
import { fakeClock } from '../../src/core/util/clock.js';
const f = (t, url) => makeFind({ source: 'library', kind: 'site', title: t, url, safety: 'curated' });

test('history keeps max finds and walks back and forward', async () => {
  const store = await openStore(memoryBackend()); const h = createHistory(store, { max: 3 }); await h.ready;
  for (const t of ['a','b','c','d']) h.push(f(t, `https://${t}.example.com/`));
  assert.deepEqual(h.list().map(x => x.title), ['b','c','d']);
  assert.equal(h.back().title, 'c'); assert.equal(h.back().title, 'b'); assert.equal(h.back(), null);
  assert.equal(h.forward().title, 'c');
  h.push(f('e', 'https://e.example.com/'));
  assert.deepEqual(h.list().map(x => x.title), ['b','c','e']);
  assert.deepEqual(h.recentDomains(2), ['e.example.com', 'c.example.com']);
});
test('history survives a restart', async () => {
  const store = await openStore(memoryBackend()); const h = createHistory(store); await h.ready;
  h.push(f('a', 'https://a.example.com/')); await new Promise(r => setTimeout(r, 0));
  const h2 = createHistory(store); await h2.ready; assert.equal(h2.current().title, 'a');
  await store.put('history', 'trail', { items: [{ find: f('z', 'https://z.example.com/'), t: 1 }] });
  await h2.reload(); assert.equal(h2.current().title, 'z');
});
test('two histories on one store merge instead of overwriting', async () => {
  const store = await openStore(memoryBackend()); const clock = fakeClock(1000); const tick = () => new Promise((r) => setTimeout(r, 0));
  const h1 = createHistory(store, { clock }); const h2 = createHistory(store, { clock }); await h1.ready; await h2.ready;
  h1.push(f('a', 'https://a.example.com/')); await tick(); clock.advance(1);
  h2.push(f('b', 'https://b.example.com/')); await tick();
  const h3 = createHistory(store, { clock }); await h3.ready; assert.deepEqual(h3.list().map((x) => x.title), ['a', 'b']);
});
