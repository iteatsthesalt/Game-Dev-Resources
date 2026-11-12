import test from 'node:test'; import assert from 'node:assert/strict';
import { SHARE_BASE, encodeShare, decodeShare, buildShareUrl, itemToFind, payloadFromLink } from '../../src/core/share.js';
import { hash64 } from '../../src/core/util/hash.js';

const payload = { v: 1, t: 'c', n: 'Weird toys', i: [['library', 'https://example.com/', 'Tiny Synth'], ['wikipedia', 'https://en.wikipedia.org/wiki/Ada_Lovelace', 'Ada Lovelace'], ['kagi', 'https://example.org/', 'example.org']] };
test('share payloads round-trip', async () => {
  const s = await encodeShare(payload);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeShare(s), payload);
});
test('buildShareUrl uses the Pages base and flags long links', async () => {
  const short = await buildShareUrl(SHARE_BASE, payload);
  assert.ok(short.url.startsWith(SHARE_BASE + '#s=')); assert.equal(short.tooLong, false);
  const i = Array.from({ length: 150 }, (_, n) => ['library', `https://s${n}.example.org/${hash64(String(n))}`, `Find ${hash64('t' + n)}`]);
  assert.equal((await buildShareUrl(SHARE_BASE, { ...payload, i })).tooLong, true);
});
test('decodeShare rejects v2 and garbage', async () => {
  const msg = { message: 'This link is broken or not from Byways.' };
  await assert.rejects(decodeShare(await encodeShare({ ...payload, v: 2 })), msg);
  await assert.rejects(decodeShare((await encodeShare(payload)).slice(0, -6)), msg);
  await assert.rejects(decodeShare('%%%'), msg);
  await assert.rejects(decodeShare(await encodeShare({ ...payload, i: [['library', 3, 'x']] })), msg);
});
test('decodeShare refuses oversized input and payloads that inflate past the cap', async () => {
  const msg = { message: 'This link is broken or not from Byways.' };
  await assert.rejects(decodeShare(await encodeShare({ ...payload, n: 'a'.repeat(1_100_000) })), msg);
  await assert.rejects(decodeShare('A'.repeat(65_537)), msg);
});
test('itemToFind rebuilds a find and drops bad urls', () => {
  assert.equal(itemToFind(['library', 'https://example.com/', 'Tiny Synth']).title, 'Tiny Synth');
  assert.equal(itemToFind(['library', 'javascript:alert(1)', 'x']), null);
});
test('payloadFromLink reads only Byways share links', async () => {
  const { url } = await buildShareUrl(SHARE_BASE, payload);
  assert.equal(payloadFromLink('  ' + url + '\n'), url.split('#s=')[1]);
  assert.equal(payloadFromLink(SHARE_BASE + 'index.html#s=abc'), 'abc');
  for (const bad of ['https://example.com/#s=abc', SHARE_BASE + '#/stumble', SHARE_BASE + '#s=', 'not a link']) assert.equal(payloadFromLink(bad), null);
});
