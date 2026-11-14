import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { assertSurpriseNotCached } from './helpers/surprise.js';
import inat from '../../src/core/sources/inat.js';
import openlibrary from '../../src/core/sources/openlibrary.js';
import apod from '../../src/core/sources/apod.js';

test('inat keeps CC photos and credits the observer', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await inat.random(ctx);
  const u = new URL(calls[0].url);
  assert.equal(u.searchParams.get('photo_license'), 'cc0,cc-by,cc-by-sa'); assert.equal(u.searchParams.get('per_page'), '30');
  assert.ok(+u.searchParams.get('page') >= 1 && +u.searchParams.get('page') <= 100);
  assert.equal(out.length, 1); const f = out[0];
  assert.equal(f.title, 'Western Honey Bee'); assert.equal(f.imageUrl, 'https://static.inaturalist.org/photos/1/large.jpg');
  assert.equal(f.author, 'beefan'); assert.equal(f.licence, 'CC BY');
  assert.equal(f.description, 'Apis mellifera, seen in Oslo, Norway on 2026-06-01.');
  await inat.more(f, ctx); assert.equal(new URL(calls[1].url).searchParams.get('taxon_id'), '47219');
});
test('openlibrary search builds book cards', async () => {
  const { ctx, calls } = await adapterCtx(); const [a, b] = await openlibrary.search('le guin', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('fields'), 'key,title,author_name,cover_i,first_publish_year');
  assert.equal(a.url, 'https://openlibrary.org/works/OL27448W'); assert.equal(a.imageUrl, 'https://covers.openlibrary.org/b/id/12345-M.jpg');
  assert.equal(a.description, 'Ursula K. Le Guin, 1969'); assert.equal(b.imageUrl, undefined);
});
test('openlibrary random reads a subject page', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await openlibrary.random(ctx);
  assert.match(calls[0].url, /\/subjects\/[a-z_]+\.json\?limit=12&offset=\d+$/); assert.ok(f.meta.subject);
});
test('apod uses DEMO_KEY and maps images and videos', async () => {
  const { ctx, calls } = await adapterCtx(); const out = await apod.random(ctx);
  const u = new URL(calls[0].url);
  assert.equal(u.searchParams.get('api_key'), 'DEMO_KEY'); assert.equal(u.searchParams.get('count'), '10'); assert.equal(u.searchParams.get('thumbs'), 'true');
  assert.equal(out.length, 2);
  assert.equal(out[0].url, 'https://apod.nasa.gov/apod/ap250314.html'); assert.equal(out[0].licence, '© Jane Sky');
  assert.equal(out[0].author, 'Jane Sky'); assert.equal(out[0].imageUrl, undefined);
  assert.equal(out[1].kind, 'video'); assert.equal(out[1].licence, 'Public domain (NASA)');
  assert.equal(out[1].imageUrl, 'https://apod.nasa.gov/apod/image/2401/thumb.jpg');
});
test('apod uses your api.data.gov key and stops near the DEMO_KEY limit', async () => {
  const keyed = await adapterCtx({ secrets: { 'src:datagov': 'MYKEY' } }); await apod.random(keyed.ctx);
  assert.equal(new URL(keyed.calls[0].url).searchParams.get('api_key'), 'MYKEY');
  const demo = await adapterCtx(); await demo.ctx.cache.set('apod:count:2026-11-11', 45, 864e5);
  assert.deepEqual(await apod.random(demo.ctx), []); assert.equal(demo.calls.length, 0);
});
test('apod stops for the day after a 429', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /api\.nasa\.gov/, file: 'apod/count.json', status: 429 }] });
  await assert.rejects(apod.random(ctx)); assert.equal(await ctx.cache.get('apod:count:2026-11-11'), 50);
});

// Extra checks beyond the brief: caching, the subject cover, the DEMO_KEY counter and partial observation fields.
test('inat search is cached for 24 hours and random is not', async () => {
  const { ctx, calls } = await adapterCtx(); await inat.search('bee', ctx); await inat.search('bee', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('q'), 'bee'); assert.equal(calls.length, 1);
  await inat.random(ctx); await inat.random(ctx); assert.equal(calls.length, 3);
});
test('inat leaves out the clauses it has no data for', async () => {
  const bare = { results: [{ id: 5, uri: 'https://www.inaturalist.org/observations/5', observed_on: '2026-01-02', taxon: { id: 9, name: 'Quercus' },
    photos: [{ url: 'https://static.inaturalist.org/photos/5/square.jpg', license_code: 'cc0' }] }] };
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /api\.inaturalist\.org/, json: bare }] });
  const [f] = await inat.random(ctx); assert.equal(f.title, 'Quercus'); assert.equal(f.licence, 'CC0');
  assert.equal(f.description, 'Quercus, on 2026-01-02.'); assert.equal(f.author, undefined);
});
test('openlibrary subject finds carry the cover and subject, and more stays on the subject', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await openlibrary.random(ctx);
  assert.equal(f.imageUrl, 'https://covers.openlibrary.org/b/id/777-M.jpg'); assert.equal(f.description, 'Ann Mapper, 1998');
  await openlibrary.more(f, ctx); assert.ok(calls[1].url.includes(`/subjects/${f.meta.subject}.json`));
  assert.deepEqual(await openlibrary.more({ meta: {} }, ctx), []); assert.equal(calls.length, 2);
});
test('apod counts each DEMO_KEY request, never counts a keyed one, and search and more are empty', async () => {
  const { ctx } = await adapterCtx(); await apod.random(ctx); await apod.random(ctx);
  assert.equal(await ctx.cache.get('apod:count:2026-11-11'), 2);
  const keyed = await adapterCtx({ secrets: { 'src:datagov': 'MYKEY' } }); await apod.random(keyed.ctx);
  assert.equal(await keyed.ctx.cache.get('apod:count:2026-11-11'), undefined);
  assert.deepEqual(await apod.search('x', ctx), []); assert.deepEqual(await apod.more({}, ctx), []);
});

test('inat skips an observation whose id is missing or not a string or number', async () => {
  const photo = { url: 'https://static.inaturalist.org/photos/7/square.jpg', license_code: 'cc0' };
  const observation = id => ({ id, uri: `https://www.inaturalist.org/observations/${id}`, taxon: { id: 9, name: 'Quercus' }, photos: [photo] });
  const results = [observation(undefined), observation({ n: 1 }), observation(null), observation('o7'), observation(8)];
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /api\.inaturalist\.org/, json: { results } }] });
  assert.deepEqual((await inat.random(ctx)).map(f => f.id), ['inat:o7', 'inat:8']);
});

// Added in Task 19b: a surprise-shaped 200 reply is never cached (shared adapter rule 12).
test('inat does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /api\.inaturalist\.org/, bad: { error: 'busy' }, empty: { total_results: 0, results: [] }, call: ctx => inat.search('bee', ctx),
}));
test('openlibrary does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /openlibrary\.org\/search\.json/, bad: { error: 'busy' }, empty: { numFound: 0, docs: [] }, call: ctx => openlibrary.search('le guin', ctx),
}));
