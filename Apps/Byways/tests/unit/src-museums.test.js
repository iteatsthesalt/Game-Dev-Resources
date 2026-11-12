import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { IDENT } from '../../src/core/sources/index.js';
import aic from '../../src/core/sources/aic.js';
import met from '../../src/core/sources/met.js';
import cleveland from '../../src/core/sources/cleveland.js';

test('aic builds IIIF images and sends AIC-User-Agent', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await aic.random(ctx);
  assert.equal(calls[0].headers['aic-user-agent'], IDENT);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('query[term][is_public_domain]'), 'true'); assert.ok(+u.searchParams.get('page') <= 500);
  assert.equal(out.length, 1);
  assert.equal(out[0].imageUrl, 'https://www.artic.edu/iiif/2/2d484387/full/843,/0/default.jpg');
  assert.equal(out[0].url, 'https://www.artic.edu/artworks/27992'); assert.equal(out[0].author, 'Georges Seurat French, 1859–1891');
  assert.equal(out[0].licence, 'Public domain'); assert.equal(out[0].meta?.lqip, undefined);
});
test('met uses v1.1 search and keeps public-domain objects', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await met.random(ctx);
  assert.equal(calls.some(c => c.url.includes('/v1/search')), false);
  assert.ok(+new URL(calls[1].url).searchParams.get('offset') < 5000);
  assert.equal(f.title, 'Wheat Field with Cypresses'); assert.equal(f.author, 'Vincent van Gogh');
  const pd = await adapterCtx({ extraRoutes: [{ match: /\/v1\/objects\//, file: 'met/object-not-pd.json' }] });
  assert.deepEqual(await met.random(pd.ctx), []);
});
test('cleveland keeps CC0 only and pages by skip', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await cleveland.random(ctx);
  assert.ok(+new URL(calls[1].url).searchParams.get('skip') < 30000);
  assert.deepEqual(out.map(f => f.title), ['Twilight in the Wilderness']); assert.equal(out[0].licence, 'CC0');
  await cleveland.random(ctx); assert.equal(calls.filter(c => c.url.endsWith('limit=1')).length, 1);
});

const DAY = 24 * 3600e3;
const objectCalls = calls => calls.filter(c => c.url.includes('/v1/objects/'));

test('aic search sends the query and maps finds', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await aic.search('seurat', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'seurat');
  assert.equal(out.length, 1); assert.equal(out[0].id, 'aic:27992');
});
test('met search sends the query and maps finds', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await met.search('van gogh', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'van gogh');
  assert.equal(out.length, 1); assert.equal(out[0].title, 'Wheat Field with Cypresses');
});
test('cleveland search sends the query and maps finds', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await cleveland.search('twilight', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'twilight');
  assert.deepEqual(out.map(f => f.title), ['Twilight in the Wilderness']);
});
test('a second identical search makes no new request', async () => {
  for (const adapter of [aic, met, cleveland]) {
    const { ctx, calls } = await adapterCtx(); const first = await adapter.search('same', ctx); const made = calls.length;
    assert.ok(made > 0); assert.deepEqual(await adapter.search('same', ctx), first); assert.equal(calls.length, made, adapter.id);
  }
});
test('met object lookups are cached for 7 days', async () => {
  const { ctx, calls } = await adapterCtx();
  await met.search('one', ctx); assert.equal(objectCalls(calls).length, 1);
  ctx.clock.advance(2 * DAY); await met.search('one', ctx);
  assert.equal(objectCalls(calls).length, 1);
  ctx.clock.advance(5 * DAY + 1); await met.search('one', ctx);
  assert.equal(objectCalls(calls).length, 2);
});
test('met search drops a lookup that fails and keeps the others', async () => {
  const search = { match: /\/v1\.1\/search/, json: { total: 3, objectIDs: [1, 2, 3] } };
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /\/v1\/objects\/2$/, status: 404, body: 'Not Found' }, search] });
  assert.deepEqual((await met.search('x', ctx)).map(f => f.id), ['met:436535', 'met:436535']);
  const all = await adapterCtx({ extraRoutes: [{ match: /\/v1\/objects\//, status: 404, body: 'Not Found' }, search] });
  assert.deepEqual(await met.search('y', all.ctx), []);
});
test('met and cleveland do not cache a reply without a total', async () => {
  for (const [adapter, bad, route] of [[met, { objectIDs: [] }, /\/v1\.1\/search/], [cleveland, { data: [] }, /\/api\/artworks\//]]) {
    const extraRoutes = [{ match: route, json: bad }];
    const { ctx } = await adapterCtx({ extraRoutes });
    assert.deepEqual(await adapter.random(ctx), [], adapter.id);
    extraRoutes.length = 0;
    assert.equal((await adapter.random(ctx)).length, 1, adapter.id);
  }
});
