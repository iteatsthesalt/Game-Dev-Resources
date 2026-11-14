import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import library from '../../src/core/sources/library.js';

const entries = [
  { id: 'lib-0001', url: 'https://synth.example.com/', title: 'Tiny Synth', blurb: 'Make sounds with a tiny synth.', tags: ['music', 'toy'], kind: 'toy', added: '2026-11-01' },
  { id: 'lib-0002', url: 'https://garden.example.com/', title: 'Pixel Garden', blurb: 'Grow a pixel garden.', tags: ['art', 'toy'], kind: 'game', added: '2026-11-01' },
  { id: 'lib-0003', url: 'https://moth.example.com/', title: 'Moth Atlas', blurb: 'Pictures of moths.', tags: ['nature'], kind: 'site', added: '2026-11-01' },
  { id: 'lib-0004', url: 'https://future.example.com/', title: 'Not Yet', blurb: 'Added later.', tags: ['toy'], kind: 'site', added: '2027-01-01' }];
const data = { library: { v: 1, entries } };
test('library random leaves out future entries and makes no requests', async () => {
  const { ctx, calls } = await adapterCtx({ data }); const out = await library.random(ctx);
  assert.deepEqual(out.map(f => f.id).sort(), ['lib:lib-0001', 'lib:lib-0002', 'lib:lib-0003']);
  assert.equal(calls.length, 0);
  const synth = out.find(f => f.id === 'lib:lib-0001');
  assert.equal(synth.kind, 'site'); assert.equal(synth.meta.libraryKind, 'toy'); assert.deepEqual(synth.why, ['Starter library']);
});
test('library search and more', async () => {
  const { ctx } = await adapterCtx({ data });
  assert.deepEqual((await library.search('tiny synth', ctx)).map(f => f.title), ['Tiny Synth']);
  const [synth] = await library.search('synth', ctx);
  assert.deepEqual((await library.more(synth, ctx)).map(f => f.title), ['Pixel Garden']);
});
test('library maps an entry to a find', async () => {
  const { ctx } = await adapterCtx({ data });
  const out = await library.random(ctx);
  const garden = out.find(f => f.id === 'lib:lib-0002');
  assert.equal(garden.kind, 'game'); assert.equal(garden.source, 'library'); assert.equal(garden.safety, 'curated');
  assert.equal(garden.description, 'Grow a pixel garden.'); assert.deepEqual(garden.tags, ['art', 'toy']);
  assert.equal(garden.meta.published, '2026-11-01');
  assert.equal(out.find(f => f.id === 'lib:lib-0003').kind, 'site');
  const article = await adapterCtx({ data: { library: { entries: [{ ...entries[0], kind: 'article' }] } } });
  assert.equal((await library.random(article.ctx))[0].kind, 'article');
});
test('library random shuffles with ctx.rand and returns every counted entry', async () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ id: `lib-${i}`, url: `https://e${i}.example.com/`, title: `Entry ${i}`, blurb: 'x', tags: [], kind: 'site', added: '2026-01-01' }));
  const a = await adapterCtx({ data: { library: { entries: many } }, seed: 1 });
  const b = await adapterCtx({ data: { library: { entries: many } }, seed: 2 });
  const one = await library.random(a.ctx); const two = await library.random(b.ctx);
  assert.equal(one.length, 80); assert.equal(new Set(one.map(f => f.id)).size, 80);
  assert.notDeepEqual(one.map(f => f.id), two.map(f => f.id));
  assert.notDeepEqual(one.map(f => f.id), many.map(e => 'lib:' + e.id));
});
test('an entry with no added date, or a malformed one, is not counted', async () => {
  const odd = [{ ...entries[0] }, { ...entries[1], added: undefined }, { ...entries[2], added: 'yesterday' }, { ...entries[2], id: 'lib-9', added: 20261101 }];
  const { ctx } = await adapterCtx({ data: { library: { entries: odd } } });
  assert.deepEqual((await library.random(ctx)).map(f => f.id), ['lib:lib-0001']);
  assert.deepEqual(await library.search('garden', ctx), []);
});
test('library entries count once the clock reaches their date', async () => {
  const { ctx } = await adapterCtx({ data, now: Date.UTC(2027, 0, 1, 0, 0, 1) });
  assert.equal((await library.random(ctx)).length, 4);
});
test('search needs every word, whole words only, and never returns everything', async () => {
  const more = [...entries, { id: 'lib-0005', url: 'https://party.example.com/', title: 'Party Time', blurb: 'A party game.', tags: ['party'], kind: 'game', added: '2026-11-01' }];
  const { ctx } = await adapterCtx({ data: { library: { entries: more } } });
  assert.deepEqual(await library.search('a the', ctx), []);
  assert.deepEqual(await library.search('', ctx), []);
  assert.deepEqual((await library.search('art', ctx)).map(f => f.title), ['Pixel Garden']);
  assert.deepEqual((await library.search('toy', ctx)).map(f => f.title), ['Tiny Synth', 'Pixel Garden']);
  assert.deepEqual(await library.search('pixel synth', ctx), []);
  assert.deepEqual((await library.search('MOTH pictures', ctx)).map(f => f.title), ['Moth Atlas']);
});
test('search returns at most 20 entries, in library order', async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `lib-${i}`, url: `https://e${i}.example.com/`, title: `Cat ${i}`, blurb: 'cats', tags: [], kind: 'site', added: '2026-01-01' }));
  const { ctx } = await adapterCtx({ data: { library: { entries: many } } });
  const out = await library.search('cats', ctx);
  assert.deepEqual(out.map(f => f.id), many.slice(0, 20).map(e => 'lib:' + e.id));
});
test('a missing or malformed library gives no finds and never throws', async () => {
  for (const bad of [undefined, null, 'x', {}, { entries: 'nope' }, { entries: null }]) {
    const { ctx } = await adapterCtx({ data: { library: bad } });
    const find = { id: 'x', url: 'https://x.example.com/', title: 'X', tags: ['toy'], description: '' };
    assert.deepEqual(await library.random(ctx), []);
    assert.deepEqual(await library.search('synth', ctx), []);
    assert.deepEqual(await library.more(find, ctx), []);
  }
});
test('entries makeFind rejects or that lack an id are dropped, and callers cannot change the library', async () => {
  const mixed = [{ ...entries[0] }, { ...entries[1], url: 'ftp://nope' }, { ...entries[2], title: ' ' }, { ...entries[2], id: undefined }, null];
  const { ctx } = await adapterCtx({ data: { library: { entries: mixed } } });
  const out = await library.random(ctx);
  assert.deepEqual(out.map(f => f.id), ['lib:lib-0001']);
  out[0].tags.push('changed'); out[0].title = 'Changed';
  assert.deepEqual((await library.random(ctx))[0].tags, ['music', 'toy']);
  assert.equal((await library.random(ctx))[0].title, 'Tiny Synth');
});
test('a reloaded library is picked up', async () => {
  const { ctx } = await adapterCtx({ data: { library: { entries: [entries[0]] } } });
  assert.equal((await library.random(ctx)).length, 1);
  ctx.data.library = { entries: [entries[0], entries[1]] };
  assert.equal((await library.random(ctx)).length, 2);
});
