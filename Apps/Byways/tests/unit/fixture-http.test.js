import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx, memorySecrets } from './helpers/fixture-http.js';
import { SOURCES } from '../../src/core/sources/index.js';
import { flush } from './helpers/async.js';

const settled = promise => {
  const state = { done: false };
  promise.then(() => { state.done = true; }, () => { state.done = true; });
  return state;
};

test('error: true rejects with TypeError Failed to fetch', async () => {
  const extraRoutes = [{ match: /boom\.example\//, error: true }];
  const { transport } = await adapterCtx({ extraRoutes });
  await assert.rejects(transport.fetch('https://boom.example/'), err => err instanceof TypeError && err.message === 'Failed to fetch');
});

test('hang: true stays pending until the signal aborts, then rejects with an AbortError', async () => {
  const extraRoutes = [{ match: /hang\.example\//, hang: true }];
  const { transport } = await adapterCtx({ extraRoutes });
  const ac = new AbortController();
  const pending = transport.fetch('https://hang.example/', { signal: ac.signal });
  const state = settled(pending);
  await flush();
  assert.equal(state.done, false);
  ac.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('hang: true with a signal that is already aborted rejects at once', async () => {
  const extraRoutes = [{ match: /hang\.example\//, hang: true }];
  const { transport } = await adapterCtx({ extraRoutes });
  await assert.rejects(transport.fetch('https://hang.example/', { signal: AbortSignal.abort() }), { name: 'AbortError' });
});

test('hang: true through ctx.http ends in a timeout NetError once the clock passes timeoutMs', async () => {
  const extraRoutes = [{ match: /hang\.example\//, hang: true }];
  const { ctx } = await adapterCtx({ extraRoutes });
  const pending = ctx.http.request('https://hang.example/', { timeoutMs: 5000 });
  const state = settled(pending);
  await flush();
  ctx.clock.advance(4999); await flush();
  assert.equal(state.done, false);
  ctx.clock.advance(1);
  await assert.rejects(pending, { name: 'NetError', kind: 'timeout' });
});

test('json and body entries get application/json and text/plain, and route headers override them', async () => {
  const extraRoutes = [
    { match: /json\.example\//, json: { a: 1 } },
    { match: /body\.example\//, body: 'hello' },
    { match: /over\.example\//, json: { a: 1 }, headers: { 'Content-Type': 'application/vnd.test+json' } },
  ];
  const { transport } = await adapterCtx({ extraRoutes });
  const json = await transport.fetch('https://json.example/');
  assert.equal(json.headers.get('content-type'), 'application/json');
  assert.deepEqual(await json.json(), { a: 1 });
  const body = await transport.fetch('https://body.example/');
  assert.equal(body.headers.get('content-type'), 'text/plain');
  assert.equal(await body.text(), 'hello');
  const over = await transport.fetch('https://over.example/');
  assert.equal(over.headers.get('content-type'), 'application/vnd.test+json');
});

test('a route pushed onto extraRoutes after adapterCtx resolves is matched', async () => {
  const extraRoutes = [];
  const { transport } = await adapterCtx({ extraRoutes });
  await assert.rejects(transport.fetch('https://late.example/'), TypeError);
  extraRoutes.push({ match: /late\.example\//, status: 201, body: 'late' });
  const res = await transport.fetch('https://late.example/');
  assert.equal(res.status, 201);
  assert.equal(await res.text(), 'late');
});

test('calls records url, method, lower-cased headers and body', async () => {
  const extraRoutes = [{ match: /rec\.example\//, body: 'ok' }];
  const { ctx, calls } = await adapterCtx({ extraRoutes });
  await ctx.http.request('https://rec.example/a', { headers: { 'Api-User-Agent': 'B', 'X-Mixed-Case': '1' } });
  await ctx.http.request('https://rec.example/b', { method: 'POST', body: 'payload' });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { url: 'https://rec.example/a', method: 'GET', headers: { 'api-user-agent': 'B', 'x-mixed-case': '1' }, body: undefined });
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].body, 'payload');
});

test('an unmatched URL throws TypeError unmatched <url> and is still recorded', async () => {
  const { transport, calls } = await adapterCtx();
  await assert.rejects(transport.fetch('https://nothing.invalid/x'), err => err instanceof TypeError && err.message === 'unmatched https://nothing.invalid/x');
  assert.deepEqual(calls.map(c => c.url), ['https://nothing.invalid/x']);
});

test('memorySecrets gives null for a missing id and round-trips set, get, delete and list', async () => {
  const secrets = memorySecrets({ 'src:a': 'one' });
  assert.equal(await secrets.get('src:missing'), null);
  assert.equal(await secrets.get('src:a'), 'one');
  await secrets.set('src:b', 'two');
  assert.equal(await secrets.get('src:b'), 'two');
  assert.deepEqual((await secrets.list()).sort(), ['src:a', 'src:b']);
  await secrets.delete('src:a');
  assert.equal(await secrets.get('src:a'), null);
  assert.deepEqual(await secrets.list(), ['src:b']);
  assert.equal(await memorySecrets().get('x'), null);
});

test('ctx has every contract field', async () => {
  const { ctx } = await adapterCtx({ secrets: { 'src:k': 'v' }, seed: 7, now: Date.UTC(2026, 0, 2) });
  for (const field of ['http', 'rand', 'clock', 'cache', 'settings', 'secrets', 'data', 'platformName', 'caps', 'dataUrl']) {
    assert.ok(field in ctx, `ctx.${field}`);
  }
  assert.equal(typeof ctx.http.request, 'function');
  assert.equal(typeof ctx.rand(), 'number');
  assert.equal(ctx.clock.now(), Date.UTC(2026, 0, 2));
  assert.equal(typeof ctx.cache.get, 'function');
  assert.equal(typeof ctx.settings, 'object');
  assert.equal(await ctx.secrets.get('src:k'), 'v');
  assert.ok(Array.isArray(ctx.data.tags) || typeof ctx.data.tags === 'object');
  assert.equal(ctx.platformName, 'pwa');
  assert.equal(ctx.caps.privilegedFetch, false);
  assert.equal(ctx.dataUrl('tags.json'), 'data/tags.json');
});

test('the same seed gives the same rand sequence, and now defaults to 2026-11-11 12:00 UTC', async () => {
  const a = (await adapterCtx({ seed: 3 })).ctx, b = (await adapterCtx({ seed: 3 })).ctx;
  assert.equal(a.rand(), b.rand());
  assert.equal(a.clock.now(), Date.UTC(2026, 10, 11, 12));
});

test('every SOURCES adapter is registered with http except the SELF_PACED ids', async () => {
  const rate = { perMinute: 1, concurrent: 1 };
  const added = { zz: { id: 'zz', rate }, ia: { id: 'ia', rate }, vault: { id: 'vault', rate } };
  Object.assign(SOURCES, added);
  try {
    const extraRoutes = [{ match: /paced\.example\//, body: 'ok' }];
    const { ctx, calls } = await adapterCtx({ extraRoutes });
    for (const source of ['zz', 'ia', 'vault']) {
      ctx.http.request('https://paced.example/' + source, { source });
      ctx.http.request('https://paced.example/' + source, { source });
    }
    await flush();
    const sent = source => calls.filter(c => c.url.endsWith('/' + source)).length;
    assert.equal(sent('zz'), 1);
    assert.equal(sent('ia'), 2);
    assert.equal(sent('vault'), 2);
  } finally {
    for (const id of Object.keys(added)) delete SOURCES[id];
  }
});
