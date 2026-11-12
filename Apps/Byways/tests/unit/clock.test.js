import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock, utcDate, nextUtcMidnight } from '../../src/core/util/clock.js';
import { NetError } from '../../src/core/net/errors.js';

test('fakeClock runs due timers in order and sets now', () => {
  const c = fakeClock(1000); const log = [];
  c.setTimeout(() => log.push('b'), 20);
  c.setTimeout(() => { log.push('a'); c.setTimeout(() => log.push('a2'), 2); }, 10);
  const x = c.setTimeout(() => log.push('x'), 5); c.clearTimeout(x);
  c.advance(15);
  assert.deepEqual(log, ['a', 'a2']); assert.equal(c.now(), 1015);
  c.advance(5); assert.deepEqual(log, ['a', 'a2', 'b']);
});
test('utcDate and nextUtcMidnight', () => {
  assert.equal(utcDate(Date.UTC(2026, 10, 11, 23, 59)), '2026-11-11');
  assert.equal(nextUtcMidnight(Date.UTC(2026, 10, 11, 23, 59)), Date.UTC(2026, 10, 12));
  assert.equal(nextUtcMidnight(Date.UTC(2026, 10, 12)), Date.UTC(2026, 10, 13));
});
test('NetError carries kind, status and source in either form', () => {
  const e = new NetError('http', 'HTTP 503', { status: 503, retryAfterMs: 2000, source: 'wikipedia' });
  assert.ok(e instanceof Error); assert.equal(e.name, 'NetError');
  assert.deepEqual([e.kind, e.message, e.status, e.retryAfterMs, e.source], ['http', 'HTTP 503', 503, 2000, 'wikipedia']);
  const o = new NetError({ kind: 'circuit', source: 'ia' });
  assert.deepEqual([o.kind, o.message, o.status, o.source], ['circuit', 'circuit', undefined, 'ia']);
});
