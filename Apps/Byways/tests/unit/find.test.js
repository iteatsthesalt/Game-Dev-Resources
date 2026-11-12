import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFind } from '../../src/core/model/find.js';
import { hash64 } from '../../src/core/util/hash.js';
const base = { source: 'library', kind: 'site', title: 'Tiny Synth', description: 'Make sounds.', url: 'https://www.Example.com/a/?utm_source=x', safety: 'curated' };

test('makeFind fills defaults and a url id', () => {
  const f = makeFind(base);
  assert.equal(f.id, 'url:' + hash64('https://example.com/a'));
  assert.deepEqual(f.tags, []); assert.deepEqual(f.why, []);
  assert.equal(makeFind({ ...base, id: 'wiki:en:Ada_Lovelace' }).id, 'wiki:en:Ada_Lovelace');
});
test('makeFind returns null for a bad url, title or kind', () => {
  for (const url of ['javascript:alert(1)', 'ftp://x.org/', '']) assert.equal(makeFind({ ...base, url }), null);
  assert.equal(makeFind({ ...base, title: '   ' }), null);
  assert.equal(makeFind({ ...base, kind: 'toy' }), null);
});
test('makeFind applies the length limits and plain text', () => {
  const f = makeFind({ ...base, title: 'x'.repeat(250), description: '<b>Bold</b> ' + 'y'.repeat(500) });
  assert.equal(f.title.length, 200); assert.ok(f.title.endsWith('…'));
  assert.equal(f.description.length, 400); assert.ok(f.description.startsWith('Bold y'));
});
test('makeFind drops non-http image urls', () => {
  assert.equal(makeFind({ ...base, imageUrl: 'data:image/png;base64,AA' }).imageUrl, undefined);
  assert.equal(makeFind({ ...base, imageUrl: 'javascript:x' }).imageUrl, undefined);
  assert.equal(makeFind({ ...base, embedUrl: 'https://evil.example/embed/x' }).embedUrl, undefined);
  assert.equal(makeFind({ ...base, embedUrl: 'https://archive.org/embed/abc' }).embedUrl, 'https://archive.org/embed/abc');
});
test('makeFind treats an unknown safety as mixed', () => {
  assert.equal(makeFind({ ...base, safety: 'whatever' }).safety, 'mixed');
});
