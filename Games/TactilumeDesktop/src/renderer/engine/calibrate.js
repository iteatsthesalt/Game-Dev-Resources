// The first-run benchmark: runs the engine at rising particle counts and picks the count
// that fits `budget` of a frame at the display's refresh rate.
//
// First version, written by the spine: the pure picker is real, the measuring is not yet.
// The engine part owns this file and replaces it.

// results: [{ n, ms }] → the largest n whose frame took at most budget × one refresh
// interval; the smallest n measured when none fits; 0 when nothing was measured.
export function pickParticles(results, refreshHz, budget = 0.7) {
  if (!results.length) return 0;
  const limit = (1000 / Math.max(refreshHz, 1)) * budget;
  const fits = results.filter((r) => r.ms <= limit).map((r) => r.n);
  return fits.length ? Math.max(...fits) : Math.min(...results.map((r) => r.n));
}

// → { particles, results: [{ n, ms }] }
export async function calibrate(engine, { refreshHz = 60, budget = 0.7, timeLimitMs = 10000 } = {}) {
  return { particles: engine.stats.particles, results: [] };
}
