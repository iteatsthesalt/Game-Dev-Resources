// The governor: it steps the particle count down after a run of slow frames, and up slowly
// after a long calm, without swinging back to a count that has just proved too slow.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGovernor } from '../../src/renderer/engine/governor.js';

// Plays `seconds` of frames, each `ms(t)` long (t: ms since the start of the run), from
// time `from`. → { changes: [{ at, particles }], now }
function run(gov, ms, seconds, from = 0) {
  const changes = [];
  let now = from;
  while (now < from + seconds * 1000) {
    const frame = typeof ms === 'function' ? ms(now - from) : ms;
    now += frame;
    const next = gov.update(frame, now);
    if (next !== null) changes.push({ at: now, particles: next });
  }
  return { changes, now };
}

const HZ60 = 1000 / 60;

describe('createGovernor', () => {
  test('starts at the start count, kept within min and max', () => {
    assert.equal(createGovernor({ min: 100, max: 1000, start: 500 }).particles, 500);
    assert.equal(createGovernor({ min: 100, max: 1000, start: 5 }).particles, 100);
    assert.equal(createGovernor({ min: 100, max: 1000, start: 5000 }).particles, 1000);
    assert.equal(createGovernor({ min: 100, max: 1000 }).particles, 100);
  });

  test('frames on time change nothing for the first few seconds', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 60 });
    const { changes } = run(gov, HZ60, 3.5);
    assert.deepEqual(changes, []);
    assert.equal(gov.particles, 1e5);
  });

  test('a long calm steps up slowly, and never past max', () => {
    const gov = createGovernor({ min: 1000, max: 130000, start: 100000, refreshHz: 60 });
    const { changes } = run(gov, HZ60, 30);
    assert.ok(changes.length >= 2, `${changes.length} steps up in 30 s`);
    assert.equal(changes[0].particles, 110000, 'a step up adds 10%');
    assert.ok(changes[0].at >= 4000, `the first step waits for 4 s of calm (it came at ${changes[0].at} ms)`);
    for (let i = 1; i < changes.length; i++) {
      assert.ok(changes[i].particles > changes[i - 1].particles);
      assert.ok(changes[i].at - changes[i - 1].at >= 4000, 'steps up are at least 4 s apart');
    }
    assert.equal(gov.particles, 130000);
    assert.ok(Number.isInteger(gov.particles));
  });

  test('a run of slow frames steps down within a second, down to min and no further', () => {
    const gov = createGovernor({ min: 50000, max: 1e6, start: 100000, refreshHz: 60 });
    // every frame takes 33 ms: the GPU only manages 30 frames a second
    const { changes } = run(gov, 33.3, 10);
    assert.ok(changes.length >= 1);
    assert.ok(changes[0].at <= 1000, `the first step down came at ${changes[0].at} ms`);
    assert.equal(changes[0].particles, 80000, 'a step down takes 20% off');
    assert.equal(gov.particles, 50000);
    assert.ok(changes.every((c) => c.particles >= 50000));
  });

  test('one hitch, or a few scattered slow frames, change nothing', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 60 });
    // a 120 ms hitch, then a slow frame every half second
    const { changes } = run(gov, (t) => (t > 1000 && t < 1017 ? 120 : t % 500 < 17 ? 30 : HZ60), 3.5);
    assert.deepEqual(changes, []);
  });

  test('a long pause (a hidden window) is not taken for a slow GPU', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 60 });
    let now = 0;
    for (let i = 0; i < 10; i++) {
      now += 2000;
      assert.equal(gov.update(2000, now), null);
    }
    assert.equal(gov.particles, 1e5);
  });

  test('after a few tries it settles below a count that is too slow, instead of swinging', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 100000, refreshHz: 60 });
    // too slow above 90,000 particles: frames take 25 ms there, 16.7 ms below
    const ms = () => (gov.particles > 90000 ? 25 : HZ60);
    const { changes } = run(gov, ms, 75);
    assert.equal(changes[0].particles, 80000);
    assert.ok(changes.every((c) => c.particles < 100000), JSON.stringify(changes));
    // each count that misses lowers how high it climbs next, until it stops trying
    const late = changes.filter((c) => c.at > 30000);
    assert.deepEqual(late, [], `still changing after 30 s: ${JSON.stringify(changes)}`);
    assert.ok(gov.particles > 80000 && gov.particles <= 90000, `settles at ${gov.particles}`);
  });

  test('a count that was too slow a long time ago may be tried again', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 100000, refreshHz: 60 });
    run(gov, 33, 1); // a step down: 100,000 proves too slow
    assert.equal(gov.particles, 80000);
    const { changes } = run(gov, HZ60, 120, 1000);
    assert.ok(gov.particles > 100000, `after two calm minutes it climbs past ${gov.particles}`);
    assert.ok(changes.length > 0);
  });

  test('a faster display has a shorter budget', () => {
    // 10 ms frames are fine at 60 Hz, slow at 144 Hz
    const at60 = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 60 });
    assert.deepEqual(run(at60, 10, 3).changes, []);
    const at144 = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 144 });
    const { changes } = run(at144, 10, 3);
    assert.ok(changes.length >= 1 && changes[0].particles === 80000);
  });

  test('GPU frame times well under budget count as calm too', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 60 });
    const { changes } = run(gov, 4, 5);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].particles, 110000);
  });

  test('junk input is ignored', () => {
    const gov = createGovernor({ min: 1000, max: 1e6, start: 1e5, refreshHz: 60 });
    for (const [ms, now] of [[NaN, 1], [16, NaN], [-5, 2], [Infinity, 3], [undefined, 4]]) assert.equal(gov.update(ms, now), null);
    assert.equal(gov.particles, 1e5);
  });
});
