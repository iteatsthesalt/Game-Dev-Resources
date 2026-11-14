import test from 'node:test';
import assert from 'node:assert/strict';
import { list, optionalText, text } from '../../src/core/sources/parse.js';

test('text trims a string and gives an empty string for anything else', () => {
  assert.equal(text('  Moth  '), 'Moth');
  for (const odd of [undefined, null, 3, ['a'], { a: 1 }]) assert.equal(text(odd), '');
});
test('optionalText keeps a non-empty string as given and gives undefined otherwise', () => {
  assert.equal(optionalText(' Moth '), ' Moth ');
  for (const odd of ['', undefined, null, 3, ['a']]) assert.equal(optionalText(odd), undefined);
});
test('list keeps an array and gives [] for anything else', () => {
  const items = [1, 2];
  assert.equal(list(items), items);
  for (const odd of [undefined, null, 'ab', { length: 1 }]) assert.deepEqual(list(odd), []);
});
