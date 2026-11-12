// The pure parts of the controller page: reading the code from the address, when to send a
// frame, how long to wait before reconnecting, and how a touch becomes pad coordinates and
// force. No DOM here, so tests/unit/link-pad.test.js can check them in Node.

// The session token from the address fragment ('#k=TOKEN'), or '' when there is none.
export function readToken(hash) {
  const m = /(?:^#|[#&])k=([A-Za-z0-9_-]{1,64})(?:&|$)/.exec(String(hash || ''));
  return m ? m[1] : '';
}

// At most `maxHz` frames a second, on average. Animation frames do not land exactly 1/120 s
// apart, so a plain "at least 8.33 ms since the last one" test would drop every other frame
// on a 120 Hz screen. A small bucket of credit absorbs that jitter instead: on a 120 Hz
// screen every frame goes out, on a 144 Hz one five frames in six. It holds up to two
// frames' worth, so the credit that builds up over a skipped frame is never thrown away,
// and after a pause at most two frames go out back to back.
export function createFrameGate(maxHz = 120, slack = 1) {
  const perMs = maxHz / 1000;
  const capacity = 1 + slack;
  let credit = capacity;
  let last = null;
  // → true when a frame may go now; it is then counted as sent
  return function take(now) {
    if (last !== null) credit = Math.min(capacity, credit + Math.max(0, now - last) * perMs);
    last = now;
    if (credit < 1) return false;
    credit -= 1;
    return true;
  };
}

// How long to wait before reconnecting after `attempt` failures in a row: 0.25 s doubling up
// to 5 s, each randomly shortened by up to half, so phones that lost the computer together
// do not all knock again at the same moment.
export function retryDelay(attempt, random = Math.random) {
  const base = Math.min(5000, 250 * 2 ** Math.max(0, Math.min(attempt, 10)));
  return Math.round(base * (0.5 + 0.5 * random()));
}

// A finger's position on the pad, 0..1 from the top left; a finger that strays past the
// edge (the pad keeps it) stays on the edge.
export function padPoint(clientX, clientY, rect) {
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  return [clamp01((clientX - rect.left) / w), clamp01((clientY - rect.top) / h)];
}

const FINGERTIP_AREA = 40 * 40; // CSS px², a typical fingertip contact (as on mobile)

// How hard a touch presses, 0..1, with 0.5 for "a usual touch" or "cannot tell". Pens report
// real pressure. Many phones report 0, or exactly 0.5, for touches they cannot measure; for
// those the contact's size stands in, as the mobile edition does, since current iPhones have
// no force sensor.
export function intensityOf({ pointerType, pressure, width, height }) {
  const p = Number(pressure);
  if (pointerType === 'mouse') return 0.5;
  if (pointerType === 'pen') return p > 0 ? Math.min(1, p) : 0.5;
  if (p > 0 && p !== 0.5) return Math.min(1, p);
  if (width > 1 && height > 1) return Math.min(1, (0.5 * width * height) / FINGERTIP_AREA);
  return 0.5;
}

// Touch ids on the wire are small numbers: each new finger takes the lowest free one, and a
// lifted finger gives its number back.
export function createSlots(count = 10) {
  const used = new Set();
  return {
    take() {
      for (let id = 0; id < count; id++) {
        if (!used.has(id)) { used.add(id); return id; }
      }
      return -1;
    },
    give(id) { used.delete(id); },
    get size() { return used.size; },
  };
}

// What to tell the person when the computer turns the phone away, and whether to keep trying
// by itself. A full or closed room may open up; the rest need the person to do something.
export const REFUSALS = Object.freeze({
  token: { retry: false, action: 'none', text: 'This QR code is out of date. Scan the new code on the computer.' },
  version: { retry: false, action: 'reload', text: 'This page is out of date. Reload it to play.' },
  bad: { retry: false, action: 'reload', text: 'The computer did not understand this phone. Reload the page to try again.' },
  full: { retry: true, action: 'retry', text: 'Eight phones are playing already. You will join when one leaves.' },
  closed: { retry: true, action: 'retry', text: 'The computer is not letting new phones join right now. Waiting…' },
});
