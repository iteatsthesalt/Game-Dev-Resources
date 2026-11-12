// renderer/ui/tier.js: which of docs/design.md's requirement tiers a measured count meets.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { requirementTier, TIERS } from '../../src/renderer/ui/tier.js';

const tier = (particles, refreshHz = 60) => requirementTier({ particles, refreshHz })?.key ?? null;

describe('requirementTier', () => {
  test('the four tiers of docs/design.md, in order', () => {
    assert.deepEqual(TIERS.map((t) => t.name), ['Minimum', 'Standard', 'Reference', 'Ultra']);
  });

  test('a count measured at 60 Hz meets the tier its range starts in', () => {
    assert.equal(tier(500e3), 'below');
    assert.equal(tier(1e6), 'minimum');
    assert.equal(tier(3e6), 'minimum');
    assert.equal(tier(5e6), 'standard');
    assert.equal(tier(12e6), 'standard');
    assert.equal(tier(15e6), 'reference');
    assert.equal(tier(29e6), 'reference');
    assert.equal(tier(30e6), 'ultra');
  });

  test('a faster display counts the frames it draws: 15M at 144 Hz is Ultra', () => {
    assert.equal(tier(15e6, 144), 'ultra');
    assert.equal(tier(15e6, 240), 'ultra');
    assert.equal(tier(8e6, 120), 'reference');
  });

  test('nothing measured yet is no tier', () => {
    assert.equal(requirementTier({ particles: 0, refreshHz: 60 }), null);
    assert.equal(requirementTier({ particles: NaN }), null);
  });

  test('each tier says what it means, in words', () => {
    const t = requirementTier({ particles: 20e6, refreshHz: 60 });
    assert.equal(t.name, 'Reference');
    assert.match(t.text, /Reference/);
    assert.match(t.text, /15/);
    assert.match(requirementTier({ particles: 2e5, refreshHz: 60 }).text, /below/i);
  });
});
