import test from 'node:test';
import assert from 'node:assert/strict';
import { fnv1a32, hash64, mulberry32, sha256Hex, gumbel } from '../../src/core/util/hash.js';

test('fnv1a32 matches FNV-1a vectors over UTF-8', () => {
  assert.equal(fnv1a32(''), 0x811c9dc5);
  assert.equal(fnv1a32('a'), 0xe40c292c);
  assert.equal(fnv1a32('foobar'), 0xbf9cf968);
  assert.equal(fnv1a32('é'), 0x1e9de8c1);
  assert.equal(fnv1a32('byways-daily-2026-11-11'), 3348453531);
});

test('hash64 is 16 hex chars of FNV-1a 64', () => {
  assert.equal(hash64(''), 'cbf29ce484222325');
  assert.equal(hash64('a'), 'af63dc4c8601ec8c');
  assert.equal(hash64('foobar'), '85944171f73967e8');
  assert.equal(hash64('é'), '0ac21707b7181e01');
});

test('mulberry32 is deterministic and in [0,1)', () => {
  const r = mulberry32(1);
  assert.deepEqual([r(), r(), r()], [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  assert.equal(mulberry32(0)(), 0.26642920868471265);
});

test('sha256Hex accepts strings and bytes', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await sha256Hex(new Uint8Array()), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('gumbel is -log(-log(u)) and stays finite at the edges', () => {
  assert.ok(Math.abs(gumbel(() => Math.exp(-1))) < 1e-12);
  assert.equal(gumbel(() => 0.5).toFixed(6), '0.366513');
  assert.ok(Number.isFinite(gumbel(() => 0)));
  assert.ok(Number.isFinite(gumbel(() => 1 - Number.EPSILON / 2)));
});
