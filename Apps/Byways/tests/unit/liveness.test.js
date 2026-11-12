import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLive } from '../../src/core/liveness.js';

const tr = (fn) => { const calls = []; return { calls, fetch: (u, init) => { calls.push({ u, init }); return fn(u, init); } }; };
test('the web check only asks whether the site answers', async () => {
  const t = tr(async () => ({ status: 0, type: 'opaque' }));
  assert.equal(await checkLive('https://example.com/a/b?x=1', { transport: t }), true);
  assert.equal(t.calls[0].u, 'https://example.com/'); assert.equal(t.calls[0].init.mode, 'no-cors');
  assert.equal(await checkLive('https://gone.example/', { transport: tr(async () => { throw new TypeError('Failed to fetch'); }) }), false);
});
test('the privileged check reads the status', async () => {
  for (const [status, live] of [[200, true], [405, true], [404, false], [500, false]]) {
    const t = tr(async () => ({ status }));
    assert.equal(await checkLive('https://example.com/a', { transport: t, privileged: true }), live);
    assert.equal(t.calls[0].init.privileged, true);
  }
});
test('a hung site counts as not live', async () => {
  const hang = tr((u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))));
  assert.equal(await checkLive('https://slow.example/', { transport: hang, timeoutMs: 20 }), false);
});
test('the web check never fetches an http: site', async () => {
  const t = tr(async () => ({ status: 0, type: 'opaque' }));
  assert.equal(await checkLive('http://0x80.example/feed', { transport: t }), true); assert.equal(t.calls.length, 0);
});
test('a url that is not http(s) is not live and is never fetched', async () => {
  for (const privileged of [false, true]) {
    const t = tr(async () => ({ status: 200 }));
    assert.equal(await checkLive('javascript:alert(1)', { transport: t, privileged }), false);
    assert.equal(t.calls.length, 0);
  }
});
test('the privileged check fetches an http: url as given', async () => {
  const t = tr(async () => ({ status: 200 }));
  assert.equal(await checkLive('http://plain.example/feed', { transport: t, privileged: true }), true);
  assert.equal(t.calls.length, 1); assert.equal(t.calls[0].u, 'http://plain.example/feed'); assert.equal(t.calls[0].init.method, 'HEAD');
});
