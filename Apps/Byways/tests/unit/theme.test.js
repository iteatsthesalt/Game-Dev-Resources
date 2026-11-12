import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAccessSettings } from '../../src/ui/theme.js';

test('applyAccessSettings sets data attributes and the text scale', () => {
  const root = { dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
  applyAccessSettings({ theme: 'high-contrast', font: 'atkinson', motion: 'reduced', textScale: 1.5 }, root);
  assert.deepEqual({ ...root.dataset }, { theme: 'high-contrast', font: 'atkinson', motion: 'reduced' });
  assert.equal(root.style.props['--text-scale'], '1.5');
  applyAccessSettings({ theme: 'neon', font: 'comic', motion: 'wild', textScale: 5 }, root);
  assert.deepEqual({ ...root.dataset }, { theme: 'system', font: 'system', motion: 'system' });
  assert.equal(root.style.props['--text-scale'], '2');
});
