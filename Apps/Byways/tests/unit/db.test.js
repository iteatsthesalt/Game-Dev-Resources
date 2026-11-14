import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { STORE_NAMES, openStore, idbBackend, memoryBackend } from '../../src/core/store/db.js';

const backends = [['memory', () => memoryBackend()], ['idb', () => idbBackend('t-' + Math.random())]];
for (const [name, make] of backends) {
  test(`${name}: put and get clone values; delete removes`, async () => {
    const s = await openStore(make()); const v = { a: [1] };
    await s.put('settings', 'k', v); v.a.push(2);
    const got = await s.get('settings', 'k'); assert.deepEqual(got, { a: [1] });
    got.a.push(3); assert.deepEqual(await s.get('settings', 'k'), { a: [1] });
    assert.equal(await s.get('settings', 'missing'), undefined);
    await s.delete('settings', 'k'); assert.equal(await s.get('settings', 'k'), undefined);
  });
  test(`${name}: getAll and keys sort by key; clear empties one store`, async () => {
    const s = await openStore(make());
    await s.put('seen', 'b', 2); await s.put('seen', 'a', 1); await s.put('history', 'x', 0);
    assert.deepEqual(await s.getAll('seen'), [{ key: 'a', value: 1 }, { key: 'b', value: 2 }]);
    assert.deepEqual(await s.keys('seen'), ['a', 'b']);
    await s.clear('seen'); assert.deepEqual(await s.getAll('seen'), []); assert.deepEqual(await s.keys('history'), ['x']);
  });
  test(`${name}: every store exists and unknown names reject`, async () => {
    const s = await openStore(make());
    for (const n of STORE_NAMES) { await s.put(n, 'k', n); assert.equal(await s.get(n, 'k'), n); }
    await assert.rejects(s.get('nope', 'k'), /unknown store: nope/);
  });
}
test('STORE_NAMES is the §14.1 list', () => assert.deepEqual(STORE_NAMES, ['settings', 'taste', 'collections', 'history', 'seen', 'cache', 'aiCache', 'usage', 'health', 'keys']));
test('idb data survives reopening', async () => {
  const n = 'p-' + Math.random(); await (await openStore(idbBackend(n))).put('keys', 'k', 'v');
  assert.equal(await (await openStore(idbBackend(n))).get('keys', 'k'), 'v');
});
test('idb writes reject when the transaction aborts after the request succeeds', async () => {
  const s = await openStore(idbBackend('a-' + Math.random()));
  await s.put('keys', 'k', 'old');
  const proto = globalThis.IDBDatabase.prototype; const realTransaction = proto.transaction;
  // Abort each write transaction as soon as its request succeeds, before it can commit.
  proto.transaction = function (...args) {
    const tx = realTransaction.apply(this, args); const realObjectStore = tx.objectStore.bind(tx);
    tx.objectStore = name => {
      const os = realObjectStore(name);
      for (const m of ['put', 'delete', 'clear']) {
        const real = os[m].bind(os);
        os[m] = (...a) => { const req = real(...a); req.addEventListener('success', () => tx.abort()); return req; };
      }
      return os;
    };
    return tx;
  };
  try {
    await assert.rejects(s.put('keys', 'k', 'new'));
    await assert.rejects(s.delete('keys', 'k'));
    await assert.rejects(s.clear('keys'));
  } finally { proto.transaction = realTransaction; }
  assert.equal(await s.get('keys', 'k'), 'old');
});
test('idbBackend rejects when IndexedDB is missing', async () => {
  const saved = globalThis.indexedDB; globalThis.indexedDB = undefined;
  try { await assert.rejects(openStore(idbBackend('x')), /IndexedDB is not available/); } finally { globalThis.indexedDB = saved; }
});
