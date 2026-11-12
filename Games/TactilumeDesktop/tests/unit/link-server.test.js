// main/link-server.js against real sockets: a real HTTP client and a real WebSocket client
// (the ws package) talk to the server on 127.0.0.1. Timeouts are shortened where a test
// waits on one, so the suite stays quick.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createLinkServer, TIMEOUTS, PEER_LIMITS, peerKey } from '../../src/main/link-server.js';
import { haptic, state, LIMITS } from '../../src/shared/protocol.js';

const ID_A = 'sessionAAAAAAAAAAAAAAA';
const ID_B = 'sessionBBBBBBBBBBBBBBB';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const open = new Set(); // every server a test started, stopped at the end even if it failed
let staticDir = '';

before(() => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-link-test-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>pad</title>');
  fs.writeFileSync(path.join(staticDir, 'phone.js'), 'console.log("pad");');
  fs.writeFileSync(path.join(staticDir, 'phone.css'), 'body{margin:0}');
  fs.writeFileSync(path.join(staticDir, 'secret.txt'), 'not for phones');
});
after(async () => {
  await Promise.all([...open].map((s) => s.stop()));
  fs.rmSync(staticDir, { recursive: true, force: true });
});

async function waitFor(fn, what = 'the condition', timeout = 2000) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${what}`);
    await sleep(5);
  }
}

async function start(options = {}) {
  const events = [];
  const logs = [];
  const server = createLinkServer({
    port: 0, host: '127.0.0.1', staticDir, onEvent: (e) => events.push(e), log: (l) => logs.push(l), ...options,
  });
  open.add(server);
  const info = await server.start();
  return { server, events, logs, port: info.port, token: info.token };
}

// A WebSocket client that keeps what it hears. `failed` is the HTTP status when the server
// refused the upgrade.
// localAddress picks the peer: on Linux all of 127/8 is this machine, so 127.0.0.2 is a second
// address on the network as far as the server can tell.
function client(port, { origin, headers, autoPong = true, path: urlPath = '/link', localAddress } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${urlPath}`, { origin, headers, autoPong, localAddress });
  const c = { ws, messages: [], close: null, failed: 0 };
  c.opened = new Promise((resolve) => {
    ws.on('open', () => resolve(true));
    ws.on('error', (e) => {
      const m = /Unexpected server response: (\d+)/.exec(e.message);
      c.failed = m ? Number(m[1]) : -1;
      resolve(false);
    });
  });
  const closed = new Promise((resolve) => ws.on('close', (code, reason) => { c.close = { code, reason: String(reason) }; resolve(c.close); }));
  // A close the server should make: a server that forgot to would otherwise hang the suite.
  c.closing = (timeout = 3000) => Promise.race([
    closed,
    sleep(timeout).then(() => { throw new Error(`the server did not close the connection within ${timeout} ms`); }),
  ]);
  c.closed = closed;
  ws.on('message', (data) => c.messages.push(JSON.parse(String(data))));
  c.send = (msg) => ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  c.next = (t, timeout) => waitFor(() => c.messages.find((m) => m.t === t), `a "${t}" message`, timeout);
  return c;
}

async function join(port, token, { id, name = '', ...opts } = {}) {
  const c = client(port, opts);
  assert.equal(await c.opened, true, `the upgrade failed with ${c.failed}`);
  c.send({ t: 'hello', v: 1, token, name, id, caps: { touches: 10, haptics: true } });
  c.welcome = await c.next('welcome');
  return c;
}

function get(port, urlPath, { method = 'GET', headers = {}, localAddress } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers, localAddress, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

const leaves = (events) => events.filter((e) => e.type === 'leave');
const joins = (events) => events.filter((e) => e.type === 'join');
const touchesOf = (events) => events.filter((e) => e.type === 'touch');

describe('HTTP: the controller page', () => {
  test('serves /, /phone.js and /phone.css with the security headers', async () => {
    const { port } = await start();
    const page = await get(port, '/');
    assert.equal(page.status, 200);
    assert.equal(page.body, '<!doctype html><title>pad</title>');
    assert.equal(page.headers['content-type'], 'text/html; charset=utf-8');
    // the socket may go only to this server: no bare "ws:", which would allow any host
    assert.equal(page.headers['content-security-policy'],
      `default-src 'self'; connect-src 'self' ws://127.0.0.1:${port}; img-src 'self' data:; `
      + "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    assert.doesNotMatch(page.headers['content-security-policy'], /ws:(;|\s|$)/);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.equal(page.headers['x-frame-options'], 'DENY');
    const js = await get(port, '/phone.js?v=2');
    assert.equal(js.status, 200);
    assert.equal(js.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(js.body, 'console.log("pad");');
    const css = await get(port, '/phone.css');
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
    assert.equal(css.headers['content-security-policy'], page.headers['content-security-policy']);
  });

  test('HEAD answers without a body', async () => {
    const { port } = await start();
    const r = await get(port, '/', { method: 'HEAD' });
    assert.equal(r.status, 200);
    assert.equal(r.body, '');
    assert.equal(r.headers['content-length'], String('<!doctype html><title>pad</title>'.length));
  });

  test('everything else is 404, whatever the path tries', async () => {
    const { port } = await start();
    for (const p of ['/index.html', '/secret.txt', '/../secret.txt', '/%2e%2e/secret.txt', '/link', '/phone.js/', '/PHONE.JS', '/favicon.ico']) {
      const r = await get(port, p);
      assert.equal(r.status, 404, p);
      assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await get(port, '/', { method })).status, 404, method);
  });

  test('a peer outside the local network gets 403, for the page and for the link', async () => {
    const seen = [];
    const { port, events } = await start({ isPeerAllowed: (address) => { seen.push(address); return false; } });
    const r = await get(port, '/');
    assert.equal(r.status, 403);
    assert.equal(r.body, 'Forbidden');
    const c = client(port);
    assert.equal(await c.opened, false);
    assert.equal(c.failed, 403);
    assert.ok(seen.length >= 2 && seen.every((a) => a === '127.0.0.1' || a === '::ffff:127.0.0.1'), seen.join());
    assert.equal(events.length, 0);
  });

  test('a public name in the Host header (DNS rebinding) gets 403, for the page and for the link', async () => {
    const { port } = await start();
    assert.equal((await get(port, '/', { headers: { Host: 'evil.example' } })).status, 403);
    assert.equal((await get(port, '/', { headers: { Host: `mypc.local:${port}` } })).status, 200);
    assert.equal((await get(port, '/', { headers: { Host: `192.168.1.5:${port}` } })).status, 200);
    const c = client(port, { headers: { Host: `evil.example:${port}` } });
    assert.equal(await c.opened, false);
    assert.equal(c.failed, 403);
  });

  test('a missing staticDir file is a 404 and a log line, not a crash', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-link-empty-'));
    const { port, logs } = await start({ staticDir: empty });
    assert.equal((await get(port, '/')).status, 404);
    assert.ok(logs.some((l) => /cannot read index\.html/.test(l)), logs.join('\n'));
    fs.rmSync(empty, { recursive: true, force: true });
  });
});

describe('WebSocket: who gets in', () => {
  test('hello with the token gets a welcome and a join event', async () => {
    const { port, token, events } = await start();
    const c = await join(port, token, { name: '  Ana‮ ' });
    assert.equal(c.welcome.v, 1);
    assert.equal(c.welcome.player, 1);
    assert.match(c.welcome.color, /^#[0-9a-f]{6}$/);
    assert.equal(c.welcome.name, 'Ana');
    assert.ok(c.welcome.behaviours.length >= 12 && c.welcome.behaviours.every((b) => b.key && b.name && Object.keys(b).length === 2));
    assert.ok(c.welcome.palettes.length >= 8 && c.welcome.palettes.every((p) => p.key && p.name && Object.keys(p).length === 2));
    await waitFor(() => joins(events).length === 1, 'the join event');
    assert.deepEqual(events[0], { type: 'join', player: 1, name: 'Ana', caps: { touches: 10, haptics: true } });
  });

  test('a wrong token is refused with "token" and closed with 1008; nothing joins', async () => {
    const { port, token, events } = await start();
    const c = client(port);
    await c.opened;
    c.send({ t: 'hello', v: 1, token: `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}` });
    assert.deepEqual(await c.next('reject'), { t: 'reject', why: 'token' });
    assert.equal((await c.closing()).code, 1008);
    assert.equal(events.length, 0);
  });

  test('a page of another version is refused with "version"', async () => {
    const { port, token } = await start();
    const c = client(port);
    await c.opened;
    c.send({ t: 'hello', v: 2, token });
    assert.deepEqual(await c.next('reject'), { t: 'reject', why: 'version' });
    assert.equal((await c.closing()).code, 1008);
  });

  test('anything but hello first is refused with "bad"', async () => {
    const { port, events } = await start();
    for (const first of [{ t: 'touch', s: 0, p: [] }, { t: 'ping', c: 1 }, 'not json', { t: 'hello', v: 1 }]) {
      const c = client(port);
      await c.opened;
      c.send(first);
      assert.deepEqual(await c.next('reject'), { t: 'reject', why: 'bad' }, JSON.stringify(first));
      assert.equal((await c.closing()).code, 1008);
    }
    assert.equal(events.length, 0);
  });

  test('a connection that never says hello is closed after the hello timeout', async () => {
    const { port, events } = await start({ timeouts: { hello: 80 } });
    const c = client(port);
    await c.opened;
    const t0 = Date.now();
    assert.equal((await c.closing()).code, 1008);
    assert.ok(Date.now() - t0 >= 60, 'closed too early');
    assert.equal(events.length, 0);
  });

  test('a page elsewhere (another Origin) is refused; the page served here is let in', async () => {
    const { port, token } = await start();
    const foreign = client(port, { origin: 'http://evil.example' });
    assert.equal(await foreign.opened, false);
    assert.equal(foreign.failed, 403);
    const other = client(port, { origin: `http://127.0.0.1:${port + 1}` });
    assert.equal(await other.opened, false);
    const own = await join(port, token, { origin: `http://127.0.0.1:${port}` });
    assert.equal(own.welcome.player, 1);
  });

  test('only /link upgrades', async () => {
    const { port } = await start();
    const c = client(port, { path: '/ws' });
    assert.equal(await c.opened, false);
    assert.equal(c.failed, 404);
  });

  test('new phones are refused with "closed" while allowNew is off, and let in once it is on', async () => {
    const { server, port, token } = await start({ allowNew: false });
    assert.equal(server.info().allowNew, false);
    const c = client(port);
    await c.opened;
    c.send({ t: 'hello', v: 1, token });
    assert.deepEqual(await c.next('reject'), { t: 'reject', why: 'closed' });
    assert.equal((await c.closing()).code, 1013);
    assert.equal(server.setAllowNew(true).allowNew, true);
    assert.equal((await join(port, token)).welcome.player, 1);
  });

  test('past maxPhones a phone is refused with "full"', async () => {
    const { port, token } = await start({ maxPhones: 2 });
    await join(port, token);
    await join(port, token);
    const c = client(port);
    await c.opened;
    c.send({ t: 'hello', v: 1, token });
    assert.deepEqual(await c.next('reject'), { t: 'reject', why: 'full' });
    assert.equal((await c.closing()).code, 1013);
  });

  test('each phone takes the lowest free player number, and leaving frees it', async () => {
    const { port, token, events, server } = await start();
    const a = await join(port, token);
    const b = await join(port, token);
    const c = await join(port, token);
    assert.deepEqual([a, b, c].map((x) => x.welcome.player), [1, 2, 3]);
    b.ws.close();
    await waitFor(() => leaves(events).length === 1, 'the leave event');
    assert.deepEqual(leaves(events)[0], { type: 'leave', player: 2 });
    assert.deepEqual(server.info().phones.map((p) => p.player), [1, 3]);
    assert.equal((await join(port, token)).welcome.player, 2);
  });

  test('at most 16 connections may wait to say hello; the 17th gets 503', async () => {
    // every client here is 127.0.0.1, so the per-peer share is lifted to reach the total
    const { port, token } = await start({ peerLimits: { pending: 32, sockets: 64 } });
    const waiting = [];
    for (let i = 0; i < 16; i++) {
      const c = client(port);
      assert.equal(await c.opened, true);
      waiting.push(c);
    }
    const extra = client(port);
    assert.equal(await extra.opened, false);
    assert.equal(extra.failed, 503);
    // one says hello: room for another
    waiting[0].send({ t: 'hello', v: 1, token });
    await waiting[0].next('welcome');
    assert.equal(await client(port).opened, true);
  });
});

describe('one peer cannot take the room new phones need', () => {
  const OTHER = '127.0.0.2';
  const rawSocket = (port, localAddress) => new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1', localAddress }, () => resolve(s));
    s.on('error', () => {});
  });
  const closedWithin = (s, ms) => Promise.race([
    new Promise((resolve) => s.once('close', () => resolve(true))),
    sleep(ms).then(() => false),
  ]);

  test('peerKey folds the IPv4-mapped form into plain IPv4', () => {
    assert.equal(peerKey('::ffff:192.168.1.5'), '192.168.1.5');
    assert.equal(peerKey('::FFFF:10.0.0.2'), '10.0.0.2');
    assert.equal(peerKey('192.168.1.5'), '192.168.1.5');
    assert.equal(peerKey('fe80::1'), 'fe80::1');
  });

  test('the defaults leave a phone room and cut silent sockets within seconds', () => {
    assert.ok(PEER_LIMITS.pending >= 2 && PEER_LIMITS.pending <= 3);
    assert.ok(PEER_LIMITS.sockets <= 16);
    assert.ok(PEER_LIMITS.firstByte <= 3000);
  });

  test('a peer holding sockets that never say hello gets 503 past its share; another phone still joins', async () => {
    const { port, token, events } = await start();
    const idle = [];
    for (let i = 0; i < 16; i++) {
      const c = client(port);
      await c.opened;
      idle.push(c);
    }
    assert.equal(idle.filter((c) => c.ws.readyState === WebSocket.OPEN).length, PEER_LIMITS.pending);
    assert.ok(idle.filter((c) => c.failed === 503).length >= 16 - PEER_LIMITS.pending);
    const phone = await join(port, token, { localAddress: OTHER, name: 'B' });
    assert.equal(phone.welcome.player, 1);
    assert.equal(joins(events).length, 1);
  });

  test('once one of its sockets says hello, that peer has room again', async () => {
    const { port, token } = await start();
    const waiting = [];
    for (let i = 0; i < PEER_LIMITS.pending; i++) {
      const c = client(port);
      assert.equal(await c.opened, true);
      waiting.push(c);
    }
    assert.equal(await client(port).opened, false);
    waiting[0].send({ t: 'hello', v: 1, token });
    await waiting[0].next('welcome');
    assert.equal(await client(port).opened, true);
  });

  test('a peer past its TCP share is cut at once; the page still loads for another address', async () => {
    const { port, logs } = await start({ peerLimits: { firstByte: 60000 } });
    const held = [];
    for (let i = 0; i < PEER_LIMITS.sockets; i++) held.push(await rawSocket(port, '127.0.0.3'));
    const extra = await rawSocket(port, '127.0.0.3');
    assert.equal(await closedWithin(extra, 1000), true, 'the extra socket from the same address is cut');
    assert.ok(logs.some((l) => /too many connections from 127\.0\.0\.3/.test(l)), logs.join('\n'));
    assert.equal((await get(port, '/', { localAddress: OTHER })).status, 200);
    // the held ones are not cut just for being many
    assert.equal(held.some((s) => s.destroyed), false);
    for (const s of held) s.destroy();
    // and with them gone, that address may connect again
    await waitFor(() => held.every((s) => s.closed), 'the held sockets to close');
    await sleep(20);
    assert.equal((await get(port, '/', { localAddress: '127.0.0.3' })).status, 200);
  });

  test('a socket that sends nothing is cut after the first-byte time; one that asks in time is served', async () => {
    const { port } = await start({ peerLimits: { firstByte: 150 } });
    const silent = await rawSocket(port);
    const t0 = Date.now();
    assert.equal(await closedWithin(silent, 2000), true, 'the silent socket is cut');
    assert.ok(Date.now() - t0 < 1000);
    // a page load and a link that joins are not cut by it
    assert.equal((await get(port, '/')).status, 200);
    const c = client(port);
    assert.equal(await c.opened, true);
    await sleep(300);
    assert.equal(c.ws.readyState, WebSocket.OPEN, 'the upgraded socket outlives the first-byte time');
  });
});

describe('WebSocket: messages from a phone that has joined', () => {
  test('touch, act and ping become events and replies, with numbers clamped', async () => {
    let clock = 5000;
    const { port, token, events } = await start({ now: () => clock });
    const c = await join(port, token);
    clock = 6000;
    c.send({ t: 'touch', s: 3, ms: 12.5, p: [[0, 0.25, 0.5, 0.75], [1, 2, -1]] });
    c.send({ t: 'act', a: 'palette', v: -5 });
    c.send({ t: 'ping', c: 42 });
    assert.deepEqual(await c.next('pong'), { t: 'pong', c: 42, s: 6000 });
    await waitFor(() => events.length >= 3, 'the events');
    assert.deepEqual(events.slice(1), [
      { type: 'touch', player: 1, seq: 3, touches: [[0, 0.25, 0.5, 0.75], [1, 1, 0, 0.5]], at: 6000, ms: 12.5 },
      { type: 'act', player: 1, a: 'palette', v: -1 },
    ]);
  });

  test('a message it should not send is ignored, and the phone keeps playing', async () => {
    const { port, token, events, logs } = await start();
    const c = await join(port, token);
    for (const odd of ['garbage', { t: 'motion', x: 1 }, { t: 'touch', s: -1, p: [] }, { t: 'act', a: 'explode' }, { t: 'hello', v: 1, token }]) c.send(odd);
    c.send({ t: 'ping', c: 7 });
    assert.equal((await c.next('pong')).c, 7);
    assert.deepEqual(events.map((e) => e.type), ['join']);
    assert.equal(logs.filter((l) => /ignored/.test(l)).length, 1, 'one log line, not one per message');
  });

  test('more than 240 messages a second, past a two-second allowance, closes with 1008', async () => {
    const { port, token, events } = await start();
    const c = await join(port, token);
    for (let i = 0; i < 1000; i++) c.send({ t: 'ping', c: i });
    const { code, reason } = await c.closing();
    assert.equal(code, 1008);
    assert.equal(reason, 'rate');
    const pongs = c.messages.filter((m) => m.t === 'pong').length;
    assert.ok(pongs >= LIMITS.maxRate * 2 - 5 && pongs < 600, `${pongs} pings were answered`);
    await waitFor(() => leaves(events).length === 1, 'the leave event');
  });

  test('a steady 120 frames a second is fine', async () => {
    const { port, token, events } = await start();
    const c = await join(port, token);
    for (let i = 0; i < 60; i++) {
      c.send({ t: 'touch', s: i, p: [[0, i / 60, 0.5]] });
      await sleep(1000 / 120);
    }
    await waitFor(() => touchesOf(events).length === 60, 'sixty touch events');
    assert.equal(c.close, null);
  });

  test('a message over 4 KB closes with 1009', async () => {
    const { port, token } = await start();
    const c = await join(port, token);
    c.send(JSON.stringify({ t: 'ping', c: 1, pad: 'x'.repeat(5000) }));
    assert.equal((await c.closing()).code, 1009);
  });

  test('a binary message closes with 1003', async () => {
    const { port, token } = await start();
    const c = await join(port, token);
    c.ws.send(Buffer.from('{"t":"ping","c":1}'));
    assert.equal((await c.closing()).code, 1003);
  });

  test('a listener that throws does not break the link', async () => {
    const { server, port, token } = await start({ onEvent: () => { throw new Error('renderer gone'); } });
    const c = await join(port, token);
    c.send({ t: 'ping', c: 1 });
    assert.equal((await c.next('pong')).c, 1);
    assert.equal(server.info().phones.length, 1);
  });
});

describe('WebSocket: silence and stuck fingers', () => {
  const quick = { quiet: 60, drop: 180, beat: 15 };

  test('a phone that answers no ping is dropped after the drop time, and leaves', async () => {
    const { port, token, events } = await start({ timeouts: quick });
    const c = await join(port, token, { autoPong: false });
    const t0 = Date.now();
    await c.closing();
    assert.ok(Date.now() - t0 >= quick.drop - 30, `dropped after ${Date.now() - t0} ms`);
    await waitFor(() => leaves(events).length === 1, 'the leave event');
  });

  test('a quiet phone that answers pings stays', async () => {
    const { port, token, server } = await start({ timeouts: quick });
    const c = await join(port, token);
    await sleep(quick.drop * 3);
    assert.equal(c.close, null);
    assert.equal(server.info().phones.length, 1);
  });

  test('fingers that stay down with no frame for the stale time are let go', async () => {
    const { port, token, events } = await start({ timeouts: { stale: 80 } });
    const c = await join(port, token);
    c.send({ t: 'touch', s: 9, p: [[0, 0.5, 0.5]] });
    await waitFor(() => touchesOf(events).length === 2, 'the let-go frame');
    const [down, up] = touchesOf(events);
    assert.equal(down.touches.length, 1);
    assert.deepEqual({ ...up, at: 0 }, { type: 'touch', player: 1, seq: 9, touches: [], at: 0 });
  });

  test('a finger whose frame keeps coming stays down, and an empty frame stops the timer', async () => {
    const { port, token, events } = await start({ timeouts: { stale: 80 } });
    const c = await join(port, token);
    for (let i = 0; i < 8; i++) {
      c.send({ t: 'touch', s: i, p: [[0, 0.5, 0.5]] });
      await sleep(30);
    }
    c.send({ t: 'touch', s: 8, p: [] });
    await sleep(200);
    const frames = touchesOf(events);
    assert.equal(frames.length, 9, 'no let-go frame of the link\'s own');
    assert.deepEqual(frames.at(-1).touches, []);
  });
});

describe('WebSocket: coming back as the same phone', () => {
  test('the same session id while the old connection is open takes over its player, seamlessly', async () => {
    const { port, token, events } = await start();
    const old = await join(port, token, { id: ID_A });
    old.send({ t: 'touch', s: 4, p: [[0, 0.5, 0.5]] });
    await waitFor(() => touchesOf(events).length === 1, 'the touch');
    const fresh = await join(port, token, { id: ID_A });
    assert.equal(fresh.welcome.player, old.welcome.player);
    assert.equal((await old.closing()).code, 4000);
    await sleep(50);
    assert.deepEqual(events.map((e) => e.type), ['join', 'touch', 'touch'], 'no leave and no second join');
    assert.deepEqual(touchesOf(events)[1].touches, [], 'the fingers the old connection had down are let go');
    fresh.send({ t: 'touch', s: 0, p: [[2, 0.1, 0.1]] });
    await waitFor(() => touchesOf(events).length === 3, 'a touch on the new connection');
    assert.equal(touchesOf(events)[2].player, old.welcome.player);
  });

  // The renderer tells a phone the colour it really draws it in once, when it joins. A phone
  // that takes over its own old connection (its Wi-Fi blinked) is no new join, so the renderer
  // says nothing: the welcome itself must carry that colour, not the slot's first guess.
  test('a phone that takes over its old connection is welcomed in the colour it was last told', async () => {
    const { server, port, token, events } = await start();
    const old = await join(port, token, { id: ID_A });
    assert.equal(old.welcome.color, '#e69f00', 'slot 1\'s first guess');
    assert.equal(server.send(1, state({ color: '#56B4E9', players: 2 })), true);
    await waitFor(() => old.messages.some((m) => m.t === 'state'), 'the state');
    const fresh = await join(port, token, { id: ID_A });
    await old.closing();
    assert.equal(fresh.welcome.player, 1);
    assert.equal(fresh.welcome.color, '#56b4e9', 'the colour the hub draws it in');
    assert.deepEqual(events.map((e) => e.type), ['join'], 'still no second join');
    // a new phone in a freed slot starts from the slot's guess again
    fresh.ws.close();
    await waitFor(() => leaves(events).length === 1, 'the leave');
    const other = await join(port, token, { id: ID_B });
    assert.equal(other.welcome.player, 1);
    assert.equal(other.welcome.color, '#e69f00');
  });

  test('a phone that left may come back as itself while allowNew is off; a new one may not', async () => {
    const { server, port, token, events } = await start();
    await join(port, token, { id: ID_B }); // player 1
    const a = await join(port, token, { id: ID_A }); // player 2
    a.ws.close();
    await waitFor(() => leaves(events).length === 1, 'the leave');
    server.setAllowNew(false);
    const back = await join(port, token, { id: ID_A });
    assert.equal(back.welcome.player, 2, 'its own number back');
    assert.equal(joins(events).length, 3);
    const stranger = client(port);
    await stranger.opened;
    stranger.send({ t: 'hello', v: 1, token, id: 'strangerXXXXXXXXXXXXXX' });
    assert.equal((await stranger.next('reject')).why, 'closed');
  });

  test('a phone coming back after the resume time needs the room open again', async () => {
    const { server, port, token, events } = await start({ timeouts: { resume: 30 } });
    const a = await join(port, token, { id: ID_A });
    a.ws.close();
    await waitFor(() => leaves(events).length === 1, 'the leave');
    await sleep(60);
    server.setAllowNew(false);
    const c = client(port);
    await c.opened;
    c.send({ t: 'hello', v: 1, token, id: ID_A });
    assert.equal((await c.next('reject')).why, 'closed');
  });

  test('a new code keeps the phones that are playing (they may even reconnect), but not ones that left', async () => {
    const { server, port, token, events } = await start();
    const stay = await join(port, token, { id: ID_A });
    const gone = await join(port, token, { id: ID_B });
    gone.ws.close();
    await waitFor(() => leaves(events).length === 1, 'the leave');
    const next = server.rotateToken();
    assert.notEqual(next.token, token);
    assert.equal(stay.close, null);
    // the phone still playing reconnects with the old code and its id
    const again = await join(port, token, { id: ID_A });
    assert.equal(again.welcome.player, stay.welcome.player);
    // the one that left, and anyone new, need the new code
    for (const id of [ID_B, undefined]) {
      const c = client(port);
      await c.opened;
      c.send({ t: 'hello', v: 1, token, id });
      assert.equal((await c.next('reject')).why, 'token', String(id));
    }
    assert.equal((await join(port, next.token)).welcome.player, 2);
  });

  test('kick removes a phone for good: it leaves, the code changes, and its id no longer works', async () => {
    const { server, port, token, events } = await start();
    const c = await join(port, token, { id: ID_A });
    assert.equal(server.kick(c.welcome.player), true);
    assert.equal((await c.next('reject')).why, 'removed', 'the page can say it was removed, not that its code is old');
    assert.equal((await c.closing()).code, 1008);
    await waitFor(() => leaves(events).length === 1, 'the leave');
    assert.notEqual(server.info().token, token);
    const back = client(port);
    await back.opened;
    back.send({ t: 'hello', v: 1, token, id: ID_A });
    assert.equal((await back.next('reject')).why, 'token');
    assert.equal(server.kick(5), false);
  });
});

describe('sending to phones', () => {
  test('send() delivers haptic and state only, rebuilt by the protocol\'s builders', async () => {
    const { server, port, token } = await start();
    const c = await join(port, token);
    assert.equal(server.send(1, haptic(30, 0.6)), true);
    assert.equal(server.send(1, { t: 'haptic', ms: 9999, k: 5, extra: 'x' }), true);
    assert.equal(server.send(1, { t: 'welcome', player: 3, color: '#000000' }), false);
    assert.equal(server.send(1, null), false);
    assert.equal(server.send(2, haptic(30, 0.6)), false, 'no such phone');
    assert.equal(server.send(1, state({ behaviour: 'whirl', color: '#E69F00' })), true);
    await waitFor(() => c.messages.length >= 4, 'the messages');
    assert.deepEqual(c.messages.slice(1), [
      { t: 'haptic', ms: 30, k: 0.6 },
      { t: 'haptic', ms: 500, k: 1 },
      { t: 'state', behaviour: 'whirl', color: '#e69f00' },
    ]);
  });

  test('broadcast reaches every phone, and a later welcome says what is playing', async () => {
    const { server, port, token } = await start();
    const a = await join(port, token);
    const b = await join(port, token);
    server.broadcast(state({ behaviour: 'halo', palette: 'aurora' }));
    server.broadcast({ t: 'reject', why: 'token' }); // not something to broadcast
    for (const c of [a, b]) assert.deepEqual(await c.next('state'), { t: 'state', behaviour: 'halo', palette: 'aurora' });
    const late = await join(port, token);
    assert.equal(late.welcome.behaviour, 'halo');
    assert.equal(late.welcome.palette, 'aurora');
    await sleep(30);
    assert.equal(a.messages.some((m) => m.t === 'reject'), false);
  });
});

describe('start, stop and info', () => {
  test('info() lists the phones, the LAN addresses best first and the URL with the token', async () => {
    const interfaces = { eth0: [{ address: '192.168.7.9', family: 'IPv4', internal: false }], docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }] };
    let clock = 1000;
    const { server, port, token } = await start({ host: '0.0.0.0', interfaces, now: () => clock });
    await join(port, token, { name: 'Bo' });
    const info = server.info();
    assert.equal(info.running, true);
    assert.equal(info.port, port);
    assert.deepEqual(info.addresses.map((a) => a.address), ['192.168.7.9', '172.17.0.1']);
    assert.equal(info.url, `http://192.168.7.9:${port}/#k=${token}`);
    assert.match(info.token, /^[A-Za-z0-9_-]{22}$/);
    assert.deepEqual(info.phones, [{ player: 1, name: 'Bo', since: 1000 }]);
  });

  test('bound to one address, that is the only one offered', async () => {
    const { server, port } = await start({ interfaces: { eth0: [{ address: '192.168.7.9', family: 'IPv4', internal: false }] } });
    assert.deepEqual(server.info().addresses, [{ address: '127.0.0.1', family: 'IPv4', name: 'bound' }]);
    assert.ok(server.info().url.startsWith(`http://127.0.0.1:${port}/#k=`));
  });

  test('with no usable address there is no URL, and a failing interface list does not throw', async () => {
    const { server } = await start({ host: '0.0.0.0', interfaces: () => { throw new Error('no permission'); } });
    assert.deepEqual(server.info().addresses, []);
    assert.equal(server.info().url, null);
  });

  test('a busy port moves the server to the next free one', async () => {
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const busy = blocker.address().port;
    try {
      const { port, logs } = await start({ port: busy });
      assert.ok(port > busy && port <= busy + 20, `took ${port}, busy was ${busy}`);
      assert.ok(logs.some((l) => l.includes(`port ${busy} is busy`)));
      assert.equal((await get(port, '/')).status, 200);
    } finally {
      blocker.close();
    }
  });

  test('stop() lets every phone go (with leave events) and start() works again', async () => {
    const { server, port, token, events } = await start();
    const a = await join(port, token);
    const waiting = client(port);
    await waiting.opened;
    await server.stop();
    assert.equal(server.info().running, false);
    assert.equal(server.info().url, null);
    await Promise.all([a.closing(), waiting.closing()]);
    await waitFor(() => leaves(events).length === 1, 'the leave');
    await server.stop(); // a second stop is harmless
    const info = await server.start();
    assert.equal(info.running, true);
    assert.equal((await join(info.port, info.token)).welcome.player, 1);
  });

  test('bad options are refused at once', () => {
    assert.throws(() => createLinkServer({ port: -1, staticDir }), TypeError);
    assert.throws(() => createLinkServer({ port: 70000, staticDir }), TypeError);
    assert.throws(() => createLinkServer({ maxPhones: 9, staticDir }), TypeError);
  });

  test('the defaults match CONTRACTS.md', () => {
    assert.equal(TIMEOUTS.hello, 5000);
    assert.equal(TIMEOUTS.drop, 30000);
    assert.ok(TIMEOUTS.quiet < TIMEOUTS.drop);
  });
});
