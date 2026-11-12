// The engine's light per speck and its clock for the shaders: pure helpers, so the numbers
// that decide how the light looks over long trails, at high refresh rates and after hours of
// play are checked without a GPU.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { speckLight, KEEP_MAX } from '../../src/renderer/engine/light.js';
import { createShaderClock } from '../../src/renderer/engine/clock.js';

const HALF_FLOAT_STEP = 1 - 2 ** -11; // a half float times anything above this no longer decays
const desktop = (trails, hz = 60, extra = {}) => speckLight({ width: 1920, height: 1080, count: 20e6, size: 1, trails, dt: 1 / hz, level: 0, ...extra });
// how long trails really last: the time constant of the fade that `keep` per frame makes
const tauOf = (keep, hz) => -1 / hz / Math.log(keep);

describe('speckLight: how bright one speck may get', () => {
  test('with no trails a speck may reach twice its resting light, as before', () => {
    const l = desktop(0);
    assert.ok(Math.abs(l.energyCap / l.energy - 2) < 1e-9, String(l.energyCap / l.energy));
  });

  // Mobile caps a speck at 24000 / N, which does not shrink as trails lengthen; on a phone
  // that is about 25 times a speck's light at trails 0.5 and 50 at 0.8. Hot light and
  // sparkle peaks need several times a resting speck's light, so a cap at 2 flattened them.
  test('with longer trails the cap grows the way the mobile edition\'s does', () => {
    const half = desktop(0.5);
    const long = desktop(0.8);
    // mobile on a phone (1080 x 2400, 262k particles): 25.2 times at trails 0.5, 50.1 at 0.8
    const r5 = half.energyCap / half.energy;
    const r8 = long.energyCap / long.energy;
    assert.ok(r5 > 20 && r5 < 30, `trails 0.5: ${r5}`);
    assert.ok(r8 > 40 && r8 < 60, `trails 0.8: ${r8}`);
    // a hot speck at a sparkle peak asks for about 7 times its resting light
    assert.ok(r5 > 6.93);
    // and the same on a 4K screen
    const big = desktop(0.5, 60, { width: 3840, height: 2160 });
    assert.ok(big.energyCap / big.energy > 20);
  });

  test('at small counts mobile\'s own cap still applies when it is the larger', () => {
    const l = speckLight({ width: 800, height: 500, count: 2000, size: 1, trails: 0, dt: 1 / 60 });
    assert.equal(l.energyCap, 24000 / 2000);
  });

  test('the light per frame still evens out over the trails (keep and trailNorm agree)', () => {
    for (const trails of [0.2, 0.5, 1]) {
      const l = desktop(trails);
      assert.ok(Math.abs(l.trailNorm - (1 - l.keep) ** 0.8) < 1e-12);
    }
  });
});

describe('speckLight: how long trails last', () => {
  // The cap on the fade per frame was mobile's 0.994, which protects 8-bit targets. The light
  // here is rgba16float, so the cap can sit much closer to 1 and still decay.
  test('trails last as long on a 240 Hz display as at 60 Hz', () => {
    for (const trails of [0.8, 1]) {
      const t60 = tauOf(desktop(trails, 60).keep, 60);
      for (const hz of [120, 144, 240]) {
        const t = tauOf(desktop(trails, hz).keep, hz);
        assert.ok(Math.abs(t / t60 - 1) < 0.03, `trails ${trails} at ${hz} Hz: ${t.toFixed(3)} s against ${t60.toFixed(3)} s`);
      }
    }
  });

  test('the fade always decays a half float', () => {
    assert.ok(KEEP_MAX < HALF_FLOAT_STEP);
    for (const hz of [30, 60, 144, 240, 500, 1000]) {
      for (const trails of [0.1, 0.5, 1]) assert.ok(desktop(trails, hz).keep <= KEEP_MAX, `${hz} Hz, trails ${trails}`);
    }
  });

  test('no trails means no fade at all', () => {
    assert.equal(desktop(0).keep, 0);
    assert.equal(desktop(0).trailNorm, 1);
  });
});

describe('createShaderClock: the time the shaders see', () => {
  const f32 = Math.fround;

  // The shaders get time as an f32. Left to grow, after a day its steps are uneven by about
  // 40% (the targets jitter) and the grain repeats every few frames.
  test('after a day and more of play, every step the shaders see is still even', () => {
    const clock = createShaderClock();
    const dt = 1 / 60;
    let last = f32(clock.time);
    let worst = 0;
    let wraps = 0;
    for (let i = 0; i < 60 * 3600 * 30; i++) {
      const t = clock.advance(dt);
      const shown = f32(t);
      if (shown < last) { wraps++; last = shown; continue; }
      worst = Math.max(worst, Math.abs((shown - last) - dt) / dt);
      last = shown;
    }
    assert.ok(worst < 0.05, `the worst step was off by ${(worst * 100).toFixed(1)}%`);
    assert.ok(wraps >= 10, `it started again ${wraps} times in 30 hours`);
  });

  test('it starts again at a scene change once it is an hour along, and never runs past two', () => {
    const clock = createShaderClock();
    clock.advance(1800, true);
    assert.equal(clock.time, 1800, 'a scene change before an hour changes nothing');
    clock.advance(1900, false);
    assert.equal(clock.time, 3700, 'past an hour, no change yet: it carries on');
    assert.equal(clock.advance(1, true), 0, 'the next scene change starts it again');
    for (let i = 0; i < 7300; i++) clock.advance(1);
    assert.ok(clock.time < 7200, `with no scene change it still starts again by two hours: ${clock.time}`);
  });

  test('the grain\'s seed stays in the range where an f32 has fine steps', () => {
    const clock = createShaderClock();
    for (let i = 0; i < 7000; i++) clock.advance(1);
    assert.ok(clock.grain >= 0 && clock.grain < 512, String(clock.grain));
    const seeds = new Set();
    for (let i = 0; i < 60; i++) {
      clock.advance(1 / 60);
      seeds.add(f32(f32(clock.grain * 13.7) % 1));
    }
    assert.equal(seeds.size, 60, 'a new grain pattern every frame');
  });
});
