// The uniform structs: JavaScript must write each field where the shader reads it. A field
// out of step is silent on the GPU (it just reads the wrong number), so the field lists in
// layout.js are checked against the structs in the .wgsl files, and the offsets against
// WGSL's layout rules.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutOf, createUniforms, STRUCTS, FRAME, POLE, LEVEL, EXPOSURE, LOOK } from '../../src/renderer/engine/layout.js';

const SHADERS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/renderer/engine/shaders');

// The fields of `struct name { ... }` in a WGSL source, as [name, type] or [name, type, length].
function wgslStruct(src, name) {
  const code = src.replace(/\/\/[^\n]*/g, '');
  const m = new RegExp(`struct\\s+${name}\\s*\\{([^}]*)\\}`).exec(code);
  if (!m) return null;
  return [...m[1].matchAll(/(\w+)\s*:\s*(array<\s*(\w+)\s*,\s*(\d+)\s*>|[\w<>]+)\s*(?:,|$)/g)]
    .map((f) => (f[3] ? [f[1], f[3], Number(f[4])] : [f[1], f[2]]));
}

describe('uniform layouts', () => {
  for (const [name, { file, fields }] of Object.entries(STRUCTS)) {
    test(`${name} in layout.js matches struct ${name} in ${file}`, () => {
      const found = wgslStruct(fs.readFileSync(path.join(SHADERS, file), 'utf8'), name);
      assert.ok(found, `struct ${name} is declared in ${file}`);
      assert.deepEqual(fields.map((f) => (f.length === 3 ? f : f.slice(0, 2))), found);
    });
  }

  test('the parser reads what it is given', () => {
    const src = 'struct S {\n  a: f32,   // why\n  b: vec2f,\n  c: array<vec4f, 8>,\n};';
    assert.deepEqual(wgslStruct(src, 'S'), [['a', 'f32'], ['b', 'vec2f'], ['c', 'vec4f', 8]]);
  });

  test('WGSL alignment: vectors align to their size, vec3 to 16, arrays and structs to 16', () => {
    const l = layoutOf([['a', 'f32'], ['b', 'vec2f'], ['c', 'f32'], ['d', 'vec3f'], ['e', 'f32'], ['f', 'vec4f', 2], ['g', 'f32']]);
    assert.deepEqual(Object.fromEntries(Object.entries(l.fields).map(([k, v]) => [k, v.offset])), { a: 0, b: 8, c: 16, d: 32, e: 44, f: 48, g: 80 });
    assert.equal(l.size, 96);
    // an array of f32 in a uniform buffer has a 16-byte stride
    assert.equal(layoutOf([['x', 'f32', 4]]).size, 64);
  });

  test('the frame uniforms: a pole is 48 bytes, the poles come last, the whole is 3,648 bytes', () => {
    assert.equal(POLE.size, 48);
    assert.equal(FRAME.fields.viewProj.offset, 0);
    assert.equal(FRAME.fields.dt.offset, 112);
    assert.equal(FRAME.fields.initCount.offset, 244);
    assert.equal(FRAME.fields.pulses.offset, 256);
    assert.equal(FRAME.fields.poles.offset, 576);
    assert.equal(FRAME.fields.poles.stride, 48);
    assert.equal(FRAME.size, 576 + 64 * 48);
  });

  test('small structs round up to their alignment', () => {
    assert.equal(LEVEL.size, 24);
    assert.equal(EXPOSURE.size, 24);
    assert.equal(LOOK.size, 40);
  });

  test('the writer puts floats and integers at their offsets, in a buffer of whole 16-byte rows', () => {
    const u = createUniforms(FRAME);
    assert.equal(u.bytes.byteLength % 16, 0);
    assert.ok(u.bytes.byteLength >= FRAME.size);
    u.set('dt', 0.25);
    u.set('poleCount', 7.9);
    u.set('invRes', [0.5, 0.125]);
    const view = new DataView(u.bytes);
    assert.equal(view.getFloat32(112, true), 0.25);
    assert.equal(view.getUint32(FRAME.fields.poleCount.offset, true), 7);
    assert.equal(view.getFloat32(96, true), 0.5);
    assert.equal(view.getFloat32(100, true), 0.125);
    assert.equal(u.at('poles'), 576 / 4);
    assert.throws(() => u.set('nonsense', 1));
  });
});
