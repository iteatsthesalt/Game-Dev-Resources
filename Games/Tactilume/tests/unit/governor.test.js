import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createGovernor, estimateRefresh, guessTier, TIERS, MODES } from '../../src/js/core/governor.js';

const MAX = 1 << 20;
const repeat = (ms, n) => Array(n).fill(ms);

// Feeds the governor `seconds` of frames. `interval` is a fixed frame time in ms, or a
// function of the governor (a stand-in for a GPU whose cost grows with the particle count).
// Returns how many times the targets changed and the extremes seen along the way.
function play(gov, seconds, interval) {
  let t = 0, changes = 0, minP = Infinity, maxP = -Infinity, minS = Infinity, maxS = -Infinity;
  while (t < seconds * 1000) {
    const ms = typeof interval === 'function' ? interval(gov) : interval;
    if (gov.sample(ms)) changes++;
    t += ms;
    minP = Math.min(minP, gov.particles); maxP = Math.max(maxP, gov.particles);
    minS = Math.min(minS, gov.renderScale); maxS = Math.max(maxS, gov.renderScale);
  }
  return { changes, minP, maxP, minS, maxS };
}

describe('estimateRefresh', () => {
  test('snaps to common display rates', () => {
    assert.equal(estimateRefresh(repeat(16.7, 30)), 60);
    assert.equal(estimateRefresh(repeat(8.3, 30)), 120);
    assert.equal(estimateRefresh(repeat(11.1, 30)), 90);
    assert.equal(estimateRefresh(repeat(6.94, 30)), 144);
    assert.equal(estimateRefresh(repeat(33.3, 30)), 30);
  });

  test('copes with jitter and ignores outliers', () => {
    const jittery = Array.from({ length: 60 }, (_, i) => 16.67 + ((i * 7) % 5 - 2) * 0.4);
    const spiky = jittery.concat([0.5, 1, 250, 900, 3000, 45, 50, 0, -3, NaN]);
    assert.equal(estimateRefresh(jittery), 60);
    assert.equal(estimateRefresh(spiky), 60);
    assert.equal(estimateRefresh(repeat(8.33, 40).concat(repeat(500, 10), repeat(1, 10))), 120);
  });

  test('assumes 60 until there are enough samples', () => {
    assert.equal(estimateRefresh([]), 60);
    assert.equal(estimateRefresh(repeat(8.3, 7)), 60);
    assert.equal(estimateRefresh(repeat(500, 30)), 60, 'all outliers');
  });
});

describe('createGovernor', () => {
  test('starts within its limits', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    assert.equal(g.particles, 1 << 19);
    assert.equal(g.renderScale, 1);
    assert.equal(g.mode, 'auto');
    assert.equal(createGovernor({ maxParticles: MAX, startParticles: 10 }).particles, 8192, 'raised to the minimum');
    assert.equal(createGovernor({ maxParticles: MAX, startParticles: 1e9 }).particles, MAX, 'lowered to the maximum');
    assert.equal(createGovernor({ maxParticles: MAX, startParticles: 1 << 19, startScale: 0.1 }).renderScale, 0.5);
  });

  test('an unknown starting mode reads back as auto, as setMode does', () => {
    assert.equal(createGovernor({ maxParticles: MAX, startParticles: 1 << 19, mode: 'nonsense' }).mode, 'auto');
  });

  test('lowers detail when frames are consistently slow', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    const r = play(g, 5, 60); // about 16 frames a second
    assert.ok(r.changes > 0, 'it reacted');
    assert.ok(g.particles < 1 << 19, `particles ${g.particles}`);
  });

  test('lowers detail when a 60 Hz display drops to 25 frames a second', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    play(g, 2, 16.7); // a 60 Hz display, keeping up
    const before = g.particles;
    play(g, 10, 40);
    assert.ok(g.particles < before, `particles ${before} -> ${g.particles}`);
  });

  test('settles at the display rate when it starts with more than the device can draw', () => {
    // a GPU that needs 25 ms per million particles, shown on a 60 Hz display
    const vsync = 1000 / 60;
    const cost = (g) => Math.max(1, Math.ceil(((g.particles / 1e6) * 25) / vsync)) * vsync;
    const g = createGovernor({ maxParticles: MAX, startParticles: MAX });
    play(g, 60, cost);
    assert.equal(cost(g), vsync, `stuck at ${g.particles} particles, ${cost(g).toFixed(1)} ms per frame`);
  });

  test('raises detail when frames are fast', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 18 });
    const r = play(g, 30, 16.7);
    assert.ok(r.changes > 0);
    assert.ok(g.particles > 1 << 18, `particles ${g.particles}`);
  });

  test('never goes below the minimum or above the maximum', () => {
    const slow = createGovernor({ maxParticles: MAX, startParticles: MAX, minParticles: 20000 });
    const a = play(slow, 120, 90);
    assert.ok(a.minP >= 20000, `particles went down to ${a.minP}`);
    assert.ok(a.minS >= 0.5, `scale went down to ${a.minS}`);
    assert.equal(slow.particles, 20000, 'it gets to the floor in two minutes');

    const fast = createGovernor({ maxParticles: MAX, startParticles: 10000, startScale: 0.5 });
    const b = play(fast, 600, 8);
    assert.ok(b.maxP <= MAX, `particles went up to ${b.maxP}`);
    assert.ok(b.maxS <= 1, `scale went up to ${b.maxS}`);
    assert.equal(fast.particles, MAX, 'it gets to the ceiling in ten minutes');
    assert.equal(fast.renderScale, 1);
  });

  for (const mode of ['battery', 'balanced']) {
    test(`${mode} mode keeps to its ceilings`, () => {
      const { maxShare, maxScale } = MODES[mode];
      const g = createGovernor({ maxParticles: MAX, startParticles: MAX, mode });
      assert.ok(g.particles <= MAX * maxShare + 1, 'starts under the ceiling');
      assert.ok(g.renderScale <= maxScale);
      const r = play(g, 300, 4);
      assert.ok(r.maxP <= Math.round(MAX * maxShare), `${r.maxP} particles`);
      assert.ok(r.maxS <= maxScale + 1e-9, `scale ${r.maxS}`);
    });
  }

  test('battery mode aims for 30 frames a second', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 18, mode: 'battery' });
    const before = g.particles;
    play(g, 20, 30); // 33 fps is plenty in battery mode: no reason to cut
    assert.ok(g.particles >= before);
  });

  test('setMode applies the new ceilings at once', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: MAX });
    g.setMode('battery');
    assert.equal(g.mode, 'battery');
    assert.ok(g.particles <= MAX * MODES.battery.maxShare + 1);
    assert.ok(g.renderScale <= MODES.battery.maxScale);
    g.setMode('max');
    assert.equal(g.particles, MAX);
    assert.equal(g.renderScale, 1);
    g.setMode('bogus');
    assert.equal(g.mode, 'auto');
  });

  test('max mode never changes anything', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 300000, mode: 'max' });
    const r = play(g, 20, 100);
    assert.equal(r.changes, 0);
    assert.equal(g.particles, 300000);
  });

  test('freeze stops changes and unfreezing resumes them', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    g.freeze(true);
    const r = play(g, 20, 80);
    assert.equal(r.changes, 0);
    assert.equal(g.particles, 1 << 19);
    g.freeze(false);
    play(g, 20, 80);
    assert.ok(g.particles < 1 << 19);
  });

  test('learns the refresh rate as it goes', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    play(g, 2, 8.33);
    assert.equal(g.refreshHz, 120);
  });

  test('a 60 cap on a 90 Hz display is met, not mistaken for slow frames', () => {
    // with the cap paced by deadline, frames come one vsync then two: 11.1 ms, 22.2 ms, ...
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    g.setCap(60);
    const vsync = 1000 / 90;
    let i = 0;
    const r = play(g, 30, () => (i++ % 2 ? 2 * vsync : vsync));
    assert.equal(r.minP, 1 << 19, `particles fell to ${r.minP}`);
    assert.equal(r.minS, 1, `render scale fell to ${r.minS}`);
    assert.equal(g.cap, 60);
  });

  test('under a 30 cap, frames that miss it still lower detail', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    g.setCap(30);
    const before = g.particles;
    play(g, 10, 50);
    assert.ok(g.particles < before, `particles ${before} -> ${g.particles}`);
  });

  test('a single long hitch does not lower detail', () => {
    const g = createGovernor({ maxParticles: MAX, startParticles: 1 << 19 });
    play(g, 2, 16.7);
    const before = g.particles;
    for (const ms of [...repeat(16.7, 60), 400, ...repeat(16.7, 60)]) {
      g.sample(ms);
      assert.ok(g.particles >= before, `dropped to ${g.particles}`);
    }
  });
});

describe('guessTier', () => {
  test('software renderers are low', () => {
    for (const renderer of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver',
    ]) assert.equal(guessTier({ renderer, deviceMemory: 16, cores: 16, maxTextureSize: 16384 }), 'low', renderer);
  });

  test('a desktop graphics card without touch is ultra', () => {
    for (const renderer of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Apple M2 Max',
    ]) assert.equal(guessTier({ renderer, touch: false }), 'ultra', renderer);
    assert.equal(guessTier({ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630)', deviceMemory: 8, cores: 8 }), 'ultra', 'a strong machine with integrated graphics');
  });

  test('touch devices are never ultra', () => {
    assert.notEqual(guessTier({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080)', touch: true, deviceMemory: 8, cores: 8 }), 'ultra');
  });

  test('recent phone GPUs are high', () => {
    for (const renderer of ['Adreno (TM) 740', 'Adreno (TM) 830', 'Mali-G715', 'Mali-G720 Immortalis MC12', 'Samsung Xclipse 940', 'Apple GPU']) {
      assert.equal(guessTier({ renderer, touch: true, deviceMemory: 8, cores: 8 }), 'high', renderer);
    }
  });

  test('old or small phones are low', () => {
    assert.equal(guessTier({ renderer: 'Adreno (TM) 506', touch: true, deviceMemory: 3, cores: 8 }), 'low');
    assert.equal(guessTier({ renderer: 'Mali-T830', touch: true, deviceMemory: 3, cores: 8 }), 'low');
    assert.equal(guessTier({ renderer: 'PowerVR Rogue GE8320', touch: true, deviceMemory: 3, cores: 8 }), 'low');
    assert.equal(guessTier({ renderer: 'Adreno (TM) 660', touch: true, deviceMemory: 2, cores: 8 }), 'low');
  });

  test('anything else is mid', () => {
    assert.equal(guessTier({ renderer: 'Adreno (TM) 660', touch: true, deviceMemory: 6, cores: 8 }), 'mid');
    assert.equal(guessTier({ renderer: '', touch: true, deviceMemory: 4, cores: 8 }), 'mid');
  });

  test('tiers allocate more than they start with, in rising order', () => {
    const order = ['low', 'mid', 'high', 'ultra'];
    assert.deepEqual(Object.keys(TIERS).sort(), [...order].sort());
    order.forEach((t, i) => {
      assert.ok(TIERS[t].start <= TIERS[t].max, t);
      if (i) assert.ok(TIERS[t].max > TIERS[order[i - 1]].max, t);
    });
  });
});
