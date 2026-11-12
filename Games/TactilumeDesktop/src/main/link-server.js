// The phone link: an HTTP server that hands phones the controller page, and a WebSocket at
// /link that turns their touches into events for the renderer. See CONTRACTS.md.
//
// Only peers on the local network get in, and a phone must show the session token from the
// QR code. Every message is checked by shared/protocol.js before it becomes an event.
//
// First version, written by the spine. The link part owns this file and replaces it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { BEHAVIOURS } from '../../../Tactilume/src/js/core/behaviours.js';
import { PALETTES } from '../../../Tactilume/src/js/core/palettes.js';
import { PROTOCOL, LIMITS, parsePhoneMessage, encode, welcome, reject, pong } from '../shared/protocol.js';
import { isPrivateAddress, pickLanAddresses, newToken, tokensEqual, controllerUrl } from '../shared/lan.js';

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/phone.js': ['phone.js', 'text/javascript; charset=utf-8'],
  '/phone.css': ['phone.css', 'text/css; charset=utf-8'],
};
const HEADERS = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws:; img-src 'self' data:",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};
const PORT_TRIES = 21;          // the asked port, then the next 20
const HELLO_MS = 5000;
const HEARTBEAT_MS = 15000;     // a phone that answers no ping for two beats is dropped
// The welcome colour per phone slot. The renderer's hub picks the colour it draws a player
// in; until the two share one table (see the spine's report), this matches hub.js by slot.
const SLOT_COLORS = ['#e69f00', '#56b4e9', '#009e73', '#f0e442', '#0072b2', '#d55e00', '#cc79a7', '#ffffff'];

export function createLinkServer({
  port = 47615, host = '0.0.0.0', staticDir, onEvent = () => {},
  allowNew = true, maxPhones = 8, log = () => {}, now = Date.now,
  randomBytes = (n) => crypto.randomBytes(n), interfaces = () => os.networkInterfaces(),
} = {}) {
  let token = newToken(randomBytes);
  let running = false;
  let boundPort = 0;
  let heartbeat = null;
  const phones = new Map();       // player → { ws, name, since, alive }
  const latest = { behaviour: '', palette: '' }; // what the renderer last said is playing

  const respond = (res, status, type, body) => {
    res.writeHead(status, { ...HEADERS, 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  };

  const http_ = http.createServer((req, res) => {
    if (!isPrivateAddress(req.socket.remoteAddress)) return respond(res, 403, 'text/plain', 'Forbidden');
    const entry = req.method === 'GET' || req.method === 'HEAD' ? FILES[req.url.split('?')[0]] : null;
    if (!entry) return respond(res, 404, 'text/plain', 'Not found');
    fs.readFile(path.join(staticDir, entry[0]), (err, body) => {
      if (err) return respond(res, 404, 'text/plain', 'Not found');
      res.writeHead(200, { ...HEADERS, 'Content-Type': entry[1], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
  });

  // maxPayload makes ws close an oversized message with 1009 by itself
  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxMessageBytes });
  http_.on('upgrade', (req, socket, head) => {
    const refuse = (status) => { socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`); };
    if (!isPrivateAddress(req.socket.remoteAddress)) return refuse('403 Forbidden');
    if (req.url.split('?')[0] !== '/link') return refuse('404 Not Found');
    wss.handleUpgrade(req, socket, head, (ws) => accept(ws, req.socket.remoteAddress));
  });

  const freeSlot = () => {
    for (let p = 1; p <= maxPhones; p++) if (!phones.has(p)) return p;
    return 0;
  };
  const sendTo = (ws, msg) => { if (ws.readyState === ws.OPEN) ws.send(encode(msg)); };
  const refuse = (ws, why) => { sendTo(ws, reject(why)); ws.close(1008, why); };

  function accept(ws, remote) {
    let player = 0;
    let windowStart = now(), count = 0;
    const helloTimer = setTimeout(() => { if (!player) ws.close(1008, 'hello'); }, HELLO_MS);

    ws.on('message', (data, isBinary) => {
      // a one-second window is enough to hold a phone to maxRate messages per second
      const t = now();
      if (t - windowStart >= 1000) { windowStart = t; count = 0; }
      if (++count > LIMITS.maxRate) return ws.close(1008, 'rate');
      if (isBinary) return ws.close(1003, 'text only');
      const r = parsePhoneMessage(data.toString('utf8'));
      if (!r.ok) {
        if (r.error === 'size') return ws.close(1009, 'size');
        // a phone that has joined may send one odd message; one that has not is refused
        return player ? undefined : refuse(ws, 'bad');
      }
      const msg = r.msg;
      if (!player) return hello(ws, msg, remote, (p) => { player = p; clearTimeout(helloTimer); });
      const p = phones.get(player);
      if (p) p.alive = true;
      if (msg.t === 'touch') onEvent({ type: 'touch', player, seq: msg.s, touches: msg.p, at: t });
      else if (msg.t === 'act') onEvent({ type: 'act', player, a: msg.a, v: msg.v });
      else if (msg.t === 'ping') sendTo(ws, pong(msg.c, t));
    });
    ws.on('pong', () => { if (player && phones.has(player)) phones.get(player).alive = true; });
    ws.on('error', (e) => log(`link: phone error: ${e.message}`));
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (player && phones.get(player)?.ws === ws) {
        phones.delete(player);
        log(`link: player ${player} left`);
        onEvent({ type: 'leave', player });
      }
    });
  }

  function hello(ws, msg, remote, joined) {
    if (msg.t !== 'hello') return refuse(ws, 'bad');
    if (msg.v !== PROTOCOL) return refuse(ws, 'version');
    if (!tokensEqual(msg.token, token)) return refuse(ws, 'token');
    if (!allowNew) return refuse(ws, 'closed');
    const player = freeSlot();
    if (!player) return refuse(ws, 'full');
    phones.set(player, { ws, name: msg.name, since: now(), alive: true });
    joined(player);
    log(`link: player ${player} joined from ${remote}`);
    sendTo(ws, welcome({
      player, color: SLOT_COLORS[player - 1], name: msg.name, ...latest,
      behaviours: BEHAVIOURS.map(({ key, name }) => ({ key, name })),
      palettes: PALETTES.map(({ key, name }) => ({ key, name })),
    }));
    onEvent({ type: 'join', player, name: msg.name, caps: msg.caps });
  }

  function info() {
    const ifaces = typeof interfaces === 'function' ? interfaces() : interfaces;
    const addresses = pickLanAddresses(ifaces);
    const url = running && addresses.length ? controllerUrl({ address: addresses[0].address, port: boundPort, token }) : null;
    return {
      running, port: boundPort, addresses, url, token, allowNew,
      phones: [...phones].map(([player, p]) => ({ player, name: p.name, since: p.since })),
    };
  }

  const listen = (p) => new Promise((resolve, reject_) => {
    const onError = (e) => { http_.off('listening', onListening); reject_(e); };
    const onListening = () => { http_.off('error', onError); resolve(); };
    http_.once('error', onError);
    http_.once('listening', onListening);
    http_.listen(p, host);
  });

  // only haptic and state messages may go to phones; anything else is a caller's mistake
  const sendable = (msg) => msg && (msg.t === 'haptic' || msg.t === 'state');
  const remember = (msg) => {
    if (msg.t !== 'state') return;
    if (msg.behaviour) latest.behaviour = msg.behaviour;
    if (msg.palette) latest.palette = msg.palette;
  };

  return {
    async start() {
      if (running) return info();
      for (let i = 0; i < PORT_TRIES; i++) {
        try {
          await listen(port + i);
          boundPort = http_.address().port;
          running = true;
          break;
        } catch (e) {
          if (e.code !== 'EADDRINUSE' || i === PORT_TRIES - 1) throw e;
          log(`link: port ${port + i} is busy, trying the next`);
        }
      }
      heartbeat = setInterval(() => {
        for (const [, p] of phones) {
          if (!p.alive) { p.ws.terminate(); continue; }
          p.alive = false;
          p.ws.ping();
        }
      }, HEARTBEAT_MS);
      heartbeat.unref?.();
      log(`link: listening on port ${boundPort}`);
      return info();
    },
    async stop() {
      clearInterval(heartbeat);
      // every socket, including ones still waiting to say hello
      for (const ws of wss.clients) ws.terminate();
      if (!running) return;
      running = false;
      await new Promise((resolve) => {
        http_.close(() => resolve());
        http_.closeAllConnections();
      });
    },
    info,
    setAllowNew(on) { allowNew = !!on; return info(); },
    rotateToken() { token = newToken(randomBytes); return info(); },
    send(player, msg) {
      const p = phones.get(player);
      if (!p || !sendable(msg)) return false;
      remember(msg);
      sendTo(p.ws, msg);
      return true;
    },
    broadcast(msg) {
      if (!sendable(msg)) return;
      remember(msg);
      for (const [, p] of phones) sendTo(p.ws, msg);
    },
  };
}
