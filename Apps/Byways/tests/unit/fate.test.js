import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { fatePull } from '../../src/core/fate.js';
import { makeFind } from '../../src/core/model/find.js';

// A source that throws is logged with console.warn; keep that out of the test output.
mock.method(console, 'warn', () => {});

const find =(t) => makeFind({ source: 's', kind: 'site', title: t, url: `https://${t}.example.com/`, safety: 'curated' });
const src = (id, outs, extra = {}) => { const calls = []; return { id, fate: true, calls, ...extra,
  random: async () => { calls.push(1); const o = outs.shift(); if (o instanceof Error) throw o; return o ?? []; } }; };
const never = async () => false;
test('fatePull follows the weights', async () => {
  const a = src('a', [[find('a')]]); const b = src('b', [[find('b')]]);
  const r = await fatePull({ sources: [a, b], weights: { a: 0 }, ctx: {}, rand: () => 0.01, seenHas: never });
  assert.equal(r.find.title, 'b'); assert.equal(a.calls.length, 0);
});
test('fatePull skips seen and failed pulls', async () => {
  const a = src('a', [new Error('down'), [find('old')], [find('new')]]);
  const r = await fatePull({ sources: [a], weights: {}, ctx: {}, rand: () => 0.5, seenHas: async (u) => u.includes('old') });
  assert.equal(r.find.title, 'new');
});
test('fatePull gives up after 3 retries', async () => {
  const a = src('a', []);
  const r = await fatePull({ sources: [a], weights: {}, ctx: {}, rand: () => 0.5, seenHas: never });
  assert.deepEqual(r, { miss: true, reason: 'Nothing new here. Try again, or turn on more Fate sources.' });
  assert.equal(a.calls.length, 4);
});
test('fatePull says when no Fate source is on', async () => {
  const r = await fatePull({ sources: [src('a', [], { fate: false })], weights: {}, ctx: {}, rand: () => 0.5, seenHas: never });
  assert.deepEqual(r, { miss: true, reason: 'No Fate sources are on. Turn some on in Settings → Sources.' });
});
test('fatePull skips finds that accept rejects', async () => {
  const a = src('a', [[find('blocked'), find('fine')]]);
  const r = await fatePull({ sources: [a], weights: {}, ctx: {}, rand: () => 0.5, seenHas: never, accept: (f) => !f.url.includes('blocked.') });
  assert.equal(r.find.title, 'fine');
});
