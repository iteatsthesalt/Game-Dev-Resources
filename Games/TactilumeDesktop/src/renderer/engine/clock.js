// The time the shaders see. Simulated time only grows, and the shaders get it as an f32:
// after hours of idle autoplay its steps turn uneven (about 40% after a day, so time-driven
// targets jitter) and the composite's grain, seeded from fract(time * 13.7), cycles through a
// handful of patterns. So the shaders get a clock that starts again from 0:
//   - at the next scene change once it is an hour along (the form changes then anyway, so
//     the jump in rotation, flow and leaders' paths goes unseen), or
//   - at two hours whatever happens, where an f32 step is still under 0.5 ms.
// Pure, so tests/unit/engine-light.test.js checks it.

export const WRAP_AFTER = 3600;   // s: from here a scene change starts the clock again
export const WRAP_BY = 7200;      // s: it never runs past this

export function createShaderClock({ wrapAfter = WRAP_AFTER, wrapBy = WRAP_BY } = {}) {
  let t = 0;
  return {
    // `dt`: simulated seconds this frame; `sceneChanged`: the form changed this frame.
    // → the time to give the shaders.
    advance(dt, sceneChanged = false) {
      t += Number.isFinite(dt) && dt > 0 ? dt : 0;
      if (t >= wrapBy || (sceneChanged && t >= wrapAfter)) t = 0;
      return t;
    },
    get time() { return t; },
    // the composite's seed for grain and dither: kept under 512 s, where fract(time * 13.7)
    // still has fine steps, and where it starts again nobody can see (grain is new each frame)
    get grain() { return t % 512; },
  };
}
