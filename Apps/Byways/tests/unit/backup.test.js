import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { fakeClock } from '../../src/core/util/clock.js';
import { makeFind } from '../../src/core/model/find.js';
import { createSeen } from '../../src/core/seen.js';
import { createCollections } from '../../src/core/collections.js';
import { exportBackup, backupFileName, importBackup, toBookmarksHtml, fromBookmarksHtml } from '../../src/core/backup.js';

const clock = fakeClock(Date.UTC(2026, 10, 11, 12));
const A = makeFind({ source: 'library', kind: 'site', title: 'Tiny Synth', url: 'https://a.example.com/', safety: 'curated' });
const B = makeFind({ source: 'library', kind: 'site', title: 'Pixel Garden', url: 'https://b.example.com/', safety: 'curated' });
const mem = (o = {}) => ({ get: async (k) => o[k] ?? null, set: async (k, v) => { o[k] = v; }, delete: async (k) => { delete o[k]; }, list: async () => Object.keys(o) });
const envelope = (over = {}) => ({ format: 'byways-backup', v: 1, collections: [], history: [], seen: [], ...over });
test('exportBackup writes the spec shape and leaves keys out', async () => {
  const store = await openStore(memoryBackend());
  await createSeen(store).add('https://a.example.com/');
  await createCollections(store, clock).add('saved', A);
  const out = await exportBackup(store, { app: 'pwa', clock, secrets: mem({ 'src:europeana': 'k' }) });
  assert.equal(out.format, 'byways-backup'); assert.equal(out.v, 1); assert.equal(out.app, 'pwa');
  assert.equal(out.exportedAt, '2026-11-11T12:00:00.000Z'); assert.equal(out.seen.length, 1);
  assert.equal(out.collections[0].items[0].find.title, 'Tiny Synth'); assert.equal('keys' in out, false);
  const withKeys = await exportBackup(store, { includeKeys: true, app: 'pwa', clock, secrets: mem({ 'src:europeana': 'k' }) });
  assert.deepEqual(withKeys.keys, { 'src:europeana': 'k' });
  assert.equal(backupFileName(clock, true), 'byways-backup-2026-11-11-with-keys.json');
});
test('importBackup merges seen and keeps a copy on a clash', async () => {
  const from = await openStore(memoryBackend());
  await createSeen(from).add('https://a.example.com/'); await createSeen(from).add('https://b.example.com/');
  await createCollections(from, clock).add('saved', B);
  const data = await exportBackup(from, { app: 'android', clock });
  const to = await openStore(memoryBackend());
  await createSeen(to).add('https://a.example.com/'); const cols = createCollections(to, clock); await cols.add('saved', A);
  const counts = await importBackup(to, data, {});
  assert.equal(counts.seen, 1); assert.equal(await createSeen(to).count(), 2);
  assert.equal((await cols.get('saved')).items.length, 1);
  assert.equal((await cols.get('saved-copy')).name, 'Saved (imported)');
});
test('importBackup rejects a foreign file and writes nothing', async () => {
  const to = await openStore(memoryBackend());
  for (const bad of [{ format: 'other' }, { format: 'byways-backup', v: 2, collections: [], history: [], seen: [['x', 1]] }, null])
    await assert.rejects(importBackup(to, bad, {}), { message: 'This is not a Byways backup file.' });
  assert.equal(await createSeen(to).count(), 0);
});
test('bookmarks HTML round-trips and drops bad links', () => {
  const html = toBookmarksHtml({ name: 'Weird & wonderful', items: [{ find: A }] });
  assert.ok(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')); assert.ok(html.includes('Weird &amp; wonderful'));
  assert.deepEqual(fromBookmarksHtml(html), [{ url: 'https://a.example.com/', title: 'Tiny Synth' }]);
  assert.deepEqual(fromBookmarksHtml('<DT><A HREF="javascript:x">x</A><DT><A HREF="https://c.example/">&lt;b&gt;C</A>'), [{ url: 'https://c.example/', title: '<b>C' }]);
});

test('a file collection with an @ id is ignored and cannot overwrite @current', async () => {
  const to = await openStore(memoryBackend()); const cols = createCollections(to, clock);
  await cols.setCurrent('saved');
  const counts = await importBackup(to, envelope({ collections: [{ id: '@current', name: 'x', items: [{ find: A, added: 1 }] }] }), {});
  assert.equal(counts.collections, 0); assert.equal(await to.get('collections', '@current'), 'saved');
});
test('a bad seen entry is skipped while good ones import', async () => {
  const to = await openStore(memoryBackend());
  const good = '0123456789abcdef';
  const counts = await importBackup(to, envelope({ seen: [[good, 5], ['nothex', 5], ['0123456789ABCDEF', 5], ['1123456789abcdef', 'soon'], 'bad', null, [good, 9]] }), {});
  assert.equal(counts.seen, 1); assert.deepEqual(await to.keys('seen'), [good]);
  assert.equal((await to.get('seen', good)).t, 5);
});
test('imported taste is clamped, and only applied to an untouched taste', async () => {
  const taste = { v: 1, tags: { synth: 99, bad: 'x', low: -99 }, sources: { library: 1.5 }, hiddenTags: ['a', 7], blockedDomains: 'no', interests: ['m', null], strangeness: 7, reactions: 4.5, extra: 1 };
  const to = await openStore(memoryBackend());
  await importBackup(to, envelope({ taste }), {});
  assert.deepEqual(await to.get('taste', 'taste'), { v: 1, tags: { synth: 3, low: -3 }, sources: { library: 1.5 }, hiddenTags: ['a'], blockedDomains: [], strangeness: 1, interests: ['m'], reactions: 0 });
  const used = { v: 1, tags: { jazz: 2 }, sources: {}, hiddenTags: [], blockedDomains: [], strangeness: 0.25, interests: [], reactions: 3 };
  await to.put('taste', 'taste', used);
  await importBackup(to, envelope({ taste: { ...taste, reactions: 8 } }), {});
  assert.deepEqual(await to.get('taste', 'taste'), used);
});
test('only src: and ai: keys with sane values are written', async () => {
  const o = {}; const secrets = mem(o); const to = await openStore(memoryBackend());
  const keys = { 'src:europeana': 'k', 'ai:openai': 'sk', __lock: 'x', 'other:id': 'y', 'src:empty': '', 'src:num': 5, 'src:long': 'z'.repeat(4097) };
  const counts = await importBackup(to, envelope({ keys }), { secrets });
  assert.equal(counts.keys, 2); assert.deepEqual(o, { 'src:europeana': 'k', 'ai:openai': 'sk' });
  const none = await importBackup(to, envelope({ keys: { 'src:a': 'k' } }), {});
  assert.equal(none.keys, 0);
});
test('history is written only into an empty trail, keeping the last 50 good entries', async () => {
  const to = await openStore(memoryBackend());
  const trail = Array.from({ length: 60 }, (_, i) => ({ find: { ...A, id: 'x' + i }, t: i }));
  trail.push({ find: { ...A, url: 'javascript:x' }, t: 99 }, { find: A, t: 'late' });
  const counts = await importBackup(to, envelope({ history: trail }), {});
  const items = (await to.get('history', 'trail')).items;
  assert.equal(counts.history, 50); assert.equal(items.length, 50); assert.equal(items[49].find.id, 'x59');
  const again = await importBackup(to, envelope({ history: [{ find: B, t: 1 }] }), {});
  assert.equal(again.history, 0); assert.equal((await to.get('history', 'trail')).items.length, 50);
});
test('collections: same content is skipped, bad items are dropped, copies are numbered', async () => {
  const to = await openStore(memoryBackend()); const cols = createCollections(to, clock);
  const file = (items, name = 'Games') => envelope({ collections: [{ id: 'c-1', name, created: 5, items }] });
  const good = [{ find: A, added: 1 }, { find: { ...B, url: 'ftp://b' }, added: 2 }, { find: B, added: 'x' }];
  assert.equal((await importBackup(to, file(good), {})).collections, 1);
  const added = await cols.get('c-1'); assert.deepEqual(added.items.map((i) => [i.find.id, i.added]), [[A.id, 1], [B.id, 0]]);
  assert.equal((await importBackup(to, file([...good].reverse()), {})).collections, 0);
  assert.equal((await importBackup(to, file([{ find: A, added: 1 }]), {})).collections, 1);
  assert.equal((await importBackup(to, file([{ find: A, added: 1 }]), {})).collections, 0);
  assert.equal((await importBackup(to, file([{ find: B, added: 1 }]), {})).collections, 1);
  assert.deepEqual((await cols.list()).map((c) => c.id), ['saved', 'c-1', 'c-1-copy', 'c-1-copy-2']);
  assert.equal((await cols.get('c-1-copy-2')).name, 'Games (imported)');
});
test('a collection without a stored record, such as Saved, is added under its own id', async () => {
  const to = await openStore(memoryBackend());
  const bad = [{ id: 7, name: 'n', items: [] }, { id: 'c-3', name: 'n' }];
  await importBackup(to, envelope({ collections: [{ id: 'saved', name: 'Renamed', items: [{ find: A, added: 1 }] }, { id: 'c-2', name: '   ', items: [] }, ...bad] }), {});
  const list = await createCollections(to, clock).list();
  assert.deepEqual(list.map((c) => [c.id, c.name, c.items.length]), [['saved', 'Saved', 1], ['c-2', 'c-2', 0]]);
});
test('importBackup never applies the settings in the file', async () => {
  const to = await openStore(memoryBackend());
  await importBackup(to, envelope({ settings: { theme: 'dark' } }), {});
  assert.deepEqual(await to.keys('settings'), []);
});
test('bookmarks HTML escapes names, titles and links, and reads quoting and case', () => {
  const find = { title: 'T & <u>', url: 'https://x.example/?a=1&b="2"' };
  const html = toBookmarksHtml({ name: 'A "b" <c>', items: [{ find }] });
  assert.ok(html.includes('<DT><H3>A &quot;b&quot; &lt;c&gt;</H3>'));
  assert.ok(html.includes('HREF="https://x.example/?a=1&amp;b=&quot;2&quot;"'));
  assert.deepEqual(fromBookmarksHtml(html), [{ url: 'https://x.example/?a=1&b="2"', title: 'T & <u>' }]);
  const loose = `<dt><a add_date="1" href='https://s.example/'>Single</a><a data-href="https://no.example/">no</a><A HREF=ftp://f.example/>ftp</A>`;
  assert.deepEqual(fromBookmarksHtml(loose), [{ url: 'https://s.example/', title: 'Single' }]);
});
test('an oversized file is imported within the caps', async () => {
  const to = await openStore(memoryBackend());
  const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const long = 'x'.repeat(201);
  const collections = many(250, (i) => ({ id: `c-${i}`, name: `${i}-${'n'.repeat(500)}`, items: [] }));
  const weights = Object.fromEntries([...many(600, (i) => [`t${i}`, 1]), [long, 1]]);
  const taste = {
    tags: weights, sources: weights,
    hiddenTags: [...many(600, (i) => `h${i}`), long], blockedDomains: [...many(600, (i) => `d${i}.example`), long], interests: [...many(600, (i) => `i${i}`), long],
  };
  const counts = await importBackup(to, envelope({ collections, taste }), {});
  assert.equal(counts.collections, 200);
  const list = (await createCollections(to, clock).list()).filter((c) => c.id !== 'saved');
  assert.equal(list.length, 200); assert.ok(list.every((c) => c.name.length === 80));
  const kept = await to.get('taste', 'taste');
  for (const key of ['hiddenTags', 'blockedDomains', 'interests']) assert.equal(kept[key].length, 500);
  for (const key of ['tags', 'sources']) { assert.equal(Object.keys(kept[key]).length, 500); assert.ok(!(long in kept[key])); }
  assert.ok(!kept.hiddenTags.includes(long));
});
test('a bad anchor is skipped without losing the links after it', () => {
  const good = (n) => `<DT><A HREF="https://${n}.example/">${n}</A>`;
  const unfinished = `${good('one')}<A HREF="https://bad.example/"\n<A HREF="https://two.example/">two</A>`;
  assert.deepEqual(fromBookmarksHtml(unfinished).map((l) => l.url), ['https://one.example/', 'https://two.example/']);
  const unclosed = `${good('one')}<DT><A HREF="https://open.example/">Open ${good('two')}`;
  assert.deepEqual(fromBookmarksHtml(unclosed), [
    { url: 'https://one.example/', title: 'one' }, { url: 'https://open.example/', title: 'Open' }, { url: 'https://two.example/', title: 'two' },
  ]);
  const started = Date.now();
  for (const unit of ["<a x='", '<a ', '<a href="https://h.example/">t ']) fromBookmarksHtml(unit.repeat(150000));
  assert.ok(Date.now() - started < 3000);
});
test('the link address is decoded as an attribute and not read as text', () => {
  const link = (href) => fromBookmarksHtml(`<A HREF="${href}">x</A>`);
  assert.deepEqual(link('https://e.example/?a=1&amp;b=2'), [{ url: 'https://e.example/?a=1&b=2', title: 'x' }]);
  assert.equal(link('https://e.example/?q=&#x41;&#66;&quot;&lt;&gt;&#39;')[0].url, `https://e.example/?q=AB"<>'`);
  assert.equal(link('https://e.example/a  b <i>c')[0].url, 'https://e.example/a  b <i>c');
  assert.deepEqual(link('&#106;avascript:alert(1)'), []);
});
