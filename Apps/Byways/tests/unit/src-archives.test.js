import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { assertSurpriseNotCached } from './helpers/surprise.js';
import { SOURCES } from '../../src/core/sources/index.js';
import nasaimages from '../../src/core/sources/nasaimages.js';
import loc from '../../src/core/sources/loc.js';
import smithsonian from '../../src/core/sources/smithsonian.js';

test('nasaimages builds detail links', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await nasaimages.search('nebula', ctx);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('media_type'), 'image'); assert.equal(u.searchParams.get('page_size'), '20');
  assert.equal(f.url, 'https://images.nasa.gov/details/PIA123'); assert.equal(f.attribution, 'NASA GSFC');
  assert.equal(f.licence, 'Public domain (NASA)');
});
test('loc reads JSON, shows no image and treats HTML as a failure', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await loc.search('map', ctx);
  const u = new URL(calls[0].url); assert.equal(u.pathname, '/photos/'); assert.equal(u.searchParams.get('fo'), 'json'); assert.equal(u.searchParams.get('c'), '25');
  assert.equal(f.title, 'Map of Boston'); assert.equal(f.description, 'An old map.'); assert.equal(f.imageUrl, undefined);
  const html = await adapterCtx({ extraRoutes: [{ match: /loc\.gov/, file: 'loc/captcha.html', headers: { 'content-type': 'text/html' } }] });
  await assert.rejects(loc.search('map', html.ctx));
  assert.deepEqual(await html.store.keys('cache'), []);
});
test('smithsonian needs the api.data.gov key, shows CC0 images only and keeps the key out of the cache', async () => {
  const none = await adapterCtx(); assert.deepEqual(await smithsonian.search('quilt', none.ctx), []); assert.equal(none.calls.length, 0);
  const { ctx, calls, store } = await adapterCtx({ secrets: { 'src:datagov': 'MYKEY' } });
  const [a, b] = await smithsonian.search('quilt', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('api_key'), 'MYKEY');
  assert.equal(a.licence, 'CC0'); assert.ok(a.imageUrl); assert.equal(a.attribution, 'National Museum of American History');
  assert.equal(b.imageUrl, undefined);
  const keys = await store.keys('cache'); assert.ok(keys.length >= 1); assert.equal(keys.some((k) => k.includes('MYKEY')), false);
});

const archives = [nasaimages, loc, smithsonian];
const withKey = { secrets: { 'src:datagov': 'MYKEY' } };

test('the archive adapters are registered with their table rows', () => {
  for (const adapter of archives) assert.equal(SOURCES[adapter.id], adapter);
  assert.deepEqual(archives.map((a) => [a.tier, a.key, a.keyName, a.rate, a.fate]), [
    ['probe', 'none', undefined, { perMinute: 30, concurrent: 1 }, false],
    ['probe', 'none', undefined, { perMinute: 10, concurrent: 1 }, false],
    ['probe', 'required', 'src:datagov', { perMinute: 30, concurrent: 1 }, true],
  ]);
  assert.deepEqual(archives.map((a) => a.probeUrl), [
    'https://images-api.nasa.gov/search?q=moon&media_type=image&page_size=1',
    'https://www.loc.gov/photos/?q=map&fo=json&c=1',
    'https://api.si.edu/openaccess/api/v1.0/search?q=quilt&rows=1&api_key=DEMO_KEY',
  ]);
});
test('nasaimages keeps the id, image and credit of an item and skips one without an id', async () => {
  const { ctx } = await adapterCtx(); const out = await nasaimages.search('nebula', ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'nasa:PIA123'); assert.equal(out[0].imageUrl, 'https://images-assets.nasa.gov/image/PIA123/PIA123~thumb.jpg');
  assert.deepEqual(out[0].why, ['NASA Images']); assert.deepEqual(out[0].tags, ['space']);
});
test('loc search ignores the image_url entries and skips a result without a link', async () => {
  const { ctx } = await adapterCtx(); const out = await loc.search('map', ctx);
  assert.equal(out.length, 1); assert.equal(out[0].url, 'https://www.loc.gov/item/2003623456/');
  assert.deepEqual(out[0].why, ['Library of Congress']); assert.deepEqual(out[0].tags, ['history', 'photography']);
});
test('smithsonian maps links and the access flag', async () => {
  const { ctx } = await adapterCtx(withKey); const [a, b] = await smithsonian.search('quilt', ctx);
  assert.equal(a.url, 'https://www.si.edu/object/crazy-quilt:nmah_1234'); assert.equal(a.title, 'Crazy quilt');
  assert.equal(b.title, 'Not open'); assert.equal(b.licence, undefined); assert.equal(b.attribution, 'National Museum of American History');
  assert.deepEqual(a.why, ['Smithsonian Open Access']);
});
test('random searches one seed word on a page, and more returns nothing', async () => {
  const nasa = await adapterCtx(); await nasaimages.random(nasa.ctx);
  const n = new URL(nasa.calls[0].url);
  assert.ok(['nebula', 'aurora', 'rover', 'launch', 'galaxy', 'eclipse', 'saturn', 'apollo', 'comet', 'earth'].includes(n.searchParams.get('q')));
  assert.ok(+n.searchParams.get('page') >= 1 && +n.searchParams.get('page') <= 5);
  const lc = await adapterCtx(); await loc.random(lc.ctx);
  const l = new URL(lc.calls[0].url); assert.ok(+l.searchParams.get('sp') >= 1 && +l.searchParams.get('sp') <= 5); assert.ok(l.searchParams.get('q'));
  const si = await adapterCtx(withKey); await smithsonian.random(si.ctx);
  const s = new URL(si.calls[0].url); assert.ok(+s.searchParams.get('start') >= 0 && +s.searchParams.get('start') < 200); assert.equal(s.searchParams.get('api_key'), 'MYKEY');
  for (const adapter of archives) assert.deepEqual(await adapter.more({}, nasa.ctx), [], adapter.id);
});
test('smithsonian without a key makes no request from random either', async () => {
  const { ctx, calls } = await adapterCtx(); assert.deepEqual(await smithsonian.random(ctx), []); assert.equal(calls.length, 0);
});
test('a second identical search makes no new request', async () => {
  for (const adapter of archives) {
    const { ctx, calls } = await adapterCtx(withKey); const first = await adapter.search('same', ctx); const made = calls.length;
    assert.ok(made > 0); assert.deepEqual(await adapter.search('same', ctx), first); assert.equal(calls.length, made, adapter.id);
  }
});

// Added in Task 19b: a surprise-shaped 200 reply is never cached (shared adapter rule 12).
test('nasaimages does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /images-api\.nasa\.gov/, bad: { reason: 'busy' }, empty: { collection: { items: [] } }, call: ctx => nasaimages.search('nebula', ctx),
}));
test('loc does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /loc\.gov/, bad: { status: 503 }, empty: { results: [] }, call: ctx => loc.search('map', ctx),
}));
test('smithsonian does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /api\.si\.edu/, bad: { error: { code: 'OVER_RATE_LIMIT' } }, empty: { status: 200, response: { rows: [] } },
  call: ctx => smithsonian.search('quilt', ctx), options: withKey,
}));
