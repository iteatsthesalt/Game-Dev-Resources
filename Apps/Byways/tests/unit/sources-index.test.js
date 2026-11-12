import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../../src/core/version.js';
import { IDENT, SELF_PACED, SOURCES, enabledSources } from '../../src/core/sources/index.js';

const fake = (id, tier, key = 'none') => ({ id, tier, key, fate: true, rate: { perMinute: 60, concurrent: 1 }, random: async () => [], search: async () => [], more: async () => [] });
const all = [fake('a', 'open'), fake('k', 'open', 'required'), fake('p', 'probe'), fake('n', 'navigate'), fake('v', 'privileged')];
const ids = (xs) => xs.map(x => x.id);
test('enabledSources applies settings, keys and the probe', () => {
  assert.deepEqual(ids(enabledSources({ sources: {} }, {}, 'pwa', all)), ['a', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: {} }, { p: 'ok' }, 'pwa', all)), ['a', 'p', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: {} }, {}, 'android', all)), ['a', 'p', 'v']);
  assert.deepEqual(ids(enabledSources({ sources: { a: { enabled: false }, k: { enabled: true }, n: { enabled: true } } }, {}, 'pwa', all)), ['k', 'v']);
});
test('IDENT names the app version, and SELF_PACED the Archive ids', () => {
  assert.equal(IDENT, `Byways/${APP_VERSION} (+https://github.com/iteatsthesalt/Game-Dev-Resources)`);
  assert.deepEqual([...SELF_PACED].sort(), ['ia', 'vault']);
});
test('every registered adapter has the contract shape', () => {
  for (const [id, a] of Object.entries(SOURCES)) {
    assert.equal(a.id, id);
    assert.ok(['open','probe','privileged','snapshot','navigate'].includes(a.tier));
    assert.ok(['none','demo','optional','required'].includes(a.key));
    for (const m of ['random', 'search', 'more']) assert.equal(typeof a[m], 'function');
    assert.ok(a.rate.perMinute > 0 && a.rate.concurrent > 0);
  }
});
