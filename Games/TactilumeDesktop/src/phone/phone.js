// The controller page served to phones: one full-screen touch pad. It reads the session
// token from the address (#k=...), joins over the WebSocket at /link, and sends every touch
// that is down, at most once per animation frame. See CONTRACTS.md, "phone/".
//
// First version, written by the spine. The link part owns this file and replaces it.
import { PROTOCOL, LIMITS, encode, parseDesktopMessage } from '../shared/protocol.js';

const MIN_GAP_MS = 1000 / 120;  // never more than 120 touch frames a second
const REJECTED = {
  token: 'This code is out of date. Scan the new QR code on the computer.',
  version: 'This page is out of date. Reload it.',
  bad: 'The computer did not understand this phone. Reload the page.',
  full: 'Eight phones are playing already. Trying again soon…',
  closed: 'The computer is not taking new phones right now. Trying again soon…',
};

const token = (/[#&]k=([A-Za-z0-9_-]{1,64})/.exec(location.hash) || [])[1] || '';
const statusBox = document.getElementById('status');
const pad = document.getElementById('pad');
const touches = new Map(); // pointerId → [id, x, y, f]
let ws = null;
let joined = false;
let retries = 0;
let seq = 0;
let dirty = false;
let lastSent = 0;
let stopRetrying = false;

const say = (text) => { statusBox.textContent = text; };
const send = (msg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(encode(msg)); };

function connect() {
  if (!token) return say('This page needs the code from the QR code. Scan it on the computer.');
  say('Connecting…');
  ws = new WebSocket(`ws://${location.host}/link`);
  ws.onopen = () => {
    send({ t: 'hello', v: PROTOCOL, token, name: '', caps: { touches: LIMITS.maxTouches, haptics: 'vibrate' in navigator } });
  };
  ws.onmessage = (e) => {
    const r = parseDesktopMessage(String(e.data));
    if (r.ok) handle(r.msg);
  };
  ws.onclose = () => {
    joined = false;
    if (stopRetrying) return;
    say('Disconnected. Trying again…');
    // waits longer after each failure, up to 10 s
    setTimeout(connect, Math.min(10000, 500 * 2 ** retries++));
  };
}

function handle(msg) {
  if (msg.t === 'welcome') {
    joined = true;
    retries = 0;
    document.body.style.setProperty('--player', msg.color);
    say(`Playing as Player ${msg.player}`);
  } else if (msg.t === 'reject') {
    say(REJECTED[msg.why]);
    // a full or closed room may open up; the other reasons need the person to act
    stopRetrying = !(msg.why === 'full' || msg.why === 'closed');
  } else if (msg.t === 'haptic') {
    navigator.vibrate?.(msg.ms);
  }
}

// touch ids on the wire are small numbers: the lowest one not in use
function freeId() {
  const used = new Set([...touches.values()].map((t) => t[0]));
  for (let id = 0; id < 256; id++) if (!used.has(id)) return id;
  return 0;
}

function place(e, entry) {
  const r = pad.getBoundingClientRect();
  entry[1] = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
  entry[2] = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)));
  // browsers report 0.5 when they cannot measure force, which is also the protocol's "unknown"
  entry[3] = e.pressure > 0 ? Math.min(1, e.pressure) : 0.5;
  dirty = true;
}

pad.addEventListener('pointerdown', (e) => {
  if (touches.size >= LIMITS.maxTouches) return;
  pad.setPointerCapture(e.pointerId);
  const entry = [freeId(), 0, 0, 0.5];
  touches.set(e.pointerId, entry);
  place(e, entry);
});
pad.addEventListener('pointermove', (e) => {
  const entry = touches.get(e.pointerId);
  if (entry) place(e, entry);
});
const lift = (e) => { if (touches.delete(e.pointerId)) dirty = true; };
pad.addEventListener('pointerup', lift);
pad.addEventListener('pointercancel', lift);
pad.addEventListener('contextmenu', (e) => e.preventDefault());

for (const b of document.querySelectorAll('[data-act]')) {
  b.addEventListener('click', () => {
    const v = b.dataset.v ? Number(b.dataset.v) : undefined;
    send(v === undefined ? { t: 'act', a: b.dataset.act } : { t: 'act', a: b.dataset.act, v });
  });
}

// One touch frame per animation frame at most, with every finger that is down; an empty
// frame tells the computer the last finger lifted.
function tick(now) {
  requestAnimationFrame(tick);
  if (!dirty || !joined || now - lastSent < MIN_GAP_MS) return;
  dirty = false;
  lastSent = now;
  send({ t: 'touch', s: seq, p: [...touches.values()] });
  seq = (seq + 1) % 2 ** 31;
}

requestAnimationFrame(tick);
connect();
