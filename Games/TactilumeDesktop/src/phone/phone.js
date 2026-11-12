// The controller page served to phones: one full-screen touch pad. It reads the session code
// from the address (#k=...), joins over the WebSocket at /link, and sends every finger that
// is down, at most once per animation frame and never more than 120 times a second. See
// CONTRACTS.md, "phone/".
//
// What makes it feel right on a phone:
//   - Pointer events on one surface, each finger captured, with the browser's own gestures
//     (scroll, zoom, rubber-banding, callouts) switched off by CSS and by non-passive touch
//     listeners, which older iOS Safari needs.
//   - Frames carry the phone's own clock (touch.ms), so the computer measures finger speed
//     without the Wi-Fi's uneven delivery in it.
//   - While fingers rest, the frame is repeated four times a second: the computer lets go of
//     fingers it stops hearing about, so a phone that freezes cannot leave a light stuck on.
//   - It reconnects by itself, waiting a little longer after each failure (with jitter), and
//     at once when the page comes back into view or the phone comes back online. A ping every
//     2 s notices a dead connection that never closed, which Wi-Fi often leaves behind.
//   - The page keeps a random id for its tab, so a phone that reconnects gets its own player
//     (and colour) back.
import { PROTOCOL, LIMITS, MAX_SEQ, encode, parseDesktopMessage, hello, touch, act, ping } from '../shared/protocol.js';
import { newToken } from '../shared/lan.js';
import { readToken, createFrameGate, retryDelay, padPoint, intensityOf, createSlots, REFUSALS } from './pad.js';

const KEEPALIVE_MS = 250;        // a resting finger's frame is repeated this often
const PING_MS = 2000;
const DEAD_AFTER_MS = 6000;      // no answer to a ping for this long: the connection is gone
const MAX_QUEUED = 4096;         // bytes not yet sent: the network is behind, so wait for it
const REPLACED = 4000;           // the close code the computer uses when this tab joined again elsewhere
const SESSION_KEY = 'tactilume.link.id';

const $ = (id) => document.getElementById(id);
const body = document.body;
const statusText = $('status-text');
const latency = $('latency');
const pad = $('pad');
const retryBox = $('retry-box');
const retryButton = $('retry');
const fullscreenButton = $('fullscreen');
const sleepNote = $('sleep-note');
const behaviourName = $('behaviour-name');
const paletteName = $('palette-name');
const actButtons = [...document.querySelectorAll('[data-act]')];

const token = readToken(location.hash);
const sessionId = loadSessionId();
const canVibrate = typeof navigator.vibrate === 'function';
const maxTouches = Math.max(1, Math.min(LIMITS.maxTouches, navigator.maxTouchPoints || LIMITS.maxTouches));

const touches = new Map();       // pointerId → { id, x, y, f, dot }
const slots = createSlots(LIMITS.maxTouches);
const gate = createFrameGate(120);
const names = { behaviours: new Map(), palettes: new Map() };

let ws = null;                   // the connection in use; an abandoned one is never this
let joined = false;
let stopped = false;             // the computer said not to come back by ourselves
let attempt = 0;
let retryTimer = 0;
let pingTimer = 0;
let pingSentAt = 0;              // 0: no ping waiting for its answer
let seq = 0;
let dirty = false;
let lastSentAt = -Infinity;
let framesSent = 0;
let rtt = 0;
let player = 0;
let players = 0;
let lastStatus = '';
let refusal = '';                // why the computer turned us away, while waiting to try again
let wakeLock = null;

// A small, read-only view of the page for the browser tests.
window.TACTILUME_PHONE = Object.freeze({
  get joined() { return joined; },
  get player() { return player; },
  get framesSent() { return framesSent; },
  get rtt() { return rtt; },
});

// The same id for this tab across reconnects and reloads; none when the phone cannot make
// a random one or store it (resuming is then just off).
function loadSessionId() {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved;
    const id = newToken((n) => crypto.getRandomValues(new Uint8Array(n)));
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return '';
  }
}

// ---- what the person sees -----------------------------------------------------------------

// state: 'connecting' | 'playing' | 'lost' | 'stopped'. The status line is a live region, so
// it is only rewritten when its words change.
function show(stateName, text, action = 'none') {
  body.dataset.state = stateName;
  if (text !== lastStatus) {
    lastStatus = text;
    statusText.textContent = text;
  }
  for (const b of actButtons) b.disabled = stateName !== 'playing';
  retryBox.hidden = action === 'none';
  retryButton.textContent = action === 'reload' ? 'Reload' : 'Try again';
  retryButton.dataset.action = action;
  if (stateName !== 'playing') latency.textContent = '';
}

function showPlaying() {
  const others = players > 1 ? ` · ${players} playing` : '';
  show('playing', `Player ${player}${others}`);
}

function setColor(color) {
  document.documentElement.style.setProperty('--player', color);
}

function nameOf(list, key) {
  if (key === 'auto') return 'Auto';
  return list.get(key) || key || '';
}

function showScene({ behaviour, palette }) {
  if (behaviour) behaviourName.textContent = nameOf(names.behaviours, behaviour);
  if (palette) paletteName.textContent = nameOf(names.palettes, palette);
}

// Android buzzes; iPhones have no vibration for web pages.
function buzz(ms) {
  if (!canVibrate) return;
  try { navigator.vibrate(ms); } catch { /* not allowed until the page has been touched */ }
}

// ---- the connection -----------------------------------------------------------------------

const sendNow = (msg) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(encode(msg));
  return true;
};

function connect() {
  clearTimeout(retryTimer);
  if (ws) return;
  if (!token) {
    stopped = true;
    show('stopped', 'This page needs the code from the QR code. Scan the code on the computer.');
    return;
  }
  stopped = false;
  // a full or closed room is the news until it opens up
  show('connecting', refusal || (attempt ? 'Connecting to the computer again…' : 'Connecting to the computer…'));
  let socket;
  try {
    socket = new WebSocket(`ws://${location.host}/link`);
  } catch {
    lost();
    return;
  }
  ws = socket;
  socket.onopen = () => {
    if (socket !== ws) return;
    sendNow(hello({ token, id: sessionId || undefined, touches: maxTouches, haptics: canVibrate }));
  };
  socket.onmessage = (e) => {
    if (socket !== ws) return;
    const r = parseDesktopMessage(String(e.data));
    if (r.ok) receive(r.msg);
  };
  socket.onclose = (e) => {
    if (socket === ws) closed(e.code);
  };
}

function receive(msg) {
  switch (msg.t) {
    case 'welcome':
      if (msg.v !== PROTOCOL) {
        stopped = true;
        show('stopped', REFUSALS.version.text, 'reload');
        ws.close();
        return;
      }
      joined = true;
      attempt = 0;
      refusal = '';
      player = msg.player;
      setColor(msg.color);
      names.behaviours = new Map(msg.behaviours.map((b) => [b.key, b.name]));
      names.palettes = new Map(msg.palettes.map((p) => [p.key, p.name]));
      showScene(msg);
      showPlaying();
      dirty = true; // fingers already down go out with the next frame
      startPings();
      break;
    case 'reject': {
      const why = REFUSALS[msg.why] || REFUSALS.bad;
      stopped = !why.retry;
      refusal = why.retry ? why.text : '';
      // a room that is full or closed now will probably still be so in a moment
      if (why.retry) attempt = Math.max(attempt, 3);
      show(stopped ? 'stopped' : 'lost', why.text, why.action);
      break;
    }
    case 'state':
      if (msg.color) setColor(msg.color);
      if (msg.players !== undefined) players = msg.players;
      showScene(msg);
      if (joined) showPlaying();
      break;
    case 'haptic':
      buzz(msg.ms);
      break;
    case 'pong':
      if (pingSentAt && msg.c === pingSentAt) {
        rtt = Math.max(0, performance.now() - msg.c);
        pingSentAt = 0;
        latency.textContent = `${Math.round(rtt)} ms`;
      }
      break;
    default:
      break;
  }
}

function closed(code) {
  ws = null;
  joined = false;
  stopPings();
  if (code === REPLACED) {
    stopped = true;
    show('stopped', 'This phone joined again in another tab, which plays now.', 'retry');
    return;
  }
  if (stopped) return;
  lost();
}

function lost() {
  ws = null;
  joined = false;
  if (!navigator.onLine) {
    show('lost', 'This phone is offline. Join the same Wi-Fi as the computer.', 'retry');
    return; // the 'online' event reconnects
  }
  show('lost', refusal || 'Cannot reach the computer. Trying again…', 'retry');
  retryTimer = setTimeout(connect, retryDelay(attempt++));
}

// A connection that went quiet without closing (the Wi-Fi dropped it) is let go here, and a
// new one started, instead of waiting minutes for the browser to notice.
function abandon() {
  const old = ws;
  ws = null;
  if (old) {
    old.onopen = old.onmessage = old.onclose = null;
    try { old.close(); } catch { /* already closing */ }
  }
  closed(1006);
}

function startPings() {
  stopPings();
  pingTimer = setInterval(() => {
    const now = performance.now();
    if (pingSentAt && now - pingSentAt > DEAD_AFTER_MS) return abandon();
    if (!pingSentAt) {
      pingSentAt = now;
      sendNow(ping(now));
    }
  }, PING_MS);
}

function stopPings() {
  clearInterval(pingTimer);
  pingTimer = 0;
  pingSentAt = 0;
}

function reconnectNow() {
  if (ws || (stopped && retryButton.dataset.action !== 'retry')) return;
  attempt = 0;
  connect();
}

retryButton.addEventListener('click', () => {
  if (retryButton.dataset.action === 'reload') location.reload();
  else { stopped = false; reconnectNow(); }
});

// ---- the pad ------------------------------------------------------------------------------

const dotPool = [];
let padRect = pad.getBoundingClientRect();

function place(e, t) {
  [t.x, t.y] = padPoint(e.clientX, e.clientY, padRect);
  t.f = intensityOf(e);
  dirty = true;
}

function onDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (touches.has(e.pointerId) || touches.size >= maxTouches) return;
  const id = slots.take();
  if (id < 0) return;
  try { pad.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
  padRect = pad.getBoundingClientRect();
  const dot = dotPool.pop() || document.createElement('div');
  dot.className = 'dot';
  pad.appendChild(dot);
  const t = { id, x: 0, y: 0, f: 0.5, dot };
  touches.set(e.pointerId, t);
  place(e, t);
  pad.classList.add('touched');
  keepAwake();
}

function onMove(e) {
  const t = touches.get(e.pointerId);
  if (!t) return;
  // the mouse button came up somewhere this page could not see
  if (e.pointerType === 'mouse' && !(e.buttons & 1)) return onEnd(e);
  place(e, t);
}

function onEnd(e) {
  const t = touches.get(e.pointerId);
  if (!t) return;
  touches.delete(e.pointerId);
  slots.give(t.id);
  t.dot.remove();
  dotPool.push(t.dot);
  dirty = true;
}

// Leaving the page (switching apps, the notification shade, the screen locking) can swallow
// the lift, so every finger is let go, and the computer told at once: animation frames stop
// while the page is hidden.
function liftAll() {
  if (!touches.size) return;
  for (const t of touches.values()) {
    slots.give(t.id);
    t.dot.remove();
    dotPool.push(t.dot);
  }
  touches.clear();
  dirty = true;
  if (joined) sendFrame(performance.now());
}

const block = (e) => { if (e.cancelable) e.preventDefault(); };
pad.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onEnd);
window.addEventListener('pointercancel', onEnd);
pad.addEventListener('lostpointercapture', onEnd);
// Older iOS Safari still scrolls and zooms unless touch listeners say no. Only the pad blocks
// touchstart: on the buttons it would also block their clicks.
pad.addEventListener('touchstart', block, { passive: false });
document.addEventListener('touchmove', block, { passive: false });
for (const name of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu', 'selectstart', 'dragstart']) {
  document.addEventListener(name, block, { passive: false });
}
if (typeof ResizeObserver === 'function') new ResizeObserver(() => { padRect = pad.getBoundingClientRect(); }).observe(pad);

for (const b of actButtons) {
  b.addEventListener('click', () => {
    if (!joined) return;
    sendNow(act(b.dataset.act, b.dataset.v ? Number(b.dataset.v) : undefined));
    buzz(10);
  });
}

// ---- sending ------------------------------------------------------------------------------

function sendFrame(now) {
  const points = [];
  for (const t of touches.values()) points.push([t.id, t.x, t.y, t.f]);
  if (!sendNow(touch(seq, points, now))) return;
  seq = seq >= MAX_SEQ ? 0 : seq + 1;
  dirty = false;
  lastSentAt = now;
  framesSent++;
}

// Once per animation frame: the dots follow the fingers, and the computer hears about every
// finger that is down when anything changed, or when a resting finger's frame is due again.
function tick(now) {
  requestAnimationFrame(tick);
  if (touches.size) {
    const w = padRect.width, h = padRect.height;
    for (const t of touches.values()) t.dot.style.transform = `translate(${t.x * w}px, ${t.y * h}px)`;
  }
  if (!joined || !ws) return;
  const due = dirty || (touches.size > 0 && now - lastSentAt >= KEEPALIVE_MS);
  // when the network is behind, a newer frame later beats a queue of old ones now
  if (!due || ws.bufferedAmount > MAX_QUEUED || !gate(now)) return;
  sendFrame(now);
}

// ---- the screen ---------------------------------------------------------------------------

// A page on plain HTTP is not a secure context, so phones give it no wake lock; when there is
// one (opened from localhost, say), it is used and the note goes away.
async function keepAwake() {
  if (wakeLock || !('wakeLock' in navigator) || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    sleepNote.hidden = true;
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* refused: the note stays */ }
}

if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
  fullscreenButton.hidden = false;
  fullscreenButton.addEventListener('click', () => {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => { fullscreenButton.hidden = !!document.fullscreenElement; });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    liftAll();
  } else {
    if (touches.size === 0) keepAwake();
    reconnectNow();
  }
});
window.addEventListener('pagehide', liftAll);
window.addEventListener('blur', liftAll);
window.addEventListener('online', reconnectNow);
window.addEventListener('offline', () => { if (!ws) lost(); });

requestAnimationFrame(tick);
connect();
