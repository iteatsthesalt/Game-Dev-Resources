// Turns touch, pen and mouse on the canvas into poles (see CONTRACTS.md).
//
// Positions are world units. Velocity is smoothed for the engine's forces, and a
// short history of samples is kept so that a flick reports how fast the finger was
// moving in its last few milliseconds, not an average over the whole drag.

import { clamp, approach, createEmitter } from '../core/util.js';

const MAX_LIVE = 10;
const MAX_PINS = 10;
const FADE_SECONDS = 0.35;      // a lifted touch keeps fading out for this long
const VELOCITY_TAU = 0.06;      // s, smoothing of the live velocity
const STILL_AFTER = 0.05;       // s without movement before the velocity eases to zero
const FLICK_WINDOW_MS = 80;     // history that decides the speed of a flick
const MAX_FLICK = 40;           // world units / s; anything faster is a glitch
const POWER_TAU = 0.08;         // s, smoothing of pressure and contact size
const COAST_TAU = 0.12;         // s, how quickly a flicked, lifted touch slows down
const PIN_REACH = 0.08;         // world units: a tap this close to a pin removes it
const FINGERTIP_AREA = 40 * 40; // CSS px², a typical fingertip contact

// Style that keeps the browser's own gestures off the canvas. The stylesheet sets
// some of it too; doing it here as well means the module works on any element.
const GUARD_STYLE = {
  'touch-action': 'none',
  'user-select': 'none',
  '-webkit-user-select': 'none',
  '-webkit-touch-callout': 'none',
  '-webkit-tap-highlight-color': 'transparent',
};
const BLOCKED_EVENTS = ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick', 'selectstart', 'dragstart'];

// Many devices report 0 or exactly 0.5 when they cannot measure pressure.
const realPressure = (p) => p > 0 && p !== 0.5;

function powerOf(e) {
  const type = e.pointerType;
  if (type === 'mouse') return 1;
  if (type === 'pen') return 0.15 + clamp(e.pressure || 0, 0, 1) * 1.85;
  if (realPressure(e.pressure)) return clamp(0.6 + e.pressure * 0.8, 0.6, 1.6);
  if (e.width > 1 && e.height > 1) return clamp((e.width * e.height) / FINGERTIP_AREA, 0.6, 1.6);
  return 1;
}

// Mouse: left button only. Pen: the tip, or the eraser end.
function isPress(e) {
  if (e.pointerType === 'mouse') return e.button === 0;
  if (e.pointerType === 'pen') return e.button === 0 || e.button === 5;
  return true;
}

// Event times in ms on the performance.now() clock. A few old browsers stamp events
// with the wall clock instead; those fall back to "now".
function stampOf(e) {
  const now = performance.now();
  const t = e.timeStamp;
  return Number.isFinite(t) && t > 0 && Math.abs(now - t) < 60000 ? t : now;
}

function isEditable(el) {
  if (!el || !el.tagName) return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

// Least-squares slope of the samples in the last FLICK_WINDOW_MS before `tEnd`.
// Fewer than two recent samples means the touch was resting when it was lifted.
function flickVelocity(history, tEnd) {
  const from = tEnd - FLICK_WINDOW_MS;
  let n = 0, st = 0, sx = 0, sy = 0, stt = 0, stx = 0, sty = 0;
  for (const s of history) {
    if (s.t < from) continue;
    const t = (s.t - tEnd) / 1000;
    n++; st += t; sx += s.x; sy += s.y; stt += t * t; stx += t * s.x; sty += t * s.y;
  }
  if (n < 2) return null;
  const den = n * stt - st * st;
  if (den < 1e-10) return null;
  const vx = (n * stx - st * sx) / den;
  const vy = (n * sty - st * sy) / den;
  const speed = Math.hypot(vx, vy);
  const k = speed > MAX_FLICK ? MAX_FLICK / speed : 1;
  return { vx: vx * k, vy: vy * k };
}

export function createPointers(target, { screenToWorld, getSettings }) {
  const ev = createEmitter();
  const live = new Map();     // pointerId -> touch record
  const consumed = new Set(); // pointers whose tap removed a pin: they make nothing else
  const pins = [];            // pole objects, kind 'pin'
  const fading = [];          // { pole, gone } lifted touches and removed pins
  let serial = 0;
  let pinWasOn = !!getSettings().pin;
  let pinAspect = 0;          // the screen's width / height that the pins' x was placed for

  function clientToWorld(clientX, clientY) {
    const r = target.getBoundingClientRect();
    return screenToWorld(clientX - r.left, clientY - r.top);
  }

  function aspectNow() {
    const r = target.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r.width / r.height : 0;
  }

  // The world is x = -aspect..aspect across the screen, so when the screen changes shape
  // (a phone turned) the pins' x is scaled with it: each keeps its place on the screen,
  // where it can still be seen and tapped away.
  function fitPins(aspect) {
    if (!(aspect > 0)) return;
    if (pinAspect > 0 && Math.abs(aspect - pinAspect) > 1e-4) {
      const k = aspect / pinAspect;
      for (const p of pins) p.x *= k;
    }
    pinAspect = aspect;
  }

  function fade(pole) {
    pole.held = false;
    fading.push({ pole, gone: 0 });
  }

  function nearestPin(x, y) {
    let best = -1, bestD = PIN_REACH;
    pins.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { best = i; bestD = d; }
    });
    return best;
  }

  function removePin(i) {
    const [pin] = pins.splice(i, 1);
    // letting go of a pin is its 'up': Nova releases what it gathered, sound lets go
    ev.emit('up', { x: pin.x, y: pin.y, vx: 0, vy: 0, power: pin.power, heldFor: pin.age, id: pin.id });
    fade(pin);
  }

  function pin(pole) {
    pole.kind = 'pin';
    pole.vx = 0;
    pole.vy = 0;
    // the pins already down are brought to this shape first, so all share one aspect
    fitPins(aspectNow());
    pins.push(pole);
    // over the limit the oldest pin quietly gives way
    while (pins.length > MAX_PINS) fade(pins.shift());
  }

  function capture(id) {
    try { target.setPointerCapture(id); } catch { /* the pointer is already gone */ }
  }

  // `lifting`: the event that ends a touch reports no pressure, so it keeps the last.
  function sample(rec, e, r, lifting = false) {
    const p = rec.pole;
    const t = stampOf(e);
    const moved = e.clientX !== rec.cx || e.clientY !== rec.cy;
    rec.cx = e.clientX;
    rec.cy = e.clientY;
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top);
    p.x = w.x;
    p.y = w.y;
    if (!lifting) rec.targetPower = powerOf(e);
    if (!moved) return;
    rec.still = 0;
    // Samples can share a timestamp; their movement is counted with the next one.
    const dts = (t - rec.lastT) / 1000;
    if (dts > 0) {
      const k = approach(dts, VELOCITY_TAU);
      p.vx += ((w.x - rec.lx) / dts - p.vx) * k;
      p.vy += ((w.y - rec.ly) / dts - p.vy) * k;
      rec.lastT = t;
      rec.lx = w.x;
      rec.ly = w.y;
    }
    rec.history.push({ t, x: w.x, y: w.y });
    while (rec.history.length > 2 && rec.history[0].t < t - FLICK_WINDOW_MS * 1.5) rec.history.shift();
  }

  function onDown(e) {
    if (!isPress(e)) return;
    // touching the light puts away a half-typed field and its on-screen keyboard
    if (isEditable(document.activeElement)) document.activeElement.blur();
    const old = live.get(e.pointerId);
    if (old) lift(old, null); // its 'up' never arrived
    const w = clientToWorld(e.clientX, e.clientY);

    const hit = nearestPin(w.x, w.y);
    if (hit >= 0) {
      removePin(hit);
      consumed.add(e.pointerId);
      capture(e.pointerId);
      ev.emit('activity');
      return;
    }
    if (live.size >= MAX_LIVE) return;

    const t = stampOf(e);
    const power = powerOf(e);
    const pole = { x: w.x, y: w.y, vx: 0, vy: 0, power, age: 0, held: true, id: 't' + serial++, kind: 'touch', fade: 1 };
    live.set(e.pointerId, {
      pointerId: e.pointerId, type: e.pointerType, pole,
      cx: e.clientX, cy: e.clientY,
      targetPower: power, still: 0, lastT: t, lx: w.x, ly: w.y,
      history: [{ t, x: w.x, y: w.y }],
    });
    capture(e.pointerId);
    ev.emit('activity');
    ev.emit('down', { x: w.x, y: w.y, power, id: pole.id, kind: getSettings().pin ? 'pin' : 'touch' });
  }

  function onMove(e) {
    const rec = live.get(e.pointerId);
    if (!rec) {
      if (consumed.has(e.pointerId)) ev.emit('activity');
      return;
    }
    // the left button came up somewhere we could not see
    if (rec.type === 'mouse' && !(e.buttons & 1)) { lift(rec, e); return; }
    const r = target.getBoundingClientRect();
    const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (list && list.length) for (const c of list) sample(rec, c, r);
    else sample(rec, e, r);
    ev.emit('activity');
  }

  // A touch ends: lifted, cancelled, or lost. `e` is the event that ended it, if any.
  function lift(rec, e) {
    live.delete(rec.pointerId);
    const p = rec.pole;
    let tEnd = performance.now();
    if (e) {
      tEnd = stampOf(e);
      sample(rec, e, target.getBoundingClientRect(), true);
    }
    const flick = flickVelocity(rec.history, tEnd) || { vx: 0, vy: 0 };
    p.vx = flick.vx;
    p.vy = flick.vy;
    p.power = rec.targetPower;
    if (getSettings().pin) {
      pin(p);
    } else {
      ev.emit('up', { x: p.x, y: p.y, vx: p.vx, vy: p.vy, power: p.power, heldFor: p.age, id: p.id });
      fade(p);
    }
    ev.emit('activity');
  }

  function onEnd(e) {
    const rec = live.get(e.pointerId);
    // a pointercancel can carry 0,0 for its position, so only an up moves the touch
    if (rec) lift(rec, e.type === 'pointerup' ? e : null);
    else if (consumed.delete(e.pointerId)) ev.emit('activity');
  }

  function onLostCapture(e) {
    const rec = live.get(e.pointerId);
    if (rec) lift(rec, null);
    consumed.delete(e.pointerId);
  }

  // Leaving the page (app switch, notification shade) can swallow the 'up'.
  function liftAll() {
    for (const rec of [...live.values()]) lift(rec, null);
    consumed.clear();
  }
  const onVisibility = () => { if (document.hidden) liftAll(); };
  const block = (e) => { if (e.cancelable) e.preventDefault(); };

  const savedStyle = {};
  for (const [name, value] of Object.entries(GUARD_STYLE)) {
    savedStyle[name] = target.style.getPropertyValue(name);
    target.style.setProperty(name, value);
  }
  const touchOpts = { passive: false };
  target.addEventListener('pointerdown', onDown);
  target.addEventListener('lostpointercapture', onLostCapture);
  target.addEventListener('touchstart', block, touchOpts);
  target.addEventListener('touchmove', block, touchOpts);
  for (const name of BLOCKED_EVENTS) target.addEventListener(name, block);
  // with capture these arrive from the canvas; without it (capture refused) they still bubble here
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  window.addEventListener('blur', liftAll);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    update(dt) {
      // The camera sways, so the point under a resting finger drifts across the plane;
      // casting again each frame keeps the pole under the finger.
      const r = live.size ? target.getBoundingClientRect() : null;
      for (const rec of live.values()) {
        const p = rec.pole;
        const w = screenToWorld(rec.cx - r.left, rec.cy - r.top);
        p.x = w.x;
        p.y = w.y;
        p.age += dt;
        rec.still += dt;
        if (rec.still > STILL_AFTER) {
          const k = Math.exp(-dt / VELOCITY_TAU);
          p.vx *= k;
          p.vy *= k;
        }
        p.power += (rec.targetPower - p.power) * approach(dt, POWER_TAU);
      }
      if (pins.length) fitPins(aspectNow());
      for (const p of pins) p.age += dt;
      // a lifted touch glides on along its flick, slowing, while it fades
      const k = Math.exp(-dt / COAST_TAU);
      for (let i = fading.length - 1; i >= 0; i--) {
        const f = fading[i];
        const p = f.pole;
        f.gone += dt;
        p.age += dt;
        p.x += p.vx * COAST_TAU * (1 - k);
        p.y += p.vy * COAST_TAU * (1 - k);
        p.vx *= k;
        p.vy *= k;
        p.fade = Math.max(0, 1 - f.gone / FADE_SECONDS);
        if (f.gone >= FADE_SECONDS) fading.splice(i, 1);
      }
      // switching pinning off lets go of the pins that are down
      const pinOn = !!getSettings().pin;
      if (pinWasOn && !pinOn) while (pins.length) fade(pins.shift());
      pinWasOn = pinOn;
    },

    poles() {
      const out = [];
      for (const rec of live.values()) out.push({ ...rec.pole });
      for (const p of pins) out.push({ ...p });
      for (const f of fading) out.push({ ...f.pole });
      return out;
    },

    active: () => live.size,
    pinCount: () => pins.length,
    clearPins() { while (pins.length) fade(pins.shift()); },
    on: ev.on,

    // For the keyboard: the canvas, the same screen-to-world mapping touches use,
    // and a way to announce its presses so they ring and chime like touches do.
    target,
    clientToWorld,
    relay(name, payload) {
      if (name === 'down' || name === 'up' || name === 'activity') ev.emit(name, payload);
    },

    dispose() {
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('lostpointercapture', onLostCapture);
      target.removeEventListener('touchstart', block, touchOpts);
      target.removeEventListener('touchmove', block, touchOpts);
      for (const name of BLOCKED_EVENTS) target.removeEventListener(name, block);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', liftAll);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const [name, value] of Object.entries(savedStyle)) {
        if (value) target.style.setProperty(name, value);
        else target.style.removeProperty(name);
      }
      live.clear();
      consumed.clear();
      pins.length = 0;
      fading.length = 0;
    },
  };
}
