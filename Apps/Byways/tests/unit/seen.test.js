import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { createSeen } from '../../src/core/seen.js';
import { hash64 } from '../../src/core/util/hash.js';

test('seen treats url variants as one find', async () => {
  const store = await openStore(memoryBackend()); const seen = createSeen(store);
  await seen.add('https://www.example.com/a/?utm_source=x#top');
  assert.equal(await seen.has('https://example.com/a'), true);
  assert.equal(await seen.has('https://example.com/b'), false);
  assert.equal(typeof (await store.get('seen', hash64('https://example.com/a'))).t, 'number');
  assert.equal(await seen.count(), 1);
});
test('seen ignores non-http urls and resets', async () => {
  const seen = createSeen(await openStore(memoryBackend()));
  await seen.add('javascript:x'); assert.equal(await seen.count(), 0);
  assert.equal(await seen.has('not a url'), false);
  await seen.add('https://example.org/'); await seen.reset(); assert.equal(await seen.count(), 0);
});
