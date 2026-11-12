// shared/lan.js: which peers count as the local network, which address goes in the QR code,
// the session token, and the Host and Origin checks that keep other web pages out.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  isPrivateAddress, pickLanAddresses, newToken, tokensEqual, controllerUrl, isLocalHostHeader, isSameOrigin,
} from '../../src/shared/lan.js';

describe('isPrivateAddress', () => {
  test('the private IPv4 ranges, at both ends of each', () => {
    for (const ip of [
      '10.0.0.0', '10.255.255.255', '172.16.0.0', '172.31.255.255', '192.168.0.0', '192.168.255.255',
      '169.254.0.1', '169.254.255.254', '100.64.0.0', '100.127.255.255', '127.0.0.1', '127.255.255.254',
    ]) assert.equal(isPrivateAddress(ip), true, ip);
  });
  test('just outside each range is public', () => {
    for (const ip of [
      '9.255.255.255', '11.0.0.0', '172.15.255.255', '172.32.0.0', '192.167.255.255', '192.169.0.0',
      '169.253.255.255', '169.255.0.0', '100.63.255.255', '100.128.0.0', '128.0.0.1', '126.255.255.255',
      '8.8.8.8', '1.1.1.1', '0.0.0.0', '255.255.255.255', '224.0.0.1',
    ]) assert.equal(isPrivateAddress(ip), false, ip);
  });
  test('IPv6 loopback, unique local (fc00::/7) and link-local (fe80::/10)', () => {
    for (const ip of ['::1', '0:0:0:0:0:0:0:1', 'fc00::1', 'fd12:3456:789a::1', 'FDFF::', 'fe80::1', 'fe80::1%eth0', 'febf:ffff::1']) {
      assert.equal(isPrivateAddress(ip), true, ip);
    }
    for (const ip of ['::', '::2', 'fbff::1', 'fec0::1', '2001:db8::1', '2a00:1450::1', 'ff02::1', '64:ff9b::808:808']) {
      assert.equal(isPrivateAddress(ip), false, ip);
    }
  });
  test('IPv4-mapped IPv6 is judged by the IPv4 inside, in either spelling', () => {
    assert.equal(isPrivateAddress('::ffff:192.168.1.5'), true);
    assert.equal(isPrivateAddress('::FFFF:10.1.2.3'), true);
    assert.equal(isPrivateAddress('::ffff:c0a8:0105'), true); // 192.168.1.5 in hex
    assert.equal(isPrivateAddress('0:0:0:0:0:ffff:127.0.0.1'), true);
    assert.equal(isPrivateAddress('::ffff:8.8.8.8'), false);
    assert.equal(isPrivateAddress('::ffff:0808:0808'), false);
    // the old "IPv4-compatible" form is not a mapping, so it is not unwrapped
    assert.equal(isPrivateAddress('::192.168.1.5'), false);
  });
  test('anything that is not an address is false', () => {
    for (const ip of [
      undefined, null, 42, '', 'localhost', '192.168.1', '192.168.1.5.6', '192.168.001.5', '010.0.0.1', '192.168.1.256',
      '192.168.1.-1', ' 192.168.1.5', '192.168.1.5 ', 'fe80::1::2', 'fe80:::1', ':1', '1:', 'fe80::zz', 'fe80::12345',
      '1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7', '::ffff:192.168.1', '::ffff:1.2.3.4:5', '::1.2.3.4.5', 'x'.repeat(100),
    ]) assert.equal(isPrivateAddress(ip), false, String(ip));
  });
});

describe('pickLanAddresses', () => {
  const ifaces = {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }, { address: '::1', family: 'IPv6', internal: true }],
    docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }],
    tailscale0: [{ address: '100.101.102.103', family: 'IPv4', internal: false }],
    wlan0: [
      { address: 'fe80::1234', family: 'IPv6', internal: false },
      { address: 'fd00::42', family: 'IPv6', internal: false },
      { address: '192.168.1.23', family: 'IPv4', internal: false },
    ],
    eth1: [{ address: '169.254.10.20', family: 4, internal: false }],
    wan: [{ address: '203.0.113.9', family: 'IPv4', internal: false }],
    'vEthernet (WSL)': [{ address: '172.28.0.1', family: 'IPv4', internal: false }],
    'Ethernet 2': [{ address: '10.0.0.7', family: 'IPv4', internal: false }],
  };
  test('real adapters\' IPv4 first, in system order; then VPN, IPv6, link-local; virtual adapters last', () => {
    assert.deepEqual(pickLanAddresses(ifaces), [
      { address: '192.168.1.23', family: 'IPv4', name: 'wlan0' },
      { address: '10.0.0.7', family: 'IPv4', name: 'Ethernet 2' },
      { address: 'fd00::42', family: 'IPv6', name: 'wlan0' },
      { address: '169.254.10.20', family: 'IPv4', name: 'eth1' },
      { address: '172.17.0.1', family: 'IPv4', name: 'docker0' },
      { address: '172.28.0.1', family: 'IPv4', name: 'vEthernet (WSL)' },
      { address: '100.101.102.103', family: 'IPv4', name: 'tailscale0' },
    ]);
  });
  test('internal, public and IPv6 link-local addresses are left out', () => {
    const found = pickLanAddresses(ifaces).map((a) => a.address);
    for (const gone of ['127.0.0.1', '::1', 'fe80::1234', '203.0.113.9']) assert.equal(found.includes(gone), false, gone);
  });
  test('a virtual adapter is still offered when it is all there is', () => {
    assert.deepEqual(pickLanAddresses({ docker0: ifaces.docker0 }), [{ address: '172.17.0.1', family: 'IPv4', name: 'docker0' }]);
  });
  test('nothing usable gives an empty list, and odd input does not throw', () => {
    assert.deepEqual(pickLanAddresses({}), []);
    assert.deepEqual(pickLanAddresses(null), []);
    assert.deepEqual(pickLanAddresses({ a: null, b: [null, { family: 'IPv4' }, { address: 5 }] }), []);
  });
});

describe('newToken', () => {
  test('16 random bytes become 22 base64url characters', () => {
    const token = newToken((n) => crypto.randomBytes(n));
    assert.match(token, /^[A-Za-z0-9_-]{22}$/);
  });
  test('the encoding is base64url without padding, bit for bit', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i * 17);
    const expected = Buffer.from(bytes).toString('base64url');
    assert.equal(newToken((n) => bytes.subarray(0, n)), expected);
    assert.equal(newToken(() => new Uint8Array(16).fill(255)), Buffer.alloc(16, 255).toString('base64url'));
    assert.equal(newToken(() => new Uint8Array(16)), 'A'.repeat(22));
  });
  test('asks for 16 bytes and refuses fewer', () => {
    let asked = 0;
    newToken((n) => { asked = n; return new Uint8Array(n); });
    assert.equal(asked, 16);
    assert.throws(() => newToken(() => new Uint8Array(15)), /fewer than 16/);
  });
  test('tokens do not repeat', () => {
    const seen = new Set(Array.from({ length: 500 }, () => newToken((n) => crypto.randomBytes(n))));
    assert.equal(seen.size, 500);
  });
});

describe('tokensEqual', () => {
  test('equal strings only', () => {
    assert.equal(tokensEqual('abc', 'abc'), true);
    assert.equal(tokensEqual('', ''), true);
    assert.equal(tokensEqual('abc', 'abd'), false);
    assert.equal(tokensEqual('abc', 'ab'), false);
    assert.equal(tokensEqual('ab', 'abc'), false);
    assert.equal(tokensEqual('abc', 'ABC'), false);
    assert.equal(tokensEqual('a\u0000', 'a'), false);
  });
  test('anything that is not a string is never equal', () => {
    assert.equal(tokensEqual(undefined, undefined), false);
    assert.equal(tokensEqual(null, 'x'), false);
    assert.equal(tokensEqual(123, '123'), false);
    assert.equal(tokensEqual(['abc'], 'abc'), false);
  });
  test('every position is compared, wherever the first difference is', () => {
    // A guess wrong in its first character and one wrong in its last make the comparison read
    // the same number of characters. One that stopped at the first difference would read 2
    // characters for the first guess and 44 for the second. Timing cannot be measured
    // reliably in a unit test; the work done can.
    const token = 'abcdefghijklmnopqrstuv';
    const original = String.prototype.charCodeAt;
    const reads = [];
    try {
      for (const guess of [`X${token.slice(1)}`, `${token.slice(0, 21)}X`, token]) {
        let n = 0;
        // eslint-disable-next-line no-extend-native
        String.prototype.charCodeAt = function counted(i) { n++; return original.call(this, i); };
        const same = tokensEqual(guess, token);
        String.prototype.charCodeAt = original;
        reads.push(n);
        assert.equal(same, guess === token);
      }
    } finally {
      String.prototype.charCodeAt = original;
    }
    assert.deepEqual(reads, [44, 44, 44]);
  });
});

describe('controllerUrl', () => {
  test('IPv4, with the token in the fragment', () => {
    assert.equal(controllerUrl({ address: '192.168.1.5', port: 47615, token: 'TOKEN_-x' }), 'http://192.168.1.5:47615/#k=TOKEN_-x');
  });
  test('IPv6 in brackets, a zone id escaped', () => {
    assert.equal(controllerUrl({ address: 'fd00::42', port: 47616, token: 'abc' }), 'http://[fd00::42]:47616/#k=abc');
    assert.equal(controllerUrl({ address: 'fe80::1%eth0', port: 1, token: 'abc' }), 'http://[fe80::1%25eth0]:1/#k=abc');
  });
  test('refuses what would make a broken or unsafe link', () => {
    assert.throws(() => controllerUrl({ address: '', port: 1, token: 'a' }), TypeError);
    for (const port of [0, 65536, 1.5, '80']) assert.throws(() => controllerUrl({ address: '10.0.0.1', port, token: 'a' }), TypeError);
    for (const token of ['', 'a b', 'a#b', '<x>', 'x'.repeat(65)]) assert.throws(() => controllerUrl({ address: '10.0.0.1', port: 1, token }), TypeError);
  });
});

describe('isLocalHostHeader (DNS rebinding)', () => {
  test('addresses and local names pass, with or without a port', () => {
    for (const host of [
      '192.168.1.5:47615', '192.168.1.5', '8.8.8.8:80', '[fd00::42]:47615', '[::1]', 'localhost:47615', 'LOCALHOST',
      'desktop-4f2a:47615', 'mypc.local:47615', 'mypc.local.', 'mypc.lan', 'tv.home', 'pc.home.arpa', 'box.internal',
      'pc.localdomain', 'app.localhost',
    ]) assert.equal(isLocalHostHeader(host), true, host);
  });
  test('public names and malformed hosts are refused', () => {
    for (const host of [
      undefined, '', 'evil.example', 'evil.example:47615', 'tactilume.app', 'a.b.c.com', 'local.example.com',
      'mypc.local.evil.com', '[fd00::42', '[nope]:80', '[::1]:x', '192.168.1.5:', '192.168.1.5:abc', 'bad_name',
      'white space', '-dash', 'x'.repeat(300), 'a..local',
    ]) assert.equal(isLocalHostHeader(host), false, String(host));
  });
});

describe('isSameOrigin (cross-site WebSocket)', () => {
  test('only this server\'s own http origin', () => {
    assert.equal(isSameOrigin('http://192.168.1.5:47615', '192.168.1.5:47615'), true);
    assert.equal(isSameOrigin('HTTP://MyPC.local:47615', 'mypc.local:47615'), true);
    assert.equal(isSameOrigin('http://[fd00::42]:47615', '[fd00::42]:47615'), true);
  });
  test('another site, port, scheme, or a missing or "null" origin is refused', () => {
    assert.equal(isSameOrigin('http://evil.example', '192.168.1.5:47615'), false);
    assert.equal(isSameOrigin('http://192.168.1.5:8080', '192.168.1.5:47615'), false);
    assert.equal(isSameOrigin('https://192.168.1.5:47615', '192.168.1.5:47615'), false);
    assert.equal(isSameOrigin('null', '192.168.1.5:47615'), false);
    assert.equal(isSameOrigin(undefined, '192.168.1.5:47615'), false);
    assert.equal(isSameOrigin('http://192.168.1.5:47615', undefined), false);
    assert.equal(isSameOrigin('http://192.168.1.5:47615/', '192.168.1.5:47615'), false);
  });
});
