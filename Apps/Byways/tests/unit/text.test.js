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

test('renameStyleAttributes renames style in tags only and survives tags that never close', () => {
  assert.equal(renameStyleAttributes('<p style="x" title="a style=b">style=x</p><textarea><b style="q"></textarea>'),
    '<p data-style="x" title="a style=b">style=x</p><textarea><b style="q"></textarea>');
  // Worst cases for backtracking: about 10,000 characters in which no tag ever closes and no style= attribute appears,
  // so both functions must return the text unchanged (without a DOM, toPlainText strips nothing when there is no `>`).
  const unclosed = ['<a'.repeat(5000), '<a "'.repeat(2500), '<a b'.repeat(2500)];
  // Regression tripwire against catastrophic backtracking, not a benchmark: the old cubic pattern took seconds on
  // 3,000 characters, so only a cubic or exponential regex crosses this bound on any machine. Measured once, around the loop.
  const start = performance.now();
  for (const s of unclosed) {
    assert.equal(renameStyleAttributes(s), s);
    assert.equal(toPlainText(s), s);
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 5000, `unclosed-tag inputs took ${elapsed} ms`);
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
