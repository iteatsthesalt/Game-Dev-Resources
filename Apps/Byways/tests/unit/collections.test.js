import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, memoryBackend } from '../../src/core/store/db.js';
import { fakeClock } from '../../src/core/util/clock.js';
import { makeFind } from '../../src/core/model/find.js';
import { createCollections } from '../../src/core/collections.js';

const find = makeFind({ source: 'library', kind: 'site', title: 'Tiny Synth', url: 'https://example.com/', safety: 'curated' });
const make = async () => createCollections(await openStore(memoryBackend()), fakeClock(Date.UTC(2026, 10, 11)));
test('Saved exists from the start', async () => {
  const c = await make(); const list = await c.list();
  assert.deepEqual(list.map(x => [x.id, x.name]), [['saved', 'Saved']]);
  assert.equal(await c.getCurrent(), 'saved'); assert.equal(await c.get('nope'), null);
});
test('create, rename, add, has and removeItem', async () => {
  const c = await make(); const id = (await c.create('Games')).id;
  await c.rename(id, 'Old games');
  assert.equal(await c.add(id, find), true); assert.equal(await c.add(id, find), false);
  await c.add('saved', find);
  assert.deepEqual((await c.has(find.id)).sort(), [id, 'saved'].sort());
  await c.removeItem(id, find.id); assert.deepEqual(await c.has(find.id), ['saved']);
  assert.equal((await c.get(id)).name, 'Old games');
});
test('Saved cannot be deleted and the current collection falls back', async () => {
  const c = await make(); const id = (await c.create('Games')).id;
  await assert.rejects(c.remove('saved'), { message: 'Saved cannot be deleted.' });
  await assert.rejects(c.create('  '), { message: 'Give the collection a name.' });
  await c.setCurrent(id); assert.equal(await c.getCurrent(), id);
  await c.remove(id); assert.equal(await c.getCurrent(), 'saved');
});
test('a new id never repeats one that is still in use', async () => {
  const c = await make();
  const a = await c.create('A'); const b = await c.create('B');
  await c.remove(a.id);
  const d = await c.create('D');
  assert.notEqual(d.id, b.id);
  assert.deepEqual((await c.list()).map(x => x.name), ['Saved', 'B', 'D']);
});
test('Saved cannot be renamed and names are trimmed', async () => {
  const c = await make(); const id = (await c.create('  Games  ')).id;
  assert.equal((await c.get(id)).name, 'Games');
  await assert.rejects(c.rename('saved', 'Keepers'), { message: 'Saved cannot be renamed.' });
  await assert.rejects(c.rename(id, '   '), { message: 'Give the collection a name.' });
  await c.rename(id, '  Old games ');
  assert.equal((await c.get(id)).name, 'Old games');
  assert.equal((await c.get('saved')).name, 'Saved');
});
test('unknown ids are ignored and the current marker is not a collection', async () => {
  const c = await make();
  assert.equal(await c.add('nope', find), false);
  await c.rename('nope', 'X'); await c.removeItem('nope', find.id);
  await c.setCurrent('nope');
  assert.equal(await c.getCurrent(), 'saved');
  assert.equal(await c.get('@current'), null);
  assert.deepEqual((await c.list()).map(x => x.id), ['saved']);
});
