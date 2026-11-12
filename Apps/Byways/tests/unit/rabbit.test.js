import test from 'node:test';
import assert from 'node:assert/strict';
import { createRabbitHole, similarLocal } from '../../src/core/rabbit.js';
import { makeFind } from '../../src/core/model/find.js';

const F = (t, tags = [], d = '', source = 'library') => makeFind({ source, kind: 'site', title: t, description: d, tags, safety: 'curated', url: `https://${t.replace(/\W/g, '').toLowerCase()}.example.com/` });
const ad = (id, outs) => ({ id, more: async () => { const o = outs.shift() ?? []; if (o instanceof Error) throw o; return o; } });
const never = async () => false;
test('similarLocal ranks by shared tags and words', () => {
  const me = F('Pixel Puzzle', ['retro', 'puzzle'], 'A tiny pixel puzzle game.');
  const out = similarLocal(me, [F('Moth Atlas', ['nature'], 'Pictures of moths.'), F('Puzzle Box', ['puzzle'], 'Slide the pixel tiles.'), F('Pixel Puzzle', ['retro'])], 5);
  assert.deepEqual(out.map(x => x.title), ['Puzzle Box']);
  assert.equal(similarLocal(me, [F('A', ['puzzle']), F('B', ['puzzle']), F('C', ['retro'])], 2).length, 2);
});
test('next uses the source first, then Marginalia, then the local pool', async () => {
  const start = F('Start', ['retro']);
  const hole = createRabbitHole({ sources: [ad('library', [[F('A')], [], []]), ad('marginalia', [[F('M', ['retro'], '', 'marginalia')], []])], ctx: {}, seenHas: never, pool: () => [F('Local', ['retro'])] });
  hole.start(start);
  assert.equal((await hole.next()).title, 'A');
  assert.equal((await hole.next()).title, 'M');
  assert.equal((await hole.next()).title, 'Local');
  assert.deepEqual(hole.trail().map(x => x.title), ['Start', 'A', 'M', 'Local']);
});
test('next skips trail and seen finds and survives a failing source', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const start = F('Start');
  const hole = createRabbitHole({ sources: [ad('library', [new Error('down')]), ad('marginalia', [[F('Start'), F('Old'), F('B')]])], ctx: {}, seenHas: async (u) => u.includes('old.') });
  hole.start(start); assert.equal((await hole.next()).title, 'B');
  assert.equal(warn.mock.callCount(), 1);
});
test('a shared link asks Marginalia whatever its kind, and an article from a source does not', async () => {
  const asked = []; const marginalia = { id: 'marginalia', more: async (f) => { asked.push(f.source); return [F('Neighbour', [], '', 'marginalia')]; } };
  const page = (source) => makeFind({ source, kind: 'article', title: 'Page', url: 'https://page.example.com/', safety: 'mostly' });
  const hole = (source) => { const h = createRabbitHole({ sources: [ad('library', []), marginalia], ctx: {}, seenHas: never, pool: () => [] }); h.start(page(source)); return h; };
  assert.equal((await hole('shared').next()).title, 'Neighbour');
  assert.equal(await hole('library').next(), null);
  assert.deepEqual(asked, ['shared']);
});
test('climbOut empties the trail', async () => {
  const hole = createRabbitHole({ sources: [], ctx: {}, seenHas: never });
  hole.start(F('Start')); hole.climbOut();
  assert.deepEqual(hole.trail(), []); assert.equal(await hole.next(), null);
});
test('next leaves out candidates that accept rejects', async () => {
  const hole = createRabbitHole({ sources: [ad('library', [[F('Blocked'), F('Hidden', ['secret']), F('Fine')]])], ctx: {}, seenHas: never,
    accept: (f) => !f.url.includes('blocked.') && !f.tags.includes('secret') });
  hole.start(F('Start')); assert.equal((await hole.next()).title, 'Fine');
});
test('the AI hook comes after the sources and the pool, and only while it is set', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const hole = createRabbitHole({ sources: [ad('library', [])], ctx: {}, seenHas: never, pool: () => [] });
  hole.start(F('Start')); assert.equal(await hole.next(), null);
  const asked = []; hole.useAi(async (f) => { asked.push(f.title); return [F('Start'), F('AI pick')]; });
  assert.equal(await hole.next({ ai: false }), null); assert.deepEqual(asked, []);
  assert.equal((await hole.next()).title, 'AI pick'); assert.deepEqual(asked, ['Start']);
  hole.useAi(async () => { throw new Error('down'); }); assert.equal(await hole.next(), null);
  assert.equal(warn.mock.callCount(), 1);
  hole.useAi(null); assert.equal(await hole.next(), null); assert.equal(asked.length, 1);
  assert.equal(warn.mock.callCount(), 1);
});

/** A source whose `more` waits until `release(found)` is called, so a test can act while a pick is in flight. */
const gated = (id) => {
  let release;
  const source = { id, more: () => new Promise((resolve) => { release = resolve; }) };
  return { source, release: (found) => release(found) };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('climbOut during a pending more() leaves the trail empty and next resolves null', async () => {
  const gate = gated('library');
  const hole = createRabbitHole({ sources: [gate.source], ctx: {}, seenHas: never });
  hole.start(F('Start'));
  const pending = hole.next();
  await tick();
  hole.climbOut();
  gate.release([F('Late')]);
  assert.equal(await pending, null);
  assert.deepEqual(hole.trail(), []);
});
test('start(B) during a pending next on A leaves the trail as just B', async () => {
  const gate = gated('library');
  const hole = createRabbitHole({ sources: [gate.source], ctx: {}, seenHas: never });
  hole.start(F('A'));
  const pending = hole.next();
  await tick();
  const b = F('B');
  hole.start(b);
  gate.release([F('Late')]);
  assert.equal(await pending, null);
  assert.deepEqual(hole.trail(), [b]);
});
test('two concurrent next() calls push two different finds in order', async () => {
  const slow = (outs) => ({ id: 'library', more: async () => { await tick(); return outs.shift() ?? []; } });
  const hole = createRabbitHole({ sources: [slow([[F('A'), F('B')], [F('A'), F('B')]])], ctx: {}, seenHas: async () => { await tick(); return false; } });
  hole.start(F('Start'));
  const [first, second] = await Promise.all([hole.next(), hole.next()]);
  assert.equal(first.title, 'A');
  assert.equal(second.title, 'B');
  assert.deepEqual(hole.trail().map((x) => x.title), ['Start', 'A', 'B']);
});
test('an AI hook cleared during an earlier step is still the hook that pick uses, without a warning', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const gate = gated('library');
  const hole = createRabbitHole({ sources: [gate.source], ctx: {}, seenHas: never, pool: () => [] });
  const asked = [];
  hole.useAi(async (f) => { asked.push(f.title); return [F('AI pick')]; });
  hole.start(F('Start'));
  const pending = hole.next();
  await tick();
  hole.useAi(null);
  gate.release([]);
  assert.equal((await pending).title, 'AI pick');
  assert.deepEqual(asked, ['Start']);
  assert.equal(warn.mock.callCount(), 0);
});
test('sources given as a function is resolved again on every next()', async () => {
  let calls = 0;
  let current = [ad('library', [[F('A')]])];
  const hole = createRabbitHole({ sources: () => { calls++; return current; }, ctx: {}, seenHas: never });
  hole.start(F('Start'));
  assert.equal((await hole.next()).title, 'A');
  assert.equal(calls, 1);
  current = [ad('library', [[F('B')]])];
  assert.equal((await hole.next()).title, 'B');
  assert.equal(calls, 2);
});
