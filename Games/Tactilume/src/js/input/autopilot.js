// Plays by itself when nobody is touching (see CONTRACTS.md).
//
// Each pole follows its own sum of slow sines per axis, with seeded frequencies, so
// paths never repeat and never leave the middle 80% of the screen. The number of
// poles wanders between one and five, one change at a time and never sooner than
// four seconds after the last, so the behaviour table changes gracefully. Every
// choice comes from one seeded generator: the same seed and the same calls give the
// same performance.

import { smoothstep, mulberry32 } from '../core/util.js';

const MIN_COUNT = 1;
const MAX_COUNT = 5;
// How often each count is played, in the long run (index = count): mostly one to three.
const COUNT_WEIGHT = [0, 0.26, 0.3, 0.24, 0.12, 0.08];
const CHANGE_EVERY = [4, 9];  // s between chances to add or remove a pole
const TAP_EVERY = [6, 14];    // s between taps (age back to 0: rings and chimes)
const FADE_IN = 1.5;          // s
const FADE_OUT = 1.5;         // s
const FREQ = [0.03, 0.17];    // Hz, per sine
const REACH = 0.8;            // share of the half-screen a path may cover
const RESUME_GAP = 0.5;       // s of missed calls after which play starts afresh
const MAX_DT = 0.25;
const TAU = Math.PI * 2;

export function createAutopilot({ seed = 1 } = {}) {
  let rng, clock, serial, voices, nextChange, nextTap, lastTime;

  const between = ([lo, hi]) => lo + rng() * (hi - lo);

  // 2 or 3 sines whose amplitudes add up to at most REACH, so |value| <= REACH.
  function axis() {
    const n = rng() < 0.5 ? 2 : 3;
    const reach = REACH * (0.65 + 0.35 * rng());
    const parts = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const weight = 0.35 + rng();
      parts.push({ w: TAU * between(FREQ), phase: rng() * TAU, amp: weight });
      sum += weight;
    }
    for (const p of parts) p.amp *= reach / sum;
    return parts;
  }

  function voice() {
    return { id: 'a' + serial++, px: axis(), py: axis(), ageFrom: clock, state: 'in', since: clock };
  }

  function evaluate(parts, t) {
    let v = 0, d = 0;
    for (const p of parts) {
      const a = p.w * t + p.phase;
      v += p.amp * Math.sin(a);
      d += p.amp * p.w * Math.cos(a);
    }
    return [v, d];
  }

  const staying = () => voices.filter((v) => v.state !== 'out');

  // One step of a Metropolis walk over the counts: it settles on COUNT_WEIGHT in the
  // long run, and only ever moves by one.
  function maybeChange() {
    const here = staying();
    const n = here.length;
    const m = n + (rng() < 0.5 ? 1 : -1);
    const accept = rng();
    if (m < MIN_COUNT || m > MAX_COUNT || accept >= Math.min(1, COUNT_WEIGHT[m] / COUNT_WEIGHT[n])) return;
    if (m > n) {
      voices.push(voice());
    } else {
      // the longest-playing pole bows out
      const leaving = here.reduce((a, b) => (b.ageFrom < a.ageFrom ? b : a));
      leaving.state = 'out';
      leaving.since = clock;
    }
  }

  function tap() {
    const ready = voices.filter((v) => v.state === 'on');
    if (ready.length) ready[Math.floor(rng() * ready.length)].ageFrom = clock;
  }

  // After a pause (someone played, then left) the poles fade back in rather than
  // reappearing at full strength where the timeline had got to.
  function resume() {
    voices = voices.filter((v) => v.state !== 'out');
    if (!voices.length) voices.push(voice());
    for (const v of voices) {
      v.state = 'in';
      v.since = clock;
      v.ageFrom = clock;
    }
    nextChange = clock + between(CHANGE_EVERY);
    nextTap = clock + between(TAP_EVERY);
  }

  function reset() {
    rng = mulberry32(seed);
    clock = 0;
    serial = 0;
    voices = [];
    voices.push(voice());
    nextChange = between(CHANGE_EVERY);
    nextTap = between(TAP_EVERY);
    lastTime = null;
  }

  reset();

  return {
    update(dt, time, aspect) {
      const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, MAX_DT) : 0;
      const asp = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
      if (lastTime !== null && Number.isFinite(time) && time - lastTime > RESUME_GAP) resume();
      if (Number.isFinite(time)) lastTime = time;
      clock += step;

      if (clock >= nextChange) {
        maybeChange();
        nextChange = clock + between(CHANGE_EVERY);
      }
      if (clock >= nextTap) {
        tap();
        nextTap = clock + between(TAP_EVERY);
      }

      const out = [];
      voices = voices.filter((v) => !(v.state === 'out' && clock - v.since >= FADE_OUT));
      for (const v of voices) {
        if (v.state === 'in' && clock - v.since >= FADE_IN) v.state = 'on';
        const [x, vx] = evaluate(v.px, clock);
        const [y, vy] = evaluate(v.py, clock);
        const t = clock - v.since;
        const power = v.state === 'in' ? smoothstep(0, FADE_IN, t) : v.state === 'out' ? 1 - smoothstep(0, FADE_OUT, t) : 1;
        out.push({
          x: x * asp, y, vx: vx * asp, vy,
          power, fade: power,
          age: clock - v.ageFrom,
          held: v.state !== 'out',
          id: v.id,
          kind: 'auto',
        });
      }
      return out;
    },

    reset,
  };
}
