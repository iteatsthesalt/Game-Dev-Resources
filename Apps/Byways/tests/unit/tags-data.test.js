import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tags = JSON.parse(readFileSync(new URL('../../src/data/tags.json', import.meta.url), 'utf8'));

test('tags.json has 40 unique kebab-case tags in four groups', () => {
  assert.equal(tags.v, 1);
  assert.deepEqual(tags.groups.map(g => g.id), ['tech-science', 'culture-creative', 'life-world', 'games']);
  const ids = tags.groups.flatMap(g => g.tags.map(t => t.id));
  assert.equal(ids.length, 40); assert.equal(new Set(ids).size, 40);
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9-]*$/);
});
