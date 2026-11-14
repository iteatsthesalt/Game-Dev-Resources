import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from '../../src/core/util/clock.js';
import { createHttp } from '../../src/core/net/http.js';
import { flush } from './helpers/async.js';

let calls, next, clock, http;
const transport = { fetch: (url, init) => { calls.push({ url, init }); return next.shift()(init); } };
const hang = init => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))));
test.beforeEach(() => { calls = []; next = []; clock = fakeClock(Date.UTC(2026, 10, 11)); http = createHttp({ transport, clock }); });

test('getJson parses and passes method, headers and privileged', async () => {
  next = [() => Promise.resolve(Response.json({ ok: 1 }))];
  assert.deepEqual(await http.getJson('https://a.test/x', { headers: { 'Api-User-Agent': 'B' }, privileged: true, source: 's' }), { ok: 1 });
  const { init } = calls[0];
  assert.equal(init.method, 'GET'); assert.equal(init.headers['Api-User-Agent'], 'B');
  assert.equal(init.privileged, true); assert.notEqual(init.credentials, 'include'); assert.ok(init.signal instanceof AbortSignal);
});
test('a status of 400 or more throws NetError http', async () => {
  next = [() => Promise.resolve(new Response('no', { status: 404 }))];
  await assert.rejects(http.getText('https://a.test/', { source: 's' }), { name: 'NetError', kind: 'http', status: 404, source: 's' });
});
test('a fetch TypeError becomes kind network', async () => {
  next = [() => { throw new TypeError('Failed to fetch'); }];
  await assert.rejects(http.request('https://a.test/'), { kind: 'network' });
});
test('timeoutMs aborts with kind timeout', async () => {
  next = [hang]; const p = http.request('https://a.test/'); await flush(); clock.advance(8000);
  await assert.rejects(p, { kind: 'timeout' });
});
test('a caller abort gives kind aborted', async () => {
  next = [hang]; const ac = new AbortController(); const p = http.request('https://a.test/', { signal: ac.signal });
  await flush(); ac.abort(); await assert.rejects(p, { kind: 'aborted' });
});
test('an option given as undefined keeps its default', async () => {
  next = [hang]; const p = http.request('https://a.test/', { timeoutMs: undefined, method: undefined }); await flush();
  assert.equal(calls[0].init.method, 'GET');
  let settled = false; p.catch(() => {}).finally(() => { settled = true; });
  clock.advance(7999); await flush(); assert.equal(settled, false);
  clock.advance(1); await assert.rejects(p, { kind: 'timeout' });
});
// Headers arrive, then the body never ends; the stream errors when the request's signal aborts, as fetch's does.
const stalledBody = init => Promise.resolve(new Response(new ReadableStream({
  start(c) { init.signal.addEventListener('abort', () => c.error(new DOMException('x', 'AbortError'))); },
})));
test('a body that stalls after the headers still times out', async () => {
  for (const read of ['getJson', 'getText']) {
    next = [stalledBody]; const p = http[read]('https://a.test/', { source: 's' }); await flush(); clock.advance(8000);
    await assert.rejects(p, { kind: 'timeout', source: 's' }, read);
  }
});
test('a caller abort during the body read gives kind aborted', async () => {
  for (const read of ['getJson', 'getText']) {
    next = [stalledBody]; const ac = new AbortController(); const p = http[read]('https://a.test/', { signal: ac.signal });
    await flush(); ac.abort(); await assert.rejects(p, { kind: 'aborted' }, read);
  }
});
test('request leaves the caller signal linked to the body stream', async () => {
  next = [stalledBody]; const ac = new AbortController(); const res = await http.request('https://a.test/', { signal: ac.signal });
  const read = res.text(); ac.abort(); await assert.rejects(read, { name: 'AbortError' });
});
test('429 with Retry-After of 10 s or less retries once', async () => {
  next = [() => Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '2' } })), () => Promise.resolve(new Response('ok'))];
  const p = http.getText('https://a.test/'); await flush(); assert.equal(calls.length, 1);
  clock.advance(2000); assert.equal(await p, 'ok'); assert.equal(calls.length, 2);
});
test('a second 429 in a row is not retried', async () => {
  next = [1, 2].map(() => () => Promise.resolve(new Response('', { status: 429, headers: { 'Retry-After': '1' } })));
  const p = http.getText('https://a.test/'); await flush(); clock.advance(1000);
  await assert.rejects(p, { kind: 'http', status: 429 }); assert.equal(calls.length, 2);
});
test('503 with Retry-After 30 pauses the source and throws', async () => {
  http.register('s', { perMinute: 60, concurrent: 1 });
  next = [() => Promise.resolve(new Response('', { status: 503, headers: { 'Retry-After': '30' } })), () => Promise.resolve(new Response('ok'))];
  await assert.rejects(http.getText('https://a.test/', { source: 's' }), { status: 503, retryAfterMs: 30000 });
  const p = http.getText('https://a.test/', { source: 's' }); await flush(); assert.equal(calls.length, 1);
  clock.advance(30000); assert.equal(await p, 'ok');
});
test('bad JSON gives kind parse', async () => {
  next = [() => Promise.resolve(new Response('not json'))];
  await assert.rejects(http.getJson('https://a.test/'), { kind: 'parse' });
});
test('3 straight network failures open the circuit for 60 s', async () => {
  http.register('s', { perMinute: 60, concurrent: 2 });
  next = [1, 2, 3, 4].map(() => () => { throw new TypeError('x'); });
  for (let i = 0; i < 3; i++) await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'network' });
  await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'circuit' }); assert.equal(calls.length, 3);
  clock.advance(60000);
  await assert.rejects(http.request('https://a.test/', { source: 's' }), { kind: 'network' }); assert.equal(calls.length, 4);
});
