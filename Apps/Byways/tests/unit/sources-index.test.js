import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_VERSION } from '../../src/core/version.js';
import { IDENT, SELF_PACED, SOURCES, enabledSources, getSource } from '../../src/core/sources/index.js';

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
const TABLE = { wikipedia: ['open','none','mostly',10,true], commons: ['open','none','mixed',10,false], inat: ['open','none','mostly',60,true],
  openlibrary: ['open','none','mostly',60,false], apod: ['open','demo','curated',2,true], marginalia: ['open','optional','mostly',20,false],
  github: ['open','optional','mostly',10,false], hn: ['probe','none','mostly',60,false], aic: ['open','none','curated',60,true],
  met: ['probe','none','curated',60,true], cleveland: ['probe','none','curated',60,true], nasaimages: ['probe','none','curated',30,false],
  loc: ['probe','none','curated',10,false], smithsonian: ['probe','required','curated',30,true], europeana: ['open','required','mostly',30,false],
  openverse: ['open','required','mostly',20,false], kagi: ['open','none','curated',6,true], kagirandom: ['probe','none','curated',20,true],
  wiby: ['probe','none','curated',10,false], library: ['open','none','curated',600,true] };
test('the registry matches the adapter table', () => {
  for (const [id, [tier, key, safety, perMinute, fate]] of Object.entries(TABLE)) {
    const a = getSource(id);
    assert.deepEqual([a.tier, a.key, a.safety, a.rate.perMinute, a.fate], [tier, key, safety, perMinute, fate], id);
    if (tier === 'probe') assert.match(a.probeUrl, /^https:\/\//, id);
  }
  assert.deepEqual(['apod', 'smithsonian', 'europeana', 'openverse', 'marginalia', 'github'].map((id) => getSource(id).keyName),
    ['src:datagov', 'src:datagov', 'src:europeana', 'src:openverse', 'src:marginalia', 'src:github']);
  for (const id of ['ia', 'vault', 'oldweb', 'itch']) assert.equal(getSource(id), undefined);
});
