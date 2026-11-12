import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, PALETTE_KEYS, paletteIndex, samplePalette, bakeLUT, paletteCSS } from '../../src/js/core/palettes.js';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('keys and names are unique; keys match PALETTE_KEYS', () => {
  assert.equal(new Set(PALETTE_KEYS).size, PALETTES.length);
  assert.equal(new Set(PALETTES.map((p) => p.name)).size, PALETTES.length);
  assert.deepEqual(PALETTE_KEYS, PALETTES.map((p) => p.key));
  for (const p of PALETTES) {
    assert.match(p.key, /^[a-z]+$/);
    assert.match(p.name, /^[A-Z][a-z]+$/);
  }
});

test('stops are valid colours, and none is near black (brightness comes from the light)', () => {
  for (const p of PALETTES) {
    assert.ok(p.stops.length >= 2, p.key);
    for (const s of p.stops) {
      assert.match(s, /^#[0-9a-f]{6}$/i, `${p.key} ${s}`);
      assert.ok(Math.max(...rgb(s)) >= 0x40, `${p.key} stop ${s} is near black`);
    }
  }
});

test('there is at least one palette marked safe for colour-vision deficiency', () => {
  assert.ok(PALETTES.some((p) => p.safe === true));
});

test('paletteIndex finds palettes and falls back to the first', () => {
  PALETTES.forEach((p, i) => assert.equal(paletteIndex(p.key), i));
  assert.equal(paletteIndex('nope'), 0);
  assert.equal(paletteIndex(undefined), 0);
});

test('samplePalette hits the stops and clamps t', () => {
  for (const p of PALETTES) {
    const n = p.stops.length;
    p.stops.forEach((s, i) => assert.deepEqual(samplePalette(p, i / (n - 1)), rgb(s), `${p.key} stop ${i}`));
    assert.deepEqual(samplePalette(p, -5), rgb(p.stops[0]));
    assert.deepEqual(samplePalette(p, 5), rgb(p.stops[n - 1]));
  }
  // halfway between the first two stops of a two-stop palette
  const mid = samplePalette({ stops: ['#000000', '#ff8040'] }, 0.5);
  assert.deepEqual(mid, [128, 64, 32]);
});

for (const width of [256, 64, 2]) {
  test(`bakeLUT(${width}): size, opaque, endpoints equal the end stops`, () => {
    const lut = bakeLUT(width);
    assert.equal(lut.width, width);
    assert.equal(lut.height, PALETTES.length);
    assert.ok(lut.data instanceof Uint8Array);
    assert.equal(lut.data.length, width * PALETTES.length * 4);
    for (let i = 3; i < lut.data.length; i += 4) assert.equal(lut.data[i], 255, `alpha at byte ${i}`);
    PALETTES.forEach((p, row) => {
      const at = (x) => Array.from(lut.data.subarray((row * width + x) * 4, (row * width + x) * 4 + 3));
      assert.deepEqual(at(0), rgb(p.stops[0]), `${p.key} first texel`);
      assert.deepEqual(at(width - 1), rgb(p.stops[p.stops.length - 1]), `${p.key} last texel`);
    });
  });
}

test('bakeLUT defaults to 256 texels per row', () => {
  assert.equal(bakeLUT().width, 256);
});

test('paletteCSS is a left-to-right gradient through every stop', () => {
  for (const p of PALETTES) {
    const css = paletteCSS(p);
    assert.ok(css.startsWith('linear-gradient(90deg, '), p.key);
    for (const s of p.stops) assert.ok(css.includes(s), `${p.key} ${s}`);
  }
});
