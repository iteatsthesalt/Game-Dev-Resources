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
