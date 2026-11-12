import test from 'node:test';
import assert from 'node:assert/strict';
import { toPlainText, firstSentence, truncate, tokenize, renameStyleAttributes, MAX_HTML_LENGTH } from '../../src/core/util/text.js';

test('toPlainText strips tags and decodes entities without DOMParser', () => {
  assert.equal(toPlainText('<p>Fish &amp; <b>chips</b></p>'), 'Fish & chips');
  assert.equal(toPlainText('&lt;b&gt; &quot;q&quot; &#39;s&#x27; &#8364;&nbsp;x'), '<b> "q" \'s\' € x');
  assert.equal(toPlainText('<script>alert(1)</script><style>p{}</style>ok'), 'ok');
  assert.equal(toPlainText('a<br>b<p>c</p>'), 'a b c');
  assert.equal(toPlainText('un<b>believ</b>able'), 'unbelievable');
  assert.equal(toPlainText('&#x110000; &#0; &#xZZ;'), '� � &#xZZ;');
  assert.equal(toPlainText(null), '');
});

test('renameStyleAttributes renames style in tags only and is linear on tags that never close', () => {
  assert.equal(renameStyleAttributes('<p style="x" title="a style=b">style=x</p><textarea><b style="q"></textarea>'),
    '<p data-style="x" title="a style=b">style=x</p><textarea><b style="q"></textarea>');
  for (const s of ['<a'.repeat(5000), '<a "'.repeat(2500), '<a b'.repeat(2500)]) {
    const start = performance.now(); renameStyleAttributes(s); toPlainText(s);
    assert.ok(performance.now() - start < 200, `${s.slice(0, 4)} took ${performance.now() - start} ms`);
  }
});

test('toPlainText reads at most MAX_HTML_LENGTH characters', () => {
  assert.equal(toPlainText('x'.repeat(MAX_HTML_LENGTH + 500)).length, MAX_HTML_LENGTH);
});

test('firstSentence', () => {
  assert.equal(firstSentence('Hello world. Second one.'), 'Hello world.');
  assert.equal(firstSentence('What? Yes.'), 'What?');
  assert.equal(firstSentence('No stop here'), 'No stop here');
  assert.equal(firstSentence(''), '');
});

test('truncate counts code points and never splits a surrogate pair', () => {
  assert.equal(truncate('hello world again', 12), 'hello world…');
  assert.equal(truncate('abc', 3), 'abc');
  assert.equal(truncate('😀😀😀', 2), '😀…');
  assert.equal([...truncate('x'.repeat(500), 200)].length, 200);
});

test('tokenize keeps lowercase letter words of 3+ and drops stop words', () => {
  assert.deepEqual(tokenize('The Quick brown fox, and the lazy DOG! 1994 an'), ['quick', 'brown', 'fox', 'lazy', 'dog']);
  assert.deepEqual(tokenize('Café crème'), ['café', 'crème']);
});
