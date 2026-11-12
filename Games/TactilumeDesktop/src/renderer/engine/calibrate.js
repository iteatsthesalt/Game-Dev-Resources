// The first-run benchmark: it plays the engine at rising particle counts (falling ones on a
// GPU too slow for the first), with every effect on, and picks the count that fits `budget`
// of a frame at the display's refresh rate. So whatever computer the app runs on becomes its
// own default. See docs/design.md, "Quality".
import { DEFAULT_PRESET, presetScene } from '../../../../Tactilume/src/js/core/presets.js';

const FIRST = 1 << 18;          // 262,144 particles: the first count measured
const FLOOR = 1 << 14;          // 16,384: the fewest it measures on a GPU too slow for FIRST
const WARM_UP = 2;              // frames drawn before measuring, after each change of count
const SAMPLES = 3;              // measurements per count; the median is kept
const FRAMES_PER_SAMPLE = 3;
const ROUND_TO = 1024;          // a picked count is a multiple of this, when there is room

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

// The counts to measure: FIRST, doubling each time, and the largest the engine allows.
export function ladder(max, first = FIRST) {
  const top = Math.max(1, Math.floor(max));
  const out = [];
  for (let n = Math.min(first, top); n < top; n *= 2) out.push(n);
  out.push(top);
  return out;
}

// results: [{ n, ms }], the frame time measured at each count. → the count to use.
// Frame time grows about linearly with the count, so the budget (budget × one refresh
// interval) is crossed between the largest count that fitted and the next one measured,
// and the pick is interpolated there. Measurements are noisy: a count that fitted after a
// smaller one did not is not trusted. Nothing fits: the smallest count measured. Nothing
// measured: 0.
export function pickParticles(results, refreshHz, budget = 0.7) {
  const sorted = (Array.isArray(results) ? results : [])
    .filter((r) => r && finite(r.n) && r.n > 0 && finite(r.ms) && r.ms >= 0)
    .sort((a, b) => a.n - b.n);
  if (!sorted.length) return 0;
  const limit = (1000 / Math.max(finite(refreshHz) ? refreshHz : 60, 1)) * (finite(budget) && budget > 0 ? budget : 0.7);
  const failAt = sorted.findIndex((r) => r.ms > limit);
  if (failAt === 0) return sorted[0].n;
  if (failAt < 0) return sorted[sorted.length - 1].n;
  const fit = sorted[failAt - 1];
  const over = sorted[failAt];
  const share = (limit - fit.ms) / Math.max(over.ms - fit.ms, 1e-9);
  const n = fit.n + Math.max(0, Math.min(1, share)) * (over.n - fit.n);
  const rounded = Math.floor(n / ROUND_TO) * ROUND_TO;
  return Math.min(over.n - 1, Math.max(fit.n, rounded));
}

// A stand-in for play: three touches circling the middle, two players (so team colours
// draw too), and a crossfade, so two behaviours run at once.
function playFrame(scene, k, dt) {
  const time = k * dt;
  const poles = [0, 1, 2].map((i) => {
    const a = time * 0.7 + (i * Math.PI * 2) / 3;
    return { x: Math.cos(a) * 0.5, y: Math.sin(a) * 0.5, vx: -Math.sin(a) * 0.35, vy: Math.cos(a) * 0.35, power: 1, age: time, held: true, id: `c${i}`, kind: 'touch', player: 1 + (i % 2) };
  });
  return {
    dt, time, scene, settings: { flashGuard: true, teamColors: true }, poles, fingers: 3,
    behaviour: { a: 'whirl', b: 'well', mix: 0.5 },
    audio: { level: 0.3, bass: 0.3, mid: 0.3, high: 0.3, onset: 0, beat: 0 },
    gravity: { x: 0, y: -1, z: 0 },
    players: [{ id: 1, color: [0.9, 0.62, 0] }, { id: 2, color: [0.34, 0.7, 0.91] }],
  };
}

// → { particles, results: [{ n, ms }] }. Leaves the engine at the picked count, with its
// particles back in the resting shape. `now` is the clock (a test can pass its own).
export async function calibrate(engine, { refreshHz = 60, budget = 0.7, timeLimitMs = 10000, now = () => performance.now() } = {}) {
  const start = now();
  const before = engine.stats.particles;
  const limit = (1000 / Math.max(refreshHz, 1)) * budget;
  const scene = presetScene(DEFAULT_PRESET);
  const dt = 1 / Math.max(refreshHz, 1);
  const results = [];
  let k = 0;
  // one frame, timed until the GPU has finished it
  const timed = async () => {
    const t = now();
    engine.frame(playFrame(scene, k++, dt));
    await engine.finish();
    return now() - t;
  };
  // → the median frame time at `n` particles, or null when out of time or GPU memory
  const measure = async (n) => {
    if (now() - start > timeLimitMs) return null;
    await engine.setQuality({ particles: n });
    // the GPU could not hold that many: the engine lowered its limit
    if (engine.stats.particles < n) return null;
    let last = 0;
    for (let i = 0; i < WARM_UP; i++) last = await timed();
    // far over budget: one frame says enough, and a slow GPU keeps its time for fewer
    if (last > limit * 4) {
      results.push({ n, ms: last });
      return last;
    }
    const samples = [];
    for (let s = 0; s < SAMPLES; s++) {
      let sum = 0;
      for (let i = 0; i < FRAMES_PER_SAMPLE; i++) sum += await timed();
      samples.push(sum / FRAMES_PER_SAMPLE);
    }
    const ms = median(samples);
    results.push({ n, ms });
    return ms;
  };

  const counts = ladder(engine.caps.maxParticles);
  const first = await measure(counts[0]);
  if (first !== null && first > limit) {
    // a slow GPU: fewer particles, a quarter at a time, until a count fits
    for (let n = Math.floor(counts[0] / 4); n >= FLOOR; n = Math.floor(n / 4)) {
      const ms = await measure(n);
      if (ms === null || ms <= limit) break;
    }
  } else if (first !== null) {
    for (const n of counts.slice(1)) {
      const ms = await measure(n);
      // well past the budget: larger counts would only take longer
      if (ms === null || ms > limit * 2) break;
    }
  }
  const particles = pickParticles(results, refreshHz, budget) || before;
  await engine.setQuality({ particles });
  engine.reset();
  return { particles, results };
}
