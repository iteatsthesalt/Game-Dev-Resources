// Where a gamepad cursor's name is drawn (src/renderer/ui/cursors.js, labelPlace). Found by
// the integration play-through: a cursor pushed to the window's right edge had its name
// ("Pad 1 R") cut in half, because the name was always centred under the ring.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { labelPlace } from '../../src/renderer/ui/cursors.js';

const W = 1000, H = 600;
const inside = (at, textWidth) => at.x - textWidth / 2 >= 0 && at.x + textWidth / 2 <= W;

describe('labelPlace', () => {
  test('in the open the name is centred just under its ring', () => {
    const at = labelPlace({ px: 500, py: 300, r: 20, textWidth: 50, width: W, height: H });
    assert.deepEqual(at, { x: 500, y: 325, baseline: 'top' });
  });

  test('at the right edge the name slides in to stay whole', () => {
    const at = labelPlace({ px: 980, py: 68, r: 24, textWidth: 50, width: W, height: H });
    assert.ok(inside(at, 50), JSON.stringify(at));
    assert.ok(at.x < 980);
  });

  test('at the left edge the same', () => {
    const at = labelPlace({ px: 5, py: 300, r: 24, textWidth: 60, width: W, height: H });
    assert.ok(inside(at, 60), JSON.stringify(at));
  });

  test('at the bottom edge the name goes above the ring', () => {
    const at = labelPlace({ px: 500, py: 588, r: 24, textWidth: 50, width: W, height: H });
    assert.equal(at.baseline, 'bottom');
    assert.ok(at.y <= 588 - 24 && at.y > 0, JSON.stringify(at));
  });

  test('it scales with the controls (k)', () => {
    const at = labelPlace({ px: 500, py: 300, r: 40, textWidth: 100, width: W, height: H, k: 2 });
    assert.deepEqual(at, { x: 500, y: 350, baseline: 'top' });
  });

  test('a window narrower than the name keeps its left end in view', () => {
    const at = labelPlace({ px: 20, py: 100, r: 10, textWidth: 80, width: 40, height: H });
    assert.ok(at.x - 40 >= 0);
  });
});
