// The phone link: an HTTP server that hands phones the controller page, and a WebSocket at
// /link that turns their touches into events for the renderer. See CONTRACTS.md.
//
// Who gets in, checked in this order:
//   1. Only peers on the local network (isPeerAllowed: private addresses, by default).
//   2. Only requests whose Host header is an address or a local name. A web page that
//      points its own domain at this computer (DNS rebinding) sends its domain, and is refused.
//   3. A browser's WebSocket must come from the controller page served here (its Origin),
//      so a page opened anywhere else cannot reach the link from the phone's browser.
//   4. The first message must be hello, with the session token, within 5 s.
//   5. New phones only while allowNew is on, and at most maxPhones at once.
// After that, shared/protocol.js checks every message before it becomes an event. A phone
// that sends more than 240 messages a second (with a two-second allowance for the burst that
// follows a Wi-Fi stall) is closed with 1008, and one that sends more than 4 KB at once with 1009.
//
// Beyond CONTRACTS.md:
//   - isPeerAllowed(address) and timeouts can be passed in, for tests.
//   - A phone whose page sends the same session id again (its Wi-Fi blinked, or the page was
//     reloaded) gets its own player back, even while allowNew is off, for 60 s after it left.
//   - Fingers that stay down with no touch frame for 1.5 s are let go with an empty frame, so
//     a phone that freezes mid-touch cannot leave a pole held on the screen. The phone page
//     repeats its frame four times a second while fingers rest, so a still finger stays down.
//   - kick(player) removes a phone and changes the code, so that phone cannot come back.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { BEHAVIOURS } from '../../../Tactilume/src/js/core/behaviours.js';
import { PALETTES } from '../../../Tactilume/src/js/core/palettes.js';
import { PROTOCOL, LIMITS, parsePhoneMessage, encode, welcome, reject, pong, haptic, state } from '../shared/protocol.js';
import {
  isPrivateAddress, pickLanAddresses, newToken, tokensEqual, controllerUrl, isLocalHostHeader, isSameOrigin,
} from '../shared/lan.js';

const FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/phone.js', ['phone.js', 'text/javascript; charset=utf-8']],
  ['/phone.css', ['phone.css', 'text/css; charset=utf-8']],
]);
const HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws:; img-src 'self' data:",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  // the controller page has no reason to appear inside another site's page
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
});

// ms. Tests pass shorter ones.
export const TIMEOUTS = Object.freeze({
  hello: 5000,     // to send hello after connecting
  quiet: 20000,    // of silence before the server pings a phone
  drop: 30000,     // of silence, that ping unanswered, before the phone is dropped
  beat: 5000,      // how often the silences are checked
  stale: 1500,     // with fingers down and no touch frame, before the fingers are let go
  resume: 60000,   // a phone that left may come back as itself for this long
});

const PORT_TRIES = 21;             // the asked port, then the next 20
const RATE_BURST_SECONDS = 2;      // a phone may catch up on this much backlog at once
const MAX_PENDING = 16;            // connections that have not said hello yet
const MAX_SESSIONS = 64;           // session ids remembered for coming back
const MAX_BUFFERED = 64 * 1024;    // bytes waiting to go to one phone; past that, sends are dropped
const CLOSE_GRACE_MS = 1000;       // a peer that does not finish closing is cut off after this

// The welcome colour by player slot: the renderer's hub chooses the colour it really draws a
// player in, and sends it in a state message as soon as the phone joins. This first guess
// matches the hub's palette order, so most phones never see it change.
const SLOT_COLORS = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#ffffff'];

const pathOf = (url) => String(url || '').split('?')[0];
const isWildcard = (host) => !host || host === '0.0.0.0' || host === '::';

// A token bucket: `rate` messages a second on average, up to `burst` at once.
function createBucket(rate, burst, now) {
  let tokens = burst;
  let last = now();
  return () => {
    const t = now();
    tokens = Math.min(burst, tokens + (Math.max(0, t - last) / 1000) * rate);
    last = t;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

export function createLinkServer({
  port = 47615, host = '0.0.0.0', staticDir, onEvent = () => {},
  allowNew = true, maxPhones = 8, log = () => {}, now = Date.now,
  randomBytes = (n) => crypto.randomBytes(n), interfaces = () => os.networkInterfaces(),
  isPeerAllowed = isPrivateAddress, timeouts: timeoutOverrides = {},
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError(`createLinkServer: bad port ${port}`);
  if (!Number.isInteger(maxPhones) || maxPhones < 1 || maxPhones > 8) throw new TypeError('createLinkServer: maxPhones is 1..8');
  const timeouts = { ...TIMEOUTS, ...timeoutOverrides };
  let token = newToken(randomBytes);
  let running = false;
  let boundPort = 0;
  let heartbeat = null;
  let pending = 0;                                // connections that have not said hello
  const phones = new Map();                       // player → { conn, name, since }
  const sessions = new Map();                     // session id → { player, leftAt } (0 while connected)
  const latest = { behaviour: '', palette: '' };  // what the renderer last said is playing
  const emit = (e) => {
    // a fault in the listener must not take a phone's connection down with it
    try { onEvent(e); } catch (err) { log(`link: an event listener failed: ${err.message}`); }
  };

  // ---- HTTP: the controller page -------------------------------------------------------

  const respond = (res, status, type, body) => {
    res.writeHead(status, { ...HEADERS, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };

  const server = http.createServer({ maxHeaderSize: 8192 }, (req, res) => {
    const refuse = (status, text) => respond(res, status, 'text/plain; charset=utf-8', text);
    if (!isPeerAllowed(req.socket.remoteAddress)) return refuse(403, 'Forbidden');
    if (!isLocalHostHeader(req.headers.host)) return refuse(403, 'Forbidden');
    const entry = req.method === 'GET' || req.method === 'HEAD' ? FILES.get(pathOf(req.url)) : null;
    if (!entry) return refuse(404, 'Not found');
    fs.readFile(path.join(staticDir, entry[0]), (err, body) => {
      if (err) {
        log(`link: cannot read ${entry[0]}: ${err.message}`);
        return refuse(404, 'Not found');
      }
      res.writeHead(200, { ...HEADERS, 'Content-Type': entry[1], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
  });
  // A peer that opens connections and then sends its request a byte at a time ("slowloris")
  // is cut off quickly; phones send a whole request at once.
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxConnections = 128;

  // ---- WebSocket: the link itself --------------------------------------------------------

  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxMessageBytes, perMessageDeflate: false });

  server.on('upgrade', (req, socket, head) => {
    // a peer that vanishes mid-handshake must not take the main process down
    socket.on('error', () => {});
    const refuse = (status) => socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, () => socket.destroy());
    if (!isPeerAllowed(req.socket.remoteAddress)) return refuse('403 Forbidden');
    if (pathOf(req.url) !== '/link') return refuse('404 Not Found');
    if (!isLocalHostHeader(req.headers.host)) return refuse('403 Forbidden');
    // browsers always send Origin; a client without one is not a web page
    if (req.headers.origin !== undefined && !isSameOrigin(req.headers.origin, req.headers.host)) return refuse('403 Forbidden');
    if (pending >= MAX_PENDING) return refuse('503 Service Unavailable');
    wss.handleUpgrade(req, socket, head, (ws) => accept(ws, req.socket.remoteAddress));
  });

  const freeSlot = () => {
    for (let p = 1; p <= maxPhones; p++) if (!phones.has(p)) return p;
    return 0;
  };

  function sendTo(ws, msg) {
    if (ws.readyState !== ws.OPEN || ws.bufferedAmount > MAX_BUFFERED) return false;
    ws.send(encode(msg));
    return true;
  }

  // Closes with a code the page can read, and cuts the connection if the peer never answers.
  function cut(conn, code, reason) {
    if (conn.closing) return;
    conn.closing = true;
    conn.ws.close(code, reason);
    setTimeout(() => conn.ws.terminate(), CLOSE_GRACE_MS).unref?.();
  }

  // 'full' and 'closed' may change soon, so they close as "try again later"
  function refuse(conn, why) {
    sendTo(conn.ws, reject(why));
    cut(conn, why === 'full' || why === 'closed' ? 1013 : 1008, why);
  }

  function accept(ws, remote) {
    const conn = {
      ws, remote, player: 0, session: '', closing: false, counted: true,
      lastHeard: now(), pingSent: false, held: false, seq: 0, staleTimer: null, ignored: 0,
      allow: createBucket(LIMITS.maxRate, LIMITS.maxRate * RATE_BURST_SECONDS, now),
      helloTimer: null,
    };
    pending++;
    conn.helloTimer = setTimeout(() => { if (!conn.player) cut(conn, 1008, 'hello'); }, timeouts.hello);
    ws.on('message', (data, isBinary) => onMessage(conn, data, isBinary));
    ws.on('pong', () => { conn.lastHeard = now(); conn.pingSent = false; });
    ws.on('error', (e) => log(`link: connection error from ${remote}: ${e.message}`));
    ws.on('close', () => onClose(conn));
  }

  function settle(conn) {
    if (conn.counted) { conn.counted = false; pending--; }
    clearTimeout(conn.helloTimer);
  }

  function onMessage(conn, data, isBinary) {
    if (conn.closing) return;
    if (!conn.allow()) return cut(conn, 1008, 'rate');
    conn.lastHeard = now();
    if (isBinary) return cut(conn, 1003, 'text only');
    const r = parsePhoneMessage(data.toString('utf8'));
    if (!r.ok) {
      if (r.error === 'size') return cut(conn, 1009, 'too big');
      if (!conn.player) return refuse(conn, 'bad');
      // a phone that has joined keeps playing through a message it should not have sent
      // (a newer page may know messages this desktop does not); nothing reaches the renderer
      if (conn.ignored++ === 0) log(`link: player ${conn.player} sent a message that was ignored (${r.error})`);
      return;
    }
    const msg = r.msg;
    if (!conn.player) return hello(conn, msg);
    if (msg.t === 'touch') touch(conn, msg);
    else if (msg.t === 'act') emit({ type: 'act', player: conn.player, a: msg.a, v: msg.v });
    else if (msg.t === 'ping') sendTo(conn.ws, pong(msg.c, now()));
    // a second hello changes nothing
  }

  function forgetOldSessions() {
    const t = now();
    for (const [id, s] of sessions) if (s.leftAt && t - s.leftAt > timeouts.resume) sessions.delete(id);
    // still too many: the ones that left longest ago go first
    const gone = [...sessions].filter(([, s]) => s.leftAt).sort((a, b) => a[1].leftAt - b[1].leftAt);
    while (sessions.size > MAX_SESSIONS && gone.length) sessions.delete(gone.shift()[0]);
  }

  function hello(conn, msg) {
    if (msg.t !== 'hello') return refuse(conn, 'bad');
    if (msg.v !== PROTOCOL) return refuse(conn, 'version');
    forgetOldSessions();
    // A phone coming back as itself (it showed the token when it first joined) needs no
    // token now: the token may have changed since, and allowNew may be off.
    const known = msg.id ? sessions.get(msg.id) : null;
    if (!known && !tokensEqual(msg.token, token)) return refuse(conn, 'token');

    let player = 0;
    let replaced = null;
    if (known) {
      const current = phones.get(known.player);
      if (current && current.conn.session === msg.id) {
        player = known.player;      // its old connection is still open: this one takes over
        replaced = current;
      } else {
        player = phones.has(known.player) ? freeSlot() : known.player;
      }
    } else {
      if (!allowNew) return refuse(conn, 'closed');
      player = freeSlot();
    }
    if (!player) return refuse(conn, 'full');

    settle(conn);
    conn.player = player;
    conn.session = msg.id || '';
    if (conn.session) sessions.set(conn.session, { player, leftAt: 0 });
    if (replaced) {
      const old = replaced.conn;
      replaced.conn = conn;
      // the new connection knows nothing of the fingers the old one had down
      if (old.held) emit({ type: 'touch', player, seq: old.seq, touches: [], at: now() });
      clearTimeout(old.staleTimer);
      // 4000: this page's own replacement; a page that hears it does not reconnect
      cut(old, 4000, 'replaced');
      log(`link: player ${player} reconnected from ${conn.remote}`);
    } else {
      phones.set(player, { conn, name: msg.name, since: now() });
      log(`link: player ${player} joined from ${conn.remote}`);
    }
    sendTo(conn.ws, welcome({
      player, color: SLOT_COLORS[player - 1], name: phones.get(player).name, ...latest,
      behaviours: BEHAVIOURS.map(({ key, name }) => ({ key, name })),
      palettes: PALETTES.map(({ key, name }) => ({ key, name })),
    }));
    if (!replaced) emit({ type: 'join', player, name: msg.name, caps: msg.caps });
  }

  function touch(conn, msg) {
    conn.seq = msg.s;
    conn.held = msg.p.length > 0;
    if (conn.held) {
      if (conn.staleTimer) conn.staleTimer.refresh();
      else conn.staleTimer = setTimeout(() => letGo(conn), timeouts.stale);
    } else {
      clearTimeout(conn.staleTimer);
      conn.staleTimer = null;
    }
    const e = { type: 'touch', player: conn.player, seq: msg.s, touches: msg.p, at: now() };
    if (msg.ms !== undefined) e.ms = msg.ms;
    emit(e);
  }

  // The phone went quiet with fingers down: whatever it was doing, they are not down now.
  function letGo(conn) {
    conn.staleTimer = null;
    if (!conn.held || conn.closing || phones.get(conn.player)?.conn !== conn) return;
    conn.held = false;
    emit({ type: 'touch', player: conn.player, seq: conn.seq, touches: [], at: now() });
  }

  function onClose(conn) {
    settle(conn);
    clearTimeout(conn.staleTimer);
    const entry = conn.player ? phones.get(conn.player) : null;
    if (!entry || entry.conn !== conn) return; // never joined, or replaced by a newer connection
    phones.delete(conn.player);
    const s = conn.session ? sessions.get(conn.session) : null;
    if (s && s.player === conn.player) s.leftAt = now();
    log(`link: player ${conn.player} left`);
    emit({ type: 'leave', player: conn.player });
  }

  function checkSilences() {
    const t = now();
    for (const { conn } of phones.values()) {
      const silent = t - conn.lastHeard;
      if (silent >= timeouts.drop) {
        log(`link: player ${conn.player} stopped answering`);
        conn.ws.terminate();
      } else if (silent >= timeouts.quiet && !conn.pingSent) {
        conn.pingSent = true;
        conn.ws.ping();
      }
    }
  }

  // ---- the rest of the interface ---------------------------------------------------------

  function readInterfaces() {
    try {
      return (typeof interfaces === 'function' ? interfaces() : interfaces) || {};
    } catch (e) {
      log(`link: cannot list network interfaces: ${e.message}`);
      return {};
    }
  }

  function info() {
    // bound to one address, only that one works; on every interface, the LAN ones
    const addresses = isWildcard(host)
      ? pickLanAddresses(readInterfaces())
      : [{ address: host, family: host.includes(':') ? 'IPv6' : 'IPv4', name: 'bound' }];
    const url = running && addresses.length ? controllerUrl({ address: addresses[0].address, port: boundPort, token }) : null;
    return {
      running, port: boundPort, addresses, url, token, allowNew,
      phones: [...phones].sort((a, b) => a[0] - b[0]).map(([player, p]) => ({ player, name: p.name, since: p.since })),
    };
  }

  const listen = (p) => new Promise((resolve, fail) => {
    const onError = (e) => { server.off('listening', onListening); fail(e); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(p, host || '0.0.0.0');
  });

  // Only haptic and state messages go to phones, rebuilt by the protocol's own builders, so
  // nothing else can ride along.
  function outgoing(msg) {
    if (!msg || typeof msg !== 'object') return null;
    if (msg.t === 'haptic') return haptic(msg.ms, msg.k);
    if (msg.t === 'state') return state(msg);
    return null;
  }
  function remember(msg) {
    if (msg.t !== 'state') return;
    if (msg.behaviour) latest.behaviour = msg.behaviour;
    if (msg.palette) latest.palette = msg.palette;
  }

  return {
    async start() {
      if (running) return info();
      for (let i = 0; i < PORT_TRIES; i++) {
        const p = port === 0 ? 0 : port + i;
        try {
          await listen(p);
          break;
        } catch (e) {
          if (e.code !== 'EADDRINUSE' || port === 0 || i === PORT_TRIES - 1 || p >= 65535) throw e;
          log(`link: port ${p} is busy, trying ${p + 1}`);
        }
      }
      boundPort = server.address().port;
      running = true;
      heartbeat = setInterval(checkSilences, timeouts.beat);
      heartbeat.unref?.();
      log(`link: listening on port ${boundPort}`);
      return info();
    },

    async stop() {
      clearInterval(heartbeat);
      heartbeat = null;
      // every socket, including ones still waiting to say hello; each joined phone's close
      // handler reports it as left
      for (const ws of wss.clients) ws.terminate();
      if (!running) return;
      running = false;
      await new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    },

    info,
    setAllowNew(on) {
      allowNew = !!on;
      return info();
    },
    // Phones playing now keep playing, and may come back as themselves; phones that already
    // left, and every new phone, need the new code.
    rotateToken() {
      token = newToken(randomBytes);
      for (const [id, s] of sessions) if (s.leftAt) sessions.delete(id);
      return info();
    },
    // Removes a phone for good: it forgets the phone's session and changes the code, so the
    // page cannot come back without the new QR code. → whether there was such a phone.
    kick(player) {
      const p = phones.get(player);
      if (!p) return false;
      if (p.conn.session) sessions.delete(p.conn.session);
      p.conn.session = '';
      token = newToken(randomBytes);
      refuse(p.conn, 'token');
      return true;
    },
    send(player, msg) {
      const p = phones.get(player);
      const out = outgoing(msg);
      if (!p || !out) return false;
      remember(out);
      return sendTo(p.conn.ws, out);
    },
    broadcast(msg) {
      const out = outgoing(msg);
      if (!out) return;
      remember(out);
      for (const { conn } of phones.values()) sendTo(conn.ws, out);
    },
  };
}
