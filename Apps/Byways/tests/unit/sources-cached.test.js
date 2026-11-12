import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { cachedJson, cachedText } from '../../src/core/sources/cached.js';

const DAY = 24 * 3600e3;
const PING = 'https://example.test/ping';

test('cachedJson keeps the parsed response for 24 hours by default', async () => {
  const { ctx, calls } = await adapterCtx(); const first = await cachedJson(ctx, 'wikipedia', PING);
  assert.deepEqual(await cachedJson(ctx, 'wikipedia', PING), first); assert.equal(calls.length, 1);
  ctx.clock.advance(DAY + 1); await cachedJson(ctx, 'wikipedia', PING); assert.equal(calls.length, 2);
});
test('cachedJson honours ttlMs and sends headers only when given', async () => {
  const { ctx, calls } = await adapterCtx(); const week = 7 * DAY;
  await cachedJson(ctx, 'wikipedia', PING); assert.equal(calls[0].headers['x-test'], undefined);
  ctx.clock.advance(DAY + 1);
  await cachedJson(ctx, 'wikipedia', PING, { ttlMs: week, headers: { 'X-Test': 'yes' } });
  assert.equal(calls[1].headers['x-test'], 'yes');
  ctx.clock.advance(6 * DAY); await cachedJson(ctx, 'wikipedia', PING, { ttlMs: week }); assert.equal(calls.length, 2);
  ctx.clock.advance(DAY); await cachedJson(ctx, 'wikipedia', PING, { ttlMs: week }); assert.equal(calls.length, 3);
});
test('the cache key leaves out api_key, so a key never reaches the store', async () => {
  const { ctx, calls, store } = await adapterCtx({ extraRoutes: [{ match: /example\.test\/ping\?/, json: { ok: true } }] });
  await cachedJson(ctx, 'wikipedia', PING + '?api_key=SECRET&x=1');
  await cachedJson(ctx, 'wikipedia', PING + '?x=1&api_key=OTHER'); assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(await store.getAll('cache')).includes('SECRET'));
});
test('cachedText caches the text of a response', async () => {
  const { ctx, calls } = await adapterCtx({ extraRoutes: [{ match: /text\.example/, body: 'hello' }] });
  assert.equal(await cachedText(ctx, 'wikipedia', 'https://text.example/a'), 'hello');
  assert.equal(await cachedText(ctx, 'wikipedia', 'https://text.example/a'), 'hello'); assert.equal(calls.length, 1);
});
