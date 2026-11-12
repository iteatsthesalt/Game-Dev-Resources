import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from '../../src/core/util/clock.js';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { createCache } from '../../src/core/store/cache.js';

test('cache returns a value until its ttl passes, then deletes it', async () => {
  const c = fakeClock(0); const store = await openStore(memoryBackend()); const cache = createCache(store, c);
  await cache.set('k', { x: 1 }, 1000);
  c.advance(999); assert.deepEqual(await cache.get('k'), { x: 1 });
  c.advance(1); assert.equal(await cache.get('k'), undefined); assert.equal(await store.get('cache', 'k'), undefined);
});
test('purgeExpired removes only expired entries', async () => {
  const c = fakeClock(0); const store = await openStore(memoryBackend()); const cache = createCache(store, c);
  await cache.set('a', 1, 10); await cache.set('b', 2, 100); c.advance(50);
  assert.equal(await cache.purgeExpired(), 1); assert.deepEqual(await store.keys('cache'), ['b']);
});
