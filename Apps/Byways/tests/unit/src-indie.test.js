import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterCtx } from './helpers/fixture-http.js';
import { assertSurpriseNotCached } from './helpers/surprise.js';
import marginalia from '../../src/core/sources/marginalia.js';
import github from '../../src/core/sources/github.js';
import hn from '../../src/core/sources/hn.js';

test('marginalia sends the public key, or yours', async () => {
  const a = await adapterCtx(); const [f] = await marginalia.search('synth', a.ctx);
  assert.equal(a.calls[0].headers['api-key'], 'public'); assert.equal(new URL(a.calls[0].url).searchParams.get('query'), 'synth');
  assert.equal(f.title, 'A synth page'); assert.deepEqual(f.why, ['Marginalia search']); assert.deepEqual(f.tags, ['web']);
  const b = await adapterCtx({ secrets: { 'src:marginalia': 'MYKEY' } }); await marginalia.search('synth', b.ctx);
  assert.equal(b.calls[0].headers['api-key'], 'MYKEY');
});
test('marginalia more finds similar sites by domain', async () => {
  const { ctx, calls } = await adapterCtx();
  const [f] = await marginalia.more({ url: 'https://www.example.com/x', kind: 'site' }, ctx);
  assert.equal(new URL(calls[0].url).pathname, '/api/v2/site/example.com/similar');
  assert.equal(f.url, 'https://neighbour.example.org/'); assert.deepEqual(f.why, ['Marginalia: similar to example.com']);
});
test('marginalia busy is a 503 NetError', async () => {
  const { ctx } = await adapterCtx({ extraRoutes: [{ match: /marginalia/, file: 'marginalia/search.json', status: 503 }] });
  await assert.rejects(marginalia.search('x', ctx), { status: 503 });
});
test('github random searches a jam topic and prefers the homepage', async () => {
  const { ctx, calls } = await adapterCtx(); const [a, b] = await github.random(ctx);
  const u = new URL(calls[0].url);
  assert.match(u.searchParams.get('q'), /^topic:(game-jam|js13k|pico-8|html5-game|ludum-dare|godot-game) stars:>20$/);
  assert.equal(u.searchParams.get('per_page'), '100'); assert.ok(+u.searchParams.get('page') <= 10);
  assert.equal(calls[0].headers.accept, 'application/vnd.github+json'); assert.equal(calls[0].headers.authorization, undefined);
  assert.equal(a.url, 'https://ann.github.io/tiny-jam/'); assert.equal(a.kind, 'game'); assert.ok(a.tags.includes('jam'));
  assert.ok(a.why.includes('★ 42')); assert.equal(b.url, 'https://github.com/bob/engine'); assert.equal(b.kind, 'project');
});
test('github sends your token and caches for an hour', async () => {
  const { ctx, calls } = await adapterCtx({ secrets: { 'src:github': 'TOKEN' } });
  await github.search('synth', ctx); await github.search('synth', ctx);
  assert.equal(calls.length, 1); assert.equal(calls[0].headers.authorization, 'Bearer TOKEN');
});
test('hn reads Show HN and keeps text plain', async () => {
  const { ctx, calls } = await adapterCtx(); const [a, b] = await hn.search('game', ctx);
  assert.equal(new URL(calls[0].url).searchParams.get('tags'), 'show_hn');
  assert.equal(a.title, 'I made a tiny game'); assert.equal(a.kind, 'game');
  assert.equal(a.description, '120 points · 30 comments on Hacker News'); assert.deepEqual(a.why, ['Show HN', '120 points']);
  assert.equal(b.url, 'https://news.ycombinator.com/item?id=222'); assert.equal(b.description.includes('<'), false);
});
test('hn random asks for a 30-day window', async () => {
  const { ctx, calls } = await adapterCtx(); await hn.random(ctx);
  const m = new URL(calls[0].url).searchParams.get('numericFilters').match(/^points>20,created_at_i>(\d+),created_at_i<(\d+)$/);
  assert.equal(+m[2] - +m[1], 30 * 86400); assert.ok(+m[2] <= ctx.clock.now() / 1000);
});

// Added in Task 19b: a surprise-shaped 200 reply is never cached (shared adapter rule 12).
test('marginalia does not cache a surprise-shaped search or similar-sites reply', async () => {
  await assertSurpriseNotCached({
    match: /api\/v2\/search/, bad: { error: 'busy' }, empty: { results: [] }, call: ctx => marginalia.search('synth', ctx),
  });
  await assertSurpriseNotCached({
    match: /\/similar$/, bad: { error: 'busy' }, empty: { domain: 'example.com', similar: [] },
    call: ctx => marginalia.more({ url: 'https://www.example.com/x', kind: 'site' }, ctx),
  });
});
test('github does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /api\.github\.com/, bad: { message: 'busy' }, empty: { total_count: 0, items: [] }, call: ctx => github.search('synth', ctx),
}));
test('hn does not cache a surprise-shaped search reply', () => assertSurpriseNotCached({
  match: /hn\.algolia\.com/, bad: { message: 'busy' }, empty: { hits: [] }, call: ctx => hn.search('game', ctx),
}));
