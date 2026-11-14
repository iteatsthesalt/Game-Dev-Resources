import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, domainOf, isHttpUrl, siteOrigin } from '../../src/core/util/url.js';

test('normalizeUrl applies the §14.1 rule', () => {
  assert.equal(normalizeUrl('HTTPS://WWW.Example.COM:443/a/?utm_source=x&b=2&a=1#frag'), 'https://example.com/a?a=1&b=2');
  assert.equal(normalizeUrl('http://example.com:80/'), 'http://example.com/');
  assert.equal(normalizeUrl('https://example.com'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com/path/'), 'https://example.com/path');
  assert.equal(normalizeUrl('https://example.com/?fbclid=1&gclid=2&ref=3&utm_medium=4'), 'https://example.com/');
  assert.equal(normalizeUrl('https://example.com:8080/AbC'), 'https://example.com:8080/AbC');
  assert.equal(normalizeUrl('https://www2.example.com/'), 'https://www2.example.com/');
  assert.equal(normalizeUrl('https://example.com/?b=2&a=1&a=0'), 'https://example.com/?a=1&a=0&b=2');
});

test('normalizeUrl returns null for anything that is not http(s)', () => {
  for (const u of ['ftp://x.org/', 'javascript:alert(1)', 'data:text/html,hi', 'not a url', '', null, undefined, 42])
    assert.equal(normalizeUrl(u), null);
});

test('domainOf, isHttpUrl and siteOrigin', () => {
  assert.equal(domainOf('https://www.Example.com/x'), 'example.com');
  assert.equal(domainOf('nope'), '');
  assert.equal(isHttpUrl('HTTP://a.b/'), true);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
  assert.equal(isHttpUrl('/relative'), false);
  assert.equal(siteOrigin('https://www.example.com/a?b=1'), 'https://www.example.com');
  assert.equal(siteOrigin('mailto:x@y.z'), '');
});
