import test from 'node:test';
import assert from 'node:assert/strict';
import { probeSource, runProbes } from '../../src/core/sources/probe.js';
import { adapterCtx } from './helpers/fixture-http.js';

const ad = (id, probeUrl) => ({ id, tier: 'probe', probeUrl, rate: { perMinute: 60, concurrent: 1 } });
test('probeSource needs a JSON reply or a 4xx answer', async () => {
  const { ctx } = await adapterCtx();
  assert.equal(await probeSource(ad('x', 'https://probe-ok.example/'), ctx.http), 'ok');
  assert.equal(await probeSource(ad('x', 'https://probe-403.example/'), ctx.http), 'ok');
  assert.equal(await probeSource(ad('x', 'https://probe-html.example/'), ctx.http), 'fail');
  assert.equal(await probeSource(ad('x', 'https://nowhere.invalid/'), ctx.http), 'fail');
  assert.equal(await probeSource({ id: 'x' }, ctx.http), 'ok');
});
test('runProbes stores results and re-runs after 24 h', async () => {
  const { ctx, calls, store } = await adapterCtx();
  const list = [ad('x', 'https://probe-ok.example/'), ad('y', 'https://nowhere.invalid/')];
  assert.deepEqual(await runProbes(list, ctx.http, store, ctx.clock), { x: 'ok', y: 'fail' });
  assert.deepEqual((await store.get('health', 'probe:pwa')).results, { x: 'ok', y: 'fail' });
  const n = calls.length; ctx.clock.advance(3600e3);
  await runProbes(list, ctx.http, store, ctx.clock); assert.equal(calls.length, n);
  ctx.clock.advance(24 * 3600e3); await runProbes(list, ctx.http, store, ctx.clock); assert.ok(calls.length > n);
});
test('runProbes probes only the ids a fresh record lacks and keeps the rest', async () => {
  const { ctx, calls, store } = await adapterCtx();
  const x = ad('x', 'https://probe-ok.example/x'), y = ad('y', 'https://probe-ok.example/y');
  assert.deepEqual(await runProbes([x], ctx.http, store, ctx.clock), { x: 'ok' });
  const { at } = await store.get('health', 'probe:pwa');
  ctx.clock.advance(3600e3); calls.length = 0;
  assert.deepEqual(await runProbes([x, y], ctx.http, store, ctx.clock), { x: 'ok', y: 'ok' });
  assert.deepEqual(calls.map(c => c.url), ['https://probe-ok.example/y']);
  assert.deepEqual(await store.get('health', 'probe:pwa'), { at, results: { x: 'ok', y: 'ok' } });
  assert.deepEqual(await runProbes([y], ctx.http, store, ctx.clock), { y: 'ok' });
  assert.equal(calls.length, 1);
});
