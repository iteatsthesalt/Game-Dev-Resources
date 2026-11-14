import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { assertSurpriseNotCached } from './helpers/surprise.js';
import { IDENT } from '../../src/core/sources/index.js';
import wikipedia from '../../src/core/sources/wikipedia.js';
import commons from '../../src/core/sources/commons.js';

const disamb = [{ match: /page\/random\/summary/, file: 'wikipedia/random-disambiguation.json' }];
test('wikipedia random reads a summary and sends Api-User-Agent', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await wikipedia.random(ctx);
  assert.equal(f.id, 'wiki:en:Ada_Lovelace'); assert.equal(f.kind, 'article');
  assert.equal(f.url, 'https://en.wikipedia.org/wiki/Ada_Lovelace'); assert.equal(f.imageUrl, 'https://upload.wikimedia.org/ada.jpg');
  assert.equal(f.licence, 'CC BY-SA 4.0'); assert.deepEqual(f.why, ['Wikipedia: random article']); assert.deepEqual(f.tags, ['education']);
  assert.equal(calls[0].headers['api-user-agent'], IDENT);
});
test('wikipedia random skips disambiguation pages', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: disamb }); assert.deepEqual(await wikipedia.random(ctx), []);
});
test('wikipedia search uses origin=* and keeps result order', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await wikipedia.search('moth', ctx);
  assert.deepEqual(out.map(f => f.title), ['Moth', 'Moth trap']);
  const u = new URL(calls[0].url); assert.equal(u.searchParams.get('origin'), '*'); assert.equal(u.searchParams.get('gsrsearch'), 'moth');
  assert.equal(calls[0].headers['api-user-agent'], IDENT);
});
test('wikipedia more uses morelike', async () => {
  const { ctx, calls } = await adapterCtx(); const [ada] = await wikipedia.random(ctx);
  const out = await wikipedia.more(ada, ctx);
  assert.equal(new URL(calls[1].url).searchParams.get('gsrsearch'), 'morelike:Ada Lovelace');
  assert.deepEqual(out.map(f => f.title), ['Charles Babbage']);
});
test('commons random is the picture of the day', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await commons.random(ctx);
  assert.ok(calls[0].url.endsWith('/api/rest_v1/feed/featured/2026/11/11')); assert.equal(calls[0].headers['api-user-agent'], IDENT);
  assert.equal(f.title, 'Aurora'); assert.equal(f.safety, 'curated'); assert.equal(f.author, 'Jane Doe');
  assert.equal(f.url, 'https://commons.wikimedia.org/wiki/File:Aurora.jpg'); assert.deepEqual(f.why, ['Wikimedia Commons: picture of the day']);
});
test('commons turns extmetadata HTML into plain text', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await commons.search('map', ctx);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, 'An old map.'); assert.equal(out[0].author, 'Ann');
  assert.equal(out[0].attribution, 'Ann · CC BY 4.0 · Wikimedia Commons'); assert.equal(out[0].safety, 'mixed');
  assert.equal(new URL(calls[0].url).searchParams.get('gsrnamespace'), '6'); assert.equal(calls[0].headers['api-user-agent'], IDENT);
  assert.equal(commons.fate, false); assert.equal(commons.safety, 'mixed');
});

// Added in fix round 1: picture-of-the-day fields, a feed without an image, and the 24 h search cache.
const DAY = 24 * 3600e3;
test('commons picture of the day carries its image, licence and description', async () => {
  const { ctx } = await adapterCtx(); const [f] = await commons.random(ctx);
  assert.equal(f.imageUrl, 'https://upload.wikimedia.org/aurora-640.jpg'); assert.equal(f.licence, 'CC BY-SA 4.0');
  assert.equal(f.description, 'Green aurora over a frozen lake.');
  assert.equal(f.attribution, 'Jane Doe · CC BY-SA 4.0 · Wikimedia Commons');
});
test('commons random returns [] when the featured feed has no image', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /feed\/featured\//, json: { tfa: {} } }] });
  assert.deepEqual(await commons.random(ctx), []);
});
test('wikipedia search is cached for 24 hours, and more shares that cache', async () => {
  const { ctx, calls } = await adapterCtx(); const first = await wikipedia.search('moth', ctx);
  assert.deepEqual(await wikipedia.search('moth', ctx), first); assert.equal(calls.length, 1);
  ctx.clock.advance(DAY + 1); await wikipedia.search('moth', ctx); assert.equal(calls.length, 2);
  await wikipedia.more(first[0], ctx); await wikipedia.more(first[0], ctx); assert.equal(calls.length, 3);
  ctx.clock.advance(DAY + 1); await wikipedia.more(first[0], ctx); assert.equal(calls.length, 4);
});
test('wikipedia random is never cached', async () => {
  const { ctx, calls } = await adapterCtx(); await wikipedia.random(ctx); await wikipedia.random(ctx);
  assert.equal(calls.length, 2);
});
test('commons search is cached for 24 hours', async () => {
  const { ctx, calls } = await adapterCtx(); const first = await commons.search('map', ctx);
  assert.deepEqual(await commons.search('map', ctx), first); assert.equal(calls.length, 1);
  ctx.clock.advance(DAY + 1); await commons.search('map', ctx); assert.equal(calls.length, 2);
});
test('commons picture of the day feed is cached for 24 hours', async () => {
  const { ctx, calls } = await adapterCtx(); const first = await commons.random(ctx);
  assert.deepEqual(await commons.random(ctx), first); assert.equal(calls.length, 1);
  ctx.clock.advance(DAY + 1); await commons.random(ctx); assert.equal(calls.length, 2);
});

// Added in Task 19b: a surprise-shaped 200 reply is never cached (shared adapter rule 12).
const maxlag = { error: { code: 'maxlag', info: 'Waiting for a database server' } };
test('wikipedia does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /en\.wikipedia\.org\/w\/api\.php/, bad: maxlag, empty: { batchcomplete: '' }, call: ctx => wikipedia.search('moth', ctx),
}));
test('commons does not cache a surprise-shaped search reply or a feed without a picture', async () => {
  await assertSurpriseNotCached({
    match: /commons\.wikimedia\.org\/w\/api\.php/, bad: maxlag, empty: { batchcomplete: '' }, call: ctx => commons.search('map', ctx),
  });
  await assertSurpriseNotCached({ match: /feed\/featured\//, bad: { tfa: {} }, call: ctx => commons.random(ctx) });
});
