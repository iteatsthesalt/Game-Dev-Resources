// Keeps the motion smooth while the app runs by changing the particle count: it steps down
// after a run of slow frames, and steps up slowly after a long calm. Pure (time comes in as
// an argument), so it is unit-tested in tests/unit/engine-governor.test.js.
//
// update(frameMs, now) takes how long the last frame took. That may be the time between
// display frames (vsync-paced, so it never shows headroom directly: a calm stretch with no
// slow frame is the sign of room to spare) or the GPU's own time per frame (where it does).
// Either way a step up is small, and a count that has just proved too slow is not tried
// again for a while, so the count does not swing up and down.

const SLOW = 1.25;            // a frame over 1.25 refresh intervals is a slow (missed) frame
const STRAIN_LIMIT = 6;       // slow frames, net of fast ones, before stepping down
const RECOVERY = 0.25;        // each frame on time takes this much strain off
const STEP_DOWN = 0.8;
const STEP_UP = 1.1;
const CALM_MS = 4000;         // no slow frame for this long before a step up
const SETTLE_DOWN_MS = 1000;  // frames right after a change are not judged
const SETTLE_UP_MS = 1500;
const CEILING_MS = 60000;     // how long a count that was too slow is remembered
const PAUSE_MS = 250;         // a gap this long is a pause (hidden window, dialog), not a slow GPU

const finite = (x) => typeof x === 'number' && Number.isFinite(x);

export function createGovernor({ min = 1, max = Infinity, start = min, refreshHz = 60 } = {}) {
  const lo = Math.max(1, Math.round(finite(min) ? min : 1));
  const hi = Math.max(lo, finite(max) ? Math.floor(max) : Infinity);
  let particles = Math.min(Math.max(Math.round(finite(start) ? start : lo), lo), hi);
  const hz = Math.min(Math.max(finite(refreshHz) ? refreshHz : 60, 20), 500);
  const budget = 1000 / hz;
  let strain = 0;
  let calmSince = null;        // when the last slow frame (or change, or pause) was
  let settleUntil = -Infinity;
  let ceiling = Infinity;      // the lowest count that recently proved too slow
  let ceilingAt = -Infinity;

  return {
    get particles() { return particles; },
    get refreshHz() { return hz; },

    // frameMs: how long the last frame took; now: a clock in ms.
    // → the new particle count, or null for no change.
    update(frameMs, now) {
      if (!finite(frameMs) || !finite(now) || frameMs < 0) return null;
      if (calmSince === null) calmSince = now;
      if (frameMs > PAUSE_MS) { calmSince = now; return null; }
      if (now < settleUntil) return null;
      if (now - ceilingAt > CEILING_MS) ceiling = Infinity;

      const slow = frameMs > budget * SLOW;
      strain = slow ? strain + 1 : Math.max(0, strain - RECOVERY);
      if (slow) calmSince = now;

      if (strain >= STRAIN_LIMIT) {
        strain = 0;
        if (particles <= lo) return null;
        ceiling = Math.min(ceiling, particles);
        ceilingAt = now;
        particles = Math.max(lo, Math.floor(particles * STEP_DOWN));
        settleUntil = now + SETTLE_DOWN_MS;
        calmSince = now;
        return particles;
      }

      if (now - calmSince >= CALM_MS && particles < hi) {
        calmSince = now;
        // a little more, but stay clear of a count that was too slow not long ago
        const next = Math.min(hi, Math.round(particles * STEP_UP), Math.floor(ceiling * 0.95));
        if (next > particles) {
          particles = next;
          settleUntil = now + SETTLE_UP_MS;
          return particles;
        }
      }
      return null;
    },
  };
}
