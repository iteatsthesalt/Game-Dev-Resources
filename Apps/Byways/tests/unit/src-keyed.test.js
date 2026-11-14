import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { assertSurpriseNotCached } from './helpers/surprise.js';
import europeana from '../../src/core/sources/europeana.js';
import openverse from '../../src/core/sources/openverse.js';

const ov = { 'src:openverse': JSON.stringify({ clientId: 'ID', clientSecret: 'SECRET' }) };
const OV_FOX = 'https://api.openverse.org/v1/images/?q=fox&mature=false&page_size=20';
const EU_VASE = 'https://api.europeana.eu/record/v2/search.json?query=vase&reusability=open&media=true&rows=20';

test('europeana needs a key and sends it as a header', async () => {
  const none = await adapterCtx(); assert.deepEqual(await europeana.search('vase', none.ctx), []); assert.equal(none.calls.length, 0);
  const { ctx, calls } = await adapterCtx({ secrets: { 'src:europeana': 'EUKEY' } }); const [f] = await europeana.search('vase', ctx);
  const u = new URL(calls[0].url);
  assert.equal(calls[0].headers['x-api-key'], 'EUKEY'); assert.equal(u.searchParams.get('wskey'), null);
  assert.equal(u.searchParams.get('reusability'), 'open'); assert.equal(u.searchParams.get('media'), 'true');
  assert.equal(f.url, 'https://museum.example/vase'); assert.equal(f.attribution, 'Example Museum via Europeana');
});
test('openverse gets a token once and filters mature results', async () => {
  const none = await adapterCtx(); assert.deepEqual(await openverse.search('fox', none.ctx), []);
  const { ctx, calls, store } = await adapterCtx({ secrets: ov });
  const out = await openverse.search('fox', ctx); await openverse.search('fox', ctx);
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].headers['content-type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[0].body, 'grant_type=client_credentials&client_id=ID&client_secret=SECRET');
  assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 1);
  assert.equal(calls[1].headers.authorization, 'Bearer TOK'); assert.equal(new URL(calls[1].url).searchParams.get('mature'), 'false');
  assert.deepEqual(out.map(f => f.id), ['ov:ov1']); assert.equal(out[0].licence, 'CC BY 2.0'); assert.equal(out[0].url, 'https://www.flickr.com/photos/x/1');
  assert.equal(JSON.stringify(await store.getAll('cache')).includes('TOK'), false);
});
test('openverse more asks for related images', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov }); const [f] = await openverse.search('fox', ctx);
  await openverse.more(f, ctx); assert.equal(new URL(calls.at(-1).url).pathname, '/v1/images/ov1/related/');
});

test('europeana maps a search result and skips records without an id', async () => {
  const { ctx } = await adapterCtx({ secrets: { 'src:europeana': 'EUKEY' } }); const out = await europeana.search('vase', ctx);
  assert.deepEqual(out.map(f => f.id), ['eu:/2021672/resource_vase', 'eu:/2021672/resource_map']);
  const [vase, map] = out;
  assert.equal(vase.title, 'Attic red-figure vase'); assert.equal(vase.kind, 'image'); assert.equal(vase.source, 'europeana');
  assert.equal(vase.description, 'A mixing bowl painted with a feast scene.'); assert.equal(vase.licence, 'http://creativecommons.org/publicdomain/zero/1.0/');
  assert.ok(vase.imageUrl.startsWith('https://api.europeana.eu/thumbnail/')); assert.deepEqual(vase.why, ['Europeana']);
  assert.deepEqual(vase.tags, ['culture', 'history']);
  assert.equal(map.url, 'https://www.europeana.eu/item/2021672/resource_map'); assert.equal(map.description, '');
  assert.deepEqual(await europeana.more(vase, ctx), []);
});
test('europeana random searches a word from a start offset and is not cached', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: { 'src:europeana': 'EUKEY' } });
  assert.equal((await europeana.random(ctx)).length, 2); await europeana.random(ctx); assert.equal(calls.length, 2);
  const u = new URL(calls[0].url); assert.ok(+u.searchParams.get('start') >= 1 && +u.searchParams.get('start') <= 100);
  assert.ok(['map', 'clock', 'poster', 'bird', 'ship', 'mask', 'garden', 'tile', 'toy', 'letter'].includes(u.searchParams.get('query')));
  assert.equal(u.searchParams.get('wskey'), null);
});
test('europeana caches a search for 24 hours without the key in the store', async () => {
  const { ctx, calls, store } = await adapterCtx({ secrets: { 'src:europeana': 'EUKEY' } });
  await europeana.search('vase', ctx); await europeana.search('vase', ctx); assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(await store.getAll('cache')).includes('EUKEY'), false);
  ctx.clock.advance(24 * 3600e3 + 1); await europeana.search('vase', ctx); assert.equal(calls.length, 2);
});
test('europeana ignores a cached search once the key is gone', async () => {
  const { ctx, calls } = await adapterCtx(); await ctx.cache.set(EU_VASE, { items: [{ id: '/1/a', title: ['Cached'], guid: 'https://x.example/a' }] }, 3600e3);
  assert.deepEqual(await europeana.search('vase', ctx), []); assert.deepEqual(await europeana.random(ctx), []); assert.equal(calls.length, 0);
});

test('openverse maps licences, authors and attribution', async () => {
  const { ctx } = await adapterCtx({ secrets: ov }); const [f] = await openverse.search('fox', ctx);
  assert.equal(f.title, 'A red fox in the snow'); assert.equal(f.kind, 'image'); assert.equal(f.source, 'openverse'); assert.equal(f.author, 'Ann Photographer');
  assert.equal(f.imageUrl, 'https://api.openverse.org/v1/images/ov1/thumb/'); assert.match(f.attribution, /Ann Photographer/);
  assert.deepEqual(f.why, ['Openverse']); assert.deepEqual(f.tags, ['photography']); assert.equal(f.meta.ovId, 'ov1');
  const [rel] = await openverse.more(f, ctx); assert.equal(rel.id, 'ov:ov3'); assert.equal(rel.licence, 'CC0 1.0');
  const pdm = await adapterCtx({ secrets: ov, extraRoutes: [{ match: /v1\/images\/\?/, json: { results: [{ id: 'p1', title: 'Old map', foreign_landing_url: 'https://x.example/p1', license: 'pdm' }, { id: 'p2', title: 'Odd', foreign_landing_url: 'https://x.example/p2', license: 'by-sa' }] } }] });
  assert.deepEqual((await openverse.search('map', pdm.ctx)).map(x => [x.licence, x.imageUrl]), [['Public Domain Mark 1.0', undefined], ['CC BY-SA', undefined]]);
});
test('openverse random searches a word on a page and is not cached', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov });
  assert.deepEqual((await openverse.random(ctx)).map(f => f.id), ['ov:ov1']); await openverse.random(ctx);
  assert.equal(calls.filter(c => c.url.includes('/images/')).length, 2); assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 1);
  const u = new URL(calls[1].url); assert.ok(+u.searchParams.get('page') >= 1 && +u.searchParams.get('page') <= 5);
  assert.ok(['moss', 'lighthouse', 'fox', 'mushroom', 'tram', 'kite', 'owl', 'fern', 'lantern', 'harbour'].includes(u.searchParams.get('q')));
});
test('openverse caches a search for 24 hours and a cache hit fetches no token', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov });
  await ctx.cache.set(OV_FOX, { results: [{ id: 'c1', title: 'Cached fox', foreign_landing_url: 'https://x.example/c1', license: 'by', license_version: '4.0' }] }, 3600e3);
  assert.deepEqual((await openverse.search('fox', ctx)).map(f => f.id), ['ov:c1']); assert.equal(calls.length, 0);
  await openverse.search('owl', ctx); await openverse.search('owl', ctx); assert.equal(calls.length, 2);
  ctx.clock.advance(24 * 3600e3 + 1); await openverse.search('owl', ctx); assert.equal(calls.filter(c => c.url.includes('/images/')).length, 2);
});
test('openverse ignores a cached search once the credentials are gone or unusable', async t => {
  t.mock.method(console, 'warn', () => {});
  const bad = [undefined, 'not json', JSON.stringify({ clientId: 'ID' }), JSON.stringify({ clientId: ' ', clientSecret: 'S' })];
  for (const value of bad) {
    const { ctx, calls } = await adapterCtx({ secrets: value === undefined ? {} : { 'src:openverse': value } });
    await ctx.cache.set(OV_FOX, { results: [{ id: 'c1', title: 'Cached fox', foreign_landing_url: 'https://x.example/c1' }] }, 3600e3);
    assert.deepEqual(await openverse.search('fox', ctx), []); assert.deepEqual(await openverse.random(ctx), []); assert.deepEqual(await openverse.more({ meta: { ovId: 'ov1' } }, ctx), []);
    assert.equal(calls.length, 0);
  }
});
test('openverse warns about unparsable credentials without quoting them', async t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { ctx } = await adapterCtx({ secrets: { 'src:openverse': 'clientId=ID&clientSecret=SECRET' } });
  assert.deepEqual(await openverse.search('fox', ctx), []);
  assert.equal(warn.mock.callCount(), 1); assert.equal(String(warn.mock.calls[0].arguments.join(' ')), 'Openverse credentials are not valid JSON');
});
test('two concurrent openverse searches request one token', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov });
  const [a, b] = await Promise.all([openverse.search('fox', ctx), openverse.search('owl', ctx)]);
  assert.equal(a.length, 1); assert.equal(b.length, 1); assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 1);
});
test('an openverse token is renewed a minute before it expires', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov }); const tokens = () => calls.filter(c => c.url.includes('auth_tokens')).length;
  await openverse.search('fox', ctx); ctx.clock.advance((43200 - 60) * 1000 - 1); await openverse.search('owl', ctx); assert.equal(tokens(), 1);
  ctx.clock.advance(2); await openverse.search('fern', ctx); assert.equal(tokens(), 2);
});
test('an openverse token that is too short-lived is used once and not kept', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov, extraRoutes: [{ match: /auth_tokens/, json: { access_token: 'TOK', expires_in: 60 } }] });
  await openverse.search('fox', ctx); await openverse.search('owl', ctx); assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 2);
});
test('an openverse token reply without an access token gives nothing and keeps nothing', async () => {
  const routes = [{ match: /auth_tokens/, json: { error: 'invalid_client' } }]; const { ctx, calls } = await adapterCtx({ secrets: ov, extraRoutes: routes });
  assert.deepEqual(await openverse.search('fox', ctx), []); assert.equal(calls.length, 1);
  routes.length = 0; assert.equal((await openverse.search('fox', ctx)).length, 1);
});
test('a changed openverse secret gets a fresh token', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov }); await openverse.search('fox', ctx);
  await ctx.secrets.set('src:openverse', JSON.stringify({ clientId: 'ID', clientSecret: 'OTHER' })); await openverse.search('owl', ctx);
  assert.deepEqual(calls.filter(c => c.url.includes('auth_tokens')).map(c => c.body.split('&')[2]), ['client_secret=SECRET', 'client_secret=OTHER']);
});
test('a 401 from openverse drops the token so the next call fetches a new one', async () => {
  const routes = [{ match: /v1\/images\/\?/, status: 401, json: { detail: 'expired' } }]; const { ctx, calls } = await adapterCtx({ secrets: ov, extraRoutes: routes });
  await assert.rejects(openverse.search('fox', ctx), { kind: 'http', status: 401 });
  assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 1); assert.equal(calls.length, 2);
  routes.length = 0; assert.equal((await openverse.search('fox', ctx)).length, 1);
  assert.equal(calls.filter(c => c.url.includes('auth_tokens')).length, 2);
});
test('openverse more gives nothing without an id and encodes the id in the path', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: ov });
  assert.deepEqual(await openverse.more({ meta: {} }, ctx), []); assert.deepEqual(await openverse.more({}, ctx), []); assert.equal(calls.length, 0);
  await openverse.more({ meta: { ovId: 'a/b c' } }, ctx); assert.equal(new URL(calls.at(-1).url).pathname, '/v1/images/a%2Fb%20c/related/');
});

// Added in Task 19b: a surprise-shaped 200 reply is never cached (shared adapter rule 12).
test('europeana does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /api\.europeana\.eu/, bad: { success: false, error: 'busy' }, empty: { success: true, itemsCount: 0, totalResults: 0, items: [] },
  call: ctx => europeana.search('vase', ctx), options: { secrets: { 'src:europeana': 'EUKEY' } },
}));
test('openverse does not cache a surprise-shaped search or related reply', async () => {
  await assertSurpriseNotCached({
    match: /v1\/images\/\?/, bad: { detail: 'busy' }, empty: { result_count: 0, results: [] }, call: ctx => openverse.search('fox', ctx), options: { secrets: ov },
  });
  await assertSurpriseNotCached({
    match: /\/related\//, bad: { detail: 'busy' }, empty: { result_count: 0, results: [] },
    call: ctx => openverse.more({ meta: { ovId: 'ov1' } }, ctx), options: { secrets: ov },
  });
});
