// Which way gravity pulls, from the device's motion sensors (see CONTRACTS.md).
//
// The answer is in world space: x to the right of the screen as it is shown now, y up
// it, z out of it toward the viewer. Held upright it is {0, -1, 0}; lying flat it is
// {0, 0, -1}, pointing into the screen, so the light pools instead of sliding.
//
// accelerationIncludingGravity reacts fastest, so it is preferred. It points away
// from gravity by the specification, but some browsers report it with the opposite
// sign; where orientation angles are also available they settle which it is.

import { approach, smoothstep } from '../core/util.js';

const SMOOTH_TAU = 0.12;        // s
const FIRST_READING_MS = 1000;  // no reading by then: this device has no tilt to offer
const ORIENTATION_FRESH = 250;  // ms an orientation reading is trusted for
const MOTION_FRESH = 300;       // ms; after that, orientation angles take over
const GRAVITY = 9.80665;
const STILL_ENOUGH = 2;         // m/s² from 1 g: steady enough to compare with orientation
const SIGN_VOTES = 4;           // agreeing readings needed to decide the sign
const LEVEL = [0.035, 0.1];     // sideways share of gravity: below about 2° counts as flat, full by about 6°
const DEG = Math.PI / 180;
const DOWN = Object.freeze({ x: 0, y: -1, z: 0 });

const num = (v) => typeof v === 'number' && Number.isFinite(v);

// Degrees the screen is turned from the device's natural orientation, counter-clockwise.
function screenAngle() {
  try {
    const a = screen.orientation && screen.orientation.angle;
    if (num(a)) return a;
  } catch { /* not offered */ }
  const legacy = window.orientation;
  return num(legacy) ? legacy : 0;
}

// Asks for sensor access where the browser offers to (iOS, recent Chrome). Calling it
// starts the request at once, so it must happen inside the tap that asked for tilt.
// Only a clear no counts as one: Chrome can answer 'prompt' and still deliver
// readings, so anything else is settled by whether readings actually arrive.
function ask(Sensor) {
  if (!Sensor) return Promise.resolve(false);
  if (typeof Sensor.requestPermission !== 'function') return Promise.resolve(true);
  try {
    return Promise.resolve(Sensor.requestPermission()).then((r) => r !== 'denied', () => false);
  } catch {
    return Promise.resolve(false);
  }
}

export function createTilt() {
  let enabled = false;
  let listening = false;
  let pending = null;
  let generation = 0;     // bumped by disable(), so a late answer does not switch tilt back on
  let firstReading = null; // resolves the wait in enable()
  let smooth = null;      // world-space gravity, smoothed, roughly unit length
  let lastFeed = 0;
  let motionAt = -Infinity;
  let orientation = null; // { g: device-space gravity, at }
  let sign = 1;           // 1: motion follows the specification; -1: the opposite
  let votes = 0;

  // device axes (natural orientation) -> screen axes as the screen is turned now
  function feed(gx, gy, gz) {
    const a = screenAngle() * DEG;
    const c = Math.cos(a), s = Math.sin(a);
    const x = c * gx - s * gy;
    const y = s * gx + c * gy;
    const now = performance.now();
    if (!smooth) {
      smooth = { x, y, z: gz };
    } else {
      const k = approach(Math.min((now - lastFeed) / 1000, 0.1), SMOOTH_TAU);
      smooth.x += (x - smooth.x) * k;
      smooth.y += (y - smooth.y) * k;
      smooth.z += (gz - smooth.z) * k;
    }
    lastFeed = now;
    if (firstReading) firstReading(true);
  }

  // Lying more flat than upright, the sign of z alone tells up from down whatever
  // the browser's conventions for the angles are, so only those readings vote.
  function checkSign(gz, length, now) {
    if (!orientation || now - orientation.at > ORIENTATION_FRESH) return;
    if (Math.abs(length - GRAVITY) > STILL_ENOUGH || Math.abs(orientation.g.z) < 0.5 || Math.abs(gz) < 0.5) return;
    const agree = Math.sign(gz) === Math.sign(orientation.g.z);
    votes = Math.max(-SIGN_VOTES, Math.min(SIGN_VOTES, votes + (agree === (sign === 1) ? 1 : -1)));
    if (votes <= -SIGN_VOTES) {
      sign = -sign;
      votes = 0;
    }
  }

  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || !num(a.x) || !num(a.y) || !num(a.z)) return;
    const length = Math.hypot(a.x, a.y, a.z);
    if (length < 0.5) return; // a sensor that is still waking up reports zeros
    const now = performance.now();
    // by the specification the reading points away from gravity
    const gx = -a.x / length, gy = -a.y / length, gz = -a.z / length;
    checkSign(gz, length, now);
    motionAt = now;
    feed(gx * sign, gy * sign, gz * sign);
  }

  function onOrientation(e) {
    if (!num(e.beta) || !num(e.gamma)) return;
    const b = e.beta * DEG, g = e.gamma * DEG;
    // gravity (0, 0, -1) in the earth frame, seen from the device after its
    // beta (about x) and gamma (about y) turns; alpha turns about gravity itself
    const gd = { x: Math.sin(g) * Math.cos(b), y: -Math.sin(b), z: -Math.cos(g) * Math.cos(b) };
    const now = performance.now();
    orientation = { g: gd, at: now };
    if (now - motionAt > MOTION_FRESH) feed(gd.x, gd.y, gd.z);
  }

  function listen(motion, orient) {
    if (listening) return;
    listening = true;
    if (motion) window.addEventListener('devicemotion', onMotion);
    if (orient) window.addEventListener('deviceorientation', onOrientation);
  }

  function stopListening() {
    listening = false;
    window.removeEventListener('devicemotion', onMotion);
    window.removeEventListener('deviceorientation', onOrientation);
  }

  function waitForReading() {
    return new Promise((resolve) => {
      const timer = setTimeout(() => done(false), FIRST_READING_MS);
      function done(ok) {
        clearTimeout(timer);
        firstReading = null;
        resolve(ok);
      }
      firstReading = done;
      if (smooth) done(true);
    });
  }

  return {
    enable() {
      if (enabled) return Promise.resolve(true);
      if (pending) return pending;
      let Motion = null, Orientation = null;
      try {
        Motion = window.DeviceMotionEvent || null;
        Orientation = window.DeviceOrientationEvent || null;
      } catch { /* not offered */ }
      if (!Motion && !Orientation) return Promise.resolve(false);
      const ticket = generation;
      // both asks start now, inside the tap; iOS shows one prompt for the pair
      const asks = [ask(Motion), ask(Orientation)];
      pending = Promise.all(asks)
        .then(([motion, orient]) => {
          if (ticket !== generation || (!motion && !orient)) return false;
          // iOS shares one permission between the two, and a second ask can be turned
          // down only for coming after the tap; the angles settle the motion sign, so
          // listen for them whenever the browser has them
          listen(motion, !!Orientation);
          return waitForReading();
        })
        .catch((err) => {
          console.warn('Tactilume: tilt could not start', err);
          return false;
        })
        .then((ok) => {
          if (ticket !== generation) return false; // disable() came first and cleaned up
          pending = null;
          if (ok) enabled = true;
          else stopListening();
          return ok;
        });
      return pending;
    },

    disable() {
      generation++;
      enabled = false;
      pending = null;
      if (firstReading) firstReading(false);
      stopListening();
      smooth = null;
      orientation = null;
      motionAt = -Infinity;
    },

    vector() {
      if (!enabled || !smooth) return { ...DOWN };
      const length = Math.hypot(smooth.x, smooth.y, smooth.z);
      if (length < 1e-3) return { ...DOWN };
      let x = smooth.x / length, y = smooth.y / length, z = smooth.z / length;
      // near level, the sideways part eases to nothing so the light rests in the middle
      const side = Math.hypot(x, y);
      const keep = smoothstep(LEVEL[0], LEVEL[1], side);
      if (keep < 1) {
        x *= keep;
        y *= keep;
        z = (z < 0 ? -1 : 1) * Math.sqrt(Math.max(0, 1 - (side * keep) ** 2));
      }
      return { x, y, z };
    },
  };
}
