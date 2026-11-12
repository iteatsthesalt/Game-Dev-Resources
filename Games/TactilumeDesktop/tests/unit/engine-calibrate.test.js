// The first-run benchmark: the pure pick of a particle count from measured frame times, the
// ladder of counts it measures, and the benchmark loop itself, run against a fake engine
// whose frames cost a known amount on a fake clock.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pickParticles, ladder, calibrate } from '../../src/renderer/engine/calibrate.js';

const M = 1 << 20;

describe('pickParticles', () => {
  test('nothing measured gives 0', () => {
    assert.equal(pickParticles([], 60), 0);
    assert.equal(pickParticles(undefined, 60), 0);
    assert.equal(pickParticles([{ n: NaN, ms: 1 }, { n: 1000, ms: -1 }, null], 60), 0);
  });

  test('when nothing fits, the smallest count measured', () => {
    // 60 Hz at 70%: 11.67 ms
    assert.equal(pickParticles([{ n: 4 * M, ms: 30 }, { n: 2 * M, ms: 20 }], 60, 0.7), 2 * M);
  });

  test('when everything fits, the largest count measured', () => {
    assert.equal(pickParticles([{ n: M, ms: 2 }, { n: 2 * M, ms: 4 }, { n: 4 * M, ms: 8 }], 60, 0.7), 4 * M);
  });

  test('between a count that fits and one that does not, it interpolates to the budget', () => {
    // 11.67 ms is 70.8% of the way from 6 ms to 14 ms
    const n = pickParticles([{ n: 4 * M, ms: 6 }, { n: 8 * M, ms: 14 }], 60, 0.7);
    assert.ok(n > 4 * M && n < 8 * M, `${n} lies between the two`);
    const expected = 4 * M + ((1000 / 60) * 0.7 - 6) / 8 * 4 * M;
    assert.ok(Math.abs(n - expected) <= 1024, `${n} is within one rounding step of ${expected}`);
    assert.equal(n % 1024, 0, 'a round number');
    // the linear model puts the pick on or under the budget
    assert.ok(6 + ((n - 4 * M) / (4 * M)) * 8 <= (1000 / 60) * 0.7 + 1e-9);
  });

  test('the order of the results does not matter', () => {
    const a = [{ n: M, ms: 3 }, { n: 2 * M, ms: 6 }, { n: 4 * M, ms: 13 }];
    assert.equal(pickParticles([...a].reverse(), 60), pickParticles(a, 60));
  });

  test('a count that fits after a smaller one did not is noise, and is not trusted', () => {
    const results = [{ n: M, ms: 5 }, { n: 2 * M, ms: 12 }, { n: 4 * M, ms: 9 }];
    const n = pickParticles(results, 60, 0.7);
    assert.ok(n >= M && n < 2 * M, `${n} stays below the first count that missed`);
  });

  test('a faster display leaves less time per frame', () => {
    const results = [{ n: M, ms: 2 }, { n: 2 * M, ms: 4 }, { n: 4 * M, ms: 8 }, { n: 8 * M, ms: 16 }];
    assert.equal(pickParticles(results, 60, 0.7), 4 * M + Math.floor(((11.666666 - 8) / 8) * 4 * M / 1024) * 1024);
    const fast = pickParticles(results, 144, 0.7); // 4.86 ms
    assert.ok(fast >= 2 * M && fast < 4 * M, `${fast} at 144 Hz`);
    assert.ok(pickParticles(results, 240, 0.5) < fast);
  });

  test('small counts are not rounded away', () => {
    assert.equal(pickParticles([{ n: 500, ms: 1 }, { n: 900, ms: 50 }], 60), 500);
  });
});

describe('ladder', () => {
  test('doubles from 262,144 and ends at the largest count allowed', () => {
    assert.deepEqual(ladder(1 << 21), [1 << 18, 1 << 19, 1 << 20, 1 << 21]);
    assert.deepEqual(ladder(67108863).slice(-2), [1 << 25, 67108863]);
    assert.equal(ladder(67108863)[0], 1 << 18);
  });
  test('a small limit is measured as it is', () => {
    assert.deepEqual(ladder(100000), [100000]);
    assert.deepEqual(ladder(0.5), [1]);
  });
});

// An engine whose frames cost `cost(n)` ms on a fake clock.
function fakeEngine({ max = 1 << 24, cost = (n) => n / M, limit = Infinity } = {}) {
  let clock = 0;
  let particles = 1 << 20;
  const calls = { setQuality: [], frames: 0, reset: 0, counts: new Set() };
  const engine = {
    clock: () => clock,
    calls,
    caps: { maxParticles: max },
    get stats() { return { particles }; },
    async setQuality({ particles: n }) {
      calls.setQuality.push(n);
      particles = Math.min(n, limit);
    },
    frame(f) {
      calls.frames++;
      calls.counts.add(particles);
      assert.ok(f.scene && Array.isArray(f.poles) && f.behaviour, 'a whole frame is drawn');
      clock += cost(particles);
    },
    async finish() {},
    reset() { calls.reset++; },
  };
  return engine;
}

describe('calibrate', () => {
  test('measures rising counts and leaves the engine at the pick, at rest', async () => {
    const engine = fakeEngine({ cost: (n) => 1 + (n / M) * 2.5 }); // 4M → 11 ms, 8M → 21 ms
    const { particles, results } = await calibrate(engine, { refreshHz: 60, budget: 0.7, now: engine.clock });
    assert.deepEqual(results.map((r) => r.n), [1 << 18, 1 << 19, 1 << 20, 1 << 21, 1 << 22, 1 << 23]);
    // each count is timed exactly, frame by frame
    for (const r of results) assert.ok(Math.abs(r.ms - (1 + (r.n / M) * 2.5)) < 1e-9);
    // 8M took 21 ms, more than twice the 11.7 ms budget, so 16M was never tried
    assert.ok(!engine.calls.counts.has(1 << 24));
    // the budget is crossed between 4M (11 ms) and 8M (21 ms)
    assert.ok(particles > 4 * M && particles < 5 * M, `picked ${particles}`);
    assert.equal(engine.calls.setQuality.at(-1), particles);
    assert.equal(engine.calls.reset, 1);
  });

  test('stops when the GPU cannot hold a count', async () => {
    const engine = fakeEngine({ cost: () => 1, limit: 3 * M });
    const { particles, results } = await calibrate(engine, { refreshHz: 60, now: engine.clock });
    assert.deepEqual(results.map((r) => r.n), [1 << 18, 1 << 19, 1 << 20, 1 << 21]);
    assert.equal(particles, 2 * M);
  });

  test('keeps to its time limit', async () => {
    const engine = fakeEngine({ cost: () => 400 });
    const { results } = await calibrate(engine, { refreshHz: 1, budget: 0.99, timeLimitMs: 10000, now: engine.clock });
    // 11 frames of 400 ms per count: 4.4 s each, so the third count starts past 10 s
    assert.equal(results.length, 3);
  });

  test('with nothing measured, the engine keeps its count', async () => {
    const engine = fakeEngine();
    const { particles, results } = await calibrate(engine, { refreshHz: 60, timeLimitMs: -1, now: engine.clock });
    assert.deepEqual(results, []);
    assert.equal(particles, 1 << 20);
  });
});
