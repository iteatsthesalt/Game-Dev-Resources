import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { adapterCtx } from './helpers/fixture-http.js';
import { assertSurpriseNotCached } from './helpers/surprise.js';
import kagi, { KAGI_LISTS, loadKagiList, parseKagiList } from '../../src/core/sources/kagi.js';
import kagirandom from '../../src/core/sources/kagirandom.js';
import wiby, { WIBY_LEAP_URL } from '../../src/core/sources/wiby.js';

const read = (name) => fs.readFileSync(new URL('../fixtures/http/' + name, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));

test('parseKagiList drops junk lines and opens the site origin', () => {
  assert.deepEqual(parseKagiList(read('kagi/smallweb.txt'), 'smallweb'), [
    { url: 'http://0x80.example/', title: '0x80.example' },
    { url: 'https://blog.example.net/', title: 'blog.example.net' },
    { url: 'https://www.blog.example.org/', title: 'blog.example.org' }]);
  assert.deepEqual(parseKagiList(read('kagi/smallyt.txt'), 'smallyt'), [
    { url: 'https://www.youtube.com/channel/UCabc', title: 'Tom S' }, { url: 'https://www.youtube.com/channel/UCxyz', title: 'UCxyz' }]);
});
test('the Kagi lists refresh weekly and survive a failed refresh', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const extra = []; const { ctx, calls } = await adapterCtx({ extraRoutes: extra });
  await loadKagiList(ctx, 'smallweb'); await loadKagiList(ctx, 'smallweb'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, KAGI_LISTS.smallweb);
  extra.push({ match: /smallweb\.txt/, error: true }); ctx.clock.advance(7 * 864e5 + 1);
  assert.equal((await loadKagiList(ctx, 'smallweb')).length, 3); await tick(); assert.equal(calls.length, 2);
  assert.equal((await loadKagiList(ctx, 'smallweb')).length, 3);
});
test('kagi random gives domain-only cards, and none before a list is loaded', async () => {
  const { ctx } = await adapterCtx(); assert.deepEqual(await kagi.random(ctx), []);
  for (const name of Object.keys(KAGI_LISTS)) await loadKagiList(ctx, name);
  const out = await kagi.random(ctx);
  assert.ok(out.length >= 1 && out.length <= 5);
  for (const f of out) { assert.equal(f.imageUrl, undefined); assert.equal(f.attribution, 'Kagi Small Web list (MIT)'); assert.deepEqual(f.why, ['Kagi Small Web']); }
});
test('kagirandom keeps known categories as tags', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await kagirandom.random(ctx);
  assert.equal(calls[0].url, 'https://kagi.com/smallweb/api/random');
  assert.equal(f.title, 'A small post'); assert.equal(f.author, 'Sam'); assert.deepEqual(f.tags, ['programming', 'retro']);
});
test('wiby searches JSON and leaps by navigation only', async () => {
  const { ctx, calls } = await adapterCtx(); const [f] = await wiby.search('games', ctx);
  assert.equal(calls[0].url, 'https://wiby.me/json/?q=games');
  assert.equal(f.title, 'My old site'); assert.equal(f.description, 'Hand coded since 1999.'); assert.deepEqual(f.tags, ['oldweb', 'web']);
  assert.deepEqual(await wiby.random(ctx), []); assert.equal(WIBY_LEAP_URL, 'https://wiby.me/surprise/');
});

test('kagi search and more make no request', async () => {
  const { ctx, calls } = await adapterCtx();
  assert.deepEqual(await kagi.search('x', ctx), []); assert.deepEqual(await kagi.more({ url: 'https://a.example/' }, ctx), []);
  assert.equal(calls.length, 0);
});
test('kagi random tags each list and asks for a download when none is cached', async () => {
  const { ctx, calls } = await adapterCtx();
  const draw = (value) => { ctx.rand = () => value; return kagi.random(ctx); };
  assert.deepEqual(await draw(0.1), []); await tick(); assert.equal(calls.length, 1);
  const [web] = await draw(0.1);
  assert.equal(web.kind, 'site'); assert.deepEqual(web.tags, ['web', 'essays']); assert.equal(web.source, 'kagi');
  assert.equal(web.description, 'A small personal site from the Kagi Small Web list.');
  await loadKagiList(ctx, 'smallyt'); await loadKagiList(ctx, 'smallcomic');
  const [video] = await draw(0.85);
  assert.equal(video.kind, 'video'); assert.deepEqual(video.tags, ['film']);
  assert.equal(video.description, 'A small YouTube channel from the Kagi Small Web list.');
  const [comic] = await draw(0.95);
  assert.equal(comic.kind, 'site'); assert.deepEqual(comic.tags, ['comics']); assert.equal(comic.url, 'http://comic.example.com/');
  assert.equal(comic.description, 'An independent web comic from the Kagi Small Web list.');
});
test('kagi random never repeats an entry in one pick', async () => {
  const { ctx } = await adapterCtx(); await loadKagiList(ctx, 'smallweb'); ctx.rand = ((values) => () => values.shift() ?? 0)([0.1, 0.99, 0.99, 0.99]);
  const out = await kagi.random(ctx);
  assert.deepEqual(out.map((f) => f.url).sort(), ['http://0x80.example/', 'https://blog.example.net/', 'https://www.blog.example.org/']);
});
test('two loads of one list share a single download', async () => {
  const { ctx, calls } = await adapterCtx();
  const [a, b] = await Promise.all([loadKagiList(ctx, 'smallweb'), loadKagiList(ctx, 'smallweb')]);
  assert.equal(calls.length, 1); assert.equal(a.length, 3); assert.deepEqual(a, b);
  ctx.rand = () => 0.1; await Promise.all([kagi.random(ctx), kagi.random(ctx)]); assert.equal(calls.length, 1);
});
test('a failed background download is not retried within the hour', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const { ctx, calls } = await adapterCtx({ extraRoutes: [{ match: /smallweb\.txt/, error: true }] });
  ctx.rand = () => 0.1;
  assert.deepEqual(await kagi.random(ctx), []); await tick(); assert.equal(calls.length, 1); assert.equal(warn.mock.callCount(), 1);
  assert.deepEqual(await kagi.random(ctx), []); await tick(); assert.equal(calls.length, 1);
  ctx.clock.advance(3600e3 + 1);
  assert.deepEqual(await kagi.random(ctx), []); await tick(); assert.equal(calls.length, 2); assert.equal(warn.mock.callCount(), 2);
});
test('a refresh that succeeds replaces the stored list', async () => {
  const extra = []; const { ctx, calls } = await adapterCtx({ extraRoutes: extra });
  await loadKagiList(ctx, 'smallweb');
  extra.push({ match: /smallweb\.txt/, body: 'https://new.example.com/feed\n' }); ctx.clock.advance(7 * 864e5 + 1);
  assert.equal((await loadKagiList(ctx, 'smallweb')).length, 3); await tick(); assert.equal(calls.length, 2);
  assert.deepEqual(await loadKagiList(ctx, 'smallweb'), [{ url: 'https://new.example.com/', title: 'new.example.com' }]);
});
test('a download that parses to no entries stores nothing', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /smallweb\.txt/, body: '# nothing here\n[DEBUG] x\n' }] });
  assert.deepEqual(await loadKagiList(ctx, 'smallweb'), []);
  assert.equal(await ctx.cache.get('kagi:list:smallweb'), undefined);
});
test('parseKagiList reads smallyt edge forms and dedupes', () => {
  const text = [
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCone # Name With Spaces https://www.youtube.com/channel/UCone',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCone',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCtwo # no url here',
    'https://www.youtube.com/feeds/videos.xml?channel_id=bad%20id',
    'https://www.youtube.com/feeds/videos.xml',
  ].join('\n');
  assert.deepEqual(parseKagiList(text, 'smallyt'), [
    { url: 'https://www.youtube.com/channel/UCone', title: 'Name With Spaces' },
    { url: 'https://www.youtube.com/channel/UCtwo', title: 'UCtwo' }]);
  assert.deepEqual(parseKagiList('https://a.example/x\r\n# c\r\nhttps://a.example/y\r\n', 'smallcomic'), [{ url: 'https://a.example/', title: 'a.example' }]);
});

test('kagirandom falls back to default tags and skips replies without a web address', async () => {
  const bare = { match: /kagi\.com\/smallweb/, json: { url: 'https://x.example/p', title: 'Plain', categories: ['unknowncat'] } };
  const a = await adapterCtx({ extraRoutes: [bare] });
  assert.deepEqual((await kagirandom.random(a.ctx))[0].tags, ['web', 'essays']);
  const b = await adapterCtx({ data: { tags: null }, extraRoutes: [{ match: /kagi\.com\/smallweb/, json: { url: 'https://x.example/p', title: 'Plain', categories: ['retro'] } }] });
  assert.deepEqual((await kagirandom.random(b.ctx))[0].tags, ['web', 'essays']);
  const c = await adapterCtx({ extraRoutes: [{ match: /kagi\.com\/smallweb/, json: { url: 'javascript:alert(1)', title: 'Bad' } }] });
  assert.deepEqual(await kagirandom.random(c.ctx), []);
  assert.deepEqual(await kagirandom.search('x', c.ctx), []); assert.deepEqual(await kagirandom.more({}, c.ctx), []);
});
test('kagirandom is not cached', async () => {
  const { ctx, calls } = await adapterCtx(); await kagirandom.random(ctx); await kagirandom.random(ctx); assert.equal(calls.length, 2);
  assert.equal(kagirandom.probeUrl, 'https://kagi.com/smallweb/api/random');
});
test('wiby skips entries without a web address and caches a search for a day', async () => {
  const { ctx, calls } = await adapterCtx();
  const first = await wiby.search('old web', ctx);
  assert.equal(first.length, 1); assert.equal(calls[0].url, 'https://wiby.me/json/?q=old+web'); assert.deepEqual(first[0].why, ['Wiby search']);
  await wiby.search('old web', ctx); assert.equal(calls.length, 1);
  ctx.clock.advance(24 * 3600e3 + 1); await wiby.search('old web', ctx); assert.equal(calls.length, 2);
});
test('wiby does not cache an unusable reply, and random and more make no request', async () => {
  const { ctx, calls } = await adapterCtx({ extraRoutes: [{ match: /wiby\.me/, json: { error: 'busy' } }] });
  assert.deepEqual(await wiby.search('x', ctx), []); await wiby.search('x', ctx); assert.equal(calls.length, 2);
  assert.deepEqual(await wiby.random(ctx), []); assert.deepEqual(await wiby.more({ url: 'https://a.example/' }, ctx), []);
  assert.equal(calls.length, 2); assert.equal(wiby.probeUrl, 'https://wiby.me/json/?q=games');
});

// Added in Task 19b: wiby uses cachedJson, so a well-formed empty reply is cached like any other source's.
test('wiby does not cache a surprise-shaped reply but caches an empty list', () => assertSurpriseNotCached({
  match: /wiby\.me/, bad: { error: 'busy' }, empty: [], call: ctx => wiby.search('nothing', ctx),
}));
