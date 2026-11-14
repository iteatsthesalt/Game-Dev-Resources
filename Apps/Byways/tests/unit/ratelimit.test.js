import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from '../../src/core/util/clock.js';
import { createLimiter, parseRetryAfter } from '../../src/core/net/ratelimit.js';
import { flush, deferred } from './helpers/async.js';

test('runs at most `concurrent` at once', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 100, concurrent: 2, clock: c });
  const d = [deferred(), deferred(), deferred()]; let started = 0;
  d.forEach(x => lim.schedule(() => { started++; return x.promise; }));
  await flush(); assert.equal(started, 2);
  d[0].resolve(); await flush(); assert.equal(started, 3);
});
test('keeps to perMinute over a sliding 60 s window', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 2, concurrent: 5, clock: c }); let done = 0;
  for (let i = 0; i < 3; i++) lim.schedule(async () => { done++; });
  await flush(); assert.equal(done, 2);
  c.advance(59999); await flush(); assert.equal(done, 2);
  c.advance(1); await flush(); assert.equal(done, 3);
});
test('pauseFor holds new starts', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 60, concurrent: 1, clock: c }); let done = 0;
  lim.pauseFor(5000); lim.schedule(async () => { done++; });
  await flush(); assert.equal(done, 0);
  c.advance(5000); await flush(); assert.equal(done, 1);
});
test('a rejection reaches the caller and frees the slot', async () => {
  const c = fakeClock(0); const lim = createLimiter({ perMinute: 60, concurrent: 1, clock: c });
  await assert.rejects(lim.schedule(async () => { throw new Error('boom'); }), /boom/);
  assert.equal(await lim.schedule(async () => 7), 7);
});
test('parseRetryAfter reads seconds and HTTP dates', () => {
  const now = Date.UTC(2026, 10, 11);
  assert.equal(parseRetryAfter('120', now), 120000);
  assert.equal(parseRetryAfter('0', now), 0);
  assert.equal(parseRetryAfter('Wed, 11 Nov 2026 00:00:10 GMT', now), 10000);
  assert.equal(parseRetryAfter('Tue, 10 Nov 2026 00:00:00 GMT', now), 0);
  for (const v of ['soon', '-5', '1.5', '', null, undefined]) assert.equal(parseRetryAfter(v, now), null);
});
